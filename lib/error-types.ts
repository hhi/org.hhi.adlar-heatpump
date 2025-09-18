/**
 * Tuya communication error categorization system
 *
 * Provides structured error handling for different types of Tuya device communication failures
 * to enable better debugging, user feedback, and recovery strategies.
 */

/**
 * Categories of Tuya communication errors
 */
export enum TuyaErrorType {
  /** Connection to device failed */
  CONNECTION_FAILED = 'connection_failed',

  /** Operation timed out */
  TIMEOUT = 'timeout',

  /** Device not found on network */
  DEVICE_NOT_FOUND = 'device_not_found',

  /** Authentication or credentials error */
  AUTHENTICATION_ERROR = 'authentication_error',

  /** DPS (data point) related error */
  DPS_ERROR = 'dps_error',

  /** Network connectivity issue */
  NETWORK_ERROR = 'network_error',

  /** Device is offline or unreachable */
  DEVICE_OFFLINE = 'device_offline',

  /** Input validation error */
  VALIDATION_ERROR = 'validation_error',

  /** Unknown or unhandled error type */
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Structured error information with recovery guidance
 */
export interface CategorizedError {
  /** Error category */
  type: TuyaErrorType;

  /** Original error object */
  originalError: Error;

  /** Context where error occurred */
  context: string;

  /** Whether the error is recoverable */
  recoverable: boolean;

  /** Whether operation should be retried */
  retryable: boolean;

  /** User-friendly error message */
  userMessage: string;

  /** Suggested recovery actions */
  recoveryActions: string[];
}

/**
 * Error categorization utility
 */
export class TuyaErrorCategorizer {
  /**
   * Categorize a Tuya communication error
   * @param error - The original error
   * @param context - Context where error occurred
   * @returns Categorized error with recovery information
   */
  static categorize(error: Error, context: string): CategorizedError {
    const errorMessage = error.message.toLowerCase();
    const errorString = error.toString().toLowerCase();

    // Timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return {
        type: TuyaErrorType.TIMEOUT,
        originalError: error,
        context,
        recoverable: true,
        retryable: true,
        userMessage: 'Device response timed out. The device may be busy or experiencing connectivity issues.',
        recoveryActions: [
          'Check device network connectivity',
          'Wait a moment and try again',
          'Verify device is powered on',
        ],
      };
    }

    // Connection errors
    if (errorMessage.includes('connection')
        || errorMessage.includes('connect')
        || errorMessage.includes('refused')
        || errorMessage.includes('unreachable')
        || errorMessage.includes('econnreset')
        || errorString.includes('socket')
        || errorMessage.includes('reset')) {
      return {
        type: TuyaErrorType.CONNECTION_FAILED,
        originalError: error,
        context,
        recoverable: true,
        retryable: true,
        userMessage: 'Unable to connect to the heat pump. Check network connectivity.',
        recoveryActions: [
          'Verify device IP address is correct',
          'Check network connectivity',
          'Ensure device is on the same network',
          'Restart the device if necessary',
        ],
      };
    }

    // Device not found
    if (errorMessage.includes('not found')
        || errorMessage.includes('no device')
        || errorMessage.includes('device discovery failed')) {
      return {
        type: TuyaErrorType.DEVICE_NOT_FOUND,
        originalError: error,
        context,
        recoverable: true,
        retryable: true,
        userMessage: 'Heat pump device not found on the network.',
        recoveryActions: [
          'Verify device is powered on',
          'Check device IP address',
          'Ensure device is connected to network',
          'Re-pair device if necessary',
        ],
      };
    }

    // Authentication errors
    if (errorMessage.includes('auth')
        || errorMessage.includes('credential')
        || errorMessage.includes('key')
        || errorMessage.includes('unauthorized')) {
      return {
        type: TuyaErrorType.AUTHENTICATION_ERROR,
        originalError: error,
        context,
        recoverable: false,
        retryable: false,
        userMessage: 'Authentication failed. Device credentials may be incorrect.',
        recoveryActions: [
          'Verify local key is correct',
          'Check device ID is accurate',
          'Re-pair device with correct credentials',
        ],
      };
    }

    // DPS/Data point errors
    if (errorMessage.includes('dps')
        || errorMessage.includes('data point')
        || errorMessage.includes('invalid data')) {
      return {
        type: TuyaErrorType.DPS_ERROR,
        originalError: error,
        context,
        recoverable: true,
        retryable: false,
        userMessage: 'Device data communication error. The device may not support this feature.',
        recoveryActions: [
          'Check device firmware version',
          'Verify feature is supported by this device model',
          'Contact support if issue persists',
        ],
      };
    }

    // Network errors
    if (errorMessage.includes('network')
        || errorMessage.includes('dns')
        || errorMessage.includes('host')
        || errorString.includes('enetwork')) {
      return {
        type: TuyaErrorType.NETWORK_ERROR,
        originalError: error,
        context,
        recoverable: true,
        retryable: true,
        userMessage: 'Network connectivity issue. Check your network connection.',
        recoveryActions: [
          'Check internet connectivity',
          'Verify local network is working',
          'Restart network router if necessary',
          'Check firewall settings',
        ],
      };
    }

    // Validation errors
    if (errorMessage.includes('invalid')
        || errorMessage.includes('validation')
        || errorMessage.includes('range')
        || errorMessage.includes('format')) {
      return {
        type: TuyaErrorType.VALIDATION_ERROR,
        originalError: error,
        context,
        recoverable: false,
        retryable: false,
        userMessage: 'Invalid input provided. Please check the values and try again.',
        recoveryActions: [
          'Verify input values are within valid ranges',
          'Check data format is correct',
          'Consult documentation for valid values',
        ],
      };
    }

    // Default: Unknown error
    return {
      type: TuyaErrorType.UNKNOWN_ERROR,
      originalError: error,
      context,
      recoverable: true,
      retryable: true,
      userMessage: 'An unexpected error occurred while communicating with the device.',
      recoveryActions: [
        'Try the operation again',
        'Check device status and connectivity',
        'Contact support if the problem persists',
      ],
    };
  }

  /**
   * Get user-friendly error message for logging
   * @param categorizedError - The categorized error
   * @returns Formatted error message
   */
  static formatForLogging(categorizedError: CategorizedError): string {
    return `[${categorizedError.type}] ${categorizedError.context}: ${categorizedError.userMessage} (Original: ${categorizedError.originalError.message})`;
  }

  /**
   * Determine if error should trigger a reconnection attempt
   * @param categorizedError - The categorized error
   * @returns Whether to attempt reconnection
   */
  static shouldReconnect(categorizedError: CategorizedError): boolean {
    return categorizedError.type === TuyaErrorType.CONNECTION_FAILED
           || categorizedError.type === TuyaErrorType.TIMEOUT
           || categorizedError.type === TuyaErrorType.DEVICE_OFFLINE
           || categorizedError.type === TuyaErrorType.NETWORK_ERROR;
  }
}
