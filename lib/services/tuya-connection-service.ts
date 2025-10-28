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
  private lastNotificationTime: number = 0;
  private lastNotificationKey: string | null = null;

  // Connection health tracking (v0.99.98)
  private lastDataEventTime: number = Date.now();
  private lastHeartbeatTime: number = 0;
  private heartbeatInProgress = false;

  // Diagnostic tracking for 06:35 disconnect investigation (v1.0.4)
  private lastDisconnectSource: string | null = null;
  private lastDisconnectTime: number = 0;

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
      // Restore last connection timestamp AND status from store (persists across app updates)
      const storedTimestamp = await this.device.getStoreValue('last_connection_timestamp');
      const storedStatus = await this.device.getStoreValue('last_connection_status');

      if (storedTimestamp && typeof storedTimestamp === 'number') {
        const daysSinceLastConnection = (Date.now() - storedTimestamp) / (1000 * 60 * 60 * 24);
        // Only restore if less than 7 days old (prevent showing very stale timestamps)
        if (daysSinceLastConnection < 7) {
          this.lastStatusChangeTime = storedTimestamp;

          // Restore status if valid (v1.0.6 - prevents showing stale "disconnected" at startup)
          if (storedStatus && typeof storedStatus === 'string' &&
              ['connected', 'disconnected', 'reconnecting', 'error'].includes(storedStatus)) {
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
      // Step 1: Stop reconnection interval, heartbeat, and DPS refresh to prevent interference
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

      // Step 4: Create new TuyAPI instance with new credentials
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
   */
  async connectTuya(): Promise<void> {
    if (this.isConnected || !this.tuya) {
      return;
    }

    this.connectionAttempts++;

    try {
      this.logger('TuyaConnectionService: Attempting connection...');

      // Discover the device on the network first
      await this.tuya.find();

      // Then connect to the device
      await this.tuya.connect();

      this.isConnected = true;
      this.hasEverConnected = true; // Mark successful connection (v1.0.6)
      this.lastDataEventTime = Date.now(); // Update activity timestamp immediately (v1.0.6)
      this.logger('TuyaConnectionService: Connected to Tuya device successfully');

      // Synchronously update status to prevent race condition with initializeConnectionStatusTracking() (v1.0.6)
      await this.updateStatusTimestamp('connected');

      // Install deep socket error handler after successful connection (v0.99.49)
      // CRITICAL: Must reinstall after every reconnection because TuyAPI recreates the socket
      this.installDeepSocketErrorHandler();

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
        this.tuya.removeAllListeners();
        await this.tuya.disconnect();
        this.isConnected = false;
        this.logger('TuyaConnectionService: Disconnected from Tuya device');
      } catch (error) {
        this.logger('TuyaConnectionService: Error during disconnect:', error);
      }
    }
  }

  /**
   * Force immediate reconnection to the device (v0.99.66).
   * Bypasses automatic reconnection delays, resets error recovery state, and attempts fresh connection.
   * Use this when user manually triggers reconnection from device settings.
   * @returns Promise that resolves when reconnection attempt completes (success or failure)
   */
  async forceReconnect(): Promise<void> {
    this.logger('TuyaConnectionService: Force reconnect triggered by user');

    // Step 1: Stop any pending reconnection attempts, heartbeat, and DPS refresh
    this.stopReconnectInterval();
    this.stopHeartbeat();
    this.stopPeriodicDpsRefresh();

    // Step 2: Disconnect cleanly from current connection (if any)
    await this.disconnect();

    // Step 3: Reset all error recovery state (bypass backoff/circuit breaker)
    this.resetErrorRecoveryState();
    this.logger('TuyaConnectionService: Error recovery state reset - ready for fresh connection');

    // Step 4: Attempt immediate reconnection
    try {
      await this.connectTuya();
      this.logger('TuyaConnectionService: Force reconnect successful');
    } catch (error) {
      this.logger('TuyaConnectionService: Force reconnect failed:', error);
      // Don't throw - let normal reconnection logic handle retry
    }

    // Step 5: Resume normal reconnection monitoring, heartbeat, and DPS refresh
    this.startReconnectInterval();
    this.startHeartbeat();
    this.startPeriodicDpsRefresh();
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

    try {
      await this.tuya.set({ multiple: true, data: dps });
      this.logger('TuyaConnectionService: Command sent successfully:', dps);
    } catch (error) {
      const categorizedError = this.handleTuyaError(error as Error, 'Send command');
      this.logger('TuyaConnectionService: Error sending command:', categorizedError.userMessage);
      throw categorizedError;
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

    // Persist both timestamp AND status to device store (survives app updates) - v1.0.6
    try {
      await this.device.setStoreValue('last_connection_timestamp', this.lastStatusChangeTime);
      await this.device.setStoreValue('last_connection_status', this.currentStatus);
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
   * Attach internal event handlers to the underlying Tuya instance:
   * - 'data', 'dp-refresh', 'error', 'connected', 'disconnected'
   */
  private setupTuyaEventHandlers(): void {
    if (!this.tuya) {
      throw new Error('Cannot setup event handlers: Tuya device not initialized');
    }

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
      this.logger('TuyaConnectionService: Device connected');
      this.isConnected = true;
      this.hasEverConnected = true; // Mark that we've successfully connected at least once (v1.0.6 bugfix)
      this.updateStatusTimestamp('connected').catch((err) => {
        this.logger('TuyaConnectionService: Failed to update status timestamp:', err);
      });

      // Reset error recovery state on successful connection
      this.resetErrorRecoveryState();

      // Notify connected handler
      if (this.onConnectedHandler) {
        this.onConnectedHandler();
      }
    });

    // Disconnected event
    this.tuya.on('disconnected', (): void => {
      // Enhanced diagnostic logging (v1.0.4)
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      const timeSinceLastData = Date.now() - this.lastDataEventTime;

      this.logger(`🔴 TuyaConnectionService: Device disconnected at ${timeStr} (no data for ${Math.round(timeSinceLastData / 1000)}s)`);
      this.lastDisconnectSource = 'disconnected_event';
      this.lastDisconnectTime = Date.now();

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
   * Start periodic DPS refresh to prevent heartbeat timeouts during idle periods (v1.0.3).
   * This queries device state every 3 minutes to keep lastDataEventTime current,
   * ensuring heartbeat probes are skipped even when device is idle or externally controlled.
   */
  private startPeriodicDpsRefresh(): void {
    // Clear existing interval if any
    this.stopPeriodicDpsRefresh();

    this.logger(`TuyaConnectionService: Starting periodic DPS refresh (interval: ${DeviceConstants.DPS_REFRESH_INTERVAL_MS / 1000}s)`);

    this.dpsRefreshInterval = this.device.homey.setInterval(() => {
      // Only refresh if connected and TuyAPI available
      if (!this.isConnected || !this.tuya) {
        return;
      }

      // Enhanced diagnostic logging (v1.0.4)
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      // Perform lightweight DPS query
      this.tuya.get({ schema: true })
        .then(() => {
          // Update activity timestamp to prevent heartbeat timeout
          this.lastDataEventTime = Date.now();
          this.logger(`TuyaConnectionService: ✅ Periodic DPS refresh at ${timeStr} - activity timestamp updated`);
        })
        .catch((error) => {
          // Don't mark as disconnected - let heartbeat mechanism handle actual failures
          // This prevents false positives from temporary network hiccups
          this.logger(`TuyaConnectionService: ⚠️ Periodic DPS refresh at ${timeStr} failed:`, error);
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
   * Perform a single heartbeat check with intelligent skip logic (v0.99.98).
   * Enhanced with hybrid approach (v1.0.9): tries passive get() first, then active set() wake-up.
   * Skips heartbeat if device has sent data recently (avoids unnecessary traffic).
   * Detects zombie connections by attempting a lightweight get() query.
   * If get() fails, attempts an idempotent set() operation to wake sleeping devices.
   */
  private async performHeartbeat(): Promise<void> {
    // Skip if already disconnected (reconnection logic handles this)
    if (!this.isConnected) {
      this.logger('TuyaConnectionService: Heartbeat skipped - already disconnected');
      return;
    }

    // Skip if heartbeat already in progress (prevent concurrent probes)
    if (this.heartbeatInProgress) {
      this.logger('TuyaConnectionService: Heartbeat skipped - probe already in progress');
      return;
    }

    // Check if we've received data recently (intelligent skip logic)
    const timeSinceLastData = Date.now() - this.lastDataEventTime;
    const recentDataThreshold = DeviceConstants.CONNECTION_HEARTBEAT_INTERVAL_MS * 0.8; // 80% of heartbeat interval

    // Enhanced diagnostic logging (v1.0.4)
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    if (timeSinceLastData < recentDataThreshold) {
      this.logger(`TuyaConnectionService: ⏭️ Heartbeat skipped at ${timeStr} - device active (data received ${Math.round(timeSinceLastData / 1000)}s ago)`);
      return;
    }

    // Device appears idle - perform proactive health check
    this.logger(`🔍 TuyaConnectionService: Heartbeat probe at ${timeStr} - no data for ${Math.round(timeSinceLastData / 1000)}s, checking connection health...`);
    this.heartbeatInProgress = true;
    this.lastHeartbeatTime = Date.now();

    try {
      // Attempt lightweight get() query with timeout
      if (!this.tuya) {
        throw new Error('TuyAPI instance not available');
      }

      // LAYER 1: Try passive get() first (network-friendly)
      let timeoutHandle: NodeJS.Timeout | null = null;
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
        this.logger('TuyaConnectionService: ✅ Heartbeat (get) successful - connection healthy');
        this.lastDataEventTime = Date.now();
        return; // Exit early - connection is healthy

      } catch (getError) {
        // LAYER 2: get() failed - try active set() wake-up (v1.0.9)
        this.logger(`TuyaConnectionService: ⚠️ Heartbeat get() failed at ${timeStr}, attempting wake-up set()... (${getError})`);

        // Clean up get() timeout
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }

        // Get current onoff state for idempotent write
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

          // Success with set() - device was sleeping but is now awake
          this.logger('TuyaConnectionService: ✅ Heartbeat (wake-up set) successful - device was sleeping, now active');
          this.lastDataEventTime = Date.now();
          return; // Exit - recovery successful!

        } catch (setError) {
          // Both layers failed - this is a true disconnect
          throw new Error(`Both get() and set() failed - true disconnect (get: ${getError}, set: ${setError})`);

        } finally {
          // Clean up set() timeout
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
        }
      }

    } catch (error) {
      // Both heartbeat layers failed - mark as disconnected
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      this.logger(`❌ TuyaConnectionService: Heartbeat completely failed at ${timeStr} - true disconnect detected: ${error}`);
      this.lastDisconnectSource = 'heartbeat_timeout';
      this.lastDisconnectTime = Date.now();

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
    }
  }

  /**
   * Schedule the next reconnection attempt using exponential backoff and circuit breaker.
   * Enhanced with stale connection detection (v0.99.98).
   * Enhanced with persistent outage tracking, circuit breaker limits, heartbeat probing,
   * and time-based notifications (v1.0.5 - Proposals 1-5).
   */
  private scheduleNextReconnectionAttempt(): void {
    // LAYER 1: Track outage start time (v1.0.5 - Proposal 1, fixed v1.0.6)
    // Only start tracking if we've ever connected successfully before
    if (this.hasEverConnected && !this.isConnected && this.outageStartTime === 0) {
      this.outageStartTime = Date.now();
      this.logger('TuyaConnectionService: Outage tracking started');
    }

    // LAYER 2: Stale Connection Detection (v0.99.98)
    // Check if connection claims to be active but hasn't received data in a long time
    if (this.isConnected) {
      const timeSinceLastData = Date.now() - this.lastDataEventTime;

      // If no data for longer than stale threshold, connection is likely dead
      if (timeSinceLastData > DeviceConstants.STALE_CONNECTION_THRESHOLD_MS) {
        this.logger(`TuyaConnectionService: 🚨 Stale connection detected - no data for ${Math.round(timeSinceLastData / 1000)}s (threshold: ${DeviceConstants.STALE_CONNECTION_THRESHOLD_MS / 1000}s)`);
        this.logger('TuyaConnectionService: Forcing reconnection for stale connection');

        // Force disconnection to trigger reconnection
        this.isConnected = false;
        this.updateStatusTimestamp('error').catch((err) => {
          this.logger('TuyaConnectionService: Failed to update status timestamp:', err);
        });

        // Apply moderate backoff (not as aggressive as failure-based)
        this.backoffMultiplier = Math.min(this.backoffMultiplier * 1.5, 8);

        // Continue to reconnection attempt below
      } else {
        // Connection is healthy and has recent data - skip reconnection
        this.logger(`TuyaConnectionService: Connection healthy (data received ${Math.round(timeSinceLastData / 1000)}s ago), skipping reconnection`);
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

      // 10-minute notification
      if (outageDuration >= 10 * 60 * 1000 && !this.notificationSent10Min) {
        this.sendCriticalNotification(
          'Extended Device Outage',
          'Heat pump has been offline for 10 minutes. Please check network connectivity.',
        ).catch((err) => this.logger('Failed to send 10-min notification:', err));
        this.notificationSent10Min = true;
      }

      // 30-minute notification
      if (outageDuration >= 30 * 60 * 1000 && !this.notificationSent30Min) {
        this.sendCriticalNotification(
          'Critical Outage',
          'Heat pump has been offline for 30 minutes. Manual intervention may be required.',
        ).catch((err) => this.logger('Failed to send 30-min notification:', err));
        this.notificationSent30Min = true;
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

    this.logger(`TuyaConnectionService: Next reconnection attempt in ${Math.round(adaptiveInterval / 1000)}s (backoff: ${this.backoffMultiplier}x)`);

    this.reconnectInterval = this.device.homey.setTimeout(() => {
      this.attemptReconnectionWithRecovery().catch((error) => {
        // Prevent unhandled rejection crash
        this.logger('TuyaConnectionService: Critical error in scheduled reconnection:', error);

        // Apply aggressive backoff and schedule retry
        this.backoffMultiplier = Math.min(this.backoffMultiplier * 2, 32);
        this.consecutiveFailures++;
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
    };
  }

  /**
   * Cleanup timers, event handlers and release the Tuya instance.
   * Enhanced cleanup for deep socket handlers (v1.0.2)
   */
  destroy(): void {
    this.logger('TuyaConnectionService: Destroying service');

    this.stopReconnectInterval();
    this.stopHeartbeat();
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

    this.logger('TuyaConnectionService: Service destroyed');
  }
}
