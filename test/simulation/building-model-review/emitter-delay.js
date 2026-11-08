'use strict';

/**
 * ADR-066: afgiftevertraging. Gebruikt de gecompileerde learner en schatter uit .homeybuild
 * (eerst `npm run build`).
 *
 *   node test/simulation/building-model-review/emitter-delay.js
 *
 * 1. De schatter (EmitterDelayEstimator) kiest de vertraging, per werkelijke vertraging en scenario.
 * 2. De learner zonder en met filter: C, UA, P_int en τ na 12 dagen.
 *
 * Huis: 1R1C (C 20, UA 0,14, g 1,0), P_int gemiddeld ~0,34 kW met een ander dagritme dan het
 * profiel, modulerende warmtepomp (PI op de binnentemperatuur), eerste-orde afgifte, sensor 0,1 °C,
 * buiten van 13 naar 7 °C met dagritme en weersdrift. Geen tapwater (ADR-066 §1.2).
 */

const path = require('path');

const build = path.join(__dirname, '../../../.homeybuild/lib/shared/adaptive');
const { BuildingModelLearner, getPIntMultiplier } = require(path.join(build, 'building-model-learner'));
const { EmitterDelayEstimator } = require(path.join(build, 'emitter-delay'));
const { mulberry32 } = require('./house');

const TRUTH = { C: 20, UA: 0.14, g: 1.0, pIntBase: 0.35 };
const pIntPattern = (h) => (h >= 23 || h < 6 ? 0.5 : h < 18 ? 1.0 : 1.6);
const T0 = Date.UTC(2026, 9, 26, 0, 0);

function simulate({
  days, seed, lagMin, setback = false, pNoise = 0.05,
}) {
  const rnd = mulberry32(seed);
  const samples = [];
  let tIn = 21.6; let integ = 0.8; let emitter = 0.8; let drift = 0; let cloud = 0.5; let pIntNoise = 0;
  for (let m = 0; m <= days * 1440; m++) {
    const h = (m / 60) % 24;
    const d = m / 1440;
    if (m % 60 === 0) { drift = 0.97 * drift + (rnd() - 0.5) * 0.5; pIntNoise = (rnd() - 0.5) * 0.2; }
    if (m % 1440 === 0) cloud = 0.1 + 0.9 * rnd();
    const tOut = 13 - 6 * (d / days) + drift * 2 + 3 * Math.sin((2 * Math.PI * (h - 9)) / 24);
    const solar = h > 8 && h < 17 ? 450 * cloud * Math.sin((Math.PI * (h - 8)) / 9) : 0;
    const setpoint = setback && (h >= 22 || h < 7) ? 19 : 21.6;
    const err = setpoint - tIn;
    integ = Math.max(0, Math.min(6, integ + (err * 1.5) / 120));
    const p = Math.max(0, Math.min(6, 3 * err + integ));
    emitter += (p - emitter) / Math.max(1, lagMin);
    if (m % 5 === 0) {
      samples.push({
        timestamp: T0 + m * 60000,
        tIndoor: Math.round(tIn * 10) / 10,
        tOutdoor: tOut,
        pHeating: p * (1 + (rnd() - 0.5) * 2 * pNoise),
        solarRadiation: solar,
        pIntMultiplier: getPIntMultiplier(Math.floor(h)), // the learner uses the same profile rhythm
        deltaTPerHour: 0,
      });
    }
    const pInt = TRUTH.pIntBase * pIntPattern(h) + pIntNoise;
    tIn += ((emitter + TRUTH.UA * (tOut - tIn) + TRUTH.g * (solar / 1000) + pInt) / TRUTH.C) / 60;
  }
  return samples;
}

const SEEDS = [7, 11, 23, 42, 77, 101];
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const n = (v, d) => v.toFixed(d).replace('.', ',');

console.log('## 1. Gekozen vertraging (min) na 3, 7 en 14 dagen, 6 seeds\n');
console.log('werkelijk | scenario | 3 d | 7 d | 14 d');
console.log('--- | --- | --- | --- | ---');
for (const [lag, label, opts] of [
  [30, 'constant', {}],
  [90, 'constant', {}],
  [150, 'constant', {}],
  [240, 'constant', {}],
  [150, 'nachtverlaging', { setback: true }],
  [150, 'ruis 40%', { pNoise: 0.4 }],
]) {
  const cells = [3, 7, 14].map((days) => SEEDS.map((seed) => {
    const est = new EmitterDelayEstimator(60);
    for (const s of simulate({ days, seed, lagMin: lag, ...opts })) est.addSample(s);
    return est.getDelayMinutes();
  }).join(', '));
  console.log(`${lag} | ${label} | ${cells.join(' | ')}`);
}

console.log('\n## 2. Learner zonder en met filter (12 dagen, constant kamerdoel)\n');
console.log('werkelijk | filter | C | UA | P_int | τ (u)');
console.log('--- | --- | --- | --- | --- | ---');
for (const lag of [30, 120]) {
  for (const filter of [0, 60, 120]) {
    const models = SEEDS.slice(0, 4).map((seed) => {
      const L = new BuildingModelLearner({
        forgettingFactor: 0.999,
        initialCovariance: 100,
        minSamplesForConfidence: 288,
        buildingProfile: 'average',
        enableDynamicPInt: true,
        timeZone: 'UTC',
        emitterDelayMinutes: filter,
      });
      for (const s of simulate({ days: 12, seed, lagMin: lag })) L.addMeasurement(s);
      return L.getModel();
    });
    const a = (k) => mean(models.map((m) => m[k]));
    console.log(`${lag} | ${filter} | ${n(a('C'), 1)} | ${n(a('UA'), 3)} | ${n(a('pInt'), 2)} | ${n(a('tau'), 0)}`);
  }
}
console.log(`\nWerkelijk: C ${TRUTH.C}, UA ${TRUTH.UA}, P_int ~0,34 kW, τ ${Math.round(TRUTH.C / TRUTH.UA)} u.`);
