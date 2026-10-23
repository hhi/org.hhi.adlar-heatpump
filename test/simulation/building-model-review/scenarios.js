/**
 * Simulatie-onderbouwing van BUILDING_MODEL_REVIEW.md §6.
 *
 * Vergelijkt de huidige BuildingModelLearner (uit .homeybuild/) met varianten met de
 * voorgestelde wijzigingen, op een gesimuleerde 1R1C-woning.
 *
 * Gebruik (vanuit de projectroot, na npm run build):
 *   node test/simulation/building-model-review/scenarios.js <S1,S1b,S2,S3|all> <datavormen>
 *   SET=data|attributie node test/simulation/building-model-review/scenarios.js all realistisch
 *   node test/simulation/building-model-review/vff.js
 *   node test/simulation/building-model-review/thermal.js
 * Datavormen: ideaal, kwantisatie, mismatch, realistisch (komma-gescheiden).
 * De getallen in review §6 zijn gemaakt met TAU_MAX=500; de standaard is 800 (ADR-062 B4).
 */

'use strict';

const { runCase, table, COLS, simulateHouse, asLearnerInput, fmt } = require('./run');
const { makeLearner } = require('./learners');

const SETS = {
  fixes: [
    ['huidig', {}],
    ['+psd', { psd: true }],
    ['+bounds', { bounds: true }],
    ['+order', { order: true }],
    ['psd+bounds+order', { psd: true, bounds: true, order: true }],
  ],
  data: [
    ['huidig', {}],
    ['huidig + uitlijning', { align: true }],
    ['fixes', { psd: true, bounds: true, order: true }],
    ['fixes + uitlijning', { psd: true, bounds: true, order: true, align: true }],
    ['fixes + venster 30 min', { psd: true, bounds: true, order: true, window: 6 }],
    ['fixes + venster 60 min', { psd: true, bounds: true, order: true, window: 12 }],
  ],
  attributie: [
    ['huidig', {}],
    ['huidig + venster 60', { window: 12 }],
    ['psd + venster 60', { psd: true, window: 12 }],
    ['bounds + venster 60', { bounds: true, window: 12 }],
    ['psd+bounds + venster 60', { psd: true, bounds: true, window: 12 }],
    ['psd+bounds+order + venster 60', { psd: true, bounds: true, order: true, window: 12 }],
  ],
};
const VARIANTS = SETS[process.env.SET || 'fixes'];

function scenario(title, truth, { days = 30, seeds = [7], profile = 'average', extra = {}, mode = 'realistisch' } = {}) {
  console.log(`\n### ${title}\n`);
  console.log(`Waarheid: C=${truth.C}, UA=${truth.UA}, τ=${(truth.C / truth.UA).toFixed(0)} h, g=${truth.g}, Pint=${truth.pInt}; startprofiel ${profile}; ${days} dagen; data: ${mode}; seeds ${seeds.join(',')}\n`);
  const agg = [];
  for (const [label, opts] of VARIANTS) {
    const rows = seeds.map((seed) => {
      const s = asLearnerInput(simulateHouse({ ...truth, days, seed, ...extra }), mode);
      const h = simulateHouse({ ...truth, days: 5, seed: seed + 1000, ...extra });
      return runCase(label, { profile, ...opts }, s, h, truth);
    });
    const avg = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
    const absAvg = (k) => rows.reduce((a, r) => a + Math.abs(r[k]), 0) / rows.length;
    agg.push({
      label, C: avg('C'), UA: avg('UA'), tau: avg('tau'), errC: absAvg('errC'), errUA: absAvg('errUA'),
      rmse: avg('rmse'), reverts: Math.round(avg('reverts')), updates: Math.round(avg('updates')),
      negXPX: Math.round(avg('negXPX')), negEigUpdates: Math.round(avg('negEigUpdates')),
      minEig: Math.min(...rows.map((r) => r.minEig)), conf: avg('conf'),
    });
  }
  console.log(table(agg, COLS));
  return agg;
}

const SEEDS = [7, 11, 23, 42, 77];
const only = process.argv[2];
const houses = {
  S1: ['S1 Gemiddelde woning, start op profiel average', { C: 15, UA: 0.3, g: 0.5, pInt: 0.3 }, 'average'],
  S1b: ['S1b Gemiddelde woning, start op profiel light', { C: 15, UA: 0.3, g: 0.5, pInt: 0.3 }, 'light'],
  S2: ['S2 Slecht geïsoleerd (UA 1,0)', { C: 10, UA: 1.0, g: 0.4, pInt: 0.3 }, 'light'],
  S3: ['S3 Zwaar en goed geïsoleerd (τ 160 h)', { C: 24, UA: 0.15, g: 0.5, pInt: 0.3 }, 'heavy'],
};
const modes = (process.argv[3] || 'ideaal,realistisch').split(',');
for (const [key, [title, truth, profile]] of Object.entries(houses)) {
  if (only && only !== 'all' && !only.split(',').includes(key)) continue;
  for (const mode of modes) scenario(title, truth, { seeds: SEEDS, profile, mode });
}

// S4 — restore van een state met τ = 800 h
console.log('\n### S4 Restore van een opgeslagen state met τ = 800 h\n');
for (const [label, opts] of [['huidig', {}], ['+bounds', { bounds: true }]]) {
  const L = makeLearner(opts);
  L.restoreState({ theta: [0.025, 0.00125, 0.01, 0.0075], P: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]], sampleCount: 100, lastMeasurement: null });
  const m = L.getModel();
  console.log(`- ${label}: sampleCount na restore = ${L.sampleCount}, C = ${fmt(m.C, 1)}, UA = ${fmt(m.UA, 3)}, τ = ${fmt(m.tau, 0)} h → ${L.sampleCount === 100 ? 'GEACCEPTEERD' : 'afgewezen'}`);
}

module.exports = { scenario };
