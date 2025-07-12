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

  private capabilitiesArray: string[] = (manifest.capabilities || [])


  async connectTuya() {
    if (!this.tuyaConnected) {
      try {
        // Discover the device on the network first
        if (this.tuya) {
          await this.tuya.find();
          // Then connect to the device
          await this.tuya.connect();
          this.tuyaConnected = true;
          this.log('Connected to Tuya device');
        } else {
          throw new Error('Tuya device is not initialized');
        }
      } catch (err) {
        this.error('Failed to find or connect to Tuya device:', err);
        throw new Error('Could not find or connect to device');
      }
    }
    this.homey.setTimeout(async () => {
      await this.connectTuya();
    }, 20000);
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
      this.log('Found capability for dpsId', dpsId, ':', capability);
      if (capability) {
        // Update the capability value in Homey
        this.setCapabilityValue(capability, (value as boolean | number | string))
          .then(() => this.log(`Updated ${capability} to`, String(value)))
          .catch((err) => this.error(`Failed to update ${capability}:`, err));
      }
    });
  }

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('MyDevice has been initialized');
    await this.setUnavailable(); // Set the device as unavailable initially

    const { manifest } = Homey;
    const myDriver = manifest.drivers[0];
    // this.log('MyDevice overview:', myDriver);

    const capList = myDriver.capabilities;
    // this.log('Capabilities list:', capList);

    const builtinCapOptList = myDriver.capabilitiesOptions || {};
    this.log('Capabilities options list:', builtinCapOptList);

    // Extract keys where `setable` exists and is `true`
    const setableBuiltInCapsKeys = Object.keys(builtinCapOptList).filter(
      (key) => builtinCapOptList[key].setable === true,
    );
    this.log('Setable built-in capabilities from driver manifest:', setableBuiltInCapsKeys); // Output: []

    const setableCustomCapsKeys = Object.keys(manifest.capabilities).filter(
      (key) => manifest.capabilities[key].setable === true,
    );
    this.log('Setable custom capabilities from app manifest:', setableCustomCapsKeys); // Output: []

    this.settableCapabilities = [...setableBuiltInCapsKeys, ...setableCustomCapsKeys];
    this.log('Setable capabilities:', this.settableCapabilities); // Output: []

    // Register a single duty listener for all capabilities (from capability name to dp i)
    this.settableCapabilities.forEach((capability: string) => {
      this.log(`Registering capability listener for ${capability}`);
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
    if (this.tuya && this.tuyaConnected) {
      try {
        await this.tuya.disconnect();
        this.log('Disconnected from Tuya device');
      } catch (err) {
        this.error('Error disconnecting from Tuya device:', err);
      }
    }
  }
}

module.exports = MyDevice;
