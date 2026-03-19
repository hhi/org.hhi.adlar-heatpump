# Adaptive Temperature Control
## Benutzerhandbuch v2.7.x

Intelligente Temperaturregelung für eine **konstante Raumtemperatur** mit optimaler Effizienz.

---

## Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Wie funktioniert es?](#wie-funktioniert-es)
3. [Erste Schritte](#erste-schritte)
4. [Flow Cards](#flow-cards)
5. [Einstellungen](#einstellungen)
6. [Praktische Beispiele](#praktische-beispiele)
7. [Troubleshooting](#troubleshooting)
8. [Expert Mode](#expert-mode)
9. [FAQ](#faq)

---

## Übersicht

**Adaptive Control** passt automatisch die Zieltemperatur Ihrer Wärmepumpe an, um eine **konstante Raumtemperatur** aufrechtzuerhalten. Das System arbeitet zusammen mit Ihrem Raumthermostat oder Temperatursensor.

### Vorteile

| Vorteil | Beschreibung |
|---------|--------------|
| 🎯 **Konstante Temperatur** | Bleibt innerhalb von ±0,3°C Ihrer gewünschten Temperatur |
| ⚡ **Höhere Effizienz** | PI-Algorithmus verhindert On/Off-Zyklen |
| 🔄 **Automatische Anpassung** | Reagiert auf sich ändernde Bedingungen |
| 💰 **Energieeinsparung** | Bis zu 25% Effizienzverbesserung möglich |

### Wann verwenden?

- ✅ Sie haben einen Thermostat oder Temperatursensor im Wohnzimmer
- ✅ Sie möchten eine **exakte** Raumtemperatur (z.B. konstant 21,0°C)
- ✅ Ihre Wärmepumpe hat häufig Temperaturschwankungen
- ✅ Sie möchten die Effizienz optimieren

---

## Wie funktioniert es?

Adaptive Control verwendet ein **PI-Regelsystem** (Proportional-Integral Controller) — die gleiche Technologie, die in professionellen industriellen Systemen verwendet wird.

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1️⃣ MESSEN                                                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Sensor sendet Temperatur (z.B. 20,5°C)                        │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2️⃣ VERGLEICHEN                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Soll: 21,0°C   Ist: 20,5°C   Abweichung: -0,5°C              │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3️⃣ PI-ALGORITHMUS                                                   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ P-Term: 3,0 × -0,5 = -1,5°C                                   │  │
│  │ I-Term: Korrektur historisch                                  │  │
│  │ Gesamt: -1,5°C                                                │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4️⃣ ANPASSEN                                                         │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Sollwert: 45°C → 43°C                                         │  │
│  │ Max 1x pro 20 Min │ Max ±3°C pro Mal                          │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │
                                   └──────────── Nächster Zyklus ─┐
                                                                  │
                                   ┌──────────────────────────────┘
                                   ▼
                            (Zurück zu MESSEN)
```

### Merkmale

| Merkmal | Wert | Beschreibung |
|---------|------|--------------|
| ⏱️ Kontroll-Intervall | 5 Min | Bewertungsfrequenz |
| 🔒 Anti-Oszillation | 20 Min | Minimum zwischen Anpassungen |
| 🎯 Deadband | ±0,3°C | Toleranzzone (keine Aktion) |
| 🛡️ Sicherheitsgrenzen | ±3°C / 15-28°C | Max. Anpassung und absoluter Bereich |
| 🔢 Smart Accumulator | Fractional → Integer | Sammelt kleine Korrekturen |

### Warum ganze Grade?

Der Wärmepumpen-Sollwert verwendet **Schritte von 1°C**. Der PI-Regler berechnet jedoch fraktionale Anpassungen (z.B. +0,7°C).

**Lösung**: Der **Smart Accumulator** sammelt fraktionale Berechnungen:

```
Zyklus 1: PI = +0,3°C → Accumulator: 0,3 → Warten
Zyklus 2: PI = +0,4°C → Accumulator: 0,7 → Anwenden +1°C, Rest: -0,3
Zyklus 3: PI = +0,2°C → Accumulator: -0,1 → Warten
```

### 5-Säulen Weighted Decision System (v2.6.0+)

Adaptive Control kombiniert **5 intelligente Komponenten** in jeder Entscheidung:

| Komponente | Gewicht | Funktion |
|------------|---------|----------|
| 🛋️ **Komfort** | 50% | PI-Regelung für stabile Raumtemperatur |
| ⚡ **Effizienz** | 15% | COP-Optimierung über Vorlauftemperatur |
| 💰 **Kosten** | 15% | Preisoptimierung (Vorheizen bei günstigem Strom) |
| 🏠 **Thermisch** | 20% | Prädiktive Regelung über gelerntes Gebäudemodell |
| ❄️ **Coast** | 80% (wenn aktiv) | Passive Kühlung — verhindert Heizen über Sollwert |

**Beispielberechnung (normal):**

```
Komfort will: +2,0°C (zu kalt)
Effizienz will: -0,5°C (niedrigere Vorlauftemp für besseren COP)
Kosten will: +1,0°C (günstiger Strom, vorheizen)
Thermisch will: +0,5°C (Gebäude kühlt schnell ab, vorausschauend heizen)

Gewichtetes Gesamt: (2,0×50% + -0,5×15% + 1,0×15% + 0,5×20%) = 1,15°C
```

**Beispielberechnung (Coast-Modus aktiv):**

```
Coast will: -4,0°C (Auslasstemperatur - Offset) ← dominant 80%
Komfort will: -1,0°C (PI erkennt Überschwingung)
Übrige Komponenten: skaliert mit 0,20

Ergebnis: -3,31°C → Kompressor stoppt ✅
```

**Ergebnis**: Wärmepumpen-Sollwert steigt um +1°C (gerundet), oder sinkt deutlich bei Coast.

> [!NOTE]
> Die Gewichte sind **konfigurierbar** über Geräteeinstellungen (Expert Mode). Standardwerte sind für die meisten Situationen optimiert.

---

## Erste Schritte

### Voraussetzungen

- **Homey Pro** mit Adlar Heat Pump App v2.7.0+
- **Funktionierende Wärmepumpe** mit stabiler Verbindung
- **Temperatursensor** (Tado, Nest, Netatmo, Fibaro, Xiaomi, etc.)

**Optional für erweiterte Optimierung (v2.7.0+):**

- ☁️ Windgeschwindigkeitssensor (für Gebäudemodell-Windkorrektur)
- ☀️ Sonnenstrahlungssensor (für Solargewinn-Optimierung)
- 💰 Dynamischer Energievertrag (für Preisoptimierung)

### Schritt 1: Temperaturdaten-Flow

Erstellen Sie einen Flow, der die Raumtemperatur sendet:

**Tado Thermostat:**
```
WHEN: Tado → Temperatur hat sich geändert
THEN: Adlar Heat Pump → Raumtemperatur senden
      └─ Temperatur: {{Tado Temperatur}}
```

**Fibaro Sensor:**
```
WHEN: Fibaro Motion Sensor → Temperatur hat sich geändert
THEN: Adlar Heat Pump → Raumtemperatur senden
      └─ Temperatur: {{Fibaro Temperatur}}
```

**Mehrere Sensoren (Durchschnitt):**
```
WHEN: Timer alle 5 Minuten
THEN: Adlar Heat Pump → Raumtemperatur senden
      └─ Temperatur: {{(Sensor1 + Sensor2 + Sensor3) / 3}}
```

> [!TIP]
> Senden Sie die Temperatur mindestens alle 10 Minuten. Daten älter als 10 Minuten werden als veraltet betrachtet.

### Schritt 2: Aktivieren

1. Öffnen Sie **Adlar Heat Pump** → **Einstellungen** ⚙️
2. Scrollen Sie zu **Adaptive Temperature Control**
3. Aktivieren Sie: **Enable adaptive temperature control** ✅
4. Klicken Sie **Speichern**

### Schritt 3: Überprüfen

Überprüfen Sie die folgenden Punkte:

- ✅ **External Indoor Temperature** Capability zeigt aktuellen Wert
- ✅ Test-Flow: "Adaptive Regelung empfiehlt Temperaturanpassung" triggert
- ✅ Insights: Diagramm zeigt kontinuierliche Temperaturdaten

---

## Flow Cards

### Action: Raumtemperatur senden

**ID:** `receive_external_indoor_temperature`

| Parameter | Typ | Bereich | Beispiel |
|-----------|-----|---------|----------|
| Temperatur | Number | -10 bis +50°C | `{{Tado Temperatur}}` |

---

### Trigger: Temperaturanpassung empfohlen

**ID:** `temperature_adjustment_recommended`

Triggert wenn Adaptive Control eine Sollwertänderung berechnet.

| Token | Typ | Beschreibung |
|-------|-----|--------------|
| `current_temperature` | Number | Aktueller Sollwert (°C) |
| `recommended_temperature` | Number | Empfohlener Sollwert (°C) |
| `adjustment` | Number | Berechnete Anpassung |
| `reason` | String | Erklärung der Berechnung |
| `controller` | String | Controller-Typ |
| `control_mode` | String | `heating` oder `cooldown` (v2.8.0+) |
| `coast_component` | Number | Coast-Beitrag zur Empfehlung (v2.8.0+) |

> [!NOTE]
> `adjustment` ist die berechnete Empfehlung und kann fraktional sein. Die tatsächliche Anpassung ist immer eine ganze Zahl.

**Beispiel:**
```
WHEN: Adaptive Regelung empfiehlt Temperaturanpassung
AND: {{recommended_temperature}} - {{current_temperature}} > 2
THEN: Benachrichtigung senden
      └─ "Empfohlen: {{recommended_temperature}}°C - {{reason}}"
```

---

### Trigger: Simulierte Temperatur angepasst

**ID:** `adaptive_simulation_update`

Triggert für Monitoring/Logging ohne echte Anpassungen.

| Token | Typ | Beschreibung |
|-------|-----|--------------|
| `simulated_target` | Number | Simulierte Zieltemperatur |
| `actual_target` | Number | Tatsächlicher Sollwert |
| `delta` | Number | Unterschied |
| `comfort_component` | Number | Komfort-Beitrag (°C) |
| `efficiency_component` | Number | Effizienz-Beitrag (°C) |
| `cost_component` | Number | Kosten-Beitrag (°C) |
| `thermal_component` | Number | Thermisches Modell-Beitrag (°C) (v2.6.0+) |
| `coast_component` | Number | Coast-Beitrag (°C) (v2.8.0+) |
| `reasoning` | String | Begründung |

---

### Trigger: Adaptive Status-Änderung

**ID:** `adaptive_status_change`

| Token | Typ | Beschreibung |
|-------|-----|--------------|
| `status` | String | `enabled` oder `disabled` |
| `reason` | String | Grund für Änderung |

**Beispiel:**
```
WHEN: Adaptive Status-Änderung
AND: Status ist 'enabled'
THEN: Benachrichtigung senden "✅ Adaptive Control aktiviert"
```

---

## Einstellungen

### Basis-Einstellungen

| Einstellung | Standard | Beschreibung |
|-------------|----------|--------------|
| Enable adaptive temperature control | Aus | Hauptschalter |

### Expert-Einstellungen

> [!IMPORTANT]
> Expert-Einstellungen sind nur sichtbar mit **Expert HVAC Funktionskarten** aktiviert.

| Einstellung | Standard | Bereich | Beschreibung |
|-------------|----------|---------|--------------|
| **Kp** (Proportional Gain) | 3,0 | 0,5 - 10,0 | Direkte Reaktion auf Abweichung |
| **Ki** (Integral Gain) | 1,5 | 0,1 - 5,0 | Korrektur langfristiger Abweichung |
| **Deadband** | 0,3°C | 0,1 - 1,0°C | Toleranzzone |

**Tuning-Tipps:**

| Problem | Lösung |
|---------|--------|
| Oszillation/Überschwingen | Verringern Sie Kp (z.B. 3,0 → 2,0) |
| Zu langsame Reaktion | Erhöhen Sie Kp (z.B. 3,0 → 4,0) |
| Strukturelle Abweichung | Erhöhen Sie Ki (z.B. 1,5 → 2,0) |
| Zu viele kleine Korrekturen | Erhöhen Sie Deadband (z.B. 0,3 → 0,5) |

### Coast-Einstellungen (v2.8.0+)

| Einstellung | Standard | Bereich | Beschreibung |
|-------------|----------|---------|--------------|
| **Coast Offset** | 1,0°C | 0,5 - 5,0°C | Grad unter Auslasstemperatur für Coast-Ziel |
| **Coast Hysterese** | 0,3°C | 0,1 - 1,0°C | Überschwingspanne über Sollwert für Aktivierung |
| **Coast Stärke** | 0,80 | 0,60 - 0,95 | Gewichtsanteil in der gewichteten Entscheidung |

---

## Praktische Beispiele

### Basis-Setup (Tado)

**Ziel:** Konstant 21°C mit Tado Thermostat

```
# Flow 1: Temperaturdaten
WHEN: Tado Wohnzimmer → Temperatur hat sich geändert
THEN: Adlar Heat Pump → Raumtemperatur senden
      └─ Temperatur: {{Tado Temperatur}}

# Flow 2: Monitoring
WHEN: Adaptive Regelung empfiehlt Temperaturanpassung
THEN: Log "Empfohlen: {{recommended_temperature}}°C ({{reason}})"
```

**Erwartetes Verhalten:**
- 20,5°C gemessen → Wärmepumpen-Sollwert steigt
- 21,3°C gemessen → Wärmepumpen-Sollwert sinkt
- Innerhalb 1-2 Stunden: stabil bei 21,0°C ±0,3°C

---

### Mehrere Räume (Durchschnitt)

```
WHEN: Timer alle 5 Minuten
THEN:
  avg_temp = ({{Wohnzimmer}} + {{Küche}} + {{Flur}}) / 3
  Raumtemperatur senden → {{avg_temp}}
```

**Vorteil:** Verhindert Überreaktion auf lokale Schwankungen (z.B. Sonne auf 1 Sensor)

---

### Nacht/Tag-Modus

**Ziel:** 21°C tagsüber, 18°C nachts

```
WHEN: Zeit ist 23:00
THEN: Logik-Variable 'Target' = 18,0

WHEN: Zeit ist 07:00
THEN: Logik-Variable 'Target' = 21,0

WHEN: Sensor → Temperatur hat sich geändert
THEN: error = {{Target}} - {{Sensor}}
      adjusted = {{Sensor}} + {{error}}
      Raumtemperatur senden → {{adjusted}}
```

---

### Wetterkompensation

```
WHEN: Buienradar → Außentemperatur hat sich geändert
THEN:
  IF: Außentemp < 0°C  → offset = +1,0°C
  IF: Außentemp < -5°C → offset = +2,0°C
  ELSE: offset = 0°C

  Raumtemperatur senden → {{Sensor}} + {{offset}}
```

---

## Troubleshooting

### ❌ "No external indoor temperature configured"

**Ursache:** Keine Temperaturdaten empfangen

**Lösung:**
1. Überprüfen Sie, ob Temperatur-Flow korrekt ist
2. Triggern Sie Flow manuell für erste Daten
3. Prüfen Sie "External Indoor Temperature" Capability

---

### ❌ Keine Anpassungen

| Ursache | Prüfen | Lösung |
|---------|--------|--------|
| Innerhalb Deadband | Abweichung < 0,3°C? | Normales Verhalten |
| Throttling aktiv | Logs: "Adjustment throttled" | Warten Sie 20 Min |
| Daten veraltet | Zeitstempel > 10 Min? | Erhöhen Sie Flow-Frequenz |
| Deaktiviert | Geräteeinstellungen | Aktivieren |

---

### ❌ Temperatur oszilliert

**Symptom:** Temperatur schießt ständig über Ziel hinaus

**Mögliche Ursachen & Lösungen:**

| Ursache | Lösung |
|---------|--------|
| Kp zu hoch | Verringern auf 2,0 |
| Ki zu hoch | Verringern auf 1,0 |
| Deadband zu klein | Erhöhen auf 0,5°C |
| Sensor nahe Wärmequelle | Sensor umplatzieren oder Durchschnitt verwenden |

**Vorgehen:**
1. Beginnen Sie mit Kp-Verringerung (größte Auswirkung)
2. Überwachen Sie 24 Stunden
3. Passen Sie Ki bei Bedarf an

---

### ❌ Langsame Reaktion

**Symptom:** Dauert Stunden um Ziel zu erreichen

| Ursache | Lösung |
|---------|--------|
| Kp zu niedrig | Erhöhen auf 4,0 oder 5,0 |
| Große thermische Masse | Erhöhen Sie Ki für bessere Langzeitkorrektur |
| Sollwertbereich begrenzt | Prüfen Sie manuellen Sollwert |

---

### ❄️ Wärmepumpe heizt bei hoher Raumtemperatur (v2.8.0+)

**Symptom:** Raum ist wärmer als Sollwert, aber Wärmepumpe läuft weiter

| Ursache | Lösung |
|---------|--------|
| Coast noch nicht aktiv | Mindestens 10 Min warten (2 Zyklen) |
| Hysterese zu hoch | Coast-Hysterese verringern (z.B. 0,3 → 0,2°C) |
| Trend fallend | Coast aktiviert nicht bei fallender Temp — normales Verhalten |

---

### ❄️ Oszillation nach Abkühlphase

**Symptom:** Nach Verlassen des Coast-Modus schießt Temperatur über

| Ursache | Lösung |
|---------|--------|
| I-Term nicht zurückgesetzt | Adaptive Control neu starten |
| Kp zu hoch nach Coast | Kp auf 2,0-2,5 verringern |

---

## Expert Mode

> [!CAUTION]
> Passen Sie Expert-Einstellungen nur an, wenn Sie messbare Probleme haben und 24-48 Stunden testen können.

### PI-Parameter

#### Kp — Proportional Gain

Bestimmt direkte Reaktion auf aktuelle Abweichung.

**Formel:** `P-Term = Kp × error`

| Kp | Error -0,5°C | Effekt |
|----|--------------|--------|
| 2,0 | -1,0°C | Vorsichtig |
| 3,0 | -1,5°C | **Standard** |
| 5,0 | -2,5°C | Aggressiv |

**Sweet Spot:** 2,5 - 4,0

---

#### Ki — Integral Gain

Korrigiert langfristige Abweichungen, die P-Term nicht löst.

**Formel:** `I-Term = Ki × (durchschnittlicher Error letzte 2 Std.)`

**Sweet Spot:** 1,0 - 2,0

---

#### Deadband

Zone, in der keine Aktion unternommen wird.

**Beispiel** (Ziel 21,0°C, Deadband 0,3°C):
- 20,8°C: Innerhalb Zone → Keine Aktion ✅
- 21,2°C: Innerhalb Zone → Keine Aktion ✅
- 21,4°C: Außerhalb Zone → Aktion ⚡

**Sweet Spot:**
- **Komfort:** 0,2 - 0,4°C
- **Effizienz:** 0,4 - 0,6°C

---

### Tuning-Strategie

#### Phase 1: Baseline (Woche 1)
- Verwenden Sie Standardwerte
- Überwachen Sie 7 Tage über Homey Insights
- Notieren Sie: Oszillation? Zu langsam? Überschwingen?

#### Phase 2: Kp anpassen (Woche 2)
- **Oszillation:** Verringern um 20% (3,0 → 2,4)
- **Zu langsam:** Erhöhen um 30% (3,0 → 3,9)
- Testen Sie 3 Tage

#### Phase 3: Ki anpassen (Woche 3)
- **Strukturell zu kalt/warm:** Erhöhen um 20%
- **Langsame Oszillation:** Verringern um 30%
- Testen Sie 5 Tage

#### Phase 4: Deadband (Woche 4)
- **Zu viele kleine Anpassungen:** +0,1°C
- **Zu große Schwankungen:** -0,1°C

---

### Fortgeschrittene Probleme

#### "Hunting Behavior"

**Symptom:** Oszillation mit Periode 1-3 Stunden

```
19:00 → 20,5°C → +2,0°C Anpassung
20:00 → 21,5°C → -1,5°C Anpassung
21:00 → 20,7°C → +1,0°C Anpassung
...
```

**Lösung:**
1. Verringern Sie Kp um 30%
2. Erhöhen Sie Deadband auf 0,4-0,5°C
3. Verringern Sie Ki um 20%

---

#### "Integral Windup"

**Symptom:** Große Überkorrektur nach langfristiger Abweichung

**Lösung:**
1. Verringern Sie Ki um 40%
2. Prüfen Sie externe Faktoren (Sonne, offenes Fenster)
3. Setzen Sie I-Term zurück: Adaptive Control aus/an

---

## FAQ

### Allgemein

**Muss ich Adaptive Control 24/7 an lassen?**
> Ja, das System lernt aus der Geschichte und funktioniert besser, je länger es läuft.

**Funktioniert es mit Fußbodenheizung?**
> Ja, aber erwarten Sie langsamere Reaktion (6-12 Std.). Verwenden Sie höheres Ki, niedrigeres Kp.

**Funktioniert es mit Heizkörpern?**
> Ja, schnellere Reaktion (1-3 Std.). Standardwerte sind hierfür optimiert.

**Kann ich mehrere Zonen regeln?**
> Eine Adaptive Control pro Wärmepumpe. Für mehrere Zonen: Verwenden Sie Durchschnitt der Sensoren.

---

### Technisch

**Was passiert bei Homey-Neustart?**
> Adaptive Control startet automatisch mit gespeicherter Historie. Erste Kontrolle innerhalb 5 Minuten.

**Was wenn Temperatursensor ausfällt?**
> Nach 10 Minuten pausiert Adaptive Control. Wärmepumpe kehrt zu manuellem Sollwert zurück.

**Kann ich das 20-Minuten-Throttling anpassen?**
> Nein, dies ist ein fester Sicherheitswert.

---

### Datenschutz & Sicherheit

**Werden Daten in die Cloud gesendet?**
> Nein, alle Berechnungen erfolgen lokal auf Homey.

**Was sind die Sicherheitsgrenzen?**
> Absoluter Bereich: 15-28°C. Max. pro Anpassung: ±3°C. Hardcodiert für Sicherheit.

**Kann Adaptive Control die Wärmepumpe beschädigen?**
> Nein, 20-Minuten-Throttling verhindert übermäßige Start/Stopp-Zyklen.

---
