# Flow Cards Implementation Guide (v1.0.7)

This guide documents the newly implemented flow cards in version 1.0.7, providing practical examples, configuration tips, and troubleshooting advice.

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

| Code | English | Nederlands |
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

**Problem**: Trigger doesn't fire despite fault visible in device status
**Solution**:
1. Check trigger is not disabled in flow settings
2. Verify flow card is enabled in device settings → Flow Card Control
3. Check app logs for error messages

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

**Smart Home Integration**:
```
WHEN: Power threshold exceeded 4000W
THEN: Check if EV is charging
  AND Pause EV charging temporarily
  AND Resume after 15 minutes
```

#### Configuration Tips

**Setting the Right Threshold**:
1. Monitor normal operation for 24 hours
2. Note maximum power during heating cycle (~3000-4000W typical)
3. Set threshold to 120% of maximum (e.g., 4800W if max is 4000W)
4. This ensures trigger only on genuine overload

**Device Settings Integration**:
- Go to Device Settings → Advanced → Power Threshold
- Set custom threshold (default: 3000W)
- Service will automatically use this value

#### Technical Details

- **Monitoring**: Checks every power update (~10 seconds)
- **State Machine**: Tracks `powerAboveThreshold` boolean
- **Hysteresis Formula**: `reset_threshold = threshold * 0.95`
- **Rate Limit**: 300,000ms (5 minutes) minimum between triggers
- **Performance**: ~2ms processing time per check

#### Troubleshooting

**Problem**: Trigger fires too often (every minute)
**Solution**:
- Threshold too low - increase by 500W increments
- Check rate limiting is working (should see "rate limited" in logs)

**Problem**: Trigger never fires despite high power
**Solution**:
1. Verify power monitoring is enabled (Device Settings → Energy Tracking)
2. Check `measure_power` capability has valid data
3. Confirm threshold is set correctly in settings

**Problem**: Trigger fires and immediately resets
**Solution**: This is normal behavior with hysteresis. Power dropped below 95% threshold.

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

**Cost Alert**:
```
WHEN: Milestone reached [any]
THEN: Calculate cost: {{milestone_value}} * €0.30
  AND IF cost > monthly budget
    THEN Send warning notification
```

**Gamification**:
```
WHEN: Milestone reached [any]
THEN: Send positive notification "Achievement unlocked: {{milestone_value}} kWh!"
  AND Show progress bar: {{total_consumption}} / 2000 kWh target
```

#### Configuration Tips

**Understanding Milestones**:
- 100 kWh ≈ €30-50 typical electricity cost
- Average heat pump: ~100-150 kWh per week in winter
- Annual consumption: ~5000-8000 kWh (= 50-80 milestones)

**Resetting Milestones** (if needed):
```javascript
// In Homey Developer Tools → Device Storage
// Delete key: 'triggered_energy_milestones'
// Next milestone will catch up from zero
```

#### Technical Details

- **Trigger Point**: After each energy update (~30 seconds)
- **Storage**: Array of triggered milestones in device store
- **Deduplication**: `if (!triggeredMilestones.includes(milestone))`
- **Catch-Up Logic**: Loops from 100 to `highestMilestone` on first run
- **Performance**: O(n) where n = number of milestones (negligible)

#### Troubleshooting

**Problem**: Multiple milestone triggers at once
**Solution**: Normal on first install. Each milestone triggers once. Subsequent runs trigger only new milestones.

**Problem**: Milestone doesn't trigger despite reaching 100 kWh
**Solution**:
1. Check `meter_power.electric_total` capability has data
2. Verify energy tracking is enabled
3. Check device logs for milestone check execution

**Problem**: Want to change milestone increment (not 100 kWh)
**Solution**: Currently fixed at 100 kWh. Use flow conditions to filter:
```
WHEN: Milestone reached [any]
  AND milestone_value MOD 500 = 0
THEN: (only triggers at 500, 1000, 1500, etc.)
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

**Dynamic Temperature Adjustment**:
```
IF: COP efficiency is below 2.0
  AND Running for > 30 minutes
THEN: Decrease target temperature by 1°C
  AND Wait 15 minutes
  AND Recheck efficiency
```

**Smart Defrost Detection**:
```
IF: COP efficiency is below 1.5
  AND Compressor is running
  AND Coil temperature < outlet temperature
THEN: Assume defrost needed
  AND Log timestamp for pattern analysis
```

#### Configuration Tips

**Setting Thresholds**:
- **Critical threshold**: < 2.0 (investigate immediately)
- **Warning threshold**: < 2.5 (monitor closely)
- **Good target**: > 3.0 (typical operation)
- **Excellent**: > 4.0 (ideal conditions)

**Factors Affecting COP**:
- Outdoor temperature (major impact)
- Water flow rate
- Temperature differential
- System age and maintenance
- Defrost cycles (temporarily lower COP)

#### Technical Details

- **Data Source**: `adlar_cop` capability (real-time)
- **Compressor Check**: `measure_frequency.compressor_strength > 0`
- **Update Frequency**: Every 30 seconds (follows COP calculation interval)
- **Return Logic**: `false` if idle, `(currentCOP > threshold)` if running

#### Troubleshooting

**Problem**: Condition always returns false
**Solution**: Check if compressor is running. Condition intentionally returns false during idle.

**Problem**: COP reads as 0 but compressor is running
**Solution**:
1. Check power measurement is available
2. Verify temperature sensors have valid data
3. Check COP calculation is enabled in settings

**Problem**: Condition triggers false alarms
**Solution**: Increase threshold slightly. COP can temporarily dip during:
- Defrost cycles
- System startup
- Extreme outdoor temperatures

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

#### Example Flows

**Daily Performance Report**:
```
EVERY DAY at 23:59:
IF: Daily COP above 3.0
THEN: Send notification "Good daily efficiency: {{adlar_cop_daily}}"
ELSE: Send notification "Below target: {{adlar_cop_daily}} (target: 3.0)"
```

**Maintenance Scheduling**:
```
EVERY WEEK:
IF: Daily COP below 2.5
  FOR 3 consecutive days
THEN: Send notification "Maintenance may be needed"
  AND Schedule inspection
```

**Weather Correlation**:
```
EVERY DAY at 22:00:
IF: Daily COP above 3.5
  AND Average outdoor temperature < -5°C
THEN: Log as "Excellent performance in cold weather"
```

#### Configuration Tips

**Understanding Daily COP**:
- Smooths out short-term fluctuations
- Better indicator of overall system health
- Less sensitive to defrost cycles than real-time COP

**Typical Daily Values**:
- Winter (< 0°C): 2.5-3.5
- Spring/Fall (5-15°C): 3.5-4.5
- Summer (> 20°C): 4.0-5.0+

#### Technical Details

- **Data Source**: `adlar_cop_daily` capability
- **Calculation**: RollingCOPCalculator.getDailyCOP()
- **Update Frequency**: Every 5 minutes
- **Data Points**: Circular buffer of last 1440 points (24 hours @ 1/min)
- **Idle Awareness**: Excludes periods with compressor off

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

#### Smart Behavior

**Long-Term Averaging**:
- 30-day rolling window
- Smooths weather variations
- Best indicator of system efficiency over time

**Data Validation**:
- Returns `false` if monthlyCOP = 0 (insufficient data)
- Requires multiple days of operation for reliable average

#### Example Flows

**Monthly Report**:
```
EVERY 1st day of month at 09:00:
IF: Monthly COP above 3.5
THEN: Send notification "Excellent monthly efficiency: {{adlar_cop_monthly}}"
  AND Calculate estimated costs
  AND Compare to previous months
```

**Seasonal Optimization**:
```
EVERY MONTH:
IF: Monthly COP below 3.0
  AND Season is Winter
THEN: Review system settings
  AND Consider insulation improvements
  AND Send efficiency tips
```

**Predictive Maintenance**:
```
EVERY MONTH:
IF: Monthly COP dropped by > 10% vs last month
THEN: Send alert "Efficiency declining"
  AND Recommend filter check
  AND Schedule professional inspection
```

#### Configuration Tips

**Seasonal Expectations**:
- Heating Season (Oct-Apr): Target > 3.0
- Shoulder Seasons (Mar-May, Sep-Oct): Target > 4.0
- Cooling Season (Jun-Aug): Target > 4.5

**Trend Analysis**:
- Track monthly COP over time
- Declining trend may indicate:
  - System aging
  - Need for maintenance
  - Refrigerant loss
  - Component failure

#### Technical Details

- **Data Source**: `adlar_cop_monthly` capability
- **Calculation**: RollingCOPCalculator.getMonthlyCOP()
- **Update Frequency**: Every 5 minutes
- **Data Points**: 30-day circular buffer
- **Weighting**: Runtime-weighted average

---

### 7. ✅ Temperature Differential

**ID**: `temperature_differential`
**Category**: System Health
**Status**: ✅ **Production-ready since v0.99** (verified in v1.0.7)

#### Configuration

```yaml
IF: Temperature differential is above/below [differential]°C
```

**Parameters**:
- `differential` (1-50°C): Temperature difference threshold
  - Typical: 5-10°C for efficient operation
  - Too low (< 3°C): Poor heat transfer
  - Too high (> 15°C): Possible flow issues

#### Smart Behavior

**Null-Safe Calculation**:
- Falls back to 0°C if sensor unavailable
- Logs fallback usage for debugging
- Prevents flow errors from missing data

**Bidirectional Check**:
- Uses `Math.abs(inlet - outlet)`
- Works regardless of flow direction
- Suitable for both heating and cooling modes

#### Example Flows

**Heat Transfer Efficiency**:
```
IF: Temperature differential below 3°C
  AND Compressor is running
THEN: Send notification "Poor heat transfer detected"
  AND Check water flow rate
  AND Verify pump operation
```

**Ideal Operating Point**:
```
IF: Temperature differential between 5°C and 10°C
  AND Power consumption < 3000W
THEN: Log as "Ideal efficiency point"
```

**Flow Problem Detection**:
```
IF: Temperature differential above 15°C
  AND Water flow below 20 L/min
THEN: Send alert "Possible flow restriction"
  AND Recommend filter check
```

#### Technical Details

- **Calculation**: `Math.abs(temp_top - temp_bottom)`
- **Sensors**: `measure_temperature.temp_top`, `measure_temperature.temp_bottom`
- **Null Handling**: Defaults to 0 with debug logging
- **Update Frequency**: Every DPS update (~10 seconds)

---

## Actions

### 8. 🕐 Calculate Value from Time Schedule

**ID**: `calculate_time_based_value`
**Category**: Time-Based Automation
**Purpose**: Evaluate current time against daily schedules to calculate output values

#### Overview

The time schedule calculator enables **time-of-day programming** for automated temperature schedules, time-of-use optimization, and daily routines. Unlike curve-based calculations, this uses time ranges to determine output values.

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

**Evaluation Rules**:
1. Evaluates from **top to bottom**
2. Returns **first matching** time range
3. Falls back to `default` if no match

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

**Hot Water Schedule**:
```
EVERY 30 MINUTES:
THEN: Calculate value from time schedule
      Schedule: 06:00-09:00: 60, 17:00-23:00: 55, default: 45
  AND Set hot water temperature to {{result_value}}°C
```

**Weekend vs Weekday**:
```
IF: Day is Saturday or Sunday
THEN: Use weekend schedule: 08:00-12:00: 22, 12:00-20:00: 21, default: 19
ELSE: Use weekday schedule: 06:00-09:00: 22, 09:00-17:00: 19, default: 20
```

**Overnight Range Example**:
```
EVERY 15 MINUTES:
THEN: Calculate comfort level
      Schedule: 23:00-06:00: 18, 06:00-23:00: 21
  AND Adjust heating to {{result_value}}°C
```

#### Best Practices

**✅ DO**:
- Always include `default: <value>` as fallback
- Use 24-hour format (HH:MM)
- Test overnight ranges carefully (23:00-06:00)
- Keep schedules under 20 entries for readability
- Document time zones if relevant

**⚠️ DON'T**:
- Exceed 30 time ranges (hard limit)
- Forget default fallback (causes errors)
- Use overlapping time ranges (first match wins)
- Mix 12-hour and 24-hour formats

#### Error Messages

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `"Invalid schedule syntax at line N"` | Malformed time range | Use format: `HH:MM-HH:MM: value` |
| `"Invalid time component at line N"` | Hour/minute out of range | Hours: 0-23, Minutes: 0-59 |
| `"Schedule exceeds maximum entries (30)"` | Too many ranges | Simplify schedule or use multiple flows |
| `"No matching time range found for current time"` | No match and no default | Add `default: <value>` as last line |
| `"Invalid output value at line N"` | Non-numeric output | Output must be valid number |

#### Technical Details

- **Implementation**: `lib/time-schedule-calculator.ts` - TimeScheduleCalculator utility class
- **Registration**: `app.ts` - registerTimeScheduleCard()
- **Update Frequency**: Evaluates on-demand (use timer-based flows)
- **Overnight Logic**: `isOvernight = endMinutes <= startMinutes`
- **Performance**: ~1ms parsing time for typical 10-range schedule
- **Thread-Safe**: Stateless utility class

#### Troubleshooting

**Problem**: "No matching time range" error despite valid time

**Solution**: Add `default: <value>` as last line in schedule

**Problem**: Overnight range (23:00-06:00) not working correctly

**Solution**:
1. Verify end time is earlier than start time (triggers overnight mode)
2. Test at boundary times (22:59, 23:00, 06:00, 06:01)
3. Check for overlapping ranges

**Problem**: Schedule works initially but stops after time

**Solution**: Time schedule needs periodic re-evaluation. Use timer trigger (every 5-15 minutes)

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

**Combined with Time Schedule**:
```
EVERY 15 MINUTES:
THEN: Get seasonal mode
  AND IF {{is_heating_season}} is true
    THEN: Use winter schedule: 06:00-09:00: 22, 09:00-17:00: 19, default: 18
    ELSE: Use summer schedule: 06:00-09:00: 20, 09:00-17:00: 18, default: 16
```

**Season Change Notification**:
```
EVERY DAY at 09:00:
THEN: Get seasonal mode
  AND IF {{days_until_season_change}} < 7
    THEN: Send notification "Season changes in {{days_until_season_change}} days"
```

**Weather + Season Optimization**:
```
WHEN: Outdoor temperature changed
THEN: Get seasonal mode
  AND IF {{mode}} is "heating"
    THEN: Calculate from curve: < 0 : 55, < 5 : 50, < 10 : 45, default : 40
    ELSE: Calculate from curve: > 25 : 18, > 20 : 20, default : 22
  AND Set target temperature to {{result_value}}
```

**Maintenance Scheduling**:
```
EVERY WEEK:
THEN: Get seasonal mode
  AND IF {{is_heating_season}} is true
    AND {{days_until_season_change}} < 30
    THEN: Send notification "Schedule pre-summer maintenance"
```

#### Use Cases

1. **Automatic Schedule Switching**: Different temperatures for winter/summer
2. **Energy Management**: Seasonal power limits and optimization
3. **Maintenance Planning**: Pre-season service reminders
4. **Hot Water Control**: Seasonal hot water temperature adjustment
5. **Flow Card Logic**: Season-aware automation rules

#### Best Practices

**✅ DO**:
- Use daily or periodic checks (not continuous polling)
- Combine with time schedules for comprehensive automation
- Set up pre-season notifications (7-14 days before change)
- Test flows before season boundaries (around May 15 and Oct 1)

**⚠️ DON'T**:
- Poll every minute (once per day is sufficient)
- Assume calendar year = heating season (spans Oct-May)
- Forget leap years (calculator handles automatically)

#### Technical Details

- **Implementation**: `lib/seasonal-mode-calculator.ts` - SeasonalModeCalculator utility class
- **Registration**: `app.ts` - registerSeasonalModeCard()
- **Heating Season**: Oct 1 (month 10, day 1) to May 15 (month 5, day 15)
- **Cooling Season**: Inverse of heating season
- **Day Calculation**: Accounts for year boundaries and leap years
- **Performance**: <1ms calculation time
- **Thread-Safe**: Stateless utility class

#### Season Boundary Behavior

**May 15 → May 16 Transition**:
- May 15 23:59: `is_heating_season = true`, `days_until_season_change = 0`
- May 16 00:00: `is_cooling_season = true`, `days_until_season_change = 138`

**September 30 → October 1 Transition**:
- Sep 30 23:59: `is_cooling_season = true`, `days_until_season_change = 0`
- Oct 1 00:00: `is_heating_season = true`, `days_until_season_change = 227`

#### Troubleshooting

**Problem**: Season doesn't match local climate

**Solution**:
- EN 14825 standard is European-focused
- For other regions, use curve calculator with local date ranges
- Consider creating custom logic based on `{{mode}}` token

**Problem**: `days_until_season_change` shows unexpected value

**Solution**:
1. Check current date is correct on Homey
2. Verify timezone settings
3. Remember: Calculation uses UTC date internally

**Problem**: Flow doesn't trigger at season boundary

**Solution**: Set up daily check flow (e.g., 00:00) to detect season changes

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

- `input_value` (number or expression): The input value to evaluate. Accepts:
  - Direct numbers: `5.2`, `-10`, `20.5`
  - Token expressions: `{{ outdoor_temperature }}`, `{{ logic|temperature }}`
  - Calculated expressions: `{{ outdoor_temperature + 2 }}`, `{{ ambient_temp - 5 }}`
- `curve` (text): Curve definition string (comma or newline separated)

**Returns**:

- `result_value` (number): Calculated output value based on curve

#### Curve Format

**Syntax**: `[operator] threshold : output_value`

**Supported Operators**:

- `>` - Greater than
- `>=` - Greater than or equal (default if no operator specified)
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


**Visual Example**: The curve calculator with a 14-point weather compensation curve applied in real-time:

![Curve Calculator Example](../images/Curve%20calculator.png)

This screenshot demonstrates:
- **Input value**: Current outdoor temperature (-10°C)
- **Curve definition**: 14 progressive thresholds from -18°C to +18°C
- **Output value**: Calculated heating setpoint (28°C)
- **Live timeline**: Real-world results at different temperatures

*Real-world example: Weather-compensated heating with 14-point curve and live timeline results*

```
WHEN: Outdoor temperature changed
THEN: Calculate value from curve
      Input: {{outdoor_temperature}}
      Curve: < -5 : 60, < 0 : 55, < 5 : 50, < 10 : 45, < 15 : 40, default : 35
  AND Set target temperature to {{result_value}}
```

**Time-Based Hot Water Optimization**:
```
EVERY HOUR:
THEN: Calculate value from curve
      Input: {{current_hour}}
      Curve: >= 22 : 45, >= 18 : 55, >= 6 : 60, default : 45
  AND Set hot water temperature to {{result_value}}
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

**Peak Hours Power Limiting**:
```
WHEN: Current hour changed
THEN: Calculate value from curve
      Input: {{current_hour}}
      Curve: >= 17 < 21 : 3000, default : 4500
  AND Set maximum power limit to {{result_value}}W
```

#### Advanced Techniques

**Nested Calculations** (Calculate intermediate values):
```
WHEN: Outdoor temperature changed
THEN: Calculate outdoor adjustment
      Input: {{outdoor_temp}}
      Curve: < 0 : 10, < 10 : 5, default : 0
  AND Calculate COP adjustment
      Input: {{adlar_cop}}
      Curve: < 2.5 : -3, >= 3.5 : +2, default : 0
  AND Set target = base_temp + outdoor_adj + cop_adj
```

**Seasonal Curves** (Use different curves per season):
```
IF: Month is between October and March (heating season)
THEN: Use winter curve: < 0 : 55, < 5 : 50, default : 45
ELSE: Use summer curve: >= 25 : 50, >= 20 : 55, default : 60
```

**Hysteresis Implementation** (Prevent oscillation):
```
WHEN: Temperature changed
  AND Temperature rising
THEN: Use curve: > 25 : off, > 20 : low, default : high
WHEN: Temperature changed
  AND Temperature falling
THEN: Use curve: < 22 : high, < 18 : low, default : off
```

#### Best Practices

**✅ DO**:

- Always add `default : <value>` as last line (prevents errors)
- Use newlines or commas to separate rules (both supported)
- Test your curve with different inputs before deploying
- Keep curves simple (under 20 entries recommended)
- Document your curve logic in flow description
- Use consistent operator direction (all `<` or all `>`)

**⚠️ DON'T**:

- Exceed 50 entries (hard limit)
- Forget the default fallback (causes errors on no match)
- Mix heating/cooling logic in same curve (use separate flows)
- Use complex operators when simple ones suffice
- Ignore evaluation order (top to bottom matters!)

#### Error Messages

The calculator provides user-friendly error messages:

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `"Input value must be a valid number"` | Invalid input tag or null value | Check your input token/variable |
| `"No matching curve condition found for input value: X"` | No condition matched and no default | Add `default : <value>` as last line |
| `"Invalid curve syntax at line N"` | Malformed condition (e.g., missing colon) | Check format: `operator threshold : value` |
| `"Curve exceeds maximum allowed entries (50)"` | Too many lines in curve | Simplify your curve or split into multiple flows |
| `"Unsupported operator at line N"` | Unknown operator used | Use only: >, >=, <, <=, ==, !=, default |
| `"Invalid output value at line N"` | Non-numeric output value | Output must be valid number |

#### Technical Details

- **Implementation**: `lib/curve-calculator.ts` - CurveCalculator utility class
- **Registration**: `app.ts:367` - registerCurveCalculatorCard()
- **Parsing**: Regex-based with comprehensive validation
- **Performance**: ~1ms parsing time for typical 10-entry curve
- **Memory**: ~100 bytes per curve entry (5KB max for 50 entries)
- **Thread-Safe**: Stateless utility class (no shared state)

**Validation System**:
```typescript
// Example: Validate curve before using
const result = CurveCalculator.validateCurve(userInput);
if (!result.valid) {
  // Show errors: result.errors
}
```

**Safe Evaluation** (with fallback):
```typescript
// Never throws, returns fallback on error
const value = CurveCalculator.evaluateWithFallback(input, curve, defaultValue);
```

#### Common Issues

**Problem**: Flow card not visible in actions

**Solution**:

1. Check app version is 1.0.8 or higher
2. Restart Homey app
3. Check device is available (not offline)

**Problem**: "No matching curve condition" error

**Solution**: Add `default : <value>` as last line in your curve

**Problem**: Curve calculates wrong values

**Solution**:

1. Test curve order - rules evaluate top to bottom
2. Check operator direction (< vs >)
3. Verify threshold values are correct
4. Use debug flow to log input and output

**Problem**: "Invalid curve syntax" error

**Solution**:

1. Check format: `[operator] threshold : output`
2. Ensure colon (`:`) separates condition from value
3. Use comma (`,`) or newline between entries
4. Remove trailing commas

**Problem**: Curve works initially but stops after Homey restart

**Solution**: Curves are stateless (no memory). Check if input token is still valid.

#### Example: Complete Weather-Compensation System

**Reference Implementation**: The screenshot above shows a production-ready 14-point weather compensation curve:

- **Temperature range**: -18°C to +18°C
- **Heating range**: 20°C (warm) to 35°C (extreme cold)
- **Curve logic**: `> 18 : 20, > 15 : 23, > 12 : 24, ... > -18 : 30, default: 35`
- **Timeline results**: Real-world calculations shown (28°C for -10°C outdoor, 35°C for -19°C outdoor)

**Multi-Flow Integration Pattern**:

```
─────────── FLOW 1: Update Heating Setpoint ───────────
WHEN: Outdoor temperature changed
THEN: Calculate heating setpoint
      Input: {{outdoor_temperature}}
      Curve: < -5 : 60, < 0 : 55, < 5 : 50, < 10 : 45, default : 40
  AND Store in variable: calculated_setpoint
  AND Log: "Outdoor {{outdoor_temp}}°C → Setpoint {{result_value}}°C"

─────────── FLOW 2: Apply Setpoint with Hysteresis ─────
WHEN: Variable calculated_setpoint changed
  AND |calculated_setpoint - current_target| > 2°C
THEN: Set target temperature to {{calculated_setpoint}}
  AND Send notification: "Heating adjusted to {{calculated_setpoint}}°C"

─────────── FLOW 3: COP-Based Fine-Tuning ─────────────
WHEN: COP below 2.5
  AND Running for > 30 minutes
THEN: Calculate adjustment
      Input: {{adlar_cop}}
      Curve: < 2.0 : -3, < 2.5 : -2, default : 0
  AND Reduce target by {{result_value}}°C
  AND Log: "Low COP {{adlar_cop}} → Reduced setpoint by {{result_value}}°C"
```

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

**Reset milestone tracking**:
```javascript
// Delete storage key: triggered_energy_milestones
// Next milestone will retrigger from zero
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

## Version History

**v1.0.7** (2025-10-24):
- ✅ Implemented `fault_detected` trigger
- ✅ Implemented `power_threshold_exceeded` trigger
- ✅ Implemented `total_consumption_milestone` trigger
- ✅ Implemented `cop_efficiency_check` condition
- ✅ Implemented `daily_cop_above_threshold` condition
- ✅ Implemented `monthly_cop_above_threshold` condition
- ✅ Verified `temperature_differential` condition production-ready

**Coming in Future Versions**:
- Pattern-based temperature change triggers
- COP trend analysis condition
- Daily consumption threshold trigger
- Fault cleared trigger (separate from fault_detected)

---

## Support

For issues or questions:
1. Check this guide's troubleshooting section
2. Enable debug mode and check logs
3. Report issues on GitHub: [org.hhi.adlar-heatpump/issues](https://github.com/HHi-Homey/org.hhi.adlar-heatpump/issues)

**Debug Mode**:
```bash
# Enable debug logging
export DEBUG=1
homey app restart
homey app log
```
