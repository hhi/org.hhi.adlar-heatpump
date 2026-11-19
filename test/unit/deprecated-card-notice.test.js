/**
 * Notice for the deprecated 'savings above' condition (v3.13.1): a timeline notice once per device,
 * retried when the notice fails, and the text present in every language.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  notifyOnce, SAVINGS_ABOVE_NOTICE_MESSAGE_KEY, SAVINGS_ABOVE_NOTICE_STORE_KEY,
} = require('../../.homeybuild/lib/shared/deprecated-card-notice');

const APP_DIR = path.join(__dirname, '..', '..');

/** A device stand-in with the parts Homey.Device offers. */
function fakeDevice({ failNotice = false } = {}) {
  const store = {};
  const notices = [];
  return {
    notices,
    store,
    homey: {
      notifications: {
        createNotification: async (options) => {
          if (failNotice) throw new Error('timeline unavailable');
          notices.push(options.excerpt);
        },
      },
      __: (key) => `text:${key}`,
    },
    getName: () => 'Heat pump',
    getStoreValue: (key) => store[key],
    setStoreValue: async (key, value) => {
      store[key] = value;
    },
  };
}

test('the notice is shown once per device', async () => {
  const device = fakeDevice();
  assert.equal(await notifyOnce(device, SAVINGS_ABOVE_NOTICE_STORE_KEY, SAVINGS_ABOVE_NOTICE_MESSAGE_KEY), true);
  assert.equal(await notifyOnce(device, SAVINGS_ABOVE_NOTICE_STORE_KEY, SAVINGS_ABOVE_NOTICE_MESSAGE_KEY), false);
  assert.deepEqual(device.notices, [`Heat pump: text:${SAVINGS_ABOVE_NOTICE_MESSAGE_KEY}`]);
  assert.equal(device.store[SAVINGS_ABOVE_NOTICE_STORE_KEY], true);
});

test('a failed notice does not set the flag, so it is tried again', async () => {
  const device = fakeDevice({ failNotice: true });
  await assert.rejects(notifyOnce(device, SAVINGS_ABOVE_NOTICE_STORE_KEY, SAVINGS_ABOVE_NOTICE_MESSAGE_KEY));
  assert.equal(device.store[SAVINGS_ABOVE_NOTICE_STORE_KEY], undefined);
});

test('every language has the notice text', () => {
  const [group, key] = SAVINGS_ABOVE_NOTICE_MESSAGE_KEY.split('.');
  for (const lang of ['en', 'nl', 'de', 'fr']) {
    const texts = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'locales', `${lang}.json`), 'utf8'));
    assert.ok(typeof texts[group]?.[key] === 'string' && texts[group][key].length > 0, `${lang}: ${SAVINGS_ABOVE_NOTICE_MESSAGE_KEY}`);
  }
});
