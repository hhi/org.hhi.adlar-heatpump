/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import assert from 'assert';

import {
  CONTROL_REGISTERS,
  HvacMode,
  SENSOR_REGISTERS,
  STATUS_BITS,
  cop,
  decodeS16,
  statusBitSet,
  thermalPowerKw,
} from '../../lib/aurora3/protocol/adlar3-modbus-registers';
import { COPCalculator } from '../../lib/aurora3/services/cop-calculator';

assert.strictEqual(decodeS16(0x0000), 0);
assert.strictEqual(decodeS16(0x00FA), 250);
assert.strictEqual(decodeS16(0xFF9C), -100);

assert.strictEqual(SENSOR_REGISTERS.outletWaterTemp.address, 43);
assert.strictEqual(SENSOR_REGISTERS.outletWaterTemp.fc, 'input');
assert.strictEqual(SENSOR_REGISTERS.inletWaterTemp.address, 42);
assert.strictEqual(SENSOR_REGISTERS.inletWaterTemp.fc, 'input');
assert.strictEqual(SENSOR_REGISTERS.waterFlow.unit, 'm³/h');
assert.strictEqual(SENSOR_REGISTERS.waterFlow.multiply, 0.1);

assert.strictEqual(CONTROL_REGISTERS.zone1HeatingSetTemp.address, 2107);
assert.strictEqual(CONTROL_REGISTERS.zone1HeatingSetTemp.fc, 'holding');
assert.strictEqual(CONTROL_REGISTERS.zone1HeatingSetTemp.multiply, 0.1);
assert.strictEqual(CONTROL_REGISTERS.zone1AutoHeatingSetTemp.address, 2109);

assert.strictEqual(HvacMode.Cool, 1);
assert.strictEqual(HvacMode.Heat, 2);
assert.strictEqual(HvacMode.Auto, 4);

assert.strictEqual(statusBitSet(STATUS_BITS.DEFROST, STATUS_BITS.DEFROST), true);
assert.strictEqual(statusBitSet(0, STATUS_BITS.DEFROST), false);

const thermal = thermalPowerKw(1.2, 5);
assert.strictEqual(Number(thermal.toFixed(3)), 6.978);
assert.strictEqual(Number(cop(thermal, 1800)?.toFixed(2)), 3.88);
assert.strictEqual(cop(thermal, 40), null);

const directCop = COPCalculator.calculateCOP({
  electricalPower: 2000,
  waterFlowRate: 20,
  inletTemperature: 30,
  outletTemperature: 35,
  compressorFrequency: 40,
}, { forceMethod: 'direct_thermal' });
assert.strictEqual(directCop.method, 'direct_thermal');
assert(directCop.cop > 0, `Expected positive COP for supply > return, got ${directCop.cop}`);
assert.strictEqual(Number(directCop.cop.toFixed(2)), 3.49);

console.log('Adlar III register checks passed');
