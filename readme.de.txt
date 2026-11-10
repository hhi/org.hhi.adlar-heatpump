Steuern und überwachen Sie Ihre Adlar Castra Aurora Wärmepumpe lokal mit Homey Pro.
Diese App enthält drei Treiber für die Anbindung über Tuya oder Modbus.
Die tägliche Kommunikation erfolgt über Ihr lokales Netzwerk.

WÄHLEN SIE IHREN TREIBER

Aurora I/II über Tuya
Für eine Aurora I/II mit Tuya-WLAN-Verbindung. Benötigt werden die Geräte-ID, der lokale Schlüssel, die lokale IP-Adresse und die Tuya-Protokollversion der Wärmepumpe.
Lokales Dashboard: http://HOMEY-IP:8092

Aurora I/II über Modbus
Für eine Aurora I/II mit RS485/Modbus-Anschluss. Ein Modbus-TCP-Gateway ist erforderlich. Geben Sie beim Koppeln die IP-Adresse des Gateways, den TCP-Port und die Modbus-Unit-ID ein.
Lokales Dashboard: http://HOMEY-IP:8090

Aurora III über Modbus
Für eine Aurora III mit RS485/Modbus-Anschluss. Ein Modbus-TCP-Gateway ist erforderlich. Dieser Treiber verwendet die eigene Registerbelegung der Aurora III. Geben Sie beim Koppeln die IP-Adresse des Gateways, den TCP-Port und die Modbus-Unit-ID ein.
Lokales Dashboard: http://HOMEY-IP:8091

Ersetzen Sie HOMEY-IP durch die lokale IP-Adresse Ihres Homey Pro. Die angegebenen Ports sind die Standardwerte. Falls Sie den Port geändert haben, verwenden Sie Ihren eingestellten Port.

ÜBERWACHUNG UND STEUERUNG

Sehen Sie Temperaturen, Betriebsstatus, Störungen und verfügbare Messwerte für Leistung, Energieverbrauch und Wasserdurchfluss ein. Steuern Sie Ein/Aus, Betriebsmodus, Sollwerte und unterstützte Heizkurvenoptionen.

Nutzen Sie Homey Flows für Steuerung, Benachrichtigungen und externe Messdaten. Verfolgen Sie COP und saisonale Effizienz oder nutzen Sie die optionale adaptive Regelung, das Lernen des Gebäudemodells sowie Energiepreis- und COP-Optimierung.

Verfügbare Messwerte, Einstellungen und Flow-Karten unterscheiden sich je nach Modell und Treiber. COP-Berechnungen setzen verwertbare Leistungs-, Temperatur- und Wasserdurchflussdaten voraus.

LOKALE DASHBOARDS

Alle drei Treiber bieten Dashboard-Seiten zur Überwachung, Steuerung und Diagnose.

Dashboard und Live zeigen verfügbare Werte und den Betriebsstatus. Die interaktive Seite ermöglicht die Bedienung unterstützter Einstellungen. Expert bietet eine durchsuchbare Übersicht der Datenpunkte oder Register. Die Änderungsübersicht zeigt Werte und aufgezeichnete Änderungen. Die Heizkurvenseite gibt Einblick in die verfügbaren Kurveneinstellungen und die Regelung.

Tuya zeigt DPS-Datenpunkte. Die Modbus-Treiber zeigen die Register des jeweiligen Wärmepumpenmodells. Die verfügbaren Dashboard-Funktionen unterscheiden sich je nach Treiber.

INSTALLATION

Wählen Sie beim Hinzufügen eines Geräts den Treiber, der zu Ihrem Wärmepumpenmodell und Anschluss passt.

Für Tuya werden die lokalen Gerätedaten benötigt. Bei Modbus muss das Gateway zuvor korrekt angeschlossen und konfiguriert sein. Beachten Sie die Installationsanleitung für Ihr Modell.

Eine feste lokale IP-Adresse oder DHCP-Reservierung für die Wärmepumpe oder das Gateway hilft, Verbindungsprobleme zu vermeiden.

Erweiterte Schreibfunktionen können Einstellungen der Wärmepumpe verändern. Prüfen Sie die Bedeutung einer Einstellung und notieren Sie den ursprünglichen Wert, bevor Sie sie ändern.

DOKUMENTATION

Auf der Quellcode-Seite finden Sie Anleitungen zur Tuya-Kopplung, Modbus-Anbindung, Gateway-Konfiguration, zu Dashboards, Homey Flows, Störungsdiagnose, COP, Heizkurven und adaptiver Regelung.
