import Homey from 'homey';
import TuyaDevice from 'tuyapi';
import { AdlarMapping } from '../../lib/definitions/adlar-mapping';

class MyDevice extends Homey.Device {
  tuya: TuyaDevice | undefined;
  tuyaConnected: boolean = false;

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
  }

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('MyDevice has been initialized');

    // Get Tuya device settings from Homey
    const id = this.getStoreValue('device_id');
    const key = this.getStoreValue('local_key');
    const ip = this.getStoreValue('ip_address');

    const version = '3.3';

    // Initialize TuyaDevice
    this.tuya = new TuyaDevice({ id, key, ip, version });

    // Connect once at startup
    await this.connectTuya();

    // Flatten the capabilities object to get all capability keys
    const { allCapabilities } = AdlarMapping;
    const capabilityKeys = Object.keys(allCapabilities);

    // Register a single listener for all capabilities
    capabilityKeys.forEach((capability) => {
      this.registerCapabilityListener(capability, async (value, opts) => {
        this.log(`${capability} set to`, value);

        // Map capability to Tuya DP (data point)
        const dpArray = allCapabilities[capability];
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

    // Example: Listen for state updates from the Tuya device
    this.tuya.on('data', (data: { dps: Record<number, unknown> }): void => {
      // Suppose data contains updated values, e.g., { dps: { 1: true, 4: 22 } }
      const dpsFetched = data.dps || {};
      Object.entries(dpsFetched).forEach(([dpsId, value]) => {
        // Find the capability key for this dpsId
        const capability = Object.keys(allCapabilities).find(
          (key) => allCapabilities[key][0] === Number(dpsId),
        );
        if (capability) {
          // Update the capability value in Homey
          this.setCapabilityValue(capability, value)
            .then(() => this.log(`Updated ${capability} to`, value))
            .catch((err) => this.error(`Failed to update ${capability}:`, err));
        }
      });
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
