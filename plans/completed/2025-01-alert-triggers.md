# Implementatieplan: Ontbrekende Alert Flow Card Triggers

**Datum**: 2026-01-18 (voltooid 2026-01-19)  
**Status**: ✅ VOLTOOID  
**Geschatte tijd**: ~45 minuten (daadwerkelijk: ~15 minuten)

## Samenvatting

Er zijn 11 alert flow cards gedefinieerd in `.homeycompose/flow/triggers/` die JSON definities en run listener registratie hebben, maar geen daadwerkelijke trigger logica in `device.ts`. Deze kaartjes verschijnen in de Homey Flow UI maar worden nooit gefired.

## Bestaand Werkend Patroon

Referentie: [`drivers/intelligent-heat-pump/device.ts:2842-2912`](../drivers/intelligent-heat-pump/device.ts#L2842-L2912)

De werkende alerts (`compressor_efficiency_alert`, `fan_motor_efficiency_alert`, `water_flow_alert`) volgen dit patroon:

```typescript
// 1. State tracking variable (regel ~207-209)
private lastXxxValue: number | null = null;

// 2. Trigger logic in DPS processing loop (regel ~2850+)
if (capability === 'measure_xxx.yyy' && typeof transformedValue === 'number') {
  if (this.lastXxxValue !== null && Math.abs(transformedValue - this.lastXxxValue) >= THRESHOLD) {
    const delta = transformedValue - this.lastXxxValue;
    const condition = delta > 0 ? 'above' : 'below';

    this.triggerFlowCard('xxx_alert', {
      current_xxx: Math.round(transformedValue * 10) / 10,
      threshold_xxx: transformedValue,
    }, {
      condition,
      xxx: transformedValue,
    }).catch((err) => {
      this.error('Failed to trigger xxx_alert:', err);
    });
  }
  this.lastXxxValue = transformedValue;
}
```

---

## Te Implementeren Alerts

### Temperature Alerts (9 stuks)

| Alert ID | Capability | DPS | Threshold |
|----------|------------|-----|-----------|
| `coiler_temperature_alert` | `measure_temperature.coiler_temp` | 23 | 2°C |
| `discharge_temperature_alert` | `measure_temperature.venting_temp` | 24 | 2°C |
| `suction_temperature_alert` | `measure_temperature.coiler_temp_f` | 41 | 2°C |
| `high_pressure_temperature_alert` | `measure_temperature.temp_current_f` | 35 | 2°C |
| `low_pressure_temperature_alert` | `measure_temperature.top_temp_f` | 36 | 2°C |
| `incoiler_temperature_alert` | `measure_temperature.bottom_temp_f` | 37 | 2°C |
| `tank_temperature_alert` | `measure_temperature.around_temp_f` | 38 | 2°C |
| `economizer_inlet_temperature_alert` | `measure_temperature.evlin` | 107 | 2°C |
| `economizer_outlet_temperature_alert` | `measure_temperature.eviout` | 108 | 2°C |

### Pulse Steps Alerts (2 stuks)

| Alert ID | Capability | DPS | Threshold |
|----------|------------|-----|-----------|
| `eev_pulse_steps_alert` | `adlar_measure_pulse_steps_temp_current` | 16 | 20 steps |
| `evi_pulse_steps_alert` | `adlar_measure_pulse_steps_effluent_temp` | 25 | 20 steps |

---

## Implementatie Stappen

### Stap 1: State Tracking Variables Toevoegen

**Bestand**: `drivers/intelligent-heat-pump/device.ts`
**Locatie**: Na regel 209 (na `private lastWaterFlow`)

```typescript
// Temperature alert state tracking (v2.x.x)
private lastCoilerTemp: number | null = null;        // For coiler_temperature_alert
private lastDischargeTemp: number | null = null;     // For discharge_temperature_alert
private lastSuctionTemp: number | null = null;       // For suction_temperature_alert
private lastHighPressureTemp: number | null = null;  // For high_pressure_temperature_alert
private lastLowPressureTemp: number | null = null;   // For low_pressure_temperature_alert
private lastIncoilerTemp: number | null = null;      // For incoiler_temperature_alert
private lastTankTemp: number | null = null;          // For tank_temperature_alert
private lastEconomizerInletTemp: number | null = null;  // For economizer_inlet_temperature_alert
private lastEconomizerOutletTemp: number | null = null; // For economizer_outlet_temperature_alert

// Pulse steps alert state tracking (v2.x.x)
private lastEevPulseSteps: number | null = null;     // For eev_pulse_steps_alert
private lastEviPulseSteps: number | null = null;     // For evi_pulse_steps_alert
```

### Stap 2: Threshold Constants Toevoegen

**Bestand**: `drivers/intelligent-heat-pump/device.ts`
**Locatie**: In de expert mode triggers sectie (regel ~2847)

```typescript
const TEMP_CHANGE_THRESHOLD = 2;      // Minimum °C change to trigger temperature alerts
const PULSE_STEPS_THRESHOLD = 20;     // Minimum pulse steps change to trigger
```

### Stap 3: Temperature Alert Triggers Implementeren

**Bestand**: `drivers/intelligent-heat-pump/device.ts`
**Locatie**: Na `water_flow_alert` trigger (regel ~2911), binnen `if (expertModeEnabled)` block

```typescript
// === TEMPERATURE ALERTS ===

// Coiler temperature (measure_temperature.coiler_temp)
if (capability === 'measure_temperature.coiler_temp' && typeof transformedValue === 'number') {
  if (this.lastCoilerTemp !== null && Math.abs(transformedValue - this.lastCoilerTemp) >= TEMP_CHANGE_THRESHOLD) {
    const delta = transformedValue - this.lastCoilerTemp;
    const condition = delta > 0 ? 'above' : 'below';

    this.log(`🌡️ coiler_temperature_alert TRIGGER: ${this.lastCoilerTemp}°C → ${transformedValue}°C`);

    this.triggerFlowCard('coiler_temperature_alert', {
      current_temperature: Math.round(transformedValue * 10) / 10,
      threshold_temperature: transformedValue,
    }, {
      condition,
      temperature: transformedValue,
    }).catch((err) => {
      this.error('Failed to trigger coiler_temperature_alert:', err);
    });
  }
  this.lastCoilerTemp = transformedValue;
}

// Discharge temperature (measure_temperature.venting_temp)
if (capability === 'measure_temperature.venting_temp' && typeof transformedValue === 'number') {
  if (this.lastDischargeTemp !== null && Math.abs(transformedValue - this.lastDischargeTemp) >= TEMP_CHANGE_THRESHOLD) {
    const delta = transformedValue - this.lastDischargeTemp;
    const condition = delta > 0 ? 'above' : 'below';

    this.log(`🌡️ discharge_temperature_alert TRIGGER: ${this.lastDischargeTemp}°C → ${transformedValue}°C`);

    this.triggerFlowCard('discharge_temperature_alert', {
      current_temperature: Math.round(transformedValue * 10) / 10,
      threshold_temperature: transformedValue,
    }, {
      condition,
      temperature: transformedValue,
    }).catch((err) => {
      this.error('Failed to trigger discharge_temperature_alert:', err);
    });
  }
  this.lastDischargeTemp = transformedValue;
}

// Suction temperature (measure_temperature.coiler_temp_f)
if (capability === 'measure_temperature.coiler_temp_f' && typeof transformedValue === 'number') {
  if (this.lastSuctionTemp !== null && Math.abs(transformedValue - this.lastSuctionTemp) >= TEMP_CHANGE_THRESHOLD) {
    const delta = transformedValue - this.lastSuctionTemp;
    const condition = delta > 0 ? 'above' : 'below';

    this.log(`🌡️ suction_temperature_alert TRIGGER: ${this.lastSuctionTemp}°C → ${transformedValue}°C`);

    this.triggerFlowCard('suction_temperature_alert', {
      current_temperature: Math.round(transformedValue * 10) / 10,
      threshold_temperature: transformedValue,
    }, {
      condition,
      temperature: transformedValue,
    }).catch((err) => {
      this.error('Failed to trigger suction_temperature_alert:', err);
    });
  }
  this.lastSuctionTemp = transformedValue;
}

// High pressure temperature (measure_temperature.temp_current_f)
if (capability === 'measure_temperature.temp_current_f' && typeof transformedValue === 'number') {
  if (this.lastHighPressureTemp !== null && Math.abs(transformedValue - this.lastHighPressureTemp) >= TEMP_CHANGE_THRESHOLD) {
    const delta = transformedValue - this.lastHighPressureTemp;
    const condition = delta > 0 ? 'above' : 'below';

    this.log(`🌡️ high_pressure_temperature_alert TRIGGER: ${this.lastHighPressureTemp}°C → ${transformedValue}°C`);

    this.triggerFlowCard('high_pressure_temperature_alert', {
      current_temperature: Math.round(transformedValue * 10) / 10,
      threshold_temperature: transformedValue,
    }, {
      condition,
      temperature: transformedValue,
    }).catch((err) => {
      this.error('Failed to trigger high_pressure_temperature_alert:', err);
    });
  }
  this.lastHighPressureTemp = transformedValue;
}

// Low pressure temperature (measure_temperature.top_temp_f)
if (capability === 'measure_temperature.top_temp_f' && typeof transformedValue === 'number') {
  if (this.lastLowPressureTemp !== null && Math.abs(transformedValue - this.lastLowPressureTemp) >= TEMP_CHANGE_THRESHOLD) {
    const delta = transformedValue - this.lastLowPressureTemp;
    const condition = delta > 0 ? 'above' : 'below';

    this.log(`🌡️ low_pressure_temperature_alert TRIGGER: ${this.lastLowPressureTemp}°C → ${transformedValue}°C`);

    this.triggerFlowCard('low_pressure_temperature_alert', {
      current_temperature: Math.round(transformedValue * 10) / 10,
      threshold_temperature: transformedValue,
    }, {
      condition,
      temperature: transformedValue,
    }).catch((err) => {
      this.error('Failed to trigger low_pressure_temperature_alert:', err);
    });
  }
  this.lastLowPressureTemp = transformedValue;
}

// Incoiler temperature (measure_temperature.bottom_temp_f)
if (capability === 'measure_temperature.bottom_temp_f' && typeof transformedValue === 'number') {
  if (this.lastIncoilerTemp !== null && Math.abs(transformedValue - this.lastIncoilerTemp) >= TEMP_CHANGE_THRESHOLD) {
    const delta = transformedValue - this.lastIncoilerTemp;
    const condition = delta > 0 ? 'above' : 'below';

    this.log(`🌡️ incoiler_temperature_alert TRIGGER: ${this.lastIncoilerTemp}°C → ${transformedValue}°C`);

    this.triggerFlowCard('incoiler_temperature_alert', {
      current_temperature: Math.round(transformedValue * 10) / 10,
      threshold_temperature: transformedValue,
    }, {
      condition,
      temperature: transformedValue,
    }).catch((err) => {
      this.error('Failed to trigger incoiler_temperature_alert:', err);
    });
  }
  this.lastIncoilerTemp = transformedValue;
}

// Tank temperature (measure_temperature.around_temp_f)
if (capability === 'measure_temperature.around_temp_f' && typeof transformedValue === 'number') {
  if (this.lastTankTemp !== null && Math.abs(transformedValue - this.lastTankTemp) >= TEMP_CHANGE_THRESHOLD) {
    const delta = transformedValue - this.lastTankTemp;
    const condition = delta > 0 ? 'above' : 'below';

    this.log(`🌡️ tank_temperature_alert TRIGGER: ${this.lastTankTemp}°C → ${transformedValue}°C`);

    this.triggerFlowCard('tank_temperature_alert', {
      current_temperature: Math.round(transformedValue * 10) / 10,
      threshold_temperature: transformedValue,
    }, {
      condition,
      temperature: transformedValue,
    }).catch((err) => {
      this.error('Failed to trigger tank_temperature_alert:', err);
    });
  }
  this.lastTankTemp = transformedValue;
}

// Economizer inlet temperature (measure_temperature.evlin)
if (capability === 'measure_temperature.evlin' && typeof transformedValue === 'number') {
  if (this.lastEconomizerInletTemp !== null && Math.abs(transformedValue - this.lastEconomizerInletTemp) >= TEMP_CHANGE_THRESHOLD) {
    const delta = transformedValue - this.lastEconomizerInletTemp;
    const condition = delta > 0 ? 'above' : 'below';

    this.log(`🌡️ economizer_inlet_temperature_alert TRIGGER: ${this.lastEconomizerInletTemp}°C → ${transformedValue}°C`);

    this.triggerFlowCard('economizer_inlet_temperature_alert', {
      current_temperature: Math.round(transformedValue * 10) / 10,
      threshold_temperature: transformedValue,
    }, {
      condition,
      temperature: transformedValue,
    }).catch((err) => {
      this.error('Failed to trigger economizer_inlet_temperature_alert:', err);
    });
  }
  this.lastEconomizerInletTemp = transformedValue;
}

// Economizer outlet temperature (measure_temperature.eviout)
if (capability === 'measure_temperature.eviout' && typeof transformedValue === 'number') {
  if (this.lastEconomizerOutletTemp !== null && Math.abs(transformedValue - this.lastEconomizerOutletTemp) >= TEMP_CHANGE_THRESHOLD) {
    const delta = transformedValue - this.lastEconomizerOutletTemp;
    const condition = delta > 0 ? 'above' : 'below';

    this.log(`🌡️ economizer_outlet_temperature_alert TRIGGER: ${this.lastEconomizerOutletTemp}°C → ${transformedValue}°C`);

    this.triggerFlowCard('economizer_outlet_temperature_alert', {
      current_temperature: Math.round(transformedValue * 10) / 10,
      threshold_temperature: transformedValue,
    }, {
      condition,
      temperature: transformedValue,
    }).catch((err) => {
      this.error('Failed to trigger economizer_outlet_temperature_alert:', err);
    });
  }
  this.lastEconomizerOutletTemp = transformedValue;
}
```

### Stap 4: Pulse Steps Alert Triggers Implementeren

**Bestand**: `drivers/intelligent-heat-pump/device.ts`
**Locatie**: Na temperature alerts, binnen `if (expertModeEnabled)` block

```typescript
// === PULSE STEPS ALERTS ===

// EEV pulse steps (adlar_measure_pulse_steps_temp_current)
if (capability === 'adlar_measure_pulse_steps_temp_current' && typeof transformedValue === 'number') {
  if (this.lastEevPulseSteps !== null && Math.abs(transformedValue - this.lastEevPulseSteps) >= PULSE_STEPS_THRESHOLD) {
    const delta = transformedValue - this.lastEevPulseSteps;
    const condition = delta > 0 ? 'above' : 'below';

    this.log(`🔧 eev_pulse_steps_alert TRIGGER: ${this.lastEevPulseSteps} → ${transformedValue} steps`);

    this.triggerFlowCard('eev_pulse_steps_alert', {
      current_pulse_steps: transformedValue,
      threshold_pulse_steps: transformedValue,
    }, {
      condition,
      pulse_steps: transformedValue,
    }).catch((err) => {
      this.error('Failed to trigger eev_pulse_steps_alert:', err);
    });
  }
  this.lastEevPulseSteps = transformedValue;
}

// EVI pulse steps (adlar_measure_pulse_steps_effluent_temp)
if (capability === 'adlar_measure_pulse_steps_effluent_temp' && typeof transformedValue === 'number') {
  if (this.lastEviPulseSteps !== null && Math.abs(transformedValue - this.lastEviPulseSteps) >= PULSE_STEPS_THRESHOLD) {
    const delta = transformedValue - this.lastEviPulseSteps;
    const condition = delta > 0 ? 'above' : 'below';

    this.log(`🔧 evi_pulse_steps_alert TRIGGER: ${this.lastEviPulseSteps} → ${transformedValue} steps`);

    this.triggerFlowCard('evi_pulse_steps_alert', {
      current_pulse_steps: transformedValue,
      threshold_pulse_steps: transformedValue,
    }, {
      condition,
      pulse_steps: transformedValue,
    }).catch((err) => {
      this.error('Failed to trigger evi_pulse_steps_alert:', err);
    });
  }
  this.lastEviPulseSteps = transformedValue;
}
```

### Stap 5: Run Listeners in app.ts (VERPLICHT)

> **Let op**: RunListeners zijn verplicht omdat de JSON definities user args hebben (condition/threshold). Zonder RunListener worden flows altijd uitgevoerd, ongeacht de user-geconfigureerde drempel.

**Bestand**: `app.ts`
**Locatie**: Na `water_flow_alert` run listener (regel ~1240)

Voor elke temperature alert een run listener toevoegen volgens het bestaande patroon:

```typescript
// Temperature alert run listeners
const temperatureAlerts = [
  'coiler_temperature_alert',
  'discharge_temperature_alert',
  'suction_temperature_alert',
  'high_pressure_temperature_alert',
  'low_pressure_temperature_alert',
  'incoiler_temperature_alert',
  'tank_temperature_alert',
  'economizer_inlet_temperature_alert',
  'economizer_outlet_temperature_alert',
];

for (const alertId of temperatureAlerts) {
  const card = this.homey.flow.getDeviceTriggerCard(alertId);
  card.registerRunListener(async (args, state) => {
    // Validate inputs
    if (!state?.condition || typeof state?.temperature !== 'number') {
      return false;
    }
    if (!args?.condition || typeof args?.temperature !== 'number') {
      return false;
    }

    // Match condition
    if (args.condition === 'above') {
      return state.temperature >= args.temperature;
    }
    return state.temperature <= args.temperature;
  });
}

// Pulse steps alert run listeners
const pulseStepsAlerts = ['eev_pulse_steps_alert', 'evi_pulse_steps_alert'];

for (const alertId of pulseStepsAlerts) {
  const card = this.homey.flow.getDeviceTriggerCard(alertId);
  card.registerRunListener(async (args, state) => {
    if (!state?.condition || typeof state?.pulse_steps !== 'number') {
      return false;
    }
    if (!args?.condition || typeof args?.pulse_steps !== 'number') {
      return false;
    }

    if (args.condition === 'above') {
      return state.pulse_steps >= args.pulse_steps;
    }
    return state.pulse_steps <= args.pulse_steps;
  });
}
```

---

## ✅ Opgeruimd: Dode Code Verwijderd

> **Status**: Voltooid op 2026-01-19

De volgende dode code is verwijderd:

- `lib/flow-helpers.ts`: `registerVoltageAlerts()` en `registerCurrentAlerts()` functies verwijderd
- `lib/flow-helpers.ts`: `voltageAlerts` en `currentAlerts` arrays verwijderd uit `FLOW_PATTERNS`
- `app.ts`: Import statements en registration calls voor voltage/current alerts verwijderd

---

## Test Checklist

- [ ] Build succesvol: `npm run build`
- [ ] Validate succesvol: `homey app validate`
- [ ] Lint succesvol: `npm run lint`
- [ ] Expert mode setting inschakelen in device settings
- [ ] Test elke temperature alert door waarde handmatig te laten wijzigen
- [ ] Test elke pulse steps alert
- [ ] Verifieer dat alerts NIET triggeren als expert mode UIT staat
- [ ] Verifieer run listeners werken met above/below condities

---

## Referenties

- Bestaande werkende implementatie: [`device.ts:2842-2912`](../drivers/intelligent-heat-pump/device.ts#L2842-L2912)
- DPS mapping: [`lib/definitions/adlar-mapping.ts`](../lib/definitions/adlar-mapping.ts)
- Flow card definities: [`.homeycompose/flow/triggers/`](../.homeycompose/flow/triggers/)
