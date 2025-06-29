import { Driver } from 'homey';

class ThermostatDriver extends Driver {
  async onInit(): Promise<void> {
    this.log('Thermostat driver has been initialized');
  }

  async onPair(session: any): Promise<void> {
    session.setHandler('validate_input', async (data: { input: string }) => {
      if (data.input === 'YES') {
        return true;
      } else {
        throw new Error('Invalid input. Please enter "YES".');
      }
    });
  }
}

module.exports = ThermostatDriver;
