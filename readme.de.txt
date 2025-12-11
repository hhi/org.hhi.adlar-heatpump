Diese App gibt Ihnen die vollständige Kontrolle über Ihre Adlar Castra Aurora Wärmepumpe direkt über Ihr Homey Smart Home System. Sie können Ihre Wärmepumpe überwachen, bedienen und optimieren, ohne auf Internetverbindungen angewiesen zu sein.

Unterstützte Sprachen
🇬🇧 English
🇩🇪 Deutsch
🇫🇷 Français
🇳🇱 Nederlands

HAUPTVORTEILE

LOKALE STEUERUNG
- Direkte Verbindung zu Ihrer Wärmepumpe über das lokale Netzwerk
- Keine Internetverbindung für den täglichen Gebrauch erforderlich
- Schnelle Reaktionszeiten und zuverlässige Verbindung

ERWEITERTE ÜBERWACHUNG
- Echtzeit-Temperaturmessungen (12 verschiedene Sensoren)
- Stromverbrauch und Effizienzüberwachung
- Automatische COP (Leistungszahl) Berechnung mit 8 verschiedenen Methoden
- Saisonale SCOP-Analyse nach europäischen Standards

VOLLSTÄNDIGE BEDIENUNG
- Temperatureinstellung und Heizmodi
- Heizkurvenanpassungen
- Warmwassertemperatursteuerung
- Timer und automatische Funktionen

INTELLIGENTE AUTOMATISIERUNG
- 67 Flow-Karten für erweiterte Automatisierung
- Intelligente Fehlererkennung und -behebung
- Wetterabhängige Optimierung
- Energieeffizienztrends und Warnungen

BENUTZERFREUNDLICH
- Vollständig lokalisierte Benutzeroberfläche (Deutsch/Englisch/Niederländisch/Französisch)
- Mobilfreundliche Anzeige
- Klare Statusanzeigen
- Verständliche Fehlermeldungen

INSTALLATION

WAS BENÖTIGEN SIE?
- Homey Pro (Firmware-Version 12.2.0 oder höher)
- Adlar Castra Aurora Wärmepumpe
- Lokale Netzwerkverbindung zur Wärmepumpe
- Geräteanmeldedaten (ID, Lokaler Schlüssel, IP-Adresse)

WIE ERHALTEN SIE DIE GERÄTEANMELDEDATEN?
Sie können den erforderlichen lokalen Schlüssel und andere Daten erhalten, indem Sie die Anweisungen befolgen in:
/docs/Tuya_LocalKey_Homey_Guide_DE.pdf

INSTALLATIONSSCHRITTE
1. Installieren Sie die App über den Homey App Store
2. Fügen Sie ein neues Gerät hinzu und wählen Sie "Intelligent Heat Pump"
3. Geben Sie Ihre Geräteanmeldedaten ein:
   - Geräte-ID
   - Lokaler Schlüssel
   - IP-Adresse
   - Protokollversion (wählen Sie 3.3, 3.4 oder 3.5)
4. Schließen Sie den Kopplungsprozess ab

PROTOKOLLVERSIONSAUSWAHL
Die Protokollversion bestimmt, wie die App mit Ihrer Wärmepumpe kommuniziert:
- 3.3 (Standard): Funktioniert für die meisten Adlar/Aurora Wärmepumpen
- 3.4: Erforderlich für einige neuere Modelle
- 3.5: Erforderlich für neueste Firmware-Versionen

Wenn Sie Verbindungsprobleme haben (häufige Verbindungsabbrüche, ECONNRESET-Fehler),
versuchen Sie eine andere Protokollversion über die Gerätereparatur (siehe Abschnitt Fehlerbehebung).
- ECONNRESET um 00:00 Uhr tritt normalerweise aufgrund eines täglichen Neustarts Ihres Routers auf;
- HMAC-Mismatch, Standard ist Protokollversion 3.3, wechseln Sie zu 3.4 (oder 3.5)
- ECONNREFUSED <ip-adresse> bestimmt höchstwahrscheinlich eine falsche IP-Adresse,
   weisen Sie Ihrer Wärmepumpe eine statische (DHCP) Adresse zu  

WICHTIGE FUNKTIONEN

TEMPERATURÜBERWACHUNG
- Wassereinlass- und Auslasstemperaturen
- Umgebungstemperatur
- Warmwassertemperatur
- Kompressortemperaturen
- Wärmetauschertemperaturen

ENERGIE UND EFFIZIENZ
- Echtzeit-Stromverbrauch
- Täglicher und gesamter Energieverbrauch
- COP-Berechnung (wie effizient Ihre Wärmepumpe arbeitet)
- Trendanalyse zur Optimierung
- Saisonale Leistungsüberwachung

SYSTEMSTEUERUNG
- Ein/Aus-Schaltung
- Heizmodusauswahl
- Temperaturzieleinstellung
- Heizkurvenanpassungen
- Warmwassereinstellungen

AUTOMATISIERUNG MIT FLOW-KARTEN
- Temperaturwarnungen
- Energieverbrauchsüberwachung
- Effizienzoptimierung
- Wetterabhängige Anpassungen
- Systemtimer-Benachrichtigungen
- Dynamischer Kurvenrechner für erweiterte Optimierung

KURVENRECHNER (Erweiterte Funktion)
Berechnen Sie Ausgabewerte basierend auf konfigurierbaren Kurven für intelligente Automatisierung:
- Wetterabhängige Heizung: Automatische Sollwertanpassung basierend auf Außentemperatur
- Zeitbasierte Optimierung: Einstellungen nach Stunde/Tag/Saison anpassen
- COP-basierte Feinabstimmung: Dynamische Temperaturanpassungen basierend auf Effizienz
- Unterstützt 6 Operatoren: >, >=, <, <=, ==, != mit Standard-Fallback
- Maximum 50 Kurveneinträge für komplexe Szenarien
- Echtzeitberechnung mit benutzerfreundlichen Fehlermeldungen

Beispiel: Wetterabhängige Heizung
"Wenn sich die Außentemperatur ändert, berechnen Sie den Heizsollwert mit Kurve:
< -5°C : 60°C, < 0°C : 55°C, < 5°C : 50°C, < 10°C : 45°C, default : 35°C"
Ergebnis: Passt die Heizung automatisch an die Wetterbedingungen an
Das Eingabefeld akzeptiert Zahlen, Variablen oder Homey-unterstützte {{ Ausdruck }} Syntax.

ZEITBASIERTER PLANER & SAISONMODUS (Erweiterte Funktionen)
Zwei neue Rechner für intelligente zeit- und saisonbasierte Automatisierung:

Zeitbasierter Planer:
Berechnen Sie Werte basierend auf Tageszeit-Zeitplänen für tägliche Temperaturprogrammierung.
Beispiel: "06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, 23:00-06:00: 18"
- Unterstützt Nachtbereiche (z.B. 23:00-06:00)
- Maximum 30 Zeitbereiche mit Standard-Fallback
- Perfekt für Komfortplanung und Nutzungszeitoptimierung

Saisonmoduserkennung:
Automatische Erkennung der Heiz-/Kühlsaison basierend auf Datum.
- Heizsaison: 1. Okt - 15. Mai (ausgerichtet auf EN 14825 SCOP-Standard)
- Gibt Modus, Saisonflags und Tage bis zum Saisonwechsel zurück
- Perfekt für automatische Winter-/Sommerplan-Umschaltung

Kombiniertes Beispiel:
Verwenden Sie alle drei Rechner zusammen für ultimative Automatisierung:
Wetterkompensation (Außentemp.) + Zeitplanung (Komfort) + Saisonmodus (Winter/Sommer)
Ergebnis: Dynamische Heizung, die sich an Wetter, Tageszeit und Saison anpasst

COP (LEISTUNGSZAHL) ÜBERWACHUNG

Die App berechnet automatisch, wie effizient Ihre Wärmepumpe arbeitet (siehe Verzeichnis /docs/COP calculation im Quellcode):
- COP-Wert: Verhältnis zwischen erzeugter Wärme und verbrauchter Elektrizität
- Tagesdurchschnitte: 24-Stunden-Trends
- Wöchentliche Analyse: Langzeitperformance
- Saisonale Überwachung: SCOP nach europäischen Standards
- Diagnose-Feedback: Was die Effizienz beeinflusst

WAS BEDEUTEN COP-WERTE?
- COP 2.0-3.0: Durchschnittliche Leistung
- COP 3.0-4.0: Gute Leistung
- COP 4.0+: Ausgezeichnete Leistung

FEHLERBEHEBUNG UND SUPPORT

HÄUFIGE PROBLEME

Verbindungsprobleme (ECONNRESET-Fehler)
Wenn Ihr Gerät ständig die Verbindung trennt oder Verbindungsreset-Fehler anzeigt:

SCHNELLE LÖSUNG (dauert weniger als 2 Minuten):
1. Öffnen Sie die Geräteeinstellungen in der Homey-App
2. Scrollen Sie nach oben zu den Verbindungseinstellungen
3. Ändern Sie die Protokollversion auf 3.4 (oder versuchen Sie 3.5, wenn 3.4 nicht funktioniert)
4. Optional: Aktualisieren Sie andere Anmeldedaten (IP-Adresse, Lokaler Schlüssel, Geräte-ID)
5. Klicken Sie auf "Speichern" und warten Sie 1-2 Minuten auf die Wiederverbindung

Erfolgsindikatoren:
- Verbindungsstatus zeigt "verbunden"
- Keine ECONNRESET-Fehler mehr
- Sensordaten werden normal aktualisiert
- Gerät bleibt verfügbar

Andere häufige Probleme:
- Keine Verbindung: Überprüfen Sie IP-Adresse, lokalen Schlüssel und Netzwerkkonnektivität
- Schwankende Werte: Normal während des Systemstarts
- Fehlercodes: Siehe App für spezifische Erklärung pro Fehlercode
- Kopplung schlägt fehl: Versuchen Sie verschiedene Protokollversionen (3.3, 3.4, 3.5)

MANUELLE VERBINDUNGSRÜCKSETZUNG (Temporäre Problemumgehung)
Wenn Ihr Gerät den Status „Verbindung getrennt" anzeigt und sich nicht automatisch neu verbindet:

ALTERNATIVE SCHNELLLÖSUNG:
1. Öffnen Sie die Gerätesteuerung in der Homey-App
2. Ändern Sie den Arbeitsmodus auf einen anderen Wert (z.B. von „Heizen" auf „Kühlen")
3. Warten Sie 5-10 Sekunden
4. Ändern Sie den Arbeitsmodus zurück auf den ursprünglichen Wert
5. Die Verbindung wird normalerweise innerhalb von Sekunden wiederhergestellt

Diese Methode funktioniert, weil das Ändern des Arbeitsmodus einen aktiven Befehl an
das Gerät sendet, wodurch schlafende Verbindungen reaktiviert werden.

HINWEIS: Ab v1.0.12 löst die App dies automatisch innerhalb von 10 Minuten.
Diese manuelle Methode ist nur für ältere App-Versionen oder als Notfall-Fallback erforderlich.

GERÄTEANMELDEDATEN AKTUALISIEREN
Sie können Geräteanmeldedaten ohne erneute Kopplung aktualisieren:
1. Gehen Sie zu den Geräteeinstellungen in der Homey-App
2. Scrollen Sie nach oben zu den Verbindungseinstellungen
3. Aktualisieren Sie die Anmeldedaten (IP-Adresse, Lokaler Schlüssel, Geräte-ID, Protokollversion)
4. Klicken Sie auf "Speichern" - Gerät verbindet sich automatisch neu

BENÖTIGEN SIE HILFE?
- Dokumentation: Prüfen Sie den /docs Ordner im Quellcode auf Github für detaillierte Informationen
- Community: Homey Community Forum (Themen-ID: 143690)
- Probleme: Melden Sie Probleme auf GitHub

ERWEITERTE FUNKTIONEN

GERÄTEEINSTELLUNGEN (Pro Gerät konfigurieren)
Zugriff über Geräteeinstellungen in der Homey-App:

Verbindungseinstellungen:
- Protokollversion: Tuya-Protokollversion (3.3, 3.4, 3.5)
- Geräte-ID, Lokaler Schlüssel, IP-Adresse: Verbindungsanmeldedaten

COP-Berechnungseinstellungen:
- COP-Berechnung aktivieren/deaktivieren
- Integration externer Leistungsmessungen
- Integration externer Durchflussdaten
- Integration externer Umgebungstemperatur

Flow-Karten-Steuerung:
Sie können steuern, welche Flow-Karten sichtbar sind (deaktiviert/auto/aktiviert):
- Temperaturwarnungen: Temperaturschwellenwertalarme
- Spannungs-/Stromüberwachung: Elektrisches Systemmonitoring
- Leistungswarnungen: Stromverbrauchsalarme
- Systemstatusänderungen: Kompressor, Abtauen, Systemzustände
- Effizienzüberwachung: COP-Trends und Ausreißer
- Expertenfunktionen: Erweiterte Diagnose-Flow-Karten

Auto-Modus (empfohlen):
Zeigt nur Flow-Karten für Sensoren mit ausreichenden Daten (kürzlich aktualisiert, keine Fehler).


Kurvensteuerungen (optional):
- Aktivieren Sie Auswahlsteuerungen für Heizungs- und Warmwasserkurven
- Standard: Deaktiviert (Sensoren immer sichtbar, Auswahlen verborgen)
- Aktivieren für fortgeschrittene Benutzer, die direkte Kurvenanpassung wünschen

Leistungsmesseinstellungen:
- Leistungsmessungen von der Wärmepumpe aktivieren/deaktivieren
- Verwaltet automatisch die Sichtbarkeit verwandter Flow-Karten
- Nützlich, wenn Sie eine externe Leistungsüberwachung haben

APP-ÜBERGREIFENDE INTEGRATION
Verbinden Sie sich mit anderen Homey-Apps für verbesserte COP-Berechnung (siehe /docs/COP flow-card-setup.md):
- Externe Leistungsmessungen (von Ihrem Smart Meter)
- Externe Wasserdurchflussdaten
- Externe Umgebungstemperaturdaten

SICHERHEIT UND ZUVERLÄSSIGKEIT

AUTOMATISCHE ÜBERWACHUNG
- Kritische Temperaturwarnungen
- Verbindungsstatuskontrolle
- Systemfehlererkennung
- Systemtimer-Benachrichtigungen

INTELLIGENTE WIEDERHERSTELLUNG
- Automatische Wiederverbindung
- Fehlerkorrektur
- Statuswiederherstellung
- Benutzerfreundliche Fehlermeldungen

