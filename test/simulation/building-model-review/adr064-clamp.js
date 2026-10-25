'use strict';

/**
 * ADR-064 §3.4 — negatieve ΔT: afkappen of meetellen (fout per poll, hele graden, onafhankelijke sensorruis).
 *   node test/simulation/building-model-review/adr064-clamp.js
 */
// Share of negative ΔT polls and heat bias from clamping, for the prototype's hydronic model
const K = 4.186 / 60;
function rng(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
for (const [flow, noise] of [[20, 0.05], [20, 0.4], [45, 0.4], [60, 0.4], [60, 0.7]]) {
  for (const P of [2, 4]) {
    const r = rng(1); const g = () => { let s = 0; for (let i = 0; i < 6; i++) s += r(); return s - 3; };
    let tru = 0; let keep = 0; let clamp = 0; let neg = 0; const N = 200000;
    for (let i = 0; i < N; i++) {
      const dT = P / (flow * K); const tRet = 29 + 3 * r();
      const m = Math.round(tRet + dT + g() * noise) - Math.round(tRet + g() * noise);
      tru += P; keep += flow * m * K; clamp += flow * Math.max(0, m) * K; if (m < 0) neg++;
    }
    console.log(`debiet ${flow} l/min, ruis ${noise} K, ${P} kW (ΔT ${(P / (flow * K)).toFixed(2)} K): negatief ${(100 * neg / N).toFixed(1)}% | behouden ${(100 * (keep / tru - 1)).toFixed(1)}% | afkappen ${(100 * (clamp / tru - 1)).toFixed(1)}%`);
  }
}
