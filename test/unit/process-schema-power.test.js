'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const driver of ['modbus', 'aurora3']) {
  const modulePath = path.join(__dirname, `../../.homeybuild/lib/${driver}/services/modbus-cop-service.js`);
  // Standalone apps contain only their own Modbus service.
  if (!fs.existsSync(modulePath)) continue;
  const { ModbusCOPService } = require(modulePath);
  const { DashboardService } = require(path.join(__dirname, `../../.homeybuild/lib/${driver}/services/dashboard-service.js`));

  test(`${driver}: expired external power and flow fall back, an explicit zero does not`, () => {
    let fresh = true;
    let externalPower = 1420;
    const service = Object.create(ModbusCOPService.prototype);
    service.device = {
      hasCapability: () => true,
      getSetting: () => true,
      getCapabilityValue: (id) => ({ adlar_external_power: externalPower, adlar_external_flow: 20 })[id],
      homey: { __: (key) => key },
    };
    service.isExternalCapabilityFresh = () => fresh;
    const snapshot = {
      power: { inputPowerKw: 0.49, derivedPowerKw: 0.49 },
      sensors: { waterFlow: { value: 17, unit: 'L/min' }, compRunningFreq: { value: 48 } },
      status: {},
      control: {},
    };
    assert.equal(service.gatherDeviceDataSources(snapshot).electricalPower, 1420);
    assert.equal(service.gatherDeviceDataSources(snapshot).waterFlowRate, 20);
    fresh = false;
    assert.equal(service.gatherDeviceDataSources(snapshot).electricalPower, 490);
    assert.equal(service.gatherDeviceDataSources(snapshot).waterFlowRate, 17);
    fresh = true;
    externalPower = 0;
    assert.equal(service.gatherDeviceDataSources(snapshot).electricalPower, 0);
    const values = {};
    service.processSnapshot(snapshot, (id, value) => {
      values[id] = value;
    });
    assert.equal(values.adlar_cop, null);
    assert.match(values.adlar_cop_method, /insufficient_data/);
  });

  test(`${driver}: outlier becomes unknown and does not enter COP averages`, () => {
    const service = Object.create(ModbusCOPService.prototype);
    service.device = {
      hasCapability: () => true,
      getSetting: () => true,
      getCapabilityValue: (id) => ({ adlar_external_power: 490, adlar_external_flow: 17 })[id],
      homey: { __: (key) => key },
    };
    service.isExternalCapabilityFresh = () => true;
    service.addCOPMeasurement = () => {
      throw new Error('Rejected measurement entered averages');
    };
    const values = {};
    service.processSnapshot({
      power: { inputPowerKw: 0.49, derivedPowerKw: 0.49 },
      sensors: {
        inletT6: { value: 25 },
        outletT7: { value: 30 },
        retourTE1: { value: 25 },
        aanvoerTA: { value: 30 },
        compRunningFreq: { value: 48 },
      },
      status: {},
      control: {},
    }, (id, value) => {
      values[id] = value;
    });
    assert.equal(values.adlar_cop, null);
    assert.equal(service.getCOPDiagnostic().rawCOP, 12.1);
    assert.equal(service.getCOPDiagnostic().acceptedCOP, null);
    assert.equal(service.getCOPDiagnostic().electricalPowerW, 490);
    assert.equal(service.getCOPDiagnostic().quality, 'outlier');
  });

  test(`${driver}: snapshot API exposes the same selected meter used by live state`, () => {
    const dashboard = new DashboardService({ appDir: path.join(__dirname, '../..'), logger() {} });
    const state = { process: { electricalPowerKw: 1.42, powerSource: 'external', capabilityCop: 4.18 } };
    dashboard.setGetLiveOperationStateCallback(() => state);
    dashboard.setSnapshot({
      ts: 1700000000000, sensors: {}, cop: {}, power: {},
    });
    let payload;
    dashboard._serveSnapshot({
      writeHead() {},
      end(value) {
        payload = JSON.parse(value);
      },
    });
    assert.deepEqual(payload.liveOperation, state);
    assert.ok(Array.isArray(payload.history));
  });
}

test('COP assessment keeps rejected measurements separate from valid data and an idle zero', () => {
  const { describeCOP } = require('../../.homeybuild/lib/shared/cop-diagnostics');
  const invalid = describeCOP({
    cop: 12.102, method: 'direct_thermal', isOutlier: true, outlierReason: 'check measurements',
  }, {
    electricalPower: 490, waterFlowRate: 17, inletTemperature: 25, outletTemperature: 30,
  });
  assert.equal(invalid.acceptedCOP, null);
  assert.equal(invalid.rawCOP, 12.1);
  assert.equal(invalid.deltaTC, 5);
  assert.equal(invalid.quality, 'outlier');
  assert.equal(describeCOP({ cop: 0, method: 'insufficient_data', isOutlier: false }).acceptedCOP, null);
  assert.equal(describeCOP({ cop: 0, method: 'idle_mode', isOutlier: false }).acceptedCOP, 0);
  assert.equal(describeCOP({ cop: 4.18, method: 'direct_thermal', isOutlier: false }).acceptedCOP, 4.18);
});
