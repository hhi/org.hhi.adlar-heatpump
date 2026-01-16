# 🏠 New Feature: Building Model & Building Insights

> **Status**: Available from version 2.5.x  
> **Requires**: Adaptive Temperature Control active + indoor/outdoor temperature

---

## What is the Building Model?

The app **automatically** learns the thermal properties of your home by analyzing temperature data. After 24-48 hours, the app knows your house better than you do.

### What Does the App Learn?

| Parameter | What it means | Example |
|-----------|---------------|---------|
| **C** (Thermal mass) | How much heat your house can store | Concrete floor = high, wooden frame = low |
| **UA** (Heat loss) | How quickly heat escapes | Well insulated = low UA |
| **τ** (Time constant) | Hours until stable temperature | τ = 50h = slow cooling |
| **g** (Solar gain) | Heating contribution from sunlight | South-facing glass = high g |
| **P_int** (Internal heat) | Heat production by occupants/appliances | Family with PCs = higher P_int |

---

## What is Building Insights?

After learning your building, the app provides **concrete recommendations** with estimated ROI (Return on Investment).

### Examples of Insights:

| Insight | Recommendation | Estimated Savings |
|---------|----------------|-------------------|
| 🌡️ **High UA** | "Consider roof insulation" | €200-400/year |
| ⏰ **Long τ** | "Pre-heating is effective" | €100-150/year |
| ☀️ **High g-value** | "Shading = less cooling needed" | €50-100/year |
| 🔥 **High P_int** | "Night temperature can be lower" | €50-80/year |

---

## How Does It Work?

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Collect Data                                       │
│  ────────────────────                                       │
│  • Indoor temperature (sensor)                              │
│  • Outdoor temperature (weather service/sensor)             │
│  • Heat pump power (optional)                               │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Machine Learning                                   │
│  ────────────────────────                                   │
│  • After 10 samples: first analysis                         │
│  • After 24 hours: 70% confidence                           │
│  • After 1 week: complete profile configuration             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Generate Insights                                  │
│  ─────────────────────────                                  │
│  • Comparison with reference values                         │
│  • ROI calculation per recommendation                       │
│  • Max 3 active insights at a time                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Confidence Levels

| Confidence | What it means | Action |
|------------|---------------|--------|
| 0-30% | Insufficient data | Wait for more samples |
| 30-70% | Basic model | First predictions possible |
| 70-90% | Reliable model | Insights available |
| 90-100% | Complete profile | Seasonal adjustments active |

**Default**: Insights appear only at 70% confidence (configurable).

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `building_model_enabled` | Off | Enable building model learning |
| `building_insights_enabled` | Off | Enable recommendations |
| `building_insights_min_confidence` | 70% | Minimum certainty for insights |
| `building_insights_max_active` | 3 | Max simultaneous recommendations |

---

## Requirements

**Minimum:**
- ✅ Adaptive temperature control active
- ✅ Indoor temperature sensor

**Recommended:**
- ✅ External outdoor temperature (weather service/weather station)
- ✅ External power measurement (for € savings in insights)

---

*More info: [Advanced Features Introduction](setup/Advanced_Features_Intro.en.md)*
*More info: [Configuration Guide](setup/advanced-settings/CONFIGURATION_GUIDE.en.md) - Section 6 & 7*
