/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey, { manifest } from 'homey';
import TuyaDevice from 'tuyapi';
import { AdlarMapping } from '../../lib/definitions/adlar-mapping';

// Extract allCapabilities and allArraysSwapped from AdlarMapping
const { allCapabilities, allArraysSwapped } = AdlarMapping;

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
    // System fault detection
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
      'measure_temperature.temp_top': 'coiler_temperature_alert',
      'measure_temperature.temp_bottom': 'incoiler_temperature_alert',
      'measure_temperature.ambient_temp': 'tank_temperature_alert',
      'measure_temperature.suction_temp': 'suction_temperature_alert',
      'measure_temperature.discharge_temp': 'discharge_temperature_alert',
      'measure_temperature.economizer_inlet_temp': 'economizer_inlet_temperature_alert',
      'measure_temperature.economizer_outlet_temp': 'economizer_outlet_temperature_alert',
      'measure_temperature.high_pressure_sensor_temp': 'high_pressure_temperature_alert',
      'measure_temperature.low_pressure_sensor_temp': 'low_pressure_temperature_alert',
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
      'measure_voltage.voltage_a': 'phase_a_voltage_alert',
      'measure_voltage.voltage_b': 'phase_b_voltage_alert',
      'measure_voltage.voltage_c': 'phase_c_voltage_alert',
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
   * Helper method to trigger flow cards safely
   */
  private async triggerFlowCard(cardId: string, tokens: Record<string, unknown>) {
    try {
      const app = this.homey.app as unknown as { [key: string]: { trigger?: (device: unknown, tokens: unknown) => Promise<void> } };
      const triggerName = `${cardId.replace(/_/g, '')}Trigger`;

      if (app[triggerName]?.trigger) {
        await app[triggerName].trigger(this, tokens);
        this.debugLog(`Triggered flow card: ${cardId}`, tokens);
      } else {
        this.debugLog(`Flow card trigger not found: ${triggerName}`);
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
    this.log('MyDevice settings where changed');
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

    // Reset connection state
    this.tuyaConnected = false;
    this.tuya = undefined;
  }
}

module.exports = MyDevice;
