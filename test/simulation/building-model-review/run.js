'use strict';

const { simulateHouse, asLearnerInput } = require('./house');
const { makeLearner } = require('./learners');

const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : String(x));

function feed(L, samples) {
  const daily = [];
  let lastDay = -1;
  for (const s of samples) {
    L.addMeasurement(s);
    const day = Math.floor((s.timestamp - samples[0].timestamp) / 86400000);
    if (day !== lastDay) { lastDay = day; daily.push({ day, ...L.getModel() }); }
  }
  return daily;
}

/** Open-lus voorspelling: elke 6 uur starten vanaf de echte Tin, 6 uur vooruit met echte invoer. */
function predictionRmse(model, holdout) {
  let se = 0; let n = 0;
  const steps = 72; // 6 h
  for (let start = 0; start + steps < holdout.length; start += steps) {
    let T = holdout[start].tIndoorTrue;
    for (let k = start; k < start + steps; k++) {
      const s = holdout[k];
      const nxt = holdout[k + 1].mean; // werkelijke invoer over het komende interval
      const dTdt = (nxt.p + model.UA * (s.tOutdoor - T) + model.g * (nxt.solar / 1000) + model.pInt) / model.C;
      T += dTdt * (5 / 60);
      const e = T - holdout[k + 1].tIndoorTrue;
      se += e * e; n++;
    }
  }
  return Math.sqrt(se / n);
}

function runCase(label, learnerOpts, samples, holdout, truth) {
  const L = makeLearner(learnerOpts);
  const daily = feed(L, samples);
  const m = L.getModel();
  return {
    label,
    C: m.C, UA: m.UA, tau: m.tau, pInt: m.pInt, conf: m.confidence,
    errC: (m.C - truth.C) / truth.C * 100,
    errUA: (m.UA - truth.UA) / truth.UA * 100,
    rmse: predictionRmse(m, holdout),
    ...L.stats,
    daily,
    learner: L,
  };
}

function table(rows, cols) {
  const head = cols.map((c) => c[0]);
  const lines = [head.join(' | '), head.map(() => '---').join(' | ')];
  for (const r of rows) lines.push(cols.map(([, f]) => f(r)).join(' | '));
  return lines.join('\n');
}

const COLS = [
  ['variant', (r) => r.label],
  ['C', (r) => fmt(r.C, 1)],
  ['UA', (r) => fmt(r.UA, 3)],
  ['τ (h)', (r) => fmt(r.tau, 0)],
  ['fout C %', (r) => fmt(r.errC, 0)],
  ['fout UA %', (r) => fmt(r.errUA, 0)],
  ['RMSE 6h (°C)', (r) => fmt(r.rmse, 2)],
  ['reverts', (r) => String(r.reverts)],
  ['updates', (r) => String(r.updates)],
  ['XᵀPX<0', (r) => String(r.negXPX)],
  ['P niet-PSD', (r) => String(r.negEigUpdates)],
  ['min eig P', (r) => fmt(r.minEig, 3)],
  ['conf %', (r) => fmt(r.conf, 0)],
];

module.exports = { asLearnerInput, runCase, table, COLS, fmt, predictionRmse, feed, simulateHouse, makeLearner };
