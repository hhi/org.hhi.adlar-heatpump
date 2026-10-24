/**
 * Unit tests for cheapest/most expensive price block detection and the
 * hour labels in energy_prices_data.
 *
 * - Blocks may only cover consecutive clock hours; gaps in the price input
 *   (skipped or missing hour offsets) must never be bridged.
 * - Hour labels use Homey's timezone, not the (UTC) process timezone.
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

const { EnergyPriceOptimizer: ModbusOptimizer } = require('../../.homeybuild/lib/modbus/adaptive/energy-price-optimizer');
const { EnergyPriceOptimizer: TuyaOptimizer } = require('../../.homeybuild/lib/tuya/adaptive/energy-price-optimizer');
const { formatHourMinute, resolveHomeyTimezone } = require('../../.homeybuild/lib/shared/utils/time-format');
const { FlowCardManagerService } = require('../../.homeybuild/lib/modbus/services/flow-card-manager-service');

const HOUR_MS = 3600000;

function createOptimizer(OptimizerClass) {
  const optimizer = new OptimizerClass({
    thresholds: {
      veryLow: 0.04, low: 0.06, normal: 0.10, high: 0.12,
    },
    maxPreHeatOffset: 1.5,
    maxReduceOffset: 1.0,
    lookAheadHours: 4,
  });
  optimizer.setPriceMode('market'); // effective price = raw price
  return optimizer;
}

function offsetOf(optimizer, date) {
  const first = optimizer.getPriceData()[0].timestamp;
  return Math.round((date.getTime() - first) / HOUR_MS);
}

for (const [driver, OptimizerClass] of [['modbus', ModbusOptimizer], ['tuya', TuyaOptimizer]]) {
  test(`${driver}: cheapest block never bridges a gap in the price data`, () => {
    const optimizer = createOptimizer(OptimizerClass);
    // Offsets 2-7 and 9-15 missing; the isolated cheap hours 1, 8 and 16 sit between gaps
    optimizer.setExternalPrices({
      0: 0.10, 1: 0.01, 8: 0.01, 16: 0.01, 17: 0.01, 18: 0.20, 19: 0.20, 20: 0.20,
    });

    const block = optimizer.findCheapestBlock(4);
    assert.ok(block, 'expected a block');
    // Only windows 16-19 and 17-20 are contiguous; 16-19 is cheapest
    assert.strictEqual(offsetOf(optimizer, block.startTime), 16);
    assert.strictEqual(block.endTime.getTime() - block.startTime.getTime(), 4 * HOUR_MS);
    assert.ok(Math.abs(block.avgPrice - ((0.01 + 0.01 + 0.20 + 0.20) / 4)) < 1e-9);
  });

  test(`${driver}: most expensive block never bridges a gap in the price data`, () => {
    const optimizer = createOptimizer(OptimizerClass);
    optimizer.setExternalPrices({
      0: 0.50, 1: 0.05, 2: 0.05, 5: 0.50, 9: 0.30, 10: 0.30,
    });

    const block = optimizer.findMostExpensiveBlock(2);
    assert.ok(block, 'expected a block');
    // 0+5 would average 0.50 but are not consecutive; 9-10 is the best contiguous pair
    assert.strictEqual(offsetOf(optimizer, block.startTime), 9);
    assert.strictEqual(block.endTime.getTime() - block.startTime.getTime(), 2 * HOUR_MS);
    assert.ok(Math.abs(block.avgPrice - 0.30) < 1e-9);
  });

  test(`${driver}: duplicate hour plus a gap does not count as a contiguous block`, () => {
    const optimizer = createOptimizer(OptimizerClass);
    // "1" and "01" both map to offset 1; offsets 0,1,1,3 span exactly 3 hours but skip hour 2
    optimizer.setExternalPrices({
      0: 0.01, 1: 0.01, '01': 0.01, 3: 0.01,
    });

    assert.strictEqual(optimizer.findCheapestBlock(4), null);
    assert.strictEqual(optimizer.findMostExpensiveBlock(4), null);
  });

  test(`${driver}: only gaps returns null`, () => {
    const optimizer = createOptimizer(OptimizerClass);
    optimizer.setExternalPrices({
      0: 0.10, 2: 0.05, 4: 0.20, 6: 0.01,
    });

    assert.strictEqual(optimizer.findCheapestBlock(2), null);
    assert.strictEqual(optimizer.findMostExpensiveBlock(2), null);
    assert.ok(optimizer.findCheapestBlock(1), '1-hour blocks need no neighbours');
  });

  test(`${driver}: contiguous data still finds the cheapest block`, () => {
    const optimizer = createOptimizer(OptimizerClass);
    optimizer.setExternalPrices([0.20, 0.15, 0.05, 0.04, 0.06, 0.03, 0.25]);

    const block = optimizer.findCheapestBlock(4);
    assert.ok(block, 'expected a block');
    assert.strictEqual(offsetOf(optimizer, block.startTime), 2);
    assert.strictEqual(block.endTime.getTime() - block.startTime.getTime(), 4 * HOUR_MS);
  });
}

test('formatHourMinute: uses the given timezone, summer and winter time', () => {
  // 2026-10-24 is CEST (UTC+2), 2026-10-25 after 01:00Z is CET (UTC+1)
  assert.strictEqual(formatHourMinute(new Date('2026-10-24T18:00:00Z'), 'Europe/Amsterdam'), '20:00');
  assert.strictEqual(formatHourMinute(new Date('2026-10-25T18:00:00Z'), 'Europe/Amsterdam'), '19:00');
  assert.strictEqual(formatHourMinute(new Date('2026-10-24T18:00:00Z'), 'UTC'), '18:00');
  assert.strictEqual(formatHourMinute(new Date('2026-10-24T18:30:00Z'), 'Europe/Amsterdam'), '20:30');
});

test('formatHourMinute: midnight is "00:00", not "24:00"', () => {
  assert.strictEqual(formatHourMinute(new Date('2026-10-24T22:00:00Z'), 'Europe/Amsterdam'), '00:00');
});

test('resolveHomeyTimezone: prefers Homey clock, falls back to process timezone', () => {
  assert.strictEqual(resolveHomeyTimezone({ clock: { getTimezone: () => 'Europe/Amsterdam' } }), 'Europe/Amsterdam');
  assert.strictEqual(
    resolveHomeyTimezone({ clock: { getTimezone: () => '' } }),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
});

function createFlowCardDevice(optimizer, timeZone) {
  const capabilities = {};
  return {
    capabilities,
    homey: { clock: { getTimezone: () => timeZone } },
    hasCapability: (id) => id === 'energy_prices_data',
    setCapabilityValue: async (id, value) => { capabilities[id] = value; },
    error: () => {},
    serviceCoordinator: {
      getAdaptiveControl: () => ({ getEnergyPriceOptimizer: () => optimizer }),
    },
  };
}

test('energy_prices_data: hour labels use Homey timezone and blocks skip gaps', async () => {
  const optimizer = createOptimizer(ModbusOptimizer);
  // Asia/Tokyo is UTC+9 without DST, so the expected labels do not depend on the test machine
  const device = createFlowCardDevice(optimizer, 'Asia/Tokyo');
  const service = new FlowCardManagerService({ device });

  // Index 4-9 are null (skipped); cheap hours 3 and 10 must not form one block
  const prices = [0.30, 0.30, 0.30, 0.01, null, null, null, null, null, null, 0.01, 0.01, 0.20, 0.20, 0.25];
  await service.handleReceiveExternalEnergyPrices({ prices_json: JSON.stringify(prices) });

  const data = JSON.parse(device.capabilities.energy_prices_data);
  const priceData = optimizer.getPriceData();

  const tokyoLabel = (ts) => `${String((new Date(ts).getUTCHours() + 9) % 24).padStart(2, '0')}:00`;
  assert.deepStrictEqual(data.schedule.map((s) => s.hour), priceData.map((p) => tokyoLabel(p.timestamp)));

  // Cheapest contiguous 4-hour block: offsets 10-13 (0.01, 0.01, 0.20, 0.20)
  const first = priceData[0].timestamp;
  assert.strictEqual(data.summary.cheapestBlock.start, tokyoLabel(first + (10 * HOUR_MS)));
  assert.strictEqual(data.summary.cheapestBlock.end, tokyoLabel(first + (14 * HOUR_MS)));
  assert.strictEqual(data.summary.cheapestBlock.avgPrice, 0.105);

  // Most expensive contiguous 2-hour block: offsets 0-1 (0.30, 0.30)
  assert.strictEqual(data.summary.expensiveBlock.start, tokyoLabel(first));
  assert.strictEqual(data.summary.expensiveBlock.end, tokyoLabel(first + (2 * HOUR_MS)));
});
