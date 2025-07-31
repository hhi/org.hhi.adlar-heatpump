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

    await this.initFlowCards();
    this.log('MyApp has been initialized');
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
      const { device } = args;
      const inletTemp = device.getCapabilityValue('measure_temperature.temp_top') || 0;
      const outletTemp = device.getCapabilityValue('measure_temperature.temp_bottom') || 0;
      const actualDifferential = Math.abs(inletTemp - outletTemp);
      return actualDifferential > args.differential;
    });

    // 3-Phase Electrical Balance Check Condition - custom logic
    const electricalBalanceCheckCondition: FlowCardCondition = this.homey.flow.getConditionCard('electrical_balance_check');
    electricalBalanceCheckCondition.registerRunListener(
      async (args: ElectricalBalanceArgs, state: FlowState) => {
        const { device } = args;
        const currentA = device.getCapabilityValue('measure_current.cur_current') || 0;
        const currentB = device.getCapabilityValue('measure_current.b_cur') || 0;
        const currentC = device.getCapabilityValue('measure_current.c_cur') || 0;

        const avgCurrent = (currentA + currentB + currentC) / 3;
        const toleranceValue = (args.tolerance / 100) * avgCurrent;

        const balanceA = Math.abs(currentA - avgCurrent) <= toleranceValue;
        const balanceB = Math.abs(currentB - avgCurrent) <= toleranceValue;
        const balanceC = Math.abs(currentC - avgCurrent) <= toleranceValue;

        return balanceA && balanceB && balanceC;
      },
    );

    // Water Flow Rate Check Condition - custom logic
    const waterFlowRateCheckCondition: FlowCardCondition = this.homey.flow.getConditionCard('water_flow_rate_check');
    waterFlowRateCheckCondition.registerRunListener(
      async (args: FlowRateArgs, state: FlowState) => {
        const { device } = args;
        const currentFlowRate = device.getCapabilityValue('measure_water') || 0;
        return currentFlowRate > args.flowRate;
      },
    );

    // System Pulse-Steps Differential Condition - custom logic
    const systemPulseStepsDifferentialCondition: FlowCardCondition = this.homey.flow.getConditionCard('system_pulse_steps_differential');
    systemPulseStepsDifferentialCondition.registerRunListener(
      async (args: PulseStepsDifferentialArgs, state: FlowState) => {
        const { device } = args;
        const eevPulseSteps = device.getCapabilityValue('adlar_measure_pulse_steps_temp_current') || 0;
        const eviPulseSteps = device.getCapabilityValue('adlar_measure_pulse_steps_effluent_temp') || 0;
        const actualDifferential = Math.abs(eevPulseSteps - eviPulseSteps);
        return actualDifferential > args.differential;
      },
    );
  }
}

// Export the app class exactly this way, so it can be used by Homey
module.exports = MyApp;
