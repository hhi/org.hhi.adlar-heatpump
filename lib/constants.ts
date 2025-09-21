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

  /** Energy tracking update interval - frequent updates for accurate energy accumulation */
  static readonly ENERGY_TRACKING_INTERVAL_MS = 10 * 1000; // 10 seconds

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

  // COP (Coefficient of Performance) calculation constants
  /** COP calculation update interval */
  static readonly COP_CALCULATION_INTERVAL_MS = 30 * 1000; // 30 seconds

  /** External device query timeout */
  static readonly EXTERNAL_DEVICE_QUERY_TIMEOUT_MS = 5 * 1000; // 5 seconds

  /** Water specific heat capacity in J/(kg·K) */
  static readonly WATER_SPECIFIC_HEAT_CAPACITY = 4186; // J/(kg·K)

  /** Kelvin conversion offset */
  static readonly CELSIUS_TO_KELVIN = 273.15;

  /** Minimum COP value - below this considered an error */
  static readonly MIN_VALID_COP = 0.5;

  /** Maximum COP value - above this considered an error */
  static readonly MAX_VALID_COP = 8.0;

  /** Typical COP ranges for different heat pump types */
  static readonly COP_RANGES = {
    AIR_TO_WATER_MIN: 2.5,
    AIR_TO_WATER_MAX: 4.5,
    GROUND_SOURCE_MIN: 3.5,
    GROUND_SOURCE_MAX: 5.5,
    DURING_DEFROST_MIN: 1.0,
    DURING_DEFROST_MAX: 2.0,
    IDEAL_CONDITIONS_MIN: 4.0,
    IDEAL_CONDITIONS_MAX: 6.0,
  };

  /** Default practical efficiency factors for Carnot calculations */
  static readonly CARNOT_EFFICIENCY = {
    BASE_EFFICIENCY: 0.4, // Base practical efficiency (40% of Carnot)
    FREQUENCY_FACTOR: 0.1, // Additional efficiency per 100Hz
    MIN_EFFICIENCY: 0.3, // Minimum practical efficiency
    MAX_EFFICIENCY: 0.5, // Maximum practical efficiency
  };

  /** Temperature difference thresholds for Method 3 estimation */
  static readonly COP_TEMP_DIFF_THRESHOLDS = {
    LOW_EFFICIENCY_TEMP_DIFF: 5, // °C - below this use low efficiency COP
    MODERATE_EFFICIENCY_TEMP_DIFF: 15, // °C - between low and high efficiency
    LOW_EFFICIENCY_COP: 2.0,
    MODERATE_EFFICIENCY_COP_BASE: 2.5,
    MODERATE_EFFICIENCY_SLOPE: 0.15, // COP increase per °C
    HIGH_EFFICIENCY_COP: 4.0,
  };

  /** Power estimation constants for compressor and fan motors */
  static readonly POWER_ESTIMATION = {
    // Compressor power estimation (typical heat pump compressor characteristics)
    COMPRESSOR_BASE_POWER: 500, // Watts at minimum frequency
    COMPRESSOR_MAX_POWER: 4000, // Watts at maximum frequency
    COMPRESSOR_MIN_FREQUENCY: 20, // Hz minimum operating frequency
    COMPRESSOR_MAX_FREQUENCY: 120, // Hz maximum operating frequency
    COMPRESSOR_POWER_CURVE_EXPONENT: 1.8, // Power scales non-linearly with frequency

    // Fan motor power estimation (outdoor unit fan)
    FAN_BASE_POWER: 50, // Watts at minimum speed
    FAN_MAX_POWER: 300, // Watts at maximum speed
    FAN_MIN_FREQUENCY: 10, // Hz minimum fan speed
    FAN_MAX_FREQUENCY: 100, // Hz maximum fan speed
    FAN_POWER_CURVE_EXPONENT: 2.2, // Fan power follows cube law approximately

    // System auxiliary power (pumps, controls, etc.)
    AUXILIARY_POWER_BASE: 150, // Watts for system electronics and circulation pump
    AUXILIARY_POWER_VARIABLE: 50, // Additional power that varies with system load

    // Defrost cycle power adjustments
    DEFROST_POWER_MULTIPLIER: 1.3, // 30% increase during defrost
  };

  // SCOP (Seasonal Coefficient of Performance) calculation constants
  /** SCOP calculation interval - daily updates during heating season */
  static readonly SCOP_CALCULATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  /** Heating season start day of year (October 1st) */
  static readonly SCOP_SEASON_START_DAY = 274; // Oct 1st

  /** Heating season end day of year (May 15th) */
  static readonly SCOP_SEASON_END_DAY = 135; // May 15th

  /** Minimum valid SCOP value */
  static readonly SCOP_MIN_VALID = 2.0;

  /** Maximum valid SCOP value */
  static readonly SCOP_MAX_VALID = 6.0;

  /** Method quality weighting factors for SCOP calculation */
  static readonly SCOP_METHOD_WEIGHTS = {
    direct_thermal: 1.0, // Full weight - most accurate
    power_module: 0.95, // Slight discount
    refrigerant_circuit: 0.90, // Moderate discount
    carnot_estimation: 0.85, // Higher discount
    valve_correlation: 0.75, // Significant discount
    temperature_difference: 0.60, // Heavy discount due to ±30% accuracy
  };

  /** SCOP quality requirements */
  static readonly SCOP_QUALITY_REQUIREMENTS = {
    HIGH_QUALITY_HOURS_MIN: 400, // Require 400+ hours of quality data
    METHOD3_MAX_CONTRIBUTION: 0.30, // Limit temp-diff method to 30%
    MIN_DATA_COVERAGE: 0.70, // 70% seasonal coverage required
    HIGH_CONFIDENCE_THRESHOLD: 0.80, // 80%+ quality methods = high confidence
    MEDIUM_CONFIDENCE_THRESHOLD: 0.50, // 50-79% quality methods = medium confidence
  };

  /** EN 14825 climate zones */
  static readonly SCOP_CLIMATE_ZONES = {
    AVERAGE: 'strasbourg', // European average climate
    WARMER: 'athens', // Southern European climate
    COLDER: 'helsinki', // Northern European climate
  };

  /** EN 14825 temperature bins for Average climate (Strasbourg) */
  static readonly SCOP_TEMPERATURE_BINS = [
    {
      temp: -10, hours: 1, load_ratio: 0.88, bin_name: 'extreme_cold',
    },
    {
      temp: -7, hours: 25, load_ratio: 0.78, bin_name: 'very_cold',
    },
    {
      temp: 2, hours: 167, load_ratio: 0.55, bin_name: 'cold',
    },
    {
      temp: 7, hours: 250, load_ratio: 0.42, bin_name: 'cool',
    },
    {
      temp: 12, hours: 250, load_ratio: 0.29, bin_name: 'mild',
    },
    {
      temp: 20, hours: 0, load_ratio: 0.10, bin_name: 'bivalent',
    }, // Bivalent temperature
  ];

  /** SCOP data storage limits */
  static readonly SCOP_DATA_LIMITS = {
    MAX_DAILY_RECORDS: 200, // Maximum daily COP records to store
    MAX_SEASONAL_HISTORY: 5, // Keep 5 years of seasonal data
    DATA_CLEANUP_INTERVAL_MS: 7 * 24 * 60 * 60 * 1000, // Weekly cleanup
  };
}
