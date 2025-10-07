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

  async onRepair(session: PairSession, device: Homey.Device) {
    this.log('Repair session started for device:', device.getName());

    // Handler for when user submits updated credentials
    session.setHandler('enter_device_info', async (data: { deviceId: string; localKey: string; ipAddress: string; protocolVersion: string }) => {
      this.log('Repair: Received updated credentials');

      try {
        // Update device settings with new credentials
        await device.setSettings({
          device_id: data.deviceId,
          local_key: data.localKey,
          ip_address: data.ipAddress,
          protocol_version: data.protocolVersion || '3.3',
        });

        // Update store data for internal use
        await device.setStoreValue('device_id', data.deviceId);
        await device.setStoreValue('local_key', data.localKey);
        await device.setStoreValue('ip_address', data.ipAddress);
        await device.setStoreValue('protocol_version', data.protocolVersion || '3.3');

        this.log(`Device repaired successfully: ${data.deviceId} @ ${data.ipAddress} (Protocol: ${data.protocolVersion || '3.3'})`);

        // Return true to indicate success and close repair flow
        return true;

      } catch (error) {
        this.error('Repair failed:', error);
        throw new Error(`Failed to update device credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Optional: Log view changes for debugging
    session.setHandler('showView', async (viewId: unknown) => {
      this.log(`Repair View: ${viewId}`);
    });

    // CRITICAL: Show the repair view to the user
    await session.showView('enter_device_info');
  }

  async onPair(session: PairSession) {
    let deviceCredentials: { deviceId: string; localKey: string; ipAddress: string; protocolVersion: string } | null = null;

    this.log('Pairing session started');

    // Step 1: Show the custom view to input device credentials
    session.setHandler('enter_device_info', async (data: { deviceId: string; localKey: string; ipAddress: string; protocolVersion: string }) => {
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
            protocol_version: deviceCredentials.protocolVersion || '3.3',
          },
          settings: {
            device_id: deviceCredentials.deviceId,
            local_key: deviceCredentials.localKey,
            ip_address: deviceCredentials.ipAddress,
            protocol_version: deviceCredentials.protocolVersion || '3.3',
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
