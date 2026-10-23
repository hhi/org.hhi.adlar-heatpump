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
    const P = on ? P_ON : 0;
    if (m % 5 === 0) {
      samples.push({
        timestamp: startTime + m * 60000,
        tIndoorTrue: tIn,
        tIndoor: Math.round(tIn / quant) * quant,
        tOutdoor: tOut,
        pHeating: P,
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

module.exports = { simulateHouse, asLearnerInput, mulberry32 };
