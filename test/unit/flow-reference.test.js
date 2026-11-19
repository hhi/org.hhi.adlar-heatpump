/**
 * Flow card reference (scripts/docs/flow-reference.js): every card function has a topic, every
 * example belongs to an existing card, and the generated references match app.json and the
 * examples.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');

const {
  LANGS, TOPICS, topicOf, collectFunctions, render, readExamples, readApp, outputFile,
} = require('../../scripts/docs/flow-reference');

const app = readApp();
const functions = collectFunctions(app);

test('every Flow card function has a topic in the reference', () => {
  const missing = functions.filter((fn) => !topicOf(fn.base)).map((fn) => `${fn.kind}/${fn.base}`);
  assert.deepStrictEqual(missing, [], 'add these functions to TOPICS in scripts/docs/flow-reference.js');
});

test('every topic entry is an existing card function', () => {
  const bases = new Set(functions.map((fn) => fn.base));
  const unknown = Object.values(TOPICS).flat().filter((base) => !bases.has(base));
  assert.deepStrictEqual(unknown, [], 'remove these entries from TOPICS: the cards no longer exist');
});

test('every example belongs to an existing card function and has a text', () => {
  const bases = new Set(functions.map((fn) => fn.base));
  for (const lang of LANGS) {
    const examples = readExamples(lang);
    for (const [base, example] of Object.entries(examples)) {
      assert.ok(bases.has(base), `${lang}: example for unknown card ${base}`);
      assert.strictEqual(typeof example.text, 'string', `${lang}/${base}: text`);
      assert.ok(!example.flow || Array.isArray(example.flow), `${lang}/${base}: flow is a list of lines`);
      // Flow lines end up in a code block; markdownlint allows 80 characters per line.
      for (const line of example.flow || []) {
        assert.ok(line.length <= 80, `${lang}/${base}: flow line longer than 80 characters: ${line}`);
        // A token ([...]) must stay on one line.
        assert.strictEqual(line.split('[').length, line.split(']').length, `${lang}/${base}: token split over lines: ${line}`);
      }
    }
  }
});

test('the generated references are up to date', () => {
  for (const lang of LANGS) {
    const expected = render(app, lang, readExamples(lang));
    const current = fs.readFileSync(outputFile(lang), 'utf8');
    assert.strictEqual(current, expected, `${lang}: run node scripts/docs/flow-reference.js`);
  }
});
