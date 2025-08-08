/* eslint-disable import/prefer-default-export */
/**
 * Device constants for the Adlar Heat Pump Homey app
 *
 * Centralized location for all magic numbers and configuration values
 * to improve maintainability and reduce code duplication.
 */

export class DeviceConstants {
  // Timing intervals (in milliseconds)
  /** Notification throttling - prevent spam notifications for 30 minutes */
  static readonly NOTIFICATION_THROTTLE_MS = 30 * 60 * 1000; // 30 minutes

  /** Tuya device reconnection attempt interval */
  static readonly RECONNECTION_INTERVAL_MS = 20 * 1000; // 20 seconds

  /** Capability health check interval */
  static readonly HEALTH_CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

  /** Allow notification key change if longer than this threshold */
  static readonly NOTIFICATION_KEY_CHANGE_THRESHOLD_MS = 5 * 1000; // 5 seconds

  /** Capability timeout - consider unhealthy after this period without data */
  static readonly CAPABILITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  // Power thresholds (in watts)
  /** High power consumption alert threshold */
  static readonly HIGH_POWER_ALERT_THRESHOLD_W = 5000; // watts

  /** Default power threshold for flow cards */
  static readonly DEFAULT_POWER_THRESHOLD_W = 1000; // watts

  // Performance thresholds
  /** Low efficiency threshold percentage */
  static readonly LOW_EFFICIENCY_THRESHOLD_PERCENT = 50; // percentage

  // Health monitoring thresholds
  /** Consider capability unhealthy after this many consecutive null values */
  static readonly NULL_THRESHOLD = 10; // consecutive nulls

  /** Maximum consecutive connection failures before extended backoff */
  static readonly MAX_CONSECUTIVE_FAILURES = 5;

  // Time formatting
  /** Milliseconds per second for time calculations */
  static readonly MS_PER_SECOND = 1000;

  /** Seconds per minute for time calculations */
  static readonly SECONDS_PER_MINUTE = 60;

  /** Minutes per hour for time calculations */
  static readonly MINUTES_PER_HOUR = 60;

  // Temperature validation ranges
  /** Minimum target temperature in Celsius */
  static readonly MIN_TARGET_TEMPERATURE = 5;

  /** Maximum target temperature in Celsius */
  static readonly MAX_TARGET_TEMPERATURE = 75;

  /** Minimum hot water temperature in Celsius */
  static readonly MIN_HOTWATER_TEMPERATURE = 35;

  /** Maximum hot water temperature in Celsius */
  static readonly MAX_HOTWATER_TEMPERATURE = 75;

  // Retry delays
  /** Capability retry delay in milliseconds */
  static readonly CAPABILITY_RETRY_DELAY_MS = 1000;

  /** Flow card retry delay in milliseconds */
  static readonly FLOW_CARD_RETRY_DELAY_MS = 5000;

  /** Settings defer delay in milliseconds */
  static readonly SETTINGS_DEFER_DELAY_MS = 100;

  // Consumption tracking
  /** Consumption milestone increment in kWh */
  static readonly CONSUMPTION_MILESTONE_INCREMENT_KWH = 100;

  // Default thresholds
  /** Default temperature threshold in Celsius */
  static readonly DEFAULT_TEMPERATURE_THRESHOLD = 25;

  /** Daily consumption threshold in kWh */
  static readonly DAILY_CONSUMPTION_THRESHOLD_KWH = 20;
}
