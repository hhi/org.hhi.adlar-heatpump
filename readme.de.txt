Diese App gibt Ihnen die volle Kontrolle über Ihre Adlar Castra Aurora Wärmepumpe direkt über Ihr Homey Smart Home System. Sie können Ihre Wärmepumpe überwachen, steuern und optimieren, ohne auf Internetverbindungen angewiesen zu sein.

Unterstützte Sprachen
🇬🇧 English
🇩🇪 Deutsch
🇫🇷 Français
🇳🇱 Nederlands

HAUPTVORTEILE

LOKALE STEUERUNG
- Direkte Verbindung mit Ihrer Wärmepumpe über das lokale Netzwerk
- Keine Internetverbindung für den täglichen Gebrauch erforderlich
- Schnelle Reaktionszeiten und zuverlässige Verbindung

ERWEITERTE ÜBERWACHUNG
- Echtzeit-Temperaturmessungen (Wärmepumpen-interne Sensoren)
- Stromverbrauch und Effizienzüberwachung
- Automatische COP (Leistungskoeffizient) Berechnung mit 8 verschiedenen Methoden
- Saisonale SCOP-Analyse nach europäischen Normen
- Umfassende Capabilities für vollständige Kontrolle

VOLLSTÄNDIGE BEDIENUNG
- Temperatureinstellung und Heizmodi
- Heizkurvenanpassungen
- Warmwassertemperatur-Steuerung
- Timer und automatische Funktionen

INTELLIGENTE AUTOMATISIERUNG
- Umfangreiche Flow-Karten für erweiterte Automatisierung
- Intelligente Fehlererkennung und Wiederherstellung
- Wetterabhängige Optimierung
- Energieeffizienz-Trends und Warnungen
- Zeitbasierte Planung und Saisonmoduserkennung
- Adaptive Temperaturregelung mit PI-Regler
- Gebäudemodell-Lernen mit maschinellem Lernen
- Gebäudeeinblicke & Empfehlungen mit ROI-Schätzungen
- Energiepreis-Optimierung mit Day-Ahead-Preisen
- COP-Optimierung für maximale Effizienz
- Umfassende Diagnosetools zur Problemlösung
- Wind- und Sonnenintegration für Gebäudemodell
  * Externe Windgeschwindigkeit für Windchill-Korrektur des Wärmeverlusts
  * Sonneneinstrahlung und PV-Leistung für genaue Solargewinn-Berechnung
  * Verbessert Gebäudemodell-Lerngenauigkeit mit Echtzeit-Wetterdaten

BENUTZERFREUNDLICH
- Vollständig deutsche Benutzeroberfläche
- Mobilfreundliche Anzeige
- Klare Statusindikatoren
- Verständliche Fehlermeldungen

INSTALLATION

WAS BENÖTIGEN SIE?
- Homey Pro (Firmware-Version 12.2.0 oder höher)
- Adlar Castra Aurora Wärmepumpe
- Lokale Netzwerkverbindung mit der Wärmepumpe
- Gerätedaten (ID, Lokaler Schlüssel, lokale IP-Adresse)

WIE ERHALTEN SIE DIE GERÄTEDATEN?
Den erforderlichen lokalen Schlüssel und andere Daten können Sie erhalten, indem Sie die Anweisungen befolgen in:
/docs/setup/Tuya_LocalKey_Homey_Guide_NL.pdf auf der Quellcode-Seite dieser App.

INSTALLATIONSSCHRITTE
1. Installieren Sie die App über den Homey App Store
2. Fügen Sie ein neues Gerät hinzu und wählen Sie "Intelligent Heat Pump"
3. Geben Sie Ihre Gerätedaten ein:
   - Geräte-ID
   - Lokaler Schlüssel
   - Lokale IP-Adresse
   - Protokollversion (wählen Sie 3.3, 3.4 oder 3.5)
4. Schließen Sie den Kopplungsprozess ab

PROTOKOLLVERSIONSAUSWAHL
Die Protokollversion bestimmt, wie die App mit Ihrer Wärmepumpe kommuniziert:
- 3.3 (Standard): Funktioniert für die meisten Adlar/Aurora Wärmepumpen
- 3.4: Erforderlich für einige neuere Modelle
- 3.5: Erforderlich für neueste Firmware-Versionen

Bei Verbindungsproblemen (häufige Unterbrechungen, ECONNRESET-Fehler),
versuchen Sie eine andere Protokollversion über die Geräteeinstellungen.
- ECONNRESET um 00:00 Uhr tritt normalerweise aufgrund des täglichen Neustarts Ihres Routers auf
- HMAC-Fehlanpassung: Standard ist Protokollversion 3.3, wechseln Sie zu 3.4 (oder 3.5)
- ECONNREFUSED <ip-adresse>: höchstwahrscheinlich eine falsche IP-Adresse,
  weisen Sie Ihrer Wärmepumpe eine statische (DHCP) Adresse zu

WICHTIGE FUNKTIONEN

TEMPERATURÜBERWACHUNG
- Wassereinlass- und Auslasstemperaturen
- Außentemperatur
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
- Temperaturziele einstellen
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
- Zeitbasierte Optimierung: Einstellungen pro Stunde/Tag/Saison anpassen
- COP-basierte Feinabstimmung: Dynamische Temperaturanpassungen basierend auf Effizienz
- Unterstützt 6 Operatoren: >, >=, <, <=, ==, != mit Standard-Fallback
- Maximum 50 Kurveneinträge für komplexe Szenarien
- Echtzeitberechnung mit benutzerfreundlichen Fehlermeldungen

Beispiel: Wetterabhängige Heizung
"Wenn sich die Außentemperatur ändert, berechne Heizungssollwert mit Kurve:
< -5°C : 60°C, < 0°C : 55°C, < 5°C : 50°C, < 10°C : 45°C, default : 35°C"
Ergebnis: Passt Heizung automatisch basierend auf Wetterbedingungen an.
Das Eingabefeld akzeptiert Zahlen, Variablen oder von Homey unterstützte {{ expression }} Syntax.

ADLAR CUSTOM HEIZKURVENRECHNER (L28/L29)
Berechnet die Vorlauftemperatur direkt aus den Adlar Custom Heizkurvenparametern:

Was sind L28 und L29?
- L29: Gewünschte Vorlauftemperatur bei -15°C Außentemperatur (Referenzpunkt, z.B. 55°C)
- L28: Steigungsgrad pro 10°C Temperaturänderung (z.B. -5 = -0.5°C pro Grad)

Wie funktioniert es?
Die Formel y = ax + b wird automatisch berechnet:
- Steigung (a) = L28 ÷ 10
- Achsenabschnitt (b) = L29 - (Steigung × -15°C)
Beispiel: L29=55°C, L28=-5 → Formel: y = -0.5x + 47.5

Beispiel-Flow:
"Wenn sich die Außentemperatur ändert, berechne Custom-Heizkurve
mit L29=55°C bei -15°C, L28=-5 pro 10°C, Außentemp {{outdoor_temperature}}"
Ergebnis bei 5°C außen → Vorlauftemp 45°C

Rückgabe:
- supply_temperature: Berechnete Vorlauftemperatur (°C)
- formula: Mathematische Formel (z.B. "y = -0.5x + 47.5")

Vorteile gegenüber dem allgemeinen Kurvenrechner:
- Verwendet dieselben L28/L29-Werte wie Ihr Wärmepumpen-Display
- Keine manuelle Kurvdefinition erforderlich
- Mathematisch exakt nach Adlar-Spezifikation

ZEITBASIERTE PLANUNG & SAISONMODUS (Erweiterte Funktionen)
Zwei Rechner für intelligente zeit- und saisonbasierte Automatisierung:

Zeitbasierte Planung:
Berechnen Sie Werte basierend auf Tagesablaufplänen für tägliche Temperaturprogrammierung.
Beispiel: "06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, 23:00-06:00: 18"
- Unterstützt nächtliche Bereiche (z.B. 23:00-06:00)
- Maximum 30 Zeitbereiche mit Standard-Fallback
- Perfekt für Komfortplanung und Zeit-von-Nutzung-Optimierung

Saisonmoduserkennung:
Automatische Erkennung der Heiz-/Kühlsaison basierend auf dem Datum.
- Heizsaison: 1. Okt - 15. Mai (gemäß EN 14825 SCOP-Standard)
- Gibt Modus, Saisonflags und Tage bis Saisonwechsel zurück
- Perfekt für automatisches Umschalten zwischen Winter-/Sommerplänen

COP (LEISTUNGSKOEFFIZIENT) ÜBERWACHUNG

Die App berechnet automatisch, wie effizient Ihre Wärmepumpe arbeitet:
- COP-Wert: Verhältnis zwischen erzeugter Wärme und verbrauchtem Strom
- Tagesdurchschnitte: 24-Stunden-Trends
- Wöchentliche Analyse: Langzeitleistung
- Saisonale Überwachung: SCOP nach europäischen Normen
- Diagnose-Feedback: Was beeinflusst die Effizienz
- Ausreißererkennung: Signalisierung unrealistischer Werte (< 0.5 oder > 8.0)

WAS BEDEUTEN COP-WERTE?
- COP 2.0-3.0: Durchschnittliche Leistung
- COP 3.0-4.0: Gute Leistung
- COP 4.0+: Ausgezeichnete Leistung


ERWEITERTE FEATURES
Siehe die Einführung in /docs/setup/advanced-control/Advanced_Features_Intro.nl.md
Um die folgenden Komponenten zu ermöglichen, ist die Erfahrung zuerst die externen Datenquellen anzuschließen.
Anschließend aktivieren Sie die Adaptive Temperaturregelung in Kombination mit den folgenden Komponenten nach Bedarf.

ADAPTIVE TEMPERATURREGELUNG
Automatische Regelung der Zieltemperatur basierend auf externem Innentemperatursensor:
- PI (Proportional-Integral) Regler für stabile Innentemperatur
- Leistung: ±0.3°C Stabilität
- Erforderlich: Externer Temperatursensor über Flow-Karte

GEBÄUDEMODELL-LERNEN
Machine-Learning-Algorithmus, der die thermischen Eigenschaften Ihres Hauses lernt:
- Lernt 4 thermische Parameter (C, UA, g, P_int)
- Lernzeit: 24-72 Stunden für Basismodell, 2-4 Wochen für genaues Modell
- Gebäudetypauswahl: Leicht/Durchschnitt/Schwer/Passiv
- Dynamische interne Wärmegewinne pro Zeitpunkt
- Saisonale Sonnengewinn-Anpassung

GEBÄUDEEINBLICKE & EMPFEHLUNGEN
Automatisierte Analyse des thermischen Gebäudemodells:
- Energiesparende Empfehlungen mit ROI-Schätzungen
- Einblicke erscheinen nach 24-48 Stunden Lernen (70% Vertrauen)

ENERGIEPREIS-OPTIMIERUNG
Automatische Optimierung basierend auf Day-Ahead-Energiepreisen:
- Preisschwellen: Sehr Niedrig/Niedrig/Normal/Hoch basierend auf 2024-Perzentilen
- Preisberechnungsmodus: Marktpreis/Markt+/All-in-Preis
- Konfigurierbare Anbieteraufschläge und Energiesteuern
- Preisblock-Erkennung für günstigste/teuerste Perioden

COP-OPTIMIERUNG
Automatische Optimierung der Vorlauftemperatur für maximale Effizienz:
- Lernt optimale Vorlauftemperatur pro Außentemperatur
- Strategien: Konservativ/Ausgewogen/Aggressiv

ADAPTIVE REGELUNGS-GEWICHTUNGSFAKTOREN
Vier Prioritäten, die zusammen bestimmen, wie das System Entscheidungen trifft:
- Komfort-Priorität (Standard 50%): Gewicht für PI-Temperaturregelung
- Effizienz-Priorität (Standard 15%): Gewicht für COP-Optimierung
- Kosten-Priorität (Standard 15%): Gewicht für Preisoptimierung
- Thermische Wärme-Priorität (Standard 20%): Gewicht für Berücksichtigung thermischer Eigenschaften des Gebäudes
- Werte werden automatisch auf insgesamt 100% normalisiert

GEBÄUDEMODELL-DIAGNOSTIK
Problemlösung für thermische Lernprobleme, wenn Ihr Gebäudemodell nicht aktualisiert wird:
- Diagnoseinformationen über die building_model_diagnostics Capability
- Überprüfen Sie Innen-/Außentemperatursensor-Status
- Überwachen Sie Lernprozess (Proben, Vertrauen, Zeitkonstante)
- Identifizieren Sie spezifische blockierende Gründe mit Lösungen
- Folgen Sie der Lern-Zeitlinie (T+0 → T+50min → T+24h)

WIND- & SONNENINTEGRATION
Verbessern Sie die Genauigkeit des thermischen Gebäudemodells mit externen Wetterdaten:

Windgeschwindigkeitskorrektur:
- Automatische Anpassung des Wärmeverlusts basierend auf Windchill-Effekt
- Flow-Karte: "Externe Windgeschwindigkeit einstellen" (km/h)
- Verbessert die Genauigkeit der Gebäudemodell-Wärmeverlustberechnung
- Kompatibel mit KNMI Wetter-App und anderen Windsensoren

Sonnenstrahlungsintegration:
- Genaue Berechnung der Sonnengewinne über Gebäudefläche
- Flow-Karte: "Externe Sonneneinstrahlung einstellen" (W/m²)
- Saisonale Anpassung (Winter 60%, Sommer 130%)
- Unterstützt KNMI Sonnenstrahlungsdaten

PV-Leistungsverfolgung:
- Echtzeit-Überwachung der Solarmodulausbeute
- Flow-Karte: "Externes PV-Leistung einstellen" (W)
- Wird für interne Wärmegewinn-Korrektur verwendet
- Verbessert Gebäudemodell-Genauigkeit mit zusätzlicher Datenquelle


CROSS-APP-INTEGRATION

Datenquellen: KNMI Wetter-App, Homey Energy-App oder eigene Sensoren

Verbinden Sie sich mit konformen Homey-Apps für verbesserte COP-Berechnung und adaptive Regelung und Gebäudemodell:
- Externe Leistungsmessungen (von Ihrem Smart Meter)
- Externe Wasserdurchflussdaten
- Externe Außentemperaturdaten (z.B. KNMI Wetter-App)
- Externe Innentemperatur für adaptive Regelung
- Windgeschwindigkeitsdaten für Windchill-Kompensation
- Sonnenstrahlungsintensität für Sonnengewinn-Berechnung
- PV-Leistung für Echtzeit-Solarenergiegewinne


SICHERHEIT UND ZUVERLÄSSIGKEIT

AUTOMATISCHE ÜBERWACHUNG
- Kritische Temperaturwarnungen
- Verbindungsstatusüberprüfung
- Systemfehlererkennung
- Systemtimer-Benachrichtigungen
- COP-Ausreißererkennung

INTELLIGENTE WIEDERHERSTELLUNG
- Automatische Wiederverbindung
- Fehlerkorrektur
- Statuswiederherstellung
- Benutzerfreundliche Fehlermeldungen

PROBLEMLÖSUNG UND UNTERSTÜTZUNG

ERWEITERTE INTEGRATIONS-SETUP UND DOKUMENTATION

Für detaillierte Anweisungen und externe Datenintegration:
- Adaptive Temperaturregelungs-Leitfaden: /docs/setup/guide/ADAPTIVE_CONTROL_GUIDE.nl.md
- Adaptive Regelungskomponenten: /docs/setup/advanced-control/ADAPTIVE_CONTROL_COMPONENTS.nl.md
- Advanced Features Flow-Karten: /docs/setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.nl.md
- Wind- & Sonnen-Setup: /docs/setup/guide/BUILDING_INSIGHTS_GUIDE.nl.md
- Flow-Karten-Leitfaden: /docs/setup/guide/FLOW_CARDS_GUIDE.nl.md
- Vollständige Konfiguration: /docs/setup/advanced-settings/CONFIGURATION_GUIDE.de.md
- Info und Spezifikationen Wärmepumpe: /docs/Heatpump specs/ Verzeichnis
- COP-Berechnungsmethoden: /docs/COP calculation/COP-calculation.md
- SCOP-Berechnung: /docs/COP calculation/SCOP-calculation.md

HÄUFIGE PROBLEME

Verbindungsprobleme (ECONNRESET-Fehler)
Wenn Ihr Gerät immer wieder die Verbindung unterbricht oder Reset-Fehler anzeigt:

SCHNELLE LÖSUNG (dauert weniger als 2 Minuten):
1. Öffnen Sie Geräteeinstellungen in der Homey-App
2. Scrollen Sie nach oben zu den Verbindungseinstellungen
3. Ändern Sie Protokollversion auf 3.4 (oder versuchen Sie 3.5, wenn 3.4 nicht funktioniert)
4. Optional: Aktualisieren Sie andere Daten (lokale IP-Adresse, Lokaler Schlüssel, Geräte-ID)
5. Klicken Sie auf "Speichern" und warten Sie 1-2 Minuten auf Wiederverbindung

Erfolgsindikatoren:
- Verbindungsstatus zeigt "verbunden"
- Keine ECONNRESET-Fehler mehr
- Sensordaten werden normal aktualisiert
- Gerät bleibt verfügbar

Andere häufige Probleme:
- Keine Verbindung: Überprüfen Sie lokale IP-Adresse, lokalen Schlüssel und Netzwerkverbindung
- Schwankende Werte: Normal während des Systemstarts
- Fehlercodes: Siehe App für spezifische Erklärung pro Fehlercode
- Kopplung fehlgeschlagen: Versuchen Sie verschiedene Protokollversionen (3.3, 3.4, 3.5)

GERÄTEDATEN AKTUALISIEREN
Sie können Gerätedaten aktualisieren, ohne erneut zu koppeln:
1. Gehen Sie zu Geräteeinstellungen in der Homey-App
2. Scrollen Sie nach oben zu den Verbindungseinstellungen
3. Aktualisieren Sie Daten (lokale IP-Adresse, Lokaler Schlüssel, Geräte-ID, Protokollversion)
4. Klicken Sie auf "Speichern" - Gerät verbindet sich automatisch neu

HILFE BENÖTIGT?
- Dokumentation: Siehe das /docs-Verzeichnis im Quellcode auf GitHub für detaillierte Informationen
- Konfigurationsleitfaden: /docs/setup/advanced-settings/CONFIGURATIEGIDS.md (vollständige Einstellungsreferenz)
- Community: Homey Community Forum (Topic ID: 143690)
- Issues: Melden Sie Probleme auf GitHub
