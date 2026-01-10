# Building Insights & Recommendations Guide

**Version**: 2.6.0+
**Last Updated**: January 2026

## Table of Contents

1. [Introduction](#introduction)
2. [What Are Building Insights?](#what-are-building-insights)
3. [How It Works](#how-it-works)
4. [Insight Categories](#insight-categories)
5. [Understanding Your Insights](#understanding-your-insights)
6. [Taking Action](#taking-action)
7. [Example Automation Flows](#example-automation-flows)
8. [Settings & Configuration](#settings--configuration)
9. [Troubleshooting](#troubleshooting)
10. [FAQ](#faq)

---

## Introduction

The **Building Insights & Recommendations** feature transforms your heat pump from a simple temperature controller into an intelligent energy advisor. After learning your building's thermal characteristics for 24-48 hours, the system provides **concrete, actionable recommendations** with estimated savings in euros per month.

### Key Benefits

- 💰 **10-30% energy savings** from insulation insights
- ⏱️ **5-10% savings** from optimized pre-heating schedules
- 🏠 **10-25% cost reduction** with thermal storage strategies (requires dynamic pricing)
- 📊 **ROI transparency** - every recommendation includes monthly savings estimates

---

## What Are Building Insights?

Building Insights analyze the **5 thermal parameters** learned by the Building Model:

| Parameter | Symbol | What It Means | Typical Range |
|-----------|--------|---------------|---------------|
| **Thermal Mass** | C | Heat capacity - how much energy needed to heat 1°C | 7-30 kWh/°C |
| **Heat Loss Coefficient** | UA | Rate of heat loss per degree temperature difference | 0.05-0.5 kW/°C |
| **Time Constant** | τ (tau) | How fast building heats/cools (τ = C/UA) | 5-25 hours |
| **Solar Gain Factor** | g | Effectiveness of solar radiation heating | 0.3-0.6 |
| **Internal Heat Gains** | P_int | Heat from people, appliances, cooking | 0.2-0.5 kW |

The system compares these learned values against:
- **Your selected building profile** (Light/Average/Heavy/Passive)
- **Typical values for well-insulated buildings**
- **Your energy pricing data** (if available)

When it detects optimization opportunities, it generates **insights** with specific recommendations.

---

## How It Works

### Learning Phase (24-48 Hours)

1. **Data Collection** (every 5 minutes):
   - Indoor temperature from external sensor
   - Outdoor temperature from heat pump or external sensor
   - Electrical power consumption
   - Estimated solar radiation

2. **Parameter Learning**:
   - Recursive Least Squares (RLS) algorithm updates thermal parameters
   - Confidence level grows from 0% → 100% over ~24-48 hours
   - At **70% confidence** (default), insights become available

3. **Insight Generation**:
   - System evaluates every 50 minutes (10 samples)
   - Detects patterns: poor insulation, thermal storage potential, pre-heating opportunities
   - Generates recommendations with ROI estimates

### Continuous Monitoring

- **Adapts to seasonal changes** (solar gain multipliers, internal heat patterns)
- **Updates insights** when parameters drift >10%
- **Rate limited** to prevent "advice fatigue" (max 1 insight per category per day)

---

## Insight Categories

The system provides **3 priority insight categories** + 1 diagnostic:

### 1. 🏠 Insulation Performance Insights

**What It Detects**:
- High heat loss (UA > expected)
- Excellent insulation (UA < expected)

**Example Insight**:
> "🏠 High heat loss - UA 0.52 kW/°C (expected: 0.30)"

**Example Recommendation**:
> "Consider insulation upgrades: roof (25% savings), walls (15%), windows (10%). Est. savings: €120/month"

**When It Triggers**:
- Confidence ≥ 70%
- UA > 1.5× profile UA **OR** UA > 0.5 kW/°C (absolute threshold)

**What To Do**:
1. **Verify the measurement** - Check if doors/windows were left open during learning
2. **Prioritize upgrades** - Roof insulation gives highest ROI (25% of total savings)
3. **Get quotes** - Use the €120/month estimate to calculate payback period
4. **Implement night setback** - Reduce heat loss during unoccupied hours (see Pre-Heating section)

**ROI Calculation Method**:
```
Excess heat loss = (Actual UA - Expected UA) kW/°C
Annual excess energy = Excess loss × 15°C avg delta × 4000 hours / COP 3.5
Annual cost = Excess energy × €0.30/kWh
Monthly savings = Annual cost / 12
```

---

### 2. ⏱️ Pre-Heating Strategy Insights

**What It Detects**:
- Fast thermal response (τ < 5 hours)
- Medium thermal response (τ 5-15 hours)
- Slow thermal response (τ > 15 hours)

**Example Insight**:
> "⏱️ Fast thermal response - building heats in 4.2 hours"

**Example Recommendation**:
> "Enable aggressive night setback to 16°C, pre-heat 2 hours before wake time (05:00 → 07:00 ready). Est. 12% energy savings."

**When It Triggers**:
- Confidence ≥ 70%
- Daily at 23:00 via flow trigger `pre_heat_recommendation`

**What To Do**:

#### For Fast Response Buildings (τ < 5h):
1. **Enable aggressive night setback**:
   - Lower to 16-17°C from 22:00-05:00
   - Building recovers quickly - no comfort impact
2. **Create pre-heat automation** (see Example Flow 1 below)
3. **Expected savings**: 10-15% energy reduction

#### For Medium Response Buildings (τ 5-15h):
1. **Enable moderate night setback**:
   - Lower to 17-18°C from 23:00-05:00
   - Allow 4 hours pre-heat time
2. **Balance comfort vs. savings**
3. **Expected savings**: 6-10% energy reduction

#### For Slow Response Buildings (τ > 15h):
1. **Minimal or no setback**:
   - Consider continuous heating at stable 19-20°C
   - Long pre-heat time (6+ hours) may not be practical
2. **Focus on insulation improvements instead**
3. **Expected savings**: 3-5% energy reduction

**Pre-Heat Timing Calculation**:
```
Pre-heat hours = τ × ln(Target temp rise / 0.5°C residual)

Example: τ = 6.8h, want to rise 4°C (17°C → 21°C)
Pre-heat hours = 6.8 × ln(4/0.5) = 6.8 × 2.08 = 14.1 hours (too long!)

Better: τ = 4.2h, rise 4°C
Pre-heat hours = 4.2 × ln(4/0.5) = 4.2 × 2.08 = 8.7 hours (manageable)
```

---

### 3. 💰 Thermal Storage Optimization Insights

**What It Detects**:
- High thermal mass buildings (C > 18 kWh/°C) with slow response (τ > 12h)
- Ability to store energy during cheap hours, coast during expensive hours

**Example Insight (With Dynamic Pricing)**:
> "💰 Thermal storage potential - C=24 kWh/°C, τ=18h"

**Example Recommendation**:
> "Pre-heat +2°C during cheap hours (02:00-06:00), coast at -1°C during peak (17:00-21:00). Est. savings: €95/month"

**Example Insight (Without Dynamic Pricing)**:
> "💡 Building suitable for thermal storage - C=24 kWh/°C, τ=18h"

**Example Recommendation**:
> "Add dynamic energy pricing data via flow card 'Receive external energy prices' to enable cost optimization. Potential savings: 15-25%"

**When It Triggers**:
- Confidence ≥ 70%
- C > 18 kWh/°C **AND** τ > 12 hours

**What To Do**:

#### If You Have Dynamic Pricing Already:
1. **Implement thermal storage automation** (see Example Flow 2 below)
2. **Pre-heat during cheap hours**:
   - Increase target by 2°C when electricity price is lowest
   - Building stores thermal energy
3. **Coast during expensive hours**:
   - Decrease target by 1°C during peak pricing
   - Building releases stored energy, heat pump idles
4. **Expected savings**: €70-150/month depending on price differential

#### If You Don't Have Dynamic Pricing Yet:
1. **Check if your energy supplier offers hourly pricing**:
   - Netherlands: Frank Energie, Tibber, ANWB Energie
   - Belgium: Bolt Energie
   - Germany: Tibber, aWATTar
2. **Set up external pricing flow card**:
   - Use Homey App "Energy Prices" or similar
   - Connect via flow: `WHEN price received THEN Adlar: Receive external energy prices`
3. **Re-evaluate after 1 week** - Insight will upgrade to "active" with ROI estimate

**Thermal Storage Calculation Method**:
```
Stored energy = C × Temp shift = 24 kWh/°C × 2°C = 48 kWh
Daily savings = Stored energy × Price differential × Utilization factor
             = 48 kWh × €0.15/kWh × 0.70 = €5.04/day
Monthly savings = €5.04 × 30 = €151/month
```

---

### 4. 🔄 Building Profile Mismatch (Diagnostic)

**What It Detects**:
- Selected building profile doesn't match learned behavior
- >30% deviation in time constant (τ)

**Example Insight**:
> "🔄 Building behaves like 'heavy' (τ=18h vs 'average' τ=10h)"

**Example Recommendation**:
> "Change building profile to 'heavy' in device settings for faster learning and better initial parameters"

**When It Triggers**:
- Confidence ≥ 50% (lower threshold - rough detection is sufficient)
- Triggers once, re-evaluates if profile changed but still mismatched

**What To Do**:
1. **Go to device settings** → Building Model section
2. **Change "Building Profile"** to suggested profile
3. **Benefit**: Learning converges 2-3× faster with correct profile
4. **No energy impact** - purely improves model accuracy

**Profile Characteristics**:

| Profile | C (kWh/°C) | UA (kW/°C) | τ (hours) | Building Type |
|---------|-----------|-----------|-----------|---------------|
| **Light** | 7 | 0.35 | 20 | Wood frame, basic insulation, quick temp changes |
| **Average** | 15 | 0.30 | 50 | Brick, cavity walls, double glazing (typical Dutch) |
| **Heavy** | 20 | 0.25 | 80 | Concrete/stone, good insulation, HR++ glass |
| **Passive** | 30 | 0.05 | 600 | Passive house, HR+++, airtight, heat recovery |

---

## Understanding Your Insights

### Where to Find Insights

**Device Capabilities** (visible in Homey app):
1. **Primary Building Insight** - Most important insight (highest priority)
2. **Secondary Building Insight** - Second-highest priority insight
3. **Recommended Action** - Specific actionable step to take
4. **Building Insights Diagnostics (JSON)** - Detailed technical data for advanced users

**Flow Trigger Cards**:
1. **"New building insight detected"** - Fires when insight appears (all categories)
2. **"Pre-heating time recommendation"** - Daily trigger at 23:00 with optimal pre-heat schedule
3. **"Building profile mismatch detected"** - One-time trigger when profile needs correction

### Insight Lifecycle

1. **New** (🆕) - Just detected, notification sent (if enabled)
2. **Active** (✅) - Displayed in capabilities, flow cards enabled
3. **Acknowledged** (👀) - User viewed, no longer notifies
4. **Dismissed** (🚫) - User explicitly dismissed, hidden for 30 days
5. **Resolved** (✔️) - User implemented action, archived in history

### Priority System

Insights are ranked 0-100 based on:
- **Confidence** (30% weight) - Model certainty
- **Energy savings potential** (40% weight) - €/month estimate
- **Action simplicity** (20% weight) - How easy to implement
- **Immediate impact** (10% weight) - Quick vs. long-term benefit

**Display Rule**: Max 3 active insights shown simultaneously (highest priority first)

---

## Taking Action

### Step-by-Step Action Guide

#### For Insulation Insights:

**Immediate Actions** (0-1 week):
1. ✅ Enable night setback to reduce heat loss during unoccupied hours
2. ✅ Check for air leaks (doors, windows, letterbox) and seal

**Short-Term Actions** (1-3 months):
1. ✅ Get quotes for roof insulation (~€3000-6000, payback 2-4 years)
2. ✅ Consider cavity wall insulation (~€1500-3000, payback 3-5 years)
3. ✅ Evaluate window upgrades to HR++ glass

**Long-Term Actions** (6-12 months):
1. ✅ Plan comprehensive insulation package
2. ✅ Check for subsidies (ISDE, local municipality grants)
3. ✅ Calculate total ROI using monthly savings estimate

#### For Pre-Heating Insights:

**Immediate Actions** (same day):
1. ✅ Create automation flow using `pre_heat_recommendation` trigger (see Example Flow 1)
2. ✅ Test night setback (start conservative: 2°C reduction)
3. ✅ Monitor comfort - adjust if wake-up temp not reached

**Optimization** (ongoing):
1. ✅ Fine-tune setback temperature based on comfort feedback
2. ✅ Adjust wake time setting if schedule changes
3. ✅ Monitor energy savings via Homey Energy dashboard

#### For Thermal Storage Insights:

**Prerequisites** (1-2 weeks):
1. ✅ Sign up for dynamic pricing energy contract
2. ✅ Install Energy Prices app in Homey
3. ✅ Set up flow to feed prices to Adlar app

**Implementation** (after prices available):
1. ✅ Create thermal storage automation (see Example Flow 2)
2. ✅ Start conservative (±1°C adjustments)
3. ✅ Monitor cost savings vs. comfort impact

**Optimization** (1-3 months):
1. ✅ Increase temperature shift if comfortable (up to ±2-3°C)
2. ✅ Adjust timing based on your price curve
3. ✅ Track monthly savings - should match estimate ±20%

---

## Example Automation Flows

### Example Flow 1: Automatic Pre-Heating Schedule

**Goal**: Automatically adjust heating schedule based on building's thermal response

```
WHEN Pre-heating time recommendation
  (triggers daily at 23:00 with optimal start time)

THEN
  1. Set target temperature to 17°C at 22:00
     (night setback - building cools slowly)

  2. Set target temperature to 21°C at {{start_time}} token
     (pre-heat begins - calculated based on τ)

  3. Notify: "Pre-heat scheduled for {{start_time}} ({{duration_hours}}h)"
     (optional - confirm automation ran)
```

**Advanced Version** (with confidence check):
```
WHEN Pre-heating time recommendation

AND {{confidence}} is greater than 75
  (only when model is highly confident)

THEN
  1. Set variable "night_setback_active" to true
  2. Set target temperature to 17°C at 22:00
  3. Set target temperature to 21°C at {{start_time}}
  4. Log: "Pre-heat: {{duration_hours}}h for {{temp_rise}}°C rise"
```

---

### Example Flow 2: Thermal Storage with Dynamic Pricing

**Goal**: Store energy during cheap hours, coast during expensive hours

```
WHEN Cheapest energy block started
  (from Energy Prices app - typically 02:00-06:00)

AND Building insight detected, category = "thermal_storage"
  (confirms building is suitable)

THEN
  1. Increase target temperature by 2°C
     (store thermal energy)

  2. Set variable "thermal_storage_mode" to "charging"
  3. Notify: "Thermal storage: pre-heating to {{target}}°C"
```

```
WHEN Most expensive energy block started
  (from Energy Prices app - typically 17:00-21:00)

AND Variable "thermal_storage_mode" equals "charging"
  (confirm we charged earlier)

THEN
  1. Decrease target temperature by 1°C
     (coast on stored energy)

  2. Set variable "thermal_storage_mode" to "coasting"
  3. Notify: "Thermal storage: coasting at {{target}}°C"
```

**Safety Flow** (restore normal temp after peak):
```
WHEN Most expensive energy block ended
  (typically 21:00)

THEN
  1. Set target temperature to 20°C (normal)
  2. Set variable "thermal_storage_mode" to "normal"
```

---

### Example Flow 3: High-Priority Insight Notifications

**Goal**: Get notified only for high-impact insights (>€70/month savings)

```
WHEN New building insight detected
  {{category}} equals any value

AND {{estimated_savings_eur_month}} is greater than 70
  (only notify for big opportunities)

AND {{priority}} is greater than 70
  (only high-priority insights)

THEN
  Send notification:
    "💰 Energy Savings Opportunity!"
    "{{insight}}"
    "Action: {{recommendation}}"
    "Potential: €{{estimated_savings_eur_month}}/month"
```

---

### Example Flow 4: Profile Mismatch Auto-Correction

**Goal**: Automatically apply suggested building profile

```
WHEN Building profile mismatch detected
  (one-time trigger when detected)

AND {{deviation_percent}} is greater than 40
  (only correct significant mismatches)

THEN
  1. Change device setting "building_profile" to {{suggested_profile}}
     (applies correction automatically)

  2. Notify:
     "Building profile updated from {{current_profile}} to {{suggested_profile}}"
     "Reason: Learned τ={{tau_learned}}h differs {{deviation_percent}}% from expected"
```

**Manual Approval Version** (safer):
```
WHEN Building profile mismatch detected

THEN
  Send notification with action buttons:
    "Profile Mismatch Detected"
    "Current: {{current_profile}} (τ={{tau_profile}}h)"
    "Learned: τ={{tau_learned}}h"
    "Suggest: {{suggested_profile}}"

    [Button: Apply Suggestion] → Change profile
    [Button: Keep Current] → Dismiss insight
```

---

## Settings & Configuration

### Insights Settings

**Location**: Device Settings → Building Insights & Recommendations

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| **Enable Building Insights** | ON | ON/OFF | Master switch - disables all insight detection when OFF |
| **Minimum Confidence (%)** | 70% | 50-90% | Threshold for showing insights. Lower = earlier but less accurate. |
| **Max Active Insights** | 3 | 1-5 | Maximum simultaneous insights to prevent information overload |
| **Wake Time** | 07:00 | HH:MM | Target time for pre-heat completion (used in τ calculations) |
| **Night Setback (°C)** | 4.0 | 2.0-6.0 | Temperature reduction during night (used to estimate savings) |

### Recommended Settings by User Type

**Beginner** (first 2 weeks):
- Minimum Confidence: 70% (conservative - wait for accurate insights)
- Max Active Insights: 2 (focus on top priorities only)
- Enable night setback: Start with 2°C reduction

**Intermediate** (after 1 month):
- Minimum Confidence: 65% (balanced - slightly earlier insights)
- Max Active Insights: 3 (standard - see all important insights)
- Increase night setback to 4°C if comfortable

**Advanced** (after 3 months):
- Minimum Confidence: 60% (aggressive - early detection)
- Max Active Insights: 5 (see all available insights)
- Optimize night setback based on your τ value

---

## Troubleshooting

### No Insights Appearing After 48 Hours

**Possible Causes & Solutions**:

1. **Model confidence < 70%**
   - **Check**: Device → Building Model Diagnostics (JSON)
   - **Solution**: Wait longer (up to 72 hours) or lower confidence threshold to 65%
   - **Why**: Unstable indoor temp, frequent mode changes, or insufficient data points

2. **Insights disabled in settings**
   - **Check**: Device Settings → Building Insights & Recommendations
   - **Solution**: Enable "Enable Building Insights" checkbox

3. **Building performs exactly as expected**
   - **Check**: All parameters within ±20% of selected profile
   - **Solution**: This is good! No optimization needed. Change to a different profile to trigger mismatch detection.

4. **Missing required data sources**
   - **Check**: Building Model Diagnostics → "Data Availability"
   - **Solution**: Ensure external indoor temp sensor connected, outdoor temp available

### Insights Show Wrong Savings Estimates

**Possible Causes & Solutions**:

1. **Your actual energy price differs from default (€0.30/kWh)**
   - **Impact**: Savings estimates scaled proportionally
   - **Solution**: Mental adjustment - multiply by (your price / 0.30)
   - **Example**: Your price €0.25/kWh → €120 estimate becomes €100

2. **Your COP differs from assumed 3.5**
   - **Impact**: Higher COP → higher savings (use less electricity for same heat)
   - **Solution**: Savings estimates are conservative - actual may be higher

3. **Your heating hours differ from typical 4000h/year**
   - **Impact**: More hours → higher savings, fewer hours → lower savings
   - **Solution**: Monitor actual savings via Homey Energy after 1 month

### Pre-Heat Recommendation Not Triggering

**Possible Causes & Solutions**:

1. **Model confidence < 70%**
   - **Check**: Building Model Diagnostics → "Confidence"
   - **Solution**: Wait for learning to complete

2. **Wake time not configured**
   - **Check**: Device Settings → Building Insights → Wake Time
   - **Solution**: Set wake time (format: HH:MM, e.g., "07:00")

3. **Flow card not created yet**
   - **Check**: Homey Flow editor → Search "pre_heat"
   - **Solution**: Create flow using "Pre-heating time recommendation" trigger

### Thermal Storage Insight Shows "Add Dynamic Pricing" But I Already Have It

**Possible Causes & Solutions**:

1. **External prices not flowing to Adlar app**
   - **Check**: Adaptive Control Diagnostics (JSON) → "dynamicPricingAvailable"
   - **Solution**: Create flow: `WHEN Energy Prices received THEN Adlar: Receive external energy prices`
   - **Test**: Manually trigger flow, check if "dynamicPricingAvailable" changes to true

2. **Prices expired (>24 hours old)**
   - **Impact**: System considers pricing unavailable
   - **Solution**: Check Energy Prices app is running, prices update daily

---

## FAQ

### Q: How long does learning take?

**A**: 24-48 hours for 70% confidence (default threshold). You can lower to 50% in settings for earlier insights (less accurate). Full convergence takes 1-3 weeks, but insights appear much sooner.

### Q: Will insights update if I improve insulation?

**A**: Yes! The model continuously learns. After insulation upgrades, UA should decrease over 3-7 days. The "poor insulation" insight will disappear and may be replaced by "excellent insulation" or "thermal storage opportunity" (if your building now has high thermal mass).

### Q: Can I dismiss insights I don't want to act on?

**A**: Yes. In future versions, you'll be able to dismiss specific insights via flow card. For now, you can:
- Lower "Max Active Insights" setting to focus on top priorities only
- Increase "Minimum Confidence" to reduce insight frequency
- Disable insights entirely in settings

### Q: Do insights consider my energy contract type?

**A**: Partially. Thermal storage insights detect if dynamic pricing is available. However, savings estimates use a generic €0.30/kWh baseline. If your contract is €0.25/kWh, scale estimates by 0.83× (€0.25/€0.30).

### Q: What if my building doesn't fit any profile?

**A**: Profiles are just starting points to accelerate learning. After 48 hours, the learned parameters completely override the profile. If you get a "profile mismatch" insight, change to the suggested profile - but it won't affect long-term accuracy, only initial learning speed.

### Q: Can I see historical insights?

**A**: Yes, in "Building Insights Diagnostics (JSON)" capability → "insight_history" array. Shows last 50 insights with timestamps, categories, and resolution status.

### Q: Why does my τ (time constant) seem high/low?

**A**: τ depends on both thermal mass (C) and heat loss (UA):
- **High τ** (>15h): Heavy building (high C) OR excellent insulation (low UA) → slow to heat/cool
- **Low τ** (<5h): Light building (low C) OR poor insulation (high UA) → fast to heat/cool

Both can be "correct" - it's the specific combination for your building.

### Q: How accurate are the savings estimates?

**A**: Target accuracy is ±20%. They're based on:
- **Conservative assumptions**: COP 3.5 (modern heat pumps are 3.0-5.0)
- **Typical heating hours**: 4000h/year (actual varies 3000-5000h)
- **Baseline energy price**: €0.30/kWh (actual varies €0.20-0.40)

Monitor actual savings via Homey Energy after implementing recommendations. Adjust expectations based on your specific situation.

### Q: What happens if I change device settings during learning?

**A**: Minimal impact. The model learns building characteristics (thermal mass, insulation), not heat pump settings. However, avoid:
- Changing building profile mid-learning (resets parameters)
- Resetting building model (loses all learned data)
- Frequent mode changes (heating/cooling) - confuses model

### Q: Can insights help if I don't have a heat pump?

**A**: Partially. Building Model learning requires power consumption data to calculate heating delivered. Without a heat pump, you won't get insights. However, the pre-heating timing logic and thermal storage concepts apply to any heating system if you manually estimate your τ (time constant).

---

## Support & Feedback

**Found a bug?** [Report on GitHub Issues](https://github.com/hermanhilberink/org.hhi.adlar-heatpump/issues)

**Feature request?** Add to [GitHub Discussions](https://github.com/hermanhilberink/org.hhi.adlar-heatpump/discussions)

**Need help?** Ask in [Homey Community Forum](https://community.homey.app)

---

**Happy Optimizing! 🎉**
