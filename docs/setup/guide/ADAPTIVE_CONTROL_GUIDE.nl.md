# Adaptive Temperature Control
## Gebruikershandleiding v2.7.x

Intelligente temperatuurregeling voor een **constante binnentemperatuur** met optimale efficiëntie.

---

## Inhoudsopgave

1. [Overzicht](#overzicht)
2. [Hoe werkt het?](#hoe-werkt-het)
3. [Aan de slag](#aan-de-slag)
4. [Flow Cards](#flow-cards)
5. [Instellingen](#instellingen)
6. [Praktische voorbeelden](#praktische-voorbeelden)
7. [Troubleshooting](#troubleshooting)
8. [Expert Mode](#expert-mode)
9. [FAQ](#faq)

---

## Overzicht

**Adaptive Control** past automatisch de doeltemperatuur van je warmtepomp aan om een **constante binnentemperatuur** te behouden. Het systeem werkt samen met jouw kamerthermostaat of temperatuursensor.

### Voordelen

| Voordeel | Beschrijving |
|----------|--------------|
| 🎯 **Constante temperatuur** | Blijft binnen ±0.3°C van je gewenste temperatuur |
| ⚡ **Hogere efficiëntie** | PI-algoritme voorkomt on/off cycling |
| 🔄 **Automatische aanpassing** | Reageert op veranderende omstandigheden |
| 💰 **Energiebesparing** | Tot 25% efficiëntieverbetering mogelijk |

### Wanneer gebruiken?

- ✅ Je hebt een thermostaat of temperatuursensor in de woonkamer
- ✅ Je wilt een **exacte** binnentemperatuur (bijv. 21.0°C constant)
- ✅ Je warmtepomp heeft vaak temperatuurschommelingen
- ✅ Je wilt de efficiëntie optimaliseren

---

## Hoe werkt het?

Adaptive Control gebruikt een **PI-regelsysteem** (Proportional-Integral controller) — dezelfde technologie die in professionele industriële systemen wordt gebruikt.

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1️⃣ METEN                                                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Sensor stuurt temperatuur (bijv. 20.5°C)                      │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2️⃣ VERGELIJKEN                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Gewenst: 21.0°C   Werkelijk: 20.5°C   Afwijking: -0.5°C       │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3️⃣ PI-ALGORITME                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ P-term: 3.0 × -0.5 = -1.5°C                                   │  │
│  │ I-term: correctie historisch                                  │  │
│  │ Totaal: -1.5°C                                                │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4️⃣ AANPASSEN                                                        │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Setpoint: 45°C → 43°C                                         │  │
│  │ Max 1x per 20 min │ Max ±3°C per keer                         │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │
                                   └──────────── Volgende cyclus ─┐
                                                                  │
                                   ┌──────────────────────────────┘
                                   ▼
                            (Terug naar METEN)
```

### Kenmerken

| Kenmerk | Waarde | Beschrijving |
|---------|--------|--------------|
| ⏱️ Controle-interval | 5 min | Evaluatie frequentie |
| 🔒 Anti-oscillatie | 20 min | Minimum tussen aanpassingen |
| 🎯 Deadband | ±0.3°C | Tolerantie zone (geen actie) |
| 🛡️ Veiligheidsgrenzen | ±3°C / 15-28°C | Max aanpassing en absolute range |
| 🔢 Smart Accumulator | Fractional → Integer | Verzamelt kleine correcties |

### Waarom hele graden?

De warmtepomp setpoint gebruikt **stappen van 1°C**. De PI-controller berekent echter fractional adjustments (bijv. +0.7°C).

**Oplossing**: De **Smart Accumulator** verzamelt fractional berekeningen:

```
Cyclus 1: PI = +0.3°C → Accumulator: 0.3 → Wacht
Cyclus 2: PI = +0.4°C → Accumulator: 0.7 → Apply +1°C, Rest: -0.3
Cyclus 3: PI = +0.2°C → Accumulator: -0.1 → Wacht
```

### 4-Pilaar Weighted Decision System (v2.6.0+)

Adaptive Control combineert **4 intelligente componenten** in elke beslissing:

| Component | Gewicht | Functie |
|-----------|---------|---------|
| 🛋️ **Comfort** | 50% | PI-regeling voor stabiele binnentemperatuur |
| ⚡ **Efficiëntie** | 15% | COP-optimalisatie via aanvoertemperatuur |
| 💰 **Kosten** | 15% | Prijsoptimalisatie (voorverwarmen bij goedkope stroom) |
| 🏠 **Thermisch** | 20% | Predictieve regeling via geleerd gebouwmodel |

**Voorbeeld berekening:**

```
Comfort wil: +2.0°C (te koud)
Efficiency wil: -0.5°C (lagere aanvoertemp voor betere COP)
Cost wil: +1.0°C (goedkope stroom, voorverwarmen)
Thermal wil: +0.5°C (gebouw koelt snel af, voorspellend opwarmen)

Gewogen totaal: (2.0×50% + -0.5×15% + 1.0×15% + 0.5×20%) = 1.15°C
```

**Resultaat**: Warmtepomp setpoint gaat +1°C omhoog (afgerond).

> [!NOTE]
> De gewichten zijn **configureerbaar** via device settings (Expert mode). Standaardwaarden zijn geoptimaliseerd voor meeste situaties.

---

## Aan de slag

### Vereisten

- **Homey Pro** met Adlar Heat Pump app v2.7.0+
- **Werkende warmtepomp** met stabiele verbinding
- **Temperatuursensor** (Tado, Nest, Netatmo, Fibaro, Xiaomi, etc.)

**Optioneel voor uitgebreide optimalisatie (v2.7.0+):**

- ☁️ Windsnelheid sensor (voor gebouwmodel wind correctie)
- ☀️ Zonnestraling sensor (voor zonne-winst optimalisatie)
- 💰 Dynamisch energiecontract (voor prijsoptimalisatie)

### Stap 1: Temperatuurdata Flow

Maak een flow die de binnentemperatuur doorstuurt:

**Tado thermostaat:**
```
WHEN: Tado → Temperatuur is veranderd
THEN: Adlar Heat Pump → Stuur binnentemperatuur
      └─ Temperatuur: {{Tado temperatuur}}
```

**Fibaro sensor:**
```
WHEN: Fibaro Motion Sensor → Temperatuur is veranderd  
THEN: Adlar Heat Pump → Stuur binnentemperatuur
      └─ Temperatuur: {{Fibaro temperatuur}}
```

**Meerdere sensoren (gemiddelde):**
```
WHEN: Timer elke 5 minuten
THEN: Adlar Heat Pump → Stuur binnentemperatuur
      └─ Temperatuur: {{(Sensor1 + Sensor2 + Sensor3) / 3}}
```

> [!TIP]
> Stuur temperatuur minimaal elke 10 minuten. Data ouder dan 10 minuten wordt als verouderd beschouwd.

### Stap 2: Inschakelen

1. Open **Adlar Heat Pump** → **Instellingen** ⚙️
2. Scroll naar **Adaptive Temperature Control**
3. Vink aan: **Enable adaptive temperature control** ✅
4. Klik **Opslaan**

### Stap 3: Controleren

Controleer de volgende punten:

- ✅ **External Indoor Temperature** capability toont actuele waarde
- ✅ Test flow: "Adaptieve regeling beveelt temperatuur aanpassing aan" triggert
- ✅ Insights: grafiek toont continue temperatuurdata

---

## Flow Cards

### Action: Stuur binnentemperatuur

**ID:** `receive_external_indoor_temperature`

| Parameter | Type | Bereik | Voorbeeld |
|-----------|------|--------|-----------|
| Temperatuur | Number | -10 tot +50°C | `{{Tado temperatuur}}` |

---

### Trigger: Temperatuur aanpassing aanbevolen

**ID:** `temperature_adjustment_recommended`

Triggert wanneer adaptive control een setpoint-wijziging berekent.

| Token | Type | Beschrijving |
|-------|------|--------------|
| `current_temperature` | Number | Huidige setpoint (°C) |
| `recommended_temperature` | Number | Aanbevolen setpoint (°C) |
| `adjustment` | Number | Berekende aanpassing |
| `reason` | String | Uitleg van berekening |
| `controller` | String | Controller type |

> [!NOTE]
> `adjustment` is de berekende aanbeveling en kan fractional zijn. De werkelijke aanpassing is altijd een geheel getal.

**Voorbeeld:**
```
WHEN: Adaptieve regeling beveelt temperatuur aanpassing aan
AND: {{recommended_temperature}} - {{current_temperature}} > 2
THEN: Stuur notificatie
      └─ "Aanbevolen: {{recommended_temperature}}°C - {{reason}}"
```

---

### Trigger: Gesimuleerde temperatuur aangepast

**ID:** `adaptive_simulation_update`

Triggert voor monitoring/logging zonder echte aanpassingen.

| Token | Type | Beschrijving |
|-------|------|--------------|
| `simulated_target` | Number | Gesimuleerde doeltemperatuur |
| `actual_target` | Number | Werkelijke setpoint |
| `delta` | Number | Verschil |
| `comfort_component` | Number | Comfort bijdrage (°C) |
| `efficiency_component` | Number | Efficiëntie bijdrage (°C) |
| `cost_component` | Number | Kosten bijdrage (°C) |
| `thermal_component` | Number | Thermisch model bijdrage (°C) (v2.6.0+) |
| `reasoning` | String | Redenering |

---

### Trigger: Adaptive status change

**ID:** `adaptive_status_change`

| Token | Type | Beschrijving |
|-------|------|--------------|
| `status` | String | `enabled` of `disabled` |
| `reason` | String | Reden van wijziging |

**Voorbeeld:**
```
WHEN: Adaptive status change
AND: Status is 'enabled'
THEN: Stuur notificatie "✅ Adaptive control geactiveerd"
```

---

## Instellingen

### Basis Instellingen

| Instelling | Standaard | Beschrijving |
|------------|-----------|--------------|
| Enable adaptive temperature control | Uit | Hoofdschakelaar |

### Expert Instellingen

> [!IMPORTANT]
> Expert instellingen zijn alleen zichtbaar met **Expert HVAC functie kaarten** ingeschakeld.

| Instelling | Standaard | Bereik | Beschrijving |
|------------|-----------|--------|--------------|
| **Kp** (Proportional Gain) | 3.0 | 0.5 - 10.0 | Directe reactie op afwijking |
| **Ki** (Integral Gain) | 1.5 | 0.1 - 5.0 | Correctie langdurige afwijking |
| **Deadband** | 0.3°C | 0.1 - 1.0°C | Tolerantie zone |

**Tuning tips:**

| Probleem | Oplossing |
|----------|-----------|
| Oscillatie/overshoot | Verlaag Kp (bijv. 3.0 → 2.0) |
| Te trage reactie | Verhoog Kp (bijv. 3.0 → 4.0) |
| Structurele afwijking | Verhoog Ki (bijv. 1.5 → 2.0) |
| Te veel kleine correcties | Verhoog deadband (bijv. 0.3 → 0.5) |

---

## Praktische voorbeelden

### Basis Setup (Tado)

**Doel:** Constante 21°C met Tado thermostaat

```
# Flow 1: Temperatuurdata
WHEN: Tado Woonkamer → Temperatuur is veranderd
THEN: Adlar Heat Pump → Stuur binnentemperatuur
      └─ Temperatuur: {{Tado temperatuur}}

# Flow 2: Monitoring
WHEN: Adaptieve regeling beveelt temperatuur aanpassing aan
THEN: Log "Aanbevolen: {{recommended_temperature}}°C ({{reason}})"
```

**Verwacht gedrag:**
- 20.5°C gemeten → Warmtepomp setpoint omhoog
- 21.3°C gemeten → Warmtepomp setpoint omlaag
- Binnen 1-2 uur: stabiel op 21.0°C ±0.3°C

---

### Meerdere kamers (gemiddelde)

```
WHEN: Timer elke 5 minuten
THEN: 
  avg_temp = ({{Woonkamer}} + {{Keuken}} + {{Gang}}) / 3
  Stuur binnentemperatuur → {{avg_temp}}
```

**Voordeel:** Voorkomt overreactie op lokale schommelingen (bijv. zon op 1 sensor)

---

### Nacht/dag modus

**Doel:** 21°C overdag, 18°C 's nachts

```
WHEN: Time is 23:00
THEN: Logic variable 'Target' = 18.0

WHEN: Time is 07:00  
THEN: Logic variable 'Target' = 21.0

WHEN: Sensor → Temperatuur is veranderd
THEN: error = {{Target}} - {{Sensor}}
      adjusted = {{Sensor}} + {{error}}
      Stuur binnentemperatuur → {{adjusted}}
```

---

### Weerscompensatie

```
WHEN: Buienradar → Buitentemperatuur is veranderd
THEN:
  IF: Buitentemp < 0°C  → offset = +1.0°C
  IF: Buitentemp < -5°C → offset = +2.0°C
  ELSE: offset = 0°C
  
  Stuur binnentemperatuur → {{Sensor}} + {{offset}}
```

---

## Troubleshooting

### ❌ "No external indoor temperature configured"

**Oorzaak:** Geen temperatuurdata ontvangen

**Oplossing:**
1. Controleer of temperatuur-flow correct is
2. Trigger flow handmatig voor eerste data
3. Check "External Indoor Temperature" capability

---

### ❌ Geen aanpassingen

| Oorzaak | Check | Oplossing |
|---------|-------|-----------|
| Binnen deadband | Afwijking < 0.3°C? | Normaal gedrag |
| Throttling actief | Logs: "Adjustment throttled" | Wacht 20 min |
| Data verouderd | Timestamp > 10 min? | Verhoog flow frequentie |
| Uitgeschakeld | Device settings | Schakel in |

---

### ❌ Temperatuur oscilleert

**Symptoom:** Temperatuur schiet steeds voorbij doel

**Mogelijke oorzaken & oplossingen:**

| Oorzaak | Oplossing |
|---------|-----------|
| Kp te hoog | Verlaag naar 2.0 |
| Ki te hoog | Verlaag naar 1.0 |
| Deadband te klein | Verhoog naar 0.5°C |
| Sensor nabij warmtebron | Verplaats sensor of gebruik gemiddelde |

**Aanpak:**
1. Start met Kp verlagen (grootste impact)
2. Monitor 24 uur
3. Pas Ki aan indien nodig

---

### ❌ Trage reactie

**Symptoom:** Duurt uren om doel te bereiken

| Oorzaak | Oplossing |
|---------|-----------|
| Kp te laag | Verhoog naar 4.0 of 5.0 |
| Grote thermische massa | Verhoog Ki voor betere lange-termijn correctie |
| Setpoint range beperkt | Check handmatige setpoint |

---

## Expert Mode

> [!CAUTION]
> Pas expert instellingen alleen aan als je meetbare problemen hebt en 24-48 uur kunt testen.

### PI-parameters

#### Kp — Proportional Gain

Bepaalt directe reactie op huidige afwijking.

**Formule:** `P-term = Kp × error`

| Kp | Error -0.5°C | Effect |
|----|--------------|--------|
| 2.0 | -1.0°C | Voorzichtig |
| 3.0 | -1.5°C | **Standaard** |
| 5.0 | -2.5°C | Agressief |

**Sweet spot:** 2.5 - 4.0

---

#### Ki — Integral Gain

Corrigeert langdurige afwijkingen die P-term niet oplost.

**Formule:** `I-term = Ki × (gemiddelde error laatste 2 uur)`

**Sweet spot:** 1.0 - 2.0

---

#### Deadband

Zone waarbinnen geen actie wordt ondernomen.

**Voorbeeld** (doel 21.0°C, deadband 0.3°C):
- 20.8°C: Binnen zone → Geen actie ✅
- 21.2°C: Binnen zone → Geen actie ✅  
- 21.4°C: Buiten zone → Actie ⚡

**Sweet spot:** 
- **Comfort:** 0.2 - 0.4°C
- **Efficiëntie:** 0.4 - 0.6°C

---

### Tuning strategie

#### Fase 1: Baseline (week 1)
- Gebruik standaardwaarden
- Monitor 7 dagen via Homey Insights
- Noteer: oscillatie? te traag? overshoot?

#### Fase 2: Kp aanpassen (week 2)
- **Oscillatie:** Verlaag 20% (3.0 → 2.4)
- **Te traag:** Verhoog 30% (3.0 → 3.9)
- Test 3 dagen

#### Fase 3: Ki aanpassen (week 3)
- **Structureel te koud/warm:** Verhoog 20%
- **Trage oscillatie:** Verlaag 30%
- Test 5 dagen

#### Fase 4: Deadband (week 4)
- **Te veel kleine aanpassingen:** +0.1°C
- **Te grote schommelingen:** -0.1°C

---

### Geavanceerde problemen

#### "Hunting behavior"

**Symptoom:** Oscillatie met periode 1-3 uur

```
19:00 → 20.5°C → +2.0°C aanpassing
20:00 → 21.5°C → -1.5°C aanpassing
21:00 → 20.7°C → +1.0°C aanpassing
...
```

**Oplossing:**
1. Verlaag Kp met 30%
2. Verhoog deadband naar 0.4-0.5°C
3. Verlaag Ki met 20%

---

#### "Integral windup"

**Symptoom:** Grote overcorrectie na langdurige afwijking

**Oplossing:**
1. Verlaag Ki met 40%
2. Check externe factoren (zon, open raam)
3. Reset I-term: adaptive control uit/aan

---

## FAQ

### Algemeen

**Moet ik adaptive control 24/7 aan laten?**
> Ja, het systeem leert van geschiedenis en presteert beter naarmate het langer draait.

**Werkt het met vloerverwarming?**
> Ja, maar verwacht langzamere respons (6-12 uur). Gebruik hogere Ki, lagere Kp.

**Werkt het met radiatoren?**
> Ja, snellere respons (1-3 uur). Standaardwaarden zijn hiervoor geoptimaliseerd.

**Kan ik meerdere zones regelen?**
> Eén adaptive control per warmtepomp. Voor meerdere zones: gebruik gemiddelde van sensoren.

---

### Technisch

**Wat gebeurt bij Homey herstart?**
> Adaptive control herstart automatisch met opgeslagen historie. Eerste controle binnen 5 minuten.

**Wat als temperatuursensor uitvalt?**
> Na 10 minuten pauzeert adaptive control. Warmtepomp keert terug naar handmatige setpoint.

**Kan ik de 20-minuten throttling aanpassen?**
> Nee, dit is een vaste veiligheidswaarde.

---

### Privacy & Veiligheid

**Wordt data naar de cloud gestuurd?**
> Nee, alle berekeningen gebeuren lokaal op Homey.

**Wat zijn de veiligheidsgrenzen?**
> Absolute range: 15-28°C. Max per aanpassing: ±3°C. Hardcoded voor veiligheid.

**Kan adaptive control de warmtepomp beschadigen?**
> Nee, 20-minuten throttling voorkomt overmatige start/stop cycli.

---
