'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Adlar3ModbusService } = require('../../../.homeybuild/lib/aurora3/protocol/adlar3-modbus-service');

const renderer = fs.readFileSync(path.join(__dirname, '../../../public/schema-renderer.js'), 'utf8');

// Run the actual page entrypoint and polling, without exporting private renderer functions.
async function page(snapshot, driver = 'aurora3', caps = []) {
  const elements = new Map();
  const modes = ['live', 'demo'].map((mode) => ({
    mode,
    classList: { toggle() {} },
    getAttribute: () => mode,
    addEventListener(_event, handler) {
      this.click = handler;
    },
  }));
  let markup = '';
  const container = {
    querySelector: () => (markup ? {} : null),
    set innerHTML(html) {
      markup = html;
      for (const match of html.matchAll(/<\w+\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
        elements.set(match[1], {
          textContent: '',
          attributes: {},
          classList: {
            toggle(name, enabled) {
              this[name] = enabled;
            },
          },
          setAttribute(key, value) {
            this.attributes[key] = value;
          },
        });
      }
    },
  };
  let poll;
  const context = {
    document: {
      body: { dataset: { driver, schemaTitle: `Adlar ${driver}` } },
      documentElement: { setAttribute() {} },
      getElementById: (id) => (id === 'schema-wrap' ? container : elements.get(id)),
      querySelectorAll: (selector) => (selector === '[data-set-mode]' ? modes : []),
    },
    localStorage: { getItem() {}, setItem() {} },
    window: {
      setInterval(handler) {
        poll = handler;
      },
    },
    fetch: async (url) => ({
      status: snapshot === null ? 204 : 200,
      ok: true,
      json: async () => (url === '/api/snapshot' ? snapshot : caps),
    }),
  };
  vm.runInNewContext(renderer, context);
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
  return {
    text: (id) => elements.get(id)?.textContent,
    attr: (id, key) => elements.get(id)?.attributes[key],
    active: (id) => elements.get(id)?.classList['flow-active'],
    tuya: (snap, values, curve = {}) => context.window.AdlarSchemaRenderer.updateFromTuya(container, snap, values, curve),
    markup: () => markup,
    async refresh(next, nextCaps = caps) {
      snapshot = next;
      caps = nextCaps;
      poll();
      await new Promise((resolve) => {
        setImmediate(resolve);
      });
    },
    mode: (mode) => modes.find((button) => button.mode === mode).click(),
  };
}

function snapshot() {
  const service = new Adlar3ModbusService({ transport: { host: '127.0.0.1' } });
  const cache = service.getRegisterCache();
  // Bare FC04 register numbers and raw wire values, including signed tenths of a degree.
  for (const [address, value] of [
    [9, 2], [38, 0], [40, 205], [41, 360], [42, 300], [43, 350], [45, 320],
    [46, 520], [49, 65526], [50, 65516], [52, 650], [53, 45], [62, 65],
    [64, 12], [70, 240], [72, 540], [74, 230], [75, 70], [77, 58],
    [78, 48], [79, 48], [80, 1], [81, 0], [86, 2400], [87, 800],
    [2107, 350], [2105, 530],
  ]) cache.set(address, value);
  return service.getSnapshot();
}

test('Aurora III process schema uses real FC04 sensor mapping, units and output states', async () => {
  const p = await page(snapshot());
  assert.equal(p.text('sc-kpi-flow'), '20,0 L/min');
  assert.equal(p.text('sc-z2-t7'), '35,0 °C');
  assert.equal(p.text('sc-z2-t6'), '30,0 °C');
  assert.equal(p.text('sc-z1-t1'), 'Buiten T4: -2,0 °C');
  assert.equal(p.text('sc-z1-t2'), 'Buitenwisselaar T3: -1,0 °C');
  assert.match(p.text('sc-z1-sat'), /2\.400.*800 kPa/);
  assert.equal(p.text('sc-z1-evi'), '4-wegklep (3-81): Verwarmen');
  assert.equal(p.text('sc-dhw-ret'), 'Buffer TW (3-45): 32,0 °C');
  assert.equal(p.text('sc-dhw-circulation'), 'Totale aanvoer TC (3-41): 36,0 °C');
  assert.equal(p.text('sc-z2-ahs'), 'Aan');
  assert.equal(p.text('sc-hx-temp'), '—', 'outlet temperature is not an HX measurement');
  assert.equal(p.text('sc-z1-ipm'), '');
  // Visible text: drop the comments (they contain arrows such as '->'), then collect the text between tags
  const withoutComments = p.markup().split('<!--').map((part, i) => (i === 0 ? part : part.slice(part.indexOf('-->') + 3))).join('');
  const labels = [...withoutComments.matchAll(/>([^<]*)</g)].map((m) => m[1]).join(' ');
  assert.doesNotMatch(labels, /0x[0-9a-f]+|L27|P119|marnie|DRUKVERZADIGING|EVI/i);
  assert.match(p.markup(), /3-43|3-42|3-79/);
});

test('effective external flow wins; III converts m³/h only once and II keeps L/min', async () => {
  const s = snapshot();
  s.cop.flowLpm = 25;
  const p = await page(s);
  assert.equal(p.text('sc-kpi-flow'), '25,0 L/min');
  delete s.cop.flowLpm;
  await p.refresh(s);
  assert.equal(p.text('sc-kpi-flow'), '20,0 L/min');
  s.sensors.waterFlow = { value: 18, unit: 'L/min' };
  await p.refresh(s);
  assert.equal(p.text('sc-kpi-flow'), '18,0 L/min');
  const a2 = await page({ sensors: { waterFlow: { value: 17.8 }, hpSatTemp: { value: 38.2 } } }, 'aurora2');
  assert.equal(a2.text('sc-kpi-flow'), '17,8 L/min');
  assert.match(a2.text('sc-z1-sat'), /38,2°/);
});

test('missing readings stay unknown; demo can return to live before the first poll', async () => {
  const p = await page(null);
  assert.equal(p.text('sc-kpi-flow'), '— L/min');
  assert.equal(p.text('sc-hx-temp'), '—');
  assert.equal(p.attr('sc-chart-t7', 'd'), '');
  assert.equal(p.attr('sc-hc-dot', 'visibility'), 'hidden');
  p.mode('demo');
  assert.equal(p.text('sc-title'), 'DEMO — Aurora III · Voorbeelddata');
  assert.equal(p.text('sc-kpi-flow'), '20,0 L/min');
  p.mode('live');
  assert.equal(p.text('sc-kpi-flow'), '— L/min');
  await p.refresh({ sensors: {} });
  assert.equal(p.text('sc-z1-sat'), 'HD — · LD — kPa');
  assert.equal(p.text('sc-z2-ahs'), '—');
  assert.equal(p.text('sc-z1-evi'), '4-wegklep (3-81): —');
});

test('pump-only operation is not compressor operation; defrost valve state is explicit', async () => {
  const s = snapshot();
  s.sensors.compRunningFreq.value = 0;
  s.status.compressorOn = false;
  s.status.running = true;
  const p = await page(s);
  assert.equal(p.text('sc-chip-evi'), '4-weg: Verwarmen');
  assert.equal(p.active('sc-pipe-suction'), false);
  assert.equal(p.active('sc-pipe-supply'), true);
  s.sensors.fourWayValveState.value = 1;
  s.status.defrosting = true;
  await p.refresh(s);
  assert.equal(p.text('sc-z1-evi'), '4-wegklep (3-81): Ontdooien');
  s.sensors.fourWayValveState.value = 2;
  await p.refresh(s);
  assert.equal(p.text('sc-z1-evi'), '4-wegklep (3-81): —');
});

test('live history is restored after demo and missing history removes the old series', async () => {
  const s = snapshot();
  s.history = [{ ts: 1700000000000, t7: 34, hz: 45 }, { ts: 1700000300000, t7: 35, hz: 48 }];
  const p = await page(s);
  const history = p.attr('sc-chart-t7', 'd');
  assert.match(history, /^M .* L /);
  p.mode('demo');
  assert.equal(p.attr('sc-chart-t7', 'd'), '');
  p.mode('live');
  assert.equal(p.attr('sc-chart-t7', 'd'), history);
  await p.refresh({ ...s, history: [] });
  assert.equal(p.attr('sc-chart-t7', 'd'), '');
});

test('Tuya still renders its own DPS profile through the public renderer API', async () => {
  const p = await page(null, null);
  p.tuya({ temperatures: { inletC: 30, outletC: 35 }, process: { flowLpm: 17.8 } }, [
    { id: 'measure_temperature.coiler_temp_f', value: 4.5 },
  ]);
  assert.equal(p.text('sc-kpi-flow'), '17,8 L/min');
  assert.equal(p.text('sc-z1-t4'), '4,5 °C');
  assert.match(p.markup(), /DPS 39/);
  assert.doesNotMatch(p.markup(), /AURORA III KOUDEMIDDELCYCLUS/);
});
