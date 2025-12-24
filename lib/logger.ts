/* eslint-disable import/prefer-default-export */
/**
 * Structured logging utility for Homey apps
 *
 * Provides hierarchical log levels (ERROR, WARN, INFO, DEBUG) with
 * runtime configuration support via device settings.
 *
 * Usage:
 * ```typescript
 * const logger = new Logger(this.log.bind(this), this.error.bind(this), logLevel);
 * logger.error('Critical failure', { details });
 * logger.warn('Potential issue detected');
 * logger.info('Connection established');
 * logger.debug('Detailed state info', { state });
 * ```
 *
 * Log Level Hierarchy:
 * - ERROR: Critical failures, exceptions, unrecoverable errors
 * - WARN: Potential issues, degraded performance, recoverable errors
 * - INFO: Important state changes, connections, user actions
 * - DEBUG: Detailed diagnostics, internal state, trace information
 *
 * @version 2.1.0
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LoggerConfig {
  /** Current log level (controls output verbosity) */
  level: LogLevel;
  /** Homey log function (for non-error messages) */
  logFn: (...args: unknown[]) => void;
  /** Homey error function (for error messages) */
  errorFn: (...args: unknown[]) => void;
  /** Optional prefix for all log messages (e.g., service name) */
  prefix?: string;
}

export class Logger {
  private config: LoggerConfig;

  /**
   * Create a new Logger instance
   *
   * @param logFn Homey's this.log.bind(this)
   * @param errorFn Homey's this.error.bind(this)
   * @param level Log level (ERROR, WARN, INFO, DEBUG)
   * @param prefix Optional prefix for all messages
   */
  constructor(
    logFn: (...args: unknown[]) => void,
    errorFn: (...args: unknown[]) => void,
    level: LogLevel = LogLevel.ERROR,
    prefix?: string,
  ) {
    this.config = {
      level,
      logFn,
      errorFn,
      prefix,
    };
  }

  /**
   * Update log level at runtime (e.g., when user changes settings)
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * Check if a specific level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return this.config.level >= level;
  }

  /**
   * ERROR: Critical failures, exceptions, unrecoverable errors
   *
   * Always logged, uses Homey's error() function
   */
  error(message: string, ...args: unknown[]): void {
    const prefix = this.config.prefix ? `[${this.config.prefix}] ` : '';
    this.config.errorFn(`${prefix}${message}`, ...args);
  }

  /**
   * WARN: Potential issues, degraded performance, recoverable errors
   *
   * Logged when level >= WARN
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.config.level >= LogLevel.WARN) {
      const prefix = this.config.prefix ? `[${this.config.prefix}] ` : '';
      this.config.logFn(`⚠️  ${prefix}${message}`, ...args);
    }
  }

  /**
   * INFO: Important state changes, connections, user actions
   *
   * Logged when level >= INFO
   */
  info(message: string, ...args: unknown[]): void {
    if (this.config.level >= LogLevel.INFO) {
      const prefix = this.config.prefix ? `[${this.config.prefix}] ` : '';
      this.config.logFn(`${prefix}${message}`, ...args);
    }
  }

  /**
   * DEBUG: Detailed diagnostics, internal state, trace information
   *
   * Logged when level >= DEBUG
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.config.level >= LogLevel.DEBUG) {
      const prefix = this.config.prefix ? `[${this.config.prefix}] ` : '';
      this.config.logFn(`🔍 ${prefix}${message}`, ...args);
    }
  }

  /**
   * Create a child logger with a different prefix
   *
   * Useful for creating service-specific loggers that share the parent's level
   */
  createChild(childPrefix: string): Logger {
    const combinedPrefix = this.config.prefix
      ? `${this.config.prefix}:${childPrefix}`
      : childPrefix;

    return new Logger(
      this.config.logFn,
      this.config.errorFn,
      this.config.level,
      combinedPrefix,
    );
  }

  /**
   * Parse log level from string (for settings)
   */
  static parseLevel(levelStr: string): LogLevel {
    switch (levelStr.toLowerCase()) {
      case 'error':
        return LogLevel.ERROR;
      case 'warn':
      case 'warning':
        return LogLevel.WARN;
      case 'info':
        return LogLevel.INFO;
      case 'debug':
        return LogLevel.DEBUG;
      default:
        return LogLevel.ERROR; // Fail-safe: default to ERROR
    }
  }

  /**
   * Convert LogLevel to string
   */
  static levelToString(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return 'error';
      case LogLevel.WARN:
        return 'warn';
      case LogLevel.INFO:
        return 'info';
      case LogLevel.DEBUG:
        return 'debug';
      default:
        return 'error';
    }
  }
}
