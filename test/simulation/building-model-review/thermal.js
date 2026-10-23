'use strict';

// A3 — calculateThermalAdjustment() (echte, gecompileerde Aurora II-service) tegenover de werkelijke opwarmtijd
const Module = require('module');

const origLoad = Module._load;
Module._load = function load(req, parent, isMain) { return req === 'homey' ? {} : origLoad.call(this, req, parent, isMain); };
const { BuildingModelService } = require('../../../.homeybuild/lib/modbus/services/building-model-service');

const truth = { C: 15, UA: 0.3, g: 0.5, pInt: 0.3 };
const P_ON = truth.UA * 22; // zelfde warmtepomp als in de simulator: 6,6 kW thermisch

const device = {
  homey: { __: (k) => k, i18n: { getLanguage: () => 'en' }, setInterval: () => ({}), clearInterval: () => {}, flow: { getDeviceTriggerCard: () => ({ trigger: async () => {} }) } },
  getSetting: () => undefined, getStoreValue: () => undefined, setStoreValue: async () => {},
  getCapabilityValue: () => null, hasCapability: () => false, setCapabilityValue: async () => {}, setCapabilityOptions: async () => {},
};
const svc = new BuildingModelService({ device, enableDynamicPInt: false, logger: () => {} });
svc.getSolarRadiationWithPriority = () => ({ radiation: 0, source: 'estimation' }); // nacht/bewolkt: geen zon
const P4 = [[1e-4, 0, 0, 0], [0, 1e-4, 0, 0], [0, 0, 1e-4, 0], [0, 0, 0, 1e-4]];
svc.getLearner().restoreState({
  theta: [1 / truth.C, truth.UA / truth.C, truth.g / truth.C, truth.pInt / truth.C], P: P4, sampleCount: 3000, lastMeasurement: null,
});
const realGetHours = Date.prototype.getHours;
Date.prototype.getHours = function getHours() { return 12; }; // dagvenster: P_int-multiplier 1,0

function trueHours(tStart, tTarget, tOut, pHeat) {
  // Werkelijke 1R1C-woning, warmtepomp continu aan, tot binnen 0,3 °C van het doel (zoals de formule)
  let T = tStart;
  for (let min = 0; min < 72 * 60; min++) {
    if (T >= tTarget - 0.3) return min / 60;
    T += ((pHeat + truth.UA * (tOut - T) + truth.pInt) / truth.C) / 60;
  }
  return Infinity;
}

console.log(`Model = waarheid (C=${truth.C}, UA=${truth.UA}, τ=${truth.C / truth.UA} h, Pint=${truth.pInt}), confidence ${svc.getLearner().getModel().confidence.toFixed(0)}%, geen zon, 12:00\n`);
console.log('Tin → doel | Tout | werkelijk (P = 6,6 kW) | werkelijk (P = 3 kW) | huidige formule | advies huidige code');
console.log('--- | --- | --- | --- | --- | ---');
for (const [tIn, target] of [[19.8, 21], [20.5, 21]]) {
  for (const tOut of [-10, 0, 10, 15]) {
    const r = svc.calculateThermalAdjustment({ indoorTemp: tIn, targetIndoorTemp: target, outdoorTemp: tOut });
    const hrs = (r.reason.match(/([\d.]+)h to target/) || [])[1];
    const fmtH = (h) => (Number.isFinite(h) ? `${h.toFixed(1)} h` : 'nooit (evenwicht < doel)');
    console.log(`${tIn} → ${target} | ${tOut} °C | ${fmtH(trueHours(tIn, target, tOut, P_ON))} | ${fmtH(trueHours(tIn, target, tOut, 3))} | ${hrs ? `${hrs} h` : '—'} | ${r.adjustment > 0 ? '+' : ''}${r.adjustment} °C (${r.reason})`);
  }
}
Date.prototype.getHours = realGetHours;
