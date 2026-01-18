import {
  App,
  FlowCardTrigger,
  FlowCardAction,
  FlowCardCondition,
} from 'homey';

/**
 * Helper functions for pattern-based flow card registration
 *
 * This module provides a centralized approach to registering flow cards based on patterns,
 * enabling dynamic flow card management based on device capabilities and health status.
 *
 * Key features:
 * - Pattern-based registration reduces code duplication
 * - Dynamic capability health checking
 * - Automatic error handling and fallbacks
 * - Support for multiple flow card types (triggers, actions, conditions)
 */

/**
 * Flow card pattern definition for pattern-based registration
 */
export interface FlowCardPattern {
  /** Unique identifier for the flow card */
  cardId: string;
  /** Homey capability name this card operates on */
  capabilityName?: string;
  /** Pattern type that determines registration behavior */
  pattern: 'temperature_alert' | 'pulse_steps_alert' | 'state_change' | 'simple_action' | 'simple_condition';
  /** Sensor type for categorization (used with state_change pattern) */
  sensorType?: string;
  /** Optional capability that must exist for this card to be available */
  requiresCapability?: string;
}

/**
 * Extended App interface with triggers storage
 */
interface ExtendedApp extends App {
  triggers: { [key: string]: FlowCardTrigger };
}

/**
 * Register temperature alert triggers with pattern-based logic
 * @param app - Extended Homey app instance with triggers storage
 * @param patterns - Array of flow card patterns to register
 */
export function registerTemperatureAlerts(app: ExtendedApp, patterns: FlowCardPattern[]): void {
  app.triggers = app.triggers || {}; // Initialize if not already present

  for (const pattern of patterns) {
    const triggerCard: FlowCardTrigger = app.homey.flow.getTriggerCard(pattern.cardId);

    // Store the trigger card in the `triggers` object
    app.triggers[`${pattern.cardId.replace(/_/g, '')}Trigger`] = triggerCard;
  }
}



/**
 * Register pulse-steps alert triggers with pattern-based logic
 */
interface AppWithPulseStepsTriggers extends App {
  [key: string]: FlowCardTrigger | unknown;
}

export function registerPulseStepsAlerts(app: AppWithPulseStepsTriggers, patterns: FlowCardPattern[]) {
  for (const pattern of patterns) {
    const triggerCard: FlowCardTrigger = app.homey.flow.getTriggerCard(pattern.cardId);
    // Store reference for device instances to use
    app[`${pattern.cardId.replace(/_/g, '')}Trigger`] = triggerCard;
  }
}

/**
 * Register state change triggers with pattern-based logic
 */
interface AppWithStateChangeTriggers extends App {
  [key: string]: FlowCardTrigger | unknown;
}

export function registerStateChanges(app: AppWithStateChangeTriggers, patterns: FlowCardPattern[]) {
  for (const pattern of patterns) {
    const triggerCard: FlowCardTrigger = app.homey.flow.getTriggerCard(pattern.cardId);
    // Store reference for device instances to use
    app[`${pattern.cardId.replace(/_/g, '')}Trigger`] = triggerCard;
  }
}

/**
 * Register simple action cards with pattern-based logic
 */
export function registerSimpleActions(app: App, patterns: FlowCardPattern[]) {
  for (const pattern of patterns) {
    const actionCard: FlowCardAction = app.homey.flow.getActionCard(pattern.cardId);

    actionCard.registerRunListener(
      async (
        args: {
          device: {
            setCapabilityValue: (capability: string, value: unknown) => Promise<void>;
            triggerCapabilityListener?: (capability: string, value: unknown, opts: Record<string, unknown>) => Promise<void>;
            getName: () => string;
            hasCapability: (capability: string) => boolean;
          };
          [key: string]: unknown;
        },
        state: unknown,
      ) => {
        if (process.env.DEBUG === '1') {
          app.log(`Action flow card triggered: ${pattern.cardId}`, { args, state });
        }

        const { device } = args;
        const { capabilityName, requiresCapability } = pattern;

        // Check if device supports required capability
        if (requiresCapability && !device.hasCapability(requiresCapability)) {
          if (process.env.DEBUG === '1') {
            app.log(`Action ${pattern.cardId} requires ${requiresCapability} capability, but device ${device.getName()} doesn't support it`);
          }
          throw new Error(`This action requires ${requiresCapability} capability which is not supported by this device`);
        }

        if (!capabilityName) {
          if (process.env.DEBUG === '1') {
            app.log(`No capability mapping for action ${pattern.cardId}`);
          }
          return false;
        }

        // Extract the value from args (assumes first argument contains the value)
        const argKeys = Object.keys(args).filter((key) => key !== 'device');
        const valueKey = argKeys[0];
        const value = args[valueKey];

        try {
          // Trigger the capability listener to send command to device (not just update Homey value)
          if (typeof device.triggerCapabilityListener === 'function') {
            await device.triggerCapabilityListener(capabilityName, value, {});
          } else {
            // Fallback for devices without triggerCapabilityListener method
            await device.setCapabilityValue(capabilityName, value);
            app.log(`Warning: Using setCapabilityValue fallback for ${capabilityName} - device commands may not reach physical device`);
          }

          if (process.env.DEBUG === '1') {
            app.log(`Action flow card result: ${pattern.cardId} - Triggered ${capabilityName} to ${value} for device ${device.getName()}`);
          }
          return true;
        } catch (error) {
          app.error(`Failed to trigger ${capabilityName} to ${value}:`, error);
          throw error;
        }
      },
    );
  }
}

/**
 * Register simple condition cards with pattern-based logic
 */
export function registerSimpleConditions(app: App, patterns: FlowCardPattern[]) {
  for (const pattern of patterns) {
    const conditionCard: FlowCardCondition = app.homey.flow.getConditionCard(pattern.cardId);

    conditionCard.registerRunListener(
      async (
        args: {
          device: {
            getCapabilityValue: (capability: string) => unknown;
            hasCapability: (capability: string) => boolean;
          };
          [key: string]: unknown;
        },
        state: unknown,
      ) => {
        if (process.env.DEBUG === '1') {
          app.log(`Condition flow card triggered: ${pattern.cardId}`, { args, state });
        }

        const { device } = args;
        const { capabilityName, requiresCapability } = pattern;

        // Check if device supports required capability
        if (requiresCapability && !device.hasCapability(requiresCapability)) {
          if (process.env.DEBUG === '1') {
            app.log(`Condition ${pattern.cardId} requires ${requiresCapability} capability, but device doesn't support it`);
          }
          return false;
        }

        if (!capabilityName) {
          if (process.env.DEBUG === '1') {
            app.log(`No capability mapping for condition ${pattern.cardId}`);
          }
          return false;
        }

        try {
          const currentValue = device.getCapabilityValue(capabilityName);

          // Pattern-based condition logic
          switch (pattern.pattern) {
            case 'simple_condition': {
              // Extract threshold from args
              const argKeys = Object.keys(args).filter((key) => key !== 'device');
              const thresholdKey = argKeys[0];
              const threshold = args[thresholdKey];
              const result = Number(currentValue) > Number(threshold);
              if (process.env.DEBUG === '1') {
                app.log(`Condition flow card result: ${pattern.cardId}`, {
                  capabilityName,
                  currentValue,
                  threshold,
                  result,
                });
              }
              return result;
            }

            default: {
              if (process.env.DEBUG === '1') {
                app.log(`Unknown condition pattern: ${pattern.pattern}`);
              }
              return false;
            }
          }
        } catch (error) {
          app.error(`Failed to evaluate condition ${pattern.cardId}:`, error);
          return false;
        }
      },
    );
  }
}

/**
 * Flow card patterns configuration
 */
export const FLOW_PATTERNS = {
  // Temperature alert triggers
  temperatureAlerts: [
    { cardId: 'coiler_temperature_alert', pattern: 'temperature_alert' as const, sensorType: 'coiler' },
    { cardId: 'high_pressure_temperature_alert', pattern: 'temperature_alert' as const, sensorType: 'high_pressure' },
    { cardId: 'low_pressure_temperature_alert', pattern: 'temperature_alert' as const, sensorType: 'low_pressure' },
    { cardId: 'incoiler_temperature_alert', pattern: 'temperature_alert' as const, sensorType: 'incoiler' },
    { cardId: 'tank_temperature_alert', pattern: 'temperature_alert' as const, sensorType: 'tank' },
    { cardId: 'suction_temperature_alert', pattern: 'temperature_alert' as const, sensorType: 'suction' },
    { cardId: 'discharge_temperature_alert', pattern: 'temperature_alert' as const, sensorType: 'discharge' },
    { cardId: 'economizer_inlet_temperature_alert', pattern: 'temperature_alert' as const, sensorType: 'economizer_inlet' },
    { cardId: 'economizer_outlet_temperature_alert', pattern: 'temperature_alert' as const, sensorType: 'economizer_outlet' },
  ],

  // Pulse-steps alert triggers
  pulseStepsAlerts: [
    { cardId: 'eev_pulse_steps_alert', pattern: 'pulse_steps_alert' as const, sensorType: 'eev' },
    { cardId: 'evi_pulse_steps_alert', pattern: 'pulse_steps_alert' as const, sensorType: 'evi' },
  ],

  // State change triggers (removed - now using Homey's automatic capability-based triggers)
  // Compressor, defrost, and backwater states automatically generate "when turned on/off" flow cards
  stateChanges: [],
  /**
   * Simple action cards that directly map flow actions to capability changes
   *
   * IMPORTANT NAMING NOTE (Tuya DPS naming constraints):
   * - 'set_capacity' -> 'adlar_enum_capacity_set' (DPS 11) -> Controls HOT WATER curve (not capacity)
   * - 'set_heating_curve' -> 'adlar_enum_countdown_set' (DPS 13) -> Controls HEATING curve (not countdown)
   *
   * The flow card names are descriptive of function, capability names follow Tuya DPS naming.
   */
  simpleActions: [
    { cardId: 'set_target_temperature', pattern: 'simple_action' as const, capabilityName: 'target_temperature' },
    { cardId: 'set_hotwater_temperature', pattern: 'simple_action' as const, capabilityName: 'adlar_hotwater' },
    { cardId: 'set_heating_mode', pattern: 'simple_action' as const, capabilityName: 'adlar_enum_mode' },
    { cardId: 'set_work_mode', pattern: 'simple_action' as const, capabilityName: 'adlar_enum_work_mode' },
    // NOTE: Despite capability name "capacity_set", this controls HOT WATER curve settings (OFF, H1-H4)
    { cardId: 'set_capacity', pattern: 'simple_action' as const, capabilityName: 'adlar_enum_capacity_set' },
    { cardId: 'set_volume', pattern: 'simple_action' as const, capabilityName: 'adlar_enum_volume_set' },
    { cardId: 'set_device_onoff', pattern: 'simple_action' as const, capabilityName: 'onoff' },
    { cardId: 'set_water_mode', pattern: 'simple_action' as const, capabilityName: 'adlar_enum_water_mode' },
    // NOTE: Despite capability name "countdown_set", this controls HEATING curve settings (H1-H8, L1-L8)
    { cardId: 'set_heating_curve', pattern: 'simple_action' as const, capabilityName: 'adlar_enum_countdown_set' },
  ],

  // Simple condition cards
  simpleConditions: [
    { cardId: 'fault_active', pattern: 'simple_condition' as const, capabilityName: 'adlar_fault' },
    { cardId: 'temperature_above', pattern: 'simple_condition' as const, capabilityName: 'measure_temperature.around_temp' },
    { cardId: 'compressor_running', pattern: 'simple_condition' as const, capabilityName: 'adlar_state_compressor_state' },
    {
      cardId: 'power_above_threshold', pattern: 'simple_condition' as const, capabilityName: 'measure_power', requiresCapability: 'measure_power',
    },
    {
      cardId: 'total_consumption_above', pattern: 'simple_condition' as const, capabilityName: 'meter_power.electric_total', requiresCapability: 'meter_power.electric_total',
    },
  ],
};
