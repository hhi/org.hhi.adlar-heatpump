# Flow Cards Implementation Guide: Basic Device Flow Cards (v2.7.x)

> **Scope**: This guide documents **basic device flow cards** for device monitoring, energy tracking and calculators.
> **Advanced features**: See [Advanced Flow Cards Guide](../advanced-control/ADVANCED_FLOWCARDS_GUIDE.en.md) for adaptive control, building model, COP optimizer, energy optimizer, building insights and wind/solar integration.

This guide provides practical examples, configuration tips, and troubleshooting advice for the basic flow cards of the Adlar Heat Pump app.

---

## Overview

Version 1.0.7 introduces **5 new flow cards** that complete critical functionality gaps identified during the comprehensive flow card audit:

| Flow Card | Type | Category | Priority |
|-----------|------|----------|----------|
| `fault_detected` | Trigger | Device Safety | 🔴 Critical |
| `power_threshold_exceeded` | Trigger | Energy Management | 🔴 Critical |
| `total_consumption_milestone` | Trigger | Goal Tracking | 🔴 Critical |
| `cop_efficiency_check` | Condition | Performance | 🔴 Critical |
| `daily_cop_above_threshold` | Condition | Performance | 🔴 Critical |
| `monthly_cop_above_threshold` | Condition | Performance | 🔴 Critical |

Additionally, **1 existing flow card** was verified production-ready:
- `temperature_differential` (Condition) - System Health ✅

---

## Triggers

### 1. 🚨 Fault Detected

**ID**: `fault_detected`
**Category**: Device Safety
**When it triggers**: When the heat pump reports a system fault (DPS 15 > 0)

#### Configuration

```yaml
WHEN: Fault code [fault_code] detected
```

**Parameters**:
- `fault_code` (range 1-100): Specific fault code to monitor
  - Leave blank to trigger on ANY fault
  - Specify code (e.g., 3) to trigger only on that fault

**Tokens Available**:
- `fault_code` (number): The fault code number
- `fault_description` (string): Human-readable description in your language

#### Supported Fault Codes

| Code | English | Dutch |
|------|---------|------------|
| 0 | No fault | Geen storing |
| 1 | High pressure protection | Hogedrukbeveiliging |
| 2 | Low pressure protection | Lagedrukbeveiliging |
| 3 | Compressor overheating | Compressor oververhitting |
| 4 | Discharge temperature too high | Uitlaattemperatuur te hoog |
| 5 | Water flow sensor fault | Waterdoorstroomsensor storing |
| 6 | Inlet temperature sensor fault | Inlaattemperatuursensor storing |
| 7 | Outlet temperature sensor fault | Uitlaattemperatuursensor storing |
| 8 | Ambient temperature sensor fault | Omgevingstemperatuursensor storing |
| 9 | Coil temperature sensor fault | Spoeltemperatuursensor storing |
| 10 | Low water flow protection | Lage waterdoorstroom beveiliging |
| 11 | Antifreeze protection active | Vorstbeveiliging actief |
| 12 | Phase loss or reverse phase | Faseuitval of omkeerde fase |
| 13 | Communication error | Communicatiefout |
| 14 | EEV valve fault | EEV-klep storing |
| 15 | System pressure abnormal | Systeemdruk abnormaal |

#### Example Flows

**Critical Fault Notification**:
```
WHEN: Fault detected
  AND fault_code is 1, 2, 3, or 4
THEN: Send notification "Critical heat pump fault: {{fault_description}}"
  AND Turn off device
  AND Send email to maintenance
```

**Sensor Fault Auto-Recovery**:
```
WHEN: Fault detected
  AND fault_code is 6, 7, 8, or 9
THEN: Wait 5 minutes
  AND Restart device
  AND Check if fault cleared
```

**Antifreeze Alert**:
```
WHEN: Fault detected
  AND fault_code is 11
THEN: Send notification "Antifreeze protection activated"
  AND Increase target temperature by 2°C
```

#### Technical Details

- **Detection**: Monitors DPS 15 (`adlar_fault` capability)
- **Trigger Logic**: Only triggers on **new** faults (change detection)
- **Deduplication**: Same fault code won't retrigger until cleared (code returns to 0)
- **Language Support**: Fault descriptions automatically localized (EN/NL)
- **Performance**: Zero overhead when no fault present

#### Troubleshooting

**Problem**: Fault trigger fires repeatedly for same fault
**Solution**: This should not happen due to change detection. Check device logs for fault code oscillation.

**Problem**: Fault description shows "Unknown fault (code: X)"
**Solution**: The fault code is not in the standard mapping table. Report code to developer for addition.

---

### 2. ⚡ Power Threshold Exceeded

**ID**: `power_threshold_exceeded`
**Category**: Energy Management
**When it triggers**: When power consumption exceeds configured threshold

#### Configuration

```yaml
WHEN: Power consumption exceeded [threshold] W
```

**Parameters**:
- `threshold` (100-10000W): Power threshold in watts
  - Default: 3000W
  - Recommended: Set to 120% of normal maximum

**Tokens Available**:
- `current_power` (number): Current power consumption in watts
- `threshold_power` (number): The configured threshold

#### Smart Features

**Hysteresis Protection** (5%):
- Once triggered at 3000W, must drop below 2850W to reset
- Prevents trigger spam from power oscillations
- Example: 2990W → 3010W → TRIGGER → 2995W → (no retrigger)

**Rate Limiting** (5 minutes):
- Maximum 1 trigger per 5 minutes
- Prevents notification flood during sustained overload
- Logs rate-limited events for diagnostics

#### Example Flows

**High Consumption Alert**:
```
WHEN: Power threshold exceeded 3500W
THEN: Send notification "High power usage: {{current_power}}W"
  AND Log to Google Sheets with timestamp
```

**Overload Protection**:
```
WHEN: Power threshold exceeded 4500W
THEN: Lower target temperature by 2°C
  AND Wait 5 minutes
  AND Check if power dropped below 4000W
```

**Time-of-Use Optimization**:
```
WHEN: Power threshold exceeded 3000W
  AND Time is between 17:00 and 21:00 (peak hours)
THEN: Switch to Economy mode
  AND Send notification "Switched to economy mode during peak hours"
```

---

### 3. 🎯 Total Consumption Milestone

**ID**: `total_consumption_milestone`
**Category**: Goal Tracking
**When it triggers**: When cumulative energy consumption reaches 100 kWh milestones

#### Configuration

```yaml
WHEN: Total consumption reached [milestone] kWh
```

**Parameters**:
- `milestone` (100-50000 kWh): Milestone value
  - Auto-triggers at: 100, 200, 300, ..., 1000, 1100, etc.
  - **Increment**: Fixed at 100 kWh steps

**Tokens Available**:
- `total_consumption` (number): Current total consumption in kWh
- `milestone_value` (number): The milestone that was reached

#### Milestone Behavior

**First Run Catch-Up**:
If you install the app with existing consumption (e.g., 523 kWh):
- Will trigger for ALL milestones: 100, 200, 300, 400, 500
- This is intentional to catch up on missed milestones
- Subsequent milestones trigger normally (only new ones)

**Deduplication**:
- Each milestone only triggers once (ever)
- Tracked in device store: `triggered_energy_milestones`
- Survives app restarts and updates
- Can be reset manually if needed

#### Example Flows

**Monthly Budget Tracking**:
```
WHEN: Milestone reached 300 kWh
THEN: Send notification "Monthly budget reached: {{total_consumption}} kWh"
  AND Calculate cost: {{total_consumption}} * €0.30
  AND Log to Insights
```

**Seasonal Goal Tracking**:
```
WHEN: Milestone reached 1000 kWh
THEN: Send notification "Seasonal milestone: {{milestone_value}} kWh"
  AND Compare to last year's data
  AND Send efficiency report
```

---

## Conditions

### 4. 🎯 COP Efficiency Check

**ID**: `cop_efficiency_check`
**Category**: Performance Monitoring
**When it's true**: When current COP exceeds threshold AND compressor is running

#### Configuration

```yaml
IF: COP efficiency is above/below [threshold]
```

**Parameters**:
- `threshold` (1.0-8.0): COP threshold value
  - Default: 2.0
  - Typical range: 2.5-4.5 for heat pumps
  - Excellent: > 4.0, Good: 3.0-4.0, Poor: < 2.5

#### Smart Behavior

**Compressor State Check**:
- **Returns `false` when compressor idle** (even if COP > threshold)
- Why? COP=0 during idle is technical correct but misleading in flows
- Prevents false positives in "IF COP < 2.0" flows

**Real-Time Monitoring**:
- Uses current `adlar_cop` capability (updated every 30 seconds)
- Reflects instantaneous efficiency, not averages

#### Example Flows

**Efficiency Alert**:
```
IF: COP efficiency is below 2.5
  AND Device is on
THEN: Send notification "Low efficiency: COP {{adlar_cop}}"
  AND Check for issues
```

**Optimization Trigger**:
```
IF: COP efficiency is above 4.0
  AND Outdoor temperature < 0°C
THEN: Send notification "Excellent efficiency despite cold weather!"
  AND Log as reference point
```
---

### 5. 📊 Daily COP Above Threshold

**ID**: `daily_cop_above_threshold`
**Category**: Performance Monitoring
**When it's true**: When 24-hour rolling average COP exceeds threshold

#### Configuration

```yaml
IF: Daily COP is above/below [threshold]
```

**Parameters**:
- `threshold` (1.0-8.0): Daily COP threshold
  - Default: 2.5
  - Recommended: 3.0 for good daily performance

#### Smart Behavior

**Data Availability Check**:
- **Returns `false` if insufficient data** (dailyCOP = 0)
- Requires at least 10 data points (~5 minutes of operation)
- This prevents false positives on startup

**Rolling Average**:
- Calculates COP over last 24 hours
- Weighted by runtime (idle periods excluded)
- More stable than real-time COP

---

### 6. 📈 Monthly COP Above Threshold

**ID**: `monthly_cop_above_threshold`
**Category**: Long-Term Performance
**When it's true**: When 30-day rolling average COP exceeds threshold

#### Configuration

```yaml
IF: Monthly COP is above/below [threshold]
```

**Parameters**:
- `threshold` (1.0-8.0): Monthly COP threshold
  - Default: 3.0
  - Target: > 3.5 for excellent seasonal performance

#### Example Flows

**Monthly Report**:
```
EVERY 1st day of month at 09:00:
IF: Monthly COP above 3.5
THEN: Send notification "Excellent monthly efficiency: {{adlar_cop_monthly}}"
  AND Calculate estimated costs
  AND Compare to previous months
```

**Predictive Maintenance**:
```
EVERY MONTH:
IF: Monthly COP dropped by > 10% vs last month
THEN: Send alert "Efficiency declining"
  AND Recommend filter check
  AND Schedule professional inspection
```
---

### 7. ✅ Temperature Differential

**ID**: `temperature_differential`
**Category**: System Health
**Status**: ✅ **Production-ready** (available in v2.7.x)

#### Configuration

```yaml
IF: Temperature differential is above/below [differential]°C
```

**Parameters**:
- `differential` (1-50°C): Temperature difference threshold
  - Typical: 5-10°C for efficient operation
  - Too low (< 3°C): Poor heat transfer
  - Too high (> 15°C): Possible flow issues

#### Example Flows

**Heat Transfer Efficiency**:
```
IF: Temperature differential below 3°C
  AND Compressor is running
THEN: Send notification "Poor heat transfer detected"
  AND Check water flow rate
  AND Verify pump operation
```

**Flow Problem Detection**:
```
IF: Temperature differential above 15°C
  AND Water flow below 20 L/min
THEN: Send alert "Possible flow restriction"
  AND Recommend filter check
```

---

## Actions

### 8. 🕐 Calculate Value from Time Schedule

**ID**: `calculate_time_based_value`
**Category**: Time-Based Automation
**Purpose**: Evaluate current time against daily schedules to calculate output values

#### Overview

The time schedule calculator enables **time-of-day programming** for automated temperature schedules, time-of-use optimization, and daily routines.

#### Configuration

```yaml
ACTION: Calculate value from time schedule
  Time Schedule: 06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, 23:00-06:00: 18
  Returns: {{result_value}}
```

**Parameters**:

- `schedule` (text): Time schedule definition string (comma or newline separated)

**Returns**:

- `result_value` (number): Calculated output value based on current time

#### Schedule Format

**Syntax**: `HH:MM-HH:MM: output_value`

**Features**:
- Supports **overnight ranges** (e.g., `23:00-06:00` spans midnight)
- Maximum **30 time ranges** per schedule
- **Default fallback** support (`default: value`)
- Comma or newline separated entries

#### Example Flows

**Daily Temperature Programming**:
```
EVERY 5 MINUTES:
THEN: Calculate value from time schedule
      Schedule: 06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, 23:00-06:00: 18
  AND Set target temperature to {{result_value}}
```

**Time-of-Use Optimization**:
```
EVERY HOUR:
THEN: Calculate value from time schedule
      Schedule: 17:00-21:00: 2500, default: 4000
  AND Set maximum power limit to {{result_value}}W
```

---

### 9. 🌡️ Get Seasonal Mode

**ID**: `get_seasonal_mode`
**Category**: Seasonal Automation
**Purpose**: Automatically detect heating/cooling season based on current date

#### Overview

The seasonal mode calculator provides **automatic season detection** aligned with the EN 14825 SCOP standard. Perfect for switching between winter and summer schedules without manual intervention.

#### Configuration

```yaml
ACTION: Get seasonal mode
  Returns 4 tokens:
    - {{mode}} - "heating" or "cooling"
    - {{is_heating_season}} - true/false
    - {{is_cooling_season}} - true/false
    - {{days_until_season_change}} - number
```

**Parameters**: None (uses current date)

**Returns**:

- `mode` (string): Current seasonal mode ("heating" or "cooling")
- `is_heating_season` (boolean): True if Oct 1 - May 15
- `is_cooling_season` (boolean): True if May 16 - Sep 30
- `days_until_season_change` (number): Days until next season starts

#### Season Definitions

**Heating Season**: October 1 - May 15 (227 days)
- Aligned with **EN 14825 SCOP standard**
- Matches existing SCOP calculation period
- Typical European heating season

**Cooling Season**: May 16 - September 30 (138 days)
- Shoulder season + summer
- Reduced heating demand period

#### Example Flows

**Automatic Schedule Switching**:
```
EVERY DAY at 00:00:
THEN: Get seasonal mode
  AND IF {{is_heating_season}} is true
    THEN: Enable winter schedule (high temperatures)
    ELSE: Enable summer schedule (lower temperatures)
```

**Season Change Notification**:
```
EVERY DAY at 09:00:
THEN: Get seasonal mode
  AND IF {{days_until_season_change}} < 7
    THEN: Send notification "Season changes in {{days_until_season_change}} days"
```
---

### 10. 📊 Calculate Value from Curve

**ID**: `calculate_curve_value`
**Category**: Dynamic Optimization
**Purpose**: Calculate output values based on input conditions using configurable curves

#### Overview

The curve calculator is a powerful utility for dynamic value calculations. While designed primarily for **weather-compensated heating** (outdoor temperature → heating setpoint), it's versatile enough for any input-output mapping scenarios.

#### Configuration

```yaml
ACTION: Calculate value from curve
  Input Value: {{outdoor_temperature}}
  Curve Definition: < 0 : 55, < 5 : 50, < 10 : 45, default : 35
  Returns: {{result_value}}
```

**Parameters**:

- `input_value` (number or expression): The input value to evaluate
- `curve` (text): Curve definition string (comma or newline separated)

**Returns**:

- `result_value` (number): Calculated output value based on curve

#### Curve Format

**Syntax**: `[operator] threshold : output_value`

**Supported Operators**:

- `>` - Greater than
- `>=` - Greater than or equal
- `<` - Less than
- `<=` - Less than or equal
- `==` - Equal to
- `!=` - Not equal to
- `default` or `*` - Fallback value (always matches, use as last line)

**Evaluation Rules**:

1. Evaluates from **top to bottom**
2. Returns **first matching** condition
3. Falls back to `default` if no match (recommended to always include)
4. Maximum 50 entries per curve

#### Example Flows

**Weather-Compensated Heating** (Primary Use Case):
```
WHEN: Outdoor temperature changed
THEN: Calculate value from curve
      Input: {{outdoor_temperature}}
      Curve: < -5 : 60, < 0 : 55, < 5 : 50, < 10 : 45, < 15 : 40, default : 35
  AND Set target temperature to {{result_value}}
```

**COP-Based Dynamic Adjustment**:
```
WHEN: COP changed
THEN: Calculate value from curve
      Input: {{adlar_cop}}
      Curve: < 2.0 : -5, < 2.5 : -3, >= 3.5 : +2, default : 0
  AND Adjust target temperature by {{result_value}}°C
```

**Multi-Stage Heating Curve**:
```
WHEN: Outdoor temperature changed
THEN: Calculate value from curve
      Input: {{outdoor_temperature}}
      Curve:
        < -10 : 65
        < -5  : 60
        < 0   : 55
        < 5   : 50
        < 10  : 45
        < 15  : 40
        default : 35
  AND Set heating setpoint to {{result_value}}
```

#### Best Practices

**✅ DO**:

- Always add `default : <value>` as last line (prevents errors)
- Use newlines or commas to separate rules (both supported)
- Test your curve with different inputs before deploying
- Keep curves simple (under 20 entries recommended)
- Document your curve logic in flow description

**⚠️ DON'T**:

- Exceed 50 entries (hard limit)
- Forget the default fallback (causes errors on no match)
- Mix heating/cooling logic in same curve (use separate flows)
- Ignore evaluation order (top to bottom matters!)

#### Error Messages

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `"Input value must be a valid number"` | Invalid input tag or null value | Check your input token/variable |
| `"No matching curve condition found"` | No condition matched and no default | Add `default : <value>` as last line |
| `"Invalid curve syntax at line N"` | Malformed condition | Check format: `operator threshold : value` |
| `"Curve exceeds maximum allowed entries (50)"` | Too many lines in curve | Simplify curve or split into multiple flows |

---

## Settings Configuration

### Power Threshold Setting

To configure custom power threshold:
1. Go to Device Settings → Advanced
2. Find "Power Threshold (W)" setting
3. Set desired threshold (100-10000W)
4. Default: 3000W

**Note**: If setting doesn't exist, trigger will use hardcoded default (3000W).

---

## Troubleshooting Guide

### General Issues

**Flow cards not visible in Homey app**:
1. Check app version is 1.0.7 or higher
2. Restart Homey app
3. Check flow card settings: Device Settings → Flow Card Control
4. Ensure relevant capability has data (not null)

**Triggers fire but flows don't execute**:
1. Check flow is enabled (not paused)
2. Verify flow logic conditions
3. Check Homey's flow execution logs
4. Test with simple flow first (just notification)

**Conditions always return false**:
1. Check capability has valid data (not null/0)
2. Verify device is operational (not offline)
3. Check specific condition requirements (e.g., compressor running for COP)
4. Enable debug mode and check logs

### Diagnostic Commands

**Check capability values**:
```javascript
// In Homey Developer Tools → Device Capabilities
adlar_cop // Should show current COP
adlar_fault // Should show 0 (no fault) or fault code
measure_power // Should show current power in watts
meter_power.electric_total // Should show cumulative kWh
```

**Check triggered milestones**:
```javascript
// In Homey Developer Tools → Device Storage
triggered_energy_milestones // Array of triggered milestones
```

---

## Best Practices

### Flow Design

**1. Use Appropriate Granularity**:
- Real-time COP: For immediate alerts
- Daily COP: For daily reports
- Monthly COP: For trend analysis

**2. Combine Conditions**:
```
IF: COP below 2.0
  AND Power above 3000W
  AND Running for > 15 minutes
THEN: Investigate (not normal to have low COP with high power)
```

**3. Add Hysteresis in Flows**:
```
WHEN: Power threshold exceeded
THEN: Wait 5 minutes
  AND IF still above threshold
    THEN Take action
```

**4. Log for Analysis**:
```
WHEN: Any efficiency trigger
THEN: Log to Insights with all relevant data
  - Timestamp
  - COP value
  - Outdoor temperature
  - Power consumption
```

### Notification Management

**Prevent Spam**:
- Use rate limiting (built-in for power/fault triggers)
- Add time-based conditions (not between 22:00-08:00)
- Combine multiple checks before notifying

**Prioritize Alerts**:
- Critical: Faults, power overload → Immediate notification
- Warning: Low COP, high consumption → Daily digest
- Info: Milestones, good performance → Weekly summary

---
