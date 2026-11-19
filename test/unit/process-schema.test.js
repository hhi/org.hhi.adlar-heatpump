'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const renderer = fs.readFileSync(path.join(__dirname, '../../public/schema-renderer.js'), 'utf8');

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

for (const driver of ['aurora2', 'tuya', 'aurora3']) {
  test(`${driver}: Live starts unknown and demo never survives returning to Live`, async () => {
    const p = await page(null, driver);
    assert.equal(p.text('sc-kpi-flow'), '— L/min');
    assert.doesNotMatch(p.markup(), /1\.420 W|1\.184 kWh|4\.820 kWh|20:15|08:15|28 DPS|120 s · OK/);
    assert.equal(p.attr('sc-chart-t7', 'd'), '');
    assert.equal(p.attr('sc-hc-dot', 'visibility'), 'hidden');
    assert.match(p.text('sc-z1-defrost'), /—/);
    assert.match(p.text('sc-z2-valve'), /—/);
    p.mode('demo');
    assert.match(p.text('sc-title'), /DEMO/);
    p.mode('live');
    assert.equal(p.text('sc-kpi-flow'), '— L/min');
    assert.equal(p.attr('sc-chart-t7', 'd'), '');
    assert.doesNotMatch(p.text('sc-sankey-footer'), /1\.420|0,30/);
  });

  test(`${driver}: external meter, COP and zero/negative/missing tariffs use current data`, async () => {
    const p = await page(null, driver);
    const s = {
      sensors: { waterFlow: { value: driver === 'aurora3' ? 1.02 : 17, unit: driver === 'aurora3' ? 'm³/h' : 'L/min' } },
      power: { inputPowerKw: 0.49, powerSource: 'ac-derived' },
      cop: { cop: 12.1, thermalPowerKw: 5.93, electricalPowerKw: 0.49 },
      liveOperation: {
        process: {
          electricalPowerKw: 1.42, powerSource: 'external', capabilityCop: 4.18, thermalPowerKw: 5.93, flowLpm: 17,
        },
      },
      process: {
        electricalPowerKw: 1.42, powerSource: 'external', capabilityCop: 4.18, thermalPowerKw: 5.93, flowLpm: 17,
      },
    };
    for (const price of [0.3, 0, -0.1, null]) {
      const caps = [
        { id: 'adlar_cop', value: 4.18 },
        { id: 'adlar_cop_method', value: 'Direct Thermisch 🟢' },
        { id: 'adlar_energy_price_current', value: price },
      ];
      if (driver === 'tuya') p.tuya(s, caps);
      else await p.refresh(s, caps.map((c) => ({ ...c, id: `${c.id}_${driver === 'aurora2' ? 'modbus' : 'aurora3'}` })));
      assert.equal(p.text('sc-kpi-cop'), '4,18');
      assert.match(p.text('sc-sankey-elec'), /1,42 kW/);
      assert.match(p.text('sc-sankey-footer'), /Externe meter.*1\.420 W/);
      assert.match(p.text('sc-sankey-footer'), price === null ? /Kosten nu: € —/ : new RegExp(({ 0: '0,00/uur', '-0.1': '-0,14/uur', 0.3: '0,43/uur' })[price]));
    }
  });

  test(`${driver}: absent history clears lines; timestamps determine horizontal spacing`, async () => {
    const p = await page(null, driver);
    const s = {
      history: [
        {
          ts: 1700000000000, t7: 30, t6: 28, hz: 40,
        },
        {
          ts: 1700000060000, t7: null, t6: 29, hz: null,
        },
        {
          ts: 1700000600000, t7: 32, t6: 30, hz: 45,
        },
      ],
    };
    if (driver === 'tuya') p.tuya(s, []); else await p.refresh(s);
    assert.match(p.attr('sc-chart-t7', 'd'), /^M 70 .* M 642 /, 'missing measurements create a gap');
    assert.equal(p.attr('sc-chart-dhw', 'd'), '');
    assert.match(p.attr('sc-chart-t6', 'd'), / L 127 /, 'one minute in a ten-minute window uses 10% of the width');
    assert.doesNotMatch(p.text('sc-time-start'), /—|20:15/);
    if (driver === 'tuya') p.tuya({ history: [] }, []); else await p.refresh({ history: [] });
    assert.equal(p.attr('sc-chart-t7', 'd'), '');
    assert.equal(p.text('sc-time-start'), '—');
  });
}

test('Tuya draws a configured curve and clears it when its parameters disappear', async () => {
  const p = await page(null, 'tuya');
  p.tuya({}, []);
  assert.equal(p.attr('sc-hc-curve', 'd'), '');
  p.tuya({}, [], { appCurve: { slope: -0.5, intercept: 40 } });
  assert.match(p.attr('sc-hc-curve', 'd'), /^M 730 .* L 1044 /);
  assert.match(p.text('sc-hc-diy-val'), /-0,50.*40,0/);
  p.tuya({}, [], {});
  assert.equal(p.attr('sc-hc-curve', 'd'), '');
  assert.equal(p.text('sc-hc-diy-val'), '—');
  assert.doesNotMatch(p.markup(), /Referentie H4|y = -0,55/);
});

for (const driver of ['aurora2', 'aurora3']) {
  test(`${driver}: rejected external input cannot reappear when the selected reading is unknown`, async () => {
    const p = await page({
      sensors: {},
      liveOperation: { process: { electricalPowerKw: null, powerSource: 'none', flowLpm: null } },
    }, driver, [{ id: 'adlar_external_power', value: 1420 }, { id: 'adlar_external_flow', value: 17 }]);
    assert.match(p.text('sc-sankey-elec'), /— kW/);
    assert.equal(p.text('sc-power-label'), '2. Elektrisch');
    assert.equal(p.text('sc-kpi-flow'), '— L/min');
    assert.doesNotMatch(p.text('sc-sankey-footer'), /Externe meter|1\.420/);
  });
}

for (const driver of ['aurora2', 'tuya', 'aurora3']) {
  test(`${driver}: rejected COP is unknown, raw result remains diagnostic and clears after recovery`, async () => {
    const p = await page(null, driver);
    const diagnostic = {
      quality: 'outlier',
      rawCOP: 12.1,
      acceptedCOP: null,
      reason: 'COP above maximum threshold (8)',
      method: 'direct_thermal',
      electricalPowerW: 490,
      flowLpm: 17,
      deltaTC: 5,
    };
    const s = {
      cop: { cop: 12.1 },
      copDiagnostic: diagnostic,
      process: { capabilityCop: null },
      liveOperation: { copDiagnostic: diagnostic, process: { capabilityCop: null } },
    };
    if (driver === 'tuya') p.tuya(s, []); else await p.refresh(s);
    assert.equal(p.text('sc-kpi-cop'), '—');
    assert.equal(p.text('sc-sankey-cop'), '—');
    assert.match(p.text('sc-cop-raw'), /12,10.*controle/);
    assert.match(p.text('sc-cop-diagnostic'), /490 W.*17,0 L\/min.*5,0 K/);
    diagnostic.quality = 'valid';
    diagnostic.acceptedCOP = 4.18;
    s.process.capabilityCop = 4.18;
    s.liveOperation.process.capabilityCop = 4.18;
    if (driver === 'tuya') p.tuya(s, []); else await p.refresh(s);
    assert.equal(p.text('sc-kpi-cop'), '4,18');
    assert.equal(p.text('sc-cop-raw'), '');
    assert.equal(p.text('sc-cop-diagnostic'), '');
  });
}
