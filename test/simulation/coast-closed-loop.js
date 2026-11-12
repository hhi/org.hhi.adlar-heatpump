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
 *   P4=1 node test/simulation/coast-closed-loop.js   (ADR-065 P4 on the app's PositionalPIController)
 *   O4=1 node test/simulation/coast-closed-loop.js   (ADR-065 O4: optimizers on, both control modes)
 *   PROTOCOL=1 node test/simulation/coast-closed-loop.js   (test protocol 3.5: shadow, transfer table, COP 0, restart)
 *   O14=1 node test/simulation/coast-closed-loop.js   (ADR-065 O14/O16: optimizers through the room target, 3.6.0)
 *   O16=1 node test/simulation/coast-closed-loop.js   (ADR-065 O16: the basis follows the user's room target, night setback)
 *   O16=1 O16_WEEK=1 node test/simulation/coast-closed-loop.js   (O16 with a thermostat week program, soft transitions)
 *   G14=1 node test/simulation/coast-closed-loop.js   (ADR-062 B7 as pre-heat duration: which observed power predicts warm-up)
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
const {
  PositionalPIController, EMITTER_PRESETS, appCurveValue, roomTargetShift, roundRecommendation,
} = require('../../.homeybuild/lib/shared/adaptive/positional-pi-controller');
const { COPOptimizer } = require('../../.homeybuild/lib/modbus/adaptive/cop-optimizer');
const { EnergyPriceOptimizer } = require('../../.homeybuild/lib/modbus/adaptive/energy-price-optimizer');
const { calculatePreHeatDuration } = require('../../.homeybuild/lib/shared/utils/preheat-calculator');

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
  // ADR-065 as built: the app's PositionalPIController (lib/shared/adaptive/positional-pi-controller.ts)
  'pos. app': { mode: 'posTS', coast: false, ua: 0, tau: 0 },
  'pos. app + coast': { mode: 'posTS', coast: true, ua: 0, tau: 0 },
  // ADR-065 O4: as the service, the PI output divided by the comfort anchor into the decision maker
  'pos. app (dm)': { mode: 'posApp', coast: false, ua: 0, tau: 0 },
  'pos. app (dm) + coast': { mode: 'posApp', coast: true, ua: 0, tau: 0 },
  // ADR-065 O14/O16 (3.6.0): price and COP shift the room target, the basis follows, no thermal component
  'pos. app O14': { mode: 'posO14', coast: false, ua: 0, tau: 0 },
};
// O4: the service's priorities (priority_* settings 50/15/15/20) and optimizer configuration
const APP_PRIORITIES = {
  comfort: 0.50, efficiency: 0.15, cost: 0.15, thermal: 0.20,
};
const SIM_EPOCH = Date.UTC(2026, 9, 19, 0, 0, 0); // Date.now() of the optimizers follows the simulated time
const realNow = Date.now;
// P4 houses (ADR-065 §5/§7): the reference house plus a light and a heavy one
const HOUSES = {
  referentie: HOUSE,
  licht: { C: 7, UA: 0.35, pInt: 0.3 },
  zwaar: { C: 30, UA: 0.25, pInt: 0.3 },
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
function curve(em, tOut, bias = em.curveBias, house = HOUSE) {
  const q = Math.max(0, house.UA * (TARGET - tOut) - house.pInt);
  return TARGET + q / em.He + q / (2 * HP.flowK) + bias;
}

/**
 * P4 curve shape: shape 1 = the ideal form; > 1 too steep, < 1 too flat, pivoting at 7 °C outdoor
 * so that only the slope is wrong.
 */
function shapedCurve(em, tOut, bias, house, shape = 1) {
  const pivot = curve(em, 7, bias, house);
  return pivot + shape * (curve(em, tOut, bias, house) - pivot);
}

/** P4 night setback: 19 °C between 23:00 and 07:00, otherwise TARGET. */
const targetAt = (hod, setback) => (setback && (hod >= 23 || hod < 7) ? 19 : TARGET);

/**
 * O16 thermostat week program: weekdays 6:30 21, 9:00 19 (away), 17:00 21, 22:30 18;
 * weekend (days 5 and 6) 8:00 21, 23:30 18.
 */
function weekTarget(day, hod) {
  if (day % 7 >= 5) return hod >= 8 && hod < 23.5 ? TARGET : 18;
  if (hod >= 6.5 && hod < 9) return TARGET;
  if (hod >= 9 && hod < 17) return 19;
  if (hod >= 17 && hod < 22.5) return TARGET;
  return 18;
}

/**
 * O4 day-ahead price (€/kWh, market) against the service's thresholds 0,04/0,06/0,10/0,12:
 * normal at night, very high in the morning and evening peak, low at midday (very low on sunny days).
 */
function priceAt(hod, sunnyDay, noise) {
  let p;
  if (hod < 6) p = 0.09;
  else if (hod < 7) p = 0.11;
  else if (hod < 10) p = 0.14;
  else if (hod < 16) p = sunnyDay ? 0.03 : 0.05;
  else if (hod < 17) p = 0.10;
  else if (hod < 21) p = 0.15;
  else p = 0.10;
  return Math.max(-0.5, p + noise);
}

/**
 * O4 thermal component as BuildingModelService.calculateThermalAdjustment today (heuristic), on a
 * converged model (the true house). Gains: P_int and the sun, both in kW.
 */
function thermalHeuristic(indoor, target, house, gains) {
  const delta = target - indoor;
  if (delta <= 0) return 0;
  const tau = house.C / house.UA;
  const gainCorrection = delta > 0.1 ? gains / (house.UA * delta) : 0;
  const effTau = tau / Math.max(1.0, 1 + gainCorrection);
  const hours = delta > 0.3 ? effTau * Math.log(delta / 0.3) : 0;
  if (hours > 2.0 && delta > 1.0) return 0.5;
  if (hours < 0.5 && delta < 0.5) return -0.3;
  return 0;
}

/**
 * O4 thermal component as proposed in ADR-062 B7: T_eq = T_out + (P + G)/UA with P the 90th
 * percentile of the thermal power with the compressor running over the last 7 days, and
 * t = τ·ln((T_eq − T_in)/(T_eq − T_target)). No observed power or T_eq ≤ T_target: 0.
 */
function thermalB7(indoor, target, tOut, house, gains, p90) {
  const delta = target - indoor;
  if (delta <= 0 || p90 === null) return 0;
  const tEq = tOut + (p90 + gains) / house.UA;
  if (tEq <= target) return 0;
  const tau = house.C / house.UA;
  const hours = tEq > indoor ? tau * Math.log((tEq - indoor) / (tEq - target)) : Infinity;
  if (hours > 2.0 && delta > 1.0) return 0.5;
  if (hours < 0.5 && delta < 0.5) return -0.3;
  return 0;
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

/** One run; returns the comfort, coast and heat-pump statistics. */
async function simulate(variantName, emitterName, seed, flow = 'direct', opts = {}) {
  // opts (gevoeligheid): Kp, Ti (uren), bias (stooklijnafwijking K), toutShift (K op de buitenreeks)
  // opts (P4): house, setback (nachtverlaging), shape (stooklijnvorm), flatBasis (vlakke basis)
  // opts (protocol): appCurve { atMinus15, atPlus15 } (basis = de app-stooklijn), shadow (niemand voert
  // het advies uit; de warmtepomp volgt { atMinus15, atPlus15 } of houdt { fixed }), copGuard (3.5.1),
  // restartAtH (herstart van de app op dat uur)
  // opts (O16): o16Ref = 'ideal' (21, the curve's own room temperature) | 'fixed20' | 'median' (7 days);
  // o16Hold: the integral pauses while the target differs from the 7-day median and until the house is back;
  // week (thermostat week program); ramp = 'both' | 'down' (the controller's target moves 0,5 °C/h);
  // lead (hours): the controller raises the target that much earlier (look-ahead), lowers it on time
  // opts (G14): g14 (record warm-up events and the observed power), oneSetback (18 °C once, day 10 23:00 – day 11 07:00),
  // away (16 °C from day 9 12:00 to day 11 12:00, a few days away)
  const P = { ...PII, ...(opts.Kp !== undefined ? { Kp: opts.Kp } : {}) };
  const house = opts.house ?? HOUSE;
  const pc = new PositionalPIController({ kp: P.Kp, tiHours: opts.Ti ?? 3 });
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
  // O4 (opts.optim = { cop, price, thermal: 'heuristic' | 'b7' | undefined }): the service's
  // priorities and optimizers; otherwise the P1–P4 setup without optimizers
  const optim = opts.optim ?? null;
  const dm = new WeightedDecisionMaker(optim ? APP_PRIORITIES : {
    comfort: 0.60, efficiency: 0.25, cost: 0.15, thermal: 0.20,
  });
  const metrics = { copConfidence: 0, priceDataAvailable: false, buildingModelConfidence: 0 };
  const noop = () => {};
  const copOpt = optim?.cop ? new COPOptimizer({
    minAcceptableCOP: 2.5, targetCOP: 3.5, strategy: 'balanced', minSupplyTemp: SP_MIN, maxSupplyTemp: Math.min(55, SP_MAX), historySize: 1000, logger: noop,
  }) : null;
  const priceOpt = optim?.price ? new EnergyPriceOptimizer({
    thresholds: {
      veryLow: 0.04, low: 0.06, normal: 0.10, high: 0.12,
    },
    maxPreHeatOffset: 1.5,
    maxReduceOffset: -1.0,
    lookAheadHours: 4,
    logger: noop,
  }) : null;
  if (optim?.thermal) {
    metrics.buildingModelConfidence = 1; // converged model
    priceOpt?.setThermalCapacity(house.C);
  }
  const powerOn = []; // B7: thermal power per cycle with the compressor running, last 7 days
  const copDay = { heat: 0, el: 0, prevRatio: 0, day: 0 };
  const rp = rng(seed + 1000); // own stream, so the other noise is the same as without optimizers
  const priceNoise = Array.from({ length: DAYS * 24 + 48 }, () => 0.01 * (rp() + rp() + rp() - 1.5));

  // O14/O16: slope of the two-point curve through −15 and +15 °C, as the app curve gives it
  const slope = Math.max(0, Math.min(3, (shapedCurve(em, -15, bias, house, 1) - shapedCurve(em, 15, bias, house, 1)) / 30));
  // Physical state
  let tIn = TARGET; let tw = TARGET + 12; let on = false; let onS = 0; let offS = 1e9;
  const appBase = (t) => appCurveValue(opts.appCurve.atMinus15, opts.appCurve.atPlus15, t);
  // Shadow: the heat pump's own setpoint, its fixed curve or a fixed value
  const shadowSp = (t) => Math.max(SP_MIN, Math.min(SP_MAX, Math.round(opts.shadow.fixed
    ?? appCurveValue(opts.shadow.atMinus15, opts.shadow.atPlus15, t))));
  let sp = v.mode === 'incr' ? em.sp0 : Math.round(curve(em, toutAt(0) + shift, bias, house));
  if (opts.appCurve) sp = Math.round(appBase(toutAt(0) + shift));
  if (opts.shadow) sp = shadowSp(toutAt(0) + shift);
  const flatValue = Math.round(curve(em, toutAt(0) + shift, bias, house));
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
    elExpensive: 0, // O4: electricity in the very-high-price hours (≥ 0,12 €/kWh)
    elCheap: 0, // O14: electricity in the low-price hours (≤ 0,06 €/kWh)
    shiftSum: 0, // O14: sum of the room-target shift per cycle
    underMorning: 0, // O16: hours more than 0,5 °C below the target between 07:00 and 11:00
    underComfort: 0, // O16: hours more than 0,5 °C below the target while the target is 21 °C
    overEvening: 0, // O16: hours more than 0,5 °C above the target between 23:00 and 03:00
    iMin: Infinity, // O16: lowest and highest integral from day 3 on
    iMax: -Infinity,
    // Protocol: hold reasons per cycle, advice range and jumps, gap to the setpoint, longest runs
    holds: {},
    advMin: Infinity,
    advMax: -Infinity,
    maxJump: 0,
    maxGap: 0,
    coldRunMaxH: 0,
    limitRunMaxH: 0,
    copDecreaseOff: 0, // cycles in which the COP optimizer lowered the setpoint with the compressor off
    iEnd: 0,
    restart: null, // { iBefore, iAfter, spBefore, maxStep2h, maxDev2h }
    rmseWindow: NaN,
  };
  let prevCoast = false;
  let coldRunS = 0; let limitRunCycles = 0; let restartDone = false; let afterRestart = -1;
  // RMSE over the 24 h from restartAtH (or windowAtH, the same window without a restart)
  const winH = opts.restartAtH ?? opts.windowAtH;
  let sumSqAfter = 0; let nAfter = 0;
  let exitWatch = null; // { untilS, min }
  let dayMax = -Infinity; let dayMin = Infinity;
  const targetHist = []; // O16: room target per cycle, last 7 days
  let o16Pause = false; // O16: integral paused for a deviating room target
  let ctrlTarget = null; // O16: the controller's target (ramped towards the room target)
  // G14: thermal power per cycle with the compressor running (A), hourly mean power including off time (B),
  // and warm-up events from day 7 on (a full week of history)
  const g14 = opts.g14 ? {
    samples: [], hourly: [], hourSum: 0, hourN: 0, prevTarget: null, open: null, events: [],
  } : null;

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
    if (optim) {
      const el = (q > 0 ? q / cop : 0) * DT / 3600;
      const priceNow = priceAt(hod, sunny[day], priceNoise[Math.floor(h)]);
      if (priceNow >= 0.12) st.elExpensive += el;
      if (priceNow <= 0.06) st.elCheap += el;
      if (day !== copDay.day) {
        copDay.prevRatio = copDay.el > 0 ? copDay.heat / copDay.el : copDay.prevRatio;
        copDay.heat = 0; copDay.el = 0; copDay.day = day;
      }
      copDay.heat += q * DT / 3600; copDay.el += el;
    }

    // --- Water loop and house ---
    const qEm = em.He * (tw - tIn);
    tw += ((q - qEm) / em.Cw) * (DT / 3600);
    tIn += ((qEm - house.UA * (tIn - tOut) + house.pInt + sun) / house.C) * (DT / 3600);

    // --- Comfort statistics (true temperature, against the target of the moment) ---
    const oneSetback = opts.oneSetback && ((day === 10 && hod >= 23) || (day === 11 && hod < 7));
    const away = opts.away && h >= 9 * 24 + 12 && h < 11 * 24 + 12;
    const target = opts.week ? weekTarget(day, hod) : (oneSetback ? 18 : (away ? 16 : targetAt(hod, opts.setback)));
    const e = tIn - target;
    if (g14?.open) {
      // G14: reached within 0,3 °C, or the target went down first (not reached in this window)
      const ev = g14.open;
      ev.qSum = (ev.qSum ?? 0) + qEm; ev.qN = (ev.qN ?? 0) + 1; ev.qHouse = ev.qSum / ev.qN;
      ev.twMax = Math.max(ev.twMax ?? -Infinity, tw); ev.spMax = Math.max(ev.spMax ?? -Infinity, sp);
      if (tIn >= ev.goal) { ev.actual = (tS - ev.startS) / 3600; g14.events.push(ev); g14.open = null; }
      else if (target < ev.target) { ev.actual = Infinity; ev.window = (tS - ev.startS) / 3600; g14.events.push(ev); g14.open = null; }
    }
    st.sumSq += e * e; st.n++;
    if (e > 0.5) st.over05 += DT / 3600;
    if (e < -0.5) st.under05 += DT / 3600;
    if (e < -0.5 && hod >= 7 && hod < 11) st.underMorning += DT / 3600;
    if (e < -0.5 && target === TARGET) st.underComfort += DT / 3600;
    if (e > 0.5 && (hod >= 23 || hod < 3)) st.overEvening += DT / 3600;
    dayMax = Math.max(dayMax, e); dayMin = Math.min(dayMin, e);
    coldRunS = e < -1 ? coldRunS + DT : 0;
    st.coldRunMaxH = Math.max(st.coldRunMaxH, coldRunS / 3600);
    if (winH !== undefined && tS >= winH * 3600 && tS < (winH + 24) * 3600) { sumSqAfter += e * e; nAfter++; }
    if ((i + 1) % (86400 / DT) === 0) { st.maxOver.push(dayMax); st.minUnder.push(dayMin); dayMax = -Infinity; dayMin = Infinity; }
    if (exitWatch) {
      exitWatch.min = Math.min(exitWatch.min, e);
      if (tS >= exitWatch.untilS) { st.afterExitMin.push(exitWatch.min); exitWatch = null; }
    }

    // --- Control cycle every 5 minutes (as executeControlCycle) ---
    if ((i + 1) % (CYCLE / DT) !== 0) continue;
    cycleNo++;
    if (g14) {
      // As BuildingModelService: one sample per 5 minutes, thermal power when the compressor runs
      if (on) { g14.samples.push(q); if (g14.samples.length > 7 * 288) g14.samples.shift(); }
      g14.hourSum += on ? q : 0; g14.hourN++;
      if (g14.hourN === 12) {
        g14.hourly.push(g14.hourSum / 12); if (g14.hourly.length > 168) g14.hourly.shift();
        g14.hourSum = 0; g14.hourN = 0;
      }
      if (g14.prevTarget !== null && target > g14.prevTarget + 0.5 && day >= 7 && !g14.open) {
        g14.open = {
          startS: tS, tIn, tOut, target, goal: target - 0.3,
          pA: percentile(g14.samples, 0.9), pB: g14.hourly.length ? Math.max(...g14.hourly) : null,
        };
      }
      g14.prevTarget = target;
    }
    // O16: soft transition, the controller's target moves at most 0,5 °C/h (down only, or both ways)
    const rampStep = 0.5 * (CYCLE / 3600);
    let aimed = target;
    if (opts.week && opts.lead) {
      const ahead = h + opts.lead;
      aimed = Math.max(target, weekTarget(Math.floor(ahead / 24), ahead % 24));
    }
    if (ctrlTarget === null || !opts.ramp) ctrlTarget = aimed;
    else if (aimed < ctrlTarget) ctrlTarget = Math.max(aimed, ctrlTarget - rampStep);
    else if (opts.ramp === 'both') ctrlTarget = Math.min(aimed, ctrlTarget + rampStep);
    else ctrlTarget = aimed;
    const indoorM = Math.round((tIn + 0.03 * gauss()) * 10) / 10;
    const outletM = Math.round(outletTrue);
    let base = opts.flatBasis ? flatValue : shapedCurve(em, tOut, bias, house, opts.shape ?? 1);
    if (opts.appCurve) base = appBase(Math.round(tOut * 10) / 10);

    // Restart of the app: the integral survives (store), the previous recommendation, the coast
    // state and the histories do not (as _restorePositionalState and a fresh service)
    if (opts.restartAtH !== undefined && !restartDone && h >= opts.restartAtH) {
      restartDone = true; afterRestart = 0;
      st.restart = {
        iBefore: pc.getIntegral(), iAfter: null, spBefore: sp, maxStep2h: 0, maxDev2h: 0,
      };
      lastRecommended = undefined; lastRecRaw = null; lastObserved = null;
      coastActive = false; cooldownCount = 0; coastCycles = 0;
      inHist.length = 0; outHist.length = 0;
      pi.resetHistory();
    }

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
    let ePos = ctrlTarget - indoorM;
    const uPrev = (v.mode === 'posTS' || v.mode === 'posApp') ? pc.output(ePos) : Math.max(-P.Umax, Math.min(P.Umax, P.Kp * ePos + integ));
    let coastAdj;
    if (v.mode === 'posI' || v.mode === 'posTS' || v.mode === 'posApp') {
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
      if (coastActive && indoorM < target + COAST.hysteresis / 2) exitAt('hard');
      const falling = inHist.length >= COAST.trendN && inHist[inHist.length - 1] < inHist[0];
      if (coastActive && falling && Math.abs(coastAdj) < COAST.staleThreshold) exitAt('soft');
      if (coastActive && coastCycles >= COAST.maxCycles) exitAt('watchdog');
      if (!coastActive) {
        const rising = inHist.length < COAST.trendN ? true : inHist[inHist.length - 1] >= inHist[0];
        if (indoorM > target + COAST.hysteresis && rising) cooldownCount++; else cooldownCount = 0;
        coastActive = cooldownCount >= 2;
        if (coastActive) coastCycles = 0;
      }
      if (coastActive) { coastCycles++; st.coastOnCycles++; }
    }

    // O4: the optimizers of executeControlCycle, at the simulated time
    let copAction = null; let priceAction = null; let thermalAction = null;
    if (optim) {
      Date.now = () => SIM_EPOCH + tS * 1000;
      try {
        if (priceOpt && (hod < CYCLE / 3600 || priceOpt.getPriceData().length === 0)) {
          // Day-ahead prices for today and tomorrow, received at midnight
          const prices = {};
          for (let k = 0; k < 48; k++) {
            const hh = Math.floor(h) + k;
            prices[k] = priceAt(hh % 24, sunny[Math.floor(hh / 24)] ?? false, priceNoise[hh] ?? 0);
          }
          priceOpt.setExternalPrices(prices, SIM_EPOCH + Math.floor(h) * 3600000);
        }
        if (priceOpt) {
          priceAction = priceOpt.calculateAction(indoorM, target);
          metrics.priceDataAvailable = priceOpt.getPriceData().length > 0;
        }
        if (copOpt) {
          const currentCop = on ? Math.round(cop * 10) / 10 : 0;
          // 3.5.1: without a valid COP measurement (0) the optimizer is skipped
          if (!opts.copGuard || currentCop > 0) {
            const daily = opts.copGuard && !(copDay.prevRatio > 0) ? currentCop : copDay.prevRatio;
            copAction = copOpt.calculateAction(currentCop, daily, Math.round(tOut * 10) / 10, sp);
            if (!on && copAction.action === 'decrease') st.copDecreaseOff++;
          }
          if (on) {
            copOpt.addMeasurement({
              timestamp: Date.now(), outdoorTemp: Math.round(tOut * 10) / 10, supplyTemp: outletM, cop: currentCop, compressorFreq: 50,
            });
          }
          // calculateCOPConfidence(): high buckets 1, medium 0,5, low 0
          const d = copOpt.getDiagnostics();
          const w = d.bucketDetails.map((b) => (b.confidence === 'high' ? 1 : (b.confidence === 'medium' ? 0.5 : 0)));
          metrics.copConfidence = d.bucketsLearned === 0 || w.length === 0 ? 0 : w.reduce((x, y) => x + y, 0) / w.length;
        }
        if (optim.thermal) {
          if (on) { powerOn.push(q); if (powerOn.length > 7 * 288) powerOn.shift(); }
          const gains = house.pInt + sun;
          const adj = optim.thermal === 'b7'
            ? thermalB7(indoorM, target, tOut, house, gains, percentile(powerOn, 0.9))
            : thermalHeuristic(indoorM, target, house, gains);
          thermalAction = { adjustment: adj, reason: 'thermal', priority: adj !== 0 ? 'medium' : 'low' };
        }
      } finally {
        Date.now = realNow;
      }
    }

    // O14: as the service, the optimizers first; price and COP shift the room target of the PI
    const o14 = v.mode === 'posO14';
    const decisionMetrics = o14 ? { ...metrics, thermalExcluded: true } : metrics;
    let feedforward = 0;
    if (o14) {
      const pre = dm.combineActionsWithThermal(null, copAction, priceAction, null, decisionMetrics, null);
      const shift = roomTargetShift(pre.breakdown);
      feedforward = (1 + slope) * shift;
      ePos += shift;
      st.shiftSum += shift;
      // O16: the basis also follows the user's own room target, relative to a reference room temperature
      targetHist.push(target); if (targetHist.length > 7 * 288) targetHist.shift();
      let ref = target;
      if (opts.o16Ref === 'ideal') ref = TARGET;
      if (opts.o16Ref === 'fixed20') ref = 20;
      if (opts.o16Ref === 'median') ref = percentile(targetHist, 0.5);
      feedforward += (1 + slope) * (ctrlTarget - ref);
      if (opts.o16Hold) {
        const median = percentile(targetHist, 0.5);
        if (target !== median) o16Pause = true;
        else if (o16Pause && Math.abs(ePos) <= 0.3) o16Pause = false;
      }
    }
    let heatingAction = await pi.calculateAction({ indoorTemp: indoorM, targetTemp: target, timestamp: tS * 1000 });
    if (v.mode === 'posApp' || o14) {
      // As _positionalHeatingAction: the PI output divided by the comfort anchor
      const step = pc.step({
        error: ePos,
        currentSetpoint: sp,
        lastRecommendation: lastRecommended ?? null,
        lastRawRecommendation: lastRecRaw,
        range: { min: SP_MIN, max: SP_MAX },
        pause: (v.coast && coastActive) ? 'coast' : (o16Pause ? 'target_step' : null),
      });
      const hold = step.holdReason ?? 'geen';
      st.holds[hold] = (st.holds[hold] ?? 0) + 1;
      if (afterRestart === 0) st.restart.iAfter = step.i;
      heatingAction = {
        temperatureAdjustment: step.u / dm.getComfortAnchor(), reason: 'pos', priority: 'medium', controller: 'heating',
      };
    }
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
    const combined = dm.combineActionsWithThermal(heatingAction, copAction, priceAction, o14 ? null : thermalAction, decisionMetrics, coastAction);

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
    } else if (o14) {
      // The optimizers act through the room target: their share is replaced by the basis feed-forward
      lastRecRaw = base + feedforward + combined.finalAdjustment - combined.breakdown.efficiency - combined.breakdown.cost;
      // O22 (ADR-067 D3): opts.roundHyst is the hysteresis threshold; without it plain rounding (the app before 3.9.0)
      const rounded = opts.roundHyst === undefined
        ? Math.round(lastRecRaw)
        : roundRecommendation(lastRecRaw, lastRecommended, opts.roundHyst);
      recommended = Math.max(SP_MIN, Math.min(SP_MAX, rounded));
    } else if (v.mode === 'posApp') {
      // As _positionalRecommendation: basis + the decision maker's correction
      lastRecRaw = base + combined.finalAdjustment;
      recommended = Math.max(SP_MIN, Math.min(SP_MAX, Math.round(lastRecRaw)));
    } else if (v.mode === 'posTS') {
      // The app's controller: same anti-windup rules, with the clamped previous recommendation (as the service)
      const step = pc.step({
        error: ePos,
        currentSetpoint: sp,
        lastRecommendation: lastRecommended ?? null,
        lastRawRecommendation: lastRecRaw,
        range: { min: SP_MIN, max: SP_MAX },
        pause: (v.coast && coastActive) ? 'coast' : null,
      });
      const corr = (v.coast && coastActive && coastAdj < 0) ? (1 - COAST.strength) * step.u + COAST.strength * coastAdj : step.u;
      lastRecRaw = base + corr;
      recommended = Math.max(SP_MIN, Math.min(SP_MAX, Math.round(lastRecRaw)));
    } else {
      recommended = Math.max(SP_MIN, Math.min(SP_MAX, Math.round(base)));
    }
    if (lastRecommended === undefined) lastRecommended = sp;
    const changed = recommended !== lastRecommended;
    if (cycleNo > 1 && afterRestart !== 0 && Math.abs(recommended - lastRecommended) > st.maxJump) {
      st.maxJump = Math.abs(recommended - lastRecommended);
      st.maxJumpCtx = { day, hod: Number(hod.toFixed(2)), from: lastRecommended, to: recommended, coastBefore: prevCoast, coastNow: coastActive };
    }
    prevCoast = coastActive;
    st.advMin = Math.min(st.advMin, recommended); st.advMax = Math.max(st.advMax, recommended);
    st.maxGap = Math.max(st.maxGap, Math.abs(recommended - sp));
    lastRecommended = recommended;
    // The user flow applies the recommendation: directly when it changes, or limited to 1 °C per 30 min.
    // Shadow: nobody applies it; the heat pump keeps its own setpoint.
    let next = sp;
    if (opts.shadow) {
      next = shadowSp(tOut);
    } else if (flow === 'direct') {
      if (changed || v.mode !== 'incr') next = recommended;
    } else if (recommended !== sp && cycleNo - lastFlowCycle >= FLOW_LIMIT.everyCycles) {
      next = sp + Math.sign(recommended - sp) * Math.min(FLOW_LIMIT.step, Math.abs(recommended - sp));
      lastFlowCycle = cycleNo;
    }
    if (next !== sp) {
      if (afterRestart >= 0 && afterRestart < 24) st.restart.maxStep2h = Math.max(st.restart.maxStep2h, Math.abs(next - sp));
      sp = next; st.spChanges++;
    }
    st.spMin = Math.min(st.spMin, sp); st.spMax = Math.max(st.spMax, sp);
    limitRunCycles = (sp <= SP_MIN || sp >= SP_MAX) ? limitRunCycles + 1 : 0;
    st.limitRunMaxH = Math.max(st.limitRunMaxH, (limitRunCycles * CYCLE) / 3600);
    if (afterRestart >= 0 && afterRestart < 24) {
      st.restart.maxDev2h = Math.max(st.restart.maxDev2h, Math.abs(sp - st.restart.spBefore));
      afterRestart++;
    }
    st.iEnd = pc.getIntegral();
    if (day >= 2) { st.iMin = Math.min(st.iMin, st.iEnd); st.iMax = Math.max(st.iMax, st.iEnd); }
    if (opts.keepTrace) (st.spTrace ??= []).push(sp);

    // TRACE=<dag> prints every cycle of that day for the first seed
    if (process.env.TRACE && Number(process.env.TRACE) === day && seed === SEEDS[0]) {
      console.log(`${hod.toFixed(2).padStart(5)} h | Tin ${tIn.toFixed(2)} | Tw ${tw.toFixed(1)} | uit ${outletM} | sp ${sp} | wp ${on ? 'aan' : 'uit'} ${q.toFixed(1)} kW`
        + ` | zon ${sun.toFixed(1)} | PI ${heatingAction ? heatingAction.temperatureAdjustment.toFixed(2) : '—'} | totaal ${combined.finalAdjustment.toFixed(2)}`
        + ` | advies ${recommended} | stooklijn ${base.toFixed(1)}${coastActive ? ' | COAST' : ''}`);
    }
  }
  if (nAfter > 0) st.rmseWindow = Math.sqrt(sumSqAfter / nAfter);
  if (g14) st.g14 = g14.events;
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

/**
 * ADR-065 P4: the app's PositionalPIController with the emitter preset (radiator Ti 3 h without coast,
 * floor Ti 6 h with coast) against the current incremental regulation, per scenario and weather.
 */
async function p4() {
  const SCENARIOS = [
    ['referentiewoning', {}],
    ['lichte woning (C 7)', { house: HOUSES.licht }],
    ['zware woning (C 30)', { house: HOUSES.zwaar }],
    ['nachtverlaging 19 °C', { setback: true }],
    ['stooklijn te steil (×1,3)', { shape: 1.3 }],
    ['stooklijn te vlak (×0,7)', { shape: 0.7 }],
    ['vlakke basis', { flatBasis: true }],
  ];
  const WEATHER = [['mild', 0], ['koud (−8 K)', -8]];
  const flow = process.env.FLOW || 'direct';
  for (const em of ['radiator', 'vloer']) {
    const preset = EMITTER_PRESETS[em === 'radiator' ? 'radiator' : 'floor'];
    const appVariant = preset.coastEnabled ? 'pos. app + coast' : 'pos. app';
    for (const [wName, shift] of WEATHER) {
      console.log(`\n### P4 ${EMITTERS[em].label}; ${wName}; flow ${flow}; preset Kp ${preset.kp}, Ti ${preset.tiHours} u, coast ${preset.coastEnabled ? 'aan' : 'uit'}; ${DAYS} dagen, ${SEEDS.length} seeds\n`);
      console.log('scenario | variant | RMSE (°C) | uren > +0,5 /dag | uren < −0,5 /dag | starts/dag | kWh el/dag | setpoint min–max');
      console.log('--- | --- | --- | --- | --- | --- | --- | ---');
      for (const [label, o] of SCENARIOS) {
        for (const name of ['incr. PI + coast (huidig)', appVariant]) {
          const runs = [];
          for (const seed of SEEDS) {
            runs.push(await simulate(name, em, seed, flow, {
              Kp: preset.kp, Ti: preset.tiHours, bias: EMITTERS[em].curveBias, toutShift: shift, ...o,
            }));
          }
          const a = (fn) => avg(runs.map(fn));
          console.log([
            label, name,
            f(a((s) => Math.sqrt(s.sumSq / s.n)), 3),
            f(a((s) => s.over05 / DAYS)),
            f(a((s) => s.under05 / DAYS)),
            f(a((s) => s.starts / DAYS), 1),
            f(a((s) => s.elKwh / DAYS)),
            `${Math.min(...runs.map((s) => s.spMin))}–${Math.max(...runs.map((s) => s.spMax))}`,
          ].join(' | '));
        }
      }
    }
  }
}

/**
 * ADR-065 O4: the optimizers (COP, price, thermal today and as ADR-062 B7) with the service's
 * priorities, for the incremental regulation and the positional mode through the decision maker.
 * The building model is converged (the true house); COP learns during the run.
 */
async function o4() {
  const SETS = [
    ['geen optimizers', {}],
    ['prijs', { price: true }],
    ['COP', { cop: true }],
    ['thermisch huidig', { thermal: 'heuristic' }],
    ['thermisch B7', { thermal: 'b7' }],
    ['alles, thermisch huidig', { cop: true, price: true, thermal: 'heuristic' }],
    ['alles, thermisch B7', { cop: true, price: true, thermal: 'b7' }],
  ];
  const WEATHER = [['mild', 0], ['koud (−8 K)', -8]];
  const flow = process.env.FLOW || 'direct';
  for (const em of (process.argv[2] && process.argv[2] !== 'all' ? [process.argv[2]] : ['radiator', 'vloer'])) {
    const preset = EMITTER_PRESETS[em === 'radiator' ? 'radiator' : 'floor'];
    const appVariant = preset.coastEnabled ? 'pos. app (dm) + coast' : 'pos. app (dm)';
    for (const [wName, shift] of WEATHER) {
      console.log(`\n### O4 ${EMITTERS[em].label}; ${wName}; flow ${flow}; preset Kp ${preset.kp}, Ti ${preset.tiHours} u, coast ${preset.coastEnabled ? 'aan' : 'uit'}; prioriteiten 50/15/15/20; ${DAYS} dagen, ${SEEDS.length} seeds\n`);
      console.log('optimizers | variant | RMSE (°C) | uren > +0,5 /dag | uren < −0,5 /dag | starts/dag | kWh el/dag | aandeel el in dure uren | setpoint min–max | setpointwijzigingen/dag');
      console.log('--- | --- | --- | --- | --- | --- | --- | --- | --- | ---');
      for (const [label, o] of SETS) {
        for (const name of ['incr. PI + coast (huidig)', appVariant]) {
          const runs = [];
          for (const seed of SEEDS) {
            runs.push(await simulate(name, em, seed, flow, {
              Kp: preset.kp, Ti: preset.tiHours, bias: EMITTERS[em].curveBias, toutShift: shift, optim: o, setback: process.env.O4_SETBACK === '1',
            }));
          }
          const a = (fn) => avg(runs.map(fn));
          console.log([
            label, name,
            f(a((s) => Math.sqrt(s.sumSq / s.n)), 3),
            f(a((s) => s.over05 / DAYS)),
            f(a((s) => s.under05 / DAYS)),
            f(a((s) => s.starts / DAYS), 1),
            f(a((s) => s.elKwh / DAYS)),
            `${f(a((s) => (s.elKwh > 0 ? (100 * s.elExpensive) / s.elKwh : 0)), 0)}%`,
            `${Math.min(...runs.map((s) => s.spMin))}–${Math.max(...runs.map((s) => s.spMax))}`,
            f(a((s) => s.spChanges / DAYS), 1),
          ].join(' | '));
        }
      }
    }
  }
}

/**
 * Test protocol 3.5 (docs/setup/advanced-control/TESTPROTOCOL_3.5.nl.md), floor heating with the preset
 * (Kp 3, Ti 6 h, coast as in the preset; COAST=1 forces it on) and the service's decision maker,
 * without optimizers unless stated:
 *   1. shadow: the app advises, the heat pump keeps its own curve or setpoint
 *   2. closed loop with an app curve from the transfer table (HH/HL) or the floor preset 35/27
 *   3. compressor off with the COP optimizer on: before (COP 0 counts as too low) and after 3.5.1
 *   4. restart of the app halfway through the closed loop, against the same run without a restart
 */
async function protocol() {
  const em = 'vloer';
  const preset = EMITTER_PRESETS.floor;
  const coast = preset.coastEnabled || process.env.COAST === '1';
  const variant = coast ? 'pos. app (dm) + coast' : 'pos. app (dm)';
  const CURVES = {
    'voorinstelling 35/27': { atMinus15: 35, atPlus15: 27 },
    'HH8 40/35': { atMinus15: 40, atPlus15: 35 },
    'HL2 35/30': { atMinus15: 35, atPlus15: 30 },
    'HL5 33/28': { atMinus15: 33, atPlus15: 28 },
    'HL8 29/24': { atMinus15: 29, atPlus15: 24 },
  };
  const WEATHER = [['mild', 0], ['koud (−8 K)', -8]];
  const base = { Kp: preset.kp, Ti: preset.tiHours, bias: EMITTERS[em].curveBias };
  const runAll = async (name, o) => {
    const runs = [];
    for (const seed of SEEDS) runs.push(await simulate(name, em, seed, 'direct', { ...base, ...o }));
    return runs;
  };
  const range = (runs, lo, hi) => `${Math.min(...runs.map(lo))}–${Math.max(...runs.map(hi))}`;
  const holdShare = (runs) => {
    const tot = {}; let n = 0;
    for (const s of runs) for (const [k, c] of Object.entries(s.holds)) { tot[k] = (tot[k] ?? 0) + c; n += c; }
    return Object.entries(tot).sort((x, y) => y[1] - x[1]).map(([k, c]) => `${k} ${f((100 * c) / n, 0)}%`).join(', ');
  };
  console.log(`# Testprotocol 3.5, droog: ${EMITTERS[em].label}; preset Kp ${preset.kp}, Ti ${preset.tiHours} u, coast ${coast ? 'aan' : 'uit'}; ${DAYS} dagen, ${SEEDS.length} seeds`);

  // 1. Shadow
  const SHADOW = [
    ['vaste curve HL5, app-stooklijn HL5 (tabel)', { shadow: CURVES['HL5 33/28'], appCurve: CURVES['HL5 33/28'] }],
    ['vaste curve HL2, app-stooklijn HL2 (tabel)', { shadow: CURVES['HL2 35/30'], appCurve: CURVES['HL2 35/30'] }],
    ['vaste curve HL2, app-stooklijn 35/27 (geen idee)', { shadow: CURVES['HL2 35/30'], appCurve: CURVES['voorinstelling 35/27'] }],
    ['vast setpoint 30, app-stooklijn 35/27', { shadow: { fixed: 30 }, appCurve: CURVES['voorinstelling 35/27'] }],
  ];
  for (const [wName, shift] of WEATHER) {
    console.log(`\n## 1. Schaduw; ${wName}\n`);
    console.log('situatie | advies min–max | setpoint min–max | max |advies − setpoint| | max sprong/cyclus | integraal vastgehouden | I eind | uren < −0,5 /dag');
    console.log('--- | --- | --- | --- | --- | --- | --- | ---');
    for (const [label, o] of SHADOW) {
      const runs = await runAll(variant, { ...o, toutShift: shift });
      const a = (fn) => avg(runs.map(fn));
      console.log([
        label,
        range(runs, (s) => s.advMin, (s) => s.advMax),
        range(runs, (s) => s.spMin, (s) => s.spMax),
        Math.max(...runs.map((s) => s.maxGap)),
        Math.max(...runs.map((s) => s.maxJump)),
        holdShare(runs),
        f(a((s) => s.iEnd)),
        f(a((s) => s.under05 / DAYS)),
      ].join(' | '));
    }
  }

  // 2. Closed loop with the transfer table
  for (const [wName, shift] of WEATHER) {
    console.log(`\n## 2. Gesloten lus met de overstaptabel; ${wName}; flow direct\n`);
    console.log('app-stooklijn | RMSE (°C) | uren < −0,5 /dag | uren > +0,5 /dag | langst > 1 °C te koud (u) | setpoint min–max | langst op een grens (u) | max sprong/cyclus | I eind | starts/dag');
    console.log('--- | --- | --- | --- | --- | --- | --- | --- | --- | ---');
    const classic = await runAll('incr. PI + coast (huidig)', { toutShift: shift });
    const row = (label, runs) => {
      const a = (fn) => avg(runs.map(fn));
      console.log([
        label,
        f(a((s) => Math.sqrt(s.sumSq / s.n)), 3),
        f(a((s) => s.under05 / DAYS)),
        f(a((s) => s.over05 / DAYS)),
        f(Math.max(...runs.map((s) => s.coldRunMaxH)), 1),
        range(runs, (s) => s.spMin, (s) => s.spMax),
        f(Math.max(...runs.map((s) => s.limitRunMaxH)), 1),
        Math.max(...runs.map((s) => s.maxJump)),
        f(a((s) => s.iEnd)),
        f(a((s) => s.starts / DAYS), 1),
      ].join(' | '));
    };
    for (const [label, c] of Object.entries(CURVES)) row(label, await runAll(variant, { appCurve: c, toutShift: shift }));
    row('Klassiek (referentie)', classic);
  }

  // 3. COP 0 with the compressor off
  for (const [wName, shift] of WEATHER) {
    console.log(`\n## 3. COP-optimalisatie aan, compressor uit; ${wName}; flow direct\n`);
    console.log('app-stooklijn | versie | RMSE (°C) | uren < −0,5 /dag | verlaging bij compressor uit (cycli/dag) | setpoint min–max | starts/dag | kWh el/dag');
    console.log('--- | --- | --- | --- | --- | --- | --- | ---');
    for (const label of ['voorinstelling 35/27', 'HL5 33/28']) {
      for (const [ver, guard] of [['3.5.0', false], ['3.5.1', true]]) {
        const runs = await runAll(variant, {
          appCurve: CURVES[label], toutShift: shift, optim: { cop: true }, copGuard: guard,
        });
        const a = (fn) => avg(runs.map(fn));
        console.log([
          label, ver,
          f(a((s) => Math.sqrt(s.sumSq / s.n)), 3),
          f(a((s) => s.under05 / DAYS)),
          f(a((s) => s.copDecreaseOff / DAYS), 0),
          range(runs, (s) => s.spMin, (s) => s.spMax),
          f(a((s) => s.starts / DAYS), 1),
          f(a((s) => s.elKwh / DAYS)),
        ].join(' | '));
      }
    }
  }

  // 4. Restart
  console.log('\n## 4. Herstart op dag 7; mild; app-stooklijn 35/27; flow direct\n');
  console.log('herstart om | I voor → na 1e cyclus | max setpointstap ≤ 2 u | max verschil setpoint met zonder herstart ≤ 2 u / ≤ 24 u | RMSE 24 u na herstart / zonder herstart');
  console.log('--- | --- | --- | --- | ---');
  for (const hod of [3, 13, 18]) {
    const at = 6 * 24 + hod;
    const rows = [];
    for (const seed of SEEDS) {
      const o = { ...base, appCurve: CURVES['voorinstelling 35/27'], keepTrace: true };
      const r = await simulate(variant, em, seed, 'direct', { ...o, restartAtH: at });
      const ref = await simulate(variant, em, seed, 'direct', { ...o, windowAtH: at });
      const c0 = Math.ceil((at * 3600) / CYCLE) - 1;
      const diff = (n) => Math.max(...r.spTrace.slice(c0, c0 + n).map((x, k) => Math.abs(x - ref.spTrace[c0 + k])));
      rows.push({ r, ref, d2: diff(24), d24: diff(288) });
    }
    console.log([
      `${hod}:00`,
      `${f(avg(rows.map((x) => x.r.restart.iBefore)))} → ${f(avg(rows.map((x) => x.r.restart.iAfter)))}`,
      Math.max(...rows.map((x) => x.r.restart.maxStep2h)),
      `${Math.max(...rows.map((x) => x.d2))} / ${Math.max(...rows.map((x) => x.d24))}`,
      `${f(avg(rows.map((x) => x.r.rmseWindow)), 3)} / ${f(avg(rows.map((x) => x.ref.rmseWindow)), 3)}`,
    ].join(' | '));
  }
}

/**
 * ADR-065 O14/O16 (3.6.0): the optimizers through the room target against 3.5 (added to the advice) and the
 * incremental regulation; share of the electricity in expensive and cheap hours. Converged building model,
 * presets of the emitter, the service's priorities.
 */
async function o14() {
  const SETS = [
    ['geen', {}],
    ['prijs', { price: true }],
    ['prijs + COP', { cop: true, price: true }],
    ['alles', { cop: true, price: true, thermal: 'heuristic' }],
  ];
  const WEATHER = [['mild', 0], ['koud (−8 K)', -8]];
  const flow = process.env.FLOW || 'direct';
  for (const em of (process.argv[2] && process.argv[2] !== 'all' ? [process.argv[2]] : ['radiator', 'vloer'])) {
    const preset = EMITTER_PRESETS[em === 'radiator' ? 'radiator' : 'floor'];
    for (const [wName, shift] of WEATHER) {
      console.log(`\n### O14 ${EMITTERS[em].label}; ${wName}; flow ${flow}; preset Kp ${preset.kp}, Ti ${preset.tiHours} u; ${DAYS} dagen, ${SEEDS.length} seeds\n`);
      console.log('optimizers | variant | RMSE (°C) | uren < −0,5 /dag | uren > +0,5 /dag | starts/dag | kWh el/dag | el in dure uren | el in goedkope uren | kamerdoelverschuiving gem.');
      console.log('--- | --- | --- | --- | --- | --- | --- | --- | --- | ---');
      for (const [label, o] of SETS) {
        for (const name of ['incr. PI + coast (huidig)', 'pos. app (dm)', 'pos. app O14']) {
          if (label === 'geen' && name === 'pos. app O14') continue;
          const runs = [];
          for (const seed of SEEDS) {
            runs.push(await simulate(name, em, seed, flow, {
              Kp: preset.kp, Ti: preset.tiHours, bias: EMITTERS[em].curveBias, toutShift: shift, optim: o,
            }));
          }
          const a = (fn) => avg(runs.map(fn));
          console.log([
            label, name,
            f(a((s) => Math.sqrt(s.sumSq / s.n)), 3),
            f(a((s) => s.under05 / DAYS)),
            f(a((s) => s.over05 / DAYS)),
            f(a((s) => s.starts / DAYS), 1),
            f(a((s) => s.elKwh / DAYS)),
            `${f(a((s) => (s.elKwh > 0 ? (100 * s.elExpensive) / s.elKwh : 0)), 0)}%`,
            `${f(a((s) => (s.elKwh > 0 ? (100 * s.elCheap) / s.elKwh : 0)), 0)}%`,
            f(a((s) => s.shiftSum / (s.n / (CYCLE / DT)))),
          ].join(' | '));
        }
      }
    }
  }
}

async function o16() {
  const WEEK_ROWS = [
    ['geen programma', 'pos. app O14', {}, false],
    ['klassiek', 'incr. PI + coast (huidig)', { week: true }, true],
    ['nu', 'pos. app O14', { week: true }, true],
    ['ideaal (21)', 'pos. app O14', { week: true, o16Ref: 'ideal' }, true],
    ['B: mediaan 7 d', 'pos. app O14', { week: true, o16Ref: 'median' }, true],
    ['zacht omlaag', 'pos. app O14', { week: true, ramp: 'down' }, true],
    ['zacht beide', 'pos. app O14', { week: true, ramp: 'both' }, true],
    ['B + zacht omlaag', 'pos. app O14', { week: true, o16Ref: 'median', ramp: 'down' }, true],
    ['ideaal + zacht omlaag', 'pos. app O14', { week: true, o16Ref: 'ideal', ramp: 'down' }, true],
    ['nu, 2 u eerder omhoog', 'pos. app O14', { week: true, lead: 2 }, true],
    ['nu, 4 u eerder omhoog', 'pos. app O14', { week: true, lead: 4 }, true],
    ['zacht omlaag, 2 u eerder', 'pos. app O14', { week: true, ramp: 'down', lead: 2 }, true],
  ];
  const ROWS = process.env.O16_WEEK ? WEEK_ROWS : [
    ['geen nachtverlaging', 'pos. app O14', {}, false],
    ['geen nachtverlaging', 'pos. app O14 A', { o16Ref: 'fixed20' }, false],
    ['klassiek', 'incr. PI + coast (huidig)', {}, true],
    ['niet meeschuiven (nu)', 'pos. app O14', {}, true],
    ['ideaal (21)', 'pos. app O14', { o16Ref: 'ideal' }, true],
    ['A: vast 20', 'pos. app O14', { o16Ref: 'fixed20' }, true],
    ['B: mediaan 7 d', 'pos. app O14', { o16Ref: 'median' }, true],
    ['I-pauze, niet meeschuiven', 'pos. app O14', { o16Hold: true }, true],
    ['B + I-pauze', 'pos. app O14', { o16Ref: 'median', o16Hold: true }, true],
    ['nu + prijs/COP', 'pos. app O14', { optim: { cop: true, price: true } }, true],
    ['B + prijs/COP', 'pos. app O14', { o16Ref: 'median', optim: { cop: true, price: true } }, true],
  ];
  const WEATHER = [['mild', 0], ['koud (−8 K)', -8]];
  const flow = process.env.FLOW || 'direct';
  for (const em of (process.argv[2] && process.argv[2] !== 'all' ? [process.argv[2]] : ['radiator', 'vloer'])) {
    const preset = EMITTER_PRESETS[em === 'radiator' ? 'radiator' : 'floor'];
    for (const [wName, shift] of WEATHER) {
      const program = process.env.O16_WEEK ? 'weekprogramma (werkdag 6:30 21, 9 19, 17 21, 22:30 18; weekend 8 21, 23:30 18)' : 'nachtverlaging 19 °C (23–7 u)';
      console.log(`\n### O16 ${EMITTERS[em].label}; ${wName}; ${program}; flow ${flow}; preset Kp ${preset.kp}, Ti ${preset.tiHours} u; ${DAYS} dagen, ${SEEDS.length} seeds\n`);
      console.log('variant | RMSE (°C) | uren < −0,5 /dag | waarvan 7–11 u | waarvan bij 21 °C | uren > +0,5 /dag | waarvan 23–3 u | starts/dag | kWh el/dag | I min–max (vanaf dag 3)');
      console.log('--- | --- | --- | --- | --- | --- | --- | --- | --- | ---');
      for (const [label, rawName, o, setback] of ROWS) {
        const name = rawName === 'pos. app O14 A' ? 'pos. app O14' : rawName;
        const runs = [];
        for (const seed of SEEDS) {
          runs.push(await simulate(name, em, seed, flow, {
            Kp: preset.kp, Ti: preset.tiHours, bias: EMITTERS[em].curveBias, toutShift: shift, setback, ...o,
          }));
        }
        const a = (fn) => avg(runs.map(fn));
        console.log([
          label + (rawName === 'pos. app O14 A' ? ' (A)' : ''),
          f(a((s) => Math.sqrt(s.sumSq / s.n)), 3),
          f(a((s) => s.under05 / DAYS)),
          f(a((s) => s.underMorning / DAYS)),
          f(a((s) => s.underComfort / DAYS)),
          f(a((s) => s.over05 / DAYS)),
          f(a((s) => s.overEvening / DAYS)),
          f(a((s) => s.starts / DAYS), 1),
          f(a((s) => s.elKwh / DAYS)),
          name === 'pos. app O14' ? `${f(a((s) => s.iMin), 1)} – ${f(a((s) => s.iMax), 1)}` : '—',
        ].join(' | '));
      }
    }
  }
}

/**
 * O22 (ADR-067 D3): rounding hysteresis on the positional recommendation. Without a night setback, so
 * every setpoint change comes from the controller. Thresholds: O22_HYST=0.6,0.75,0.9 (default below).
 */
async function o22() {
  const thresholds = (process.env.O22_HYST || '0.6,0.75,0.9,1').split(',').map(Number);
  const ROWS = [['afronden (was)', undefined], ...thresholds.map((t) => [`hysterese ${String(t).replace('.', ',')} °C`, t])];
  const flow = process.env.FLOW || 'direct';
  for (const em of (process.argv[2] && process.argv[2] !== 'all' ? [process.argv[2]] : ['radiator', 'vloer'])) {
    const preset = EMITTER_PRESETS[em === 'radiator' ? 'radiator' : 'floor'];
    for (const [wName, shift] of [['mild', 0], ['koud (−8 K)', -8]]) {
      console.log(`\n### O22 ${EMITTERS[em].label}; ${wName}; geen nachtverlaging; flow ${flow}; preset Kp ${preset.kp}, Ti ${preset.tiHours} u; ${DAYS} dagen, ${SEEDS.length} seeds\n`);
      console.log('variant | wijzigingen/dag | RMSE (°C) | uren < −0,5 /dag | uren > +0,5 /dag | starts/dag | kWh el/dag');
      console.log('--- | --- | --- | --- | --- | --- | ---');
      for (const [label, roundHyst] of ROWS) {
        const runs = [];
        for (const seed of SEEDS) {
          runs.push(await simulate('pos. app O14', em, seed, flow, {
            Kp: preset.kp, Ti: preset.tiHours, bias: EMITTERS[em].curveBias, toutShift: shift, setback: false, roundHyst,
          }));
        }
        const a = (fn) => avg(runs.map(fn));
        console.log([
          label,
          f(a((s) => s.spChanges / DAYS), 1),
          f(a((s) => Math.sqrt(s.sumSq / s.n)), 3),
          f(a((s) => s.under05 / DAYS)),
          f(a((s) => s.over05 / DAYS)),
          f(a((s) => s.starts / DAYS), 1),
          f(a((s) => s.elKwh / DAYS)),
        ].join(' | '));
      }
    }
  }
}

/**
 * G14 (ADR-062 B7 as pre-heat duration): t = τ·ln((T_eq − T_in)/(T_eq − T_goal)), T_eq = T_out + (P + P_int)/UA,
 * goal = target − 0,3 °C, no sun (the future is unknown). Infinity when T_eq ≤ goal.
 */
function b7Hours(ev, house, p) {
  if (p === null) return null;
  if (ev.tIn >= ev.goal) return 0;
  const tEq = ev.tOut + (p + house.pInt) / house.UA;
  if (tEq <= ev.goal) return Infinity;
  return (house.C / house.UA) * Math.log((tEq - ev.tIn) / (tEq - ev.goal));
}

/**
 * G14 smooth transition: the classes up to a step of 0,5 °C, B7 with the highest hourly mean from 1,5 °C,
 * linearly mixed in between, so that a larger step never jumps to a much shorter time at one threshold.
 */
function g14Blend(ev, house) {
  const delta = ev.target - ev.tIn;
  const classes = calculatePreHeatDuration(house.C / house.UA, delta);
  const b7 = b7Hours(ev, house, ev.pB);
  if (b7 === null) return classes;
  const w = Math.max(0, Math.min(1, (delta - 0.5) / 1.0));
  if (w === 0) return classes;
  if (!Number.isFinite(b7)) return Infinity;
  return (1 - w) * classes + w * b7;
}

/** G14 smooth transition, never shorter than for a smaller step (running maximum in steps of 0,05 °C). */
function g14BlendMono(ev, house) {
  const delta = ev.target - ev.tIn;
  let best = g14Blend(ev, house);
  for (let d = 0.5; d < delta; d += 0.05) {
    best = Math.max(best, g14Blend({ ...ev, tIn: ev.target - d }, house));
  }
  return best;
}

/**
 * G14 physics plus tail: B7 (highest hourly mean) for the warm-up to 0,5 °C below the target, plus the
 * classes for the last ≤ 0,5 °C that the control loop closes slowly. Both parts grow with the step.
 */
function g14Sum(ev, house) {
  const delta = ev.target - ev.tIn;
  if (delta <= 0) return 0;
  const tau = house.C / house.UA;
  const tail = calculatePreHeatDuration(tau, Math.min(delta, 0.5));
  if (delta <= 0.5) return tail;
  if (ev.pB === null) return calculatePreHeatDuration(tau, delta);
  const bulk = b7Hours({ ...ev, goal: ev.target - 0.5 }, house, ev.pB);
  return bulk + tail;
}

/** A prediction is good within 1 h or 30 %; for a target not reached in its window, when it predicts longer. */
function g14Good(pred, ev) {
  if (pred === null) return false;
  if (!Number.isFinite(ev.actual)) return pred > ev.window;
  if (!Number.isFinite(pred)) return false;
  return Math.abs(pred - ev.actual) <= Math.max(1, 0.3 * ev.actual);
}

/** G14: predicted hours per step size for one situation, to check that a larger step never gives a shorter time. */
function g14Monotonic() {
  const house = HOUSE; const target = 21;
  console.log('\n### G14 monotonie: referentiewoning, buiten 10 °C, vermogen 4,9 kW (hoogste uur)\n');
  console.log('stap (°C) | klassen | B7 | harde grens 1 °C | vloeiend | fysica + staart');
  console.log('--- | --- | --- | --- | --- | ---');
  for (const delta of [0.4, 0.5, 0.7, 0.9, 1.0, 1.1, 1.3, 1.5, 2.0, 3.0]) {
    const ev = { tIn: target - delta, tOut: 10, target, goal: target - 0.3, pB: 4.9 };
    const classes = calculatePreHeatDuration(house.C / house.UA, delta);
    const b7 = b7Hours(ev, house, ev.pB);
    console.log([f(delta, 1), f(classes, 1), f(b7, 1), f(delta < 1 ? classes : b7, 1), f(g14Blend(ev, house), 1), f(g14Sum(ev, house), 1)].join(' | '));
  }
}

/** G14: per method, the cases (house × outdoor × power) in which a larger step gives a shorter time. */
function g14MonotonicGrid() {
  const methods = {
    'harde grens 1 °C': (ev, house) => (ev.target - ev.tIn < 1
      ? calculatePreHeatDuration(house.C / house.UA, ev.target - ev.tIn) : b7Hours(ev, house, ev.pB)),
    'vloeiend 0,5–1,5 °C': g14Blend,
    'fysica + staart': g14Sum,
    'vloeiend, nooit korter': g14BlendMono,
  };
  console.log('\n### G14 monotonie over woning (licht, referentie, zwaar) × buiten (−5, 5, 15 °C) × vermogen (3, 5, 7 kW), stap 0,1–4 °C\n');
  console.log('methode | gevallen met een daling | grootste daling (u)');
  console.log('--- | --- | ---');
  for (const [name, fn] of Object.entries(methods)) {
    let cases = 0; let worst = 0;
    for (const house of Object.values(HOUSES)) {
      for (const tOut of [-5, 5, 15]) {
        for (const p of [3, 5, 7]) {
          let prev = 0; let drop = 0;
          for (let d = 0.1; d <= 4.001; d += 0.05) {
            const t = fn({ tIn: 21 - d, tOut, target: 21, goal: 20.7, pB: p }, house);
            if (Number.isFinite(t) && Number.isFinite(prev) && t < prev - 1e-9) drop = Math.max(drop, prev - t);
            prev = t;
          }
          if (drop > 0) { cases++; worst = Math.max(worst, drop); }
        }
      }
    }
    console.log(`${name} | ${cases} van 27 | ${f(worst, 1)}`);
  }
}

async function g14() {
  g14Monotonic();
  g14MonotonicGrid();
  const SCENARIOS = [
    ['weekprogramma', { week: true }],
    ['nachtverlaging 19 °C', { setback: true }],
    ['constant, eenmalig 18 °C', { oneSetback: true }],
    ['2 dagen weg op 16 °C', { away: true }],
  ];
  const CASES = [
    ['radiator', 'referentie'], ['vloer', 'referentie'], ['radiator', 'licht'], ['radiator', 'zwaar'],
  ];
  const WEATHER = [['mild', 0], ['koud (−8 K)', -8]];
  const METHODS = [
    ['klassen (nu)', (ev, house) => calculatePreHeatDuration(house.C / house.UA, ev.target - ev.tIn)],
    ['A: P90', (ev, house) => b7Hours(ev, house, ev.pA)],
    ['B: hoogste uur', (ev, house) => b7Hours(ev, house, ev.pB)],
    ['echt max. 7 kW', (ev, house) => b7Hours(ev, house, HP.Qmax)],
    ['B, klassen onder 1 °C', (ev, house) => (ev.target - ev.tIn < 1
      ? calculatePreHeatDuration(house.C / house.UA, ev.target - ev.tIn) : b7Hours(ev, house, ev.pB))],
    ['vloeiend 0,5–1,5 °C', (ev, house) => g14Blend(ev, house)],
    ['fysica + staart', (ev, house) => g14Sum(ev, house)],
    ['vloeiend, nooit korter', (ev, house) => g14BlendMono(ev, house)],
  ];
  const median = (a) => percentile(a, 0.5);
  console.log(`\n### G14 voorverwarmduur: voorspeld tegen gesimuleerd; ${process.env.G14_VARIANT || 'positioneel (preset)'}, flow direct; ${DAYS} dagen, ${SEEDS.length} seeds, stappen omhoog vanaf dag 7\n`);
  console.log('Goed = binnen 1 uur of 30%; bij een doel dat niet gehaald wordt: als de voorspelling langer is dan het tijdslot. Factor = mediaan van voorspeld / werkelijk.\n');
  console.log(`scenario | afgifte, woning (τ) | weer | stappen | gehaald | werkelijk (mediaan u) | P A / P B (kW) | ${METHODS.map(([m]) => `${m}: goed, factor`).join(' | ')}`);
  console.log(`--- | --- | --- | --- | --- | --- | --- | ${METHODS.map(() => '---').join(' | ')}`);
  for (const [scName, so] of SCENARIOS) {
    for (const [em, houseName] of CASES) {
      const house = HOUSES[houseName];
      const preset = EMITTER_PRESETS[em === 'radiator' ? 'radiator' : 'floor'];
      for (const [wName, shift] of WEATHER) {
        const events = [];
        for (const seed of SEEDS) {
          const st = await simulate(process.env.G14_VARIANT || 'pos. app O14', em, seed, 'direct', {
            Kp: preset.kp, Ti: preset.tiHours, bias: EMITTERS[em].curveBias, toutShift: shift, house, g14: true, ...so,
          });
          events.push(...st.g14);
          if (process.env.G14_DEBUG && seed === SEEDS[0]) {
            for (const ev of st.g14.slice(0, 3)) {
              console.log(`  debug ${scName} ${em} ${houseName} ${wName}: dag ${f(ev.startS / 86400, 2)} Tin ${f(ev.tIn)} Tout ${f(ev.tOut, 1)} doel ${ev.target} `
                + `A ${f(ev.pA, 1)} B ${f(ev.pB, 1)} → ${f(b7Hours(ev, house, ev.pB), 1)} u (B), ${f(b7Hours(ev, house, HP.Qmax), 1)} u (7 kW); werkelijk ${f(ev.actual, 1)} u; `
                + `warmte naar huis ${f(ev.qHouse, 2)} kW, water ${f(ev.twMax, 1)} °C max, setpoint ${ev.spMax} max`);
            }
          }
        }
        const reached = events.filter((ev) => Number.isFinite(ev.actual));
        const cols = METHODS.map(([, fn]) => {
          const preds = events.map((ev) => fn(ev, house));
          const good = events.filter((ev, k) => g14Good(preds[k], ev)).length;
          const ratios = reached.map((ev) => {
            const pr = fn(ev, house);
            return pr === null ? NaN : pr / Math.max(0.25, ev.actual);
          }).filter((x) => !Number.isNaN(x));
          const m = median(ratios);
          return `${Math.round((100 * good) / Math.max(1, events.length))}%, ${m === Infinity ? 'nooit' : f(m, 1)}`;
        });
        console.log([
          scName, `${em}, ${houseName} (${Math.round(house.C / house.UA)} u)`, wName, events.length,
          `${Math.round((100 * reached.length) / Math.max(1, events.length))}%`,
          f(median(reached.map((ev) => ev.actual)), 1),
          `${f(median(events.map((ev) => ev.pA ?? NaN).filter(Number.isFinite)), 1)} / ${f(median(events.map((ev) => ev.pB ?? NaN).filter(Number.isFinite)), 1)}`,
          ...cols,
        ].join(' | '));
      }
    }
  }
}

if (process.env.G14) {
  g14();
} else if (process.env.O22) {
  o22();
} else if (process.env.O16) {
  o16();
} else if (process.env.O14) {
  o14();
} else if (process.env.PROTOCOL) {
  protocol();
} else if (process.env.O4) {
  o4();
} else if (process.env.P4) {
  p4();
} else if (process.env.SENS) {
  sensitivity();
} else if (process.env.TRACE) {
  simulate(process.env.VARIANT || 'incr. PI (huidig)', process.argv[2] || 'radiator', SEEDS[0], process.env.FLOW || 'direct');
} else {
  main();
}
