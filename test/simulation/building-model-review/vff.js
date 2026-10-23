'use strict';

// §2.8 — Volgt de learner een verandering van de woning (na-isolatie: UA 0,30 → 0,20 op dag 20)?
const { simulateHouse, asLearnerInput } = require('./house');
const { makeLearner } = require('./learners');

const truth = { C: 15, UA: 0.3, g: 0.5, pInt: 0.3 };
const SEEDS = [7, 11, 23, 42, 77];
const best = { psd: true, bounds: true, order: true, window: 12 };
const variants = [
  ['huidig, λ 0,999', { lambda: 0.999 }],
  ['fixes+venster, λ 0,999 (VFF zoals nu: inert)', { ...best, lambda: 0.999 }],
  ['fixes+venster, λ 0,999 + VFF-voorstel', { ...best, lambda: 0.999, vff: true }],
  ['fixes+venster, λ-instelling 0,995 (VFF dan actief)', { ...best, lambda: 0.995 }],
];

console.log('variant | UA dag 19 | UA dag 25 | UA dag 30 | UA dag 50 | dagen tot |UA−0,20| < 10% | λ gem. | λ min');
console.log('--- | --- | --- | --- | --- | --- | --- | ---');
for (const [label, opts] of variants) {
  const acc = { d19: 0, d25: 0, d30: 0, d50: 0, reach: [], lamAvg: 0, lamMin: 1 };
  for (const seed of SEEDS) {
    const s = asLearnerInput(simulateHouse({ ...truth, days: 50, seed, change: { atDay: 20, UA: 0.2 } }), 'realistisch');
    const L = makeLearner({ profile: 'average', ...opts });
    const t0 = s[0].timestamp;
    let reach = null;
    for (const x of s) {
      L.addMeasurement(x);
      const day = (x.timestamp - t0) / 86400000;
      if (Number.isInteger(day)) {
        const ua = L.getModel().UA;
        if (day === 19) acc.d19 += ua;
        if (day === 25) acc.d25 += ua;
        if (day === 30) acc.d30 += ua;
        if (day === 50) acc.d50 += ua;
        if (day > 20 && reach === null && Math.abs(ua - 0.2) / 0.2 < 0.1) reach = day - 20;
      }
    }
    acc.reach.push(reach === null ? '>30' : String(reach));
    const lams = L.stats.lambdas;
    if (lams.length) {
      acc.lamAvg += lams.reduce((a, b) => a + b, 0) / lams.length;
      acc.lamMin = Math.min(acc.lamMin, ...lams);
    } else {
      acc.lamAvg += opts.lambda; acc.lamMin = Math.min(acc.lamMin, opts.lambda);
    }
  }
  const n = SEEDS.length;
  console.log([label, (acc.d19 / n).toFixed(3), (acc.d25 / n).toFixed(3), (acc.d30 / n).toFixed(3), (acc.d50 / n).toFixed(3),
    acc.reach.join(' / '), (acc.lamAvg / n).toFixed(4), acc.lamMin.toFixed(4)].join(' | '));
}
