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

  // Connection status tracking (v0.99.47)
  private currentStatus: 'connected' | 'disconnected' | 'reconnecting' | 'error' = 'disconnected';

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
  private lastNotificationTime: number = 0;
  private lastNotificationKey: string | null = null;

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

      this.logger('TuyaConnectionService: Initialization completed successfully');

    } catch (error) {
      this.logger('TuyaConnectionService: Error during initialization:', error);
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
          this.currentStatus = 'disconnected';

          // Apply recovery strategy
          if (!categorizedError.recoverable) {
            this.currentStatus = 'error';
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

      // Forward to data handler
      if (this.onDataHandler) {
        this.onDataHandler(data);
      }
    });

    // DP-Refresh event - device data refresh
    this.tuya.on('dp-refresh', (data: { dps: Record<number, unknown> }): void => {
      const dpsFetched = data.dps || {};
      this.logger('TuyaConnectionService: DP-Refresh received from Tuya:', dpsFetched);

      // Forward to dp-refresh handler
      if (this.onDpRefreshHandler) {
        this.onDpRefreshHandler(data);
      }
    });

    // Connected event
    this.tuya.on('connected', (): void => {
      this.logger('TuyaConnectionService: Device connected');
      this.isConnected = true;
      this.currentStatus = 'connected';

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
      this.currentStatus = 'disconnected';

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
   * Schedule the next reconnection attempt using exponential backoff and circuit breaker.
   */
  private scheduleNextReconnectionAttempt(): void {
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
    this.currentStatus = 'reconnecting';

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
      this.updateRecoveryStrategy(categorizedError);

      // Send notifications based on failure patterns
      await this.handleReconnectionFailureNotification(categorizedError);

      // Schedule next attempt with updated strategy
      this.scheduleNextReconnectionAttempt();
    }
  }

  /**
   * Adjust internal recovery strategy (backoff, circuit breaker) based on categorized error.
   */
  private updateRecoveryStrategy(error: CategorizedError): void {
    // Set status to 'error' for non-recoverable errors
    if (!error.recoverable) {
      this.currentStatus = 'error';
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
   * Force an immediate reconnect attempt (resets recovery state first).
   */
  async forceReconnect(): Promise<void> {
    this.logger('TuyaConnectionService: Force reconnection requested');

    // Reset error recovery state
    this.resetErrorRecoveryState();

    // Disconnect first if connected
    if (this.isConnected) {
      await this.disconnect();
    }

    // Attempt immediate reconnection
    await this.connectTuya();
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
