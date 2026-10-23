/**
 * Pre-heat recommendation reads the target temperature from
 * target_temperature.indoor (BUILDING_MODEL_REVIEW_ADDENDUM.md, A1).
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
  const triggers = [];
  const capabilities = { 'target_temperature.indoor': 21 };
  const settings = { building_insights_enabled: true, insights_min_confidence: 70 };
  const device = {
    homey: {
      __: (key) => key,
      i18n: { getLanguage: () => 'en' },
      setInterval: () => ({ mocked: true }),
      clearInterval: () => {},
      flow: {
        getDeviceTriggerCard: (id) => ({
          trigger: async (_device, tokens) => {
            triggers.push({ id, tokens });
          },
        }),
      },
    },
    getSetting: (key) => settings[key],
    getCapabilityValue: (key) => capabilities[key] ?? null,
  };
  const model = {
    C: 15, UA: 0.3, g: 0.5, pInt: 0.3, tau: 50, confidence: 80,
  };
  const buildingModelService = {
    getLearner: () => ({ getModel: () => model }),
    getDiagnosticStatus: async () => ({ confidence: 80 }),
  };
  const adaptiveControlService = { externalTemperature: { getIndoorTemperature: () => 19 } };
  const service = new BuildingInsightsService({
    device, buildingModelService, adaptiveControlService, logger: () => {},
  });
  return { service, triggers };
}

for (const driver of ['tuya', 'modbus', 'aurora3']) {
  test(`A1 ${driver}: pre-heat recommendation uses target_temperature.indoor`, async () => {
    const { service, triggers } = createService(driver);
    await service.checkPreHeatThreshold({ confidence: 80 });
    assert.strictEqual(triggers.length, 1);
    assert.strictEqual(triggers[0].id, 'pre_heat_recommendation');
    assert.strictEqual(triggers[0].tokens.target_temp, 21);
  });
}
