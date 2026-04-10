# 🚀 New Feature: Adaptive Temperature Control

> **Status**: Available from version 2.8.x  
> **Requires**: External indoor temperature sensor via Homey Flow

---

## What is Adaptive Temperature Control?

The Adlar app now **learns** how your home behaves and automatically adjusts the heat pump for optimal comfort and maximum savings.

### The 5 Pillars: Comfort • Efficiency • Cost • Thermal • Coast

| Factor | What it does | Setting |
|--------|--------------|---------|
| 🛋️ **Comfort** | Stable indoor temperature (±0.3°C) via PI control | 50% (default) |
| ⚡ **Efficiency** | Optimal COP through smart supply temperature | 15% (default) |
| 💰 **Cost** | Pre-heat during cheap electricity, reduce during expensive | 15% (default) |
| 🏠 **Thermal** | Predictive control via learned building model (τ, C, UA) | 20% (default) |
| ❄️ **Coast** | Passive cooling — prevents unnecessary heating above setpoint | max. 80% (conditional) |

*Weights are adjustable and automatically normalize to 100%.*

---

## What Can It Achieve?

### 1. More Stable Temperature
- **Problem**: Traditional thermostats react slowly, temperature fluctuates 1-2°C
- **Solution**: PI controller with prediction → indoor temperature stays within ±0.3°C

### 2. Lower Energy Bills
- **COP Optimization**: Learns optimal supply temperature per outdoor temperature → €200-300/year
- **Price Optimization**: Pre-heats during cheap hours → €400-600/year

### 3. Smarter Building Model (v2.6.0+)

The app automatically learns:

- **Thermal mass (C)**: How quickly your home cools down
- **Heat loss (UA)**: Insulation quality
- **Time constant (τ)**: Hours until stable temperature
- **Solar gain (g)**: Heating contribution from sun (if sensor available)
- **Wind correction**: Extra heat loss during strong wind (v2.7.0+)

**Learning period**: 48-72 hours for a reliable model  
**Updates**: Continuous learning as conditions change

### 4. Passive Cooling Mode (v2.8.0+)

- **Problem**: Heat pump keeps heating while the room is already too warm (e.g. from solar gain)
- **Solution**: Coast strategy detects overshoot → lowers setpoint below water temperature → compressor stops
- **I-term reset**: PI controller starts fresh after cooling phase
- **Hydraulic lag (v2.10.x+)**: Coast automatically yields its weight back to the PI controller while the outlet temperature has not yet responded to a setpoint decrease — ensuring correction is never blocked

---

## Required Setup

```
┌─────────────────────────────────────────────────────┐
│   External Sensor   →    Flow Card    →    App      │
│   (thermostat)           (trigger)        (learns)  │
└─────────────────────────────────────────────────────┘
```

**Minimum requirements:**
1. ✅ Indoor temperature sensor (e.g., Aqara, Tado, Homey thermostat)
2. ✅ Flow: `WHEN temp changes` → `Send to heat pump`

**Optional for extra features:**
- Outdoor temperature sensor (weather service, weather station)
- External power meter (for COP)
- Dynamic energy contract (for price optimization)
- Wind speed sensor (for wind correction on heat loss)
- Solar radiation sensor (for solar-gain learning)

---

## How to Activate?

1. **Device Settings** → Enable `Adaptive temperature control`
2. Create flow for indoor temperature
3. Wait 48-72 hours for building model learning
4. Optional: Enable COP/Price optimization
5. Optional: Configure wind/solar sensors for extra optimization

---

*More info: [Advanced Features Introduction](setup/advanced-control/Advanced_Features_Intro.en.md)*
*More info: [Configuration Guide](setup/advanced-settings/CONFIGURATION_GUIDE.en.md) - Section 5*
