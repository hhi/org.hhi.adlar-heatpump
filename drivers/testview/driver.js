'use strict';

const Homey = require('homey');

module.exports = class TestViewDriver extends Homey.Driver {
  onPairListDevices(data, callback) {
    const deviceName = data.name || 'Unnamed Device';
    const device = {
      name: deviceName,
      data: {
        id: deviceName.toLowerCase().replace(/\s+/g, '_')
      },
      capabilities: ['measure_temperature']
    };
    callback(null, [device]);
  }
};
