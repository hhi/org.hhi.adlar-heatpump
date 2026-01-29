# Calculator Utilities - Developer Guide

This document provides comprehensive developer documentation for the three calculator utilities in the Homey app. These are production-ready utilities for dynamic value calculations in flow cards.

## Table of Contents

- [Curve Calculator](#curve-calculator)
- [Time Schedule Calculator](#time-schedule-calculator)
- [Seasonal Mode Calculator](#seasonal-mode-calculator)
- [Integration Patterns](#integration-patterns)

---

## Curve Calculator

**Version**: v1.0.8+, Enhanced v1.3.10

**Purpose**: Production-ready utility for dynamic value calculation based on configurable curves in flow cards.

### Architecture

**Location**: `lib/curve-calculator.ts`
**Registration**: `app.ts:475-514` - `registerCurveCalculatorCard()`
**Flow Card**: `.homeycompose/flow/actions/calculate_curve_value.json`

**Key Features**:

- 6 comparison operators: `>`, `>=`, `<`, `<=`, `==`, `!=`
- Default fallback support (`default` or `*` keyword)
- Maximum 50 entries per curve (abuse prevention)
- Comma or newline separated entries
- **Input flexibility (v1.3.10)**: Accepts direct numbers, token expressions, and calculated expressions
- Comprehensive error handling with user-friendly messages
- Multilingual support (EN/NL/DE/FR)

### Implementation Pattern

**Static Utility Class** (thread-safe, stateless):

```typescript
export class CurveCalculator {
  // Parse curve string into structured entries
  static parseCurve(curveString: string): CurveEntry[];

  // Validate curve without throwing exceptions
  static validateCurve(curveString: string): CurveValidationResult;

  // Evaluate curve for input value (throws on error)
  static evaluate(inputValue: number, curveString: string): number;

  // Safe evaluation with fallback (never throws)
  static evaluateWithFallback(
    inputValue: number,
    curveString: string,
    fallbackValue: number
  ): number;
}
```

### Flow Card Registration

**Registration in `app.ts`** - Enhanced v1.3.10:

```typescript
registerCurveCalculatorCard() {
  const curveCard = this.homey.flow.getActionCard('calculate_curve_value');

  curveCard.registerRunListener(async (args, state) => {
    const { input_value: inputValueRaw, curve } = args;

    // Parse input value (supports number, string, and expressions)
    let inputValue: number;
    if (typeof inputValueRaw === 'number') {
      inputValue = inputValueRaw;
    } else if (typeof inputValueRaw === 'string') {
      inputValue = parseFloat(inputValueRaw);
    } else {
      throw new Error('Input value must be a number or numeric string');
    }

    // Validate parsed number
    if (Number.isNaN(inputValue) || !Number.isFinite(inputValue)) {
      throw new Error(`Input value must be a valid number (received: "${inputValueRaw}")`);
    }

    // Evaluate curve using CurveCalculator utility
    const resultValue = CurveCalculator.evaluate(inputValue, curve);

    // Return result token
    return { result_value: resultValue };
  });
}
```

### Input Format Support (v1.3.10)

The `input_value` field accepts:

- **Direct numbers**: `5.2`, `-10`, `20.5`
- **Token expressions**: `{{ outdoor_temperature }}`, `{{ logic|temperature }}`
- **Calculated expressions**: `{{ outdoor_temperature + 2 }}`, `{{ ambient_temp - 5 }}`

All expressions are evaluated by Homey before reaching the flow card listener, then parsed as numbers using `parseFloat()`.

### Use Cases

#### Primary: Weather-Compensated Heating

**Visual Example**: See `docs/setup/Curve calculator.png` for production implementation with 14-point curve and timeline results.

```text
Outdoor Temp → Heating Setpoint
< -5 : 60, < 0 : 55, < 5 : 50, < 10 : 45, default : 35
```

#### Time-Based Optimization

```text
Hour of Day → Hot Water Temp
>= 22 : 45, >= 18 : 55, >= 6 : 60, default : 45
```

#### COP-Based Dynamic Adjustment

```text
Current COP → Temperature Adjustment
< 2.0 : -5, < 2.5 : -3, >= 3.5 : +2, default : 0
```

### Curve Syntax

**Format**: `[operator] threshold : output_value`

**Evaluation**:

1. Top-to-bottom order (first match wins)
2. Default fallback if no match
3. Maximum 50 entries

**Operators**:

- `>` - Greater than
- `>=` - Greater than or equal (default if omitted)
- `<` - Less than
- `<=` - Less than or equal
- `==` - Equal to
- `!=` - Not equal to
- `default` or `*` - Always matches (use as last line)

### Error Handling

**Production-Ready Error Messages**:

- `"Input value must be a valid number"` - Invalid input
- `"Curve definition cannot be empty"` - Empty curve string
- `"Invalid curve syntax at line N"` - Malformed entry
- `"Unsupported operator at line N"` - Unknown operator
- `"Invalid output value at line N"` - Non-numeric output
- `"Curve exceeds maximum allowed entries (50)"` - Too many entries
- `"No matching curve condition found for input value: X"` - No match and no default

**Error Context**: All errors include line numbers and specific guidance for resolution.

### Performance Characteristics

**Parsing Performance**:

- ~1ms for typical 10-entry curve
- O(n) where n = number of entries
- Regex-based parsing with validation

**Memory Usage**:

- ~100 bytes per curve entry
- 5KB maximum (50 entries × 100 bytes)
- Stateless class (no persistent memory)

**Evaluation Performance**:

- O(n) worst case (evaluates until match)
- O(1) best case (first entry matches)
- Typically <1ms for 10-entry curve

### Best Practices

**✅ DO**:

- Always include `default : <value>` as last line
- Keep curves under 20 entries for readability
- Test curve with representative inputs before deploying
- Use consistent operator direction (`<` or `>`)
- Document curve logic in flow description

**❌ DON'T**:

- Exceed 50 entries (hard limit enforced)
- Mix heating/cooling logic in same curve
- Use complex operators when simple ones suffice
- Forget evaluation order matters (top to bottom)

### Validation Pattern

**Pre-Validation** (recommended for user input):

```typescript
const result = CurveCalculator.validateCurve(userInput);
if (!result.valid) {
  this.error('Curve validation failed:', result.errors);
  return;
}
// Safe to use validated curve
const value = CurveCalculator.evaluate(inputValue, userInput);
```

**Safe Evaluation** (with fallback):

```typescript
// Never throws, returns fallback on any error
const value = CurveCalculator.evaluateWithFallback(
  outdoorTemp,
  curve,
  defaultSetpoint // Fallback if curve fails
);
```

### Testing Strategy

**Unit Tests** (recommended):

```typescript
// Test basic evaluation
const result = CurveCalculator.evaluate(5, "< 0 : 55, < 10 : 45, default : 35");
expect(result).toBe(45); // 5 is < 10

// Test default fallback
const result2 = CurveCalculator.evaluate(15, "< 0 : 55, < 10 : 45, default : 35");
expect(result2).toBe(35); // 15 doesn't match, uses default

// Test validation
const validation = CurveCalculator.validateCurve("invalid syntax");
expect(validation.valid).toBe(false);
expect(validation.errors.length).toBeGreaterThan(0);
```

**Integration Tests** (flow card):

1. Create test flow with curve calculator
2. Trigger with known input values
3. Verify `result_value` token is correct
4. Test error scenarios (invalid curve, missing default)
5. Verify multilingual error messages

### Maintenance Notes

**Adding New Operators**:

1. Add to `SUPPORTED_OPERATORS` array
2. Add case to switch statement in `evaluate()`
3. Update regex pattern if needed
4. Update documentation and error messages

**Modifying Entry Limit**:

- Current: `MAX_CURVE_ENTRIES = 50`
- Change in one place, enforced throughout
- Consider memory impact (100 bytes × limit)

**Multilingual Support**:

- Flow card definition: `.homeycompose/flow/actions/calculate_curve_value.json`
- Error messages: Currently English only in `curve-calculator.ts`
- Future: Consider extracting error messages to localization file

### Documentation References

**User Documentation**:

- [README.md](../../README.md#advanced-calculate-value-from-curve) - Lines 147-230
- [FLOW_CARDS_GUIDE.md](../setup/guide/FLOW_CARDS_GUIDE.en.md#10--calculate-value-from-curve) - Comprehensive guide

**Technical Documentation**:

- [lib/curve-calculator.ts](../../lib/curve-calculator.ts) - Implementation
- [app.ts](../../app.ts#L367-L409) - Flow card registration
- [.homeycompose/flow/actions/calculate_curve_value.json](../../.homeycompose/flow/actions/calculate_curve_value.json) - Flow card definition

---

## Time Schedule Calculator

**Version**: v1.2.3+

**Purpose**: Production-ready utility for time-based value calculation using daily schedules.

### Architecture

**Location**: `lib/time-schedule-calculator.ts`
**Registration**: `app.ts:419-457` - `registerTimeScheduleCard()`
**Flow Card**: `.homeycompose/flow/actions/calculate_time_based_value.json`

**Key Features**:

- Time range format: `HH:MM-HH:MM: value`
- Supports overnight ranges (e.g., `23:00-06:00: 18`)
- Default fallback support (`default: value`)
- Maximum 30 entries per schedule (abuse prevention)
- Comma or newline separated entries
- Comprehensive validation with line-specific error messages
- Multilingual support (EN/NL/DE/FR)

### Use Cases

**Daily Temperature Scheduling**:

```text
06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, 23:00-06:00: 18
```

- 07:30 → 22°C (morning comfort)
- 14:00 → 19°C (nobody home)
- 20:00 → 21°C (evening comfort)
- 02:00 → 18°C (night setback)

**Time-of-Use Pricing Optimization**:

```text
00:00-06:00: 45, 06:00-23:00: 55, 23:00-00:00: 45
```

- Night tariff: Lower hot water temperature (45°C)
- Day tariff: Normal temperature (55°C)

**Combined with Seasonal Mode** (recommended):

```
WHEN time is 06:00
AND Get seasonal mode → is_heating_season = true
THEN Calculate time-based value: "06:00-09:00: 22, 09:00-17:00: 19, default: 18"
     Set target_temperature to {{result_value}}
```

### Implementation Pattern

**Static Utility Class** (thread-safe, stateless):

```typescript
export class TimeScheduleCalculator {
  // Parse schedule string into time range entries
  static parseSchedule(scheduleString: string): TimeRangeEntry[];

  // Validate schedule without throwing exceptions
  static validateSchedule(scheduleString: string): ScheduleValidationResult;

  // Evaluate schedule for current/specific time (throws on error)
  static evaluate(scheduleString: string, now?: Date): number;

  // Safe evaluation with fallback (never throws)
  static evaluateWithFallback(
    scheduleString: string,
    fallbackValue: number,
    now?: Date
  ): number;
}
```

### Schedule Syntax

**Format**: `HH:MM-HH:MM: output_value`

**Examples**:

- Normal range: `06:00-09:00: 22` (6 AM to 9 AM)
- Overnight range: `23:00-06:00: 18` (11 PM to 6 AM, spans midnight)
- Default fallback: `default: 20` (covers all unmatched times)

**Validation**:

- Hours: 0-23
- Minutes: 0-59
- Output values: Any valid number (including negatives, decimals)
- Overnight detection: Automatic (end time < start time)

### Error Handling

**Production-Ready Error Messages** (with line numbers):

```text
Invalid schedule syntax at line 2: '25:00-09:00: 22'
Invalid start hour at line 2: 25
Start hour must be between 0 and 23
```

**Common Errors**:

- Empty schedule → `"Schedule definition cannot be empty"`
- Invalid time → `"Invalid start hour at line N: 25"`
- Same start/end → `"Invalid time range: start and end times are identical"`
- No match found → `"No matching time range found for current time: 14:30"`

### Performance

- Parsing: ~1ms for 10-entry schedule
- Evaluation: O(n) worst case, typically <1ms
- Memory: ~100 bytes per entry, 3KB maximum (30 entries)

---

## Seasonal Mode Calculator

**Version**: v1.2.3+

**Purpose**: Automatic seasonal mode determination based on heating season dates (Oct 1 - May 15).

### Architecture

**Location**: `lib/seasonal-mode-calculator.ts`
**Registration**: `app.ts:465-503` - `registerSeasonalModeCard()`
**Flow Card**: `.homeycompose/flow/actions/get_seasonal_mode.json`

**Key Features**:

- Heating season: October 1 - May 15 (aligned with EN 14825 SCOP standard)
- Cooling season: May 16 - September 30
- Returns 4 tokens: `mode`, `is_heating_season`, `is_cooling_season`, `days_until_season_change`
- Integrates with existing SCOP calculation logic
- No user configuration needed (fixed dates)

### Use Cases

**Automatic Winter/Summer Schedule Switching**:

```
WHEN time is 06:00
AND Get seasonal mode → is_heating_season = true
THEN Time schedule: "06:00-09:00: 22, 09:00-17:00: 19, default: 18"

WHEN time is 06:00
AND Get seasonal mode → is_heating_season = false
THEN Time schedule: "06:00-22:00: 18, default: 16"
```

**Season Change Notification**:

```
WHEN Get seasonal mode → days_until_season_change <= 7
THEN Send notification: "Heating season ends in {{days_until_season_change}} days"
```

**Mode-Based Flow Logic**:

```
IF Get seasonal mode → mode = "heating"
THEN Enable winter heating curves
ELSE Enable summer cooling curves
```

### Implementation Pattern

**Static Utility Class** (thread-safe, stateless):

```typescript
export class SeasonalModeCalculator {
  // Check if date is in heating season
  static isHeatingSeason(date?: Date): boolean;

  // Check if date is in cooling season
  static isCoolingSeason(date?: Date): boolean;

  // Get seasonal mode ('heating' or 'cooling')
  static getSeasonalMode(date?: Date): SeasonalMode;

  // Get comprehensive seasonal information
  static getCurrentSeason(date?: Date): SeasonalModeResult;

  // Check if near season boundary (within N days)
  static isNearSeasonBoundary(date?: Date, daysThreshold?: number): boolean;
}
```

### Flow Card Tokens

**Returned Tokens**:

1. `mode` (string): `"heating"` or `"cooling"`
2. `is_heating_season` (boolean): `true` during Oct 1 - May 15
3. `is_cooling_season` (boolean): `true` during May 16 - Sep 30
4. `days_until_season_change` (number): Days remaining until next season

**Usage in Flows**:

```
Get seasonal mode
→ mode: "heating"
→ is_heating_season: true
→ is_cooling_season: false
→ days_until_season_change: 45
```

### Season Definitions

**Heating Season**: October 1 - May 15 (inclusive)

- Aligns with EN 14825 SCOP calculation period
- Matches existing SCOP calculator logic
- 227 days total (non-leap year)

**Cooling Season**: May 16 - September 30 (inclusive)

- Remainder of the year
- 138 days total (non-leap year)

**Design Rationale**:

- Fixed dates simplify automation (no user configuration)
- European climate optimized (Central Europe heating needs)
- Consistent with energy efficiency standards

### Performance

- Evaluation: O(1) - simple date comparison
- Memory: Stateless, no persistent data
- Performance: <0.1ms per call

---

## Integration Patterns

### Best Practices

**✅ DO**:

- Always include `default: <value>` in time schedules and curves
- Combine calculators for seasonal time schedules
- Test overnight ranges (23:00-06:00) before deployment
- Use seasonal mode for automatic heating/cooling switching
- Keep schedules under 15 entries for readability
- Keep curves under 20 entries for readability

**❌ DON'T**:

- Exceed entry limits (30 for time schedules, 50 for curves)
- Rely on seasonal mode for non-European climates without adjustment
- Forget that overnight ranges span midnight
- Mix heating/cooling logic in single schedule or curve

### Complete Weather-Compensated + Time-Based System

**Example Flow Integration**:

```
// Flow 1: Get outdoor temperature and seasonal mode
WHEN outdoor temperature changes
AND Get seasonal mode → is_heating_season = true
THEN Calculate curve value:
     Input: {{outdoor_temperature}}
     Curve: "< -5: 60, < 0: 55, < 5: 50, < 10: 45, default: 40"
     → Store in variable: base_setpoint

// Flow 2: Apply time-based adjustment
WHEN time is 06:00, 09:00, 17:00, 23:00
THEN Calculate time-based value:
     Schedule: "06:00-09:00: 2, 09:00-17:00: -3, 17:00-23:00: 1, default: -2"
     → Store in variable: time_adjustment

// Flow 3: Apply combined setpoint
WHEN variables change
THEN Set target_temperature: {{base_setpoint}} + {{time_adjustment}}
```

**Result**: Dynamic heating setpoint that adjusts for both outdoor temperature (weather compensation) and time of day (comfort scheduling), only during heating season.

### Common Patterns

**Pattern 1: Weather Compensation with Seasonal Switching**

```typescript
// In flow logic
if (isHeatingSeason) {
  // Winter curve: aggressive heating at low temps
  curve = "< -5: 60, < 0: 55, < 5: 50, < 10: 45, default: 40";
} else {
  // Summer curve: minimal heating
  curve = "> 20: 18, > 15: 20, default: 22";
}
```

**Pattern 2: Time-Based with Override**

```typescript
// Base schedule
schedule = "06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, default: 18";

// Override for special conditions
if (copEfficiency < 2.0) {
  // Lower setpoint if COP is poor
  adjustment = -2;
}
```

**Pattern 3: Cascading Calculations**

```typescript
// Step 1: Base value from weather
baseTemp = CurveCalculator.evaluate(outdoorTemp, weatherCurve);

// Step 2: Time-based adjustment
timeAdjust = TimeScheduleCalculator.evaluate(timeSchedule);

// Step 3: Seasonal modifier
seasonalModifier = SeasonalModeCalculator.isHeatingSeason() ? 1.0 : 0.8;

// Final setpoint
finalSetpoint = (baseTemp + timeAdjust) * seasonalModifier;
```
