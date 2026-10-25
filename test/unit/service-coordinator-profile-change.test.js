/**
 * A building profile change soft-resets the building model in all three drivers
 * (ADR-062 phase 1f; Aurora II and III did not do this before 3.4.0).
 * Builds the compiled ServiceCoordinator from its prototype with service stubs,
 * so only the order in onSettings() is exercised.
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

function createCoordinator(driver) {
  const { ServiceCoordinator } = require(`../../.homeybuild/lib/${driver}/services/service-coordinator`);
  const calls = [];
  const coordinator = Object.create(ServiceCoordinator.prototype);
  Object.assign(coordinator, {
    logger: () => {},
    settingsManager: { onSettings: async () => {} },
    energyTracking: { onSettings: async () => {} },
    adaptiveControl: {
      onSettings: async () => { calls.push('adaptiveControl.onSettings'); },
      getBuildingModelService: () => ({
        softReset: async (profile) => { calls.push(`softReset:${profile}`); },
      }),
    },
    buildingInsights: {
      onSettingsChanged: async () => { calls.push('insights.onSettingsChanged'); },
      evaluateInsights: async () => { calls.push('insights.evaluateInsights'); },
    },
  });
  return { coordinator, calls };
}

for (const driver of ['tuya', 'modbus', 'aurora3']) {
  test(`${driver}: a building_profile change soft-resets after adaptiveControl.onSettings and re-evaluates insights`, async () => {
    const { coordinator, calls } = createCoordinator(driver);
    await coordinator.onSettings({ building_profile: 'average' }, { building_profile: 'heavy' }, ['building_profile']);
    assert.deepStrictEqual(calls.slice(0, 3), ['adaptiveControl.onSettings', 'softReset:heavy', 'insights.evaluateInsights']);
    assert.strictEqual(calls.filter((c) => c.startsWith('softReset')).length, 1);
  });

  test(`${driver}: another setting change does not soft-reset the building model`, async () => {
    const { coordinator, calls } = createCoordinator(driver);
    await coordinator.onSettings({ insights_min_confidence: 70 }, { insights_min_confidence: 60 }, ['insights_min_confidence']);
    assert.ok(!calls.some((c) => c.startsWith('softReset')), calls.join(', '));
  });
}
