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
}

// Export the app class exactly this way, so it can be used by Homey
module.exports = MyApp;
