/**
 * Tests for R21 (v3.7.1): the outdoor temperature used by adaptive control.
 * Without a user-set forecast location the forecast is for the default location (Amsterdam);
 * the heat pump's own sensor then goes before Open-Meteo. A recent flow-card value stays first.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'homey') return {};
  return originalLoad.call(this, request, parent, isMain);
};

const { WeatherForecastService } = require('../../.homeybuild/lib/shared/services/weather-forecast-service');
const { AdaptiveControlService: TuyaService } = require('../../.homeybuild/lib/tuya/services/adaptive-control-service');
const { AdaptiveControlService: ModbusService } = require('../../.homeybuild/lib/modbus/services/adaptive-control-service');
const { AdaptiveControlService: Aurora3Service } = require('../../.homeybuild/lib/aurora3/services/adaptive-control-service');

function forecastService(settings) {
  return new WeatherForecastService({
    device: { getSettings: () => settings, homey: {} },
  });
}

test('isLocationUserSet: the default location (52.37, 4.90) counts as not set', () => {
  assert.strictEqual(forecastService({ forecast_location_lat: 52.37, forecast_location_lon: 4.9 }).isLocationUserSet(), false);
});

test('isLocationUserSet: missing values count as not set', () => {
  assert.strictEqual(forecastService({}).isLocationUserSet(), false);
});

test('isLocationUserSet: a changed latitude or longitude counts as set', () => {
  assert.strictEqual(forecastService({ forecast_location_lat: 52.09, forecast_location_lon: 4.9 }).isLocationUserSet(), true);
  assert.strictEqual(forecastService({ forecast_location_lat: 52.37, forecast_location_lon: 5.12 }).isLocationUserSet(), true);
});

function createService(ServiceClass, { locationSet, sensorTemp, flowTemp = null }) {
  const store = {};
  const capabilities = {};
  if (flowTemp !== null) {
    store.external_outdoor_temp_timestamp = Date.now() - 10 * 60 * 1000;
    capabilities.adlar_external_ambient = flowTemp;
  }
  const device = {
    homey: {
      __: (key) => key,
      setInterval: () => ({}),
      clearInterval: () => {},
      setTimeout: () => ({}),
    },
    getSetting: () => undefined,
    getSettings: () => ({}),
    getStoreValue: (key) => store[key] ?? null,
    getCapabilityValue: (key) => capabilities[key] ?? null,
    hasCapability: () => false,
    getOutdoorTemperatureWithFallback: () => sensorTemp,
    error: () => {},
  };
  const service = new ServiceClass({ device, logger: () => {} });
  service.weatherForecast = {
    getTempAt: () => 8,
    isLocationUserSet: () => locationSet,
  };
  return service;
}

const drivers = [['Tuya', TuyaService], ['Aurora II', ModbusService], ['Aurora III', Aurora3Service]];

for (const [name, ServiceClass] of drivers) {
  test(`${name}: location not set → heat pump sensor before Open-Meteo`, async () => {
    const service = createService(ServiceClass, { locationSet: false, sensorTemp: 3 });
    assert.strictEqual(await service.getEffectiveOutdoorTemp(), 3);
  });

  test(`${name}: location set → Open-Meteo before the heat pump sensor`, async () => {
    const service = createService(ServiceClass, { locationSet: true, sensorTemp: 3 });
    assert.strictEqual(await service.getEffectiveOutdoorTemp(), 8);
  });

  test(`${name}: location not set and no sensor value → Open-Meteo`, async () => {
    const service = createService(ServiceClass, { locationSet: false, sensorTemp: null });
    assert.strictEqual(await service.getEffectiveOutdoorTemp(), 8);
  });

  test(`${name}: a recent flow-card value stays first`, async () => {
    const service = createService(ServiceClass, { locationSet: false, sensorTemp: 3, flowTemp: 6 });
    assert.strictEqual(await service.getEffectiveOutdoorTemp(), 6);
  });
}
