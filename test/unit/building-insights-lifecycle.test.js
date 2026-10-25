/**
 * Timer lifecycle of BuildingInsightsService (ADR-062 A7, review addendum A7).
 * Runs against the compiled insights service of all three drivers.
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

function createService(driver) {
  const { BuildingInsightsService } = require(`../../.homeybuild/lib/${driver}/services/building-insights-service`);
  const active = new Set();
  const settings = { building_insights_enabled: true, insights_min_confidence: 70 };
  const device = {
    homey: {
      __: (key) => key,
      i18n: { getLanguage: () => 'en' },
      setInterval: () => {
        const handle = { id: active.size + 1 };
        active.add(handle);
        return handle;
      },
      clearInterval: (handle) => { active.delete(handle); },
    },
    getSetting: (key) => settings[key],
  };
  const service = new BuildingInsightsService({
    device, buildingModelService: {}, adaptiveControlService: {}, logger: () => {},
  });
  // Isolate the timer lifecycle from persistence and evaluation
  service.restoreState = async () => {};
  service.persistState = async () => {};
  service.evaluateInsights = async () => {};
  return { service, active };
}

for (const driver of ['tuya', 'modbus', 'aurora3']) {
  test(`A7 ${driver}: initialize() twice keeps one evaluation interval and destroy() clears it`, async () => {
    const { service, active } = createService(driver);
    await service.initialize();
    await service.initialize();
    assert.strictEqual(active.size, 1);
    await service.destroy();
    assert.strictEqual(active.size, 0);
  });
}
