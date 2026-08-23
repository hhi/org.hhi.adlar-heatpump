Steuern und überwachen Sie Ihre Adlar Castra Aurora Wärmepumpe lokal mit Homey
Pro. Diese eine App unterstützt zwei Verbindungsmethoden: Tuya Local API und
Modbus RS485 über ein Modbus-TCP-Gateway. Wählen Sie den zu Ihrer Installation
passenden Gerätetreiber; beide arbeiten für den täglichen Betrieb ohne
Cloud-Verbindung in Ihrem lokalen Netzwerk.

🇬🇧 English  🇩🇪 Deutsch 🇫🇷 Français 🇳🇱 Nederlands

TREIBER AUSWÄHLEN

TUYA LOCAL API
- Wählen Sie "Adlar Castra Aurora Heat Pump (Tuya)"
- Benötigt Geräte-ID, lokalen Schlüssel, lokale IP-Adresse und Tuya-
  Protokollversion (3.3, 3.4 oder 3.5) der Wärmepumpe
- Verwenden Sie diesen Treiber für eine über WLAN verbundene Wärmepumpe

MODBUS-TCP-GATEWAY
- Wählen Sie "Adlar Castra Aurora Heat Pump (Modbus)"
- Benötigt einen RS485/Modbus-Anschluss und ein erreichbares Modbus-TCP-
  Gateway, etwa ein Elfin EW11A
- Geben Sie IP-Adresse des Gateways, TCP-Port und Modbus-Unit-ID ein
- Die üblichen Standardwerte sind Port 502 und Unit-ID 1

WICHTIGE FUNKTIONEN
- Lokale Temperaturen, Betriebsstatus, Abtauen, Frostschutz, Sterilisation und
  dekodierte Fehlerinformationen
- Messungen von Leistung, Energie, Spannung, Strom, Kompressor, Lüfter, Ventil,
  Pumpe und Wasserdurchfluss, sofern von der Wärmepumpe unterstützt
- Steuerung von Ein/Aus, Betriebsmodus sowie Heiz-, Kühl- und
  Warmwasser-Sollwerten und unterstützten Heiz- und Warmwasserkurven
- COP- und saisonale Effizienzüberwachung mit verfügbaren Leistungs-,
  Temperaturdifferenz- und Durchflussdaten
- Homey-Flow-Karten für Warnungen, Fehler, Sollwerte, externe Daten und
  erweiterte Kurven-, Zeitplan- und Saisonberechnungen
- Optionale adaptive Temperatursteuerung, Gebäudemodell-Lernen, Energiepreis-
  und COP-Optimierung sowie wetterbasierte Empfehlungen
- Erweiterte lokale Diagnose- und Registerwerkzeuge für Modbus-Installationen

WICHTIG
- Erweiterte Modbus-Schreibwerkzeuge können das Verhalten der Wärmepumpe
  verändern. Verwenden Sie sie nur, wenn Sie das Register kennen und den
  ursprünglichen Wert notiert haben.
- Der Modbus-Treiber zielt auf die R32-Registerkarte und warnt bei anderen
  Kältemitteln.
- Der COP kann fehlen oder ungenauer sein, wenn verwendbare Leistungs- oder
  Durchflussdaten fehlen.
- Eine feste DHCP-Zuweisung oder statische IP-Adresse für Wärmepumpe oder
  Gateway hilft, Wiederverbindungsprobleme zu vermeiden.

DOKUMENTATION

Auf der Quellcode-Seite finden Sie Einrichtungs-, Flow-, COP-, Heizkurven- und
erweiterte Steuerungsanleitungen, einschließlich des Modbus-Diagnose- und
Dashboard-Leitfadens: /docs/setup/MODBUS_DASHBOARD_GUIDE.de.md.
Für die Tuya-Kopplung: /docs/setup/Tuya_LocalKey_Homey_Guide_DE.pdf
und /docs/setup/PROTOCOL_VERSION_GUIDE.de.md.
