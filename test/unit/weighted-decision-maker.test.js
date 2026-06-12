/**
 * Unit tests for WeightedDecisionMaker (ADR-059 W2)
 *
 * Core invariant: the comfort (PI) weight is anchored and does NOT vary with
 * optimizer confidence — the effective loop gain stays constant.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { WeightedDecisionMaker } = require('../../.homeybuild/lib/adaptive/weighted-decision-maker');

const PRIORITIES = { comfort: 0.6, efficiency: 0.25, cost: 0.15 };

function heatingAction(adjustment) {
  return {
    temperatureAdjustment: adjustment, reason: 'test PI', priority: 'medium', controller: 'heating',
  };
}

function copAction(action, magnitude) {
  return {
    action, magnitude, reason: 'test COP', priority: 'low',
  };
}

function priceAction(action, magnitude, priority = 'medium') {
  return {
    action, magnitude, reason: 'test price', priority,
  };
}

const FULL_CONFIDENCE = { copConfidence: 1.0, buildingModelConfidence: 1.0, priceDataAvailable: true };
const NO_CONFIDENCE = { copConfidence: 0.0, buildingModelConfidence: 0.0, priceDataAvailable: false };

test('ADR-059 W2: comfort contribution is invariant under optimizer confidence', () => {
  const dm = new WeightedDecisionMaker(PRIORITIES);
  const pi = heatingAction(2.0);

  const withFull = dm.combineActionsWithThermal(pi, null, null, null, FULL_CONFIDENCE, null);
  const withNone = dm.combineActionsWithThermal(pi, null, null, null, NO_CONFIDENCE, null);

  assert.strictEqual(withFull.breakdown.comfort, withNone.breakdown.comfort,
    'comfort breakdown must not depend on confidence metrics');
  assert.ok(Math.abs(withFull.breakdown.comfort - 2.0 * 0.6) < 1e-9,
    `comfort = adjustment × anchor (got ${withFull.breakdown.comfort})`);
});

test('ADR-059 W2: unavailable optimizers do not redistribute weight to comfort', () => {
  const dm = new WeightedDecisionMaker(PRIORITIES);
  const pi = heatingAction(1.0);

  const result = dm.combineActionsWithThermal(pi, null, null, null, NO_CONFIDENCE, null);
  assert.ok(Math.abs(result.effectiveWeights.comfort - 0.6) < 1e-9,
    `comfort weight stays at anchor 0.6 (got ${result.effectiveWeights.comfort})`);
  assert.strictEqual(result.effectiveWeights.efficiency, 0);
  assert.strictEqual(result.effectiveWeights.cost, 0);
  assert.strictEqual(result.effectiveWeights.thermal, 0);
  assert.ok(Math.abs(result.finalAdjustment - 0.6) < 1e-9, 'final = PI × anchor only');
});

test('optimizers renormalize within their own budget (1 - anchor)', () => {
  const dm = new WeightedDecisionMaker(PRIORITIES);
  const pi = heatingAction(0);

  const result = dm.combineActionsWithThermal(
    pi,
    copAction('decrease', 1.0),
    priceAction('maintain', 0),
    { adjustment: 0.5, reason: 'thermal', priority: 'low' },
    FULL_CONFIDENCE,
    null,
  );
  const w = result.effectiveWeights;
  const optimizerSum = w.efficiency + w.cost + w.thermal;
  assert.ok(Math.abs(optimizerSum - 0.4) < 1e-9,
    `optimizer weights sum to budget 0.4 (got ${optimizerSum})`);
  assert.ok(Math.abs(w.comfort + optimizerSum - 1.0) < 1e-9, 'all weights sum to 1.0');
});

test('cost multiplier shifts weight within the optimizer budget, not against comfort', () => {
  const dm = new WeightedDecisionMaker(PRIORITIES);
  const pi = heatingAction(1.0);

  const normal = dm.combineActionsWithThermal(
    pi, copAction('decrease', 0.5), priceAction('maintain', 0), null, FULL_CONFIDENCE, null,
  );
  const boosted = dm.combineActionsWithThermal(
    pi, copAction('decrease', 0.5), priceAction('reduce', -1.0, 'high'), null, FULL_CONFIDENCE, null,
  );

  assert.strictEqual(normal.effectiveWeights.comfort, boosted.effectiveWeights.comfort,
    'comfort anchor unaffected by ×3 cost multiplier');
  assert.ok(boosted.effectiveWeights.cost > normal.effectiveWeights.cost,
    'cost weight grows within optimizer budget');
});

test('ADR-024/040A: active coast displaces, zero coastAdjust does not', () => {
  const dm = new WeightedDecisionMaker(PRIORITIES);
  const pi = heatingAction(1.0);
  const coast = {
    adjustment: -1.2, reason: 'coast', priority: 'high', strength: 0.8,
  };

  const active = dm.combineActionsWithThermal(pi, null, null, null, FULL_CONFIDENCE, coast);
  assert.ok(Math.abs(active.effectiveWeights.coast - 0.8) < 1e-9, 'coast gets its strength share');
  assert.ok(Math.abs(active.effectiveWeights.comfort - 0.6 * 0.2) < 1e-9,
    'comfort scaled to anchor × (1 - strength)');

  const idle = { ...coast, adjustment: 0 };
  const inactive = dm.combineActionsWithThermal(pi, null, null, null, FULL_CONFIDENCE, idle);
  assert.strictEqual(inactive.effectiveWeights.coast, 0, 'coastAdjust=0 → no coast weight');
  assert.ok(Math.abs(inactive.effectiveWeights.comfort - 0.6) < 1e-9, 'comfort back at full anchor');
});

test('ADR-060: anchor stays 0.6 when thermal priority is configured (production config)', () => {
  // Production passes thermal: 0.20 (loadPrioritySettings), making the constructor
  // total 1.2. The anchor must still be comfort/(comfort+efficiency+cost) = 0.6 —
  // previously the four-way normalization silently lowered it to 0.5 (effective Kp × 0.5).
  const dm = new WeightedDecisionMaker({ ...PRIORITIES, thermal: 0.20 });
  const pi = heatingAction(1.0);

  const result = dm.combineActionsWithThermal(pi, null, null, null, NO_CONFIDENCE, null);
  assert.ok(Math.abs(result.effectiveWeights.comfort - 0.6) < 1e-9,
    `anchor must remain 0.6 with thermal configured (got ${result.effectiveWeights.comfort})`);
  assert.ok(Math.abs(result.finalAdjustment - 0.6) < 1e-9, 'final = PI × anchor 0.6');
});

test('thermal component gated on building model confidence >= 0.5', () => {
  const dm = new WeightedDecisionMaker(PRIORITIES);
  const pi = heatingAction(0);
  const thermal = { adjustment: 0.5, reason: 'thermal boost', priority: 'medium' };
  const lowConf = { copConfidence: 0, buildingModelConfidence: 0.4, priceDataAvailable: false };

  const result = dm.combineActionsWithThermal(pi, null, null, thermal, lowConf, null);
  assert.strictEqual(result.effectiveWeights.thermal, 0, 'thermal disabled below 50% confidence');
  assert.strictEqual(result.finalAdjustment, 0);
});
