/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';
import TuyAPI from 'tuyapi';
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

  // Intervals
  private reconnectInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastNotificationTime: number = 0;
  private lastNotificationKey: string | null = null;

  // Connection health tracking (v0.99.98)
  private lastDataEventTime: number = Date.now();
  private lastHeartbeatTime: number = 0;
  private heartbeatInProgress = false;

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
      // Restore last connection timestamp from store (persists across app updates)
      const storedTimestamp = await this.device.getStoreValue('last_connection_timestamp');
      if (storedTimestamp && typeof storedTimestamp === 'number') {
        const daysSinceLastConnection = (Date.now() - storedTimestamp) / (1000 * 60 * 60 * 24);
        // Only restore if less than 7 days old (prevent showing very stale timestamps)
        if (daysSinceLastConnection < 7) {
          this.lastStatusChangeTime = storedTimestamp;
          this.logger(`TuyaConnectionService: Restored connection timestamp from ${new Date(storedTimestamp).toISOString()}`);
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
      // Step 1: Stop reconnection interval and heartbeat to prevent interference
      this.stopReconnectInterval();
      this.stopHeartbeat();

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
      this.logger('TuyaConnectionService: Connected to Tuya device successfully');

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

    // Step 1: Stop any pending reconnection attempts and heartbeat
    this.stopReconnectInterval();
    this.stopHeartbeat();

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

    // Step 5: Resume normal reconnection monitoring and heartbeat
    this.startReconnectInterval();
    this.startHeartbeat();
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
   * Get formatted connection status with timestamp for display (v0.99.61, localized v0.99.68).
   * Format: "Status (HH:MM:SS)" or "Status (DD-MM HH:MM)" for older timestamps
   * @returns Formatted status string with timestamp in local timezone
   */
  getFormattedConnectionStatus(): string {
    // Get localized status label
    const statusLabel = this.device.homey.__(`connection_status.${this.currentStatus}`);

    // Create timestamp in local timezone (not UTC)
    const timestamp = new Date(this.lastStatusChangeTime);
    const now = new Date();

    // Get Homey's configured timezone (fallback to auto-detection)
    // Homey stores timezone in system settings, prefer this over Node.js process timezone
    const homeyTimezone = this.device.homey.clock.getTimezone() || Intl.DateTimeFormat().resolvedOptions().timeZone;

    // If status changed today, show only time (HH:MM:SS)
    // If status changed on a different day, show date and time (D-MMM HH:MM)
    const isSameDay = timestamp.toDateString() === now.toDateString();

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

    return `${statusLabel} (${timeString})`;
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

    // Persist timestamp to device store (survives app updates)
    try {
      await this.device.setStoreValue('last_connection_timestamp', this.lastStatusChangeTime);
    } catch (error) {
      this.logger(`TuyaConnectionService: Failed to persist connection timestamp: ${error}`);
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
      this.logger('TuyaConnectionService: Device disconnected');
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
   * Perform a single heartbeat check with intelligent skip logic (v0.99.98).
   * Skips heartbeat if device has sent data recently (avoids unnecessary traffic).
   * Detects zombie connections by attempting a lightweight get() query.
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

    if (timeSinceLastData < recentDataThreshold) {
      this.logger(`TuyaConnectionService: Heartbeat skipped - device active (data received ${Math.round(timeSinceLastData / 1000)}s ago)`);
      return;
    }

    // Device appears idle - perform proactive health check
    this.logger(`TuyaConnectionService: Heartbeat probe - no data for ${Math.round(timeSinceLastData / 1000)}s, checking connection health...`);
    this.heartbeatInProgress = true;
    this.lastHeartbeatTime = Date.now();

    try {
      // Attempt lightweight get() query with timeout
      if (!this.tuya) {
        throw new Error('TuyAPI instance not available');
      }

      // Use TuyAPI's get() method to probe connection health
      // This will throw an error if connection is dead
      await Promise.race([
        this.tuya.get({ schema: true }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Heartbeat timeout')), DeviceConstants.HEARTBEAT_TIMEOUT_MS);
        }),
      ]);

      this.logger('TuyaConnectionService: ✅ Heartbeat successful - connection healthy');

      // Update last data event time (successful probe counts as activity)
      this.lastDataEventTime = Date.now();

    } catch (error) {
      this.logger(`TuyaConnectionService: ❌ Heartbeat failed - zombie connection detected: ${error}`);

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
   */
  private scheduleNextReconnectionAttempt(): void {
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

    // Check circuit breaker state
    if (this.circuitBreakerOpen) {
      const timeSinceOpen = Date.now() - this.circuitBreakerOpenTime;
      if (timeSinceOpen < this.circuitBreakerResetTime) {
        // Still in cooldown period
        this.logger(`TuyaConnectionService: Circuit breaker open, cooling down for ${Math.round((this.circuitBreakerResetTime - timeSinceOpen) / 1000)}s more`);
        this.reconnectInterval = this.device.homey.setTimeout(() => {
          try {
            this.scheduleNextReconnectionAttempt();
          } catch (error) {
            this.logger('TuyaConnectionService: Error during circuit breaker cooldown check:', error);
          }
        }, 10000); // Check every 10 seconds during cooldown
        return;
      }
      // Try to reset circuit breaker
      this.logger('TuyaConnectionService: Attempting to reset circuit breaker...');
      this.circuitBreakerOpen = false;
      this.backoffMultiplier = 1; // Reset backoff
    }

    // Calculate adaptive interval with exponential backoff
    const baseInterval = DeviceConstants.RECONNECTION_INTERVAL_MS;
    const adaptiveInterval = Math.min(
      baseInterval * this.backoffMultiplier,
      this.maxBackoffSeconds * 1000,
    );

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
   */
  private async attemptReconnectionWithRecovery(): Promise<void> {
    if (this.isConnected) {
      // Already connected, reset backoff and exit
      this.resetErrorRecoveryState();
      return;
    }

    this.logger(`TuyaConnectionService: Attempting to reconnect to Tuya device... (attempt ${this.consecutiveFailures + 1})`);
    await this.updateStatusTimestamp('reconnecting');

    try {
      await this.connectTuya();

      // Success! Reset all error recovery state
      this.resetErrorRecoveryState();
      this.logger('TuyaConnectionService: Reconnection successful, error recovery state reset');

      // Mark device as available again after successful reconnection
      try {
        await this.device.setAvailable();
        this.logger('TuyaConnectionService: Device marked as available after successful reconnection');
      } catch (err) {
        this.logger('TuyaConnectionService: Failed to set device available:', err);
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
   */
  private async handleReconnectionFailureNotification(error: CategorizedError): Promise<void> {
    // Immediate notification for critical infrastructure failures
    if (!error.recoverable && this.consecutiveFailures <= 3) {
      await this.sendCriticalNotification(
        'Critical Device Error',
        `Heat pump connection failed: ${error.userMessage}. Manual intervention may be required.`,
      );

      // Mark device as unavailable for non-recoverable errors
      try {
        await this.device.setUnavailable(`Connection failed: ${error.userMessage}`);
        this.logger('TuyaConnectionService: Device marked as unavailable due to non-recoverable error');
      } catch (err) {
        this.logger('TuyaConnectionService: Failed to set device unavailable:', err);
      }
      return;
    }

    // Standard notification after initial failure threshold
    if (this.consecutiveFailures === DeviceConstants.MAX_CONSECUTIVE_FAILURES) {
      await this.sendCriticalNotification(
        'Device Connection Lost',
        `Heat pump has been disconnected for over 1 minute. ${error.userMessage}`,
      );

      // Mark device as unavailable after 1 minute offline
      try {
        await this.device.setUnavailable('Heat pump disconnected - attempting reconnection...');
        this.logger('TuyaConnectionService: Device marked as unavailable after connection loss');
      } catch (err) {
        this.logger('TuyaConnectionService: Failed to set device unavailable:', err);
      }
      return;
    }

    // Extended outage notification
    if (this.consecutiveFailures === DeviceConstants.MAX_CONSECUTIVE_FAILURES * 3) {
      await this.sendCriticalNotification(
        'Extended Device Outage',
        `Heat pump has been offline for over 5 minutes. Connection issues persist: ${error.userMessage}`,
      );
      // Device already marked unavailable at failure #5
    }
  }

  /**
   * Reset internal failure counters and backoff state.
   */
  private resetErrorRecoveryState(): void {
    this.consecutiveFailures = 0;
    this.backoffMultiplier = 1;
    this.circuitBreakerOpen = false;
    this.circuitBreakerOpenTime = 0;
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
   */
  destroy(): void {
    this.logger('TuyaConnectionService: Destroying service');

    this.stopReconnectInterval();
    this.stopHeartbeat();

    if (this.tuya) {
      this.tuya.removeAllListeners();
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
