# Adlar Wärmepumpen-App - Konfigurationshandbuch

Dieses Handbuch beschreibt alle konfigurierbaren Einstellungen der Adlar Wärmepumpen Homey App. Jede Einstellung wird mit praktischen Beispielen und Empfehlungen erklärt.

---

## 🔗 Einstellungsgruppen & Abhängigkeiten

| # | Gruppe | Erforderlich | Optional |
|---|--------|--------------|----------|
| 1 | **Verbindungseinstellungen** | - | - |
| 2 | **COP Einstellungen** | - | Leistungsmessung (für Genauigkeit) |
| 3 | **Funktionseinstellungen** | App-Neustart | - |
| 4 | **Flow-Karten-Verwaltung** | App-Neustart | - |
| 5 | **Adaptive Temperaturregelung** | Externer Temp-Sensor | - |
| 6 | **Gebäudemodell-Lernen** | - | - |
| 7 | **Gebäude-Einblicke** | Gebäudemodell ON | Min. Vertrauen |
| 8 | **Energiepreis-Optimierung** | Adaptive Regelung ON, Internet | Dynamischer Tarif |
| 9 | **COP-Optimierung** | COP-Berechnung ON, Adaptive Regelung | 1+ Woche Daten |
| 10 | **Gewichtungsfaktoren** | Adaptive Regelung ON | - |
| 11 | **Diagnose** | - | - |
| 12 | **Energiemanagement** | - | Leistungsmessung |

```
┌──────────────────┐
│ 1. Verbindung    │  Basis - immer erforderlich
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ 2. COP Settings  │────▶│ 9. COP Optimizer │
└──────────────────┘     └──────────────────┘
         │                        ▲
         │                        │
         ▼                        │
┌──────────────────┐              │
│ 5. Adaptive Temp │──────────────┤
│    Control       │              │
└────────┬─────────┘              │
         │                        │
    ┌────┴────┬───────────────────┤
    ▼         ▼                   │
┌────────┐ ┌────────────────┐     │
│ 10.    │ │ 8. Price       │─────┘
│Weights │ │    Optimizer   │
└────────┘ └────────────────┘

┌──────────────────┐     ┌──────────────────┐
│ 6. Building      │────▶│ 7. Building      │
│    Model         │     │    Insights      │
└──────────────────┘     └──────────────────┘
```

---

## 📖 Inhaltsverzeichnis

1. [Verbindungseinstellungen](#1-verbindungseinstellungen)
2. [COP (Leistungszahl) Einstellungen](#2-cop-leistungszahl-einstellungen)
3. [Funktionseinstellungen](#3-funktionseinstellungen)
4. [Flow-Karten-Verwaltung](#4-flow-karten-verwaltung)
5. [Adaptive Temperaturregelung](#5-adaptive-temperaturregelung)
6. [Gebäudemodell-Lernen](#6-gebäudemodell-lernen)
7. [Gebäude-Einblicke & Empfehlungen](#7-gebäude-einblicke--empfehlungen)
8. [Energiepreis-Optimierung](#8-energiepreis-optimierung)
9. [COP-Optimierung](#9-cop-optimierung)
10. [Gewichtungsfaktoren der Adaptiven Regelung](#10-gewichtungsfaktoren-der-adaptiven-regelung)
11. [Diagnose](#11-diagnose)
12. [Energiemanagement](#12-energiemanagement)

---

## 1. Verbindungseinstellungen

Diese Einstellungen sind erforderlich, um Ihre Adlar Wärmepumpe über das lokale Tuya-Protokoll zu verbinden.

### Geräte-ID
- **Funktion**: Eindeutige Identifikation Ihrer Wärmepumpe
- **Format**: Alphanumerischer Code (z.B. `bf1234567890abcdef`)
- **Wie erhalten**: Über Tuya IoT Platform oder während des Pairing-Prozesses
- **Hinweis**: Änderung löst automatische Neuverbindung aus

### Lokaler Schlüssel
- **Funktion**: Sicherheitsschlüssel für verschlüsselte Kommunikation
- **Format**: Hexadezimale Zeichenkette (z.B. `a1b2c3d4e5f6g7h8`)
- **Wie erhalten**: Über Tuya IoT Platform oder während des Pairing-Prozesses
- **Sicherheit**: Verschlüsselt in Homey gespeichert

### IP-Adresse
- **Funktion**: Lokale Netzwerkadresse Ihrer Wärmepumpe
- **Wert**: IPv4-Format (z.B. `192.168.1.100`)
- **Empfehlung**: Setzen Sie eine statische IP-Adresse über Ihren Router (DHCP-Reservierung)
- **Warum statische IP**: Verhindert Verbindungsprobleme nach Router-Neustart

### Protokollversion
- **Funktion**: Tuya-Kommunikationsprotokoll-Version
- **Optionen**:
  - **3.3** (Standard) - Am häufigsten für ältere Geräte
  - **3.4** - Neuere Geräte ab 2020
  - **3.5** - Neuestes Protokoll mit verbesserter Sicherheit
- **Wie wählen**: Überprüfen Sie in der Tuya IoT Platform oder verwenden Sie 3.3 als Standard
- **Automatische Neuverbindung**: Gerät verbindet sich nach Änderung automatisch neu

---

## 2. COP (Leistungszahl) Einstellungen

COP misst die Effizienz Ihrer Wärmepumpe: wie viel Wärme (kW) Sie pro verbrauchtem Strom (kW) erhalten. Beispiel: COP 4.0 bedeutet 4 kW Wärme aus 1 kW Strom.

### COP-Berechnung aktivieren
- **Standard**: Aktiviert
- **Funktion**: Berechnet automatisch die Effizienz Ihrer Wärmepumpe
- **Warum nützlich**:
  - Leistungseinblicke
  - Früherkennung von Problemen (COP < 2.0 kann auf Fehlfunktion hinweisen)
  - Basis für Optimierungsalgorithmen
- **Empfehlung**: Immer aktiviert lassen

### COP-Berechnungsmethode
Die App unterstützt 6 verschiedene Berechnungsmethoden mit unterschiedlicher Genauigkeit:

| Methode | Genauigkeit | Erforderliche Sensoren | Wann verwenden |
|---------|-------------|------------------------|----------------|
| **Auto** (empfohlen) | Beste verfügbare | Automatisch | Standard - wählt beste Methode |
| Direkt thermisch | ±5% | Thermischer Leistungssensor | Am genauesten, falls verfügbar |
| Leistungsmodul | ±8% | Externer Leistungsmesser | Mit Smart Plug oder kWh-Zähler |
| Kältekreis | ±12% | Temperatur- + Drucksensoren | Standard interne Sensoren |
| Carnot-Schätzung | ±15% | Ein-/Ausgangstemperaturen | Theoretische Näherung |
| Ventilkorrelation | ±20% | Ventilpositionen | Basierend auf Systemverhalten |
| Temperaturdifferenz | ±30% | Nur Temperaturen | Am wenigsten genau, Basisschätzung |

### COP-Ausreißererkennung
- **Standard**: Aktiviert
- **Funktion**: Erkennt unrealistische COP-Werte, die auf Folgendes hinweisen:
  - Sensorfehlfunktionen
  - Falsche Messungen
  - Temporäre Systemabweichungen
- **Warum wichtig**: Verhindert, dass fehlerhafte Daten Ihre Durchschnitte und Optimierungen verfälschen

### Minimaler gültiger COP
- **Standard**: 0.5
- **Bereich**: 0.1 - 2.0
- **Funktion**: Werte unter diesem Schwellenwert werden als Ausreißer markiert

### Maximaler gültiger COP
- **Standard**: 8.0
- **Bereich**: 4.0 - 15.0
- **Funktion**: Werte über diesem Schwellenwert werden als Ausreißer markiert

---

## 3. Funktionseinstellungen

Diese Einstellungen bestimmen, welche Funktionen in der Homey-App-Oberfläche sichtbar sind. **Hinweis: Änderungen erfordern App-Neustart und Schließen der App.**

### Kurvensteuerungseinstellungen anzeigen
- **Standard**: Deaktiviert
- **Funktion**: Zeigt/verbirgt Anpassungssteuerungen für Heiz- und Warmwasserkurven
- **Flow-Karten**: Funktionieren immer, unabhängig von dieser Einstellung

### Interne Leistungsmessfähigkeiten
- **Standard**: Deaktiviert
- **Funktion**: Zeigt/verbirgt 9 DPS-Leistungsmessungen (Leistungsaufnahme, Spannung, Strom)
- **Wann aktivieren**: Ihre Wärmepumpe hat eingebaute Leistungsmessung

### Schieberegler-Verwaltungsfähigkeiten
- **Standard**: Deaktiviert
- **Funktion**: Zeigt/verbirgt 3 Schieberegler (Warmwassertemperatur, Wassermodus, Lautstärke)

### Intelligentes Energie-Tracking
- **Standard**: Aktiviert
- **Funktion**: Intelligente Auswahl der Leistungsmessquelle
- **Funktionsweise**:
  1. **Priorität 1**: Externe Leistungsmessung (über Flow-Karte)
  2. **Priorität 2**: Interne Sensoren (falls verfügbar)
- **Homey Energie-Dashboard**: Gerät erscheint automatisch mit genauen Daten

---

## 4. Flow-Karten-Verwaltung

Bestimmt, welche Flow-Karten im Homey Flow-Editor sichtbar sind. **Neustart nach Änderungen empfohlen.**

### Allgemeine Optionen (für alle Kategorien):
- **Deaktiviert**: Flow-Karten immer ausgeblendet
- **Auto** (empfohlen): Nur anzeigen, wenn relevante Sensoren verfügbar sind
- **Erzwungen aktiviert**: Immer anzeigen, auch ohne Sensoren

### Verfügbare Kategorien:
| Kategorie | Standard | Beschreibung |
|-----------|----------|--------------|
| Temperaturbezogene Alarme | Auto | Trigger für Temperaturschwellen |
| Spannungsbezogene Alarme | Auto | Trigger für Spannungsabweichungen |
| Strombezogene Alarme | Auto | Trigger für Stromabweichungen |
| Leistungsbezogene Alarme | Auto | Trigger für Leistungsabweichungen |
| Impuls-Stufen-Alarme | Auto | Trigger für Ventil-/Kompressorpositionen |
| Statusänderungs-Alarme | Auto | Trigger für Betriebsstatusänderungen |
| Effizienz (S)COP-Alarme | Auto | Trigger für COP- und SCOP-Effizienz |

### Expert HVAC-Funktionskarten
- **Standard**: Aktiviert
- **Funktion**: Erweiterte Diagnose-Trigger (Kompressor, Lüfter, Wasserdurchfluss)
- **Zielgruppe**: HVAC-Profis, fortgeschrittene Benutzer

### Täglicher Trennungszähler
- **Standard**: Deaktiviert
- **Funktion**: Zählt, wie oft die Verbindung verloren wurde
- **Capability**: Bei Aktivierung wird der `adlar_daily_disconnect_count`-Sensor zu Ihrem Gerät hinzugefügt
- **Persistenz**: Einstellung bleibt nach App-Updates und Homey-Neustarts erhalten
- **Normaler Wert**: 0-2 pro Tag
- **Problematisch**: > 5 pro Tag → WLAN-Signal verbessern oder statische IP setzen

---

## 5. Adaptive Temperaturregelung

Automatische Zieltemperaturregelung basierend auf externem Innentemperatursensor.

### Adaptive Temperaturregelung aktivieren
- **Standard**: Deaktiviert
- **Funktion**: PI (Proportional-Integral) Regler für stabile Innentemperatur
- **Voraussetzungen**:
  - Externer Temperatursensor (über Flow-Karte)
  - Zieltemperatur eingestellt
  - Flow "Innentemperatur senden" aktiv
- **Leistung**: ±0.3°C Stabilität (Totzone einstellbar)

### PI-Reglerparameter (Experteneinstellungen)

**Nur sichtbar mit aktivierten "Expert HVAC-Funktionskarten"**

#### Proportionalverstärkung (Kp)
- **Standard**: 3.0
- **Bereich**: 0.5 - 10.0
- **Funktion**: Bestimmt, wie schnell das System auf aktuelle Fehler reagiert
- **Höherer Wert**: Schnellere Korrektur, Überschwingungsrisiko
- **Niedrigerer Wert**: Stabilere Regelung, langsamere Korrektur

#### Integralverstärkung (Ki)
- **Standard**: 1.5
- **Bereich**: 0.1 - 5.0
- **Funktion**: Beseitigt anhaltende Abweichungen (stationärer Fehler)

#### Totzone
- **Standard**: 0.3°C
- **Bereich**: 0.1 - 1.0°C
- **Funktion**: Toleranz bevor Anpassungen vorgenommen werden

---

## 6. Gebäudemodell-Lernen

Machine-Learning-Algorithmus, der die thermischen Eigenschaften Ihres Hauses lernt.

### Gebäudemodell-Lernen aktivieren
- **Standard**: Aktiviert
- **Funktion**: Lernt 4 thermische Parameter (C, UA, g, P_int)
- **Lernzeit**: 24-72 Stunden für Basismodell, 2-4 Wochen für genaues Modell
- **Algorithmus**: Recursive Least Squares (RLS) mit Vergessensfaktor

### Vergessensfaktor (Experteneinstellung)
- **Standard**: 0.999
- **Bereich**: 0.990 - 0.9995
- **Funktion**: Wie schnell sich das Modell an Änderungen anpasst. Höher = stabiler, besseres Vertrauen (~75%). Niedriger = schnellere Anpassung an saisonale Änderungen.
- **Nur sichtbar**: Mit aktivierten "Expert HVAC-Funktionskarten"

### Gebäudetyp
- **Standard**: Durchschnitt (typisches NL-Haus)
- **Optionen**:
  - **Leicht**: Holz/Fertigbau, Basisdämmung, schnelle Temp-Änderungen
  - **Durchschnitt**: Ziegel, Hohlwand, Doppelverglasung (typisches NL-Haus)
  - **Schwer**: Beton/Stein, gute Dämmung, HR++-Glas, stabil
  - **Passiv**: Passivhaus, HR+++-Glas, luftdicht, Wärmerückgewinnung

### Gebäudemodell-Lernen zurücksetzen
- **Standard**: Deaktiviert
- **Typ**: Einmalige Aktion (Checkbox)
- **Funktion**: Setzt alle gelernten Gebäudeparameter zurück (C, UA, τ, g, P_int) und startet mit ausgewähltem Gebäudeprofil neu
- **Automatisches Zurücksetzen**: Deaktiviert sich nach dem Zurücksetzen automatisch
- **Wann verwenden**: Diagnose zeigt korrupten Status (negative Werte, 0% Vertrauen mit vielen Proben)

### Dynamische Interne Wärmegewinne
- **Standard**: Aktiviert
- **Funktion**: Berücksichtigt variierende Wärme von Personen/Geräten nach Tageszeit
- **Tagesmuster**:
  - Nacht (23:00-06:00): 40% (Schlaf)
  - Tag (06:00-18:00): 100% (normal)
  - Abend (18:00-23:00): 180% (Kochen, TV)
- **Genauigkeitsverbesserung**: ~10-15%

### Saisonale Solargewinn-Anpassung
- **Standard**: Aktiviert
- **Funktion**: Korrigiert wechselnden Sonnenwinkel im Jahresverlauf
- **Saisonale Multiplikatoren**:
  - Winter (Dez-Feb): 60%
  - Sommer (Jun-Jul): 130%
- **Genauigkeitsbeitrag**: 5-20% der Gesamtwärme

---

## 7. Gebäude-Einblicke & Empfehlungen

Automatisierte Analyse des thermischen Gebäudemodells mit Energiespar-Empfehlungen und ROI-Schätzungen.

### Gebäude-Einblicke aktivieren
- **Standard**: Aktiviert
- **Funktion**: Analysiert thermisches Gebäudemodell und liefert Energiespar-Empfehlungen
- **Lernzeit**: Einblicke erscheinen nach 48-72 Stunden Lernen
- **Voraussetzungen**: Gebäudemodell-Lernen muss aktiviert sein

### Mindestvertrauen
- **Standard**: 70%
- **Bereich**: 50% - 90%
- **Funktion**: Zeigt Einblicke nur, wenn Gebäudemodell-Vertrauen diesen Schwellenwert überschreitet
- **70%**: ~48-72 Stunden Lernen
- **Niedrigere Werte**: Frühere Einblicke, weniger Genauigkeit

### Max Aktive Einblicke
- **Standard**: 3
- **Bereich**: 1 - 5
- **Funktion**: Maximale Anzahl gleichzeitig anzuzeigender Einblicke
- **Priorität**: Wichtigste Einblicke werden zuerst angezeigt

---

## 8. Energiepreis-Optimierung

Automatische Optimierung basierend auf Day-Ahead-Energiepreisen (dynamischer Vertrag erforderlich).

### Preisoptimierung aktivieren
- **Standard**: Deaktiviert
- **Funktion**: Nutzt niedrige Preise, vermeidet hohe Preise
- **Datenquelle**: EnergyZero API (kostenlos, kein Konto erforderlich)
- **Geschätzte Einsparungen**: 400-600€ pro Jahr

### Preisberechnungsmodus
- **Standard**: All-in-Preis (komplette Kosten)
- **Optionen**:
  - **Marktpreis**: Spotpreis + MwSt.
  - **Marktpreis+**: Spotpreis + Anbieteraufschlag + MwSt.
  - **All-in-Preis**: Komplette Kosten inkl. Energiesteuer

### Anbieteraufschlag (€/kWh inkl. MwSt.)
- **Standard**: 0,0182€/kWh
- **Bereich**: 0€ - 0,50€/kWh
- **Funktion**: Ihr Anbieteraufschlag pro kWh, inklusive MwSt.
- **Tipp**: Überprüfen Sie Ihren Energievertrag für diesen Wert

### Energiesteuer (€/kWh inkl. MwSt.)
- **Standard**: 0,11085€/kWh
- **Bereich**: 0€ - 0,50€/kWh
- **Funktion**: Energiesteuer pro kWh, inklusive MwSt.
- **Niederlande 2024**: ~0,11085€

### MwSt.-Prozentsatz
- **Standard**: 21%
- **Bereich**: 0 - 30%
- **Funktion**: MwSt.-Prozentsatz auf Marktpreis angewendet
- **Niederlande**: 21% (Standard), 9% (ermäßigt)

### Preisschwellen

Die Schwellen basieren auf 2024 Spotpreis-Perzentilen:

| Schwelle | Standard | Perzentil | Aktion |
|----------|----------|-----------|--------|
| Sehr Niedrig | 0,04€/kWh | P10 | Maximales Vorheizen (+1,5°C) |
| Niedrig | 0,06€/kWh | P30 | Moderates Vorheizen (+0,75°C) |
| Normal | 0,10€/kWh | P70 | Halten (0°C Anpassung) |
| Hoch | 0,12€/kWh | P90 | Leichte Reduzierung (-0,5°C) |

> [!NOTE]
> Preise über dem "Hoch"-Schwellenwert lösen "Sehr hoch"-Aktion mit -1,0°C Reduzierung aus.

### Maximaler Vorheiz-Offset
- **Standard**: 1,5°C
- **Bereich**: 0,0 - 3,0°C
- **Funktion**: Begrenzt, wie viel wärmer als gewünscht während sehr niedriger Preisperioden

### Tageskostenwarnung-Schwelle
- **Standard**: 10€/Tag
- **Bereich**: 1€ - 50€/Tag
- **Funktion**: Löst Flow-Karte bei Überschreitung aus

### Preisblockgröße
- **Standard**: 4 Stunden
- **Bereich**: 1 - 12 Stunden
- **Funktion**: Größe der günstigsten/teuersten Blöcke für Day-Ahead-Planung
- **Verwendet von**: 'Günstigster Block gestartet'-Trigger und Blockerkennung

### Teurer-Block-Warnzeit
- **Standard**: 2 Stunden
- **Bereich**: 1 - 4 Stunden
- **Funktion**: Löst 'teure Periode nähert sich'-Flow N Stunden vor teurem Block aus
- **Verwendung**: Zum Vorheizen des Gebäudes

### Preistrend-Analysefenster
- **Standard**: 6 Stunden
- **Bereich**: 3 - 24 Stunden
- **Funktion**: Anzahl zukünftiger Stunden zur Analyse für Preistrenderkennung (steigend/fallend/stabil)
- **Verwendet von**: 'Preistrend geändert'-Trigger

---

## 9. COP-Optimierung

Automatische Vorlauftemperatur-Optimierung für maximale Effizienz.

### COP-Optimierung aktivieren
- **Standard**: Deaktiviert
- **Funktion**: Lernt optimale Vorlauftemperatur pro Außentemperatur
- **Voraussetzungen**:
  - COP-Berechnung aktiv
  - Mindestens 1 Woche Daten
  - Adaptive Regelung aktiviert
- **Geschätzte Einsparungen**: 200-300€/Jahr
- **Lernzeit**: 2-4 Wochen für zuverlässige Optimierung

### Minimal Akzeptabler COP
- **Standard**: 2,5
- **Bereich**: 1,5 - 4,0
- **Funktion**: Trigger für Optimierungsaktion wenn COP unter Wert fällt

### Ziel-COP
- **Standard**: 3,5
- **Bereich**: 2,0 - 5,0
- **Funktion**: Zielwert für Optimierungsalgorithmus

### Optimierungsstrategie
- **Standard**: Ausgewogen (empfohlen)
- **Optionen**:
  - **Konservativ**: Langsam, sicher - kleine Schritte, lange Beobachtung
  - **Ausgewogen**: Moderate Schritte, normale Beobachtung (empfohlen)
  - **Aggressiv**: Schnell, experimentell - große Schritte, schnelle Iteration

---

## 10. Gewichtungsfaktoren der Adaptiven Regelung

Diese vier Prioritäten bestimmen gemeinsam, wie das System Entscheidungen trifft. **Werte werden automatisch auf insgesamt 100% normalisiert.**

### Komfort-Priorität
- **Standard**: 50%
- **Bereich**: 0 - 100%
- **Funktion**: Gewicht für PI-Temperaturregelung
- **Hoher Komfort** (70-80%): Temperatur immer stabil innerhalb ±0,3°C

### Effizienz-Priorität
- **Standard**: 15%
- **Bereich**: 0 - 100%
- **Funktion**: Gewicht für COP-Optimierung
- **Hohe Effizienz** (30-40%): Fokus auf maximalen COP

### Kosten-Priorität
- **Standard**: 15%
- **Bereich**: 0 - 100%
- **Funktion**: Gewicht für Preisoptimierung
- **Dynamischer Multiplikator** (v2.6.0):
  - HOHE Preise (reduzieren): Gewicht ×2,0 bis ×3,0
  - NIEDRIGE Preise (vorheizen): Gewicht ×1,2 bis ×1,5
- **Hohe Kosten** (25-35%): Maximale Einsparungen bei Energiekosten

### Thermische Vorhersage-Priorität
- **Standard**: 20%
- **Bereich**: 0 - 50%
- **Funktion**: Gewicht für thermische Vorhersagen (τ/C/UA)
- **Voraussetzungen**: Gebäudemodell-Vertrauen ≥50%
- **0%**: Deaktiviert (kein Einfluss vom Gebäudemodell)

**Praktische Profile**:

| Profil | Komfort | Effizienz | Kosten | Thermisch | Anwendungsfall |
|--------|---------|-----------|--------|-----------|----------------|
| Familie mit Baby | 80% | 5% | 5% | 10% | Max Komfort |
| Homeoffice | 50% | 15% | 15% | 20% | Ausgewogen (Standard) |
| Budget-Fokus | 35% | 10% | 35% | 20% | Dynamischer Vertrag |
| Oft Abwesend | 30% | 40% | 10% | 20% | Max Effizienz |

---

## 11. Diagnose

Werkzeuge zur Fehlerbehebung und Systemanalyse.

### Neuverbindung erzwingen
- **Typ**: Einmalige Aktion (Checkbox)
- **Funktion**: Sofortige Neuverbindung zum Tuya-Gerät
- **Wann verwenden**:
  - Status zeigt "Getrennt"
  - Nach WLAN-Router-Neustart
  - Nach Wärmepumpen-Firmware-Update

### Kapazitätsdiagnose-Bericht generieren
- **Typ**: Einmalige Aktion (Checkbox)
- **Funktion**: Detaillierte Übersicht aller Kapazitätsstatus
- **Ausgabe**: In Homey App-Logs protokolliert

### Log-Level
- **Standard**: ERROR (für Produktion empfohlen)
- **Optionen**:
  - **ERROR**: Nur kritische Fehler (empfohlen)
  - **WARN**: Fehler + Warnungen
  - **INFO**: Fehler + Warnungen + wichtige Ereignisse
  - **DEBUG**: Alle Logs (Fehlerbehebung) - temporär verwenden!

---

## 12. Energiemanagement

Verwaltung von Energiezählern für Tracking und Berichterstattung.

### Externen Energie-Gesamtzähler zurücksetzen
- **Typ**: Einmalige Aktion (Checkbox)
- **Funktion**: Setzt den kumulativen Energiezähler auf Null
- **Datenquelle**: Messungen über Flow-Karte "Externe Leistungsmessung eingeben"
- **Hinweis**: Aktion ist irreversibel, Daten gehen verloren

### Externen Energie-Tageszähler zurücksetzen
- **Typ**: Einmalige Aktion (Checkbox)
- **Funktion**: Setzt den täglichen Energiezähler auf Null
- **Automatisches Zurücksetzen**: Erfolgt normalerweise automatisch um 00:00 Uhr

---

## 💡 Häufige Konfigurationsszenarien

### Szenario 1: "Ich möchte einfach eine stabile Raumtemperatur"
```
✅ Adaptive Temperaturregelung: EIN
   - Kp: 3,0, Ki: 1,5, Totzone: 0,3°C
✅ Gebäudemodell-Lernen: EIN
   - Gebäudetyp: Durchschnitt (oder Ihr Typ)
   - Dynamisches P_int: EIN
   - Saisonales g: EIN
❌ Preisoptimierung: AUS (erst Komfort unter Kontrolle bringen)
❌ COP-Optimierung: AUS (erst System stabilisieren lassen)

Prioritäten:
- Komfort: 80%
- Effizienz: 5%
- Kosten: 5%
- Thermisch: 10%
```

### Szenario 2: "Maximale Einsparungen, habe dynamischen Vertrag"
```
✅ Adaptive Temperaturregelung: EIN
✅ Gebäudemodell-Lernen: EIN
✅ Preisoptimierung: EIN
   - Preisberechnungsmodus: All-in-Preis
   - Schwellen: Vertragsprozentsätze prüfen
   - Max Vorheizen: 1,5°C
✅ COP-Optimierung: EIN (nach 2 Wochen)
   - Min COP: 2,5
   - Ziel: 3,5
   - Strategie: Ausgewogen

Prioritäten:
- Komfort: 35%
- Effizienz: 10%
- Kosten: 35%
- Thermisch: 20%
```

### Szenario 3: "Passivhaus, Effizienz ist entscheidend"
```
✅ Adaptive Temperaturregelung: EIN
   - Kp: 2,0 (niedriger für langsame thermische Masse)
   - Ki: 1,0
   - Totzone: 0,5°C (mehr Toleranz)
✅ Gebäudemodell-Lernen: EIN
   - Gebäudetyp: Passiv
   - Vergessensfaktor: 0,999 (langsame Anpassung)
✅ COP-Optimierung: EIN
   - Strategie: Aggressiv (Passivhaus toleriert Experimente)

Prioritäten:
- Komfort: 25%
- Effizienz: 40%
- Kosten: 10%
- Thermisch: 25%
```

### Szenario 4: "Oft abwesend, minimale Überwachung"
```
✅ Intelligentes Energie-Tracking: EIN
✅ COP-Berechnung: EIN
   - Ausreißererkennung: EIN
✅ Gebäudemodell: EIN (für Einblicke)
❌ Alle Optimierung: AUS (einrichten und vergessen)
✅ Flow-Alarme: Auto
✅ Tageskostenschwelle: 10€ (Benachrichtigung bei hohen Kosten)

Flows verwenden für:
- Benachrichtigung wenn COP < 2,0 (mögliches Problem)
- Benachrichtigung wenn Trennung > 5/Tag
- Benachrichtigung wenn Tageskosten > 10€
```

---
