'use strict';

/**
 * Closed-loop simulatie van de adaptieve regeling: PI-alleen, PI + coast en PI met een
 * smallere dode zone, op een woning met watercircuit en een warmtepomp met interne
 * thermostaat op het setpoint.
 *
 *   npm run build
 *   node test/simulation/coast-closed-loop.js [radiator|vloer|all]
 *   SENS=1 [FLOW=beperkt] node test/simulation/coast-closed-loop.js
 *   TRACE=<dag> VARIANT='<naam>' FLOW=<direct|beperkt> node test/simulation/coast-closed-loop.js radiator
 *
 * Fysica (stap 30 s):
 *   - woning: C · dT/dt = He·(Tw − Tin) − UA·(Tin − Tout) + P_int + zon
 *   - watercircuit: Cw · dTw/dt = Q_wp − He·(Tw − Tin)
 *   - warmtepomp: inverter stuurt de uitlaat naar het setpoint, Q ∈ [Qmin, Qmax];
 *     start bij uitlaat < setpoint − 2 (na ≥ 5 min uit), stopt bij Qmin en uitlaat > setpoint + 1
 *     (na ≥ 10 min aan); COP als fractie van Carnot
 *   - buitentemperatuur: gemeten reeks van de testinstallatie (adr064-buitentemp-2026-10-18.json)
 *   - zon: op een deel van de dagen een halve sinus rond 13:00 (de oorzaak van overshoot)
 * Regeling (elke 5 min), de gecompileerde HeatingController en WeightedDecisionMaker:
 *   - incrementeel (huidige code): coast, accumulator, afronding, begrenzing en verrekening
 *     zoals in adaptive-control-service.ts (Aurora II); advies = setpoint + round(accumulator)
 *   - positioneel (alternatief): advies = stooklijn + gewogen PI-uitvoer; binnen de deadband
 *     blijft de laatste PI-uitvoer staan; coast trekt het advies naar uitlaat − offset
 *   - positioneel met integraal (alternatief, PII): advies = stooklijn + Kp·e + I, met een echte
 *     integraal en anti-windup; coast verdringt de PI zoals in de WeightedDecisionMaker
 *   - stooklijn: het setpoint waarbij de woning zonder zon op 21 °C blijft, plus een vaste
 *     afwijking (radiator +2 K, vloer +1 K), zoals een iets te hoog ingestelde stooklijn
 *   - flow: direct (elk gewijzigd advies) of beperkt (hooguit 1 °C per 30 min richting het advies)
 *   - binnentemperatuur gemeten op 0,1 °C, uitlaat op hele graden; geen COP-, prijs- of
 *     thermische component (confidence 0), zoals bij een nieuw model
 */

const fs = require('fs');
const path = require('path');

const { HeatingController } = require('../../.homeybuild/lib/modbus/adaptive/heating-controller');
const { WeightedDecisionMaker } = require('../../.homeybuild/lib/modbus/adaptive/weighted-decision-maker');

const TOUT = JSON.parse(fs.readFileSync(path.join(__dirname, 'building-model-review/adr064-buitentemp-2026-10-18.json'), 'utf8')).slice(0, 168);
const DT = 30; // s
const CYCLE = 300; // s
const DAYS = 14;
const SEEDS = [7, 11, 23, 42, 77];
const TARGET = 21;

const EMITTERS = {
  radiator: {
    He: 0.25, Cw: 0.25, sp0: 35, curveBias: 2, label: 'Radiatoren (He 0,25 kW/K, Cw 0,25 kWh/K)',
  },
  vloer: {
    He: 0.6, Cw: 4.0, sp0: 27, curveBias: 1, label: 'Vloerverwarming (He 0,6 kW/K, Cw 4 kWh/K)',
  },
};
const HOUSE = { C: 20, UA: 0.3, pInt: 0.3 };
const HP = {
  flowK: 20 * (4.186 / 60), Qmin: 2, Qmax: 7, startBelow: 2, stopAbove: 1, minOffS: 300, minOnS: 600,
};
// Coast-instellingen (standaard) en constanten uit adaptive-control-service.ts
const COAST = {
  offset: 1.0, hysteresis: 0.3, strength: 0.8, maxCycles: 24, stepLimit: -1.5, staleThreshold: 0.5, trendN: 3, outletN: 4,
};
const ACC_CLAMP = 2.0;
const SP_MIN = 20; // vloerverwarming 20–60 en adaptive_min_setpoint 18 → 20
const SP_MAX = 60;
const FLOW_LIMIT = { step: 1, everyCycles: 6 }; // beperkte flow: 1 °C per 30 min

const VARIANTS = {
  'incr. PI (huidig)': { mode: 'incr', coast: false, ua: 0.40, tau: 67 },
  'incr. PI + coast (huidig)': { mode: 'incr', coast: true, ua: 0.40, tau: 67 },
  'incr. PI smal': { mode: 'incr', coast: false, ua: 0, tau: 0 },
  'incr. PI smal + coast': { mode: 'incr', coast: true, ua: 0, tau: 0 },
  'pos. PI': { mode: 'pos', coast: false, ua: 0.40, tau: 67 },
  'pos. PI + coast': { mode: 'pos', coast: true, ua: 0.40, tau: 67 },
  'pos. PI smal': { mode: 'pos', coast: false, ua: 0, tau: 0 },
  'pos. PI smal + coast': { mode: 'pos', coast: true, ua: 0, tau: 0 },
  'pos. PI-I': { mode: 'posI', coast: false, ua: 0, tau: 0 },
  'pos. PI-I + coast': { mode: 'posI', coast: true, ua: 0, tau: 0 },
  'alleen stooklijn': { mode: 'curve', coast: false, ua: 0, tau: 0 },
};
// Positional PI with a true integral (alternative, not in the app):
//   u = Kp·e + I, I += Ki·e per cycle; Kp 3 K/K (= Kp 5 × comfort anchor 0,6), Ti 3 h
//   anti-windup: I begrensd op ±6 K, u op ±8 K; geen integratie binnen ±0,1 °C, tijdens coast,
//   en zolang het setpoint meer dan 1 °C van het advies af staat (flow loopt achter) of het
//   advies tegen een setpointgrens staat in de richting van de fout
const PII = {
  Kp: 3, Ki: 3 / 36, Imax: 6, Umax: 8, deadband: 0.1,
};

function rng(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const toutAt = (h) => {
  const i = Math.floor(h) % 168; const f = h - Math.floor(h);
  return TOUT[i] * (1 - f) + TOUT[(i + 1) % 168] * f;
};

/** Heating curve: the outlet setpoint that keeps the house at TARGET without sun, plus a bias. */
function curve(em, tOut, bias = em.curveBias) {
  const q = Math.max(0, HOUSE.UA * (TARGET - tOut) - HOUSE.pInt);
  return TARGET + q / em.He + q / (2 * HP.flowK) + bias;
}

/** One run; returns the comfort, coast and heat-pump statistics. */
async function simulate(variantName, emitterName, seed, flow = 'direct', opts = {}) {
  // opts (gevoeligheid): Kp, Ti (uren), bias (stooklijnafwijking K), toutShift (K op de buitenreeks)
  const P = { ...PII, ...(opts.Kp !== undefined ? { Kp: opts.Kp } : {}) };
  P.Ki = P.Kp / ((opts.Ti ?? 3) * 12);
  const bias = opts.bias;
  const shift = opts.toutShift ?? 0;
  const v = VARIANTS[variantName];
  const em = EMITTERS[emitterName];
  const r = rng(seed);
  const sunny = Array.from({ length: DAYS }, () => r() < 0.5);
  const sunPeak = Array.from({ length: DAYS }, () => 1.5 + 1.5 * r()); // kW piek
  const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += r(); return s - 3; };

  const pi = new HeatingController({ Kp: 5, Ki: 1.5, deadband: 0.3 });
  pi.setThermalInertia(v.tau);
  pi.setDynamicDeadbandUA(v.ua);
  const dm = new WeightedDecisionMaker({
    comfort: 0.60, efficiency: 0.25, cost: 0.15, thermal: 0.20,
  });
  const metrics = { copConfidence: 0, priceDataAvailable: false, buildingModelConfidence: 0 };

  // Physical state
  let tIn = TARGET; let tw = TARGET + 12; let on = false; let onS = 0; let offS = 1e9;
  let sp = v.mode === 'incr' ? em.sp0 : Math.round(curve(em, toutAt(0) + shift, bias));
  // Controller state
  let acc = 0; let lastObserved = null; let lastRecommended;
  let coastActive = false; let cooldownCount = 0; let coastCycles = 0;
  let piHeld = 0; let cycleNo = 0; let lastFlowCycle = -1e9;
  let integ = 0; let lastRecRaw = null; // posI: integral state and last unrounded recommendation
  const inHist = []; const outHist = [];
  // Statistics
  const st = {
    starts: 0, heatKwh: 0, elKwh: 0, sumSq: 0, n: 0, over05: 0, under05: 0, maxOver: [], minUnder: [],
    coastOnCycles: 0, exits: { hard: 0, soft: 0, watchdog: 0 }, afterExitMin: [], spChanges: 0, spMin: Infinity, spMax: -Infinity,
  };
  let exitWatch = null; // { untilS, min }
  let dayMax = -Infinity; let dayMin = Infinity;

  const steps = (DAYS * 86400) / DT;
  for (let i = 0; i < steps; i++) {
    const tS = i * DT; const h = tS / 3600; const day = Math.floor(h / 24); const hod = h % 24;
    const tOut = toutAt(h) + shift;
    const sun = sunny[day] && hod > 9 && hod < 17 ? sunPeak[day] * Math.sin(((hod - 9) / 8) * Math.PI) : 0;

    // --- Heat pump (internal thermostat on the outlet) ---
    const k2 = 2 * HP.flowK;
    let q = 0;
    if (on) {
      q = Math.max(HP.Qmin, Math.min(HP.Qmax, k2 * (sp - tw)));
      const outlet = tw + q / k2;
      if (onS >= HP.minOnS && k2 * (sp - tw) <= HP.Qmin && outlet > sp + HP.stopAbove) { on = false; offS = 0; q = 0; }
    } else if (offS >= HP.minOffS && tw < sp - HP.startBelow) {
      on = true; onS = 0; st.starts++;
      q = Math.max(HP.Qmin, Math.min(HP.Qmax, k2 * (sp - tw)));
    }
    if (on) onS += DT; else offS += DT;
    const outletTrue = tw + q / k2;
    const cop = Math.max(1.5, Math.min(7, 0.45 * (outletTrue + 273.15) / Math.max(5, outletTrue - tOut + 5)));
    st.heatKwh += q * DT / 3600; st.elKwh += (q > 0 ? q / cop : 0) * DT / 3600;

    // --- Water loop and house ---
    const qEm = em.He * (tw - tIn);
    tw += ((q - qEm) / em.Cw) * (DT / 3600);
    tIn += ((qEm - HOUSE.UA * (tIn - tOut) + HOUSE.pInt + sun) / HOUSE.C) * (DT / 3600);

    // --- Comfort statistics (true temperature) ---
    const e = tIn - TARGET;
    st.sumSq += e * e; st.n++;
    if (e > 0.5) st.over05 += DT / 3600;
    if (e < -0.5) st.under05 += DT / 3600;
    dayMax = Math.max(dayMax, e); dayMin = Math.min(dayMin, e);
    if ((i + 1) % (86400 / DT) === 0) { st.maxOver.push(dayMax); st.minUnder.push(dayMin); dayMax = -Infinity; dayMin = Infinity; }
    if (exitWatch) {
      exitWatch.min = Math.min(exitWatch.min, e);
      if (tS >= exitWatch.untilS) { st.afterExitMin.push(exitWatch.min); exitWatch = null; }
    }

    // --- Control cycle every 5 minutes (as executeControlCycle) ---
    if ((i + 1) % (CYCLE / DT) !== 0) continue;
    cycleNo++;
    const indoorM = Math.round((tIn + 0.03 * gauss()) * 10) / 10;
    const outletM = Math.round(outletTrue);
    const base = curve(em, tOut, bias);

    // Settlement on observation (ADR-059 W1)
    if (lastObserved !== null && sp !== lastObserved) {
      const applied = sp - lastObserved;
      if (lastRecommended !== undefined && Math.abs(sp - lastRecommended) <= 1.0) acc -= applied;
    }
    lastObserved = sp;

    inHist.push(indoorM); if (inHist.length > COAST.trendN) inHist.shift();
    // _computeCoastAdjustment (incremental: relative to the current setpoint)
    outHist.push(outletM); if (outHist.length > COAST.outletN) outHist.shift();
    const dropRate = outHist.length < COAST.outletN ? 0 : (outHist[outHist.length - 1] - outHist[0]) / COAST.outletN;
    const mult = dropRate < 0 ? Math.max(0.3, 1.0 + dropRate * 0.5) : 1.0;
    // posI: PI output from the previous cycle's state (for the coast reference)
    const ePos = TARGET - indoorM;
    const uPrev = Math.max(-P.Umax, Math.min(P.Umax, P.Kp * ePos + integ));
    let coastAdj;
    if (v.mode === 'posI') {
      coastAdj = Math.min(0, (outletM - COAST.offset) - (base + uPrev)) * mult;
    } else if (v.mode === 'pos') {
      // Positional: relative to what the curve plus PI alone would ask; the flow limits the rate
      coastAdj = Math.min(0, (outletM - COAST.offset) - (base + 0.6 * piHeld)) * mult;
    } else {
      const raw = (outletM - COAST.offset) - sp;
      coastAdj = Math.max(COAST.stepLimit, Math.min(0, raw)) * mult;
    }

    if (v.coast) {
      const exitAt = (kind) => {
        pi.resetHistory(); coastActive = false; cooldownCount = 0; coastCycles = 0; st.exits[kind]++;
        if (v.mode === 'pos' && process.env.POS_EXIT_RESET === '1') piHeld = 0;
        exitWatch = { untilS: tS + 6 * 3600, min: Infinity };
      };
      if (coastActive && indoorM < TARGET + COAST.hysteresis / 2) exitAt('hard');
      const falling = inHist.length >= COAST.trendN && inHist[inHist.length - 1] < inHist[0];
      if (coastActive && falling && Math.abs(coastAdj) < COAST.staleThreshold) exitAt('soft');
      if (coastActive && coastCycles >= COAST.maxCycles) exitAt('watchdog');
      if (!coastActive) {
        const rising = inHist.length < COAST.trendN ? true : inHist[inHist.length - 1] >= inHist[0];
        if (indoorM > TARGET + COAST.hysteresis && rising) cooldownCount++; else cooldownCount = 0;
        coastActive = cooldownCount >= 2;
        if (coastActive) coastCycles = 0;
      }
      if (coastActive) { coastCycles++; st.coastOnCycles++; }
    }

    let heatingAction = await pi.calculateAction({ indoorTemp: indoorM, targetTemp: TARGET, timestamp: tS * 1000 });
    if (v.mode === 'pos') {
      // Positional: inside the deadband the last PI output stays (frozen), it does not drop to 0
      if (heatingAction) piHeld = heatingAction.temperatureAdjustment;
      heatingAction = {
        temperatureAdjustment: piHeld, reason: 'pos', priority: 'medium', controller: 'heating',
      };
    }
    const coastAction = (v.coast && coastActive) ? {
      adjustment: coastAdj, reason: 'coast', priority: 'high', strength: COAST.strength,
    } : null;
    const combined = dm.combineActionsWithThermal(heatingAction, null, null, null, metrics, coastAction);

    let recommended;
    if (v.mode === 'incr') {
      acc = Math.max(-ACC_CLAMP, Math.min(ACC_CLAMP, acc + combined.finalAdjustment));
      recommended = Math.max(SP_MIN, Math.min(SP_MAX, sp + Math.round(acc)));
    } else if (v.mode === 'pos') {
      recommended = Math.max(SP_MIN, Math.min(SP_MAX, Math.round(base + combined.finalAdjustment)));
    } else if (v.mode === 'posI') {
      // Conditional integration (anti-windup)
      const flowBehind = lastRecRaw !== null && Math.abs(sp - Math.round(lastRecRaw)) > 1;
      const atLimit = lastRecRaw !== null
        && ((lastRecRaw >= SP_MAX && ePos > 0) || (lastRecRaw <= SP_MIN && ePos < 0));
      const freezeInCoast = v.coast && coastActive && process.env.COAST_INTEGRATE !== '1';
      if (Math.abs(ePos) > P.deadband && !freezeInCoast && !flowBehind && !atLimit) {
        integ = Math.max(-P.Imax, Math.min(P.Imax, integ + P.Ki * ePos));
      }
      const u = Math.max(-P.Umax, Math.min(P.Umax, P.Kp * ePos + integ));
      // Coast displaces the PI as in the decision maker: (1 − strength)·u + strength·coastAdj,
      // only while coast actually contributes (coastAdj < 0, ADR-040A)
      const corr = (v.coast && coastActive && coastAdj < 0) ? (1 - COAST.strength) * u + COAST.strength * coastAdj : u;
      lastRecRaw = base + corr;
      recommended = Math.max(SP_MIN, Math.min(SP_MAX, Math.round(lastRecRaw)));
    } else {
      recommended = Math.max(SP_MIN, Math.min(SP_MAX, Math.round(base)));
    }
    if (lastRecommended === undefined) lastRecommended = sp;
    const changed = recommended !== lastRecommended;
    lastRecommended = recommended;
    // The user flow applies the recommendation: directly when it changes, or limited to 1 °C per 30 min
    let next = sp;
    if (flow === 'direct') {
      if (changed || v.mode !== 'incr') next = recommended;
    } else if (recommended !== sp && cycleNo - lastFlowCycle >= FLOW_LIMIT.everyCycles) {
      next = sp + Math.sign(recommended - sp) * Math.min(FLOW_LIMIT.step, Math.abs(recommended - sp));
      lastFlowCycle = cycleNo;
    }
    if (next !== sp) { sp = next; st.spChanges++; }
    st.spMin = Math.min(st.spMin, sp); st.spMax = Math.max(st.spMax, sp);

    // TRACE=<dag> prints every cycle of that day for the first seed
    if (process.env.TRACE && Number(process.env.TRACE) === day && seed === SEEDS[0]) {
      console.log(`${hod.toFixed(2).padStart(5)} h | Tin ${tIn.toFixed(2)} | Tw ${tw.toFixed(1)} | uit ${outletM} | sp ${sp} | wp ${on ? 'aan' : 'uit'} ${q.toFixed(1)} kW`
        + ` | zon ${sun.toFixed(1)} | PI ${heatingAction ? heatingAction.temperatureAdjustment.toFixed(2) : '—'} | totaal ${combined.finalAdjustment.toFixed(2)}`
        + ` | advies ${recommended} | stooklijn ${base.toFixed(1)}${coastActive ? ' | COAST' : ''}`);
    }
  }
  return st;
}

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',') : '—');

async function main() {
  const which = process.argv[2] || 'all';
  const emitters = which === 'all' ? Object.keys(EMITTERS) : [which];
  const flows = (process.env.FLOWS || 'direct,beperkt').split(',');
  for (const em of emitters) {
    for (const flow of flows) {
      console.log(`\n### ${EMITTERS[em].label}; flow ${flow === 'direct' ? 'direct' : 'hooguit 1 °C per 30 min'}; ${DAYS} dagen, ${SEEDS.length} seeds, doel ${TARGET} °C, zon op ~50% van de dagen\n`);
      console.log('variant | RMSE (°C) | max boven doel/dag | uren > +0,5 /dag | min onder doel/dag | uren < −0,5 /dag | min ≤ 6 u na coast-exit | starts/dag | kWh el/dag | coast-uren/dag | setpoint min–max | setpointwijzigingen/dag');
      console.log('--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---');
      for (const name of Object.keys(VARIANTS)) {
        const runs = [];
        for (const seed of SEEDS) runs.push(await simulate(name, em, seed, flow));
        const a = (fn) => avg(runs.map(fn));
        console.log([
          name,
          f(a((s) => Math.sqrt(s.sumSq / s.n)), 3),
          f(a((s) => avg(s.maxOver))),
          f(a((s) => s.over05 / DAYS)),
          f(a((s) => avg(s.minUnder))),
          f(a((s) => s.under05 / DAYS)),
          f(a((s) => (s.afterExitMin.length ? Math.min(...s.afterExitMin) : NaN))),
          f(a((s) => s.starts / DAYS), 1),
          f(a((s) => s.elKwh / DAYS)),
          f(a((s) => s.coastOnCycles * 5 / 60 / DAYS)),
          `${Math.min(...runs.map((s) => s.spMin))}–${Math.max(...runs.map((s) => s.spMax))}`,
          f(a((s) => s.spChanges / DAYS), 1),
        ].join(' | '));
      }
    }
  }
}

async function sensitivity() {
  // Eén factor tegelijk rond de basis Kp 3, Ti 3 u, stooklijnafwijking +2 K; mild (gemeten reeks) en koud (−8 K)
  const BASE = { Kp: 3, Ti: 3, bias: 2 };
  const CONFIGS = [
    ['basis (Kp 3, Ti 3 u, +2 K)', {}],
    ['Ti 1,5 u', { Ti: 1.5 }], ['Ti 6 u', { Ti: 6 }],
    ['Kp 2', { Kp: 2 }], ['Kp 4', { Kp: 4 }],
    ['afwijking 0 K', { bias: 0 }], ['afwijking +4 K', { bias: 4 }],
  ];
  const WEATHER = [['mild', 0], ['koud (−8 K)', -8]];
  const flow = process.env.FLOW || 'direct';
  for (const em of ['radiator', 'vloer']) {
    for (const [wName, shift] of WEATHER) {
      console.log(`\n### Gevoeligheid ${EMITTERS[em].label}; ${wName}; flow ${flow}; ${DAYS} dagen, ${SEEDS.length} seeds\n`);
      console.log('variant | instelling | RMSE (°C) | uren > +0,5 /dag | uren < −0,5 /dag | min onder doel/dag | starts/dag | kWh el/dag | coast-uren/dag | setpoint min–max');
      console.log('--- | --- | --- | --- | --- | --- | --- | --- | --- | ---');
      const rows = [['incr. PI + coast (huidig)', 'referentie', {}], ['incr. PI (huidig)', 'referentie', {}]];
      for (const [label, o] of CONFIGS) {
        rows.push(['pos. PI-I', label, o]);
        rows.push(['pos. PI-I + coast', label, o]);
      }
      for (const [name, label, o] of rows) {
        const runs = [];
        for (const seed of SEEDS) runs.push(await simulate(name, em, seed, flow, { ...BASE, ...o, toutShift: shift }));
        const a = (fn) => avg(runs.map(fn));
        console.log([
          name, label,
          f(a((s) => Math.sqrt(s.sumSq / s.n)), 3),
          f(a((s) => s.over05 / DAYS)),
          f(a((s) => s.under05 / DAYS)),
          f(a((s) => avg(s.minUnder))),
          f(a((s) => s.starts / DAYS), 1),
          f(a((s) => s.elKwh / DAYS)),
          f(a((s) => s.coastOnCycles * 5 / 60 / DAYS)),
          `${Math.min(...runs.map((s) => s.spMin))}–${Math.max(...runs.map((s) => s.spMax))}`,
        ].join(' | '));
      }
    }
  }
}

if (process.env.SENS) {
  sensitivity();
} else if (process.env.TRACE) {
  simulate(process.env.VARIANT || 'incr. PI (huidig)', process.argv[2] || 'radiator', SEEDS[0], process.env.FLOW || 'direct');
} else {
  main();
}
