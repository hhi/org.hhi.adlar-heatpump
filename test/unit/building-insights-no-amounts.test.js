/**
 * v3.4.2: building insights no longer show an estimated amount in euros.
 * A predicted saving cannot be substantiated (dynamic prices are not known in advance,
 * the heat pump does not run every hour). The 'savings above' condition is deprecated
 * and returns false; the trigger token estimated_savings_eur_month stays 0.
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

function createService(driver, model, lang = 'nl') {
  const { BuildingInsightsService } = require(`../../.homeybuild/lib/${driver}/services/building-insights-service`);
  const triggers = [];
  const settings = { building_insights_enabled: true, insights_min_confidence: 70, building_profile: 'average' };
  const device = {
    homey: {
      __: (key) => key,
      i18n: { getLanguage: () => lang },
      setInterval: () => ({ mocked: true }),
      clearInterval: () => {},
      flow: {
        getDeviceTriggerCard: (id) => ({
          trigger: async (_device, tokens) => { triggers.push({ id, tokens }); },
        }),
      },
    },
    getSetting: (key) => settings[key],
    getCapabilityValue: () => null,
  };
  const service = new BuildingInsightsService({
    device,
    buildingModelService: { getLearner: () => ({ getModel: () => model }) },
    adaptiveControlService: { hasDynamicPricing: () => true },
    logger: () => {},
  });
  return { service, triggers };
}

const diagnostics = { confidence: 90, blockingReason: null, sampleCount: 500 };

for (const driver of ['tuya', 'modbus', 'aurora3']) {
  test(`${driver}: insulation insight shows the verdict without an amount`, () => {
    const model = {
      C: 21.6, UA: 0.8, g: 0.5, pInt: 0.3, tau: 27, confidence: 90,
    };
    for (const lang of ['nl', 'en']) {
      const { service } = createService(driver, model, lang);
      const insight = service.detectInsulationInsights(diagnostics);
      assert.ok(insight, lang);
      assert.ok(!insight.recommendation.includes('€'), insight.recommendation);
      assert.strictEqual(insight.estimatedSavings, undefined);
    }
    assert.strictEqual(createService(driver, model, 'nl').service.detectInsulationInsights(diagnostics).recommendation,
      '🔴 Hoog verlies • Dak/muren/ramen');
  });

  test(`${driver}: thermal storage insight shows the verdict without an amount, also with dynamic prices`, () => {
    const model = {
      C: 40, UA: 0.1, g: 0.5, pInt: 0.3, tau: 400, confidence: 90,
    };
    const { service } = createService(driver, model, 'nl');
    const insight = service.detectThermalStorageInsights(diagnostics);
    assert.ok(insight.recommendation.includes('Grote buffer • Weinig verlies'), insight.recommendation);
    assert.ok(!insight.recommendation.includes('€'), insight.recommendation);
    assert.strictEqual(insight.priority, 90);
  });

  test(`${driver}: 'savings above' condition returns false and the trigger token is 0`, async () => {
    const { service, triggers } = createService(driver, {
      C: 21.6, UA: 0.8, g: 0.5, pInt: 0.3, tau: 27, confidence: 90,
    });
    assert.strictEqual(service.areSavingsAbove('insulation_performance', 0), false);
    const insight = service.detectInsulationInsights(diagnostics);
    await service.triggerInsightFlowCard(insight);
    const fired = triggers.find((t) => t.id === 'building_insight_detected');
    assert.ok(fired, JSON.stringify(triggers.map((t) => t.id)));
    assert.strictEqual(fired.tokens.estimated_savings_eur_month, 0);
  });
}
