'use strict';

/**
 * ADR-062 B13 — P-update met de werkelijk genomen stap (effectieve gain).
 * Subklasse van de gecompileerde learner; alleen updateRLS() is vervangen.
 *   mirror    — de huidige code, opnieuw geschreven (controle: gelijk aan de echte learner)
 *   effDiag   — K_eff = s ⊙ K met s_i = werkelijke stap / volle stap per component (B13)
 *   effScalar — K_eff = s · K met één factor: projectie van de werkelijke stap op de volle stap
 * Beide eff-varianten gebruiken de Joseph-vorm, die P voor elke gain PSD houdt:
 *   P⁺ = [(I − K_eff Xᵀ) P (I − K_eff Xᵀ)ᵀ + λ K_eff K_effᵀ] / λ
 * (met K_eff = K gelijk aan de standaardupdate (P − K Xᵀ P) / λ).
 *   npm run build
 *   node test/simulation/building-model-review/adr062-b13.js <check|regress|matrix|restart> [varianten]
 */

const path = require('path');

const mode = process.argv[2] || 'check';
const { BuildingModelLearner } = require('../../../.homeybuild/lib/shared/adaptive/building-model-learner');
const { simulateHouse, asLearnerInput, applyGates } = require('./house');
const { predictionRmse } = require('./run');

class ProtoLearner extends BuildingModelLearner {
  constructor(config, variant) {
    super(config);
    this.variant = variant;
    this.limitedSteps = 0;
    this.sSum = 0;
  }

  updateRLS(X, y) {
    const { lambda } = this;
    const prediction = this.dotProduct(X, this.theta);
    this.recordResidual(y - prediction);
    const PX = this.matrixVectorMultiply(this.P, X);
    const denominator = lambda + this.dotProduct(X, PX);
    const K = PX.map((val) => val / denominator);
    const error = y - prediction;
    const thetaPrevious = [...this.theta];
    const step = K.map((k) => k * error);
    this.theta = this.theta.map((val, i) => val + step[i]);

    const violations = BuildingModelLearner.thetaViolations(this.theta);
    const stuck = violations.length > 0
      && this.consecutiveReverts >= BuildingModelLearner.BOUNDED_STEP.AFTER_CONSECUTIVE_REVERTS
      && BuildingModelLearner.thetaViolations(thetaPrevious).length === 0;
    if (stuck) {
      const alpha = BuildingModelLearner.largestValidFraction(thetaPrevious, step);
      this.theta = thetaPrevious.map((val, i) => val + alpha * step[i]);
      this.boundedSteps++;
    } else if (violations.length > 0) {
      this.theta = thetaPrevious;
      this.consecutiveReverts++;
      this.totalReverts++;
      return;
    }
    this.consecutiveReverts = 0;

    let rateLimited = false;
    for (let i = 0; i < 4; i++) {
      const maxChange = Math.abs(thetaPrevious[i]) * 0.05;
      const actualChange = this.theta[i] - thetaPrevious[i];
      if (Math.abs(actualChange) > maxChange && maxChange > 0) {
        this.theta[i] = thetaPrevious[i] + Math.sign(actualChange) * maxChange;
        rateLimited = true;
      }
    }
    if (rateLimited) this.rateLimitActivations++;

    if (this.variant === 'mirror') {
      const KXP = this.matrixMultiply(this.outerProduct(K, X), this.P);
      const updated = this.P.map((row, i) => row.map((val, j) => (val - KXP[i][j]) / lambda));
      this.P = BuildingModelLearner.projectCovariance(updated);
      return;
    }

    // Effective gain: the fraction of the full Kalman step that θ actually took
    const actual = this.theta.map((v, i) => v - thetaPrevious[i]);
    let Keff;
    if (this.variant === 'effDiag') {
      Keff = K.map((k, i) => (step[i] !== 0 ? k * Math.max(0, Math.min(1, actual[i] / step[i])) : k));
    } else {
      const ss = step.reduce((a, v) => a + v * v, 0);
      const s = ss > 0 ? Math.max(0, Math.min(1, step.reduce((a, v, i) => a + v * actual[i], 0) / ss)) : 1;
      Keff = K.map((k) => k * s);
    }
    if (rateLimited || stuck) {
      this.limitedSteps++;
      this.sSum += Keff.reduce((a, k, i) => a + (K[i] !== 0 ? k / K[i] : 1), 0) / 4;
    }
    // Joseph form
    const A = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => (i === j ? 1 : 0) - Keff[i] * X[j]));
    const AP = this.matrixMultiply(A, this.P);
    const APAt = AP.map((row, i) => row.map((_, j) => row.reduce((acc, v, k) => acc + v * A[j][k], 0)));
    const updated = APAt.map((row, i) => row.map((v, j) => (v + lambda * Keff[i] * Keff[j]) / lambda));
    this.P = BuildingModelLearner.projectCovariance(updated);
  }
}

const SEEDS = [7, 11, 23, 42, 77];
const WEATHER = { warm: [4, {}, 'geen'], koudA3: [0, { defrost: true, dhw: true }, 'A3'], koudA2: [0, { defrost: true, dhw: true }, 'A2'] };
const HOUSES = {
  licht: { C: 7, UA: 0.35, g: 0.4, pInt: 0.3 },
  gemiddeld: { C: 15, UA: 0.3, g: 0.5, pInt: 0.3 },
  lek: { C: 10, UA: 1.0, g: 0.4, pInt: 0.3 },
  zwaar: { C: 24, UA: 0.15, g: 0.5, pInt: 0.3 },
  passief: { C: 30, UA: 0.07, g: 0.6, pInt: 0.25 },
};
const cfg = (profile) => ({
  forgettingFactor: 0.999, initialCovariance: 100, minSamplesForConfidence: 288, buildingProfile: profile, enableDynamicPInt: false,
});
const make = (variant, profile) => (variant === 'real' ? new BuildingModelLearner(cfg(profile)) : new ProtoLearner(cfg(profile), variant));
const trace = (P) => P.reduce((a, r, i) => a + r[i], 0);

function run(variant, truth, profile, w, days = [1, 30]) {
  const [tOut, ev, gates] = WEATHER[w];
  const acc = days.map(() => ({ rmse: 0, ua: 0, pint: 0 }));
  let reverts = 0; let bounded = 0; let stuck = 0; let tr = 0; let limited = 0; let sMean = 0;
  for (const seed of SEEDS) {
    const L = make(variant, profile);
    const s = asLearnerInput(applyGates(simulateHouse({ ...truth, days: Math.max(...days), seed, tOutMean: tOut, events: ev }), gates), 'realistisch');
    const h = simulateHouse({ ...truth, days: 5, seed: seed + 1000, tOutMean: tOut, events: ev });
    const t0 = s[0].timestamp; let next = 0;
    for (const x of s) {
      L.addMeasurement(x);
      while (next < days.length && (x.timestamp - t0) / 86400000 >= days[next]) {
        const m = L.getModel();
        acc[next].rmse += predictionRmse(m, h);
        acc[next].ua += Math.abs(m.UA - truth.UA) / truth.UA;
        acc[next].pint += Math.abs(m.pInt - truth.pInt);
        next++;
      }
    }
    const m = L.getModel(); if (Math.abs(m.UA - truth.UA) / truth.UA > 0.25) stuck++;
    const d = L.getExcitationDiagnostics();
    reverts += d.totalReverts; bounded += L.boundedSteps; tr += trace(L.P);
    limited += L.limitedSteps || 0; sMean += L.limitedSteps ? L.sSum / L.limitedSteps : 0;
  }
  const n = SEEDS.length;
  return {
    d: acc.map((a) => ({ rmse: a.rmse / n, ua: 100 * a.ua / n, pint: a.pint / n })),
    reverts: Math.round(reverts / n), bounded: Math.round(bounded / n), stuck, trace: tr / n, limited: Math.round(limited / n), s: sMean / n,
  };
}
const f = (x, d = 4) => x.toFixed(d);
const PROFILE_OF = { licht: 'light', gemiddeld: 'average', lek: 'light', zwaar: 'heavy', passief: 'passive' };

if (mode === 'check') {
  console.log('## Controle: prototype "mirror" tegen de echte learner (RMSE dag 30, reverts, bounded, trace P)');
  let ok = true;
  for (const [k, t] of Object.entries(HOUSES)) {
    for (const w of Object.keys(WEATHER)) {
      const a = run('real', t, PROFILE_OF[k], w, [30]);
      const b = run('mirror', t, PROFILE_OF[k], w, [30]);
      const same = a.d[0].rmse === b.d[0].rmse && a.reverts === b.reverts && a.bounded === b.bounded && a.trace === b.trace;
      ok = ok && same;
      console.log(`${k} ${w}: echt ${f(a.d[0].rmse)} rv${a.reverts} b${a.bounded} | mirror ${f(b.d[0].rmse)} rv${b.reverts} b${b.bounded} ${same ? '✔ gelijk' : '✖ VERSCHIL'}`);
    }
  }
  console.log(ok ? 'Alles gelijk' : 'VERSCHIL GEVONDEN');
}

const VARIANTS = (process.argv[3] || 'mirror,effDiag,effScalar').split(',');

if (mode === 'regress') {
  const SC = { S1: ['gemiddeld', 'average'], S1b: ['gemiddeld', 'light'], S2: ['lek', 'light'], S3: ['zwaar', 'heavy'], S5: ['passief', 'passive'] };
  for (const w of Object.keys(WEATHER)) {
    console.log(`\n## S1–S5 ${w}: RMSE 6 u dag 30 · |UA-fout| % · |P_int-fout| kW · reverts/bounded · trace P · afgeremde stappen (gem. s)`);
    console.log(`scenario | ${VARIANTS.join(' | ')}`);
    for (const [s, [k, p]] of Object.entries(SC)) {
      const cells = VARIANTS.map((v) => {
        const r = run(v, HOUSES[k], p, w, [30]);
        return `${f(r.d[0].rmse, 3)} · ${r.d[0].ua.toFixed(0)}% · ${r.d[0].pint.toFixed(2)} · ${r.reverts}/${r.bounded} · ${r.trace.toExponential(1)}${v === 'mirror' ? '' : ` · ${r.limited} (${r.s.toFixed(2)})`}`;
      });
      console.log(`${s} | ${cells.join(' | ')}`);
    }
  }
}

if (mode === 'matrix') {
  for (const w of ['warm', 'koudA3']) {
    console.log(`\n## Matrix ${w}: RMSE dag 1 / dag 30, ❌n = runs (van 5) met UA-fout > 25% op dag 30`);
    console.log(`woning | start | ${VARIANTS.join(' | ')}`);
    for (const [k, t] of Object.entries(HOUSES)) {
      for (const p of ['light', 'average', 'heavy', 'passive']) {
        const cells = VARIANTS.map((v) => {
          const r = run(v, t, p, w);
          return `${r.d[0].rmse.toFixed(3)} / ${r.d[1].rmse.toFixed(3)}${r.stuck ? ` ❌${r.stuck}` : ''}`;
        });
        console.log(`${k} | ${p} | ${cells.join(' | ')}`);
      }
    }
  }
}

if (mode === 'restart') {
  // As adr064-restart.js: real outdoor series, ideal heat, truth C 20 / UA 0,30 / P_int 0,30, start from the installation's θ
  const fs = require('fs');
  const TOUT = JSON.parse(fs.readFileSync(path.join(__dirname, 'adr064-buitentemp-2026-10-18.json'), 'utf8')).slice(0, 168);
  const THETA = [0.037858, 0.014989, 0.013145, 0.046989];
  const toutAt = (h) => { const i = Math.floor(h) % 168; const fr = h - Math.floor(h); return TOUT[i] * (1 - fr) + TOUT[(i + 1) % 168] * fr; };
  const rng = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const restart = (variant, seed, pDiag) => {
    const C = 20; const UA = 0.3; const pInt = 0.3;
    const r = rng(seed); const g = () => { let s = 0; for (let i = 0; i < 6; i++) s += r(); return s - 3; };
    const L = make(variant, 'average');
    if (pDiag !== null) { L.theta = [...THETA]; L.P = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => (i === j ? (i === 2 ? 0.099 : pDiag) : 0))); }
    let tIn = 21.7; let on = false; let level = 3; let acc = 0; let n = 0; let prev = null; const out = {};
    const DT = 5; const steps = (28 * 86400) / DT;
    for (let i = 0; i < steps; i++) {
      const h = (i * DT) / 3600; const tOut = toutAt(h);
      const target = (h % 24) > 6 && (h % 24) < 23 ? 21.8 : 21.4;
      if (!on && tIn < target - 0.2) { on = true; level = Math.max(2, Math.min(8, 1.8 * UA * (target - tOut) + 2 + g() * 0.4)); }
      if (on && tIn > target + 0.2) on = false;
      const q = on ? Math.max(0, level * (1 + 0.08 * Math.sin(h * 7.3) + 0.05 * g())) : 0;
      tIn += ((q - UA * (tIn - tOut) + pInt) / C) * (DT / 3600);
      acc += q; n++;
      if ((i + 1) % 60 === 0) {
        const cur = { timestamp: Date.UTC(2026, 9, 1) + (i + 1) * DT * 1000, tIndoor: Math.round(tIn * 10) / 10, tOutdoor: tOut };
        if (prev) L.addMeasurement({ ...prev, pHeating: acc / n, solarRadiation: 0, deltaTPerHour: 0 });
        prev = cur; acc = 0; n = 0;
      }
      const day = (i + 1) * DT / 86400;
      if ([2, 6, 14, 28].includes(day)) out[day] = L.getModel();
    }
    return out;
  };
  for (const pd of [null, 1e-2, 1e-3, 1e-4]) {
    console.log(`\n## ${pd === null ? 'Verse start (profiel average)' : `Start installatiestand, P_diag ${pd}`}: C · UA · P_int (gem. 3 seeds)`);
    console.log(`variant | dag 2 | dag 6 | dag 14 | dag 28`);
    for (const v of VARIANTS) {
      const runs = [7, 11, 23].map((s) => restart(v, s, pd));
      const cell = (d) => { const a = (k) => runs.reduce((x, r) => x + r[d][k], 0) / runs.length; return `${a('C').toFixed(1)} · ${a('UA').toFixed(3)} · ${a('pInt').toFixed(2)}`; };
      console.log(`${v} | ${[2, 6, 14, 28].map(cell).join(' | ')}`);
    }
  }
}
