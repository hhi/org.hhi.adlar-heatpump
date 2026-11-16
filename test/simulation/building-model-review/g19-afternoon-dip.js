'use strict';

/**
 * G19: dagpatroon in τ. Gebruikt de gecompileerde learner uit .homeybuild (eerst `npm run build`).
 *
 *   node test/simulation/building-model-review/g19-afternoon-dip.js
 *
 * Vraag: zakt τ elke middag doordat de binnentemperatuur rond zonsondergang sneller daalt dan één
 * warmtemassa toelaat, en maakt de ondergrens van de covariantie (P_FLOOR) die reactie zo snel?
 *
 * Huis met twee warmtemassa's: lucht (sensor) en bouwmassa.
 *   Ca·dTa/dt = fAir·P + H·(Tm − Ta) + UAa·(Tout − Ta) + gain + pInt − window
 *   Cm·dTm/dt = (1 − fAir)·P + H·(Ta − Tm) + UAm·(Tout − Tm)
 * Met H zeer groot gedraagt het huis zich als één massa (controle).
 *
 * De learner krijgt de horizontale zonstraling; de werkelijke winst valt door verticaal glas en
 * houdt bij lage zon langer aan. Dat verschil is bewust: het is wat het model niet kan weten.
 */

const path = require('path');

const build = path.join(__dirname, '../../../.homeybuild/lib/shared/adaptive');
const { BuildingModelLearner } = require(path.join(build, 'building-model-learner'));
const { mulberry32 } = require('./house');

const T0 = Date.UTC(2026, 10, 2, 0, 0);
const DAYS = 16;
const FIRST_DAY = 8; // days before this one are learning time
const SEEDS = [7, 11, 23, 42];

const HOUSE = {
  Ca: 1.2, Cm: 17, H: 1.5, UAa: 0.07, UAm: 0.10, fAir: 0.5, pInt: 0.25, lagMin: 45,
};

const SCENARIOS = [
  { label: 'één massa, zon', house: { H: 40 }, cloud: 1 },
  { label: 'twee massa\'s, zon', house: {}, cloud: 1 },
  {
    label: 'twee massa\'s, veel zon', house: {}, cloud: 1, gainPeak: 2,
  },
  {
    label: 'twee massa\'s, veel zon, aan/uit', house: {}, cloud: 1, gainPeak: 2, onOff: true,
  },
  { label: 'twee massa\'s, bewolkt', house: {}, cloud: 0.25 },
  { label: 'twee massa\'s, geen zon', house: {}, cloud: 0 },
  {
    label: 'twee massa\'s, geen zon, aan/uit', house: {}, cloud: 0, onOff: true,
  },
  {
    label: 'twee massa\'s, geen zon, raam 15:00–15:40', house: {}, cloud: 0, windowUA: 0.12,
  },
];

function simulate({
  house, cloud, windowUA = 0, gainPeak = 0.9, onOff = false, seed,
}) {
  const h = { ...HOUSE, ...house };
  const rnd = mulberry32(seed);
  const samples = [];
  let ta = 21.5; let tm = 21.3; let integ = 1.2; let emitter = 1.2; let drift = 0; let sky = cloud; let on = true;
  for (let m = 0; m <= DAYS * 1440; m++) {
    const hour = (m / 60) % 24;
    if (m % 60 === 0) drift = 0.97 * drift + (rnd() - 0.5) * 0.4;
    if (m % 1440 === 0) sky = cloud * (0.7 + 0.3 * rnd());
    const tOut = 8 + drift * 2 + 2.5 * Math.sin((2 * Math.PI * (hour - 9)) / 24);
    // Horizontal radiation (what the learner gets): November, daylight 08:00–16:30, peak 200 W/m².
    const daylight = hour > 8 && hour < 16.5;
    const solar = daylight ? 200 * sky * Math.sin((Math.PI * (hour - 8)) / 8.5) : 0;
    // Real gain through vertical south glazing: flatter over the day, ends at sunset.
    const gain = daylight ? gainPeak * sky * Math.sin((Math.PI * (hour - 8)) / 8.5) ** 0.4 : 0;
    const windowLoss = hour >= 15 && hour < 15 + 40 / 60 ? windowUA * (ta - tOut) : 0;
    const err = 21.5 - ta;
    integ = Math.max(0, Math.min(6, integ + (err * 1.5) / 120));
    if (err > 0.2) on = true;
    if (err < -0.2) on = false;
    let p = Math.max(0, Math.min(6, 3 * err + integ));
    if (onOff) p = on ? 3.5 : 0;
    emitter += (p - emitter) / h.lagMin;
    if (m % 5 === 0) {
      samples.push({
        timestamp: T0 + m * 60000,
        tIndoor: Math.round(ta * 10) / 10,
        tOutdoor: tOut,
        pHeating: p,
        solarRadiation: solar,
        deltaTPerHour: 0,
      });
    }
    const dTa = (h.fAir * emitter + h.H * (tm - ta) + h.UAa * (tOut - ta) + gain + h.pInt - windowLoss) / h.Ca;
    const dTm = ((1 - h.fAir) * emitter + h.H * (ta - tm) + h.UAm * (tOut - tm)) / h.Cm;
    ta += dTa / 60;
    tm += dTm / 60;
  }
  return samples;
}

/** Per day: τ and UA at 14:00, the lowest τ until 19:00, the fastest indoor drop over 40 minutes. */
function analyse(samples) {
  const learner = new BuildingModelLearner({
    forgettingFactor: 0.999,
    initialCovariance: 100,
    minSamplesForConfidence: 288,
    buildingProfile: 'average',
    enableDynamicPInt: true,
    timeZone: 'UTC',
    emitterDelayMinutes: 45,
  });
  const days = [];
  let hourly = []; // |Δτ| per hour outside 14:00–19:00
  let prevHourTau = null;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    learner.addMeasurement(s);
    const minute = Math.round((s.timestamp - T0) / 60000);
    const day = Math.floor(minute / 1440);
    const hour = (minute % 1440) / 60;
    if (day < FIRST_DAY || day >= DAYS) continue;
    if (!Number.isInteger(hour) && (hour < 14 || hour > 19)) continue;
    const model = learner.getModel();
    if (!days[day]) {
      days[day] = {
        tauBefore: null, uaBefore: null, cBefore: null, tauMin: Infinity, uaAtMin: null, cAtMin: null, drop: 0, pSum: 0, pN: 0,
      };
    }
    const d = days[day];
    if (hour === 14) {
      d.tauBefore = model.tau; d.uaBefore = model.UA; d.cBefore = model.C;
    }
    if (hour >= 14.5 && hour < 16.5) {
      d.pSum += s.pHeating; d.pN++;
    }
    if (hour >= 14 && hour <= 19) {
      if (model.tau < d.tauMin) {
        d.tauMin = model.tau; d.uaAtMin = model.UA; d.cAtMin = model.C;
      }
      if (i >= 8) d.drop = Math.max(d.drop, samples[i - 8].tIndoor - s.tIndoor);
    }
    if (Number.isInteger(hour)) {
      if (prevHourTau !== null && (hour <= 14 || hour > 19)) hourly.push(Math.abs(model.tau / prevHourTau - 1));
      prevHourTau = model.tau;
    }
  }
  const used = days.filter((d) => d && d.tauBefore !== null);
  hourly = hourly.length > 0 ? hourly : [0];
  return {
    days: used,
    dip: used.map((d) => 1 - d.tauMin / d.tauBefore),
    hourly: hourly.reduce((a, b) => a + b, 0) / hourly.length,
    tau: learner.getModel().tau,
  };
}

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const n = (v, d) => v.toFixed(d).replace('.', ',');
const pct = (v) => `${n(v * 100, 0)}%`;

function table(title) {
  console.log(`\n## ${title}\n`);
  console.log('scenario | daling binnen in 40 min (°C) | middagdaling τ gem. | grootste | rest van de dag, per uur | τ eind (u)');
  console.log('--- | --- | --- | --- | --- | ---');
  for (const sc of SCENARIOS) {
    const runs = SEEDS.map((seed) => analyse(simulate({ ...sc, seed })));
    const dips = runs.flatMap((r) => r.dip);
    const drops = runs.flatMap((r) => r.days.map((d) => d.drop));
    console.log([
      sc.label,
      n(mean(drops), 2),
      pct(mean(dips)),
      pct(Math.max(...dips)),
      pct(mean(runs.map((r) => r.hourly))),
      n(mean(runs.map((r) => r.tau)), 0),
    ].join(' | '));
  }
}

const { RLS_COVARIANCE } = BuildingModelLearner;
const floor = RLS_COVARIANCE.P_FLOOR;

table(`1. Huidige learner (P_FLOOR ${floor}), dag ${FIRST_DAY + 1}–${DAYS}, ${SEEDS.length} seeds`);

console.log(`\n## 2. Eén reeks: ${SCENARIOS[3].label}, seed 7\n`);
console.log('dag | daling binnen (°C) | vermogen 14:30–16:30 (kW) | τ 14:00 (u) | τ laagst (u) | daling τ | UA 14:00 | UA laagst | C 14:00 | C laagst');
console.log('--- | --- | --- | --- | --- | --- | --- | --- | --- | ---');
for (const [i, d] of analyse(simulate({ ...SCENARIOS[3], seed: 7 })).days.entries()) {
  console.log([
    FIRST_DAY + i + 1, n(d.drop, 1), n(d.pSum / d.pN, 1), n(d.tauBefore, 0), n(d.tauMin, 0), pct(1 - d.tauMin / d.tauBefore),
    n(d.uaBefore, 3), n(d.uaAtMin, 3), n(d.cBefore, 1), n(d.cAtMin, 1),
  ].join(' | '));
}

// Diagnosis only, not a proposal: the same runs with a 100× lower floor on the covariance.
RLS_COVARIANCE.P_FLOOR = floor / 100;
table(`3. Zelfde reeksen met P_FLOOR ${RLS_COVARIANCE.P_FLOOR} (alleen diagnose)`);
RLS_COVARIANCE.P_FLOOR = floor;
