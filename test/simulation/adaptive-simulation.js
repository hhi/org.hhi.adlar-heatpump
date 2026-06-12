/**
 * Offline simulatie van de geharmoniseerde adaptieve regeling (ADR-060).
 * Draait volledig zonder Homey, tegen de gecompileerde output in .homeybuild/.
 *
 *   npm run simulate
 *
 * Scenario A — Building model learning (4 gesimuleerde dagen, 5-min stappen):
 *   Een virtueel huis met BEKENDE parameters (C, UA, g, P_int) wordt verwarmd door
 *   een virtuele warmtepomp met dagelijkse tapwatercycli (DHW) en defrosts bij kou.
 *   Twee learners draaien parallel op exact dezelfde data:
 *     - GATED:   met de ADR-057 W2b sample-gating (DHW/defrost overslaan) — zoals de app
 *     - UNGATED: zonder gating — zoals vóór de harmonisatie
 *   Toont: convergentie naar de ware parameters, confidence-opbouw (herijkte formule),
 *   de dt-gap-guard bij een gesimuleerde herstart, en de schade van ongegate samples.
 *   Houdt P_int bewust statisch: dit scenario is een DHW/defrost-gating regressietest,
 *   geen test voor de afzonderlijke time-of-day P_int-regressor.
 *
 * Scenario B — Adviesketen (comfort-anker + accumulator + settlement):
 *   Toont: vast comfort-anker 0,6 onafhankelijk van optimizer-confidence (effectieve
 *   Kp ≈ 3,0), accumulatie van kleine optimizer-bijdragen tot een heel-graads advies,
 *   afboeking bij toepassing (settlement-on-observation) en de ±2 °C-clamp.
 *
 * Scenario C — Gesloten lus (kamer → PI → advies → setpoint → kamer):
 *   Toont: de volledige flow-assisted regeling over 12 uur: een koude kamer vraagt
 *   warmte, PI en weging bouwen setpoint-aanbevelingen op, settlement boekt toegepaste
 *   stappen af, het afgiftesysteem reageert vertraagd, en de kamer convergeert naar
 *   de gewenste temperatuur zonder overmatige overshoot.
 *
 * Scenario D — Identificeerbaarheid bij weinig excitatie:
 *   Vergelijkt een bijna-stationaire warmtevraag met een run met variërend vermogen
 *   en buitentemperatuur. Toont dat samples alléén niet genoeg zijn: zonder excitatie
 *   blijft het model dicht bij het startprofiel.
 *
 * Scenario E — Verborgen DHW in gecombineerde modus:
 *   Kwantificeert de bekende beperking dat DHW-cycli binnen gecombineerde modi (5/7)
 *   niet als mode-gate zichtbaar zijn en daarom als ruis/bias in de learner terechtkomen.
 *
 * Scenario F — Datagaten en herstel:
 *   Toont dat ontbrekende COP/power/sensor-data geen learning-samples toevoegen, dat
 *   confidence tijdens de datastilte niet oploopt, en dat learning na herstel doorgaat.
 *
 * Scenario G — Zwaar huis met trage afgifte:
 *   Test de gesloten lus met hoge thermische massa en traag watercircuit om overshoot,
 *   setpoint-bounds en uiteindelijke doeltemperatuur te bewaken.
 *
 * Scenario H — Passive cooldown / coast:
 *   Toont coast-activatie na hysterese + stijgende trend, negatieve staplimiet,
 *   verdringing in de weging, settlement van toegepaste setpointverlagingen, en exit
 *   zodra de kamer terugvalt of de hydraulische coast-correctie verwaarloosbaar is.
 */

'use strict';

const {
  BuildingModelLearner,
  getDynamicPInt,
} = require('../../.homeybuild/lib/adaptive/building-model-learner');
const { HeatingController } = require('../../.homeybuild/lib/adaptive/heating-controller');
const { WeightedDecisionMaker } = require('../../.homeybuild/lib/adaptive/weighted-decision-maker');

// ---------------------------------------------------------------------------
// Hulpmiddelen
// ---------------------------------------------------------------------------

/** Deterministische PRNG (mulberry32) zodat elke run hetzelfde resultaat geeft. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmt = (v, d = 2) => (typeof v === 'number' ? v.toFixed(d) : String(v));
const pad = (s, w) => String(s).padStart(w);

function header(title) {
  console.log(`\n${'═'.repeat(78)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(78));
}

function check(ok, label) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}`);
  if (!ok) process.exitCode = 1;
}

function modelScore(model, truth) {
  return Math.abs(model.C - truth.C) + Math.abs(model.UA - truth.UA) * 20;
}

function runGatingModelSimulation({
  dynamicPInt,
  includeDhwDefrost,
  seed = 42,
  days = 4,
}) {
  const TRUE = {
    C: 12.0,
    UA: 0.25,
    g: 0.5,
    pIntBase: 0.3,
  };

  const rnd = mulberry32(seed);
  const STEP_MIN = 5;
  const STEP_H = STEP_MIN / 60;
  const STEPS = (days * 24 * 60) / STEP_MIN;
  const P_THERMAL = 6.0;
  const COP_NOMINAL = 3.0;
  const TARGET = 20.5;

  const learnerConfig = {
    forgettingFactor: 0.999,
    initialCovariance: 100,
    minSamplesForConfidence: 288,
    buildingProfile: 'average',
    enableDynamicPInt: dynamicPInt,
    logger: () => { },
  };

  const guardLog = { dtGap: 0, invalid: 0, divergence: 0 };
  const gated = new BuildingModelLearner({
    ...learnerConfig,
    logger: (msg) => {
      if (typeof msg !== 'string') return;
      if (msg.includes('Time gap') || msg.includes('baseline refreshed')) guardLog.dtGap++;
      if (msg.includes('INVALID MEASUREMENT')) guardLog.invalid++;
      if (msg.includes('DIVERGENCE')) guardLog.divergence++;
    },
  });
  const ungated = new BuildingModelLearner(learnerConfig);
  const dynamic = new BuildingModelLearner({ ...learnerConfig, enableDynamicPInt: true });
  const staticPInt = new BuildingModelLearner({ ...learnerConfig, enableDynamicPInt: false });

  let tIndoor = 19.5;
  let heatingOn = false;
  let lastDefrostEnd = -999;
  let restartDone = false;

  const progress = [];

  for (let i = 0; i < STEPS; i++) {
    const tMs = i * STEP_MIN * 60 * 1000;
    const hourOfDay = (i * STEP_MIN) / 60 % 24;
    const dayHourAbs = (i * STEP_MIN) / 60;

    const tOutdoor = 2 + 4 * Math.sin(((hourOfDay - 9) / 24) * 2 * Math.PI) + (rnd() - 0.5) * 0.4;
    const solar = hourOfDay > 8 && hourOfDay < 17
      ? Math.max(0, 400 * Math.sin(((hourOfDay - 8) / 9) * Math.PI)) : 0;
    const pInt = dynamicPInt ? getDynamicPInt(Math.floor(hourOfDay), TRUE.pIntBase) : TRUE.pIntBase;

    if (tIndoor < TARGET - 0.3) heatingOn = true;
    if (tIndoor > TARGET + 0.3) heatingOn = false;

    const inDHW = includeDhwDefrost && ((hourOfDay >= 7 && hourOfDay < 7.5) || (hourOfDay >= 19 && hourOfDay < 19.5));
    let inDefrost = false;
    if (includeDhwDefrost && heatingOn && tOutdoor < 3 && (dayHourAbs - lastDefrostEnd) > 2) {
      inDefrost = true;
      if ((i % 3) === 2) lastDefrostEnd = dayHourAbs;
    }

    let pHouse = 0;
    if (inDefrost) pHouse = -2.0;
    else if (inDHW) pHouse = 0;
    else if (heatingOn) pHouse = P_THERMAL;

    const dT = (STEP_H / TRUE.C)
      * (pHouse - TRUE.UA * (tIndoor - tOutdoor) + TRUE.g * (solar / 1000) + pInt);
    tIndoor += dT + (rnd() - 0.5) * 0.01;

    if (includeDhwDefrost && dayHourAbs >= 60 && dayHourAbs < 63) {
      restartDone = true;
      continue;
    }

    const measuredIndoor = tIndoor + (rnd() - 0.5) * 0.04;
    const phantomPHeating = (heatingOn || inDHW || inDefrost) ? (P_THERMAL / COP_NOMINAL) * COP_NOMINAL : 0;
    const sample = {
      timestamp: tMs,
      tIndoor: measuredIndoor,
      tOutdoor,
      pHeating: phantomPHeating,
      solarRadiation: solar,
      solarSource: 'estimation',
      deltaTPerHour: 0,
    };

    if (!inDHW && !inDefrost) gated.addMeasurement({ ...sample, pHeating: heatingOn ? P_THERMAL : 0 });
    ungated.addMeasurement(sample);
    dynamic.addMeasurement({ ...sample, pHeating: heatingOn ? P_THERMAL : 0 });
    staticPInt.addMeasurement({ ...sample, pHeating: heatingOn ? P_THERMAL : 0 });

    if (includeDhwDefrost && i > 0 && i % 144 === 0) {
      progress.push({
        hour: Math.round(dayHourAbs),
        tIndoor,
        tOutdoor,
        status: inDefrost ? 'defrost ' : inDHW ? 'DHW     ' : heatingOn ? 'verwarmt' : 'uit     ',
        gated: gated.getModel(),
        ungated: ungated.getModel(),
      });
    }
  }

  return {
    TRUE,
    gated: gated.getModel(),
    ungated: ungated.getModel(),
    dynamic: dynamic.getModel(),
    staticPInt: staticPInt.getModel(),
    gatedExcitation: gated.getExcitationDiagnostics(),
    ungatedExcitation: ungated.getExcitationDiagnostics(),
    dynamicExcitation: dynamic.getExcitationDiagnostics(),
    staticExcitation: staticPInt.getExcitationDiagnostics(),
    guardLog,
    restartDone,
    progress,
  };
}

// ---------------------------------------------------------------------------
// Scenario A — Building model learning
// ---------------------------------------------------------------------------

function scenarioA() {
  header('SCENARIO A — Building model: varianten voor gating en dynamische P_int');

  const a1 = runGatingModelSimulation({ dynamicPInt: false, includeDhwDefrost: true });
  const { TRUE } = a1;
  console.log(`  Waar huis:  C=${TRUE.C} kWh/°C, UA=${TRUE.UA} kW/°C, g=${TRUE.g}, P_int=${TRUE.pIntBase} kW`);
  console.log('  Startprofiel learner: average (C=15, UA=0.3) — moet richting waarheid bewegen\n');

  console.log('  A1 — DHW/defrost-gating met statische P_int');
  console.log('  tijd   | binnen | buiten | status   || GATED C/UA/conf      || UNGATED C/UA/conf');
  console.log('  -------|--------|--------|----------||----------------------||------------------');
  a1.progress.forEach((row) => {
    console.log(
      `  ${pad(`${row.hour}u`, 5)} | ${pad(fmt(row.tIndoor, 1), 6)} | ${pad(fmt(row.tOutdoor, 1), 6)} | `
      + `${row.status} || `
      + `C=${pad(fmt(row.gated.C, 1), 5)} UA=${fmt(row.gated.UA, 3)} ${pad(fmt(row.gated.confidence, 0), 3)}% || `
      + `C=${pad(fmt(row.ungated.C, 1), 5)} UA=${fmt(row.ungated.UA, 3)} ${pad(fmt(row.ungated.confidence, 0), 3)}%`,
    );
  });

  console.log('\n  Eindresultaat na 4 dagen:');
  console.log(`             ${pad('C (waar 12.0)', 16)} ${pad('UA (waar 0.250)', 16)} ${pad('τ (waar 48h)', 14)} ${pad('confidence', 11)} ${pad('reverts', 8)}`);
  console.log(`    GATED:   ${pad(fmt(a1.gated.C, 1), 16)} ${pad(fmt(a1.gated.UA, 3), 16)} ${pad(fmt(a1.gated.tau, 1), 14)} ${pad(`${fmt(a1.gated.confidence, 0)}%`, 11)} ${pad(a1.gatedExcitation.totalReverts, 8)}`);
  console.log(`    UNGATED: ${pad(fmt(a1.ungated.C, 1), 16)} ${pad(fmt(a1.ungated.UA, 3), 16)} ${pad(fmt(a1.ungated.tau, 1), 14)} ${pad(`${fmt(a1.ungated.confidence, 0)}%`, 11)} ${pad(a1.ungatedExcitation.totalReverts, 8)}`);
  console.log(`\n  Guard-activaties (gated learner): dt-gap=${a1.guardLog.dtGap}×, invalid=${a1.guardLog.invalid}×, divergence=${a1.guardLog.divergence}×`);

  const a1GatedScore = modelScore(a1.gated, TRUE);
  const a1UngatedScore = modelScore(a1.ungated, TRUE);
  const errC = { gated: Math.abs(a1.gated.C - TRUE.C), ungated: Math.abs(a1.ungated.C - TRUE.C) };
  const errUA = { gated: Math.abs(a1.gated.UA - TRUE.UA), ungated: Math.abs(a1.ungated.UA - TRUE.UA) };
  check(a1GatedScore < a1UngatedScore,
    `A1 gating verbetert gecombineerde score (${fmt(a1GatedScore, 2)} vs ${fmt(a1UngatedScore, 2)}; |ΔC| ${fmt(errC.gated, 2)} vs ${fmt(errC.ungated, 2)}, |ΔUA| ${fmt(errUA.gated, 3)} vs ${fmt(errUA.ungated, 3)})`);
  check(errC.gated < 3.0, `A1 gated C binnen 3 kWh/°C van waarheid (Δ=${fmt(errC.gated, 2)})`);
  check(a1.restartDone && a1.guardLog.dtGap >= 1,
    `A1 dt-gap-guard actief: herstart + eerste sample na elk gated DHW/defrost-venster (${a1.guardLog.dtGap}× baseline-verversing)`);
  check(a1.gated.confidence >= 40, `A1 confidence na 4 dagen ≥ 40% (nu ${fmt(a1.gated.confidence, 0)}%)`);
  check(a1.gated.tau > 1.25 && a1.gated.tau < 500, `A1 τ binnen fysieke bounds (${fmt(a1.gated.tau, 1)}h)`);

  const a2 = runGatingModelSimulation({ dynamicPInt: true, includeDhwDefrost: false, seed: 43 });
  const a2DynamicScore = modelScore(a2.dynamic, a2.TRUE);
  const a2StaticScore = modelScore(a2.staticPInt, a2.TRUE);
  console.log('\n  A2 — dynamische P_int zonder DHW/defrost');
  console.log(`    dynamic P_int: C=${fmt(a2.dynamic.C, 1)}, UA=${fmt(a2.dynamic.UA, 3)}, score=${fmt(a2DynamicScore, 2)}`);
  console.log(`    static P_int:  C=${fmt(a2.staticPInt.C, 1)}, UA=${fmt(a2.staticPInt.UA, 3)}, score=${fmt(a2StaticScore, 2)}`);
  check(a2DynamicScore <= a2StaticScore + 0.25,
    `A2 dynamische P_int is niet slechter dan statisch buiten marge (${fmt(a2DynamicScore, 2)} vs ${fmt(a2StaticScore, 2)})`);
  check(Math.abs(a2.dynamic.C - a2.TRUE.C) < 3.0,
    `A2 dynamic C binnen 3 kWh/°C van waarheid (Δ=${fmt(Math.abs(a2.dynamic.C - a2.TRUE.C), 2)})`);
  check(Math.abs(a2.dynamic.UA - a2.TRUE.UA) < 0.06,
    `A2 dynamic UA binnen 0.06 kW/°C van waarheid (Δ=${fmt(Math.abs(a2.dynamic.UA - a2.TRUE.UA), 3)})`);

  const a3 = runGatingModelSimulation({ dynamicPInt: true, includeDhwDefrost: true, seed: 44 });
  const a3GatedScore = modelScore(a3.gated, a3.TRUE);
  const a3UngatedScore = modelScore(a3.ungated, a3.TRUE);
  console.log('\n  A3 — dynamische P_int + DHW/defrost stress-case');
  console.log(`    gated:   C=${fmt(a3.gated.C, 1)}, UA=${fmt(a3.gated.UA, 3)}, score=${fmt(a3GatedScore, 2)}, reverts=${a3.gatedExcitation.totalReverts}`);
  console.log(`    ungated: C=${fmt(a3.ungated.C, 1)}, UA=${fmt(a3.ungated.UA, 3)}, score=${fmt(a3UngatedScore, 2)}, reverts=${a3.ungatedExcitation.totalReverts}`);
  check(a3GatedScore <= a3UngatedScore + 0.5,
    `A3 gated gecombineerde score niet slechter dan ungated buiten marge (${fmt(a3GatedScore, 2)} vs ${fmt(a3UngatedScore, 2)})`);
  check(a3.gated.C > 5 && a3.gated.C < 40 && a3.gated.UA > 0.05 && a3.gated.UA < 1.0,
    `A3 gated parameters blijven fysiek plausibel (C=${fmt(a3.gated.C, 1)}, UA=${fmt(a3.gated.UA, 3)})`);
  check(a3.gated.tau > 1.25 && a3.gated.tau < 500,
    `A3 τ binnen fysieke bounds (${fmt(a3.gated.tau, 1)}h)`);
}

// ---------------------------------------------------------------------------
// Scenario B — Adviesketen: anker + accumulator + settlement
// ---------------------------------------------------------------------------

async function scenarioB() {
  header('SCENARIO B — Adviesketen: comfort-anker, accumulator en settlement');

  // Productieconfiguratie: inclusief thermal 0.20 (totaal 1.2) — de ADR-060-precisering
  const dm = new WeightedDecisionMaker({
    comfort: 0.60, efficiency: 0.25, cost: 0.15, thermal: 0.20,
  });
  const pi = new HeatingController({ logger: () => { } }); // defaults: Kp=5.0, Ki=1.5

  const FULL = { copConfidence: 1.0, buildingModelConfidence: 1.0, priceDataAvailable: true };
  const NONE = { copConfidence: 0.0, buildingModelConfidence: 0.0, priceDataAvailable: false };

  // B1 — Vast anker: zelfde kamertemperatuurfout, totaal verschillende databeschikbaarheid
  console.log('\n  B1. Vast comfort-anker (productieconfig mét thermal):');
  const err = 0.6; // °C onder gewenst
  const action1 = await pi.calculateAction({ indoorTemp: 20.0 - err, targetTemp: 20.0, timestamp: 0 });
  const withFull = dm.combineActionsWithThermal(action1, null, null, null, FULL, null);
  const withNone = dm.combineActionsWithThermal(action1, null, null, null, NONE, null);
  console.log(`     PI-uitvoer bij fout ${err}°C: ${fmt(action1.temperatureAdjustment)}°C (Kp=5.0)`);
  console.log(`     comfort-gewicht vol vertrouwen: ${fmt(withFull.effectiveWeights.comfort, 3)}, geen vertrouwen: ${fmt(withNone.effectiveWeights.comfort, 3)}`);
  check(Math.abs(withFull.effectiveWeights.comfort - 0.6) < 1e-9, 'Anker = 0,6 mét thermal geconfigureerd (was 0,5 vóór de fix)');
  check(withFull.breakdown.comfort === withNone.breakdown.comfort, 'Comfort-bijdrage onafhankelijk van optimizer-confidence');
  const effGain = withFull.breakdown.comfort / err;
  console.log(`     effectieve lusversterking: ${fmt(effGain, 2)} (doel ≈ 3,0 = Kp 5,0 × anker 0,6; incl. I-term iets hoger)`);
  check(effGain > 2.5 && effGain < 4.0, `Effectieve versterking in de buurt van 3,0 (${fmt(effGain, 2)})`);

  // B2 — Accumulator: kleine optimizer-bijdragen tellen op tot een heel-graads advies
  console.log('\n  B2. Accumulator: kleine bijdragen bereiken de gebruiker:');
  let accumulator = 0;
  const CLAMP = 2.0;
  let setpoint = 35; // huidig setpoint-register 0x0301
  let cyclesToAdvice = null;
  let postSettlement = null;
  const piIdle = new HeatingController({ logger: () => { } });

  for (let cycle = 1; cycle <= 40; cycle++) {
    // Kamer op temperatuur (PI in deadband → null), maar prijs is laag: preheat-advies +0.5
    const heating = await piIdle.calculateAction({ indoorTemp: 20.0, targetTemp: 20.0, timestamp: cycle * 300000 });
    const price = { action: 'preheat', magnitude: 0.5, reason: 'goedkoop blok', priority: 'low' };
    const combined = dm.combineActionsWithThermal(heating, null, price, null, FULL, null);

    accumulator = Math.max(-CLAMP, Math.min(CLAMP, accumulator + combined.finalAdjustment));
    const recommended = setpoint + Math.round(accumulator);
    if (recommended !== setpoint) {
      cyclesToAdvice = cycle;
      console.log(`     cyclus ${cycle}: advies ${setpoint} → ${recommended}°C (accumulator ${fmt(accumulator)}°C, per cyclus +${fmt(combined.finalAdjustment)}°C)`);
      // Settlement: de gebruikersflow past toe → afboeken
      const applied = recommended - setpoint;
      setpoint = recommended;
      accumulator -= applied;
      postSettlement = accumulator;
      console.log(`     settlement: toegepast +${applied}°C, accumulator terug naar ${fmt(accumulator)}°C`);
      break; // demonstratie compleet — bij aanhoudend goedkope prijs zou een volgend advies volgen
    }
  }
  check(cyclesToAdvice !== null && cyclesToAdvice > 1,
    `Sub-graad prijsbijdrage cumuleerde in ${cyclesToAdvice} cycli (${cyclesToAdvice * 5} min) tot een heel-graads advies`);
  check(postSettlement !== null && Math.abs(postSettlement) < 1.0,
    `Accumulator direct na settlement netjes klein (${fmt(postSettlement)}°C)`);

  // B3 — Clamp: genegeerde adviezen bouwen niet onbeperkt op
  console.log('\n  B3. Clamp ±2,0 °C bij genegeerde adviezen:');
  let acc2 = 0;
  for (let i = 0; i < 200; i++) {
    const heating = await piIdle.calculateAction({ indoorTemp: 19.0, targetTemp: 20.0, timestamp: (100 + i) * 300000 });
    const combined = dm.combineActionsWithThermal(heating, null, null, null, FULL, null);
    acc2 = Math.max(-CLAMP, Math.min(CLAMP, acc2 + combined.finalAdjustment));
  }
  console.log(`     na 200 genegeerde cycli met fout 1,0°C: accumulator = ${fmt(acc2)}°C`);
  check(acc2 === CLAMP, `Accumulator geklemd op +${CLAMP}°C — geen onbegrensde opbouw`);

  // B4 — Coast-verdringing (ter volledigheid, zelfde mechaniek als in de app)
  console.log('\n  B4. Coast-verdringing:');
  const piAct = await pi.calculateAction({ indoorTemp: 21.5, targetTemp: 20.0, timestamp: 999000000 });
  const coast = {
    adjustment: -1.2, reason: 'uitlaat 34°C − offset', priority: 'high', strength: 0.8,
  };
  const coasted = dm.combineActionsWithThermal(piAct, null, null, null, FULL, coast);
  console.log(`     gewichten: comfort=${fmt(coasted.effectiveWeights.comfort, 2)}, coast=${fmt(coasted.effectiveWeights.coast, 2)}, advies=${fmt(coasted.finalAdjustment)}°C`);
  check(Math.abs(coasted.effectiveWeights.coast - 0.8) < 1e-9 && coasted.finalAdjustment < 0,
    'Coast verdringt naar 80% en het advies is negatief (afkoelen)');
}

// ---------------------------------------------------------------------------
// Scenario C — Gesloten lus: de adaptieve temperatuurregeling van begin tot eind
// ---------------------------------------------------------------------------

/**
 * Demonstreert de werkelijke regeling (cascade): de kamer wijkt af van de gewenste
 * binnentemperatuur → PI berekent een delta → weging → accumulator → aanbeveling →
 * een gesimuleerde gebruikersflow past het setpoint-register toe (settlement) →
 * de warmtepomp levert meer/minder vermogen → de kamer convergeert naar het doel.
 *
 * Virtueel afgiftesysteem: P_thermisch = K_RAD × (watersetpoint − T_kamer), begrensd.
 */
async function scenarioC() {
  header('SCENARIO C — Gesloten lus: kamer 18,5 °C → gewenst 21,0 °C (12 uur, 5-min cycli)');

  // Huis (lichter dan scenario A zodat 12 uur volstaat) en afgiftesysteem
  const C = 8.0; // kWh/°C
  const UA = 0.25; // kW/°C
  const P_INT = 0.3; // kW
  const K_RAD = 0.35; // kW per °C (water − kamer)
  const P_MAX = 8.0; // kW
  const T_OUT = 2.0; // °C, koude dag
  const DESIRED = 21.0;
  const SP_MIN = 20; const SP_MAX = 55;

  const dm = new WeightedDecisionMaker({
    comfort: 0.60, efficiency: 0.25, cost: 0.15, thermal: 0.20,
  });
  const pi = new HeatingController({ logger: () => { } }); // Kp=5.0, Ki=1.5, deadband 0.3
  const FULL = { copConfidence: 1.0, buildingModelConfidence: 1.0, priceDataAvailable: true };

  let tIndoor = 18.5; // na nachtverlaging
  let tWater = 28; // werkelijke watertemperatuur (loopt traag achter het setpoint aan)
  const TAU_WATER_H = 0.5; // eerste-orde naijling van het afgiftesysteem (~30 min)
  let setpoint = 32; // watersetpoint (register 0x0301)
  let accumulator = 0;
  const CLAMP = 2.0;
  let adviceCount = 0;
  let firstOnTarget = null;
  let maxIndoor = -99;
  const lastTwoHours = [];

  console.log('  De gesimuleerde gebruikersflow past elke aanbeveling direct toe (flow-assisted).');
  console.log('  Het water volgt het setpoint eerste-orde (τ ≈ 30 min) — zoals een echt afgiftesysteem.');
  console.log('\n  tijd | kamer  | fout   | PI-advies | accu  | setpoint | water | P_wp');
  console.log('  -----|--------|--------|-----------|-------|----------|-------|------');

  const CYCLES = 144; // 12 uur
  for (let i = 1; i <= CYCLES; i++) {
    // 1. Water loopt traag richting het setpoint; warmtepomp levert via het afgiftesysteem
    tWater += ((5 / 60) / TAU_WATER_H) * (setpoint - tWater);
    const pHeat = Math.max(0, Math.min(P_MAX, K_RAD * (tWater - tIndoor)));

    // 2. Fysica: kamer reageert (5 min)
    tIndoor += ((5 / 60) / C) * (pHeat - UA * (tIndoor - T_OUT) + P_INT);
    maxIndoor = Math.max(maxIndoor, tIndoor);
    if (firstOnTarget === null && tIndoor >= DESIRED - 0.3) firstOnTarget = i;
    if (i > CYCLES - 24) lastTwoHours.push(tIndoor);

    // 3. Adviesketen (exact de app-mechaniek: PI → weging → accumulator → advies)
    const heating = await pi.calculateAction({ indoorTemp: tIndoor, targetTemp: DESIRED, timestamp: i * 300000 });
    const combined = dm.combineActionsWithThermal(heating, null, null, null, FULL, null);
    accumulator = Math.max(-CLAMP, Math.min(CLAMP, accumulator + combined.finalAdjustment));
    const recommended = Math.max(SP_MIN, Math.min(SP_MAX, setpoint + Math.round(accumulator)));

    // 4. Gebruikersflow past toe → settlement-on-observation
    if (recommended !== setpoint) {
      adviceCount++;
      const applied = recommended - setpoint;
      setpoint = recommended;
      accumulator -= applied;
    }

    if (i % 12 === 0) { // elk uur een regel
      console.log(
        `  ${pad(`${i / 12}u`, 4)} | ${pad(fmt(tIndoor, 2), 6)} | ${pad(fmt(DESIRED - tIndoor, 2), 6)} | `
        + `${pad(heating ? fmt(heating.temperatureAdjustment, 2) : 'deadband', 9)} | ${pad(fmt(accumulator, 2), 5)} | `
        + `${pad(setpoint, 8)} | ${pad(fmt(tWater, 1), 5)} | ${pad(fmt(pHeat, 1), 4)} kW`,
      );
    }
  }

  const tail = lastTwoHours.reduce((s, v) => s + v, 0) / lastTwoHours.length;
  console.log(`\n  Aanbevelingen toegepast: ${adviceCount}; op temperatuur (±0,3°C) na ${fmt((firstOnTarget ?? 0) / 12, 1)} uur`);
  console.log('\n  Toetsing:');
  check(firstOnTarget !== null, `Kamer bereikt de gewenste zone (eerste keer na ${fmt((firstOnTarget ?? 0) / 12, 1)}u)`);
  check(maxIndoor <= DESIRED + 1.0, `Overshoot begrensd (max ${fmt(maxIndoor, 2)}°C ≤ ${fmt(DESIRED + 1.0, 1)}°C)`);
  check(Math.abs(tail - DESIRED) <= 0.5, `Laatste 2 uur gemiddeld op doel: ${fmt(tail, 2)}°C (doel ${DESIRED} ± 0,5)`);
  check(setpoint >= SP_MIN && setpoint <= SP_MAX, `Setpoint bleef binnen [${SP_MIN}, ${SP_MAX}] (eind: ${setpoint}°C)`);
}

// ---------------------------------------------------------------------------
// Scenario D — Identificeerbaarheid bij weinig excitatie
// ---------------------------------------------------------------------------

function scenarioD() {
  header('SCENARIO D — Identificeerbaarheid: varianten voor excitatie en regressoren');

  const TRUE = {
    C: 15.0, UA: 0.30, g: 0.45, pIntBase: 0.30,
  };
  const STEP_H = 5 / 60;
  const SAMPLES = 8000;
  const START_TIME = 1700000000000;

  const makeLearner = (enableDynamicPInt = false) => new BuildingModelLearner({
    forgettingFactor: 0.999,
    initialCovariance: 100,
    minSamplesForConfidence: 288,
    buildingProfile: 'light', // bewust verkeerd startprofiel: C=7
    enableDynamicPInt,
    logger: () => { },
  });

  const run = (kind) => {
    const dynamicPInt = kind === 'dynamic-regressors';
    const learner = makeLearner(dynamicPInt);
    let tIndoor = 20.0;
    for (let i = 0; i < SAMPLES; i++) {
      const excited = kind === 'excited' || kind === 'dynamic-regressors';
      const hourOfDay = (i * 5) / 60 % 24;
      const tOutdoor = excited ? 5 + 5 * Math.sin(i / 60) : 5;
      const solar = kind === 'dynamic-regressors' && hourOfDay > 8 && hourOfDay < 17
        ? Math.max(0, 450 * Math.sin(((hourOfDay - 8) / 9) * Math.PI)) : 0;
      const pInt = dynamicPInt ? getDynamicPInt(Math.floor(hourOfDay), TRUE.pIntBase) : TRUE.pIntBase;
      // Poor-excitation case: precies het vermogen rond stationair evenwicht.
      const pHeating = excited
        ? Math.max(0, 2.0 + 1.5 * Math.sin(i / 20) + 0.8 * Math.sin(i / 7))
        : TRUE.UA * (20 - tOutdoor) - TRUE.pIntBase;

      learner.addMeasurement({
        timestamp: START_TIME + i * 5 * 60 * 1000,
        tIndoor,
        tOutdoor,
        pHeating,
        solarRadiation: solar,
        solarSource: 'estimation',
        deltaTPerHour: 0,
      });

      tIndoor += (STEP_H / TRUE.C)
        * (pHeating - TRUE.UA * (tIndoor - tOutdoor) + TRUE.g * (solar / 1000) + pInt);
    }
    return { model: learner.getModel(), excitation: learner.getExcitationDiagnostics() };
  };

  const poor = run('poor');
  const excited = run('excited');
  const dynamic = run('dynamic-regressors');
  const poorErrC = Math.abs(poor.model.C - TRUE.C);
  const excitedErrC = Math.abs(excited.model.C - TRUE.C);
  const dynamicErrC = Math.abs(dynamic.model.C - TRUE.C);
  const poorScore = modelScore(poor.model, TRUE);
  const excitedScore = modelScore(excited.model, TRUE);
  const dynamicScore = modelScore(dynamic.model, TRUE);

  console.log(`  Waar C=${TRUE.C}, startprofiel C≈7`);
  console.log(`  D1 weinig excitatie:       C=${fmt(poor.model.C, 1)}, UA=${fmt(poor.model.UA, 3)}, score=${fmt(poorScore, 2)}, confidence=${fmt(poor.model.confidence, 0)}%`);
  console.log(`  D2 vermogen/weer-variatie: C=${fmt(excited.model.C, 1)}, UA=${fmt(excited.model.UA, 3)}, score=${fmt(excitedScore, 2)}, confidence=${fmt(excited.model.confidence, 0)}%`);
  console.log(`  D3 + zon/dyn P_int:        C=${fmt(dynamic.model.C, 1)}, UA=${fmt(dynamic.model.UA, 3)}, score=${fmt(dynamicScore, 2)}, confidence=${fmt(dynamic.model.confidence, 0)}%`);
  console.log('\n  Toetsing:');
  check(poorErrC > 6.0,
    `D1 zonder excitatie blijft C dicht bij het verkeerde startprofiel (ΔC=${fmt(poorErrC, 1)})`);
  check(excitedErrC < poorErrC && excitedScore < poorScore,
    `D2 variatie verbetert C én gecombineerde score (ΔC ${fmt(excitedErrC, 1)} vs ${fmt(poorErrC, 1)}, score ${fmt(excitedScore, 2)} vs ${fmt(poorScore, 2)})`);
  check(Math.abs(excited.model.UA - TRUE.UA) < Math.abs(poor.model.UA - TRUE.UA) + 0.2,
    `D2 UA blijft informatief begrensd (ΔUA=${fmt(Math.abs(excited.model.UA - TRUE.UA), 3)})`);
  check(dynamicErrC < poorErrC && dynamicScore < poorScore,
    `D3 regressoren blijven identificeerbaar beter dan weinig excitatie (score ${fmt(dynamicScore, 2)} vs ${fmt(poorScore, 2)})`);
  check(dynamic.model.g > 0.05 && dynamic.model.g < 1.0,
    `D3 solar gain blijft fysiek plausibel (g=${fmt(dynamic.model.g, 3)})`);
  check(excited.excitation.totalReverts >= poor.excitation.totalReverts,
    `D2 excitatiepad activeert beschermlagen zichtbaar (${excited.excitation.totalReverts} vs ${poor.excitation.totalReverts} reverts)`);
}

// ---------------------------------------------------------------------------
// Scenario E — Verborgen DHW in gecombineerde modus
// ---------------------------------------------------------------------------

function scenarioE() {
  header('SCENARIO E — Verborgen DHW in gecombineerde modus: bias kwantificeren');

  const TRUE = { C: 12.0, UA: 0.25, g: 0.5, pIntBase: 0.3 };
  const rnd = mulberry32(57);
  const STEP_MIN = 5;
  const STEP_H = STEP_MIN / 60;
  const STEPS = (4 * 24 * 60) / STEP_MIN;
  const P_THERMAL = 6.0;
  const TARGET = 20.5;
  const START_TIME = 1700000000000;

  const makeLearner = () => new BuildingModelLearner({
    forgettingFactor: 0.999,
    initialCovariance: 100,
    minSamplesForConfidence: 288,
    buildingProfile: 'average',
    enableDynamicPInt: true,
    logger: () => { },
  });

  const ideal = makeLearner();
  const hiddenDhw = makeLearner();
  let tIndoor = 19.5;
  let heatingOn = false;
  let dhwSamples = 0;

  for (let i = 0; i < STEPS; i++) {
    const hourOfDay = (i * STEP_MIN) / 60 % 24;
    const tOutdoor = 2 + 4 * Math.sin(((hourOfDay - 9) / 24) * 2 * Math.PI) + (rnd() - 0.5) * 0.4;
    const solar = hourOfDay > 8 && hourOfDay < 17
      ? Math.max(0, 400 * Math.sin(((hourOfDay - 8) / 9) * Math.PI)) : 0;
    const pInt = getDynamicPInt(Math.floor(hourOfDay), TRUE.pIntBase);

    if (tIndoor < TARGET - 0.3) heatingOn = true;
    if (tIndoor > TARGET + 0.3) heatingOn = false;

    // Verborgen DHW binnen gecombineerde modus 5/7: configured mode blijft heating-capable.
    const inHiddenDhw = (hourOfDay >= 7 && hourOfDay < 7.5) || (hourOfDay >= 19 && hourOfDay < 19.5);
    const pHouse = inHiddenDhw ? 0 : heatingOn ? P_THERMAL : 0;
    const phantomPHeating = (heatingOn || inHiddenDhw) ? P_THERMAL : 0;

    tIndoor += (STEP_H / TRUE.C)
      * (pHouse - TRUE.UA * (tIndoor - tOutdoor) + TRUE.g * (solar / 1000) + pInt)
      + (rnd() - 0.5) * 0.01;

    const sample = {
      timestamp: START_TIME + i * STEP_MIN * 60 * 1000,
      tIndoor: tIndoor + (rnd() - 0.5) * 0.04,
      tOutdoor,
      pHeating: phantomPHeating,
      solarRadiation: solar,
      solarSource: 'estimation',
      deltaTPerHour: 0,
    };

    if (!inHiddenDhw) ideal.addMeasurement({ ...sample, pHeating: heatingOn ? P_THERMAL : 0 });
    else dhwSamples++;
    hiddenDhw.addMeasurement(sample);
  }

  const iModel = ideal.getModel();
  const hModel = hiddenDhw.getModel();
  const idealErr = Math.abs(iModel.C - TRUE.C) + Math.abs(iModel.UA - TRUE.UA) * 20;
  const hiddenErr = Math.abs(hModel.C - TRUE.C) + Math.abs(hModel.UA - TRUE.UA) * 20;

  console.log(`  Verborgen DHW-samples: ${dhwSamples}`);
  console.log(`  ideaal gegated: C=${fmt(iModel.C, 1)}, UA=${fmt(iModel.UA, 3)}, confidence=${fmt(iModel.confidence, 0)}%`);
  console.log(`  verborgen DHW:  C=${fmt(hModel.C, 1)}, UA=${fmt(hModel.UA, 3)}, confidence=${fmt(hModel.confidence, 0)}%`);
  console.log('\n  Toetsing:');
  check(dhwSamples > 0, `DHW-vensters zijn daadwerkelijk aanwezig (${dhwSamples} samples)`);
  check(hiddenErr > idealErr,
    `Verborgen DHW geeft meetbare extra bias (score ${fmt(hiddenErr, 2)} vs ${fmt(idealErr, 2)})`);
  check(Math.abs(hModel.C - TRUE.C) < 5.0,
    `Bias blijft begrensd in deze nominale casus (C=${fmt(hModel.C, 1)})`);
}

// ---------------------------------------------------------------------------
// Scenario F — Datagaten en herstel
// ---------------------------------------------------------------------------

function scenarioF() {
  header('SCENARIO F — Datagaten: ontbrekende COP/power/sensor-data voegt geen samples toe');

  const learner = new BuildingModelLearner({
    forgettingFactor: 0.999,
    initialCovariance: 100,
    minSamplesForConfidence: 288,
    buildingProfile: 'average',
    enableDynamicPInt: false,
    logger: () => { },
  });
  const TRUE = { C: 15.0, UA: 0.30, pInt: 0.30 };
  const STEP_H = 5 / 60;
  const START_TIME = 1700000000000;
  let tIndoor = 20.0;

  const addSample = (i) => {
    const pHeating = Math.max(0, 2.0 + 1.5 * Math.sin(i / 20) + 0.8 * Math.sin(i / 7));
    const tOutdoor = 5 + 5 * Math.sin(i / 60);
    learner.addMeasurement({
      timestamp: START_TIME + i * 5 * 60 * 1000,
      tIndoor,
      tOutdoor,
      pHeating,
      solarRadiation: 0,
      solarSource: 'estimation',
      deltaTPerHour: 0,
    });
    tIndoor += (STEP_H / TRUE.C) * (pHeating - TRUE.UA * (tIndoor - tOutdoor) + TRUE.pInt);
  };

  for (let i = 0; i < 288; i++) addSample(i);
  const beforeGapCount = learner.getState().sampleCount;
  const beforeGapConfidence = learner.getModel().confidence;

  // 24 uur geen geldige data: BuildingModelService zou in deze gevallen returnen
  // vóór addMeasurement() bij ontbrekende indoor/outdoor/power/COP.
  for (let i = 288; i < 576; i++) {
    const pHeating = Math.max(0, 2.0 + 1.5 * Math.sin(i / 20) + 0.8 * Math.sin(i / 7));
    const tOutdoor = 5 + 5 * Math.sin(i / 60);
    tIndoor += (STEP_H / TRUE.C) * (pHeating - TRUE.UA * (tIndoor - tOutdoor) + TRUE.pInt);
  }

  const duringGapCount = learner.getState().sampleCount;
  const duringGapConfidence = learner.getModel().confidence;

  addSample(576); // groot tijdgat: baseline refresh, geen learning-update
  const resumeFirstCount = learner.getState().sampleCount;
  addSample(577); // normale 5-min stap: learning hervat
  const resumedCount = learner.getState().sampleCount;

  console.log(`  vóór datagat: samples=${beforeGapCount}, confidence=${fmt(beforeGapConfidence, 0)}%`);
  console.log(`  na 24u stilte: samples=${duringGapCount}, confidence=${fmt(duringGapConfidence, 0)}%`);
  console.log(`  herstel: eerste sample na gap=${resumeFirstCount}, tweede=${resumedCount}`);
  console.log('\n  Toetsing:');
  check(duringGapCount === beforeGapCount,
    `Geen samplegroei tijdens ontbrekende data (${beforeGapCount} → ${duringGapCount})`);
  check(duringGapConfidence === beforeGapConfidence,
    `Confidence loopt niet op tijdens datastilte (${fmt(beforeGapConfidence, 1)}% → ${fmt(duringGapConfidence, 1)}%)`);
  check(resumeFirstCount === beforeGapCount,
    'Eerste sample na lange gap ververst alleen de baseline');
  check(resumedCount === beforeGapCount + 1,
    'Tweede sample na herstel leert weer normaal');
}

// ---------------------------------------------------------------------------
// Scenario G — Zwaar huis met trage afgifte
// ---------------------------------------------------------------------------

async function scenarioG() {
  header('SCENARIO G — Gesloten lus: zwaar huis en traag afgiftesysteem (24 uur)');

  const C = 20.0;
  const UA = 0.18;
  const P_INT = 0.3;
  const K_RAD = 0.18;
  const P_MAX = 6.0;
  const T_OUT = 0.0;
  const DESIRED = 21.0;
  const SP_MIN = 20;
  const SP_MAX = 55;
  const TAU_WATER_H = 2.0;

  const dm = new WeightedDecisionMaker({
    comfort: 0.60, efficiency: 0.25, cost: 0.15, thermal: 0.20,
  });
  const pi = new HeatingController({ logger: () => { } });
  pi.setThermalInertia(C / UA);
  pi.setDynamicDeadbandUA(UA);
  const FULL = { copConfidence: 1.0, buildingModelConfidence: 1.0, priceDataAvailable: true };

  let tIndoor = 19.0;
  let tWater = 30.0;
  let setpoint = 34;
  let accumulator = 0;
  let adviceCount = 0;
  let firstOnTarget = null;
  let maxIndoor = -99;
  const lastFourHours = [];

  console.log('  Zware gebouwmassa: C=20 kWh/°C, watertraagheid τ≈2 uur.');
  console.log('\n  tijd | kamer  | fout   | PI-advies | accu  | setpoint | water | P_wp');
  console.log('  -----|--------|--------|-----------|-------|----------|-------|------');

  const CYCLES = 288;
  for (let i = 1; i <= CYCLES; i++) {
    tWater += ((5 / 60) / TAU_WATER_H) * (setpoint - tWater);
    const pHeat = Math.max(0, Math.min(P_MAX, K_RAD * (tWater - tIndoor)));
    tIndoor += ((5 / 60) / C) * (pHeat - UA * (tIndoor - T_OUT) + P_INT);

    maxIndoor = Math.max(maxIndoor, tIndoor);
    if (firstOnTarget === null && tIndoor >= DESIRED - 0.3) firstOnTarget = i;
    if (i > CYCLES - 48) lastFourHours.push(tIndoor);

    const heating = await pi.calculateAction({ indoorTemp: tIndoor, targetTemp: DESIRED, timestamp: i * 300000 });
    const combined = dm.combineActionsWithThermal(heating, null, null, null, FULL, null);
    accumulator = Math.max(-2, Math.min(2, accumulator + combined.finalAdjustment));
    const recommended = Math.max(SP_MIN, Math.min(SP_MAX, setpoint + Math.round(accumulator)));

    if (recommended !== setpoint) {
      adviceCount++;
      const applied = recommended - setpoint;
      setpoint = recommended;
      accumulator -= applied;
    }

    if (i % 24 === 0) {
      console.log(
        `  ${pad(`${i / 12}u`, 4)} | ${pad(fmt(tIndoor, 2), 6)} | ${pad(fmt(DESIRED - tIndoor, 2), 6)} | `
        + `${pad(heating ? fmt(heating.temperatureAdjustment, 2) : 'deadband', 9)} | ${pad(fmt(accumulator, 2), 5)} | `
        + `${pad(setpoint, 8)} | ${pad(fmt(tWater, 1), 5)} | ${pad(fmt(pHeat, 1), 4)} kW`,
      );
    }
  }

  const tail = lastFourHours.reduce((s, v) => s + v, 0) / lastFourHours.length;
  console.log(`\n  Aanbevelingen toegepast: ${adviceCount}; op temperatuur (±0,3°C) na ${fmt((firstOnTarget ?? 0) / 12, 1)} uur`);
  console.log('\n  Toetsing:');
  check(firstOnTarget !== null && firstOnTarget / 12 < 20,
    `Zwaar huis bereikt de gewenste zone binnen 20 uur (${fmt((firstOnTarget ?? 0) / 12, 1)}u)`);
  check(maxIndoor <= DESIRED + 0.8,
    `Overshoot blijft begrensd bij trage afgifte (max ${fmt(maxIndoor, 2)}°C)`);
  check(Math.abs(tail - DESIRED) <= 0.6,
    `Laatste 4 uur gemiddeld dicht bij doel: ${fmt(tail, 2)}°C (doel ${DESIRED} ± 0,6)`);
  check(setpoint >= SP_MIN && setpoint <= SP_MAX,
    `Setpoint bleef binnen [${SP_MIN}, ${SP_MAX}] (eind: ${setpoint}°C)`);
}

// ---------------------------------------------------------------------------
// Scenario H — Passive cooldown / coast
// ---------------------------------------------------------------------------

async function scenarioH() {
  header('SCENARIO H — Passive cooldown / coast: activatie, weging, settlement en exit');

  const TREND_WINDOW_SIZE = 3;
  const OUTLET_TREND_WINDOW_SIZE = 4;
  const COAST_STEP_LIMIT = -1.5;
  const STALE_COAST_ADJ_THRESHOLD = 0.5;
  const HYSTERESIS = 0.3;
  const OFFSET = 1.0;
  const STRENGTH = 0.80;
  const DESIRED = 21.0;

  const dm = new WeightedDecisionMaker({
    comfort: 0.60, efficiency: 0.25, cost: 0.15, thermal: 0.20,
  });
  const pi = new HeatingController({ logger: () => { } });
  const FULL = { copConfidence: 1.0, buildingModelConfidence: 1.0, priceDataAvailable: true };

  let setpoint = 45;
  let outletTemp = 43.5;
  let indoorTemp = 21.42;
  let accumulator = 0;
  let coastActive = false;
  let cooldownCycleCount = 0;
  let coastCycleCount = 0;
  const indoorHistory = [];
  const outletHistory = [];
  const appliedDeltas = [];
  const coastWeights = [];
  const coastAdjustments = [];
  let activatedAt = null;
  let hardExitAt = null;
  let softExitSeen = false;
  let zeroDeltaWeight = null;

  const recordIndoor = (value) => {
    indoorHistory.push(value);
    if (indoorHistory.length > TREND_WINDOW_SIZE) indoorHistory.shift();
  };

  const isTemperatureRising = () => {
    if (indoorHistory.length < TREND_WINDOW_SIZE) return true;
    return indoorHistory[indoorHistory.length - 1] >= indoorHistory[0];
  };

  const recordOutlet = (value) => {
    outletHistory.push(value);
    if (outletHistory.length > OUTLET_TREND_WINDOW_SIZE) outletHistory.shift();
  };

  const outletDropRate = () => {
    if (outletHistory.length < OUTLET_TREND_WINDOW_SIZE) return 0;
    return (outletHistory[outletHistory.length - 1] - outletHistory[0]) / OUTLET_TREND_WINDOW_SIZE;
  };

  const computeCoast = () => {
    recordOutlet(outletTemp);
    const rawAdjustment = (outletTemp - OFFSET) - setpoint;
    const baseAdjustment = Math.min(0, rawAdjustment);
    const clampedAdjustment = Math.max(COAST_STEP_LIMIT, baseAdjustment);
    const dropRate = outletDropRate();
    const multiplier = dropRate < 0 ? Math.max(0.3, 1.0 + dropRate * 0.5) : 1.0;
    return {
      adjustment: clampedAdjustment * multiplier,
      dropRate,
      multiplier,
    };
  };

  const cooldownConfirmed = () => {
    const magnitudeOk = indoorTemp > DESIRED + HYSTERESIS;
    const trendOk = isTemperatureRising();
    if (magnitudeOk && trendOk) cooldownCycleCount++;
    else cooldownCycleCount = 0;
    return cooldownCycleCount >= 2;
  };

  const hardExit = () => indoorTemp < DESIRED + HYSTERESIS / 2;
  const staleCoast = (coastAdj) => {
    const isFalling = indoorHistory.length >= TREND_WINDOW_SIZE
      && indoorHistory[indoorHistory.length - 1] < indoorHistory[0];
    return isFalling && Math.abs(coastAdj) < STALE_COAST_ADJ_THRESHOLD;
  };

  console.log('  Start: kamer boven doel en stijgend, uitlaat warmer dan het gewenste lagere setpoint.');
  console.log('\n  cyclus | kamer | uitlaat | setpoint | coastAdj | coastW | advies');
  console.log('  -------|-------|---------|----------|----------|--------|-------');

  for (let cycle = 1; cycle <= 18; cycle++) {
    // Eerste cycli warmt de kamer nog na; daarna koelt de woning langzaam af.
    indoorTemp += cycle <= 4 ? 0.04 : -0.08;
    outletTemp += 0.28 * (setpoint - outletTemp);

    recordIndoor(indoorTemp);
    const coast = computeCoast();

    if (coastActive && hardExit()) {
      pi.resetHistory();
      coastActive = false;
      cooldownCycleCount = 0;
      coastCycleCount = 0;
      hardExitAt = cycle;
    }

    if (coastActive && staleCoast(coast.adjustment)) {
      pi.resetHistory();
      coastActive = false;
      cooldownCycleCount = 0;
      coastCycleCount = 0;
      softExitSeen = true;
    }

    if (!coastActive && cooldownConfirmed()) {
      coastActive = true;
      coastCycleCount = 0;
      if (activatedAt === null) activatedAt = cycle;
    }

    if (coastActive) coastCycleCount++;

    const heating = await pi.calculateAction({
      indoorTemp,
      targetTemp: DESIRED,
      timestamp: cycle * 300000,
    });
    const coastAction = coastActive ? {
      adjustment: coast.adjustment,
      reason: `Coast simulatie: uitlaat ${fmt(outletTemp, 1)}°C, dropRate ${fmt(coast.dropRate, 2)}`,
      priority: 'high',
      strength: STRENGTH,
    } : null;
    const combined = dm.combineActionsWithThermal(heating, null, null, null, FULL, coastAction);
    coastWeights.push(combined.effectiveWeights.coast ?? 0);
    coastAdjustments.push(coast.adjustment);

    accumulator = Math.max(-2, Math.min(2, accumulator + combined.finalAdjustment));
    const recommended = setpoint + Math.round(accumulator);
    let applied = 0;
    if (recommended !== setpoint) {
      applied = recommended - setpoint;
      setpoint = recommended;
      accumulator -= applied;
      appliedDeltas.push(applied);
    }

    if (cycle === 18) {
      const zeroCoast = {
        adjustment: 0,
        reason: 'Coast simulatie: geen negatieve delta',
        priority: 'high',
        strength: STRENGTH,
      };
      const zeroCombined = dm.combineActionsWithThermal(null, null, null, null, FULL, zeroCoast);
      zeroDeltaWeight = zeroCombined.effectiveWeights.coast ?? null;
    }

    console.log(
      `  ${pad(cycle, 6)} | ${pad(fmt(indoorTemp, 2), 5)} | ${pad(fmt(outletTemp, 1), 7)} | `
      + `${pad(setpoint, 8)} | ${pad(fmt(coast.adjustment, 2), 8)} | `
      + `${pad(fmt(combined.effectiveWeights.coast ?? 0, 2), 6)} | ${pad(fmt(combined.finalAdjustment, 2), 5)}`
      + `${applied !== 0 ? ` (${applied > 0 ? '+' : ''}${applied}°C toegepast)` : ''}`,
    );
  }

  const negativeApplied = appliedDeltas.filter((v) => v < 0).reduce((sum, v) => sum + v, 0);
  const maxCoastWeight = Math.max(...coastWeights);
  const minCoastAdjustment = Math.min(...coastAdjustments);

  console.log('\n  Toetsing:');
  check(activatedAt === 2,
    `Coast activeert na twee bevestigde cycli boven hysterese (cyclus ${activatedAt})`);
  check(maxCoastWeight === STRENGTH,
    `Negatieve coast-delta verdringt naar ${(STRENGTH * 100).toFixed(0)}% gewicht`);
  check(minCoastAdjustment >= COAST_STEP_LIMIT,
    `Coast-stap blijft binnen limiet ${COAST_STEP_LIMIT}°C (min ${fmt(minCoastAdjustment, 2)}°C)`);
  check(negativeApplied <= -1,
    `Settlement past setpointverlagingen toe (totaal ${negativeApplied}°C)`);
  check(hardExitAt !== null || softExitSeen,
    `Coast verlaat weer via ${hardExitAt !== null ? `harde exit in cyclus ${hardExitAt}` : 'zachte stale-coast exit'}`);
  check(zeroDeltaWeight === 0,
    'CoastAction met delta 0 krijgt 0% coast-gewicht');
}

// ---------------------------------------------------------------------------

(async () => {
  console.log('Offline simulatie adaptieve regeling — ADR-060 geharmoniseerd gedrag');
  console.log('(pure componenten uit .homeybuild/, geen Homey of hardware nodig)');
  scenarioA();
  await scenarioB();
  await scenarioC();
  scenarioD();
  scenarioE();
  scenarioF();
  await scenarioG();
  await scenarioH();
  header(process.exitCode ? 'RESULTAAT: één of meer toetsen GEFAALD' : 'RESULTAAT: alle toetsen geslaagd');
})();
