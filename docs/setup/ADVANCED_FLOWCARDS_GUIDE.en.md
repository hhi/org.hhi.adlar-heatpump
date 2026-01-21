# 🔧 Flow Cards Documentation: Advanced Features

> **Version**: 2.6.x  
> **Purpose**: Flow cards for adaptive control, building model, energy optimizer, COP optimizer, and building insights

---

## 📊 Overview per Module

| Module | Triggers | Conditions | Actions | Total |
|--------|----------|------------|---------|-------|
| Adaptive Control | 3 | 2 | 2 | **7** |
| Building Model | 1 | 1 | 0 | **2** |
| Energy/Price Optimizer | 2 | 3 | 1 | **6** |
| COP Optimizer | 5 | 5 | 0 | **10** |
| Building Insights | 2 | 1 | 2 | **5** |

---

## 1️⃣ Adaptive Temperature Control

### 🔵 TRIGGERS

| Flow ID | Title | Description |
|---------|-------|-------------|
| `adaptive_simulation_update` ⭐ | Simulated temperature updated | Central trigger (every 5 min) with full breakdown |
| `temperature_adjustment_recommended` ⭐ | Recommended temperature adjustment | Trigger for flow-assisted mode with recommendation |
| `adaptive_status_change` | Adaptive control status changed | Status change (on/off/error) |

#### `temperature_adjustment_recommended` - Tokens
| Token | Type | Description |
|-------|------|-------------|
| `current_temperature` | number | Current target temperature (°C) |
| `recommended_temperature` | number | Recommended target temperature (°C) |
| `adjustment` | number | Temperature adjustment (°C) |
| `reason` | string | Adjustment reason |
| `controller` | string | Controller type (weighted) |
| `building_model_confidence` | number | Building model confidence (%) |

#### `adaptive_simulation_update` - Tokens
| Token | Type | Description |
|-------|------|-------------|
| `simulated_target` | number | Simulated target temperature (°C) |
| `actual_target` | number | Actual target (°C) |
| `delta` | number | Difference (°C) |
| `adjustment` | number | Proposed adjustment (°C) |
| `comfort_component` | number | Comfort contribution (°C) |
| `efficiency_component` | number | COP contribution (°C) |
| `cost_component` | number | Cost contribution (°C) |
| `building_model_confidence` | number | Building model confidence (%) |
| `cop_confidence` | number | COP confidence (%) |
| `reasoning` | string | Calculation explanation |

---

### 🟢 ACTIONS

| Flow ID | Title | Description |
|---------|-------|-------------|
| `receive_external_indoor_temperature` ⭐ | Send indoor temperature to heat pump | **ESSENTIAL** - Connect external sensor |
| `receive_external_ambient_data` | Send outdoor temperature | External outdoor temperature |

#### `receive_external_indoor_temperature` - Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `temperature_value` | text | Temperature in °C |

---

### 🟡 CONDITIONS

| Flow ID | Title | Description |
|---------|-------|-------------|
| `confidence_above` | Model confidence above threshold | Quality gate |

---

## 2️⃣ Building Model Learning

> **Note**: Building model diagnostics are automatically updated to the `building_model_diagnostics` capability.

---

### 🟡 CONDITIONS

| Flow ID | Title | Description |
|---------|-------|-------------|
| `confidence_above` | Model confidence above threshold | Check confidence level |

---

## 3️⃣ Energy/Price Optimizer

### 🔵 TRIGGERS

| Flow ID | Title | Description |
|---------|-------|-------------|
| `price_trend_changed` ⭐ | Price trend changed | rising → falling → stable |
| `price_threshold_crossed` | Price threshold crossed | Category changed |

#### `price_trend_changed` - Tokens
| Token | Type | Description |
|-------|------|-------------|
| `old_trend` | string | Previous trend |
| `new_trend` | string | New trend |
| `hours_analyzed` | number | Hours in analysis |

---

### 🟢 ACTIONS

| Flow ID | Title | Description |
|---------|-------|-------------|
| `receive_external_energy_prices` ⭐ | Send energy prices to heat pump | JSON format `{"0":0.11,...}` |

---

### 🟡 CONDITIONS

| Flow ID | Title | Description |
|---------|-------|-------------|
| `price_in_cheapest_hours` | Price in cheapest hours | Check if current hour is in cheapest X hours |
| `price_vs_daily_average` | Price vs daily average | Above/below X% of average |
| `price_trend_is` | Price trend is | rising/falling/stable |

---

## 4️⃣ COP Optimizer

### 🔵 TRIGGERS

| Flow ID | Title | Description |
|---------|-------|-------------|
| `cop_efficiency_changed` | COP efficiency changed | Current COP changed |
| `cop_outlier_detected` | COP outlier detected | Value < 0.5 or > 8.0 |
| `cop_trend_detected` | COP trend detected | Trend classification |
| `daily_cop_efficiency_changed` | Daily COP changed | 24-hour average |
| `monthly_cop_efficiency_changed` | Monthly COP changed | 30-day average |

---

> **Note**: COP optimizer diagnostics are automatically updated to the `cop_optimizer_diagnostics` capability.

---

### 🟡 CONDITIONS

| Flow ID | Title | Description |
|---------|-------|-------------|
| `cop_efficiency_check` | COP above/below threshold | Threshold check |
| `cop_calculation_method_is` | COP method is | auto, direct_thermal, etc. |
| `cop_trend_analysis` | COP trend is | Trend classification |
| `daily_cop_above_threshold` | Daily COP above threshold | 24-hour check |
| `monthly_cop_above_threshold` | Monthly COP above threshold | 30-day check |

---

## 5️⃣ Building Insights

### 🔵 TRIGGERS

| Flow ID | Title | Description |
|---------|-------|-------------|
| `building_insight_detected` ⭐ | New building insight | Triggers at ≥70% confidence |
| `pre_heat_recommendation` ⭐ | Pre-heat recommendation | Triggers when ΔT > 1.5°C (v2.6.0) |

#### `building_insight_detected` - Tokens
| Token | Type | Description |
|-------|------|-------------|
| `category` | string | Category (thermal_storage, etc.) |
| `insight` | string | Insight description |
| `recommendation` | string | Recommendation |
| `priority` | number | Priority (0-100) |
| `confidence` | number | Confidence (%) |
| `estimated_savings_eur_month` | number | Estimated savings €/month |

#### `pre_heat_recommendation` - Tokens (v2.6.0)
| Token | Type | Description |
|-------|------|-------------|
| `duration_hours` | number | Pre-heat duration in hours |
| `temp_rise` | number | Required temperature rise (°C) |
| `current_temp` | number | Current indoor temperature (°C) |
| `target_temp` | number | Target temperature (°C) |
| `confidence` | number | Model confidence (%) |

**Trigger conditions:**
- ΔT (target - indoor) > 1.5°C
- Model confidence ≥ 70%
- Max 1x per 4 hours (fatigue prevention)

---

### 🟢 ACTIONS

| Flow ID | Title | Description |
|---------|-------|-------------|
| `force_insight_analysis` | Force insight analysis | Evaluate immediately (tokens: insights_detected, confidence) |
| `calculate_preheat_time` ⭐ | Calculate pre-heat duration | Calculates time needed to warm up ±X°C (v2.6.0) |

#### `calculate_preheat_time` - Parameters & Returns
| Parameter | Type | Description |
|-----------|------|-------------|
| `temperature_rise` | number | Desired temperature rise in °C (e.g., 2.0) |

| Return Token | Type | Description |
|--------------|------|-------------|
| `preheat_hours` | number | Pre-heat duration in hours |
| `confidence` | number | Model confidence (%) |
| `building_tau` | number | Thermal time constant τ (hours) |

---

### 🟡 CONDITIONS

| Flow ID | Title | Description |
|---------|-------|-------------|
| `insight_is_active` | Insight is active | Check if category is active |

---

## 📁 Source Code Locations

### JSON Definitions
```
.homeycompose/flow/
├── triggers/   → Flow trigger definitions
├── conditions/ → Flow condition definitions
└── actions/    → Flow action definitions
```

### Code Implementation Reference

> **Legend**: Trigger = where flow is invoked | RunListener = where filtering/args are processed

#### TRIGGERS

| Flow ID | Trigger Location | RunListener Location |
|---------|------------------|----------------------|
| `adaptive_simulation_update` | `adaptive-control-service.ts:945` | - |
| `temperature_adjustment_recommended` | `adaptive-control-service.ts:907` | - |
| `adaptive_status_change` | `adaptive-control-service.ts:882` | - |
| `building_insight_detected` | `building-insights-service.ts:748` | - |
| `price_trend_changed` | `adaptive-control-service.ts:1919` | - |
| `price_threshold_crossed` | `adaptive-control-service.ts:1678` | - |
| `cop_efficiency_changed` | `device.ts:2043` | `app.ts:988` |
| `cop_outlier_detected` | `device.ts:2019` | - |
| `cop_trend_detected` | `rolling-cop-calculator.ts:586` | - |
| `daily_cop_efficiency_changed` | `rolling-cop-calculator.ts:618` | `app.ts:1022` |
| `monthly_cop_efficiency_changed` | `rolling-cop-calculator.ts:636` | `app.ts:1056` |

#### ACTIONS

| Flow ID | Handler Location |
|---------|------------------|
| `receive_external_indoor_temperature` | `flow-card-manager-service.ts:988` |
| `receive_external_energy_prices` | `flow-card-manager-service.ts:1021` |
| `receive_external_power_data` | `flow-card-manager-service.ts:945` |
| `receive_external_flow_data` | `flow-card-manager-service.ts:964` |
| `receive_external_ambient_data` | `flow-card-manager-service.ts:976` |
| `force_insight_analysis` | `flow-card-manager-service.ts:745` |

#### CONDITIONS

| Flow ID | Handler Location |
|---------|------------------|
| `confidence_above` | `flow-card-manager-service.ts:814` |
| `insight_is_active` | `flow-card-manager-service.ts:798` |
| `price_in_cheapest_hours` | `flow-card-manager-service.ts:506` |
| `price_vs_daily_average` | `flow-card-manager-service.ts:629` |
| `price_trend_is` | `flow-card-manager-service.ts:563` |
| `savings_above` | `flow-card-manager-service.ts:830` |

---

*See: [Configuration Guide](./advanced-settings/CONFIGURATION_GUIDE.en.md) for all settings*
