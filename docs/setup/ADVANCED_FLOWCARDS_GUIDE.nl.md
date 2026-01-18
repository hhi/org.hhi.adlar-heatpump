# 🔧 Flow Cards Documentatie: Geavanceerde Functies

> **Versie**: 2.5.x  
> **Doel**: Flow cards voor adaptieve regeling, building model, energy optimizer, COP optimizer en building insights

---

## 📊 Overzicht per Module

| Module | Triggers | Conditions | Actions | Totaal |
|--------|----------|------------|---------|--------|
| Adaptieve Regeling | 3 | 2 | 2 | **7** |
| Building Model | 1 | 1 | 2 | **4** |
| Energy/Price Optimizer | 2 | 3 | 1 | **6** |
| COP Optimizer | 5 | 5 | 1 | **11** |
| Building Insights | 1 | 1 | 4 | **6** |

---

## 1️⃣ Adaptieve Temperatuurregeling

### 🔵 TRIGGERS

| Flow ID | Titel | Beschrijving |
|---------|-------|--------------|
| `adaptive_simulation_update` ⭐ | Simulated temperature updated | Centrale trigger (elke 5 min) met volledige breakdown |
| `temperature_adjustment_recommended` ⭐ | Aanbevolen temperatuur aanpassing | Trigger voor flow-assisted modus met aanbeveling |
| `adaptive_status_change` | Adaptive control status changed | Status verandering (aan/uit/fout) |

#### `temperature_adjustment_recommended` - Tokens
| Token | Type | Beschrijving |
|-------|------|--------------|
| `current_temperature` | number | Huidige doeltemperatuur (°C) |
| `recommended_temperature` | number | Aanbevolen doeltemperatuur (°C) |
| `adjustment` | number | Temperatuur aanpassing (°C) |
| `reason` | string | Reden voor aanpassing |
| `controller` | string | Controller type (weighted) |
| `building_model_confidence` | number | Gebouwmodel betrouwbaarheid (%) |

#### `adaptive_simulation_update` - Tokens
| Token | Type | Beschrijving |
|-------|------|--------------|
| `simulated_target` | number | Gesimuleerde doeltemperatuur (°C) |
| `actual_target` | number | Werkelijke doel (°C) |
| `delta` | number | Verschil (°C) |
| `adjustment` | number | Voorgestelde aanpassing (°C) |
| `comfort_component` | number | Bijdrage comfort (°C) |
| `efficiency_component` | number | Bijdrage COP (°C) |
| `cost_component` | number | Bijdrage prijs (°C) |
| `building_model_confidence` | number | Gebouwmodel betrouwbaarheid (%) |
| `cop_confidence` | number | COP betrouwbaarheid (%) |
| `reasoning` | string | Uitleg berekening |

---

### 🟢 ACTIONS

| Flow ID | Titel | Beschrijving |
|---------|-------|--------------|
| `receive_external_indoor_temperature` ⭐ | Stuur binnentemperatuur naar warmtepomp | **ESSENTIEEL** - Externe sensor koppelen |
| `receive_external_ambient_data` | Stuur buitentemperatuur | Externe buitentemperatuur |

#### `receive_external_indoor_temperature` - Parameters
| Parameter | Type | Beschrijving |
|-----------|------|--------------|
| `temperature_value` | text | Temperatuur in °C |

---

### 🟡 CONDITIONS

| Flow ID | Titel | Beschrijving |
|---------|-------|--------------|
| `confidence_above` | Model betrouwbaarheid boven drempel | Kwaliteitspoort |

---

## 2️⃣ Building Model Learning

### 🟢 ACTIONS

| Flow ID | Titel | Beschrijving |
|---------|-------|--------------|
| `diagnose_building_model` | Diagnosticeer gebouwmodel leren | Logt τ/C/UA status naar app logs |

---

### 🟡 CONDITIONS

| Flow ID | Titel | Beschrijving |
|---------|-------|--------------|
| `confidence_above` | Model betrouwbaarheid boven drempel | Check confidence level |

---

## 3️⃣ Energy/Price Optimizer

### 🔵 TRIGGERS

| Flow ID | Titel | Beschrijving |
|---------|-------|--------------|
| `price_trend_changed` ⭐ | Prijstrend veranderd | rising → falling → stable |
| `price_threshold_crossed` | Prijs drempel overschreden | Categorie veranderd |

#### `price_trend_changed` - Tokens
| Token | Type | Beschrijving |
|-------|------|--------------|
| `old_trend` | string | Vorige trend |
| `new_trend` | string | Nieuwe trend |
| `hours_analyzed` | number | Uren in analyse |

---

### 🟢 ACTIONS

| Flow ID | Titel | Beschrijving |
|---------|-------|--------------|
| `receive_external_energy_prices` ⭐ | Stuur energieprijzen naar warmtepomp | JSON formaat `{"0":0.11,...}` |

---

### 🟡 CONDITIONS

| Flow ID | Titel | Beschrijving |
|---------|-------|--------------|
| `price_in_cheapest_hours` | Prijs in goedkoopste uren | Check of huidig uur in goedkoopste X uren |
| `price_vs_daily_average` | Prijs vs daggemiddelde | Boven/onder X% van gemiddelde |
| `price_trend_is` | Prijstrend is | rising/falling/stable |

---

## 4️⃣ COP Optimizer

### 🔵 TRIGGERS

| Flow ID | Titel | Beschrijving |
|---------|-------|--------------|
| `cop_efficiency_changed` | COP efficiëntie veranderd | Huidige COP veranderd |
| `cop_outlier_detected` | COP outlier gedetecteerd | Waarde < 0.5 of > 8.0 |
| `cop_trend_detected` | COP trend gedetecteerd | Trend classificatie |
| `daily_cop_efficiency_changed` | Dagelijkse COP veranderd | 24-uurs gemiddelde |
| `monthly_cop_efficiency_changed` | Maandelijkse COP veranderd | 30-dagen gemiddelde |

---

### 🟢 ACTIONS

| Flow ID | Titel | Beschrijving |
|---------|-------|--------------|
| `diagnose_cop_optimizer` | Diagnosticeer COP optimizer leren | Logt samples per temp bucket |

---

### 🟡 CONDITIONS

| Flow ID | Titel | Beschrijving |
|---------|-------|--------------|
| `cop_efficiency_check` | COP boven/onder drempel | Threshold check |
| `cop_calculation_method_is` | COP methode is | auto, direct_thermal, etc. |
| `cop_trend_analysis` | COP trend is | Trend classificatie |
| `daily_cop_above_threshold` | Dagelijkse COP boven drempel | 24-uurs check |
| `monthly_cop_above_threshold` | Maandelijkse COP boven drempel | 30-dagen check |

---

## 5️⃣ Building Insights

### 🔵 TRIGGERS

| Flow ID | Titel | Beschrijving |
|---------|-------|--------------|
| `building_insight_detected` ⭐ | Nieuw gebouw inzicht | Triggert bij ≥70% confidence |

#### `building_insight_detected` - Tokens
| Token | Type | Beschrijving |
|-------|------|--------------|
| `category` | string | Categorie (thermal_storage, etc.) |
| `insight` | string | Beschrijving inzicht |
| `recommendation` | string | Aanbeveling |
| `priority` | number | Prioriteit (0-100) |
| `confidence` | number | Betrouwbaarheid (%) |
| `estimated_savings_eur_month` | number | Geschatte besparing €/maand |

---

### 🟢 ACTIONS

| Flow ID | Titel | Beschrijving |
|---------|-------|--------------|
| `force_insight_analysis` | Forceer inzicht analyse | Direct evalueren (tokens: insights_detected, confidence) |
| `dismiss_insight` | Negeer inzicht | Verberg categorie voor X dagen |
| `reset_insight_history` | Reset inzicht geschiedenis | Wis alle genegeerde insights |
| `set_confidence_threshold` | Stel betrouwbaarheidsdrempel in | Dynamisch aanpassen (50-90%) |

---

### 🟡 CONDITIONS

| Flow ID | Titel | Beschrijving |
|---------|-------|--------------|
| `insight_is_active` | Inzicht is actief | Check of categorie actief is |

---

## 📁 Source Code Locaties

### JSON Definities
```
.homeycompose/flow/
├── triggers/   → Flow trigger definities
├── conditions/ → Flow condition definities
└── actions/    → Flow action definities
```

### Code Implementatie Referentie

> **Legenda**: Trigger = waar de flow wordt aangeroepen | RunListener = waar filtering/args worden verwerkt

#### TRIGGERS

| Flow ID | Trigger Locatie | RunListener Locatie |
|---------|-----------------|---------------------|
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

| Flow ID | Handler Locatie |
|---------|-----------------|
| `receive_external_indoor_temperature` | `flow-card-manager-service.ts:988` |
| `receive_external_energy_prices` | `flow-card-manager-service.ts:1021` |
| `receive_external_power_data` | `flow-card-manager-service.ts:945` |
| `receive_external_flow_data` | `flow-card-manager-service.ts:964` |
| `receive_external_ambient_data` | `flow-card-manager-service.ts:976` |
| `diagnose_building_model` | `flow-card-manager-service.ts:1033` |
| `diagnose_cop_optimizer` | `flow-card-manager-service.ts:857` |
| `force_insight_analysis` | `flow-card-manager-service.ts:745` |
| `dismiss_insight` | `flow-card-manager-service.ts:731` |
| `reset_insight_history` | `flow-card-manager-service.ts:762` |
| `set_confidence_threshold` | `flow-card-manager-service.ts:782` |

#### CONDITIONS

| Flow ID | Handler Locatie |
|---------|-----------------|
| `confidence_above` | `flow-card-manager-service.ts:814` |
| `insight_is_active` | `flow-card-manager-service.ts:798` |
| `price_in_cheapest_hours` | `flow-card-manager-service.ts:506` |
| `price_vs_daily_average` | `flow-card-manager-service.ts:629` |
| `price_trend_is` | `flow-card-manager-service.ts:563` |
| `savings_above` | `flow-card-manager-service.ts:830` |

---

*Zie: [Configuration Guide](./advanced-settings/CONFIGURATION_GUIDE.nl.md) voor alle instellingen*

