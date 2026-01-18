# 🔧 Flow Cards Dokumentation: Erweiterte Funktionen

> **Version**: 2.5.x  
> **Zweck**: Flow Cards für adaptive Regelung, Gebäudemodell, Energieoptimierer, COP-Optimierer und Gebäudeeinblicke

---

## 📊 Übersicht pro Modul

| Modul | Triggers | Conditions | Actions | Gesamt |
|-------|----------|------------|---------|--------|
| Adaptive Regelung | 3 | 2 | 2 | **7** |
| Gebäudemodell | 1 | 1 | 2 | **4** |
| Energie/Preis-Optimierer | 2 | 3 | 1 | **6** |
| COP-Optimierer | 5 | 5 | 1 | **11** |
| Gebäudeeinblicke | 1 | 1 | 4 | **6** |

---

## 1️⃣ Adaptive Temperaturregelung

### 🔵 TRIGGERS

| Flow ID | Titel | Beschreibung |
|---------|-------|--------------|
| `adaptive_simulation_update` ⭐ | Simulierte Temperatur aktualisiert | Zentraler Trigger (alle 5 Min) mit vollständiger Aufschlüsselung |
| `temperature_adjustment_recommended` ⭐ | Empfohlene Temperaturanpassung | Trigger für Flow-assisted Modus mit Empfehlung |
| `adaptive_status_change` | Adaptive Steuerung Status geändert | Statusänderung (ein/aus/Fehler) |

#### `temperature_adjustment_recommended` - Tokens
| Token | Typ | Beschreibung |
|-------|-----|--------------|
| `current_temperature` | number | Aktuelle Zieltemperatur (°C) |
| `recommended_temperature` | number | Empfohlene Zieltemperatur (°C) |
| `adjustment` | number | Temperaturanpassung (°C) |
| `reason` | string | Anpassungsgrund |
| `controller` | string | Controller-Typ (weighted) |
| `building_model_confidence` | number | Gebäudemodell-Vertrauen (%) |

#### `adaptive_simulation_update` - Tokens
| Token | Typ | Beschreibung |
|-------|-----|--------------|
| `simulated_target` | number | Simulierte Zieltemperatur (°C) |
| `actual_target` | number | Tatsächliches Ziel (°C) |
| `delta` | number | Differenz (°C) |
| `adjustment` | number | Vorgeschlagene Anpassung (°C) |
| `comfort_component` | number | Komfort-Beitrag (°C) |
| `efficiency_component` | number | COP-Beitrag (°C) |
| `cost_component` | number | Kosten-Beitrag (°C) |
| `building_model_confidence` | number | Gebäudemodell-Vertrauen (%) |
| `cop_confidence` | number | COP-Vertrauen (%) |
| `reasoning` | string | Berechnungserklärung |

---

### 🟢 ACTIONS

| Flow ID | Titel | Beschreibung |
|---------|-------|--------------|
| `receive_external_indoor_temperature` ⭐ | Raumtemperatur an Wärmepumpe senden | **WESENTLICH** - Externen Sensor verbinden |
| `receive_external_ambient_data` | Außentemperatur senden | Externe Außentemperatur |

#### `receive_external_indoor_temperature` - Parameter
| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `temperature_value` | text | Temperatur in °C |

---

### 🟡 CONDITIONS

| Flow ID | Titel | Beschreibung |
|---------|-------|--------------|
| `confidence_above` | Modellvertrauen über Schwelle | Qualitätsgate |

---

## 2️⃣ Gebäudemodell-Lernen

### 🟢 ACTIONS

| Flow ID | Titel | Beschreibung |
|---------|-------|--------------|
| `diagnose_building_model` | Gebäudemodell-Lernen diagnostizieren | Protokolliert τ/C/UA-Status |

---

### 🟡 CONDITIONS

| Flow ID | Titel | Beschreibung |
|---------|-------|--------------|
| `confidence_above` | Modellvertrauen über Schwelle | Vertrauensniveau prüfen |

---

## 3️⃣ Energie/Preis-Optimierer

### 🔵 TRIGGERS

| Flow ID | Titel | Beschreibung |
|---------|-------|--------------|
| `price_trend_changed` ⭐ | Preistrend geändert | rising → falling → stable |
| `price_threshold_crossed` | Preisschwelle überschritten | Kategorie geändert |

#### `price_trend_changed` - Tokens
| Token | Typ | Beschreibung |
|-------|-----|--------------|
| `old_trend` | string | Vorheriger Trend |
| `new_trend` | string | Neuer Trend |
| `hours_analyzed` | number | Analysierte Stunden |

---

### 🟢 ACTIONS

| Flow ID | Titel | Beschreibung |
|---------|-------|--------------|
| `receive_external_energy_prices` ⭐ | Energiepreise an Wärmepumpe senden | JSON-Format `{"0":0.11,...}` |

---

### 🟡 CONDITIONS

| Flow ID | Titel | Beschreibung |
|---------|-------|--------------|
| `price_in_cheapest_hours` | Preis in günstigsten Stunden | Prüft ob aktuelle Stunde in günstigsten X Stunden |
| `price_vs_daily_average` | Preis vs Tagesdurchschnitt | Über/unter X% des Durchschnitts |
| `price_trend_is` | Preistrend ist | rising/falling/stable |

---

## 4️⃣ COP-Optimierer

### 🔵 TRIGGERS

| Flow ID | Titel | Beschreibung |
|---------|-------|--------------|
| `cop_efficiency_changed` | COP-Effizienz geändert | Aktueller COP geändert |
| `cop_outlier_detected` | COP-Ausreißer erkannt | Wert < 0.5 oder > 8.0 |
| `cop_trend_detected` | COP-Trend erkannt | Trendklassifikation |
| `daily_cop_efficiency_changed` | Täglicher COP geändert | 24-Stunden-Durchschnitt |
| `monthly_cop_efficiency_changed` | Monatlicher COP geändert | 30-Tage-Durchschnitt |

---

### 🟢 ACTIONS

| Flow ID | Titel | Beschreibung |
|---------|-------|--------------|
| `diagnose_cop_optimizer` | COP-Optimierer-Lernen diagnostizieren | Protokolliert Samples pro Temp-Bucket |

---

### 🟡 CONDITIONS

| Flow ID | Titel | Beschreibung |
|---------|-------|--------------|
| `cop_efficiency_check` | COP über/unter Schwelle | Schwellenprüfung |
| `cop_calculation_method_is` | COP-Methode ist | auto, direct_thermal, etc. |
| `cop_trend_analysis` | COP-Trend ist | Trendklassifikation |
| `daily_cop_above_threshold` | Täglicher COP über Schwelle | 24-Stunden-Prüfung |
| `monthly_cop_above_threshold` | Monatlicher COP über Schwelle | 30-Tage-Prüfung |

---

## 5️⃣ Gebäudeeinblicke

### 🔵 TRIGGERS

| Flow ID | Titel | Beschreibung |
|---------|-------|--------------|
| `building_insight_detected` ⭐ | Neue Gebäudeerkenntnis | Triggert bei ≥70% Vertrauen |

#### `building_insight_detected` - Tokens
| Token | Typ | Beschreibung |
|-------|-----|--------------|
| `category` | string | Kategorie (thermal_storage, etc.) |
| `insight` | string | Erkenntnisbeschreibung |
| `recommendation` | string | Empfehlung |
| `priority` | number | Priorität (0-100) |
| `confidence` | number | Vertrauen (%) |
| `estimated_savings_eur_month` | number | Geschätzte Einsparungen €/Monat |

---

### 🟢 ACTIONS

| Flow ID | Titel | Beschreibung |
|---------|-------|--------------|
| `force_insight_analysis` | Erkenntnisanalyse erzwingen | Sofort auswerten (Tokens: insights_detected, confidence) |
| `dismiss_insight` | Erkenntnis verwerfen | Kategorie für X Tage ausblenden |
| `reset_insight_history` | Erkenntnishistorie zurücksetzen | Alle verworfenen Erkenntnisse löschen |
| `set_confidence_threshold` | Vertrauensschwelle festlegen | Dynamisch anpassen (50-90%) |

---

### 🟡 CONDITIONS

| Flow ID | Titel | Beschreibung |
|---------|-------|--------------|
| `insight_is_active` | Erkenntnis ist aktiv | Prüft ob Kategorie aktiv ist |

---

## 📁 Quellcode-Speicherorte

### JSON-Definitionen
```
.homeycompose/flow/
├── triggers/   → Flow-Trigger-Definitionen
├── conditions/ → Flow-Condition-Definitionen
└── actions/    → Flow-Action-Definitionen
```

### Code-Implementierungsreferenz

> **Legende**: Trigger = wo Flow aufgerufen wird | RunListener = wo Filterung/Args verarbeitet werden

#### TRIGGERS

| Flow ID | Trigger-Speicherort | RunListener-Speicherort |
|---------|---------------------|-------------------------|
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

| Flow ID | Handler-Speicherort |
|---------|---------------------|
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

| Flow ID | Handler-Speicherort |
|---------|---------------------|
| `confidence_above` | `flow-card-manager-service.ts:814` |
| `insight_is_active` | `flow-card-manager-service.ts:798` |
| `price_in_cheapest_hours` | `flow-card-manager-service.ts:506` |
| `price_vs_daily_average` | `flow-card-manager-service.ts:629` |
| `price_trend_is` | `flow-card-manager-service.ts:563` |
| `savings_above` | `flow-card-manager-service.ts:830` |

---

*Siehe: [Configuration Guide](./advanced-settings/CONFIGURATION_GUIDE.de.md) für alle Einstellungen*
