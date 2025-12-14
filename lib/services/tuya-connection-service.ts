/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';
import TuyAPI from 'tuyapi';
import { promises as dnsPromises } from 'dns';
import { DeviceConstants } from '../constants';
import { TuyaErrorCategorizer, CategorizedError } from '../error-types';

export interface TuyaConnectionOptions {
  device: Homey.Device;
  logger?: (message: string, ...args: unknown[]) => void;
  onData?: (data: { dps: Record<number, unknown> }) => void;
  onDpRefresh?: (data: { dps: Record<number, unknown> }) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: CategorizedError) => void;
}

export interface TuyaDeviceConfig {
  id: string;
  key: string;
  ip: string;
  version?: string;
}

export interface ConnectionStatus {
  isConnected: boolean;
  lastConnected: number | null;
  lastDisconnected: number | null;
  consecutiveFailures: number;
  circuitBreakerOpen: boolean;
  backoffMultiplier: number;
  connectionAttempts: number;
}

export class TuyaConnectionService {
  private device: Homey.Device;
  private logger: (message: string, ...args: unknown[]) => void;
  private tuya: TuyAPI | null = null;
  private isConnected = false;

  // Connection status tracking (v0.99.47, enhanced v0.99.61 with timestamps)
  private currentStatus: 'connected' | 'disconnected' | 'reconnecting' | 'error' = 'disconnected';
  private lastStatusChangeTime: number = Date.now(); // Timestamp of last status change

  // Error recovery state
  private consecutiveFailures = 0;
  private backoffMultiplier = 1;
  private circuitBreakerOpen = false;
  private circuitBreakerOpenTime = 0;
  private circuitBreakerResetTime = 5 * 60 * 1000; // 5 minutes
  private maxBackoffSeconds = 300; // 5 minutes
  private connectionAttempts = 0;
  private passiveReconnectionAttempts = 0; // v1.0.12 - Track passive (find+connect) attempts

  // Persistent outage tracking (v1.0.5 - Proposal 1)
  private outageStartTime = 0; // When current outage began
  private totalOutageDuration = 0; // Cumulative outage duration
  private hasEverConnected = false; // Track if we've successfully connected at least once (v1.0.6 bugfix)

  // Next reconnection tracking (v1.0.6 - UX improvement)
  private nextReconnectionTime = 0; // When next reconnection attempt is scheduled
  private readonly MAX_RECONNECTION_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes guaranteed max (v1.0.6)

  // Circuit breaker cycle limit (v1.0.5 - Proposal 2)
  private circuitBreakerCycles = 0;
  private readonly MAX_CIRCUIT_BREAKER_CYCLES = 3; // 3 cycles = 15 min total

  // Time-based notification tracking (v1.0.5 - Proposal 5)
  private notificationSent2Min = false;
  private notificationSent10Min = false;
  private notificationSent30Min = false;

  // Intervals
  private reconnectInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private dpsRefreshInterval: NodeJS.Timeout | null = null; // v1.0.3

  // Data event tracking for zombie detection (v1.0.16)
  private lastDataEventReceived = 0;
  private waitingForDataEvent = false;
  private lastNotificationTime: number = 0;
  private lastNotificationKey: string | null = null;

  // Connection health tracking (v0.99.98)
  private lastDataEventTime: number = Date.now();
  private lastHeartbeatTime: number = 0;
  private heartbeatInProgress = false;
  private forceReconnectInProgress = false; // v1.0.31 - Prevent concurrent forceReconnect calls
  private queryInProgress = false; // v1.3.11 - Prevent concurrent TuyaAPI queries that cause disconnect events

  // Layer 0: Native heartbeat monitoring (v1.1.2)
  private lastNativeHeartbeatTime: number = 0;
  private nativeHeartbeatMonitorInterval: NodeJS.Timeout | null = null;
  private readonly NATIVE_HEARTBEAT_TIMEOUT_MS = 35000; // 35 seconds (TuyaAPI heartbeat is ~10s, allow 3.5x margin)

  // Diagnostic tracking for 06:35 disconnect investigation (v1.0.4)
  private lastDisconnectSource: string | null = null;
  private lastDisconnectTime: number = 0;

  // Device configuration storage for TuyAPI instance recreation (v1.3.8 - critical bugfix)
  // CRITICAL: Store config to allow TuyAPI instance recreation after disconnect() sets tuya=null
  // Without this, reconnection attempts silently fail when tuya is null (v1.0.36 regression)
  private deviceConfig: TuyaDeviceConfig | null = null;

  // Event handlers
  private onDataHandler?: (data: { dps: Record<number, unknown> }) => void;
  private onDpRefreshHandler?: (data: { dps: Record<number, unknown> }) => void;
  private onConnectedHandler?: () => void;
  private onDisconnectedHandler?: () => void;
  private onErrorHandler?: (error: CategorizedError) => void;

  /**
   * Manages a local Tuya device connection with reconnection/backoff, event handling,
   * and safe command dispatch.
   * @param options.device - owning Homey device
   * @param options.logger - optional logger function
   * @param options.onData - callback invoked when `data` events arrive
   * @param options.onDpRefresh - callback for `dp-refresh` events
   * @param options.onConnected/onDisconnected/onError - lifecycle callbacks
   */
  constructor(options: TuyaConnectionOptions) {
    this.device = options.device;
    this.logger = options.logger || (() => {});
    this.onDataHandler = options.onData;
    this.onDpRefreshHandler = options.onDpRefresh;
    this.onConnectedHandler = options.onConnected;
    this.onDisconnectedHandler = options.onDisconnected;
    this.onErrorHandler = options.onError;
  }

  /**
   * Initialize the underlying Tuya/TuyAPI instance using the provided config.
   * - Validates config and creates the `TuyAPI` instance.
   * - Does not necessarily connect immediately (see connectTuya()).
   * @param config - Tuya device config (id, key, ip, version)
   */
  async initialize(config: TuyaDeviceConfig): Promise<void> {
    this.logger('TuyaConnectionService: Initializing Tuya device connection');

    try {
      // Store config for TuyAPI instance recreation (v1.3.8 - critical bugfix)
      // CRITICAL: Allows reconnection after disconnect() sets tuya=null (v1.0.36 regression fix)
      this.deviceConfig = config;

      // Restore last connection timestamp AND status from store (persists across app updates)
      const storedTimestamp = await this.device.getStoreValue('last_connection_timestamp');
      const storedStatus = await this.device.getStoreValue('last_connection_status');

      if (storedTimestamp && typeof storedTimestamp === 'number') {
        const daysSinceLastConnection = (Date.now() - storedTimestamp) / (1000 * 60 * 60 * 24);
        // Only restore if less than 7 days old (prevent showing very stale timestamps)
        if (daysSinceLastConnection < 7) {
          this.lastStatusChangeTime = storedTimestamp;

          // Restore status if valid (v1.0.6 - prevents showing stale "disconnected" at startup)
          if (storedStatus && typeof storedStatus === 'string'
              && ['connected', 'disconnected', 'reconnecting', 'error'].includes(storedStatus)) {
            this.currentStatus = storedStatus as 'connected' | 'disconnected' | 'reconnecting' | 'error';
            this.logger(`TuyaConnectionService: Restored connection status '${storedStatus}' from ${new Date(storedTimestamp).toISOString()}`);
          } else {
            this.logger(`TuyaConnectionService: Restored timestamp from ${new Date(storedTimestamp).toISOString()}`);
          }
        } else {
          this.logger(`TuyaConnectionService: Stored timestamp too old (${Math.round(daysSinceLastConnection)} days), using current time`);
        }
      }

      // Create Tuya device instance
      this.tuya = new TuyAPI({
        id: config.id,
        key: config.key,
        ip: config.ip,
        version: config.version || '3.3',
      });

      this.setupTuyaEventHandlers();

      // Attempt initial connection
      await this.connectTuya();

      // Install deep socket error handler AFTER connection (v0.99.49)
      // CRITICAL: TuyAPI creates the .device object during .connect(), not during constructor
      // We must install the handler AFTER the socket is created
      this.installDeepSocketErrorHandler();

      // Install TCP keep-alive to prevent silent socket closes (v1.0.32)
      // NAT gateways/firewalls close idle TCP connections after 15-30 minutes
      // Keep-alive probes every 5 minutes to keep connection alive
      this.installTCPKeepAlive();

      // Start reconnection monitoring
      this.startReconnectInterval();

      // Start heartbeat monitoring (v0.99.98)
      this.startHeartbeat();

      // Start periodic DPS refresh to prevent idle timeouts (v1.0.3)
      this.startPeriodicDpsRefresh();

      this.logger('TuyaConnectionService: Initialization completed successfully');

    } catch (error) {
      this.logger('TuyaConnectionService: Error during initialization:', error);
      throw error;
    }
  }

  /**
   * Reinitialize TuyaConnectionService with new credentials (for repair mode).
   * - Disconnects and destroys the old Tuya instance
   * - Creates a new TuyAPI instance with updated credentials
   * - Reattaches event handlers and attempts connection
   * @param config - Updated Tuya device config (id, key, ip, version)
   */
  async reinitialize(config: TuyaDeviceConfig): Promise<void> {
    this.logger('TuyaConnectionService: Reinitializing with new credentials (repair mode)');

    try {
      // Step 1: Stop reconnection interval, heartbeat, DPS refresh to prevent interference
      this.stopReconnectInterval();
      this.stopHeartbeat();
      this.stopPeriodicDpsRefresh();

      // Step 2: Disconnect and cleanup old instance
      if (this.tuya) {
        this.logger('TuyaConnectionService: Cleaning up old Tuya instance');
        this.tuya.removeAllListeners();

        if (this.isConnected) {
          try {
            await this.tuya.disconnect();
          } catch (error) {
            this.logger('TuyaConnectionService: Error disconnecting old instance:', error);
          }
        }

        this.tuya = null;
        this.isConnected = false;
        await this.updateStatusTimestamp('disconnected');
      }

      // Step 3: Reset error recovery state for fresh start
      this.resetErrorRecoveryState();

      // Step 4: Store new config for future reconnections (v1.3.8)
      this.deviceConfig = config;

      // Step 5: Create new TuyAPI instance with new credentials
      this.logger('TuyaConnectionService: Creating new Tuya instance with updated credentials');
      this.tuya = new TuyAPI({
        id: config.id,
        key: config.key,
        ip: config.ip,
        version: config.version || '3.3',
      });

      // Step 5: Reattach event handlers
      this.setupTuyaEventHandlers();

      // Step 6: Attempt connection with new credentials
      this.logger('TuyaConnectionService: Attempting connection with new credentials');
      await this.connectTuya();

      // Step 7: Install deep socket error handler
      this.installDeepSocketErrorHandler();

      // Step 8: Restart reconnection monitoring
      this.startReconnectInterval();

      // Step 9: Restart heartbeat monitoring (v0.99.98)
      this.startHeartbeat();

      // Step 10: Restart periodic DPS refresh (v1.0.3)
      this.startPeriodicDpsRefresh();

      this.logger('TuyaConnectionService: Reinitialization completed successfully');
      this.logger(`TuyaConnectionService: Now using device ${config.id} at ${config.ip} (Protocol: ${config.version || '3.3'})`);

    } catch (error) {
      this.logger('TuyaConnectionService: Error during reinitialization:', error);

      // Even if connection fails, ensure reconnection monitoring is active
      this.startReconnectInterval();

      throw error;
    }
  }

  /**
   * Connect to the Tuya device and set up event handlers.
   * Uses a circuit breaker/backoff strategy on repeated failures.
   * Enhanced with wake-up mechanism for sleeping devices (v1.0.12).
   * v1.3.8: Recreates TuyAPI instance if null (fixes v1.0.36 regression)
   */
  async connectTuya(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    // v1.3.8 CRITICAL FIX: Recreate TuyAPI instance if null
    // Fixes v1.0.36 regression where disconnect() sets tuya=null but reconnection fails
    // because connectTuya() would return early without recreating the instance
    if (!this.tuya) {
      if (!this.deviceConfig) {
        this.logger('TuyaConnectionService: ❌ Cannot connect - device config not initialized');
        throw new Error('Cannot connect: device config not initialized');
      }

      this.logger('TuyaConnectionService: 🔄 Recreating TuyAPI instance (was null after disconnect)');
      this.tuya = new TuyAPI({
        id: this.deviceConfig.id,
        key: this.deviceConfig.key,
        ip: this.deviceConfig.ip,
        version: this.deviceConfig.version || '3.3',
      });

      // Reattach event handlers to new instance
      this.setupTuyaEventHandlers();
      this.logger('TuyaConnectionService: ✅ TuyAPI instance recreated, event handlers attached');
    }

    this.connectionAttempts++;
    this.passiveReconnectionAttempts++; // v1.0.12

    try {
      this.logger('TuyaConnectionService: Attempting connection...');

      // Install deep socket error handler PROACTIVELY before connection attempt (v1.0.33)
      // CRITICAL FIX: TuyAPI creates the internal TCP socket during find()/connect() calls
      // without our error handler attached yet. This race condition window allows ECONNRESET
      // to occur on the unprotected socket and become an unhandled rejection (crash report).
      // Installing the handler here (before any socket operations) prevents the crash.
      this.installDeepSocketErrorHandler();

      // v1.0.12: Progressive reconnection strategy
      // After WAKE_UP_ATTEMPT_THRESHOLD failed passive attempts, try active wake-up first
      const shouldTryWakeUp = this.passiveReconnectionAttempts >= DeviceConstants.WAKE_UP_ATTEMPT_THRESHOLD;

      if (shouldTryWakeUp) {
        this.logger(`TuyaConnectionService: 🔔 Attempting wake-up (after ${this.passiveReconnectionAttempts} passive attempts)...`);

        try {
          // Get current onoff state for idempotent write
          const currentOnOff = this.device.getCapabilityValue('onoff') || false;

          // Attempt wake-up with timeout
          let wakeUpTimeoutHandle: NodeJS.Timeout | null = null;
          try {
            await Promise.race([
              this.tuya.set({ dps: 1, set: currentOnOff }), // Idempotent write
              new Promise((_, reject) => {
                wakeUpTimeoutHandle = this.device.homey.setTimeout(
                  () => reject(new Error('Wake-up timeout')),
                  DeviceConstants.WAKE_UP_TIMEOUT_MS,
                );
              }),
            ]);

            // Wake-up successful! Device is responsive
            this.logger('TuyaConnectionService: ✅ Wake-up successful - device responsive to commands');

            // Now connect normally (device should be awake and discoverable)
            await this.tuya.find();
            await this.tuya.connect();

          } finally {
            if (wakeUpTimeoutHandle) {
              clearTimeout(wakeUpTimeoutHandle);
            }
          }

        } catch (wakeUpError) {
          // Wake-up failed - fall back to standard passive reconnection
          this.logger(`TuyaConnectionService: ⚠️ Wake-up failed: ${wakeUpError} - trying passive reconnection...`);

          // Continue with standard passive discovery
          await this.tuya.find();
          await this.tuya.connect();
        }

      } else {
        // Standard passive reconnection (first 5 attempts)
        this.logger(`TuyaConnectionService: Passive reconnection attempt ${this.passiveReconnectionAttempts}/${DeviceConstants.WAKE_UP_ATTEMPT_THRESHOLD}...`);

        // Discover the device on the network first
        await this.tuya.find();

        // Then connect to the device
        await this.tuya.connect();
      }

      this.isConnected = true;
      this.hasEverConnected = true; // Mark successful connection (v1.0.6)
      this.logger('TuyaConnectionService: Connected to Tuya device successfully');

      // Synchronously update status to prevent race condition with initializeConnectionStatusTracking() (v1.0.6)
      await this.updateStatusTimestamp('connected');

      // Install deep socket error handler after successful connection (v0.99.49)
      // CRITICAL: Must reinstall after every reconnection because TuyAPI recreates the socket
      this.installDeepSocketErrorHandler();

      // Install TCP keep-alive after successful connection (v1.0.32)
      // CRITICAL: Must reinstall after every reconnection because TuyAPI recreates the socket
      this.installTCPKeepAlive();

      // Update timestamp immediately on successful connection (v1.0.25)
      // Zombie detection handled by heartbeat mechanism (5min interval) + DPS refresh (3min interval)
      // Pre-v1.0.18 health check was causing false-positive unavailable states on slow networks
      this.lastDataEventTime = Date.now();
      this.logger('✅ TuyaConnectionService: Connection verified and healthy');

    } catch (error) {
      const categorizedError = this.handleTuyaError(error as Error, 'Tuya device connection');

      // Notify error handler
      if (this.onErrorHandler) {
        this.onErrorHandler(categorizedError);
      }

      // Send user notification for non-recoverable errors
      if (!categorizedError.recoverable) {
        await this.sendCriticalNotification(
          'Device Connection Failed',
          categorizedError.userMessage,
        );
      }

      throw categorizedError;
    }
  }

  /**
   * Disconnect from Tuya and cleanup event handlers.
   */
  async disconnect(): Promise<void> {
    if (this.tuya && this.isConnected) {
      try {
        // Stop Layer 0 monitoring before disconnecting
        this.stopNativeHeartbeatMonitoring();

        this.tuya.removeAllListeners();
        await this.tuya.disconnect();
        this.isConnected = false;
        this.tuya = null; // CRITICAL FIX (v1.0.36): Clear stale TuyAPI instance to allow fresh reconnection
        this.logger('TuyaConnectionService: Disconnected from Tuya device');
      } catch (error) {
        this.logger('TuyaConnectionService: Error during disconnect:', error);
      }
    }
  }

  /**
   * Verify connection health after reconnection (v1.0.18).
   * Confirms that both the socket is responsive AND data events are actually firing.
   * This prevents zombie connections (open socket but no data flow).
   *
   * @returns true if connection is healthy (data event received), false otherwise
   */
  private async verifyConnectionHealth(): Promise<boolean> {
    const preQueryDataTime = this.lastDataEventReceived;

    try {
      this.logger('TuyaConnectionService: Verifying connection health with DPS query...');
      await this.tuya!.get({ schema: true });

      // Wait for data event to fire (v1.0.24: increased to 10s from 2s to handle high-latency networks)
      const startWait = Date.now();
      while (Date.now() - startWait < DeviceConstants.HEARTBEAT_DATA_EVENT_TIMEOUT_MS) {
        if (this.lastDataEventReceived > preQueryDataTime) {
          this.logger('✅ Connection health verified - data event received');
          return true;
        }

        await new Promise((resolve) => {
          this.device.homey.setTimeout(resolve, 100);
        });
      }

      this.logger(`❌ Connection health check failed - no data event received within ${DeviceConstants.HEARTBEAT_DATA_EVENT_TIMEOUT_MS / 1000}s`);
      return false;
    } catch (error) {
      this.logger('❌ Connection health check error:', error);
      return false;
    }
  }

  /**
   * Force immediate reconnection to the device (v0.99.66).
   * Bypasses automatic reconnection delays, resets error recovery state, and attempts fresh connection.
   * Use this when user manually triggers reconnection from device settings.
   * @returns Promise that resolves when reconnection attempt completes (success or failure)
   */
  async forceReconnect(): Promise<void> {
    // Prevent concurrent forceReconnect calls (v1.0.31)
    if (this.forceReconnectInProgress) {
      this.logger('TuyaConnectionService: Force reconnect already in progress, skipping duplicate call');
      return;
    }

    this.forceReconnectInProgress = true;
    try {
      await this.forceReconnectImpl();
    } finally {
      this.forceReconnectInProgress = false;
    }
  }

  private async forceReconnectImpl(): Promise<void> {
    this.logger('TuyaConnectionService: Force reconnect triggered by user');

    // Step 1: Stop any pending reconnection attempts, heartbeat, and DPS refresh
    this.stopReconnectInterval();
    this.stopHeartbeat();
    this.stopPeriodicDpsRefresh();

    // Step 2: Disconnect cleanly from current connection (if any)
    await this.disconnect();

    // Step 2.5: Stabilization delay to allow socket cleanup (v1.0.18)
    // CRITICAL: Prevents reusing corrupted socket state immediately after disconnect
    await new Promise((resolve) => {
      this.device.homey.setTimeout(resolve, 2000);
    });
    this.logger('TuyaConnectionService: Socket stabilization delay complete - proceeding with reconnection');

    // Step 3: Reset all error recovery state (bypass backoff/circuit breaker)
    this.resetErrorRecoveryState();
    this.logger('TuyaConnectionService: Error recovery state reset - ready for fresh connection');

    // Step 4: Attempt immediate reconnection
    let connectSuccess = false;
    try {
      await this.connectTuya();
      connectSuccess = true;
      this.logger('TuyaConnectionService: Force reconnect successful - intervals resumed');
    } catch (error) {
      this.logger('TuyaConnectionService: Force reconnect attempt failed, triggering normal reconnection loop:', error);

      // CRITICAL FIX (v1.0.31): Mark as disconnected and trigger reconnection loop
      // This ensures failures don't silently restart intervals with device still offline
      this.isConnected = false;
      this.consecutiveFailures++;

      // Let the normal reconnection loop handle retry with proper backoff
      this.scheduleNextReconnectionAttempt();
      return; // Exit early - don't restart intervals
    }

    // Step 5: Resume normal reconnection monitoring, heartbeat, and DPS refresh
    // ONLY if connection was successful
    if (connectSuccess) {
      this.startReconnectInterval();
      this.startHeartbeat();
      this.startPeriodicDpsRefresh();
    }
  }

  /**
   * Send a command to the device in DPS format (map from number to value).
   * Accepts string, number, or boolean values as required by different DPS types.
   * Throws if not connected or on underlying send error.
   */
  async sendCommand(dps: Record<number, string | number | boolean>): Promise<void> {
    if (!this.tuya || !this.isConnected) {
      throw new Error('Device not connected');
    }

    // v1.3.11: Wait for existing query to complete (max 5 seconds for poor WiFi conditions)
    const maxWaitMs = 5000;
    const startWait = Date.now();
    while (this.queryInProgress && (Date.now() - startWait) < maxWaitMs) {
      await new Promise((resolve) => {
        this.device.homey.setTimeout(resolve, 100); // Wait 100ms between checks
      });
    }

    if (this.queryInProgress) {
      this.logger('TuyaConnectionService: ⚠️ Query still in progress after 3s wait, proceeding anyway');
    }

    // Set query lock
    this.queryInProgress = true;

    try {
      await this.tuya.set({ multiple: true, data: dps });
      this.logger('TuyaConnectionService: Command sent successfully:', dps);
    } catch (error) {
      const categorizedError = this.handleTuyaError(error as Error, 'Send command');
      this.logger('TuyaConnectionService: Error sending command:', categorizedError.userMessage);
      throw categorizedError;
    } finally {
      // v1.3.11: Release query lock
      this.queryInProgress = false;
    }
  }

  /**
   * Return current connection status information useful for diagnostics.
   */
  getConnectionStatus(): ConnectionStatus {
    return {
      isConnected: this.isConnected,
      lastConnected: null, // Would need to track this
      lastDisconnected: null, // Would need to track this
      consecutiveFailures: this.consecutiveFailures,
      circuitBreakerOpen: this.circuitBreakerOpen,
      backoffMultiplier: this.backoffMultiplier,
      connectionAttempts: this.connectionAttempts,
    };
  }

  /**
   * Get the current connection status enum value for adlar_connection_status capability.
   * @returns One of: 'connected', 'disconnected', 'reconnecting', 'error'
   */
  getCurrentConnectionStatus(): 'connected' | 'disconnected' | 'reconnecting' | 'error' {
    return this.currentStatus;
  }

  /**
   * Format time interval in human-readable format (v1.0.6 - UX improvement).
   * @param seconds - Time interval in seconds
   * @returns Formatted string like "2m 30s" or "45s"
   */
  private formatTimeInterval(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  }

  /**
   * Get formatted connection status with timestamp for display (v0.99.61, localized v0.99.68).
   * Enhanced with outage duration and circuit breaker info (v1.0.5 - Proposal 4).
   * Enhanced to always show next reconnection time (v1.0.6 - UX improvement).
   * Format: "Status (HH:MM:SS)" or "Status (DD-MM HH:MM)" for older timestamps
   * @returns Formatted status string with timestamp in local timezone
   */
  getFormattedConnectionStatus(): string {
    // Get localized status label
    const statusLabel = this.device.homey.__(`connection_status.${this.currentStatus}`);

    // Add context for outage duration and next reconnection time (v1.0.5, enhanced v1.0.6)
    let contextInfo = '';
    const now = Date.now();

    // Show outage duration for disconnected/error states
    if ((this.currentStatus === 'disconnected' || this.currentStatus === 'error') && this.outageStartTime > 0) {
      const outageMinutes = Math.floor((now - this.outageStartTime) / 60000);
      contextInfo = ` [${outageMinutes} min`;

      // Add next reconnection time if scheduled
      if (this.nextReconnectionTime > now) {
        const secondsUntilRetry = Math.ceil((this.nextReconnectionTime - now) / 1000);
        contextInfo += `, retry in ${this.formatTimeInterval(secondsUntilRetry)}`;
      }
      contextInfo += ']';
    } else if (this.currentStatus === 'reconnecting') {
      // Show countdown for reconnecting state
      if (this.circuitBreakerOpen) {
        const remainingCooldown = Math.ceil(
          (this.circuitBreakerResetTime - (now - this.circuitBreakerOpenTime)) / 1000,
        );
        contextInfo = ` [retry in ${this.formatTimeInterval(remainingCooldown)}]`;
      } else if (this.nextReconnectionTime > now) {
        const secondsUntilRetry = Math.ceil((this.nextReconnectionTime - now) / 1000);
        contextInfo = ` [retry in ${this.formatTimeInterval(secondsUntilRetry)}]`;
      }
    }

    // Create timestamp in local timezone (not UTC)
    const timestamp = new Date(this.lastStatusChangeTime);
    const nowDate = new Date();

    // Get Homey's configured timezone (fallback to auto-detection)
    // Homey stores timezone in system settings, prefer this over Node.js process timezone
    const homeyTimezone = this.device.homey.clock.getTimezone() || Intl.DateTimeFormat().resolvedOptions().timeZone;

    // If status changed today, show only time (HH:MM:SS)
    // If status changed on a different day, show date and time (D-MMM HH:MM)
    const isSameDay = timestamp.toDateString() === nowDate.toDateString();

    // Detect language from Homey (support en, nl, de, fr with fallback to 'en')
    const detectedLanguage = this.device.homey.i18n.getLanguage();
    const supportedLanguages = ['en', 'nl', 'de', 'fr'] as const;
    type SupportedLanguage = typeof supportedLanguages[number];
    const language: SupportedLanguage = supportedLanguages.includes(detectedLanguage as SupportedLanguage)
      ? (detectedLanguage as SupportedLanguage)
      : 'en';

    let timeString: string;
    if (isSameDay) {
      // Same day: show only time in Homey's configured timezone
      timeString = timestamp.toLocaleTimeString(language, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: homeyTimezone, // Use Homey's timezone
      });
    } else {
      // Different day: show date and time with short month abbreviation
      // Format: "3-Oct 14:25" (English), "3-okt 14:25" (Dutch), "3-Okt 14:25" (German), "3-oct 14:25" (French)
      const monthAbbreviations: Record<SupportedLanguage, string[]> = {
        en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        nl: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
        de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
        fr: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
      };

      const monthAbbr = monthAbbreviations[language][timestamp.getMonth()];
      const day = timestamp.getDate();
      const time = timestamp.toLocaleTimeString(language, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: homeyTimezone, // Use Homey's timezone
      });

      timeString = `${day}-${monthAbbr} ${time}`;
    }

    return `${statusLabel}${contextInfo} (${timeString})`;
  }

  /**
   * Update status change timestamp and persist to device store (v0.99.63).
   * This ensures the timestamp survives app updates and restarts.
   * IMPORTANT: Only updates timestamp if status actually changes (prevents overwriting restored timestamps)
   * @param newStatus - The new connection status
   */
  private async updateStatusTimestamp(newStatus: 'connected' | 'disconnected' | 'reconnecting' | 'error'): Promise<void> {
    // Only update timestamp if status actually changed
    if (this.currentStatus === newStatus) {
      // Status unchanged - preserve existing timestamp (important for app updates)
      this.logger(`TuyaConnectionService: Status unchanged (${newStatus}), preserving timestamp`);
      return;
    }

    // Status changed - update both status and timestamp
    this.currentStatus = newStatus;
    this.lastStatusChangeTime = Date.now();

    this.logger(`TuyaConnectionService: Status changed to ${newStatus}, updating timestamp`);

    // Update boolean capability for insights tracking (v1.0.12)
    const isConnected = (newStatus === 'connected');
    try {
      await this.device.setCapabilityValue('adlar_connection_active', isConnected);
    } catch (error) {
      this.logger(`TuyaConnectionService: Failed to update connection_active capability: ${error}`);
      // Non-critical error, continue operation
    }

    // Update disconnect source capability for timeline visibility (v1.0.37+)
    if (newStatus === 'disconnected' && this.lastDisconnectSource) {
      try {
        // Only update if capability exists (added in v1.0.37+)
        if (this.device.hasCapability('adlar_disconnect_source')) {
          await this.device.setCapabilityValue('adlar_disconnect_source', this.lastDisconnectSource);
          this.logger(`TuyaConnectionService: Disconnect source updated to: ${this.lastDisconnectSource}`);
        }
      } catch (error) {
        this.logger(`TuyaConnectionService: Failed to update disconnect_source capability: ${error}`);
        // Non-critical error, continue operation
      }
    }

    // Persist both timestamp AND status to device store (survives app updates) - v1.0.6
    try {
      await this.device.setStoreValue('last_connection_timestamp', this.lastStatusChangeTime);
      await this.device.setStoreValue('last_connection_status', this.currentStatus);
      // Also persist disconnect source for diagnostics
      if (this.lastDisconnectSource) {
        await this.device.setStoreValue('last_disconnect_source', this.lastDisconnectSource);
      }
    } catch (error) {
      this.logger(`TuyaConnectionService: Failed to persist connection state: ${error}`);
      // Non-critical error, continue operation
    }
  }

  /**
   * Return the underlying Tuya/TuyAPI instance if available (nullable).
   */
  getTuyaInstance(): TuyAPI | null {
    return this.tuya;
  }

  /**
   * Whether the service currently considers the device connected.
   */
  isDeviceConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Install deep socket error handler to intercept TuyAPI internal socket errors (v0.99.49)
   *
   * CRITICAL FIX: TuyAPI library's internal socket can throw ECONNRESET errors that bypass
   * our standard .on('error') handler. This method accesses TuyAPI's internal .client property
   * (the raw TCP socket) and attaches error handlers directly to prevent crashes.
   *
   * Error from socket: read ECONNRESET at /app/node_modules/tuyapi/index.js:688:26
   * This error occurs when the Tuya device abruptly closes the TCP connection without
   * proper shutdown, causing Node.js to emit ECONNRESET on the raw socket.
   *
   * TIMING: Must be called AFTER this.tuya.connect() because TuyAPI creates the .client socket
   * during connection (line 619: this.client = new net.Socket()), not during constructor.
   * Should be called after every reconnection.
   */
  private installDeepSocketErrorHandler(): void {
    if (!this.tuya) {
      this.logger('TuyaConnectionService: Cannot install socket error handler - TuyAPI not initialized');
      return;
    }

    try {
      // Access TuyAPI's internal socket object (the raw TCP socket)
      // @ts-expect-error - Accessing private TuyAPI internals for crash prevention
      const tuyaSocket = this.tuya.client;

      if (tuyaSocket) {
        // Remove any existing error listeners to prevent duplicates (idempotent)
        tuyaSocket.removeAllListeners('error');

        // Install error handler on TuyAPI's internal socket
        // This catches socket-level errors (ECONNRESET, etc.) BEFORE they bubble up
        tuyaSocket.on('error', (error: Error) => {
          this.logger('TuyaConnectionService: 🛡️ Deep socket error intercepted (crash prevented):', error.message);

          // Categorize the error for proper handling
          const categorizedError = TuyaErrorCategorizer.categorize(error, 'Deep socket error');

          // Mark as disconnected
          this.isConnected = false;
          this.updateStatusTimestamp('disconnected').catch((err) => {
            this.logger('TuyaConnectionService: Failed to update status timestamp:', err);
          });

          // Apply recovery strategy
          if (!categorizedError.recoverable) {
            this.updateStatusTimestamp('error').catch((err) => {
              this.logger('TuyaConnectionService: Failed to update status timestamp:', err);
            });
          }

          // Trigger reconnection via our standard system
          this.scheduleNextReconnectionAttempt();

          this.logger('TuyaConnectionService: Deep socket error handled gracefully - reconnection scheduled');
        });

        this.logger('TuyaConnectionService: ✅ Deep socket error handler installed successfully on TuyAPI socket');
      } else {
        this.logger('TuyaConnectionService: ⚠️ TuyAPI socket not yet created - handler will be installed after connect()');
      }
    } catch (error) {
      // If we can't install the deep handler, log but don't crash
      this.logger('TuyaConnectionService: ⚠️ Could not install deep socket error handler:', error);
      this.logger('TuyaConnectionService: Falling back to standard error handling');
    }
  }

  /**
   * Install TCP keep-alive on the underlying socket to prevent silent NAT/firewall closes (v1.0.32).
   *
   * PROBLEM: NAT gateways and ISP firewalls silently close idle TCP connections after 15-30 minutes
   * of inactivity. Without keep-alive, the socket appears "connected" but is actually dead.
   *
   * SOLUTION: Enable OS-level TCP keep-alive with 5-minute idle threshold. This sends periodic
   * probe packets to detect and prevent silent closes before app thinks connection is alive.
   *
   * IMPORTANT: Must be called AFTER this.tuya.connect() because the socket is created during
   * connection, not during constructor.
   */
  private installTCPKeepAlive(): void {
    if (!this.tuya) {
      this.logger('TuyaConnectionService: Cannot install TCP keep-alive - TuyAPI not initialized');
      return;
    }

    try {
      // Access TuyAPI's internal TCP socket
      // @ts-expect-error - Accessing private TuyAPI internals for TCP keep-alive
      const tuyaSocket = this.tuya.client;

      if (tuyaSocket) {
        // Enable TCP keep-alive with 5-minute idle threshold
        // This tells the OS to probe the socket if idle for 5 minutes
        // If probe fails, connection is marked dead and reconnection triggered
        tuyaSocket.setKeepAlive(true, 5 * 60 * 1000); // 5 minutes = 300,000 ms

        this.logger('TuyaConnectionService: ✅ TCP keep-alive enabled (5-minute idle probe)');
      } else {
        this.logger('TuyaConnectionService: ⚠️ TuyAPI socket not yet created - keep-alive will be installed after reconnect');
      }
    } catch (error) {
      // If we can't install keep-alive, log but don't crash
      this.logger('TuyaConnectionService: ⚠️ Could not install TCP keep-alive:', error);
      this.logger('TuyaConnectionService: Device may experience disconnections during extended idle periods');
    }
  }

  /**
   * Attach internal event handlers to the underlying Tuya instance:
   * - 'data', 'dp-refresh', 'error', 'connected', 'disconnected'
   */
  private setupTuyaEventHandlers(): void {
    if (!this.tuya) {
      throw new Error('Cannot setup event handlers: Tuya device not initialized');
    }

    // CRITICAL: Remove all existing listeners before adding new ones (v1.0.20)
    // This prevents duplicate listeners that accumulate on reconnect attempts
    // Without this, each reconnect adds another listener, causing conflicts
    this.tuya.removeAllListeners();

    // Error event - handle socket errors to prevent app crashes
    this.tuya.on('error', (error: Error): void => {
      // Enhanced diagnostic logging (v1.0.4)
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      const errorMsg = error?.message || String(error);

      this.logger(`⚠️ TuyaConnectionService: Socket error at ${timeStr}: ${errorMsg}`);
      this.lastDisconnectSource = `socket_error: ${errorMsg}`;
      this.lastDisconnectTime = Date.now();

      const categorizedError = this.handleTuyaError(error, 'TuyAPI socket error');

      // Mark device as disconnected for socket connection errors
      this.isConnected = false;

      // Send specific notification about socket error
      this.sendCriticalNotification(
        'Socket Error Disconnect',
        `Socket fout om ${timeStr}: ${errorMsg}. ${categorizedError.recoverable ? 'Automatisch herverbinden...' : 'Handmatige interventie mogelijk vereist.'}`,
      ).catch((err) => {
        this.logger('Failed to send socket error notification:', err);
      });

      // Update recovery strategy based on error type
      if (!categorizedError.recoverable) {
        this.backoffMultiplier = Math.min(this.backoffMultiplier * 1.5, 8);
        this.logger(`TuyaConnectionService: Non-recoverable socket error detected, applying immediate backoff: ${this.backoffMultiplier}x`);
      }

      // Notify error handler
      if (this.onErrorHandler) {
        this.onErrorHandler(categorizedError);
      }

      this.logger('TuyaConnectionService: TuyAPI error handled gracefully, enhanced recovery system will manage reconnection');
    });

    // Data event - device data updates
    this.tuya.on('data', (data: { dps: Record<number, unknown> }): void => {
      const dpsFetched = data.dps || {};
      this.logger('TuyaConnectionService: Data received from Tuya:', dpsFetched);

      // Update last data event timestamp (v0.99.98 - stale connection detection)
      this.lastDataEventTime = Date.now();

      // Track data event reception for zombie detection (v1.0.16)
      this.lastDataEventReceived = Date.now();
      this.waitingForDataEvent = false;

      // Forward to data handler only if dps is valid (v0.99.63 - crash fix)
      if (this.onDataHandler && data.dps && typeof data.dps === 'object') {
        this.onDataHandler(data);
      } else if (this.onDataHandler && !data.dps) {
        this.logger('TuyaConnectionService: Skipping data handler - received event with null/undefined dps');
      }
    });

    // DP-Refresh event - device data refresh
    this.tuya.on('dp-refresh', (data: { dps: Record<number, unknown> }): void => {
      const dpsFetched = data.dps || {};
      this.logger('TuyaConnectionService: DP-Refresh received from Tuya:', dpsFetched);

      // Update last data event timestamp (v0.99.98 - stale connection detection)
      this.lastDataEventTime = Date.now();

      // Forward to dp-refresh handler only if dps is valid (v0.99.63 - crash fix)
      if (this.onDpRefreshHandler && data.dps && typeof data.dps === 'object') {
        this.onDpRefreshHandler(data);
      } else if (this.onDpRefreshHandler && !data.dps) {
        this.logger('TuyaConnectionService: Skipping dp-refresh handler - received event with null/undefined dps');
      }
    });

    // Connected event
    this.tuya.on('connected', (): void => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      // Enhanced recovery logging with layer detection context
      if (this.lastDisconnectSource) {
        this.logger('╔═══════════════════════════════════════════════════╗');
        this.logger(`║ ✅ [RECOVERY] CONNECTION RESTORED at ${timeStr} ║`);
        this.logger('╠═══════════════════════════════════════════════════╣');
        this.logger(`║  Previous disconnect: ${this.lastDisconnectSource}`);
        if (this.lastDisconnectTime > 0) {
          const outageSeconds = Math.round((Date.now() - this.lastDisconnectTime) / 1000);
          this.logger(`║  Outage duration: ${outageSeconds}s`);
        }
        this.logger('╚═══════════════════════════════════════════════════╝');
      } else {
        this.logger(`TuyaConnectionService: ✅ Device connected at ${timeStr}`);
      }

      this.isConnected = true;
      this.hasEverConnected = true; // Mark that we've successfully connected at least once (v1.0.6 bugfix)
      this.updateStatusTimestamp('connected').catch((err) => {
        this.logger('TuyaConnectionService: Failed to update status timestamp:', err);
      });

      // Reset error recovery state on successful connection
      this.resetErrorRecoveryState();

      // Start Layer 0 native heartbeat monitoring (v1.1.2)
      this.startNativeHeartbeatMonitoring();

      // Notify connected handler
      if (this.onConnectedHandler) {
        this.onConnectedHandler();
      }
    });

    // Layer 0: Native heartbeat event (v1.1.2)
    // TuyaAPI sends heartbeat every ~10 seconds when connected
    // This is the fastest disconnection detection layer
    this.tuya.on('heartbeat', (): void => {
      this.lastNativeHeartbeatTime = Date.now();
      this.logger('💓 Native heartbeat received');
    });

    // Disconnected event
    this.tuya.on('disconnected', (): void => {
      // Enhanced diagnostic logging (v1.0.4)
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      const timeSinceLastData = Date.now() - this.lastDataEventTime;

      this.logger(`🔴 TuyaConnectionService: Device disconnected at ${timeStr} (no data for ${Math.round(timeSinceLastData / 1000)}s)`);
      this.lastDisconnectSource = `tuya_disconnected_event (idle: ${Math.round(timeSinceLastData / 1000)}s)`;
      this.lastDisconnectTime = Date.now();

      // Send specific notification about TuyAPI disconnect event
      this.sendCriticalNotification(
        'TuyAPI Disconnect Event',
        `Device verbroken om ${timeStr}. Geen data ontvangen voor ${Math.round(timeSinceLastData / 1000)}s. Automatisch herverbinden...`,
      ).catch((err) => {
        this.logger('Failed to send disconnect notification:', err);
      });

      this.isConnected = false;
      this.updateStatusTimestamp('disconnected').catch((err) => {
        this.logger('TuyaConnectionService: Failed to update status timestamp:', err);
      });

      // Apply minimal backoff for clean disconnections
      this.backoffMultiplier = Math.min(this.backoffMultiplier * 1.2, 4);

      // Notify disconnected handler
      if (this.onDisconnectedHandler) {
        this.onDisconnectedHandler();
      }
    });
  }

  /**
   * Start the reconnect loop/interval; uses scheduleNextReconnectionAttempt to adapt.
   */
  private startReconnectInterval(): void {
    // Clear any existing interval
    this.stopReconnectInterval();

    // Start enhanced reconnection with adaptive interval
    this.scheduleNextReconnectionAttempt();
  }

  /**
   * Stop any pending reconnect interval or timer.
   */
  private stopReconnectInterval(): void {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  /**
   * Start heartbeat monitoring to proactively detect zombie connections (v0.99.98).
   * Uses intelligent skip logic to avoid unnecessary network traffic when device is active.
   */
  private startHeartbeat(): void {
    // Clear any existing heartbeat
    this.stopHeartbeat();

    this.logger(`TuyaConnectionService: Starting heartbeat monitoring (interval: ${DeviceConstants.CONNECTION_HEARTBEAT_INTERVAL_MS / 1000}s)`);

    this.heartbeatInterval = this.device.homey.setInterval(() => {
      this.performHeartbeat().catch((error) => {
        this.logger('TuyaConnectionService: Heartbeat error:', error);
        // Error handling is done within performHeartbeat, this catch prevents unhandled rejection
      });
    }, DeviceConstants.CONNECTION_HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stop heartbeat monitoring.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Start Layer 0 native heartbeat monitoring (v1.1.2).
   * Monitors TuyaAPI's native heartbeat event to detect connection loss within 35 seconds.
   * This is the fastest disconnection detection layer (Layer 0).
   */
  private startNativeHeartbeatMonitoring(): void {
    // Clear any existing monitor
    this.stopNativeHeartbeatMonitoring();

    // Initialize timestamp
    this.lastNativeHeartbeatTime = Date.now();

    this.logger('🔵 TuyaConnectionService: Starting Layer 0 native heartbeat monitoring (timeout: 35s)');

    // Check every 10 seconds if native heartbeats have stopped
    this.nativeHeartbeatMonitorInterval = this.device.homey.setInterval(() => {
      if (!this.isConnected) {
        return; // Skip check if already disconnected
      }

      const timeSinceLastHeartbeat = Date.now() - this.lastNativeHeartbeatTime;
      const timeSinceLastData = Date.now() - this.lastDataEventTime;

      // DIAGNOSTIC: Log health check every interval
      this.logger(`🔍 Layer 0 Health Check: Heartbeat ${Math.round(timeSinceLastHeartbeat / 1000)}s ago, Data ${Math.round(timeSinceLastData / 1000)}s ago`);

      if (timeSinceLastHeartbeat > this.NATIVE_HEARTBEAT_TIMEOUT_MS) {
        // Native heartbeats have stopped - connection is dead
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

        this.logger('╔═══════════════════════════════════════════════════╗');
        this.logger(`║ 🔴 [LAYER 0] ZOMBIE DETECTED at ${timeStr}      ║`);
        this.logger('╠═══════════════════════════════════════════════════╣');
        this.logger(`║  Last heartbeat: ${Math.round(timeSinceLastHeartbeat / 1000)}s ago (threshold: 35s)`);
        this.logger(`║  Last data event: ${Math.round(timeSinceLastData / 1000)}s ago`);
        this.logger(`║  Consecutive failures: ${this.consecutiveFailures}`);
        this.logger(`║  Backoff multiplier: ${this.backoffMultiplier}x`);
        this.logger('╠═══════════════════════════════════════════════════╣');
        this.logger('║  🔄 Triggering reconnection attempt...');
        this.logger('╚═══════════════════════════════════════════════════╝');

        // Mark as disconnected
        this.isConnected = false;
        this.lastDisconnectSource = `layer0_native_heartbeat_timeout (${Math.round(timeSinceLastHeartbeat / 1000)}s)`;
        this.lastDisconnectTime = Date.now();

        // Update status timestamp (fire-and-forget)
        this.updateStatusTimestamp('disconnected').catch((err) => {
          this.logger('Failed to update status timestamp:', err);
        });

        // Trigger reconnection
        this.consecutiveFailures++;
        this.logger(`➡️  Layer 0: Calling scheduleNextReconnectionAttempt() (failures: ${this.consecutiveFailures})`);
        this.scheduleNextReconnectionAttempt();

        // Notify handlers
        if (this.onDisconnectedHandler) {
          this.onDisconnectedHandler();
        }
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Stop Layer 0 native heartbeat monitoring.
   */
  private stopNativeHeartbeatMonitoring(): void {
    if (this.nativeHeartbeatMonitorInterval) {
      clearInterval(this.nativeHeartbeatMonitorInterval);
      this.nativeHeartbeatMonitorInterval = null;
    }
  }

  /**
   * Start periodic DPS refresh to prevent heartbeat timeouts during idle periods (v1.0.3).
   * This queries device state every 3 minutes to keep lastDataEventTime current,
   * ensuring heartbeat probes are skipped even when device is idle or externally controlled.
   * Enhanced with zombie detection (v1.0.17) - verifies data events actually fire after query.
   */
  private startPeriodicDpsRefresh(): void {
    // Clear existing interval if any
    this.stopPeriodicDpsRefresh();

    this.logger(`TuyaConnectionService: Starting periodic DPS refresh (interval: ${DeviceConstants.DPS_REFRESH_INTERVAL_MS / 1000}s)`);

    this.dpsRefreshInterval = this.device.homey.setInterval(async () => {
      // Only refresh if connected and TuyAPI available
      if (!this.isConnected || !this.tuya) {
        return;
      }

      // v1.3.11: Skip if another query is in progress to prevent concurrent TuyaAPI calls
      if (this.queryInProgress) {
        this.logger('TuyaConnectionService: DPS refresh skipped - query already in progress');
        return;
      }

      // Enhanced diagnostic logging (v1.0.4)
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      // Perform lightweight DPS query (NAT keep-alive only, v1.0.31)
      // CHANGE (v1.0.31): DPS refresh is NOW NAT keep-alive only - heartbeat handles zombie detection
      // This removes the 10-second wait loop and forceReconnect call that caused temporal paradoxes

      // DIAGNOSTIC TEST (v1.0.37): Track if DPS refresh triggers actual data events
      const preRefreshDataTime = this.lastDataEventReceived;
      const preRefreshTimestamp = Date.now();

      // v1.3.11: Set query lock before TuyaAPI call
      this.queryInProgress = true;

      this.tuya.get({ schema: true })
        .then(async () => {
          // Query succeeded - but did it trigger a data event?
          this.logger(`TuyaConnectionService: ✅ Periodic DPS refresh at ${timeStr} - query succeeded`);

          // Wait 500ms to see if data event arrives
          await new Promise((resolve) => {
            this.device.homey.setTimeout(resolve, 500);
          });

          // Check if data event was received
          const dataEventReceived = this.lastDataEventReceived > preRefreshDataTime;
          const elapsedMs = Date.now() - preRefreshTimestamp;

          if (dataEventReceived) {
            // Data event confirmed - update timestamp
            this.lastDataEventTime = Date.now();
            this.logger(`TuyaConnectionService: ✅ DPS refresh triggered data event (${elapsedMs}ms) - NAT mapping maintained`);
          } else {
            // NO data event - this is critical diagnostic info!
            this.logger(`TuyaConnectionService: ⚠️ DPS refresh did NOT trigger data event after ${elapsedMs}ms`);
            this.logger('TuyaConnectionService: ⚠️ Query succeeded but device sent no response - possible idempotent query issue');
            // Don't update lastDataEventTime - let heartbeat detect this as stale
          }

          // v1.3.11: Release query lock
          this.queryInProgress = false;
        })
        .catch((error) => {
          // Query failed - don't mark as disconnected, let heartbeat handle failures
          // This prevents false positives from temporary network hiccups
          this.logger(`TuyaConnectionService: ⚠️ Periodic DPS refresh at ${timeStr} failed:`, error);

          // v1.3.11: Release query lock
          this.queryInProgress = false;
        });
    }, DeviceConstants.DPS_REFRESH_INTERVAL_MS);
  }

  /**
   * Stop periodic DPS refresh.
   */
  private stopPeriodicDpsRefresh(): void {
    if (this.dpsRefreshInterval) {
      clearInterval(this.dpsRefreshInterval);
      this.dpsRefreshInterval = null;
    }
  }

  /**
   * Perform heartbeat check to verify TCP keep-alive is working (v1.0.31 - Synergistic Strategy).
   *
   * ARCHITECTURE (v1.0.31 - Option B, v1.2.1 - Layer 0 redundancy):
   * - Layer 0 (10-sec): TuyaAPI native heartbeat - fastest zombie detection
   * - TCP keep-alive (5-min OS-level): Sends packets to detect dead sockets
   * - Heartbeat (5-min app-level): Verifies device responds to keep-alive probes
   * - DPS refresh (15-min): NAT timeout prevention ONLY, redundant with Layer 0 (v1.2.1)
   *
   * Heartbeat runs at same 5-minute interval as TCP keep-alive to complement it:
   * Layer 1: get() query - tests if socket is responsive (confirms keep-alive working)
   * Layer 2: set(dps:1) wake-up - tests if sleeping device responds to commands
   *
   * If both layers fail → device is unresponsive (true disconnect)
   * If either succeeds → device is responsive (keep-alive working)
   *
   * Skips heartbeat if device has sent data recently (avoids unnecessary traffic).
   * Enhanced with hybrid approach (v1.0.9): tries passive get() first, then active set() wake-up.
   * If get() fails, attempts an idempotent set() operation to wake sleeping devices.
   */
  private async performHeartbeat(): Promise<void> {
    // v1.0.12: Enhanced disconnection handling - allow wake-up probes after extended outage
    if (!this.isConnected) {
      // Check if we should attempt wake-up probe during extended disconnection
      const outageDuration = this.outageStartTime > 0 ? Date.now() - this.outageStartTime : 0;
      const shouldProbeDisconnected = outageDuration >= DeviceConstants.HEARTBEAT_DISCONNECTED_DELAY_MS;

      if (!shouldProbeDisconnected) {
        // Too early - let normal reconnection logic handle it
        this.logger('TuyaConnectionService: Heartbeat skipped - disconnected (normal reconnection active)');
        return;
      }

      // Extended outage (15+ minutes) - attempt wake-up probe
      this.logger(`TuyaConnectionService: 🔍 Heartbeat wake-up probe during extended outage (${Math.round(outageDuration / 60000)} minutes)...`);

      // Attempt wake-up probe (same as reconnection wake-up)
      if (!this.tuya) {
        this.logger('TuyaConnectionService: TuyAPI instance not available');
        return;
      }

      try {
        const currentOnOff = this.device.getCapabilityValue('onoff') || false;

        let wakeUpTimeoutHandle: NodeJS.Timeout | null = null;
        try {
          await Promise.race([
            this.tuya.set({ dps: 1, set: currentOnOff }),
            new Promise((_, reject) => {
              wakeUpTimeoutHandle = this.device.homey.setTimeout(
                () => reject(new Error('Heartbeat wake-up timeout')),
                DeviceConstants.WAKE_UP_TIMEOUT_MS,
              );
            }),
          ]);

          // Wake-up probe successful!
          this.logger('TuyaConnectionService: ✅ Heartbeat wake-up probe successful - device responsive!');
          this.lastDataEventTime = Date.now();

          // Don't change isConnected here - let normal reconnection flow handle it
          // This wake-up just proves device is responsive, triggering faster reconnection

        } finally {
          if (wakeUpTimeoutHandle) {
            clearTimeout(wakeUpTimeoutHandle);
          }
        }

      } catch (error) {
        this.logger(`TuyaConnectionService: ⚠️ Heartbeat wake-up probe failed: ${error}`);
        // Continue with normal reconnection logic
      }

      return; // Exit - don't run normal heartbeat logic when disconnected
    }

    // Skip if heartbeat already in progress (prevent concurrent probes)
    if (this.heartbeatInProgress) {
      this.logger('TuyaConnectionService: Heartbeat skipped - probe already in progress');
      return;
    }

    // v1.3.11: Skip if another query is in progress to prevent concurrent TuyaAPI calls
    if (this.queryInProgress) {
      this.logger('TuyaConnectionService: Heartbeat skipped - query already in progress');
      return;
    }

    // Check if we've received data recently (intelligent skip logic - v1.0.32: 50% for TCP resilience)
    const timeSinceLastData = Date.now() - this.lastDataEventTime;
    const recentDataThreshold = DeviceConstants.CONNECTION_HEARTBEAT_INTERVAL_MS * 0.5; // 50% of heartbeat interval (more aggressive probing with TCP keep-alive)

    // Enhanced diagnostic logging (v1.0.4)
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    if (timeSinceLastData < recentDataThreshold) {
      this.logger(`TuyaConnectionService: ⏭️ Heartbeat skipped at ${timeStr} - device active (data received ${Math.round(timeSinceLastData / 1000)}s ago)`);
      return;
    }

    // DIAGNOSTIC (v1.0.37): Log when heartbeat runs despite DPS refresh potentially running
    const timeSinceDpsRefresh = Date.now() % DeviceConstants.DPS_REFRESH_INTERVAL_MS;
    if (timeSinceDpsRefresh < 10000) { // Within 10 seconds of DPS refresh cycle
      this.logger(`TuyaConnectionService: ⚠️ Heartbeat running close to DPS refresh cycle (${Math.round(timeSinceDpsRefresh / 1000)}s offset)`);
      this.logger('TuyaConnectionService: ⚠️ This may indicate DPS refresh is not updating lastDataEventTime correctly');
    }

    // Device appears idle - perform proactive health check
    this.logger(`🔍 TuyaConnectionService: Heartbeat probe at ${timeStr} - no data for ${Math.round(timeSinceLastData / 1000)}s, checking connection health...`);
    this.heartbeatInProgress = true;
    this.queryInProgress = true; // v1.3.11: Set query lock before TuyaAPI call
    this.lastHeartbeatTime = Date.now();

    try {
      // Attempt lightweight get() query with timeout
      if (!this.tuya) {
        throw new Error('TuyAPI instance not available');
      }

      // LAYER 1: Try passive get() first (network-friendly)
      let timeoutHandle: NodeJS.Timeout | null = null;
      let layer1GetError: Error | null = null;

      try {
        await Promise.race([
          this.tuya.get({ schema: true }),
          new Promise((_, reject) => {
            timeoutHandle = this.device.homey.setTimeout(
              () => reject(new Error('Heartbeat get() timeout')),
              DeviceConstants.HEARTBEAT_TIMEOUT_MS,
            );
          }),
        ]);

        // Success with get() - device is responsive
        this.logger('TuyaConnectionService: ✅ LAYER 1 (get) successful - verifying data event reception...');

      } catch (getError) {
        // Layer 1 failed
        layer1GetError = getError as Error;
        this.logger(`TuyaConnectionService: ⚠️ LAYER 1 (get) failed: ${layer1GetError.message}`);
      } finally {
        // Clean up get() timeout
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
      }

      // Now check if Layer 1 succeeded in triggering data event
      const layer1DataEventReceived = await this.waitForDataEvent(
        DeviceConstants.HEARTBEAT_DATA_EVENT_TIMEOUT_MS,
      );

      if (layer1DataEventReceived) {
        // Layer 1 succeeded - data event confirmed
        this.logger('TuyaConnectionService: ✓ LAYER 1 success - Data event confirmed, connection healthy');
        this.lastDataEventTime = Date.now();
        this.heartbeatInProgress = false;
        return; // Exit early - connection is healthy
      }

      // Layer 1 didn't trigger data event - try Layer 2: active set() wake-up (v1.0.26)
      this.logger('TuyaConnectionService: ⚠️ LAYER 1 no data event - attempting LAYER 2 (wake-up set)...');

      let layer2SetError: Error | null = null;
      const currentOnOff = this.device.getCapabilityValue('onoff') || false;

      try {
        // Attempt idempotent set() operation with timeout
        await Promise.race([
          this.tuya.set({ dps: 1, set: currentOnOff }), // Write current value (no side effects)
          new Promise((_, reject) => {
            timeoutHandle = this.device.homey.setTimeout(
              () => reject(new Error('Heartbeat set() timeout')),
              DeviceConstants.HEARTBEAT_TIMEOUT_MS,
            );
          }),
        ]);

        // Success with set() - device was sleeping but responded to command
        this.logger('TuyaConnectionService: ✅ LAYER 2 (set) successful - verifying data event reception...');

      } catch (setError) {
        // Layer 2 also failed
        layer2SetError = setError as Error;
        this.logger(`TuyaConnectionService: ⚠️ LAYER 2 (set) also failed: ${layer2SetError.message}`);
      } finally {
        // Clean up set() timeout
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
      }

      // Now check if Layer 2 succeeded in triggering data event
      const layer2DataEventReceived = await this.waitForDataEvent(
        DeviceConstants.HEARTBEAT_DATA_EVENT_TIMEOUT_MS,
      );

      if (layer2DataEventReceived) {
        // Layer 2 succeeded - data event confirmed after set()
        this.logger('TuyaConnectionService: ✓ LAYER 2 success - Device woken and responding');
        this.lastDataEventTime = Date.now();
        this.heartbeatInProgress = false;
        return; // Exit - recovery successful!
      }

      // Both layers failed to trigger data event - this is a zombie connection
      this.logger('╔═══════════════════════════════════════════════════╗');
      this.logger(`║ 🧟 [LAYER 1-2] ZOMBIE DETECTED at ${timeStr}    ║`);
      this.logger('╠═══════════════════════════════════════════════════╣');
      this.logger(`║  LAYER 1 (get): ${layer1GetError ? `FAILED - ${layer1GetError.message}` : 'OK but NO data event'}`);
      this.logger(`║  LAYER 2 (set): ${layer2SetError ? `FAILED - ${layer2SetError.message}` : 'OK but NO data event'}`);
      this.logger(`║  Last data event: ${Math.round(timeSinceLastData / 1000)}s ago`);
      this.logger(`║  Consecutive failures: ${this.consecutiveFailures}`);
      this.logger(`║  Backoff multiplier: ${this.backoffMultiplier}x`);
      this.logger('╠═══════════════════════════════════════════════════╣');
      this.logger('║  🔄 Triggering force reconnect...');
      this.logger('╚═══════════════════════════════════════════════════╝');

      // Store detailed disconnect source for diagnostics
      const layer1Status = layer1GetError ? `failed: ${layer1GetError.message}` : 'no data event';
      const layer2Status = layer2SetError ? `failed: ${layer2SetError.message}` : 'no data event';
      this.lastDisconnectSource = `zombie_heartbeat (Layer1=${layer1Status}, Layer2=${layer2Status})`;
      this.lastDisconnectTime = Date.now();

      // Send specific notification about zombie detection
      await this.sendCriticalNotification(
        'Zombie Verbinding Gedetecteerd',
        `Heartbeat detecteerde geen data events. Layer1(get): ${layer1Status}, Layer2(set): ${layer2Status}. Automatisch herverbinden...`,
      );

      // Force reconnection to clear zombie state
      await this.forceReconnect();

    } catch (error) {
      // Both heartbeat layers failed - mark as disconnected
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger(`❌ TuyaConnectionService: Heartbeat completely failed at ${timeStr} - true disconnect detected: ${errorMsg}`);
      this.lastDisconnectSource = `heartbeat_exception (${errorMsg})`;
      this.lastDisconnectTime = Date.now();

      // Send specific notification about heartbeat failure
      await this.sendCriticalNotification(
        'Heartbeat Timeout Disconnect',
        `Heartbeat probe gefaald om ${timeStr}. Fout: ${errorMsg}. Automatisch herverbinden...`,
      );

      // Mark as disconnected to trigger reconnection
      this.isConnected = false;
      this.updateStatusTimestamp('disconnected').catch((err) => {
        this.logger('TuyaConnectionService: Failed to update status timestamp:', err);
      });

      // Increment failure counter for backoff logic
      this.consecutiveFailures++;

      // Trigger reconnection
      this.scheduleNextReconnectionAttempt();

    } finally {
      this.heartbeatInProgress = false;
      this.queryInProgress = false; // v1.3.11: Release query lock
    }
  }

  /**
   * Wait for a data event to confirm TuyAPI is actually receiving data (v1.0.16).
   * Used for zombie connection detection.
   * @param timeoutMs - Maximum time to wait for data event
   * @returns Promise<boolean> - true if data event received, false if timeout
   */
  private async waitForDataEvent(timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    this.waitingForDataEvent = true;

    return new Promise((resolve) => {
      const checkInterval = this.device.homey.setInterval(() => {
        // Check if data event was received
        if (!this.waitingForDataEvent) {
          clearInterval(checkInterval);
          resolve(true);
          return;
        }

        // Check for timeout
        if (Date.now() - startTime >= timeoutMs) {
          clearInterval(checkInterval);
          this.waitingForDataEvent = false;
          resolve(false);
        }
      }, 100); // Check every 100ms
    });
  }

  /**
   * Schedule the next reconnection attempt using exponential backoff and circuit breaker.
   * Enhanced with stale connection detection (v0.99.98).
   * Enhanced with persistent outage tracking, circuit breaker limits, heartbeat probing,
   * and time-based notifications (v1.0.5 - Proposals 1-5).
   */
  private scheduleNextReconnectionAttempt(): void {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    this.logger('┌─────────────────────────────────────────────────────┐');
    this.logger(`│ SCHEDULE RECONNECTION CALLED at ${timeStr}        │`);
    this.logger(`│ isConnected: ${this.isConnected ? 'true ' : 'false'}                              │`);
    this.logger(`│ consecutiveFailures: ${this.consecutiveFailures.toString().padEnd(28)}│`);
    this.logger(`│ backoffMultiplier: ${this.backoffMultiplier}x${' '.repeat(28 - this.backoffMultiplier.toString().length - 1)}│`);
    this.logger(`│ circuitBreakerOpen: ${this.circuitBreakerOpen ? 'true ' : 'false'}${' '.repeat(24)}│`);
    this.logger('└─────────────────────────────────────────────────────┘');

    // LAYER 1: Track outage start time (v1.0.5 - Proposal 1, fixed v1.0.6)
    // Only start tracking if we've ever connected successfully before
    if (this.hasEverConnected && !this.isConnected && this.outageStartTime === 0) {
      this.outageStartTime = Date.now();
      this.logger('📊 Outage tracking started');
    }

    // LAYER 2: Stale Connection Detection (v0.99.98)
    // Check if connection claims to be active but hasn't received data in a long time
    if (this.isConnected) {
      const timeSinceLastData = Date.now() - this.lastDataEventTime;

      // If no data for longer than stale threshold, connection is likely dead
      if (timeSinceLastData > DeviceConstants.STALE_CONNECTION_THRESHOLD_MS) {
        const idleMinutes = Math.round(timeSinceLastData / 60000);
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

        this.logger('╔═══════════════════════════════════════════════════╗');
        this.logger(`║ ⏰ [LAYER 3] STALE CONNECTION at ${timeStr}     ║`);
        this.logger('╠═══════════════════════════════════════════════════╣');
        this.logger(`║  Idle time: ${Math.round(timeSinceLastData / 1000)}s (${idleMinutes} min)`);
        this.logger(`║  Threshold: ${DeviceConstants.STALE_CONNECTION_THRESHOLD_MS / 1000}s`);
        this.logger('╠═══════════════════════════════════════════════════╣');
        this.logger('║  🔄 Forcing reconnection for stale connection');
        this.logger('╚═══════════════════════════════════════════════════╝');

        // Store detailed disconnect source
        this.lastDisconnectSource = `stale_connection (idle: ${idleMinutes}min, threshold: ${DeviceConstants.STALE_CONNECTION_THRESHOLD_MS / 60000}min)`;
        this.lastDisconnectTime = Date.now();

        // Send specific notification about stale connection
        this.sendCriticalNotification(
          'Stale Connection Detected',
          `Geen data ontvangen voor ${idleMinutes} minuten. Verbinding wordt als inactief beschouwd. Automatisch herverbinden...`,
        ).catch((err) => {
          this.logger('Failed to send stale connection notification:', err);
        });

        // Force disconnection to trigger reconnection
        this.isConnected = false;
        this.updateStatusTimestamp('error').catch((err) => {
          this.logger('TuyaConnectionService: Failed to update status timestamp:', err);
        });

        // Apply moderate backoff (not as aggressive as failure-based)
        this.backoffMultiplier = Math.min(this.backoffMultiplier * 1.5, 8);

        // Continue to reconnection attempt below
      } else {
        // Connection is healthy and has recent data - reschedule next health check
        // CRITICAL (v1.0.31): MUST always schedule next check to keep monitoring loop alive
        const secondsSinceData = Math.round(timeSinceLastData / 1000);
        const nextCheckIn = Math.round(DeviceConstants.RECONNECTION_INTERVAL_MS / 1000);
        this.logger(`TuyaConnectionService: Connection healthy (data received ${secondsSinceData}s ago), next health check in ${nextCheckIn}s`);

        // Schedule next health check at normal interval (don't apply backoff for healthy connections)
        this.reconnectInterval = this.device.homey.setTimeout(() => {
          this.scheduleNextReconnectionAttempt();
        }, DeviceConstants.RECONNECTION_INTERVAL_MS);
        return;
      }
    }

    // LAYER 3: Time-based notifications (v1.0.5 - Proposal 5)
    if (this.outageStartTime > 0) {
      const outageDuration = Date.now() - this.outageStartTime;

      // 2-minute notification
      if (outageDuration >= 2 * 60 * 1000 && !this.notificationSent2Min) {
        this.sendCriticalNotification(
          'Device Connection Lost',
          'Heat pump has been offline for 2 minutes. Automatic recovery in progress.',
        ).catch((err) => this.logger('Failed to send 2-min notification:', err));
        this.notificationSent2Min = true;
      }

      // 10-minute notification + DIAGNOSTIC REPORT
      if (outageDuration >= 10 * 60 * 1000 && !this.notificationSent10Min) {
        this.logger('🔍 10-MINUTE OUTAGE - Generating diagnostic report...');
        this.logDiagnosticReport();
        this.sendCriticalNotification(
          'Extended Device Outage',
          'Heat pump has been offline for 10 minutes. Please check network connectivity.',
        ).catch((err) => this.logger('Failed to send 10-min notification:', err));
        this.notificationSent10Min = true;
      }

      // 30-minute notification + DIAGNOSTIC REPORT
      if (outageDuration >= 30 * 60 * 1000 && !this.notificationSent30Min) {
        this.logger('🔍 30-MINUTE OUTAGE - Generating diagnostic report...');
        this.logDiagnosticReport();
        this.sendCriticalNotification(
          'Critical Outage',
          'Heat pump has been offline for 30 minutes. Manual intervention may be required.',
        ).catch((err) => this.logger('Failed to send 30-min notification:', err));
        this.notificationSent30Min = true;
      }

      // 1-hour diagnostic (logging only, no notification)
      const oneHour = 60 * 60 * 1000;
      if (outageDuration >= oneHour && outageDuration < oneHour + 30000) { // Only log once around 1-hour mark
        this.logger('🔍 1-HOUR OUTAGE - Generating diagnostic report...');
        this.logDiagnosticReport();
      }
    }

    // LAYER 4: Circuit breaker with cycle limit (v1.0.5 - Proposal 2)
    if (this.circuitBreakerOpen) {
      const timeSinceOpen = Date.now() - this.circuitBreakerOpenTime;

      if (timeSinceOpen < this.circuitBreakerResetTime) {
        // Still in cooldown period - check for early internet recovery (Proposal 3)
        this.logger(`TuyaConnectionService: Circuit breaker open, cooling down for ${Math.round((this.circuitBreakerResetTime - timeSinceOpen) / 1000)}s more`);

        // Proposal 3: Lightweight connectivity probe every 30 seconds during cooldown
        if (timeSinceOpen % 30000 < 10000) {
          dnsPromises.resolve('google.com')
            .then(() => {
              this.logger('TuyaConnectionService: ✅ Internet recovered during cooldown - attempting immediate reconnection');
              this.circuitBreakerOpen = false;
              this.circuitBreakerCycles = 0;
              this.consecutiveFailures = 0;
              this.scheduleNextReconnectionAttempt();
            })
            .catch(() => {
              // Still offline, continue cooldown
            });
        }

        this.reconnectInterval = this.device.homey.setTimeout(() => {
          try {
            this.scheduleNextReconnectionAttempt();
          } catch (error) {
            this.logger('TuyaConnectionService: Error during circuit breaker cooldown check:', error);
          }
        }, 10000); // Check every 10 seconds during cooldown
        return;
      }

      // Cooldown period ended - check cycle limit (Proposal 2)
      this.circuitBreakerCycles++;
      this.logger(`TuyaConnectionService: Circuit breaker reset attempt ${this.circuitBreakerCycles}/${this.MAX_CIRCUIT_BREAKER_CYCLES}`);

      if (this.circuitBreakerCycles >= this.MAX_CIRCUIT_BREAKER_CYCLES) {
        // Max cycles reached - switch to continuous slow retry
        this.logger('TuyaConnectionService: ⚠️ Max circuit breaker cycles reached - switching to slow continuous retry');
        this.circuitBreakerOpen = false;
        this.backoffMultiplier = 8; // 2.5 min retry interval (20s * 8 = 160s)
        // Keep trying indefinitely at slower rate
      } else {
        // Reset circuit breaker for another cycle
        this.logger('TuyaConnectionService: Circuit breaker reset - attempting reconnection');
        this.circuitBreakerOpen = false;
        this.consecutiveFailures = 0;
        this.backoffMultiplier = 1; // Reset backoff for fresh cycle
      }
    }

    // Calculate adaptive interval with exponential backoff
    const baseInterval = DeviceConstants.RECONNECTION_INTERVAL_MS;
    let adaptiveInterval = Math.min(
      baseInterval * this.backoffMultiplier,
      this.maxBackoffSeconds * 1000,
    );

    // Enforce 30-minute maximum guarantee (v1.0.6 - user requirement)
    // If it's been longer than 30 minutes since last attempt, force immediate retry
    const timeSinceLastAttempt = this.nextReconnectionTime > 0 ? Date.now() - this.nextReconnectionTime : 0;
    if (timeSinceLastAttempt > this.MAX_RECONNECTION_INTERVAL_MS) {
      this.logger('TuyaConnectionService: ⚠️ 30-minute maximum exceeded - forcing immediate retry');
      adaptiveInterval = 1000; // 1 second
    }

    // Set next reconnection time for status display (v1.0.6)
    this.nextReconnectionTime = Date.now() + adaptiveInterval;

    const nextAttemptTime = new Date(this.nextReconnectionTime);
    const nextTimeStr = `${nextAttemptTime.getHours().toString().padStart(2, '0')}:${nextAttemptTime.getMinutes().toString().padStart(2, '0')}:${nextAttemptTime.getSeconds().toString().padStart(2, '0')}`;

    this.logger('╔═════════════════════════════════════════════════════╗');
    this.logger(`║ RECONNECTION SCHEDULED                              ║`);
    this.logger(`║ Next attempt in: ${Math.round(adaptiveInterval / 1000)}s (at ${nextTimeStr})${' '.repeat(Math.max(0, 14 - Math.round(adaptiveInterval / 1000).toString().length - nextTimeStr.length))}║`);
    this.logger(`║ Backoff multiplier: ${this.backoffMultiplier}x${' '.repeat(29 - this.backoffMultiplier.toString().length)}║`);
    this.logger(`║ Circuit breaker: ${this.circuitBreakerOpen ? 'OPEN' : 'CLOSED'}${' '.repeat(28 - (this.circuitBreakerOpen ? 4 : 6))}║`);
    this.logger('╚═════════════════════════════════════════════════════╝');

    this.reconnectInterval = this.device.homey.setTimeout(() => {
      this.logger('⏰ Reconnection timer FIRED - executing attemptReconnectionWithRecovery()...');
      this.attemptReconnectionWithRecovery().catch((error) => {
        // Prevent unhandled rejection crash
        this.logger('TuyaConnectionService: ❌ Critical error in scheduled reconnection:', error);

        // Apply aggressive backoff and schedule retry
        this.backoffMultiplier = Math.min(this.backoffMultiplier * 2, 32);
        this.consecutiveFailures++;
        this.logger(`➡️  Rescheduling after error (failures: ${this.consecutiveFailures}, backoff: ${this.backoffMultiplier}x)`);
        this.scheduleNextReconnectionAttempt();
      });
    }, adaptiveInterval);
  }

  /**
   * Try a reconnection attempt with recovery logic and update internal failure counters.
   * Enhanced with forced disconnect to fix TuyAPI state desynchronization (v1.0.3).
   */
  private async attemptReconnectionWithRecovery(): Promise<void> {
    // CHECK 1: If already connected, reset backoff and exit (v1.0.6 - MUST check BEFORE disconnect)
    if (this.isConnected) {
      this.logger('TuyaConnectionService: Already connected, skipping reconnection attempt');
      this.resetErrorRecoveryState();
      return;
    }

    // FIX 1: Force disconnect to reset TuyAPI internal state before reconnect attempt
    // This prevents "Already connected" errors when app state and TuyAPI state are out of sync
    if (this.tuya) {
      try {
        await this.tuya.disconnect();
        this.logger('TuyaConnectionService: Forced disconnect before reconnect attempt (state sync)');
      } catch (err) {
        // Expected error if socket was already closed - safe to ignore
        this.logger('TuyaConnectionService: Disconnect failed (socket already closed):', err);
      }
    }

    // FIX 1.5: Stabilization delay to allow socket cleanup (v1.0.18)
    // CRITICAL: Prevents reusing corrupted socket state immediately after disconnect
    await new Promise((resolve) => {
      this.device.homey.setTimeout(resolve, 2000);
    });
    this.logger('TuyaConnectionService: Socket stabilization delay complete');

    this.logger(`TuyaConnectionService: Attempting to reconnect to Tuya device... (attempt ${this.consecutiveFailures + 1})`);
    await this.updateStatusTimestamp('reconnecting');

    try {
      await this.connectTuya();

      // Success! Reset all error recovery state
      const wasExtendedOutage = this.consecutiveFailures >= DeviceConstants.MAX_CONSECUTIVE_FAILURES;
      this.resetErrorRecoveryState();
      this.logger('TuyaConnectionService: Reconnection successful, error recovery state reset');

      // Mark device as available again after successful reconnection
      try {
        await this.device.setAvailable();
        this.logger('TuyaConnectionService: Device marked as available after successful reconnection');
      } catch (err) {
        this.logger('TuyaConnectionService: Failed to set device available:', err);
      }

      // Send recovery notification only if device was unavailable (extended outage)
      if (wasExtendedOutage) {
        await this.sendCriticalNotification(
          'Verbinding Hersteld',
          'Warmtepomp is weer online na verbindingsprobleem.',
        );
      }

      // CRITICAL FIX (v1.2.1): Restart health check loop after successful reconnection
      // Without this, stale connection detection and periodic health monitoring stops
      // until next disconnect/reconnect cycle
      this.scheduleNextReconnectionAttempt();
      this.logger('TuyaConnectionService: Health check loop restarted after successful reconnection');

    } catch (error) {
      const categorizedError = error as CategorizedError;
      this.consecutiveFailures++;

      // Determine recovery strategy based on error type
      await this.updateRecoveryStrategy(categorizedError);

      // Send notifications based on failure patterns
      await this.handleReconnectionFailureNotification(categorizedError);

      // Schedule next attempt with updated strategy
      this.scheduleNextReconnectionAttempt();
    }
  }

  /**
   * Adjust internal recovery strategy (backoff, circuit breaker) based on categorized error.
   */
  private async updateRecoveryStrategy(error: CategorizedError): Promise<void> {
    // Set status to 'error' for non-recoverable errors
    if (!error.recoverable) {
      await this.updateStatusTimestamp('error');
    }

    // Exponential backoff for recoverable errors
    if (error.recoverable) {
      this.backoffMultiplier = Math.min(this.backoffMultiplier * 1.5, 16); // Cap at 16x
    } else {
      // For non-recoverable errors, use more aggressive backoff
      this.backoffMultiplier = Math.min(this.backoffMultiplier * 2, 32); // Cap at 32x
    }

    // Activate circuit breaker after severe failure patterns
    if (this.consecutiveFailures >= DeviceConstants.MAX_CONSECUTIVE_FAILURES * 2) {
      this.logger(`TuyaConnectionService: Activating circuit breaker after ${this.consecutiveFailures} consecutive failures`);
      this.circuitBreakerOpen = true;
      this.circuitBreakerOpenTime = Date.now();
    }
  }

  /**
   * Notify users/devices about reconnection failures according to thresholds.
   * Enhanced with time-based notifications (v1.0.5 - notifications moved to scheduleNextReconnectionAttempt).
   */
  private async handleReconnectionFailureNotification(error: CategorizedError): Promise<void> {
    // Mark device as unavailable for non-recoverable errors
    if (!error.recoverable && this.consecutiveFailures <= 3) {
      try {
        await this.device.setUnavailable(`Connection failed: ${error.userMessage}`);
        this.logger('TuyaConnectionService: Device marked as unavailable due to non-recoverable error');
      } catch (err) {
        this.logger('TuyaConnectionService: Failed to set device unavailable:', err);
      }
      return;
    }

    // Mark device as unavailable after initial failure threshold
    if (this.consecutiveFailures === DeviceConstants.MAX_CONSECUTIVE_FAILURES) {
      try {
        await this.device.setUnavailable('Heat pump disconnected - attempting reconnection...');
        this.logger('TuyaConnectionService: Device marked as unavailable after connection loss');
      } catch (err) {
        this.logger('TuyaConnectionService: Failed to set device unavailable:', err);
      }
    }

    // Note: Time-based notifications (2min, 10min, 30min) are now sent from scheduleNextReconnectionAttempt()
    // based on outage duration instead of failure count (v1.0.5 - Proposal 5)
  }

  /**
   * Reset internal failure counters and backoff state.
   */
  private resetErrorRecoveryState(): void {
    this.consecutiveFailures = 0;
    this.backoffMultiplier = 1;
    this.circuitBreakerOpen = false;
    this.circuitBreakerOpenTime = 0;

    // Reset outage tracking (v1.0.5)
    this.outageStartTime = 0;
    this.totalOutageDuration = 0;
    this.circuitBreakerCycles = 0;

    // Reset notification flags (v1.0.5)
    this.notificationSent2Min = false;
    this.notificationSent10Min = false;
    this.notificationSent30Min = false;

    // Reset next reconnection time (v1.0.6)
    this.nextReconnectionTime = 0;

    // Reset passive reconnection attempts (v1.0.12)
    this.passiveReconnectionAttempts = 0;
  }

  /**
   * Convert a raw Error to a CategorizedError with `recoverable` and `userMessage` fields.
   */
  private handleTuyaError(error: Error, context: string): CategorizedError {
    return TuyaErrorCategorizer.categorize(error, context);
  }

  /**
   * Send a device-level critical notification with anti-spam throttling.
   */
  private async sendCriticalNotification(title: string, message: string) {
    const now = Date.now();
    const notificationKey = `${title}:${message}`;

    // Prevent spam - only send notifications every 30 minutes for the same device
    // Also prevent duplicate notifications within 5 seconds (for duplicate events)
    if (now - this.lastNotificationTime > DeviceConstants.NOTIFICATION_THROTTLE_MS
        || (this.lastNotificationKey !== notificationKey && now - this.lastNotificationTime > DeviceConstants.NOTIFICATION_KEY_CHANGE_THRESHOLD_MS)) {
      try {
        await this.device.homey.notifications.createNotification({
          excerpt: `${this.device.getName()}: ${title}`,
        });
        this.lastNotificationTime = now;
        this.lastNotificationKey = notificationKey;
        this.logger(`Critical notification sent: ${title}`);
      } catch (err) {
        this.logger('Failed to send notification:', err);
      }
    }
  }

  /**
   * Return diagnostics for the Tuya connection manager.
   */
  getDiagnostics(): Record<string, unknown> {
    return {
      isConnected: this.isConnected,
      consecutiveFailures: this.consecutiveFailures,
      backoffMultiplier: this.backoffMultiplier,
      circuitBreakerOpen: this.circuitBreakerOpen,
      circuitBreakerOpenTime: this.circuitBreakerOpenTime,
      connectionAttempts: this.connectionAttempts,
      hasReconnectInterval: !!this.reconnectInterval,
      tuyaInstanceExists: !!this.tuya,
      queryInProgress: this.queryInProgress, // v1.3.11
    };
  }

  /**
   * Log comprehensive diagnostic report of all timer states and connection status.
   * Use this when connection is stuck to see what timers are active/inactive.
   */
  logDiagnosticReport(): void {
    const now = Date.now();
    const formatTime = (timestamp: number): string => {
      if (timestamp === 0) return 'NEVER';
      const secondsAgo = Math.round((now - timestamp) / 1000);
      return `${secondsAgo}s ago`;
    };

    this.logger('╔═══════════════════════════════════════════════════════════╗');
    this.logger('║           CONNECTION DIAGNOSTIC REPORT                    ║');
    this.logger('╠═══════════════════════════════════════════════════════════╣');
    this.logger('║ CONNECTION STATE                                          ║');
    this.logger('╟───────────────────────────────────────────────────────────╢');
    this.logger(`║ isConnected: ${(this.isConnected ? 'true ' : 'false').padEnd(46)}║`);
    this.logger(`║ hasEverConnected: ${(this.hasEverConnected ? 'true' : 'false').padEnd(42)}║`);
    this.logger(`║ currentStatus: ${this.currentStatus.padEnd(45)}║`);
    this.logger(`║ lastDisconnectSource: ${(this.lastDisconnectSource || 'N/A').padEnd(36)}║`);
    this.logger('╟───────────────────────────────────────────────────────────╢');
    this.logger('║ TIMESTAMPS                                                ║');
    this.logger('╟───────────────────────────────────────────────────────────╢');
    this.logger(`║ lastDataEventTime: ${formatTime(this.lastDataEventTime).padEnd(39)}║`);
    this.logger(`║ lastHeartbeatTime: ${formatTime(this.lastHeartbeatTime).padEnd(39)}║`);
    this.logger(`║ lastNativeHeartbeatTime: ${formatTime(this.lastNativeHeartbeatTime).padEnd(33)}║`);
    this.logger(`║ lastStatusChangeTime: ${formatTime(this.lastStatusChangeTime).padEnd(38)}║`);
    this.logger(`║ lastDisconnectTime: ${formatTime(this.lastDisconnectTime).padEnd(40)}║`);
    this.logger(`║ outageStartTime: ${formatTime(this.outageStartTime).padEnd(43)}║`);
    this.logger('╟───────────────────────────────────────────────────────────╢');
    this.logger('║ TIMER STATES                                              ║');
    this.logger('╟───────────────────────────────────────────────────────────╢');
    this.logger(`║ reconnectInterval: ${(this.reconnectInterval ? 'ACTIVE' : 'INACTIVE').padEnd(41)}║`);
    this.logger(`║ heartbeatInterval: ${(this.heartbeatInterval ? 'ACTIVE' : 'INACTIVE').padEnd(41)}║`);
    this.logger(`║ nativeHeartbeatMonitorInterval: ${(this.nativeHeartbeatMonitorInterval ? 'ACTIVE' : 'INACTIVE').padEnd(28)}║`);
    this.logger(`║ dpsRefreshInterval: ${(this.dpsRefreshInterval ? 'ACTIVE' : 'INACTIVE').padEnd(40)}║`);
    this.logger(`║ heartbeatInProgress: ${(this.heartbeatInProgress ? 'true' : 'false').padEnd(39)}║`);
    this.logger(`║ queryInProgress (v1.3.11): ${(this.queryInProgress ? 'true' : 'false').padEnd(32)}║`);
    this.logger('╟───────────────────────────────────────────────────────────╢');
    this.logger('║ RECONNECTION STATE                                        ║');
    this.logger('╟───────────────────────────────────────────────────────────╢');
    this.logger(`║ consecutiveFailures: ${this.consecutiveFailures.toString().padEnd(38)}║`);
    this.logger(`║ backoffMultiplier: ${this.backoffMultiplier.toString().padEnd(40)}x║`);
    this.logger(`║ connectionAttempts: ${this.connectionAttempts.toString().padEnd(40)}║`);
    this.logger(`║ passiveReconnectionAttempts: ${this.passiveReconnectionAttempts.toString().padEnd(31)}║`);
    this.logger('╟───────────────────────────────────────────────────────────╢');
    this.logger('║ CIRCUIT BREAKER                                           ║');
    this.logger('╟───────────────────────────────────────────────────────────╢');
    this.logger(`║ circuitBreakerOpen: ${(this.circuitBreakerOpen ? 'OPEN' : 'CLOSED').padEnd(40)}║`);
    this.logger(`║ circuitBreakerCycles: ${this.circuitBreakerCycles.toString().padEnd(38)}║`);
    this.logger(`║ circuitBreakerOpenTime: ${formatTime(this.circuitBreakerOpenTime).padEnd(36)}║`);
    this.logger('╟───────────────────────────────────────────────────────────╢');
    this.logger('║ TUYA INSTANCE                                             ║');
    this.logger('╟───────────────────────────────────────────────────────────╢');
    this.logger(`║ tuyaInstanceExists: ${(this.tuya ? 'true' : 'false').padEnd(40)}║`);
    this.logger('╚═══════════════════════════════════════════════════════════╝');
  }

  /**
   * Cleanup timers, event handlers and release the Tuya instance.
   * Enhanced cleanup for deep socket handlers (v1.0.2)
   */
  destroy(): void {
    this.logger('TuyaConnectionService: Destroying service');

    this.stopReconnectInterval();
    this.stopHeartbeat();
    this.stopNativeHeartbeatMonitoring(); // v1.1.2
    this.stopPeriodicDpsRefresh();

    if (this.tuya) {
      // Remove deep socket error handler BEFORE removeAllListeners (v1.0.2)
      try {
        // @ts-expect-error - Accessing TuyAPI internal socket for cleanup
        const tuyaSocket = this.tuya.device?.client;
        if (tuyaSocket) {
          tuyaSocket.removeAllListeners('error');
          this.logger('TuyaConnectionService: Deep socket error handler removed');
        }
      } catch (error) {
        this.logger('TuyaConnectionService: Error removing deep socket handler:', error);
      }

      // Remove all TuyAPI event listeners
      this.tuya.removeAllListeners();

      // Disconnect if connected
      if (this.isConnected) {
        try {
          this.tuya.disconnect();
        } catch (error) {
          this.logger('TuyaConnectionService: Error during cleanup disconnect:', error);
        }
      }
    }

    this.tuya = null;
    this.isConnected = false;

    // Reset in-progress flags (v1.0.31, v1.3.11)
    this.forceReconnectInProgress = false;
    this.queryInProgress = false;

    this.logger('TuyaConnectionService: Service destroyed');
  }
}
