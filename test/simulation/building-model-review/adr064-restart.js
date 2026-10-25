'use strict';

/**
 * ADR-064 §3.5/§3.6 — herstel vanuit de stand van de testinstallatie en verse start na een volledige reset.
 *   DYN=1 node test/simulation/building-model-review/adr064-restart.js   (DYN=1: dynamische P_int aan)
 */
// Does a learner that starts from the installation's current state (θ from building_model_diagnostics,
// 25 Oct 2026) move back to the true house with clean data? Real outdoor series, ideal heat,
// truth C 20 / UA 0,30 / P_int 0,30. P is not exported (only P_diag rounded to 3 decimals),
// so several start covariances are tried.
const path = require('path');
const fs = require('fs');
const { BuildingModelLearner } = require('../../../.homeybuild/lib/shared/adaptive/building-model-learner');
const TOUT = JSON.parse(fs.readFileSync(path.join(__dirname, 'adr064-buitentemp-2026-10-18.json'), 'utf8')).slice(0, 168);
const THETA = [0.037858, 0.014989, 0.013145, 0.046989];
const DT_S = 5; const SAMPLE_S = 300;
function rng(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const toutAt = (h) => { const i = Math.floor(h) % 168; const f = h - Math.floor(h); return TOUT[i] * (1 - f) + TOUT[(i + 1) % 168] * f; };
function run(seed, pDiag, days) {
  const C = 20; const UA = 0.3; const pInt = 0.3;
  const r = rng(seed); const g = () => { let s = 0; for (let i = 0; i < 6; i++) s += r(); return s - 3; };
  const L = new BuildingModelLearner({ forgettingFactor: 0.999, initialCovariance: 100, minSamplesForConfidence: 288, buildingProfile: 'average', enableDynamicPInt: process.env.DYN === '1' });
  if (pDiag !== null) {
    L.theta = [...THETA];
    L.P = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => (i === j ? (i === 2 ? 0.099 : pDiag) : 0)));
  }
  let tIn = 21.7; let on = false; let level = 3; let acc = 0; let n = 0; let prev = null;
  const out = [];
  const steps = (days * 86400) / DT_S;
  for (let i = 0; i < steps; i++) {
    const h = (i * DT_S) / 3600; const tOut = toutAt(h);
    const target = (h % 24) > 6 && (h % 24) < 23 ? 21.8 : 21.4;
    if (!on && tIn < target - 0.2) { on = true; level = Math.max(2, Math.min(8, 1.8 * UA * (target - tOut) + 2 + g() * 0.4)); }
    if (on && tIn > target + 0.2) on = false;
    const q = on ? Math.max(0, level * (1 + 0.08 * Math.sin(h * 7.3) + 0.05 * g())) : 0;
    tIn += ((q - UA * (tIn - tOut) + pInt) / C) * (DT_S / 3600);
    acc += q; n++;
    if ((i + 1) % (SAMPLE_S / DT_S) === 0) {
      const cur = { timestamp: Date.UTC(2026, 9, 1) + (i + 1) * DT_S * 1000, tIndoor: Math.round(tIn * 10) / 10, tOutdoor: tOut };
      if (prev) L.addMeasurement({ ...prev, pHeating: acc / n, solarRadiation: 0, deltaTPerHour: 0 });
      prev = cur; acc = 0; n = 0;
    }
    if ((i + 1) % ((86400 * 2) / DT_S) === 0) out.push({ day: (i + 1) * DT_S / 86400, ...L.getModel() });
  }
  return out;
}
const start = new BuildingModelLearner({ forgettingFactor: 0.999, initialCovariance: 100, minSamplesForConfidence: 288, buildingProfile: 'average', enableDynamicPInt: process.env.DYN === '1' });
start.theta = [...THETA];
const s0 = start.getModel();
console.log(`start (installatie) | C ${s0.C.toFixed(1)} | UA ${s0.UA.toFixed(3)} | P_int ${s0.pInt.toFixed(2)} | τ ${s0.tau.toFixed(0)}`);
for (const pd of [null, 1e-2, 1e-3, 1e-4]) {
  const runs = [7, 11, 23].map((s) => run(s, pd, 28));
  const label = pd === null ? 'vers (profiel)' : `start installatie, P_diag ${pd}`;
  const rows = runs[0].map((_, k) => {
    const a = (f) => runs.reduce((x, r) => x + f(r[k]), 0) / runs.length;
    return `d${runs[0][k].day}: C ${a((m) => m.C).toFixed(1)} UA ${a((m) => m.UA).toFixed(3)} P_int ${a((m) => m.pInt).toFixed(2)}`;
  });
  console.log(`${label}\n  ${rows.filter((_, k) => [0, 1, 2, 4, 6, 9, 13].includes(k)).join('\n  ')}`);
}
