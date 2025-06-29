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

  async onPair(session: PairSession) {
    let deviceCredentials: { deviceId: string; localKey: string } | null = null;

    // Step 1: Show the custom view to input device credentials
    session.showView('enter_device_info');
    session.setHandler('enter_device_info', async (data: { deviceId: string; localKey: string }) => {
      // Store the credentials for later use
      deviceCredentials = data;
      return true;
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
