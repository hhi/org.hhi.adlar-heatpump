# Implementation Plan: Wind Sensitivity & Improved Solar Radiation

**Status**: Decision Document
**Date**: 2026-01-25
**Author**: Claude Code

## Overview

Extend the BuildingModel with two features:
1. **Wind Sensitivity (α)** - Learn wind correction coefficient, apply real-time target corrections
2. **Improved Solar Radiation** - Priority cascade: solar panels → KNMI → sinusoidal estimation

**Key Design Decision**: RLS algorithm remains 4-dimensional. Wind affects UA as **post-processing correction**: `UA_effective = UA × (1 + α × windSpeed / 10)`

---

## Architecture Diagram

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL DATA SOURCES                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐                     │
│   │   KNMI App  │      │  SolarEdge  │      │   Homey     │                     │
│   │             │      │  Inverter   │      │   Weather   │                     │
│   └──────┬──────┘      └──────┬──────┘      └──────┬──────┘                     │
│          │                    │                    │                            │
│          ▼                    ▼                    ▼                            │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐                     │
│   │ Wind: km/h  │      │ Power: Watt │      │ Rad: W/m²   │                     │
│   └──────┬──────┘      └──────┬──────┘      └──────┬──────┘                     │
│          │                    │                    │                            │
└──────────┼────────────────────┼────────────────────┼────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           HOMEY FLOW CARDS (Actions)                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   receive_external_     receive_external_      receive_external_                │
│   wind_data             solar_power            solar_radiation                  │
│        │                      │                      │                          │
└────────┼──────────────────────┼──────────────────────┼──────────────────────────┘
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      FLOW CARD MANAGER SERVICE                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   handleReceiveExternal   handleReceiveExternal   handleReceiveExternal         │
│   WindData()              SolarPower()            SolarRadiation()              │
│        │                      │                      │                          │
│        ▼                      ▼                      ▼                          │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐                     │
│   │ Capability: │      │ Capability: │      │ Capability: │                     │
│   │ adlar_ext_  │      │ adlar_ext_  │      │ adlar_ext_  │                     │
│   │ wind_speed  │      │ solar_power │      │ solar_rad   │                     │
│   └──────┬──────┘      └──────┬──────┘      └──────┬──────┘                     │
│          │                    │                    │                            │
└──────────┼────────────────────┼────────────────────┼────────────────────────────┘
           │                    │                    │
           │                    └─────────┬──────────┘
           │                              │
           ▼                              ▼
┌─────────────────────────┐    ┌─────────────────────────────────────────────────┐
│  WIND CORRECTION        │    │           BUILDING MODEL SERVICE                 │
│  SERVICE (NEW)          │    ├─────────────────────────────────────────────────┤
├─────────────────────────┤    │                                                  │
│                         │    │   getSolarRadiationWithPriority()               │
│  • Receive wind data    │    │   ┌─────────────────────────────────────────┐   │
│  • Learn α coefficient  │    │   │ Priority 1: Solar Panel Power           │   │
│  • Calculate correction │    │   │   power / (Wp/1000) / efficiency        │   │
│                         │    │   ├─────────────────────────────────────────┤   │
│  Formula:               │    │   │ Priority 2: KNMI Radiation (W/m²)       │   │
│  correction = α × wind  │    │   ├─────────────────────────────────────────┤   │
│    × ΔT / 100           │    │   │ Priority 3: Sinusoidal Estimation       │   │
│                         │    │   │   (existing fallback)                   │   │
│  α learning:            │    │   └─────────────────────────────────────────┘   │
│  EMA from residual      │    │                                                  │
│  heat loss errors       │    │   collectAndLearn() → BuildingModelLearner      │
│                         │    │   (RLS algorithm, 4 parameters: C, UA, g, pInt) │
└───────────┬─────────────┘    └──────────────────────┬──────────────────────────┘
            │                                         │
            │         ┌───────────────────────────────┘
            │         │
            ▼         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      ADAPTIVE CONTROL SERVICE                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   executeControlCycle() - Every 5 minutes                                       │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                         │   │
│   │  Component 1: HeatingController (PI control)  ──────────────┐          │   │
│   │  Component 2: COPOptimizer                    ──────────────┤          │   │
│   │  Component 3: EnergyPriceOptimizer            ──────────────┤          │   │
│   │  Component 4: BuildingModel (thermal)         ──────────────┤          │   │
│   │  Component 5: WindCorrection (NEW)            ──────────────┤          │   │
│   │                                                             │          │   │
│   │                                                             ▼          │   │
│   │                                               ┌─────────────────────┐  │   │
│   │                                               │ WeightedDecision-   │  │   │
│   │                                               │ Maker               │  │   │
│   │                                               │                     │  │   │
│   │                                               │ Combines all        │  │   │
│   │                                               │ components with     │  │   │
│   │                                               │ configurable        │  │   │
│   │                                               │ weights             │  │   │
│   │                                               └──────────┬──────────┘  │   │
│   │                                                          │             │   │
│   └──────────────────────────────────────────────────────────┼─────────────┘   │
│                                                              │                  │
│                                                              ▼                  │
│                                               ┌─────────────────────────────┐   │
│                                               │  adlar_simulated_target     │   │
│                                               │  (Simulated target temp)    │   │
│                                               └──────────────┬──────────────┘   │
│                                                              │                  │
└──────────────────────────────────────────────────────────────┼──────────────────┘
                                                               │
                                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           USER FLOW (Optional Apply)                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   Trigger: "Simulated target changed"                                           │
│   Condition: Change > threshold                                                  │
│   Action: Apply to target_temperature (DPS 4)                                   │
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                         HEAT PUMP (Tuya)                                │   │
│   │                                                                         │   │
│   │   target_temperature (DPS 4) ← User decides when to apply              │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Wind Correction Detail

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        WIND CORRECTION CALCULATION                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   INPUTS                          CALCULATION                    OUTPUT         │
│   ──────                          ───────────                    ──────         │
│                                                                                  │
│   ┌───────────────┐                                                             │
│   │ Wind Speed    │───┐                                                         │
│   │ (km/h)        │   │                                                         │
│   └───────────────┘   │     ┌─────────────────────────────┐                     │
│                       ├────▶│                             │                     │
│   ┌───────────────┐   │     │  correction = α × wind × ΔT │    ┌─────────────┐  │
│   │ Indoor Temp   │───┤     │              ───────────────│───▶│ Target      │  │
│   │ (°C)          │   │     │                   100       │    │ Correction  │  │
│   └───────────────┘   │     │                             │    │ (+0.0-3.0°C)│  │
│                       ├────▶│  Capped at max_correction   │    └─────────────┘  │
│   ┌───────────────┐   │     │                             │                     │
│   │ Outdoor Temp  │───┤     └─────────────────────────────┘                     │
│   │ (°C)          │   │                  ▲                                      │
│   └───────────────┘   │                  │                                      │
│                       │     ┌────────────┴────────────┐                         │
│   ┌───────────────┐   │     │                         │                         │
│   │ α (learned    │───┘     │  α Learning (EMA)       │                         │
│   │  or manual)   │         │                         │                         │
│   └───────────────┘         │  If residual > 0:       │                         │
│                             │  α_new = 0.99×α_old +   │                         │
│                             │          0.01×α_implied │                         │
│                             │                         │                         │
│                             └─────────────────────────┘                         │
│                                                                                  │
│   LOOKUP TABLE (Reference, α = 0.006):                                          │
│   ┌──────────┬─────────┬─────────┬─────────┬─────────┐                          │
│   │ Wind km/h│ ΔT=10°C │ ΔT=15°C │ ΔT=20°C │ ΔT=25°C │                          │
│   ├──────────┼─────────┼─────────┼─────────┼─────────┤                          │
│   │    10    │  +0.2°C │  +0.3°C │  +0.4°C │  +0.5°C │                          │
│   │    20    │  +0.4°C │  +0.6°C │  +0.8°C │  +1.0°C │                          │
│   │    30    │  +0.6°C │  +0.9°C │  +1.2°C │  +1.5°C │                          │
│   │    40    │  +0.8°C │  +1.2°C │  +1.6°C │  +2.0°C │                          │
│   │    50    │  +1.0°C │  +1.5°C │  +2.0°C │  +2.5°C*│                          │
│   └──────────┴─────────┴─────────┴─────────┴─────────┘                          │
│   * Capped at max_correction setting                                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Solar Radiation Priority Cascade

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      SOLAR RADIATION PRIORITY CASCADE                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   getSolarRadiationWithPriority()                                               │
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  PRIORITY 1: Solar Panel Power (Most Accurate)                          │   │
│   │  ─────────────────────────────────────────────                          │   │
│   │                                                                         │   │
│   │  Condition: power !== null && Wp > 0                                    │   │
│   │                                                                         │   │
│   │  ┌─────────────┐     ┌─────────────────────────────┐     ┌───────────┐ │   │
│   │  │ Solar Panel │     │                             │     │           │ │   │
│   │  │ Power (W)   │────▶│  radiation = power          │────▶│  W/m²     │ │   │
│   │  └─────────────┘     │             ─────────────── │     │  output   │ │   │
│   │  ┌─────────────┐     │             (Wp/1000) × eff │     │           │ │   │
│   │  │ Wp Setting  │────▶│                             │     └───────────┘ │   │
│   │  └─────────────┘     │  Example:                   │                   │   │
│   │  ┌─────────────┐     │  3000W / (6000/1000) / 0.85 │                   │   │
│   │  │ Efficiency  │────▶│  = 588 W/m²                 │                   │   │
│   │  │ (0.85)      │     └─────────────────────────────┘                   │   │
│   │  └─────────────┘                                                        │   │
│   │                                                                         │   │
│   │  ✓ Hyperlocal (measures YOUR roof)                                     │   │
│   │  ✓ Includes shading, orientation                                       │   │
│   │  ✓ Real-time updates                                                   │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                         │
│                                       ▼ (if not available)                      │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  PRIORITY 2: KNMI Solar Radiation (Good Accuracy)                       │   │
│   │  ────────────────────────────────────────────────                       │   │
│   │                                                                         │   │
│   │  Condition: radiation !== null                                          │   │
│   │                                                                         │   │
│   │  ┌─────────────┐                                        ┌───────────┐  │   │
│   │  │ KNMI W/m²   │───────────────────────────────────────▶│  W/m²     │  │   │
│   │  │ (direct)    │                                        │  output   │  │   │
│   │  └─────────────┘                                        └───────────┘  │   │
│   │                                                                         │   │
│   │  ✓ Regional measurement (weather station)                              │   │
│   │  ✓ Includes cloud cover                                                │   │
│   │  ✗ Not hyperlocal                                                      │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                         │
│                                       ▼ (if not available)                      │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  PRIORITY 3: Sinusoidal Estimation (Fallback)                           │   │
│   │  ────────────────────────────────────────────                           │   │
│   │                                                                         │   │
│   │  Always available                                                       │   │
│   │                                                                         │   │
│   │  ┌─────────────┐     ┌─────────────────────────────┐     ┌───────────┐ │   │
│   │  │ Hour of Day │────▶│  500 × sin(π × (hour-6)/14) │────▶│  W/m²     │ │   │
│   │  │ (0-23)      │     │                             │     │  output   │ │   │
│   │  └─────────────┘     │  Peak: 500 W/m² at noon     │     └───────────┘ │   │
│   │                      │  Zero: before 6h, after 20h │                   │   │
│   │                      └─────────────────────────────┘                   │   │
│   │                                                                         │   │
│   │  ✗ No cloud cover                                                      │   │
│   │  ✗ No seasonal variation                                               │   │
│   │  ✓ Always works                                                        │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: New Capabilities (3 files)

### 1.1 `.homeycompose/capabilities/adlar_external_wind_speed.json`
```json
{
  "id": "adlar_external_wind_speed",
  "title": { "en": "External Wind Speed", "nl": "Externe Windsnelheid" },
  "type": "number",
  "units": { "en": "km/h", "nl": "km/u" },
  "min": 0, "max": 200, "step": 0.1, "decimals": 1,
  "getable": true, "setable": false,
  "uiComponent": "sensor", "insights": true,
  "icon": "/assets/external-wind-speed.svg"
}
```

### 1.2 `.homeycompose/capabilities/adlar_external_solar_power.json`
```json
{
  "id": "adlar_external_solar_power",
  "title": { "en": "External Solar Power", "nl": "Externe Zonnepaneel Vermogen" },
  "type": "number",
  "units": { "en": "W" },
  "min": 0, "max": 50000, "step": 1, "decimals": 0,
  "getable": true, "setable": false,
  "uiComponent": "sensor", "insights": true,
  "icon": "/assets/external-solar-power.svg"
}
```

### 1.3 `.homeycompose/capabilities/adlar_external_solar_radiation.json`
```json
{
  "id": "adlar_external_solar_radiation",
  "title": { "en": "External Solar Radiation", "nl": "Externe Zonnestraling" },
  "type": "number",
  "units": { "en": "W/m²" },
  "min": 0, "max": 1500, "step": 1, "decimals": 0,
  "getable": true, "setable": false,
  "uiComponent": "sensor", "insights": true,
  "icon": "/assets/external-solar-radiation.svg"
}
```

---

## Phase 2: New Flow Cards (3 files)

### 2.1 `.homeycompose/flow/actions/receive_external_wind_data.json`
- **Input**: wind_speed (km/h), 0-200, step 0.1
- **Purpose**: Receive KNMI wind data for heat loss correction

### 2.2 `.homeycompose/flow/actions/receive_external_solar_power.json`
- **Input**: power_value (Watt), 0-50000
- **Purpose**: Receive solar panel output (SolarEdge, etc.)

### 2.3 `.homeycompose/flow/actions/receive_external_solar_radiation.json`
- **Input**: radiation_value (W/m²), 0-1500
- **Purpose**: Receive KNMI solar radiation directly

---

## Phase 3: Device Settings

### 3.1 Wind Correction Group (new section in `driver.settings.compose.json`)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `wind_correction_enabled` | checkbox | false | Enable wind correction |
| `wind_alpha_manual` | number | 0 | Manual α override (0 = use learned) |
| `wind_max_correction` | number | 3.0 | Max target correction (°C) |

### 3.2 Solar Radiation Group

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `solar_source` | dropdown | "auto" | auto / solar_panels / knmi_radiation / estimation |
| `solar_panel_wp` | number | 0 | System Wp rating (e.g., 6000 for 6kWp) |
| `solar_panel_efficiency` | number | 0.85 | Real-world efficiency factor |

---

## Phase 4: WindCorrectionService (NEW)

### File: `lib/services/wind-correction-service.ts`

**Responsibilities:**
1. Receive wind data from flow card
2. Learn α coefficient from residual heat loss errors
3. Calculate real-time target correction using formula

### Core Formula (Lookup Table Alternative)

```typescript
calculateCorrection(indoorTemp, outdoorTemp, baseUA): number {
  const alpha = this.getEffectiveAlpha(); // manual override or learned
  const deltaT = indoorTemp - outdoorTemp;
  const windSpeed = this.currentWindSpeed; // km/h
  const maxCorrection = this.device.getSetting('wind_max_correction') || 3.0;

  // Skip if no temperature difference or no wind
  if (deltaT <= 5 || windSpeed < 5) return 0;

  // Formula: α × windSpeed × ΔT / compensationFactor
  // Where compensationFactor normalizes to °C correction
  const rawCorrection = alpha * windSpeed * deltaT / 100;

  return Math.min(rawCorrection, maxCorrection);
}
```

### Lookup Table (Reference Values, α = 0.006)

| Wind (km/h) | ΔT=10°C | ΔT=15°C | ΔT=20°C | ΔT=25°C |
|-------------|---------|---------|---------|---------|
| 10 | +0.2°C | +0.3°C | +0.4°C | +0.5°C |
| 20 | +0.4°C | +0.6°C | +0.8°C | +1.0°C |
| 30 | +0.6°C | +0.9°C | +1.2°C | +1.5°C |
| 40 | +0.8°C | +1.2°C | +1.6°C | +2.0°C |
| 50 | +1.0°C | +1.5°C | +2.0°C | +2.5°C* |

*Capped at max_correction setting

### Alpha Learning (Simplified RLS)

```typescript
learnAlphaFromResidual(predictedLoss, actualLoss, windSpeed, deltaT): void {
  // Residual = actual - predicted (positive = more loss than expected)
  const residual = actualLoss - predictedLoss;

  // If wind present and residual positive, wind caused extra loss
  if (windSpeed > 5 && residual > 0 && deltaT > 5) {
    // alpha = residual / (windSpeed * deltaT * UA_base)
    const impliedAlpha = residual / (windSpeed * deltaT * this.baseUA);

    // Exponential moving average
    this.learnedAlpha = 0.99 * this.learnedAlpha + 0.01 * impliedAlpha;
  }
}
```

---

## Phase 5: BuildingModelService Modifications

### File: `lib/services/building-model-service.ts`

### 5.1 Solar Priority Cascade

```typescript
private getSolarRadiationWithPriority(): number {
  const source = this.device.getSetting('solar_source') || 'auto';

  // Priority 1: Solar panels (convert W to W/m²)
  if (source === 'auto' || source === 'solar_panels') {
    const power = this.device.getCapabilityValue('adlar_external_solar_power');
    const wp = this.device.getSetting('solar_panel_wp');
    const eff = this.device.getSetting('solar_panel_efficiency') || 0.85;

    if (power !== null && wp > 0) {
      // At STC: 1000 W/m² → Wp output
      // radiation = power / (Wp / 1000) / efficiency
      return Math.min((power / (wp / 1000)) / eff, 1200);
    }
  }

  // Priority 2: KNMI radiation
  if (source === 'auto' || source === 'knmi_radiation') {
    const radiation = this.device.getCapabilityValue('adlar_external_solar_radiation');
    if (radiation !== null) return radiation;
  }

  // Priority 3: Sinusoidal estimation (existing)
  return this.estimateSolarRadiation(new Date().getHours());
}
```

### 5.2 Wind Data Collection for Alpha Learning

In `collectAndLearn()`:
- Read `adlar_external_wind_speed` capability
- Pass to WindCorrectionService for alpha learning
- Store wind speed in measurement for logging

---

## Phase 6: FlowCardManagerService Handlers

### File: `lib/services/flow-card-manager-service.ts`

Add 3 new handlers in `registerExternalDataActionCards()`:

1. `handleReceiveExternalWindData(args: { wind_speed: number })`
2. `handleReceiveExternalSolarPower(args: { power_value: number })`
3. `handleReceiveExternalSolarRadiation(args: { radiation_value: number })`

Pattern: Set capability → Store value → Emit event

---

## Phase 7: AdaptiveControlService Integration

### File: `lib/services/adaptive-control-service.ts`

**Integration Approach**: Wind correctie wordt verwerkt via de **gesimuleerde target** (`adlar_simulated_target`), niet direct naar de warmtepomp. De gebruiker beslist via flows of/wanneer dit wordt toegepast.

### 7.1 Add WindCorrectionService

```typescript
// In constructor
this.windCorrection = new WindCorrectionService({ device, logger });

// In executeControlCycle(), after existing components
if (this.device.getSetting('wind_correction_enabled')) {
  const windCorrection = this.windCorrection.calculateCorrection({
    indoorTemp,
    outdoorTemp: this.device.getOutdoorTemperatureWithFallback() || 0,
    baseUA: this.buildingModel.getLearner().getModel().UA,
  });

  // Add wind correction to thermal component (affects simulated target)
  // This follows existing pattern: simulation only, user applies via flows
  thermalAction.adjustment += windCorrection.correction;

  // Log for transparency
  if (windCorrection.correction > 0) {
    this.logger(`💨 Wind correction: +${windCorrection.correction.toFixed(1)}°C → simulated target`);
  }
}
```

### 7.2 Update Simulated Target Capability

The wind correction is included in `adlar_simulated_target`, which users can apply via the existing flow card pattern:
- Trigger: "Simulated target changed"
- Condition: Check if change is significant
- Action: Apply to actual target_temperature (user choice)

---

## Phase 8: SVG Icons (3 files)

Create in `assets/`:
1. `external-wind-speed.svg` - Wind/airflow icon
2. `external-solar-power.svg` - Solar panel icon
3. `external-solar-radiation.svg` - Sun with rays icon

Follow iOS/Safari compatibility rules (attributes on elements, not root SVG).

---

## Phase 9: Driver Compose Updates

### File: `drivers/intelligent-heat-pump/driver.compose.json`

Add new capabilities to capabilities array:
```json
"capabilities": [
  // ... existing ...
  "adlar_external_wind_speed",
  "adlar_external_solar_power",
  "adlar_external_solar_radiation"
]
```

---

## Implementation Order

1. Phase 1 - Capabilities (3 JSON files)
2. Phase 2 - Flow cards (3 JSON files)
3. Phase 3 - Device settings
4. Phase 8 - SVG icons
5. Phase 9 - Driver compose
6. Phase 4 - WindCorrectionService (new TypeScript file)
7. Phase 5 - BuildingModelService modifications
8. Phase 6 - FlowCardManagerService handlers
9. Phase 7 - AdaptiveControlService integration
10. Localization updates (en.json, nl.json)

---

## Verification

### Build & Validate
```bash
npm run build
homey app validate
```

### Test Scenarios
1. Send wind data via flow → check capability updates
2. Send solar power via flow → check radiation conversion
3. Enable wind correction → verify target temp increases with wind
4. Disable wind correction → verify no effect
5. Test priority cascade: panel data present → uses panel; absent → uses KNMI; absent → uses estimation

### Flow Card Tests
- KNMI app trigger → `receive_external_wind_data` action
- SolarEdge app trigger → `receive_external_solar_power` action
- KNMI app trigger → `receive_external_solar_radiation` action

---

## Files to Create (NEW)

| File | Type |
|------|------|
| `.homeycompose/capabilities/adlar_external_wind_speed.json` | Capability |
| `.homeycompose/capabilities/adlar_external_solar_power.json` | Capability |
| `.homeycompose/capabilities/adlar_external_solar_radiation.json` | Capability |
| `.homeycompose/flow/actions/receive_external_wind_data.json` | Flow card |
| `.homeycompose/flow/actions/receive_external_solar_power.json` | Flow card |
| `.homeycompose/flow/actions/receive_external_solar_radiation.json` | Flow card |
| `lib/services/wind-correction-service.ts` | Service |
| `assets/external-wind-speed.svg` | Icon |
| `assets/external-solar-power.svg` | Icon |
| `assets/external-solar-radiation.svg` | Icon |

## Files to Modify

| File | Changes |
|------|---------|
| `drivers/intelligent-heat-pump/driver.settings.compose.json` | Add wind + solar settings groups |
| `drivers/intelligent-heat-pump/driver.compose.json` | Add 3 new capabilities |
| `lib/services/building-model-service.ts` | Solar priority cascade, wind data collection |
| `lib/services/flow-card-manager-service.ts` | 3 new flow card handlers |
| `lib/services/adaptive-control-service.ts` | WindCorrectionService integration |
| `locales/en.json` | Translations |
| `locales/nl.json` | Translations |
