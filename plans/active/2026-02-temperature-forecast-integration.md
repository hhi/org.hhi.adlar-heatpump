# Feature: Temperatuurprognose Integratie

**Status**: 🔵 In Progress  
**Versie**: v5 (finaal)  
**Datum**: 2026-02-09  
**App versie**: 2.8.0

---

## Doel

Integreer Open-Meteo temperatuurprognose in de adaptieve regeling voor COP-timing optimalisatie, met flow-assisted gebruikersparticipatie.

---

## Scope

| Onderdeel | In scope | Reden |
|-----------|----------|-------|
| Open-Meteo temp prognose | ✅ | Gratis, 48u horizon, meeste impact |
| COP timing advies | ✅ | 20-35% efficiëntieverbetering |
| Trigger flow card | ✅ | Flow-assisted architectuur |
| Solcast | ❌ | Te complex, weinig meerwaarde v1 |
| 5e weight | ❌ | Past in bestaande efficiency |

---

## Open-Meteo Parameters

| Parameter | API veld | Gebruik |
|-----------|----------|---------|
| Temperatuur | `temperature_2m` | COP timing |
| Bewolking | `cloud_cover` | Optioneel: weersomslag detectie |

**Horizon**: 48 uur  
**Update**: Elk 2 uur  
**API key**: Niet nodig

---

## Nieuwe Capabilities

```json
{
  "id": "adlar_forecast_advice",
  "type": "string",
  "title": { "nl": "Forecast advies" },
  "getable": true,
  "setable": false
}
```

```json
{
  "id": "adlar_optimal_delay",
  "type": "number",
  "title": { "nl": "Optimale wachttijd (uren)" },
  "units": "u",
  "getable": true,
  "setable": false
}
```

---

## Nieuwe Flow Card (Trigger)

```json
{
  "id": "forecast_heating_advice",
  "title": { "nl": "Forecast verwarmingsadvies beschikbaar" },
  "tokens": [
    { "name": "delay_hours", "type": "number", "title": "Wacht uren" },
    { "name": "expected_cop", "type": "number", "title": "Verwachte COP" },
    { "name": "current_cop", "type": "number", "title": "Huidige COP" },
    { "name": "advice_text", "type": "string", "title": "Advies" }
  ]
}
```

---

## Integratie in Bestaande Weights

| Weight | Wijziging |
|--------|-----------|
| **efficiency** | COPOptimizer krijgt temp forecast, geeft timing advies |
| comfort | Ongewijzigd |
| cost | Ongewijzigd |
| thermal | Ongewijzigd |

**WeightedDecisionMaker**: Geen wijzigingen

---

## Wijzigingen per Bestand

| Bestand | Wijziging |
|---------|-----------|
| `weather-forecast-service.ts` | [NEW] Open-Meteo client, cache, parsing |
| `cop-optimizer.ts` | + temp forecast parameter, timing advies |
| `adlar_forecast_advice` capability | [NEW] |
| `adlar_optimal_delay` capability | [NEW] |
| `forecast_heating_advice` trigger | [NEW] |
| `driver.settings.compose.json` | + enable_forecast, locatie settings |
| `service-coordinator.ts` | Registratie WeatherForecastService |

---

## Settings

```json
{
  "id": "enable_weather_forecast",
  "type": "checkbox",
  "label": { "nl": "Temperatuurprognose inschakelen" },
  "value": false
},
{
  "id": "forecast_location_lat",
  "type": "number",
  "label": { "nl": "Locatie breedtegraad" },
  "value": 52.0
},
{
  "id": "forecast_location_lon",
  "type": "number",
  "label": { "nl": "Locatie lengtegraad" },
  "value": 5.0
}
```

---

## Resilience

| Scenario | Actie |
|----------|-------|
| API fout | Cache gebruiken (max 6u) |
| Geen cache | Geen advies, alles werkt normaal |
| Invalid data | Negeren, log warning |

---

## Changelog

| Datum | Wijziging |
|-------|-----------|
| 2026-02-09 | Plan aangemaakt en goedgekeurd voor 2.8.0 |
