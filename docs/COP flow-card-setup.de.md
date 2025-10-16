# Schnellstart-Anleitung für Flow-Karten-Einrichtung

## Überblick

Die Adlar-Wärmepumpe kann externe Messdaten von anderen Homey-Geräten über Flow-Karten empfangen, um die COP-Berechnungsgenauigkeit zu verbessern. Dies schafft ein direktes Datenaustauschsystem, bei dem externe Sensoren ihre Messungen automatisch an die Wärmepumpe senden.

**Service-Architektur (v0.99.23+)**: Die Integration externer Daten wird vom **EnergyTrackingService** verwaltet und vom **COPCalculator**-Service für verbesserte Effizienzberechnungen verarbeitet.

![Externe Leistungsmessungs-Einrichtung](/docs/COP%20calculation/COP%20-%20external%20power%20measure.png)

## Erforderliche vs. Optionale Komponenten

### ✅ **Erforderliche Komponenten**

- **WENN-Karte**: Auslöser für externes Gerät (z.B. "Die Leistung hat sich geändert")
- **DANN-Karte**: Datensende-Aktion (z.B. "Leistungsdaten an Wärmepumpe senden")
- **Datenverbindung**: Messwert muss vom Auslöser zur Aktion übergeben werden

### ⚠️ **Optionale Komponenten**

- **UND-Bedingungen**: Zuverlässigkeitsprüfungen hinzufügen (Gerät online, Daten gültig, usw.)
- **SONST-Aktionen**: Fehlerbehandlung und Benachrichtigungen

## ⚠️ Wichtig: Datenaktualität

**Externe Geräte senden Daten, wenn sich ihre Messungen ändern.** Der **EnergyTrackingService** der Wärmepumpe speichert die neuesten innerhalb der letzten 5 Minuten empfangenen Daten. Der **COPCalculator**-Service verwendet diese zwischengespeicherten Daten für COP-Berechnungen. Häufigere Aktualisierungen führen zu genaueren COP-Berechnungen.

**Service-Timeout**: Anfragen für externe Daten haben ein Timeout von 5 Sekunden (`DeviceConstants.EXTERNAL_DEVICE_QUERY_TIMEOUT_MS`), konfigurierbar in den Geräteeinstellungen.

## Basis-Einrichtung (Direkter Datenaustausch)

### Schritt 1: Externen Daten-Flow erstellen

#### WENN (Auslöser)

- [Ihr Stromzähler] Die Leistung hat sich geändert
- Gerät: Ihr externes Leistungsmessgerät (z.B. "Wärmepumpe kWh - Zählerschrank")

#### DANN (Aktion)

- Leistungsdaten für COP-Berechnung an Wärmepumpe senden
- Gerät: [Ihre Wärmepumpe] (z.B. "Intelligent Heat Pump - Haus")
- power_value: `{{power}}` *(vom Auslöser-Token - aktuelle Messung)*

Dieser Flow ermöglicht es externen Stromzählern, ihre Messungen automatisch mit dem Wärmepumpengerät zu teilen, was genauere COP-Berechnungen unter Verwendung tatsächlich gemessener Stromverbräuche ermöglicht.

## Erweiterte Einrichtung (Mit UND-Bedingungen)

### WENN (Erweiterter Auslöser)

- [Ihr Stromzähler] Die Leistung hat sich geändert

### UND *(Optional aber Empfohlen)*

- Smart Meter ist verfügbar
- Leistungsmessung > 0W UND < 50000W
- Leistungsmessung unterscheidet sich vom vorherigen Wert

### DANN (Erweiterte Aktion)

- Leistungsdaten für COP-Berechnung an Wärmepumpe senden

### SONST *(Optionale Fehlerbehandlung)*

- Benachrichtigung senden: "Ungültige Leistungsdaten erkannt"

## Unterstützte Datentypen

| Typ | Externes Gerät Auslöser | Wärmepumpen-Aktionskarte | Datenfeld |
|-----|------------------------|--------------------------|-----------|
| Leistung | Geräteleistungsmessung geändert | `receive_external_power_data` | `power_value` (W) |
| Durchfluss | Gerätedurchflussmessung geändert | `receive_external_flow_data` | `flow_value` (L/min) |
| Temperatur | Gerätetemperatur geändert | `receive_external_ambient_data` | `temperature_value` (°C) |

## Häufige Probleme & Lösungen

### ❌ "Externe Daten werden nicht verwendet"

**Ursache**: Flow wird nicht ausgelöst oder Daten erreichen Wärmepumpe nicht
**Lösungen**:

- Überprüfen Sie, ob Flow aktiviert ist und funktioniert
- Überprüfen Sie, ob externes Gerät online ist und Daten meldet
- Testen Sie Flow manuell, um sicherzustellen, dass Aktionskarte ausgeführt wird

### ❌ "Datenwerte scheinen inkorrekt"

**Ursache**: Falsches Token oder Inkompatibilität der Maßeinheiten
**Lösungen**:

- Überprüfen Sie, ob korrektes Auslöser-Token verwendet wird (z.B. `{{power}}` für Leistungsmessungen)
- Überprüfen Sie, ob Maßeinheiten den erwarteten Werten entsprechen (W für Leistung, L/min für Durchfluss, °C für Temperatur)

### ❌ Daten werden nicht in COP-Berechnung verwendet

**Ursache**: Ungültige Datenwerte oder verspätete Antworten
**Lösungen**:

- Stellen Sie realistische Datenbereiche sicher (Leistung: 100-50000W)
- Überprüfen Sie Geräte-Logs auf Validierungsfehler
- Testen Sie manuelle Flow-Ausführung

## Service-Architektur-Integration (v0.99.23+)

### Wie externe Daten durch Services fließen

1. **Flow-Auslöser**: Externes Gerät (Stromzähler, Durchflusssensor) löst Homey-Flow aus
2. **Flow-Aktion**: Benutzer-Flow führt "Sende [Datentyp] an Wärmepumpe"-Aktionskarte aus
3. **EnergyTrackingService**: Empfängt und validiert externe Daten (Bereichsprüfungen, Null-Validierung)
4. **Datenzwischenspeicherung**: EnergyTrackingService speichert Daten mit Zeitstempel (5 Minuten TTL)
5. **COPCalculator-Anfrage**: Wenn COP-Berechnung läuft, fragt nach aktuellen Daten von EnergyTrackingService
6. **Methodenauswahl**: COPCalculator aktualisiert automatisch auf Methode mit höherer Genauigkeit, wenn externe Daten verfügbar
7. **COP-Berechnung**: Verwendet externe Daten in Direct Thermal-Methode (±5% Genauigkeit)
8. **Event-Emission**: COPCalculator sendet `cop-calculated`-Event mit Ergebnis
9. **RollingCOPCalculator**: Abonniert Event, fügt Datenpunkt zum Zeitreihen-Puffer hinzu
10. **Gerät-Veröffentlichung**: Aktualisierte COP-Werte werden an Homey-Capabilities veröffentlicht

**Service-Koordinationsvorteile**:

- **Automatische Methodenauswahl**: COPCalculator-Service wählt automatisch beste Methode basierend auf verfügbaren Daten
- **Datenvalidierung**: EnergyTrackingService validiert externe Daten vor Verwendung
- **Service-Isolation**: Externe Datenhandhabung isoliert von Berechnungslogik
- **Event-getrieben**: Services kommunizieren über Events, keine enge Kopplung

## Vorteile nach Datentyp

### Leistungsdaten-Integration

- **Genauigkeit**: ±5% vs. ±30% mit internen Schätzungen
- **Methode**: Aktualisiert auf "Direct Thermal"-Berechnung (COPCalculator Methode 1)
- **Service**: EnergyTrackingService speichert externe Leistungsdaten
- **Anforderungen**: Smart Meter mit Echtzeit-Leistungsmessungen
- **Einrichtung**: Externer Stromzähler → "Leistung geändert"-Auslöser → "Leistungsdaten an Wärmepumpe senden"-Aktion (verarbeitet von EnergyTrackingService)

### Durchflussdaten-Integration

- **Genauigkeit**: ±8% thermische Berechnungen
- **Methode**: Ermöglicht präzise Wärmeübertragungsberechnungen (COPCalculator Methoden 1-3)
- **Service**: EnergyTrackingService speichert Durchflussmessungen zwischen
- **Anforderungen**: Wasserdurchflusssensor im Heizkreis

### Temperaturdaten-Integration

- **Genauigkeit**: ±12% Umgebungskompensation
- **Methode**: Bessere wetterangepasste Effizienz (COPCalculator Methode 5: Carnot-Schätzung)
- **Service**: EnergyTrackingService validiert Umgebungstemperaturdaten
- **Anforderungen**: Außentemperatursensor

## Testen Ihrer Einrichtung

1. **Manueller Test**: Lösen Sie Ihr externes Gerät aus, um neue Messungen zu generieren
2. **Flow überprüfen**: Überprüfen Sie, ob Flow ausgeführt wird, wenn externe Gerätedaten sich ändern
3. **Logs überprüfen**: Wärmepumpen-Logs zeigen eingehende externe Daten (EnergyTrackingService-Logs)
4. **Daten überprüfen**: Externe Daten erscheinen in Wärmepumpen-Diagnose ("External Power Measurement"-Capability)
5. **COP-Methode überwachen**: Überprüfen Sie `adlar_cop_method`-Capability - sollte "Direct Thermal" zeigen, wenn externe Leistungsdaten verwendet werden
6. **Service-Gesundheit**: Verwenden Sie Geräteeinstellungen-Diagnose, um zu überprüfen, ob EnergyTrackingService aktuelle externe Daten hat

**Service-Diagnose** (Geräteeinstellungen → Capability-Diagnose):

- **EnergyTrackingService-Status**: Zeigt Verfügbarkeit externer Daten und Zeitstempel
- **COPCalculator-Methode**: Zeigt aktuelle Berechnungsmethode und warum sie ausgewählt wurde
- **Datenaktualität**: Gibt Zeit seit letztem Empfang externer Daten an

Der **COPCalculator-Service** wählt automatisch die beste Berechnungsmethode basierend auf verfügbaren Datenquellen, wobei externe Daten die genauesten COP-Berechnungen ermöglichen (Direct Thermal ±5%).
