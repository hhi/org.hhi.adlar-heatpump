# 🚀 New Feature: Adaptive Temperature Control

> **Status**: Available from version 2.5.x  
> **Requires**: External indoor temperature sensor via Homey Flow

---

## What is Adaptive Temperature Control?

The Adlar app now **learns** how your home behaves and automatically adjusts the heat pump for optimal comfort and maximum savings.

### The 3 Pillars: Comfort • Efficiency • Cost

| Factor | What it does | Setting |
|--------|--------------|---------|
| 🛋️ **Comfort** | Stable indoor temperature (±0.3°C) via PI control | 60% (default) |
| ⚡ **Efficiency** | Optimal COP through smart supply temperature | 25% (default) |
| 💰 **Cost** | Pre-heat during cheap electricity, reduce during expensive | 15% (default) |

*Weights are adjustable and automatically normalize to 100%.*

---

## What Can It Achieve?

### 1. More Stable Temperature
- **Problem**: Traditional thermostats react slowly, temperature fluctuates 1-2°C
- **Solution**: PI controller with prediction → indoor temperature stays within ±0.3°C

### 2. Lower Energy Bills
- **COP Optimization**: Learns optimal supply temperature per outdoor temperature → €200-300/year
- **Price Optimization**: Pre-heats during cheap hours → €400-600/year

### 3. Smarter Building Model
The app automatically learns:
- **Thermal mass (C)**: How quickly your home cools down
- **Heat loss (UA)**: Insulation quality
- **Time constant (τ)**: Hours until stable temperature
- **Solar gain (g)**: Heating contribution from sun

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

---

## How to Activate?

1. **Device Settings** → Enable `Adaptive temperature control`
2. Create flow for indoor temperature
3. Wait 24-48 hours for building model learning
4. Optional: Enable COP/Price optimization

---

*More info: [Advanced Features Introduction](setup/Advanced_Features_Intro.en.md)*
*More info: [Configuration Guide](setup/advanced-settings/CONFIGURATION_GUIDE.en.md) - Section 5*
