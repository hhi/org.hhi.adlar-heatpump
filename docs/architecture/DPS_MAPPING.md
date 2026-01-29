# DPS Mapping & Data Processing

**Parent Documentation**: [CLAUDE.md](../../CLAUDE.md)
**Related**: [SERVICE_ARCHITECTURE.md](SERVICE_ARCHITECTURE.md#2-capabilityhealthservice)

## Overview

The app uses a centralized mapping system to translate Tuya DPS (Data Point System) values to Homey capabilities, with support for multi-capability mappings, scale transformations, and health tracking.

**Location**: `lib/definitions/adlar-mapping.ts`

## DPS to Capability Mapping (Enhanced v0.99.54+)

### Mapping Arrays

The `AdlarMapping` class provides five mapping arrays:

1. **`capabilities`** - Standard Homey capabilities
   - Example: `onoff`, `target_temperature`, `dim`

2. **`customCapabilities`** - Extended capabilities with dot notation
   - Example: `measure_temperature.temp_top`, `measure_temperature.temp_bottom`

3. **`adlarCapabilities`** - Device-specific capabilities
   - Example: `adlar_hotwater`, `adlar_fault`, `adlar_state_compressor`

4. **`allArraysSwapped`** - Reverse mapping DPS ID → capability name (legacy)
   - Single capability per DPS
   - Used for backward compatibility

5. **`dpsToCapabilities`** - **NEW (v0.99.54+)** Multi-capability mapping
   - One DPS can update multiple capabilities simultaneously
   - Enables dual picker/sensor architecture

### Dual Picker/Sensor Architecture (v0.99.54+)

**Problem**: Users need visibility into curve settings without accidentally changing them.

**Solution**: Each control DPS maps to TWO capabilities:
- **Sensor** (always visible, read-only in UI)
- **Picker** (optional, user-controllable, toggleable via settings)

**Implementation**:

| DPS | Sensor (Always Visible) | Picker (Optional) | User Setting |
|-----|------------------------|-------------------|--------------|
| 11  | `adlar_sensor_capacity_set` | `adlar_enum_capacity_set` | `enable_curve_controls` |
| 13  | `adlar_enum_countdown_set` | `adlar_picker_countdown_set` | `enable_curve_controls` |

**Benefits**:
- ✅ Always-visible read-only status display via sensor capabilities
- ✅ Optional user-controllable pickers (toggled via `enable_curve_controls` setting)
- ✅ Single DPS update maintains data consistency across both capabilities
- ✅ Flow cards work regardless of picker visibility setting
- ✅ Cleaner default UI (pickers hidden, sensors shown)

**Device Settings Toggle**:

```text
Settings → Advanced → "Enable curve controls" (default: false)

Disabled (default):
├─ adlar_sensor_capacity_set: ✓ Visible (read-only)
└─ adlar_enum_capacity_set: ✗ Hidden

Enabled:
├─ adlar_sensor_capacity_set: ✓ Visible (read-only)
└─ adlar_enum_capacity_set: ✓ Visible (user-controllable)
```

## DPS Scale Transformation (v1.0.10+)

**Critical Fix**: Tuya compresses decimal values as integers for transmission efficiency. Raw DPS values must be transformed using scale factors before display.

### Scale Factor System

**Location**: `lib/definitions/adlar-mapping.ts`

```typescript
static dpsScales: Record<number, number> = {
  // Power measurements (Scale 1: divide by 10)
  104: 1, // measure_power (Watt)

  // Energy measurements (Scale 2: divide by 100)
  18: 2,  // meter_power.power_consumption (kWh)
  105: 2, // meter_power.electric_total (kWh)

  // Current measurements (Scale 3: divide by 1000)
  102: 3, // measure_current.cur_current (Ampère A)
  109: 3, // measure_current.b_cur (Ampère B)
  110: 3, // measure_current.c_cur (Ampère C)

  // Voltage measurements (Scale 3: divide by 1000)
  103: 3, // measure_voltage.voltage_current (Volt A)
  111: 3, // measure_voltage.bv (Volt B)
  112: 3, // measure_voltage.cv (Volt C)
};
```

### Transformation Formula

```
actualValue = rawDpsValue / (10 ^ scale)
```

**Examples**:
- Scale 1: `25000 / 10 = 2500 W` (power)
- Scale 2: `12345 / 100 = 123.45 kWh` (energy)
- Scale 3: `2305 / 1000 = 230.5 V` (voltage)
- Scale 3: `1050 / 1000 = 10.50 A` (current)

### Implementation

**Transformation Method**:

```typescript
static transformDpsValue(dpsId: number, rawValue: unknown): unknown {
  if (typeof rawValue !== 'number') return rawValue; // Pass through non-numeric

  const scale = this.dpsScales[dpsId];
  if (scale === undefined) return rawValue; // No scale defined

  const divisor = 10 ** scale; // 10^1=10, 10^2=100, 10^3=1000
  return rawValue / divisor;
}
```

**Application** (`device.ts:updateCapabilitiesFromDps()`):

```typescript
// Transform raw DPS value before capability update
const transformedValue = AdlarMapping.transformDpsValue(dpsId, value);
await this.setCapabilityValue(capability, transformedValue);
```

### Impact Assessment

**Before Fix** (v1.0.9 and earlier):
- ❌ Voltage: `2305 V` displayed (should be `230.5 V`) - 1000x too high
- ❌ Current: `1050 A` displayed (should be `10.5 A`) - 1000x too high
- ❌ Power: `25000 W` displayed (should be `2500 W`) - 10x too high
- ❌ Energy: `12345 kWh` displayed (should be `123.45 kWh`) - 100x too high

**After Fix** (v1.0.10+):
- ✅ All electrical measurements display correct values
- ✅ COP calculations use accurate power/energy data
- ✅ Flow card thresholds work as expected
- ✅ Energy tracking reflects actual consumption

### Maintenance Note

When adding new DPS with decimal values:
1. Check device protocol documentation for scale factor
2. Add entry to `dpsScales` mapping in `adlar-mapping.ts`
3. Test transformed values match expected physical units
4. Update this documentation with new DPS entries

## Outdoor Temperature Sensor Priority (v2.0.2+)

**Critical**: External ambient sensors (weather stations, outdoor thermometers) are significantly more accurate than heat pump's internal sensor, which is affected by compressor heat.

### Priority Fallback System

```typescript
// Priority 1: External ambient sensor (most accurate)
const outdoorTemp = device.getCapabilityValue('adlar_external_ambient');

// Priority 2: Heat pump's own sensor (fallback, less accurate)
if (outdoorTemp === null) {
  outdoorTemp = device.getCapabilityValue('measure_temperature.temp_ambient'); // DPS 25
}
```

### Helper Method

**Location**: `device.ts:2893-2920`

```typescript
public getOutdoorTemperatureWithFallback(): number | null {
  // Returns: external sensor → heat pump sensor → null

  // Try external sensor first
  const externalTemp = this.getCapabilityValue('adlar_external_ambient');
  if (externalTemp !== null && externalTemp !== undefined) {
    return externalTemp;
  }

  // Fallback to heat pump's own sensor
  const internalTemp = this.getCapabilityValue('measure_temperature.temp_ambient');
  return internalTemp !== null && internalTemp !== undefined ? internalTemp : null;
}
```

### Usage Locations

- [BuildingModelService](../../lib/services/building-model-service.ts#L106-L114) - Thermal mass learning
- [BuildingModelService diagnostics](../../lib/services/building-model-service.ts#L246-L248) - Health checks
- [AdaptiveControlService](../../lib/services/adaptive-control-service.ts#L372-L374) - COP optimization

### Flow Card Setup

**Recommended User Configuration**:

```text
WHEN [Weather Station] temperature changes
THEN Send [temperature] to [Heat Pump] for COP/thermal mass calculation
```

This flow card updates `adlar_external_ambient` capability, which takes priority over DPS 25 sensor.

### Accuracy Difference

| Sensor Type | Accuracy | Notes |
|-------------|----------|-------|
| External sensor | ±0.1°C | Weather station quality, isolated from heat sources |
| Heat pump sensor (DPS 25) | ±0.5-1.0°C | Affected by compressor proximity bias |

**Impact**: 1°C error = ~10% COP calculation error

**Recommendation**: Always use external ambient sensor for COP/building model calculations when available.

## DPS-Only Health Tracking (v1.2.3)

**Purpose**: Health metrics track **device communication health** (DPS data from Tuya device), not application logic health (calculated values or user configurations).

### What's Included in Health Metrics

**✅ DPS Capabilities** (tracked):

- **SENSOR capabilities**: `measure_*`, `meter_*`
  - Direct device sensor data
  - Timeout: 5 minutes

- **STATUS capabilities**: `adlar_connection_status`, `adlar_fault`, `adlar_state_*`
  - Device status information
  - Timeout: 15 minutes

- **POWER capabilities**: Power/voltage/current measurements from device
  - Electrical measurements (DPS 102-104, 109-112)
  - Timeout: 5 minutes

- **CONTROL capabilities**: User-controlled settings
  - Never timeout (user sets values, not auto-updating)

### What's Excluded from Health Metrics

**❌ Non-DPS Capabilities** (excluded):

- **CALCULATED capabilities**: `adlar_cop*`, `adlar_scop*`
  - Derived from sensor data (application logic)
  - Not direct device communication

- **EXTERNAL capabilities**: `adlar_external_*`
  - User configuration via flow cards
  - Not device-generated data

### Health Status Thresholds

- **Healthy**: ≥90% of DPS capabilities have recent valid data
- **Degraded**: 70-89% of DPS capabilities healthy
- **Critical**: <70% of DPS capabilities healthy

### Example Calculation

Device with 44 total capabilities:
- 13 calculated/external (excluded from health check)
- 31 DPS capabilities (included in health check)

**Correct Assessment**:
- If 30/31 DPS capabilities healthy → **97% = "healthy"** ✅

**Incorrect Assessment** (pre-v1.2.3):
- If 30/44 total capabilities healthy → 68% = "critical" ❌

### Rationale

1. **Device vs Application**: Health check answers "Is the device communicating?" not "Are my automations working?"
2. **Dependency Chain**: Calculated values depend on sensor health - if sensors healthy but COP=null, that's a calculation issue not a communication issue
3. **Optional Features**: External integrations are user configuration choices, not device functionality

**Implementation**: [capability-health-service.ts:186-211](../../lib/services/capability-health-service.ts#L186-L211)

---

## Device Communication

**TuyAPI Integration**:

- Uses TuyAPI library for local device communication
- Automatic reconnection using DeviceConstants.RECONNECTION_INTERVAL_MS (20 seconds)
- Bidirectional data flow: Homey capabilities ↔ Tuya DPS
- Event-driven updates via 'data' and 'dp-refresh' events
- Enhanced error handling with categorization and automatic retry for recoverable errors

**Data Flow**:

```text
┌─────────────────────────────────────────────────┐
│             Device → Homey                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Device emits DPS update                     │
│     └─ TuyAPI receives 'data' event             │
│                                                 │
│  2. TuyaConnectionService processes event       │
│     └─ Extract DPS ID and value                 │
│                                                 │
│  3. AdlarMapping.transformDpsValue()            │
│     └─ Apply scale transformation if needed     │
│                                                 │
│  4. AdlarMapping.dpsToCapabilities lookup       │
│     └─ May return multiple capabilities         │
│                                                 │
│  5. Update capabilities (batched async)         │
│     ├─ device.setCapabilityValue(cap1, value)   │
│     └─ device.setCapabilityValue(cap2, value)   │
│                                                 │
│  6. CapabilityHealthService validation          │
│     └─ Track health status of DPS capabilities  │
│                                                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│             Homey → Device                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. User changes capability in Homey UI         │
│     └─ device.onCapability[Name](value)         │
│                                                 │
│  2. AdlarMapping reverse lookup                 │
│     └─ Capability name → DPS ID                 │
│                                                 │
│  3. TuyaConnectionService.set()                 │
│     └─ tuya.set({ dps: X, set: value })         │
│                                                 │
│  4. Device updates internal state               │
│     └─ Sends confirmation via 'data' event      │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

**Related Documentation**:
- [Service Architecture](SERVICE_ARCHITECTURE.md)
- [Capability Health Tracking](SERVICE_ARCHITECTURE.md#2-capabilityhealthservice)
- [Error Handling](ERROR_HANDLING.md)
