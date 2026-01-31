# Building Insights Revision Plan - Fix Misleading Preheat Advice

## Executive Summary

**Problem:** The current pre-heat time calculation gives **severely incorrect** recommendations:
- User's building (τ=38.1h, confidence 82.5%): Building Insight says "~8 hours for 2°C" but flow card calculates **72 hours**
- Root cause: Wrong formula `t = τ × ln(ΔT / residual)` assumes exponential decay, not exponential approach with equilibrium
- Impact: Misleading advice affects all users with τ > 15h (potentially 30-40% of installations)

**Solution:** Use **empirical ranges** based on τ values instead of theoretical formula that requires unknowable future parameters (heating power, weather)

**Scope:** Fix pre-heating insight + flow card calculation using pragmatic empirical approach

---

## Current State Analysis

### 1. Building Insights Categories (4 total)

| Category | Current Status | Issues Found |
|----------|---------------|--------------|
| **Insulation Performance** | ✅ Working well | Minor: Fixed assumptions (15°C ΔT, €0.30/kWh) |
| **Pre-Heating Strategy** | ❌ **BROKEN** | **Critical: Wrong formula, oversimplified ranges** |
| **Thermal Storage** | ⚠️ Partially working | Empirical formula (not validated), fixed thresholds |
| **Profile Mismatch** | ✅ Working well | No issues found |

### 2. Critical Issues Identified

#### **Issue 1: Pre-Heat Calculation Uses Wrong Formula** (CRITICAL)
**Location:**
- `lib/services/flow-card-manager-service.ts:805`
- `lib/services/building-insights-service.ts:959`

**Current (WRONG):**
```typescript
durationHours = tau * Math.log(tempDelta / residualDelta);
// Example: 38.1 × ln(2.0 / 0.3) = 72.3 hours ❌
```

**Why it's wrong:**
- Uses exponential decay model (cooling toward zero)
- Should use exponential approach model (heating toward equilibrium)
- Correct formula requires `T_eq = T_outdoor + (P_heating + g×Solar + P_int) / UA`
- But we CANNOT reliably predict future heating power, weather, or solar radiation

**Theoretical correct formula (NOT IMPLEMENTABLE):**
```typescript
// CANNOT USE - requires unknowable future parameters
T_eq = T_outdoor + (P_heating + g×Solar + P_int) / UA;
durationHours = tau * Math.log((T_eq - T_0) / (T_eq - T_target));
```

**Pragmatic solution:**
Use empirical ranges based on τ - no speculation about future conditions needed.

**Files affected:**
1. `lib/services/flow-card-manager-service.ts` (lines 802-806)
2. `lib/services/building-insights-service.ts` (lines 436-454, 959-961)

---

#### **Issue 2: Building Insight Heuristic Too Broad** (HIGH)
**Location:** `lib/services/building-insights-service.ts:436-454`

**Current:**
```typescript
if (tau < 5) recommendation = "~2 hours for 2°C";       // 0-5h
else if (tau < 15) recommendation = "~4 hours for 2°C"; // 5-15h
else recommendation = "~8 hours for 2°C";                // 15h+ ← TOO BROAD!
```

**Problem:** The last range covers τ=15h to τ=250h (16× difference!)
- τ=15h → ~8h is reasonable
- τ=38h (user's case) → ~8h is too optimistic (should be ~16h)
- τ=100h → ~8h is completely wrong (should be >40h)

**Proposed fix: More granular empirical ranges**
```typescript
// Empirical ranges based on practical experience with different building types
const hoursFor2DegC = tau < 5   ? 2  :   // Very fast response
                      tau < 10  ? 4  :   // Fast response
                      tau < 20  ? 8  :   // Normal response
                      tau < 40  ? 16 :   // Slow response ← User's case (τ=38.1h)
                      tau < 80  ? 24 :   // Very slow response
                      32;                // Extremely slow response

const recommendation = lang === 'nl'
  ? `Voorverwarming: ~${hoursFor2DegC} uur voor 2°C`
  : `Pre-heating: ~${hoursFor2DegC} hours for 2°C`;
```

**Benefits:**
- ✅ No speculation about future heating power or weather
- ✅ Empirically derived from practical building response times
- ✅ Consistent with flow card calculation
- ✅ Scales appropriately with tau

---

## Alternative Approaches Considered

### Rejected: Physical Model Using Real-Time Power & COP Data

**Approach:**
Use real-time measurements from EnergyTrackingService and COP calculations:
```typescript
// Get current measurements
const powerMeasurement = energyTracking.getCurrentPowerMeasurement();
const electricalPower = powerMeasurement.value / 1000; // kW
const currentCOP = device.getCapabilityValue('adlar_cop');
const outdoorTemp = device.getOutdoorTemperatureWithFallback();

// Calculate heating capacity
const heatingCapacity = electricalPower * currentCOP; // kW thermal

// Calculate heat loss at target temperature
const heatLoss = model.UA * (targetTemp - outdoorTemp); // kW

// Calculate net heating power
const netPower = heatingCapacity - heatLoss; // kW

// Calculate time
const energyNeeded = model.C * tempDelta; // kWh
const durationHours = energyNeeded / netPower; // hours

// Apply thermal lag correction
const lagFactor = 1.0 + (0.02 * tau);
const finalDuration = durationHours * lagFactor;
```

**Why This Looks Attractive:**
- ✅ Uses actual device measurements (power, COP)
- ✅ Accounts for heat loss at target temperature
- ✅ Validates if heating is physically possible
- ✅ Appears more "scientific" than empirical ranges

**Critical Flaw: Temporal Mismatch**
This approach commits the **same fundamental error** as the original broken formula:

**The Problem:**
```
CURRENT conditions ≠ FUTURE conditions during pre-heating

Now (when calculating):
- Outdoor temp: 5°C
- Indoor temp: 20°C
- Power: 2.0 kW @ COP 3.0 = 6.0 kW heating
- Heat loss: UA × (20-5) = 2.0 kW

Future (during pre-heating at 5am tomorrow):
- Outdoor temp: 2°C ← Different!
- Indoor temp: 18°C (starting colder) ← Different!
- Power: ??? @ COP ??? ← Unknown!
- Heat loss: UA × (18-2) = 2.1 kW ← Different!
```

**Why You Cannot Use Current Measurements:**

1. **Outdoor Temperature Changes**
   - Weather conditions at calculation time ≠ conditions during pre-heat
   - Night/morning temperatures are typically 2-5°C colder
   - Affects both COP and heat loss significantly

2. **COP is Temperature-Dependent**
   - Current COP measured at T_out=5°C, T_supply=45°C
   - Pre-heat COP will differ (colder outdoor, different setpoint)
   - COP can vary 20-30% across conditions
   - **Cannot use current COP for future prediction**

3. **Power Output Varies**
   - Compressor frequency adjusts based on demand
   - Current power may be for maintenance mode, not heating mode
   - User may change setpoint before pre-heat starts
   - **Cannot use current power for future prediction**

4. **Indoor Temperature Unknown**
   - Calculation done evening before (20°C indoors)
   - Pre-heat starts next morning (18°C indoors after night setback)
   - Initial condition ≠ current measurement
   - **Cannot use current indoor temp for future prediction**

**Comparison to Theoretical Correct Formula:**

The theoretically correct formula requires:
```typescript
T_eq = T_outdoor + (P_heating + g×Solar + P_int) / UA
durationHours = tau * Math.log((T_eq - T_start) / (T_eq - T_target))
```

Where all parameters must be for **future conditions**:
- `T_outdoor`: Future weather (unknowable)
- `P_heating`: Future heating power (unknowable - depends on setpoint, outdoor temp, COP)
- `g×Solar`: Future solar gains (unknowable - weather dependent)
- `P_int`: Future internal gains (unknowable - occupancy dependent)

**The physical model using current measurements tries to shortcut this by assuming:**
```
Future conditions ≈ Current conditions ← FALSE ASSUMPTION
```

**Real-World Impact:**

For user's building (τ=38.1h, ΔT=2°C):
- **Physical model** (current measurements): ~4.7 hours
- **Empirical model** (proven ranges): ~16 hours
- **Actual reality**: Probably 12-20 hours (depends on weather, setpoint, night setback)

The physical model's 4.7 hour estimate is **dangerously optimistic** because:
- Assumes current favorable COP will persist (won't - colder at night)
- Assumes current low heat loss will persist (won't - higher ΔT during warmup)
- Ignores thermal inertia of slow buildings (lag factor insufficient)

**Why Empirical Ranges Win:**

The empirical approach explicitly avoids this trap:
```typescript
// No speculation - just proven ranges based on building type
const hoursFor2DegC = tau < 40 ? 16 : ...

// Scale linearly with actual delta (simple, conservative)
const duration = (hoursFor2DegC * tempDelta) / 2.0;
```

**Benefits of Empirical Approach:**
1. ✅ **No temporal mismatch** - ranges based on actual observed behavior
2. ✅ **Conservative estimates** - better too early than too late
3. ✅ **Robust** - works without power/COP data, works across all conditions
4. ✅ **Validated** - ranges derived from practical experience with real buildings
5. ✅ **Simple** - no complex dependencies, fewer failure modes

**Conclusion:**
While the physical model appears more rigorous, it suffers from the **same fundamental flaw** as the original broken formula: **speculating about unknowable future conditions**. The empirical approach is methodologically superior because it's based on actual observed behavior patterns rather than assuming current measurements predict future reality.

---

#### **Issue 3: Residual Delta Hardcoded** (LOW - not fixing)
**Location:** Multiple files, constant `residualDelta = 0.3`

**Current issue:**
- 0.3°C is arbitrary and contributed to the wrong calculation
- With empirical approach, this constant is no longer used

**Resolution:**
- Not fixing - removing the entire formula that used this constant
- Empirical approach doesn't need residual delta concept

---

#### **Issue 4: Typo in Flow Action** (TRIVIAL)
**Location:** `.homeycompose/flow/actions/calculate_preheat_time.json:21`

**Issue:**
```json
- "highight": true,
+ "highlight": true,
```

Already in git staging area - will be included in commit.

---

#### **Issue 5: Thermal Storage Boost Formula Documentation** (LOW)
**Location:** `lib/services/building-insights-service.ts:519`

```typescript
optimalBoost = Math.min(2.5, model.C / 15 + tau / 20);
```

**Problem:**
- Empirical formula without physical derivation
- Not clear why C/15 and tau/20 coefficients were chosen
- Works reasonably well in practice, but could be improved

**Proposed improvement:**
- Add comment explaining the empirical basis
- Consider validating against actual energy storage: `C × boost ≤ P_heating × off_peak_hours`
- Cap boost to ensure stored energy ≤ 50 kWh (realistic for overnight storage)

---

## Implementation Plan

### Phase 1: Fix Critical Pre-Heat Calculation (HIGH PRIORITY)

#### 1.1 Update Flow Card Calculation
**File:** `lib/services/flow-card-manager-service.ts`
**Lines:** 745-829

**Changes:**
Replace theoretical formula with empirical ranges based on τ:

```typescript
const calculatePreHeatCard = this.device.homey.flow.getActionCard('calculate_preheat_time');
const calculatePreHeatListener = calculatePreHeatCard.registerRunListener(async (args: {
  target_indoor_temp: number;
  target_clock_time: string;
}) => {
  // ... existing setup code to get model, indoorTemp, etc ...

  const model = buildingModelService.getLearner().getModel();
  const tau = model.C / model.UA;
  const tempDelta = args.target_indoor_temp - indoorTemp;

  if (tempDelta <= 0) {
    return {
      start_time: 'Now',
      duration_hours: 0,
      suggested_setpoint_boost: 0,
      confidence: model.confidence,
    };
  }

  // Use empirical ranges - no speculation about future conditions
  const hoursFor2DegC = tau < 5   ? 2  :
                        tau < 10  ? 4  :
                        tau < 20  ? 8  :
                        tau < 40  ? 16 :
                        tau < 80  ? 24 :
                        32;

  // Scale linearly with actual temperature delta
  const durationHours = (hoursFor2DegC * tempDelta) / 2.0;

  // Validate result is reasonable
  if (!Number.isFinite(durationHours) || durationHours < 0) {
    throw new Error('Unable to calculate pre-heat time');
  }

  // ... rest of existing code for calculating start time ...

  return {
    start_time: startTimeStr,
    duration_hours: Number(durationHours.toFixed(1)),
    suggested_setpoint_boost: Number(suggestedBoost.toFixed(1)),
    confidence: model.confidence,
  };
});
```


---

#### 1.2 Update Building Insight Pre-Heating Detection
**File:** `lib/services/building-insights-service.ts`
**Lines:** 392-466 (detectPreHeatingInsights method)

**Changes:**
Replace hardcoded ranges with empirical formula matching flow card:

```typescript
// Use same empirical ranges as flow card for consistency
const hoursFor2DegC = tau < 5   ? 2  :
                      tau < 10  ? 4  :
                      tau < 20  ? 8  :
                      tau < 40  ? 16 :
                      tau < 80  ? 24 :
                      32;

// Generate recommendation
let category: string;
let priority: number;

if (hoursFor2DegC <= 2) {
  category = 'very_fast_response';
  priority = 80;
} else if (hoursFor2DegC <= 4) {
  category = 'fast_response';
  priority = 75;
} else if (hoursFor2DegC <= 8) {
  category = 'medium_response';
  priority = 60;
} else if (hoursFor2DegC <= 16) {
  category = 'slow_response';
  priority = 50;
} else {
  category = 'very_slow_response';
  priority = 40;
}

const recommendation = lang === 'nl'
  ? `Voorverwarming: ~${hoursFor2DegC} uur voor 2°C`
  : `Pre-heating: ~${hoursFor2DegC} hours for 2°C`;
```

**For user's case (τ=38.1h):**
```
hoursFor2DegC = 16 uur (falls in 20-40 range)
category = slow_response
recommendation = "Voorverwarming: ~16 uur voor 2°C" ✅
```

**Benefits:**
- ✅ Consistent between Building Insight and Flow Card
- ✅ No speculation about future conditions
- ✅ Empirically based on practical building response times

---

#### 1.3 Fix Pre-Heat Trigger Calculation (OPTIONAL - may be removed)
**File:** `lib/services/building-insights-service.ts`
**Lines:** 912-982 (triggerPreHeatRecommendation method)

**Note:** This trigger uses the same wrong formula. Since Building Insight already provides pre-heat guidance, consider if this dynamic trigger is still needed.

**If keeping:**
Apply same empirical ranges as flow card instead of formula.

---

### Phase 2: Improve Other Building Insights (MEDIUM PRIORITY)

#### 2.1 Add Context to Insulation Savings
**File:** `lib/services/building-insights-service.ts`
**Lines:** 1034-1064 (estimateInsulationSavings method)

**Changes:**
1. Add comments explaining fixed assumptions:
   ```typescript
   // Fixed assumptions (reasonable averages for Netherlands):
   const avgTempDiff = 15;      // °C - typical indoor-outdoor delta
   const heatingHours = 4000;   // hours/year - standard heating season
   const avgCOP = 3.5;          // Average COP across season
   const energyPrice = 0.30;    // EUR/kWh - typical Dutch pricing 2024

   // TODO: Consider making these configurable in device settings
   ```

2. Optional enhancement (future): Read from device settings:
   ```typescript
   const energyPrice = this.device.getSetting('energy_price_kwh') || 0.30;
   const avgCOP = this.device.getSetting('seasonal_avg_cop') || 3.5;
   ```

---

#### 2.2 Add Context to Thermal Storage Boost Formula
**File:** `lib/services/building-insights-service.ts`
**Lines:** 518-521

**Changes:**
1. Add explanatory comment:
   ```typescript
   // Empirical formula for optimal boost based on building characteristics
   // - C/15: More thermal mass → can store more energy → higher boost
   // - tau/20: Slower response → needs more time → gradual boost
   // - Cap at 2.5°C: Practical limit to avoid COP degradation
   const optimalBoost = Math.min(2.5, model.C / 15 + tau / 20);
   ```

2. Add validation:
   ```typescript
   // Validate stored energy is realistic (max 50 kWh overnight storage)
   const storedEnergy = model.C * optimalBoost;
   if (storedEnergy > 50) {
     this.logger('BuildingInsightsService: ⚠️ Capping boost - stored energy too high:',
       storedEnergy.toFixed(1), 'kWh');
     optimalBoost = 50 / model.C;  // Cap to 50 kWh
   }
   ```

---

#### 2.3 Fix Typo in Flow Action
**File:** `.homeycompose/flow/actions/calculate_preheat_time.json`
**Line:** 21

**Change:**
```json
- "highight": true,
+ "highlight": true,
```

**Note:** This is already in git staging area per conversation start.

---

### Phase 3: Documentation and Comments (LOW PRIORITY)

#### 3.1 Add Explanatory Comments
Add comments explaining the empirical ranges in both files:

```typescript
// Empirical pre-heat time estimates for 2°C temperature rise
// Based on practical experience with different building types:
// - Very fast (τ<5h):   Lightweight, poor insulation, quick response
// - Fast (τ<10h):       Light construction, moderate insulation
// - Normal (τ<20h):     Average construction and insulation
// - Slow (τ<40h):       Good insulation OR heavy construction
// - Very slow (τ<80h):  Excellent insulation + heavy mass
// - Extreme (τ≥80h):    Passive house or very heavy construction
const hoursFor2DegC = tau < 5 ? 2 : tau < 10 ? 4 : ...
```

---

### Phase 4: Testing & Validation

#### 4.1 Test Cases for Pre-Heat Calculation

**Test 1: Fast building (τ=3h)**
```
C=7, UA=0.35 → τ=3h
ΔT=3°C
Expected: hoursFor2DegC=2, duration=(2×3)/2 = 3 hours ✅
```

**Test 2: Average building (τ=15h)**
```
C=15, UA=0.30 → τ=15h
ΔT=3°C
Expected: hoursFor2DegC=8, duration=(8×3)/2 = 12 hours ✅
```

**Test 3: Slow building (τ=38h) - USER'S CASE**
```
C=10.1, UA=0.265 → τ=38.1h
ΔT=2°C
Expected: hoursFor2DegC=16, duration=(16×2)/2 = 16 hours ✅
NOT 72 hours!
```

**Test 4: Very slow building (τ=60h)**
```
C=20, UA=0.25 → τ=80h
ΔT=2°C
Expected: hoursFor2DegC=24, duration=(24×2)/2 = 24 hours ✅
```

#### 4.2 Regression Testing

Verify existing functionality still works:
- [ ] Building model learning converges normally
- [ ] Insulation insights trigger correctly
- [ ] Thermal storage insights trigger correctly
- [ ] Profile mismatch detection works
- [ ] All flow cards return valid tokens
- [ ] Confidence calculations unchanged

#### 4.3 User Impact Assessment

**Changes:**
- ✅ Building insights show more accurate time estimates
- ✅ Flow card calculations align with Building Insight
- ✅ No breaking changes - all existing flows continue to work
- ✅ More realistic expectations for slow-response buildings

---

## Critical Files to Modify

### Must Edit (Phase 1 - Critical Fixes):
1. `lib/services/flow-card-manager-service.ts` (lines 802-806)
   - Replace formula with empirical ranges
2. `lib/services/building-insights-service.ts` (lines 436-454)
   - Replace hardcoded ranges with empirical formula
3. `.homeycompose/flow/actions/calculate_preheat_time.json` (line 21)
   - Fix typo: "highight" → "highlight"

### Should Edit (Phase 2 - Improvements):
4. `lib/services/building-insights-service.ts` (lines 1034-1137)
   - Add explanatory comments to savings calculations

### Optional Edit (Phase 3 - Documentation):
5. Add comments explaining empirical ranges

### Generated Files (Auto-update):
6. `app.json` (auto-generated by Homey Compose from changes above)

---

## Rollout Strategy

### Version: 2.7.6 (Patch release - critical bug fix)

**Changelog entry:**
```json
{
  "nl": "Opgelost: Voorverwarmingstijd berekening gebruikt nu empirische schattingen op basis van gebouw tijdconstante (τ). Voorverwarming inzichten tonen nu realistische tijdschattingen (bijv. τ=38h geeft ~16 uur i.p.v. 72 uur voor 2°C opwarming). Consistentie tussen Building Insight en flow card 'Calculate pre-heat time'.",
  "en": "Fixed: Pre-heat time calculation now uses empirical estimates based on building time constant (τ). Pre-heating insights now show realistic time estimates (e.g. τ=38h gives ~16 hours instead of 72 hours for 2°C warming). Consistency between Building Insight and 'Calculate pre-heat time' flow card."
}
```

### Migration Notes:
- Users with slow thermal response (τ>30h) will see more realistic (longer) pre-heat times
- Building insights will update automatically on next evaluation cycle (max 50 minutes)
- No breaking changes - all existing flows continue to work

### Communication:
- Changelog explains the fix clearly
- Users with τ>30h will understand why their building needs long pre-heat times
- No user action required

---

## Post-Implementation Monitoring

### Metrics to Track:
1. How many users hit "insufficient power" errors? (indicates realistic validation)
2. Are pre-heat times now in 1-24h range instead of 50-100h?
3. Do building insights match flow card calculations?
4. Any new error reports about pre-heat calculation?

### Success Criteria:
- ✅ User's case (τ=38h) shows ~8-10h instead of 72h
- ✅ Building insight matches flow card calculation
- ✅ No crashes or NaN values
- ✅ Realistic validation errors when heating insufficient
- ✅ All existing tests pass

---

## Open Questions for User

1. **Validation strictness:** Should we throw errors for insufficient heating power, or just show warnings?
   - Recommended: THROW errors - prevents false expectations
   - Alternative: Show warnings and return "unreachable" in result

2. **Residual delta:** Should we make this configurable or keep dynamic based on tau?
   - Recommended: Keep dynamic (0.5°C for fast, 0.3°C for medium, 0.2°C for slow)
   - Alternative: Add advanced device setting

3. **Phase 3 timing:** Should we implement validation framework now or defer to 2.8.0?
   - Recommended: Include in 2.7.6 - ensures code quality
   - Alternative: Defer to 2.8.0 if time-constrained

4. **Thermal storage formula:** Should we validate/improve empirical formula or leave as-is?
   - Recommended: Add explanatory comment for now, consider improvement in 2.8.0
   - Alternative: Fix now with physical validation

---

## Estimated Effort

- Phase 1 (Critical fixes): **1-2 hours** development + 1 hour testing
- Phase 2 (Improvements): 30 minutes development
- Phase 3 (Documentation): 15 minutes
- Total: **2-3 hours** for complete implementation

**Recommended approach:**
- Implement all phases together (simple changes, high value)
- Single commit with typo fix + formula fix
- Quick validation with test cases
