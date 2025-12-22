# Adaptive Temperature Control - Gebruikershandleiding (v1.4.0)

Deze handleiding legt uit hoe je de adaptieve temperatuurregeling van je Adlar warmtepomp gebruikt om automatisch een constante binnentemperatuur te behouden met optimale efficiëntie.

---

## 📋 Inhoudsopgave

1. [Wat is Adaptive Control?](#wat-is-adaptive-control)
2. [Hoe werkt het?](#hoe-werkt-het)
3. [Wat heb je nodig?](#wat-heb-je-nodig)
4. [Installatie & Configuratie](#installatie--configuratie)
5. [Instellingen](#instellingen)
6. [Flow Cards](#flow-cards)
7. [Praktische Voorbeelden](#praktische-voorbeelden)
8. [Troubleshooting](#troubleshooting)
9. [Expert Mode](#expert-mode)

---

## Wat is Adaptive Control?

**Adaptive Control** is een intelligente temperatuurregeling die automatisch de doeltemperatuur van je warmtepomp aanpast om een **constante binnentemperatuur** te behouden. In plaats van een vaste setpoint werkt de warmtepomp samen met jouw kamerthermostaat of temperatuursensor.

### Voordelen

✅ **Constante binnentemperatuur** - Blijft binnen ±0.3°C van je gewenste temperatuur
✅ **Minder temperatuurschommelingen** - Geen koude/warme periodes meer
✅ **Hogere efficiëntie** - PI-algoritme voorkomt on/off cycling
✅ **Automatische aanpassing** - Reageert op veranderende omstandigheden
✅ **Energie besparing** - Tot 25% efficiëntieverbetering mogelijk

### Wanneer gebruiken?

- Je hebt een thermostaat of temperatuursensor in de woonkamer
- Je wilt een **exacte** binnentemperatuur (bijv. 21.0°C constant)
- Je warmtepomp heeft vaak temperatuurschommelingen
- Je wilt de efficiëntie optimaliseren

---

## Hoe werkt het?

Adaptive Control gebruikt een **PI-regelsysteem** (Proportional-Integral controller) - dezelfde technologie die in professionele industriële systemen wordt gebruikt.

### Proces in 4 stappen

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          ADAPTIVE CONTROL PROCES                          │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ STAP 1: METEN                                                      │  │
│  │ ────────────────────────────────────────────────────────────────── │  │
│  │ Sensor stuurt werkelijke binnentemperatuur                        │  │
│  │ Bijvoorbeeld: 20.5°C                                               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                     │                                     │
│                                     ▼                                     │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ STAP 2: VERGELIJKEN                                                │  │
│  │ ────────────────────────────────────────────────────────────────── │  │
│  │ Gewenst:    21.0°C                                                 │  │
│  │ Werkelijk:  20.5°C                                                 │  │
│  │ Afwijking:  -0.5°C (te koud)                                       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                     │                                     │
│                                     ▼                                     │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ STAP 3: BEREKENEN (PI-algoritme)                                   │  │
│  │ ────────────────────────────────────────────────────────────────── │  │
│  │ • P-term: 3.0 × -0.5 = -1.5°C                                      │  │
│  │ • I-term: 0.0°C                                                    │  │
│  │ • PI totaal berekent: -1.5°C                                       │  │
│  │ • Accumulator: -1.5°C                                              │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                     │                                     │
│                                     ▼                                     │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ STAP 4: AANPASSEN (Smart Rounding)                                 │  │
│  │ ────────────────────────────────────────────────────────────────── │  │
│  │ • Integer: Math.round(-1.5) = -2°C                                 │  │
│  │ • Setpoint: 45°C → 43°C                                            │  │
│  │ • Accumulator: -1.5 - (-2) = +0.5°C                                │  │
│  │ • Remainder bewaard voor volgende cyclus                           │  │
│  │ • Limiet: Max 1x/20min, max ±3°C                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### Belangrijke kenmerken

**⏱️ Controle-interval**: Elke 5 minuten evalueert het systeem de temperatuur
**🔒 Anti-oscillatie**: Max 1 aanpassing per 20 minuten (voorkomt heen-en-weer regelen)
**🎯 Deadband**: Geen actie binnen ±0.3°C tolerantie (voorkomt onnodige correcties)
**🛡️ Veiligheidsgrenzen**: Max ±3°C aanpassing per keer, absolute range 15-28°C
**💾 Geheugen**: Houdt historie bij voor betere voorspellingen
**🔢 Smart Accumulator**: Verzamelt fractional PI-berekeningen tot ≥0.5°C voor integer toepassing

### Waarom hele graden? (Step:1 Rounding)

De warmtepomp setpoint (watertemperatuur) gebruikt **stappen van 1°C** - dit is normaal voor warmtepompen omdat:

- ✅ **Fysiek logisch**: Watertemperatuur van 45.3°C maakt geen praktisch verschil vs 45°C
- ✅ **Hardware standaard**: De meeste warmtepompen werken intern met hele graden
- ✅ **Eenvoudige bediening**: Handmatige setpoint-wijzigingen blijven overzichtelijk

**Maar**: De PI-controller berekent **fractional adjustments** (bijv. +0.7°C) voor optimale kamertemperatuur regeling.

**Oplossing**: De **Smart Accumulator** verzamelt deze fractional adjustments totdat ze samen ≥0.5°C zijn:

```
Cyclus 1: PI berekent +0.3°C → Accumulator: 0.3 → Wacht (< 0.5)
Cyclus 2: PI berekent +0.4°C → Accumulator: 0.7 → Apply +1°C, Remainder: -0.3
Cyclus 3: PI berekent +0.2°C → Accumulator: -0.1 → Wacht
Cyclus 4: PI berekent +0.6°C → Accumulator: +0.5 → Apply +1°C, Remainder: -0.5
```

**Voordeel**: PI-precisie behouden, warmtepomp krijgt hele graden, transparante logging.

---

## Wat heb je nodig?

### Vereisten

1. **Homey Pro** met Adlar Heat Pump app versie 1.4.0 of nieuwer
2. **Werkende warmtepomp** met stabiele verbinding
3. **Temperatuursensor** - één van de volgende:
   - Homey thermostaat (bijv. Tado, Nest, Netatmo)
   - Homey temperatuursensor (bijv. Fibaro, Aeotec, Xiaomi)
   - Externe API met temperatuurdata

### Niet vereist maar aanbevolen

- **Stabiele internetverbinding** - Voor logging en updates
- **Homey insights** - Om resultaten te monitoren
- **Expert mode kennis** - Alleen voor geavanceerde aanpassingen

---

## Installatie & Configuratie

### Stap 1: Temperatuurdata Flow aanmaken

Voordat je adaptive control kunt inschakelen, moet je een flow maken die de binnentemperatuur doorstuurt naar de warmtepomp.

**Voorbeeld: Tado thermostaat**

```
WHEN: Tado - Temperatuur is veranderd
THEN: Adlar Heat Pump - Stuur binnentemperatuur voor adaptieve regeling
      └─ Temperatuur (°C): {{Tado temperatuur}}
```

**Voorbeeld: Fibaro sensor**

```
WHEN: Fibaro Motion Sensor - Temperatuur is veranderd
THEN: Adlar Heat Pump - Stuur binnentemperatuur voor adaptieve regeling
      └─ Temperatuur (°C): {{Fibaro temperatuur}}
```

**Voorbeeld: Meerdere sensoren (gemiddelde)**

```
WHEN: Time is 09:00, 12:00, 15:00, 18:00, 21:00
THEN: Adlar Heat Pump - Stuur binnentemperatuur voor adaptieve regeling
      └─ Temperatuur (°C): {{(Sensor1 + Sensor2 + Sensor3) / 3}}
```

> **💡 TIP**: Stuur de temperatuur minimaal elke 10 minuten. Het systeem beschouwt data ouder dan 10 minuten als verouderd en pauzeert de regeling.

### Stap 2: Adaptive Control inschakelen

1. Open de **Adlar Heat Pump** in Homey
2. Ga naar **Instellingen** ⚙️
3. Scroll naar sectie **"Adaptive Temperature Control"**
4. Vink aan: **"Enable adaptive temperature control"** ✅
5. Klik **"Opslaan"**

Het systeem start automatisch en voert de eerste controle direct uit.

### Stap 3: Controleren of het werkt

Check de volgende punten:

✅ **Capability zichtbaar**: Ga naar de heat pump → Bekijk "External Indoor Temperature"
✅ **Waarde actueel**: De temperatuur moet de laatste sensor-update tonen
✅ **Flow trigger actief**: Maak een test-flow met trigger "Target temperature adjusted"
✅ **Insights**: Bekijk de grafiek van "External Indoor Temperature" voor continuïteit

---

## Instellingen

### Simple Mode (Standaard gebruiker)

In de **device settings** vind je onder "Adaptive Temperature Control":

#### 🔘 Enable adaptive temperature control
- **Type**: Checkbox (aan/uit)
- **Standaard**: Uit
- **Beschrijving**: Hoofdschakelaar voor adaptive control
- **Wanneer aanpassen**:
  - ✅ Aan: Je hebt een temperatuursensor gekoppeld via flow
  - ❌ Uit: Je wilt handmatig de warmtepomp regelen

> **⚠️ BELANGRIJK**: Als je adaptive control uitschakelt, keert de warmtepomp terug naar de handmatige setpoint. De flow voor temperatuurdata kan blijven draaien (wordt genegeerd).

### Expert Mode (Geavanceerde gebruikers)

Alleen zichtbaar als **"Flow Expert Mode"** is ingeschakeld in de device settings.

#### 🔧 PI Controller: Proportional Gain (Kp)
- **Type**: Nummer (0.5 - 10.0)
- **Standaard**: 3.0
- **Beschrijving**: Bepaalt de **directe reactie** op temperatuurafwijking
- **Effect**:
  - Hogere waarde (bijv. 5.0): **Snellere** reactie, meer **agressieve** correcties
  - Lagere waarde (bijv. 1.5): **Langzamere** reactie, meer **geleidelijke** correcties
- **Aanpassen wanneer**:
  - ⬆️ **Verhoog** als: Temperatuur reageert te traag op veranderingen
  - ⬇️ **Verlaag** als: Temperatuur overshoot (schiet voorbij doel)

#### 🔧 PI Controller: Integral Gain (Ki)
- **Type**: Nummer (0.1 - 5.0)
- **Standaard**: 1.5
- **Beschrijving**: Corrigeert **structurele afwijkingen** over tijd
- **Effect**:
  - Hogere waarde (bijv. 2.5): **Sneller** wegwerken van blijvende afwijking
  - Lagere waarde (bijv. 0.5): **Langzamer** maar **stabieler** gedrag
- **Aanpassen wanneer**:
  - ⬆️ **Verhoog** als: Temperatuur blijft structureel 0.2-0.3°C te laag/hoog
  - ⬇️ **Verlaag** als: Temperatuur oscilleert (heen en weer rondom setpoint)

#### 🔧 PI Controller: Deadband (°C)
- **Type**: Nummer (0.1 - 1.0)
- **Standaard**: 0.3°C
- **Beschrijving**: **Tolerantie** waarbinnen geen actie wordt ondernomen
- **Effect**:
  - Hogere waarde (bijv. 0.5°C): **Minder** aanpassingen, stabieler
  - Lagere waarde (bijv. 0.2°C): **Meer** aanpassingen, nauwkeuriger
- **Aanpassen wanneer**:
  - ⬆️ **Verhoog** als: Te veel kleine correcties (onrustig gedrag)
  - ⬇️ **Verlaag** als: Temperatuurafwijking groter dan gewenst

> **🎓 EXPERT TIP**: De standaardwaarden (Kp=3.0, Ki=1.5, deadband=0.3°C) zijn geoptimaliseerd voor 99% van de installaties. Pas alleen aan als je meetbare problemen ervaart.

---

## Flow Cards

Adaptive Control biedt 3 flow cards voor automatisering en monitoring.

### 1️⃣ Action: Stuur binnentemperatuur voor adaptieve regeling

**ID**: `receive_external_indoor_temperature`
**Type**: Action Card
**Wanneer gebruiken**: Om temperatuurdata van sensoren naar de warmtepomp te sturen

#### Parameters

| Parameter | Type | Bereik | Voorbeeld |
|-----------|------|--------|-----------|
| Temperatuur (°C) | Number | -10 tot +50°C | `{{Tado temperatuur}}` |

#### Voorbeelden

**Simpele doorstuur**:
```
WHEN: Tado - Temperatuur is veranderd
THEN: Stuur binnentemperatuur voor adaptieve regeling
      └─ Temperatuur: {{Tado temperatuur}}
```

**Meerdere sensoren met logica**:
```
WHEN: Timer elke 5 minuten
AND: Woonkamer sensor beschikbaar
THEN: Stuur binnentemperatuur voor adaptieve regeling
      └─ Temperatuur: {{Woonkamer sensor temperatuur}}
ELSE: Stuur binnentemperatuur voor adaptieve regeling
      └─ Temperatuur: {{Slaapkamer sensor temperatuur}}
```

---

### 2️⃣ Trigger: Target temperature adjusted

**ID**: `target_temperature_adjusted`
**Type**: Trigger Card
**Wanneer triggert**: Elke keer dat adaptive control de warmtepomp setpoint aanpast

#### Tokens

| Token | Type | Beschrijving | Voorbeeld |
|-------|------|--------------|-----------|
| `old_temperature` | Number | Vorige setpoint (°C) | `45` |
| `new_temperature` | Number | Nieuwe setpoint (°C) | `43` |
| `adjustment` | Number | **PI-berekende** adjustment (kan fractional zijn) | `-1.5` |
| `reason` | String | Uitleg van PI berekening | `PI Control: Error=-0.5°C, P=-1.5°C, I=0.0°C` |
| `controller` | String | Welke controller | `heating` |

**⚠️ Let op**: `adjustment` is de **PI-berekende waarde** (fractional), niet altijd gelijk aan `new_temperature - old_temperature` (integer). Voor de werkelijk toegepaste adjustment: bereken `{{new_temperature}} - {{old_temperature}}`.

#### Voorbeelden

**Notificatie bij grote aanpassing**:
```
WHEN: Target temperature adjusted
AND: old_temperature - new_temperature is groter dan 2
THEN: Calculate: applied = {{new_temperature}} - {{old_temperature}}
     Send notification "Grote warmtepomp correctie: {{applied}}°C (PI berekende: {{adjustment}}°C)"
```

**Logging naar spreadsheet**:
```
WHEN: Target temperature adjusted
THEN: Calculate: applied_adjustment = {{new_temperature}} - {{old_temperature}}
      Google Sheets - Add row
      └─ Timestamp: {{time}}
      └─ Old temp: {{old_temperature}}
      └─ New temp: {{new_temperature}}
      └─ Applied: {{applied_adjustment}}
      └─ PI calculated: {{adjustment}}
      └─ Reason: {{reason}}
```

**Alarm bij veel aanpassingen**:
```
WHEN: Target temperature adjusted (5x binnen 2 uur)
THEN: Send notification "Adaptive control maakt veel aanpassingen - check systeem"
```

---

### 3️⃣ Trigger: Adaptive status change

**ID**: `adaptive_status_change`
**Type**: Trigger Card
**Wanneer triggert**: Wanneer adaptive control wordt ingeschakeld of uitgeschakeld

#### Tokens

| Token | Type | Beschrijving | Voorbeeld |
|-------|------|--------------|-----------|
| `status` | String | Nieuwe status | `enabled` of `disabled` |
| `reason` | String | Reden van wijziging | `Adaptive temperature control enabled` |

#### Voorbeelden

**Bevestiging bij inschakelen**:
```
WHEN: Adaptive status change
AND: Status is 'enabled'
THEN: Send notification "✅ Adaptive control geactiveerd - constante temperatuur actief"
```

**Waarschuwing bij uitschakelen**:
```
WHEN: Adaptive status change
AND: Status is 'disabled'
THEN: Send notification "⚠️ Adaptive control uitgeschakeld - handmatige modus actief"
```

**Automatisch weer inschakelen na reboot**:
```
WHEN: Homey is opgestart
AND: Adaptive control is uitgeschakeld
THEN: Wacht 60 seconden
AND: Schakel adaptive control weer in (via settings)
```

---

## Praktische Voorbeelden

### Voorbeeld 1: Basis Setup (Tado thermostaat)

**Doel**: Constante 21°C in de woonkamer met Tado thermostaat

**Flow 1: Temperatuurdata**
```
WHEN: Tado Woonkamer - Temperatuur is veranderd
THEN: Adlar Heat Pump - Stuur binnentemperatuur
      └─ Temperatuur: {{Tado temperatuur}}
```

**Flow 2: Monitoring**
```
WHEN: Adlar Heat Pump - Target temperature adjusted
THEN: Homey Log - Log entry
      └─ Bericht: "Warmtepomp aangepast: {{adjustment}}°C ({{reason}})"
```

**Settings**:
- ✅ Enable adaptive temperature control
- Tado setpoint: 21.0°C (dit is het doel)
- Warmtepomp handmatige setpoint: Maakt niet uit (wordt overruled)

**Verwacht gedrag**:
- Als Tado meet 20.5°C → Warmtepomp setpoint omhoog
- Als Tado meet 21.3°C → Warmtepomp setpoint omlaag
- Binnen 1-2 uur stabiliseert de temperatuur op 21.0°C ±0.3°C

---

### Voorbeeld 2: Meerdere kamers (gemiddelde)

**Doel**: Constante temperatuur over 3 kamers (woonkamer, keuken, gang)

**Flow: Temperatuur gemiddelde**
```
WHEN: Timer - Elke 5 minuten
THEN:
  1. Calculate logic variable:
     └─ avg_temp = ({{Woonkamer temp}} + {{Keuken temp}} + {{Gang temp}}) / 3

  2. Adlar Heat Pump - Stuur binnentemperatuur
     └─ Temperatuur: {{avg_temp}}
```

**Voordeel**: Voorkomt dat de warmtepomp te veel reageert op lokale schommelingen (bijv. zon op 1 sensor)

---

### Voorbeeld 3: Nachtmodus met lagere temperatuur

**Doel**: 21°C overdag, 18°C 's nachts, adaptive control blijft actief

**Flow 1: Dag/nacht schakelaar**
```
WHEN: Time is 23:00
THEN: Logic variable 'Target temp' = 18.0

WHEN: Time is 07:00
THEN: Logic variable 'Target temp' = 21.0
```

**Flow 2: Temperatuur + offset**
```
WHEN: Sensor - Temperatuur is veranderd
THEN: Calculate:
      └─ error = {{Target temp}} - {{Sensor temperatuur}}
      └─ adjusted_temp = {{Sensor temperatuur}} + {{error}}

      Adlar Heat Pump - Stuur binnentemperatuur
      └─ Temperatuur: {{adjusted_temp}}
```

**Hoe het werkt**:
- 's Nachts: Sensor meet 19°C, doel 18°C → Stuurt 18°C door → Warmtepomp verlaagt
- Overdag: Sensor meet 20°C, doel 21°C → Stuurt 20°C door → Warmtepomp verhoogt

---

### Voorbeeld 4: Weersafhankelijke regeling

**Doel**: Hogere setpoint bij koud weer, adaptive control aanpassen

**Flow: Weerscompensatie**
```
WHEN: Buienradar - Buitentemperatuur is veranderd
THEN:
  IF: Buitentemp < 0°C
      THEN: Target offset = +1.0°C
  IF: Buitentemp < -5°C
      THEN: Target offset = +2.0°C
  ELSE: Target offset = 0°C

  Stuur binnentemperatuur voor adaptieve regeling
  └─ Temperatuur: {{Sensor temp}} + {{Target offset}}
```

**Effect**: Bij vrieskou compenseert adaptive control automatisch met hogere setpoint

---

## Troubleshooting

### ❌ Probleem: "Cannot start adaptive control: no external indoor temperature configured"

**Oorzaak**: Er is nog geen temperatuurdata ontvangen
**Oplossing**:
1. Controleer of de temperatuur-flow correct is (zie [Stap 1](#stap-1-temperatuurdata-flow-aanmaken))
2. Trigger de flow handmatig om de eerste data te sturen
3. Check in device capabilities of "External Indoor Temperature" een waarde heeft
4. Probeer adaptive control opnieuw in te schakelen

---

### ❌ Probleem: Adaptive control doet geen aanpassingen

**Mogelijke oorzaken**:

**1. Temperatuur binnen deadband (0.3°C)**
- Check: Is de afwijking kleiner dan 0.3°C?
- Oplossing: Dit is normaal gedrag - binnen de deadband is geen actie nodig

**2. Throttling actief (20 minuten wachttijd)**
- Check: Bekijk logs voor bericht "Adjustment throttled (anti-oscillation)"
- Oplossing: Wacht tot de 20 minuten voorbij zijn - dit voorkomt oscillatie

**3. Temperatuurdata verouderd (>10 minuten)**
- Check: Bekijk timestamp van "External Indoor Temperature"
- Oplossing: Verhoog frequentie van temperatuur-flow naar minimaal elke 5 minuten

**4. Adaptive control is uitgeschakeld**
- Check: Device settings → "Enable adaptive temperature control"
- Oplossing: Schakel in en sla op

---

### ❌ Probleem: Temperatuur oscilleert (heen en weer)

**Symptoom**: Temperatuur schiet steeds voorbij het doel (bijv. 20.5°C → 21.5°C → 20.5°C)

**Mogelijke oorzaken**:

**1. Kp (Proportional Gain) te hoog**
- Gevolg: Te agressieve reactie op kleine afwijkingen
- Oplossing: Verlaag Kp van 3.0 naar 2.0 (expert mode)

**2. Ki (Integral Gain) te hoog**
- Gevolg: Over-correctie van historische afwijking
- Oplossing: Verlaag Ki van 1.5 naar 1.0 (expert mode)

**3. Deadband te klein**
- Gevolg: Te veel kleine correcties
- Oplossing: Verhoog deadband van 0.3°C naar 0.5°C (expert mode)

**4. Sensor te dicht bij warmtebron**
- Gevolg: Sensor meet lokale temperatuurpieken
- Oplossing: Verplaats sensor of gebruik gemiddelde van meerdere sensoren

**Aanbevolen aanpak**:
1. Start met Kp verlagen (grootste impact)
2. Monitor 24 uur
3. Pas Ki aan indien nodig
4. Als laatste: deadband verhogen

---

### ❌ Probleem: Temperatuur reageert te traag

**Symptoom**: Het duurt uren voordat de temperatuur het doel bereikt

**Mogelijke oorzaken**:

**1. Kp (Proportional Gain) te laag**
- Gevolg: Te voorzichtige reactie
- Oplossing: Verhoog Kp van 3.0 naar 4.0 of 5.0 (expert mode)

**2. Throttling te streng (20 minuten)**
- Gevolg: Systeem kan niet vaak genoeg bijsturen
- Oplossing: Dit is een vaste waarde - kan niet worden aangepast (veiligheid)

**3. Warmtepomp setpoint range te beperkt**
- Gevolg: Max aanpassing van 3°C is niet genoeg
- Oplossing: Check of de handmatige setpoint niet te ver van optimaal staat

**4. Gebouw heeft grote thermische massa**
- Gevolg: Opwarmen/afkoelen duurt lang
- Oplossing: Verhoog Ki voor betere lange-termijn correctie

---

### ❌ Probleem: "Adjustment throttled" verschijnt te vaak in logs

**Symptoom**: Elke 5 minuten zie je "Adjustment throttled" in de logs

**Oorzaak**: Dit is **normaal gedrag** - het systeem evalueert elke 5 minuten maar past max 1x per 20 minuten aan

**Wanneer probleem**:
- Als de temperatuur **niet** stabiel is (blijft afwijken)
- Als de afwijking groter is dan de deadband (>0.3°C)

**Oplossing**:
1. Check of de afwijking echt >0.3°C is (anders binnen deadband = normaal)
2. Controleer of de laatste **toegepaste** aanpassing effectief was (check oude logs)
3. Als na 20+ minuten nog steeds geen aanpassing: check PI parameters

**Voorbeeld normale situatie**:
```
15:00 - No action needed (within deadband) ← Afwijking 0.2°C
15:05 - No action needed (within deadband) ← Afwijking 0.1°C
15:10 - Adjustment throttled                ← Afwijking 0.4°C maar laatste aanpassing was 15:10-20min=14:50
15:15 - Adjustment throttled                ← Nog steeds binnen throttle window
15:20 - Adjustment throttled                ← Nog steeds binnen throttle window
15:25 - Applying adjustment +0.8°C          ← 20 min voorbij, nu wel aanpassing
```

---

### ❌ Probleem: Flow card "Target temperature adjusted" triggert niet

**Mogelijke oorzaken**:

**1. Adaptive control is uitgeschakeld**
- Check: Device settings
- Oplossing: Schakel in

**2. Temperatuur binnen deadband**
- Check: Afwijking is <0.3°C?
- Oplossing: Normaal gedrag - binnen deadband triggert niet

**3. Throttling actief**
- Check: Logs voor "Adjustment throttled"
- Oplossing: Wacht 20 minuten na laatste aanpassing

**4. Flow card niet correct geregistreerd**
- Check: Herstart Homey app
- Oplossing: Settings → Apps → Adlar Heat Pump → Restart

---

## Expert Mode

### Wanneer expert mode gebruiken?

Gebruik expert mode **alleen** als:
- ✅ Je begrijpt PI-controllers en regeltheorie
- ✅ Je meetbare problemen hebt met de standaardwaarden
- ✅ Je Homey Insights gebruikt om effecten te monitoren
- ✅ Je bereid bent om 24-48 uur te testen na elke aanpassing

**Gebruik expert mode NIET** als:
- ❌ "Gewoon om te kijken wat er gebeurt"
- ❌ Je geen probleem hebt met huidige prestaties
- ❌ Je de impact niet kunt meten

### PI-parameters begrijpen

#### Kp (Proportional Gain) - Directe reactie

**Wat doet het**: Bepaalt hoe hard het systeem reageert op de **huidige** afwijking

**Formule**: `P-term = Kp × error`

**Voorbeeld met Kp=3.0**:
- Error = -1.0°C (te koud) → P-term = 3.0 × -1.0 = **-3.0°C** aanpassing
- Error = -0.5°C (te koud) → P-term = 3.0 × -0.5 = **-1.5°C** aanpassing
- Error = -0.2°C (te koud) → P-term = 3.0 × -0.2 = **-0.6°C** aanpassing

**Tuning tips**:
- Te laag (bijv. 1.0): Traag, kan niet bijbenen bij grote afwijkingen
- Te hoog (bijv. 8.0): Agressief, overshoot, oscillatie
- **Sweet spot**: 2.5 - 4.0 voor de meeste installaties

---

#### Ki (Integral Gain) - Structurele correctie

**Wat doet het**: Corrigeert **langdurige afwijkingen** die de P-term niet oplost

**Formule**: `I-term = Ki × (gemiddelde error over laatste 2 uur)`

**Voorbeeld met Ki=1.5**:
- Gemiddelde error = -0.3°C (blijft structureel te koud) → I-term = 1.5 × -0.3 = **-0.45°C** extra
- Gemiddelde error = -0.1°C (bijna op temperatuur) → I-term = 1.5 × -0.1 = **-0.15°C** extra

**Waarom belangrijk**:
- Zonder I-term kan een structurele offset (bijv. slecht geïsoleerde ruimte) niet worden gecorrigeerd
- De P-term reageert alleen op de **huidige** error, niet op **persistente** error

**Tuning tips**:
- Te laag (bijv. 0.5): Structurele afwijking blijft bestaan
- Te hoog (bijv. 3.0): Overcompensatie, traag systeem oscilleert
- **Sweet spot**: 1.0 - 2.0 voor de meeste installaties

---

#### Deadband - Tolerantie zone

**Wat doet het**: Definieert de zone waarbinnen **geen actie** wordt ondernomen

**Voorbeeld met deadband=0.3°C en doel=21.0°C**:
- 20.6°C: Binnen deadband (21.0 - 0.3 = 20.7) → **Geen actie**
- 20.8°C: Binnen deadband → **Geen actie**
- 21.2°C: Binnen deadband (21.0 + 0.3 = 21.3) → **Geen actie**
- 21.4°C: **Buiten** deadband → **Actie ondernemen**

**Waarom belangrijk**:
- Voorkomt onnodige correcties bij kleine schommelingen
- Vermindert slijtage van de warmtepomp (minder start/stop cycli)
- Verhoogt energie-efficiëntie

**Tuning tips**:
- Te klein (bijv. 0.1°C): Veel onnodige aanpassingen, onrustig systeem
- Te groot (bijv. 1.0°C): Te veel temperatuurschommelingen
- **Sweet spot**: 0.2 - 0.4°C voor comfort, 0.4 - 0.6°C voor efficiëntie

---

#### Smart Accumulator - Van fractional naar integer

**Probleem**: PI-controller berekent fractional adjustments (bijv. -0.7°C), maar warmtepomp accepteert alleen hele graden (step:1).

**Oplossing**: Smart Accumulator verzamelt fractional berekeningen totdat ≥0.5°C voor integer toepassing.

**Voorbeeld scenario**:

| Cyclus | Error | Kp×error | Ki×avg | PI Calc | Accumulated | Integer | Apply? | Setpoint | Remainder |
|--------|-------|----------|--------|---------|-------------|---------|--------|----------|-----------|
| 1 | -0.2°C | -0.6 | 0.0 | **-0.6** | -0.6 | -1 | ✅ | 45→44 | **+0.4** |
| 2 | -0.1°C | -0.3 | -0.1 | **-0.4** | 0.0 | 0 | ❌ Wacht | 44 | **0.0** |
| 3 | 0.0°C | 0.0 | -0.1 | **-0.1** | -0.1 | 0 | ❌ Wacht | 44 | **-0.1** |
| 4 | +0.2°C | +0.6 | 0.0 | **+0.6** | +0.5 | +1 | ✅ | 44→45 | **-0.5** |

**Voordelen**:

- ✅ **PI-precisie behouden**: Geen verlies van kleine correcties over tijd
- ✅ **Warmtepomp compatibel**: Alleen integer adjustments (step:1)
- ✅ **Transparant**: Logs tonen zowel PI-berekening als toegepaste waarde
- ✅ **Persistent**: Accumulator survives app restarts (opgeslagen in device store)

**Loggen**:

```
[15:00] PI adjustment calculated: -0.60°C, accumulated: -0.60°C
[15:00] Applying integer adjustment: -1°C (accumulated: -0.60°C → remainder: +0.40°C)
[15:05] PI adjustment calculated: -0.40°C, accumulated: 0.00°C
[15:05] Accumulating adjustment (waiting for ≥0.5°C): 0.00°C
```

---

### Tuning strategie (stap-voor-stap)

#### Fase 1: Baseline meten (week 1)

1. Gebruik standaardwaarden (Kp=3.0, Ki=1.5, deadband=0.3°C)
2. Laat systeem 7 dagen draaien zonder aanpassingen
3. Monitor via Homey Insights:
   - External Indoor Temperature (doelwaarde vs werkelijk)
   - Target Temperature Adjusted events (frequentie)
   - COP/efficiency (heeft tuning neveneffecten?)

4. Noteer problemen:
   - Oscillatie? (heen en weer)
   - Te traag? (bereikt doel niet binnen 2 uur)
   - Te agressief? (overshoot)

#### Fase 2: Kp aanpassen (week 2)

**Als oscillatie/overshoot**:
- Verlaag Kp met 20% (bijv. 3.0 → 2.4)
- Test 3 dagen
- Herhaal indien nodig (tot minimaal 1.5)

**Als te traag**:
- Verhoog Kp met 30% (bijv. 3.0 → 3.9)
- Test 3 dagen
- Herhaal indien nodig (tot maximaal 6.0)

#### Fase 3: Ki aanpassen (week 3)

**Alleen aanpassen als**:
- Kp is gestabiliseerd EN
- Er is een structurele afwijking (gemiddeld >0.2°C over 24 uur)

**Als structureel te koud/warm**:
- Verhoog Ki met 20% (bijv. 1.5 → 1.8)
- Test 5 dagen (I-term heeft tijd nodig)

**Als trage oscillatie (periode >6 uur)**:
- Verlaag Ki met 30% (bijv. 1.5 → 1.05)
- Test 5 dagen

#### Fase 4: Deadband finetunen (week 4)

**Als te veel kleine aanpassingen** (<0.5°C):
- Verhoog deadband met 0.1°C (bijv. 0.3 → 0.4)

**Als te grote schommelingen**:
- Verlaag deadband met 0.1°C (bijv. 0.3 → 0.2)

---

### Geavanceerde troubleshooting

#### Probleem: "Hunting behavior" (jacht gedrag)

**Symptoom**: Temperatuur oscilleert met periode van 1-3 uur

**Diagnose**:
```
19:00 → 20.5°C (te koud)  → +2.0°C aanpassing
20:00 → 21.5°C (te warm)  → -1.5°C aanpassing
21:00 → 20.7°C (te koud)  → +1.0°C aanpassing
22:00 → 21.3°C (te warm)  → -0.8°C aanpassing
... blijft oscilleren
```

**Oplossing**:
1. Verlaag Kp met 30% (te agressieve P-term)
2. Verhoog deadband naar 0.4-0.5°C (geef meer ruimte)
3. Check Ki - mogelijk ook te hoog (verlaag met 20%)

---

#### Probleem: "Integral windup"

**Symptoom**: Na een lange periode van afwijking maakt het systeem een enorme overcorrectie

**Diagnose**:
```
10:00-18:00 → Consistent 20.2°C (doel: 21.0°C, error: -0.8°C)
             → I-term accumuleert: -0.8 × 8 uur = grote negatieve waarde
18:00       → Enorme aanpassing van +5°C
19:00       → Nu 22.5°C (te warm door overcompensatie)
```

**Oplossing**:
1. Verlaag Ki met 40% (te agressieve integratie)
2. Check of er externe factoren zijn (bijv. zon op sensor, raam open)
3. Overweeg history reset: Schakel adaptive control uit/aan om I-term te resetten

---

#### Probleem: Systeem reageert verschillend overdag vs 's nachts

**Symptoom**: Overdag stabiel, 's nachts oscillatie (of andersom)

**Mogelijke oorzaken**:
1. **Thermische massa verschil**: Overdag zonwarmte, 's nachts alleen verwarming
2. **Luchtstroom**: Overdag ramen open, 's nachts dicht
3. **Sensor locatie**: Sensor beïnvloed door zon/draft

**Oplossing**:
- Gebruik **twee sets parameters** via geavanceerde flow:
  ```
  WHEN: Time is 22:00 (nachtmodus)
  THEN: Set Kp = 2.0, Ki = 1.0, deadband = 0.4

  WHEN: Time is 07:00 (dagmodus)
  THEN: Set Kp = 3.5, Ki = 1.5, deadband = 0.3
  ```
- Of: Gebruik gemiddelde van meerdere sensoren
- Of: Verplaats sensor naar stabielere locatie

---

## Veelgestelde vragen (FAQ)

### Algemeen

**Q: Moet ik adaptive control 24/7 aan laten staan?**
A: Ja, voor beste resultaten. Het systeem leert van de geschiedenis en presteert beter naarmate het langer draait. Je kunt het uitzetten voor onderhoud, maar schakel daarna weer in.

**Q: Kan ik adaptive control combineren met weerscompensatie?**
A: Ja! Zie [Voorbeeld 4](#voorbeeld-4-weersafhankelijke-regeling). Je past de doorgestuurde binnentemperatuur aan op basis van buitentemperatuur.

**Q: Werkt het met vloerverwarming?**
A: Ja, maar verwacht langzamere respons (6-12 uur stabilisatie) door grote thermische massa. Overweeg hogere Ki en lagere Kp.

**Q: Werkt het met radiatoren?**
A: Ja, snellere respons (1-3 uur stabilisatie). Standaardwaarden zijn geoptimaliseerd voor radiatoren.

**Q: Kan ik meerdere zones regelen?**
A: Eén adaptive control per warmtepomp. Voor meerdere zones: gebruik gemiddelde van sensoren of aparte warmtepompen.

---

### Technisch

**Q: Wat gebeurt er bij een Homey herstart?**
A: Adaptive control herstart automatisch met opgeslagen historie (PI error history blijft bewaard). Eerste controle binnen 5 minuten na opstart.

**Q: Wat als de temperatuursensor uitvalt?**
A: Na 10 minuten zonder data pauzeert adaptive control automatisch. De warmtepomp keert terug naar handmatige setpoint. Bij herstel hervat het systeem.

**Q: Hoeveel data wordt opgeslagen?**
A: Laatste 24 datapunten (2 uur geschiedenis bij 5-minuten interval). Ongeveer 1KB per device.

**Q: Kan ik de 20-minuten throttling aanpassen?**
A: Nee, dit is een vaste veiligheidswaarde om oscillatie te voorkomen. Expert gebruikers kunnen eventueel de code aanpassen (niet aanbevolen).

---

### Privacy & Veiligheid

**Q: Wordt mijn temperatuurdata naar de cloud gestuurd?**
A: Nee, alle berekeningen gebeuren lokaal op Homey. Geen data verlaat je netwerk (tenzij je zelf flows maakt die loggen naar cloud services).

**Q: Wat is de minimale/maximale setpoint?**
A: Absolute grenzen: 15°C - 28°C. Max aanpassing per keer: ±3°C. Deze zijn hardcoded voor veiligheid.

**Q: Kan adaptive control mijn warmtepomp beschadigen?**
A: Nee, de 20-minuten throttling voorkomt overmatige start/stop cycli. Het systeem is conservatiever dan handmatige bediening.

---

## Changelog

### v1.4.0 (2024-12-18)
- ✨ Eerste release van Adaptive Temperature Control (Fase 1 MVP)
- ✅ PI-controller met persistence
- ✅ Flow cards: receive_external_indoor_temperature, target_temperature_adjusted, adaptive_status_change
- ✅ Simple mode (enable/disable) en Expert mode (PI parameters)
- ✅ Anti-oscillatie throttling (20 minuten minimum tussen aanpassingen)
- ✅ Data health monitoring (10 minuten max age)
- ✅ Safety limits (±3°C, 15-28°C range, 0.3°C deadband)

---

**© 2024 Adlar Heat Pump App - Adaptive Temperature Control**
**Versie**: 1.4.0
**Laatst bijgewerkt**: 18 december 2024
