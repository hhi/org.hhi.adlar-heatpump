/**
 * Unit tests for the forgetting factor migration (R25, 3.6.2)
 *
 * 3.4.2 raised the minimum of building_model_forgetting_factor from 0.990 to 0.9985.
 * A stored value below it makes Homey reject every settings save, so onInit replaces it.
 * Run via: npm test (builds first, then node --test)
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { BuildingModelLearner } = require('../../.homeybuild/lib/shared/adaptive/building-model-learner');

const migrate = (value) => BuildingModelLearner.forgettingFactorMigration(value);

test('R25: a value below the minimum becomes the default 0.999', () => {
  assert.strictEqual(migrate(0.995), 0.999);
  assert.strictEqual(migrate(0.990), 0.999);
  assert.strictEqual(migrate(0.9984), 0.999);
});

test('R25: a value above the maximum becomes the default 0.999', () => {
  assert.strictEqual(migrate(0.9999), 0.999);
});

test('R25: valid values, including both bounds, stay as they are', () => {
  for (const value of [0.9985, 0.999, 0.9995]) {
    assert.strictEqual(migrate(value), null, `${value} should not be migrated`);
  }
});

test('R25: a missing or non-numeric value is left alone (Homey fills in the default)', () => {
  for (const value of [undefined, null, '0.995', Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.strictEqual(migrate(value), null, `${String(value)} should not be migrated`);
  }
});

test('R25: the replacement is inside the range the setting accepts', () => {
  const { MIN, MAX } = BuildingModelLearner.LAMBDA;
  const replacement = migrate(0.995);
  assert.ok(replacement >= MIN && replacement <= MAX);
});
