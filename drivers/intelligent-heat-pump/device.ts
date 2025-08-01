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
  flow_advanced_mode: boolean;
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
      flow_advanced_mode: this.getSetting('flow_advanced_mode') || false,
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
        if (value !== null && value !== undefined) {
          capabilitiesWithData.push(capability);
          this.debugLog(`Capability ${capability} has data:`, value);
        }
      } catch (err) {
        this.debugLog(`Capability ${capability} not available:`, err);
      }
    }

    return capabilitiesWithData;
  }

  /**
   * Determine if a category should register flow cards based on combined logic
   */
  private shouldRegisterCategory(
    category: keyof CapabilityCategories,
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
      // Find the capability key for this dpsId
      const capability = allArraysSwapped[Number(dpsId)];
      this.debugLog('Found capability for dpsId', dpsId, ':', capability);
      if (capability) {
        // Check for critical conditions before updating
        this.checkForCriticalConditions(capability, value).catch((err) => this.error('Error checking critical conditions:', err));
        // Update the capability value in Homey
        this.setCapabilityValue(capability, (value as boolean | number | string))
          .then(() => this.debugLog(`Updated ${capability} to`, String(value)))
          .catch((err) => this.error(`Failed to update ${capability}:`, err));
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

      // Advanced mode flow cards
      if (userPrefs.flow_advanced_mode) {
        await this.registerAdvancedFlowCards();
      }

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

    try {
      switch (category) {
        case 'temperature':
          await this.registerTemperatureFlowCards(availableCaps);
          break;
        case 'voltage':
          await this.registerVoltageFlowCards(availableCaps);
          break;
        case 'current':
          await this.registerCurrentFlowCards(availableCaps);
          break;
        case 'power':
          await this.registerPowerFlowCards(availableCaps);
          break;
        case 'pulseSteps':
          await this.registerPulseStepsFlowCards(availableCaps);
          break;
        case 'states':
          await this.registerStateFlowCards(availableCaps);
          break;
        default:
          this.log(`Unknown category: ${category}`);
          break;
      }
    } catch (error) {
      this.error(`Error registering ${category} flow cards:`, error);
    }
  }

  /**
   * Register temperature-related flow cards
   */
  private async registerTemperatureFlowCards(availableCaps: string[]): Promise<void> {
    try {
      // Temperature threshold condition
      if (availableCaps.some((cap) => cap.includes('temp'))) {
        const tempThresholdCard = this.homey.flow.getConditionCard('temperature_above_threshold');
        const tempListener = tempThresholdCard.registerRunListener(async (args) => {
          const sensorCap = `measure_temperature.${args.sensor || 'around_temp'}`;
          if (this.hasCapability(sensorCap)) {
            const currentTemp = this.getCapabilityValue(sensorCap) || 0;
            return currentTemp > (args.threshold || 25);
          }
          return false;
        });
        this.flowCardListeners.set('temperature_above_threshold', tempListener);
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
      // Voltage range condition
      if (availableCaps.some((cap) => cap.includes('voltage'))) {
        const voltageRangeCard = this.homey.flow.getConditionCard('voltage_in_range');
        const voltageListener = voltageRangeCard.registerRunListener(async (args) => {
          const phaseCap = `measure_voltage.${args.phase || 'voltage_current'}`;
          if (this.hasCapability(phaseCap)) {
            const currentVoltage = this.getCapabilityValue(phaseCap) || 0;
            const minVoltage = args.min_voltage || 200;
            const maxVoltage = args.max_voltage || 250;
            return currentVoltage >= minVoltage && currentVoltage <= maxVoltage;
          }
          return false;
        });
        this.flowCardListeners.set('voltage_in_range', voltageListener);
      }

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
      // Current threshold condition
      if (availableCaps.some((cap) => cap.includes('current'))) {
        const currentThresholdCard = this.homey.flow.getConditionCard('current_above_threshold');
        const currentListener = currentThresholdCard.registerRunListener(async (args) => {
          const phaseCap = `measure_current.${args.phase || 'cur_current'}`;
          if (this.hasCapability(phaseCap)) {
            const currentAmperage = this.getCapabilityValue(phaseCap) || 0;
            return currentAmperage > (args.threshold || 10);
          }
          return false;
        });
        this.flowCardListeners.set('current_above_threshold', currentListener);
      }

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
          const currentPower = this.getCapabilityValue('measure_power') || 0;
          return currentPower > (args.threshold || 1000);
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
          const valve = args.valve || 'temp_current';
          const capability = valve === 'temp_current' ? 'adlar_measure_pulse_steps_temp_current' : 'adlar_measure_pulse_steps_effluent_temp';

          if (this.hasCapability(capability)) {
            const pulseSteps = this.getCapabilityValue(capability) || 0;
            const minSteps = args.min_steps || 10;
            const maxSteps = args.max_steps || 450;
            return pulseSteps >= minSteps && pulseSteps <= maxSteps;
          }
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
          const stateType = args.state_type || 'compressor_state';
          const capability = `adlar_state_${stateType}`;

          if (this.hasCapability(capability)) {
            const currentState = this.getCapabilityValue(capability) || 0;
            return currentState === (args.expected_state || 1);
          }
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
   * Register advanced flow cards (when advanced mode is enabled)
   */
  private async registerAdvancedFlowCards(): Promise<void> {
    try {
      // Advanced efficiency condition
      const efficiencyCard = this.homey.flow.getConditionCard('compressor_efficiency_above');
      const efficiencyListener = efficiencyCard.registerRunListener(async (args) => {
        const power = this.getCapabilityValue('measure_power') || 0;
        const compressorState = this.getCapabilityValue('adlar_state_compressor_state') || 0;
        const efficiency = compressorState > 0 && power > 0 ? (compressorState / power) * 100 : 0;
        return efficiency > (args.threshold || 50);
      });
      this.flowCardListeners.set('compressor_efficiency_above', efficiencyListener);

      // Advanced trigger cards
      const advancedTriggerCards = [
        'compressor_efficiency_alert',
        'fan_motor_efficiency_alert',
        'water_flow_alert',
      ];

      advancedTriggerCards.forEach((cardId) => {
        try {
          const triggerCard = this.homey.flow.getDeviceTriggerCard(cardId);
          this.flowCardListeners.set(cardId, triggerCard);
        } catch (err) {
          this.log(`Advanced trigger card ${cardId} not found, skipping`);
        }
      });

      this.log('Advanced flow cards registered');
    } catch (error) {
      this.error('Error registering advanced flow cards:', error);
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
    this.debugLog('Setable built-in capabilities from driver manifest:', setableBuiltInCapsKeys); // Output: []

    const setableCustomCapsKeys = Object.keys(manifest.capabilities).filter(
      (key) => manifest.capabilities[key].setable === true,
    );
    this.debugLog('Setable custom capabilities from app manifest:', setableCustomCapsKeys); // Output: []

    this.settableCapabilities = [...setableBuiltInCapsKeys, ...setableCustomCapsKeys];
    this.debugLog('Setable capabilities:', this.settableCapabilities); // Output: []

    // Register a single duty listener for all capabilities (from capability name to dp i)
    this.settableCapabilities.forEach((capability: string) => {
      this.debugLog(`Registering capability listener for ${capability}`);
      this.registerCapabilityListener(capability, async (value, opts) => {
        this.log(`${capability} set to`, value);

        // Map capability to Tuya DP (data point)
        const dpArray = this.allCapabilities[capability];
        const dp = Array.isArray(dpArray) ? dpArray[0] : undefined;
        if (dp !== undefined) {
          try {
            await this.connectTuya();
            if (this.tuya) {
              await this.tuya.set({ dps: dp, set: value });
              this.log(`Sent to Tuya: dp ${dp} = ${value}`);
            } else {
              this.error('Tuya device is not initialized');
              throw new Error('Tuya device is not initialized');
            }
          } catch (err) {
            this.error(`Failed to send to Tuya: ${err}`);
            throw new Error('Failed to update device');
          }
        }
      });
    });

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

    return undefined;
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('MyDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('MyDevice has been deleted');

    // Stop reconnection interval
    this.stopReconnectInterval();

    if (this.tuya) {
      try {
        // Remove all event listeners to prevent memory leaks
        this.tuya.removeAllListeners();

        // Disconnect if connected
        if (this.tuyaConnected) {
          await this.tuya.disconnect();
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
