# Gebäudeerkenntnisse & Empfehlungen Leitfaden

**Version**: 2.6.0+ | **Zuletzt aktualisiert**: Januar 2026

---

## Inhaltsverzeichnis

1. [Einführung](#einführung)
2. [Was sind Gebäudeerkenntnisse?](#was-sind-gebäudeerkenntnisse)
3. [Wie es funktioniert](#wie-es-funktioniert)
4. [Erkenntniskategorien](#erkenntniskategorien)
5. [Ihre Erkenntnisse verstehen](#ihre-erkenntnisse-verstehen)
6. [Maßnahmen ergreifen](#maßnahmen-ergreifen)
7. [Beispiel-Flows](#beispiel-flows)
8. [Flow-Karten Referenz](#flow-karten-referenz)
9. [Einstellungen](#einstellungen)
10. [Fehlerbehebung](#fehlerbehebung)
11. [FAQ](#faq)

---

## Einführung

Die Funktion **Gebäudeerkenntnisse & Empfehlungen** verwandelt Ihre Wärmepumpe von einem einfachen Temperaturregler in einen intelligenten Energieberater. Nach 24-48 Stunden Lernphase der thermischen Eigenschaften Ihres Gebäudes liefert das System **konkrete, umsetzbare Empfehlungen** mit geschätzten Einsparungen in Euro pro Monat.

### Hauptvorteile

| Vorteil | Einsparung |
|---------|------------|
| 💰 Dämmungserkenntnisse | 10-30% |
| ⏱️ Vorheizoptimierung | 5-10% |
| 🏠 Thermische Speicherstrategien | 10-25% (mit dynamischen Preisen) |
| 📊 ROI-Transparenz | Jede Empfehlung enthält monatliche Einsparungen |

---

## Was sind Gebäudeerkenntnisse?

Gebäudeerkenntnisse analysieren die **5 thermischen Parameter**, die vom Gebäudemodell gelernt werden:

| Parameter | Symbol | Bedeutung | Typischer Bereich |
|-----------|--------|-----------|-------------------|
| **Thermische Masse** | C | Wärmekapazität - wie viel Energie für 1°C benötigt | 7-30 kWh/°C |
| **Wärmeverlustkoeffizient** | UA | Rate des Wärmeverlusts pro Grad Differenz | 0,05-0,5 kW/°C |
| **Zeitkonstante** | τ (tau) | Wie schnell das Gebäude heizt/kühlt (τ = C/UA) | 5-25 Stunden |
| **Solargewinnfaktor** | g | Effektivität der Sonneneinstrahlung | 0,3-0,6 |
| **Interne Wärmegewinne** | P_int | Wärme von Menschen, Geräten, Kochen | 0,2-0,5 kW |

Das System vergleicht gelernte Werte mit:
- **Ihrem ausgewählten Gebäudeprofil** (Leicht/Mittel/Schwer/Passiv)
- **Typischen Werten für gut gedämmte Gebäude**
- **Ihren Energiepreisdaten** (falls verfügbar)

Bei Optimierungsmöglichkeiten generiert es **Erkenntnisse** mit spezifischen Empfehlungen.

---

## Wie es funktioniert

### Lernphase (24-48 Stunden)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Datensammlung   │───▶│Parameter-Lernen │───▶│ Vertrauen wächst│
│   alle 5 Min    │    │  RLS-Algorithmus│    │    0% → 100%    │
└─────────────────┘    └─────────────────┘    └────────┬────────┘
                                                       │
         ┌─────────────────────────────────────────────┘
         ▼
   ┌───────────┐
   │   ≥70%?   │
   └─────┬─────┘
         │
    ┌────┴────┐
    │         │
   Ja        Nein ──────────────────────────────┐
    │                                           │
    ▼                                           │
┌─────────────────┐                             │
│  Erkenntnisse   │                             │
│   verfügbar     │          ┌──────────────────┘
└─────────────────┘          │
                             ▼
                   (Zurück zur Datensammlung)
```

**Gesammelte Daten:**
- Innentemperatur (externer Sensor)
- Außentemperatur (Wärmepumpe oder externer Sensor)
- Elektrische Leistung
- Geschätzte Sonneneinstrahlung

**Erkenntniserzeugung:**
- System evaluiert alle 50 Minuten (10 Messungen)
- Erkennt Muster: schlechte Dämmung, thermisches Speicherpotenzial, Vorheizmöglichkeiten
- Generiert Empfehlungen mit ROI-Schätzungen

### Kontinuierliche Überwachung

- **Passt sich an Jahreszeiten an** (Solargewinn-Multiplikatoren, interne Wärmemuster)
- **Aktualisiert Erkenntnisse** bei Parameterdrift >10%
- **Ratenbegrenzt** zur Vermeidung von "Beratungsmüdigkeit" (max. 1 Erkenntnis pro Kategorie pro Tag)

---

## Erkenntniskategorien

Das System bietet **4 kategoriespezifische Sensoren** (v2.5.10+):

### 1. 🏠 Dämmungsleistungs-Erkenntnisse

**Was erkannt wird:**
- Hoher Wärmeverlust (UA > erwartet)
- Ausgezeichnete Dämmung (UA < erwartet)

**Beispiel-Erkenntnis:**
> „🏠 Hoher Wärmeverlust - UA 0,52 kW/°C (erwartet: 0,30)"

**Beispiel-Empfehlung:**
> „Erwägen Sie Dämmungsupgrades: Dach (25% Einsparung), Wände (15%), Fenster (10%). Gesch. Einsparung: €120/Monat"

**Wann es auslöst:**
- Vertrauen ≥ 70%
- UA > 1,5× Profil-UA **ODER** UA > 0,5 kW/°C (absolute Schwelle)

**Was zu tun ist:**
1. **Messung überprüfen** - Prüfen, ob Türen/Fenster während des Lernens offen standen
2. **Upgrades priorisieren** - Dachdämmung bietet höchsten ROI (25% der Gesamteinsparung)
3. **Angebote einholen** - €120/Monat-Schätzung zur Berechnung der Amortisationszeit nutzen
4. **Nachtabsenkung implementieren** - Wärmeverlust während unbewohnter Stunden reduzieren

---

### 2. ⏱️ Vorheiz-Strategie-Erkenntnisse

**Was erkannt wird:**
- Schnelle thermische Reaktion (τ < 5 Stunden)
- Mittlere thermische Reaktion (τ 5-15 Stunden)
- Langsame thermische Reaktion (τ > 15 Stunden)

**Beispiel-Erkenntnis:**
> „⏱️ Schnelle thermische Reaktion - Gebäude heizt in 4,2 Stunden auf"

**Beispiel-Empfehlung:**
> „Aktivieren Sie aggressive Nachtabsenkung auf 16°C, Vorheizen 2 Stunden vor Aufwachzeit (05:00 → 07:00 fertig). Gesch. 12% Energieeinsparung."

**Empfohlene Maßnahmen nach Typ:**

| Reaktionstyp | τ | Nachtabsenkung | Vorheizen | Einsparung |
|--------------|---|----------------|-----------|------------|
| Schnell | <5h | Aggressiv (16-17°C) | 2-3 Stunden | 10-15% |
| Mittel | 5-15h | Moderat (17-18°C) | 4-5 Stunden | 6-10% |
| Langsam | >15h | Minimal oder keine | Nicht praktikabel | 3-5% |

---

### 3. 💰 Thermische Speicheroptimierungs-Erkenntnisse

**Was erkannt wird:**
- Gebäude mit hoher thermischer Masse (C > 18 kWh/°C) mit langsamer Reaktion (τ > 12h)
- Fähigkeit, Energie in günstigen Stunden zu speichern, in teuren Stunden abzuschalten

**Beispiel-Erkenntnis (mit dynamischen Preisen):**
> „💰 Thermisches Speicherpotenzial - C=24 kWh/°C, τ=18h"

**Beispiel-Empfehlung:**
> „Vorheizen +2°C während günstiger Stunden (02:00-06:00), Ausrollen -1°C während Spitze (17:00-21:00). Gesch. Einsparung: €95/Monat"

**Beispiel-Erkenntnis (ohne dynamische Preise):**
> „💡 Gebäude geeignet für thermische Speicherung - C=24 kWh/°C, τ=18h"

**Beispiel-Empfehlung:**
> „Fügen Sie dynamische Energiepreise über Flow-Karte 'Externe Energiepreise empfangen' hinzu, um Kostenoptimierung zu aktivieren. Potenzielle Einsparung: 15-25%"

**Thermische Speicherberechnung:**
```
Gespeicherte Energie = C × Temp-Verschiebung = 24 kWh/°C × 2°C = 48 kWh
Tägliche Einsparung = Gespeicherte Energie × Preisdifferenz × Nutzungsfaktor
                    = 48 kWh × €0,15/kWh × 0,70 = €5,04/Tag
Monatliche Einsparung = €5,04 × 30 = €151/Monat
```

---

### 4. 🔄 Gebäudeprofil-Abweichung (Diagnose)

**Was erkannt wird:**
- Ausgewähltes Gebäudeprofil stimmt nicht mit gelerntem Verhalten überein
- >30% Abweichung in Zeitkonstante (τ)

**Beispiel-Erkenntnis:**
> „🔄 Gebäude verhält sich wie 'schwer' (τ=18h vs 'mittel' τ=10h)"

**Beispiel-Empfehlung:**
> „Ändern Sie das Gebäudeprofil in den Geräteeinstellungen auf 'schwer' für schnelleres Lernen und bessere Anfangsparameter"

**Profileigenschaften:**

| Profil | C (kWh/°C) | UA (kW/°C) | τ (Stunden) | Gebäudetyp |
|--------|-----------|-----------|-------------|------------|
| **Leicht** | 7 | 0,35 | 20 | Holzrahmen, Basisdämmung, schnelle Temp-Änderungen |
| **Mittel** | 15 | 0,30 | 50 | Ziegel, Hohlwände, Doppelverglasung (typisch DE) |
| **Schwer** | 20 | 0,25 | 80 | Beton/Stein, gute Dämmung, HR++ Glas |
| **Passiv** | 30 | 0,05 | 600 | Passivhaus, HR+++, luftdicht, Wärmerückgewinnung |

---

## Ihre Erkenntnisse verstehen

### Wo zu finden

**Geräte-Capabilities (v2.5.10+)** - Jede Kategorie hat ihren eigenen Sensor:
1. **Dämmungs-Erkenntnis** (`building_insight_insulation`) — Wärmeverlustanalyse
2. **Vorheiz-Erkenntnis** (`building_insight_preheating`) — Thermische Reaktionsberatung
3. **Thermische Speicher-Erkenntnis** (`building_insight_thermal_storage`) — Lastverschiebungspotenzial
4. **Gebäudeprofil-Erkenntnis** (`building_insight_profile`) — Profilabweichungserkennung
5. **Gebäudeerkenntnisse-Diagnose (JSON)** — Detaillierte technische Daten

**Flow-Trigger-Karten:**
1. **„Neue Gebäudeerkenntnis erkannt"** — Löst bei neuen Erkenntnissen aus
2. **„Vorheizzeit-Empfehlung"** — Täglicher Trigger um 23:00
3. **„Gebäudeprofil-Abweichung erkannt"** — Einmaliger Trigger

### Erkenntnislebenszyklus

| Status | Symbol | Beschreibung |
|--------|--------|--------------|
| Neu | 🆕 | Gerade erkannt, Benachrichtigung gesendet |
| Aktiv | ✅ | In Capabilities angezeigt |
| Bestätigt | 👀 | Benutzer hat es gesehen |
| Abgelehnt | 🚫 | Für 30 Tage ausgeblendet |
| Gelöst | ✔️ | Maßnahme implementiert |

### Prioritätssystem

Erkenntnisse werden 0-100 bewertet basierend auf:
- **Vertrauen** (30%) — Modellsicherheit
- **Energieeinsparungspotenzial** (40%) — €/Monat-Schätzung
- **Maßnahmeneinfachheit** (20%) — Wie einfach zu implementieren
- **Sofortwirkung** (10%) — Schneller vs. langfristiger Nutzen

**Anzeigeregel:** Jede Kategorie hat ihren eigenen Sensor - alle Erkenntnisse werden parallel angezeigt (v2.5.10)

---

## Maßnahmen ergreifen

### Schritt-für-Schritt-Aktionsleitfaden

#### Für Dämmungserkenntnisse:

| Zeitrahmen | Maßnahmen |
|------------|-----------|
| **Sofort** (0-1 Woche) | ✅ Nachtabsenkung aktivieren<br/>✅ Luftlecks prüfen und abdichten |
| **Kurzfristig** (1-3 Monate) | ✅ Angebote für Dachdämmung einholen (€3000-6000, Amortisation 2-4 Jahre)<br/>✅ Hohlwanddämmung erwägen (€1500-3000)<br/>✅ Fenster auf HR++ Glas bewerten |
| **Langfristig** (6-12 Monate) | ✅ Umfassendes Dämmungspaket planen<br/>✅ Förderungen prüfen (BAFA, KfW, lokale Programme)<br/>✅ Gesamt-ROI mit monatlichen Einsparungen berechnen |

#### Für Vorheiz-Erkenntnisse:

| Zeitrahmen | Maßnahmen |
|------------|-----------|
| **Sofort** | ✅ Automatisierungs-Flow mit `pre_heat_recommendation` Trigger erstellen<br/>✅ Nachtabsenkung testen (konservativ starten: 2°C Absenkung) |
| **Optimierung** | ✅ Absenkung basierend auf Komfort feinjustieren<br/>✅ Aufwachzeit-Einstellung bei Bedarf anpassen |

#### Für Thermische Speicher-Erkenntnisse:

| Zeitrahmen | Maßnahmen |
|------------|-----------|
| **Voraussetzungen** (1-2 Wochen) | ✅ Für dynamischen Energievertrag anmelden<br/>✅ Energy Prices App installieren<br/>✅ Flow zur Preisweiterleitung einrichten |
| **Implementierung** | ✅ Thermische Speicher-Automatisierung erstellen<br/>✅ Konservativ starten (±1°C Anpassungen) |
| **Optimierung** | ✅ Temperaturverschiebung erhöhen, wenn komfortabel<br/>✅ Timing basierend auf Ihrer Preiskurve anpassen |

---

## Beispiel-Flows

### Flow 1: Automatischer Vorheiz-Zeitplan

```
WENN Vorheizzeit-Empfehlung
  (löst täglich um 23:00 mit optimaler Startzeit aus)

DANN
  1. Zieltemperatur auf 17°C um 22:00 setzen
     (Nachtabsenkung - Gebäude kühlt langsam ab)

  2. Zieltemperatur auf 21°C um {{start_time}} Token setzen
     (Vorheizen beginnt - basierend auf τ berechnet)

  3. Benachrichtigung: „Vorheizen geplant für {{start_time}} ({{duration_hours}}h)"
```

---

### Flow 2: Thermische Speicherung mit dynamischen Preisen

```
WENN Günstigster Energieblock gestartet
  (von Energy Prices App - typisch 02:00-06:00)

UND Gebäudeerkenntnis erkannt, Kategorie = „thermal_storage"

DANN
  1. Zieltemperatur um 2°C erhöhen (thermische Energie speichern)
  2. Benachrichtigung: „Thermische Speicherung: Vorheizen auf {{target}}°C"
```

```
WENN Teuerster Energieblock gestartet
  (typisch 17:00-21:00)

DANN
  1. Zieltemperatur um 1°C senken (auf gespeicherter Energie ausrollen)
  2. Benachrichtigung: „Thermische Speicherung: Ausrollen bei {{target}}°C"
```

---

### Flow 3: Hochprioritäts-Erkenntnisbenachrichtigungen

```
WENN Neue Gebäudeerkenntnis erkannt

UND {{estimated_savings_eur_month}} ist größer als 70
UND {{priority}} ist größer als 70

DANN
  Benachrichtigung senden:
    „💰 Energieeinsparungsmöglichkeit!"
    „{{insight}}"
    „Maßnahme: {{recommendation}}"
    „Potenzial: €{{estimated_savings_eur_month}}/Monat"
```

---

## Flow-Karten Referenz

### Trigger-Karten (3)

#### 1. Neue Gebäudeerkenntnis erkannt

**Löst aus:** Wenn eine neue Erkenntnis erkannt wird (≥70% Vertrauen, max. 1× pro Kategorie pro Tag)

**Tokens:**

- `category` (string) - Kategorie: insulation_performance / pre_heating / thermal_storage
- `insight` (string) - Menschenlesbare Erkenntnismeldung
- `recommendation` (string) - Empfohlene Maßnahme
- `priority` (number 0-100) - Prioritätswert
- `confidence` (number 0-100) - Modellzuverlässigkeit
- `estimated_savings_eur_month` (number) - Monatliche Einsparung in EUR (falls zutreffend)

**Häufigkeit:** Max. 1× pro Kategorie pro 24 Stunden (Beratungsmüdigkeitsprävention)

---

#### 2. Vorheizzeit-Empfehlung

**Löst aus:** Täglich um 23:00 mit optimaler Vorheizstartzeit

**Tokens:**

- `start_time` (string) - HH:MM Format (z.B. „05:30")
- `target_time` (string) - Zielzeit (über wake_time Einstellung gesetzt)
- `duration_hours` (number) - Vorheizdauer in Stunden
- `temp_rise` (number) - Temperaturanstieg in °C
- `confidence` (number 0-100) - Modellzuverlässigkeit

**Bedingungen:** Nur wenn Vertrauen ≥70%, neuberechnet bei τ Änderung >10%

---

#### 3. Gebäudeprofil-Abweichung erkannt

**Löst aus:** Einmalig, wenn gelerntes Verhalten signifikant vom ausgewählten Profil abweicht

**Tokens:**

- `current_profile` (string) - Aktuelles Profil (z.B. „average")
- `suggested_profile` (string) - Vorgeschlagenes Profil (z.B. „heavy")
- `tau_learned` (number) - Gelernte Zeitkonstante in Stunden
- `tau_profile` (number) - Profil-Zeitkonstante in Stunden
- `deviation_percent` (number) - Abweichungsprozentsatz
- `confidence` (number 0-100) - Modellzuverlässigkeit (min. 50%)

**Bedingungen:** Abweichung >30%, Vertrauen ≥50%

---

### Aktions-Karten (4)

#### 1. Erkenntnis ausblenden

**Funktion:** Spezifische Erkenntniskategorie temporär ausblenden

**Parameter:**

- `category` (Dropdown) - Auszublendende Kategorie
- `duration` (number 1-365) - Anzahl Tage

**Verwendung:** Nach Renovierungsplanung, bekanntes Problem ignorieren

---

#### 2. Erkenntnisanalyse erzwingen

**Funktion:** Sofortige Auswertung auslösen (nicht auf 50-Min-Intervall warten)

**Rückgabe:**

- `insights_detected` (number) - Anzahl erkannter Erkenntnisse
- `confidence` (number) - Aktuelle Modellzuverlässigkeit

**Verwendung:** On-Demand-Analyse, Debugging, Tagesbericht

---

#### 3. Erkenntnishistorie zurücksetzen

**Funktion:** Alle aktiven Erkenntnisse und Historie löschen (Gebäudemodell bleibt erhalten)

**Parameter:**

- `confirm` (Checkbox) - MUSS angekreuzt sein, um Reset auszuführen

**Verwendung:** Nach großen Gebäudeänderungen (Dämmung, Renovierung, neue Fenster)

**WICHTIG:** Gebäudemodell (C, UA, τ, g, P_int) bleibt erhalten - nur Erkenntnisse werden zurückgesetzt

---

#### 4. Vertrauensschwelle setzen

**Funktion:** Mindestvertrauensschwelle dynamisch anpassen

**Parameter:**

- `threshold` (number 50-90) - Neue Schwelle in %

**Effekt:** Höhere Schwelle = weniger Erkenntnisse (sehr zuverlässig), niedriger = mehr Erkenntnisse (früher, weniger genau)

**Verwendung:** Adaptive Schwelle - mit 70% starten, nach Konvergenz auf 60% senken

---

### Bedingungs-Karten (3)

#### 1. Erkenntnis ist aktiv

**Funktion:** Prüfen, ob spezifische Kategorie aktuell aktiv ist

**Parameter:**

- `category` (Dropdown) - Zu prüfende Kategorie

**Rückgabe:** `true` wenn aktiv UND nicht abgelehnt, sonst `false`

**Verwendung:** Bedingte Automatisierung (nur thermische Speicherung wenn Erkenntnis aktiv)

---

#### 2. Modellvertrauen ist über Schwelle

**Funktion:** Qualitätsgatter für Flows

**Parameter:**

- `threshold` (number 0-100) - Vertrauensschwelle in %

**Rückgabe:** `true` wenn Modellvertrauen > Schwelle

**Verwendung:** Nur Benachrichtigungen/Maßnahmen bei hoher Sicherheit (z.B. >80%)

---

#### 3. Geschätzte Einsparung ist über Schwelle

**Funktion:** ROI-basierte Filterung

**Parameter:**

- `category` (Dropdown) - Zu prüfende Kategorie (insulation_performance / pre_heating / thermal_storage)
- `threshold` (number 0-500) - €/Monat Schwelle

**Rückgabe:** `true` wenn geschätzte monatliche Einsparung > Schwelle

**Verwendung:** Filter für signifikante Einsparungen (z.B. nur benachrichtigen wenn >€100/Monat)

---

## Einstellungen

### Erkenntniseinstellungen

**Ort:** Geräteeinstellungen → Gebäudeerkenntnisse & Empfehlungen

| Einstellung | Standard | Bereich | Beschreibung |
|-------------|----------|---------|--------------|
| **Gebäudeerkenntnisse aktivieren** | AN | AN/AUS | Hauptschalter |
| **Mindestvertrauen (%)** | 70% | 50-90% | Schwelle für Anzeige von Erkenntnissen |
| **Aufwachzeit** | 07:00 | HH:MM | Zielzeit für Vorheiz-Abschluss |
| **Nachtabsenkung (°C)** | 4,0 | 2,0-6,0 | Temperaturabsenkung nachts |

> **Hinweis (v2.5.10):** Die Einstellung „Max. Aktive Erkenntnisse" wurde entfernt - jede Kategorie hat jetzt ihren eigenen Sensor.

### Aufwachzeit - Wie es funktioniert

Die `wake_time` Einstellung bestimmt, wann das Vorheizen abgeschlossen sein soll. Das System berechnet automatisch die optimale Startzeit:

**Formel:**
```
Vorheiz_Dauer = τ × ln(ΔT_Ziel / ΔT_Rest)
Start_Zeit = Aufwachzeit - Vorheiz_Dauer
```

**Beispielberechnung:**
- Aufwachzeit: **07:00**
- τ (Zeitkonstante): **10 Stunden**
- Nachtabsenkung: **4°C** (von 21°C auf 17°C)
- Rest-Temperaturabfall: **0,5°C** (Annahme)

```
Vorheiz_Dauer = 10 × ln(4 / 0,5) = 10 × 2,08 = 20,8 Stunden
→ Dies ist unrealistisch, daher passt das System für thermische Masse an
```

**Praktische Ergebnisse nach Gebäudetyp:**

| τ (Stunden) | Vorheizen | Start für Aufwachzeit 07:00 |
|-------------|-----------|------------------------------|
| 4 | 2 Stunden | 05:00 |
| 8 | 3,5 Stunden | 03:30 |
| 15 | 5 Stunden | 02:00 |
| 25+ | Nicht praktikabel | Kontinuierliches Heizen erwägen |

### Empfohlene Einstellungen nach Benutzertyp

| Typ | Vertrauen | Nachtabsenkung |
|-----|-----------|----------------|
| **Anfänger** (erste 2 Wochen) | 70% | 2°C |
| **Fortgeschritten** (nach 1 Monat) | 65% | 4°C |
| **Experte** (nach 3 Monaten) | 60% | Basierend auf τ |

---

## Fehlerbehebung

### Keine Erkenntnisse nach 48 Stunden

| Ursache | Lösung |
|---------|--------|
| Modellvertrauen <70% | Länger warten (bis zu 72 Stunden) oder Schwelle auf 65% senken |
| Erkenntnisse deaktiviert | Geräteeinstellungen → Gebäudeerkenntnisse aktivieren prüfen |
| Gebäude verhält sich genau wie erwartet | Gute Nachricht! Keine Optimierung nötig |
| Fehlende Datenquellen | Sicherstellen, dass externer Innentemperatursensor verbunden ist |

### Erkenntnisse zeigen falsche Einsparungsschätzungen

| Ursache | Auswirkung | Lösung |
|---------|------------|--------|
| Energiepreis ≠ €0,30/kWh | Schätzungen proportional | Mit (Ihr Preis / 0,30) multiplizieren |
| COP ≠ 3,5 | Höherer COP = höhere Einsparung | Schätzungen sind konservativ |
| Heizstunden ≠ 4000h/Jahr | Mehr Stunden = höhere Einsparung | Tatsächliche Einsparung nach 1 Monat überwachen |

### Vorheiz-Empfehlung löst nicht aus

| Ursache | Lösung |
|---------|--------|
| Modellvertrauen <70% | Auf Lernen warten |
| Aufwachzeit nicht konfiguriert | Über Geräteeinstellungen setzen |
| Flow-Karte nicht erstellt | Flow mit „Vorheizzeit-Empfehlung" Trigger erstellen |

---

## FAQ

### F: Wie lange dauert das Lernen?

**A:** 24-48 Stunden für 70% Vertrauen (Standardschwelle). Sie können auf 50% senken für frühere Erkenntnisse (weniger genau). Vollständige Konvergenz dauert 1-3 Wochen.

### F: Werden Erkenntnisse aktualisiert, wenn ich die Dämmung verbessere?

**A:** Ja! Das Modell lernt kontinuierlich. Nach Dämmungsupgrades sollte UA über 3-7 Tage sinken. Die „schlechte Dämmung"-Erkenntnis verschwindet und kann durch „ausgezeichnete Dämmung" oder „thermische Speicherungsmöglichkeit" ersetzt werden.

### F: Was, wenn mein Gebäude in kein Profil passt?

**A:** Profile sind nur Startpunkte zur Beschleunigung des Lernens. Nach 48 Stunden überschreiben gelernte Parameter das Profil vollständig.

### F: Warum scheint mein τ (Zeitkonstante) hoch/niedrig?

**A:** τ hängt sowohl von thermischer Masse (C) als auch Wärmeverlust (UA) ab:
- **Hohes τ** (>15h): Schweres Gebäude (hohes C) ODER ausgezeichnete Dämmung (niedriges UA)
- **Niedriges τ** (<5h): Leichtes Gebäude (niedriges C) ODER schlechte Dämmung (hohes UA)

### F: Wie genau sind die Einsparungsschätzungen?

**A:** Zielgenauigkeit ist ±20%. Sie basieren auf konservativen Annahmen (COP 3,5, 4000 Heizstunden, €0,30/kWh). Überwachen Sie tatsächliche Einsparungen via Homey Energy nach Implementierung.

### F: Was passiert, wenn ich Geräteeinstellungen während des Lernens ändere?

**A:** Minimale Auswirkung. Das Modell lernt Gebäudeeigenschaften, nicht Wärmepumpeneinstellungen. Aber vermeiden Sie:
- Gebäudeprofil während des Lernens ändern (setzt Parameter zurück)
- Gebäudemodell zurücksetzen (verliert alle gelernten Daten)
- Häufige Moduswechsel (verwirrt Modell)
