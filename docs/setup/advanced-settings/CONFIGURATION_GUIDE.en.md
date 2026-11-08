# Adlar Heat Pump App - Configuration Guide

This guide describes all configurable settings of the Adlar Heat Pump Homey app. Each setting is explained with practical examples and recommendations.

---

## 🔗 Settings Groups & Dependencies

| # | Group | Requires | Optional |
|---|-------|----------|----------|
| 1 | **Connection Settings** | - | - |
| 2 | **COP Settings** | - | Power measurement (for accuracy) |
| 3 | **Feature Settings** | App restart | - |
| 4 | **Flow Card Controls** | App restart | - |
| 5 | **Adaptive control** (six groups; weighting factors: row 10) | Indoor temperature via flow card, Desired Indoor Temperature | - |
| 6 | **Building Model Learning** | - | - |
| 7 | **Building Insights** | Building Model Learning ON | Min. confidence |
| 8 | **Energy Price Optimization** | Adaptive Control ON, Internet | Dynamic tariff |
| 9 | **COP Optimization** | COP Calculation ON, Adaptive Control | 1+ week data |
| 10 | **Adaptive control: weighting factors** | Adaptive control on | - |
| 11 | **Diagnostics** | - | - |
| 12 | **Energy Management** | - | Power measurement |

```
┌──────────────────┐
│ 1. Connection    │  Base - always needed
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ 2. COP Settings  │────▶│ 9. COP Optimizer │
└──────────────────┘     └──────────────────┘
         │                        ▲
         │                        │
         ▼                        │
┌──────────────────┐              │
│ 5. Adaptive Temp │──────────────┤
│    Control       │              │
└────────┬─────────┘              │
         │                        │
    ┌────┴────┬───────────────────┤
    ▼         ▼                   │
┌────────┐ ┌────────────────┐     │
│ 10.    │ │ 8. Price       │─────┘
│Weights │ │    Optimizer   │
└────────┘ └────────────────┘

┌──────────────────┐     ┌──────────────────┐
│ 6. Building      │────▶│ 7. Building      │
│    Model         │     │    Insights      │
└──────────────────┘     └──────────────────┘
```

---

## 📖 Table of Contents

1. [Connection Settings](#1-connection-settings)
2. [COP (Coefficient of Performance) Settings](#2-cop-coefficient-of-performance-settings)
3. [Feature Settings](#3-feature-settings)
4. [Flow Card Handling](#4-flow-card-handling)
5. [Adaptive control](#5-adaptive-control)
6. [Building Model Learning](#6-building-model-learning)
7. [Building Insights & Recommendations](#7-building-insights--recommendations)
8. [Energy Price Optimization](#8-energy-price-optimization)
9. [COP Optimization](#9-cop-optimization)
10. [Adaptive control: weighting factors](#10-adaptive-control-weighting-factors)
11. [Diagnostics](#11-diagnostics)
12. [Energy Management](#12-energy-management)

---

## 1. Connection Settings

These settings are required to connect to your Adlar heat pump via the local Tuya protocol.

### Device ID
- **Function**: Unique identification of your heat pump
- **Format**: Alphanumeric code (e.g., `bf1234567890abcdef`)
- **How to obtain**: Via Tuya IoT Platform or during pairing process
- **Note**: Changing triggers automatic reconnection

### Local Key
- **Function**: Security key for encrypted communication
- **Format**: Hexadecimal string (e.g., `a1b2c3d4e5f6g7h8`)
- **How to obtain**: Via Tuya IoT Platform or during pairing process
- **Security**: Stored encrypted in Homey

### IP Address
- **Function**: Local network address of your heat pump
- **Value**: IPv4 format (e.g., `192.168.1.100`)
- **Recommendation**: Set a static IP address via your router (DHCP reservation)
- **Why static IP**: Prevents connection issues after router restart

### Protocol Version
- **Function**: Tuya communication protocol version
- **Options**:
  - **3.3** (default) - Most common for older devices
  - **3.4** - Newer devices from 2020 onwards
  - **3.5** - Latest protocol with improved security
- **How to choose**: Check in Tuya IoT Platform or use 3.3 as default
- **Automatic reconnection**: Device reconnects automatically after change

---

## 2. COP (Coefficient of Performance) Settings

COP measures the efficiency of your heat pump: how much heat (kW) you get per consumed electricity (kW). For example: COP 4.0 means 4 kW heat from 1 kW electricity.

### Enable COP Calculation
- **Default**: Enabled
- **Function**: Automatically calculates the efficiency of your heat pump
- **Why useful**:
  - Performance insights
  - Early detection of problems (COP < 2.0 may indicate malfunction)
  - Basis for optimization algorithms
- **Recommendation**: Always keep enabled

### COP Calculation Method
The app supports 6 different calculation methods with varying accuracy:

| Method | Accuracy | Required Sensors | When to Use |
|--------|----------|------------------|-------------|
| **Auto** (recommended) | Best available | Automatic | Default - chooses best method |
| Direct thermal | ±5% | Thermal power sensor | Most accurate, if available |
| Power module | ±8% | External power meter | With smart plug or kWh meter |
| Refrigerant circuit | ±12% | Temperature + pressure sensors | Standard internal sensors |
| Carnot estimate | ±15% | In/out temperatures | Theoretical approximation |
| Valve correlation | ±20% | Valve positions | Based on system behavior |
| Temperature difference | ±30% | Only temperatures | Least accurate, basic estimate |

### COP Outlier Detection
- **Default**: Enabled
- **Function**: Detects unrealistic COP values indicating:
  - Sensor malfunctions
  - Incorrect measurements
  - Temporary system deviations
- **Why important**: Prevents erroneous data from distorting your averages and optimizations

### Minimum Valid COP
- **Default**: 0.5
- **Range**: 0.1 - 2.0
- **Function**: Values below this threshold are marked as outliers

### Maximum Valid COP
- **Default**: 8.0
- **Range**: 4.0 - 15.0
- **Function**: Values above this threshold are marked as outliers

---

## 3. Feature Settings

These settings determine which features are visible in the Homey app interface. **Note: Changes require app restart and closing.**

### Show Curve Control Settings
- **Default**: Disabled
- **Function**: Shows/hides adjustment controls for heating and hot water curves
- **Flow cards**: Always work, regardless of this setting

### Internal Power Measurement Capabilities
- **Default**: Disabled
- **Function**: Shows/hides 9 DPS power measurements (power consumption, voltage, current)
- **When to enable**: Your heat pump has built-in power measurement

### Slider Management Capabilities
- **Default**: Disabled
- **Function**: Shows/hides 3 sliders (hot water temperature, water mode, volume)

### Intelligent Energy Tracking
- **Default**: Enabled
- **Function**: Smart selection of power measurement source
- **How it works**:
  1. **Priority 1**: External power measurement (via flow card)
  2. **Priority 2**: Internal sensors (if available)
- **Homey Energy Dashboard**: Device appears automatically with accurate data

---

## 4. Flow Card Handling

Determines which flow cards are visible in the Homey Flow editor. **Restart recommended after changes.**

### General Options (for all categories):
- **Disabled**: Flow cards always hidden
- **Auto** (recommended): Show only if relevant sensors are available
- **Force enabled**: Always show, even without sensors

### Available Categories:
| Category | Default | Description |
|----------|---------|-------------|
| Temperature related alarms | Auto | Triggers for temperature thresholds |
| Voltage related alarms | Auto | Triggers for voltage deviations |
| Current related alarms | Auto | Triggers for current deviations |
| Power related alarms | Auto | Triggers for power deviations |
| Pulse-step related alarms | Auto | Triggers for valve/compressor positions |
| Status change alarms | Auto | Triggers for operational status changes |
| Efficiency (S)COP alarms | Auto | Triggers for COP and SCOP efficiency |

### Expert HVAC Function Cards
- **Default**: Enabled
- **Function**: Advanced diagnostic triggers (compressor, fan motor, water flow)
- **Target audience**: HVAC professionals, advanced users

### Daily Disconnect Count
- **Default**: Disabled
- **Function**: Counts how many times connection was lost
- **Capability**: When enabled, adds the `adlar_daily_disconnect_count` sensor to your device
- **Persistence**: Setting persists through app updates and Homey restarts
- **Normal value**: 0-2 per day
- **Problematic**: > 5 per day → improve WiFi signal or set static IP

---

## 5. Adaptive control

Calculates a recommended water temperature (Simulated Target Temperature) every
5 minutes. The app does not change the setpoint itself: only a flow with the
card **Adaptive control recommends temperature adjustment** carries out the
recommendation. A step-by-step explanation is in the
[control settings guide](../guide/CONTROL_SETTINGS_GUIDE.en.md).

Since 3.6.2 the settings are in six groups. Homey always shows all of them; the
group title says in which control mode they count.

| Group | Settings | Counts in |
| --- | --- | --- |
| Adaptive control | Adaptive control on, control mode, lowest and highest water temperature | All modes |
| Adaptive control: heating curve (Positional) | Basis of the recommendation, copy once, water at −15 °C and +15 °C | Positional |
| Adaptive control: fine-tuning (Positional – Manual) | Kp, Ti | Positional – Manual |
| Adaptive control: fine-tuning (Classic) | Kp, Ki, deadband | Classic |
| Adaptive control: coast (Classic, Positional – Manual) | Coast on, recommendation below the water temperature, start threshold, share, maximum duration | Classic, Positional – Manual |
| Adaptive control: weighting factors | See [section 10](#10-adaptive-control-weighting-factors) | See per factor |

### Adaptive control on

- **Default**: Disabled
- **Function**: Turns the calculation of the recommendation on
- **Requirements**:
  - Indoor temperature via the card **Send indoor temperature to heat pump**
  - A value for **Desired Indoor Temperature**; without it, every cycle is
    skipped (only visible in the debug log)
  - A flow that carries out the recommendation, if the app is to actually
    control
- **Building model**: has its own switch and also learns while the control is
  off

### Fine-tuning (Classic)

Group **Adaptive control: fine-tuning (Classic)**. Only counts in the control
mode Classic.

#### Kp: proportional gain

- **Default**: 5.0
- **Range**: 0.5 - 10.0
- **Function**: Determines how quickly system responds to current error
- **Higher value**: Faster correction, risk of overshoot
- **Lower value**: More stable control, slower correction

#### Ki: integral gain

- **Default**: 1.5
- **Range**: 0.1 - 5.0
- **Function**: Eliminates persistent deviations (steady-state error)

#### Deadband

- **Default**: 0.3°C
- **Range**: 0.1 - 1.0°C
- **Function**: Tolerance before adjustments are made

### Lowest and highest water temperature in the recommendation (v3.4.3+)

Group **Adaptive control**. Counts in all control modes.


- **Minimum — default**: 18°C, **range**: 15 - 30°C
- **Maximum — default**: 60°C (Tuya: 65°C), **range**: 25 - 60°C (Tuya: 25 -
  65°C)
- **Function**: Lowest and highest water temperature the adaptive control will
  recommend
- **Rule**: The maximum must be at least 2°C above the minimum; otherwise the
  change is rejected
- **Heat pump limits (v3.4.4+)**: The recommendation also stays within the
  heating limits set in the heat pump (Aurora I/II: P110/P111, Aurora III: zone
  1 limits). The adaptive control diagnostics show which limit applies
- **Floor heating**: Set both around the range of your own heating curve (e.g.
  2°C below and 3°C above) and leave room for cold weather

### Control mode and heating curve (v3.5.0+)

- **Control mode — default**: Classic
  - **Classic**: a small step up or down every cycle; the steps add up (previous
    behaviour)
  - **Positional – Radiators** (experimental): Kp 3, Ti 3 h, coast off
  - **Positional – Floor heating** (experimental): Kp 3, Ti 6 h, coast off
  - **Positional – Manual** (experimental): Kp and Ti from the group
    fine-tuning (Positional – Manual) and the switch **Coast on**
  - Positional: advice = heating curve + PI correction with a true integral,
    without a wide dead zone; the setpoint stays calm, also with a flow that
    applies every advice
- **Coast**: with Classic and Positional – Manual the switch **Coast on** applies;
  Radiators and Floor heating switch coast off
- **Basis of the recommendation — default**: App curve
  - **App curve**: water temperature at −15 °C and at +15 °C outdoor. Starting
    values: Radiators 50 / 35, Floor heating 35 / 27, otherwise 45 / 30;
    prefilled when you choose the control mode, as long as you have not changed
    them yourself
  - **Heat pump curve (followed continuously)** (Aurora I/II: DIY curve, only while DIY is switched
    on; Aurora III: climate curve): only when you have set it yourself; when DIY
    is off or the curve is not usable, the app curve applies. Tuya does not have
    this choice
- **Diagnostics**: `adaptive_control_diagnostics` shows the mode, the emitter
  system, Kp and Ti with their source, the basis with its source and the P and I
  terms

#### Adjusting the heating curve

| What you notice | Adjustment |
| --- | --- |
| Too cold in frost, fine in mild weather | Value at −15 °C +1–2 |
| Too cold in mild weather | Value at +15 °C +1–2 |
| Slightly too cold everywhere | Both values +1 |
| Too warm | The other way round: lower |

- Change one value at a time and wait a day (floor heating: two days). In the
  diagnostics, an I term that stays above 0 points to a heating curve that is
  too low, below 0 to one that is too high

#### Switching from a fixed curve

Did you use a fixed curve of the heat pump (Aurora I/II: curve selection
HH1–HH8 or HL1–HL8; Tuya: heating curve H1–H8 or L1–L8)? Note that curve and
choose it at **Copy once into the app curve**: after saving, the app
fills in the two values from the table. Then set the curve selection to OFF.
After OFF, the app can no longer read the curve.

| Curve | −15 °C | +15 °C | Curve | −15 °C | +15 °C |
| --- | --- | --- | --- | --- | --- |
| HH1 | 54 | 51 | HL1 | 37 | 33 |
| HH2 | 54 | 46 | HL2 | 34 | 31 |
| HH3 | 53 | 42 | HL3 | 32 | 30 |
| HH4 | 49 | 46 | HL4 | 34 | 29 |
| HH5 | 49 | 41 | HL5 | 32 | 29 |
| HH6 | 44 | 41 | HL6 | 30 | 27 |
| HH7 | 44 | 36 | HL7 | 28 | 27 |
| HH8 | 39 | 36 | HL8 | 28 | 25 |

- Each curve is a staircase of 1 °C steps; the values follow the middle of
  that staircase in the graphs of the heat pump manual, rounded to whole
  degrees
- The new values show once you reopen the settings
- Aurora I/II with a DIY heating curve: choose **DIY heating curve of the heat
  pump (L28/L29)**. The app takes L29 as the value at −15 °C and L29 + 30 × L28
  as the value at +15 °C (e.g. L28 = −0.5 and L29 = 55 gives 55 / 40). A slope
  that is not negative, or values outside the app curve, are rejected

**Which control mode do I choose?**

| Situation | Choice |
| --- | --- |
| No flow that applies the advice | Does not matter: advice only |
| The current control works well | Classic |
| Setpoint creeps away or swings, radiators | Positional – Radiators |
| Setpoint creeps away, floor heating | Positional – Floor heating |
| Mixed: floor and radiators | See below |
| Fan coil units | Positional – Radiators |
| Heating curve unknown | Starting values, then adjust |

- **Mixed or fan coil units**: not tested. With mixed emitters, Positional –
  Floor heating if the floor is the largest or slowest emitter, otherwise
  Positional – Radiators
- **Aurora I/II and Tuya**: the heat pump only keeps a new setpoint when the
  heating curve selection (Tuya: heating curve) is OFF; otherwise neither mode
  applies the advice. The app then calculates the heating curve itself
- **Heat pump curve** only with your own DIY curve: when DIY is off, the app
  uses the app curve. Take over a fixed curve with the table above
- **Trying it safely**: turn off the flow that applies the advice, choose a
  positional control mode and compare the simulated target
  (`adlar_simulated_target`) with the heating curve for a day
- **Switching back** is always possible; the integral and the accumulated
  correction then start at 0
- **Night setback and thermostat schedule**: a heat pump needs hours to warm the
  house up again, in every control mode. With radiators, let the schedule go up
  2–4 hours before the desired time. With floor heating, keep it constant or
  lower it by at most 1 °C; otherwise Positional heats up in the morning, with
  more compressor starts
- **Optimizers** (price, COP): shift the room target in Positional, by at most
  1.5 °C; the heating curve follows. With the COP optimizer on, the house can
  stay slightly below the room target on average. The thermal component of the
  building model does not take part in Positional
- **Experimental**: Positional has seen little testing in practice

### Fine-tuning (Positional – Manual)

Group **Adaptive control: fine-tuning (Positional – Manual)**. Only counts in
Positional – Manual; Radiators and Floor heating use fixed values.

#### Kp: degrees of water per degree indoors

- **Default**: 3, **range**: 1 - 8
- **Function**: The recommendation rises by this many degrees per degree that it
  is too cold indoors

#### Ti: integration time

- **Default**: 3 hours, **range**: 1 - 12 hours
- **Function**: How fast a persistent indoor deviation is removed; shorter is
  faster

### Coast (Classic, Positional – Manual)

Group **Adaptive control: coast (Classic, Positional – Manual)**. Radiators and
Floor heating do not use coast.

#### Coast on

- **Default**: On
- **Function**: When it is too warm indoors, coast sets the recommendation below
  the current water temperature, so the compressor stays off and the house cools
  down by itself

#### Coast: recommendation below the water temperature (v2.8.0+)

- **Default**: 1.0°C
- **Range**: 0.5 - 5.0°C
- **Function**: Degrees below outlet temperature for coast target value
- **Lower**: Compressor stops sooner, less heating
- **Higher**: More cautious coast, more margin

#### Coast: start threshold above desired (v2.8.0+)

- **Default**: 0.3°C
- **Range**: 0.1 - 1.0°C
- **Function**: Overshoot margin above setpoint for coast mode activation

#### Coast: share in the recommendation (v2.8.0+)

- **Default**: 0.80
- **Range**: 0.60 - 0.95
- **Function**: Weight share of coast in weighted decision (dominant when active)

#### Coast: maximum duration (Aurora)

- **Default**: 24 cycles of 5 minutes (2 hours), **range**: 6 - 48
- **Function**: Coast stops after this many cycles at the latest, even if it is
  still too warm indoors. Tuya does not have this setting

---

## 6. Building Model Learning

Machine learning algorithm that learns the thermal properties of your home.

### Enable Building Model Learning
- **Default**: Disabled
- **Function**: Learns 4 thermal parameters (C, UA, g, P_int)
- **Learning time**: 24-72 hours for basic model, 2-4 weeks for accurate model
- **Algorithm**: Recursive Least Squares (RLS) with forgetting factor

### Forgetting Factor (Expert Setting)
- **Default**: 0.999
- **Range**: 0.9985 - 0.9995
- **Function**: How quickly the model adapts to changes. Higher = more stable, better confidence (~75%). Lower = faster adaptation to seasonal changes.
- **Applies**: Immediately (v3.5.0+); the learned model is kept
- **Migration (v3.6.2)**: A value below 0.9985 from an older version is set to
  0.999. Since v3.4.2 such a value blocked saving any setting on that device

### Building Type
- **Default**: Average (typical NL house)
- **Options**:
  - **Light**: Wood/prefab, basic insulation, fast temp changes
  - **Average**: Brick, cavity walls, double glazing (typical NL house)
  - **Heavy**: Concrete/stone, good insulation, HR++ glass, stable
  - **Passive**: Passive house, HR+++ glass, airtight, heat recovery
- **Change**: Takes effect immediately; learning continues from the new profile values with half of the collected samples

### Emitter System and Buffer Tank (v3.7.0+)

- **Function**: Start value for the emitter delay, the time between the heat the
  heat pump delivers and the heat that reaches the room. Without this delay the
  model sees the heat of a buffer tank or floor only later, and makes the
  thermal mass (C), the heat loss (UA) and the internal gains too large
- **Emitter system**: Automatic (default), Radiators / convectors or Floor
  heating. Radiators start at 30 min, floor heating at 180 min. Automatic takes
  the control mode (Positional – Radiators/Floor heating), otherwise the heat
  pump mode when it tells floor from radiators; otherwise 60 min
- **Buffer tank**: Volume in litres (0–2000, default 0). Each litre adds 1
  minute
- **Example**: Radiators with a 120 litre buffer tank: 30 + 120 = 150 min
- **Learning**: After about 3 days of heating the model chooses the delay that
  explains the measurements best (0–360 min). See "ML Emitter Delay"; the title
  says whether the value is learned or the start value
- **Changing**: Takes effect immediately; a learned value is dropped and
  determined again within 6 hours. If the delay changes by 60 minutes or more,
  the building model starts again from the selected building type (keeping half
  of the samples)
- **On the update to 3.7.0**: A model that is stuck (thermal mass at 40 kWh/°C,
  time constant above 500 hours or internal gains above 1 kW) starts again from
  the building type. Fill in the buffer tank before the update; then there is
  only one restart

### Reset Building Model Learning
- **Default**: Disabled
- **Type**: One-time action (checkbox)
- **Function**: Resets all learned building parameters (C, UA, τ, g, P_int) and restarts with selected building profile
- **Automatic reset**: Automatically disables after reset
- **When to use**: Diagnostics show corrupt state (negative values, 0% confidence with many samples)

### Dynamic Internal Heat Gains
- **Default**: Enabled
- **Function**: Accounts for varying heat from people/appliances by time of day
- **Day Pattern** (times in the Homey time zone, v3.5.0+):
  - Night (23:00-06:00): 40% (sleeping)
  - Day (06:00-18:00): 100% (normal)
  - Evening (18:00-23:00): 180% (cooking, TV)
- **Accuracy improvement**: ~10-15%
- **Applies**: Immediately (v3.5.0+); learning continues from the values of the
  building profile, with half of the collected samples

---

## 7. Building Insights & Recommendations

Automated analysis of the thermal building model with energy-saving recommendations and ROI estimates.

### Enable Building Insights
- **Default**: Disabled
- **Function**: Analyze thermal building model and provide energy-saving recommendations
- **Learning time**: Insights appear after about 1–2 days of learning
- **Requirements**: Building model learning must be enabled

### Minimum Confidence
- **Default**: 70%
- **Range**: 50% - 90%
- **Function**: Only show insights when building model confidence exceeds this threshold
- **70%**: about 1–2 days of learning
- **Lower values**: Earlier insights, less accuracy

---

## 8. Energy Price Optimization

Automatic optimization based on day-ahead energy prices (dynamic contract required).

### Enable Price Optimization
- **Default**: Disabled
- **Function**: Utilize low prices, avoid high prices
- **Data source**: EnergyZero API (free, no account needed)

### Price Calculation Mode
- **Default**: All-in price (complete costs)
- **Options**:
  - **Market price**: Spot price + VAT
  - **Market price+**: Spot price + supplier markup + VAT
  - **All-in price**: Complete costs including energy tax

### Supplier Markup (€/kWh incl. VAT)
- **Default**: €0.0182/kWh
- **Range**: €0 - €0.50/kWh
- **Function**: Your supplier markup per kWh, including VAT
- **Tip**: Check your energy contract for this value

### Energy Tax (€/kWh incl. VAT)
- **Default**: €0.11085/kWh
- **Range**: €0 - €0.50/kWh
- **Function**: Energy tax per kWh, including VAT
- **Netherlands 2024**: ~€0.11085

### VAT Percentage
- **Default**: 21%
- **Range**: 0 - 30%
- **Function**: VAT percentage applied to market price
- **Netherlands**: 21% (standard), 9% (reduced rate)

### Price Thresholds

Thresholds are based on 2024 spot price percentiles:

| Threshold | Default | Percentile | Action |
|-----------|---------|------------|--------|
| Very Low | €0.04/kWh | P10 | Maximum pre-heating (+1.5°C) |
| Low | €0.06/kWh | P30 | Moderate pre-heating (+0.75°C) |
| Normal | €0.10/kWh | P70 | Maintain (0°C adjustment) |
| High | €0.12/kWh | P90 | Slight reduction (-0.5°C) |

> [!NOTE]
> Prices above the "High" threshold trigger "Very high" action with -1.0°C reduction.

### Maximum Pre-heat Offset
- **Default**: 1.5°C
- **Range**: 0.0 - 3.0°C
- **Function**: Limits how much warmer than desired during very low price periods

### Daily Cost Warning Threshold
- **Default**: €10/day
- **Range**: €1 - €50/day
- **Function**: Trigger flow card when exceeded

### Price Block Size
- **Default**: 4 hours
- **Range**: 1 - 12 hours
- **Function**: Size of cheapest/most expensive blocks for day-ahead planning
- **Used by**: 'Cheapest block started' trigger and block detection

### Expensive Block Warning Time
- **Default**: 2 hours
- **Range**: 1 - 4 hours
- **Function**: Trigger 'expensive period approaching' flow N hours before expensive block starts
- **Use**: To pre-heat building

### Price Trend Analysis Window
- **Default**: 6 hours
- **Range**: 3 - 24 hours
- **Function**: Number of future hours to analyze for price trend detection (rising/falling/stable)
- **Used by**: 'Price trend changed' trigger

---

## 9. COP Optimization

Automatic supply temperature optimization for maximum efficiency.

### Enable COP Optimization
- **Default**: Disabled
- **Function**: Learns optimal supply temperature per outdoor temperature
- **Requirements**:
  - COP calculation active
  - Minimum 1 week of data
  - Adaptive control enabled
- **Learning time**: 2-4 weeks for reliable optimization

### Minimum Acceptable COP
- **Default**: 2.5
- **Range**: 1.5 - 4.0
- **Function**: Trigger for optimization action when COP falls below value

### Target COP
- **Default**: 3.5
- **Range**: 2.0 - 5.0
- **Function**: Target value for optimization algorithm

### Optimization Strategy
- **Default**: Balanced (recommended)
- **Options**:
  - **Conservative**: Slow, safe - small steps, long observation
  - **Balanced**: Moderate steps, normal observation (recommended)
  - **Aggressive**: Fast, experimental - large steps, quick iteration

---

## 10. Adaptive control: weighting factors

These four weighting factors together determine how the control makes decisions. **Values are automatically normalized to total 100%.** Comfort and Building model only count in Classic. In Positional, Efficiency and Cost only shift the room target, by at most 1.5 °C together. When coast mode is active, the coast component dominates (80% default).

### Comfort — Classic only

- **Default**: 50%
- **Range**: 0 - 100%
- **Function**: Weight for PI temperature control
- **High comfort** (70-80%): Temperature always stable within ±0.3°C

### Efficiency

- **Default**: 15%
- **Range**: 0 - 100%
- **Function**: Weight for COP optimization
- **High efficiency** (30-40%): Focus on maximum COP

### Cost

- **Default**: 15%
- **Range**: 0 - 100%
- **Function**: Weight for price optimization
- **Dynamic multiplier** (v2.6.0):
  - HIGH prices (reduce): weight ×2.0 to ×3.0
  - LOW prices (preheat): weight ×1.2 to ×1.5
- **High cost** (25-35%): Maximum savings on energy costs

### Building model — Classic only

- **Default**: 20%
- **Range**: 0 - 50%
- **Function**: Weight for thermal predictions (τ/C/UA)
- **Requirements**: Building model confidence ≥50%
- **0%**: Disabled (no influence from building model)

**Practical Profiles**:

| Profile | Comfort | Efficiency | Cost | Thermal | Use Case |
|---------|---------|------------|------|---------|----------|
| Family with Baby | 80% | 5% | 5% | 10% | Max comfort |
| Home Worker | 50% | 15% | 15% | 20% | Balanced (default) |
| Budget Focus | 35% | 10% | 35% | 20% | Dynamic contract |
| Often Away | 30% | 40% | 10% | 20% | Max efficiency |

---

## 11. Diagnostics

Tools for troubleshooting and system analysis.

### Force Reconnection
- **Type**: One-time action (checkbox)
- **Function**: Immediate reconnect to Tuya device
- **When to use**:
  - Status shows "Disconnected"
  - After WiFi router restart
  - After heat pump firmware update

### Generate Capability Diagnostics Report
- **Type**: One-time action (checkbox)
- **Function**: Detailed overview of all capabilities status
- **Output**: Logged in Homey app logs

### Log Level
- **Default**: ERROR (recommended for production)
- **Options**:
  - **ERROR**: Only critical errors (recommended)
  - **WARN**: Errors + warnings
  - **INFO**: Errors + warnings + important events
  - **DEBUG**: All logs (troubleshooting) - use temporarily!

---

## 12. Energy Management

Management of energy counters for tracking and reporting.

### Reset External Energy Total Counter
- **Type**: One-time action (checkbox)
- **Function**: Sets the cumulative energy counter to zero
- **Data source**: Measurements via flow card "Enter external power measurement"
- **Note**: Action is irreversible, data will be lost

### Reset External Energy Daily Counter
- **Type**: One-time action (checkbox)
- **Function**: Sets the daily energy counter to zero
- **Automatic reset**: Normally happens automatically at 00:00

---

## 💡 Common Configuration Scenarios

### Scenario 1: "I just want a stable room temperature"
```
✅ Adaptive Temperature Control: ON
   - Kp: 5.0, Ki: 1.5, Deadband: 0.3°C
✅ Building Model Learning: ON
   - Building type: Average (or your type)
   - Dynamic P_int: ON
   - Seasonal g: ON
❌ Price Optimization: OFF (first get comfort under control)
❌ COP Optimization: OFF (first let system stabilize)

Priorities:
- Comfort: 80%
- Efficiency: 5%
- Cost: 5%
- Thermal: 10%
```

### Scenario 2: "Maximum savings, have dynamic contract"
```
✅ Adaptive Temperature Control: ON
✅ Building Model Learning: ON
✅ Price Optimization: ON
   - Price calculation mode: All-in price
   - Thresholds: Check your contract percentages
   - Max preheat: 1.5°C
✅ COP Optimization: ON (after 2 weeks)
   - Min COP: 2.5
   - Target: 3.5
   - Strategy: Balanced

Priorities:
- Comfort: 35%
- Efficiency: 10%
- Cost: 35%
- Thermal: 20%
```

### Scenario 3: "Passive house, efficiency is key"
```
✅ Adaptive Temperature Control: ON
   - Kp: 2.0 (lower for slow thermal mass)
   - Ki: 1.0
   - Deadband: 0.5°C (more tolerance)
✅ Building Model Learning: ON
   - Building type: Passive
   - Forgetting factor: 0.999 (slow adaptation)
✅ COP Optimization: ON
   - Strategy: Aggressive (passive house tolerates experiments)

Priorities:
- Comfort: 25%
- Efficiency: 40%
- Cost: 10%
- Thermal: 25%
```

### Scenario 4: "Often away, minimal supervision"
```
✅ Intelligent energy tracking: ON
✅ COP calculation: ON
   - Outlier detection: ON
✅ Building model: ON (for insights)
❌ All optimization: OFF (set-and-forget)
✅ Flow alerts: Auto
✅ Daily cost threshold: €10 (notification on high costs)

Use flows for:
- Notification when COP < 2.0 (possible problem)
- Notification when disconnect > 5/day
- Notification when daily cost > €10
```

---
