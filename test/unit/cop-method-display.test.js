/**
 * Display text of the adlar_cop_method capability, shared by the Tuya, Aurora I/II and Aurora III drivers.
 *
 * The translate stub mimics Homey's `__()`: it returns the key itself when a translation is missing.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'homey') return { Device: class {}, App: class {} };
  return originalLoad.call(this, request, parent, isMain);
};

const { formatCopMethodDisplay, formatCopMethodDisabled } = require('../../.homeybuild/lib/shared/utils/cop-method-display');
const nl = require('../../locales/nl.json');

function translateFrom(locale) {
  return (key) => key.split('.').reduce((node, part) => (node ? node[part] : undefined), locale) ?? key;
}

const NL = translateFrom(nl);
const MISSING = (key) => key;

const result = (overrides = {}) => ({
  cop: 3.5, method: 'direct_thermal', confidence: 'high', isOutlier: false, ...overrides,
});

test('a valid COP shows the method with its confidence', () => {
  assert.strictEqual(formatCopMethodDisplay(result(), NL), 'Direct Thermisch 🟢');
  assert.strictEqual(formatCopMethodDisplay(result({ confidence: 'medium' }), NL), 'Direct Thermisch 🟡');
  assert.strictEqual(formatCopMethodDisplay(result({ confidence: 'low' }), NL), 'Direct Thermisch 🔴');
});

test('no valid COP shows low confidence', () => {
  assert.strictEqual(formatCopMethodDisplay(result({ cop: 0 }), NL), 'Direct Thermisch 🔴');
});

test('missing data shows the diagnostic', () => {
  const insufficient = result({
    cop: 0, method: 'insufficient_data', confidence: 'low', diagnosticInfo: { primaryIssue: 'no_power_measurement' },
  });
  assert.strictEqual(formatCopMethodDisplay(insufficient, NL), '! Geen Vermogen Data 🔴');
});

test('an outlier shows the method and the localized outlier marker', () => {
  assert.strictEqual(formatCopMethodDisplay(result({ cop: 9.8, isOutlier: true }), NL), 'Direct Thermisch ⚠ Uitschieter');
});

test('compressor off and disabled are localized', () => {
  assert.strictEqual(formatCopMethodDisplay(result({ cop: 0, method: 'idle_mode' }), NL), 'Compressor uit');
  assert.strictEqual(formatCopMethodDisabled(NL), 'Uitgeschakeld');
});

test('a missing translation falls back to readable text, never the raw key', () => {
  assert.strictEqual(formatCopMethodDisplay(result({ cop: 0, method: 'idle_mode' }), MISSING), 'Compressor off');
  assert.strictEqual(formatCopMethodDisplay(result(), MISSING), 'direct_thermal 🟢');
  assert.strictEqual(formatCopMethodDisabled(MISSING), 'Disabled');
});

test('the new texts exist in all four languages', () => {
  for (const lang of ['en', 'nl', 'de', 'fr']) {
    const locale = require(`../../locales/${lang}.json`);
    for (const key of ['idle_mode', 'outlier', 'disabled']) {
      assert.ok(locale.cop_method[key], `${lang}: cop_method.${key}`);
    }
  }
});
