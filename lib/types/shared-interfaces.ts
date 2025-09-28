/* eslint-disable import/prefer-default-export */

/**
 * Shared interface definitions used across multiple services.
 * Consolidated to avoid duplication and ensure consistency.
 */

/**
 * Categories for grouping device capabilities by functional type.
 * Used by CapabilityHealthService and FlowCardManagerService.
 */
export interface CapabilityCategories {
  temperature: string[];
  voltage: string[];
  current: string[];
  power: string[];
  pulseSteps: string[];
  states: string[];
  efficiency: string[];
}

/**
 * User preferences for flow card registration behavior.
 * Used by FlowCardManagerService and device settings validation.
 */
/* eslint-disable camelcase */
export interface UserFlowPreferences {
  flow_temperature_alerts: 'disabled' | 'auto' | 'enabled';
  flow_voltage_alerts: 'disabled' | 'auto' | 'enabled';
  flow_current_alerts: 'disabled' | 'auto' | 'enabled';
  flow_power_alerts: 'disabled' | 'auto' | 'enabled';
  flow_pulse_steps_alerts: 'disabled' | 'auto' | 'enabled';
  flow_state_alerts: 'disabled' | 'auto' | 'enabled';
  flow_efficiency_alerts: 'disabled' | 'auto' | 'enabled';
  flow_expert_mode: boolean;
}
/* eslint-enable camelcase */

/**
 * Generic service options pattern used by all services.
 * Provides consistent interface for service initialization.
 */
export interface ServiceOptions {
  device: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Homey.Device type
  logger?: (message: string, ...args: unknown[]) => void;
}
