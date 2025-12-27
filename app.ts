/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import {
  App,
  FlowCardTrigger,
  FlowCardCondition,
  Device,
} from 'homey';
import enableDebugInspector from './app-debug'; // Uncomment and fix path if file exists
import {
  registerTemperatureAlerts,
  registerVoltageAlerts,
  registerCurrentAlerts,
  registerPulseStepsAlerts,
  registerStateChanges,
  registerSimpleActions,
  registerSimpleConditions,
  FLOW_PATTERNS,
} from './lib/flow-helpers';
import { CurveCalculator } from './lib/curve-calculator';
import { TimeScheduleCalculator } from './lib/time-schedule-calculator';
import { SeasonalModeCalculator } from './lib/seasonal-mode-calculator';
import { SelfHealingRegistry } from './lib/self-healing-registry';
import { enableFlowCardLogging } from './lib/flow-handler-wrapper';
import { Logger, LogLevel } from './lib/logger';

// Type definitions for flow card arguments
interface DeviceFlowArgs {
  device: Device;
}

interface TemperatureDifferentialArgs extends DeviceFlowArgs {
  differential: number;
}

interface ElectricalBalanceArgs extends DeviceFlowArgs {
  tolerance: number;
}

interface FlowRateArgs extends DeviceFlowArgs {
  flowRate: number;
}

interface PulseStepsDifferentialArgs extends DeviceFlowArgs {
  differential: number;
}

interface FlowState {
  [key: string]: FlowCardTrigger | FlowCardCondition | ((...args: unknown[]) => unknown) | unknown;
}

class MyApp extends App {
  // Additional storage for pattern-based triggers
  triggers: { [key: string]: FlowCardTrigger } = {};

  // Self-healing registry for automatic error recovery (v1.3.5)
  private selfHealing!: SelfHealingRegistry;

  // Structured logger with configurable log levels (v2.1.0)
  private logger!: Logger;

  // Index signature to support dynamic trigger assignment
  [key: string]: FlowCardTrigger | ((...args: unknown[]) => unknown) | unknown;

  // Debug-conditional logging method (DEPRECATED - use logger.debug() instead)
  private debugLog(...args: unknown[]) {
    if (process.env.DEBUG === '1') {
      this.log(...args);
    }
  }

  /**
   * Override Homey's log() method to route through Logger (v2.1.0)
   * All existing this.log() calls now respect the DEBUG environment variable
   */
  log(message?: unknown, ...args: unknown[]): void {
    // If logger is initialized, use it at INFO level
    // Otherwise fall back to Homey's default log (during early initialization)
    if (this.logger) {
      this.logger.info(this.safeStringify(message), ...args);
    } else {
      super.log(message, ...args);
    }
  }

  /**
   * Override Homey's error() method to route through Logger (v2.1.0)
   * Errors are always logged regardless of log level
   */
  error(message?: unknown, ...args: unknown[]): void {
    // If logger is initialized, use it
    // Otherwise fall back to Homey's default error (during early initialization)
    if (this.logger) {
      this.logger.error(this.safeStringify(message), ...args);
    } else {
      super.error(message, ...args);
    }
  }

  /**
   * Safely convert any value to string, handling circular references
   * This prevents crashes when logging complex error objects
   */
  private safeStringify(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return '';

    // Primitive types are safe
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    // For objects, use JSON.stringify with circular reference handler
    try {
      return JSON.stringify(value, this.getCircularReplacer());
    } catch (e) {
      // If JSON.stringify fails, fall back to toString()
      try {
        return String(value);
      } catch (e2) {
        // Last resort: return type information
        return `[${typeof value}]`;
      }
    }
  }

  /**
   * Create a replacer function that handles circular references
   * Used by JSON.stringify to prevent "Converting circular structure to JSON" errors
   */
  private getCircularReplacer() {
    const seen = new WeakSet();
    return (_key: string, value: unknown) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    };
  }

  // Trigger card references (auto-generated from patterns)
  // Temperature alerts
  coilertemperaturealertTrigger!: FlowCardTrigger;
  highpressuretemperaturealertTrigger!: FlowCardTrigger;
  lowpressuretemperaturealertTrigger!: FlowCardTrigger;
  incoilertemperaturealertTrigger!: FlowCardTrigger;
  tanktemperaturealertTrigger!: FlowCardTrigger;
  suctiontemperaturealertTrigger!: FlowCardTrigger;
  dischargetemperaturealertTrigger!: FlowCardTrigger;
  economizerinlettemperaturealertTrigger!: FlowCardTrigger;
  economizeroutlettemperaturealertTrigger!: FlowCardTrigger;

  // Voltage alerts
  phaseavoltagealertTrigger!: FlowCardTrigger;
  phasebvoltagealertTrigger!: FlowCardTrigger;
  phasecvoltagealertTrigger!: FlowCardTrigger;

  // Current alerts
  phasebcurrentalertTrigger!: FlowCardTrigger;
  phaseccurrentalertTrigger!: FlowCardTrigger;

  // Pulse-steps alerts
  eevpulsestepsalertTrigger!: FlowCardTrigger;
  evipulsestepsalertTrigger!: FlowCardTrigger;

  // State changes
  defroststatechangedTrigger!: FlowCardTrigger;
  compressorstatechangedTrigger!: FlowCardTrigger;
  backwaterstatechangedTrigger!: FlowCardTrigger;

  // Simple triggers (manually registered)
  faultDetectedTrigger!: FlowCardTrigger;
  powerThresholdExceededTrigger!: FlowCardTrigger;

  async onInit() {
    // Initialize structured logger (v2.1.0)
    // Use DEBUG env var for backward compatibility: DEBUG=1 → DEBUG level, otherwise ERROR level
    // CRITICAL: Use super.log/super.error to avoid infinite recursion
    const logLevel = process.env.DEBUG === '1' ? LogLevel.DEBUG : LogLevel.ERROR;
    this.logger = new Logger(
      super.log.bind(this),
      super.error.bind(this),
      logLevel,
      'App',
    );
    this.logger.info('App initializing with log level:', Logger.levelToString(logLevel), '(DEBUG=', process.env.DEBUG, ')');

    // Initialize self-healing registry (v1.3.5 - automatic error recovery)
    this.selfHealing = new SelfHealingRegistry(
      (message, ...args) => this.logger.debug(message, ...args),
      this.homey,
    );
    this.logger.info('✅ Self-Healing Registry initialized');

    // Enable automatic flow card logging (v2.0.0 - conditional on DEVMODE)
    enableFlowCardLogging(this.homey, this.log.bind(this));

    if (process.env.DEBUG === '1') {
      this.log('Development mode detected, enabling debug features');
      this.log('HOMEY_APP_RUNNER_DEVMODE=', process.env.HOMEY_APP_RUNNER_DEVMODE);
      await enableDebugInspector(); // Uncomment if enableDebugInspector is available
    }

    // Global safety net for unhandled promise rejections (production crash prevention)
    process.on('unhandledRejection', (reason, promise) => {
      this.error('⚠️ UNHANDLED PROMISE REJECTION - App crash prevented:', reason);
      this.error('Promise:', promise);

      // Send notification to user for critical errors
      this.homey.notifications.createNotification({
        excerpt: 'Heat Pump App: Internal error detected - check app diagnostics',
      }).catch(() => {
        this.error('Failed to send unhandledRejection notification');
      });
    });

    // Global safety net for uncaught exceptions (last resort crash prevention)
    process.on('uncaughtException', (error) => {
      this.error('⚠️ UNCAUGHT EXCEPTION - Critical error:', error);

      // Send critical notification to user
      this.homey.notifications.createNotification({
        excerpt: 'Heat Pump App: Critical error - app may be unstable, please restart',
      }).catch(() => {
        this.error('Failed to send uncaughtException notification');
      });

      // Log stack trace for debugging
      if (error.stack) {
        this.error('Stack trace:', error.stack);
      }
    });

    await this.initFlowCards();
    this.log('MyApp has been initialized with production-ready error handlers');
  }

  async onUninit() {
    // Clean up self-healing registry (v1.3.5)
    if (this.selfHealing) {
      this.selfHealing.destroy();
      this.log('Self-Healing Registry destroyed');
    }

    // Clean up global error handlers to prevent stacking during app updates
    // If we don't remove these, each app update adds another handler → duplicates
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('uncaughtException');

    this.log('MyApp uninitialized - global error handlers cleaned up');
  }

  async initFlowCards() {
    this.debugLog('Initializing flow cards with pattern-based registration...');

    // Register pattern-based cards
    this.registerPatternBasedCards();

    // Register custom/unique cards
    this.registerCustomCards();

    this.debugLog('Flow cards initialized successfully');
  }

  registerPatternBasedCards() {
    // Register all pattern-based triggers
    registerTemperatureAlerts(this, FLOW_PATTERNS.temperatureAlerts);
    registerVoltageAlerts(this, FLOW_PATTERNS.voltageAlerts);
    registerCurrentAlerts(this, FLOW_PATTERNS.currentAlerts);
    registerPulseStepsAlerts(this, FLOW_PATTERNS.pulseStepsAlerts);
    registerStateChanges(this, FLOW_PATTERNS.stateChanges);

    // Register all pattern-based actions
    registerSimpleActions(this, FLOW_PATTERNS.simpleActions);

    // Register all pattern-based conditions
    registerSimpleConditions(this, FLOW_PATTERNS.simpleConditions);

    this.debugLog('Pattern-based cards registered successfully');
  }

  registerCustomCards() {
    // Custom triggers that don't fit the pattern
    this.faultDetectedTrigger = this.homey.flow.getTriggerCard('fault_detected');
    this.powerThresholdExceededTrigger = this.homey.flow.getTriggerCard('power_threshold_exceeded');

    // Custom conditions with complex logic
    this.registerComplexConditions();

    // RunListeners for "changed" triggers (v1.3.2+)
    this.registerChangedTriggerRunListeners();

    // Calculator action cards
    this.registerCurveCalculatorCard();
    this.registerLinearHeatingCurveCard();
    this.registerTimeScheduleCard();
    this.registerSeasonalModeCard();

    this.debugLog('Custom cards registered successfully');
  }

  registerComplexConditions() {
    // Temperature Differential Condition - custom logic
    const temperatureDifferentialCondition: FlowCardCondition = this.homey.flow.getConditionCard('temperature_differential');
    temperatureDifferentialCondition.registerRunListener(async (args: TemperatureDifferentialArgs, state: FlowState) => {
      const featureName = 'temperature_differential';

      try {
        // Self-healing: Check if feature disabled (v1.3.6)
        if (!this.selfHealing.isFeatureEnabled(featureName)) {
          this.debugLog(`${featureName}: Disabled by self-healing - degraded mode`);
          return false; // Fail-safe: return false when filtering disabled
        }

        // Input validation
        if (!args?.device || typeof args.differential !== 'number') {
          this.error(`${featureName}: Invalid args`, { args });
          this.selfHealing.trackError(featureName, { error: 'Invalid args', args });
          return false;
        }

        this.debugLog('Temperature differential condition triggered', { args, state });
        const { device } = args;
        const rawInletTemp = device.getCapabilityValue('measure_temperature.temp_top');
        const rawOutletTemp = device.getCapabilityValue('measure_temperature.temp_bottom');
        const inletTempIsNull = rawInletTemp === null || rawInletTemp === undefined;
        const outletTempIsNull = rawOutletTemp === null || rawOutletTemp === undefined;
        const inletTemp = rawInletTemp || 0;
        const outletTemp = rawOutletTemp || 0;
        const actualDifferential = Math.abs(inletTemp - outletTemp);
        const result = actualDifferential > args.differential;

        if (inletTempIsNull || outletTempIsNull) {
          this.debugLog('Temperature differential condition: using fallback values for null capabilities', {
            inletTempRaw: rawInletTemp,
            inletTempFallback: inletTemp,
            inletTempIsNull,
            outletTempRaw: rawOutletTemp,
            outletTempFallback: outletTemp,
            outletTempIsNull,
            actualDifferential,
            threshold: args.differential,
            result,
          });
        } else {
          this.debugLog('Temperature differential condition result', {
            inletTemp,
            outletTemp,
            actualDifferential,
            threshold: args.differential,
            result,
          });
        }
        return result;
      } catch (error) {
        this.error(`${featureName} runListener error:`, error);
        this.selfHealing.trackError(featureName, { error });
        return false; // Fail-safe: return false on error
      }
    });

    // 3-Phase Electrical Balance Check Condition - custom logic
    const electricalBalanceCheckCondition: FlowCardCondition = this.homey.flow.getConditionCard('electrical_balance_check');
    electricalBalanceCheckCondition.registerRunListener(
      async (args: ElectricalBalanceArgs, state: FlowState) => {
        const featureName = 'electrical_balance_check';

        try {
          // Self-healing: Check if feature disabled (v1.3.6)
          if (!this.selfHealing.isFeatureEnabled(featureName)) {
            this.debugLog(`${featureName}: Disabled by self-healing - degraded mode`);
            return false; // Fail-safe: return false when filtering disabled
          }

          // Input validation
          if (!args?.device || typeof args.tolerance !== 'number') {
            this.error(`${featureName}: Invalid args`, { args });
            this.selfHealing.trackError(featureName, { error: 'Invalid args', args });
            return false;
          }

          this.debugLog('Electrical balance condition triggered', { args, state });
          const { device } = args;
          const rawCurrentA = device.getCapabilityValue('measure_current.cur_current');
          const rawCurrentB = device.getCapabilityValue('measure_current.b_cur');
          const rawCurrentC = device.getCapabilityValue('measure_current.c_cur');
          const currentAIsNull = rawCurrentA === null || rawCurrentA === undefined;
          const currentBIsNull = rawCurrentB === null || rawCurrentB === undefined;
          const currentCIsNull = rawCurrentC === null || rawCurrentC === undefined;
          const currentA = rawCurrentA || 0;
          const currentB = rawCurrentB || 0;
          const currentC = rawCurrentC || 0;

          const avgCurrent = (currentA + currentB + currentC) / 3;
          const toleranceValue = (args.tolerance / 100) * avgCurrent;

          const balanceA = Math.abs(currentA - avgCurrent) <= toleranceValue;
          const balanceB = Math.abs(currentB - avgCurrent) <= toleranceValue;
          const balanceC = Math.abs(currentC - avgCurrent) <= toleranceValue;

          const result = balanceA && balanceB && balanceC;

          if (currentAIsNull || currentBIsNull || currentCIsNull) {
            this.debugLog('Electrical balance condition: using fallback values for null capabilities', {
              currentARaw: rawCurrentA,
              currentAFallback: currentA,
              currentAIsNull,
              currentBRaw: rawCurrentB,
              currentBFallback: currentB,
              currentBIsNull,
              currentCRaw: rawCurrentC,
              currentCFallback: currentC,
              currentCIsNull,
              avgCurrent,
              tolerance: args.tolerance,
              toleranceValue,
              balanceA,
              balanceB,
              balanceC,
              result,
            });
          } else {
            this.debugLog('Electrical balance condition result', {
              currentA,
              currentB,
              currentC,
              avgCurrent,
              tolerance: args.tolerance,
              toleranceValue,
              balanceA,
              balanceB,
              balanceC,
              result,
            });
          }
          return result;
        } catch (error) {
          this.error(`${featureName} runListener error:`, error);
          this.selfHealing.trackError(featureName, { error });
          return false; // Fail-safe: return false on error
        }
      },
    );

    // Water Flow Rate Check Condition - custom logic
    const waterFlowRateCheckCondition: FlowCardCondition = this.homey.flow.getConditionCard('water_flow_rate_check');
    waterFlowRateCheckCondition.registerRunListener(
      async (args: FlowRateArgs, state: FlowState) => {
        const featureName = 'water_flow_rate_check';

        try {
          // Self-healing: Check if feature disabled (v1.3.6)
          if (!this.selfHealing.isFeatureEnabled(featureName)) {
            this.debugLog(`${featureName}: Disabled by self-healing - degraded mode`);
            return false; // Fail-safe: return false when filtering disabled
          }

          // Input validation
          if (!args?.device || typeof args.flowRate !== 'number') {
            this.error(`${featureName}: Invalid args`, { args });
            this.selfHealing.trackError(featureName, { error: 'Invalid args', args });
            return false;
          }

          this.debugLog('Water flow rate condition triggered', { args, state });
          const { device } = args;
          const rawFlowRate = device.getCapabilityValue('measure_water');
          const flowRateIsNull = rawFlowRate === null || rawFlowRate === undefined;
          const currentFlowRate = rawFlowRate || 0;
          const result = currentFlowRate > args.flowRate;

          if (flowRateIsNull) {
            this.debugLog('Water flow rate condition: using fallback value for null capability', {
              flowRateRaw: rawFlowRate,
              flowRateFallback: currentFlowRate,
              flowRateIsNull,
              threshold: args.flowRate,
              result,
            });
          } else {
            this.debugLog('Water flow rate condition result', {
              currentFlowRate,
              threshold: args.flowRate,
              result,
            });
          }
          return result;
        } catch (error) {
          this.error(`${featureName} runListener error:`, error);
          this.selfHealing.trackError(featureName, { error });
          return false; // Fail-safe: return false on error
        }
      },
    );

    // System Pulse-Steps Differential Condition - custom logic
    const systemPulseStepsDifferentialCondition: FlowCardCondition = this.homey.flow.getConditionCard('system_pulse_steps_differential');
    systemPulseStepsDifferentialCondition.registerRunListener(
      async (args: PulseStepsDifferentialArgs, state: FlowState) => {
        const featureName = 'system_pulse_steps_differential';

        try {
          // Self-healing: Check if feature disabled (v1.3.6)
          if (!this.selfHealing.isFeatureEnabled(featureName)) {
            this.debugLog(`${featureName}: Disabled by self-healing - degraded mode`);
            return false; // Fail-safe: return false when filtering disabled
          }

          // Input validation
          if (!args?.device || typeof args.differential !== 'number') {
            this.error(`${featureName}: Invalid args`, { args });
            this.selfHealing.trackError(featureName, { error: 'Invalid args', args });
            return false;
          }

          this.debugLog('Pulse steps differential condition triggered', { args, state });
          const { device } = args;
          const rawEevPulseSteps = device.getCapabilityValue('adlar_measure_pulse_steps_temp_current');
          const rawEviPulseSteps = device.getCapabilityValue('adlar_measure_pulse_steps_effluent_temp');
          const eevPulseStepsIsNull = rawEevPulseSteps === null || rawEevPulseSteps === undefined;
          const eviPulseStepsIsNull = rawEviPulseSteps === null || rawEviPulseSteps === undefined;
          const eevPulseSteps = rawEevPulseSteps || 0;
          const eviPulseSteps = rawEviPulseSteps || 0;
          const actualDifferential = Math.abs(eevPulseSteps - eviPulseSteps);
          const result = actualDifferential > args.differential;

          if (eevPulseStepsIsNull || eviPulseStepsIsNull) {
            this.debugLog('Pulse steps differential condition: using fallback values for null capabilities', {
              eevPulseStepsRaw: rawEevPulseSteps,
              eevPulseStepsFallback: eevPulseSteps,
              eevPulseStepsIsNull,
              eviPulseStepsRaw: rawEviPulseSteps,
              eviPulseStepsFallback: eviPulseSteps,
              eviPulseStepsIsNull,
              actualDifferential,
              threshold: args.differential,
              result,
            });
          } else {
            this.debugLog('Pulse steps differential condition result', {
              eevPulseSteps,
              eviPulseSteps,
              actualDifferential,
              threshold: args.differential,
              result,
            });
          }
          return result;
        } catch (error) {
          this.error(`${featureName} runListener error:`, error);
          this.selfHealing.trackError(featureName, { error });
          return false; // Fail-safe: return false on error
        }
      },
    );
  }

  /**
   * Register curve calculator action card with production-ready error handling
   *
   * Allows users to calculate values dynamically based on configurable curves.
   * Primary use case: Weather-compensated heating (outdoor temp → heating setpoint)
   */
  registerCurveCalculatorCard() {
    const curveCard = this.homey.flow.getActionCard('calculate_curve_value');

    curveCard.registerRunListener(async (args, state) => {
      const { input_value: inputValueRaw, curve } = args;

      try {
        // Parse input value (supports both number and string with number)
        let inputValue: number;
        if (typeof inputValueRaw === 'number') {
          inputValue = inputValueRaw;
        } else if (typeof inputValueRaw === 'string') {
          inputValue = parseFloat(inputValueRaw);
        } else {
          throw new Error('Input value must be a number or numeric string');
        }

        // Validate parsed number
        if (Number.isNaN(inputValue) || !Number.isFinite(inputValue)) {
          throw new Error(`Input value must be a valid number (received: "${inputValueRaw}")`);
        }

        if (!curve || typeof curve !== 'string' || curve.trim() === '') {
          throw new Error('Curve definition cannot be empty');
        }

        // Evaluate curve using CurveCalculator utility
        const resultValue = CurveCalculator.evaluate(inputValue, curve);

        // Log result (only in debug mode)
        this.debugLog(`Curve calculation: ${inputValue} → ${resultValue}`, {
          inputValue,
          curve: curve.substring(0, 100), // Truncate long curves in logs
          resultValue,
        });

        // Standard logging for production
        this.log(`Curve calculation successful: ${inputValue} → ${resultValue}`);

        return { result_value: resultValue };

      } catch (error) {
        // Error logging
        this.error('Curve calculation failed:', error);

        // Re-throw with user-friendly message
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Curve calculation failed: ${errorMessage}`);
      }
    });

    this.debugLog('Curve calculator card registered successfully');
  }

  /**
   * Register linear heating curve calculator action card
   *
   * Calculates supply temperature using linear formula: y = slope * x + intercept
   * where intercept = reference_temp - (slope * reference_outdoor)
   *
   * Example: Reference point (55°C at -15°C), slope -0.5 → Formula: y = -0.5x + 47.5
   *
   * Primary use cases:
   * - Weather compensation heating curves
   * - Day/night temperature profiles
   * - Seasonal heating adjustments
   */
  registerLinearHeatingCurveCard() {
    const linearCurveCard = this.homey.flow.getActionCard('calculate_linear_heating_curve');

    linearCurveCard.registerRunListener(async (args, state) => {
      const {
        outdoor_temp: outdoorTempRaw,
        reference_temp,
        reference_outdoor,
        slope,
      } = args;

      try {
        // Parse outdoor temperature (supports number, string, tokens)
        let outdoorTemp: number;
        if (typeof outdoorTempRaw === 'number') {
          outdoorTemp = outdoorTempRaw;
        } else if (typeof outdoorTempRaw === 'string') {
          outdoorTemp = parseFloat(outdoorTempRaw);
        } else {
          throw new Error('Outdoor temperature must be a number or numeric string');
        }

        // Validate parsed number
        if (Number.isNaN(outdoorTemp) || !Number.isFinite(outdoorTemp)) {
          throw new Error(`Outdoor temperature must be valid (received: "${outdoorTempRaw}")`);
        }

        // Validate other parameters
        if (Number.isNaN(reference_temp) || Number.isNaN(reference_outdoor) || Number.isNaN(slope)) {
          throw new Error('All parameters must be valid numbers');
        }

        // Calculate supply temperature: y = slope * x + intercept
        // Intercept: b = reference_temp - (slope * reference_outdoor)
        const intercept = reference_temp - (slope * reference_outdoor);
        const supplyTemperature = (slope * outdoorTemp) + intercept;

        // Round to 1 decimal place for practical use
        const roundedSupplyTemp = Math.round(supplyTemperature * 10) / 10;

        // Log results (debug mode)
        this.debugLog(`Linear heating curve: ${outdoorTemp}°C → ${roundedSupplyTemp}°C`, {
          outdoorTemp,
          referencePoint: `${reference_temp}°C @ ${reference_outdoor}°C`,
          slope,
          intercept,
          supplyTemperature: roundedSupplyTemp,
        });

        // Standard logging for production
        this.log(`Linear curve: ${outdoorTemp}°C → ${roundedSupplyTemp}°C (slope: ${slope})`);

        return { supply_temperature: roundedSupplyTemp };

      } catch (error) {
        // Error logging
        this.error('Linear heating curve calculation failed:', error);

        // Re-throw with user-friendly message
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Linear heating curve failed: ${errorMessage}`);
      }
    });

    this.debugLog('Linear heating curve card registered successfully');
  }

  /**
   * Register time schedule calculator action card
   *
   * Allows users to calculate values dynamically based on time-of-day schedules.
   * Primary use case: Daily temperature scheduling (morning/day/evening/night setpoints)
   */
  registerTimeScheduleCard() {
    const timeScheduleCard = this.homey.flow.getActionCard('calculate_time_based_value');

    timeScheduleCard.registerRunListener(async (args, state) => {
      const { schedule } = args;

      try {
        // Input validation
        if (!schedule || typeof schedule !== 'string' || schedule.trim() === '') {
          throw new Error('Schedule definition cannot be empty');
        }

        // Evaluate schedule using TimeScheduleCalculator utility
        const resultValue = TimeScheduleCalculator.evaluate(schedule);

        // Log result (only in debug mode)
        this.debugLog(`Time schedule calculation: ${resultValue}`, {
          schedule: schedule.substring(0, 100), // Truncate long schedules in logs
          currentTime: new Date().toTimeString(),
          resultValue,
        });

        // Standard logging for production
        this.log(`Time schedule calculation successful: ${resultValue}`);

        return { result_value: resultValue };

      } catch (error) {
        // Error logging
        this.error('Time schedule calculation failed:', error);

        // Re-throw with user-friendly message
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Time schedule calculation failed: ${errorMessage}`);
      }
    });

    this.debugLog('Time schedule calculator card registered successfully');
  }

  /**
   * Register seasonal mode action card
   *
   * Returns current seasonal mode (heating/cooling) based on date.
   * Heating season: Oct 1 - May 15 (aligned with EN 14825 SCOP standard)
   */
  registerSeasonalModeCard() {
    const seasonalModeCard = this.homey.flow.getActionCard('get_seasonal_mode');

    seasonalModeCard.registerRunListener(async (args, state) => {
      try {
        // Get current seasonal mode using SeasonalModeCalculator utility
        const seasonResult = SeasonalModeCalculator.getCurrentSeason();

        // Log result (only in debug mode)
        this.debugLog('Seasonal mode calculation:', {
          mode: seasonResult.mode,
          isHeatingSeason: seasonResult.isHeatingSeason,
          month: seasonResult.month,
          day: seasonResult.day,
          daysUntilSeasonChange: seasonResult.daysUntilSeasonChange,
        });

        // Standard logging for production
        this.log(`Seasonal mode: ${seasonResult.mode} (${seasonResult.daysUntilSeasonChange} days until change)`);

        return {
          mode: seasonResult.mode,
          is_heating_season: seasonResult.isHeatingSeason,
          is_cooling_season: seasonResult.isCoolingSeason,
          days_until_season_change: seasonResult.daysUntilSeasonChange,
        };

      } catch (error) {
        // Error logging
        this.error('Seasonal mode calculation failed:', error);

        // Re-throw with user-friendly message
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Seasonal mode calculation failed: ${errorMessage}`);
      }
    });

    this.debugLog('Seasonal mode calculator card registered successfully');
  }

  /**
   * Register runListeners for "changed" trigger cards (v1.3.2+, fixed v1.3.4, enhanced v1.3.5)
   *
   * CRITICAL FIX: These triggers have user args (condition + threshold/state)
   * but were missing runListeners to filter flows based on user-specified values.
   *
   * Without runListeners:
   * - Trigger fires on ANY change
   * - User args (above/below, threshold) are IGNORED
   * - Flows execute regardless of condition
   *
   * With runListeners:
   * - Homey evaluates args.condition vs state.condition
   * - Flow only executes if user-specified threshold is crossed
   * - Proper filtering based on user intent
   *
   * v1.3.4 Bug Fixes:
   * - Added try-catch blocks to prevent unhandled Promise rejections
   * - Added state validation to handle undefined/null values safely
   * - Removed unsafe .toUpperCase() calls that could throw on undefined
   * - All runListeners now fail-safe (return false on error)
   *
   * v1.3.5 Self-Healing:
   * - Auto-disables runListeners after 50 errors/hour (prevents crash loops)
   * - Graceful degradation: disabled features fall back to "execute all flows" mode
   * - Auto-re-enables after 1 hour cooldown (automatic recovery)
   * - Prevents permanent device failure from recurring bugs
   *
   * Affected triggers (9 total):
   * - Temperature-based (3): ambient, inlet, outlet
   * - COP-based (3): real-time, daily, monthly
   * - State-based (3): compressor, defrost, backwater
   */
  registerChangedTriggerRunListeners() {
    // ========================================
    // CATEGORY 1: Temperature-Based Triggers (3)
    // ========================================

    // Ambient Temperature Changed
    const ambientTempCard = this.homey.flow.getDeviceTriggerCard('ambient_temperature_changed');
    ambientTempCard.registerRunListener(async (args, state) => {
      const featureName = 'ambient_temperature_changed';

      try {
        // Self-healing: Check if feature disabled due to excessive errors (v1.3.5)
        if (!this.selfHealing.isFeatureEnabled(featureName)) {
          this.debugLog(`${featureName}: Disabled by self-healing - executing flow without filtering (degraded mode)`);
          return true; // Fail-open: execute all flows when filtering disabled
        }

        // Validate inputs (fail-safe: return false if invalid)
        if (!state?.condition || !state?.temperature || typeof state.temperature !== 'number') {
          this.error(`${featureName}: Invalid state object`, { state });
          this.selfHealing.trackError(featureName, { error: 'Invalid state', state });
          return false;
        }
        if (!args?.condition || !args?.temperature || typeof args.temperature !== 'number') {
          this.error(`${featureName}: Invalid args object`, { args });
          this.selfHealing.trackError(featureName, { error: 'Invalid args', args });
          return false;
        }

        const userCondition = args.condition; // User-specified: 'above' or 'below'
        const userThreshold = args.temperature; // User-specified: e.g., 20°C
        const currentTemp = state.temperature; // Actual temp from state: e.g., 11°C
        const triggerCondition = state.condition; // State condition: 'above' or 'below'

        this.debugLog(`🔍 ${featureName} runListener:`, {
          userCondition,
          userThreshold,
          currentTemp,
          triggerCondition,
        });

        // v1.3.12: Simple threshold check (ignore trigger direction)
        // User expectation: "below 15°C" means "whenever temp < 15°C", not "only when crossing below"
        const shouldExecute = (userCondition === 'above')
          ? currentTemp >= userThreshold
          : currentTemp <= userThreshold;

        this.debugLog(`  → User wants ${userCondition.toUpperCase()} ${userThreshold}°C, current temp: ${currentTemp}°C (crossed ${triggerCondition}) → ${shouldExecute ? 'EXECUTE' : 'SKIP'}`);
        return shouldExecute;
      } catch (error) {
        this.error(`${featureName} runListener error:`, error);
        this.selfHealing.trackError(featureName, { error });
        return false; // Fail-safe: don't execute flow on error
      }
    });

    // Inlet Temperature Changed
    const inletTempCard = this.homey.flow.getDeviceTriggerCard('inlet_temperature_changed');
    inletTempCard.registerRunListener(async (args, state) => {
      const featureName = 'inlet_temperature_changed';
      try {
        if (!this.selfHealing.isFeatureEnabled(featureName)) {
          return true; // Degraded mode: execute all flows
        }

        if (!state?.condition || !state?.temperature || typeof state.temperature !== 'number') {
          this.error(`${featureName}: Invalid state`, { state });
          this.selfHealing.trackError(featureName, { error: 'Invalid state', state });
          return false;
        }
        if (!args?.condition || !args?.temperature || typeof args.temperature !== 'number') {
          this.error(`${featureName}: Invalid args`, { args });
          this.selfHealing.trackError(featureName, { error: 'Invalid args', args });
          return false;
        }

        const userCondition = args.condition;
        const userThreshold = args.temperature;
        const currentTemp = state.temperature;
        const triggerCondition = state.condition;

        // v1.3.12: Simple threshold check (ignore trigger direction)
        // User expectation: "above 60°C" means "whenever temp > 60°C", not "only when crossing above"
        const shouldExecute = (userCondition === 'above')
          ? currentTemp >= userThreshold
          : currentTemp <= userThreshold;

        this.debugLog(`🔍 ${featureName}: User wants ${userCondition.toUpperCase()} ${userThreshold}°C, current: ${currentTemp}°C (crossed ${triggerCondition}) → ${shouldExecute ? 'EXECUTE' : 'SKIP'}`);
        return shouldExecute;
      } catch (error) {
        this.error(`${featureName} runListener error:`, error);
        this.selfHealing.trackError(featureName, { error });
        return false;
      }
    });

    // Outlet Temperature Changed
    const outletTempCard = this.homey.flow.getDeviceTriggerCard('outlet_temperature_changed');
    outletTempCard.registerRunListener(async (args, state) => {
      const featureName = 'outlet_temperature_changed';
      try {
        if (!this.selfHealing.isFeatureEnabled(featureName)) {
          return true; // Degraded mode: execute all flows
        }

        if (!state?.condition || !state?.temperature || typeof state.temperature !== 'number') {
          this.error(`${featureName}: Invalid state`, { state });
          this.selfHealing.trackError(featureName, { error: 'Invalid state', state });
          return false;
        }
        if (!args?.condition || !args?.temperature || typeof args.temperature !== 'number') {
          this.error(`${featureName}: Invalid args`, { args });
          this.selfHealing.trackError(featureName, { error: 'Invalid args', args });
          return false;
        }

        const userCondition = args.condition;
        const userThreshold = args.temperature;
        const currentTemp = state.temperature;
        const triggerCondition = state.condition;

        // v1.3.12: Simple threshold check (ignore trigger direction)
        // User expectation: "below 30°C" means "whenever temp < 30°C", not "only when crossing below"
        const shouldExecute = (userCondition === 'above')
          ? currentTemp >= userThreshold
          : currentTemp <= userThreshold;

        this.debugLog(`🔍 ${featureName}: User wants ${userCondition.toUpperCase()} ${userThreshold}°C, current: ${currentTemp}°C (crossed ${triggerCondition}) → ${shouldExecute ? 'EXECUTE' : 'SKIP'}`);
        return shouldExecute;
      } catch (error) {
        this.error(`${featureName} runListener error:`, error);
        this.selfHealing.trackError(featureName, { error });
        return false;
      }
    });

    // ========================================
    // CATEGORY 2: COP Efficiency Triggers (3)
    // ========================================

    // Real-Time COP Efficiency Changed
    const copEfficiencyCard = this.homey.flow.getDeviceTriggerCard('cop_efficiency_changed');
    copEfficiencyCard.registerRunListener(async (args, state) => {
      const featureName = 'cop_efficiency_changed';
      try {
        if (!this.selfHealing.isFeatureEnabled(featureName)) return true;

        if (!state?.condition || typeof state?.cop_value !== 'number') {
          this.error(`${featureName}: Invalid state`, { state });
          this.selfHealing.trackError(featureName, { error: 'Invalid state', state });
          return false;
        }
        if (!args?.condition || typeof args?.threshold !== 'number') {
          this.error(`${featureName}: Invalid args`, { args });
          this.selfHealing.trackError(featureName, { error: 'Invalid args', args });
          return false;
        }

        const userCondition = args.condition;
        const userThreshold = args.threshold;
        const currentCOP = state.cop_value;
        const triggerCondition = state.condition;

        if (userCondition === 'above') {
          return triggerCondition === 'above' && currentCOP >= userThreshold;
        }
        return triggerCondition === 'below' && currentCOP <= userThreshold;
      } catch (error) {
        this.error(`${featureName} runListener error:`, error);
        this.selfHealing.trackError(featureName, { error });
        return false;
      }
    });

    // Daily COP Efficiency Changed
    const dailyCOPCard = this.homey.flow.getDeviceTriggerCard('daily_cop_efficiency_changed');
    dailyCOPCard.registerRunListener(async (args, state) => {
      const featureName = 'daily_cop_efficiency_changed';
      try {
        if (!this.selfHealing.isFeatureEnabled(featureName)) return true;

        if (!state?.condition || typeof state?.cop_value !== 'number') {
          this.error(`${featureName}: Invalid state`, { state });
          this.selfHealing.trackError(featureName, { error: 'Invalid state', state });
          return false;
        }
        if (!args?.condition || typeof args?.threshold !== 'number') {
          this.error(`${featureName}: Invalid args`, { args });
          this.selfHealing.trackError(featureName, { error: 'Invalid args', args });
          return false;
        }

        const userCondition = args.condition;
        const userThreshold = args.threshold;
        const currentCOP = state.cop_value;
        const triggerCondition = state.condition;

        if (userCondition === 'above') {
          return triggerCondition === 'above' && currentCOP >= userThreshold;
        }
        return triggerCondition === 'below' && currentCOP <= userThreshold;
      } catch (error) {
        this.error(`${featureName} runListener error:`, error);
        this.selfHealing.trackError(featureName, { error });
        return false;
      }
    });

    // Monthly COP Efficiency Changed
    const monthlyCOPCard = this.homey.flow.getDeviceTriggerCard('monthly_cop_efficiency_changed');
    monthlyCOPCard.registerRunListener(async (args, state) => {
      const featureName = 'monthly_cop_efficiency_changed';
      try {
        if (!this.selfHealing.isFeatureEnabled(featureName)) return true;

        if (!state?.condition || typeof state?.cop_value !== 'number') {
          this.error(`${featureName}: Invalid state`, { state });
          this.selfHealing.trackError(featureName, { error: 'Invalid state', state });
          return false;
        }
        if (!args?.condition || typeof args?.threshold !== 'number') {
          this.error(`${featureName}: Invalid args`, { args });
          this.selfHealing.trackError(featureName, { error: 'Invalid args', args });
          return false;
        }

        const userCondition = args.condition;
        const userThreshold = args.threshold;
        const currentCOP = state.cop_value;
        const triggerCondition = state.condition;

        if (userCondition === 'above') {
          return triggerCondition === 'above' && currentCOP >= userThreshold;
        }
        return triggerCondition === 'below' && currentCOP <= userThreshold;
      } catch (error) {
        this.error(`${featureName} runListener error:`, error);
        this.selfHealing.trackError(featureName, { error });
        return false;
      }
    });

    // ========================================
    // CATEGORY 3: State-Based Triggers (3)
    // ========================================

    // State Changed Flow Cards: Removed custom triggers for compressor/defrost/backwater
    // Now using Homey's automatic capability-based flow cards ("when turned on/off")
    // The boolean capabilities (adlar_state_compressor_state, adlar_state_defrost_state,
    // adlar_state_backwater) automatically generate flow cards when their values change

    // === EXPERT MODE TRIGGERS (v1.3.12) ===
    // Compressor efficiency alert
    const compressorEfficiencyCard = this.homey.flow.getDeviceTriggerCard('compressor_efficiency_alert');
    compressorEfficiencyCard.registerRunListener(async (args, state) => {
      const featureName = 'compressor_efficiency_alert';

      try {
        // Self-healing check
        if (!this.selfHealing.isFeatureEnabled(featureName)) {
          this.debugLog(`${featureName}: Disabled by self-healing - executing flow (degraded mode)`);
          return true;
        }

        // Validate inputs
        if (!state?.condition || !state?.frequency || typeof state.frequency !== 'number') {
          this.error(`${featureName}: Invalid state object`, { state });
          this.selfHealing.trackError(featureName, { error: 'Invalid state', state });
          return false;
        }
        if (!args?.condition || !args?.frequency || typeof args.frequency !== 'number') {
          this.error(`${featureName}: Invalid args object`, { args });
          this.selfHealing.trackError(featureName, { error: 'Invalid args', args });
          return false;
        }

        const userCondition = args.condition; // 'above' or 'below'
        const userThreshold = args.frequency; // e.g., 150 Hz
        const currentFrequency = state.frequency; // e.g., 160 Hz

        this.debugLog(`🔍 ${featureName} runListener:`, {
          userCondition,
          userThreshold,
          currentFrequency,
        });

        // v1.3.12: Threshold monitoring (ignore crossing direction)
        // User expectation: "above 150 Hz" means "whenever frequency > 150 Hz"
        const shouldExecute = (userCondition === 'above')
          ? currentFrequency >= userThreshold
          : currentFrequency <= userThreshold;

        this.debugLog(`  → User wants ${userCondition.toUpperCase()} ${userThreshold} Hz, current: ${currentFrequency} Hz → ${shouldExecute ? 'EXECUTE' : 'SKIP'}`);
        return shouldExecute;
      } catch (error) {
        this.error(`${featureName} runListener error:`, error);
        this.selfHealing.trackError(featureName, { error });
        return false;
      }
    });

    // Fan motor efficiency alert
    const fanMotorEfficiencyCard = this.homey.flow.getDeviceTriggerCard('fan_motor_efficiency_alert');
    fanMotorEfficiencyCard.registerRunListener(async (args, state) => {
      const featureName = 'fan_motor_efficiency_alert';

      try {
        // Self-healing check
        if (!this.selfHealing.isFeatureEnabled(featureName)) {
          this.debugLog(`${featureName}: Disabled by self-healing - executing flow (degraded mode)`);
          return true;
        }

        // Validate inputs
        if (!state?.condition || !state?.frequency || typeof state.frequency !== 'number') {
          this.error(`${featureName}: Invalid state object`, { state });
          this.selfHealing.trackError(featureName, { error: 'Invalid state', state });
          return false;
        }
        if (!args?.condition || !args?.frequency || typeof args.frequency !== 'number') {
          this.error(`${featureName}: Invalid args object`, { args });
          this.selfHealing.trackError(featureName, { error: 'Invalid args', args });
          return false;
        }

        const userCondition = args.condition; // 'above' or 'below'
        const userThreshold = args.frequency; // e.g., 80 Hz
        const currentFrequency = state.frequency; // e.g., 75 Hz

        this.debugLog(`🔍 ${featureName} runListener:`, {
          userCondition,
          userThreshold,
          currentFrequency,
        });

        // v1.3.12: Threshold monitoring (ignore crossing direction)
        // User expectation: "below 30 Hz" means "whenever frequency < 30 Hz"
        const shouldExecute = (userCondition === 'above')
          ? currentFrequency >= userThreshold
          : currentFrequency <= userThreshold;

        this.debugLog(`  → User wants ${userCondition.toUpperCase()} ${userThreshold} Hz, current: ${currentFrequency} Hz → ${shouldExecute ? 'EXECUTE' : 'SKIP'}`);
        return shouldExecute;
      } catch (error) {
        this.error(`${featureName} runListener error:`, error);
        this.selfHealing.trackError(featureName, { error });
        return false;
      }
    });

    // Water flow alert
    const waterFlowCard = this.homey.flow.getDeviceTriggerCard('water_flow_alert');
    waterFlowCard.registerRunListener(async (args, state) => {
      const featureName = 'water_flow_alert';

      try {
        // Self-healing check
        if (!this.selfHealing.isFeatureEnabled(featureName)) {
          this.debugLog(`${featureName}: Disabled by self-healing - executing flow (degraded mode)`);
          return true;
        }

        // Validate inputs
        if (!state?.condition || !state?.flow_rate || typeof state.flow_rate !== 'number') {
          this.error(`${featureName}: Invalid state object`, { state });
          this.selfHealing.trackError(featureName, { error: 'Invalid state', state });
          return false;
        }
        if (!args?.condition || !args?.flow_rate || typeof args.flow_rate !== 'number') {
          this.error(`${featureName}: Invalid args object`, { args });
          this.selfHealing.trackError(featureName, { error: 'Invalid args', args });
          return false;
        }

        const userCondition = args.condition; // 'above' or 'below'
        const userThreshold = args.flow_rate; // e.g., 15 L/min
        const currentFlowRate = state.flow_rate; // e.g., 12 L/min

        this.debugLog(`🔍 ${featureName} runListener:`, {
          userCondition,
          userThreshold,
          currentFlowRate,
        });

        // v1.3.12: Threshold monitoring (ignore crossing direction)
        // User expectation: "below 15 L/min" means "whenever flow < 15 L/min"
        const shouldExecute = (userCondition === 'above')
          ? currentFlowRate >= userThreshold
          : currentFlowRate <= userThreshold;

        this.debugLog(`  → User wants ${userCondition.toUpperCase()} ${userThreshold} L/min, current: ${currentFlowRate} L/min → ${shouldExecute ? 'EXECUTE' : 'SKIP'}`);
        return shouldExecute;
      } catch (error) {
        this.error(`${featureName} runListener error:`, error);
        this.selfHealing.trackError(featureName, { error });
        return false;
      }
    });

    this.log(`Changed trigger runListeners registered successfully (12 triggers with self-healing: 9 standard + 3 expert mode, threshold: ${this.selfHealing ? '50 errors/hour' : 'N/A'})`);
  }
}

// Export the app class exactly this way, so it can be used by Homey
module.exports = MyApp;
