# Flow-Karten: Nachschlagewerk

Dieses Nachschlagewerk beschreibt jede Flow-Karte der App: was die Karte tut,
für welche Treiber sie existiert, ihre Felder und ein Beispiel.

Es wird aus den Karten der App erzeugt; bitte nicht von Hand bearbeiten.

Karten mit über oder unter und einem Schwellenwert lösen bei jeder Messung aus,
die sich ausreichend ändert, solange der Wert die Bedingung erfüllt, also nicht
einmalig beim Überschreiten. Sendet eine solche Karte eine Benachrichtigung,
verwenden Sie eine Ja/Nein-Variable, um Wiederholungen zu vermeiden (siehe das
Beispiel beim Wasserdurchfluss-Alarm).

Eine ausführliche Einführung mit Szenarien steht in
[FLOW_CARDS_GUIDE.de.md](FLOW_CARDS_GUIDE.de.md).

## Inhalt

- [Auslöser](#auslöser)
- [Bedingungen](#bedingungen)
- [Aktionen](#aktionen)

## Auslöser

### Auslöser: Bedienung und Modi

#### Betriebsmodus geändert

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus

Wird ausgelöst, wenn sich der Betriebsmodus ändert (ECO, Normal, Boost)

Tokens: Betriebsmodus, Vorheriger Betriebsmodus

**Beispiel:** halten Sie fest, wann Boost eingeschaltet wird.

```text
WENN Betriebsmodus geändert
UND Betriebsmodus ist Boost
DANN Sende eine Push-Benachrichtigung "Boost ist an"
```

#### Heizmodus geändert

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn sich der Heizmodus ändert

Tokens: Heizmodus, Vorheriger Heizmodus

**Beispiel:** erhalten Sie eine Benachrichtigung, wenn jemand den Modus am
Bedienfeld ändert.

```text
WENN Heizmodus geändert
DANN Sende eine Push-Benachrichtigung "Modus ist jetzt [Heizmodus]"
```

#### Wassermodus geändert

**Auslöser** · Aurora I/II über Tuya

Wird ausgelöst, wenn sich der Wassermodus ändert

Tokens: Wassermodus, Vorheriger Wassermodus

**Beispiel:** dies ist eine Installationseinstellung, die sich normalerweise
nicht ändert; erstellen Sie bei einer Änderung eine Benachrichtigung.

```text
WENN Wassermodus geändert
DANN Erstelle eine Benachrichtigung "Wassermodus geändert auf [Wassermodus]"
```

### Auslöser: Temperaturen, Störungen und Alarme

#### Außentemperatur geändert

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn die Außentemperatur über oder unter einen bestimmten Wert
fällt – nützlich für Wetterkompensation

- Bedingung: über, unter
- Temperatur : Zahl, -30 bis 50 °C

Tokens: Aktuelle Außentemperatur

**Beispiel:** schalten Sie einen virtuellen Schalter Heizsaison aus, wenn es
draußen warm wird. Ein Schalter, der schon aus ist, bleibt aus; Wiederholungen
schaden also nicht.

```text
WENN Außentemperatur geändert über 18°C
DANN Heizsaison ausschalten (virtueller Schalter)
```

#### Druckgas-Temperaturalarm

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn die Druckgas-Temperatur einen angegebenen Schwellenwert
über- oder unterschreitet

- Bedingung: über, unter
- Temperatur : Zahl, 0 bis 120 °C

Tokens: Aktuelle Druckgas-Temperatur, Schwellenwert Temperatur

**Beispiel:** senden Sie eine Benachrichtigung, wenn der Kompressor zu heiß
wird.

```text
WENN Druckgas-Temperatur über 105°C
DANN Sende eine Push-Benachrichtigung "Druckgas über 105 °C, Wärmepumpe prüfen"
```

#### Economizer-Auslass-Temperaturalarm

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus

Wird ausgelöst, wenn die Economizer-Auslass-Temperatur einen angegebenen
Schwellenwert über- oder unterschreitet

- Bedingung: über, unter
- Temperatur : Zahl, -30 bis 80 °C

Tokens: Aktuelle Economizer-Auslass-Temperatur, Schwellenwert Temperatur

**Beispiel:** beobachten Sie den Economizer (EVI-Wärmetauscher) bei der
Fehlersuche.

```text
WENN Economizer-Auslass-Temperatur über 60°C
DANN Erstelle eine Benachrichtigung
    "[Aktuelle Economizer-Auslass-Temperatur] °C"
```

#### Economizer-Einlass-Temperaturalarm

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus

Wird ausgelöst, wenn die Economizer-Einlass-Temperatur einen angegebenen
Schwellenwert über- oder unterschreitet

- Bedingung: über, unter
- Temperatur : Zahl, -30 bis 80 °C

Tokens: Aktuelle Economizer-Einlass-Temperatur, Schwellenwert Temperatur

**Beispiel:** beobachten Sie den Economizer (EVI-Wärmetauscher) bei der
Fehlersuche.

```text
WENN Economizer-Einlass-Temperatur unter -10°C
DANN Erstelle eine Benachrichtigung
    "[Aktuelle Economizer-Einlass-Temperatur] °C"
```

#### EEV-Öffnungspuls-Alarm

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn die elektronischen Expansionsventil (EEV) Pulsschritte
einen angegebenen Schwellenwert über- oder unterschreiten

- Bedingung: über, unter
- Schritte: Zahl, 0 bis 500 Pulse-steps

Tokens: Aktuelle EEV-Öffnungspulsschritte, Schwellenwert Pulsschritte

**Beispiel:** halten Sie fest, wann das Expansionsventil weit schließt, als
Hilfe bei der Fehlersuche.

```text
WENN EEV-Pulsschritte unter 50
DANN Erstelle eine Benachrichtigung "EEV [Aktuelle EEV-Öffnungspulsschritte]"
```

#### EVI-Öffnungspuls-Alarm

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn die Enhanced Vapor Injection (EVI) Pulsschritte einen
angegebenen Schwellenwert über- oder unterschreiten

- Bedingung: über, unter
- Schritte: Zahl, 0 bis 500 Pulse-steps

Tokens: Aktuelle EVI-Öffnungspulsschritte, Schwellenwert Pulsschritte

**Beispiel:** halten Sie fest, wie weit das EVI-Ventil öffnet, als Hilfe bei der
Fehlersuche.

```text
WENN EVI-Öffnungspulsschritte über 300
DANN Erstelle eine Benachrichtigung "EVI [Aktuelle EVI-Öffnungspulsschritte]"
```

#### Hochdruck-Temperaturalarm

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus

Wird ausgelöst, wenn die Hochdruck-Sättigungstemperatur einen angegebenen
Schwellenwert über- oder unterschreitet

- Bedingung: über, unter
- Temperatur : Zahl, -20 bis 100 °C

Tokens: Aktuelle Hochdruck-Temperatur, Schwellenwert Temperatur

**Beispiel:** halten Sie fest, wann die Hochdruckseite sehr warm wird.

```text
WENN Hochdruck-Temperatur über 55°C
DANN Erstelle eine Benachrichtigung "[Aktuelle Hochdruck-Temperatur] °C"
```

#### Kompressor-Effizienzalarm (Experte)

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Aurora I/II über Tuya, Aurora III über Modbus: Wird ausgelöst, wenn die
Kompressor-Frequenz einen angegebenen Schwellenwert über- oder unterschreitet.
Erfordert 'Expertenfunktionskarten aktivieren' in den Geräteeinstellungen.

Aurora I/II über Modbus: Wird ausgelöst, wenn die Kompressor-Frequenz einen
angegebenen Schwellenwert über- oder unterschreitet.

- Bedingung: über, unter
- Frequenz : Zahl, 10 bis 200 Hz

Tokens: Aktuelle Frequenz, Schwellenwert Frequenz

**Beispiel:** halten Sie fest, wann der Kompressor mit hoher Drehzahl läuft. Bei
der Tuya-Version muss die Einstellung für Experten-Karten eingeschaltet sein.

```text
WENN Kompressor-Frequenz über 90 Hz
DANN Erstelle eine Benachrichtigung "Kompressor bei [Aktuelle Frequenz] Hz"
```

#### Kondensator-Temperaturalarm

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus

Wird ausgelöst, wenn die Kondensator-Temperatur einen angegebenen Schwellenwert
über- oder unterschreitet

- Bedingung: über, unter
- Temperatur : Zahl, -20 bis 80 °C

Tokens: Aktuelle Kondensator-Temperatur, Schwellenwert Temperatur

**Beispiel:** halten Sie fest, wann der Kondensator sehr warm wird.

```text
WENN Kondensator-Temperatur über 60°C
DANN Erstelle eine Benachrichtigung
    "Kondensator [Aktuelle Kondensator-Temperatur] °C"
```

#### Lüftermotor-Effizienzalarm (Experte)

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Aurora I/II über Tuya, Aurora III über Modbus: Wird ausgelöst, wenn die
Lüftermotor-Frequenz einen angegebenen Schwellenwert über- oder unterschreitet.
Erfordert 'Expertenfunktionskarten aktivieren' in den Geräteeinstellungen.

Aurora I/II über Modbus: Wird ausgelöst, wenn die Lüftermotor-Frequenz einen
angegebenen Schwellenwert über- oder unterschreitet.

- Bedingung: über, unter
- Frequenz : Zahl, 10 bis 100 Hz

Tokens: Aktuelle Lüfterfrequenz, Schwellenwert Frequenz

**Beispiel:** halten Sie fest, wann der Lüfter mit hoher Drehzahl läuft. Bei der
Tuya-Version muss die Einstellung für Experten-Karten eingeschaltet sein.

```text
WENN Lüftermotor-Frequenz über 60 Hz
DANN Erstelle eine Benachrichtigung "Lüfter bei [Aktuelle Lüfterfrequenz] Hz"
```

#### Niederdruck-Temperaturalarm

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus

Wird ausgelöst, wenn die Niederdruck-Sättigungstemperatur einen angegebenen
Schwellenwert über- oder unterschreitet

- Bedingung: über, unter
- Temperatur : Zahl, -30 bis 50 °C

Tokens: Aktuelle Niederdruck-Temperatur, Schwellenwert Temperatur

**Beispiel:** halten Sie fest, wann die Niederdruckseite sehr kalt wird.

```text
WENN Niederdruck-Temperatur unter -20°C
DANN Erstelle eine Benachrichtigung "[Aktuelle Niederdruck-Temperatur] °C"
```

#### Rücklauftemperatur geändert

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn die Rücklauftemperatur einen angegebenen Schwellenwert
über- oder unterschreitet

- Bedingung: über, unter
- Temperatur : Zahl, -20 bis 80 °C

Tokens: Aktuelle Rücklauftemperatur

**Beispiel:** warnen Sie, wenn der Vorlauf zu warm für die Fußbodenheizung wird.
Die Karte heißt in der App Rücklauftemperatur, misst aber das Wasser am Austritt
der Wärmepumpe (Vorlauf). Sie löst bei jedem weiteren Anstieg von 0,5 °C erneut
aus.

```text
WENN Rücklauftemperatur geändert über 45°C
UND Heizmodus ist Fußbodenheizung
DANN Sende eine Push-Benachrichtigung "Vorlauf [Aktuelle Rücklauftemperatur] °C"
```

#### Rücklauftemperatur hat sich geändert

**Auslöser** · Aurora I/II über Modbus · Aurora III über Modbus

Wird ausgelöst, wenn sich die Rücklauftemperatur um mindestens 0,5°C ändert

Tokens: Aktuelle Rücklauftemperatur, Vorherige Rücklauftemperatur,
Temperaturänderung

**Beispiel:** halten Sie die Temperatur am Austritt der Wärmepumpe (Vorlauf) in
einer Zahlenvariable fest. Die Karte löst bei jeder Änderung von mindestens 0,5
°C aus.

```text
WENN Rücklauftemperatur hat sich geändert
DANN Setze eine Zahlenvariable: Vorlauf auf [Aktuelle Rücklauftemperatur]
```

#### Sauggas-Temperaturalarm

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn die Sauggas-Temperatur einen angegebenen Schwellenwert
über- oder unterschreitet

- Bedingung: über, unter
- Temperatur : Zahl, -30 bis 50 °C

Tokens: Aktuelle Sauggas-Temperatur, Schwellenwert Temperatur

**Beispiel:** halten Sie fest, wann das Sauggas sehr kalt wird.

```text
WENN Sauggas-Temperatur unter -20°C
DANN Erstelle eine Benachrichtigung "Sauggas [Aktuelle Sauggas-Temperatur] °C"
```

#### Störung erkannt

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn eine Systemstörung erkannt wird

- code (Aurora I/II über Tuya): Zahl, 1 bis 100
- code (Aurora I/II über Modbus, Aurora III über Modbus): Text

Tokens: Störungscode, Störungsbeschreibung

**Beispiel:** erhalten Sie eine Benachrichtigung bei einer bestimmten Störung.
Bei den Modbus-Treibern ist der Code Text wie im Display (zum Beispiel F1.1 oder
E03), bei Tuya eine Zahl. Für alle Störungen zusammen verwenden Sie die
Bedingung Störung ist aktiv.

```text
WENN Störung F1.1 erkannt
DANN Sende eine Push-Benachrichtigung
    "Störung [Störungscode]: [Störungsbeschreibung]"
```

#### Verdampfer-Temperaturalarm

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn die Verdampfer-Temperatur einen angegebenen Schwellenwert
über- oder unterschreitet

- Bedingung: über, unter
- Temperatur : Zahl, -20 bis 80 °C

Tokens: Aktuelle Verdampfer-Temperatur, Schwellenwert Temperatur

**Beispiel:** halten Sie fest, wann der Außenverdampfer sehr kalt wird, als
Hilfe bei der Suche nach Vereisung.

```text
WENN Verdampfer-Temperatur unter -15°C
DANN Erstelle eine Benachrichtigung "[Aktuelle Verdampfer-Temperatur] °C"
```

#### Vorlauftemperatur geändert

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn die Vorlauftemperatur einen angegebenen Schwellenwert über-
oder unterschreitet

- Bedingung: über, unter
- Temperatur : Zahl, -20 bis 80 °C

Tokens: Aktuelle Vorlauftemperatur

**Beispiel:** schalten Sie einen virtuellen Schalter Rücklauf warm ein, sobald
das zurückkommende Wasser warm genug ist. Die Karte heißt in der App
Vorlauftemperatur, misst aber das Wasser am Eintritt der Wärmepumpe (Rücklauf).

```text
WENN Vorlauftemperatur geändert über 30°C
DANN Rücklauf warm einschalten (virtueller Schalter)
```

#### Vorlauftemperatur hat sich geändert

**Auslöser** · Aurora I/II über Modbus · Aurora III über Modbus

Wird ausgelöst, wenn sich die Vorlauftemperatur um mindestens 0,5°C ändert

Tokens: Aktuelle Vorlauftemperatur, Vorherige Vorlauftemperatur,
Temperaturänderung

**Beispiel:** halten Sie die Temperatur am Eintritt der Wärmepumpe (Rücklauf) in
einer Zahlenvariable fest, zum Beispiel für einen anderen Flow. Die Karte löst
bei jeder Änderung von mindestens 0,5 °C aus.

```text
WENN Vorlauftemperatur hat sich geändert
DANN Setze eine Zahlenvariable: Rücklauf auf [Aktuelle Vorlauftemperatur]
```

#### Warmwasser-Temperaturalarm

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn die Warmwasser-Temperatur einen angegebenen Schwellenwert
über- oder unterschreitet

- Bedingung: über, unter
- Temperatur : Zahl, 0 bis 90 °C

Tokens: Aktuelle Warmwasser-Temperatur, Schwellenwert Temperatur

**Beispiel:** zeigen Sie mit einem virtuellen Schalter, ob der Speicher warm
ist.

```text
WENN Warmwasser-Temperatur über 50°C
DANN Speicher warm einschalten (virtueller Schalter)

WENN Warmwasser-Temperatur unter 40°C
DANN Speicher warm ausschalten
```

#### Wasserdurchfluss-Alarm (Experte)

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Aurora I/II über Tuya, Aurora III über Modbus: Wird ausgelöst, wenn der
Wasserdurchfluss einen angegebenen Schwellenwert über- oder unterschreitet.
Erfordert 'Expertenfunktionskarten aktivieren' in den Geräteeinstellungen.

Aurora I/II über Modbus: Wird ausgelöst, wenn der Wasserdurchfluss einen
angegebenen Schwellenwert über- oder unterschreitet.

- Bedingung: über, unter
- Durchflussrate (L/min): Zahl, 0 bis 100 L/min

Tokens: Aktueller Durchfluss, Schwellenwert Durchfluss

**Beispiel:** eine Benachrichtigung bei zu geringem Durchfluss, mit einer
Ja/Nein-Variable Durchflussmeldung gegen Wiederholungen. Bei der Tuya-Version
muss die Einstellung für Experten-Karten eingeschaltet sein.

```text
WENN Wasserdurchfluss unter 10 L/min
UND Kompressor ist läuft
UND Durchflussmeldung ist gleich nein
DANN Sende eine Push-Benachrichtigung
    "Wenig Durchfluss: [Aktueller Durchfluss] L/min"
UND Setze eine Ja/Nein-Variable: Durchflussmeldung auf ja

WENN Wasserdurchfluss über 15 L/min
DANN Setze eine Ja/Nein-Variable: Durchflussmeldung auf nein
```

### Auslöser: Energie und Effizienz (COP)

#### COP-Ausreißer erkannt

**Auslöser** · Aurora I/II über Tuya

Wird ausgelöst, wenn ein ungültiger oder verdächtiger COP-Wert erkannt wird, was
auf mögliche Sensorprobleme hinweist

Tokens: Ausreißer-COP-Wert, Ausreißergrund, Verwendete Berechnungsmethode

**Beispiel:** ein Ausreißer weist oft auf einen falschen Sensor oder eine
fehlende Leistungsmessung hin; halten Sie ihn in der Zeitleiste fest.

```text
WENN COP-Ausreißer erkannt
DANN Erstelle eine Benachrichtigung "COP [Ausreißer-COP-Wert]: [Ausreißergrund]"
```

#### COP-Effizienz geändert

**Auslöser** · Aurora I/II über Tuya

Wird ausgelöst, wenn die Leistungszahl (COP) einen angegebenen Schwellenwert
über- oder unterschreitet

- Bedingung: über, unter
- COP-Schwellenwert: Zahl, 1 bis 8 COP

Tokens: Aktuelle COP, Vorherige COP, Änderung des COP, Verwendete
Berechnungsmethode, Vertrauensniveau

**Beispiel:** halten Sie einen niedrigen COP fest, mit der verwendeten
Berechnungsmethode. Die Karte prüft bei jeder Änderung von mindestens 0,3.

```text
WENN COP-Effizienz geändert unter 2
UND Kompressor ist läuft
DANN Erstelle eine Benachrichtigung
    "COP [Aktuelle COP] ([Verwendete Berechnungsmethode])"
```

#### COP-Trend erkannt

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn COP über die letzten 24 Stunden einen signifikanten
Verbesserungs- oder Verschlechterungstrend zeigt

- Trend-Typ: Verbesserung, Verschlechterung, jede Trendänderung

Tokens: Trend-Richtung, Trend-Stärke, Trend-Beschreibung, Aktueller täglicher
COP

**Beispiel:** erhalten Sie eine Benachrichtigung, wenn die Effizienz in den
letzten 24 Stunden deutlich zurückgeht.

```text
WENN COP-Trend erkannt: Verschlechterung
DANN Sende eine Push-Benachrichtigung "[Trend-Beschreibung]"
```

#### Gesamtverbrauchs-Meilenstein erreicht

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn der gesamte Stromverbrauch die angegebenen Meilensteine
erreicht

- Verbrauchs-Meilenstein (kWh): Zahl, 100 bis 50000 kWh

Tokens: Gesamtverbrauch, Meilenstein-Wert

**Beispiel:** eine Erinnerung bei einem Verbrauchsmeilenstein, zum Beispiel für
die Wartung.

```text
WENN Gesamtverbrauch erreichte 10000 kWh
DANN Sende eine Push-Benachrichtigung "[Gesamtverbrauch] kWh: Wartung planen"
```

#### Leistungs-Schwellenwert überschritten

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn die Leistungsaufnahme den angegebenen Schwellenwert
überschreitet (erfordert Leistungsüberwachung)

- Leistungs-Schwellenwert (W): Zahl, 100 bis 10000 W

Tokens: Aktuelle Leistungsaufnahme, Schwellenwert Leistung

**Beispiel:** halten Sie fest, wann die Wärmepumpe viel Leistung aufnimmt. Die
Karte löst einmal beim Überschreiten aus und erst wieder, nachdem die Leistung
zuerst gesunken ist. Erfordert eine Leistungsmessung.

```text
WENN Leistungsaufnahme überschritt 3000 W
DANN Erstelle eine Benachrichtigung "Leistung [Aktuelle Leistungsaufnahme] W"
```

#### Leistungsbericht ist verfügbar

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird täglich um 23:00 Uhr mit einem umfassenden Leistungsbericht ausgelöst.
Verwenden Sie in Kombination mit einer Benachrichtigungsaktion für tägliche
Leistungszusammenfassungen.

Tokens: Gesamtbewertung (0-100), Bewertung, Zusammenfassung, Empfehlungen,
Vollständiger Bericht (JSON)

**Beispiel:** erhalten Sie jeden Abend um 23:00 eine kurze Zusammenfassung.

```text
WENN Leistungsbericht ist verfügbar
DANN Sende eine Push-Benachrichtigung "[Bewertung]: [Zusammenfassung]"
```

#### Monatliche COP-Effizienz geändert

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn die 30-Tage-Durchschnitts-COP einen angegebenen
Schwellenwert über- oder unterschreitet

- Bedingung: über, unter
- Monatlicher COP-Schwellenwert: Zahl, 1 bis 8 COP

Tokens: Aktueller monatlicher COP, Vorheriger monatlicher COP, Änderung des COP

**Beispiel:** verfolgen Sie die Effizienz über 30 Tage. Die Karte prüft bei
jeder Änderung von mindestens 0,2.

```text
WENN Monatliche COP-Effizienz geändert unter 3
DANN Sende eine Push-Benachrichtigung "Monats-COP [Aktueller monatlicher COP]"
```

#### Tagesverbrauchs-Schwellenwert erreicht

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn der tägliche Stromverbrauch den angegebenen Schwellenwert
erreicht

- Täglicher Schwellenwert (kWh): Zahl, 1 bis 100 kWh

Tokens: Tagesverbrauch, Schwellenwert

**Beispiel:** erhalten Sie eine Benachrichtigung pro Tag, sobald der Verbrauch
eine Grenze erreicht.

```text
WENN Tagesverbrauch erreichte 30 kWh
DANN Sende eine Push-Benachrichtigung "Heute schon [Tagesverbrauch] kWh"
```

#### Tägliche COP-Effizienz geändert

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn die 24-Stunden-Durchschnitts-COP einen angegebenen
Schwellenwert über- oder unterschreitet

- Bedingung: über, unter
- Täglicher COP-Schwellenwert: Zahl, 1 bis 8 COP

Tokens: Aktueller täglicher COP, Vorheriger täglicher COP, Änderung des COP

**Beispiel:** halten Sie fest, wann der Tages-COP unter eine Grenze fällt. Die
Karte prüft bei jeder Änderung von mindestens 0,2.

```text
WENN Tägliche COP-Effizienz geändert unter 3
DANN Erstelle eine Benachrichtigung "Tages-COP [Aktueller täglicher COP]"
```

#### Tägliche Energiekosten Schwellenwert überschritten

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn die heutigen Gesamtenergiekosten den angegebenen Betrag
überschreiten (erfordert Preisoptimierer)

- Kosten-Schwellenwert (€): Zahl, 1 bis 50

Tokens: Gesamtkosten Heute (€), Verbrauch Heute (kWh), Durchschnittspreis Heute
(€/kWh)

**Beispiel:** erhalten Sie eine Benachrichtigung pro Tag, wenn die Energiekosten
einen Betrag überschreiten. Funktioniert nur mit Preisoptimierung und einer
externen Energiemessung.

```text
WENN Tägliche Kosten überschritten €5
DANN Sende eine Push-Benachrichtigung "Kosten heute € [Gesamtkosten Heute (€)]"
```

### Auslöser: Energiepreise

#### Energiepreis-Schwellenwert überschritten

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn sich die Energiepreis-Kategorie ändert (very_low, low,
normal, high, very_high)

Tokens: Preis-Kategorie, Aktueller Preis (€/kWh), Preis Nächste Stunde (€/kWh)

**Beispiel:** ECO bei einem sehr hohen Preis und zurück auf Normal bei jeder
anderen Kategorie. Die Kategorie ist ein Code: very_low, low, normal, high oder
very_high. Funktioniert nur, wenn die adaptive Regelung läuft (mit einer
Innentemperatur), die Preisoptimierung eingeschaltet ist und Preise über Externe
Energiepreise senden hereinkommen.

```text
WENN Energiepreis-Schwellenwert überschritten
UND [Preis-Kategorie] ist genau very_high
DANN Betriebsmodus einstellen auf ECO
SONST Betriebsmodus einstellen auf Normal
```

#### Günstigster Block gestartet

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn der günstigste Strompreis-Block des Tages beginnt. Nutzen
Sie dies, um den Energieverbrauch während günstiger Perioden zu maximieren.

Tokens: Block-Startzeit, Block-Endzeit, Durchschnittspreis (€/kWh), Block-Dauer
(Stunden)

**Beispiel:** bereiten Sie im günstigsten Block zusätzlich Warmwasser und setzen
Sie es danach zurück, mit einer Verzögerung auf der zweiten Aktionskarte. Die
Blocklänge stellen Sie unter Preisblock-Größe (Stunden) ein, Standard 4.
Funktioniert nur, wenn die adaptive Regelung läuft (mit einer Innentemperatur),
die Preisoptimierung eingeschaltet ist und Preise über Externe Energiepreise
senden hereinkommen.

```text
WENN Günstigster Block gestartet
DANN Warmwassertemperatur einstellen auf 55
UND Warmwassertemperatur einstellen auf 48 (Verzögerung 4 Stunden)
```

#### Preistrend geändert

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn sich die Richtung des Strompreistrends ändert (steigend,
fallend, stabil). Basierend auf linearer Regressionsanalyse mit
Konfidenzschwelle.

Tokens: Vorheriger Trend, Neuer Trend, Analysierte Stunden

**Beispiel:** erstellen Sie eine Benachrichtigung, wenn die Preise zu steigen
oder zu fallen beginnen. Funktioniert nur, wenn die adaptive Regelung läuft (mit
einer Innentemperatur), die Preisoptimierung eingeschaltet ist und Preise über
Externe Energiepreise senden hereinkommen.

```text
WENN Preistrend geändert
DANN Erstelle eine Benachrichtigung
    "Preistrend [Vorheriger Trend] zu [Neuer Trend]"
```

#### Teure Periode naht

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird N Stunden vor Beginn des teuersten Strompreis-Blocks ausgelöst. Nutzen Sie
dies zum Vorheizen oder Vorbereiten vor teuren Perioden.

Tokens: Block-Startzeit, Durchschnittspreis (€/kWh), Block-Dauer (Stunden)

**Beispiel:** stellen Sie die Wärmepumpe auf ECO, bevor die teure Periode
beginnt. Wie viele Stunden vorher die Karte auslöst, stellen Sie unter Teurer
Block Warnzeit (Stunden) ein, Standard 2. Die Aurora III hat kein ECO.
Funktioniert nur, wenn die adaptive Regelung läuft (mit einer Innentemperatur),
die Preisoptimierung eingeschaltet ist und Preise über Externe Energiepreise
senden hereinkommen.

```text
WENN Teure Periode naht
DANN Betriebsmodus einstellen auf ECO
UND Sende eine Push-Benachrichtigung "Teuer ab [Block-Startzeit]"
```

### Auslöser: Adaptive Regelung und Gebäudemodell

#### Adaptive Regelung empfiehlt Temperaturanpassung

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn adaptive Regelung eine empfohlene Temperaturanpassung
berechnet (nur bei signifikanter Aktion). Verwenden Sie
building_model_confidence zum Filtern. Verwenden Sie 'Zieltemperatur (Sollwert)
einstellen' zum Anwenden. Aurora I/II via Modbus: Die Empfehlung folgt dem Modus
der Wärmepumpe (Heiz-Sollwert in Heizmodi, Fußbodenheizungs-Sollwert in
Fußbodenheizungsmodi); anwenden mit 'Sollwert-Temperatur einstellen (nach
Modus)' auf Auto.

Tokens: Aktuelle Zieltemperatur, Empfohlene Zieltemperatur, Temperaturanpassung,
Anpassungsgrund, Regler, Gebäudemodell Vertrauen (%), Regelmodus

**Beispiel:** das ist der Kern der adaptiven Regelung: Die Regelung stellt den
Sollwert nicht selbst ein, dieser Flow führt die Empfehlung aus. Bei der Aurora
I/II über Modbus folgt die Empfehlung dem Modus; verwenden Sie dort
Sollwert-Temperatur einstellen (nach Modus) auf Auto. Bei der Aurora I/II bleibt
der Sollwert nur, wenn die Heizkurve AUS ist.

```text
WENN Adaptive Regelung empfiehlt Temperaturanpassung
DANN Zieltemperatur (Sollwert) einstellen auf
    [Empfohlene Zieltemperatur] Automatisch runden (empfohlen)
```

#### Adaptive Steuerung Status geändert

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn die adaptive Temperatursteuerung aktiviert oder deaktiviert
wird

Tokens: Status, Grund

**Beispiel:** erhalten Sie eine Benachrichtigung, wenn die adaptive Regelung
ein- oder ausgeschaltet wird.

```text
WENN Adaptive Steuerung Status geändert
DANN Sende eine Push-Benachrichtigung "Adaptive Regelung [Status]: [Grund]"
```

#### Gebäudemodell-Lernmeilenstein

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn das thermische Gebäudemodell einen Lernmeilenstein erreicht
(z.B. 70% Vertrauen)

Tokens: Meilenstein, Vertrauen, Thermische Masse (kWh/°C), Zeitkonstante
(Stunden)

**Beispiel:** erhalten Sie eine Benachrichtigung, wenn das Gebäudemodell 70%
Vertrauen erreicht. Nach einem Neustart des Lernens löst die Karte erneut aus.

```text
WENN Gebäudemodell-Lernmeilenstein
DANN Sende eine Push-Benachrichtigung "Gebäudemodell: [Meilenstein]"
```

#### Gebäudeprofil-Fehlanpassung erkannt

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn erlerntes Gebäudeverhalten erheblich vom ausgewählten
Profil abweicht (>30% Abweichung). Schlägt optimales Profil für schnelleres
Lernen vor.

Tokens: Aktuelles Profil, Vorgeschlagenes Profil, Gelernte τ (Stunden), Profil τ
(Stunden), Abweichung (%), Vertrauen (%)

**Beispiel:** das gelernte Verhalten passt nicht zum gewählten Gebäudetyp.
Wählen Sie den vorgeschlagenen Typ in den Einstellungen (Gebäudetyp), um
schneller zu lernen.

```text
WENN Gebäudeprofil-Fehlanpassung erkannt
DANN Sende eine Push-Benachrichtigung
    "Gebäudetyp [Vorgeschlagenes Profil] passt besser"
```

#### Neue Gebäudeerkenntnis erkannt

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn das Gebäudemodell umsetzbare Leistungserkenntnisse erkennt
(≥70% Vertrauen). Verwenden Sie Token zum Filtern nach Kategorie und
Einsparpotenzial.

Tokens: Kategorie, Erkenntnis, Empfehlung, Priorität (0-100), Vertrauen (%),
Geschätzte Einsparungen (€/Monat, nicht mehr berechnet)

**Beispiel:** erhalten Sie eine neue Erkenntnis über das Haus, sobald das
Gebäudemodell zuverlässig genug ist (Einstellung Mindestvertrauen (%), Standard
70%).

```text
WENN Neue Gebäudeerkenntnis erkannt
DANN Sende eine Push-Benachrichtigung "[Erkenntnis] [Empfehlung]"
```

#### Prognose-Heizempfehlung verfügbar

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird ausgelöst, wenn neue COP-optimierte Heizempfehlung basierend auf
Temperaturvorhersage verfügbar ist

Tokens: Wartezeit (Stunden), Erwarteter COP, Aktueller COP, Empfehlung

**Beispiel:** erhalten Sie die Empfehlung auf Basis der erwarteten
Außentemperatur: warten, weil es später wärmer und damit effizienter ist, oder
jetzt heizen. Die Karte löst aus, wenn sich die Empfehlung ändert. Erfordert die
Wettervorhersage in den Einstellungen. Der Empfehlungstext ist derzeit immer
Niederländisch.

```text
WENN Prognose-Heizempfehlung verfügbar
DANN Erstelle eine Benachrichtigung "[Empfehlung]"
```

#### Simulierte Temperatur aktualisiert

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Wird bei jedem Regelzyklus (5 min) mit vollständiger Aufschlüsselung der
adaptiven Regelungsberechnung ausgelöst. Verwenden Sie für Überwachung,
Protokollierung und Vertrauensfilterung. Filtern Sie nach
building_model_confidence, um nur auf vertrauenswürdige Empfehlungen zu
reagieren.

Tokens: Simuliertes Ziel (°C), Tatsächliches Ziel (°C), Unterschied (°C),
Anpassung (°C), Komfort-Komponente (°C), Effizienz-Komponente (°C),
Kosten-Komponente (°C), Gebäudemodell Vertrauen (%), COP Vertrauen (%),
Coast-Komponente (°C), Begründung

**Beispiel:** die Karte löst bei jedem Regelzyklus aus (etwa alle 5 Minuten).
Verwenden Sie sie, um Werte festzuhalten, nicht für Benachrichtigungen.

```text
WENN Simulierte Zieltemperatur aktualisiert
DANN Setze eine Zahlenvariable: Empfehlung auf [Simuliertes Ziel (°C)]
```

#### Vorheizzeit-Empfehlung

**Auslöser** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Triggert wenn ΔT (Ziel - Innen) 1.5°C überschreitet. Liefert Vorheizdauer
basierend auf thermischer Gebäudereaktion (τ). Erfordert ≥70% Modellvertrauen.
Max 1x pro 4 Stunden.

Tokens: Dauer (Stunden), Temperaturanstieg (°C), Aktuelle Temperatur (°C),
Zieltemperatur (°C), Vertrauen (%)

**Beispiel:** die Karte löst aus, wenn es mehr als 1,5 °C kälter als gewünscht
ist und das Gebäudemodell zuverlässig genug ist (Einstellung Mindestvertrauen
(%), Standard 70%), höchstens einmal alle 4 Stunden.

```text
WENN Vorheizzeit-Empfehlung
DANN Sende eine Push-Benachrichtigung
    "Aufheizen dauert [Dauer (Stunden)] Stunden"
```

## Bedingungen

### Bedingungen: Bedienung und Modi

#### Betriebsmodus ist

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus

Prüfen Sie, ob der Betriebsmodus mit dem ausgewählten Modus übereinstimmt

- Betriebsmodus: ECO, Normal, Boost

**Beispiel:** stellen Sie die Wärmepumpe morgens zurück auf Normal, wenn sie
noch auf ECO steht.

```text
WENN Die Uhrzeit ist 07:00
UND Betriebsmodus ist ECO
DANN Betriebsmodus einstellen auf Normal
```

#### Geräteleistung ist

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Prüfen Sie, ob der Geräteleistungsstatus mit dem ausgewählten Status
übereinstimmt

- Leistungsstatus: Ein, Aus

**Beispiel:** senken Sie den Sollwert nur, wenn die Wärmepumpe eingeschaltet
ist.

```text
WENN Die letzte Person geht
UND Geräteleistung ist Ein
DANN Zieltemperatur (Sollwert) einstellen auf 30
```

#### Heizkurveneinstellung ist

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus

Prüfen Sie, ob die Heizkurveneinstellung mit der ausgewählten Kurve
übereinstimmt

- Heizkurve: AUS, H1, H2, H3, H4, H5, H6, H7, H8, L1, L2, L3, L4, L5, L6, L7,
  L8 - Benutzerdefinierte Kurve

**Beispiel:** ändern Sie den Sollwert nur, wenn die Heizkurve AUS ist; mit einer
Heizkurve bestimmt die Wärmepumpe die Vorlauftemperatur selbst und hält einen
eingestellten Sollwert nicht.

```text
WENN Die Uhrzeit ist 06:00
UND Heizkurveneinstellung ist AUS
DANN Zieltemperatur (Sollwert) einstellen auf 40
```

#### Heizmodus ist

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Prüfen Sie, ob der Heizmodus mit dem ausgewählten Modus übereinstimmt

- Heizmodus (Aurora I/II über Tuya, Aurora I/II über Modbus): Kälte, Heizen,
  Fußbodenheizung, Warmwasser, Kälte und Warmwasser, Heizen und Warmwasser,
  Fußbodenheizung und Warmwasser
- Heizmodus (Aurora III über Modbus): Aus, Kühlen, Heizen, Auto

**Beispiel:** schalten Sie im Mai auf nur Warmwasser um, aber nur, wenn die
Wärmepumpe noch auf Heizen und Warmwasser steht. Die Aurora III hat andere Modi
(Kühlen, Heizen, Auto) und keinen eigenen Warmwassermodus.

```text
WENN Die Uhrzeit ist 08:00
UND Tag und Monat sind 1. Mai
UND Heizmodus ist Heizen und Warmwasser
DANN Heizmodus einstellen auf Warmwasser
```

#### Kompressor läuft

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Prüfen Sie, ob der Kompressor derzeit läuft

**Beispiel:** erhalten Sie eine Benachrichtigung, wenn der Kompressor noch
läuft, wenn eine teure Periode beginnt.

```text
WENN Teure Periode naht
UND Kompressor ist läuft
DANN Sende eine Push-Benachrichtigung "Wärmepumpe läuft in teurer Periode"
```

#### Leisemodus ist

**Bedingung** · Aurora III über Modbus

Prüfen Sie die Stufe des Leisemodus der Wärmepumpe

- Leisemodus: Aus, Stufe 1, Stufe 2

**Beispiel:** schalten Sie den Leisemodus morgens aus, wenn er noch an ist.

```text
WENN Die Uhrzeit ist 07:00
UND Leisemodus ist nicht Aus
DANN Leisemodus einstellen auf Aus
```

#### Stromverbrauchsüberwachung ist

**Bedingung** · Aurora I/II über Tuya

Prüfen Sie, ob die Stromverbrauchsüberwachungsstufe der angegebenen Bedingung
entspricht

- Vergleich: Gleich, Größer als, Kleiner als
- Stromverbrauchsüberwachung: Zahl, 0 bis 2

**Beispiel:** diese Einstellung gibt an, welches Leistungsmodul die Wärmepumpe
hat (0 = keins, 1 = einphasig, 2 = dreiphasig). Prüfen Sie mit der Karte, ob der
Wert noch stimmt, zum Beispiel nach einer Störung.

```text
WENN Die Uhrzeit ist 08:00
UND Stromverbrauchsüberwachung ist nicht Gleich 1
DANN Sende eine Push-Benachrichtigung "Einstellung Leistungsmodul geändert"
```

#### Warmwasser wird bereitet

**Bedingung** · Aurora III über Modbus

Prüfen, ob die Wärmepumpe gerade Warmwasser bereitet

**Beispiel:** schalten Sie den Leisemodus erst ein, wenn die Wärmepumpe kein
Warmwasser mehr bereitet.

```text
WENN Die Uhrzeit ist 22:00
UND Warmwasser wird nicht bereitet
DANN Leisemodus einstellen auf Stufe 2
```

#### Warmwasser-Kurveneinstellung ist

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus

Prüfen Sie, ob die Warmwasser-Kurveneinstellung mit der ausgewählten Einstellung
übereinstimmt

- Warmwasser-Kurveneinstellung: AUS, H1, H2, H3, H4

**Beispiel:** schalten Sie die Warmwasserkurve abends wieder ein, wenn sie aus
ist.

```text
WENN Die Uhrzeit ist 22:00
UND Warmwasser-Kurveneinstellung ist AUS
DANN Warmwasserkurve einstellen auf H2
```

#### Warmwassertemperatur ist

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Prüfen Sie, ob die Warmwassertemperatur der angegebenen Bedingung entspricht

- Vergleich: Gleich, Größer als, Kleiner als
- Warmwassertemperatur : Zahl, 20 bis 75 °C

**Beispiel:** die Karte vergleicht den Warmwasser-Sollwert, nicht die gemessene
Speichertemperatur. Setzen Sie den Sollwert zurück, wenn er nach einer Erhöhung
zu hoch geblieben ist.

```text
WENN Die Uhrzeit ist 23:00
UND Warmwassertemperatur ist Größer als 50°C
DANN Warmwassertemperatur einstellen auf 48
```

#### Wassersteuerungsmodus ist

**Bedingung** · Aurora I/II über Tuya

Prüfen Sie, ob der Wassersteuerungsmodus der angegebenen Bedingung entspricht

- Vergleich: Gleich, Größer als, Kleiner als
- Wassersteuerungsmodus: Zahl, 0 bis 1

**Beispiel:** dies ist eine Installationseinstellung; melden Sie mit der Karte
einen unerwarteten Wert.

```text
WENN Die Uhrzeit ist 08:00
UND Wassersteuerungsmodus ist nicht Gleich 0
DANN Sende eine Push-Benachrichtigung "Wassersteuerungsmodus steht auf 1"
```

#### Zieltemperatur (Sollwert) ist

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Prüfen Sie, ob die Zieltemperatur (Sollwert) der angegebenen Bedingung
entspricht

- Vergleich: Gleich, Größer als, Kleiner als
- Temperatur (Aurora I/II über Tuya): Zahl, 5 bis 60 °C
- Temperatur (Aurora I/II über Modbus, Aurora III über Modbus): Zahl, 15 bis 60
  °C

**Beispiel:** senken Sie den Sollwert nachts nur, wenn er höher als der
Nachtwert ist.

```text
WENN Die Uhrzeit ist 23:00
UND Zieltemperatur (Sollwert) ist Größer als 35°C
DANN Zieltemperatur (Sollwert) einstellen auf 32
```

### Bedingungen: Temperaturen, Störungen und Alarme

#### Elektrische Bilanz prüfen

**Bedingung** · Aurora I/II über Tuya

Prüfen Sie, ob die 3-Phasen-Elektrischen Ströme innerhalb der angegebenen
Toleranz ausgeglichen sind

- Bilanztoleranz : Zahl, 1 bis 20 %

**Beispiel:** prüfen Sie täglich, ob die drei Phasen etwa gleich belastet sind.

```text
WENN Die Uhrzeit ist 12:00
UND Kompressor ist läuft
UND 3-Phasen-Elektrische Bilanz ist außerhalb 10% Toleranz
DANN Sende eine Push-Benachrichtigung "Phasen ungleich belastet"
```

#### Störung ist aktiv

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Prüfen Sie, ob derzeit eine Störung aktiv ist (Fehlercode > 0)

**Beispiel:** erhalten Sie jeden Morgen eine Erinnerung, solange noch eine
Störung aktiv ist.

```text
WENN Die Uhrzeit ist 08:00
UND Störung ist aktiv
DANN Sende eine Push-Benachrichtigung "Die Wärmepumpe meldet noch eine Störung"
```

#### System-Pulsschritte-Differenz prüfen

**Bedingung** · Aurora I/II über Tuya

Prüfen Sie, ob die Pulsschritte-Differenz zwischen EEV und EVI über oder unter
einem Schwellenwert liegt

- Pulsschritte-Differenz: Zahl, 0 bis 1000 Pulse-steps

**Beispiel:** halten Sie den Unterschied zwischen EEV- und EVI-Ventil fest, als
Hilfe bei der Fehlersuche.

```text
WENN Die Uhrzeit ist 14:00
UND System-Pulsschritte-Differenz ist über 300
DANN Erstelle eine Benachrichtigung "Großer Unterschied EEV und EVI"
```

#### Temperaturdifferenz prüfen

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Prüfen Sie, ob die Temperaturdifferenz zwischen Einlass und Auslass über oder
unter einem Schwellenwert liegt

- Temperaturdifferenz : Zahl, 1 bis 50 °C

**Beispiel:** ein großer Unterschied zwischen Vorlauf und Rücklauf kann auf zu
geringen Durchfluss hinweisen.

```text
WENN Die Uhrzeit ist 14:00
UND Kompressor ist läuft
UND Temperaturdifferenz ist über 8°C
DANN Sende eine Push-Benachrichtigung "Großer Unterschied Vor- und Rücklauf"
```

#### Umgebungstemperatur über

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Prüfen Sie, ob die Umgebungstemperatur über oder unter einem bestimmten Wert
liegt

- Temperatur: Zahl, -30 bis 50 °C

**Beispiel:** bereiten Sie im günstigsten Block zusätzlich Warmwasser, aber nur,
wenn es draußen kalt ist.

```text
WENN Günstigster Block gestartet
UND Umgebungstemperatur ist unter 5°C
DANN Warmwassertemperatur einstellen auf 55
UND Warmwassertemperatur einstellen auf 48 (Verzögerung 4 Stunden)
```

#### Wasserdurchflussrate prüfen

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Prüfen Sie, ob die Wasserdurchflussrate über oder unter dem angegebenen
Schwellenwert liegt

- Durchflussrate (L/min): Zahl, 1 bis 100 L/min

**Beispiel:** prüfen Sie den Durchfluss zu einer festen Zeit, während der
Kompressor läuft.

```text
WENN Die Uhrzeit ist 10:00
UND Kompressor ist läuft
UND Wasserdurchflussrate ist unter 15 L/min
DANN Sende eine Push-Benachrichtigung "Wenig Durchfluss, Filter prüfen"
```

### Bedingungen: Energie und Effizienz (COP)

#### COP-Berechnungsmethode ist

**Bedingung** · Aurora I/II über Tuya

Prüfen Sie, welche Berechnungsmethode für den aktuellen COP-Wert verwendet
wurde - nützlich für Automatisierung basierend auf Datenverfügbarkeit

- Berechnungsmethode: Direkt thermisch (höchste Genauigkeit), Carnot-Schätzung
  (mittlere Genauigkeit), Temperaturdifferenz (einfach), Unzureichende Daten

**Beispiel:** reagieren Sie auf einen niedrigen COP nur, wenn er aus gemessenem
Durchfluss, Temperaturen und Stromverbrauch berechnet wurde.

```text
WENN COP-Effizienz geändert unter 2
UND COP-Berechnungsmethode ist Direkt thermisch (höchste Genauigkeit)
DANN Sende eine Push-Benachrichtigung "Niedriger COP: [Aktuelle COP]"
```

#### COP-Effizienz ist

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Prüfen Sie, ob die aktuelle Leistungszahl (COP) über oder unter einem
Schwellenwert liegt

- COP-Schwellenwert: Zahl, 1 bis 8 COP

**Beispiel:** bereiten Sie nachmittags zusätzlich Warmwasser, wenn die
Wärmepumpe in dem Moment effizient läuft, und setzen Sie den Sollwert abends
zurück.

```text
WENN Die Uhrzeit ist 14:00
UND COP-Effizienz ist über 4
DANN Warmwassertemperatur einstellen auf 55

WENN Die Uhrzeit ist 18:00
DANN Warmwassertemperatur einstellen auf 48
```

#### COP-Trendanalyse

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Prüfen Sie den COP-Leistungstrend über einen bestimmten Zeitraum

- Zeitraum : Zahl, 1 bis 168 h

**Beispiel:** eine wöchentliche Prüfung der Effizienz.

```text
WENN Die Uhrzeit ist 10:00
UND Heute ist ein Sonntag
UND COP-Trend ist verschlechternd über 168 Stunden
DANN Sende eine Push-Benachrichtigung "Die Effizienz geht diese Woche zurück"
```

#### Gesamtverbrauch über Schwellenwert

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Prüfen Sie, ob der gesamte Stromverbrauch über oder unter einem Schwellenwert
liegt

- Verbrauchsschwellenwert (kWh): Zahl, 100 bis 50000 kWh

**Beispiel:** eine jährliche Erinnerung, sobald der Gesamtverbrauch eine Grenze
überschritten hat.

```text
WENN Die Uhrzeit ist 08:00
UND Tag und Monat sind 1. September
UND Gesamtverbrauch ist über 20000 kWh
DANN Sende eine Push-Benachrichtigung "Zeit für die Wartung"
```

#### Monatliche COP über Schwellenwert

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Prüfen Sie, ob die 30-Tage-Durchschnitts-COP über oder unter einem Schwellenwert
liegt

- Monatlicher COP-Schwellenwert: Zahl, 1 bis 8 COP

**Beispiel:** halten Sie fest, wenn der Monats-COP unter einer Grenze liegt.

```text
WENN Leistungsbericht ist verfügbar
UND Monatliche COP ist unter 3
DANN Erstelle eine Benachrichtigung "Monats-COP unter 3"
```

#### Stromverbrauch über

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Prüfen Sie, ob der aktuelle Stromverbrauch über oder unter einem Schwellenwert
liegt (erfordert Leistungsüberwachung)

- Leistungsschwellenwert (W): Zahl, 100 bis 10000 W

**Beispiel:** stellen Sie die Wärmepumpe auf ECO, wenn sie in der teuren Periode
viel Leistung aufnimmt. Erfordert eine Leistungsmessung; die Aurora III hat
keinen ECO-Modus.

```text
WENN Teure Periode naht
UND Stromverbrauch ist über 1500 Watt
DANN Betriebsmodus einstellen auf ECO
```

#### Tägliche COP über Schwellenwert

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Prüfen Sie, ob die 24-Stunden-Durchschnitts-COP über oder unter einem
Schwellenwert liegt

- Täglicher COP-Schwellenwert: Zahl, 1 bis 8 COP

**Beispiel:** ergänzen Sie den Abendbericht um eine Warnung, wenn der Tages-COP
niedrig war.

```text
WENN Leistungsbericht ist verfügbar
UND Tägliche COP ist unter 2,5
DANN Sende eine Push-Benachrichtigung "Niedriger Tages-COP: [Zusammenfassung]"
```

### Bedingungen: Energiepreise

#### Erkenntniseinsparungen sind über Schwellenwert

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

**Veraltet: in neuen Flows nicht mehr wählbar.**

Überprüfen Sie, ob die geschätzten monatlichen Einsparungen für eine
Erkenntniskategorie einen Schwellenwert überschreiten (in EUR/Monat). Verwenden
Sie für ROI-basierte Filterung (z. B. nur handeln bei Einsparungen >€100/Monat).

- Kategorie: Isolationsleistung, Vorheizstrategie, Wärmespeicher
- Schwellenwert (EUR/Monat): Zahl, 0 bis 500

**Beispiel:** seit Version 3.4.2 schätzt die App keine Einsparung in Euro mehr,
weil sie sich mit dynamischen Preisen nicht belegen lässt. Die Karte gibt immer
falsch zurück. Verwenden Sie stattdessen Erkenntnis ist aktiv.

#### Preis in günstigsten Stunden

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Prüfen Sie, ob die aktuelle Stunde im günstigsten N-Stunden-Block heute liegt.
Nützlich für energieintensive Aufgaben während günstiger Perioden.

- Blockgröße (Stunden): Zahl, 1 bis 12 h

**Beispiel:** bereiten Sie Warmwasser nur in den drei günstigsten Stunden des
Tages. Erfordert Preise über Externe Energiepreise senden.

```text
WENN Alle 1 Stunde
UND Aktuelle Stunde ist in den günstigsten 3 Stunden heute
DANN Warmwassertemperatur einstellen auf 55
SONST Warmwassertemperatur einstellen auf 48
```

#### Preis vs Tagesdurchschnitt

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Prüfen Sie, ob der aktuelle Strompreis vom Tagesdurchschnitt um mindestens die
angegebene Marge abweicht. Nützlich zum Erkennen deutlich niedriger oder hoher
Preise.

- Marge (%): Zahl, 0 bis 50 %

**Beispiel:** Boost, wenn der Preis deutlich unter dem Tagesdurchschnitt liegt,
sonst Normal. Erfordert Preise über Externe Energiepreise senden; die Aurora III
hat kein Boost.

```text
WENN Alle 1 Stunde
UND Aktueller Preis ist unter Tagesdurchschnitt um 20%
DANN Betriebsmodus einstellen auf Boost
SONST Betriebsmodus einstellen auf Normal
```

#### Preistrend ist

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Prüfen Sie, ob die Strompreise in den nächsten N Stunden steigen, fallen oder
stabil sind. Basierend auf linearer Regression mit Konfidenzmetrik.

- Analysefenster (Stunden): Zahl, 1 bis 24 h
- Trend: Steigend, Fallend, Stabil

**Beispiel:** bereiten Sie morgens Warmwasser, wenn die Preise in den nächsten
Stunden steigen, und setzen Sie es später zurück. Erfordert Preise über Externe
Energiepreise senden.

```text
WENN Die Uhrzeit ist 06:00
UND Preistrend für nächste 6 Stunden ist Steigend
DANN Warmwassertemperatur einstellen auf 55
UND Warmwassertemperatur einstellen auf 48 (Verzögerung 3 Stunden)
```

### Bedingungen: Adaptive Regelung und Gebäudemodell

#### Erkenntnis ist aktiv

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Überprüfen Sie, ob eine bestimmte Erkenntniskategorie derzeit aktiv ist (in
Fähigkeiten sichtbar). Gibt falsch zurück, wenn verworfen oder nicht erkannt.

- Kategorie: Isolationsleistung, Vorheizstrategie, Wärmespeicher,
  Gebäudeprofil-Fehlanpassung

**Beispiel:** eine wöchentliche Erinnerung an eine offene Erkenntnis.

```text
WENN Die Uhrzeit ist 09:00
UND Heute ist ein Montag
UND Isolationsleistung Erkenntnis ist aktiv
DANN Sende eine Push-Benachrichtigung "Es gibt eine Erkenntnis zur Dämmung"
```

#### Modellvertrauen ist über Schwellenwert

**Bedingung** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III
über Modbus

Überprüfen Sie, ob das Gebäudemodellvertrauen einen Schwellenwert überschreitet
(0-100%). Verwenden Sie als Qualitätsgate für Flows (z. B. nur
Benachrichtigungen senden, wenn Vertrauen >80%).

- Schwellenwert (%): Zahl, 0 bis 100

**Beispiel:** führen Sie die Empfehlung erst aus, wenn das Gebäudemodell
zuverlässig genug ist.

```text
WENN Adaptive Regelung empfiehlt Temperaturanpassung
UND Modellvertrauen ist über 70%
DANN Zieltemperatur (Sollwert) einstellen auf
    [Empfohlene Zieltemperatur] Automatisch runden (empfohlen)
```

## Aktionen

### Aktionen: Bedienung und Modi

#### Benutzerdefinierte Heizkurve einstellen (L28/L29)

**Aktion** · Aurora I/II über Modbus

Schreibt die DIY-Heizkurve direkt in die Modbus-Register L27, L28 und L29. slope
ist der Kurvenkoeffizient k (z. B. -0.5), intercept ist die Vorlauftemperatur
bei -15°C Außen (L29, z. B. 55). Gültiger Bereich: slope -5.0..0.0, intercept
30..80. Die Capabilities heating_curve_slope und heating_curve_intercept werden
innerhalb von 30 Sekunden per Polling aktualisiert.

- Neigung (k, z. B. -0.5): Zahl
- Schnittpunkt (Vorlauftemp. bei -15°C, z. B. 55): Zahl

**Beispiel:** stellen Sie zu Beginn der Heizsaison eine eigene Heizkurve ein.
Die Karte schaltet die eigene Kurve auch ein; eine Neigung von -0,5 und 50 °C
bei -15 °C außen ergibt bei 5 °C außen 40 °C Vorlauf.

```text
WENN Die Uhrzeit ist 08:00
UND Tag und Monat sind 1. Oktober
DANN Benutzerdefinierte Heizkurve einstellen: Neigung -0.5,
    Schnittpunkt 50°C
```

#### Betriebsmodus einstellen

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus

Systembetriebsmodus einstellen

- Betriebsmodus: ECO, Normal, Boost

**Beispiel:** Boost im günstigsten Block, ECO in der teuren Periode.

```text
WENN Günstigster Block gestartet
DANN Betriebsmodus einstellen auf Boost

WENN Teure Periode naht
DANN Betriebsmodus einstellen auf ECO
```

#### Erzwungene Zusatzheizung schalten

**Aktion** · Aurora III über Modbus

Erzwingt die elektrische Zusatzheizung oder gibt sie wieder frei

- Zustand: ein, aus

**Beispiel:** erzwingen Sie bei strengem Frost die elektrische Zusatzheizung und
geben Sie sie wieder frei, wenn es weniger kalt ist.

```text
WENN Außentemperatur geändert unter -10°C
DANN Erzwungene Zusatzheizung ein schalten

WENN Außentemperatur geändert über -5°C
DANN Erzwungene Zusatzheizung aus schalten
```

#### Geräteleistung einstellen

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus

Gerätestromstatus einstellen

- Stromstatus: Ein, Aus

**Beispiel:** schalten Sie die Wärmepumpe mit einer virtuellen Taste ein und
aus.

```text
WENN Virtuelle Taste Wärmepumpe wird ausgeschaltet
DANN Geräteleistung einstellen auf Aus
```

#### Heizkurveneinstellung einstellen

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus

Heizkurveneinstellung einstellen

- Heizkurveneinstellung: AUS, H1, H2, H3, H4, H5, H6, H7, H8, L1, L2, L3, L4,
  L5, L6, L7, L8 - individuelle Kurve

**Beispiel:** ab der Heizsaison eine höhere Heizkurve.

```text
WENN Die Uhrzeit ist 08:00
UND Tag und Monat sind 1. Oktober
DANN Heizkurveneinstellung einstellen auf H4
```

#### Heizmodus einstellen

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Heizbetriebsmodus einstellen

- Heizmodus (Aurora I/II über Tuya, Aurora I/II über Modbus): Kalt, Heizung,
  Fußbodenheizung, Warmwasser, Kalt- und Warmwasser, Heizung und Warmwasser,
  Fußbodenheizung und Warmwasser
- Heizmodus (Aurora III über Modbus): Kühlen, Heizung, Auto

**Beispiel:** schalten Sie zu Beginn der Heizsaison zurück auf Heizung und
Warmwasser. Bei der Aurora III wählen Sie hier Heizen.

```text
WENN Die Uhrzeit ist 08:00
UND Tag und Monat sind 1. Oktober
DANN Heizmodus einstellen auf Heizung und Warmwasser
```

#### Kurve einstellen (nach Modus)

**Aktion** · Aurora I/II über Modbus

Kurveneinstellung einstellen, geleitet an Heizen, Kühlen, Fußbodenheizung oder
Warmwasser. Auto folgt dem aktuellen Modus der Wärmepumpe.

- Anwenden auf: Auto (aktuellem Modus folgen), Heizen, Kühlen, Fußbodenheizung,
  Warmwasser
- Kurveneinstellung: AUS, H1, H2, H3, H4, H5, H6, H7, H8, L1, L2, L3, L4, L5,
  L6, L7, L8 - individuelle Kurve

**Beispiel:** stellen Sie zu Beginn der Heizsaison die Kurve für die
Fußbodenheizung ein.

```text
WENN Die Uhrzeit ist 08:00
UND Tag und Monat sind 1. Oktober
DANN Kurve einstellen auf L3 für Fußbodenheizung
```

#### Leisemodus einstellen

**Aktion** · Aurora III über Modbus

Stellt die Stufe des Leisemodus der Wärmepumpe ein

- Leisemodus: Aus, Stufe 1, Stufe 2

**Beispiel:** nachts leiser laufen.

```text
WENN Die Uhrzeit ist 22:00
DANN Leisemodus einstellen auf Stufe 2

WENN Die Uhrzeit ist 07:00
DANN Leisemodus einstellen auf Aus
```

#### Sollwert-Temperatur einstellen (nach Modus)

**Aktion** · Aurora I/II über Modbus

Sollwert-Temperatur einstellen, geleitet an Heizen, Kühlen oder Fußbodenheizung.
Auto folgt dem aktuellen Modus der Wärmepumpe.

- Temperatur (°C): Zahl, 7 bis 60 °C
- Anwenden auf: Auto (aktuellem Modus folgen), Heizen, Kühlen, Fußbodenheizung
- Bei Dezimalwert: Automatisch runden (empfohlen), Fehler anzeigen

**Beispiel:** nachts ein niedrigerer Sollwert für die Fußbodenheizung. Der
Sollwert bleibt nur, wenn die Heizkurve AUS ist.

```text
WENN Die Uhrzeit ist 23:00
DANN Sollwert einstellen auf 30 für Fußbodenheizung
    Automatisch runden (empfohlen)
```

#### Stromverbrauchsprüfung einstellen

**Aktion** · Aurora I/II über Tuya

Stromverbrauchsprüfungsstufe einstellen

- Stromverbrauchsprüfung: Zahl, 0 bis 2

**Beispiel:** diese Einstellung gibt an, welches Leistungsmodul die Wärmepumpe
hat (0 = keins, 1 = einphasig, 2 = dreiphasig). Ändern Sie sie nur auf Anweisung
des Installateurs; verwenden Sie die Karte nicht in einem automatischen Flow.

#### Warmwasserfunktion schalten

**Aktion** · Aurora III über Modbus

Schaltet die Warmwasserbereitung ein oder aus

- Zustand: ein, aus

**Beispiel:** schalten Sie die Warmwasserbereitung im Urlaub aus, mit einer
Ja/Nein-Variable Urlaub.

```text
WENN Eine Variable hat sich geändert (Urlaub)
UND Urlaub ist gleich ja
DANN Warmwasserfunktion aus schalten
```

#### Warmwasserkurve einstellen

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus

Warmwasserkurveneinstellung für optimale Effizienz einstellen

- Warmwasserkurveneinstellung: AUS, H1, H2, H3, H4

**Beispiel:** morgens eine höhere Warmwasserkurve für die Duschspitze.

```text
WENN Die Uhrzeit ist 05:30
DANN Warmwasserkurve einstellen auf H3

WENN Die Uhrzeit ist 09:00
DANN Warmwasserkurve einstellen auf H1
```

#### Warmwassertemperatur einstellen

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Warmwassertemperatureinstellung einstellen

- Warmwassertemperatur (°C): Zahl, 20 bis 75 °C

**Beispiel:** bereiten Sie im günstigsten Block zusätzlich Warmwasser.

```text
WENN Günstigster Block gestartet
DANN Warmwassertemperatur einstellen auf 55

WENN Teure Periode naht
DANN Warmwassertemperatur einstellen auf 48
```

#### Wassersteuermodus einstellen

**Aktion** · Aurora I/II über Tuya

Wassersteuermoduseinstellung einstellen

- Wassersteuermodus: Zahl, 0 bis 1

**Beispiel:** dies ist eine Installationseinstellung. Ändern Sie sie nur auf
Anweisung des Installateurs; verwenden Sie die Karte nicht in einem
automatischen Flow.

#### Zieltemperatur (Sollwert) einstellen

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Zieltemperatur (Sollwert) für die Wärmepumpe einstellen

- Temperatur (°C) (Aurora I/II über Tuya): Zahl, 5 bis 75 °C
- Temperatur (°C) (Aurora I/II über Modbus, Aurora III über Modbus): Zahl, 15
  bis 60 °C
- Bei Dezimalwert: Automatisch runden (empfohlen), Fehler anzeigen

**Beispiel:** so wenden Sie die Empfehlung der adaptiven Regelung an: Die
Regelung stellt den Sollwert nicht selbst ein, sondern gibt eine Empfehlung, die
Ihr Flow ausführt. Bei der Aurora I/II bleibt der Sollwert nur, wenn die
Heizkurve AUS ist. Setzen Sie den Sollwert nicht zusätzlich mit einem anderen
Flow, sonst arbeiten beide gegeneinander.

```text
WENN Adaptive Regelung empfiehlt Temperaturanpassung
DANN Zieltemperatur (Sollwert) einstellen auf
    [Empfohlene Zieltemperatur] Automatisch runden (empfohlen)
```

### Aktionen: Energie und Effizienz (COP)

#### Leistungsbericht erstellen

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Erstellen Sie einen umfassenden Wärmepumpen-Leistungsbericht mit Bewertungen in
7 Bereichen (Effizienz, Gebäude, Abtauung, Energie, Preise, Telemetrie,
Gesundheit). Gibt Gesamtbewertung, Einstufung und umsetzbare Empfehlungen
zurück.

Tokens: Gesamtbewertung (0-100), Bewertung, Zusammenfassung, Empfehlungen,
Vollständiger Bericht (JSON)

**Beispiel:** erstellen Sie den Bericht zu einer anderen Zeit als 23:00 und
leiten Sie das Ergebnis weiter.

```text
WENN Die Uhrzeit ist 18:00
UND Heute ist ein Sonntag
DANN Leistungsbericht erstellen
UND Sende eine Push-Benachrichtigung "[Bewertung]: [Zusammenfassung]"
```

### Aktionen: Energiepreise

#### Energiepreise an Wärmepumpe senden

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Sendet stündliche Energiepreise (€/kWh) von externer Quelle zur preisbasierten
Optimierung. Akzeptiert zwei Formate: Array [0.11,0.10,...] wobei
Index=Stundenoffset (0=aktuelle Stunde), oder Objekt {"0":0.11,"1":0.10,...} mit
Stundenschlüsseln.

- Energiepreise (JSON): Text

**Beispiel:** die App holt selbst keine Preise. Senden Sie sie als Text aus
einer anderen App, einer Variable oder einer HTTP-Anfrage, zum Beispiel
[0.21,0.19,0.18,...] in €/kWh, wobei die erste Zahl die aktuelle Stunde ist. Die
Preise gelten ab dem Empfang; senden Sie neue, sobald sie verfügbar sind, zum
Beispiel jeden Nachmittag nach der Veröffentlichung der Preise für morgen.

```text
WENN Die Uhrzeit ist 14:30
DANN Externe Energiepreise [Preise] für Preisoptimierung senden
```

### Aktionen: Adaptive Regelung und Gebäudemodell

#### Erkenntnisanalyse erzwingen

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Sofort Gebäudeerkenntnisse auswerten (ohne auf 50-Minuten-Intervall zu warten).
Gibt die Anzahl der erkannten Erkenntnisse und das aktuelle Modellvertrauen
zurück.

Tokens: Erkenntnisse erkannt, Modellvertrauen (%)

**Beispiel:** aktualisieren Sie die Erkenntnisse sofort, statt auf die nächste
Analyse zu warten (alle 50 Minuten).

```text
WENN Die Uhrzeit ist 08:00
DANN Erkenntnisanalyse erzwingen
UND Erstelle eine Benachrichtigung "[Erkenntnisse erkannt] Erkenntnisse"
```

#### Gewünschte Innentemperatur einstellen

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Stellen Sie die gewünschte Raumtemperatur für die adaptive Steuerung ein. Das
adaptive System passt den Wärmepumpen-Sollwert an, um diese Temperatur zu
erreichen.

- Innentemperatur : Zahl, 15 bis 25 °C

**Beispiel:** nachts eine niedrigere gewünschte Innentemperatur. Die adaptive
Regelung passt ihre Empfehlung daran an.

```text
WENN Die Uhrzeit ist 22:30
DANN Gewünschte Innentemperatur einstellen auf 19°C

WENN Die Uhrzeit ist 06:30
DANN Gewünschte Innentemperatur einstellen auf 21°C
```

#### Vorheiz-Startzeit berechnen

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Berechnet, wann mit dem Heizen begonnen werden soll, um die gewünschte
Innentemperatur zu einer bestimmten Zeit zu erreichen. Verwendet die thermische
Zeitkonstante (τ) des Gebäudemodells für genaue Vorhersage.

- Ziel-Innentemperatur (°C): Zahl, 16 bis 28
- Fertig um (HH:MM): Text

Tokens: Startzeit, Dauer (Stunden), Vorgeschlagene Sollwerterhöhung (°C),
Modellvertrauen (%)

**Beispiel:** berechnen Sie nachts, wann das Heizen beginnen muss, um um 07:00
21 °C zu erreichen. Die Zeit geben Sie als HH:MM ein.

```text
WENN Die Uhrzeit ist 04:00
DANN Berechne wann mit dem Heizen zu beginnen um 21°C um 07:00
    zu erreichen
UND Sende eine Push-Benachrichtigung "Start um [Startzeit]"
```

### Aktionen: Externe Daten

#### Durchflussdaten an Wärmepumpe senden

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Sendet Wasserdurchflussdaten an die Wärmepumpe für erweiterte COP-Berechnungen

- Wasserdurchflussrate (L/min): Zahl, 0 bis 200

**Beispiel:** senden Sie den Durchfluss eines externen Durchflussmessers, wenn
die Wärmepumpe ihn nicht selbst misst. Ein Wert gilt eine Stunde.

```text
WENN (Trigger Ihres Durchflussmessers bei einer neuen Messung)
DANN Sende [Durchfluss]L/min an Wärmepumpe für COP-Berechnung
```

#### Leistungsdaten an Wärmepumpe senden

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Sendet Stromverbrauchsdaten an die Wärmepumpe für erweiterte COP-Berechnungen

- Stromverbrauch (W): Zahl, 0 bis 50000

**Beispiel:** senden Sie die gemessene Leistung eines kWh-Zählers oder einer
smarten Steckdose, auch wenn sie auf 0 W fällt. Das ergibt die genaueste
COP-Berechnung und füllt Tagesverbrauch und Tageskosten. Für den COP gilt ein
Wert eine Stunde; der Tagesverbrauch rechnet mit dem zuletzt empfangenen Wert
weiter.

```text
WENN Die Leistung hat sich geändert (kWh-Zähler Wärmepumpe)
DANN Sende [Leistung]W an Wärmepumpe für COP-Berechnung
```

#### Raumtemperatur an Wärmepumpe senden

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Sendet aktuelle Raum-/Innentemperatur von einem externen Sensor zur Aktivierung
der adaptiven Temperatursteuerung

- Raumtemperatur (°C): Text

**Beispiel:** die adaptive Regelung funktioniert nur mit einer Innentemperatur.
Senden Sie sie bei jeder Änderung eines Raumsensors, am besten mit dem Token des
Sensors. Bleibt der Wert 12 Stunden gleich, meldet die App das; nach 24 Stunden
korrigiert die Regelung nicht mehr darauf. Wenn Sie selbst einen Wert eingeben,
verwenden Sie einen Punkt (21.5).

```text
WENN Die Temperatur hat sich geändert (Raumsensor Wohnzimmer)
DANN Sende [Temperatur]°C Raumtemperatur für adaptive Steuerung
```

#### Solarleistung an Wärmepumpe senden

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Sendet Solarertrag für genaue Sonnenstrahlungsberechnung. Verwenden mit
SolarEdge, Enphase, usw.

- Solarleistung (W): Zahl, 0 bis 50000

**Beispiel:** die App rechnet die Leistung der Solarmodule in Sonnenstrahlung
für das Gebäudemodell um. Füllen Sie dafür Solarmodulsystemgröße (Wp) in den
Einstellungen aus. Ein Wert gilt eine Stunde; danach greift die App auf die
Wettervorhersage zurück.

```text
WENN Die Leistung hat sich geändert (Wechselrichter)
DANN Sende Solarleistung [Leistung]W an Wärmepumpe
```

#### Sonnenstrahlung an Wärmepumpe senden

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Sendet Sonnenstrahlung für Gebäudemodell. Verwenden mit KNMI Wetter-App.

- Sonnenstrahlung (W/m²): Zahl, 0 bis 1500

**Beispiel:** senden Sie die gemessene Sonnenstrahlung, zum Beispiel aus einer
Wetter-App. Solarmodule haben Vorrang, wenn sie ebenfalls Daten senden. Ein Wert
gilt eine Stunde.

```text
WENN Alle 15 Minuten
DANN Sende Sonnenstrahlung [Sonnenstrahlung Ihrer Wetter-App] W/m²
    an Wärmepumpe
```

#### Umgebungstemperatur an Wärmepumpe senden

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Sendet Umgebungstemperaturdaten an die Wärmepumpe für erweiterte COP/Thermische
Masse Berechnungen

- Umgebungstemperatur (°C): Zahl, -50 bis 50

**Beispiel:** verwenden Sie einen eigenen Außensensor statt des Sensors der
Wärmepumpe. Ein Wert gilt eine Stunde; danach greift die adaptive Regelung auf
die Wettervorhersage und den Sensor der Wärmepumpe zurück.

```text
WENN Die Temperatur hat sich geändert (Außensensor)
DANN Sende [Temperatur]°C an Wärmepumpe für COP/Thermische Masse
    Berechnung
```

#### Windgeschwindigkeit an Wärmepumpe senden

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Sendet Windgeschwindigkeit für Wärmeverlustkorrektur. Verwenden mit KNMI
Wetter-App.

- Windgeschwindigkeit (km/h): Zahl, 0 bis 200

**Beispiel:** senden Sie die Windgeschwindigkeit für die Korrektur des
Wärmeverlusts. Die Karte erwartet km/h; ein Wert in m/s mal 3,6 ergibt km/h. Ein
Wert gilt eine Stunde; danach greift die App auf die Wettervorhersage zurück.

```text
WENN Alle 15 Minuten
DANN Sende Windgeschwindigkeit [Windgeschwindigkeit Ihrer Wetter-App]
    km/h an Wärmepumpe
```

### Aktionen: Rechenhilfen

#### Aktuellen Saisonmodus abrufen

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Gibt den Heiz-/Kühlmodus basierend auf dem aktuellen Datum zurück.
Heizsaison: 1. Okt - 15. Mai (gemäß EN 14825 SCOP-Standard). Perfekt zum
automatischen Umschalten zwischen Winter- und Sommerplänen.

Tokens: Modus, Ist Heizsaison, Ist Kühlsaison, Tage bis zum Saisonwechsel

**Beispiel:** die Heizsaison läuft vom 1. Oktober bis 15. Mai. Speichern Sie das
Ergebnis in einer Ja/Nein-Variable, damit andere Flows darauf prüfen können.

```text
WENN Die Uhrzeit ist 00:05
DANN Saisonmodus abrufen
UND Setze eine Ja/Nein-Variable: Heizsaison auf [Ist Heizsaison]
```

#### Berechne Custom Heizkurve (L28/L29)

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus

Berechnet Vorlauftemperatur mit Adlar Custom Heizkurve. Verwendet L29
(Solltemperatur bei -15°C) und L28 (Neigungsgrad pro 10°C). Beispiel: L29=55°C
bei -15°C mit L28=-5 ergibt Neigung -0.5/°C, Formel y = -0.5x + 47.5. Für
Außentemp 5°C → Vorlauftemp 45°C.

- Außentemperatur: Text
- L29: Solltemperatur bei -15°C außen (°C): Zahl
- L28: Neigungsgrad (pro 10°C): Zahl

Tokens: Vorlauftemperatur, Heizkurve Formel

**Beispiel:** berechnen Sie die Vorlauftemperatur einer geraden Heizkurve wie
der eigenen Heizkurve der Wärmepumpe: L29 ist der Vorlauf bei -15 °C außen, L28
die Neigung pro 10 °C. Mit 55 und -5 ergibt 5 °C außen 45 °C Vorlauf. Praktisch,
um eine Kurve zuerst auszuprobieren.

```text
WENN Alle 30 Minuten
DANN Heizkurve berechnen: L29=55°C bei -15°C, L28=-5/10°C
    mit Außentemp [Außentemperatur der Wärmepumpe]
UND Erstelle eine Benachrichtigung "Kurve ergibt [Vorlauftemperatur] °C"
```

#### Wert aus Kurvenregeln berechnen

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Berechnet Ausgabewerte basierend auf Eingabe (z.B. Außentemperatur →
Heizsollwert). Format: '[Operator] Schwellenwert : Wert'. Operatoren: >, >=, <,
<=, ==, !=. Wertet von oben nach unten aus, gibt erste Übereinstimmung zurück.
Verwenden Sie 'default : Wert' als Fallback. Beispiel Heizkurve: '< 0 : 55, < 5
: 50, < 10 : 45, default : 35'

- Eingabewert: Text
- Kurven-Definition: Text

Tokens: Ergebnis-Wert

**Beispiel:** erstellen Sie eine eigene Heizkurve in Stufen: Die erste passende
Regel bestimmt das Ergebnis. Bei der Aurora I/II bleibt der Sollwert nur, wenn
die Heizkurve der Wärmepumpe AUS ist; verwenden Sie dies nicht zusammen mit der
adaptiven Regelung.

```text
WENN Alle 30 Minuten
DANN Berechne Wert via [Außentemperatur der Wärmepumpe]
    mit Kurvenregeln < 0 : 55, < 5 : 50, < 10 : 45, default : 35
UND Zieltemperatur (Sollwert) einstellen auf [Ergebnis-Wert]
    Automatisch runden (empfohlen)
```

#### Wert aus Zeitplan berechnen

**Aktion** · Aurora I/II über Tuya · Aurora I/II über Modbus · Aurora III über
Modbus

Bewertet die aktuelle Zeit anhand eines Tagesplans, um Ausgabewerte zu
berechnen. Perfekt für zeitbasierte Temperaturplanung, zeitabhängige Tarife und
automatisierte tägliche Routinen.

- Zeitplan: Text

Tokens: Ergebniswert

**Beispiel:** ein Tagesplan für die gewünschte Innentemperatur. Zeiträume über
Mitternacht sind erlaubt; mit default : Wert fangen Sie den Rest ab.

```text
WENN Alle 30 Minuten
DANN Wert aus Zeiträumen berechnen
    06:00-22:00: 21, 22:00-06:00: 19
UND Gewünschte Innentemperatur einstellen auf [Ergebniswert]°C
```

### Aktionen: Modbus-Register

#### Modbus-Register lesen

**Aktion** · Aurora I/II über Modbus · Aurora III über Modbus

Liest ein Modbus Holding-Register (FC03) und gibt den Registerwert als
Flow-Token zurück. Adresse in Hex (0x0301) oder Dezimal (769).
Temperaturregister speichern Werte ×10 — Ergebnis durch 10 teilen für °C.

- Registeradresse: Text

Tokens: Registerwert

**Beispiel:** lesen Sie ein Register, das die App selbst nicht anzeigt. Bei der
Aurora I/II ist die Adresse hex oder dezimal (0x0301 = 769, der Heiz-Sollwert);
Temperaturen sind ×10 gespeichert. Bei der Aurora III verwenden Sie die Zahl
nach 4- (4-2100 wird 2100); Eingangsregister (3-) sind mit dieser Karte nicht
lesbar.

```text
WENN Die Uhrzeit ist 12:00
DANN Modbus-Register 0x0301 lesen
UND Erstelle eine Benachrichtigung "Register 0x0301: [Registerwert]"
```

#### Modbus-Register schreiben

**Aktion** · Aurora I/II über Modbus · Aurora III über Modbus

Schreibt einen Rohwert in ein Modbus Holding-Register (FC06). Adresse in Hex
(0x0301) oder Dezimal (769). Temperaturregister erwarten ×10 — 450 für 45 °C
eingeben. Vorsicht: falsche Werte können das Verhalten der Wärmepumpe
beeinflussen.

- Registeradresse: Text
- Registerwert: Zahl

**Beispiel:** schreiben Sie nur in ein Register, von dem Sie wissen, was es tut;
ein falscher Wert kann die Wärmepumpe stören. Temperaturen sind ×10: 350 ist 35
°C. Bei der Aurora I/II bleibt der Heiz-Sollwert (0x0301) nur, wenn die
Heizkurve AUS ist.

```text
WENN Die Uhrzeit ist 06:00
DANN 350 in Modbus-Register 0x0301 schreiben
```
