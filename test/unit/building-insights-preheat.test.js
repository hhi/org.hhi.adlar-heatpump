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

function createService(driver, conditions = undefined) {
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
  if (conditions !== undefined) buildingModelService.getPreHeatConditions = () => conditions;
  const adaptiveControlService = { externalTemperature: { getIndoorTemperature: () => 19, getIndoorStaleness: () => 'fresh' } };
  const service = new BuildingInsightsService({
    device, buildingModelService, adaptiveControlService, logger: () => {},
  });
  return { service, triggers, model };
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

// G14 (ADR-062 B7): with a power history the trigger and the insight use the physical estimate
const CONDITIONS = {
  UA: 0.3, pInt: 0.3, outdoorTemp: 5, maxHeatingPowerKw: 8,
};

for (const driver of ['tuya', 'modbus', 'aurora3']) {
  test(`G14 ${driver}: pre-heat recommendation uses the measured heating power`, async () => {
    const { estimatePreHeatDuration } = require('../../.homeybuild/lib/shared/utils/preheat-calculator');
    const { service, triggers } = createService(driver, CONDITIONS);
    await service.checkPreHeatThreshold({ confidence: 80 });
    assert.strictEqual(triggers.length, 1);
    const expected = Math.round(estimatePreHeatDuration(50, 19, 21, CONDITIONS) * 10) / 10;
    assert.strictEqual(triggers[0].tokens.duration_hours, expected);
    assert.ok(expected < 24, 'shorter than the 24 h of the classes for 2 °C');
  });

  test(`G14 ${driver}: without a power history the trigger keeps the classes`, async () => {
    const { service, triggers } = createService(driver, null);
    await service.checkPreHeatThreshold({ confidence: 80 });
    assert.strictEqual(triggers[0].tokens.duration_hours, 24);
  });

  test(`G14 ${driver}: the pre-heat insight names the time at the current weather`, () => {
    const { service } = createService(driver, CONDITIONS);
    const insight = service.detectPreHeatingInsights({ confidence: 80 });
    assert.match(insight.recommendation, /^Very slow \(~24 hours for 2°C\) · at 5°C outside now ~\d+ hours$/);

    const { service: withoutHistory } = createService(driver, null);
    assert.strictEqual(withoutHistory.detectPreHeatingInsights({ confidence: 80 }).recommendation, 'Very slow (~24 hours for 2°C)');
  });
}
