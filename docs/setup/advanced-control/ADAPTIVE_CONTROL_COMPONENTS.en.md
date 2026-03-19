# Adlar Heat Pump — Adaptive Control System

**Version:** 2.8.x | **Date:** March 2026

---

## Overview

This system intelligently controls your Adlar Castra heat pump for:

- **Constant indoor temperature** (±0.3°C)
- **Passive cooling mode** (coast) — prevents unnecessary heating
- **Energy optimization** via dynamic prices
- **COP maximization** for maximum efficiency
- **Automatic learning** how your home responds

### Estimated Savings

| Component | Savings/year |
|-----------|-------------|
| Energy Price Optimization | €400-600 |
| COP Optimization | €200-300 |
| **Total** | **€600-900** |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           HOMEY PRO                                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │          Adlar Heat Pump Device - Main Controller             │  │
│  └─────────────────────────────┬─────────────────────────────────┘  │
│                                │                                    │
│        ┌───────────┬───────────┼───────────┬───────────┬───────────┐  │
│        │           │           │           │           │           │  │
│        ▼           ▼           ▼           ▼           ▼           │  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│  │  Comfort  │ │ Building  │ │  Energy   │ │    COP    │ │  Thermal  │ │
│  │  Control  │ │  Learner  │ │ Optimizer │ │ Optimizer │ │   Model   │ │
│  │    50%    │ │   Info    │ │    15%    │ │    15%    │ │    20%    │ │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ │
│        │             │             │             │                  │
└────────┼─────────────┼─────────────┼─────────────┼──────────────────┘
         │             │             │             │
         ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          HEAT PUMP                                  │
│  ┌───────────────────┐  ┌───────────────────────────────────────┐   │
│  │ DPS 4:            │  │ DPS 21/22: Supply/Return              │   │
│  │ Target Temp       │  │ DPS 26: Outdoor Temp                  │   │
│  └───────────────────┘  └───────────────────────────────────────┘   │
│  ┌───────────────────┐                                              │
│  │ DPS 13:           │                                              │
│  │ Heating Curve=OFF │                                              │
│  └───────────────────┘                                              │
└─────────────────────────────────────────────────────────────────────┘
         ▲
         │
┌─────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL DATA                               │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │
│  │Indoor Temp    │  │ Energy Prices │  │  Weather API  │            │
│  └───────────────┘  └───────────────┘  └───────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

### Control Loop (every 5 min)

1. **Collect data** — Indoor/outdoor temp, power, prices
2. **Cooldown detection** — Tist > Tsoll + hysteresis? → Coast mode
3. **Calculate controllers** — Each component provides advice
4. **Weighted decision** — 50% comfort + 15% efficiency + 15% cost + 20% thermal (+ 80% coast when active)
5. **Execute** — Update target temperature (DPS 4)

---

## Component 1: Heating Controller

### PI Controller

The **PI (Proportional-Integral) controller** combines:

| Component | Function | Formula |
|-----------|----------|---------|
| **P** (Proportional) | Correct current deviation | `Kp × error` |
| **I** (Integral) | Eliminate structural deviation | `Ki × average_error` |

**Total correction:** `(Kp × current_error) + (Ki × average_error)`

### Parameters

| Parameter | Default | Range | Effect |
|-----------|---------|-------|--------|
| Kp | 3.0 | 1.0-5.0 | Response speed |
| Ki | 1.5 | 0.5-3.0 | Long-term correction |
| Deadband | 0.3°C | 0.1-1.0°C | Tolerance zone |
| Min Wait | 20 min | 10-60 min | Anti-oscillation |

### Tuning Profiles

| Profile | Kp | Ki | Deadband | Use Case |
|---------|----|----|----------|----------|
| Aggressive | 4.0-5.0 | 2.0-3.0 | 0.2°C | Poorly insulated |
| **Balanced** | 3.0 | 1.5 | 0.3°C | **Recommended** |
| Conservative | 2.0 | 1.0 | 0.5°C | Good insulation |

---

## Component 5: Coast Strategy (Passive Cooling Mode)

> New in v2.8.0 — [ADR-024](../../../plans/decisions/ADR-024-adaptive-cooldown-mode.md)

### What does it do?

When the room temperature is **above the setpoint** (e.g. due to solar gain), the system detects this and **prevents unnecessary heating**. The heat pump stays off while the room passively cools to the desired level.

### How does it work?

| Step | Description |
|------|--------------|
| 1️⃣ **Detection** | Tist > Tsoll + hysteresis (default 0.3°C) |
| 2️⃣ **Confirmation** | At least 2 consecutive measurements (~10 min) |
| 3️⃣ **Trend check** | Temperature rising or stable (not falling) |
| 4️⃣ **Coast active** | Target temperature → below current water temperature |
| 5️⃣ **Exit** | When Tist < Tsoll + hysteresis/2 → back to heating |

### Weight in Decision

The coast strategy receives a **dominant weight** (default 80%) in the weighted decision:

```
When coast mode active:
  Coast:    80%  (dominant — prevents heating)
  Comfort:  10%  (PI — also negative, reinforces coast)
  Thermal:   4%  (wind correction, negligible)
  Other:     6%  (COP + price)
```

> [!NOTE]
> The PI controller is **reset** (I-term cleared) upon leaving coast mode to prevent bias.

### Settings

| Setting | Default | Effect |
|---------|---------|--------|
| Coast Offset | 1°C | Degrees below outlet temperature for coast target |
| Coast Hysteresis | 0.3°C | Overshoot margin above setpoint for activation |
| Coast Strength | 0.80 | Weight share in the weighted decision |

---

## Component 2: Building Model Learner

### Learned Parameters

| Parameter | Symbol | Unit | Typical value |
|-----------|--------|------|---------------|
| Thermal mass | C | kWh/°C | 10-25 |
| Heat loss | UA | kW/°C | 0.1-0.4 |
| Solar gain factor | g | - | 0.3-0.6 |
| Internal heat | P_int | kW | 0.2-0.5 |
| Wind correction | W_corr | - | 0.03-0.12 |
| Time constant | τ | hour | 4-16 |

### Machine Learning: RLS

The system uses **Recursive Least Squares** (RLS):

- ✅ Learns real-time during use
- ✅ Adapts to seasons
- ✅ Computationally light (fits on Homey)
- ✅ Provides confidence indicator

**Learning progression:**

| Period | Confidence | Prediction |
|--------|------------|------------|
| Day 1 | 25% | ±2°C |
| Day 3 | 45% | ±1°C |
| Week 1 | 72% | ±0.5°C |
| Week 4 | 91% | ±0.2°C |

### Building Type Categories

| Type | C (kWh/°C) | UA (kW/°C) | τ (hour) |
|------|------------|------------|----------|
| Light (wood/prefab) | 5-8 | 0.35-0.45 | 2-4 |
| Average (NL house) | 10-15 | 0.25-0.35 | 4-8 |
| Heavy (concrete) | 15-25 | 0.15-0.25 | 8-16 |
| Passive house | 25-40 | <0.05 | 16-48 |

---

## Component 3: Energy Price Optimizer

### Price Categories

| Category | Threshold | Action | Offset |
|----------|-----------|--------|--------|
| Very Low | ≤€0.04/kWh | Pre-heat MAX | +1.5°C |
| Low | ≤€0.06/kWh | Pre-heat | +0.75°C |
| Normal | ≤€0.10/kWh | Maintain | 0°C |
| High | ≤€0.12/kWh | Reduce | -0.5°C |
| Very High | >€0.12/kWh | Reduce MAX | -1.0°C |

> [!NOTE]
> Thresholds are based on 2024 spot price percentiles.

### Cost Calculation Modes

| Mode | Formula |
|------|---------|
| Market price | Spot + VAT |
| Market price+ | Spot + markup + VAT |
| **All-in** | Spot + markup + tax + VAT |

### Example Savings

```
WITHOUT optimization: €18/day
WITH optimization:    €10/day
─────────────────────────────
Savings:              €8/day = ~€2,900/year (max)
Realistic:            €400-600/year
```

---

## Component 4: COP Controller

### What is COP?

**COP = Heat Output / Electrical Input**

| COP | Meaning | Cost (€0.25/kWh) |
|-----|---------|------------------|
| 2.0 | Poor | €0.25/hour for 4kW |
| 3.5 | Good | €0.14/hour for 4kW |
| 5.0 | Excellent | €0.10/hour for 4kW |

> [!IMPORTANT]
> Difference between COP 2.0 and 5.0 = **2.5× cheaper!**

### Factors Affecting COP

| Factor | Effect | Optimization |
|--------|--------|--------------|
| Temp difference | Larger = lower COP | Lower supply temp |
| Outdoor temp | Warmer = higher COP | Pre-heat in mild weather |
| Supply temp | Lower = higher COP | Minimum necessary temp |

### Multi-Horizon Analysis

The app uses built-in COP capabilities:

| Capability | Horizon | Usage |
|------------|---------|-------|
| `adlar_cop` | Realtime | Direct adjustments |
| `adlar_cop_daily` | 24h average | Day pattern |
| `adlar_cop_weekly` | 7d average | Trends |
| `adlar_cop_monthly` | 30d average | Season |
| `adlar_scop` | Season (EN 14825) | Annual |

### Efficiency Zones

| Zone | COP | Action |
|------|-----|--------|
| 🟢 Excellent | ≥4.0 | Maintain |
| 🟢 Good | 3.5-4.0 | Maintain |
| 🟡 Acceptable | 3.0-3.5 | Monitor |
| 🟠 Moderate | 2.5-3.0 | Optimize |
| 🔴 Poor | <2.5 | **Urgent!** |

---

## System Integration

### Priorities & Weights

The weighting factors are **configurable** via Device Settings → Adaptive Control Weighting Factors:

| Priority | Default | Range | Function |
|----------|---------|-------|----------|
| **Comfort** | 50% | 0-100% | Weight for PI temperature control |
| **Efficiency** | 15% | 0-100% | Weight for COP optimization |
| **Cost** | 15% | 0-100% | Weight for price optimization |
| **Thermal** | 20% | 0-100% | Weight for thermal model prediction |

> [!NOTE]
> Values are automatically normalized to total 100%.

### Conflict Resolution

**Example:**
```
Comfort Controller: "Increase +2°C" (too cold!)
COP Optimizer:      "Decrease -1°C" (poor COP)
Price Optimizer:    "Decrease -1°C" (expensive price)
Thermal Model:      "Increase +0.5°C" (prediction)

Calculation:
+2.0 × 0.50 = +1.00°C
-1.0 × 0.15 = -0.15°C
-1.0 × 0.15 = -0.15°C
+0.5 × 0.20 = +0.10°C
─────────────────────
Total:     +0.80°C
```

### Example: Coast Mode Active

```
Comfort Controller: "Decrease -1°C" (PI detects overshoot)
COP Optimizer:      "Decrease -0.5°C" (lower supply = higher COP)
Price Optimizer:    "Maintain 0°C" (normal price)
Thermal Model:      "Increase +0.3°C" (wind correction)
Coast Strategy:     "Decrease -4°C" (coast target = outlet - offset)

Calculation (with coast strength = 0.80):
-4.0 × 0.80       = -3.20°C  (coast dominant)
-1.0 × 0.50 × 0.20 = -0.10°C  (comfort scaled)
-0.5 × 0.15 × 0.20 = -0.02°C  (COP scaled)
 0.0 × 0.15 × 0.20 =  0.00°C  (price scaled)
+0.3 × 0.20 × 0.20 = +0.01°C  (thermal scaled)
───────────────────────────────
Total:            -3.31°C → Setpoint << P111 → compressor stops ✅
```

### Override Rules

1. **Safety First** — Outside 15-28°C range: ignore everything
2. **Comfort Minimum** — Too cold: 100% comfort priority
3. **Efficiency Opportunity** — Room + low COP: increase COP weight

---

## Setup & Configuration

### Quick Start (5 minutes)

1. **Install app** on Homey Pro
2. **Configure external sensor** (thermostat)
3. **Heating curve → OFF** (app does this automatically)
4. **Wait 48-72 hours** for first reliable results
5. **Activate optimizations** after 1 week

### Installation Phases

| Phase | Day | Action | Expected |
|-------|-----|--------|----------|
| Learning | 1-3 | Collect data | 30-50% confidence |
| Basic | 3-7 | Adaptive Control ON | Stable temp |
| Full | 10+ | COP + Price ON | All optimizations |

### Configuration

````carousel
```json
// Heating Controller
{
  "adaptive_control_enabled": true,
  "target_temperature": 20,
  "control_deadband": 0.3,
  "control_kp": 3.0,
  "control_ki": 1.5,
  "min_wait_between_changes": 20
}
```
<!-- slide -->
```json
// Energy Optimizer
{
  "price_optimizer_enabled": true,
  "price_calculation_mode": "all_in",
  "price_threshold_very_low": 0.04,
  "price_threshold_low": 0.06,
  "price_threshold_normal": 0.10,
  "price_threshold_high": 0.12,
  "price_max_preheat_offset": 1.5
}
```
<!-- slide -->
```json
// COP Controller
{
  "cop_optimizer_enabled": true,
  "cop_min_acceptable": 2.5,
  "cop_target": 3.5,
  "cop_strategy": "balanced"
}
```
<!-- slide -->
```json
// Coast Strategy (Passive Cooling Mode)
{
  "adaptive_cooldown_offset": 1.0,
  "adaptive_cooldown_hysteresis": 0.3,
  "adaptive_cooldown_strength": 0.80
}
```
````

---

## Flow Examples

### Basic: Notification

```
WHEN: Setpoint automatically adjusted
THEN: Send notification
      "🌡️ Target: {{old}}°C → {{new}}°C"
```

### Advanced: GPS Home Arrival

```
WHEN: Someone is arriving home
IF: Everyone was away AND Current temp < 19°C
THEN: Set adaptive target to 20°C
      Send notification "🏠 Warming up started"
```

### Price Optimization

```
WHEN: Time is 23:00
IF: Current price < €0.08/kWh
    AND Tomorrow 07:00 price > €0.30/kWh
    AND Building τ > 6 hours
THEN: Set target +1.5°C (pre-heat)
      Send notification "⚡💰 Pre-heating"
```

### Multi-Horizon COP Report

```
WHEN: Time is Sunday 20:00
THEN: Get COP metrics
      Send notification:
      "📈 Weekly COP Report
       Current: {{adlar_cop}}
       Daily: {{adlar_cop_daily}}
       Weekly: {{adlar_cop_weekly}}
       SCOP: {{adlar_scop}}"
```

---

## Troubleshooting

### Common Problems

| Problem | Cause | Solution |
|---------|-------|----------|
| "Heating curve not OFF" | Manually changed | Settings → Control Mode reset |
| Temp not responding | External sensor issues | Check sensor connection |
| Model confidence low | Inconsistent data | Wait longer or reset model |
| No price data | API issues | Check internet connection |
| COP unrealistic | HP in transition | Wait 24h for stabilization |
| HP heats at high room temp | Coast not active | Check hysteresis setting, wait 10 min |
| Oscillation after cooling | I-term bias | Coast exit reset not working → restart adaptive control |

### Tuning Problems

| Symptom | Adjustment |
|---------|------------|
| Oscillates too much | Increase deadband, lower Kp |
| Responds too slowly | Decrease deadband, increase Kp |
| Structurally too cold/warm | Increase Ki |
| Too many small corrections | Increase min_wait |

### Debug Mode

```bash
# Activate via Settings → Log Level → DEBUG

# Provides extra logs:
# - Controller status every 5 min
# - RLS updates and prediction errors
# - COP calculations
# - Price category decisions
```

---

## Appendix: Technical Details

### DPS Mapping

| DPS | Capability | Description |
|-----|------------|-------------|
| 4 | `target_temperature` | Target temperature (direct control) |
| 13 | `adlar_enum_countdown_set` | Heating curve (**MUST be OFF!**) |
| 21 | `measure_temperature.temp_top` | Supply temperature |
| 22 | `measure_temperature.temp_bottom` | Return temperature |
| 26 | `measure_temperature.around_temp` | Outdoor temperature |
| 27 | `adlar_state_compressor_state` | Compressor status |

> [!CAUTION]
> **NEVER** manually change the heating curve (DPS 13)! It must always be OFF for adaptive control.

### Formulas

**Heat Balance:**
```
dT/dt = (1/C) × [P_heating - UA×(T_in - T_out) + P_solar + P_internal]
```

**COP Calculation:**
```
COP = Q_thermal / P_electrical
Q_thermal = ṁ × c_p × ΔT
```

**PI Controller:**
```
Correction = (Kp × current_error) + (Ki × average_error)
```

### Performance Metrics

| Metric | Target | Typical |
|--------|--------|---------|
| Temp Stability | ±0.3°C | ±0.2°C |
| Response Time | <30 min | 15-20 min |
| COP Improvement | +20% | +25-35% |
| Cost Reduction | 30% | 35-45% |
| Annual savings | €500 | €600-800 |

---
