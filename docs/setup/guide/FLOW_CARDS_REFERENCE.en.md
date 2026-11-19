# Flow cards: reference

This reference describes every Flow card of the app: what the card does, which
drivers it exists for, its fields and an example.

It is generated from the cards in the app itself; do not edit it by hand.

Cards with above or below and a threshold fire on every reading that changes
enough while the value meets the condition, so not once when the threshold is
crossed. When such a card sends a notification, use a Yes/No variable to prevent
repeats (see the example for the water flow alert).

A worked introduction with scenarios is in
[FLOW_CARDS_GUIDE.en.md](FLOW_CARDS_GUIDE.en.md).

## Contents

- [Triggers](#triggers)
- [Conditions](#conditions)
- [Actions](#actions)

## Triggers

### Triggers: Control and modes

#### Heating mode changed

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when the heating mode changes

Tokens: Heating mode, Previous heating mode

**Example:** get a notification when someone changes the mode on the control
panel.

```text
WHEN Heating mode changed
THEN Send a push notification "Mode is now [Heating mode]"
```

#### Water mode changed

**Trigger** · Aurora I/II via Tuya

Triggers when the water control temperature mode changes

Tokens: Water mode, Previous water mode

**Example:** this is an installation setting that normally does not change;
create a notification when it does.

```text
WHEN Water mode changed
THEN Create a notification "Water mode changed to [Water mode]"
```

#### Work mode changed

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus

Triggers when the work mode changes (ECO, Normal, Boost)

Tokens: Work mode, Previous work mode

**Example:** keep track of when Boost switches on.

```text
WHEN Work mode changed
AND Work mode is Boost
THEN Send a push notification "Boost is on"
```

### Triggers: Temperatures, faults and alerts

#### Ambient temperature changed

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggered when ambient temperature has changed above or below a specified
level - useful for weather compensation

- Condition: above, below
- Temperature : number, -30 to 50 °C

Tokens: Current ambient temperature

**Example:** switch a virtual switch Heating season off when it gets warm
outside. A switch that is already off stays off, so repeats do no harm.

```text
WHEN Ambient temperature changed above 18°C
THEN Turn Heating season off (virtual switch)
```

#### Coiler temperature alert

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when electricity coiler temperature goes above or below a specified
level

- Condition: above, below
- Temperature : number, -20 to 80 °C

Tokens: Current Coiler temperature, Threshold temperature

**Example:** record when the outdoor coil gets very cold, to help look for
icing.

```text
WHEN Coiler temperature below -15°C
THEN Create a notification "[Current Coiler temperature] °C"
```

#### Compressor efficiency alert (Expert)

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Aurora I/II via Tuya, Aurora III via Modbus: Triggers when compressor frequency
goes above or below a specified level. Requires 'Enable expert feature cards' in
device settings.

Aurora I/II via Modbus: Triggers when compressor frequency goes above or below a
specified level.

- Condition: above, below
- Frequency : number, 10 to 200 Hz

Tokens: Current frequency, Threshold frequency

**Example:** record when the compressor runs at high speed. The Tuya version
needs the Expert cards setting switched on.

```text
WHEN Compressor frequency above 90 Hz
THEN Create a notification "Compressor at [Current frequency] Hz"
```

#### Discharge temperature alert

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when discharge temperature goes above or below a specified level

- Condition: above, below
- Temperature : number, 0 to 120 °C

Tokens: Current Discharge temperature, Threshold temperature

**Example:** send a notification when the compressor gets too hot.

```text
WHEN Discharge temperature above 105°C
THEN Send a push notification "Discharge above 105 °C, check the heat pump"
```

#### Economizer inlet temperature alert

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus

Triggers when economizer inlet temperature goes above or below a specified level

- Condition: above, below
- Temperature : number, -30 to 80 °C

Tokens: Current Economizer inlet temperature, Threshold temperature

**Example:** follow the economizer (EVI heat exchanger) when looking for a
fault.

```text
WHEN Economizer inlet temperature below -10°C
THEN Create a notification "[Current Economizer inlet temperature] °C"
```

#### Economizer outlet temperature alert

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus

Triggers when economizer outlet temperature goes above or below a specified
level

- Condition: above, below
- Temperature : number, -30 to 80 °C

Tokens: Current Economizer outlet temperature, Threshold temperature

**Example:** follow the economizer (EVI heat exchanger) when looking for a
fault.

```text
WHEN Economizer outlet temperature above 60°C
THEN Create a notification "[Current Economizer outlet temperature] °C"
```

#### EEV Open pulse-steps alert

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when Electronic Expansion Valve (EEV) pulse-steps go above or below a
specified level

- Condition: above, below
- Pulse-steps: number, 0 to 500 Pulse-steps

Tokens: Current EEV Open pulse-steps, Threshold pulse-steps

**Example:** record when the expansion valve closes far, to help look for a
fault.

```text
WHEN EEV pulse-steps below 50
THEN Create a notification "EEV [Current EEV Open pulse-steps]"
```

#### EVI Open pulse-steps alert

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when Enhanced Vapor Injection (EVI) pulse-steps go above or below a
specified level

- Condition: above, below
- Pulse-steps: number, 0 to 500 Pulse-steps

Tokens: Current EVI Open pulse-steps, Threshold pulse-steps

**Example:** record how far the EVI valve opens, to help look for a fault.

```text
WHEN EVI Open pulse-steps above 300
THEN Create a notification "EVI [Current EVI Open pulse-steps]"
```

#### Fan motor efficiency alert (Expert)

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Aurora I/II via Tuya, Aurora III via Modbus: Triggers when fan motor frequency
goes above or below a specified level. Requires 'Enable expert feature cards' in
device settings.

Aurora I/II via Modbus: Triggers when fan motor frequency goes above or below a
specified level.

- Condition: above, below
- Frequency : number, 10 to 100 Hz

Tokens: Current fan frequency, Threshold frequency

**Example:** record when the fan runs at high speed. The Tuya version needs the
Expert cards setting switched on.

```text
WHEN Fan motor frequency above 60 Hz
THEN Create a notification "Fan at [Current fan frequency] Hz"
```

#### Fault detected

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when a system fault is detected

- code (Aurora I/II via Tuya): number, 1 to 100
- code (Aurora I/II via Modbus, Aurora III via Modbus): text

Tokens: Fault code, Fault description

**Example:** get a notification for a specific fault. On the Modbus drivers the
code is text as on the display (for example F1.1 or E03), on Tuya a number. For
every fault at once, use the condition Fault is active.

```text
WHEN Fault F1.1 detected
THEN Send a push notification "Fault [Fault code]: [Fault description]"
```

#### High pressure temperature alert

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus

Triggers when high pressure saturation temperature goes above or below a
specified level

- Condition: above, below
- Temperature : number, -20 to 100 °C

Tokens: Current High pressure temperature, Threshold temperature

**Example:** record when the high-pressure side gets very warm.

```text
WHEN High pressure temperature above 55°C
THEN Create a notification "[Current High pressure temperature] °C"
```

#### Incoiler temperature alert

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus

Triggers when incoiler temperature goes above or below a specified level

- Condition: above, below
- Temperature : number, -20 to 80 °C

Tokens: Current Incoiler temperature, Threshold temperature

**Example:** record when the condenser gets very warm.

```text
WHEN Incoiler temperature above 60°C
THEN Create a notification "Condenser [Current Incoiler temperature] °C"
```

#### Inlet temperature changed

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when water inlet temperature goes above or below a specified level

- Condition: above, below
- Temperature : number, -20 to 80 °C

Tokens: Current inlet temperature

**Example:** switch a virtual switch Return warm on once the return water is
warm enough.

```text
WHEN Inlet temperature changed above 30°C
THEN Turn Return warm on (virtual switch)
```

#### Inlet temperature has changed

**Trigger** · Aurora I/II via Modbus · Aurora III via Modbus

Triggers when water inlet temperature changes by at least 0.5°C

Tokens: Current inlet temperature, Previous inlet temperature, Temperature
change

**Example:** keep the return temperature in a number variable, for example for
another flow. The card fires on every change of at least 0.5 °C.

```text
WHEN Inlet temperature has changed
THEN Set a number variable: Return to [Current inlet temperature]
```

#### Low pressure temperature alert

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus

Triggers when low pressure saturation temperature goes above or below a
specified level

- Condition: above, below
- Temperature : number, -30 to 50 °C

Tokens: Current Low pressure temperature, Threshold temperature

**Example:** record when the low-pressure side gets very cold.

```text
WHEN Low pressure temperature below -20°C
THEN Create a notification "[Current Low pressure temperature] °C"
```

#### Outlet temperature changed

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when water outlet temperature goes above or below a specified level

- Condition: above, below
- Temperature : number, -20 to 80 °C

Tokens: Current outlet temperature

**Example:** warn when the supply gets too warm for floor heating. The card
fires again on every further rise of 0.5 °C.

```text
WHEN Outlet temperature changed above 45°C
AND Heating mode is Floor heating
THEN Send a push notification "Supply [Current outlet temperature] °C"
```

#### Outlet temperature has changed

**Trigger** · Aurora I/II via Modbus · Aurora III via Modbus

Triggers when water outlet temperature changes by at least 0.5°C

Tokens: Current outlet temperature, Previous outlet temperature, Temperature
change

**Example:** keep the supply temperature in a number variable. The card fires on
every change of at least 0.5 °C.

```text
WHEN Outlet temperature has changed
THEN Set a number variable: Supply to [Current outlet temperature]
```

#### Suction temperature alert

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when suction temperature goes above or below a specified level

- Condition: above, below
- Temperature : number, -30 to 50 °C

Tokens: Current Suction temperature, Threshold temperature

**Example:** record when the suction gas gets very cold.

```text
WHEN Suction temperature below -20°C
THEN Create a notification "Suction [Current Suction temperature] °C"
```

#### Tank temperature alert

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when water tank temperature goes above or below a specified level

- Condition: above, below
- Temperature : number, 0 to 90 °C

Tokens: Current Tank temperature, Threshold temperature

**Example:** show with a virtual switch whether the tank is warm.

```text
WHEN Tank temperature above 50°C
THEN Turn Tank warm on (virtual switch)

WHEN Tank temperature below 40°C
THEN Turn Tank warm off
```

#### Water flow rate alert (Expert)

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Aurora I/II via Tuya, Aurora III via Modbus: Triggers when water flow rate goes
above or below a specified level. Requires 'Enable expert feature cards' in
device settings.

Aurora I/II via Modbus: Triggers when water flow rate goes above or below a
specified level.

- Condition: above, below
- Flow rate (L/min): number, 0 to 100 L/min

Tokens: Current flow rate, Threshold flow rate

**Example:** one notification for too little flow, with a Yes/No variable Flow
alert against repeats. The Tuya version needs the Expert cards setting switched
on.

```text
WHEN Water flow rate below 10 L/min
AND Compressor is running
AND Flow alert is equal to no
THEN Send a push notification "Low flow: [Current flow rate] L/min"
AND Set a Yes/No variable: Flow alert to yes

WHEN Water flow rate above 15 L/min
THEN Set a Yes/No variable: Flow alert to no
```

### Triggers: Energy and efficiency (COP)

#### COP efficiency changed

**Trigger** · Aurora I/II via Tuya

Triggers when the Coefficient of Performance (COP) goes above or below a
specified threshold

- Condition: above, below
- COP threshold: number, 1 to 8 COP

Tokens: Current COP, Previous COP, Change in COP, Calculation method used,
Confidence level

**Example:** record a low COP, with the calculation method used. The card looks
at every change of at least 0.3.

```text
WHEN COP efficiency changed below 2
AND Compressor is running
THEN Create a notification "COP [Current COP] ([Calculation method used])"
```

#### COP outlier detected

**Trigger** · Aurora I/II via Tuya

Triggers when an invalid or suspicious COP value is detected, indicating
potential sensor issues

Tokens: Outlier COP value, Outlier reason, Calculation method used

**Example:** an outlier often points to a sensor that is wrong or a missing
power measurement; record it in the timeline.

```text
WHEN COP outlier detected
THEN Create a notification "COP [Outlier COP value]: [Outlier reason]"
```

#### COP trend detected

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when COP shows a significant improving or degrading trend over the last
24 hours

- Trend type: improving, degrading, any trend change

Tokens: Trend direction, Trend strength, Trend description, Current daily COP

**Example:** get a notification when efficiency clearly declines over the last
24 hours.

```text
WHEN COP trend detected: degrading
THEN Send a push notification "[Trend description]"
```

#### Daily consumption threshold reached

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when daily electricity consumption reaches specified threshold

- Daily threshold (kWh): number, 1 to 100 kWh

Tokens: Daily consumption, Threshold value

**Example:** get one notification a day once consumption reaches a limit.

```text
WHEN Daily consumption reached 30 kWh
THEN Send a push notification "Already [Daily consumption] kWh today"
```

#### Daily COP efficiency changed

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when the 24-hour average COP goes above or below a specified threshold

- Condition: above, below
- Daily COP threshold: number, 1 to 8 COP

Tokens: Current daily COP, Previous daily COP, Change in COP

**Example:** record when the daily COP drops below a limit. The card looks at
every change of at least 0.2.

```text
WHEN Daily COP efficiency changed below 3
THEN Create a notification "Daily COP [Current daily COP]"
```

#### Daily energy cost exceeded threshold

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when today's total energy cost exceeds specified amount (requires price
optimizer)

- Cost threshold (€): number, 1 to 50

Tokens: Today's Total Cost (€), Today's Consumption (kWh), Average Price Today
(€/kWh)

**Example:** get one notification a day when energy costs exceed an amount. Only
works with price optimization and an external energy measurement.

```text
WHEN Daily cost exceeded €5
THEN Send a push notification "Cost today € [Today's Total Cost (€)]"
```

#### Monthly COP efficiency changed

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when the 30-day average COP goes above or below a specified threshold

- Condition: above, below
- Monthly COP threshold: number, 1 to 8 COP

Tokens: Current monthly COP, Previous monthly COP, Change in COP

**Example:** follow efficiency over 30 days. The card looks at every change of
at least 0.2.

```text
WHEN Monthly COP efficiency changed below 3
THEN Send a push notification "Monthly COP [Current monthly COP]"
```

#### Performance report is ready

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggered daily at 23:00 with a comprehensive performance report. Use in
combination with a notification action to receive daily performance summaries.

Tokens: Overall score (0-100), Rating, Summary, Recommendations, Full report
(JSON)

**Example:** receive a short summary every evening at 23:00.

```text
WHEN Performance report is ready
THEN Send a push notification "[Rating]: [Summary]"
```

#### Power threshold exceeded

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when power consumption exceeds specified threshold (requires power
monitoring support)

- Power threshold (W): number, 100 to 10000 W

Tokens: Current power consumption, Threshold power

**Example:** record when the heat pump draws a lot of power. The card fires once
when the threshold is crossed and again only after the power has dropped first.
Requires a power measurement.

```text
WHEN Power consumption exceeded 3000 W
THEN Create a notification "Power [Current power consumption] W"
```

#### Total consumption milestone reached

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when total electricity consumption reaches specified milestones

- Consumption milestone (kWh): number, 100 to 50000 kWh

Tokens: Total consumption, Milestone value

**Example:** a reminder at a consumption milestone, for example for maintenance.

```text
WHEN Total consumption reached 10000 kWh
THEN Send a push notification "[Total consumption] kWh: plan maintenance"
```

### Triggers: Energy prices

#### Cheapest block started

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when the cheapest electricity price block of the day starts. Use to
maximize energy consumption during low-price periods.

Tokens: Block Start Time, Block End Time, Average Price (€/kWh), Block Duration
(hours)

**Example:** heat the hot water extra in the cheapest block and set it back
afterwards, with a delay on the second action card. The block length is set in
Price Block Size (hours), default 4. Only works when adaptive control is running
(with an indoor temperature), price optimization is on, and prices come in
through Send external energy prices.

```text
WHEN Cheapest block started
THEN Set hot water temperature to 55
AND Set hot water temperature to 48 (delay 4 hours)
```

#### Energy price crossed threshold

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when energy price category changes (very_low, low, normal, high,
very_high)

Tokens: Price Category, Current Price (€/kWh), Next Hour Price (€/kWh)

**Example:** ECO at a very high price and back to Normal at any other category.
The category is a code: very_low, low, normal, high or very_high. Only works
when adaptive control is running (with an indoor temperature), price
optimization is on, and prices come in through Send external energy prices.

```text
WHEN Energy price crossed threshold
AND [Price Category] is exactly very_high
THEN Set work mode to ECO
ELSE Set work mode to Normal
```

#### Expensive period approaching

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers N hours before the most expensive electricity price block starts. Use
to pre-heat or prepare before high-price periods.

Tokens: Block Start Time, Average Price (€/kWh), Block Duration (hours)

**Example:** set the heat pump to ECO before the expensive period starts. How
many hours ahead the card fires is set in Expensive Block Warning Time (hours),
default 2. The Aurora III has no ECO. Only works when adaptive control is
running (with an indoor temperature), price optimization is on, and prices come
in through Send external energy prices.

```text
WHEN Expensive period approaching
THEN Set work mode to ECO
AND Send a push notification "Expensive from [Block Start Time]"
```

#### Price trend changed

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when electricity price trend direction changes (rising, falling,
stable). Based on linear regression analysis with confidence threshold.

Tokens: Previous Trend, New Trend, Hours Analyzed

**Example:** create a notification when prices start rising or falling. Only
works when adaptive control is running (with an indoor temperature), price
optimization is on, and prices come in through Send external energy prices.

```text
WHEN Price trend changed
THEN Create a notification "Price trend [Previous Trend] to [New Trend]"
```

### Triggers: Adaptive control and building model

#### Adaptive control recommends temperature adjustment

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggered when adaptive control calculates a recommended temperature adjustment
(only when significant action needed). Use building_model_confidence to filter
on model confidence. Use the 'Set target (setpoint) temperature' action to
apply. Aurora I/II via Modbus: the recommendation follows the heat pump's mode
(heating setpoint in heating modes, floor heating setpoint in floor heating
modes); apply it with 'Set setpoint temperature (by mode)' set to Auto.

Tokens: Current target temperature, Recommended target temperature, Temperature
adjustment, Adjustment reason, Controller, Building Model Confidence (%),
Control mode

**Example:** this is the core of adaptive control: the control does not set the
setpoint itself, this flow carries out the recommendation. On the Aurora I/II
via Modbus the recommendation follows the mode; use Set setpoint temperature (by
mode) on Auto there. On the Aurora I/II the setpoint only stays if the heating
curve is OFF.

```text
WHEN Adaptive control recommends temperature adjustment
THEN Set target (setpoint) temperature to [Recommended target temperature]
    Auto-round (recommended)
```

#### Adaptive control status changed

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggered when adaptive temperature control is enabled or disabled

Tokens: Status, Reason

**Example:** get a notification when adaptive control switches on or off.

```text
WHEN Adaptive control status changed
THEN Send a push notification "Adaptive control [Status]: [Reason]"
```

#### Building model learning milestone

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when the building thermal model reaches a learning milestone (e.g., 70%
confidence)

Tokens: Milestone, Confidence, Thermal Mass (kWh/°C), Time Constant (hours)

**Example:** get one notification when the building model reaches 70%
confidence. After learning starts over, the card fires again.

```text
WHEN Building model learning milestone
THEN Send a push notification "Building model: [Milestone]"
```

#### Building profile mismatch detected

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when learned building behavior significantly differs from selected
profile (>30% deviation). Suggests optimal profile for faster learning.

Tokens: Current Profile, Suggested Profile, Learned τ (hours), Profile τ
(hours), Deviation (%), Confidence (%)

**Example:** the learned behaviour does not match the chosen building type.
Choose the suggested type in the settings (Building Type) to learn faster.

```text
WHEN Building profile mismatch detected
THEN Send a push notification "Building type [Suggested Profile] fits better"
```

#### Forecast heating advice available

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when new COP-optimized heating advice is available based on temperature
forecast

Tokens: Delay hours, Expected COP, Current COP, Advice

**Example:** receive the advice based on the expected outdoor temperature: wait
because it gets warmer and so more efficient later, or heat now. The card fires
when the advice changes. Requires the weather forecast in the settings. The
advice text is currently always in Dutch.

```text
WHEN Forecast heating advice available
THEN Create a notification "[Advice]"
```

#### New building insight detected

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when building model detects actionable performance insight (≥70%
confidence). Use tokens to filter by category and savings potential.

Tokens: Category, Insight, Recommendation, Priority (0-100), Confidence (%),
Est. Savings (€/month, no longer calculated)

**Example:** receive a new insight about the house as soon as the building model
is reliable enough (setting Minimum Confidence (%), default 70%).

```text
WHEN New building insight detected
THEN Send a push notification "[Insight] [Recommendation]"
```

#### Pre-heating time recommendation

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers when ΔT (target - indoor) exceeds 1.5°C. Provides pre-heat duration
based on building thermal response (τ). Requires ≥70% model confidence. Max once
per 4 hours.

Tokens: Duration (hours), Temperature Rise (°C), Current Temperature (°C),
Target Temperature (°C), Confidence (%)

**Example:** the card fires when it is more than 1.5 °C colder than desired and
the building model is reliable enough (setting Minimum Confidence (%), default
70%), at most once every 4 hours.

```text
WHEN Pre-heating time recommendation
THEN Send a push notification "Warming up takes [Duration (hours)] hours"
```

#### Simulated temperature updated

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggers every control cycle (5 min) with full breakdown of what adaptive
control calculates. Use for monitoring, logging, and confidence-based filtering.
Filter on building_model_confidence to only act on high-confidence
recommendations.

Tokens: Simulated Target (°C), Actual Target (°C), Difference (°C), Adjustment
(°C), Comfort Component (°C), Efficiency Component (°C), Cost Component (°C),
Building Model Confidence (%), COP Confidence (%), Coast Component (°C),
Reasoning

**Example:** the card fires every control cycle (about every 5 minutes). Use it
to keep track of values, not for notifications.

```text
WHEN Simulated target temperature updated
THEN Set a number variable: Advice to [Simulated Target (°C)]
```

## Conditions

### Conditions: Control and modes

#### Compressor is running

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if the compressor is currently running

**Example:** get a notification if the compressor is still running when an
expensive period starts.

```text
WHEN Expensive period approaching
AND Compressor is running
THEN Send a push notification "The heat pump runs in the expensive period"
```

#### Device power is

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if the device power state matches the selected state

- Power state: On, Off

**Example:** only lower the setpoint when the heat pump is on.

```text
WHEN The last person leaves
AND Device power is On
THEN Set target (setpoint) temperature to 30
```

#### Electricity consumption checking is

**Condition** · Aurora I/II via Tuya

Check if the electricity consumption checking level matches the specified
condition

- Comparison: Equal to, Greater than, Less than
- Electricity consumption checking: number, 0 to 2

**Example:** this setting tells which power module the heat pump has (0 = none,
1 = single-phase, 2 = three-phase). Use the card to check that the value is
still right, for example after a fault.

```text
WHEN The time is 08:00
AND Electricity consumption checking is not Equal to 1
THEN Send a push notification "Power module setting has changed"
```

#### Heating curve setting is

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus

Check if the heating curve setting matches the selected curve

- Heating curve: OFF, H1, H2, H3, H4, H5, H6, H7, H8, L1, L2, L3, L4, L5, L6,
  L7, L8 - custom curve

**Example:** only change the setpoint when the heating curve is OFF; with a
heating curve the heat pump sets the supply temperature itself and does not keep
a setpoint you set.

```text
WHEN The time is 06:00
AND Heating curve setting is OFF
THEN Set target (setpoint) temperature to 40
```

#### Heating mode is

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if the heating mode matches the selected mode

- Heating mode (Aurora I/II via Tuya, Aurora I/II via Modbus): Cold, Heating,
  Floor heating, Hot water, Cold and hot water, Heating and hot water, Floor
  heating and hot water
- Heating mode (Aurora III via Modbus): Off, Cooling, Heating, Auto

**Example:** switch to hot water only in May, but only if the heat pump is still
on heating and hot water. The Aurora III has other modes (Cooling, Heating,
Auto) and no separate hot water mode.

```text
WHEN The time is 08:00
AND The day and month are 1 May
AND Heating mode is Heating and hot water
THEN Set heating mode to Hot water
```

#### Hot water curve setting is

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus

Check if the hot water curve setting matches the selected setting

- Hot water curve setting: OFF, H1, H2, H3, H4

**Example:** switch the hot water curve back on in the evening if it is off.

```text
WHEN The time is 22:00
AND Hot water curve setting is OFF
THEN Set hot water curve setting to H2
```

#### Hot water is being heated

**Condition** · Aurora III via Modbus

Check if the heat pump is heating domestic hot water right now

**Example:** only switch on silent mode once the heat pump is no longer heating
hot water.

```text
WHEN The time is 22:00
AND Hot water is not being heated
THEN Set silent mode to Level 2
```

#### Hot water temperature is

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if the hot water temperature matches the specified condition

- Comparison: Equal to, Greater than, Less than
- Hot water temperature : number, 20 to 75 °C

**Example:** the card compares the hot water setpoint, not the measured tank
temperature. Set the setpoint back if it stayed too high after a boost.

```text
WHEN The time is 23:00
AND Hot water temperature is Greater than 50°C
THEN Set hot water temperature to 48
```

#### Silent mode is

**Condition** · Aurora III via Modbus

Check the silent mode level of the heat pump

- Silent mode: Off, Level 1, Level 2

**Example:** switch silent mode off in the morning if it is still on.

```text
WHEN The time is 07:00
AND Silent mode is not Off
THEN Set silent mode to Off
```

#### Target (setpoint) temperature is

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if the target (setpoint) temperature matches the specified condition

- Comparison: Equal to, Greater than, Less than
- Temperature (Aurora I/II via Tuya): number, 5 to 60 °C
- Temperature (Aurora I/II via Modbus, Aurora III via Modbus): number, 15 to 60
  °C

**Example:** only lower the setpoint at night if it is higher than the night
value.

```text
WHEN The time is 23:00
AND Target (setpoint) temperature is Greater than 35°C
THEN Set target (setpoint) temperature to 32
```

#### Water control mode is

**Condition** · Aurora I/II via Tuya

Check if the water control mode matches the specified condition

- Comparison: Equal to, Greater than, Less than
- Water control mode: number, 0 to 1

**Example:** this is an installation setting; use the card to report an
unexpected value.

```text
WHEN The time is 08:00
AND Water control mode is not Equal to 0
THEN Send a push notification "Water control mode is 1"
```

#### Work mode is

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus

Check if the work mode matches the selected mode

- Work mode: ECO, Normal, Boost

**Example:** set the heat pump back to Normal in the morning if it is still on
ECO.

```text
WHEN The time is 07:00
AND Work mode is ECO
THEN Set work mode to Normal
```

### Conditions: Temperatures, faults and alerts

#### Ambient temperature above

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if the ambient temperature is above or below a specific value

- Temperature: number, -30 to 50 °C

**Example:** heat the hot water extra in the cheapest block, but only when it is
cold outside.

```text
WHEN Cheapest block started
AND Ambient temperature is below 5°C
THEN Set hot water temperature to 55
AND Set hot water temperature to 48 (delay 4 hours)
```

#### Electrical balance check

**Condition** · Aurora I/II via Tuya

Check if the 3-phase electrical currents are balanced within specified tolerance

- Balance tolerance : number, 1 to 20 %

**Example:** check daily whether the three phases carry about the same load.

```text
WHEN The time is 12:00
AND Compressor is running
AND 3-phase electrical balance is outside 10% tolerance
THEN Send a push notification "Phases unevenly loaded"
```

#### Fault is active

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if a fault is currently active (fault code > 0)

**Example:** get a reminder every morning as long as a fault is still active.

```text
WHEN The time is 08:00
AND Fault is active
THEN Send a push notification "The heat pump still reports a fault"
```

#### System pulse-steps differential check

**Condition** · Aurora I/II via Tuya

Check if the pulse-steps difference between EEV and EVI is above or below a
threshold

- Pulse-steps differential: number, 0 to 1000 Pulse-steps

**Example:** record the difference between the EEV and EVI valves, to help look
for a fault.

```text
WHEN The time is 14:00
AND System pulse-steps differential is above 300
THEN Create a notification "Large difference EEV and EVI"
```

#### Temperature differential check

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if the temperature difference between inlet and outlet is above or below a
threshold

- Temperature differential : number, 1 to 50 °C

**Example:** a large difference between supply and return can point to too
little flow.

```text
WHEN The time is 14:00
AND Compressor is running
AND Temperature differential is above 8°C
THEN Send a push notification "Large difference supply and return"
```

#### Water flow rate check

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if water flow rate is above or below specified threshold

- Flow rate (L/min): number, 1 to 100 L/min

**Example:** check the flow at a fixed time while the compressor runs.

```text
WHEN The time is 10:00
AND Compressor is running
AND Water flow rate is below 15 L/min
THEN Send a push notification "Low flow, check the filter"
```

### Conditions: Energy and efficiency (COP)

#### COP calculation method is

**Condition** · Aurora I/II via Tuya

Check which calculation method was used for the current COP value - useful for
automation based on data availability

- Calculation method: Direct thermal (most accurate), Carnot estimation (medium
  accuracy), Temperature difference (basic), Insufficient data

**Example:** only react to a low COP when it was calculated from measured flow,
temperatures and power.

```text
WHEN COP efficiency changed below 2
AND COP calculation method is Direct thermal (most accurate)
THEN Send a push notification "Low COP: [Current COP]"
```

#### COP efficiency is

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if the current Coefficient of Performance (COP) is above or below a
threshold

- COP threshold: number, 1 to 8 COP

**Example:** heat the hot water extra in the afternoon when the heat pump runs
efficiently at that moment, and set the setpoint back in the evening.

```text
WHEN The time is 14:00
AND COP efficiency is above 4
THEN Set hot water temperature to 55

WHEN The time is 18:00
THEN Set hot water temperature to 48
```

#### COP trend analysis

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check the COP performance trend over a specified time period

- Time period : number, 1 to 168 h

**Example:** a weekly efficiency check.

```text
WHEN The time is 10:00
AND Today is a Sunday
AND COP trend is degrading over 168 hours
THEN Send a push notification "Efficiency is declining this week"
```

#### Daily COP above threshold

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if the 24-hour average COP is above or below a threshold

- Daily COP threshold: number, 1 to 8 COP

**Example:** add a warning to the evening report when the daily COP was low.

```text
WHEN Performance report is ready
AND Daily COP is below 2.5
THEN Send a push notification "Low daily COP: [Summary]"
```

#### Monthly COP above threshold

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if the 30-day average COP is above or below a threshold

- Monthly COP threshold: number, 1 to 8 COP

**Example:** record when the monthly COP is below a limit.

```text
WHEN Performance report is ready
AND Monthly COP is below 3
THEN Create a notification "Monthly COP below 3"
```

#### Power consumption above

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if current power consumption is above or below a threshold (requires power
monitoring support)

- Power threshold (W): number, 100 to 10000 W

**Example:** set the heat pump to ECO when it draws a lot of power in the
expensive period. Requires a power measurement; the Aurora III has no ECO mode.

```text
WHEN Expensive period approaching
AND Power consumption is above 1500 watts
THEN Set work mode to ECO
```

#### Total consumption above threshold

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if total electricity consumption is above or below a threshold

- Consumption threshold (kWh): number, 100 to 50000 kWh

**Example:** a yearly reminder once total consumption has passed a limit.

```text
WHEN The time is 08:00
AND The day and month are 1 September
AND Total consumption is above 20000 kWh
THEN Send a push notification "Time for maintenance"
```

### Conditions: Energy prices

#### Insight savings are above threshold

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

**Deprecated: no longer available for new flows.**

Check if estimated monthly savings for an insight category exceed a threshold
(in EUR/month). Use for ROI-based filtering (e.g., only act on savings
>€100/month).

- Category: Insulation performance, Pre-heating strategy, Thermal storage
- Threshold (EUR/month): number, 0 to 500

**Example:** since version 3.4.2 the app no longer estimates a saving in euros,
because it cannot be substantiated with dynamic prices. The card always returns
false. Use Insight is active instead.

#### Price in cheapest hours

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if current hour is within the cheapest N-hour block today. Useful for
running high-power tasks during low-price periods.

- Block size (hours): number, 1 to 12 h

**Example:** only heat the hot water in the three cheapest hours of the day.
Requires prices through Send external energy prices.

```text
WHEN Every 1 hour
AND Current hour is in cheapest 3 hours of today
THEN Set hot water temperature to 55
ELSE Set hot water temperature to 48
```

#### Price trend is

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if electricity prices are rising, falling, or stable in the next N hours.
Based on linear regression with confidence metric.

- Analysis window (hours): number, 1 to 24 h
- Trend: Rising, Falling, Stable

**Example:** heat the hot water in the morning when prices rise in the coming
hours, and set it back later. Requires prices through Send external energy
prices.

```text
WHEN The time is 06:00
AND Price trend for next 6 hours is Rising
THEN Set hot water temperature to 55
AND Set hot water temperature to 48 (delay 3 hours)
```

#### Price vs daily average

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if current electricity price deviates from the daily average by at least
the specified margin percentage. Useful for detecting significantly low or high
prices.

- Margin (%): number, 0 to 50 %

**Example:** Boost when the price is well below the daily average, otherwise
Normal. Requires prices through Send external energy prices; the Aurora III has
no Boost.

```text
WHEN Every 1 hour
AND Current price is below daily average by 20%
THEN Set work mode to Boost
ELSE Set work mode to Normal
```

### Conditions: Adaptive control and building model

#### Insight is active

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if a specific insight category is currently active (visible in
capabilities). Returns false if dismissed or not detected.

- Category: Insulation performance, Pre-heating strategy, Thermal storage,
  Building profile mismatch

**Example:** a weekly reminder of an open insight.

```text
WHEN The time is 09:00
AND Today is a Monday
AND Insulation performance insight is active
THEN Send a push notification "There is an insight about the insulation"
```

#### Model confidence is above threshold

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Check if building model confidence exceeds a threshold (0-100%). Use as quality
gate for flows (e.g., only send notifications when confidence >80%).

- Threshold (%): number, 0 to 100

**Example:** only carry out the recommendation when the building model is
reliable enough.

```text
WHEN Adaptive control recommends temperature adjustment
AND Model confidence is above 70%
THEN Set target (setpoint) temperature to [Recommended target temperature]
    Auto-round (recommended)
```

## Actions

### Actions: Control and modes

#### Set curve (by mode)

**Action** · Aurora I/II via Modbus

Set the curve setting, routed to heating, cooling, floor heating, or hot water.
Auto follows the heat pump's current mode.

- Apply to: Auto (follow current mode), Heating, Cooling, Floor heating, Hot
  water
- Curve setting: OFF, H1, H2, H3, H4, H5, H6, H7, H8, L1, L2, L3, L4, L5, L6,
  L7, L8 - custom curve

**Example:** set the floor heating curve at the start of the heating season.

```text
WHEN The time is 08:00
AND The day and month are 1 October
THEN Set curve to L3 for Floor heating
```

#### Set Custom heating curve (L28/L29)

**Action** · Aurora I/II via Modbus

Writes the DIY heating curve directly to Modbus registers L27, L28 and L29.
slope is the curve coefficient k (e.g. -0.5), intercept is the supply
temperature at -15°C outdoor (L29, e.g. 55). Valid range: slope -5.0..0.0,
intercept 30..80. Capabilities heating_curve_slope and heating_curve_intercept
are updated within 30 seconds via polling.

- Slope (k, e.g. -0.5): number
- Intercept (supply temp at -15°C, e.g. 55): number

**Example:** set a custom heating curve at the start of the heating season. The
card also switches the custom curve on; a slope of -0.5 and 50 °C at -15 °C
outside gives 40 °C supply at 5 °C outside.

```text
WHEN The time is 08:00
AND The day and month are 1 October
THEN Set Custom heating curve: slope -0.5, intercept 50°C
```

#### Set device power

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus

Set the device power state

- Power state: On, Off

**Example:** switch the heat pump on and off with a virtual button.

```text
WHEN Virtual button Heat pump is turned off
THEN Set device power to Off
```

#### Set electricity consumption checking

**Action** · Aurora I/II via Tuya

Set the electricity consumption checking level

- Electricity consumption checking: number, 0 to 2

**Example:** this setting tells which power module the heat pump has (0 = none,
1 = single-phase, 2 = three-phase). Only change it when the installer says so;
do not use the card in an automatic flow.

#### Set heating curve setting

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus

Set the heating curve setting

- Heating curve setting: OFF, H1, H2, H3, H4, H5, H6, H7, H8, L1, L2, L3, L4,
  L5, L6, L7, L8 - custom curve

**Example:** a higher heating curve from the start of the heating season.

```text
WHEN The time is 08:00
AND The day and month are 1 October
THEN Set heating curve setting to H4
```

#### Set heating mode

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Set the heating operation mode

- Heating mode (Aurora I/II via Tuya, Aurora I/II via Modbus): Cold, Heating,
  Floor heating, Hot water, Cold and hot water, Heating and hot water, Floor
  heating and hot water
- Heating mode (Aurora III via Modbus): Cooling, Heating, Auto

**Example:** switch back to heating and hot water at the start of the heating
season. On the Aurora III choose Heating here.

```text
WHEN The time is 08:00
AND The day and month are 1 October
THEN Set heating mode to Heating and hot water
```

#### Set hot water curve setting

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus

Set the hot water curve setting for optimal efficiency

- Hot water curve setting: OFF, H1, H2, H3, H4

**Example:** a higher hot water curve in the morning for the shower peak.

```text
WHEN The time is 05:30
THEN Set hot water curve setting to H3

WHEN The time is 09:00
THEN Set hot water curve setting to H1
```

#### Set hot water temperature

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Set the hot water temperature setting

- Hot water temperature (°C): number, 20 to 75 °C

**Example:** heat the hot water extra in the cheapest block.

```text
WHEN Cheapest block started
THEN Set hot water temperature to 55

WHEN Expensive period approaching
THEN Set hot water temperature to 48
```

#### Set setpoint temperature (by mode)

**Action** · Aurora I/II via Modbus

Set the setpoint temperature, routed to heating, cooling, or floor heating. Auto
follows the heat pump's current mode.

- Temperature (°C): number, 7 to 60 °C
- Apply to: Auto (follow current mode), Heating, Cooling, Floor heating
- If decimal value: Auto-round (recommended), Show error

**Example:** a lower floor heating setpoint at night. The setpoint only stays if
the heating curve is OFF.

```text
WHEN The time is 23:00
THEN Set setpoint to 30 for Floor heating
    Auto-round (recommended)
```

#### Set silent mode

**Action** · Aurora III via Modbus

Sets the silent mode level of the heat pump

- Silent mode: Off, Level 1, Level 2

**Example:** run more quietly at night.

```text
WHEN The time is 22:00
THEN Set silent mode to Level 2

WHEN The time is 07:00
THEN Set silent mode to Off
```

#### Set target (setpoint) temperature

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Set the target (setpoint) temperature for the heat pump

- Temperature (°C) (Aurora I/II via Tuya): number, 5 to 75 °C
- Temperature (°C) (Aurora I/II via Modbus, Aurora III via Modbus): number, 15
  to 60 °C
- If decimal value: Auto-round (recommended), Show error

**Example:** this is how you apply the recommendation of adaptive control: the
control does not set the setpoint itself but gives a recommendation that your
flow carries out. On the Aurora I/II the setpoint only stays if the heating
curve is OFF. Do not also set the setpoint from another flow, or the two work
against each other.

```text
WHEN Adaptive control recommends temperature adjustment
THEN Set target (setpoint) temperature to [Recommended target temperature]
    Auto-round (recommended)
```

#### Set water control mode

**Action** · Aurora I/II via Tuya

Set the water control mode setting

- Water control mode: number, 0 to 1

**Example:** this is an installation setting. Only change it when the installer
says so; do not use the card in an automatic flow.

#### Set work mode

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus

Set the system work mode

- Work mode: ECO, Normal, Boost

**Example:** Boost in the cheapest block, ECO in the expensive period.

```text
WHEN Cheapest block started
THEN Set work mode to Boost

WHEN Expensive period approaching
THEN Set work mode to ECO
```

#### Switch forced backup heater

**Action** · Aurora III via Modbus

Forces the electric backup heater on or releases it

- State: on, off

**Example:** force the electric backup heater in severe frost and release it
when it is less cold.

```text
WHEN Ambient temperature changed below -10°C
THEN Switch forced backup heater on

WHEN Ambient temperature changed above -5°C
THEN Switch forced backup heater off
```

#### Switch hot water function

**Action** · Aurora III via Modbus

Switches domestic hot water heating on or off

- State: on, off

**Example:** switch hot water heating off during the holidays, with a Yes/No
variable Holiday.

```text
WHEN A variable has changed (Holiday)
AND Holiday is equal to yes
THEN Switch hot water function off
```

### Actions: Energy and efficiency (COP)

#### Generate performance report

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Generate a comprehensive heat pump performance report with scores across 7
domains (efficiency, building, defrost, energy, pricing, telemetry, health).
Returns overall score, rating, and actionable recommendations.

Tokens: Overall score (0-100), Rating, Summary, Recommendations, Full report
(JSON)

**Example:** create the report at another time than 23:00 and pass on the
result.

```text
WHEN The time is 18:00
AND Today is a Sunday
THEN Generate performance report
AND Send a push notification "[Rating]: [Summary]"
```

### Actions: Energy prices

#### Send energy prices to heat pump

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Sends hourly energy prices (€/kWh) from external source to enable price-based
optimization. Accepts two formats: Array [0.11,0.10,...] where index=hour offset
(0=current hour), or Object {"0":0.11,"1":0.10,...} with hour keys.

- Energy prices (JSON): text

**Example:** the app does not fetch prices itself. Send them as text from
another app, a variable or an HTTP request, for example [0.21,0.19,0.18,...] in
€/kWh, where the first number is the current hour. The prices apply from the
moment they are received; send new ones when they are available, for example
every afternoon after tomorrow's prices are published.

```text
WHEN The time is 14:30
THEN Send external energy prices [Prices] for price optimization
```

### Actions: Adaptive control and building model

#### Calculate pre-heat start time

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Calculate when to start heating to reach the desired indoor temperature at a
specific time. Uses the building model's thermal time constant (τ) for accurate
prediction.

- Target indoor temperature (°C): number, 16 to 28
- Ready at (HH:MM): text

Tokens: Start time, Duration (hours), Suggested setpoint boost (°C), Model
confidence (%)

**Example:** calculate at night when heating has to start to reach 21 °C at
07:00. Enter the time as HH:MM.

```text
WHEN The time is 04:00
THEN Calculate when to start heating to reach 21°C at 07:00
AND Send a push notification "Start at [Start time]"
```

#### Force insight analysis

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Immediately evaluate building insights (without waiting for 50-minute interval).
Returns number of insights detected and current model confidence.

Tokens: Insights detected, Model confidence (%)

**Example:** update the insights right away instead of waiting for the next
analysis (every 50 minutes).

```text
WHEN The time is 08:00
THEN Force insight analysis
AND Create a notification "[Insights detected] insights"
```

#### Set desired indoor temperature

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Set the desired room temperature for adaptive control. The adaptive control
system will adjust the heat pump setpoint to reach this temperature.

- Indoor Temperature : number, 15 to 25 °C

**Example:** a lower desired indoor temperature at night. Adaptive control
adjusts its recommendation to it.

```text
WHEN The time is 22:30
THEN Set desired indoor temperature to 19°C

WHEN The time is 06:30
THEN Set desired indoor temperature to 21°C
```

### Actions: External data

#### Send ambient temperature to heat pump

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Sends ambient temperature data to the heat pump for enhanced COP/thermal mass
calculations

- Ambient temperature (°C): number, -50 to 50

**Example:** use your own outdoor sensor instead of the heat pump's sensor. A
value counts for an hour; after that adaptive control falls back to the weather
forecast and the heat pump's sensor.

```text
WHEN The temperature has changed (outdoor sensor)
THEN Send [Temperature]°C to heat pump for COP/thermal mass calculation
```

#### Send flow data to heat pump

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Sends water flow data to the heat pump for enhanced COP calculations

- Water flow rate (L/min): number, 0 to 200

**Example:** send the flow of an external flow meter, if the heat pump does not
measure it itself. A value counts for an hour.

```text
WHEN (trigger of your flow meter on a new reading)
THEN Send [Flow]L/min to heat pump for COP calculation
```

#### Send indoor temperature to heat pump

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Sends current indoor/room temperature from an external sensor to enable adaptive
temperature control

- Indoor temperature (°C): text

**Example:** adaptive control only works with an indoor temperature. Send it on
every change of a room sensor, preferably with the sensor's token. If the value
stays the same for 12 hours the app reports it; after 24 hours the control no
longer corrects on it. If you type a value yourself, use a point (21.5).

```text
WHEN The temperature has changed (living room sensor)
THEN Send [Temperature]°C indoor temperature for adaptive control
```

#### Send power data to heat pump

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Sends power consumption data to the heat pump for enhanced COP calculations

- Power consumption (W): number, 0 to 50000

**Example:** send the measured power of a kWh meter or smart plug, also when it
drops to 0 W. This gives the most accurate COP calculation and fills daily
consumption and daily cost. For the COP a value counts for an hour; daily
consumption keeps counting with the last value received.

```text
WHEN The power has changed (heat pump kWh meter)
THEN Send [Power]W to heat pump for COP calculation
```

#### Send solar panel power to heat pump

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Sends solar panel output for accurate solar radiation calculation. Use with
SolarEdge, Enphase, etc.

- Solar panel power (W): number, 0 to 50000

**Example:** the app converts the power of the solar panels into solar radiation
for the building model. Fill in Solar panel system size (Wp) in the settings for
this. A value counts for an hour; after that the app falls back to the weather
forecast.

```text
WHEN The power has changed (solar inverter)
THEN Send solar power [Power]W to heat pump
```

#### Send solar radiation to heat pump

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Sends solar radiation data for building model. Use with KNMI weather app.

- Solar radiation (W/m²): number, 0 to 1500

**Example:** send the measured solar radiation, for example from a weather app.
Solar panels take precedence if they also send data. A value counts for an hour.

```text
WHEN Every 15 minutes
THEN Send solar radiation [Solar radiation from your weather app] W/m²
    to heat pump
```

#### Send wind speed data to heat pump

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Sends wind speed data for heat loss correction. Use with KNMI weather app.

- Wind speed (km/h): number, 0 to 200

**Example:** send the wind speed for the heat loss correction. The card expects
km/h; a value in m/s times 3.6 is km/h. A value counts for an hour; after that
the app falls back to the weather forecast.

```text
WHEN Every 15 minutes
THEN Send wind speed [Wind speed from your weather app] km/h to heat pump
```

### Actions: Calculators

#### Calculate Custom heating curve (L28/L29)

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus

Calculates supply temperature using Adlar Custom heating curve. Uses L29 (set
temp at -15°C) and L28 (slope grade per 10°C). Example: L29=55°C at -15°C with
L28=-5 gives slope -0.5/°C, formula y = -0.5x + 47.5. For outdoor temp 5°C →
supply temp 45°C.

- Outdoor Temperature: text
- L29: Set temp at -15°C outdoor (°C): number
- L28: Slope grade (per 10°C): number

Tokens: Supply Temperature, Heating Curve Formula

**Example:** calculate the supply temperature of a straight heating curve like
the heat pump's custom curve: L29 is the supply at -15 °C outside, L28 the slope
per 10 °C. With 55 and -5, 5 °C outside gives 45 °C supply. Useful to try out a
curve first.

```text
WHEN Every 30 minutes
THEN Calculate heating curve: L29=55°C at -15°C, L28=-5/10°C
    with outdoor temp [Ambient temperature of the heat pump]
AND Create a notification "Curve gives [Supply Temperature] °C"
```

#### Calculate value from curve rules

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Calculates output values based on input (e.g., outdoor temperature → heating
setpoint). Format: '[operator] threshold : value'. Operators: >, >=, <, <=, ==,
!=. Evaluates top to bottom, returns first match. Use 'default : value' as
fallback. Example heating curve: '< 0 : 55, < 5 : 50, < 10 : 45, default : 35'

- Input Value: text
- Curve Definition: text

Tokens: Result Value

**Example:** make your own heating curve in steps: the first rule that matches
decides the result. On the Aurora I/II the setpoint only stays if the heat
pump's heating curve is OFF; do not use this together with adaptive control.

```text
WHEN Every 30 minutes
THEN Calculate value via [Ambient temperature of the heat pump]
    using curve rules < 0 : 55, < 5 : 50, < 10 : 45, default : 35
AND Set target (setpoint) temperature to [Result Value]
    Auto-round (recommended)
```

#### Calculate value from time schedule

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Evaluates current time against a daily schedule to calculate output values.
Perfect for time-based temperature scheduling, time-of-use pricing, and
automated daily routines.

- Time schedule: text

Tokens: Result value

**Example:** a daily schedule for the desired indoor temperature. Periods across
midnight are allowed; default : value catches the rest.

```text
WHEN Every 30 minutes
THEN Calculate value from time periods
    06:00-22:00: 21, 22:00-06:00: 19
AND Set desired indoor temperature to [Result value]°C
```

#### Get current seasonal mode

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Returns heating/cooling mode based on current date. Heating season: Oct 1 - May
15 (aligned with EN 14825 SCOP standard). Perfect for automatically switching
between winter and summer schedules.

Tokens: Mode, Is heating season, Is cooling season, Days until season change

**Example:** the heating season runs from 1 October to 15 May. Store the result
in a Yes/No variable, so other flows can test it.

```text
WHEN The time is 00:05
THEN Get seasonal mode
AND Set a Yes/No variable: Heating season to [Is heating season]
```

### Actions: Modbus registers

#### Read Modbus register

**Action** · Aurora I/II via Modbus · Aurora III via Modbus

Reads one Modbus holding register (FC03) and returns the raw register value as a
flow token. Address in hex (0x0301) or decimal (769). Temperature registers
store values ×10 — divide the result by 10 for °C.

- Register address: text

Tokens: Register value

**Example:** read a register the app does not show. On the Aurora I/II the
address is hex or decimal (0x0301 = 769, the heating setpoint); temperatures are
stored ×10. On the Aurora III use the number after 4- (4-2100 becomes 2100);
input registers (3-) cannot be read with this card.

```text
WHEN The time is 12:00
THEN Read Modbus register 0x0301
AND Create a notification "Register 0x0301: [Register value]"
```

#### Write Modbus register

**Action** · Aurora I/II via Modbus · Aurora III via Modbus

Writes a raw value to one Modbus holding register (FC06). Address in hex
(0x0301) or decimal (769). Temperature registers expect values ×10 — enter 450
for 45 °C. Use with care: incorrect values may affect heat pump behaviour.

- Register address: text
- Register value: number

**Example:** only write to a register when you know what it does; a wrong value
can upset the heat pump. Temperatures are ×10: 350 is 35 °C. On the Aurora I/II
the heating setpoint (0x0301) only stays if the heating curve is OFF.

```text
WHEN The time is 06:00
THEN Write 350 to Modbus register 0x0301
```
