/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';
import PairSession from 'homey/lib/PairSession';
import { AdlarMapping } from '../../lib/definitions/adlar-mapping';

const {
  customCapabilities,
  capabilities,
  adlarCapabilities,
  allArraysSwapped,
  dps,
} = AdlarMapping;

class MyDriver extends Homey.Driver {

  capabilities!: string[];
  customCapabilities!: Record<string, unknown>;
  dps!: Record<string, unknown>;
  adlarCapabilities!: Record<string, unknown>;
  allArraysSwapped!: unknown;

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('MyDriver is initializing...');
    this.capabilities = Object.keys(capabilities);
    this.customCapabilities = customCapabilities;
    this.dps = dps;
    this.adlarCapabilities = adlarCapabilities;
    this.allArraysSwapped = allArraysSwapped;

    // Register capabilities from driver.compose.json
    this.log('MyDriver has been initialized');
  }

  /**
   * Returns a list of devices available for pairing.
   * The user will select one of these devices.
   */
  // async onPairListDevices() {
  //   // Return devices with a placeholder id; will be replaced after user input
  //   return [
  //     {
  //       name: 'Aurora series',
  //       data: { id: 'ZNRB-Device' },
  //     },
  //   ];
  // }

  async onRepair(session: PairSession) {
    let deviceCredentials: { deviceId: string; localKey: string; ipAddress: string } | null = null;

    this.log('Repair session started');

    // Step 1: Show the repair view to update device credentials
    session.setHandler('enter_device_info', async (data: { deviceId: string; localKey: string; ipAddress: string }) => {
      // Store the updated credentials for later use
      deviceCredentials = data;
      return true;
    });

    // Received when a view has changed
    session.setHandler('showView', async (viewId: unknown) => {
      this.log(`Repair View: ${viewId}`);
    });

    // Step 2: Apply the updated credentials
    session.setHandler('update_device', async (device: { setSettings: (settings: Record<string, unknown>) => Promise<void>; setStoreValue: (key: string, value: unknown) => Promise<void> }) => {
      if (!deviceCredentials) {
        throw new Error('Device credentials not provided during repair');
      }

      // Update device settings with new credentials
      await device.setSettings({
        device_id: deviceCredentials.deviceId,
        local_key: deviceCredentials.localKey,
        ip_address: deviceCredentials.ipAddress,
      });

      // Update store data for internal use
      await device.setStoreValue('device_id', deviceCredentials.deviceId);
      await device.setStoreValue('local_key', deviceCredentials.localKey);
      await device.setStoreValue('ip_address', deviceCredentials.ipAddress);

      this.log(`Device repaired with new credentials: ${deviceCredentials.deviceId} @ ${deviceCredentials.ipAddress}`);
      return true;
    });
  }

  async onPair(session: PairSession) {
    let deviceCredentials: { deviceId: string; localKey: string; ipAddress: string } | null = null;

    this.log('Pairing session started');

    // Step 1: Show the custom view to input device credentials
    session.setHandler('enter_device_info', async (data: { deviceId: string; localKey: string; ipAddress: string }) => {
      // Store the credentials for later use
      deviceCredentials = data;
      return true;
    });

    // Received when a view has changed
    session.setHandler('showView', async (viewId: unknown) => {
      this.log(`View: ${viewId}`);
    });

    // Step 2: List the discovered device
    session.setHandler('list_devices', async () => {
      if (!deviceCredentials) {
        throw new Error('Device credentials not provided');
      }

      return [
        {
          name: 'Intelligent Heat Pump',
          data: {
            id: deviceCredentials.deviceId,
          },
          store: {
            device_id: deviceCredentials.deviceId,
            local_key: deviceCredentials.localKey,
            ip_address: deviceCredentials.ipAddress,
          },
          settings: {
            device_id: deviceCredentials.deviceId,
            local_key: deviceCredentials.localKey,
            ip_address: deviceCredentials.ipAddress,
          },
        },
      ];
    });

    // Step 3: Finalize the registration of the device
    session.setHandler('add_devices', async (devices: Array<{ data: { id: string } }>) => {
      if (!devices || devices.length === 0) {
        throw new Error('No devices selected for registration');
      }

      // Perform any additional setup or validation here if needed
      this.log(`Device registered: ${devices[0].data.id}`);
      return true;
    });
  }
}
module.exports = MyDriver;
