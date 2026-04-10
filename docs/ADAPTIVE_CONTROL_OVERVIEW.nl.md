# 🚀 Nieuwe Functionaliteit: Adaptieve Temperatuurregeling

> **Status**: Beschikbaar vanaf versie 2.8.x  
> **Vereist**: Externe binnentemperatuur sensor via Homey Flow

---

## Wat is Adaptieve Temperatuurregeling?

De Adlar app leert nu **zelf** hoe jouw woning zich gedraagt en past automatisch de warmtepomp aan voor optimaal comfort én maximale besparing.

### De 5 Pijlers: Comfort • Efficiëntie • Kosten • Thermisch • Coast

| Factor | Wat het doet | Instelling |
|--------|--------------|------------|
| 🛋️ **Comfort** | Stabiele binnentemperatuur (±0.3°C) via PI-regeling | 50% (standaard) |
| ⚡ **Efficiëntie** | Optimale COP door slimme aanvoertemperatuur | 15% (standaard) |
| 💰 **Kosten** | Voorverwarmen bij goedkope stroom, afschalen bij dure | 15% (standaard) |
| 🏠 **Thermisch** | Predictieve regeling via geleerd gebouwmodel (τ, C, UA) | 20% (standaard) |
| ❄️ **Coast** | Passieve koeling — voorkomt onnodig stoken boven setpoint | max. 80% (conditioneel) |

*De gewichten zijn instelbaar en normaliseren automatisch naar 100%.*

---

## Wat Kan Het Bewerkstelligen?

### 1. Stabielere Temperatuur
- **Probleem**: Traditionele thermostaten reageren traag, temperatuur schommelt 1-2°C
- **Oplossing**: PI-controller met voorspelling → binnentemperatuur blijft binnen ±0.3°C

### 2. Lagere Energierekening
- **COP Optimalisatie**: Leert optimale aanvoertemperatuur per buitentemperatuur → €200-300/jaar
- **Prijsoptimalisatie**: Verwarmt vooraf tijdens goedkope uren → €400-600/jaar

### 3. Slimmer Gebouwmodel (v2.6.0+)

De app leert automatisch jouw woning kennen:

- **Thermische massa (C)**: Hoe snel je huis afkoelt/opwarmt
- **Warmteverlies (UA)**: Isolatiekwaliteit
- **Tijdsconstante (τ)**: Reactiesnelheid op temperatuurverandering
- **Zonnewinst (g)**: Bijverwarming door zon (indien sensor beschikbaar)
- **Windcorrectie**: Extra warmteverlies bij harde wind (v2.7.0+)

**Learning periode**: 48-72 uur voor betrouwbaar model
**Updates**: Continu bijleren bij veranderende omstandigheden

### 4. Passieve Koelmodus (v2.8.0+)

- **Probleem**: Warmtepomp stookt door terwijl de kamer al te warm is (bijv. door zon)
- **Oplossing**: Coast-strategie detecteert overshoot → verlaagt setpoint onder watertemperatuur → compressor stopt
- **I-term reset**: PI-regelaar wordt na afkoelfase schoon herstart
- **Hydraulische vertraging (v2.10.x+)**: Coast geeft zijn gewicht automatisch terug aan de PI-regelaar zolang de uitlaattemperatuur nog niet reageert op een setpoint-verlaging — zodat bijsturing nooit wordt geblokkeerd

---

## Benodigde Setup

```
┌─────────────────────────────────────────────────────┐
│   Externe Sensor    →    Flow Card    →    App      │
│   (thermostaat)          (trigger)        (leert)   │
└─────────────────────────────────────────────────────┘
```

**Minimaal vereist:**

1. ✅ Binnentemperatuur sensor (bijv. Aqara, Tado, Homey thermostaat)
2. ✅ Flow: `WANNEER temp verandert` → `Stuur binnentemperatuur naar warmtepomp`

**Optioneel voor uitgebreide optimalisatie:**

- 🌡️ Buitentemperatuur sensor (voor gebouwmodel learning en COP optimalisatie)
- 💡 Externe vermogensmeter (voor nauwkeurige COP berekening)
- 💰 Dynamisch energiecontract (voor prijsoptimalisatie)
- ☁️ Windsnelheid sensor (voor wind correctie op warmteverlies)
- ☀️ Zonnestraling sensor (voor zonne-winst correctie)

---

## Hoe Activeren?

1. **Device Settings** → Schakel `Adaptieve temperatuurregeling` in
2. Maak flow voor binnentemperatuur
3. Wacht 48-72 uur voor volledig gebouwmodel learning
4. Optioneel: Schakel COP/Prijsoptimalisatie in
5. Optioneel: Configureer wind/solar sensoren voor extra optimalisatie

---

*Meer info: [Advanced Features Introduction](setup/advanced-control/Advanced_Features_Intro.nl.md)*
*Meer info: [Configuration Guide](setup/advanced-settings/CONFIGURATION_GUIDE.nl.md) - Sectie 5*