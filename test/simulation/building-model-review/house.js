'use strict';

/**
 * 1R1C-woningsimulator met een aan/uit-warmtepomp (hysterese), dag/nacht-setpoint,
 * buitentemperatuur met dagritme en weersdrift, zoninstraling met bewolking en
 * een binnensensor met 0,1 °C-resolutie. Integratie per minuut, meting per 5 minuten.
 *
 * Waarheid: C·dT/dt = P + UA·(Tout − Tin) + g·I/1000 + Pint
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulateHouse(opts) {
  const {
    C, UA, g, pInt,
    days,
    seed = 1,
    pOn = null, // thermisch vermogen als de compressor draait (kW)
    tOutMean = 4,
    quant = 0.1,
    startTime = Date.UTC(2026, 0, 5, 0, 0), // maandag 00:00 UTC
    change = null, // { atDay, UA?, C? } — bv. renovatie
    startIndoor = 20,
    events = {}, // { defrost: true, dhw: true } — ontdooien en tapwater (ADR-062 B2)
  } = opts;
  const rnd = mulberry32(seed);
  const P_ON = pOn ?? Math.min(18, Math.max(4, UA * 22)); // ruim genoeg voor ΔT ≈ 20 K
  const samples = [];
  let tIn = startIndoor;
  let on = false;
  let drift = 0;
  let cloud = 0.6;
  let curC = C;
  let curUA = UA;
  const minutes = days * 24 * 60;
  // Gemiddelden over het lopende meetinterval (voor de 'ideaal uitgelijnde' invoer)
  let accP = 0; let accDiff = 0; let accSolar = 0; let accN = 0;
  let runMin = 0; // compressorlooptijd sinds de laatste ontdooicyclus
  let defrostLeft = 0;
  for (let m = 0; m <= minutes; m++) {
    const tHours = m / 60;
    const hour = tHours % 24;
    const day = Math.floor(tHours / 24);
    if (change && day >= change.atDay) {
      curC = change.C ?? C;
      curUA = change.UA ?? UA;
    }
    if (m % 60 === 0) drift = 0.97 * drift + (rnd() - 0.5) * 0.6; // langzame weersdrift
    if (m % (24 * 60) === 0) cloud = 0.15 + 0.85 * rnd();
    const tOut = tOutMean + drift * 3 + 4 * Math.sin((2 * Math.PI * (hour - 9)) / 24);
    const solar = hour > 8 && hour < 17 ? 450 * cloud * Math.sin((Math.PI * (hour - 8)) / 9) : 0;
    const setpoint = hour >= 7 && hour < 22 ? 21 : 19;
    if (tIn < setpoint - 0.3) on = true;
    if (tIn > setpoint + 0.3) on = false;
    // Ontdooien: bij Tout < 3 °C na elke 50 min compressorloop 8 min, warmte uit het systeem.
    if (events.defrost && defrostLeft === 0 && on && tOut < 3 && runMin >= 50) { defrostLeft = 8; runMin = 0; }
    const defrost = defrostLeft > 0;
    // Tapwater: dagelijks 13:00–13:40; de warmtepomp levert aan de boiler, niet aan de woning.
    const dhw = !!events.dhw && hour >= 13 && hour < 13 + 40 / 60;
    let P = on ? P_ON : 0; // werkelijk vermogen naar de woning
    let pMeasured = P; // wat de service als thermisch vermogen ziet
    if (defrost) { P = -1.0; pMeasured = 0; defrostLeft--; }
    if (dhw) { P = 0; pMeasured = P_ON; }
    if (on && !defrost && !dhw) runMin++;
    if (m % 5 === 0) {
      samples.push({
        timestamp: startTime + m * 60000,
        tIndoorTrue: tIn,
        tIndoor: Math.round(tIn / quant) * quant,
        tOutdoor: tOut,
        pHeating: pMeasured,
        defrost,
        dhw,
        solarRadiation: solar,
        deltaTPerHour: 0,
        truth: { C: curC, UA: curUA, g, pInt },
        // Gemiddelden over het afgelopen interval (m−5, m]
        mean: accN > 0 ? { p: accP / accN, diff: accDiff / accN, solar: accSolar / accN } : { p: P, diff: tOut - tIn, solar },
      });
      accP = 0; accDiff = 0; accSolar = 0; accN = 0;
    }
    const dTdt = (P + curUA * (tOut - tIn) + g * (solar / 1000) + pInt) / curC; // °C/h
    accP += P; accDiff += tOut - tIn; accSolar += solar; accN++;
    tIn += dTdt / 60;
  }
  return samples;
}

/**
 * Wat de learner te zien krijgt.
 *  realistisch  — zoals de service: vermogen op het meetmoment, sensor met 0,1 °C
 *  ideaal       — intervalgemiddelden voor P, (Tout−Tin) en zon; exacte Tin
 *  kwantisatie  — ideaal uitgelijnd, maar sensor met 0,1 °C
 *  mismatch     — exacte Tin, maar vermogen op het meetmoment
 * (Tout wordt zo gekozen dat de learner X[1] = Tout − Tin als intervalgemiddelde ziet.)
 */
function asLearnerInput(samples, mode) {
  return samples.map((s) => {
    const aligned = mode === 'ideaal' || mode === 'kwantisatie';
    const quantized = mode === 'realistisch' || mode === 'kwantisatie';
    const tIndoor = quantized ? s.tIndoor : s.tIndoorTrue;
    return {
      ...s,
      tIndoor,
      pHeating: aligned ? s.mean.p : s.pHeating,
      tOutdoor: aligned ? tIndoor + s.mean.diff : s.tOutdoor,
      solarRadiation: aligned ? s.mean.solar : s.solarRadiation,
    };
  });
}

/**
 * Sample-poorten van de service (ADR-062 B2): geblokkeerde samples bereiken de learner niet.
 *  geen — alles door
 *  A2   — defrost geblokkeerd; tapwater in combimodus niet herkend (vermogen naar de boiler telt mee)
 *  A3   — defrost en tapwater (adlar_dhw_active) geblokkeerd
 */
function applyGates(samples, gates) {
  if (gates === 'A2') return samples.filter((s) => !s.defrost);
  if (gates === 'A3') return samples.filter((s) => !s.defrost && !s.dhw);
  return samples;
}

module.exports = { simulateHouse, asLearnerInput, applyGates, mulberry32 };
