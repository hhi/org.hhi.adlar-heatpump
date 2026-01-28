# 🚀 Nieuwe Functionaliteit: Adaptieve Temperatuurregeling

> **Status**: Beschikbaar vanaf versie 2.5.x  
> **Vereist**: Externe binnentemperatuur sensor via Homey Flow

---

## Wat is Adaptieve Temperatuurregeling?

De Adlar app leert nu **zelf** hoe jouw woning zich gedraagt en past automatisch de warmtepomp aan voor optimaal comfort én maximale besparing.

### De 3 Pijlers: Comfort • Efficiëntie • Kosten

| Factor | Wat het doet | Instelling |
|--------|--------------|------------|
| 🛋️ **Comfort** | Stabiele binnentemperatuur (±0.3°C) via PI-regeling | 60% (standaard) |
| ⚡ **Efficiëntie** | Optimale COP door slimme aanvoertemperatuur | 25% (standaard) |
| 💰 **Kosten** | Voorverwarmen bij goedkope stroom, afschalen bij dure | 15% (standaard) |

*De gewichten zijn instelbaar en normaliseren automatisch naar 100%.*

---

## Wat Kan Het Bewerkstelligen?

### 1. Stabielere Temperatuur
- **Probleem**: Traditionele thermostaten reageren traag, temperatuur schommelt 1-2°C
- **Oplossing**: PI-controller met voorspelling → binnentemperatuur blijft binnen ±0.3°C

### 2. Lagere Energierekening
- **COP Optimalisatie**: Leert optimale aanvoertemperatuur per buitentemperatuur → €200-300/jaar
- **Prijsoptimalisatie**: Verwarmt vooraf tijdens goedkope uren → €400-600/jaar

### 3. Slimmer Gebouwmodel
De app leert automatisch:
- **Thermische massa (C)**: Hoe snel je huis afkoelt
- **Warmteverlies (UA)**: Isolatiekwaliteit
- **Tijdsconstante (τ)**: Hoeveel uur tot stabiele temperatuur
- **Zonnewinst (g)**: Bijverwarming door zon

---

## Benodigde Setup

```
┌─────────────────────────────────────────────────────┐
│   Externe Sensor    →    Flow Card    →    App      │
│   (thermostaat)          (trigger)        (leert)   │
└─────────────────────────────────────────────────────┘
```

**Minimale vereiste:**
1. ✅ Binnentemperatuur sensor (bijv. Aqara, Tado, Homey thermostaat)
2. ✅ Flow: `WANNEER temp verandert` → `Stuur naar warmtepomp`

**Optioneel voor extra functies:**
- Buitentemperatuur sensor (KNMI, weerstation)
- Externe vermogensmeter (voor COP)
- Dynamisch energiecontract (voor prijsoptimalisatie)

---

## Hoe Activeren?

1. **Device Settings** → Schakel `Adaptieve temperatuurregeling` in
2. Maak flow voor binnentemperatuur
3. Wacht 24-48 uur voor gebouwmodel learning
4. Optioneel: Schakel COP/Prijsoptimalisatie in

---

*Meer info: [Advanced Features Introduction](setup/advanced-control/Advanced_Features_Intro.nl.md)*
*Meer info: [Configuration Guide](setup/advanced-settings/CONFIGURATION_GUIDE.nl.md) - Sectie 5*