'use strict';

/**
 * ADR-064 §3.3 — identificeerbaarheid van UA en P_int (synthetische buitentemperatuur).
 *   node test/simulation/building-model-review/adr064-ident.js <var|offset|all>
 */

/**
 * Identifiability prototype (scratchpad, not app code): how far UA and P_int trade off when
 * T_in − T_out hardly varies, and what an indoor sensor offset does. Same house and thermostat
 * as adr064-heat.js, 5-s steps, 5-minute samples, ideal (true, interval-averaged) heat as input,
 * so only identification is tested, not the heat measurement.
 * Reports per scenario (mean over seeds): C, UA, P_int, τ, the identifiable combination
 * P_int − UA × D̄ (D̄ = mean T_in − T_out), and the correlation of θ2 (UA/C) and θ4 (P_int/C)
 * in the learner's covariance matrix P at the end of the run.
 */


const { BuildingModelLearner } = require('../../../.homeybuild/lib/shared/adaptive/building-model-learner');

const DT_S = 5;
const SAMPLE_S = 300;

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** opts: { C, UA, pInt, tOutMean, ampDay, ampSlow, days, seed, setback, sensorOffset } */
function simulate(opts) {
  const {
    C, UA, pInt, tOutMean, ampDay, ampSlow, days, seed, setback = 1, sensorOffset = 0,
  } = opts;
  const rnd = mulberry32(seed);
  const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += rnd(); return s - 3; };
  const steps = (days * 86400) / DT_S;
  const perSample = SAMPLE_S / DT_S;
  let tIn = 21;
  let on = false;
  let level = 4.5;
  let acc = 0; let n = 0;
  const samples = [];
  const t0 = Date.UTC(2026, 9, 1);
  for (let i = 0; i < steps; i++) {
    const h = (i * DT_S) / 3600;
    const tOut = tOutMean + ampDay * Math.sin((2 * Math.PI * (h - 9)) / 24) + ampSlow * Math.sin(h / 37);
    const day = (h % 24) > 6 && (h % 24) < 23;
    const target = day ? 21.5 : 21.5 - setback;
    if (!on && tIn < target - 0.3) { on = true; level = Math.max(2, Math.min(8, 1.8 * UA * (target - tOut) + 2 + gauss() * 0.4)); }
    if (on && tIn > target + 0.3) on = false;
    const produced = on ? Math.max(0, level * (1 + 0.08 * Math.sin(h * 7.3) + 0.05 * gauss())) : 0;
    tIn += ((produced - UA * (tIn - tOut) + pInt) / C) * (DT_S / 3600);
    acc += produced; n++;
    if ((i + 1) % perSample === 0) {
      samples.push({
        timestamp: t0 + (i + 1) * DT_S * 1000,
        tIndoor: Math.round((tIn + sensorOffset) * 10) / 10, // measured, 0.1 °C
        tOutdoor: tOut,
        tInTrue: tIn,
        heatAvg: acc / n,
      });
      acc = 0; n = 0;
    }
  }
  return samples;
}

function learn(samples) {
  const L = new BuildingModelLearner({
    forgettingFactor: 0.999, initialCovariance: 100, minSamplesForConfidence: 288, buildingProfile: 'average', enableDynamicPInt: false,
  });
  for (let j = 0; j < samples.length - 1; j++) {
    const s = samples[j];
    L.addMeasurement({
      timestamp: s.timestamp, tIndoor: s.tIndoor, tOutdoor: s.tOutdoor, pHeating: samples[j + 1].heatAvg, solarRadiation: 0, deltaTPerHour: 0,
    });
  }
  const { P } = L; // private in TS, plain field in the compiled JS
  const corr = P[1][3] / Math.sqrt(P[1][1] * P[3][3]);
  return { model: L.getModel(), corr };
}

const TRUTH = { C: 20, UA: 0.3, pInt: 0.3 };
const SEEDS = [7, 11, 23, 42, 77];
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = avg(a); return Math.sqrt(avg(a.map((x) => (x - m) ** 2))); };

console.log('scenario | σ(T_in−T_out) °C | D̄ °C | C (20) | UA (0,30) | P_int (0,30) | τ (67 u) | P_int − UA·D̄ (waar) | corr θ2–θ4');
console.log('--- | --- | --- | --- | --- | --- | --- | --- | ---');

function scenario(label, extra) {
  const r = {
    C: [], UA: [], pInt: [], tau: [], combo: [], comboTrue: [], corr: [], sdD: [], D: [],
  };
  for (const seed of SEEDS) {
    const s = simulate({ ...TRUTH, days: 30, seed, ...extra });
    const D = s.map((x) => x.tInTrue - x.tOutdoor);
    const Dm = avg(D);
    const { model, corr } = learn(s);
    r.C.push(model.C); r.UA.push(model.UA); r.pInt.push(model.pInt); r.tau.push(model.tau);
    r.combo.push(model.pInt - model.UA * Dm); r.comboTrue.push(TRUTH.pInt - TRUTH.UA * Dm);
    r.corr.push(corr); r.sdD.push(sd(D)); r.D.push(Dm);
  }
  const f = (x, d) => x.toFixed(d).replace('.', ',');
  console.log(`${label} | ${f(avg(r.sdD), 2)} | ${f(avg(r.D), 1)} | ${f(avg(r.C), 1)} | ${f(avg(r.UA), 3)} | ${f(avg(r.pInt), 2)} | ${f(avg(r.tau), 0)} | ${f(avg(r.combo), 2)} (${f(avg(r.comboTrue), 2)}) | ${f(avg(r.corr), 3)}`);
}

const MODE = process.argv[2] || 'all';
if (MODE === 'var' || MODE === 'all') {
  scenario('A1 buiten ±4 dag, ±1,5 traag', { tOutMean: 11, ampDay: 4, ampSlow: 1.5 });
  scenario('A2 buiten ±2 dag, ±0,5 traag', { tOutMean: 11, ampDay: 2, ampSlow: 0.5 });
  scenario('A3 buiten ±1 dag, ±0,25 traag', { tOutMean: 11, ampDay: 1, ampSlow: 0.25 });
  scenario('A4 buiten ±0,3 dag, geen traag', { tOutMean: 11, ampDay: 0.3, ampSlow: 0 });
  scenario('A5 = A3 + nachtverlaging 2 °C', { tOutMean: 11, ampDay: 1, ampSlow: 0.25, setback: 2 });
}
if (MODE === 'offset' || MODE === 'all') {
  scenario('B1 binnensensor +1 °C (buiten ±4)', { tOutMean: 11, ampDay: 4, ampSlow: 1.5, sensorOffset: 1 });
  scenario('B2 binnensensor −1 °C (buiten ±4)', { tOutMean: 11, ampDay: 4, ampSlow: 1.5, sensorOffset: -1 });
  scenario('B3 binnensensor +1 °C (buiten ±1)', { tOutMean: 11, ampDay: 1, ampSlow: 0.25, sensorOffset: 1 });
}
