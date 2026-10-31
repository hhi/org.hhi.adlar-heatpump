/**
 * ADR-062 fase 3: B13 (P follows the step θ took), A5 (settings are leading), F2/F3 (local time
 * for the P_int windows, solar time for the sun) and A6 (the 70% milestone fires once).
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

const { BuildingModelLearner } = require('../../.homeybuild/lib/shared/adaptive/building-model-learner');
const { getZonedHour, getSolarHour } = require('../../.homeybuild/lib/shared/utils/time-format');
const { BuildingModelService } = require('../../.homeybuild/lib/modbus/services/building-model-service');

const diag = (v) => [[v, 0, 0, 0], [0, v, 0, 0], [0, 0, v, 0], [0, 0, 0, v]];

function createLearner(overrides = {}) {
  return new BuildingModelLearner({
    forgettingFactor: 0.999,
    initialCovariance: 100,
    minSamplesForConfidence: 288,
    buildingProfile: 'average',
    enableDynamicPInt: false,
    ...overrides,
  });
}

/** The former covariance update (P − K·Xᵀ·P) / λ with the same PSD projection. */
function classicP(P, X, lambda) {
  const PX = P.map((row) => row.reduce((s, v, j) => s + v * X[j], 0));
  const den = lambda + X.reduce((s, v, i) => s + v * PX[i], 0);
  const K = PX.map((v) => v / den);
  const XtP = X.map((_, j) => P.reduce((s, row, i) => s + X[i] * row[j], 0));
  const out = P.map((row, i) => row.map((v, j) => (v - K[i] * XtP[j]) / lambda));
  return BuildingModelLearner.projectCovariance(out);
}

function rlsStep(P, dy) {
  const learner = createLearner();
  learner.P = P.map((row) => [...row]);
  const X = [2, -15, 0, 1];
  const y = learner.theta.reduce((s, t, i) => s + t * X[i], 0) + dy;
  learner.updateRLS(X, y);
  return { learner, expected: classicP(P, X, learner.lambda) };
}

test('B13: without a shortened step the Joseph form equals the former update', () => {
  const { learner, expected } = rlsStep(diag(1e-3), 0.001);
  assert.strictEqual(learner.rateLimitActivations, 0, 'no rate limiting');
  learner.P.forEach((row, i) => row.forEach((v, j) => assert.ok(Math.abs(v - expected[i][j]) < 1e-12, `P[${i}][${j}]`)));
});

test('B13: a rate-limited component keeps more uncertainty than the full step claims', () => {
  const { learner, expected } = rlsStep(diag(1e-3), 0.5);
  assert.strictEqual(learner.rateLimitActivations, 1, 'rate limited');
  assert.ok(learner.P[1][1] > expected[1][1] + 1e-6, `UA/C: ${learner.P[1][1]} > ${expected[1][1]}`);
});

test('A5: the forgetting factor can be set directly, with the constructor clamp', () => {
  const learner = createLearner();
  learner.setForgettingFactor(0.9992);
  assert.strictEqual(learner.lambda, 0.9992);
  learner.setForgettingFactor(0.9);
  assert.strictEqual(learner.lambda, 0.9985);
});

test('A5: switching dynamic P_int soft-resets, unless the caller resets itself', () => {
  const learner = createLearner();
  learner.sampleCount = 100;
  assert.strictEqual(learner.setDynamicPInt(false, 'average'), false, 'unchanged value');
  assert.strictEqual(learner.sampleCount, 100);
  assert.strictEqual(learner.setDynamicPInt(true, 'average'), true);
  assert.strictEqual(learner.sampleCount, 50, 'soft reset halves the samples');
  assert.strictEqual(learner.setDynamicPInt(false, 'average', false), true);
  assert.strictEqual(learner.sampleCount, 50, 'no own reset');
  assert.strictEqual(learner.getState().enableDynamicPInt, false);
});

test('F2: the P_int windows use the wall clock of the configured timezone', () => {
  const at = Date.parse('2026-10-24T17:30:00Z'); // 19:30 in Amsterdam (evening), 17:30 UTC (day)
  const near = (actual, expected, msg) => assert.ok(Math.abs(actual - expected) < 1e-9, `${msg}: ${actual}`);
  near(createLearner({ enableDynamicPInt: true, timeZone: 'Europe/Amsterdam' }).pIntMultiplierAt(at), 1.8, 'Amsterdam evening');
  near(createLearner({ enableDynamicPInt: true, timeZone: 'UTC' }).pIntMultiplierAt(at), 1.0, 'UTC day');
});

test('F2/F3: zoned hour and mean solar time', () => {
  assert.strictEqual(getZonedHour(new Date('2026-10-24T18:30:00Z'), 'Europe/Amsterdam'), 20.5);
  assert.strictEqual(getZonedHour(new Date('2026-12-24T18:30:00Z'), 'Europe/Amsterdam'), 19.5);
  assert.ok(Math.abs(getSolarHour(new Date('2026-10-24T11:40:00Z'), 5) - 12) < 1e-9);
  assert.ok(Math.abs(getSolarHour(new Date('2026-10-24T23:30:00Z'), 15) - 0.5) < 1e-9, 'wraps past midnight');
});

function createService(store = {}) {
  const triggered = [];
  const device = {
    homey: {
      __: (key) => key,
      i18n: { getLanguage: () => 'en' },
      flow: { getDeviceTriggerCard: () => ({ trigger: async (_d, tokens) => { triggered.push(tokens); } }) },
    },
    store,
    getSetting: () => undefined,
    getStoreValue: (key) => store[key],
    setStoreValue: async (key, value) => { store[key] = value; },
    getCapabilityValue: () => null,
    hasCapability: () => false,
    setCapabilityValue: async () => {},
    setCapabilityOptions: async () => {},
  };
  const service = new BuildingModelService({ device, buildingProfile: 'average', enableDynamicPInt: false });
  return { service, triggered, store };
}

function withConfidence(service, confidence) {
  const model = service.learner.getModel();
  service.learner.getModel = () => ({ ...model, confidence });
}

test('A6: the milestone fires once when the confidence crosses 70%', async () => {
  const { service, triggered, store } = createService();
  service.lastConfidence = 60;
  withConfidence(service, 72);
  await service.updateModelCapabilities();
  withConfidence(service, 73);
  await service.updateModelCapabilities();
  assert.strictEqual(triggered.length, 1);
  assert.strictEqual(store.building_model_milestone_70, true);

  service.lastConfidence = 60; // dip and cross again: the flag holds
  await service.updateModelCapabilities();
  assert.strictEqual(triggered.length, 1);
});

test('A6: a model restored above 70% does not fire; a soft reset clears the flag', async () => {
  const { service, triggered, store } = createService({ building_model_milestone_70: true });
  service.lastConfidence = 95;
  withConfidence(service, 95);
  await service.updateModelCapabilities();
  assert.strictEqual(triggered.length, 0);
  await service.softReset('average');
  assert.strictEqual(store.building_model_milestone_70, false);
});
