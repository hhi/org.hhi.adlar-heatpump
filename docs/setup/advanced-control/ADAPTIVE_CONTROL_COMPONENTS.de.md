# Adlar Wärmepumpe — Adaptives Regelsystem

**Version:** 2.8.x | **Datum:** März 2026

---

## Überblick

Dieses System steuert Ihre Adlar Castra Wärmepumpe intelligent für:

- **Konstante Innentemperatur** (±0.3°C)
- **Passiver Kühlmodus** (Coast) — verhindert unnötiges Heizen
- **Energieoptimierung** über dynamische Preise
- **COP-Maximierung** für maximale Effizienz
- **Automatisches Lernen** wie Ihr Haus reagiert

### Geschätzte Einsparungen

| Komponente | Einsparungen/Jahr |
|------------|-------------------|
| Energiepreis-Optimierung | 400-600€ |
| COP-Optimierung | 200-300€ |
| **Gesamt** | **600-900€** |

---

## Architektur

```
┌─────────────────────────────────────────────────────────────────────┐
│                           HOMEY PRO                                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │          Adlar Heat Pump Device - Main Controller             │  │
│  └─────────────────────────────┬─────────────────────────────────┘  │
│                                │                                    │
│        ┌───────────┬───────────┼───────────┬───────────┬───────────┐  │
│        │           │           │           │           │           │  │
│        ▼           ▼           ▼           ▼           ▼           │  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│  │  Comfort  │ │ Building  │ │  Energy   │ │    COP    │ │ Thermisch │ │
│  │  Control  │ │  Learner  │ │ Optimizer │ │ Optimizer │ │   Model   │ │
│  │    50%    │ │   Info    │ │    15%    │ │    15%    │ │    20%    │ │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ │
│        │             │             │             │                  │
└────────┼─────────────┼─────────────┼─────────────┼──────────────────┘
         │             │             │             │
         ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         WÄRMEPUMPE                                  │
│  ┌───────────────────┐  ┌───────────────────────────────────────┐   │
│  │ DPS 4:            │  │ DPS 21/22: Vorlauf/Rücklauf           │   │
│  │ Zieltemperatur    │  │ DPS 26: Außentemperatur               │   │
│  └───────────────────┘  └───────────────────────────────────────┘   │
│  ┌───────────────────┐                                              │
│  │ DPS 13:           │                                              │
│  │ Heizkurve = AUS   │                                              │
│  └───────────────────┘                                              │
└─────────────────────────────────────────────────────────────────────┘
         ▲
         │
┌─────────────────────────────────────────────────────────────────────┐
│                       EXTERNE DATEN                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │
│  │Innentemperatur│  │ Energiepreise │  │  Wetter-API   │            │
│  └───────────────┘  └───────────────┘  └───────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

### Regelkreis (alle 5 Min)

1. **Daten sammeln** — Innen-/Außentemp, Leistung, Preise
2. **Abkühlerkennung** — Tist > Tsoll + Hysterese? → Coast-Modus
3. **Regler berechnen** — Jede Komponente gibt Empfehlung
4. **Gewichtete Entscheidung** — 50% Komfort + 15% Effizienz + 15% Kosten + 20% Thermisch (+ 80% Coast wenn aktiv)
5. **Ausführen** — Zieltemperatur aktualisieren (DPS 4)

---

## Komponente 1: Heizungsregler

### PI-Regler

Der **PI (Proportional-Integral) Regler** kombiniert:

| Komponente | Funktion | Formel |
|------------|----------|--------|
| **P** (Proportional) | Aktuelle Abweichung korrigieren | `Kp × Fehler` |
| **I** (Integral) | Strukturelle Abweichung beseitigen | `Ki × mittlerer_Fehler` |

**Gesamtkorrektur:** `(Kp × aktueller_Fehler) + (Ki × mittlerer_Fehler)`

### Parameter

| Parameter | Standard | Bereich | Effekt |
|-----------|----------|---------|--------|
| Kp | 3.0 | 1.0-5.0 | Reaktionsgeschwindigkeit |
| Ki | 1.5 | 0.5-3.0 | Langzeitkorrektur |
| Totzone | 0.3°C | 0.1-1.0°C | Toleranzzone |
| Min. Wartezeit | 20 Min | 10-60 Min | Anti-Oszillation |

### Abstimmungsprofile

| Profil | Kp | Ki | Totzone | Anwendungsfall |
|--------|----|----|---------|----------------|
| Aggressiv | 4.0-5.0 | 2.0-3.0 | 0.2°C | Schlecht gedämmt |
| **Ausgewogen** | 3.0 | 1.5 | 0.3°C | **Empfohlen** |
| Konservativ | 2.0 | 1.0 | 0.5°C | Gute Dämmung |

---

## Komponente 5: Coast-Strategie (Passiver Kühlmodus)

> Neu in v2.8.0 — [ADR-024](../../../plans/decisions/ADR-024-adaptive-cooldown-mode.md)

### Was macht es?

Wenn die Raumtemperatur **über dem Sollwert** liegt (z.B. durch Solargewinne), erkennt das System dies und **verhindert unnötiges Heizen**. Die Wärmepumpe bleibt aus, während der Raum passiv auf das gewünschte Niveau abkühlt.

### Wie funktioniert es?

| Schritt | Beschreibung |
|---------|--------------|
| 1️⃣ **Erkennung** | Tist > Tsoll + Hysterese (Standard 0.3°C) |
| 2️⃣ **Bestätigung** | Mindestens 2 aufeinanderfolgende Messungen (~10 Min) |
| 3️⃣ **Trendprüfung** | Temperatur steigt oder ist stabil (nicht fallend) |
| 4️⃣ **Coast aktiv** | Zieltemperatur → unter aktuelle Wassertemperatur |
| 5️⃣ **Exit** | Wenn Tist < Tsoll + Hysterese/2 → zurück zum Heizen |

### Gewicht in der Entscheidung

Die Coast-Strategie erhält ein **dominantes Gewicht** (Standard 80%) in der gewichteten Entscheidung:

```
Bei aktivem Coast-Modus:
  Coast:     80%  (dominant — verhindert Heizen)
  Komfort:   10%  (PI — auch negativ, verstärkt Coast)
  Thermisch:  4%  (Windkorrektur, vernachlässigbar)
  Andere:     6%  (COP + Preis)
```

> [!NOTE]
> Der PI-Regler wird beim Verlassen des Coast-Modus **zurückgesetzt** (I-Term gelöscht) um Verzerrungen zu vermeiden.

### Einstellungen

| Einstellung | Standard | Effekt |
|-------------|----------|--------|
| Coast Offset | 1°C | Grad unter Auslasstemperatur für Coast-Ziel |
| Coast Hysterese | 0.3°C | Überschwingspanne über Sollwert für Aktivierung |
| Coast Stärke | 0.80 | Gewichtsanteil in der gewichteten Entscheidung |

---

## Komponente 2: Gebäudemodell-Lerner

### Gelernte Parameter

| Parameter | Symbol | Einheit | Typischer Wert |
|-----------|--------|---------|----------------|
| Thermische Masse | C | kWh/°C | 10-25 |
| Wärmeverlust | UA | kW/°C | 0.1-0.4 |
| Solargewinn-Faktor | g | - | 0.3-0.6 |
| Interne Wärme | P_int | kW | 0.2-0.5 |
| Windkorrektur | W_corr | - | 0.03-0.12 |
| Zeitkonstante | τ | Stunde | 4-16 |

### Maschinelles Lernen: RLS

Das System verwendet **Recursive Least Squares** (RLS):

- ✅ Lernt in Echtzeit während der Nutzung
- ✅ Passt sich an Jahreszeiten an
- ✅ Rechenleicht (läuft auf Homey)
- ✅ Liefert Vertrauensindikator

**Lernfortschritt:**

| Zeitraum | Vertrauen | Vorhersage |
|----------|-----------|------------|
| Tag 1 | 25% | ±2°C |
| Tag 3 | 45% | ±1°C |
| Woche 1 | 72% | ±0.5°C |
| Woche 4 | 91% | ±0.2°C |

### Gebäudetyp-Kategorien

| Typ | C (kWh/°C) | UA (kW/°C) | τ (Stunde) |
|-----|------------|------------|------------|
| Leicht (Holz/Fertig) | 5-8 | 0.35-0.45 | 2-4 |
| Durchschnitt (NL-Haus) | 10-15 | 0.25-0.35 | 4-8 |
| Schwer (Beton) | 15-25 | 0.15-0.25 | 8-16 |
| Passivhaus | 25-40 | <0.05 | 16-48 |

---

## Komponente 3: Energiepreis-Optimierer

### Preiskategorien

| Kategorie | Schwelle | Aktion | Versatz |
|-----------|----------|--------|---------|
| Sehr Niedrig | ≤0.04€/kWh | Vorheizen MAX | +1.5°C |
| Niedrig | ≤0.06€/kWh | Vorheizen | +0.75°C |
| Normal | ≤0.10€/kWh | Halten | 0°C |
| Hoch | ≤0.12€/kWh | Reduzieren | -0.5°C |
| Sehr Hoch | >0.12€/kWh | Reduzieren MAX | -1.0°C |

> [!NOTE]
> Die Schwellen basieren auf 2024 Spotpreis-Perzentilen.

### Kostenberechnungsmodi

| Modus | Formel |
|-------|--------|
| Marktpreis | Spot + MwSt. |
| Marktpreis+ | Spot + Aufschlag + MwSt. |
| **All-in** | Spot + Aufschlag + Steuer + MwSt. |

### Beispiel Einsparungen

```
OHNE Optimierung: 18€/Tag
MIT Optimierung:  10€/Tag
─────────────────────────────
Einsparung:       8€/Tag = ~2.900€/Jahr (max)
Realistisch:      400-600€/Jahr
```

---

## Komponente 4: COP-Regler

### Was ist COP?

**COP = Wärmeleistung / Elektrische Aufnahme**

| COP | Bedeutung | Kosten (0.25€/kWh) |
|-----|-----------|-------------------|
| 2.0 | Schlecht | 0.25€/Stunde für 4kW |
| 3.5 | Gut | 0.14€/Stunde für 4kW |
| 5.0 | Ausgezeichnet | 0.10€/Stunde für 4kW |

> [!IMPORTANT]
> Unterschied zwischen COP 2.0 und 5.0 = **2.5× günstiger!**

### Faktoren die COP beeinflussen

| Faktor | Effekt | Optimierung |
|--------|--------|-------------|
| Temp-Differenz | Größer = niedrigerer COP | Niedrigere Vorlauftemp |
| Außentemperatur | Wärmer = höherer COP | Vorheizen bei mildem Wetter |
| Vorlauftemperatur | Niedriger = höherer COP | Minimal nötige Temp |

### Multi-Horizont-Analyse

Die App verwendet eingebaute COP-Fähigkeiten:

| Fähigkeit | Horizont | Verwendung |
|-----------|----------|------------|
| `adlar_cop` | Echtzeit | Direkte Anpassungen |
| `adlar_cop_daily` | 24h Durchschnitt | Tagesmuster |
| `adlar_cop_weekly` | 7d Durchschnitt | Trends |
| `adlar_cop_monthly` | 30d Durchschnitt | Saison |
| `adlar_scop` | Saison (EN 14825) | Jährlich |

### Effizienzzonen

| Zone | COP | Aktion |
|------|-----|--------|
| 🟢 Ausgezeichnet | ≥4.0 | Beibehalten |
| 🟢 Gut | 3.5-4.0 | Beibehalten |
| 🟡 Akzeptabel | 3.0-3.5 | Überwachen |
| 🟠 Moderat | 2.5-3.0 | Optimieren |
| 🔴 Schlecht | <2.5 | **Dringend!** |

---

## Systemintegration

### Prioritäten & Gewichtungen

Die Gewichtungsfaktoren sind **konfigurierbar** über Geräteeinstellungen → Gewichtungsfaktoren der Adaptiven Regelung:

| Priorität | Standard | Bereich | Funktion |
|-----------|----------|---------|----------|
| **Komfort** | 50% | 0-100% | Gewicht für PI-Temperaturregelung |
| **Effizienz** | 15% | 0-100% | Gewicht für COP-Optimierung |
| **Kosten** | 15% | 0-100% | Gewicht für Preisoptimierung |
| **Thermisch** | 20% | 0-100% | Gewicht für thermisches Modell |

> [!NOTE]
> Werte werden automatisch auf insgesamt 100% normalisiert.

### Konfliktlösung

**Beispiel:**
```
Komfort-Regler:   "Erhöhen +2°C" (zu kalt!)
COP-Optimierer:   "Senken -1°C" (schlechter COP)
Preis-Optimierer: "Senken -1°C" (teurer Preis)
Thermisches Modell: "Erhöhen +0.5°C" (Vorhersage)

Berechnung:
+2.0 × 0.50 = +1.00°C
-1.0 × 0.15 = -0.15°C
-1.0 × 0.15 = -0.15°C
+0.5 × 0.20 = +0.10°C
─────────────────────
Gesamt:    +0.80°C
```

### Beispiel: Coast-Modus aktiv

```
Komfort-Regler:     "Senken -1°C" (PI erkennt Überschwingung)
COP-Optimierer:     "Senken -0.5°C" (niedrigerer Vorlauf = höherer COP)
Preis-Optimierer:   "Halten 0°C" (normaler Preis)
Thermisches Modell: "Erhöhen +0.3°C" (Windkorrektur)
Coast-Strategie:    "Senken -4°C" (Coast-Ziel = Auslasstemp - Offset)

Berechnung (mit Coast-Stärke = 0.80):
-4.0 × 0.80       = -3.20°C  (Coast dominant)
-1.0 × 0.50 × 0.20 = -0.10°C  (Komfort skaliert)
-0.5 × 0.15 × 0.20 = -0.02°C  (COP skaliert)
 0.0 × 0.15 × 0.20 =  0.00°C  (Preis skaliert)
+0.3 × 0.20 × 0.20 = +0.01°C  (Thermisch skaliert)
───────────────────────────────
Gesamt:            -3.31°C → Sollwert << P111 → Kompressor stoppt ✅
```

### Vorrang-Regeln

1. **Sicherheit zuerst** — Außerhalb 15-28°C Bereich: alles ignorieren
2. **Komfort-Minimum** — Zu kalt: 100% Komfort-Priorität
3. **Effizienz-Gelegenheit** — Spielraum + niedriger COP: COP-Gewicht erhöhen

---

## Einrichtung & Konfiguration

### Schnellstart (5 Minuten)

1. **App installieren** auf Homey Pro
2. **Externen Sensor konfigurieren** (Thermostat)
3. **Heizkurve → AUS** (App macht das automatisch)
4. **48-72 Stunden warten** für erste Ergebnisse
5. **Optimierungen aktivieren** nach 1 Woche

### Installationsphasen

| Phase | Tag | Aktion | Erwartet |
|-------|-----|--------|----------|
| Lernen | 1-3 | Daten sammeln | 30-50% Vertrauen |
| Basis | 3-7 | Adaptive Regelung EIN | Stabile Temp |
| Vollständig | 10+ | COP + Preis EIN | Alle Optimierungen |

### Konfiguration

````carousel
```json
// Heizungsregler
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
// Energie-Optimierer
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
// COP-Regler
{
  "cop_optimizer_enabled": true,
  "cop_min_acceptable": 2.5,
  "cop_target": 3.5,
  "cop_strategy": "balanced"
}
```
<!-- slide -->
```json
// Coast-Strategie (Passiver Kühlmodus)
{
  "adaptive_cooldown_offset": 1.0,
  "adaptive_cooldown_hysteresis": 0.3,
  "adaptive_cooldown_strength": 0.80
}
```
````

---

## Flow-Beispiele

### Basis: Benachrichtigung

```
WENN: Sollwert automatisch angepasst
DANN: Benachrichtigung senden
      "🌡️ Ziel: {{old}}°C → {{new}}°C"
```

### Erweitert: GPS-Ankunft zu Hause

```
WENN: Jemand kommt nach Hause
FALLS: Alle waren weg UND Aktuelle Temp < 19°C
DANN: Adaptives Ziel auf 20°C setzen
      Benachrichtigung senden "🏠 Aufheizen gestartet"
```

### Preisoptimierung

```
WENN: Uhrzeit ist 23:00
FALLS: Aktueller Preis < 0.08€/kWh
       UND Morgen 07:00 Preis > 0.30€/kWh
       UND Gebäude τ > 6 Stunden
DANN: Ziel +1.5°C setzen (Vorheizen)
      Benachrichtigung senden "⚡💰 Vorheizen"
```

### Multi-Horizont COP-Bericht

```
WENN: Uhrzeit ist Sonntag 20:00
DANN: COP-Metriken abrufen
      Benachrichtigung senden:
      "📈 Wöchentlicher COP-Bericht
       Aktuell: {{adlar_cop}}
       Täglich: {{adlar_cop_daily}}
       Wöchentlich: {{adlar_cop_weekly}}
       SCOP: {{adlar_scop}}"
```

---

## Fehlerbehebung

### Häufige Probleme

| Problem | Ursache | Lösung |
|---------|---------|--------|
| "Heizkurve nicht AUS" | Manuell geändert | Einstellungen → Regelmodus zurücksetzen |
| Temp reagiert nicht | Externe Sensor-Probleme | Sensor-Verbindung prüfen |
| Modell-Vertrauen niedrig | Inkonsistente Daten | Länger warten oder Modell zurücksetzen |
| Keine Preisdaten | API-Probleme | Internetverbindung prüfen |
| COP unrealistisch | WP in Übergang | 24h auf Stabilisierung warten |
| WP heizt bei hoher Raumtemp | Coast nicht aktiv | Hysterese-Einstellung prüfen, 10 Min warten |
| Oszillation nach Abkühlung | I-Term Verzerrung | Coast-Exit-Reset funktioniert nicht → Adaptive Regelung neustarten |

### Abstimmungsprobleme

| Symptom | Anpassung |
|---------|-----------|
| Oszilliert zu stark | Totzone erhöhen, Kp senken |
| Reagiert zu langsam | Totzone verringern, Kp erhöhen |
| Strukturell zu kalt/warm | Ki erhöhen |
| Zu viele kleine Korrekturen | min_wait erhöhen |

### Debug-Modus

```bash
# Aktivieren über Einstellungen → Log-Level → DEBUG

# Liefert zusätzliche Logs:
# - Regler-Status alle 5 Min
# - RLS-Updates und Vorhersagefehler
# - COP-Berechnungen
# - Preiskategorie-Entscheidungen
```

---

## Anhang: Technische Details

### DPS-Zuordnung

| DPS | Fähigkeit | Beschreibung |
|-----|-----------|--------------|
| 4 | `target_temperature` | Zieltemperatur (direkte Steuerung) |
| 13 | `adlar_enum_countdown_set` | Heizkurve (**MUSS AUS sein!**) |
| 21 | `measure_temperature.temp_top` | Vorlauftemperatur |
| 22 | `measure_temperature.temp_bottom` | Rücklauftemperatur |
| 26 | `measure_temperature.around_temp` | Außentemperatur |
| 27 | `adlar_state_compressor_state` | Kompressorstatus |

> [!CAUTION]
> Die Heizkurve (DPS 13) **NIEMALS** manuell ändern! Sie muss für die adaptive Regelung immer auf AUS stehen.

### Formeln

**Wärmebilanz:**
```
dT/dt = (1/C) × [P_Heizung - UA×(T_innen - T_außen) + P_solar + P_intern]
```

**COP-Berechnung:**
```
COP = Q_thermisch / P_elektrisch
Q_thermisch = ṁ × c_p × ΔT
```

**PI-Regler:**
```
Korrektur = (Kp × aktueller_Fehler) + (Ki × mittlerer_Fehler)
```

### Leistungsmetriken

| Metrik | Ziel | Typisch |
|--------|------|---------|
| Temp-Stabilität | ±0.3°C | ±0.2°C |
| Reaktionszeit | <30 Min | 15-20 Min |
| COP-Verbesserung | +20% | +25-35% |
| Kostenreduzierung | 30% | 35-45% |
| Jährliche Einsparungen | 500€ | 600-800€ |

---
