/**
 * v3.11.0: automatic price thresholds (P10/P30/P70/P90 over ±12 hours).
 * Uses the NL day-ahead prices of 15 October 2026 (source: jeroen.nl, based on ENTSO-E/EPEX),
 * received at local midnight (22:00:02 UTC on 14 October). With the fixed 2024 thresholds 21 of
 * the 24 hours were 'very high' and the cheapest hours (13:00–15:00 local) only 'normal'.
 * Runs against both compiled optimizers (Tuya; Modbus, also used by Aurora III).
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const HOUR = 3600000;
const RECEIVED_AT = Date.UTC(2026, 9, 14, 22, 0, 2);
const DAY_START = Date.UTC(2026, 9, 14, 22, 0, 0);
const atLocalHour = (h) => DAY_START + h * HOUR + 30 * 60000;

// €/kWh excl. VAT, 00:00–23:00 local time on 15 October 2026
const PRICES = [
  0.1928, 0.18755, 0.17548, 0.17175, 0.1689, 0.17763, 0.21203, 0.2437,
  0.25893, 0.2199, 0.19585, 0.15, 0.1062, 0.08715, 0.09093, 0.1214,
  0.173, 0.22908, 0.25123, 0.24218, 0.2142, 0.2107, 0.20493, 0.19445,
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

function createOptimizer(EnergyPriceOptimizer, lines = []) {
  return new EnergyPriceOptimizer({
    thresholds: {
      veryLow: 0.04, low: 0.06, normal: 0.1, high: 0.12,
    },
    lookAheadHours: 4,
    maxPreHeatOffset: 1.5,
    maxReduceOffset: -1,
    logger: (msg) => lines.push(String(msg)),
  });
}

function receiveDay(opt) {
  withNow(RECEIVED_AT, () => opt.setExternalPrices(asOffsets(PRICES)));
}

for (const driver of ['tuya', 'modbus']) {
  const { EnergyPriceOptimizer } = require(`../../.homeybuild/lib/${driver}/adaptive/energy-price-optimizer`);

  test(`${driver}: fixed mode keeps the 2024 thresholds (cheapest hour only 'normal')`, () => {
    const opt = createOptimizer(EnergyPriceOptimizer);
    receiveDay(opt);
    assert.strictEqual(opt.getThresholdMode(), 'fixed');
    assert.strictEqual(opt.getCurrentPrice(atLocalHour(13)).category, 'normal');
    const veryHigh = PRICES.filter((_, h) => opt.getCurrentPrice(atLocalHour(h)).category === 'very_high');
    assert.strictEqual(veryHigh.length, 21);
  });

  test(`${driver}: auto mode makes the cheapest hours 'very low' and the peak 'very high'`, () => {
    const opt = createOptimizer(EnergyPriceOptimizer);
    opt.setThresholdMode('auto');
    receiveDay(opt);
    const active = opt.getActiveThresholds(atLocalHour(13));
    assert.strictEqual(active.source, 'auto');
    assert.strictEqual(active.sampleSize, 23);
    assert.ok(Math.abs(active.thresholds.veryLow - 0.10924) < 1e-9, `P10 ${active.thresholds.veryLow}`);
    assert.strictEqual(opt.getCurrentPrice(atLocalHour(13)).category, 'very_low');
    assert.strictEqual(opt.getCurrentPrice(atLocalHour(14)).category, 'very_low');
    assert.strictEqual(opt.getCurrentPrice(atLocalHour(8)).category, 'very_high');
  });

  test(`${driver}: auto mode spreads the day over all five categories`, () => {
    const opt = createOptimizer(EnergyPriceOptimizer);
    opt.setThresholdMode('auto');
    receiveDay(opt);
    const counts = {};
    for (let h = 0; h < 24; h++) {
      const { category } = opt.getCurrentPrice(atLocalHour(h));
      counts[category] = (counts[category] || 0) + 1;
    }
    for (const category of ['very_low', 'low', 'normal', 'high', 'very_high']) {
      assert.ok(counts[category] >= 1, `${category}: ${JSON.stringify(counts)}`);
    }
  });

  test(`${driver}: auto mode falls back to the fixed thresholds with fewer than 12 prices`, () => {
    const lines = [];
    const opt = createOptimizer(EnergyPriceOptimizer, lines);
    opt.setThresholdMode('auto');
    withNow(RECEIVED_AT, () => opt.setExternalPrices(asOffsets(PRICES.slice(0, 6))));
    const active = opt.getActiveThresholds(atLocalHour(2));
    assert.strictEqual(active.source, 'fallback');
    assert.strictEqual(active.sampleSize, 6);
    assert.strictEqual(active.thresholds.high, 0.12);
    assert.ok(lines.some((l) => l.includes('fixed thresholds used')));
  });

  test(`${driver}: auto mode treats a flat day as normal`, () => {
    const opt = createOptimizer(EnergyPriceOptimizer);
    opt.setThresholdMode('auto');
    const flat = Array.from({ length: 24 }, (_, h) => 0.1 + (h % 3) * 0.005);
    withNow(RECEIVED_AT, () => opt.setExternalPrices(asOffsets(flat)));
    assert.strictEqual(opt.getActiveThresholds(atLocalHour(12)).source, 'flat');
    for (let h = 0; h < 24; h++) {
      assert.strictEqual(opt.getCurrentPrice(atLocalHour(h)).category, 'normal');
    }
  });

  test(`${driver}: ended hours are kept for the window and survive a restart`, () => {
    const opt = createOptimizer(EnergyPriceOptimizer);
    opt.setThresholdMode('auto');
    receiveDay(opt);
    // New prices at 12:00 local, only for the rest of the day (12:00–23:00)
    const noon = DAY_START + 12 * HOUR + 2000;
    withNow(noon, () => opt.setExternalPrices(asOffsets(PRICES.slice(12))));
    assert.strictEqual(opt.getPriceData().length, 12);
    assert.strictEqual(opt.getActiveThresholds(atLocalHour(12)).sampleSize, 24);

    const state = JSON.parse(JSON.stringify(opt.getState()));
    assert.strictEqual(state.recentPrices.length, 12);
    const restored = createOptimizer(EnergyPriceOptimizer);
    restored.setThresholdMode('auto');
    withNow(noon, () => restored.restoreState(state));
    assert.strictEqual(restored.getActiveThresholds(atLocalHour(12)).sampleSize, 24);
    assert.strictEqual(restored.getCurrentPrice(atLocalHour(13)).category, 'very_low');
  });

  test(`${driver}: a stored state without the buffer still restores`, () => {
    const opt = createOptimizer(EnergyPriceOptimizer);
    receiveDay(opt);
    const { recentPrices, ...oldState } = JSON.parse(JSON.stringify(opt.getState()));
    assert.deepStrictEqual(recentPrices, []);
    const restored = createOptimizer(EnergyPriceOptimizer);
    withNow(RECEIVED_AT, () => restored.restoreState(oldState));
    assert.strictEqual(restored.getState().recentPrices.length, 0);
    assert.strictEqual(restored.getPriceData().length, 24);
  });

  test(`${driver}: the category of the average uses the raw price, the value stays effective`, () => {
    const opt = createOptimizer(EnergyPriceOptimizer);
    opt.setFinancialComponents({ storageFee: 0.0182, energyTax: 0.11085, vatPercentage: 21 });
    opt.setPriceMode('all_in');
    receiveDay(opt);
    // 13:00–16:00 local: raw average 0.118 → 'high' with the fixed thresholds
    const avg = opt.getAveragePrice(atLocalHour(12), 4);
    assert.strictEqual(avg.category, 'high');
    assert.ok(avg.price > 0.25, `effective average ${avg.price}`);
  });

  test(`${driver}: switching back to fixed restores the fixed categories`, () => {
    const opt = createOptimizer(EnergyPriceOptimizer);
    opt.setThresholdMode('auto');
    receiveDay(opt);
    assert.strictEqual(opt.getCurrentPrice(atLocalHour(13)).category, 'very_low');
    opt.setThresholdMode('fixed');
    assert.strictEqual(opt.getActiveThresholds(atLocalHour(13)).source, 'fixed');
    assert.strictEqual(opt.getCurrentPrice(atLocalHour(13)).category, 'normal');
  });
}
