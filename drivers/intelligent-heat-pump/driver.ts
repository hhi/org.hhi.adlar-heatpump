import Homey from 'homey';
import custom_capabilities from './settings/adlar_mapping';
import capabilities from './settings/adlar_mapping';
import dps from './settings/adlar_mapping';

module.exports = class MyDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('MyDriver is initializing...');
    this.capabilities = capabilities;
    this.custom_capabilities = custom_capabilities;
    this.dps = dps;

    // Register capabilities from driver.compose.json
    this.log('MyDriver has been initialized');
  }

  /**
   * Returns a list of devices available for pairing.
   * The user will select one of these devices.
   */
  async onPairListDevices() {
    // Return devices with a placeholder id; will be replaced after user input
    return [
      {
        name: 'Aurora series',
        data: { id: 'ZNRB-Device' },
      }
    ];
  }

  /**
   * Handles the data entered by the user after device selection.
   * Stores device_id and local_key in the session for the selected device.
   * Updates device.data.id with the entered device_id.
   */
  async onPairViewEnterDeviceInfo({ data, session, device }) {
    // Set the actual device_id as the data.id value
    if (device && device.data) {
      device.data.id = data.device_id;
    }
    session.setStore({
      device_id: data.device_id,
      local_key: data.local_key,
      selected_device: device, // optional, for reference
    });
    return {};
  }

};
