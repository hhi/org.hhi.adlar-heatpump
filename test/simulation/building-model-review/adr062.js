'use strict';

/**
 * Aanvullende simulaties voor ADR-062.
 *   node test/simulation/building-model-review/adr062.js <b1|b2|b5|b3b6|all>
 * B1  — vensterlengte en -vorm (overlappend / blokken), zonder blokkades
 * B2  — het venster bij ontdooien en tapwater (poorten zoals Aurora II en Aurora III)
 * B5  — restore van een state die met de huidige code is geleerd
 * B3/B6 — rekentijd per update en confidence/trace
 */

const { simulateHouse, asLearnerInput, applyGates } = require('./house');
const { makeLearner, minEigen } = require('./learners');
const { runCase, table, COLS, fmt } = require('./run');

const SEEDS = [7, 11, 23, 42, 77];
const FIX = { psd: true, bounds: true, order: true };
const which = process.argv[2] || 'all';

const HOUSES = {
  S5: [{ C: 30, UA: 0.07, g: 0.6, pInt: 0.25 }, 'passive'],
  S1b: [{ C: 15, UA: 0.3, g: 0.5, pInt: 0.3 }, 'light'],
  S2: [{ C: 10, UA: 1.0, g: 0.4, pInt: 0.3 }, 'light'],
  S3: [{ C: 24, UA: 0.15, g: 0.5, pInt: 0.3 }, 'heavy'],
};

function run(title, variants, { houses = ['S1b', 'S2', 'S3'], tOutMean = 4, events = {}, gates = 'geen' } = {}) {
  console.log(`\n### ${title}\n`);
  for (const key of houses) {
    const [truth, profile] = HOUSES[key];
    const agg = [];
    for (const [label, opts] of variants) {
      const rows = SEEDS.map((seed) => {
        const raw = simulateHouse({ ...truth, days: 30, seed, tOutMean, events });
        const s = asLearnerInput(applyGates(raw, gates), 'realistisch');
        const h = simulateHouse({ ...truth, days: 5, seed: seed + 1000, tOutMean, events });
        return runCase(label, { profile, ...opts }, s, h, truth);
      });
      const avg = (k) => rows.reduce((a, r) => a + (r[k] ?? 0), 0) / rows.length;
      const absAvg = (k) => rows.reduce((a, r) => a + Math.abs(r[k]), 0) / rows.length;
      agg.push({
        label, C: avg('C'), UA: avg('UA'), tau: avg('tau'), errC: absAvg('errC'), errUA: absAvg('errUA'),
        rmse: avg('rmse'), reverts: Math.round(avg('reverts')), updates: Math.round(avg('updates')),
        negXPX: Math.round(avg('negXPX')), negEigUpdates: Math.round(avg('negEigUpdates')),
        minEig: Math.min(...rows.map((r) => r.minEig)), conf: avg('conf'), resets: Math.round(avg('windowResets')),
      });
    }
    console.log(`**${key}** (C=${truth.C}, UA=${truth.UA}; Tout gem. ${tOutMean} °C; events ${JSON.stringify(events)}; poorten ${gates})\n`);
    console.log(table(agg, [...COLS.filter(([n]) => !['XᵀPX<0', 'min eig P'].includes(n)), ['vensterresets', (r) => String(r.resets)]]));
    console.log('');
  }
}

if (which === 'b1' || which === 'all') {
  run('B1 Vensterlengte en -vorm (geen blokkades)', [
    ['huidig', {}],
    ['fixes + 30 min overlap', { ...FIX, windowMin: 30 }],
    ['fixes + 60 min overlap', { ...FIX, windowMin: 60 }],
    ['fixes + 60 min blok', { ...FIX, windowMin: 60, windowMode: 'block' }],
    ['fixes + 90 min overlap', { ...FIX, windowMin: 90 }],
  ]);
}

if (which === 'b2' || which === 'all') {
  const V = [
    ['huidig', {}],
    ['fixes + 30 min overlap', { ...FIX, windowMin: 30 }],
    ['fixes + 60 min overlap', { ...FIX, windowMin: 60 }],
    ['fixes + 60 min blok', { ...FIX, windowMin: 60, windowMode: 'block' }],
    ['fixes + 60 min overlap, reset bij elk ontbrekend sample', { ...FIX, windowMin: 60, maxGapMin: 7.5 }],
    ['fixes + 90 min overlap, reset bij elk ontbrekend sample', { ...FIX, windowMin: 90, maxGapMin: 7.5 }],
  ];
  const ev = { defrost: true, dhw: true };
  run('B2a Koud weer met ontdooien en tapwater, poorten Aurora III', V, { tOutMean: 0, events: ev, gates: 'A3' });
  run('B2b Koud weer met ontdooien en tapwater, poorten Aurora II (tapwater niet herkend)', V, { tOutMean: 0, events: ev, gates: 'A2' });
}

if (which === 'b5' || which === 'all') {
  console.log('\n### B5 Restore van een state die met de huidige code is geleerd\n');
  console.log('woning | oude state: τ / UA / min eig P | geldig met nieuwe grenzen | RMSE 6 u na 10 dagen: zonder restore | met restore + P-projectie | met restore, P ongewijzigd');
  console.log('--- | --- | --- | --- | --- | ---');
  for (const key of ['S1b', 'S2', 'S3', 'S5']) {
    const [truth, profile] = HOUSES[key];
    const res = { a: 0, b: 0, c: 0, valid: 0, tau: 0, ua: 0, eig: 0 };
    for (const seed of SEEDS) {
      const learnOld = asLearnerInput(simulateHouse({ ...truth, days: 30, seed }), 'realistisch');
      const old = makeLearner({ profile });
      for (const x of learnOld) old.addMeasurement(x);
      const st = JSON.parse(JSON.stringify(old.getState()));
      const m = old.getModel();
      res.tau += m.tau; res.ua += m.UA; res.eig = Math.min(res.eig, minEigen(st.P));
      const cont = asLearnerInput(simulateHouse({ ...truth, days: 10, seed: seed + 500 }), 'realistisch');
      const hold = simulateHouse({ ...truth, days: 5, seed: seed + 1000 });
      const { predictionRmse } = require('./run');
      const fresh = makeLearner({ profile, ...FIX, windowMin: 60 });
      for (const x of cont) fresh.addMeasurement(x);
      res.a += predictionRmse(fresh.getModel(), hold);
      const proj = makeLearner({ profile, ...FIX, windowMin: 60 });
      proj.restoreState({ ...st, lastMeasurement: null });
      if (proj.sampleCount > 0) res.valid++;
      proj.P = require('./learners').projectPsd(proj.P);
      for (const x of cont) proj.addMeasurement(x);
      res.b += predictionRmse(proj.getModel(), hold);
      const raw = makeLearner({ profile, ...FIX, windowMin: 60 });
      raw.restoreState({ ...st, lastMeasurement: null });
      for (const x of cont) raw.addMeasurement(x);
      res.c += predictionRmse(raw.getModel(), hold);
    }
    const n = SEEDS.length;
    console.log(`${key} | ${fmt(res.tau / n, 0)} h / ${fmt(res.ua / n, 3)} / ${fmt(res.eig, 2)} | ${res.valid}/${n} | ${fmt(res.a / n, 3)} | ${fmt(res.b / n, 3)} | ${fmt(res.c / n, 3)}`);
  }
}

if (which === 'b4' || which === 'all') {
  run(`B4 Passieve woning (τ ≈ 430 h), start op profiel passive (τ 600 h); TAU_MAX=${process.env.TAU_MAX || 500}`, [
    ['huidig', {}],
    ['fixes + 60 min overlap', { ...FIX, windowMin: 60, maxGapMin: 7.5 }],
  ], { houses: ['S5'] });
}

if (which === 'b3b6' || which === 'all') {
  console.log('\n### B3/B6 Rekentijd per update en confidence\n');
  const [truth, profile] = HOUSES.S1b;
  const s = asLearnerInput(simulateHouse({ ...truth, days: 30, seed: 7 }), 'realistisch');
  for (const [label, opts] of [['huidig', {}], ['fixes + 60 min overlap', { ...FIX, windowMin: 60 }]]) {
    const L = makeLearner({ profile, ...opts });
    const traces = [];
    const t0 = process.hrtime.bigint();
    let i = 0;
    for (const x of s) {
      L.addMeasurement(x);
      if (++i % 288 === 0) traces.push(L.P.reduce((a, r, k) => a + r[k], 0));
    }
    const ns = Number(process.hrtime.bigint() - t0);
    const updates = L.stats.updates + L.stats.reverts;
    console.log(`- ${label}: ${(ns / updates / 1000).toFixed(1)} µs per update (incl. meetcode met eigenwaarden), trace P per dag ${traces.map((x) => x.toFixed(3)).join(' ')}, confidence ${L.getModel().confidence.toFixed(0)}%`);
  }
  const { projectPsd } = require('./learners');
  const P = [[0.5, 0.1, 0.0, 0.2], [0.1, 0.3, 0.05, 0.0], [0.0, 0.05, 0.9, 0.1], [0.2, 0.0, 0.1, 0.7]];
  const n = 100000;
  const t1 = process.hrtime.bigint();
  for (let k = 0; k < n; k++) projectPsd(P);
  console.log(`- alleen de PSD-projectie (Jacobi 4×4): ${(Number(process.hrtime.bigint() - t1) / n / 1000).toFixed(2)} µs per aanroep (deze Mac)`);
}
