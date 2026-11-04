/**
 * Tests for the Aurora I/II running status (R16): Running Status 1 (0x0000) bit 14 MACHINE_RUN
 * is not set by every firmware, so `running` falls back to the compressor frequency (0x0040).
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'homey') return {};
  return originalLoad.call(this, request, parent, isMain);
};

const { Adlar2ModbusService } = require('../../.homeybuild/lib/modbus/protocol/adlar2-modbus-service');
const { STATUS_1_BITS } = require('../../.homeybuild/lib/modbus/protocol/adlar-modbus-registers');

function statusFor(status1, compressorFreq) {
  const service = new Adlar2ModbusService({ transport: { host: '127.0.0.1' } });
  const { cache } = service.tcp; // getRegisterCache() returns a copy on Aurora II
  cache.set(0x0000, status1);
  cache.set(0x0040, compressorFreq);
  return service.getSnapshot().status;
}

test('running follows MACHINE_RUN when the firmware sets it', () => {
  const status = statusFor(STATUS_1_BITS.MACHINE_RUN, 0);
  assert.strictEqual(status.running, true);
  assert.strictEqual(status.compressorOn, false);
});

test('running falls back to the compressor when MACHINE_RUN stays empty', () => {
  // Observed on 3-4 Nov: only bit 12 set while the compressor ran at 45 Hz.
  const status = statusFor(STATUS_1_BITS.CONST_TEMP_SHUTDOWN, 45);
  assert.strictEqual(status.running, true);
  assert.strictEqual(status.compressorOn, true);
});

test('running is false with MACHINE_RUN empty and the compressor off', () => {
  const status = statusFor(STATUS_1_BITS.CONST_TEMP_SHUTDOWN, 0);
  assert.strictEqual(status.running, false);
  assert.strictEqual(status.compressorOn, false);
});

test('defrosting still follows SYSTEM_DEFROST only', () => {
  assert.strictEqual(statusFor(0, 45).defrosting, false);
  assert.strictEqual(statusFor(STATUS_1_BITS.SYSTEM_DEFROST, 45).defrosting, true);
});
