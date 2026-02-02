# Feature: Building Model Integratie in Adaptieve Regeling

**Status**: 🟡 Planning  
**Aangemaakt**: 2026-01-20  
**Laatste update**: 2026-01-20  
**Auteur**: Gemini (met Herman)

---

## Samenvatting

Activeer de geleerde building model parameters (τ, C, UA, g, pInt) in de control loop voor voorspellende temperatuurregeling, overshoot preventie en thermal load shifting.

## Probleem / Aanleiding

Het building model leert thermische eigenschappen maar gebruikt deze alleen voor:
- Insights genereren
- Logging en tokens

De `simulated_target` wordt nu alleen berekend op basis van huidige meetfout (reactief), niet op basis van thermisch gedrag (voorspellend).

## Voorgestelde Oplossing

1. **Predictieve regeling**: τ gebruiken om opwarmtijd te berekenen
2. **Overshoot preventie**: PI-controller eerder stoppen gebaseerd op τ
3. **Thermal load shifting**: C gebruiken voor pre-heat potentieel
4. **Building als 4e component**: Nieuwe "thermal" weging in weighted decision

---

## Technisch Ontwerp

### Architectuur

```
┌─────────────────────────────────────────────────────────────────┐
│                    AdaptiveControlService                        │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐│
│  │ Heating     │  │ COP         │  │ Energy      │  │ Building││
│  │ Controller  │  │ Optimizer   │  │ Optimizer   │  │ Model   ││
│  │ (comfort)   │  │ (efficiency)│  │ (cost)      │  │(thermal)││
│  │    50%      │  │    20%      │  │    10%      │  │  20%    ││
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────┬────┘│
│         │                │                │               │     │
│         └────────────────┴────────────────┴───────────────┘     │
│                                 │                               │
│                    WeightedDecisionMaker                        │
│                                 │                               │
│                      simulated_target                           │
└─────────────────────────────────────────────────────────────────┘
```

### Betrokken Bestanden

**Wijzigingen:**

- `lib/adaptive/heating-controller.ts` - Dynamic deadband + overshoot margin
- `lib/adaptive/energy-price-optimizer.ts` - Thermal capacity boost
- `lib/services/building-model-service.ts` - `calculateThermalAdjustment()`
- `lib/adaptive/weighted-decision-maker.ts` - 4-component weging
- `lib/services/adaptive-control-service.ts` - Orchestratie
- `.homeycompose/driver.settings.compose.json` - `priority_thermal`

**Nieuw:**

- `.homeycompose/flow/actions/calculate_preheat_time.json`

### Data Model

**Nieuwe setting:**
```json
{
  "id": "priority_thermal",
  "type": "number",
  "label": { "nl": "Thermische voorspelling prioriteit (%)" },
  "value": 20,
  "min": 0,
  "max": 50
}
```

---

## Implementatie Taken

- [ ] `HeatingController` - dynamic deadband + overshoot margin
- [ ] `EnergyPriceOptimizer` - thermal capacity boost
- [ ] `BuildingModelService` - nieuwe `calculateThermalAdjustment()` methode
- [ ] `WeightedDecisionMaker` - 4-component weging + confidence gate (≥50%)
- [ ] Settings - nieuwe `priority_thermal` instelling
- [ ] `AdaptiveControlService` - orchestratie van alle parameters
- [ ] Flow card: `calculate_preheat_time`
- [ ] Tests schrijven
- [ ] Documentatie updaten

---

## Risico's en Aandachtspunten

| Risico | Impact | Mitigatie |
|--------|--------|-----------|
| Onnauwkeurig building model | Verkeerde predictie | Confidence gate (≥50%) |
| Te agressieve overshoot preventie | Comfort verlies | Conservatieve margin (20%) |
| Overmatig load shifting | Pieken | Max 2°C pre-heat cap |
| Breaking change voor bestaande users | Ander gedrag | Fallback naar reactief bij <50% |

---

## Acceptatiecriteria

- [ ] Building model parameters actief in control loop bij ≥50% confidence
- [ ] Fallback naar reactief gedrag bij <50% confidence
- [ ] Flow card `calculate_preheat_time` werkt
- [ ] Nieuwe setting `priority_thermal` zichtbaar en functioneel
- [ ] Geen regressies in bestaande functionaliteit
- [ ] Documentatie bijgewerkt (ADVANCED_FLOWCARDS_GUIDE)

---

## Notities

- 63% komt van e^(-1) = 0.368, dus 1 - 0.368 = 0.632
- g = solar gain factor (kW per W/m² zonnestraling)
- pInt = internal gains (warmte van bewoners/apparaten)
- Naamgeving: "thermal" i.p.v. "building" voor consistentie

---

## Changelog

| Datum | Wijziging |
|-------|-----------|
| 2026-01-20 | Plan aangemaakt |
| 2026-01-20 | v2: Verduidelijkingen toegevoegd (63%, terminologie) |
| 2026-01-20 | v3: g/pInt rol, flow card beschrijving, priority_thermal setting |
