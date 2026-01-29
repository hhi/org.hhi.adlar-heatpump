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
- Echtzeit-Temperaturmessungen (interne Wärmepumpensensoren)
- Stromverbrauch und Effizienzüberwachung
- Automatische COP (Leistungszahl) Berechnung mit 8 verschiedenen Methoden
- Saisonale SCOP-Analyse nach europäischen Standards
- Umfangreiche Funktionen für vollständige Kontrolle

VOLLSTÄNDIGE BEDIENUNG
- Temperatureinstellung und Heizmodi
- Heizkurvenanpassungen
- Warmwassertemperatursteuerung
- Timer und automatische Funktionen

INTELLIGENTE AUTOMATISIERUNG
- Umfangreiche Flow-Karten für erweiterte Automatisierung
- Intelligente Fehlererkennung und -behebung
- Wetterabhängige Optimierung
- Energieeffizienztrends und Warnungen
- Zeitbasierte Planung und Saisonmoduserkennung
- Adaptive Temperaturregelung mit PI-Regler
- Gebäudemodell-Lernen mit maschinellem Lernen
- Gebäudeeinblicke & Empfehlungen mit ROI-Schätzungen
- Energiepreisoptimierung mit Day-Ahead-Preisen
- COP-Optimierung für maximale Effizienz
- Umfassende Diagnosetools zur Fehlerbehebung
- Wind- und Solarintegration für Gebäudemodell
  * Externe Windgeschwindigkeit für Windchill-Korrektur des Wärmeverlusts
  * Sonneneinstrahlung und PV-Leistung für präzise Solargewinn-Berechnung
  * Verbessert Gebäudemodell-Lerngenauigkeit mit Echtzeit-Wetterdaten

BENUTZERFREUNDLICH
- Vollständig lokalisierte Benutzeroberfläche
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
/docs/setup/Tuya_LocalKey_Homey_Guide_DE.pdf

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
versuchen Sie eine andere Protokollversion über die Geräteeinstellungen.
- ECONNRESET um 00:00 Uhr tritt normalerweise aufgrund eines täglichen Neustarts Ihres Routers auf
- HMAC-Mismatch: Standard ist Protokollversion 3.3, wechseln Sie zu 3.4 (oder 3.5)
- ECONNREFUSED <ip-adresse>: höchstwahrscheinlich eine falsche IP-Adresse,
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
- Stündliche und tägliche Kostenberechnung

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
Ergebnis: Passt die Heizung automatisch an die Wetterbedingungen an.
Das Eingabefeld akzeptiert Zahlen, Variablen oder Homey-unterstützte {{ Ausdruck }} Syntax.

ADLAR CUSTOM HEIZKURVENRECHNER (L28/L29)
Berechnet die Vorlauftemperatur direkt aus den Adlar Custom Heizkurvenparametern:

Was sind L28 und L29?
- L29: Gewünschte Vorlauftemperatur bei -15°C Außentemp. (Referenzpunkt, z.B. 55°C)
- L28: Neigungsgrad pro 10°C Temperaturänderung (z.B. -5 = -0,5°C pro Grad)

Wie funktioniert es?
Die Formel y = ax + b wird automatisch berechnet:
- Steigung (a) = L28 ÷ 10
- Achsenabschnitt (b) = L29 - (Steigung × -15°C)
Beispiel: L29=55°C, L28=-5 → Formel: y = -0,5x + 47,5

Beispiel-Flow:
"Wenn sich die Außentemperatur ändert, berechne Custom Heizkurve
mit L29=55°C bei -15°C, L28=-5 pro 10°C, Außentemp. {{outdoor_temperature}}"
Ergebnis bei 5°C außen → Vorlauftemp. 45°C

Rückgabewerte:
- supply_temperature: Berechnete Vorlauftemperatur (°C)
- formula: Mathematische Formel (z.B. "y = -0,5x + 47,5")

Vorteile gegenüber dem allgemeinen Kurvenrechner:
- Verwendet dieselben L28/L29-Werte wie Ihr Wärmepumpendisplay
- Keine manuelle Kurvenkonfiguration erforderlich
- Mathematisch exakt gemäß Adlar-Spezifikation

ZEITBASIERTER PLANER & SAISONMODUS (Erweiterte Funktionen)
Zwei Rechner für intelligente zeit- und saisonbasierte Automatisierung:

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

COP (LEISTUNGSZAHL) ÜBERWACHUNG

Die App berechnet automatisch, wie effizient Ihre Wärmepumpe arbeitet:
- COP-Wert: Verhältnis zwischen erzeugter Wärme und verbrauchter Elektrizität
- Tagesdurchschnitte: 24-Stunden-Trends
- Wöchentliche Analyse: Langzeitperformance
- Saisonale Überwachung: SCOP nach europäischen Standards
- Diagnose-Feedback: Was die Effizienz beeinflusst
- Ausreißererkennung: Kennzeichnung unrealistischer Werte (< 0,5 oder > 8,0)

WAS BEDEUTEN COP-WERTE?
- COP 2.0-3.0: Durchschnittliche Leistung
- COP 3.0-4.0: Gute Leistung
- COP 4.0+: Ausgezeichnete Leistung

ERWEITERTE EINSTELLUNGEN

ADAPTIVE TEMPERATURREGELUNG
Automatische Zieltemperaturregelung basierend auf externem Innentemperatursensor:
- PI (Proportional-Integral) Regler für stabile Innentemperatur
- Leistung: ±0,3°C Stabilität
- Erforderlich: Externer Temperatursensor über Flow-Karte

GEBÄUDEMODELL-LERNEN
Machine-Learning-Algorithmus, der die thermischen Eigenschaften Ihres Hauses lernt:
- Lernt 4 thermische Parameter (C, UA, g, P_int)
- Lernzeit: 24-72 Stunden für Basismodell, 2-4 Wochen für genaues Modell
- Gebäudetyp-Auswahl: Leicht/Durchschnitt/Schwer/Passiv
- Dynamische interne Wärmegewinne nach Tageszeit
- Saisonale Solargewinn-Anpassung

GEBÄUDEEINBLICKE & EMPFEHLUNGEN
Automatisierte Analyse des thermischen Gebäudemodells:
- Energiesparempfehlungen mit ROI-Schätzungen
- Einblicke erscheinen nach 24-48 Stunden Lernen (70% Vertrauen)
- Konfigurierbare "Aufwachzeit" für Vorheiz-Berechnungen
- Nachtabsenkung für Einsparungsschätzungen
- Maximale Anzahl aktiver Einblicke konfigurierbar (1-5)

ENERGIEPREISOPTIMIERUNG
Automatische Optimierung basierend auf Day-Ahead-Energiepreisen:
- Datenquelle: EnergyZero API (kostenlos, kein Konto erforderlich)
- Geschätzte Einsparungen: 400-600 € pro Jahr
- Preisschwellen: Sehr Niedrig/Niedrig/Normal/Hoch basierend auf 2024er Perzentilen
- Preisberechnungsmodus: Markt/Markt+/All-in-Preis
- Konfigurierbare Lieferantengebühr und Energiesteuer
- Preisblock-Erkennung für günstigste/teuerste Perioden

COP-OPTIMIERUNG
Automatische Vorlauftemperatur-Optimierung für maximale Effizienz:
- Lernt optimale Vorlauftemperatur pro Außentemperatur
- Geschätzte Einsparungen: 200-300 €/Jahr
- Strategien: Konservativ/Ausgewogen/Aggressiv

ADAPTIVE REGELUNG GEWICHTUNGSFAKTOREN
Drei Prioritäten, die zusammen bestimmen, wie das System Entscheidungen trifft:
- Komfortpriorität (Standard 60%): Gewichtung für PI-Temperaturregelung
- Effizienzpriorität (Standard 25%): Gewichtung für COP-Optimierung
- Kostenpriorität (Standard 15%): Gewichtung für Preisoptimierung
- Werte werden automatisch auf 100% normalisiert

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

GERÄTEANMELDEDATEN AKTUALISIEREN
Sie können Geräteanmeldedaten ohne erneute Kopplung aktualisieren:
1. Gehen Sie zu den Geräteeinstellungen in der Homey-App
2. Scrollen Sie nach oben zu den Verbindungseinstellungen
3. Aktualisieren Sie die Anmeldedaten (IP-Adresse, Lokaler Schlüssel, Geräte-ID, Protokollversion)
4. Klicken Sie auf "Speichern" - Gerät verbindet sich automatisch neu

BENÖTIGEN SIE HILFE?
- Dokumentation: Prüfen Sie den /docs Ordner auf GitHub für detaillierte Informationen
- Konfigurationsleitfaden: /docs/setup/advanced-settings/CONFIGURATIEGIDS.md (vollständige Einstellungsreferenz)
- Community: Homey Community Forum (Themen-ID: 143690)
- Probleme: Melden Sie Probleme auf GitHub

APP-ÜBERGREIFENDE INTEGRATION
Verbinden Sie sich mit anderen Homey-Apps für verbesserte COP-Berechnung und Gebäudemodell:
- Externe Leistungsmessungen (von Ihrem Smart Meter)
- Externe Wasserdurchflussdaten
- Externe Umgebungstemperaturdaten (z.B. KNMI Wetter-App)
- Externe Innentemperatur für adaptive Regelung
- Windgeschwindigkeitsdaten für Windchill-Kompensation
- Sonnenstrahlungsintensität für Solargewinn-Berechnung
- PV-Leistung für Echtzeit-Solarenergiegewinne

GEBÄUDEMODELL-DIAGNOSE
Fehlerbehebung für thermische Lernprobleme, wenn Ihr Gebäudemodell nicht aktualisiert wird:
- Umfassende Diagnose-Flow-Karte
- Innen-/Außentemperatursensor-Status prüfen
- Lernprozess überwachen (Proben, Vertrauen, Zeitkonstante)
- Spezifische Blockierungsgründe mit Lösungen identifizieren
- Lern-Zeitlinie verfolgen (T+0 → T+50min → T+24h)

Verwendung: Erstellen Sie Flow "Gebäudemodell-Lernen diagnostizieren" für detaillierten Status in App-Logs

WIND- & SOLARINTEGRATION
Verbessern Sie die Genauigkeit des thermischen Gebäudemodells mit externen Wetterdaten:

Windgeschwindigkeits-Korrektur:
- Automatische Anpassung des Wärmeverlusts basierend auf Windchill-Effekt
- Flow-Karte: "Externe Windgeschwindigkeit einstellen" (km/h)
- Reduziert Gebäudemodell-Lernzeit um 30-50%
- Kompatibel mit KNMI Wetter-App und anderen Windsensoren

Sonnenstrahlungs-Integration:
- Genaue Berechnung der Solargewinne über Gebäudeoberfläche
- Flow-Karte: "Externe Sonneneinstrahlung einstellen" (W/m²)
- Saisonale Anpassung (Winter 60%, Sommer 130%)
- Unterstützt KNMI Sonnenstrahlungsdaten

PV-Leistungs-Tracking:
- Echtzeit-Überwachung der Solarpanel-Leistung
- Flow-Karte: "Externe PV-Leistung einstellen" (W)
- Verwendet für interne Wärmegewinn-Korrektur
- Verbessert Gebäudemodell-Zuverlässigkeit auf 85%+

Datenquellen: KNMI Wetter-App, Homey Energy App, oder eigene Sensoren

ERWEITERTE INTEGRATIONS-EINRICHTUNG
Für detaillierte Anweisungen zur externen Datenintegration:
- Wind & Solar Setup: /docs/setup/guide/BUILDING_INSIGHTS_GUIDE.de.md
- Flow-Karten Anleitung: /docs/setup/guide/FLOW_CARDS_GUIDE.de.md
- Vollständige Konfiguration: /docs/setup/advanced-settings/CONFIGURATION_GUIDE.de.md

SICHERHEIT UND ZUVERLÄSSIGKEIT

AUTOMATISCHE ÜBERWACHUNG
- Kritische Temperaturwarnungen
- Verbindungsstatuskontrolle
- Systemfehlererkennung
- Systemtimer-Benachrichtigungen
- COP-Ausreißererkennung

INTELLIGENTE WIEDERHERSTELLUNG
- Automatische Wiederverbindung
- Fehlerkorrektur
- Statuswiederherstellung
- Benutzerfreundliche Fehlermeldungen
