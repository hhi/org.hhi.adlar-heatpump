/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey, { manifest } from 'homey';
import TuyaDevice from 'tuyapi';
import { AdlarMapping } from '../../lib/definitions/adlar-mapping';

// Extract allCapabilities and allArraysSwapped from AdlarMapping
const { allCapabilities, allArraysSwapped } = AdlarMapping;

// Types for combined flow card management
interface CapabilityCategories {
  temperature: string[];
  voltage: string[];
  current: string[];
  power: string[];
  pulseSteps: string[];
  states: string[];
}

/* eslint-disable camelcase */
interface UserFlowPreferences {
  flow_temperature_alerts: 'disabled' | 'auto' | 'enabled';
  flow_voltage_alerts: 'disabled' | 'auto' | 'enabled';
  flow_current_alerts: 'disabled' | 'auto' | 'enabled';
  flow_power_alerts: 'disabled' | 'auto' | 'enabled';
  flow_pulse_steps_alerts: 'disabled' | 'auto' | 'enabled';
  flow_state_alerts: 'disabled' | 'auto' | 'enabled';
  flow_expert_mode: boolean;
}
/* eslint-enable camelcase */

class MyDevice extends Homey.Device {
  tuya: TuyaDevice | undefined;
  tuyaConnected: boolean = false;
  allCapabilities: Record<string, number[]> = allCapabilities;
  allArraysSwapped: Record<number, string> = allArraysSwapped;
  settableCapabilities: string[] = [];
  reconnectInterval: NodeJS.Timeout | undefined;
  consecutiveFailures: number = 0;
  lastNotificationTime: number = 0;
  lastNotificationKey: string = '';

  // Flow card management
  private flowCardListeners: Map<string, unknown> = new Map();
  private isFlowCardsInitialized: boolean = false;

  // Capability health monitoring
  private capabilityHealthMap = new Map<string, {
    isHealthy: boolean;
    lastSeenData: number;
    nullCount: number;
    dataCount: number;
    lastValue: unknown;
  }>();

  private readonly CAPABILITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes without data = unhealthy

  private readonly NULL_THRESHOLD = 10; // Consider unhealthy after 10 consecutive nulls

  private healthCheckInterval: NodeJS.Timeout | null = null;

  private capabilitiesArray: string[] = (manifest.capabilities || [])

  // Debug-conditional logging method
  private debugLog(...args: unknown[]) {
    if (process.env.DEBUG === '1') {
      this.log(...args);
    }
  }

  private async sendCriticalNotification(title: string, message: string) {
    const now = Date.now();
    const notificationKey = `${title}:${message}`;

    // Prevent spam - only send notifications every 30 minutes for the same device
    // Also prevent duplicate notifications within 5 seconds (for duplicate events)
    if (now - this.lastNotificationTime > 30 * 60 * 1000
        || (this.lastNotificationKey !== notificationKey && now - this.lastNotificationTime > 5000)) {
      try {
        await this.homey.notifications.createNotification({
          excerpt: `${this.getName()}: ${title}`,
        });
        this.lastNotificationTime = now;
        this.lastNotificationKey = notificationKey;
        this.log(`Critical notification sent: ${title}`);
      } catch (err) {
        this.error('Failed to send notification:', err);
      }
    }
  }

  async connectTuya() {
    if (!this.tuyaConnected) {
      try {
        // Discover the device on the network first
        if (this.tuya) {
          await this.tuya.find();
          // Then connect to the device
          await this.tuya.connect();
          this.tuyaConnected = true;
          this.debugLog('Connected to Tuya device');
        } else {
          throw new Error('Tuya device is not initialized');
        }
      } catch (err) {
        this.error('Failed to find or connect to Tuya device:', err);
        // Don't throw here to allow reconnection attempts
      }
    }
  }

  private startReconnectInterval() {
    // Clear any existing interval
    this.stopReconnectInterval();

    // Start new interval for reconnection attempts
    this.reconnectInterval = this.homey.setInterval(async () => {
      if (!this.tuyaConnected) {
        this.debugLog('Attempting to reconnect to Tuya device...');
        try {
          await this.connectTuya();
          // Reset failure counter on successful connection
          this.consecutiveFailures = 0;
        } catch (err) {
          this.debugLog('Reconnection attempt failed:', err);
          this.consecutiveFailures++;

          // Send notification after 5 consecutive failures (100 seconds)
          if (this.consecutiveFailures === 5) {
            await this.sendCriticalNotification(
              'Device Connection Lost',
              'Heat pump has been disconnected for over 1 minute. Please check device and network connectivity.',
            );
          }
        }
      }
    }, 20000);
  }

  private stopReconnectInterval() {
    if (this.reconnectInterval) {
      this.homey.clearInterval(this.reconnectInterval);
      this.reconnectInterval = undefined;
    }
  }

  /**
   * Helper function to replace dots with underscores in a string.
   * @param {string} input The input string
   * @returns {string} The modified string with dots replaced by underscores
   */
  private replaceDotWithUnderscore(input: string): string {
    return input.replace(/\./g, '_');
  }

  /**
   * Update capability health tracking when value changes
   */
  private updateCapabilityHealth(capability: string, value: unknown): void {
    const now = Date.now();
    const health = this.capabilityHealthMap.get(capability) || {
      isHealthy: true,
      lastSeenData: now,
      nullCount: 0,
      dataCount: 0,
      lastValue: null,
    };

    const isNull = value === null || value === undefined;

    if (isNull) {
      health.nullCount++;
    } else {
      health.nullCount = 0; // Reset null count on valid data
      health.dataCount++;
      health.lastSeenData = now;
      health.lastValue = value;
    }

    // Update health status - consider capability unhealthy when DPS value is null
    const wasHealthy = health.isHealthy;
    health.isHealthy = !isNull && health.nullCount < this.NULL_THRESHOLD && (now - health.lastSeenData) < this.CAPABILITY_TIMEOUT_MS;

    // Log health status changes
    if (wasHealthy !== health.isHealthy) {
      if (health.isHealthy) {
        this.log(`Capability ${capability} recovered - now healthy`);
      } else {
        this.log(`Capability ${capability} became unhealthy - nullCount: ${health.nullCount}, timeSinceData: ${now - health.lastSeenData}ms`);
      }
    }

    this.capabilityHealthMap.set(capability, health);
  }

  /**
   * Get capability health status
   */
  private getCapabilityHealth(capability: string): boolean {
    const health = this.capabilityHealthMap.get(capability);
    if (!health) return false;

    const now = Date.now();
    const isHealthy = health.nullCount < this.NULL_THRESHOLD && (now - health.lastSeenData) < this.CAPABILITY_TIMEOUT_MS;

    // Update health status if it has changed
    if (health.isHealthy !== isHealthy) {
      health.isHealthy = isHealthy;
      this.capabilityHealthMap.set(capability, health);
    }

    return isHealthy;
  }

  /**
   * Get all capability health statuses
   */
  private getAllCapabilityHealthStatuses(): Record<string, {
    isHealthy: boolean;
    lastSeenData: number;
    nullCount: number;
    dataCount: number;
    lastValue: unknown;
    timeSinceLastData: number;
  }> {
    const now = Date.now();
    const statuses: Record<string, {
      isHealthy: boolean;
      lastSeenData: number;
      nullCount: number;
      dataCount: number;
      lastValue: unknown;
      timeSinceLastData: number;
    }> = {};

    for (const [capability, health] of this.capabilityHealthMap.entries()) {
      statuses[capability] = {
        ...health,
        timeSinceLastData: now - health.lastSeenData,
      };
    }

    return statuses;
  }

  /**
   * Get available capabilities organized by category (Option A)
   */
  private getAvailableCapabilities(): CapabilityCategories {
    const caps = Object.keys(this.allCapabilities);

    return {
      temperature: caps.filter((cap) => cap.startsWith('measure_temperature')),
      voltage: caps.filter((cap) => cap.startsWith('measure_voltage')),
      current: caps.filter((cap) => cap.startsWith('measure_current')),
      power: caps.filter((cap) => cap.includes('power')),
      pulseSteps: caps.filter((cap) => cap.includes('pulse_steps')),
      states: caps.filter((cap) => cap.startsWith('adlar_state')),
    };
  }

  /**
   * Get user flow preferences from device settings (Option B)
   */
  private getUserFlowPreferences(): UserFlowPreferences {
    return {
      flow_temperature_alerts: this.getSetting('flow_temperature_alerts') || 'auto',
      flow_voltage_alerts: this.getSetting('flow_voltage_alerts') || 'auto',
      flow_current_alerts: this.getSetting('flow_current_alerts') || 'auto',
      flow_power_alerts: this.getSetting('flow_power_alerts') || 'auto',
      flow_pulse_steps_alerts: this.getSetting('flow_pulse_steps_alerts') || 'auto',
      flow_state_alerts: this.getSetting('flow_state_alerts') || 'auto',
      flow_expert_mode: this.getSetting('flow_expert_mode') || false,
    };
  }

  /**
   * Detect capabilities that have actual data (Option C)
   */
  private async detectCapabilitiesWithData(): Promise<string[]> {
    const capabilitiesWithData: string[] = [];

    // Check which capabilities have actual data (not null/undefined)
    for (const capability of Object.keys(this.allCapabilities)) {
      try {
        const value = this.getCapabilityValue(capability);
        // Update health tracking for this capability
        this.updateCapabilityHealth(capability, value);

        // Check if capability is currently healthy (has recent valid data)
        if (this.getCapabilityHealth(capability)) {
          capabilitiesWithData.push(capability);
          this.debugLog(`Capability ${capability} is healthy with data:`, value);
        } else {
          this.debugLog(`Capability ${capability} is unhealthy - excluding from flow cards`);
        }
      } catch (err) {
        this.debugLog(`Capability ${capability} not available:`, err);
      }
    }

    return capabilitiesWithData;
  }

  /**
   * Get healthy capabilities by category for dynamic flow card management
   */
  private getHealthyCapabilitiesByCategory(): CapabilityCategories {
    const caps = Object.keys(this.allCapabilities).filter((cap) => this.getCapabilityHealth(cap));

    return {
      temperature: caps.filter((cap) => cap.startsWith('measure_temperature')),
      voltage: caps.filter((cap) => cap.startsWith('measure_voltage')),
      current: caps.filter((cap) => cap.startsWith('measure_current')),
      power: caps.filter((cap) => cap.includes('power')),
      pulseSteps: caps.filter((cap) => cap.includes('pulse_steps')),
      states: caps.filter((cap) => cap.startsWith('adlar_state')),
    };
  }

  /**
   * Periodically update flow cards based on capability health changes
   */
  private async updateFlowCardsBasedOnHealth(): Promise<void> {
    try {
      // Get current healthy capabilities
      const healthyCapabilities = this.getHealthyCapabilitiesByCategory();
      const userPrefs = this.getUserFlowPreferences();

      // Check if any categories need flow card updates due to health changes
      const categoriesToUpdate: (keyof CapabilityCategories)[] = [];

      for (const category of Object.keys(healthyCapabilities) as (keyof CapabilityCategories)[]) {
        const currentHealthyCaps = healthyCapabilities[category];
        const availableCaps = this.getAvailableCapabilities()[category];

        // If healthy capabilities differ significantly from available capabilities, update
        if (currentHealthyCaps.length !== availableCaps.length
            || !currentHealthyCaps.every((cap) => availableCaps.includes(cap))) {
          categoriesToUpdate.push(category);
        }
      }

      if (categoriesToUpdate.length > 0) {
        this.log(`Updating flow cards for categories with health changes: ${categoriesToUpdate.join(', ')}`);

        // Unregister existing flow cards for affected categories
        for (const category of categoriesToUpdate) {
          await this.unregisterFlowCardsForCategory(category);
        }

        // Re-register flow cards with current healthy capabilities
        const capabilitiesWithData = await this.detectCapabilitiesWithData();
        for (const category of categoriesToUpdate) {
          await this.registerFlowCardsByCategory(
            category,
            healthyCapabilities[category],
            userPrefs[`flow_${category}_alerts` as keyof typeof userPrefs] as 'disabled' | 'auto' | 'enabled',
            capabilitiesWithData,
          );
        }
      }
    } catch (error) {
      this.error('Error updating flow cards based on health:', error);
    }
  }

  /**
   * Unregister flow cards for a specific category
   */
  private async unregisterFlowCardsForCategory(category: keyof CapabilityCategories): Promise<void> {
    const categoryFlowCards = this.getCategoryFlowCards(category);

    for (const cardId of categoryFlowCards) {
      const listener = this.flowCardListeners.get(cardId);
      if (listener) {
        try {
          if (typeof (listener as { unregister?: () => void }).unregister === 'function') {
            (listener as { unregister: () => void }).unregister();
          }
          this.flowCardListeners.delete(cardId);
          this.debugLog(`Unregistered flow card: ${cardId} for category: ${category}`);
        } catch (error) {
          this.error(`Error unregistering flow card ${cardId}:`, error);
        }
      }
    }
  }

  /**
   * Get flow card IDs for a specific category
   */
  private getCategoryFlowCards(category: keyof CapabilityCategories): string[] {
    const categoryCards: Record<keyof CapabilityCategories, string[]> = {
      temperature: [
        'temperature_above', 'coiler_temperature_alert', 'incoiler_temperature_alert',
        'tank_temperature_alert', 'suction_temperature_alert', 'discharge_temperature_alert',
        'ambient_temperature_changed', 'inlet_temperature_changed', 'outlet_temperature_changed',
        'high_pressure_temperature_alert', 'low_pressure_temperature_alert',
        'economizer_inlet_temperature_alert', 'economizer_outlet_temperature_alert',
      ],
      voltage: ['phase_a_voltage_alert', 'phase_b_voltage_alert', 'phase_c_voltage_alert'],
      current: ['phase_b_current_alert', 'phase_c_current_alert'],
      power: ['power_above_threshold', 'power_threshold_exceeded', 'total_consumption_above'],
      pulseSteps: ['eev_pulse_steps_alert', 'evi_pulse_steps_alert'],
      states: ['compressor_running', 'compressor_state_changed', 'defrost_state_changed', 'backwater_state_changed'],
    };

    return categoryCards[category] || [];
  }

  /**
   * Start periodic health checks for dynamic flow card management
   */
  private startHealthCheckInterval(): void {
    // Check capability health every 2 minutes
    try {
      const interval = this.homey.setInterval(() => {
        this.updateFlowCardsBasedOnHealth().catch((error) => {
          this.error('Error during health check update:', error);
        });
      }, 2 * 60 * 1000);
      if (interval) {
        this.healthCheckInterval = interval;
        this.log('Started capability health check interval');
      } else {
        this.healthCheckInterval = null;
        this.error('Failed to start health check interval: setInterval returned undefined');
      }
    } catch (err) {
      this.healthCheckInterval = null;
      this.error('Error starting health check interval:', err);
    }
  }

  /**
   * Stop periodic health checks
   */
  private stopHealthCheckInterval(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      this.log('Stopped capability health check interval');
    }
  }

  /**
   * Generate a human-readable capability diagnostic report
   */
  private generateCapabilityDiagnosticReport(healthStatuses: Record<string, {
    isHealthy: boolean;
    lastSeenData: number;
    nullCount: number;
    dataCount: number;
    lastValue: unknown;
    timeSinceLastData: number;
  }>): string {
    const report: string[] = [];
    const categories = this.getAvailableCapabilities();

    report.push('=== CAPABILITY HEALTH STATUS ===\n');

    // Overall summary
    const totalCapabilities = Object.keys(healthStatuses).length;
    const healthyCapabilities = Object.values(healthStatuses).filter(
      (status: unknown) => typeof status === 'object' && status !== null
        && 'isHealthy' in status && (status as { isHealthy: boolean }).isHealthy,
    ).length;
    const unhealthyCapabilities = totalCapabilities - healthyCapabilities;

    report.push('📊 SUMMARY:');
    report.push(`   Total Capabilities: ${totalCapabilities}`);
    report.push(`   ❌ Unhealthy: ${unhealthyCapabilities}`);
    report.push(`   ✅ Healthy: ${healthyCapabilities}`);

    report.push('');

    // Unhealthy capabilities first
    const unhealthy = Object.entries(healthStatuses).filter(([, status]) => !status.isHealthy);
    if (unhealthy.length > 0) {
      report.push('🚨 UNHEALTHY CAPABILITIES:');
      for (const [capability, health] of unhealthy) {
        const timeAgo = this.formatTimeAgo(health.timeSinceLastData);
        const reason = health.nullCount >= this.NULL_THRESHOLD
          ? `Too many null values (${health.nullCount})`
          : `No recent data (${timeAgo})`;
        const lastValue = health.lastValue !== null && health.lastValue !== undefined
          ? ` = ${health.lastValue}`
          : ' = null';
        report.push(`   ❌ ${capability}${lastValue}`);
        report.push(`      ${reason}, last data: ${timeAgo}`);
      }
      report.push('');
    }

    // Healthy capabilities by category
    for (const [categoryName, capabilities] of Object.entries(categories)) {
      if (capabilities.length === 0) continue;

      const healthyInCategory = capabilities.filter((cap: string | number) => healthStatuses[cap]?.isHealthy || !healthStatuses[cap]);

      if (healthyInCategory.length === 0) continue;

      report.push(`📁 ${categoryName.toUpperCase()} - HEALTHY (${healthyInCategory.length} capabilities):`);

      for (const capability of healthyInCategory) {
        const health = healthStatuses[capability];
        if (health) {
          const timeAgo = this.formatTimeAgo(health.timeSinceLastData);
          const nullCount = health.nullCount > 0 ? ` (${health.nullCount} nulls)` : '';
          const lastValue = health.lastValue !== null && health.lastValue !== undefined
            ? ` = ${health.lastValue}`
            : ' = null';

          report.push(`   ✅ ${capability}${lastValue}   Last data: ${timeAgo}${nullCount}`);
        } else {
          report.push(`   ⚠️  ${capability} = no health data`);
        }
      }
      report.push('');
    }

    report.push('💡 TIP: Unhealthy capabilities are excluded from flow cards in "auto" mode.');
    report.push('    Use "enabled" mode to force flow cards for all capabilities.');

    return report.join('\n');
  }

  /**
   * Format time difference in human-readable format
   */
  private formatTimeAgo(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ago`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s ago`;
    return `${seconds}s ago`;
  }

  /**
   * Determine if a category should register flow cards based on combined logic
   */
  private shouldRegisterCategory(
    _category: keyof CapabilityCategories,
    availableCaps: string[],
    userSetting: string,
    capabilitiesWithData: string[],
  ): boolean {

    switch (userSetting) {
      case 'disabled':
        return false;

      case 'enabled':
        return availableCaps.length > 0; // Has capabilities

      case 'auto':
      default:
        // Auto mode: require both capability AND data
        return availableCaps.length > 0
               && availableCaps.some((cap) => capabilitiesWithData.includes(cap));
    }
  }

  /**
   * Get category for a capability
   */
  private getCapabilityCategory(capability: string): keyof CapabilityCategories {
    if (capability.startsWith('measure_temperature')) return 'temperature';
    if (capability.startsWith('measure_voltage')) return 'voltage';
    if (capability.startsWith('measure_current')) return 'current';
    if (capability.includes('power')) return 'power';
    if (capability.includes('pulse_steps')) return 'pulseSteps';
    if (capability.startsWith('adlar_state')) return 'states';
    return 'temperature'; // Default fallback
  }

  /**
   * Updates Homey capabilities based on fetched DPS data.
   * @param {Record<string, unknown>} dpsFetched The DPS data fetched from the Tuya device.
   * @param {Record<number, string>} allArraysSwapped The mapping of DPS IDs to Homey capability names.
   */
  private updateCapabilitiesFromDps(dpsFetched: Record<string, unknown>, allArraysSwapped: Record<number, string>): void {
    Object.entries(dpsFetched).forEach(([dpsId, value]) => {
      const dpsNumber = Number(dpsId);

      // Find all capabilities that map to this DPS ID (handle dual capabilities)
      const matchingCapabilities: string[] = [];
      Object.entries(this.allCapabilities).forEach(([capabilityName, dpsArray]) => {
        if (dpsArray.includes(dpsNumber)) {
          matchingCapabilities.push(capabilityName);
        }
      });

      this.debugLog(`DPS ${dpsId} received with value:`, value);
      this.debugLog(`Found ${matchingCapabilities.length} capabilities for dpsId ${dpsId}:`, matchingCapabilities);
      
      // Special debug for DPS 13 (heating curve)
      if (dpsNumber === 13) {
        this.log('DPS 13 (heating curve) update:', value);
        this.log('All capabilities mapping:', Object.keys(this.allCapabilities));
        this.log('adlar_enum_countdown_set mapping:', this.allCapabilities['adlar_enum_countdown_set']);
      }

      if (matchingCapabilities.length > 0) {
        // Update all matching capabilities
        matchingCapabilities.forEach((capability) => {
          // Update capability health tracking
          this.updateCapabilityHealth(capability, value);

          // Check for critical conditions before updating
          this.checkForCriticalConditions(capability, value).catch((err) => this.error('Error checking critical conditions:', err));

          // Update the capability value in Homey
          this.setCapabilityValue(capability, (value as boolean | number | string))
            .then(() => this.debugLog(`Updated ${capability} to`, String(value)))
            .catch((err) => this.error(`Failed to update ${capability}:`, err));
        });
      } else {
        this.debugLog(`No capability mapping found for DPS ${dpsId}`);
      }
    });
  }

  private async checkForCriticalConditions(capability: string, value: unknown) {
    // Check user preferences first
    const category = this.getCapabilityCategory(capability);
    const userSettings = this.getUserFlowPreferences();

    // Map category to correct property name
    const settingMap: Record<keyof CapabilityCategories, keyof UserFlowPreferences> = {
      temperature: 'flow_temperature_alerts',
      voltage: 'flow_voltage_alerts',
      current: 'flow_current_alerts',
      power: 'flow_power_alerts',
      pulseSteps: 'flow_pulse_steps_alerts',
      states: 'flow_state_alerts',
    };

    const userSetting = userSettings[settingMap[category]];

    if (userSetting === 'disabled') {
      return; // User disabled this category
    }

    // Check if capability should trigger based on combined logic
    const availableCaps = this.getAvailableCapabilities();
    const capabilitiesWithData = [capability]; // This capability clearly has data

    if (!this.shouldRegisterCategory(category, availableCaps[category], userSetting as string, capabilitiesWithData)) {
      return; // Doesn't meet combined criteria
    }

    // System fault detection (always enabled - critical for safety)
    if (capability === 'adlar_fault' && value !== 0) {
      await this.sendCriticalNotification(
        'System Fault Detected',
        `Heat pump fault code: ${value}. Please check system immediately.`,
      );
      // Fire fault trigger
      await this.triggerFlowCard('fault_detected', { fault_code: value });
    }

    // Temperature safety checks and flow triggers
    const temperatureCapabilityMap: Record<string, string> = {
      'measure_temperature.coiler_temp': 'coiler_temperature_alert',
      'measure_temperature.bottom_temp_f': 'incoiler_temperature_alert',
      'measure_temperature.around_temp_f': 'tank_temperature_alert',
      'measure_temperature.coiler_temp_f': 'suction_temperature_alert',
      'measure_temperature.venting_temp': 'discharge_temperature_alert',
      'measure_temperature.evlin': 'economizer_inlet_temperature_alert',
      'measure_temperature.eviout': 'economizer_outlet_temperature_alert',
      'measure_temperature.temp_current_f': 'high_pressure_temperature_alert',
      'measure_temperature.top_temp_f': 'low_pressure_temperature_alert',
    };

    if (temperatureCapabilityMap[capability] && typeof value === 'number') {
      // Fire temperature alert flow cards for any significant threshold (customize as needed)
      if (value > 60 || value < 0) {
        await this.triggerFlowCard(temperatureCapabilityMap[capability], {
          temperature: value,
          sensor_type: capability.split('.')[1] || 'unknown',
        });
      }

      // Critical temperature safety checks
      if (value > 80 || value < -20) {
        await this.sendCriticalNotification(
          'Temperature Alert',
          `Extreme temperature detected (${value}°C). System safety may be compromised.`,
        );
      }
    }

    // Voltage alert flow triggers
    const voltageCapabilityMap: Record<string, string> = {
      'measure_voltage.voltage_current': 'phase_a_voltage_alert',
      'measure_voltage.bv': 'phase_b_voltage_alert',
      'measure_voltage.cv': 'phase_c_voltage_alert',
    };

    if (voltageCapabilityMap[capability] && typeof value === 'number') {
      // Fire voltage alert for values outside typical range (customize thresholds)
      if (value > 250 || value < 200) {
        await this.triggerFlowCard(voltageCapabilityMap[capability], {
          voltage: value,
          phase: capability.split('.')[1] || 'unknown',
        });
      }
    }

    // Current alert flow triggers
    const currentCapabilityMap: Record<string, string> = {
      'measure_current.b_cur': 'phase_b_current_alert',
      'measure_current.c_cur': 'phase_c_current_alert',
    };

    if (currentCapabilityMap[capability] && typeof value === 'number') {
      // Fire current alert for high current values (customize threshold)
      if (value > 20) {
        await this.triggerFlowCard(currentCapabilityMap[capability], {
          current: value,
          phase: capability.split('.')[1] || 'unknown',
        });
      }
    }

    // Pulse-steps alerts and flow triggers
    const pulseStepsCapabilityMap: Record<string, string> = {
      adlar_measure_pulse_steps_temp_current: 'eev_pulse_steps_alert',
      adlar_measure_pulse_steps_effluent_temp: 'evi_pulse_steps_alert',
    };

    if (pulseStepsCapabilityMap[capability] && typeof value === 'number') {
      // Fire pulse-steps alert flow cards for values outside operational range
      if (value > 450 || value < 10) {
        await this.triggerFlowCard(pulseStepsCapabilityMap[capability], {
          pulse_steps: value,
          valve_type: capability.includes('temp_current') ? 'eev' : 'evi',
        });
      }

      // Critical pulse-steps safety checks
      if (value > 480 || value < 0) {
        await this.sendCriticalNotification(
          'Pulse-Steps Alert',
          `Critical pulse-steps reading (${value}). System may require immediate attention.`,
        );
      }
    }

    // State change triggers
    const stateCapabilityMap: Record<string, string> = {
      adlar_state_defrost_state: 'defrost_state_changed',
      adlar_state_compressor_state: 'compressor_state_changed',
      adlar_state_backwater_state: 'backwater_state_changed',
    };

    if (stateCapabilityMap[capability]) {
      await this.triggerFlowCard(stateCapabilityMap[capability], {
        new_state: value,
        state_type: capability.split('_').pop() || 'unknown',
      });
    }

    // Temperature change triggers (threshold-based)
    const tempChangeCapabilityMap: Record<string, string> = {
      'measure_temperature.around_temp': 'ambient_temperature_changed',
      'measure_temperature.temp_top': 'inlet_temperature_changed',
      'measure_temperature.temp_bottom': 'outlet_temperature_changed',
    };

    if (tempChangeCapabilityMap[capability] && typeof value === 'number') {
      // Store previous value and check for significant changes
      const prevValueKey = `prev_${capability.replace(/\./g, '_')}`;
      const previousValue = this.getStoreValue(prevValueKey) || value;

      // Fire trigger if temperature changed by more than 2°C
      if (Math.abs(value - previousValue) >= 2) {
        await this.triggerFlowCard(tempChangeCapabilityMap[capability], {
          temperature: value,
          previous_temperature: previousValue,
          change: value - previousValue,
          sensor_type: capability.split('.')[1] || 'unknown',
        });

        // Store new value for next comparison
        await this.setStoreValue(prevValueKey, value);
      }
    }

    // Power and consumption threshold triggers
    if (capability === 'measure_power' && typeof value === 'number') {
      // Fire power threshold exceeded for values above 5kW
      if (value > 5000) {
        await this.triggerFlowCard('power_threshold_exceeded', {
          power: value,
          threshold: 5000,
        });
      }
    }

    if (capability === 'meter_power.electric_total' && typeof value === 'number') {
      // Fire consumption milestone for every 100kWh increment
      const milestoneIncrement = 100;
      const currentMilestone = Math.floor(value / milestoneIncrement);
      const lastMilestone = this.getStoreValue('last_consumption_milestone') || 0;

      if (currentMilestone > lastMilestone) {
        await this.triggerFlowCard('total_consumption_milestone', {
          consumption: value,
          milestone: currentMilestone * milestoneIncrement,
        });
        await this.setStoreValue('last_consumption_milestone', currentMilestone);
      }
    }

    if (capability === 'meter_power.electric_today' && typeof value === 'number') {
      // Fire daily consumption threshold for values above 20kWh
      if (value > 20) {
        await this.triggerFlowCard('daily_consumption_threshold', {
          daily_consumption: value,
          threshold: 20,
        });
      }
    }

    // Water flow alert
    if (capability === 'measure_water' && typeof value === 'number') {
      // Fire water flow alert for low flow rates (below 10 L/min)
      if (value < 10) {
        await this.triggerFlowCard('water_flow_alert', {
          flow_rate: value,
          threshold: 10,
          alert_type: 'low_flow',
        });
      }
    }

    // Efficiency alerts
    if (capability === 'adlar_state_compressor_state' && typeof value === 'number') {
      // Calculate efficiency based on power consumption vs state
      const power = this.getCapabilityValue('measure_power') || 0;
      const efficiency = value > 0 && power > 0 ? (value / power) * 100 : 0;

      if (efficiency < 50 && power > 1000) { // Low efficiency with significant power draw
        await this.triggerFlowCard('compressor_efficiency_alert', {
          efficiency,
          power,
          threshold: 50,
        });
      }
    }

    // Electrical load alert
    const totalCurrentCapabilities = ['measure_current.cur_current', 'measure_current.b_cur', 'measure_current.c_cur'];
    if (totalCurrentCapabilities.includes(capability) && typeof value === 'number') {
      const currentA = this.getCapabilityValue('measure_current.cur_current') || 0;
      const currentB = this.getCapabilityValue('measure_current.b_cur') || 0;
      const currentC = this.getCapabilityValue('measure_current.c_cur') || 0;
      const totalLoad = Number(currentA) + Number(currentB) + Number(currentC);

      if (totalLoad > 50) { // Total electrical load above 50A
        await this.triggerFlowCard('electrical_load_alert', {
          total_load: totalLoad,
          phase_a: currentA,
          phase_b: currentB,
          phase_c: currentC,
          threshold: 50,
        });
      }
    }

    // Fan motor efficiency alert (based on fan speed vs power consumption)
    if (capability === 'adlar_enum_volume_set' && typeof value === 'number') {
      const power = this.getCapabilityValue('measure_power') || 0;
      const expectedPowerRatio = value * 100; // Expected: volume setting * 100W

      if (power > expectedPowerRatio * 1.5) { // 50% higher than expected
        await this.triggerFlowCard('fan_motor_efficiency_alert', {
          volume_setting: value,
          actual_power: power,
          expected_power: expectedPowerRatio,
          efficiency_ratio: expectedPowerRatio / power,
        });
      }
    }

    // Countdown timer finished
    if (capability === 'adlar_countdowntimer' && value === 0) {
      const previousTimer = this.getStoreValue('prev_countdown') || 0;
      if (previousTimer > 0) { // Timer was running and now finished
        await this.triggerFlowCard('countdown_timer_finished', {
          timer_duration: previousTimer,
          completion_time: new Date().toISOString(),
        });
      }
      await this.setStoreValue('prev_countdown', value);
    } else if (capability === 'adlar_countdowntimer' && typeof value === 'number') {
      await this.setStoreValue('prev_countdown', value);
    }
  }

  /**
   * Initialize flow cards based on current settings (called once during device init)
   */
  private async initializeFlowCards(): Promise<void> {
    try {
      await this.updateFlowCards();
      this.isFlowCardsInitialized = true;
      this.log('Flow cards initialized successfully');
    } catch (error) {
      this.error('Error initializing flow cards:', error);
    }
  }

  /**
   * Update all flow cards based on current settings (called when settings change)
   */
  private async updateFlowCards(): Promise<void> {
    try {
      // Don't proceed if device isn't fully initialized yet
      if (!this.isFlowCardsInitialized && Object.keys(this.homey.drivers.getDrivers()).length === 0) {
        this.log('Skipping flow card update - system not ready');
        return;
      }

      // Unregister all current flow card listeners
      this.unregisterAllFlowCards();

      // Get current user preferences and available capabilities
      const userPrefs = this.getUserFlowPreferences();
      const availableCaps = this.getAvailableCapabilities();
      const capabilitiesWithData = await this.detectCapabilitiesWithData();

      // Register flow cards based on settings
      await this.registerFlowCardsByCategory('temperature', availableCaps.temperature, userPrefs.flow_temperature_alerts, capabilitiesWithData);
      await this.registerFlowCardsByCategory('voltage', availableCaps.voltage, userPrefs.flow_voltage_alerts, capabilitiesWithData);
      await this.registerFlowCardsByCategory('current', availableCaps.current, userPrefs.flow_current_alerts, capabilitiesWithData);
      await this.registerFlowCardsByCategory('power', availableCaps.power, userPrefs.flow_power_alerts, capabilitiesWithData);
      await this.registerFlowCardsByCategory('pulseSteps', availableCaps.pulseSteps, userPrefs.flow_pulse_steps_alerts, capabilitiesWithData);
      await this.registerFlowCardsByCategory('states', availableCaps.states, userPrefs.flow_state_alerts, capabilitiesWithData);

      // Expert feature cards
      if (userPrefs.flow_expert_mode) {
        await this.registerExpertFeatureCards();
      }

      // Register action-based condition cards (always available)
      await this.registerActionBasedConditionCards();

      this.log('Flow cards updated successfully');
    } catch (error) {
      this.error('Error updating flow cards:', error);
    }
  }

  /**
   * Register flow cards for a specific category based on user setting
   */
  private async registerFlowCardsByCategory(
    category: keyof CapabilityCategories,
    availableCaps: string[],
    userSetting: 'disabled' | 'auto' | 'enabled',
    capabilitiesWithData: string[],
  ): Promise<void> {
    const shouldRegister = this.shouldRegisterCategory(category, availableCaps, userSetting, capabilitiesWithData);

    if (!shouldRegister) {
      this.log(`Skipping ${category} flow cards - setting: ${userSetting}, available: ${availableCaps.length}, with data: ${availableCaps.filter((cap) => capabilitiesWithData.includes(cap)).length}`);
      return;
    }

    this.log(`Registering ${category} flow cards - available capabilities:`, availableCaps.filter((cap) => capabilitiesWithData.includes(cap)));

    // Flow cards are handled by the pattern-based system in app.ts
    // No device-level registration needed
    this.debugLog(`Category ${category} flow cards managed by pattern-based system`);
    this.log(`Skipping device-level registration for ${category} - managed by app-level pattern system`);
  }

  /**
   * Register temperature-related flow cards
   */
  private async registerTemperatureFlowCards(availableCaps: string[]): Promise<void> {
    try {
      // Temperature threshold condition
      if (availableCaps.some((cap) => cap.includes('temp'))) {
        const tempThresholdCard = this.homey.flow.getConditionCard('temperature_above');
        const tempListener = tempThresholdCard.registerRunListener(async (args) => {
          this.debugLog('Temperature threshold condition triggered', { args });
          const sensorCap = `measure_temperature.${args.sensor || 'around_temp'}`;
          if (this.hasCapability(sensorCap)) {
            const rawValue = this.getCapabilityValue(sensorCap);
            const isNull = rawValue === null || rawValue === undefined;
            const currentTemp = rawValue || 0;
            const result = currentTemp > (args.threshold || 25);

            if (isNull) {
              this.debugLog('Temperature threshold condition: using fallback value for null capability', {
                sensorCap,
                rawValue,
                fallbackValue: currentTemp,
                threshold: args.threshold || 25,
                result,
              });
            } else {
              this.debugLog('Temperature threshold condition result', {
                sensorCap,
                currentTemp,
                threshold: args.threshold || 25,
                result,
              });
            }
            return result;
          }
          this.debugLog('Temperature threshold condition: capability not found', { sensorCap });
          return false;
        });
        this.flowCardListeners.set('temperature_above', tempListener);
      }

      // Register trigger cards for each available temperature sensor
      const tempTriggerCards = [
        'coiler_temperature_alert',
        'incoiler_temperature_alert',
        'tank_temperature_alert',
        'suction_temperature_alert',
        'discharge_temperature_alert',
        'ambient_temperature_changed',
        'inlet_temperature_changed',
        'outlet_temperature_changed',
      ];

      tempTriggerCards.forEach((cardId) => {
        try {
          const triggerCard = this.homey.flow.getDeviceTriggerCard(cardId);
          this.flowCardListeners.set(cardId, triggerCard);
        } catch (err) {
          this.log(`Temperature trigger card ${cardId} not found, skipping`);
        }
      });

      this.log('Temperature flow cards registered');
    } catch (error) {
      this.error('Error registering temperature flow cards:', error);
    }
  }

  /**
   * Register voltage-related flow cards
   */
  private async registerVoltageFlowCards(availableCaps: string[]): Promise<void> {
    try {
      // Voltage range condition card does not exist - handled by pattern-based system
      this.debugLog('Voltage flow cards managed by pattern-based system');

      // Voltage alert triggers
      const voltageTriggerCards = [
        'phase_a_voltage_alert',
        'phase_b_voltage_alert',
        'phase_c_voltage_alert',
      ];

      voltageTriggerCards.forEach((cardId) => {
        try {
          const triggerCard = this.homey.flow.getDeviceTriggerCard(cardId);
          this.flowCardListeners.set(cardId, triggerCard);
        } catch (err) {
          this.log(`Voltage trigger card ${cardId} not found, skipping`);
        }
      });

      this.log('Voltage flow cards registered');
    } catch (error) {
      this.error('Error registering voltage flow cards:', error);
    }
  }

  /**
   * Register current-related flow cards
   */
  private async registerCurrentFlowCards(availableCaps: string[]): Promise<void> {
    try {
      // Current threshold condition card does not exist - handled by pattern-based system
      this.debugLog('Current flow cards managed by pattern-based system');

      // Current alert triggers
      const currentTriggerCards = [
        'phase_b_current_alert',
        'phase_c_current_alert',
        'electrical_load_alert',
      ];

      currentTriggerCards.forEach((cardId) => {
        try {
          const triggerCard = this.homey.flow.getDeviceTriggerCard(cardId);
          this.flowCardListeners.set(cardId, triggerCard);
        } catch (err) {
          this.log(`Current trigger card ${cardId} not found, skipping`);
        }
      });

      this.log('Current flow cards registered');
    } catch (error) {
      this.error('Error registering current flow cards:', error);
    }
  }

  /**
   * Register power-related flow cards
   */
  private async registerPowerFlowCards(availableCaps: string[]): Promise<void> {
    try {
      // Power threshold condition
      if (availableCaps.some((cap) => cap.includes('power'))) {
        const powerThresholdCard = this.homey.flow.getConditionCard('power_above_threshold');
        const powerListener = powerThresholdCard.registerRunListener(async (args) => {
          this.debugLog('Power threshold condition triggered', { args });
          const rawValue = this.getCapabilityValue('measure_power');
          const isNull = rawValue === null || rawValue === undefined;
          const currentPower = rawValue || 0;
          const result = currentPower > (args.threshold || 1000);

          if (isNull) {
            this.debugLog('Power threshold condition: using fallback value for null capability', {
              capability: 'measure_power',
              rawValue,
              fallbackValue: currentPower,
              threshold: args.threshold || 1000,
              result,
            });
          } else {
            this.debugLog('Power threshold condition result', {
              currentPower,
              threshold: args.threshold || 1000,
              result,
            });
          }
          return result;
        });
        this.flowCardListeners.set('power_above_threshold', powerListener);
      }

      // Power alert triggers
      const powerTriggerCards = [
        'power_threshold_exceeded',
        'total_consumption_milestone',
        'daily_consumption_threshold',
      ];

      powerTriggerCards.forEach((cardId) => {
        try {
          const triggerCard = this.homey.flow.getDeviceTriggerCard(cardId);
          this.flowCardListeners.set(cardId, triggerCard);
        } catch (err) {
          this.log(`Power trigger card ${cardId} not found, skipping`);
        }
      });

      this.log('Power flow cards registered');
    } catch (error) {
      this.error('Error registering power flow cards:', error);
    }
  }

  /**
   * Register pulse-steps related flow cards
   */
  private async registerPulseStepsFlowCards(availableCaps: string[]): Promise<void> {
    try {
      // Pulse steps range condition
      if (availableCaps.some((cap) => cap.includes('pulse_steps'))) {
        const pulseStepsRangeCard = this.homey.flow.getConditionCard('pulse_steps_in_range');
        const pulseStepsListener = pulseStepsRangeCard.registerRunListener(async (args) => {
          this.debugLog('Pulse steps range condition triggered', { args });
          const valve = args.valve || 'temp_current';
          const capability = valve === 'temp_current' ? 'adlar_measure_pulse_steps_temp_current' : 'adlar_measure_pulse_steps_effluent_temp';

          if (this.hasCapability(capability)) {
            const rawValue = this.getCapabilityValue(capability);
            const isNull = rawValue === null || rawValue === undefined;
            const pulseSteps = rawValue || 0;
            const minSteps = args.min_steps || 10;
            const maxSteps = args.max_steps || 450;
            const result = pulseSteps >= minSteps && pulseSteps <= maxSteps;

            if (isNull) {
              this.debugLog('Pulse steps range condition: using fallback value for null capability', {
                valve,
                capability,
                rawValue,
                fallbackValue: pulseSteps,
                minSteps,
                maxSteps,
                result,
              });
            } else {
              this.debugLog('Pulse steps range condition result', {
                valve,
                capability,
                pulseSteps,
                minSteps,
                maxSteps,
                result,
              });
            }
            return result;
          }
          this.debugLog('Pulse steps range condition: capability not found', { capability });
          return false;
        });
        this.flowCardListeners.set('pulse_steps_in_range', pulseStepsListener);
      }

      // Pulse steps alert triggers
      const pulseStepsTriggerCards = [
        'eev_pulse_steps_alert',
        'evi_pulse_steps_alert',
      ];

      pulseStepsTriggerCards.forEach((cardId) => {
        try {
          const triggerCard = this.homey.flow.getDeviceTriggerCard(cardId);
          this.flowCardListeners.set(cardId, triggerCard);
        } catch (err) {
          this.log(`Pulse steps trigger card ${cardId} not found, skipping`);
        }
      });

      this.log('Pulse steps flow cards registered');
    } catch (error) {
      this.error('Error registering pulse steps flow cards:', error);
    }
  }

  /**
   * Register state-related flow cards
   */
  private async registerStateFlowCards(availableCaps: string[]): Promise<void> {
    try {
      // System state condition
      if (availableCaps.some((cap) => cap.includes('state'))) {
        const stateConditionCard = this.homey.flow.getConditionCard('system_in_state');
        const stateListener = stateConditionCard.registerRunListener(async (args) => {
          this.debugLog('State condition triggered', { args });
          const stateType = args.state_type || 'compressor_state';
          const capability = `adlar_state_${stateType}`;

          if (this.hasCapability(capability)) {
            const rawValue = this.getCapabilityValue(capability);
            const isNull = rawValue === null || rawValue === undefined;
            const currentState = rawValue || 0;
            const result = currentState === (args.expected_state || 1);

            if (isNull) {
              this.debugLog('State condition: using fallback value for null capability', {
                stateType,
                capability,
                rawValue,
                fallbackValue: currentState,
                expectedState: args.expected_state || 1,
                result,
              });
            } else {
              this.debugLog('State condition result', {
                stateType,
                capability,
                currentState,
                expectedState: args.expected_state || 1,
                result,
              });
            }
            return result;
          }
          this.debugLog('State condition: capability not found', { capability });
          return false;
        });
        this.flowCardListeners.set('system_in_state', stateListener);
      }

      // State change triggers
      const stateTriggerCards = [
        'defrost_state_changed',
        'compressor_state_changed',
        'backwater_state_changed',
        'fault_detected',
        'countdown_timer_finished',
      ];

      stateTriggerCards.forEach((cardId) => {
        try {
          const triggerCard = this.homey.flow.getDeviceTriggerCard(cardId);
          this.flowCardListeners.set(cardId, triggerCard);
        } catch (err) {
          this.log(`State trigger card ${cardId} not found, skipping`);
        }
      });

      this.log('State flow cards registered');
    } catch (error) {
      this.error('Error registering state flow cards:', error);
    }
  }

  /**
   * Register expert feature cards (when expert mode is enabled)
   */
  private async registerExpertFeatureCards(): Promise<void> {
    try {
      // Expert efficiency condition
      const efficiencyCard = this.homey.flow.getConditionCard('compressor_efficiency_above');
      const efficiencyListener = efficiencyCard.registerRunListener(async (args) => {
        this.debugLog('Efficiency condition triggered', { args });
        const rawPower = this.getCapabilityValue('measure_power');
        const rawCompressorState = this.getCapabilityValue('adlar_state_compressor_state');
        const powerIsNull = rawPower === null || rawPower === undefined;
        const compressorStateIsNull = rawCompressorState === null || rawCompressorState === undefined;
        const power = rawPower || 0;
        const compressorState = rawCompressorState || 0;
        const efficiency = compressorState > 0 && power > 0 ? (compressorState / power) * 100 : 0;
        const result = efficiency > (args.threshold || 50);

        if (powerIsNull || compressorStateIsNull) {
          this.debugLog('Efficiency condition: using fallback values for null capabilities', {
            powerRaw: rawPower,
            powerFallback: power,
            powerIsNull,
            compressorStateRaw: rawCompressorState,
            compressorStateFallback: compressorState,
            compressorStateIsNull,
            efficiency,
            threshold: args.threshold || 50,
            result,
          });
        } else {
          this.debugLog('Efficiency condition result', {
            power,
            compressorState,
            efficiency,
            threshold: args.threshold || 50,
            result,
          });
        }
        return result;
      });
      this.flowCardListeners.set('compressor_efficiency_above', efficiencyListener);

      // Expert trigger cards
      const expertTriggerCards = [
        'compressor_efficiency_alert',
        'fan_motor_efficiency_alert',
        'water_flow_alert',
      ];

      expertTriggerCards.forEach((cardId) => {
        try {
          const triggerCard = this.homey.flow.getDeviceTriggerCard(cardId);
          this.flowCardListeners.set(cardId, triggerCard);
        } catch (err) {
          this.log(`Expert trigger card ${cardId} not found, skipping`);
        }
      });

      this.log('Expert feature cards registered');
    } catch (error) {
      this.error('Error registering expert feature cards:', error);
    }
  }

  /**
   * Register action-based condition flow cards
   */
  private async registerActionBasedConditionCards(): Promise<void> {
    try {
      // Device power state condition
      const devicePowerCard = this.homey.flow.getConditionCard('device_power_is');
      devicePowerCard.registerRunListener(async (args) => {
        this.debugLog('Device power condition triggered', { args });
        const currentValue = this.getCapabilityValue('onoff');
        const expectedState = args.state === 'on';
        return currentValue === expectedState;
      });

      // Target temperature condition
      const targetTempCard = this.homey.flow.getConditionCard('target_temperature_is');
      targetTempCard.registerRunListener(async (args) => {
        this.debugLog('Target temperature condition triggered', { args });
        const currentValue = this.getCapabilityValue('target_temperature') || 0;
        const targetValue = args.temperature || 0;

        switch (args.comparison) {
          case 'equal':
            return Math.abs(currentValue - targetValue) < 0.5;
          case 'greater':
            return currentValue > targetValue;
          case 'less':
            return currentValue < targetValue;
          default:
            return false;
        }
      });

      // Hot water temperature condition
      const hotWaterTempCard = this.homey.flow.getConditionCard('hotwater_temperature_is');
      hotWaterTempCard.registerRunListener(async (args) => {
        this.debugLog('Hot water temperature condition triggered', { args });
        const currentValue = this.getCapabilityValue('adlar_hotwater') || 0;
        const targetValue = args.temperature || 0;

        switch (args.comparison) {
          case 'equal':
            return Math.abs(currentValue - targetValue) < 1;
          case 'greater':
            return currentValue > targetValue;
          case 'less':
            return currentValue < targetValue;
          default:
            return false;
        }
      });

      // Heating mode condition
      const heatingModeCard = this.homey.flow.getConditionCard('heating_mode_is');
      heatingModeCard.registerRunListener(async (args) => {
        this.debugLog('Heating mode condition triggered', { args });
        const currentValue = this.getCapabilityValue('adlar_enum_mode');
        return currentValue === args.mode;
      });

      // Work mode condition
      const workModeCard = this.homey.flow.getConditionCard('work_mode_is');
      workModeCard.registerRunListener(async (args) => {
        this.debugLog('Work mode condition triggered', { args });
        const currentValue = this.getCapabilityValue('adlar_enum_work_mode');
        return currentValue === args.mode;
      });

      // Water mode condition
      const waterModeCard = this.homey.flow.getConditionCard('water_mode_is');
      waterModeCard.registerRunListener(async (args) => {
        this.debugLog('Water mode condition triggered', { args });
        const currentValue = this.getCapabilityValue('adlar_enum_water_mode') || 0;
        const targetValue = args.mode || 0;

        switch (args.comparison) {
          case 'equal':
            return currentValue === targetValue;
          case 'greater':
            return currentValue > targetValue;
          case 'less':
            return currentValue < targetValue;
          default:
            return false;
        }
      });

      // Capacity setting condition
      const capacitySettingCard = this.homey.flow.getConditionCard('capacity_setting_is');
      capacitySettingCard.registerRunListener(async (args) => {
        this.debugLog('Capacity setting condition triggered', { args });
        const currentValue = this.getCapabilityValue('adlar_enum_capacity_set');
        return currentValue === args.capacity;
      });

      // Heating curve condition
      const heatingCurveCard = this.homey.flow.getConditionCard('heating_curve_is');
      heatingCurveCard.registerRunListener(async (args) => {
        this.debugLog('Heating curve condition triggered', { args });
        const currentValue = this.getCapabilityValue('adlar_enum_countdown_set');
        return currentValue === args.curve;
      });

      // Volume setting condition
      const volumeSettingCard = this.homey.flow.getConditionCard('volume_setting_is');
      volumeSettingCard.registerRunListener(async (args) => {
        this.debugLog('Volume setting condition triggered', { args });
        const currentValue = this.getCapabilityValue('adlar_enum_volume_set') || 0;
        const targetValue = args.level || 0;

        switch (args.comparison) {
          case 'equal':
            return currentValue === targetValue;
          case 'greater':
            return currentValue > targetValue;
          case 'less':
            return currentValue < targetValue;
          default:
            return false;
        }
      });

      this.log('Action-based condition cards registered');
    } catch (error) {
      this.error('Error registering action-based condition cards:', error);
    }
  }

  /**
   * Unregister all flow card listeners
   */
  private unregisterAllFlowCards(): void {
    this.flowCardListeners.forEach((listener, cardId) => {
      try {
        if (listener && typeof (listener as { unregister?: () => void }).unregister === 'function') {
          (listener as { unregister: () => void }).unregister();
        }
        this.log(`Unregistered flow card: ${cardId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.log(`Flow card ${cardId} was not registered or already unregistered:`, errorMessage);
      }
    });
    this.flowCardListeners.clear();
    this.log('All flow card listeners unregistered');
  }

  /**
   * Helper method to trigger flow cards safely
   */
  private async triggerFlowCard(cardId: string, tokens: Record<string, unknown>) {
    try {
      // Check if the flow card is registered and should be triggered
      const flowCard = this.flowCardListeners.get(cardId);
      if (!flowCard) {
        this.debugLog(`Flow card ${cardId} not registered, skipping trigger`);
        return;
      }

      // Check if trigger method exists on the flow card
      if (flowCard && typeof (flowCard as { trigger?: (device: unknown, tokens: unknown, state?: unknown) => Promise<void> }).trigger === 'function') {
        await (flowCard as { trigger: (device: unknown, tokens: unknown, state?: unknown) => Promise<void> }).trigger(this, tokens, { device: this });
        this.debugLog(`Triggered flow card: ${cardId}`, tokens);
      } else {
        // Fallback to app-level trigger for compatibility
        const app = this.homey.app as unknown as { [key: string]: { trigger?: (device: unknown, tokens: unknown) => Promise<void> } };
        const triggerName = `${cardId.replace(/_/g, '')}Trigger`;

        if (app[triggerName]?.trigger) {
          await app[triggerName].trigger(this, tokens);
          this.debugLog(`Triggered flow card via app: ${cardId}`, tokens);
        } else {
          this.debugLog(`Flow card trigger method not found: ${cardId}`);
        }
      }
    } catch (error) {
      this.error(`Failed to trigger flow card ${cardId}:`, error);
    }
  }

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    await this.setUnavailable(); // Set the device as unavailable initially

    const { manifest } = Homey;
    const myDriver = manifest.drivers[0];
    // this.log('MyDevice overview:', myDriver);

    const capList = myDriver.capabilities;
    this.debugLog('Capabilities list:', capList);

    const builtinCapOptList = myDriver.capabilitiesOptions || {};
    this.debugLog('Capabilities options list:', builtinCapOptList);

    // Extract keys where `setable` exists and is `true`
    const setableBuiltInCapsKeys = Object.keys(builtinCapOptList).filter(
      (key) => builtinCapOptList[key].setable === true,
    );
    this.debugLog('Setable built-in capabilities from driver manifest:', setableBuiltInCapsKeys);

    // Verify heating curve capability (single capability for both display and control)
    const heatingCurveCapability = 'adlar_enum_countdown_set';
    this.debugLog(`Checking heating curve capability: ${heatingCurveCapability}`);
    this.debugLog('Capability exists in manifest:', capList.includes(heatingCurveCapability));
    this.debugLog('Capability available on device:', this.hasCapability(heatingCurveCapability));

    const setableCustomCapsKeys = Object.keys(manifest.capabilities).filter(
      (key) => manifest.capabilities[key].setable === true,
    );
    this.debugLog('Setable custom capabilities from app manifest:', setableCustomCapsKeys);

    // Default setable built-in capabilities (per Homey SDK standards)
    const defaultSetableBuiltInCaps = [
      'target_temperature',
      'onoff',
    ];

    // Filter only capabilities that are actually present in the device
    const availableDefaultSetableCaps = defaultSetableBuiltInCaps.filter((cap) => capList.includes(cap));
    this.debugLog('Available default setable built-in capabilities:', availableDefaultSetableCaps);

    // Combine and deduplicate setable capabilities
    this.settableCapabilities = [
      ...new Set([
        ...setableBuiltInCapsKeys,
        ...setableCustomCapsKeys,
        ...availableDefaultSetableCaps,
      ]),
    ];
    this.debugLog('Setable capabilities:', this.settableCapabilities); // Output: []

    // Register enhanced capability listeners with validation and error handling
    this.settableCapabilities.forEach((capability: string) => {
      this.debugLog(`Registering capability listener for ${capability}`);
      this.registerCapabilityListener(capability, async (value, _opts) => {
        this.log(`${capability} set to`, value);

        try {
          // Map capability to Tuya DP (data point)
          const dpArray = this.allCapabilities[capability];
          const dp = Array.isArray(dpArray) ? dpArray[0] : undefined;

          if (dp === undefined) {
            const errorMsg = `No Tuya DP mapping found for capability: ${capability}`;
            this.error(errorMsg);
            throw new Error(errorMsg);
          }

          // Validate value based on capability type
          const validatedValue = this.validateCapabilityValue(capability, value);

          // Ensure Tuya connection
          await this.connectTuya();

          if (!this.tuya) {
            throw new Error('Tuya device is not initialized');
          }

          // Send command to device
          await this.tuya.set({ dps: dp, set: validatedValue as string | number | boolean });
          this.log(`Successfully sent to Tuya: dp ${dp} = ${validatedValue}`);

          // Update Homey capability value to confirm change
          await this.setCapabilityValue(capability, validatedValue).catch((err) => {
            this.error(`Failed to update Homey capability ${capability}:`, err);
          });

          // Note: Using single capability for heating curve - both display and control

        } catch (error) {
          this.error(`Failed to update ${capability} on device:`, error);

          // Provide user-friendly error messages
          let userMessage = 'Failed to update device';
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
            userMessage = 'Device connection lost. Please check network connectivity.';
          } else if (errorMessage.includes('not initialized')) {
            userMessage = 'Device not ready. Please try again in a moment.';
          } else if (errorMessage.includes('mapping')) {
            userMessage = 'Device capability not supported.';
          } else if (errorMessage.includes('range') || errorMessage.includes('Invalid')) {
            userMessage = errorMessage; // Use the specific validation error
          }

          throw new Error(userMessage);
        }
      });
    });

    // Register flow card action listeners
    await this.registerFlowCardActionListeners();

    // Handle optional capabilities based on settings
    await this.handleOptionalCapabilities();

    // Get Tuya device settings from Homey
    const id = this.getStoreValue('device_id');
    const key = this.getStoreValue('local_key');
    const ip = this.getStoreValue('ip_address');
    const version = '3.3';

    // Initialize TuyaDevice
    this.tuya = new TuyaDevice({
      id,
      key,
      ip,
      version,
    });

    // Connect once at startup
    await this.connectTuya();

    // Start reconnection interval
    this.startReconnectInterval();

    // Initialize flow cards based on current settings
    await this.initializeFlowCards();

    // Start periodic health checks for dynamic flow card management
    this.startHealthCheckInterval();

    // TUYA ON EVENT (from dp id to capability name)
    this.tuya.on('data', (data: { dps: Record<number, unknown> }): void => {
      // Suppose data contains updated values, e.g., { dps: { 1: true, 4: 22 } }
      const dpsFetched = data.dps || {};
      this.log('Data received from Tuya:', dpsFetched);

      // Update Homey capabilities based on the fetched DPS data
      this.updateCapabilitiesFromDps(dpsFetched, this.allArraysSwapped);

      this.setAvailable()
        .then(() => this.log('Device set as available'))
        .catch((err) => this.error('Error setting device as available:', err));
    });

    // TUYA DP_REFRESH event (from dp id to capability name)
    this.tuya.on('dp-refresh', (data: { dps: Record<number, unknown> }): void => {
      // Suppose data contains updated values, e.g., { dps: { 1: true, 4: 22 } }
      const dpsFetched = data.dps || {};
      this.log('DP-Refresh received from Tuya:', dpsFetched);

      // Update Homey capabilities based on the fetched DPS data
      this.updateCapabilitiesFromDps(dpsFetched, this.allArraysSwapped);
    });

    // Fixing promise handling for setAvailable and setUnavailable
    this.tuya.on('connected', (): void => {
      this.log('Device', 'Connected to device!');
      this.setAvailable()
        .then(() => this.log('Device set as available'))
        .catch((err) => this.error('Error setting device as available:', err));
    });

    this.tuya.on('disconnected', (): void => {
      this.log('Device', 'Disconnected from device!');
      this.tuyaConnected = false;
      this.setUnavailable('Device disconnected')
        .then(() => this.log('Device set as unavailable'))
        .catch((err) => this.error('Error setting device as unavailable:', err));
    });

  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('MyDevice has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    this.log('MyDevice settings changed:', changedKeys);

    // Check if any flow card settings were changed
    const flowSettingsChanged = changedKeys.some((key) => key.startsWith('flow_'));

    if (flowSettingsChanged) {
      this.log('Flow card settings changed, updating flow card availability');

      // Log the changes for debugging
      changedKeys.forEach((key) => {
        if (key.startsWith('flow_')) {
          this.log(`${key}: ${oldSettings[key]} → ${newSettings[key]}`);
        }
      });

      // Update flow cards based on new settings
      try {
        await this.updateFlowCards();
        this.log('Flow cards updated successfully');
      } catch (error) {
        this.error('Error updating flow cards:', error);
      }

      return 'Flow card settings updated. Changes will take effect immediately.';
    }

    // Handle capability diagnostics request
    if (changedKeys.includes('capability_diagnostics') && newSettings.capability_diagnostics === true) {
      const healthStatuses = this.getAllCapabilityHealthStatuses();
      const diagnosticReport = this.generateCapabilityDiagnosticReport(healthStatuses);

      this.log('Capability diagnostic report generated:', diagnosticReport);

      // Reset the trigger setting after onSettings completes to avoid race condition
      this.homey.setTimeout(async () => {
        try {
          await this.setSettings({ capability_diagnostics: false });
        } catch (error) {
          this.error('Failed to reset diagnostics checkbox:', error);
        }
      }, 100);

      return `Capability Diagnostics Report:\n\n${diagnosticReport}`;
    }

    // Handle power measurement settings
    if (changedKeys.includes('enable_power_measurements')) {
      const enablePower = newSettings.enable_power_measurements;

      // Auto-manage all power-related flow alert settings
      const powerFlowSettings = ['flow_power_alerts', 'flow_voltage_alerts', 'flow_current_alerts'];
      const settingsToUpdate: Record<string, string> = {};

      if (!enablePower) {
        // Disable all power-related flow alerts when power measurements are disabled
        for (const setting of powerFlowSettings) {
          if (oldSettings[setting] !== 'disabled') {
            settingsToUpdate[setting] = 'disabled';
          }
        }

        if (Object.keys(settingsToUpdate).length > 0) {
          await this.setSettings(settingsToUpdate);
          this.log('Auto-disabled power-related flow alerts due to power measurements being disabled:', Object.keys(settingsToUpdate));
        }
      } else if (enablePower && oldSettings.enable_power_measurements === false) {
        // Reset all to auto when power measurements are re-enabled
        for (const setting of powerFlowSettings) {
          settingsToUpdate[setting] = 'auto';
        }

        await this.setSettings(settingsToUpdate);
        this.log('Auto-enabled power-related flow alerts due to power measurements being enabled:', Object.keys(settingsToUpdate));
      }

      await this.handleOptionalCapabilities();
      this.log('Power measurement settings updated');
      return 'Power measurement settings updated. Capabilities and flow cards have been updated.';
    }

    return undefined;
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} _name The new name
   */
  async onRenamed(_name: string) {
    this.log('MyDevice was renamed');
  }

  /**
   * Handle optional capabilities based on settings
   */
  private async handleOptionalCapabilities(): Promise<void> {
    const enablePowerMeasurements = this.getSetting('enable_power_measurements') ?? true;

    const powerCapabilities = [
      'measure_power',
      'meter_power.power_consumption',
      'meter_power.electric_total',
      'measure_current.cur_current',
      'measure_current.b_cur',
      'measure_current.c_cur',
      'measure_voltage.voltage_current',
      'measure_voltage.bv',
      'measure_voltage.cv',
    ];

    for (const capability of powerCapabilities) {
      if (enablePowerMeasurements) {
        if (!this.hasCapability(capability)) {
          try {
            await this.addCapability(capability);
            this.log(`Added optional capability: ${capability}`);
          } catch (error) {
            this.error(`Failed to add capability ${capability}:`, error);
          }
        }
      } else if (this.hasCapability(capability)) {
        try {
          await this.removeCapability(capability);
          this.log(`Removed optional capability: ${capability}`);
        } catch (error) {
          this.error(`Failed to remove capability ${capability}:`, error);
        }
      }
    }
  }

  /**
   * Validate capability values based on capability type
   */
  private validateCapabilityValue(capability: string, value: unknown): unknown {
    switch (capability) {
      case 'target_temperature': {
        const temp = Number(value);
        if (Number.isNaN(temp) || temp < 5 || temp > 75) {
          throw new Error(`Temperature ${temp}°C is outside valid range (5-75°C)`);
        }
        return temp;
      }

      case 'onoff':
        return Boolean(value);

      case 'adlar_enum_mode':
      case 'adlar_enum_countdown_set':
      case 'adlar_enum_work_mode':
        if (typeof value !== 'string') {
          throw new Error(`Invalid enum value for ${capability}: ${value}`);
        }
        return value;

      case 'adlar_hotwater': {
        const hotWaterTemp = Number(value);
        if (Number.isNaN(hotWaterTemp) || hotWaterTemp < 35 || hotWaterTemp > 75) {
          throw new Error(`Hot water temperature ${hotWaterTemp}°C is outside valid range (35-75°C)`);
        }
        return hotWaterTemp;
      }

      default:
        return value;
    }
  }

  /**
   * Register flow card action listeners
   * Note: Most ACTION cards are now handled by the app-level pattern-based system in app.ts/flow-helpers.ts
   * Only custom/complex ACTION cards should be registered here
   */
  private async registerFlowCardActionListeners(): Promise<void> {
    this.debugLog('Registering device-level flow card action listeners');

    try {
      // All simple ACTION cards (set_target_temperature, set_device_onoff, set_heating_mode,
      // set_heating_curve, set_work_mode) are now handled by the app-level pattern-based system
      this.debugLog('Simple ACTION cards are managed by app-level pattern-based system');

      // Reserve this method for custom/complex ACTION cards that need device-specific logic
      // Currently no custom ACTION cards require device-level registration
    } catch (error) {
      this.error('Error registering flow card action listeners:', error);
    }
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('MyDevice has been deleted');

    // Stop reconnection interval
    this.stopReconnectInterval();

    // Stop health check interval
    this.stopHealthCheckInterval();

    if (this.tuya) {
      try {
        // Remove all event listeners to prevent memory leaks
        this.tuya.removeAllListeners();

        // Disconnect if connected
        if (this.tuyaConnected) {
          this.tuya.disconnect();
          this.log('Disconnected from Tuya device');
        }
      } catch (err) {
        this.error('Error cleaning up Tuya device:', err);
      }
    }

    // Clean up flow card listeners
    this.unregisterAllFlowCards();

    // Reset connection state
    this.tuyaConnected = false;
    this.tuya = undefined;
  }
}

module.exports = MyDevice;
