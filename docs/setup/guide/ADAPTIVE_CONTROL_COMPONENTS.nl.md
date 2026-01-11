# Adlar Warmtepomp — Adaptieve Regeling Systeem

**Versie:** 2.4.0 | **Datum:** Januari 2026

---

## Overzicht

Dit systeem regelt je Adlar Castra warmtepomp intelligent voor:

- **Constante binnentemperatuur** (±0.3°C)
- **Energie optimalisatie** via dynamische prijzen
- **COP maximalisatie** voor maximale efficiëntie
- **Automatisch leren** hoe jouw woning reageert

### Geschatte Besparingen

| Onderdeel | Besparing/jaar |
|-----------|---------------|
| Energie Prijs Optimalisatie | €400-600 |
| COP Optimalisatie | €200-300 |
| **Totaal** | **€600-900** |

---

## Architectuur

```
┌─────────────────────────────────────────────────────────────────────┐
│                           HOMEY PRO                                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │          Adlar Heat Pump Device - Main Controller             │  │
│  └─────────────────────────────┬─────────────────────────────────┘  │
│                                │                                    │
│        ┌───────────┬───────────┼───────────┬───────────┐            │
│        │           │           │           │           │            │
│        ▼           ▼           ▼           ▼           │            │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐            │
│  │  Heating  │ │ Building  │ │  Energy   │ │    COP    │            │
│  │  Control  │ │  Learner  │ │ Optimizer │ │Controller │            │
│  │    60%    │ │   Info    │ │    15%    │ │    25%    │            │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘            │
│        │             │             │             │                  │
└────────┼─────────────┼─────────────┼─────────────┼──────────────────┘
         │             │             │             │
         ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          WARMTEPOMP                                 │
│  ┌───────────────────┐  ┌───────────────────────────────────────┐   │
│  │ DPS 4:            │  │ DPS 21/22: Aanvoer/Retour             │   │
│  │ Steltemperatuur   │  │ DPS 26: Buitentemp                    │   │
│  └───────────────────┘  └───────────────────────────────────────┘   │
│  ┌───────────────────┐                                              │
│  │ DPS 13:           │                                              │
│  │ Stooklijn = OFF   │                                              │
│  └───────────────────┘                                              │
└─────────────────────────────────────────────────────────────────────┘
         ▲
         │
┌─────────────────────────────────────────────────────────────────────┐
│                         EXTERNE DATA                                │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │
│  │Binnentemperatuur│  │ Energieprijzen│  │   Weer API   │            │
│  └───────────────┘  └───────────────┘  └───────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

### Control Loop (elke 5 min)

1. **Data verzamelen** — Binnen/buiten temp, vermogen, prijzen
2. **Controllers berekenen** — Elk component geeft advies
3. **Gewogen beslissing** — 60% comfort + 25% COP + 15% prijs
4. **Uitvoeren** — Update steltemperatuur (DPS 4)

---

## Component 1: Heating Controller

### PI Regelaar

De **PI (Proportional-Integral) controller** combineert:

| Component | Functie | Formule |
|-----------|---------|---------|
| **P** (Proportioneel) | Huidige afwijking corrigeren | `Kp × error` |
| **I** (Integraal) | Structurele afwijking wegwerken | `Ki × gemiddelde_error` |

**Totale correctie:** `(Kp × huidige_fout) + (Ki × gemiddelde_fout)`

### Parameters

| Parameter | Default | Bereik | Effect |
|-----------|---------|--------|--------|
| Kp | 3.0 | 1.0-5.0 | Snelheid reactie |
| Ki | 1.5 | 0.5-3.0 | Lange-termijn correctie |
| Deadband | 0.3°C | 0.1-1.0°C | Tolerantie zone |
| Min Wait | 20 min | 10-60 min | Anti-oscillatie |

### Tuning Profielen

| Profiel | Kp | Ki | Deadband | Use Case |
|---------|----|----|----------|----------|
| Agressief | 4.0-5.0 | 2.0-3.0 | 0.2°C | Slecht geïsoleerd |
| **Gebalanceerd** | 3.0 | 1.5 | 0.3°C | **Aanbevolen** |
| Conservatief | 2.0 | 1.0 | 0.5°C | Goede isolatie |

---

## Component 2: Building Model Learner

### Geleerde Parameters

| Parameter | Symbool | Eenheid | Typische waarde |
|-----------|---------|---------|-----------------|
| Thermische massa | C | kWh/°C | 10-25 |
| Warmteverlies | UA | kW/°C | 0.1-0.4 |
| Zonnewinst factor | g | - | 0.3-0.6 |
| Interne warmte | P_int | kW | 0.2-0.5 |
| Tijdsconstante | τ | uur | 4-16 |

### Machine Learning: RLS

Het systeem gebruikt **Recursive Least Squares** (RLS):

- ✅ Leert real-time tijdens gebruik
- ✅ Past zich aan bij seizoenen
- ✅ Computationeel licht (past op Homey)
- ✅ Geeft betrouwbaarheid indicator

**Leerprogressie:**

| Periode | Confidence | Voorspelling |
|---------|------------|--------------|
| Dag 1 | 25% | ±2°C |
| Dag 3 | 45% | ±1°C |
| Week 1 | 72% | ±0.5°C |
| Week 4 | 91% | ±0.2°C |

### Gebouwtype Categorieën

| Type | C (kWh/°C) | UA (kW/°C) | τ (uur) |
|------|------------|------------|---------|
| Licht (hout/prefab) | 5-8 | 0.35-0.45 | 2-4 |
| Gemiddeld (NL woning) | 10-15 | 0.25-0.35 | 4-8 |
| Zwaar (beton) | 15-25 | 0.15-0.25 | 8-16 |
| Passiefhuis | 25-40 | <0.05 | 16-48 |

---

## Component 3: Energy Price Optimizer

### Prijscategorieën

| Categorie | Drempel | Actie | Offset |
|-----------|---------|-------|--------|
| Zeer Laag | ≤€0.04/kWh | Pre-heat MAX | +1.5°C |
| Laag | ≤€0.06/kWh | Pre-heat | +0.75°C |
| Normaal | ≤€0.10/kWh | Handhaven | 0°C |
| Hoog | ≤€0.12/kWh | Reduceren | -0.5°C |
| Zeer Hoog | >€0.12/kWh | Reduceren MAX | -1.0°C |

> [!NOTE]
> Drempels zijn gebaseerd op 2024 spotprijs percentielen.

### Kostenberekening Modi

| Modus | Formule |
|-------|---------|
| Marktprijs | Spot + BTW |
| Marktprijs+ | Spot + opslag + BTW |
| **All-in** | Spot + opslag + belasting + BTW |

### Voorbeeld Besparing

```
ZONDER optimalisatie: €18/dag
MET optimalisatie:    €10/dag
─────────────────────────────
Besparing:            €8/dag = ~€2.900/jaar (max)
Realistisch:          €400-600/jaar
```

---

## Component 4: COP Controller

### Wat is COP?

**COP = Warmte Output / Elektrisch Input**

| COP | Betekenis | Kosten (€0.25/kWh) |
|-----|-----------|-------------------|
| 2.0 | Slecht | €0.25/uur voor 4kW |
| 3.5 | Goed | €0.14/uur voor 4kW |
| 5.0 | Excellent | €0.10/uur voor 4kW |

> [!IMPORTANT]
> Verschil tussen COP 2.0 en 5.0 = **2.5× goedkoper!**

### Factoren die COP beïnvloeden

| Factor | Effect | Optimalisatie |
|--------|--------|---------------|
| Temp verschil | Groter = lagere COP | Lagere aanvoertemp |
| Buitentemp | Warmer = hogere COP | Pre-heat bij mild weer |
| Aanvoertemp | Lager = hogere COP | Minimaal noodzakelijke temp |

### Multi-Horizon Analyse

De app gebruikt ingebouwde COP capabilities:

| Capability | Horizon | Gebruik |
|------------|---------|---------|
| `adlar_cop` | Realtime | Directe aanpassingen |
| `adlar_cop_daily` | 24u gemiddelde | Dagpatroon |
| `adlar_cop_weekly` | 7d gemiddelde | Trends |
| `adlar_cop_monthly` | 30d gemiddelde | Seizoen |
| `adlar_scop` | Seizoen (EN 14825) | Jaarlijks |

### Efficiency Zones

| Zone | COP | Actie |
|------|-----|-------|
| 🟢 Excellent | ≥4.0 | Maintain |
| 🟢 Goed | 3.5-4.0 | Maintain |
| 🟡 Acceptabel | 3.0-3.5 | Monitor |
| 🟠 Matig | 2.5-3.0 | Optimize |
| 🔴 Slecht | <2.5 | **Urgent!** |

---

## Systeem Integratie

### Prioriteiten & Gewichten

De wegingsfactoren zijn **configureerbaar** via Apparaatinstellingen → Adaptieve Regeling Wegingsfactoren:

| Prioriteit | Standaard | Bereik | Functie |
|------------|-----------|--------|---------|
| **Comfort** | 60% | 0-100% | Gewicht voor PI temperatuurregeling |
| **Efficiëntie** | 25% | 0-100% | Gewicht voor COP optimalisatie |
| **Kosten** | 15% | 0-100% | Gewicht voor prijsoptimalisatie |

> [!NOTE]
> Waarden worden automatisch genormaliseerd naar totaal 100%.

### Conflict Resolutie

**Voorbeeld:**
```
Temp Controller:  "Verhoog +2°C" (te koud!)
COP Controller:   "Verlaag -1°C" (slechte COP)
Price Optimizer:  "Verlaag -1°C" (dure prijs)

Berekening:
+2 × 0.60 = +1.20°C
-1 × 0.25 = -0.25°C
-1 × 0.15 = -0.15°C
─────────────────────
Totaal:    +0.80°C
```

### Override Regels

1. **Safety First** — Buiten 15-28°C range: negeer alles
2. **Comfort Minimum** — Te koud: 100% comfort prioriteit
3. **Efficiency Opportunity** — Ruimte + lage COP: verhoog COP gewicht

---

## Setup & Configuratie

### Snelstart (5 minuten)

1. **Installeer app** op Homey Pro
2. **Configureer externe sensor** (thermostaat)
3. **Stooklijn → OFF** (app doet dit automatisch)
4. **Wacht 24 uur** voor eerste resultaten
5. **Activeer optimalisaties** na 1 week

### Installatie Fases

| Fase | Dag | Actie | Verwacht |
|------|-----|-------|----------|
| Learning | 1-3 | Data verzamelen | 30-50% confidence |
| Basis | 3-7 | Adaptive Control AAN | Stabiele temp |
| Volledig | 10+ | COP + Prijs AAN | Alle optimalisaties |

### Configuratie

````carousel
```json
// Heating Controller
{
  "adaptive_control_enabled": true,
  "target_temperature": 20,
  "control_deadband": 0.3,
  "control_kp": 3.0,
  "control_ki": 1.5,
  "min_wait_between_changes": 20
}
```
<!-- slide -->
```json
// Energy Optimizer
{
  "price_optimizer_enabled": true,
  "price_calculation_mode": "all_in",
  "price_threshold_very_low": 0.04,
  "price_threshold_low": 0.06,
  "price_threshold_normal": 0.10,
  "price_threshold_high": 0.12,
  "price_max_preheat_offset": 1.5
}
```
<!-- slide -->
```json
// COP Controller
{
  "cop_optimizer_enabled": true,
  "cop_min_acceptable": 2.5,
  "cop_target": 3.5,
  "cop_strategy": "balanced"
}
```
````

---

## Flow Voorbeelden

### Basis: Notificatie

```
WHEN: Setpoint automatically adjusted
THEN: Send notification
      "🌡️ Steltemp: {{old}}°C → {{new}}°C"
```

### Geavanceerd: GPS Thuiskomst

```
WHEN: Someone is arriving home
IF: Everyone was away AND Current temp < 19°C
THEN: Set adaptive target to 20°C
      Send notification "🏠 Opwarmen gestart"
```

### Prijs Optimalisatie

```
WHEN: Time is 23:00
IF: Current price < €0.08/kWh
    AND Tomorrow 07:00 price > €0.30/kWh
    AND Building τ > 6 hours
THEN: Set target +1.5°C (pre-heat)
      Send notification "⚡💰 Pre-heating"
```

### Multi-Horizon COP Rapport

```
WHEN: Time is Sunday 20:00
THEN: Get COP metrics
      Send notification:
      "📈 Wekelijks COP Rapport
       Current: {{adlar_cop}}
       Daily: {{adlar_cop_daily}}
       Weekly: {{adlar_cop_weekly}}
       SCOP: {{adlar_scop}}"
```

---

## Troubleshooting

### Veelvoorkomende Problemen

| Probleem | Oorzaak | Oplossing |
|----------|---------|-----------|
| "Heating curve not OFF" | Handmatig gewijzigd | Settings → Control Mode reset |
| Temp reageert niet | Externe sensor issues | Check sensor verbinding |
| Model confidence laag | Inconsistente data | Wacht langer of reset model |
| Geen prijsdata | API issues | Check internetverbinding |
| COP onrealistisch | WP in transitie | Wacht 24u voor stabilisatie |

### Tuning Problemen

| Symptoom | Aanpassing |
|----------|------------|
| Schommelt te veel | Verhoog deadband, verlaag Kp |
| Reageert te traag | Verlaag deadband, verhoog Kp |
| Structureel te koud/warm | Verhoog Ki |
| Te veel kleine correcties | Verhoog min_wait |

### Debug Modus

```bash
# Activeer via Settings → Log Level → DEBUG

# Geeft extra logs:
# - Controller status elke 5 min
# - RLS updates en voorspelfouten
# - COP berekeningen
# - Prijscategorie beslissingen
```

---

## Appendix: Technische Details

### DPS Mapping

| DPS | Capability | Beschrijving |
|-----|------------|--------------|
| 4 | `target_temperature` | Steltemperatuur (direct control) |
| 13 | `adlar_enum_countdown_set` | Stooklijn (**MOET OFF zijn!**) |
| 21 | `measure_temperature.temp_top` | Aanvoertemperatuur |
| 22 | `measure_temperature.temp_bottom` | Retourtemperatuur |
| 26 | `measure_temperature.around_temp` | Buitentemperatuur |
| 27 | `adlar_state_compressor_state` | Compressor status |

> [!CAUTION]
> Verander **NOOIT** handmatig de stooklijn (DPS 13)! Deze moet altijd op OFF staan voor adaptieve regeling.

### Formules

**Warmte Balans:**
```
dT/dt = (1/C) × [P_verwarming - UA×(T_in - T_out) + P_zon + P_intern]
```

**COP Berekening:**
```
COP = Q_thermal / P_electrical
Q_thermal = ṁ × c_p × ΔT
```

**PI Controller:**
```
Correctie = (Kp × huidige_fout) + (Ki × gemiddelde_fout)
```

### Performance Metrics

| Metric | Target | Typisch |
|--------|--------|---------|
| Temp Stabiliteit | ±0.3°C | ±0.2°C |
| Response Time | <30 min | 15-20 min |
| COP Verbetering | +20% | +25-35% |
| Kostenverlaging | 30% | 35-45% |
| Jaarlijkse besparing | €500 | €600-800 |

---
