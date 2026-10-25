'use strict';

/**
 * ADR-064 §3.2 — warmte-invoer: ideaal, huidige momentopname en vensterintegratie.
 *   node test/simulation/building-model-review/adr064-heat.js <main|sens|clamp|bias|all>
 */

/**
 * ADR-064 prototype (scratchpad, not app code): measured window heat versus the current
 * momentary COP. Simulates a house with a hydronic circuit at 5-second resolution:
 *   - the heat pump cycles on a thermostat; produced heat P_th modulates around a set level
 *   - water flow 20 l/min while the compressor runs, 0 otherwise (with a start-up delay)
 *   - supply/return temperatures with natural variation, measured in WHOLE degrees
 *   - flow register in whole l/min
 * Heat inputs for the learner (all fed to the same compiled BuildingModelLearner):
 *   ideaal     — true delivered heat, averaged per 5-minute interval (upper bound)
 *   huidig     — current method: one rounded snapshot at the sample moment
 *                (compressor off → 0; compressor on but snapshot heat ≤ 0 or COP outlier → sample skipped)
 *   venster    — ADR-064: heat per 5-s poll from rounded values, integrated per 5-minute interval
 * The window design is emulated by feeding each sample the average over the interval that
 * follows it: the learner weights a sample's value over [t_j, t_j+1], so its window mean equals
 * window energy / window duration — the quantity the real implementation will supply.
 */


const { BuildingModelLearner } = require('../../../.homeybuild/lib/shared/adaptive/building-model-learner');
const MODE = process.argv[2] || 'main';

const K = 4.186 / 60; // kW per (l/min · K)
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

/**
 * Simulate one run. Returns 5-minute samples with the three heat inputs and the truth.
 * opts: { C, UA, pInt, tOutMean, days, seed, quant: 'round'|'floor'|'none', retVar, emitterH }
 */
function simulate(opts) {
  const {
    C, UA, pInt, tOutMean, days, seed, quant = 'round', retVar = 1.0, emitterH = 0, flowScale = 1, clampNeg = true, flowNom = 20, sensNoise = 0.05,
  } = opts;
  const rnd = mulberry32(seed);
  const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += rnd(); return s - 3; };
  const q = (x) => (quant === 'round' ? Math.round(x) : quant === 'floor' ? Math.floor(x) : x);
  const steps = (days * 86400) / DT_S;
  const perSample = SAMPLE_S / DT_S;
  let tIn = 21;
  let on = false;
  let runS = 0;
  let level = 4.5;
  let delivered = 0;
  let retWander = 0;
  const samples = [];
  let acc = { ideal: 0, poll: 0, n: 0 };
  let last = null;
  const t0 = Date.UTC(2026, 9, 1);
  for (let i = 0; i < steps; i++) {
    const h = (i * DT_S) / 3600;
    const tOut = tOutMean + 4 * Math.sin((2 * Math.PI * (h - 9)) / 24) + 1.5 * Math.sin(h / 37);
    const target = (h % 24) > 6 && (h % 24) < 23 ? 21.5 : 20.5;
    if (!on && tIn < target - 0.3) { on = true; runS = 0; level = Math.max(2, Math.min(8, 1.8 * UA * (target - tOut) + 2 + gauss() * 0.4)); }
    if (on && tIn > target + 0.3) on = false;
    if (on) runS += DT_S;
    const modulation = 1 + 0.08 * Math.sin(h * 7.3) + 0.05 * gauss();
    const produced = on ? Math.max(0, level * modulation) : 0; // kW thermal
    // Flow: pump starts with the compressor; first 30 s no measurable flow yet
    const flowTrue = on && runS > 30 ? flowNom + 0.6 * gauss() : 0;
    // Delivered heat: direct, or through a first-order emitter lag
    delivered += emitterH > 0 ? (produced - delivered) * (DT_S / 3600 / emitterH) : (produced - delivered);
    tIn += ((delivered - UA * (tIn - tOut) + pInt) / C) * (DT_S / 3600);
    // Hydronic temperatures: return wanders, supply = return + ΔT
    retWander += (gauss() * 0.05 - retWander * 0.002);
    const tRet = tIn + 8 + retVar * (Math.sin(h * 1.7) * 0.6 + retWander);
    const dTtrue = flowTrue > 0 ? produced / (flowTrue * K) : 0;
    const tSup = tRet + dTtrue;
    // Measured (whole degrees, whole l/min, small sensor noise before quantisation)
    const flowM = Math.round(flowTrue * flowScale); // flowScale < 1: register reads systematically low
    const dTm = q(tSup + gauss() * sensNoise) - q(tRet + gauss() * sensNoise);
    const pollHeat = flowM > 0 ? (clampNeg ? Math.max(0, flowM * dTm * K) : flowM * dTm * K) : 0;
    const cop = 2.6 + 0.09 * (tOut + 5);
    const pEl = on ? produced / cop + 0.02 : 0.011; // kW, kWh meter
    acc.ideal += produced; acc.poll += pollHeat; acc.n++;
    last = {
      on, flowM, dTm, pollHeat, pEl,
    };
    if ((i + 1) % perSample === 0) {
      samples.push({
        timestamp: t0 + (i + 1) * DT_S * 1000,
        tIndoor: Math.round(tIn * 10) / 10,
        tOutdoor: tOut,
        tInTrue: tIn,
        snapshot: { ...last },
        idealAvg: acc.ideal / acc.n, // average over the interval ending here
        pollAvg: acc.poll / acc.n,
      });
      acc = { ideal: 0, poll: 0, n: 0 };
    }
  }
  return samples;
}

/** Feed a variant to a fresh learner; returns the learned model and the share of skipped samples. */
function learn(samples, variant, profile = 'average') {
  const L = new BuildingModelLearner({
    forgettingFactor: 0.999, initialCovariance: 100, minSamplesForConfidence: 288, buildingProfile: profile, enableDynamicPInt: false,
  });
  let skipped = 0;
  for (let j = 0; j < samples.length - 1; j++) {
    const s = samples[j];
    const next = samples[j + 1]; // interval [t_j, t_j+1] → the learner weights sample j's value over it
    let p;
    if (variant === 'ideaal') p = next.idealAvg;
    else if (variant === 'venster') p = next.pollAvg;
    else {
      // huidig: snapshot at the sample moment
      const snap = s.snapshot;
      if (!snap.on) p = 0;
      else {
        const copSnap = snap.pollHeat / snap.pEl;
        if (snap.pollHeat <= 0 || copSnap > 8 || copSnap < 1) { skipped++; L.interruptWindow(); continue; }
        p = snap.pEl * copSnap; // = snapshot heat
      }
    }
    L.addMeasurement({
      timestamp: s.timestamp, tIndoor: s.tIndoor, tOutdoor: s.tOutdoor, pHeating: p, solarRadiation: 0, deltaTPerHour: 0,
    });
  }
  return { model: L.getModel(), skipped: skipped / (samples.length - 1) };
}

/** 6-hour open-loop prediction RMSE on a fresh holdout run, using the true heat. */
function predictionRmse(model, holdout) {
  let se = 0; let n = 0;
  const steps = 72;
  for (let start = 0; start + steps < holdout.length - 1; start += steps) {
    let T = holdout[start].tInTrue;
    for (let k = start; k < start + steps; k++) {
      const q = holdout[k + 1].idealAvg;
      T += ((q - model.UA * (T - holdout[k].tOutdoor) + model.pInt) / model.C) * (SAMPLE_S / 3600);
      const e = T - holdout[k + 1].tInTrue; se += e * e; n++;
    }
  }
  return Math.sqrt(se / n);
}

const TRUTH = { C: 20, UA: 0.3, pInt: 0.3 };
const SEEDS = [7, 11, 23, 42, 77];

function scenario(label, extra, variants = ['ideaal', 'huidig', 'venster']) {
  const rows = {};
  for (const v of variants) rows[v] = { C: [], UA: [], pInt: [], rmse: [], skip: [] };
  for (const seed of SEEDS) {
    const train = simulate({ ...TRUTH, days: 30, seed, ...extra });
    const hold = simulate({ ...TRUTH, days: 5, seed: seed + 1000, ...extra, emitterH: 0 });
    for (const v of variants) {
      const { model, skipped } = learn(train, v);
      rows[v].C.push(model.C); rows[v].UA.push(model.UA); rows[v].pInt.push(model.pInt);
      rows[v].rmse.push(predictionRmse(model, hold)); rows[v].skip.push(skipped);
    }
  }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log(`\n### ${label}`);
  console.log('variant | C (waar 20) | UA (waar 0,30) | P_int (waar 0,30) | RMSE 6 u (°C) | overgeslagen samples');
  console.log('--- | --- | --- | --- | --- | ---');
  for (const v of variants) {
    const r = rows[v];
    console.log(`${v} | ${avg(r.C).toFixed(1)} | ${avg(r.UA).toFixed(3)} | ${avg(r.pInt).toFixed(2)} | ${avg(r.rmse).toFixed(3)} | ${(100 * avg(r.skip)).toFixed(1)}%`);
  }
}

if (MODE === 'main' || MODE === 'all') {
  scenario('Mild 12 °C, hele graden (afronden), natuurlijke variatie', { tOutMean: 12, quant: 'round' });
  scenario('Koud 3 °C, hele graden (afronden)', { tOutMean: 3, quant: 'round' });
}
if (MODE === 'sens' || MODE === 'all') {
  scenario('Mild 12 °C, hele graden AFKAPPEN (floor)', { tOutMean: 12, quant: 'floor' });
  scenario('Mild 12 °C, hele graden, ZEER STABIELE temperaturen (weinig variatie)', { tOutMean: 12, quant: 'round', retVar: 0.05 });
  scenario('Mild 12 °C, GEEN afronding (0,1 °C-resolutie benaderd)', { tOutMean: 12, quant: 'none' });
  scenario('Mild 12 °C, hele graden, afgiftevertraging 3 u (vloer)', { tOutMean: 12, quant: 'round', emitterH: 3 });
}
if (MODE === 'clamp' || MODE === 'all') {
  scenario('Mild, hele graden, afkappen negatieve ΔT naar 0 (20 l/min)', { tOutMean: 12, quant: 'round' }, ['ideaal', 'venster']);
  scenario('Mild, hele graden, negatieve ΔT behouden (20 l/min)', { tOutMean: 12, quant: 'round', clampNeg: false }, ['ideaal', 'venster']);
  scenario('Mild, hele graden, sensorruis 0,4 K, 45 l/min, afkappen', { tOutMean: 12, quant: 'round', flowNom: 45, sensNoise: 0.4 }, ['ideaal', 'huidig', 'venster']);
  scenario('Mild, hele graden, sensorruis 0,4 K, 45 l/min, behouden', { tOutMean: 12, quant: 'round', flowNom: 45, sensNoise: 0.4, clampNeg: false }, ['ideaal', 'venster']);
  scenario('Mild, hele graden, afkappen, hoog debiet 45 l/min (kleine ΔT)', { tOutMean: 12, quant: 'round', flowNom: 45 }, ['ideaal', 'venster']);
  scenario('Mild, hele graden, behouden, hoog debiet 45 l/min (kleine ΔT)', { tOutMean: 12, quant: 'round', flowNom: 45, clampNeg: false }, ['ideaal', 'venster']);
}
if (MODE === 'bias' || MODE === 'all') {
  scenario('Mild 12 °C, hele graden, warmte systematisch 40% te laag gemeten (debiet × 0,6)', { tOutMean: 12, quant: 'round', flowScale: 0.6 });
}
