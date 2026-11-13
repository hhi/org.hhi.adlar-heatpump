# Setting up adaptive control

A guide to the settings of adaptive control: the six groups whose title starts
with **Adaptive control**. Which choice to make, which settings count for that
choice and which you can leave alone. Applies to version 3.6.2
and to all three drivers (Tuya, Aurora I/II and Aurora III); differences are
listed under [Differences per driver](#differences-per-driver).

## Contents

- [In short](#in-short)
- [Step by step](#step-by-step)
- [Which setting counts in which control mode](#which-setting-counts-in-which-control-mode)
- [Classic and Positional](#classic-and-positional)
- [The heating curve in Positional](#the-heating-curve-in-positional)
- [Coast](#coast)
- [The settings one by one](#the-settings-one-by-one)
- [Outdoor temperature](#outdoor-temperature)
- [Differences per driver](#differences-per-driver)
- [Questions](#questions)

## In short

- Every 5 minutes the app calculates **advice** for the water temperature. You
  see it in **Simulated Target Temperature** (`adlar_simulated_target`).
- The advice does not change anything on the heat pump. Only a flow that
  carries out the advice turns it into control.
- The heat pump only keeps a setpoint sent from outside if its own heating curve
  selection is set to **OFF** (Aurora I/II: heating curve selection; Tuya:
  heating curve).
- The **control mode** decides how the advice is calculated. In each mode only
  part of the settings count; you can leave the rest alone.

## Step by step

### 1. Requirements

- A flow that sends the indoor temperature every few minutes with the card
  **Send indoor temperature to heat pump**. Without an indoor temperature the
  control does not start.
- Turn on **Adaptive control on**. While it is off, no advice is calculated
  and the other settings do not count.
- The room target is **Desired Indoor Temperature** on the device. Set it there
  or with the card **Set desired indoor temperature** (15–25 °C). Without a
  room target, every cycle is skipped.

### 2. Advice only, or real control?

| You want to | What you do |
| --- | --- |
| First see what the app would do | No flow that carries out the advice. Leave the heating curve selection of the heat pump as it is |
| Let the app control | A flow with the trigger **Adaptive control recommends temperature adjustment** that sets the target temperature of the heat pump to `recommended_temperature`. Set the heating curve selection of the heat pump to **OFF** |

In both cases, watch for a day first. Compare the advice with what the heat pump
does on its own now.

In Positional without a flow that carries out the advice, the I-term stands still
as soon as the setpoint of the heat pump differs from the advice by more than
1 °C. You then mainly see the heating curve plus the P-term, not how the control
corrects over time.

### 3. Choose the control mode

| Situation | Control mode |
| --- | --- |
| You already control with the app and it works well | Classic |
| Radiators or fan coil units, setpoint drifts or swings | Positional – Radiators |
| Floor heating, setpoint drifts or swings | Positional – Floor heating |
| Mixed: floor and radiators | Positional – Floor heating if the floor is the largest or slowest emitter, otherwise – Radiators |
| You want to choose Kp, Ti or coast yourself | Positional – Manual |

The positional modes are **experimental**: better than Classic in the
simulation, but little tested in practice. You can always switch back.

### 4. Choose the heating curve (Positional only)

| What the heat pump uses now | What you choose |
| --- | --- |
| A fixed curve (HH1–HH8, HL1–HL8; Tuya H1–H8, L1–L8) | **Copy once into the app curve** → that curve. Then set the heating curve selection to OFF |
| Its own DIY heating curve (Aurora I/II, L28/L29) | Copy once with **Copy once into the app curve** → **DIY heating curve**, or follow continuously with **Basis of the recommendation** → **Heat pump curve (followed continuously)**. See [Copy once or follow continuously](#copy-once-or-follow-continuously) |
| I don't know | Nothing: the app fills in a starting curve when you choose the control mode |

### 5. Limits

Set **Lowest** and **Highest water temperature in the recommendation**. With floor heating: around
the range of your own heating curve, for example 2 °C below and 3 °C above, with
room for cold weather.

### 6. Check

- **Simulated Target Temperature**: does the advice follow the outdoor
  temperature roughly like your heating curve?
- **Adaptive Control Diagnostics** (`adaptive_control_diagnostics`): shows the
  mode, Kp and Ti with their source, the basis (heating curve) with its source,
  and the P- and I-term.
- If the I-term stays above 0 for days, the heating curve is too low; below 0,
  too high. See [Adjusting the heating curve](#adjusting-the-heating-curve).

## Which setting counts in which control mode

Homey always shows all settings. They are in six groups; a group's title says
in which control mode it counts. This table shows which ones count.

| Group: settings | Classic | Positional – Radiators / Floor heating | Positional – Manual |
| --- | --- | --- | --- |
| Adaptive control: on, control mode, lowest and highest water temperature | Yes | Yes | Yes |
| Heating curve (Positional): basis of the recommendation, copy once, water at −15 °C and +15 °C | No | Yes | Yes |
| Fine-tuning (Positional – Manual): Kp, Ti | No | No, fixed values | Yes |
| Fine-tuning (Classic): Kp, Ki, deadband | Yes | No | No |
| Coast (Classic, Positional – Manual) | Yes | No, coast is always off | Yes |
| Weighting factors: Comfort, Building model | Yes | No | No |
| Weighting factors: Efficiency, Cost | Yes | Yes, only for shifting the room target | Yes, same |

## Classic and Positional

### Classic

Every 5 minutes the app calculates a small correction and adds it to the current
advice. These steps add up: after a cold night the advice can have climbed a
long way, and it takes a while to come down again. Within the deadband (default
0.3 °C) nothing changes. Classic does not need a heating curve.

### Positional

The advice is calculated afresh every 5 minutes from three parts:

1. **Basis**: the water temperature that belongs to the outdoor temperature,
   taken from a heating curve.
2. **P-term**: Kp × (room target − indoor temperature). Reacts at once.
3. **I-term**: grows slowly while it stays too cold or too warm, and so removes
   the effect of a heating curve that is slightly too high or too low. Ti sets
   how slowly.

Example: outdoor 5 °C, heating curve 50 / 35 gives a basis of 40 °C. Indoor
20.5 °C with a room target of 21 °C gives a P-term of 3 × 0.5 = 1.5 °C. The
advice is then 41.5 °C plus the I-term, rounded to whole degrees.

Limits: the P- and I-term together at most ±8 °C, the I-term alone at most
±6 °C. The I-term stands still at a deviation of up to 0.1 °C, during defrost
and hot water, at a limit, and while the heat pump has not yet taken over the
previous advice.

### The three positional variants

| | Radiators | Floor heating | Manual |
| --- | --- | --- | --- |
| Kp | 3 | 3 | Setting, default 3 |
| Ti | 3 hours | 6 hours | Setting, default 3 hours |
| Coast | Off | Off | Switch **Coast on**, **default on** |
| Starting curve | 50 / 35 | 35 / 27 | None |

Only Ti differs between the emitter types: a floor reacts only after hours, so
the I-term must grow more slowly. Kp hardly depends on the emitter type.

Note for **Manual**: with the default values it equals Radiators, **but with
coast on**. If you do not want that, turn **Coast on** off.

## The heating curve in Positional

### App curve

A straight line through two points: the water temperature at −15 °C and at
+15 °C outdoor. Between those points the app calculates the value; beyond them
the line continues, within the limits.

When you choose a positional control mode, the app fills in a starting curve
(Radiators 50 / 35, Floor heating 35 / 27). It only does so as long as you have
never changed the two values yourself. Once you have changed them, or had them
filled in from a fixed curve, they stay, also when you later switch modes.

### Copying a fixed curve

**Copy once into the app curve** fills in the two values once from a
curve of the heat pump. The list then jumps back to "—". Open the settings again
to see the new values.

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

The fixed curves are staircases with steps of 1 °C. The values follow the middle
of that staircase, rounded to whole degrees.

Aurora I/II with a DIY heating curve: choose **DIY heating curve of the heat
pump (L28/L29)**. The app takes L29 as the value at −15 °C and L29 + 30 × L28 as
the value at +15 °C. Example: L28 = −0.5 and L29 = 55 gives 55 / 40. If the app
cannot read the DIY curve yet, or it is not usable, you get a message and
nothing changes.

### Copy once or follow continuously

With the Aurora I/II you can use a DIY heating curve in two ways:

| | Copy once | Follow continuously |
| --- | --- | --- |
| Setting | Copy once into the app curve → **DIY heating curve of the heat pump** | Basis of the recommendation → **Heat pump curve (followed continuously)** |
| What the app does | Puts the DIY values into the app curve once | Calculates every cycle with the DIY curve of the heat pump |
| Outdoor temperature | The app's (see [Outdoor temperature](#outdoor-temperature)) | The heat pump's sensor |
| You change the DIY curve later | The app does not pick it up; copy again | The app follows at once |
| DIY is off or not usable | Message when saving, nothing changes | The app uses the app curve without a message |

You can combine both: copy first, then follow. If following drops out, the app
continues with the same curve.

On the Aurora III, **Heat pump curve** means the climate curve of the heat pump.
Only choose it if you set that curve yourself. Tuya does not have this choice.

### Adjusting the heating curve

| What you notice | Change |
| --- | --- |
| Too cold in frost, fine in mild weather | Value at −15 °C 1–2 °C higher |
| Too cold in mild weather | Value at +15 °C 1–2 °C higher |
| Slightly too cold everywhere | Both values 1 °C higher |
| Too warm | The other way round: lower |

Change one value at a time and wait a day (floor heating: two days).

## Coast

### What coast does

Coast lets the house cool down passively when it gets too warm. If the room is
more than the start threshold (**Coast: start threshold above desired**, default
0.3 °C) above the room target for two cycles in a row and is not falling, coast
pulls the advice to the current water temperature minus **Coast: recommendation
below the water temperature** (default 1 °C). The heat pump then stops heating.

Coast stops when the room drops below the room target plus half the start threshold
(by default 21.15 °C with a target of 21 °C), when the room is falling and coast
hardly does anything any more, or after the maximum number of cycles (Aurora:
default 24, 2 hours).

### Why Positional runs without coast

**What coast was meant for.** Classic adds a small step to the advice every 5
minutes. After a cold period the advice has climbed a long way. If it then gets
too warm, all those steps have to come back first, and meanwhile the heat pump
keeps heating: the room overshoots. Coast was added as an emergency brake: it
pulls the advice below the water temperature so the compressor stops.

**Why Positional does not need that brake.** Positional calculates the advice
afresh every cycle from the heating curve. There are no added-up steps that have
to come back first. If it gets too warm, the P-term is negative at once: 0.5 °C
too warm gives advice 1.5 °C lower in the same cycle, 1 °C too warm 3 °C lower.
The I-term then slowly follows.

**What goes wrong with coast in Positional.** Coast aims at the water
temperature minus 1 °C, and that water temperature moves with the compressor:

1. The room is too warm. Coast pulls the advice down and the compressor stops.
2. Coast ends. The advice jumps back in one cycle to heating curve plus P- and
   I-term, in the simulation up to 9 °C higher.
3. The compressor starts again and the water temperature rises above the advice.
   Coast therefore drops out while the compressor runs, and steps in again as
   soon as it stops.
4. If the heating curve is slightly too high, the room stays too warm and steps
   1 to 3 repeat.

In the simulation this gave 14–23 compressor starts per day. Many short starts
wear the compressor and cost efficiency.

**What the test showed.** 24 simulated situations: three houses (average,
light, heavy), mild and cold weather, four heating curves (fitting, 35 / 27, HL2
too high, HL8 too low), 14 days each. Coast off against coast on:

| Outcome | Count |
| --- | --- |
| Coast off better | 11 |
| Equal | 9 |
| Coast off slightly worse | 4, all with the too-low curve HL8: up to about 1 hour per day more than 0.5 °C too cold in mild weather |

With coast off the compressor started 0.4 times per day on average, with coast
on 2.9 times. A jump of more than 1 °C in the advice did not occur with coast
off. With a heating curve that is too low, the fix is to raise the curve, not
coast.

**What was tried to keep coast.** Fixing the coast target at its lowest value
(worse), letting the advice rise gradually after coast (hardly helps), and only
pausing the I-term without pulling the advice down (worse with a heating curve
that is too high).

**History.** In 3.5.0 and 3.5.1 coast was on for Floor heating. That choice came
from simulations with a heating curve that fits exactly; there coast makes
little difference. With the two-point app curve, as users have it, the swinging
showed up. Since 3.5.2 coast is off in both presets.

**Coast anyway?** Choose Positional – Manual and turn **Coast on** on. The swinging
described above can then still happen. No situation has been tested in which
coast does better in Positional.

The presets turn coast off, whatever the switch **Coast on** says. In Classic and
Manual the switch does count.

## The settings one by one

In the order of the groups.

| Setting | What it does | Counts in | Default |
| --- | --- | --- | --- |
| **Group Adaptive control** | | | |
| Adaptive control on | Turns the calculation of the advice on | All | Off |
| Control mode | Classic or one of the three positional variants | All | Classic |
| Lowest water temperature in the recommendation | Lowest advice; match it to P111 | All | 18 °C |
| Highest water temperature in the recommendation | Highest advice; at least 2 °C above the minimum | All | 60 °C (Tuya 65 °C) |
| **Group heating curve (Positional)** | | | |
| Basis of the recommendation | App curve or heat pump curve (followed continuously) | Positional | App curve |
| Copy once into the app curve | Fills in the two values below once | Positional | — |
| App curve: water at −15 °C / +15 °C outdoor | The two points of the app curve | Positional | 45 / 30, or the mode's starting curve |
| **Group fine-tuning (Positional – Manual)** | | | |
| Kp: degrees of water per degree indoors | Degrees of water temperature per degree of indoor deviation | Manual | 3 |
| Ti: integration time | How slowly the I-term grows | Manual | 3 hours |
| **Group fine-tuning (Classic)** | | | |
| Kp: proportional gain | Size of the correction per degree of deviation | Classic | 5.0 |
| Ki: integral gain | How strongly a lasting deviation is corrected | Classic | 1.5 |
| Deadband | Deviation within which nothing changes | Classic | 0.3 °C |
| **Group coast** | | | |
| Coast on | Coast on or off | Classic, Manual | On |
| Coast: recommendation below the water temperature | How many degrees below the water temperature coast aims | Classic, Manual | 1 °C |
| Coast: start threshold above desired | Margin above the room target before coast starts | Classic, Manual | 0.3 °C |
| Coast: share in the recommendation | How heavily coast weighs | Classic, Manual | 0.80 |
| Coast: maximum duration (Aurora) | Maximum number of 5-minute cycles | Classic, Manual | 24 |
| **Group weighting factors** | | | |
| Comfort | Weight of the temperature control; in Positional the room for Efficiency and Cost | All | 50 % |
| Efficiency | Weight of the COP optimization | All | 15 % |
| Cost | Weight of the price optimization | All | 15 % |
| Building model — Classic only | Weight of the building model | Classic | 20 % |

The weighting factors are scaled together to 100 %. Efficiency and Cost only do
something while COP or price optimization is on. In Positional they shift the
room target, by at most 1.5 °C; the heating curve shifts along. Comfort sets
how much room they get there: a lower value gives them more room.

## Outdoor temperature

The control, and especially the heating curve in Positional, uses the outdoor
temperature. The app takes the first one available:

1. the outdoor temperature from a flow card, if it is less than 1 hour old;
2. the Open-Meteo weather forecast for the current hour;
3. the outdoor sensor of the heat pump.

While the location is still the default (Amsterdam), the outdoor sensor of the
heat pump goes before the weather forecast (since v3.7.1).

The forecast is fetched every hour, also while **Enable weather forecast
integration** is off; that switch only shows or hides the forecast sensors. The
forecast applies to the location in the settings. Enter your own location there,
or send the outdoor temperature at least every hour through a flow card.

Exception: **Heat pump curve** uses the outdoor sensor of the heat pump.

## Differences per driver

| | Tuya | Aurora I/II | Aurora III |
| --- | --- | --- | --- |
| Basis of the recommendation | Not present: always the app curve | App curve or DIY heating curve | App curve or climate curve |
| Copy once | H1–H8, L1–L8 | HH1–HH8, HL1–HL8 and DIY (L28/L29) | Not present |
| Coast: maximum duration | Not adjustable | Adjustable | Adjustable |
| Highest water temperature in the recommendation | 25–65 °C, default 65 °C | 25–60 °C, default 60 °C | 25–60 °C, default 60 °C |
| Setpoint only stays with | Heating curve OFF | Heating curve selection OFF | — |

## Questions

**The advice changes, but the heat pump does not.**
There is no flow that carries out the advice, or the heating curve selection of
the heat pump is not set to OFF.

**The setpoint jumps back after a while.**
The heating curve selection (Tuya: heating curve) is not set to OFF. The heat
pump then puts back its own heating curve value.

**The advice stands still.**
Is **Adaptive control on** on, does the indoor temperature come in, and does
**Desired Indoor Temperature** have a value? Without all three, no new advice
is calculated. The control only reports this in the debug log.

**I changed Kp, but nothing changes.**
In Positional, **Kp: proportional gain** (group fine-tuning Classic) does not
count; there **Kp: degrees of water per degree indoors** applies, and only in
Manual.

**I saved a setting, but nothing changes.**
Open the settings screen again and check that the value was kept. After an
error message the screen may still show the value you entered while the app
keeps the old one. Before 3.6.2, a forgetting factor below 0.9985 blocked every
save; 3.6.2 sets such a value to 0.999.

**I turned coast off, or on, but nothing changes.**
In Positional – Radiators and – Floor heating, coast is always off.

**After choosing a control mode, the curve values are not 50 / 35.**
You changed the values yourself earlier, or had them filled in from a fixed
curve. The app does not overwrite your own heating curve.

**The advice is far from what the heat pump does now.**
The app's heating curve differs from the heat pump's. Copy the heat pump's
heating curve (see [Choose the heating curve](#4-choose-the-heating-curve-positional-only)).
Also check the location used for the outdoor temperature.
