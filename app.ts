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

  // Index signature to support dynamic trigger assignment
  [key: string]: FlowCardTrigger | ((...args: unknown[]) => unknown) | unknown;

  // Debug-conditional logging method
  private debugLog(...args: unknown[]) {
    if (process.env.DEBUG === '1') {
      this.log(...args);
    }
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
    // Initialize self-healing registry (v1.3.5 - automatic error recovery)
    this.selfHealing = new SelfHealingRegistry((message, ...args) => this.log(message, ...args));
    this.log('✅ Self-Healing Registry initialized');

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
    this.registerTimeScheduleCard();
    this.registerSeasonalModeCard();

    this.debugLog('Custom cards registered successfully');
  }

  registerComplexConditions() {
    // Temperature Differential Condition - custom logic
    const temperatureDifferentialCondition: FlowCardCondition = this.homey.flow.getConditionCard('temperature_differential');
    temperatureDifferentialCondition.registerRunListener(async (args: TemperatureDifferentialArgs, state: FlowState) => {
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
    });

    // 3-Phase Electrical Balance Check Condition - custom logic
    const electricalBalanceCheckCondition: FlowCardCondition = this.homey.flow.getConditionCard('electrical_balance_check');
    electricalBalanceCheckCondition.registerRunListener(
      async (args: ElectricalBalanceArgs, state: FlowState) => {
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
      },
    );

    // Water Flow Rate Check Condition - custom logic
    const waterFlowRateCheckCondition: FlowCardCondition = this.homey.flow.getConditionCard('water_flow_rate_check');
    waterFlowRateCheckCondition.registerRunListener(
      async (args: FlowRateArgs, state: FlowState) => {
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
      },
    );

    // System Pulse-Steps Differential Condition - custom logic
    const systemPulseStepsDifferentialCondition: FlowCardCondition = this.homey.flow.getConditionCard('system_pulse_steps_differential');
    systemPulseStepsDifferentialCondition.registerRunListener(
      async (args: PulseStepsDifferentialArgs, state: FlowState) => {
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
      const { input_value: inputValue, curve } = args;

      try {
        // Input validation
        if (typeof inputValue !== 'number' || Number.isNaN(inputValue)) {
          throw new Error('Input value must be a valid number');
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

        // Filter logic: Only execute flow if user's condition matches trigger condition
        if (userCondition === 'above') {
          const shouldExecute = triggerCondition === 'above' && currentTemp >= userThreshold;
          this.debugLog(`  → User wants ABOVE ${userThreshold}°C, temp crossed ${triggerCondition} at ${currentTemp}°C → ${shouldExecute ? 'EXECUTE' : 'SKIP'}`);
          return shouldExecute;
        }
        const shouldExecute = triggerCondition === 'below' && currentTemp <= userThreshold;
        this.debugLog(`  → User wants BELOW ${userThreshold}°C, temp crossed ${triggerCondition} at ${currentTemp}°C → ${shouldExecute ? 'EXECUTE' : 'SKIP'}`);
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

        if (userCondition === 'above') {
          return triggerCondition === 'above' && currentTemp >= userThreshold;
        }
        return triggerCondition === 'below' && currentTemp <= userThreshold;
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

        if (userCondition === 'above') {
          return triggerCondition === 'above' && currentTemp >= userThreshold;
        }
        return triggerCondition === 'below' && currentTemp <= userThreshold;
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

    // Compressor State Changed
    const compressorStateCard = this.homey.flow.getDeviceTriggerCard('compressor_state_changed');
    compressorStateCard.registerRunListener(async (args, state) => {
      const featureName = 'compressor_state_changed';
      try {
        if (!this.selfHealing.isFeatureEnabled(featureName)) return true;

        if (!state?.state || typeof state.state !== 'string') {
          this.error(`${featureName}: Invalid state`, { state });
          this.selfHealing.trackError(featureName, { error: 'Invalid state', state });
          return false;
        }
        if (!args?.state || typeof args.state !== 'string') {
          this.error(`${featureName}: Invalid args`, { args });
          this.selfHealing.trackError(featureName, { error: 'Invalid args', args });
          return false;
        }

        const userState = args.state;
        const currentState = state.state;

        // Only execute flow if user's desired state matches current state
        return userState === currentState;
      } catch (error) {
        this.error(`${featureName} runListener error:`, error);
        this.selfHealing.trackError(featureName, { error });
        return false;
      }
    });

    // Defrost State Changed
    const defrostStateCard = this.homey.flow.getDeviceTriggerCard('defrost_state_changed');
    defrostStateCard.registerRunListener(async (args, state) => {
      const featureName = 'defrost_state_changed';
      try {
        if (!this.selfHealing.isFeatureEnabled(featureName)) return true;

        if (!state?.state || typeof state.state !== 'string') {
          this.error(`${featureName}: Invalid state`, { state });
          this.selfHealing.trackError(featureName, { error: 'Invalid state', state });
          return false;
        }
        if (!args?.state || typeof args.state !== 'string') {
          this.error(`${featureName}: Invalid args`, { args });
          this.selfHealing.trackError(featureName, { error: 'Invalid args', args });
          return false;
        }

        const userState = args.state;
        const currentState = state.state;

        return userState === currentState;
      } catch (error) {
        this.error(`${featureName} runListener error:`, error);
        this.selfHealing.trackError(featureName, { error });
        return false;
      }
    });

    // Backwater State Changed
    const backwaterStateCard = this.homey.flow.getDeviceTriggerCard('backwater_state_changed');
    backwaterStateCard.registerRunListener(async (args, state) => {
      const featureName = 'backwater_state_changed';
      try {
        if (!this.selfHealing.isFeatureEnabled(featureName)) return true;

        if (!state?.state || typeof state.state !== 'string') {
          this.error(`${featureName}: Invalid state`, { state });
          this.selfHealing.trackError(featureName, { error: 'Invalid state', state });
          return false;
        }
        if (!args?.state || typeof args.state !== 'string') {
          this.error(`${featureName}: Invalid args`, { args });
          this.selfHealing.trackError(featureName, { error: 'Invalid args', args });
          return false;
        }

        const userState = args.state;
        const currentState = state.state;

        return userState === currentState;
      } catch (error) {
        this.error(`${featureName} runListener error:`, error);
        this.selfHealing.trackError(featureName, { error });
        return false;
      }
    });

    this.log(`Changed trigger runListeners registered successfully (9 triggers with self-healing, threshold: ${this.selfHealing ? '50 errors/hour' : 'N/A'})`);
  }
}

// Export the app class exactly this way, so it can be used by Homey
module.exports = MyApp;
