/**
 * v3.4.1: negative day-ahead prices and restoring stored prices after a restart.
 * Uses the real NL day-ahead prices of 25 October 2026 (end of daylight saving time),
 * received at 00:00:02 UTC: 13 of the hours are negative (00–05 and 07–13 UTC).
 * Runs against both compiled optimizers (Tuya; Modbus, also used by Aurora III).
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const HOUR = 3600000;
const RECEIVED_AT = Date.UTC(2026, 9, 25, 0, 0, 2);

// €/kWh excl. VAT for 00:00–22:00 UTC on 25 October 2026 (source: ENTSO-E / EPEX day-ahead NL)
const PRICES_UTC = [
  -0.0018, -0.00293, -0.00165, -0.00095, -0.0016, -0.0012, 0.00013, -0.00025,
  -0.0016, -0.0028, -0.0031, -0.00385, -0.0045, -0.00158, 0.00155, 0.0178,
  0.088, 0.13405, 0.1082, 0.0886, 0.07513, 0.05348, 0.03318,
];
const asOffsets = (prices) => Object.fromEntries(prices.map((p, i) => [String(i), p]));

function withNow(now, fn) {
  const realNow = Date.now;
  Date.now = () => now;
  try {
    return fn();
  } finally {
    Date.now = realNow;
  }
}

function createOptimizer(EnergyPriceOptimizer, lines) {
  return new EnergyPriceOptimizer({
    thresholds: {
      veryLow: 0.04, low: 0.06, normal: 0.1, high: 0.12,
    },
    lookAheadHours: 4,
    maxPreHeatOffset: 1.5,
    maxReductionOffset: 1,
    logger: (msg) => lines.push(String(msg)),
  });
}

for (const driver of ['tuya', 'modbus']) {
  const { EnergyPriceOptimizer } = require(`../../.homeybuild/lib/${driver}/adaptive/energy-price-optimizer`);

  test(`${driver}: negative prices are kept and the cheapest 4-hour block is 09:00–13:00 UTC`, () => {
    const opt = createOptimizer(EnergyPriceOptimizer, []);
    withNow(RECEIVED_AT, () => opt.setExternalPrices(asOffsets(PRICES_UTC)));
    const data = opt.getPriceData();
    assert.strictEqual(data.length, 23);
    assert.strictEqual(data.filter((p) => p.price < 0).length, 13);
    const block = withNow(RECEIVED_AT, () => opt.findCheapestBlock(4));
    assert.strictEqual(block.startTime.toISOString(), '2026-10-25T09:00:00.000Z');
    assert.strictEqual(block.endTime.toISOString(), '2026-10-25T13:00:00.000Z');
    assert.ok(block.avgPrice < 0, `average ${block.avgPrice}`);
  });

  test(`${driver}: restored prices keep their clock times and past hours are dropped`, () => {
    const lines = [];
    const opt = createOptimizer(EnergyPriceOptimizer, lines);
    const restart = Date.UTC(2026, 9, 25, 9, 30); // 9.5 hours after receipt
    withNow(restart, () => opt.setExternalPrices(asOffsets(PRICES_UTC), RECEIVED_AT));
    const data = opt.getPriceData();
    assert.strictEqual(new Date(data[0].timestamp).toISOString(), '2026-10-25T09:00:00.000Z');
    assert.strictEqual(data.length, 14);
    assert.strictEqual(withNow(restart, () => opt.getCurrentPrice(restart)).price, -0.0028);
    const cheapest = withNow(restart, () => opt.findCheapestBlock(4));
    assert.strictEqual(cheapest.startTime.toISOString(), '2026-10-25T09:00:00.000Z');
    const expensive = withNow(restart, () => opt.findMostExpensiveBlock(2));
    assert.strictEqual(expensive.startTime.toISOString(), '2026-10-25T17:00:00.000Z');
    assert.ok(lines.some((l) => l.includes('9 past hours dropped')));
  });

  test(`${driver}: prices outside -1 to 5 €/kWh are skipped with a warning`, () => {
    const lines = [];
    const opt = createOptimizer(EnergyPriceOptimizer, lines);
    withNow(RECEIVED_AT, () => opt.setExternalPrices({
      0: -2, 1: 10, 2: 0.1, 3: -0.5,
    }));
    assert.deepStrictEqual(opt.getPriceData().map((p) => p.price), [0.1, -0.5]);
    assert.ok(lines.some((l) => l.startsWith('⚠️') && l.includes('2 of 4 prices')));
  });

  test(`${driver}: deviation from the average uses effective prices and stays finite around zero`, () => {
    const opt = createOptimizer(EnergyPriceOptimizer, []);
    withNow(RECEIVED_AT, () => opt.setExternalPrices(asOffsets(PRICES_UTC)));
    const at = Date.UTC(2026, 9, 25, 12, 30);
    const deviation = withNow(at, () => opt.getDeviationFromAverage(at, 6));
    assert.ok(deviation.current < deviation.average);
    assert.ok(Number.isFinite(deviation.deviationPercent) && deviation.deviationPercent < 0);

    // An average of exactly zero: the percentage is taken against 0.005 €/kWh
    const flat = createOptimizer(EnergyPriceOptimizer, []);
    withNow(RECEIVED_AT, () => flat.setExternalPrices(asOffsets([0.002, -0.002, 0.002, -0.002, 0.002, -0.002])));
    const d0 = withNow(RECEIVED_AT, () => flat.getDeviationFromAverage(RECEIVED_AT, 6));
    assert.ok(Math.abs(d0.average) < 1e-12);
    assert.ok(Math.abs(d0.deviationPercent - 40) < 1e-6, `deviation ${d0.deviationPercent}`);
    assert.strictEqual(withNow(RECEIVED_AT, () => flat.getDeviationFromAverage(RECEIVED_AT + 10 * HOUR, 6)), null, 'no current price');
  });
}
