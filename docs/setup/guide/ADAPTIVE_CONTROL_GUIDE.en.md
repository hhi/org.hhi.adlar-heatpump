# Adaptive Temperature Control
## User Guide v2.7.x

Intelligent temperature control for a **constant indoor temperature** with optimal efficiency.

---

## Table of Contents

1. [Overview](#overview)
2. [How does it work?](#how-does-it-work)
3. [Getting Started](#getting-started)
4. [Flow Cards](#flow-cards)
5. [Settings](#settings)
6. [Practical Examples](#practical-examples)
7. [Troubleshooting](#troubleshooting)
8. [Expert Mode](#expert-mode)
9. [FAQ](#faq)

---

## Overview

**Adaptive Control** automatically adjusts your heat pump's target temperature to maintain a **constant indoor temperature**. The system works together with your room thermostat or temperature sensor.

### Benefits

| Benefit | Description |
|---------|-------------|
| 🎯 **Constant temperature** | Stays within ±0.3°C of your desired temperature |
| ⚡ **Higher efficiency** | PI algorithm prevents on/off cycling |
| 🔄 **Automatic adjustment** | Responds to changing conditions |
| 💰 **Energy savings** | Up to 25% efficiency improvement possible |

### When to use?

- ✅ You have a thermostat or temperature sensor in the living room
- ✅ You want an **exact** indoor temperature (e.g., constant 21.0°C)
- ✅ Your heat pump often has temperature fluctuations
- ✅ You want to optimize efficiency

---

## How does it work?

Adaptive Control uses a **PI control system** (Proportional-Integral controller) — the same technology used in professional industrial systems.

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1️⃣ MEASURE                                                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Sensor sends temperature (e.g., 20.5°C)                       │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2️⃣ COMPARE                                                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Target: 21.0°C   Actual: 20.5°C   Deviation: -0.5°C          │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3️⃣ PI ALGORITHM                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ P-term: 3.0 × -0.5 = -1.5°C                                   │  │
│  │ I-term: historical correction                                │  │
│  │ Total: -1.5°C                                                 │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4️⃣ ADJUST                                                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Setpoint: 45°C → 43°C                                         │  │
│  │ Max 1x per 20 min │ Max ±3°C per time                         │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │
                                   └──────────── Next cycle ──────┐
                                                                  │
                                   ┌──────────────────────────────┘
                                   ▼
                            (Back to MEASURE)
```

### Features

| Feature | Value | Description |
|---------|-------|-------------|
| ⏱️ Control interval | 5 min | Evaluation frequency |
| 🔒 Anti-oscillation | 20 min | Minimum between adjustments |
| 🎯 Deadband | ±0.3°C | Tolerance zone (no action) |
| 🛡️ Safety limits | ±3°C / 15-28°C | Max adjustment and absolute range |
| 🔢 Smart Accumulator | Fractional → Integer | Collects small corrections |

### Why whole degrees?

The heat pump setpoint uses **steps of 1°C**. However, the PI controller calculates fractional adjustments (e.g., +0.7°C).

**Solution**: The **Smart Accumulator** collects fractional calculations:

```
Cycle 1: PI = +0.3°C → Accumulator: 0.3 → Wait
Cycle 2: PI = +0.4°C → Accumulator: 0.7 → Apply +1°C, Rest: -0.3
Cycle 3: PI = +0.2°C → Accumulator: -0.1 → Wait
```

### 4-Pillar Weighted Decision System (v2.6.0+)

Adaptive Control combines **4 intelligent components** in each decision:

| Component | Weight | Function |
|-----------|--------|----------|
| 🛋️ **Comfort** | 50% | PI control for stable indoor temperature |
| ⚡ **Efficiency** | 15% | COP optimization via flow temperature |
| 💰 **Cost** | 15% | Price optimization (pre-heating during cheap electricity) |
| 🏠 **Thermal** | 20% | Predictive control via learned building model |

**Example calculation:**

```
Comfort wants: +2.0°C (too cold)
Efficiency wants: -0.5°C (lower flow temp for better COP)
Cost wants: +1.0°C (cheap electricity, pre-heat)
Thermal wants: +0.5°C (building cools quickly, predictive heating)

Weighted total: (2.0×50% + -0.5×15% + 1.0×15% + 0.5×20%) = 1.15°C
```

**Result**: Heat pump setpoint increases by +1°C (rounded).

> [!NOTE]
> The weights are **configurable** via device settings (Expert mode). Default values are optimized for most situations.

---

## Getting Started

### Requirements

- **Homey Pro** with Adlar Heat Pump app v2.7.0+
- **Working heat pump** with stable connection
- **Temperature sensor** (Tado, Nest, Netatmo, Fibaro, Xiaomi, etc.)

**Optional for extended optimization (v2.7.0+):**

- ☁️ Wind speed sensor (for building model wind correction)
- ☀️ Solar radiation sensor (for solar gain optimization)
- 💰 Dynamic energy contract (for price optimization)

### Step 1: Temperature Data Flow

Create a flow that sends the indoor temperature:

**Tado thermostat:**
```
WHEN: Tado → Temperature has changed
THEN: Adlar Heat Pump → Send indoor temperature
      └─ Temperature: {{Tado temperature}}
```

**Fibaro sensor:**
```
WHEN: Fibaro Motion Sensor → Temperature has changed
THEN: Adlar Heat Pump → Send indoor temperature
      └─ Temperature: {{Fibaro temperature}}
```

**Multiple sensors (average):**
```
WHEN: Timer every 5 minutes
THEN: Adlar Heat Pump → Send indoor temperature
      └─ Temperature: {{(Sensor1 + Sensor2 + Sensor3) / 3}}
```

> [!TIP]
> Send temperature at least every 10 minutes. Data older than 10 minutes is considered outdated.

### Step 2: Enable

1. Open **Adlar Heat Pump** → **Settings** ⚙️
2. Scroll to **Adaptive Temperature Control**
3. Check: **Enable adaptive temperature control** ✅
4. Click **Save**

### Step 3: Verify

Check the following points:

- ✅ **External Indoor Temperature** capability shows current value
- ✅ Test flow: "Adaptive control recommends temperature adjustment" triggers
- ✅ Insights: chart shows continuous temperature data

---

## Flow Cards

### Action: Send indoor temperature

**ID:** `receive_external_indoor_temperature`

| Parameter | Type | Range | Example |
|-----------|------|-------|---------|
| Temperature | Number | -10 to +50°C | `{{Tado temperature}}` |

---

### Trigger: Temperature adjustment recommended

**ID:** `temperature_adjustment_recommended`

Triggers when adaptive control calculates a setpoint change.

| Token | Type | Description |
|-------|------|-------------|
| `current_temperature` | Number | Current setpoint (°C) |
| `recommended_temperature` | Number | Recommended setpoint (°C) |
| `adjustment` | Number | Calculated adjustment |
| `reason` | String | Explanation of calculation |
| `controller` | String | Controller type |

> [!NOTE]
> `adjustment` is the calculated recommendation and can be fractional. The actual adjustment is always a whole number.

**Example:**
```
WHEN: Adaptive control recommends temperature adjustment
AND: {{recommended_temperature}} - {{current_temperature}} > 2
THEN: Send notification
      └─ "Recommended: {{recommended_temperature}}°C - {{reason}}"
```

---

### Trigger: Simulated temperature adjusted

**ID:** `adaptive_simulation_update`

Triggers for monitoring/logging without actual adjustments.

| Token | Type | Description |
|-------|------|-------------|
| `simulated_target` | Number | Simulated target temperature |
| `actual_target` | Number | Actual setpoint |
| `delta` | Number | Difference |
| `comfort_component` | Number | Comfort contribution (°C) |
| `efficiency_component` | Number | Efficiency contribution (°C) |
| `cost_component` | Number | Cost contribution (°C) |
| `thermal_component` | Number | Thermal model contribution (°C) (v2.6.0+) |
| `reasoning` | String | Reasoning |

---

### Trigger: Adaptive status change

**ID:** `adaptive_status_change`

| Token | Type | Description |
|-------|------|-------------|
| `status` | String | `enabled` or `disabled` |
| `reason` | String | Reason for change |

**Example:**
```
WHEN: Adaptive status change
AND: Status is 'enabled'
THEN: Send notification "✅ Adaptive control activated"
```

---

## Settings

### Basic Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Enable adaptive temperature control | Off | Main switch |

### Expert Settings

> [!IMPORTANT]
> Expert settings are only visible with **Expert HVAC function cards** enabled.

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| **Kp** (Proportional Gain) | 3.0 | 0.5 - 10.0 | Direct response to deviation |
| **Ki** (Integral Gain) | 1.5 | 0.1 - 5.0 | Correction of long-term deviation |
| **Deadband** | 0.3°C | 0.1 - 1.0°C | Tolerance zone |

**Tuning tips:**

| Problem | Solution |
|---------|----------|
| Oscillation/overshoot | Decrease Kp (e.g., 3.0 → 2.0) |
| Too slow response | Increase Kp (e.g., 3.0 → 4.0) |
| Structural deviation | Increase Ki (e.g., 1.5 → 2.0) |
| Too many small corrections | Increase deadband (e.g., 0.3 → 0.5) |

---

## Practical Examples

### Basic Setup (Tado)

**Goal:** Constant 21°C with Tado thermostat

```
# Flow 1: Temperature data
WHEN: Tado Living Room → Temperature has changed
THEN: Adlar Heat Pump → Send indoor temperature
      └─ Temperature: {{Tado temperature}}

# Flow 2: Monitoring
WHEN: Adaptive control recommends temperature adjustment
THEN: Log "Recommended: {{recommended_temperature}}°C ({{reason}})"
```

**Expected behavior:**
- 20.5°C measured → Heat pump setpoint increases
- 21.3°C measured → Heat pump setpoint decreases
- Within 1-2 hours: stable at 21.0°C ±0.3°C

---

### Multiple rooms (average)

```
WHEN: Timer every 5 minutes
THEN:
  avg_temp = ({{Living room}} + {{Kitchen}} + {{Hallway}}) / 3
  Send indoor temperature → {{avg_temp}}
```

**Advantage:** Prevents overreaction to local fluctuations (e.g., sun on 1 sensor)

---

### Night/day mode

**Goal:** 21°C during day, 18°C at night

```
WHEN: Time is 23:00
THEN: Logic variable 'Target' = 18.0

WHEN: Time is 07:00
THEN: Logic variable 'Target' = 21.0

WHEN: Sensor → Temperature has changed
THEN: error = {{Target}} - {{Sensor}}
      adjusted = {{Sensor}} + {{error}}
      Send indoor temperature → {{adjusted}}
```

---

### Weather compensation

```
WHEN: Weather app → Outdoor temperature has changed
THEN:
  IF: Outdoor temp < 0°C  → offset = +1.0°C
  IF: Outdoor temp < -5°C → offset = +2.0°C
  ELSE: offset = 0°C

  Send indoor temperature → {{Sensor}} + {{offset}}
```

---

## Troubleshooting

### ❌ "No external indoor temperature configured"

**Cause:** No temperature data received

**Solution:**
1. Check if temperature flow is correct
2. Trigger flow manually for initial data
3. Check "External Indoor Temperature" capability

---

### ❌ No adjustments

| Cause | Check | Solution |
|-------|-------|----------|
| Within deadband | Deviation < 0.3°C? | Normal behavior |
| Throttling active | Logs: "Adjustment throttled" | Wait 20 min |
| Data outdated | Timestamp > 10 min? | Increase flow frequency |
| Disabled | Device settings | Enable |

---

### ❌ Temperature oscillates

**Symptom:** Temperature constantly overshoots target

**Possible causes & solutions:**

| Cause | Solution |
|-------|----------|
| Kp too high | Decrease to 2.0 |
| Ki too high | Decrease to 1.0 |
| Deadband too small | Increase to 0.5°C |
| Sensor near heat source | Relocate sensor or use average |

**Approach:**
1. Start by decreasing Kp (biggest impact)
2. Monitor 24 hours
3. Adjust Ki if needed

---

### ❌ Slow response

**Symptom:** Takes hours to reach target

| Cause | Solution |
|-------|----------|
| Kp too low | Increase to 4.0 or 5.0 |
| Large thermal mass | Increase Ki for better long-term correction |
| Setpoint range limited | Check manual setpoint |

---

## Expert Mode

> [!CAUTION]
> Only adjust expert settings if you have measurable problems and can test for 24-48 hours.

### PI Parameters

#### Kp — Proportional Gain

Determines direct response to current deviation.

**Formula:** `P-term = Kp × error`

| Kp | Error -0.5°C | Effect |
|----|--------------|--------|
| 2.0 | -1.0°C | Cautious |
| 3.0 | -1.5°C | **Default** |
| 5.0 | -2.5°C | Aggressive |

**Sweet spot:** 2.5 - 4.0

---

#### Ki — Integral Gain

Corrects long-term deviations that P-term doesn't solve.

**Formula:** `I-term = Ki × (average error last 2 hours)`

**Sweet spot:** 1.0 - 2.0

---

#### Deadband

Zone within which no action is taken.

**Example** (target 21.0°C, deadband 0.3°C):
- 20.8°C: Within zone → No action ✅
- 21.2°C: Within zone → No action ✅
- 21.4°C: Outside zone → Action ⚡

**Sweet spot:**
- **Comfort:** 0.2 - 0.4°C
- **Efficiency:** 0.4 - 0.6°C

---

### Tuning Strategy

#### Phase 1: Baseline (week 1)
- Use default values
- Monitor 7 days via Homey Insights
- Note: oscillation? too slow? overshoot?

#### Phase 2: Adjust Kp (week 2)
- **Oscillation:** Decrease 20% (3.0 → 2.4)
- **Too slow:** Increase 30% (3.0 → 3.9)
- Test 3 days

#### Phase 3: Adjust Ki (week 3)
- **Structurally too cold/warm:** Increase 20%
- **Slow oscillation:** Decrease 30%
- Test 5 days

#### Phase 4: Deadband (week 4)
- **Too many small adjustments:** +0.1°C
- **Too large fluctuations:** -0.1°C

---

### Advanced Problems

#### "Hunting Behavior"

**Symptom:** Oscillation with period 1-3 hours

```
19:00 → 20.5°C → +2.0°C adjustment
20:00 → 21.5°C → -1.5°C adjustment
21:00 → 20.7°C → +1.0°C adjustment
...
```

**Solution:**
1. Decrease Kp by 30%
2. Increase deadband to 0.4-0.5°C
3. Decrease Ki by 20%

---

#### "Integral Windup"

**Symptom:** Large overcorrection after long-term deviation

**Solution:**
1. Decrease Ki by 40%
2. Check external factors (sun, open window)
3. Reset I-term: adaptive control off/on

---

## FAQ

### General

**Should I leave adaptive control on 24/7?**
> Yes, the system learns from history and performs better the longer it runs.

**Does it work with underfloor heating?**
> Yes, but expect slower response (6-12 hours). Use higher Ki, lower Kp.

**Does it work with radiators?**
> Yes, faster response (1-3 hours). Default values are optimized for this.

**Can I control multiple zones?**
> One adaptive control per heat pump. For multiple zones: use average of sensors.

---

### Technical

**What happens on Homey restart?**
> Adaptive control restarts automatically with saved history. First check within 5 minutes.

**What if temperature sensor fails?**
> After 10 minutes, adaptive control pauses. Heat pump returns to manual setpoint.

**Can I adjust the 20-minute throttling?**
> No, this is a fixed safety value.

---

### Privacy & Security

**Is data sent to the cloud?**
> No, all calculations happen locally on Homey.

**What are the safety limits?**
> Absolute range: 15-28°C. Max per adjustment: ±3°C. Hardcoded for safety.

**Can adaptive control damage the heat pump?**
> No, 20-minute throttling prevents excessive start/stop cycles.

---
