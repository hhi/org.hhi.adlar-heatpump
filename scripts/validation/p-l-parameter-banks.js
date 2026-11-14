'use strict';

const data = require('../../test/fixtures/modbus/p-l-433-143.json');
// eslint-disable-next-line node/no-unpublished-require
const definitions = require('../../.homeybuild/lib/modbus/protocol/adlar-modbus-registers');

const signed = (raw) => (raw > 0x7FFF ? raw - 0x10000 : raw);
const live = new Map([
  ...Object.values(definitions.P_PARAMETERS),
  ...Object.values(definitions.P_PARAMETERS_EXTRA),
  ...Object.values(definitions.P_WORKING_CONDITIONS),
  ...Object.values(definitions.L_PARAMETERS),
].map((def) => [def.address, def]));

function compare(prefix, baseline = true) {
  const rows = data.parameters.filter((p) => p.parameter.startsWith(prefix) && p.baselineKey);
  const different = rows.filter((p) => {
    const range = baseline ? p.baselineRange : live.get(p.address);
    return range?.min !== signed(p.minRaw) || range?.max !== signed(p.maxRaw);
  });
  return { compared: rows.length, equal: rows.length - different.length, differences: different.map((p) => p.parameter) };
}

function alignment(prefix, shift = 0, swapped = false) {
  const rows = data.parameters.filter((p) => p.parameter.startsWith(prefix));
  const bank = new Map(rows.map((p) => [p.address, p]));
  return rows.filter((p) => {
    if (p.baselineRange.min === null || p.baselineRange.max === null) return false;
    const other = bank.get(p.address + shift);
    return other && p.baselineRange.min === signed(other[swapped ? 'maxRaw' : 'minRaw'])
      && p.baselineRange.max === signed(other[swapped ? 'minRaw' : 'maxRaw']);
  }).length;
}

function rangeDirections(prefix) {
  const directions = {
    wider: 0, narrower: 0, shifted: 0, missingBaseline: 0,
  };
  for (const p of data.parameters.filter((row) => row.parameter.startsWith(prefix) && row.baselineKey)) {
    const { min, max } = p.baselineRange;
    const measuredMin = signed(p.minRaw);
    const measuredMax = signed(p.maxRaw);
    if (min === measuredMin && max === measuredMax) continue;
    if (min === null || max === null) directions.missingBaseline++;
    else if (measuredMin <= min && measuredMax >= max) directions.wider++;
    else if (measuredMin >= min && measuredMax <= max) directions.narrower++;
    else directions.shifted++;
  }
  return directions;
}

function report() {
  return {
    device: data.device,
    baselineCommit: data.baseline.commit,
    baseline: { P: compare('P'), L: compare('L') },
    current: { P: compare('P', false), L: compare('L', false) },
    alignment: {
      P: {
        exact: alignment('P'), minusOne: alignment('P', -1), plusOne: alignment('P', 1), swapped: alignment('P', 0, true),
      },
      L: { exact: alignment('L') },
    },
    directions: { P: rangeDirections('P'), L: rangeDirections('L') },
    writeLimitsEnforced: data.measurement.writeLimitsEnforced,
  };
}

module.exports = { report, signed };
if (require.main === module) process.stdout.write(`${JSON.stringify(report(), null, 2)}\n`);
