# RLS Gebouwmodel — Databronnen & Telemetrie

Overzicht van alle invoer-capabilities en databronnen die de gebouw-leermodule (RLS-algoritme) gebruikt.

**Zie ook:** [RLS_RESEARCH_REPORT.md](RLS_RESEARCH_REPORT.md) voor het algoritme zelf en λ-trade-offs.

---

## Het RLS-invoermodel

Het Recursive Least Squares algoritme leert thermische gebouweigenschappen via:

```
y  = dT/dt                                              (°C/uur, te verklaren variabele)
X  = [pHeating, (tOutdoor − tIndoor), solar/1000, P_int_multiplier]
θ  = [1/C, UA/C, g/C, P_int/C]                         (te leren parameters)
```

**Geleerde parameters (elke ~50 minuten gepubliceerd):**

| Capability | Betekenis | Eenheid |
|---|---|---|
| `adlar_building_c` | Thermische massa C | kWh/°C |
| `adlar_building_ua` | Warmteverliescoëfficiënt UA | kW/°C |
| `adlar_building_tau` | Tijdconstante τ = C/UA | uren |
| `adlar_building_g` | Zonnewinstfactor g | — |
| `adlar_building_pint` | Interne warmtewinst | kW |
| `building_model_diagnostics` | RLS-state, P-matrix, confidence | JSON |

---

## Invoerbronnen per variabele

### 1. Binnentemperatuur — **verplicht**

Blokkeer-conditie: niet beschikbaar → leren stopt.

| Prioriteit | Capability | Bron |
|---|---|---|
| 1e | `measure_temperature.indoor` | Externe sensor via flow card |
| 2e | `adlar_external_indoor_temperature` | Legacy naamgeving (backwards compat) |

**Rol in algoritme:** Berekening van `dT/dt = (T_indoor_nu − T_indoor_vorig) / Δt` en de warmteverliesterm `(T_outdoor − T_indoor)`.

**Validatiebounds:** 5 °C – 30 °C

---

### 2. Buitentemperatuur — **verplicht (één van beide)**

Blokkeer-conditie: niet beschikbaar → leren stopt.

| Prioriteit | Capability | Bron |
|---|---|---|
| 1e | `adlar_external_ambient` | KNMI, weerstation via flow card |
| 2e | `measure_temperature.temp_ambient` | **Direct DPS van de warmtepomp** |

**Rol in algoritme:** Vormt de warmteverliesterm `X[1] = (T_outdoor − T_indoor)`. Hierdoor kan de RLS het UA-koefficënt leren: hoe groter het verschil, hoe meer warmte er verloren gaat.

**Validatiebounds:** −10 °C – +50 °C

> De interne pomp-sensor (`temp_ambient`, DPS) is de enige warmtepomp-temperatuur die de gebouwmodule direct gebruikt. Alle overige DPS-temperatuursensoren (aanvoer, retour, koelmiddel, compressor) worden niet door de gebouwmodule gebruikt — die dienen voor COP-berekening en telemetrie-scoring.

---

### 3. Thermisch vermogen — **verplicht (één van drie)**

Blokkeer-conditie: niet beschikbaar, of COP = 0 terwijl compressor actief → leren stopt.

| Prioriteit | Capability | Bron | Vertrouwen |
|---|---|---|---|
| 1e | `adlar_external_power` | Slimme meter, Shelly via flow card | High |
| 2e | `measure_power.internal` | Device DPS 104 (`cur_power`) | Medium |
| 3e | Schatting op basis van compressorfrequentie | Intern berekend | Low |

**Conversie elektrisch → thermisch:**

```
pHeating (kW) = (elektrischVermogen_W / 1000) × adlar_cop
```

**Rol in algoritme:** Directe invoer als `X[0] = pHeating`. Het RLS leert hoeveel van dit vermogen omgezet wordt in daadwerkelijke temperatuurstijging (1/C parameter).

**Validatiebounds:** 0 kW – 20 kW

---

### 4. Zonnestraling — **optioneel**

Niet verplicht, maar essentieel voor een nauwkeurige g-parameter (zonnewinstfactor). Zonder zonnedata wordt g gecombineerd met P_int.

| Prioriteit | Capability | Bron |
|---|---|---|
| 1e | `adlar_external_solar_power` | Omvormer-vermogen via flow card |
| 2e | `adlar_external_solar_radiation` | KNMI of weerstation via flow card |
| 3e | Open Meteo API | `shortwave_radiation` (HTTP fetch door WeatherForecastService) |
| 4e | Astronomische schatting | Latitude + jaardag + zonsdeclinatie (lokaal berekend) |

**Conversie panelen → straling:**

```
radiation (W/m²) = panelPower_W / (solar_panel_wp / 1000) / solar_panel_efficiency
```

**Instellingen nodig voor omvormer-conversie:**

| Setting | Standaard |
|---|---|
| `solar_panel_wp` | 0 (uitgeschakeld) |
| `solar_panel_efficiency` | 0.85 |

**TTL:** Data ouder dan **1 uur** wordt genegeerd en de volgende prioriteit wordt geprobeerd.

**Rol in algoritme:** `X[2] = solarRadiation / 1000` (kW/m²). Het RLS leert de factor g: hoeveel een W/m² zonnestraling bijdraagt aan de binnentemperatuur.

**Validatiebounds:** 0 W/m² – 1200 W/m²

---

### 5. Interne warmtewinst (P_int) — tijdsafhankelijke multiplier

Geen externe capability — intern berekend op basis van het tijdstip.

| Tijdvak | Multiplier | Reden |
|---|---|---|
| Nacht (23:00–06:00) | 0.40 | Weinig activiteit |
| Dag (06:00–18:00) | 1.00 | Normaal bewoning |
| Avond (18:00–23:00) | 1.80 | Koken, apparaten, mensen |

Vereist instelling `enable_dynamic_pint = true`.

---

## Datacyclus

```
Elke 5 minuten:
├─ Lees binnensensor (measure_temperature.indoor)
├─ Lees buitentemperatuur (adlar_external_ambient → temp_ambient)
├─ Lees elektrisch vermogen (adlar_external_power → DPS 104 → schatting)
├─ Bereken thermisch vermogen = elektrisch / adlar_cop
├─ Haal zonnestraling op (4-staps prioriteitscascade, TTL 1h)
├─ Bereken dT/dt = (T_indoor_nu − T_indoor_vorig) / Δt
├─ Valideer alle waarden binnen bounds
├─ Stel X-vector samen en voer RLS-update uit
└─ Elke 10 samples (~50 min): update capabilities + persist state
```

---

## Blokkeercondities — leren stopt als...

1. `building_model_enabled = false` (ingesteld door gebruiker)
2. Geen binnentemperatuur beschikbaar
3. Geen buitentemperatuur beschikbaar
4. Geen vermogensmeting beschikbaar
5. COP = 0 terwijl compressor actief is (inconsistente sensordata)

---

## Configuratie-instellingen

| Setting | Type | Rol | Standaard |
|---|---|---|---|
| `building_model_enabled` | boolean | Aan/uitzetten leren | `true` |
| `building_profile` | enum | Initiële prior-parameters | `'average'` |
| `building_model_forgetting_factor` | number | RLS λ (leersnelheid) | `0.999` |
| `enable_dynamic_pint` | boolean | Tijdvak P_int multiplier | `true` |
| `forecast_location_lat` | number | Breedtegraad voor astronomie | `52.37` |
| `solar_panel_wp` | number | Piekstroom zonnepanelen (W) | `0` |
| `solar_panel_efficiency` | number | Paneel-efficiëntie | `0.85` |

---

## Betrokken bronbestanden

| Bestand | Rol |
|---|---|
| `lib/adaptive/building-model-learner.ts` | Core RLS-algoritme |
| `lib/services/building-model-service.ts` | Datacollectie & lifecycle |
| `lib/services/external-temperature-service.ts` | Beheer binnentemperatuur |
| `lib/services/energy-tracking-service.ts` | Vermogensmeting |
| `drivers/intelligent-heat-pump/device.ts` | Fallback buitentemperatuur |
