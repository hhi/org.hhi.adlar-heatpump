# Gebäudeerkenntnisse & Empfehlungen Leitfaden

**Version**: 3.4.0+ | **Zuletzt aktualisiert**: Oktober 2026

---

## Inhaltsverzeichnis

1. [Einführung](#einführung)
2. [Was sind Gebäudeerkenntnisse?](#was-sind-gebäudeerkenntnisse)
3. [Wie es funktioniert](#wie-es-funktioniert)
4. [Sonnenstrahlungsquellen](#sonnenstrahlungsquellen)
5. [Erkenntniskategorien](#erkenntniskategorien)
6. [Ihre Erkenntnisse verstehen](#ihre-erkenntnisse-verstehen)
7. [Maßnahmen ergreifen](#maßnahmen-ergreifen)
8. [Beispiel-Flows](#beispiel-flows)
9. [Einstellungen](#einstellungen)
10. [Fehlerbehebung](#fehlerbehebung)
11. [FAQ](#faq)

---

## Einführung

Die Funktion **Gebäudeerkenntnisse & Empfehlungen** verwandelt Ihre Wärmepumpe von einem einfachen Temperaturregler in einen intelligenten Energieberater. Nach etwa 1–2 Tagen Lernphase der thermischen Eigenschaften Ihres Gebäudes liefert das System **konkrete, umsetzbare Empfehlungen**.

### Hauptvorteile

| Vorteil | Einsparung |
|---------|------------|
| 💰 Dämmungserkenntnisse | 10-30% |
| ⏱️ Vorheizoptimierung | 5-10% |
| 🏠 Thermische Speicherstrategien | 10-25% (mit dynamischen Preisen) |

---

## Was sind Gebäudeerkenntnisse?

Gebäudeerkenntnisse analysieren die Parameter des Gebäudemodells: 4 gelernte Parameter (C, UA, g, P_int), die Zeitkonstante τ = C/UA und die Windkorrektur, die separat gelernt wird:

| Parameter | Symbol | Bedeutung | Typischer Bereich |
|-----------|--------|-----------|-------------------|
| **Thermische Masse** | C | Wärmekapazität - wie viel Energie für 1°C benötigt | 7-30 kWh/°C |
| **Wärmeverlustkoeffizient** | UA | Rate des Wärmeverlusts pro Grad Differenz | 0,05-0,5 kW/°C |
| **Zeitkonstante** | τ (tau) | Wie schnell das Gebäude heizt/kühlt (τ = C/UA) | 20-600 Stunden (Profilwerte) |
| **Solargewinnfaktor** | g | Effektivität der Sonneneinstrahlung | 0,3-0,6 |
| **Interne Wärmegewinne** | P_int | Wärme von Menschen, Geräten, Kochen | 0,2-0,5 kW |
| **Windkorrektur** | W_corr | Zusätzlicher Wärmeverlust bei starkem Wind (v2.7.0+) | 0-50 W/°C |

Das System vergleicht gelernte Werte mit:
- **Ihrem ausgewählten Gebäudeprofil** (Leicht/Mittel/Schwer/Passiv)
- **Typischen Werten für gut gedämmte Gebäude**
- **Ihren Energiepreisdaten** (falls verfügbar)

Bei Optimierungsmöglichkeiten generiert es **Erkenntnisse** mit spezifischen Empfehlungen.

---

## Wie es funktioniert

### Lernphase (1–2 Tage)

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
- Generiert Empfehlungen

### Kontinuierliche Überwachung

- **Passt sich an Jahreszeiten an** (Solargewinn-Multiplikatoren, interne Wärmemuster)
- **Aktualisiert Erkenntnisse** bei Parameterdrift >10%
- **Ratenbegrenzt** zur Vermeidung von "Beratungsmüdigkeit" (max. 1 Erkenntnis pro Kategorie pro Tag)

---

## Sonnenstrahlungsquellen

Das Gebäudemodell verwendet Sonneneinstrahlung, um den Wärmegewinn durch Fenster zu berechnen. Ab Version 2.7.0 unterstützt das System **drei Datenquellen** mit automatischer Priorisierung.

### Der Solargewinnfaktor (g)

Der **g-Faktor** (0,3-0,6) bestimmt, wie viel der einfallenden Sonnenstrahlung Ihr Gebäude effektiv erwärmt:

| g-Wert | Bedeutung | Typisches Gebäude |
|--------|-----------|-------------------|
| **0,3** | Wenig Solargewinn | Kleine Fenster, Nord-Ausrichtung |
| **0,45** | Durchschnittlicher Solargewinn | Standardwohnung |
| **0,6** | Hoher Solargewinn | Große Fenster nach Süden |

**Formel:** `Solargewinn (kW) = g × Sonneneinstrahlung (W/m²) / 1000 × Effektive Fensterfläche`

### Sonneneinstrahlung Prioritätskaskade (v2.7.0)

Das System wählt automatisch die beste verfügbare Quelle:

```
┌─────────────────────────────────────────────────────────────┐
│  PRIORITÄT 1: Solarpanels                                   │
│  - Genaueste Echtzeitdaten                                  │
│  - Umgerechnet in Strahlung: P_panel / Wp × 1000 W/m²       │
│  - Erfordert: Flow-Karte "Externe Solarleistung empfangen"  │
└─────────────────────────────────────────────────────────────┘
                         ↓ (nicht verfügbar)
┌─────────────────────────────────────────────────────────────┐
│  PRIORITÄT 2: KNMI Strahlungsdaten                          │
│  - Tatsächlich gemessene Strahlung                          │
│  - Erfordert: Flow-Karte "Externe Sonneneinstrahlung"       │
│  - Quelle: z.B. Wetter-App oder Wetterstation-Integration   │
└─────────────────────────────────────────────────────────────┘
                         ↓ (nicht verfügbar)
┌─────────────────────────────────────────────────────────────┐
│  PRIORITÄT 3: Sinusförmige Schätzung (Fallback)             │
│  - Berechnet basierend auf Zeit und Datum                   │
│  - Formel: max(0, sin(π × (Stunde-6)/12)) × Spitzenwert     │
│  - Jahreszeitabhängige Spitzenwerte (Winter 200, Sommer 800)│
└─────────────────────────────────────────────────────────────┘
```

### Jahreszeitenkorrektur (g-Multiplikator)

Die Einstellung **"Jahreszeitlicher Solargewinn (g)"** passt die Effektivität der Sonneneinstrahlung pro Jahreszeit an:

| Monat | Multiplikator | Grund |
|-------|---------------|-------|
| Dez-Feb | 60% | Tiefe Wintersonne, viel Bewölkung |
| Mär, Nov | 80% | Übergangsperioden |
| Apr, Okt | 100% | Referenz-Baseline |
| Mai, Sep | 120% | Höhere Sonne, besserer Einfallswinkel |
| Jun-Aug | 130% | Maximale Sommereinstrahlung |

> [!IMPORTANT]
> **Automatische Erkennung (v2.7.0):** Die Jahreszeitenkorrektur wird **nur** bei geschätzter Strahlung angewendet. Bei Verwendung von Solarpanels oder KNMI-Daten wird die Korrektur automatisch deaktiviert, da diese Quellen bereits den tatsächlichen Jahreszeiten- und Wettereffekt enthalten.

### Welche Quelle verwenden?

| Quelle | Vorteile | Nachteile | Setup |
|--------|----------|-----------|-------|
| **Solarpanels** | Am genauesten, Echtzeit | Erfordert Solarpanel-Integration | Flow: Panel → ADLAR |
| **KNMI** | Gemessene Daten, keine Panels nötig | Kann 10-60 Min verzögert sein | Flow: Wetter-App → ADLAR |
| **Schätzung** | Kein Setup nötig, immer verfügbar | Weniger genau bei Bewölkung | Automatisch aktiv |

**Empfehlung:** Wenn Sie Solarpanels haben, leiten Sie deren Leistung weiter. Ansonsten ist die sinusförmige Schätzung mit Jahreszeitenkorrektur für die meisten Situationen ausreichend genau.

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
> „🔴 High loss • Roof/walls/windows"

**Wann es auslöst:**
- Vertrauen ≥ 70%
- UA > 1,5× Profil-UA **ODER** UA > 0,5 kW/°C (absolute Schwelle)

**Was zu tun ist:**
1. **Messung überprüfen** - Prüfen, ob Türen/Fenster während des Lernens offen standen
2. **Upgrades priorisieren** - Dachdämmung bietet höchsten ROI
3. **Nachtabsenkung implementieren** - Wärmeverlust während unbewohnter Stunden reduzieren

---

### 2. ⏱️ Vorheiz-Strategie-Erkenntnisse

**Was erkannt wird:** sechs Reaktionsklassen, basierend auf τ (die Erkenntnis erscheint auf Englisch):

| Reaktion | τ | Beispiel-Erkenntnis |
|---|---|---|
| Sehr schnell | <5h | Very fast (~2 hours for 2°C) |
| Schnell | 5–10h | Fast (~4 hours for 2°C) |
| Normal | 10–20h | Normal (~8 hours for 2°C) |
| Langsam | 20–40h | Slow (~16 hours for 2°C) |
| Sehr langsam | 40–80h | Very slow (~24 hours for 2°C) |
| Extrem langsam | ≥80h | Extremely slow (~32 hours for 2°C) |

Bei τ über 250 Stunden (z. B. Passivhaus) erscheint keine Vorheiz-Erkenntnis.

---

### 3. 💰 Thermische Speicheroptimierungs-Erkenntnisse

**Was erkannt wird:**
- Gebäude mit hoher thermischer Masse (C > 18 kWh/°C) mit langsamer Reaktion (τ > 12h)
- Fähigkeit, Energie in günstigen Stunden zu speichern, in teuren Stunden abzuschalten

**Beispiel-Erkenntnis (mit dynamischen Preisen):**
> „💰 Thermisches Speicherpotenzial - C=24 kWh/°C, τ=18h"

**Beispiel-Empfehlung:**
> „🟢 Large buffer • Low loss"

**Beispiel-Erkenntnis (ohne dynamische Preise):**
> „💡 Gebäude geeignet für thermische Speicherung - C=24 kWh/°C, τ=18h"

**Beispiel-Empfehlung:**
> „🟢 Large buffer • Low loss • Add dynamic pricing"

---

### 4. 🔄 Gebäudeprofil-Abweichung (Diagnose)

**Was erkannt wird:**
- Ausgewähltes Gebäudeprofil stimmt nicht mit gelerntem Verhalten überein
- >30% Abweichung in Zeitkonstante (τ)

**Beispiel-Erkenntnis:**
> „🔄 Gebäude verhält sich wie 'schwer' (τ=80h vs 'mittel' τ=50h)"

**Beispiel-Empfehlung:**
> „Ändern Sie das Gebäudeprofil in den Geräteeinstellungen auf 'schwer' für schnelleres Lernen und bessere Anfangsparameter"

**Profileigenschaften:**

| Profil | C (kWh/°C) | UA (kW/°C) | τ (Stunden) | Gebäudetyp |
|--------|-----------|-----------|-------------|------------|
| **Leicht** | 7 | 0,35 | 20 | Holzrahmen, Basisdämmung, schnelle Temp-Änderungen |
| **Mittel** | 15 | 0,30 | 50 | Ziegel, Hohlwände, Doppelverglasung (typisch NL) |
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
2. **„Vorheizzeit-Empfehlung"** — Triggert wenn ΔT > 1.5°C (max 1x pro 4 Stunden)
3. **„Gebäudeprofil-Abweichung erkannt"** — Einmaliger Trigger

### Erkenntnislebenszyklus

| Status | Symbol | Beschreibung |
|--------|--------|--------------|
| Neu | 🆕 | Gerade erkannt, Benachrichtigung gesendet |
| Aktiv | ✅ | In Capabilities angezeigt |
| Bestätigt | 👀 | Benutzer hat es gesehen |
| Abgelehnt | 🚫 | Für 30 Tage ausgeblendet |
| Gelöst | ✔️ | Maßnahme implementiert |

### Blockiert

Kann das Gebäudemodell vorübergehend nicht lernen, zeigen die Erkenntnisse **🚫
Blockiert: …** mit dem Grund.

- **Fehlende Quelle oder Einstellung** (keine Innen- oder Außentemperatur, keine
  Leistung, Lernen deaktiviert): sofort sichtbar, da hier eine Aktion von Ihnen
  nötig ist.
- **Kurze Unterbrechung im normalen Betrieb** (keine COP-Messung beim
  Kompressorstart, Abtauen, Warmwasser, Zusatzheizung): erst sichtbar, wenn sie
  länger als 30 Minuten anhält (ab 3.4.3). Bis dahin bleibt die normale
  Erkenntnis stehen.

### Prioritätssystem

Erkenntnisse werden 0-100 bewertet basierend auf:
- **Vertrauen** (30%) — Modellsicherheit
- **Energieeinsparungspotenzial** (40%) — anhand der Art der Erkenntnis
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
| **Kurzfristig** (1-3 Monate) | ✅ Angebote für Dachdämmung einholen (€3000-6000)<br/>✅ Hohlwanddämmung erwägen (€1500-3000)<br/>✅ Fenster auf HR++ Glas bewerten |
| **Langfristig** (6-12 Monate) | ✅ Umfassendes Dämmungspaket planen<br/>✅ Förderungen prüfen (BAFA, KfW, lokale Programme) |

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

UND {{priority}} ist größer als 70

DANN
  Benachrichtigung senden:
    „💰 Energieeinsparungsmöglichkeit!"
    „{{insight}}"
    „Maßnahme: {{recommendation}}"
```

---

### Flow 4: Profil-Abweichung Auto-Korrektur

```
WENN Gebäudeprofil-Abweichung erkannt

UND {{deviation_percent}} ist größer als 40

DANN
  1. Geräteeinstellung "building_profile" auf {{suggested_profile}} ändern
  2. Benachrichtigung:
     "Gebäudeprofil aktualisiert von {{current_profile}} auf {{suggested_profile}}"
```

---

### Flow 5: Erkenntnisanalyse erzwingen (On-Demand)

```
WENN Benutzer die virtuelle Taste "Gebäude jetzt analysieren" drückt
  (oder täglich um 08:00 für den Morgenbericht)

DANN
  1. Erkenntnisanalyse erzwingen
     (Aktion: Force insight analysis)
     Rückgabe: {{insights_detected}}, {{confidence}}

  2. WENN {{insights_detected}} ist größer als 0
     DANN Benachrichtigung:
       "Gebäudeanalyse: {{insights_detected}} Erkenntnis(se) gefunden"
       "Modellvertrauen: {{confidence}}%"
```

**Use case:** Sofort nach größeren Änderungen (Wetter, Einstellungen) prüfen, ohne 50 Minuten zu warten.


---

### Flow 6: Thermische Speicherung nur wenn aktiv (Condition)

```
WENN Günstigster Energieblock gestartet
  (von der Energy Prices App)

UND Thermische Speicher-Erkenntnis ist aktiv
  (Bedingung: Insight is active - category "thermal_storage")

DANN
  Zieltemperatur um 2°C erhöhen
  Benachrichtigung: "Thermische Speicherung: Vorheizen aktiv"

SONST
  (Keine Aktion - thermische Speicherung für dieses Gebäude nicht möglich)
```

**Use case:** Bedingte Automatisierung - thermische Speicherstrategie nur anwenden, wenn Gebäude geeignet ist.

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
- `estimated_savings_eur_month` (number) - Seit 3.4.2 nicht mehr berechnet, immer 0 (bleibt bestehen, damit vorhandene Flows weiter funktionieren)

**Häufigkeit:** Max. 1× pro Kategorie pro 24 Stunden (Beratungsmüdigkeitsprävention)

---

#### 2. Vorheizzeit-Empfehlung

**Löst aus:** Wenn ΔT (Ziel - innen) > 1.5°C (max 1x pro 4 Stunden)

**Tokens (v2.6.0):**

- `duration_hours` (number) - Vorheizdauer in Stunden
- `temp_rise` (number) - Benötigter Temperaturanstieg in °C
- `current_temp` (number) - Aktuelle Innentemperatur in °C
- `target_temp` (number) - Zieltemperatur in °C
- `confidence` (number 0-100) - Modellzuverlässigkeit

**Bedingungen:** Nur wenn Vertrauen ≥70%, max 1x pro 4 Stunden

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

### Aktions-Karten (2)

#### 1. Erkenntnisanalyse erzwingen

**Funktion:** Sofortige Auswertung auslösen (nicht auf 50-Min-Intervall warten)

**Rückgabe:**

- `insights_detected` (number) - Anzahl erkannter Erkenntnisse
- `confidence` (number) - Aktuelle Modellzuverlässigkeit

**Verwendung:** On-Demand-Analyse, Debugging, Tagesbericht

---

#### 2. Vorheizdauer berechnen (v2.6.0)

**Funktion:** Berechnet Zeit für X°C Temperaturanstieg

**Parameter:**

- `temperature_rise` (number) - Gewünschter Temperaturanstieg in °C (z.B. 2.0)

**Rückgabe:**

- `preheat_hours` (number) - Vorheizdauer in Stunden
- `confidence` (number) - Modellzuverlässigkeit (%)
- `building_tau` (number) - Thermische Zeitkonstante τ (Stunden)

**Verwendung:** Vorheizen für bestimmte Zeiten planen, thermische Speicher-Automatisierung

**Beispiel-Flow:**
```
WENN Günstigster Preisblock nähert sich (2 Stunden vorher)
DANN
  1. Vorheizdauer berechnen (temperature_rise = 2.0)
  2. IF preheat_hours < 3 THEN
       → Jetzt vorheizen starten
```

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

#### 3. Geschätzte Einsparung ist über Schwelle (veraltet)

Seit 3.4.2 kann diese Bedingung nicht mehr zu neuen Flows hinzugefügt werden. In bestehenden Flows liefert sie immer `false`, weil Erkenntnisse keine Einsparung mehr schätzen: Bei dynamischen Preisen ist die Einsparung vorab nicht bekannt.

---

## Einstellungen

### Erkenntniseinstellungen

**Ort:** Geräteeinstellungen → Gebäudeerkenntnisse & Empfehlungen

| Einstellung | Standard | Bereich | Beschreibung |
|-------------|----------|---------|--------------|
| **Gebäudeerkenntnisse aktivieren** | AN | AN/AUS | Hauptschalter |
| **Mindestvertrauen (%)** | 70% | 50-90% | Schwelle für Anzeige von Erkenntnissen |

> **Hinweis (v2.6.0):** Die Einstellungen `wake_time` und `night_setback_delta` wurden entfernt. Vorheizen wird jetzt dynamisch basierend auf aktuellen Innen/Ziel-Temperaturen berechnet.

### Dynamisches Vorheizen (v2.6.0)

Das System löst automatisch aus, wenn ΔT (Ziel - innen) > 1.5°C:

**Formel:**
```
Vorheiz_Dauer = τ × ln(ΔT / 0.3)
```

**Beispiel:**
- Zieltemperatur: **21°C**
- Innentemperatur: **18°C**
- τ (Zeitkonstante): **10 Stunden**
- ΔT = 21 - 18 = **3°C**

```
Vorheiz_Dauer = 10 × ln(3 / 0.3) = 10 × 2.30 = 23 Stunden → begrenzt
```

**Praktische Ergebnisse:**

| τ (Stunden) | ΔT 2°C | ΔT 3°C | ΔT 4°C |
|-------------|--------|--------|--------|
| 4 | 0.8h | 0.9h | 1.0h |
| 10 | 1.9h | 2.3h | 2.6h |
| 15 | 2.9h | 3.5h | 3.9h |

### Empfohlene Einstellungen nach Benutzertyp

| Typ | Vertrauen |
|-----|-----------|
| **Anfänger** (erste 2 Wochen) | 70% |
| **Fortgeschritten** (nach 1 Monat) | 65% |
| **Experte** (nach 3 Monaten) | 60% |

---

## Fehlerbehebung

### Keine Erkenntnisse nach 48 Stunden

| Ursache | Lösung |
|---------|--------|
| Modellvertrauen <70% | Länger warten (bis zu 72 Stunden) oder Schwelle auf 65% senken |
| Erkenntnisse deaktiviert | Geräteeinstellungen → Gebäudeerkenntnisse aktivieren prüfen |
| Gebäude verhält sich genau wie erwartet | Gute Nachricht! Keine Optimierung nötig |
| Fehlende Datenquellen | Sicherstellen, dass externer Innentemperatursensor verbunden ist |

### Vorheiz-Empfehlung löst nicht aus

| Ursache | Lösung |
|---------|--------|
| Modellvertrauen <70% | Auf Lernen warten |
| Aufwachzeit nicht konfiguriert | Über Geräteeinstellungen setzen |
| Flow-Karte nicht erstellt | Flow mit „Vorheizzeit-Empfehlung" Trigger erstellen |

---

## FAQ

### F: Wie lange dauert das Lernen?

**A:** Etwa 1–2 Tage für 70% Vertrauen (Standardschwelle). Sie können auf 50% senken für frühere Erkenntnisse (weniger genau). Vollständige Konvergenz dauert 1-3 Wochen.

### F: Werden Erkenntnisse aktualisiert, wenn ich die Dämmung verbessere?

**A:** Ja! Das Modell lernt kontinuierlich. Nach Dämmungsupgrades sollte UA über 3-7 Tage sinken. Die „schlechte Dämmung"-Erkenntnis verschwindet und kann durch „ausgezeichnete Dämmung" oder „thermische Speicherungsmöglichkeit" ersetzt werden.

### F: Was, wenn mein Gebäude in kein Profil passt?

**A:** Profile sind nur Startpunkte zur Beschleunigung des Lernens. Nach 48 Stunden überschreiben gelernte Parameter das Profil vollständig.

### F: Warum scheint mein τ (Zeitkonstante) hoch/niedrig?

**A:** τ hängt sowohl von thermischer Masse (C) als auch Wärmeverlust (UA) ab:
- **Hohes τ** (≥80h): Schweres Gebäude (hohes C) ODER ausgezeichnete Dämmung (niedriges UA)
- **Niedriges τ** (<20h): Leichtes Gebäude (niedriges C) ODER schlechte Dämmung (hohes UA)

### F: Warum zeigen Erkenntnisse keinen Einsparungsbetrag?

**A:** Seit 3.4.2 zeigen Erkenntnisse keinen Betrag in Euro mehr. Eine vorhergesagte Einsparung lässt sich nicht belegen: Bei dynamischen Preisen sind die Preise vorab nicht bekannt, und die Wärmepumpe läuft nicht jede Stunde. Messen Sie die tatsächliche Einsparung nachträglich über Homey Energie.

### F: Was passiert, wenn ich Geräteeinstellungen während des Lernens ändere?

**A:** Minimale Auswirkung. Das Modell lernt Gebäudeeigenschaften, nicht Wärmepumpeneinstellungen. Aber vermeiden Sie:
- Gebäudeprofil während des Lernens ändern (setzt Parameter zurück)
- Gebäudemodell zurücksetzen (verliert alle gelernten Daten)
- Häufige Moduswechsel (verwirrt Modell)
