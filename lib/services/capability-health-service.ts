/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';
import { DeviceConstants } from '../constants';
import { CapabilityCategories, UserFlowPreferences } from '../types/shared-interfaces';

export interface CapabilityHealthOptions {
  device: Homey.Device;
  logger?: (message: string, ...args: unknown[]) => void;
}

export interface CapabilityHealthData {
  capability: string;
  isHealthy: boolean;
  lastUpdated: number;
  nullCount: number;
  lastValue: unknown;
  category: string;
}

export interface HealthReport {
  timestamp: number;
  totalCapabilities: number;
  healthyCapabilities: number;
  unhealthyCapabilities: number;
  nullCapabilities: number;
  categories: Record<string, CapabilityHealthData[]>;
  overall: 'healthy' | 'degraded' | 'critical';
}

export class CapabilityHealthService {
  private device: Homey.Device;
  private logger: (message: string, ...args: unknown[]) => void;
  private capabilityHealthMap = new Map<string, CapabilityHealthData>();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHealthReport: HealthReport | null = null;

  // Store bound event handler reference to prevent memory leaks (v1.0.2)
  // bind() creates new function each time → removeListener fails without stored reference
  private onCapabilityValueChangedBound?: (capability: string, value: unknown) => void;

  /**
   * Create a CapabilityHealthService to track capability freshness/health for a device.
   * @param options.device - The Homey device instance that owns this service.
   * @param options.logger - Optional logger function (message, ...args).
   */
  constructor(options: CapabilityHealthOptions) {
    this.device = options.device;
    this.logger = options.logger || (() => {});
  }

  /**
   * Start monitoring capabilities (initialization + periodic checks + event listeners).
   * Registers `capability_value_changed` listener and starts the periodic health check.
   */
  start(): void {
    this.logger('CapabilityHealthService: Starting health monitoring');

    // Initialize health data for all capabilities
    this.initializeCapabilityHealth();

    // Start periodic health checks
    this.startHealthCheckInterval();

    // Listen for capability updates - store bound reference for proper cleanup (v1.0.2)
    this.onCapabilityValueChangedBound = this.onCapabilityValueChanged.bind(this);
    this.device.on('capability_value_changed', this.onCapabilityValueChangedBound);
  }

  /**
   * Stop monitoring and remove listeners/intervals.
   * Clears the periodic interval and removes the `capability_value_changed` listener.
   */
  stop(): void {
    this.logger('CapabilityHealthService: Stopping health monitoring');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Remove listener using stored bound reference (v1.0.2 - fixes memory leak)
    if (this.onCapabilityValueChangedBound) {
      this.device.removeListener('capability_value_changed', this.onCapabilityValueChangedBound);
      this.onCapabilityValueChangedBound = undefined;
    }
  }

  /**
   * Initialize health data for all capabilities on the device.
   * Populates `capabilityHealthMap` with baseline entries using current capability values.
   */
  private initializeCapabilityHealth(): void {
    const capabilities = this.device.getCapabilities();
    const now = Date.now();

    capabilities.forEach((capability) => {
      const currentValue = this.device.getCapabilityValue(capability);
      const isHealthy = this.isCapabilityValueHealthy(currentValue);

      this.capabilityHealthMap.set(capability, {
        capability,
        isHealthy,
        lastUpdated: now,
        nullCount: isHealthy ? 0 : 1,
        lastValue: currentValue,
        category: this.getCapabilityCategory(capability),
      });
    });

    this.logger('CapabilityHealthService: Initialized health monitoring for capabilities', capabilities.length);
  }

  /**
   * Event handler for capability value changes.
   * Updates health data and timestamps for the given capability.
   * @param capability - capability id string (e.g. 'measure_temperature.room').
   * @param value - new capability value.
   */
  private onCapabilityValueChanged(capability: string, value: unknown): void {
    this.updateCapabilityHealth(capability, value);
  }

  /**
   * Update the health record for a specific capability.
   * - Updates lastUpdated, nullCount and lastValue.
   * - Determines whether the capability is considered healthy.
   * @param capability - capability id
   * @param value - current value to evaluate
   */
  updateCapabilityHealth(capability: string, value: unknown): void {
    const now = Date.now();
    const isHealthy = this.isCapabilityValueHealthy(value);

    let healthData = this.capabilityHealthMap.get(capability);

    if (!healthData) {
      // Initialize new capability health data
      healthData = {
        capability,
        isHealthy,
        lastUpdated: now,
        nullCount: isHealthy ? 0 : 1,
        lastValue: value,
        category: this.getCapabilityCategory(capability),
      };
    } else {
      // Update existing health data
      const wasHealthy = healthData.isHealthy;
      healthData.isHealthy = isHealthy;
      healthData.lastUpdated = now;
      healthData.lastValue = value;

      if (!isHealthy) {
        healthData.nullCount++;

        // Check for critical null count threshold
        if (healthData.nullCount >= DeviceConstants.NULL_THRESHOLD && wasHealthy) {
          this.logger(`CapabilityHealthService: Capability ${capability} became unhealthy (${healthData.nullCount} null values)`);
          this.device.emit('capability:health-degraded', { capability, healthData });
        }
      } else {
        // Reset null count on healthy value
        if (healthData.nullCount > 0) {
          this.logger(`CapabilityHealthService: Capability ${capability} recovered (was ${healthData.nullCount} null values)`);
          this.device.emit('capability:health-recovered', { capability, healthData });
        }
        healthData.nullCount = 0;
      }
    }

    this.capabilityHealthMap.set(capability, healthData);
  }

  /**
   * Determine whether a capability value should be considered healthy.
   * Default logic: value is not null/undefined.
   * Override or extend for special cases.
   */
  private isCapabilityValueHealthy(value: unknown): boolean {
    return value !== null && value !== undefined;
  }

  /**
   * Map a capability id to a logical category used for grouping (temperature, voltage, etc).
   * v1.2.3: Separates calculated/external capabilities from DPS-based device data.
   * Only DPS-based capabilities (sensor/status) are included in device health metrics.
   * @param capability - the capability identifier
   * @returns category name
   */
  private getCapabilityCategory(capability: string): string {
    // Calculated capabilities - excluded from health metrics (not DPS data)
    if (capability.includes('cop') || capability.includes('scop')) return 'calculated';

    // External integration capabilities - excluded from health metrics (user configuration)
    if (capability.startsWith('adlar_external_')) return 'external';

    // DPS-based sensor capabilities - included in health metrics
    if (capability.startsWith('measure_temperature')) return 'temperature';
    if (capability.startsWith('measure_voltage')) return 'voltage';
    if (capability.startsWith('measure_current')) return 'current';
    if (capability.includes('power') || capability.includes('energy')) return 'power';
    if (capability.includes('pulse_steps')) return 'pulseSteps';

    // DPS-based status capabilities - included in health metrics
    if (capability.startsWith('adlar_state')) return 'states';

    return 'other';
  }

  /**
   * Start the periodic health-check interval.
   * Uses the Homey timer (`device.homey.setInterval`) and will call `performHealthCheck`.
   */
  private startHealthCheckInterval(): void {
    this.healthCheckInterval = this.device.homey.setInterval(() => {
      this.performHealthCheck();
    }, DeviceConstants.HEALTH_CHECK_INTERVAL_MS);

    this.logger('CapabilityHealthService: Started health check interval');
  }

  /**
   * Perform a full pass over capability health entries and emit events if statuses changed.
   * - Marks capabilities as unhealthy when they exceed timeouts.
   * - Emits 'capability:health-degraded' / 'capability:health-recovered' on the device when needed.
   */
  private performHealthCheck(): void {
    const now = Date.now();
    let healthChanges = 0;

    this.capabilityHealthMap.forEach((healthData, capability) => {
      const timeSinceUpdate = now - healthData.lastUpdated;
      const wasHealthy = healthData.isHealthy;

      // v1.2.1: Use capability-specific timeout instead of global timeout
      const timeout = this.getCapabilityTimeout(capability);

      // Check for stale data (no updates for extended period)
      // and recovery (recent update after being stale)
      if (timeSinceUpdate > timeout) {
        if (healthData.isHealthy) {
          healthData.isHealthy = false;
          healthChanges++;
          this.logger(`CapabilityHealthService: Capability ${capability} marked as stale (${Math.round(timeSinceUpdate / 1000)}s since update, timeout: ${Math.round(timeout / 1000)}s)`);
          this.device.emit('capability:health-stale', { capability, healthData, timeSinceUpdate });
        }
      } else if (!wasHealthy && this.isCapabilityValueHealthy(healthData.lastValue)) {
        healthData.isHealthy = true;
        healthData.nullCount = 0;
        healthChanges++;
        this.logger(`CapabilityHealthService: Capability ${capability} recovered from stale state`);
        this.device.emit('capability:health-recovered', { capability, healthData });
      }
    });

    if (healthChanges > 0) {
      this.generateHealthReport();
    }
  }

  /**
   * Determine the appropriate timeout for a capability based on its type (v1.2.1).
   * Control capabilities never timeout, sensors have short timeouts, status/calculated have longer timeouts.
   * @param capability - The capability ID
   * @returns Timeout in milliseconds
   */
  private getCapabilityTimeout(capability: string): number {
    // Control capabilities - NEVER timeout (user-controlled, not auto-updating)
    if (
      capability === 'onoff'
      || capability === 'target_temperature'
      || capability === 'dim'
      || capability.startsWith('adlar_enum_') // All enum pickers (mode, water_mode, work_mode, etc.)
      || capability.startsWith('adlar_picker_') // All picker controls (countdown, capacity, volume)
      || capability === 'adlar_hotwater' // Hot water setpoint
    ) {
      return DeviceConstants.CAPABILITY_TIMEOUTS.CONTROL; // Infinity
    }

    // Calculated capabilities - Medium timeout (periodic calculations)
    if (
      capability.startsWith('adlar_cop') // COP calculations
      || capability.startsWith('adlar_scop') // SCOP calculations
      || capability.startsWith('adlar_external_') // External data integrations
    ) {
      return DeviceConstants.CAPABILITY_TIMEOUTS.CALCULATED; // 10 minutes
    }

    // Status capabilities - Longer timeout (event-driven)
    if (
      capability === 'adlar_connection_status'
      || capability === 'adlar_connection_active'
      || capability === 'adlar_fault'
      || capability.startsWith('adlar_state_') // State indicators
      || capability.startsWith('adlar_sensor_') // Read-only sensor displays
    ) {
      return DeviceConstants.CAPABILITY_TIMEOUTS.STATUS; // 15 minutes
    }

    // Sensor capabilities - Short timeout (frequent updates expected)
    // measure_*, meter_*, adlar_measure_*, adlar_countdowntimer, etc.
    return DeviceConstants.CAPABILITY_TIMEOUTS.SENSOR; // 5 minutes
  }

  /**
   * Read user preferences related to flow card registration (settings-aware filtering).
   * Returns defaults if settings are missing.
   */
  private getUserFlowPreferences(): UserFlowPreferences {
    return {
      flow_temperature_alerts: this.device.getSetting('flow_temperature_alerts') || 'auto',
      flow_voltage_alerts: this.device.getSetting('flow_voltage_alerts') || 'auto',
      flow_current_alerts: this.device.getSetting('flow_current_alerts') || 'auto',
      flow_power_alerts: this.device.getSetting('flow_power_alerts') || 'auto',
      flow_pulse_steps_alerts: this.device.getSetting('flow_pulse_steps_alerts') || 'auto',
      flow_state_alerts: this.device.getSetting('flow_state_alerts') || 'auto',
      flow_efficiency_alerts: this.device.getSetting('flow_efficiency_alerts') || 'auto',
      flow_expert_mode: this.device.getSetting('flow_expert_mode') || false,
    };
  }

  /**
   * Determine if a capability category is enabled via user settings.
   * v1.2.1 FIX: Checks BOTH feature enablement AND flow card settings.
   * v1.2.3: Calculated/external categories always return true (excluded from health tracking elsewhere).
   * Settings can be 'disabled', 'auto', or 'enabled'.
   * Returns false only if explicitly disabled.
   */
  private isCategoryEnabled(category: keyof CapabilityCategories): boolean {
    const userPrefs = this.getUserFlowPreferences();

    // v1.2.1: First check feature enablement settings (master switches)
    const enablePowerMeasurements = this.device.getSetting('enable_power_measurements') ?? true;
    const enableCOPCalculation = this.device.getSetting('cop_calculation_enabled') !== false; // default true

    switch (category) {
      case 'temperature':
        return userPrefs.flow_temperature_alerts !== 'disabled';

      case 'voltage':
      case 'current':
      case 'power':
        // v1.2.1 FIX: If power measurements disabled, these categories are ALWAYS disabled
        if (!enablePowerMeasurements) return false;
        // Otherwise check flow card settings
        if (category === 'voltage') return userPrefs.flow_voltage_alerts !== 'disabled';
        if (category === 'current') return userPrefs.flow_current_alerts !== 'disabled';
        return userPrefs.flow_power_alerts !== 'disabled';

      case 'efficiency':
        // v1.2.1 FIX: If COP calculation disabled, efficiency category is ALWAYS disabled
        if (!enableCOPCalculation) return false;
        return userPrefs.flow_efficiency_alerts !== 'disabled';

      case 'calculated':
      case 'external':
        // v1.2.3: These categories are excluded from health metrics via explicit checks
        // Return true here for flow card compatibility
        return true;

      case 'pulseSteps':
        return userPrefs.flow_pulse_steps_alerts !== 'disabled';
      case 'states':
        return userPrefs.flow_state_alerts !== 'disabled';
      default:
        return true; // Unknown categories are enabled by default
    }
  }

  /**
   * Generate a consolidated health report for all capabilities.
   * The report includes summary counts and grouped capability health data.
   * Only counts ENABLED capabilities in health metrics (settings-aware).
   * @returns HealthReport
   */
  generateHealthReport(): HealthReport {
    const now = Date.now();
    const categories: Record<string, CapabilityHealthData[]> = {};
    let totalCapabilities = 0;
    let healthyCapabilities = 0;
    let unhealthyCapabilities = 0;
    let nullCapabilities = 0;

    // Group capabilities by category and count health status
    // v1.0.31: FIXED - Only count capabilities that are enabled via settings
    // v1.2.3: FIXED - Exclude calculated/external capabilities (DPS-only health tracking)
    this.capabilityHealthMap.forEach((healthData) => {
      const category = healthData.category as keyof CapabilityCategories;

      // v1.2.3: Skip calculated and external capabilities (not DPS device data)
      if (category === 'calculated' || category === 'external') {
        return; // Skip - health check tracks DPS communication only
      }

      // Skip disabled capability categories
      if (!this.isCategoryEnabled(category)) {
        this.logger(
          `CapabilityHealthService: Excluding disabled category '${category}' from health report`,
        );
        return; // Skip this capability - it's disabled
      }

      totalCapabilities++;

      if (healthData.isHealthy) {
        healthyCapabilities++;
      } else {
        unhealthyCapabilities++;
        if (healthData.nullCount > 0) {
          nullCapabilities++;
        }
      }

      if (!categories[healthData.category]) {
        categories[healthData.category] = [];
      }
      categories[healthData.category].push({ ...healthData });
    });

    // Determine overall health status
    const healthyPercentage = totalCapabilities > 0 ? (healthyCapabilities / totalCapabilities) : 1;
    let overall: 'healthy' | 'degraded' | 'critical';

    if (healthyPercentage >= 0.9) {
      overall = 'healthy';
    } else if (healthyPercentage >= 0.7) {
      overall = 'degraded';
    } else {
      overall = 'critical';
    }

    const report: HealthReport = {
      timestamp: now,
      totalCapabilities,
      healthyCapabilities,
      unhealthyCapabilities,
      nullCapabilities,
      categories,
      overall,
    };

    this.lastHealthReport = report;

    this.logger('CapabilityHealthService: Health report generated (DPS-only, settings-aware)', {
      overall,
      healthy: healthyCapabilities,
      total: totalCapabilities,
      percentage: `${Math.round(healthyPercentage * 100)}%`,
    });

    // Emit health report event
    this.device.emit('capability:health-report', report);

    return report;
  }

  /**
   * Return the available capabilities grouped by category.
   * Useful for determining which flow cards to register.
   * v1.2.3: Added calculated/external categories.
   */
  getAvailableCapabilities(): CapabilityCategories {
    const capabilities = this.device.getCapabilities();
    const result: CapabilityCategories = {
      temperature: [],
      voltage: [],
      current: [],
      power: [],
      pulseSteps: [],
      states: [],
      efficiency: [], // Legacy - kept for flow card compatibility
      calculated: [], // v1.2.3: COP/SCOP calculations
      external: [], // v1.2.3: External integrations
    };

    capabilities.forEach((capability) => {
      const category = this.getCapabilityCategory(capability);
      if (category in result) {
        result[category as keyof CapabilityCategories].push(capability);
      }
    });

    return result;
  }

  /**
   * Inspect stored health data and detect which capabilities currently have healthy data.
   * v1.0.31: FIXED - Only returns capabilities from ENABLED categories (settings-aware).
   * v1.2.3: FIXED - Excludes calculated/external capabilities (DPS-only tracking).
   * @returns array of capability ids considered to have healthy/recent data
   */
  async detectCapabilitiesWithData(): Promise<string[]> {
    const capabilitiesWithData: string[] = [];
    const now = Date.now();

    this.capabilityHealthMap.forEach((healthData, capability) => {
      const category = healthData.category as keyof CapabilityCategories;

      // v1.2.3: Skip calculated and external capabilities (not DPS device data)
      if (category === 'calculated' || category === 'external') {
        return; // Skip - only track DPS communication health
      }

      // v1.0.31: Skip capabilities from disabled categories
      if (!this.isCategoryEnabled(category)) {
        return; // Skip this capability - its category is disabled
      }

      const timeSinceUpdate = now - healthData.lastUpdated;
      // v1.2.1: Use capability-specific timeout
      const timeout = this.getCapabilityTimeout(capability);
      const hasRecentData = timeSinceUpdate < timeout;
      const hasHealthyValue = this.isCapabilityValueHealthy(healthData.lastValue);
      const lowNullCount = healthData.nullCount < DeviceConstants.NULL_THRESHOLD;

      if (hasRecentData && hasHealthyValue && lowNullCount) {
        capabilitiesWithData.push(capability);
      }
    });

    this.logger('CapabilityHealthService: Detected capabilities with healthy data (DPS-only, settings-aware)', capabilitiesWithData.length);
    return capabilitiesWithData;
  }

  /**
   * Return health data object for the requested capability, or undefined if not tracked.
   */
  getCapabilityHealth(capability: string): CapabilityHealthData | undefined {
    return this.capabilityHealthMap.get(capability);
  }

  /**
   * Return a copy of all capability health entries (safe for external inspection).
   */
  getAllCapabilityHealth(): Map<string, CapabilityHealthData> {
    return new Map(this.capabilityHealthMap);
  }

  /**
   * Return the last generated health report, or null if none.
   */
  getLastHealthReport(): HealthReport | null {
    return this.lastHealthReport;
  }

  /**
   * Convenience: check whether a specific capability is currently healthy.
   */
  isCapabilityHealthy(capability: string): boolean {
    const healthData = this.capabilityHealthMap.get(capability);
    return healthData?.isHealthy ?? false;
  }

  /**
   * Return a list of capability ids currently considered healthy.
   */
  getHealthyCapabilities(): string[] {
    const healthy: string[] = [];
    this.capabilityHealthMap.forEach((healthData, capability) => {
      if (healthData.isHealthy) {
        healthy.push(capability);
      }
    });
    return healthy;
  }

  /**
   * Return a list of capability ids currently considered unhealthy.
   */
  getUnhealthyCapabilities(): string[] {
    const unhealthy: string[] = [];
    this.capabilityHealthMap.forEach((healthData, capability) => {
      if (!healthData.isHealthy) {
        unhealthy.push(capability);
      }
    });
    return unhealthy;
  }

  /**
   * Return an array of critical conditions derived from health data.
   * Useful for diagnostics UI or aggregated alerts.
   */
  getCriticalConditions(): Array<{ capability: string; condition: string; severity: 'warning' | 'critical' }> {
    const conditions: Array<{ capability: string; condition: string; severity: 'warning' | 'critical' }> = [];
    const now = Date.now();

    this.capabilityHealthMap.forEach((healthData, capability) => {
      const timeSinceUpdate = now - healthData.lastUpdated;
      // v1.2.1: Use capability-specific timeout
      const timeout = this.getCapabilityTimeout(capability);

      // Skip control capabilities (they never timeout)
      if (timeout === Infinity) {
        return; // Control capabilities don't have critical conditions based on staleness
      }

      // Critical: No data for extended period (2x timeout)
      if (timeSinceUpdate > timeout * 2) {
        conditions.push({
          capability,
          condition: `No data for ${Math.round(timeSinceUpdate / 60000)} minutes`,
          severity: 'critical',
        });
      } else if (healthData.nullCount >= DeviceConstants.NULL_THRESHOLD) {
        conditions.push({
          capability,
          condition: `${healthData.nullCount} consecutive null values`,
          severity: 'warning',
        });
      } else if (timeSinceUpdate > timeout) {
        conditions.push({
          capability,
          condition: `Stale data (${Math.round(timeSinceUpdate / 1000)}s old)`,
          severity: 'warning',
        });
      }
    });

    return conditions;
  }

  /**
   * Generate a diagnostics object that contains the health report and extra diagnostic data.
   * Emits a `diagnostics:capability-report` device event.
   */
  generateDiagnosticsReport(): Record<string, unknown> {
    const report = this.generateHealthReport();
    const criticalConditions = this.getCriticalConditions();

    return {
      ...report,
      criticalConditions,
      capabilityDetails: Object.fromEntries(this.capabilityHealthMap),
      diagnosticInfo: {
        healthCheckInterval: DeviceConstants.HEALTH_CHECK_INTERVAL_MS,
        capabilityTimeouts: DeviceConstants.CAPABILITY_TIMEOUTS, // v1.2.1: Show all timeout types
        nullThreshold: DeviceConstants.NULL_THRESHOLD,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Handler invoked by settings when a user requests capability diagnostics.
   * Emits a `diagnostics:capability-report` on the device.
   */
  async handleDiagnosticsRequest(): Promise<void> {
    const diagnostics = this.generateDiagnosticsReport();

    this.logger('CapabilityHealthService: Capability Diagnostics Report', diagnostics);

    // Emit detailed diagnostics event
    this.device.emit('diagnostics:capability-report', diagnostics);
  }

  /**
   * Gracefully stop monitoring and clear internal state for this service.
   * Safe to call when destroying the device.
   */
  destroy(): void {
    this.stop();
    this.capabilityHealthMap.clear();
    this.lastHealthReport = null;
    this.logger('CapabilityHealthService: Service destroyed');
  }
}
