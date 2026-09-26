/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';
import PairSession from 'homey/lib/PairSession';

interface ModbusCredentials {
  host: string;
  port: number;
  unitId: number;
}

class ModbusDriver extends Homey.Driver {

  async onInit() {
    this.log('Adlar Modbus driver initialized');
  }

  async onPair(session: PairSession) {
    let credentials: ModbusCredentials | null = null;

    this.log('Pairing session started');

    session.setHandler('enter_modbus_info', async (data: { host: string; port: string; unitId: string }) => {
      const port = parseInt(data.port, 10) || 502;
      const unitId = parseInt(data.unitId, 10) || 1;

      if (!data.host || data.host.trim() === '') {
        throw new Error('IP address is required');
      }

      credentials = {
        host: data.host.trim(),
        port,
        unitId,
      };

      this.log(`Pairing: ${credentials.host}:${credentials.port} unit=${credentials.unitId}`);
      return true;
    });

    session.setHandler('showView', async (viewId: unknown) => {
      this.log(`View: ${viewId}`);
    });

    session.setHandler('list_devices', async () => {
      if (!credentials) {
        throw new Error('Modbus connection details not provided');
      }

      return [
        {
          name: `Aurora I/II Modbus (${credentials.host})`,
          data: {
            id: `modbus-${credentials.host}-${credentials.unitId}`,
          },
          settings: {
            modbus_host: credentials.host,
            modbus_port: credentials.port,
            modbus_unit_id: credentials.unitId,
            poll_superfast_s: 5,
            poll_superfast_adaptive: true,
            poll_fast_s: 10,
            poll_medium_s: 30,
            poll_slow_s: 300,
            log_level: 'error',
          },
        },
      ];
    });

    session.setHandler('add_devices', async (devices: Array<{ data: { id: string } }>) => {
      if (!devices || devices.length === 0) {
        throw new Error('No devices selected');
      }
      this.log(`Device registered: ${devices[0].data.id}`);
      return true;
    });
  }
}

module.exports = ModbusDriver;
