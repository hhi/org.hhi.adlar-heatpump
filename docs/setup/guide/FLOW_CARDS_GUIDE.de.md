# Flow-Karten Implementierungsleitfaden: Basis Device Flow Cards (v2.7.x)

> **Scope**: Dieser Leitfaden dokumentiert **Basis-Device-Flow-Karten** für Geräte-Monitoring, Energy Tracking und Calculatoren.
> **Erweiterte Features**: Siehe [Advanced Flow Cards Guide](../advanced-control/ADVANCED_FLOWCARDS_GUIDE.de.md) für adaptive Regelung, Gebäudemodell, COP-Optimierer, Energieoptimierer, Gebäudeerkenntnisse und Wind/Solar-Integration.

Dieser Leitfaden bietet praktische Beispiele, Konfigurationstipps und Hilfe zur Fehlerbehebung für die Basis-Flow-Karten der Adlar Wärmepumpen-App.

---

## Übersicht

Version 1.0.7 führt **5 neue Flow-Karten** ein, die kritische Funktionslücken schließen, die während des umfassenden Flow-Karten-Audits identifiziert wurden:

| Flow-Karte | Typ | Kategorie | Priorität |
|------------|-----|-----------|-----------|
| `fault_detected` | Trigger | Gerätesicherheit | 🔴 Kritisch |
| `power_threshold_exceeded` | Trigger | Energieverwaltung | 🔴 Kritisch |
| `total_consumption_milestone` | Trigger | Zielverfolgung | 🔴 Kritisch |
| `cop_efficiency_check` | Bedingung | Leistung | 🔴 Kritisch |
| `daily_cop_above_threshold` | Bedingung | Leistung | 🔴 Kritisch |
| `monthly_cop_above_threshold` | Bedingung | Leistung | 🔴 Kritisch |

Zusätzlich wurde **1 bestehende Flow-Karte** als produktionsreif verifiziert:
- `temperature_differential` (Bedingung) - Systemzustand ✅

---

## Trigger

### 1. 🚨 Störung erkannt

**ID**: `fault_detected`
**Kategorie**: Gerätesicherheit
**Wann es auslöst**: Wenn die Wärmepumpe eine Systemstörung meldet (DPS 15 > 0)

#### Konfiguration

```yaml
WENN: Störungscode [fault_code] erkannt
```

**Parameter**:
- `fault_code` (Bereich 1-100): Spezifischer Störungscode zur Überwachung
  - Leer lassen, um bei JEDER Störung auszulösen
  - Code angeben (z.B. 3), um nur bei dieser Störung auszulösen

**Verfügbare Tokens**:
- `fault_code` (number): Die Störungscodenummer
- `fault_description` (string): Menschenlesbare Beschreibung in Ihrer Sprache

#### Unterstützte Störungscodes

| Code | Deutsch | English |
|------|---------|---------|
| 0 | Keine Störung | No fault |
| 1 | Hochdruckschutz | High pressure protection |
| 2 | Niederdruckschutz | Low pressure protection |
| 3 | Kompressor-Überhitzung | Compressor overheating |
| 4 | Austrittstemperatur zu hoch | Discharge temperature too high |
| 5 | Wasserdurchflusssensor-Störung | Water flow sensor fault |
| 6 | Einlasstemperatursensor-Störung | Inlet temperature sensor fault |
| 7 | Auslasstemperatursensor-Störung | Outlet temperature sensor fault |
| 8 | Umgebungstemperatursensor-Störung | Ambient temperature sensor fault |
| 9 | Spulentemperatursensor-Störung | Coil temperature sensor fault |
| 10 | Niedriger Wasserdurchfluss-Schutz | Low water flow protection |
| 11 | Frostschutz aktiv | Antifreeze protection active |
| 12 | Phasenverlust oder umgekehrte Phase | Phase loss or reverse phase |
| 13 | Kommunikationsfehler | Communication error |
| 14 | EEV-Ventil-Störung | EEV valve fault |
| 15 | Systemdruck abnormal | System pressure abnormal |

#### Beispiel-Flows

**Kritische Störungsbenachrichtigung**:
```
WENN: Störung erkannt
  UND fault_code ist 1, 2, 3 oder 4
DANN: Benachrichtigung senden "Kritische Wärmepumpenstörung: {{fault_description}}"
  UND Gerät ausschalten
  UND E-Mail an Wartung senden
```

**Sensor-Störung Auto-Wiederherstellung**:
```
WENN: Störung erkannt
  UND fault_code ist 6, 7, 8 oder 9
DANN: 5 Minuten warten
  UND Gerät neu starten
  UND Prüfen, ob Störung behoben
```

**Frostschutz-Alarm**:
```
WENN: Störung erkannt
  UND fault_code ist 11
DANN: Benachrichtigung senden "Frostschutz aktiviert"
  UND Zieltemperatur um 2°C erhöhen
```

#### Technische Details

- **Erkennung**: Überwacht DPS 15 (`adlar_fault` Capability)
- **Trigger-Logik**: Löst nur bei **neuen** Störungen aus (Änderungserkennung)
- **Deduplizierung**: Gleicher Störungscode löst nicht erneut aus, bis behoben (Code kehrt zu 0 zurück)
- **Sprachunterstützung**: Störungsbeschreibungen automatisch lokalisiert (EN/NL/DE)
- **Leistung**: Kein Overhead, wenn keine Störung vorhanden

#### Fehlerbehebung

**Problem**: Störungstrigger löst wiederholt für dieselbe Störung aus
**Lösung**: Sollte wegen Änderungserkennung nicht passieren. Gerätelogs auf Störungscode-Oszillation prüfen.

**Problem**: Störungsbeschreibung zeigt "Unknown fault (code: X)"
**Lösung**: Störungscode ist nicht in der Standard-Mappingtabelle. Code an Entwickler melden zur Ergänzung.

---

### 2. ⚡ Leistungsschwelle überschritten

**ID**: `power_threshold_exceeded`
**Kategorie**: Energieverwaltung
**Wann es auslöst**: Wenn der Stromverbrauch den konfigurierten Schwellenwert überschreitet

#### Konfiguration

```yaml
WENN: Stromverbrauch überschritt [threshold] W
```

**Parameter**:
- `threshold` (100-10000W): Leistungsschwelle in Watt
  - Standard: 3000W
  - Empfohlen: Auf 120% des normalen Maximums setzen

**Verfügbare Tokens**:
- `current_power` (number): Aktueller Stromverbrauch in Watt
- `threshold_power` (number): Der konfigurierte Schwellenwert

#### Intelligente Funktionen

**Hysterese-Schutz** (5%):
- Einmal bei 3000W ausgelöst, muss unter 2850W fallen, um zurückzusetzen
- Verhindert Trigger-Spam bei Leistungsschwankungen
- Beispiel: 2990W → 3010W → TRIGGER → 2995W → (kein erneutes Auslösen)

**Ratenbegrenzung** (5 Minuten):
- Maximum 1 Trigger pro 5 Minuten
- Verhindert Benachrichtigungsflut bei anhaltender Überlast
- Protokolliert rate-limitierte Ereignisse für Diagnose

#### Beispiel-Flows

**Hoher Verbrauchsalarm**:
```
WENN: Leistungsschwelle überschritten 3500W
DANN: Benachrichtigung senden "Hoher Stromverbrauch: {{current_power}}W"
  UND In Google Sheets mit Zeitstempel protokollieren
```

**Überlastschutz**:
```
WENN: Leistungsschwelle überschritten 4500W
DANN: Zieltemperatur um 2°C senken
  UND 5 Minuten warten
  UND Prüfen, ob Leistung unter 4000W gefallen
```

**Zeit-der-Nutzung-Optimierung**:
```
WENN: Leistungsschwelle überschritten 3000W
  UND Zeit ist zwischen 17:00 und 21:00 (Spitzenzeiten)
DANN: In Economy-Modus wechseln
  UND Benachrichtigung senden "Während Spitzenzeiten auf Economy-Modus umgeschaltet"
```

---

### 3. 🎯 Gesamtverbrauchs-Meilenstein

**ID**: `total_consumption_milestone`
**Kategorie**: Zielverfolgung
**Wann es auslöst**: Wenn der kumulierte Energieverbrauch 100 kWh-Meilensteine erreicht

#### Konfiguration

```yaml
WENN: Gesamtverbrauch erreichte [milestone] kWh
```

**Parameter**:
- `milestone` (100-50000 kWh): Meilensteinwert
  - Auto-Trigger bei: 100, 200, 300, ..., 1000, 1100, usw.
  - **Inkrement**: Fest auf 100 kWh-Schritte

**Verfügbare Tokens**:
- `total_consumption` (number): Aktueller Gesamtverbrauch in kWh
- `milestone_value` (number): Der erreichte Meilenstein

#### Meilenstein-Verhalten

**Erstes Aufholen**:
Bei Installation der App mit bestehendem Verbrauch (z.B. 523 kWh):
- Löst für ALLE Meilensteine aus: 100, 200, 300, 400, 500
- Dies ist beabsichtigt, um verpasste Meilensteine aufzuholen
- Nachfolgende Meilensteine lösen normal aus (nur neue)

**Deduplizierung**:
- Jeder Meilenstein löst nur einmal aus (jemals)
- Verfolgt im Gerätespeicher: `triggered_energy_milestones`
- Überlebt App-Neustarts und Updates
- Kann bei Bedarf manuell zurückgesetzt werden

#### Beispiel-Flows

**Monatliches Budget-Tracking**:
```
WENN: Meilenstein erreicht 300 kWh
DANN: Benachrichtigung senden "Monatliches Budget erreicht: {{total_consumption}} kWh"
  UND Kosten berechnen: {{total_consumption}} * €0.30
  UND In Insights protokollieren
```

**Saisonales Ziel-Tracking**:
```
WENN: Meilenstein erreicht 1000 kWh
DANN: Benachrichtigung senden "Saison-Meilenstein: {{milestone_value}} kWh"
  UND Mit Vorjahresdaten vergleichen
  UND Effizienzbericht senden
```

---

## Bedingungen

### 4. 🎯 COP-Effizienzprüfung

**ID**: `cop_efficiency_check`
**Kategorie**: Leistungsüberwachung
**Wann es wahr ist**: Wenn aktueller COP den Schwellenwert überschreitet UND Kompressor läuft

#### Konfiguration

```yaml
WENN: COP-Effizienz ist über/unter [threshold]
```

**Parameter**:
- `threshold` (1.0-8.0): COP-Schwellenwert
  - Standard: 2.0
  - Typischer Bereich: 2.5-4.5 für Wärmepumpen
  - Ausgezeichnet: > 4.0, Gut: 3.0-4.0, Schlecht: < 2.5

#### Intelligentes Verhalten

**Kompressorzustandsprüfung**:
- **Gibt `false` zurück, wenn Kompressor im Leerlauf** (auch wenn COP > Schwelle)
- Warum? COP=0 im Leerlauf ist technisch korrekt, aber irreführend in Flows
- Verhindert Fehlalarme in "WENN COP < 2.0" Flows

**Echtzeit-Überwachung**:
- Verwendet die aktuelle `adlar_cop` Capability (alle 30 Sekunden aktualisiert)
- Spiegelt momentane Effizienz wider, keine Durchschnittswerte

#### Beispiel-Flows

**Effizienz-Alarm**:
```
WENN: COP-Effizienz ist unter 2.5
  UND Gerät ist an
DANN: Benachrichtigung senden "Niedrige Effizienz: COP {{adlar_cop}}"
  UND Auf Probleme prüfen
```

**Optimierungs-Trigger**:
```
WENN: COP-Effizienz ist über 4.0
  UND Außentemperatur < 0°C
DANN: Benachrichtigung senden "Ausgezeichnete Effizienz trotz Kälte!"
  UND Als Referenzpunkt protokollieren
```

---

### 5. 📊 Tages-COP über Schwelle

**ID**: `daily_cop_above_threshold`
**Kategorie**: Leistungsüberwachung
**Wann es wahr ist**: Wenn der rollierende 24-Stunden-Durchschnitts-COP den Schwellenwert überschreitet

#### Konfiguration

```yaml
WENN: Tages-COP ist über/unter [threshold]
```

**Parameter**:
- `threshold` (1.0-8.0): Tages-COP-Schwelle
  - Standard: 2.5
  - Empfohlen: 3.0 für gute Tagesleistung

#### Intelligentes Verhalten

**Datenverfügbarkeitsprüfung**:
- **Gibt `false` zurück, wenn unzureichende Daten vorhanden** (dailyCOP = 0)
- Erfordert mindestens 10 Datenpunkte (~5 Minuten Betrieb)
- Verhindert Fehlalarme beim Start

**Gleitender Durchschnitt**:
- Berechnet COP über die letzten 24 Stunden
- Gewichtet nach Laufzeit (Leerlaufzeiten ausgeschlossen)
- Stabiler als Echtzeit-COP

---

### 6. 📈 Monats-COP über Schwelle

**ID**: `monthly_cop_above_threshold`
**Kategorie**: Langzeitleistung
**Wann es wahr ist**: Wenn der rollierende 30-Tage-Durchschnitts-COP den Schwellenwert überschreitet

#### Konfiguration

```yaml
WENN: Monats-COP ist über/unter [threshold]
```

**Parameter**:
- `threshold` (1.0-8.0): Monats-COP-Schwelle
  - Standard: 3.0
  - Ziel: > 3.5 für ausgezeichnete saisonale Leistung

#### Beispiel-Flows

**Monatlicher Bericht**:
```
JEDEN 1. Tag des Monats um 09:00:
WENN: Monats-COP über 3.5
DANN: Benachrichtigung senden "Ausgezeichnete monatliche Effizienz: {{adlar_cop_monthly}}"
  UND Geschätzte Kosten berechnen
  UND Mit vorherigen Monaten vergleichen
```

**Vorausschauende Wartung**:
```
JEDEN MONAT:
WENN: Monats-COP um > 10% gegenüber dem Vormonat gesunken
DANN: Alarm senden "Effizienz sinkt"
  UND Filterprüfung empfehlen
  UND Professionelle Inspektion planen
```

---

### 7. ✅ Temperaturdifferenz

**ID**: `temperature_differential`
**Kategorie**: Systemzustand
**Status**: ✅ **Produktionsreif** (verfügbar in v2.7.x)

#### Konfiguration

```yaml
WENN: Temperaturdifferenz ist über/unter [differential]°C
```

**Parameter**:
- `differential` (1-50°C): Temperaturdifferenzschwelle
  - Typisch: 5-10°C für effizienten Betrieb
  - Zu niedrig (< 3°C): Schlechte Wärmeübertragung
  - Zu hoch (> 15°C): Mögliche Durchflussprobleme

#### Beispiel-Flows

**Wärmeübertragungs-Effizienz**:
```
WENN: Temperaturdifferenz unter 3°C
  UND Kompressor läuft
DANN: Benachrichtigung senden "Schlechte Wärmeübertragung erkannt"
  UND Wasserdurchfluss prüfen
  UND Pumpenfunktion verifizieren
```

**Durchflussproblem-Erkennung**:
```
WENN: Temperaturdifferenz über 15°C
  UND Wasserdurchfluss unter 20 L/min
DANN: Alarm senden "Mögliche Durchflussbeschränkung"
  UND Filterprüfung empfehlen
```

---

## Aktionen

### 8. 🕐 Wert aus Zeitplan berechnen

**ID**: `calculate_time_based_value`
**Kategorie**: Zeitbasierte Automatisierung
**Zweck**: Aktuelle Zeit gegen Tagespläne auswerten, um Ausgabewerte zu berechnen

#### Übersicht

Der Zeitplan-Rechner ermöglicht **Zeit-des-Tages-Programmierung** für automatisierte Temperaturschemata, Zeit-der-Nutzung-Optimierung und tägliche Routinen.

#### Konfiguration

```yaml
AKTION: Wert aus Zeitplan berechnen
  Zeitplan: 06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, 23:00-06:00: 18
  Rückgabe: {{result_value}}
```

**Parameter**:

- `schedule` (text): Zeitplan-Definitionsstring (Komma oder Zeilenumbruch getrennt)

**Rückgabe**:

- `result_value` (number): Berechneter Ausgabewert basierend auf aktueller Zeit

#### Zeitplan-Format

**Syntax**: `HH:MM-HH:MM: ausgabe_wert`

**Funktionen**:
- Unterstützt **Übernacht-Bereiche** (z.B. `23:00-06:00` überspannt Mitternacht)
- Maximum **30 Zeitbereiche** pro Zeitplan
- **Standard-Fallback**-Unterstützung (`default: wert`)
- Komma- oder Zeilenumbruch-getrennte Eingaben

#### Beispiel-Flows

**Tägliche Temperaturprogrammierung**:
```
ALLE 5 MINUTEN:
DANN: Wert aus Zeitplan berechnen
      Zeitplan: 06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, 23:00-06:00: 18
  UND Zieltemperatur auf {{result_value}} setzen
```

**Zeit-der-Nutzung-Optimierung**:
```
JEDEN STUNDE:
DANN: Wert aus Zeitplan berechnen
      Zeitplan: 17:00-21:00: 2500, default: 4000
  UND Maximales Leistungslimit auf {{result_value}}W setzen
```

---

### 9. 🌡️ Saisonmodus abrufen

**ID**: `get_seasonal_mode`
**Kategorie**: Saisonale Automatisierung
**Zweck**: Automatische Erkennung der Heiz-/Kühlsaison basierend auf aktuellem Datum

#### Übersicht

Der Saisonmodus-Rechner bietet **automatische Saisondetektion** abgestimmt auf den EN 14825 SCOP Standard. Perfekt für das Umschalten zwischen Winter- und Sommerzeitplänen ohne manuelle Eingriffe.

#### Konfiguration

```yaml
AKTION: Saisonmodus abrufen
  Rückgabe 4 Tokens:
    - {{mode}} - "heating" oder "cooling"
    - {{is_heating_season}} - true/false
    - {{is_cooling_season}} - true/false
    - {{days_until_season_change}} - Zahl
```

**Parameter**: Keine (verwendet aktuelles Datum)

**Rückgabe**:
- `mode` (string): Aktueller Saisonmodus ("heating" oder "cooling")
- `is_heating_season` (boolean): True wenn 1. Okt - 15. Mai
- `is_cooling_season` (boolean): True wenn 16. Mai - 30. Sep
- `days_until_season_change` (number): Tage bis zur nächsten Saison

#### Saison-Definitionen

**Heizsaison**: 1. Oktober - 15. Mai (227 Tage)
- Ausgerichtet am **EN 14825 SCOP Standard**
- Entspricht dem bestehenden SCOP-Berechnungszeitraum
- Typische europäische Heizsaison

**Kühlsaison**: 16. Mai - 30. September (138 Tage)
- Übergangszeit + Sommer
- Zeitraum mit reduziertem Heizbedarf

#### Beispiel-Flows

**Automatische Zeitplanumschaltung**:
```
JEDEN TAG um 00:00:
DANN: Saisonmodus abrufen
  UND WENN {{is_heating_season}} wahr ist
    DANN: Winterzeitplan aktivieren (hohe Temperaturen)
    SONST: Sommerzeitplan aktivieren (niedrigere Temperaturen)
```

**Saisonwechsel-Benachrichtigung**:
```
JEDEN TAG um 09:00:
DANN: Saisonmodus abrufen
  UND WENN {{days_until_season_change}} < 7
    DANN: Benachrichtigung senden "Saison wechselt in {{days_until_season_change}} Tagen"
```

---

### 10. 📊 Wert aus Kurve berechnen

**ID**: `calculate_curve_value`
**Kategorie**: Dynamische Optimierung
**Zweck**: Ausgabewerte basierend auf Eingabebedingungen mit konfigurierbaren Kurven berechnen

#### Übersicht

Der Kurvenrechner ist ein leistungsstarkes Werkzeug für dynamische Wertberechnungen. Primär für **witterungsgeführte Heizung** (Außentemperatur → Heizungssollwert) konzipiert, ist er vielseitig genug für jedes Eingabe-Ausgabe-Mapping-Szenario.

#### Konfiguration

```yaml
AKTION: Wert aus Kurve berechnen
  Eingabewert: {{outdoor_temperature}}
  Kurvendefinition: < 0 : 55, < 5 : 50, < 10 : 45, default : 35
  Rückgabe: {{result_value}}
```

**Parameter**:

- `input_value` (Zahl oder Ausdruck): Der zu bewertende Eingabewert
- `curve` (text): Kurvendefinitionsstring (Komma oder Zeilenumbruch getrennt)

**Rückgabe**:

- `result_value` (number): Berechneter Ausgabewert basierend auf Kurve

#### Kurvenformat

**Syntax**: `[operator] schwelle : ausgabe_wert`

**Unterstützte Operatoren**:

- `>` - Größer als
- `>=` - Größer oder gleich
- `<` - Kleiner als
- `<=` - Kleiner oder gleich
- `==` - Gleich
- `!=` - Ungleich
- `default` oder `*` - Fallback-Wert (immer passend, als letzte Zeile verwenden)

**Auswertungsregeln**:
1. Wird **von oben nach unten** ausgewertet
2. Gibt die **erste passende** Bedingung zurück
3. Fällt auf `default` zurück, wenn keine Übereinstimmung (empfohlen immer anzugeben)
4. Maximum 50 Einträge pro Kurve

#### Beispiel-Flows

**Witterungsgeführte Heizung** (Hauptanwendungsfall):
```
WENN: Außentemperatur geändert
DANN: Wert aus Kurve berechnen
      Eingabe: {{outdoor_temperature}}
      Kurve: < -5 : 60, < 0 : 55, < 5 : 50, < 10 : 45, < 15 : 40, default : 35
  UND Zieltemperatur auf {{result_value}} setzen
```

**COP-basierte dynamische Anpassung**:
```
WENN: COP geändert
DANN: Wert aus Kurve berechnen
      Eingabe: {{adlar_cop}}
      Kurve: < 2.0 : -5, < 2.5 : -3, >= 3.5 : +2, default : 0
  UND Zieltemperatur um {{result_value}}°C anpassen
```

**Mehrstufige Heizkurve**:
```
WENN: Außentemperatur geändert
DANN: Wert aus Kurve berechnen
      Eingabe: {{outdoor_temperature}}
      Kurve:
        < -10 : 65
        < -5  : 60
        < 0   : 55
        < 5   : 50
        < 10  : 45
        < 15  : 40
        default : 35
  UND Heizungs-Sollwert auf {{result_value}} setzen
```

#### Best Practices

**✅ TUN**:
- Immer `default : <wert>` als letzte Zeile hinzufügen (verhindert Fehler)
- Zeilenumbrüche oder Kommas zur Trennung von Regeln verwenden
- Kurve mit verschiedenen Eingaben testen vor dem Einsatz
- Kurven einfach halten (unter 20 Einträge empfohlen)
- Kurvenlogik in der Flow-Beschreibung dokumentieren

**⚠️ NICHT TUN**:
- 50 Einträge überschreiten (harte Grenze)
- Standard-Fallback vergessen (verursacht Fehler bei keiner Übereinstimmung)
- Heiz-/Kühllogik in derselben Kurve mischen (separate Flows verwenden)
- Auswertungsreihenfolge ignorieren (oben nach unten ist wichtig!)

#### Fehlermeldungen

| Fehlermeldung | Ursache | Lösung |
|---------------|---------|--------|
| `"Input value must be a valid number"` | Ungültiger Eingabe-Tag oder Null-Wert | Eingabe-Token/Variable prüfen |
| `"No matching curve condition found"` | Keine Bedingung passte und kein Standard | `default : <wert>` als letzte Zeile hinzufügen |
| `"Invalid curve syntax at line N"` | Fehlerhafte Bedingung | Format prüfen: `operator schwelle : wert` |
| `"Curve exceeds maximum allowed entries (50)"` | Zu viele Zeilen in der Kurve | Kurve vereinfachen oder in mehrere Flows aufteilen |

---

## Modbus-Modelle: Aurora II und Aurora III

Die App hat für jedes Modell einen eigenen Modbus-Treiber. Viele Flow-Karten gibt es **einmal pro Treiber** mit demselben Titel: Im Flow-Editor sehen Sie die Karten des Treibers des gewählten Geräts. Ein Flow, der für ein Aurora II-Gerät erstellt wurde, funktioniert daher nicht für ein Aurora III-Gerät; erstellen Sie ihn mit der Karte des Aurora III-Geräts neu.

Die folgenden Karten gibt es **nur für Aurora III**.

### 11. 🔥 Erzwungene Zusatzheizung Schalten (Aurora III)

**ID**: `set_backup_heater`
**Typ**: Aktion

```yaml
THEN: Erzwungene Zusatzheizung [ein/aus] schalten
```

**Parameter**:

- `state` (ein/aus): erzwingt die elektrische Zusatzheizung oder gibt sie wieder frei

### 12. 🚿 Warmwasserfunktion Schalten (Aurora III)

**ID**: `set_dhw_function`
**Typ**: Aktion

```yaml
THEN: Warmwasserfunktion [ein/aus] schalten
```

**Parameter**:

- `state` (ein/aus): schaltet die Warmwasserbereitung ein oder aus

### 13. 🤫 Leisemodus Einstellen (Aurora III)

**ID**: `set_silent_mode`
**Typ**: Aktion

```yaml
THEN: Leisemodus einstellen auf [Aus/Stufe 1/Stufe 2]
```

**Parameter**:

- `level` (Aus, Stufe 1, Stufe 2): Stufe des Leisemodus. Stufe 2 ist nur bei R290-Wärmepumpen verfügbar.

### 14. 🚿 Warmwasser Wird Bereitet (Aurora III)

**ID**: `dhw_heating_active`
**Typ**: Bedingung

```yaml
IF: Warmwasser wird (nicht) bereitet
```

### 15. 🤫 Leisemodus Ist (Aurora III)

**ID**: `silent_mode_is`
**Typ**: Bedingung

```yaml
IF: Leisemodus ist (nicht) [Aus/Stufe 1/Stufe 2]
```

#### Beispiel-Flow

**Nachts leise**:

```text
WHEN: Es ist 22:00
THEN: Leisemodus einstellen auf Stufe 1
WHEN: Es ist 07:00
THEN: Leisemodus einstellen auf Aus
```

---

## Einstellungskonfiguration

### Leistungsschwellen-Einstellung

Um benutzerdefinierte Leistungsschwelle zu konfigurieren:
1. Zu Geräteeinstellungen → Erweitert gehen
2. "Leistungsschwelle (W)" Einstellung finden
3. Gewünschte Schwelle setzen (100-10000W)
4. Standard: 3000W

**Hinweis**: Wenn die Einstellung nicht existiert, verwendet der Trigger den hartcodierten Standard (3000W).

---

## Fehlerbehebungsleitfaden

### Allgemeine Probleme

**Flow-Karten nicht sichtbar in Homey App**:
1. App-Version ist 1.0.7 oder höher prüfen
2. Homey App neu starten
3. Flow-Karten-Einstellungen prüfen: Geräteeinstellungen → Flow-Karten-Steuerung
4. Sicherstellen, dass relevante Capability Daten hat (nicht null)

**Trigger löst aus, aber Flows werden nicht ausgeführt**:
1. Prüfen, ob Flow aktiviert ist (nicht pausiert)
2. Flow-Logikbedingungen verifizieren
3. Homeys Flow-Ausführungsprotokolle prüfen
4. Mit einfachem Flow zuerst testen (nur Benachrichtigung)

**Bedingungen geben immer false zurück**:
1. Prüfen, ob Capability gültige Daten hat (nicht null/0)
2. Verifizieren, dass Gerät betriebsbereit ist (nicht offline)
3. Spezifische Bedingungsanforderungen prüfen (z.B. Kompressor läuft für COP)
4. Debug-Modus aktivieren und Protokolle prüfen

### Diagnostische Kommandos

**Capability-Werte prüfen**:
```javascript
// In Homey Developer Tools → Device Capabilities
adlar_cop // Sollte aktuellen COP anzeigen
adlar_fault // Sollte 0 (keine Störung) oder Störungscode anzeigen
measure_power // Sollte aktuelle Leistung in Watt anzeigen
meter_power.electric_total // Sollte kumulative kWh anzeigen
```

**Getriggerte Meilensteine prüfen**:
```javascript
// In Homey Developer Tools → Device Storage
triggered_energy_milestones // Array der getriggerten Meilensteine
```

---

## Best Practices

### Flow-Design

**1. Angemessene Granularität verwenden**:
- Echtzeit-COP: Für sofortige Warnungen
- Tages-COP: Für Tagesberichte
- Monats-COP: Für Trendanalyse

**2. Bedingungen kombinieren**:
```
WENN: COP unter 2.0
  UND Leistung über 3000W
  UND Läuft seit > 15 Minuten
DANN: Untersuchen (nicht normal, niedrigen COP mit hoher Leistung zu haben)
```

**3. Hysterese in Flows hinzufügen**:
```
WENN: Leistungsschwelle überschritten
DANN: 5 Minuten warten
  UND WENN noch über Schwelle
    DANN Maßnahme ergreifen
```

**4. Für Analyse protokollieren**:
```
WENN: Jeder Effizienz-Trigger
DANN: In Insights mit allen relevanten Daten protokollieren
  - Zeitstempel
  - COP-Wert
  - Außentemperatur
  - Leistungsaufnahme
```

### Benachrichtigungsverwaltung

**Spam verhindern**:
- Ratenbegrenzung verwenden (eingebaut für Leistungs-/Störungstrigger)
- Zeitbasierte Bedingungen hinzufügen (nicht zwischen 22:00-08:00)
- Mehrere Prüfungen vor dem Benachrichtigen kombinieren

**Alarme priorisieren**:
- Kritisch: Störungen, Leistungsüberlastung → Sofortige Benachrichtigung
- Warnung: Niedriger COP, hoher Verbrauch → Tägliche Zusammenfassung
- Info: Meilensteine, gute Leistung → Wöchentliche Zusammenfassung
