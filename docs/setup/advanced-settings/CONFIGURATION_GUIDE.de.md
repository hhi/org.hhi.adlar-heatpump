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
| 5 | **Adaptive Regelung** (sechs Gruppen; Gewichtungsfaktoren: Zeile 10) | Raumtemperatur über Flow-Karte, Gewünschte Innentemperatur | - |
| 6 | **Gebäudemodell-Lernen** | - | - |
| 7 | **Gebäude-Einblicke** | Gebäudemodell ON | Min. Vertrauen |
| 8 | **Energiepreis-Optimierung** | Adaptive Regelung ON, Internet | Dynamischer Tarif |
| 9 | **COP-Optimierung** | COP-Berechnung ON, Adaptive Regelung | 1+ Woche Daten |
| 10 | **Adaptive Regelung: Gewichtungsfaktoren** | Adaptive Regelung ein | - |
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
5. [Adaptive Regelung](#5-adaptive-regelung)
6. [Gebäudemodell-Lernen](#6-gebäudemodell-lernen)
7. [Gebäude-Einblicke & Empfehlungen](#7-gebäude-einblicke--empfehlungen)
8. [Energiepreis-Optimierung](#8-energiepreis-optimierung)
9. [COP-Optimierung](#9-cop-optimierung)
10. [Adaptive Regelung: Gewichtungsfaktoren](#10-adaptive-regelung-gewichtungsfaktoren)
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

## 5. Adaptive Regelung

Berechnet alle 5 Minuten eine Empfehlung für die Wassertemperatur (Simulierte
Zieltemperatur). Die App ändert den Sollwert nicht selbst: Nur ein Flow mit der
Karte **Adaptive Regelung empfiehlt Temperaturanpassung** setzt die Empfehlung
um. Eine Schritt-für-Schritt-Erklärung steht in der
[Anleitung zu den Regeleinstellungen](../guide/CONTROL_SETTINGS_GUIDE.de.md).

Seit 3.6.2 stehen die Einstellungen in sechs Gruppen. Homey zeigt immer alle;
der Gruppentitel sagt, bei welchem Regelmodus sie zählen.

| Gruppe | Einstellungen | Zählt bei |
| --- | --- | --- |
| Adaptive Regelung | Adaptive Regelung ein, Regelmodus, niedrigste und höchste Wassertemperatur | Allen Modi |
| Adaptive Regelung: Heizkurve (Positionell) | Grundlage der Empfehlung, einmalig übernehmen, Wasser bei −15 °C und +15 °C | Positionell |
| Adaptive Regelung: Feineinstellung (Positionell – Manuell) | Kp, Ti | Positionell – Manuell |
| Adaptive Regelung: Feineinstellung (Klassisch) | Kp, Ki, Totzone | Klassisch |
| Adaptive Regelung: Coast (Klassisch, Positionell – Manuell) | Coast ein, Empfehlung unter der Wassertemperatur, Startschwelle, Anteil, maximale Dauer | Klassisch, Positionell – Manuell |
| Adaptive Regelung: Gewichtungsfaktoren | Siehe [Abschnitt 10](#10-adaptive-regelung-gewichtungsfaktoren) | Siehe je Faktor |

### Adaptive Regelung ein

- **Standard**: Deaktiviert
- **Funktion**: Schaltet die Berechnung der Empfehlung ein
- **Voraussetzungen**:
  - Raumtemperatur über die Karte **Raumtemperatur an Wärmepumpe senden**
  - Ein Wert bei **Gewünschte Innentemperatur**; ohne diesen Wert wird jeder
    Zyklus übersprungen (nur im Debug-Log sichtbar)
  - Ein Flow, der die Empfehlung umsetzt, wenn die App wirklich regeln soll
- **Gebäudemodell**: hat einen eigenen Schalter und lernt auch, wenn die
  Regelung aus ist

### Feineinstellung (Klassisch)

Gruppe **Adaptive Regelung: Feineinstellung (Klassisch)**. Zählt nur beim
Regelmodus Klassisch.

#### Kp: Proportionalverstärkung

- **Standard**: 5.0
- **Bereich**: 0.5 - 10.0
- **Funktion**: Bestimmt, wie schnell das System auf aktuelle Fehler reagiert
- **Höherer Wert**: Schnellere Korrektur, Überschwingungsrisiko
- **Niedrigerer Wert**: Stabilere Regelung, langsamere Korrektur

#### Ki: Integralverstärkung

- **Standard**: 1.5
- **Bereich**: 0.1 - 5.0
- **Funktion**: Beseitigt anhaltende Abweichungen (stationärer Fehler)

#### Totzone

- **Standard**: 0,3°C
- **Bereich**: 0,1 - 1,0°C
- **Funktion**: Toleranz bevor Anpassungen vorgenommen werden

### Niedrigste und höchste Wassertemperatur in der Empfehlung (v3.4.3+)

Gruppe **Adaptive Regelung**. Zählt bei allen Regelmodi.


- **Minimum — Standard**: 18°C, **Bereich**: 15 - 30°C
- **Maximum — Standard**: 60°C (Tuya: 65°C), **Bereich**: 25 - 60°C (Tuya: 25 -
  65°C)
- **Funktion**: Niedrigste und höchste Wassertemperatur, die die adaptive
  Regelung empfehlen kann
- **Regel**: Das Maximum muss mindestens 2°C über dem Minimum liegen; sonst wird
  die Änderung abgelehnt
- **Grenzen der Wärmepumpe (v3.4.4+)**: Die Empfehlung bleibt auch innerhalb der
  in der Wärmepumpe eingestellten Heizgrenzen (Aurora I/II: P110/P111, Aurora
  III: Grenzen von Zone 1). Die Diagnose der adaptiven Regelung zeigt, welche
  Grenze gilt
- **Fußbodenheizung**: Beide um den Bereich Ihrer eigenen Heizkurve einstellen
  (z. B. 2°C darunter und 3°C darüber) und Spielraum für kaltes Wetter lassen

### Regelmodus und Heizkurve (v3.5.0+)

- **Regelmodus — Standard**: Klassisch
  - **Klassisch**: in jedem Zyklus ein kleiner Schritt nach oben oder unten; die
    Schritte summieren sich (bisheriges Verhalten)
  - **Positionell – Heizkörper** (experimentell): Kp 3, Ti 3 h, Coast aus
  - **Positionell – Fußbodenheizung** (experimentell): Kp 3, Ti 6 h, Coast aus
  - **Positionell – Manuell** (experimentell): Kp und Ti aus der Gruppe
    Feineinstellung (Positionell – Manuell) und der Schalter **Coast ein**
  - Positionell: Empfehlung = Heizkurve + PI-Korrektur mit echtem Integral, ohne
    breite Totzone; der Sollwert bleibt ruhig, auch mit einem Flow, der jede
    Empfehlung ausführt
- **Coast**: bei Klassisch und Positionell – Manuell gilt der Schalter **Coast ein**;
  Heizkörper und Fußbodenheizung schalten Coast aus
- **Grundlage der Empfehlung — Standard**: App-Kurve
  - **App-Kurve**: Wassertemperatur bei −15 °C und bei +15 °C außen. Startwerte:
    Heizkörper 50 / 35, Fußbodenheizung 35 / 27, sonst 45 / 30; bei der Wahl des
    Regelmodus vorausgefüllt, solange Sie sie nicht selbst geändert haben
  - **Heizkurve der Wärmepumpe (laufend gefolgt)** (Aurora I/II: DIY-Kurve, nur wenn DIY
    eingeschaltet ist; Aurora III: Klimakurve): nur, wenn Sie sie selbst
    eingestellt haben; ist DIY aus oder die Kurve nicht brauchbar, gilt die
    App-Kurve. Tuya hat diese Wahl nicht
- **Diagnose**: `adaptive_control_diagnostics` zeigt den Modus, das
  Wärmeabgabesystem, Kp und Ti mit Quelle, die Basis mit Quelle und die P- und
  I-Anteile

#### Heizkurve anpassen

| Was Sie bemerken | Anpassung |
| --- | --- |
| Zu kalt bei Frost, gut bei mildem Wetter | Wert bei −15 °C +1–2 |
| Zu kalt bei mildem Wetter | Wert bei +15 °C +1–2 |
| Überall etwas zu kalt | Beide Werte +1 |
| Zu warm | Umgekehrt: senken |

- Ändern Sie einen Wert pro Mal und warten Sie einen Tag (Fußbodenheizung: zwei
  Tage). In der Diagnose weist ein I-Anteil, der dauerhaft über 0 liegt, auf
  eine zu niedrige Heizkurve hin, unter 0 auf eine zu hohe

#### Umstieg von einer festen Kurve

Haben Sie eine feste Kurve der Wärmepumpe verwendet (Aurora I/II:
Heizkurvenauswahl HH1–HH8 oder HL1–HL8; Tuya: Heizkurve H1–H8 oder L1–L8)?
Notieren Sie diese Kurve und wählen Sie sie bei **Einmalig in die App-Kurve
übernehmen**: Nach dem Speichern trägt die App die beiden Werte aus der
Tabelle ein. Stellen Sie danach die Heizkurvenauswahl auf OFF. Nach OFF kann
die App die Kurve nicht mehr auslesen.

| Kurve | −15 °C | +15 °C | Kurve | −15 °C | +15 °C |
| --- | --- | --- | --- | --- | --- |
| HH1 | 54 | 51 | HL1 | 37 | 33 |
| HH2 | 54 | 46 | HL2 | 34 | 31 |
| HH3 | 53 | 42 | HL3 | 32 | 30 |
| HH4 | 49 | 46 | HL4 | 34 | 29 |
| HH5 | 49 | 41 | HL5 | 32 | 29 |
| HH6 | 44 | 41 | HL6 | 30 | 27 |
| HH7 | 44 | 36 | HL7 | 28 | 27 |
| HH8 | 39 | 36 | HL8 | 28 | 25 |

- Jede Kurve ist eine Treppe mit Stufen von 1 °C; die Werte folgen der Mitte
  dieser Treppe in den Grafiken der Anleitung der Wärmepumpe, auf ganze Grad
  gerundet
- Die neuen Werte sind sichtbar, sobald Sie die Einstellungen erneut öffnen
- Aurora I/II mit einer DIY-Heizkurve: wählen Sie **DIY-Heizkurve der
  Wärmepumpe (L28/L29)**. Die App übernimmt L29 als Wert bei −15 °C und
  L29 + 30 × L28 als Wert bei +15 °C (z. B. L28 = −0,5 und L29 = 55 ergibt
  55 / 40). Eine Steigung, die nicht negativ ist, oder Werte außerhalb der
  App-Kurve werden abgelehnt

**Welchen Regelmodus wähle ich?**

| Situation | Wahl |
| --- | --- |
| Kein Flow, der die Empfehlung ausführt | Egal: nur Empfehlung |
| Die aktuelle Regelung funktioniert gut | Klassisch |
| Sollwert driftet oder schwankt, Heizkörper | Positionell – Heizkörper |
| Sollwert driftet, Fußbodenheizung | Positionell – Fußbodenheizung |
| Gemischt: Boden und Heizkörper | Siehe unten |
| Gebläsekonvektoren | Positionell – Heizkörper |
| Heizkurve unbekannt | Startwerte, danach anpassen |

- **Gemischt oder Gebläsekonvektoren**: nicht getestet. Bei gemischter
  Wärmeabgabe Positionell – Fußbodenheizung, wenn der Boden die größte oder
  trägste Wärmeabgabe ist, sonst Positionell – Heizkörper
- **Aurora I/II und Tuya**: Die Wärmepumpe behält einen neuen Sollwert nur, wenn
  die Heizkurvenauswahl (Tuya: Heizkurve) auf OFF steht; sonst führt keiner der
  beiden Modi die Empfehlung aus. Die App berechnet die Heizkurve dann selbst
- **Heizkurve der Wärmepumpe** nur mit eigener DIY-Kurve: ist DIY aus, rechnet
  die App mit der App-Kurve. Eine feste Kurve übernehmen Sie mit der Tabelle
  oben
- **Sicher ausprobieren**: Schalten Sie den Flow aus, der die Empfehlung
  ausführt, wählen Sie einen positionellen Regelmodus und vergleichen Sie einen
  Tag lang das simulierte Ziel (`adlar_simulated_target`) mit der Heizkurve
- **Zurückstellen** ist jederzeit möglich; das Integral und die aufsummierte
  Korrektur beginnen dann bei 0
- **Nachtabsenkung und Thermostatprogramm**: Eine Wärmepumpe braucht Stunden,
  um das Haus wieder aufzuheizen, in jedem Regelmodus. Lassen Sie das Programm
  bei Heizkörpern 2–4 Stunden vor dem gewünschten Zeitpunkt hochgehen. Halten
  Sie es bei Fußbodenheizung konstant oder senken Sie höchstens um 1 °C ab;
  sonst heizt Positionell morgens auf, mit mehr Kompressorstarts
- **Optimierer** (Preis, COP): verschieben bei Positionell das Raumziel, um
  höchstens 1,5 °C; die Heizkurve verschiebt sich mit. Mit eingeschalteter
  COP-Optimierung kann das Haus im Mittel etwas unter dem Raumziel bleiben. Die
  thermische Komponente des Gebäudemodells wirkt bei Positionell nicht mit
- **Experimentell**: Positionell ist in der Praxis noch wenig getestet

### Feineinstellung (Positionell – Manuell)

Gruppe **Adaptive Regelung: Feineinstellung (Positionell – Manuell)**. Zählt nur
bei Positionell – Manuell; Heizkörper und Fußbodenheizung verwenden feste Werte.

#### Kp: Grad Wasser pro Grad innen

- **Standard**: 3, **Bereich**: 1 - 8
- **Funktion**: Um so viele Grad steigt die Empfehlung pro Grad, das es innen zu
  kalt ist

#### Ti: Nachstellzeit

- **Standard**: 3 Stunden, **Bereich**: 1 - 12 Stunden
- **Funktion**: Wie schnell eine bleibende Abweichung innen ausgeglichen wird;
  kürzer ist schneller

### Coast (Klassisch, Positionell – Manuell)

Gruppe **Adaptive Regelung: Coast (Klassisch, Positionell – Manuell)**.
Heizkörper und Fußbodenheizung verwenden kein Coast.

#### Coast ein

- **Standard**: Ein
- **Funktion**: Ist es innen zu warm, setzt Coast die Empfehlung unter die
  aktuelle Wassertemperatur, sodass der Kompressor aus bleibt und das Haus von
  selbst abkühlt

#### Coast: Empfehlung unter der Wassertemperatur (v2.8.0+)

- **Standard**: 1,0°C
- **Bereich**: 0,5 - 5,0°C
- **Funktion**: Grad unter Auslasstemperatur für Coast-Zielwert
- **Niedriger**: Kompressor stoppt früher, weniger Heizung
- **Höher**: Vorsichtigerer Coast, mehr Spielraum

#### Coast: Startschwelle über der Wunschtemperatur (v2.8.0+)

- **Standard**: 0,3°C
- **Bereich**: 0,1 - 1,0°C
- **Funktion**: Überschwingungsmarge über Sollwert für Coast-Modus-Aktivierung

#### Coast: Anteil an der Empfehlung (v2.8.0+)

- **Standard**: 0,80
- **Bereich**: 0,60 - 0,95
- **Funktion**: Gewichtsanteil von Coast in gewichteter Entscheidung (dominant bei Aktivierung)

#### Coast: maximale Dauer (Aurora)

- **Standard**: 24 Zyklen à 5 Minuten (2 Stunden), **Bereich**: 6 - 48
- **Funktion**: Coast endet spätestens nach dieser Anzahl Zyklen, auch wenn es
  innen noch zu warm ist. Tuya hat diese Einstellung nicht

---

## 6. Gebäudemodell-Lernen

Machine-Learning-Algorithmus, der die thermischen Eigenschaften Ihres Hauses lernt.

### Gebäudemodell-Lernen aktivieren
- **Standard**: Deaktiviert
- **Funktion**: Lernt 4 thermische Parameter (C, UA, g, P_int)
- **Lernzeit**: 24-72 Stunden für Basismodell, 2-4 Wochen für genaues Modell
- **Algorithmus**: Recursive Least Squares (RLS) mit Vergessensfaktor

### Vergessensfaktor (Experteneinstellung)
- **Standard**: 0.999
- **Bereich**: 0.9985 - 0.9995
- **Funktion**: Wie schnell sich das Modell an Änderungen anpasst. Höher = stabiler, besseres Vertrauen (~75%). Niedriger = schnellere Anpassung an saisonale Änderungen.
- **Wirkung**: Sofort (v3.5.0+); das gelernte Modell bleibt erhalten
- **Migration (v3.6.2)**: Ein Wert unter 0.9985 aus einer älteren Version wird
  auf 0.999 gesetzt. Seit v3.4.2 blockierte ein solcher Wert das Speichern jeder
  Einstellung auf diesem Gerät

### Gebäudetyp
- **Standard**: Durchschnitt (typisches NL-Haus)
- **Optionen**:
  - **Leicht**: Holz/Fertigbau, Basisdämmung, schnelle Temp-Änderungen
  - **Durchschnitt**: Ziegel, Hohlwand, Doppelverglasung (typisches NL-Haus)
  - **Schwer**: Beton/Stein, gute Dämmung, HR++-Glas, stabil
  - **Passiv**: Passivhaus, HR+++-Glas, luftdicht, Wärmerückgewinnung
- **Ändern**: Wirkt sofort; das Lernen setzt mit den Werten des neuen Profils fort, mit der Hälfte der gesammelten Samples

### Gebäudemodell-Lernen zurücksetzen
- **Standard**: Deaktiviert
- **Typ**: Einmalige Aktion (Checkbox)
- **Funktion**: Setzt alle gelernten Gebäudeparameter zurück (C, UA, τ, g, P_int) und startet mit ausgewähltem Gebäudeprofil neu
- **Automatisches Zurücksetzen**: Deaktiviert sich nach dem Zurücksetzen automatisch
- **Wann verwenden**: Diagnose zeigt korrupten Status (negative Werte, 0% Vertrauen mit vielen Proben)

### Dynamische Interne Wärmegewinne
- **Standard**: Aktiviert
- **Funktion**: Berücksichtigt variierende Wärme von Personen/Geräten nach Tageszeit
- **Tagesmuster** (Zeiten in der Zeitzone des Homey, v3.5.0+):
  - Nacht (23:00-06:00): 40% (Schlaf)
  - Tag (06:00-18:00): 100% (normal)
  - Abend (18:00-23:00): 180% (Kochen, TV)
- **Genauigkeitsverbesserung**: ~10-15%
- **Wirkung**: Sofort (v3.5.0+); das Lernen geht von den Werten des
  Gebäudeprofils weiter, mit der Hälfte der gesammelten Samples

---

## 7. Gebäude-Einblicke & Empfehlungen

Automatisierte Analyse des thermischen Gebäudemodells mit Energiespar-Empfehlungen und ROI-Schätzungen.

### Gebäude-Einblicke aktivieren
- **Standard**: Deaktiviert
- **Funktion**: Analysiert thermisches Gebäudemodell und liefert Energiespar-Empfehlungen
- **Lernzeit**: Einblicke erscheinen nach etwa 1–2 Tagen Lernen
- **Voraussetzungen**: Gebäudemodell-Lernen muss aktiviert sein

### Mindestvertrauen
- **Standard**: 70%
- **Bereich**: 50% - 90%
- **Funktion**: Zeigt Einblicke nur, wenn Gebäudemodell-Vertrauen diesen Schwellenwert überschreitet
- **70%**: etwa 1–2 Tage Lernen
- **Niedrigere Werte**: Frühere Einblicke, weniger Genauigkeit

---

## 8. Energiepreis-Optimierung

Automatische Optimierung basierend auf Day-Ahead-Energiepreisen (dynamischer Vertrag erforderlich).

### Preisoptimierung aktivieren
- **Standard**: Deaktiviert
- **Funktion**: Nutzt niedrige Preise, vermeidet hohe Preise
- **Datenquelle**: EnergyZero API (kostenlos, kein Konto erforderlich)

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

## 10. Adaptive Regelung: Gewichtungsfaktoren

Diese vier Gewichtungsfaktoren bestimmen gemeinsam, wie die Regelung Entscheidungen trifft. **Werte werden automatisch auf insgesamt 100% normalisiert.** Komfort und Gebäudemodell zählen nur bei Klassisch. Bei Positionell verschieben Effizienz und Kosten nur das Raumziel, zusammen höchstens 1,5 °C. Bei aktivem Coast-Modus dominiert die Coast-Komponente (80% Standard).

### Komfort — nur Klassisch

- **Standard**: 50%
- **Bereich**: 0 - 100%
- **Funktion**: Gewicht für PI-Temperaturregelung
- **Hoher Komfort** (70-80%): Temperatur immer stabil innerhalb ±0,3°C

### Effizienz

- **Standard**: 15%
- **Bereich**: 0 - 100%
- **Funktion**: Gewicht für COP-Optimierung
- **Hohe Effizienz** (30-40%): Fokus auf maximalen COP

### Kosten

- **Standard**: 15%
- **Bereich**: 0 - 100%
- **Funktion**: Gewicht für Preisoptimierung
- **Dynamischer Multiplikator** (v2.6.0):
  - HOHE Preise (reduzieren): Gewicht ×2,0 bis ×3,0
  - NIEDRIGE Preise (vorheizen): Gewicht ×1,2 bis ×1,5
- **Hohe Kosten** (25-35%): Maximale Einsparungen bei Energiekosten

### Gebäudemodell — nur Klassisch

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
   - Kp: 5,0, Ki: 1,5, Totzone: 0,3°C
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
