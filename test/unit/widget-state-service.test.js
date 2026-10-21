/**
 * Live operation widget (v3.3.0): Tuya state contract, connection codes and the
 * Aurora II regulation codes that the widget turns into text.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const tuya = require('../../.homeybuild/lib/tuya/services/widget-state-service');
const aurora2 = require('../../.homeybuild/lib/modbus/services/widget-state-service');
const { connectionStateFromStatus } = require('../../.homeybuild/lib/shared/widget-state-common');

function device(caps) {
  return {
    hasCapability: (id) => Object.prototype.hasOwnProperty.call(caps, id),
    getCapabilityValue: (id) => caps[id],
    getName: () => 'Heat pump',
  };
}

const TUYA_CAPS = {
  'measure_temperature.temp_bottom': 36,
  'measure_temperature.temp_top': 31.5,
  'measure_temperature.around_temp': 7,
  'measure_temperature.around_temp_f': 48.5,
  target_temperature: 37,
  'measure_frequency.compressor_strength': 61,
  measure_power: 1500,
  measure_water: 17,
  adlar_cop: 3.4,
  adlar_state_defrost_state: false,
  adlar_state_compressor_state: true,
  adlar_fault: 0,
  adlar_enum_mode: 'heating',
  onoff: true,
  adlar_connection_status: 'Verbonden (14:25:03)',
};

test('Tuya: maps capabilities onto the shared widget contract', () => {
  const now = Date.now();
  const state = tuya.buildLiveOperationWidgetState({
    device: device(TUYA_CAPS), connected: true, lastDataAt: now - 30_000,
  });

  assert.strictEqual(state.source, 'tuya');
  assert.strictEqual(state.status.mode, 'heating');
  assert.strictEqual(state.status.faultActive, '');
  assert.strictEqual(state.status.connectionState, 'online');
  assert.deepStrictEqual(state.temperatures, {
    outletC: 36, inletC: 31.5, ambientC: 7, dhwC: 48.5, bufferC: null, setpointC: 37,
  });
  assert.strictEqual(state.process.electricalPowerKw, 1.5);
  assert.strictEqual(state.process.thermalPowerKw, 5.34);
  assert.strictEqual(state.process.liveCopEstimate, 3.6);
  assert.strictEqual(state.process.compressorHz, 61);
  assert.strictEqual(state.process.flowSource, 'capability');
  assert.strictEqual(state.process.powerSource, 'capability');
  assert.strictEqual(state.data.freshness, 'fresh');
  assert.ok(state.data.ageMs >= 30_000 && state.data.ageMs < 31_000);
});

test('Tuya: no data yet, fault code, external flow and defrost', () => {
  const state = tuya.buildLiveOperationWidgetState({
    device: device({
      ...TUYA_CAPS, adlar_fault: 4, adlar_external_flow: 20, adlar_state_defrost_state: true,
    }),
    connected: null,
    lastDataAt: null,
  });

  assert.strictEqual(state.status.faultActive, '4');
  assert.strictEqual(state.status.connectionState, 'unknown');
  assert.strictEqual(state.data.ageMs, null);
  assert.strictEqual(state.data.freshness, 'no_data');
  assert.strictEqual(state.process.flowSource, 'external');
  assert.strictEqual(state.process.thermalPowerKw, 0);
  assert.strictEqual(state.process.liveCopEstimate, null);
});

test('connection status strings map to codes', () => {
  assert.strictEqual(connectionStateFromStatus('Connected: 3-Oct 14:25'), 'online');
  assert.strictEqual(connectionStateFromStatus('Disconnected: 3-Oct 14:25 (timeout)'), 'offline');
  assert.strictEqual(connectionStateFromStatus('online'), 'online');
  assert.strictEqual(connectionStateFromStatus('degraded'), 'degraded');
  assert.strictEqual(connectionStateFromStatus(''), 'unknown');
  assert.strictEqual(connectionStateFromStatus(null), 'unknown');
});

test('Aurora II: regulation delivers codes and numbers, no text', () => {
  const state = aurora2.buildLiveOperationWidgetState({
    device: device({ adlar_connection_status: 'Connected: 3-Oct 14:25' }),
    snapshot: {
      ts: Date.now(),
      sourcePollGroup: 'fast',
      sensors: { outletT7: { value: 35 }, inletT6: { value: 30 } },
      control: {
        mode: 1, modeName: 'Heating', tempControlMode: 0, acReturnDiffC: 2, heatingSetpointC: 33,
      },
      status: { running: true, compressorOn: true, defrosting: false, activeFaults: [] },
      diagnostics: { connectionQuality: 'online' },
      power: {},
      cop: {},
    },
  });

  assert.strictEqual(state.source, 'aurora2');
  assert.strictEqual(state.status.connectionState, 'online');
  assert.deepStrictEqual(state.regulation, {
    mode: 'Heating',
    sensor: 'return',
    hysteresisC: 2,
    hysteresisSource: 'P26',
    activeSetpointC: 33,
    setpointDeviationC: -3,
  });

  const empty = aurora2.buildLiveOperationWidgetState({ device: device({}), snapshot: null });
  assert.strictEqual(empty.status.mode, null);
  assert.strictEqual(empty.regulation.sensor, null);
  assert.strictEqual(empty.regulation.hysteresisSource, null);
});
