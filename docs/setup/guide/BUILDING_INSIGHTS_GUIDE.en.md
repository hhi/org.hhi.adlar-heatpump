# Building Insights & Recommendations Guide

**Version**: 2.7.0+ | **Last Updated**: January 2026

---

## Table of Contents

1. [Introduction](#introduction)
2. [What Are Building Insights?](#what-are-building-insights)
3. [How It Works](#how-it-works)
4. [Solar Radiation Sources](#solar-radiation-sources)
5. [Insight Categories](#insight-categories)
6. [Understanding Your Insights](#understanding-your-insights)
7. [Taking Action](#taking-action)
8. [Example Flows](#example-flows)
9. [Settings](#settings)
10. [Troubleshooting](#troubleshooting)
11. [FAQ](#faq)

---

## Introduction

The **Building Insights & Recommendations** feature transforms your heat pump from a simple temperature controller into an intelligent energy advisor. After learning your building's thermal characteristics for 48-72 hours, the system provides **concrete, actionable recommendations** with estimated savings in euros per month.

### Key Benefits

| Benefit | Savings |
|---------|---------|
| 💰 Insulation insights | 10-30% |
| ⏱️ Pre-heating optimization | 5-10% |
| 🏠 Thermal storage strategies | 10-25% (with dynamic pricing) |
| 📊 ROI transparency | Every recommendation includes monthly savings |

---

## What Are Building Insights?

Building Insights analyze the **6 thermal parameters** learned by the Building Model:

| Parameter | Symbol | Meaning | Typical Range |
|-----------|--------|---------|---------------|
| **Thermal Mass** | C | Heat capacity - how much energy needed for 1°C | 7-30 kWh/°C |
| **Heat Loss Coefficient** | UA | Rate of heat loss per degree difference | 0.05-0.5 kW/°C |
| **Time Constant** | τ (tau) | How fast building heats/cools (τ = C/UA) | 5-25 hours |
| **Solar Gain Factor** | g | Effectiveness of solar radiation heating | 0.3-0.6 |
| **Internal Heat Gains** | P_int | Heat from people, appliances, cooking | 0.2-0.5 kW |
| **Wind Correction** | W_corr | Extra heat loss in high wind (v2.7.0+) | 0-50 W/°C |

The system compares learned values with:
- **Your selected building profile** (Light/Average/Heavy/Passive)
- **Typical values for well-insulated buildings**
- **Your energy pricing data** (if available)

When optimization opportunities are detected, it generates **insights** with specific recommendations.

---

## How It Works

### Learning Phase (48-72 Hours)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Data Collection │───▶│Parameter Learning│───▶│ Confidence grows│
│   every 5 min   │    │  RLS algorithm  │    │    0% → 100%    │
└─────────────────┘    └─────────────────┘    └────────┬────────┘
                                                       │
         ┌─────────────────────────────────────────────┘
         ▼
   ┌───────────┐
   │   ≥70%?   │
   └─────┬─────┘
         │
    ┌────┴────┐
    │         │
   Yes        No ──────────────────────────────┐
    │                                          │
    ▼                                          │
┌─────────────────┐                            │
│    Insights     │                            │
│    available    │          ┌─────────────────┘
└─────────────────┘          │
                             ▼
                   (Back to Data Collection)
```

**Data collected:**
- Indoor temperature (external sensor)
- Outdoor temperature (heat pump or external sensor)
- Electrical power
- Estimated solar radiation

**Insight generation:**
- System evaluates every 50 minutes (10 samples)
- Detects patterns: poor insulation, thermal storage potential, pre-heating opportunities
- Generates recommendations with ROI estimates

### Continuous Monitoring

- **Adapts to seasons** (solar gain multipliers, internal heat patterns)
- **Updates insights** when parameter drift >10%
- **Rate limited** to prevent "advice fatigue" (max 1 insight per category per day)

---

## Solar Radiation Sources

The building model uses solar radiation to calculate heat gain through windows. From version 2.7.0, the system supports **three data sources** with automatic priority.

### The Solar Gain Factor (g)

The **g-factor** (0.3-0.6) determines how much incoming solar radiation effectively heats your building:

| g-value | Meaning | Typical Building |
|---------|---------|------------------|
| **0.3** | Low solar gain | Small windows, north-facing |
| **0.45** | Average solar gain | Standard home |
| **0.6** | High solar gain | Large south-facing windows |

**Formula:** `Solar gain (kW) = g × Solar radiation (W/m²) / 1000 × Effective window area`

### Solar Radiation Priority Cascade (v2.7.0)

The system automatically selects the best available source:

```
┌─────────────────────────────────────────────────────────────┐
│  PRIORITY 1: Solar Panels                                  │
│  - Most accurate real-time data                            │
│  - Converted to radiation via: P_panel / Wp × 1000 W/m²   │
│  - Requires: flow card "Receive external solar power"      │
└─────────────────────────────────────────────────────────────┘
                         ↓ (not available)
┌─────────────────────────────────────────────────────────────┐
│  PRIORITY 2: KNMI Radiation Data                            │
│  - Actual measured radiation from weather station           │
│  - Requires: flow card "Receive external solar radiation"   │
│  - Source: e.g., KNMI app or weather station integration    │
└─────────────────────────────────────────────────────────────┘
                         ↓ (not available)
┌─────────────────────────────────────────────────────────────┐
│  PRIORITY 3: Sinusoidal Estimation (fallback)               │
│  - Calculated based on time and date                       │
│  - Uses formula: max(0, sin(π × (hour-6)/12)) × peak       │
│  - Season-dependent peak values (winter 200, summer 800)    │
└─────────────────────────────────────────────────────────────┘
```

### Seasonal Correction (g-multiplier)

The **"Seasonal solar gain (g)"** setting adjusts solar radiation effectiveness per season:

| Month | Multiplier | Reason |
|-------|------------|--------|
| Dec-Feb | 60% | Low winter sun, more clouds |
| Mar, Nov | 80% | Transition periods |
| Apr, Oct | 100% | Reference baseline |
| May, Sep | 120% | Higher sun, better angle |
| Jun-Aug | 130% | Maximum summer radiation |

> [!IMPORTANT]
> **Automatic detection (v2.7.0):** Seasonal correction is **only** applied for estimated radiation (sinusoidal fallback). When using solar panels or KNMI data, the correction is automatically disabled because these sources already include actual seasonal/weather effects.

### Which Source Should I Use?

| Source | Advantages | Disadvantages | Setup |
|--------|------------|---------------|-------|
| **Solar Panels** | Most accurate, real-time | Requires solar panel integration | Flow: solar panel → ADLAR |
| **KNMI** | Measured data, no panels needed | May be 10-60 min delayed | Flow: weather app → ADLAR |
| **Estimation** | No setup needed, always available | Less accurate during clouds | Automatically active |

**Recommendation:** If you have solar panels, forward their power output. Otherwise, the sinusoidal estimation with seasonal correction is sufficiently accurate for most situations.

---

## Insight Categories

The system provides **4 category-specific sensors** (v2.5.10+):

### 1. 🏠 Insulation Performance Insights

**What it detects:**
- High heat loss (UA > expected)
- Excellent insulation (UA < expected)

**Example Insight:**
> "🏠 High heat loss - UA 0.52 kW/°C (expected: 0.30)"

**Example Recommendation:**
> "Consider insulation upgrades: roof (25% savings), walls (15%), windows (10%). Est. savings: €120/month"

**When it triggers:**
- Confidence ≥ 70%
- UA > 1.5× profile UA **OR** UA > 0.5 kW/°C (absolute threshold)

**What to do:**
1. **Verify the measurement** - Check if doors/windows were left open during learning
2. **Prioritize upgrades** - Roof insulation gives highest ROI (25% of total savings)
3. **Get quotes** - Use €120/month estimate to calculate payback period
4. **Implement night setback** - Reduce heat loss during unoccupied hours

---

### 2. ⏱️ Pre-Heating Strategy Insights

**What it detects:**
- Fast thermal response (τ < 5 hours)
- Medium thermal response (τ 5-15 hours)
- Slow thermal response (τ > 15 hours)

**Example Insight (v2.6.0):**
> "Fast (~2 hours for 2°C)" / "Normal (~4 hours for 2°C)" / "Slow (~8 hours for 2°C)"

**Recommendations by type:**

| Response Type | τ | Advice |
|---------------|---|--------|
| Fast | <5h | Stable heating, flexible scheduling possible |
| Normal | 5-15h | Plan 4+ hours ahead for temperature increase |
| Slow | >15h | Continuous heating optimal for heat pump |

---

### 3. 💰 Thermal Storage Optimization Insights

**What it detects:**
- High thermal mass buildings (C > 18 kWh/°C) with slow response (τ > 12h)
- Ability to store energy during cheap hours, coast during expensive hours

**Example Insight (with dynamic pricing):**
> "💰 Thermal storage potential - C=24 kWh/°C, τ=18h"

**Example Recommendation:**
> "Pre-heat +2°C during cheap hours (02:00-06:00), coast -1°C during peak (17:00-21:00). Est. savings: €95/month"

**Example Insight (without dynamic pricing):**
> "💡 Building suitable for thermal storage - C=24 kWh/°C, τ=18h"

**Example Recommendation:**
> "Add dynamic energy prices via flow card 'Receive external energy prices' to enable cost optimization. Potential savings: 15-25%"

**Thermal Storage Calculation:**
```
Stored energy = C × Temp shift = 24 kWh/°C × 2°C = 48 kWh
Daily savings = Stored energy × Price differential × Utilization factor
             = 48 kWh × €0.15/kWh × 0.70 = €5.04/day
Monthly savings = €5.04 × 30 = €151/month
```

---

### 4. 🔄 Building Profile Mismatch (Diagnostic)

**What it detects:**
- Selected building profile doesn't match learned behavior
- >30% deviation in time constant (τ)

**Example Insight:**
> "🔄 Building behaves like 'heavy' (τ=18h vs 'average' τ=10h)"

**Example Recommendation:**
> "Change building profile to 'heavy' in device settings for faster learning and better initial parameters"

**Profile Characteristics:**

| Profile | C (kWh/°C) | UA (kW/°C) | τ (hours) | Building Type |
|---------|-----------|-----------|-----------|---------------|
| **Light** | 7 | 0.35 | 20 | Wood frame, basic insulation, quick temp changes |
| **Average** | 15 | 0.30 | 50 | Brick, cavity walls, double glazing (typical NL) |
| **Heavy** | 20 | 0.25 | 80 | Concrete/stone, good insulation, HR++ glass |
| **Passive** | 30 | 0.05 | 600 | Passive house, HR+++, airtight, heat recovery |

---

## Understanding Your Insights

### Where to Find Them

**Device Capabilities (v2.5.10+)** - Each category has its own sensor:
1. **Insulation Insight** (`building_insight_insulation`) — Heat loss analysis
2. **Pre-heating Insight** (`building_insight_preheating`) — Thermal response advice
3. **Thermal Storage Insight** (`building_insight_thermal_storage`) — Load-shifting potential
4. **Building Profile Insight** (`building_insight_profile`) — Profile mismatch detection
5. **Building Insights Diagnostics (JSON)** — Detailed technical data

**Flow Trigger Cards:**
1. **"New building insight detected"** — Triggers on new insights
2. **"Pre-heating time recommendation"** — Triggers when ΔT > 1.5°C (max 1x per 4 hours)
3. **"Building profile mismatch detected"** — One-time trigger

### Insight Lifecycle

| Status | Icon | Description |
|--------|------|-------------|
| New | 🆕 | Just detected, notification sent |
| Active | ✅ | Displayed in capabilities |
| Acknowledged | 👀 | User has seen it |
| Dismissed | 🚫 | Hidden for 30 days |
| Resolved | ✔️ | Action implemented |

### Priority System

Insights are ranked 0-100 based on:
- **Confidence** (30%) — Model certainty
- **Energy savings potential** (40%) — €/month estimate
- **Action simplicity** (20%) — How easy to implement
- **Immediate impact** (10%) — Quick vs. long-term benefit

**Display rule:** Each category has its own sensor - all insights are shown in parallel (v2.5.10)

---

## Taking Action

### Step-by-Step Action Guide

#### For Insulation Insights:

| Timeframe | Actions |
|-----------|---------|
| **Immediate** (0-1 week) | ✅ Enable night setback<br/>✅ Check air leaks and seal |
| **Short-term** (1-3 months) | ✅ Get quotes for roof insulation (€3000-6000, payback 2-4 years)<br/>✅ Consider cavity wall insulation (€1500-3000)<br/>✅ Evaluate windows for HR++ glass |
| **Long-term** (6-12 months) | ✅ Plan comprehensive insulation package<br/>✅ Check subsidies (ISDE, local grants)<br/>✅ Calculate total ROI with monthly savings |

#### For Pre-Heating Insights:

| Timeframe | Actions |
|-----------|---------|
| **Immediate** | ✅ Create automation flow with `pre_heat_recommendation` trigger<br/>✅ Test night setback (start conservative: 2°C reduction) |
| **Optimization** | ✅ Fine-tune setback based on comfort<br/>✅ Adjust wake time setting if needed |

#### For Thermal Storage Insights:

| Timeframe | Actions |
|-----------|---------|
| **Prerequisites** (1-2 weeks) | ✅ Sign up for dynamic energy contract<br/>✅ Install Energy Prices app<br/>✅ Set up flow to forward prices |
| **Implementation** | ✅ Create thermal storage automation<br/>✅ Start conservative (±1°C adjustments) |
| **Optimization** | ✅ Increase temperature shift if comfortable<br/>✅ Adjust timing based on your price curve |

---

## Example Flows

### Flow 1: Automatic Pre-Heating Schedule

```
WHEN Pre-heating time recommendation
  (triggers daily at 23:00 with optimal start time)

THEN
  1. Set target temperature to 17°C at 22:00
     (night setback - building cools slowly)

  2. Set target temperature to 21°C at {{start_time}} token
     (pre-heating begins - calculated based on τ)

  3. Notify: "Pre-heat scheduled for {{start_time}} ({{duration_hours}}h)"
```

---

### Flow 2: Thermal Storage with Dynamic Pricing

```
WHEN Cheapest energy block started
  (from Energy Prices app - typically 02:00-06:00)

AND Building insight detected, category = "thermal_storage"

THEN
  1. Increase target temperature by 2°C (store thermal energy)
  2. Notify: "Thermal storage: pre-heating to {{target}}°C"
```

```
WHEN Most expensive energy block started
  (typically 17:00-21:00)

THEN
  1. Decrease target temperature by 1°C (coast on stored energy)
  2. Notify: "Thermal storage: coasting at {{target}}°C"
```

---

### Flow 3: High-Priority Insight Notifications

```
WHEN New building insight detected

AND {{estimated_savings_eur_month}} is greater than 70
AND {{priority}} is greater than 70

THEN
  Send notification:
    "💰 Energy Savings Opportunity!"
    "{{insight}}"
    "Action: {{recommendation}}"
    "Potential: €{{estimated_savings_eur_month}}/month"
```

---

### Flow 4: Profile Mismatch Auto-Correction

```
WHEN Building profile mismatch detected

AND {{deviation_percent}} is greater than 40

THEN
  1. Change device setting "building_profile" to {{suggested_profile}}
  2. Notify:
     "Building profile updated from {{current_profile}} to {{suggested_profile}}"
```

---

### Flow 5: Force Insight Analysis (On-Demand)

```
WHEN User presses virtual button "Analyze Building Now"
  (or daily at 08:00 for morning report)

THEN
  1. Force insight analysis
     (action: Force insight analysis)
     Returns: {{insights_detected}}, {{confidence}}

  2. WHEN {{insights_detected}} is greater than 0
     THEN Notify:
       "Building analysis: {{insights_detected}} insight(s) found"
       "Model reliability: {{confidence}}%"
```

**Use case:** Check immediately after major changes (weather, settings) without waiting 50 minutes.

---

### Flow 6: Only Notify High ROI Insights (Condition)

```
WHEN Building insight detected

AND Estimated savings is above €100/month
  (condition: Savings above threshold - category, €100)

AND Model confidence is above 75%
  (condition: Confidence above threshold - 75%)

THEN
  Send push notification:
    "💰 Large Savings Opportunity!"
    "{{insight}}"
    "Action: {{recommendation}}"
    "Potential: €{{estimated_savings_eur_month}}/month"
```

**Use case:** Filter "advice noise" - only notifications for significant savings with high certainty.

---

### Flow 7: Thermal Storage Only When Active (Condition)

```
WHEN Cheapest energy block started
  (from Energy Prices app)

AND Thermal storage insight is active
  (condition: Insight is active - category "thermal_storage")

THEN
  Increase target temperature by 2°C
  Notify: "Thermal storage: pre-heating active"

ELSE
  (No action - thermal storage not possible for this building)
```

**Use case:** Conditional automation - only apply thermal storage strategy if building is suitable.

---

## Flow Cards Reference

### Trigger Cards (3)

#### 1. New building insight detected

**Triggers:** When a new insight is detected (≥70% confidence, max 1× per category per day)

**Tokens:**

- `category` (string) - Category: insulation_performance / pre_heating / thermal_storage
- `insight` (string) - Human-readable insight message
- `recommendation` (string) - Recommended action
- `priority` (number 0-100) - Priority score
- `confidence` (number 0-100) - Model reliability
- `estimated_savings_eur_month` (number) - Monthly savings in EUR (if applicable)

**Frequency:** Max 1× per category per 24 hours (advice fatigue prevention)

---

#### 2. Pre-heating time recommendation

**Triggers:** When ΔT (target - indoor) > 1.5°C (max 1x per 4 hours)

**Tokens (v2.6.0):**

- `duration_hours` (number) - Pre-heating duration in hours
- `temp_rise` (number) - Required temperature rise in °C
- `current_temp` (number) - Current indoor temperature in °C
- `target_temp` (number) - Target temperature in °C
- `confidence` (number 0-100) - Model reliability

**Conditions:** Only if confidence ≥70%, max 1x per 4 hours

---

#### 3. Building profile mismatch detected

**Triggers:** One-time when learned behavior significantly deviates from selected profile

**Tokens:**

- `current_profile` (string) - Current profile (e.g., "average")
- `suggested_profile` (string) - Suggested profile (e.g., "heavy")
- `tau_learned` (number) - Learned time constant in hours
- `tau_profile` (number) - Profile time constant in hours
- `deviation_percent` (number) - Deviation percentage
- `confidence` (number 0-100) - Model reliability (minimum 50%)

**Conditions:** Deviation >30%, confidence ≥50%

---

### Action Cards (2)

#### 1. Force insight analysis

**Function:** Trigger immediate evaluation (don't wait for 50-min interval)

**Returns:**

- `insights_detected` (number) - Number of detected insights
- `confidence` (number) - Current model reliability

**Use:** On-demand analysis, debugging, daily report

---

#### 2. Calculate pre-heat duration (v2.6.0)

**Function:** Calculates time needed for X°C temperature rise

**Parameters:**

- `temperature_rise` (number) - Desired temperature rise in °C (e.g., 2.0)

**Returns:**

- `preheat_hours` (number) - Pre-heat duration in hours
- `confidence` (number) - Model reliability (%)
- `building_tau` (number) - Thermal time constant τ (hours)

**Use:** Plan pre-heating for specific times, thermal storage automation

**Example flow:**
```
WHEN Cheapest price block approaching (2 hours ahead)
THEN
  1. Calculate pre-heat duration (temperature_rise = 2.0)
  2. IF preheat_hours < 3 THEN
       → Start pre-heating now
```

---

### Condition Cards (3)

#### 1. Insight is active

**Function:** Check if specific category is currently active

**Parameters:**

- `category` (dropdown) - Category to check

**Returns:** `true` if active AND not dismissed, otherwise `false`

**Use:** Conditional automation (only thermal storage if insight active)

---

#### 2. Model confidence is above threshold

**Function:** Quality gate for flows

**Parameters:**

- `threshold` (number 0-100) - Confidence threshold in %

**Returns:** `true` if model confidence > threshold

**Use:** Only notifications/actions at high certainty (e.g., >80%)

---

#### 3. Estimated savings is above threshold

**Function:** ROI-based filtering

**Parameters:**

- `category` (dropdown) - Category to check (insulation_performance / pre_heating / thermal_storage)
- `threshold` (number 0-500) - EUR/month threshold

**Returns:** `true` if estimated monthly savings > threshold

**Use:** Filter for significant savings (e.g., only notify if >€100/month)

---

## Settings

### Insights Settings

**Location:** Device Settings → Building Insights & Recommendations

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| **Enable Building Insights** | ON | ON/OFF | Master switch |
| **Minimum Confidence (%)** | 70% | 50-90% | Threshold for showing insights |

> **Note (v2.6.0):** The `wake_time` and `night_setback_delta` settings have been removed. Pre-heating is now calculated dynamically based on actual indoor/target temperatures.

### Dynamic Pre-Heating (v2.6.0)

The system triggers automatically when ΔT (target - indoor) > 1.5°C:

**Formula:**
```
Pre_heat_duration = τ × ln(ΔT / 0.3)
```

**Example:**
- Target temperature: **21°C**
- Indoor temperature: **18°C**
- τ (time constant): **10 hours**
- ΔT = 21 - 18 = **3°C**

```
Pre_heat_duration = 10 × ln(3 / 0.3) = 10 × 2.30 = 23 hours → capped
```

**Practical outcomes:**

| τ (hours) | ΔT 2°C | ΔT 3°C | ΔT 4°C |
|-----------|--------|--------|--------|
| 4 | 0.8h | 0.9h | 1.0h |
| 10 | 1.9h | 2.3h | 2.6h |
| 15 | 2.9h | 3.5h | 3.9h |

### Recommended Settings by User Type

| Type | Confidence |
|------|------------|
| **Beginner** (first 2 weeks) | 70% |
| **Intermediate** (after 1 month) | 65% |
| **Advanced** (after 3 months) | 60% |

---

## Troubleshooting

### No Insights After 48 Hours

| Cause | Solution |
|-------|----------|
| Model confidence <70% | Wait longer (up to 72 hours) or lower threshold to 65% |
| Insights disabled | Check Device Settings → Enable Building Insights |
| Building performs exactly as expected | Good news! No optimization needed |
| Missing data sources | Ensure external indoor temp sensor is connected |

### Insights Show Wrong Savings Estimates

| Cause | Impact | Solution |
|-------|--------|----------|
| Energy price ≠ €0.30/kWh | Estimates proportional | Multiply by (your price / 0.30) |
| COP ≠ 3.5 | Higher COP = higher savings | Estimates are conservative |
| Heating hours ≠ 4000h/year | More hours = higher savings | Monitor actual savings after 1 month |

### Pre-Heating Recommendation Not Triggering

| Cause | Solution |
|-------|----------|
| Model confidence <70% | Wait for learning |
| Wake time not configured | Set via Device Settings |
| Flow card not created | Create flow with "Pre-heating time recommendation" trigger |

---

## FAQ

### Q: How long does learning take?

**A:** 48-72 hours for 70% confidence (default threshold). You can lower to 50% for earlier insights (less accurate). Full convergence takes 1-3 weeks.

### Q: Do insights update if I improve insulation?

**A:** Yes! The model learns continuously. After insulation upgrades, UA should decrease over 3-7 days. The "poor insulation" insight disappears and may be replaced by "excellent insulation" or "thermal storage opportunity".

### Q: What if my building doesn't fit any profile?

**A:** Profiles are just starting points to accelerate learning. After 48 hours, learned parameters completely override the profile.

### Q: Why does my τ (time constant) seem high/low?

**A:** τ depends on both thermal mass (C) and heat loss (UA):
- **High τ** (>15h): Heavy building (high C) OR excellent insulation (low UA)
- **Low τ** (<5h): Light building (low C) OR poor insulation (high UA)

### Q: How accurate are the savings estimates?

**A:** Target accuracy is ±20%. They're based on conservative assumptions (COP 3.5, 4000 heating hours, €0.30/kWh). Monitor actual savings via Homey Energy after implementation.

### Q: What happens if I change device settings during learning?

**A:** Minimal impact. The model learns building characteristics, not heat pump settings. But avoid:
- Changing building profile mid-learning (resets parameters)
- Resetting building model (loses all learned data)
- Frequent mode changes (confuses model)
