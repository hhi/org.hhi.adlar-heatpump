'use strict';

module.exports = {
  async getState({ homey, query }) {
    const deviceId = typeof query.deviceId === 'string' ? query.deviceId : undefined;
    return homey.app.getAdlarLiveOperationWidgetState(deviceId);
  },
};
