# 🔧 Flow Cards Dokumentation: Erweiterte Funktionen

> **Version**: 2.7.x  
> **Zweck**: Flow Cards für adaptive Regelung, Gebäudemodell, Energieoptimierer, COP-Optimierer, Gebäudeeinblicke und Wind-/Sonnenstrahlungsdaten

---

## 📊 Übersicht pro Modul

| Modul | Triggers | Conditions | Actions | Gesamt |
|-------|----------|------------|---------|--------|
| Adaptive Regelung | 3 | 2 | 2 | **7** |
| Gebäudemodell | 1 | 1 | 0 | **2** |
| Energie/Preis-Optimierer | 2 | 3 | 1 | **6** |
| COP-Optimierer | 5 | 5 | 0 | **10** |
| Gebäudeeinblicke | 2 | 1 | 2 | **5** |
| Wind & Sonnenstrahlung (v2.7.0) | 0 | 0 | 3 | **3** |

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
| `thermal_component` | number | Beitrag thermisches Modell (°C) |
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

> **Hinweis**: Gebäudemodell-Diagnostik wird automatisch auf die `building_model_diagnostics` Fähigkeit aktualisiert.

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

> **Hinweis**: COP-Optimierer-Diagnostik wird automatisch auf die `cop_optimizer_diagnostics` Fähigkeit aktualisiert.

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
| `pre_heat_recommendation` ⭐ | Vorheiz-Empfehlung | Triggert wenn ΔT > 1.5°C (v2.6.0) |

#### `building_insight_detected` - Tokens
| Token | Typ | Beschreibung |
|-------|-----|--------------|
| `category` | string | Kategorie (thermal_storage, etc.) |
| `insight` | string | Erkenntnisbeschreibung |
| `recommendation` | string | Empfehlung |
| `priority` | number | Priorität (0-100) |
| `confidence` | number | Vertrauen (%) |
| `estimated_savings_eur_month` | number | Nicht mehr berechnet (immer 0, seit 3.4.2) |

#### `pre_heat_recommendation` - Tokens (v2.6.0)
| Token | Typ | Beschreibung |
|-------|-----|--------------|
| `duration_hours` | number | Vorheiz-Dauer in Stunden |
| `temp_rise` | number | Benötigte Temperaturerhöhung (°C) |
| `current_temp` | number | Aktuelle Innentemperatur (°C) |
| `target_temp` | number | Zieltemperatur (°C) |
| `confidence` | number | Modellvertrauen (%) |

**Trigger-Bedingungen:**
- ΔT (Ziel - innen) > 1.5°C
- Modellvertrauen ≥ 70%
- Max 1x pro 4 Stunden (Ermüdungsverhinderung)

---

### 🟢 ACTIONS

| Flow ID | Titel | Beschreibung |
|---------|-------|--------------|
| `force_insight_analysis` | Erkenntnisanalyse erzwingen | Sofort auswerten (Tokens: insights_detected, confidence) |
| `calculate_preheat_time` ⭐ | Vorheiz-Dauer berechnen | Berechnet Zeit für ±X°C Erwärmung (v2.6.0) |

#### `calculate_preheat_time` - Parameter & Rückgabe
| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `temperature_rise` | number | Gewünschte Temperaturerhöhung in °C (z.B. 2.0) |

| Rückgabe-Token | Typ | Beschreibung |
|----------------|-----|--------------|
| `preheat_hours` | number | Vorheiz-Dauer in Stunden |
| `confidence` | number | Modellvertrauen (%) |
| `building_tau` | number | Thermische Zeitkonstante τ (Stunden) |

**Beispiel-Flow:**
```
WHEN Günstigster Preisblock nähert sich (2 Stunden vorher)
THEN
  1. Vorheiz-Dauer berechnen (temperature_rise = 2.0)
  2. IF preheat_hours < 3 THEN
       → Jetzt vorheizen starten
  3. Benachrichtigung: "Vorheizen dauert {{preheat_hours}}h"
```

---

### 🟡 CONDITIONS

| Flow ID | Titel | Beschreibung |
|---------|-------|--------------|
| `insight_is_active` | Erkenntnis ist aktiv | Prüft ob Kategorie aktiv ist |

---

## 6️⃣ Wind- & Sonnenstrahlungsdaten (v2.7.0)

> **Neu in v2.7.0**: Externe Wind- und Solarstrahlungsdaten für ein genaueres Gebäudemodell und Windkorrektur.

### 🟢 ACTIONS

| Flow ID | Titel | Beschreibung |
|---------|-------|--------------|
| `receive_external_wind_data` ⭐ | Windgeschwindigkeit an Wärmepumpe senden | Winddaten für Wärmeverlustkorrektur |
| `receive_external_solar_power` ⭐ | Solarleistung an Wärmepumpe senden | Solar-Panel-Ausgang (W) |
| `receive_external_solar_radiation` | Solarstrahlung an Wärmepumpe senden | Direkte Strahlung (W/m²) |

#### `receive_external_wind_data` - Parameter
| Parameter | Typ | Bereich | Beschreibung |
|-----------|-----|--------|--------------|
| `wind_speed` | number | 0-200 km/h | Windgeschwindigkeit in Kilometern pro Stunde |

**Windkorrektur-Formel:**
```
correction = α × windSpeed × ΔT / 100
```
* `α` = Windempfindlichkeitskoeffizient (gelernt oder manuell)
* `ΔT` = (T_indoor - T_outdoor)

**Wind-α-Referenztabelle (v2.7.0):**
| α value | Bedeutung | Typisches Gebäude |
|---------|-----------|------------------|
| 0.03-0.05 | Geringe Windempfindlichkeit | Geschützte Lage |
| 0.05-0.08 | Durchschnittlich | Standardhaus |
| 0.08-0.12 | Windempfindlich | Freistehend, exponiert |

**Beispiel-Flow:**
```
WHEN Windgeschwindigkeit geändert (weather app)
THEN Windgeschwindigkeit an Wärmepumpe senden ({{wind_speed}})
```

---

#### `receive_external_solar_power` - Parameter
| Parameter | Typ | Bereich | Beschreibung |
|-----------|-----|--------|--------------|
| `power_value` | number | 0-50000 W | Aktuelle Solar-Panel-Leistung in Watt |

**Umrechnung in Strahlung:**
```
radiation = P_panel / Wp × 1000 W/m²
```
* `Wp` = Peak-Solarleistung (Einstellung: solar_panel_wp)

**Beispiel-Flow:**
```
WHEN Solar-Panel-Leistung geändert (SolarEdge/Enphase app)
THEN Solarleistung an Wärmepumpe senden ({{current_power}})
```

> [!TIP]
> Konfiguriere `solar_panel_wp` in den Geräteeinstellungen für eine genaue Umrechnung.

---

#### `receive_external_solar_radiation` - Parameter
| Parameter | Typ | Bereich | Beschreibung |
|-----------|-----|--------|--------------|
| `radiation_value` | number | 0-1500 W/m² | Direkte Solarstrahlung in W/m² |

**Beispiel-Flow:**
```
WHEN Solarstrahlung geändert (weather station/KNMI app)
THEN Solarstrahlung an Wärmepumpe senden ({{radiation}})
```

**Prioritätskaskade:** Wenn sowohl Solarleistung als auch Strahlung empfangen werden, hat Solarleistung Priorität (genauer).

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
| `force_insight_analysis` | `flow-card-manager-service.ts:745` |
| `receive_external_wind_data` | `flow-card-manager-service.ts:984` |
| `receive_external_solar_power` | `flow-card-manager-service.ts:996` |
| `receive_external_solar_radiation` | `flow-card-manager-service.ts:1008` |

#### CONDITIONS

| Flow ID | Handler-Speicherort |
|---------|---------------------|
| `confidence_above` | `flow-card-manager-service.ts:814` |
| `insight_is_active` | `flow-card-manager-service.ts:798` |
| `price_in_cheapest_hours` | `flow-card-manager-service.ts:506` |
| `price_vs_daily_average` | `flow-card-manager-service.ts:629` |
| `price_trend_is` | `flow-card-manager-service.ts:563` |
| `savings_above` (veraltet seit 3.4.2) | `flow-card-manager-service.ts` |

---

*Siehe: [Configuration Guide](../advanced-settings/CONFIGURATION_GUIDE.de.md) für alle Einstellungen*
