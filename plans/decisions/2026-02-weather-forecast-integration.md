# Feature: Weerprognose Integratie (KNMI/Solcast)

**Status**: 🟡 Planning  
**Aangemaakt**: 2026-02-09  
**Laatste update**: 2026-02-09  
**Auteur**: Gemini 

---

## Samenvatting

Integreer weerprognoses (KNMI en/of Solcast) in de adaptieve regeling voor voorspellende optimalisatie van pre-heating, COP-optimalisatie en thermal load shifting.

## Probleem / Aanleiding

De huidige adaptieve regeling werkt **reactief**:
- Zondata wordt real-time ontvangen maar niet voorspeld
- Buitentemperatuur wordt gemeten, niet voorspeld
- Pre-heating berekening kent geen toekomstige zonne-bijdrage
- COP-optimalisatie kan niet anticiperen op temperatuurstijging

Met weerprognoses wordt de regeling **predictief**, wat leidt tot:
- Slimmere pre-heating timing (minder energie door zonne-anticipatie)
- Betere COP door timing af te stemmen op warmere periodes
- Effectievere thermal load shifting

---

## Voorgestelde Oplossing

### Aanpak: Flow Card Integratie

Consistent met de huidige architectuur ontvangen we prognose-data via flow cards. Gebruikers koppelen externe Homey apps (KNMI app, Solcast community app) aan deze flow cards.

### Prioriteit 1: Temperatuur & Zonnestraling Prognose

| Data | Bron | Gebruik |
|------|------|---------|
| Buitentemperatuur (6-24u) | KNMI | COP-optimalisatie, pre-heating |
| Globale straling (6-24u) | KNMI/Solcast | Solar gain voorspelling |

### Prioriteit 2: Verfijning

| Data | Bron | Gebruik |
|------|------|---------|
| PV Power Forecast | Solcast | Thermal storage planning |
| Windsnelheid prognose | KNMI | Windchill correctie |

---

## Relevante Datasets

### KNMI Parameters (gratis, betrouwbaar)

| Parameter | Code | Meerwaarde voor Adlar |
|-----------|------|------------------------|
| **Buitentemperatuur prognose** | T | COP-optimalisatie: timing afstemmen op hogere temp |
| **Globale straling prognose** | Q | Solar gain voorspelling voor pre-heating |
| **Windsnelheid** | FF | Windchill correctie (bestaande `WindCorrectionService`) |
| **Neerslagkans** | R | Bewolkingsindicator voor solar gain |

### Solcast Parameters (specifiekere PV prognose)

| Parameter | Meerwaarde voor Adlar |
|-----------|------------------------|
| **PV Power Forecast** | Directe voorspelling van zonne-opbrengst (Wp → W verwacht) |
| **GHI (Global Horizontal Irradiance)** | Nauwkeuriger zonnestraling voor building model g-factor |
| **DNI (Direct Normal Irradiance)** | Betere schatting directe zonnestraling |
| **Cloud Opacity** | Betere inschatting van solar gain fluctuaties |

---

## Meerwaarde per Component

| Component | Huidige Data | Met Prognose | Meerwaarde |
|-----------|--------------|--------------|------------|
| **Pre-heating berekening** | Alleen huidige τ | +verwachte zonopkomst en -intensiteit | Nauwkeuriger starttijd (minder energie nodig als zon gaat bijdragen) |
| **Thermal Storage** | Actuele prijzen | +verwachte zonne-opbrengst | Slim pre-koelen/pre-verwarmen vóór zonpiek |
| **COP Optimizer** | Huidige buitentemp | +verwachte temp komende uren | Beter timing van verwarming bij hoge COP |
| **Energy Price Optimizer** | Prijzen komende uren | +verwachte PV-opbrengst | Slim schuiven van warmtevraag naar goedkope/groene momenten |

---

## Technisch Ontwerp

### Architectuur

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AdaptiveControlService                            │
│  executeControlCycle() - elke 5 minuten                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐   ┌─────────────┐   ┌──────────────────────────┐   │
│  │ PI-regeling │ + │ Building    │ + │ WeatherForecastService   │   │
│  │ (comfort)   │   │ Model       │   │ (NIEUW)                  │   │
│  └──────┬──────┘   │ (τ, UA, g)  │   │ • Temp forecast buffer   │   │
│         │          └──────┬──────┘   │ • Solar forecast buffer  │   │
│         │                 │          │ • Wind forecast buffer   │   │
│         ▼                 ▼          └──────────┬───────────────┘   │
│  ┌──────────────────────────────────────────────┼───────────────────┤
│  │         WeightedDecisionMaker                │                   │
│  │   comfort + efficiency + cost + thermal + FORECAST               │
│  └──────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌──────────────┐     Flow Card      ┌─────────────────────────┐
│ KNMI App     │ ─────────────────► │ receive_weather_forecast│
│ Solcast App  │                    │ (JSON met 24u data)     │
└──────────────┘                    └────────────┬────────────┘
                                                 │
                                    ┌────────────▼────────────┐
                                    │ WeatherForecastService  │
                                    │ • parseForecast()       │
                                    │ • getTempAt(hours)      │
                                    │ • getSolarAt(hours)     │
                                    │ • getWindAt(hours)      │
                                    └────────────┬────────────┘
                                                 │
                    ┌────────────────────────────┼────────────────────────┐
                    │                            │                        │
          ┌─────────▼─────────┐     ┌────────────▼────────┐    ┌─────────▼─────────┐
          │ BuildingInsights  │     │ COP Optimizer       │    │ EnergyOptimizer   │
          │ calculatePreheat  │     │ optimizeForTemp     │    │ thermalShift      │
          │ + solar anticipate│     │ + forecast temp     │    │ + solar forecast  │
          └───────────────────┘     └─────────────────────┘    └───────────────────┘
```

### Betrokken Bestanden

**Nieuw:**

| Bestand | Beschrijving |
|---------|--------------|
| `lib/services/weather-forecast-service.ts` | Nieuwe service voor prognose-opslag en -queries |
| `.homeycompose/flow/actions/receive_weather_forecast.json` | Flow card voor JSON prognose-ontvangst |

**Wijzigingen:**

| Bestand | Wijziging |
|---------|-----------|
| `lib/services/adaptive-control-service.ts` | Integratie WeatherForecastService |
| `lib/services/building-insights-service.ts` | Pre-heat met solar anticipatie |
| `lib/adaptive/cop-optimizer.ts` | Temp forecast voor COP timing |
| `lib/adaptive/energy-price-optimizer.ts` | Solar forecast voor load shifting |
| `lib/services/service-coordinator.ts` | Registratie nieuwe service |
| `lib/services/flow-card-manager-service.ts` | Handler voor nieuwe flow card |
| `.homeycompose/driver.settings.compose.json` | Nieuwe settings voor forecast |
| `drivers/intelligent-heat-pump/driver.flow.compose.json` | Flow card definitie |

### Data Model

**WeatherForecast Interface:**

```typescript
interface HourlyForecast {
  hour: number;           // 0-23 (relatief vanaf nu)
  timestamp: number;      // Unix timestamp
  temperature?: number;   // Buitentemp °C
  solarRadiation?: number; // W/m²
  solarPower?: number;    // PV forecast W
  windSpeed?: number;     // m/s
  cloudCover?: number;    // 0-100%
}

interface WeatherForecast {
  source: 'knmi' | 'solcast' | 'other';
  receivedAt: number;
  validUntil: number;
  hourly: HourlyForecast[];
}
```

**Nieuwe settings:**

```json
{
  "id": "enable_weather_forecast",
  "type": "checkbox",
  "label": { "nl": "Gebruik weerprognose", "en": "Use weather forecast" },
  "value": false
},
{
  "id": "forecast_temp_weight",
  "type": "number",
  "label": { "nl": "Temperatuur prognose gewicht (%)", "en": "Temperature forecast weight (%)" },
  "value": 15,
  "min": 0,
  "max": 30
},
{
  "id": "forecast_solar_anticipation_hours",
  "type": "number",
  "label": { "nl": "Zon anticipatie (uren vooruit)", "en": "Solar anticipation (hours ahead)" },
  "value": 2,
  "min": 1,
  "max": 6
}
```

**Flow Card JSON:**

```json
{
  "id": "receive_weather_forecast",
  "title": { "nl": "Ontvang weerprognose", "en": "Receive weather forecast" },
  "titleFormatted": { 
    "nl": "Ontvang weerprognose van [[source]]",
    "en": "Receive weather forecast from [[source]]"
  },
  "args": [
    {
      "name": "source",
      "type": "dropdown",
      "values": [
        { "id": "knmi", "label": { "nl": "KNMI", "en": "KNMI" } },
        { "id": "solcast", "label": { "nl": "Solcast", "en": "Solcast" } },
        { "id": "other", "label": { "nl": "Overig", "en": "Other" } }
      ]
    },
    {
      "name": "forecast_json",
      "type": "text",
      "title": { "nl": "Prognose JSON", "en": "Forecast JSON" }
    }
  ]
}
```

---

## Implementatie Taken

### Fase 1: Core Service (MVP)

- [ ] `WeatherForecastService` - basisstructuur met forecast opslag
- [ ] Flow card `receive_weather_forecast` - JSON ontvangst
- [ ] Parsing en validatie van forecast data
- [ ] Capability `adlar_forecast_status` voor weergave in UI
- [ ] Settings voor enable/disable en gewichten

### Fase 2: Pre-heating Integratie

- [ ] `BuildingInsightsService.calculatePreHeatTime()` uitbreiden met solar anticipatie
- [ ] Reductie opwarmtijd berekenen op basis van verwachte zonnestraling
- [ ] Trigger flow card met aangepaste starttijd

### Fase 3: COP Optimalisatie

- [ ] `COPOptimizer` uitbreiden met temperatuur prognose
- [ ] Timing suggesties voor verwarming bij hogere buitentemperatuur
- [ ] Integratie in weighted decision maker

### Fase 4: Thermal Load Shifting

- [ ] `EnergyPriceOptimizer` uitbreiden met solar forecast
- [ ] Pre-heat boost wanneer zon verwacht wordt
- [ ] Combinatie met dynamische prijzen

---

## Meerwaarde Analyse

| Use Case | Zonder Prognose | Met Prognose | Besparing |
|----------|-----------------|--------------|-----------|
| Pre-heating (winter ochtend) | Start 06:00 | Start 06:30 (zon helpt) | 15-20% energie |
| COP-optimalisatie | Reactief op huidige temp | Uitstellen tot middag (hogere COP) | 20-25% efficiënter |
| Thermal storage | Alleen op prijzen | Prijzen + zonvoorspelling | Tot 30% bij hoge massa |
| Windchill correctie | Huidige wind | Voorspelde windpieken | Betere voorbereiding |

---

## Risico's en Aandachtspunten

| Risico | Impact | Mitigatie |
|--------|--------|-----------|
| Onnauwkeurige prognose | Verkeerde timing | Conservatieve gewichten (max 30%) |
| Verouderde forecast data | Suboptimale beslissingen | `validUntil` check, max 6 uur oud |
| Complexe gebruikerskoppeling | Adoptiedrempel | Duidelijke documentatie + voorbeeldflows |
| Extra geheugengebruik | Performance | Max 48 uur opslaan, oude data verwijderen |
| Breaking change | Ander gedrag | Standaard uitgeschakeld, opt-in |

---

## Acceptatiecriteria

- [ ] `WeatherForecastService` ontvangt en parset KNMI/Solcast JSON
- [ ] Flow card `receive_weather_forecast` werkt met dropdown source selectie
- [ ] Forecast data ouder dan 6 uur wordt genegeerd
- [ ] Pre-heat berekening reduceert opwarmtijd bij verwachte zon
- [ ] COP optimizer stelt verwarming uit bij verwachte temp stijging
- [ ] Settings zichtbaar en functioneel
- [ ] Fallback naar bestaand gedrag als geen forecast beschikbaar
- [ ] Documentatie bijgewerkt (ADVANCED_FLOWCARDS_GUIDE)

---

## Verificatie Plan

### Unit Tests

De app heeft geen bestaande unit test framework. Nieuwe tests zouden via Jest of Mocha opgezet kunnen worden, maar dit valt buiten de scope van dit plan.

### Handmatige Verificatie

1. **Forecast ontvangst testen:**
   - Maak een Homey flow met "receive_weather_forecast" action
   - Stuur test JSON met temperatuur en solar data
   - Controleer in logs dat data correct geparsed wordt

2. **Pre-heat integratie testen:**
   - Stel building model confidence ≥50% in (of mock)
   - Stuur forecast met hoge zonnestraling (500 W/m²) om 08:00
   - Controleer dat `calculate_preheat_time` kortere tijd teruggeeft

3. **Visuele verificatie:**
   - Controleer capability `adlar_forecast_status` in Homey UI
   - Moet tonen: bron, laatste update, aantal uren beschikbaar

---

## Notities

- KNMI biedt gratis 10-daagse prognose via open API
- Solcast biedt gratis tier voor hobbyisten (10 API calls/dag)
- Bestaande Homey community apps: "KNMI Weer", "Solcast Solar"
- JSON format moet flexibel zijn voor verschillende bronnen
- Prioriteit voor temperatuur en zonnestraling, wind is nice-to-have

---

## Changelog

| Datum | Wijziging |
|-------|-----------|
| 2026-02-09 | Plan aangemaakt |
