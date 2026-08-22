/**
 * Regressietests voor de zombie-detectie en incidentadministratie in TuyaConnectionService.
 *
 * Bewaakt de reparaties uit ADR-003 Fase 0 tegen de ECHTE implementatie in
 * .homeybuild — niet tegen een nagebouwd model:
 *
 *   F0-2  waitForDataEvent() vergelijkt een timestamp die vóór de request is
 *         vastgelegd, zodat een data-event dat TuyAPI synchroon uitzendt vóór
 *         het resolven van get() (tuyapi r. 885 vs. r. 921) meetelt.
 *   F0-3  De dp-refresh-handler werkt dezelfde velden bij als de data-handler.
 *   F0-4  Een TuyAPI-instance wordt na disconnect nooit hergebruikt, ook niet
 *         wanneer isConnected al false is.
 *   REV   Een incident wordt ook afgesloten wanneer de verbinding zichzelf herstelt
 *         zonder door attemptReconnectionWithRecovery() heen te lopen. Blijft het open,
 *         dan bevriest de detector-telemetrie en wordt de volgende uitvalmelding
 *         permanent onderdrukt.
 *
 * Draait de fix terug, dan falen deze tests.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const Module = require('node:module');

// De service importeert 'homey' alleen voor types; stub het zodat require slaagt.
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'homey') return {};
  return originalLoad.call(this, request, parent, isMain);
};

const {
  TuyaConnectionService,
} = require('../../.homeybuild/lib/tuya/services/tuya-connection-service');

const WINDOW_MS = 400;

/** Minimale Homey.Device-dubbel: alleen wat de service daadwerkelijk aanraakt. */
function makeDevice({ capabilities = [] } = {}) {
  const written = new Map();
  return {
    written,
    getName: () => 'Test heatpump',
    getCapabilityValue: () => false,
    hasCapability: (id) => capabilities.includes(id),
    setCapabilityValue: async (id, value) => { written.set(id, value); },
    setStoreValue: async () => undefined,
    getStoreValue: async () => undefined,
    homey: {
      clock: { getTimezone: () => 'Europe/Amsterdam' },
      // unref: de service plant een persist-timer van 60s die het testproces
      // anders openhoudt. Intervallen blijven wel ref'd — waitForDataEvent
      // heeft er een nodig zolang het wacht.
      setTimeout: (fn, ms) => {
        const timer = setTimeout(fn, ms);
        if (typeof timer.unref === 'function') timer.unref();
        return timer;
      },
      clearTimeout: (t) => clearTimeout(t),
      setInterval: (fn, ms) => setInterval(fn, ms),
      clearInterval: (t) => clearInterval(t),
    },
  };
}

/**
 * Nep-TuyAPI die de volgorde van tuyapi nabootst: het event wordt synchroon
 * uitgezonden en pas daarna resolvet de request-promise.
 */
class FakeTuya extends EventEmitter {
  constructor({ mode = 'data' } = {}) {
    super();
    this.mode = mode;
    this.disconnectCalls = 0;
  }

  async get() {
    if (this.mode === 'data' || this.mode === 'dp-refresh') {
      this.emit(this.mode === 'data' ? 'data' : 'dp-refresh', { dps: { 1: true } });
    }
    return { dps: { 1: true } };
  }

  async disconnect() {
    this.disconnectCalls += 1;
  }
}

function makeService(tuya, deviceOptions) {
  const device = makeDevice(deviceOptions);
  const service = new TuyaConnectionService({ device, logger: () => {} });
  service.testDevice = device;
  if (tuya) {
    service.tuya = tuya;
    service.setupTuyaEventHandlers();
  }
  return service;
}

describe('F0-2 — waitForDataEvent meet het juiste venster', () => {
  test('de methode accepteert een referentie-timestamp', () => {
    // De vlag-gebaseerde implementatie van vóór F0-2 nam één argument.
    // Faalt deze assertie, dan is de fix teruggedraaid.
    assert.strictEqual(
      TuyaConnectionService.prototype.waitForDataEvent.length, 2,
      'waitForDataEvent(timeoutMs, previousDataEventTime) verwacht twee argumenten',
    );
  });

  test('een data-event tijdens get() telt mee', async () => {
    const tuya = new FakeTuya({ mode: 'data' });
    const service = makeService(tuya);

    const previous = service.lastDataEventReceived;   // venster opent hier
    await tuya.get({ schema: true });                 // event is nu al gepasseerd

    const fresh = await service.waitForDataEvent(WINDOW_MS, previous);

    assert.strictEqual(fresh, true, 'het event vóór de resolve moet meetellen');
    assert.ok(service.lastDataEventReceived > previous);
  });

  test('geen enkel event binnen het venster levert false', async () => {
    const tuya = new FakeTuya({ mode: 'silent' });
    const service = makeService(tuya);

    const previous = service.lastDataEventReceived;
    await tuya.get({ schema: true });

    const fresh = await service.waitForDataEvent(WINDOW_MS, previous);

    assert.strictEqual(fresh, false);
  });

  test('een event ná het openen van het venster telt ook mee', async () => {
    const tuya = new FakeTuya({ mode: 'silent' });
    const service = makeService(tuya);

    const previous = service.lastDataEventReceived;
    setTimeout(() => tuya.emit('data', { dps: { 1: true } }), 120);

    const fresh = await service.waitForDataEvent(WINDOW_MS, previous);

    assert.strictEqual(fresh, true);
  });
});

describe('F0-3 — dp-refresh telt als geldig dataverkeer', () => {
  test('dp-refresh werkt dezelfde velden bij als data', async () => {
    const tuya = new FakeTuya({ mode: 'dp-refresh' });
    const service = makeService(tuya);
    service.zombieRecoveryAttempts = 2;

    const previous = service.lastDataEventReceived;
    await tuya.get({ schema: true });

    assert.ok(service.lastDataEventReceived > previous, 'lastDataEventReceived moet vooruit');
    assert.ok(service.lastDataEventTime > 0, 'lastDataEventTime moet vooruit');
    assert.strictEqual(service.zombieRecoveryAttempts, 0, 'de zombie-teller moet resetten');
  });

  test('een dp-refresh-antwoord levert een verse probe op', async () => {
    const tuya = new FakeTuya({ mode: 'dp-refresh' });
    const service = makeService(tuya);

    const previous = service.lastDataEventReceived;
    await tuya.get({ schema: true });

    const fresh = await service.waitForDataEvent(WINDOW_MS, previous);

    assert.strictEqual(fresh, true, 'dps-1-loze antwoorden mogen niet als stilte gelden');
  });
});

describe('F0-4 — de TuyAPI-instance wordt nooit hergebruikt', () => {
  test('disconnect ruimt op, ook wanneer isConnected al false is', async () => {
    const tuya = new FakeTuya({ mode: 'data' });
    const service = makeService(tuya);
    service.isConnected = false;   // het Layer 0-herstelpad

    await service.disconnect();

    assert.strictEqual(service.tuya, null, 'de instance moet losgelaten worden');
    assert.strictEqual(tuya.disconnectCalls, 1, 'de socket moet gesloten worden');
    assert.strictEqual(tuya.listenerCount('data'), 0, 'listeners moeten verwijderd zijn');
  });

  test('een losgelaten instance ontvangt geen events meer', async () => {
    const tuya = new FakeTuya({ mode: 'data' });
    const service = makeService(tuya);

    await service.disconnect();
    const previous = service.lastDataEventReceived;
    tuya.emit('data', { dps: { 1: true } });

    assert.strictEqual(service.lastDataEventReceived, previous);
  });
});

describe('Incidentadministratie — een hersteld incident wordt afgesloten', () => {
  test('een spontaan herstel sluit het incident, ook via de vroege return', async () => {
    const service = makeService(new FakeTuya({ mode: 'data' }));

    // Layer 0 detecteert en opent een incident.
    service.recordDetector('layer0', true);
    service.outageStartTime = Date.now() - 60_000;
    service.outageNotificationSent = false;

    assert.notStrictEqual(service.telemetryIncidentDetector, null, 'incident moet openstaan');

    // TuyAPI heeft zichzelf herverbonden vóórdat de hersteltimer afging.
    service.isConnected = true;
    await service.attemptReconnectionWithRecovery();

    assert.strictEqual(service.telemetryIncidentDetector, null, 'incident moet gesloten zijn');
    assert.strictEqual(service.outageStartTime, 0, 'outage-tracking moet gereset zijn');
    assert.strictEqual(service.outageNotificationSent, false);
  });

  test('na het herstel worden nieuwe detecties weer geteld', async () => {
    const service = makeService(new FakeTuya({ mode: 'data' }));

    service.recordDetector('layer0', true);
    service.isConnected = true;
    await service.attemptReconnectionWithRecovery();

    const before = service.getTelemetryDay().detectors.layer1;
    service.recordDetector('layer1', true);

    assert.strictEqual(
      service.getTelemetryDay().detectors.layer1, before + 1,
      'recordDetector mag niet stil blijven na een eerder incident',
    );
  });

  test('een gedetecteerde requestfout telt niet als zombie', () => {
    const service = makeService(new FakeTuya({ mode: 'data' }));
    const day = service.getTelemetryDay();
    const beforeZombie = day.disconnectsZombie;
    const beforeDetector = day.detectors.layer1;

    service.recordDetector('layer1', false);   // get()/set() gaven een timeout

    assert.strictEqual(service.getTelemetryDay().detectors.layer1, beforeDetector + 1,
      'de detector telt wel');
    assert.strictEqual(service.getTelemetryDay().disconnectsZombie, beforeZombie,
      'disconnectsZombie mag niet oplopen bij een gedetecteerde requestfout');
  });
});

describe('Meetbaarheid — de zombie-teller landt in een capability', () => {
  test('een heartbeat-detectie hoogt adlar_zombie_detections_daily op', async () => {
    const service = makeService(new FakeTuya({ mode: 'data' }), {
      capabilities: ['adlar_zombie_detections_daily', 'adlar_connection_diagnostics'],
    });

    service.recordDetector('layer1', true);
    await new Promise((resolve) => setTimeout(resolve, 20));   // flush is fire-and-forget

    assert.strictEqual(service.testDevice.written.get('adlar_zombie_detections_daily'), 1);

    const raw = service.testDevice.written.get('adlar_connection_diagnostics');
    assert.strictEqual(typeof raw, 'string', 'de telemetrie moet als JSON worden weggeschreven');
    assert.ok(JSON.parse(raw).days.length >= 1);
  });

  test('zonder de capabilities gebeurt er niets', async () => {
    const service = makeService(new FakeTuya({ mode: 'data' }));   // geen capabilities

    service.recordDetector('layer1', true);
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(service.testDevice.written.size, 0);
  });
});
