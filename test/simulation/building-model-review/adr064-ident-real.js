'use strict';

/**
 * ADR-064 §3.5 — identificatie met de gemeten buitentemperatuur, sensorafwijking en radiatorvertraging.
 *   node test/simulation/building-model-review/adr064-ident-real.js <offset|lag>
 */
// Identification with the real hourly outdoor series (Self-Hosted Server, 18–25 Oct 2026),
// repeated to 28 days and linearly interpolated; otherwise as adr064-ident.js (ideal heat).
// Optional: first-order emitter lag (emitterH, hours) between produced and delivered heat,
// and a heat measurement factor (heatScale) on the heat fed to the learner.
const path = require('path');
const fs = require('fs');
const { BuildingModelLearner } = require('../../../.homeybuild/lib/shared/adaptive/building-model-learner');
const TOUT = JSON.parse(fs.readFileSync(path.join(__dirname, 'adr064-buitentemp-2026-10-18.json'), 'utf8')).slice(0, 168);
const DT_S = 5; const SAMPLE_S = 300;
function rng(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const toutAt = (h) => { const i = Math.floor(h) % 168; const f = h - Math.floor(h); return TOUT[i] * (1 - f) + TOUT[(i + 1) % 168] * f; };
function run(seed, sensorOffset = 0, emitterH = 0, heatScale = 1) {
  const C = 20; const UA = 0.3; const pInt = 0.3;
  const r = rng(seed); const g = () => { let s = 0; for (let i = 0; i < 6; i++) s += r(); return s - 3; };
  const L = new BuildingModelLearner({ forgettingFactor: 0.999, initialCovariance: 100, minSamplesForConfidence: 288, buildingProfile: 'average', enableDynamicPInt: false });
  let tIn = 21.7; let delivered = 0; let on = false; let level = 3; let acc = 0; let n = 0; let prev = null; const D = [];
  const steps = (28 * 86400) / DT_S;
  for (let i = 0; i < steps; i++) {
    const h = (i * DT_S) / 3600; const tOut = toutAt(h);
    const target = (h % 24) > 6 && (h % 24) < 23 ? 21.8 : 21.4;
    if (!on && tIn < target - 0.2) { on = true; level = Math.max(2, Math.min(8, 1.8 * UA * (target - tOut) + 2 + g() * 0.4)); }
    if (on && tIn > target + 0.2) on = false;
    const q = on ? Math.max(0, level * (1 + 0.08 * Math.sin(h * 7.3) + 0.05 * g())) : 0;
    delivered += emitterH > 0 ? (q - delivered) * Math.min(1, DT_S / 3600 / emitterH) : (q - delivered);
    tIn += ((delivered - UA * (tIn - tOut) + pInt) / C) * (DT_S / 3600);
    acc += q; n++;
    if ((i + 1) % (SAMPLE_S / DT_S) === 0) {
      const cur = { timestamp: Date.UTC(2026, 9, 1) + (i + 1) * DT_S * 1000, tIndoor: Math.round((tIn + sensorOffset) * 10) / 10, tOutdoor: tOut };
      if (prev) L.addMeasurement({ ...prev, pHeating: (acc / n) * heatScale, solarRadiation: 0, deltaTPerHour: 0 });
      prev = cur; acc = 0; n = 0; D.push(tIn - tOut);
    }
  }
  const m = L.getModel(); const { P } = L;
  const mean = D.reduce((a, b) => a + b, 0) / D.length;
  const sd = Math.sqrt(D.reduce((a, b) => a + (b - mean) ** 2, 0) / D.length);
  return { m, corr: P[1][3] / Math.sqrt(P[1][1] * P[3][3]), sd, mean };
}
const MODE = process.argv[2] || 'offset';
const cases = MODE === 'lag'
  ? [[0, 0, 1], [0, 0.25, 1], [0, 0.5, 1], [0, 0.75, 1], [0, 1, 1], [0, 3, 1], [0, 0, 0.6], [0, 0.5, 0.6], [0, 1, 0.6]]
  : [[0, 0, 1], [1, 0, 1], [2, 0, 1]];
for (const [off, lag, hs] of cases) {
  const rs = [7, 11, 23, 42, 77].map((s) => run(s, off, lag, hs));
  const a = (f) => rs.reduce((x, y) => x + f(y), 0) / rs.length;
  const rng2 = (f, d) => `${Math.min(...rs.map(f)).toFixed(d)}–${Math.max(...rs.map(f)).toFixed(d)}`;
  console.log(`sensor +${off} °C | vertraging ${Math.round(lag * 60)} min | warmte ×${hs} | C ${a((r) => r.m.C).toFixed(1)} | UA ${a((r) => r.m.UA).toFixed(3)} (${rng2((r) => r.m.UA, 3)}) | P_int ${a((r) => r.m.pInt).toFixed(2)} (${rng2((r) => r.m.pInt, 2)}) | τ ${a((r) => r.m.tau).toFixed(0)} | corr ${a((r) => r.corr).toFixed(3)}`);
}
