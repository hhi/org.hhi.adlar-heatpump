# 📚 Adlar Wärmepumpe Dokumentation

Willkommen zur Dokumentation der Adlar-Wärmepumpe-Homey-App.

[Nederlands](README.nl.md) · [English](README.en.md) · [Deutsch](README.de.md) · [Français](README.fr.md)

## Beginnen Sie mit Ihrem Treiber

Diese App unterstützt drei Treiber. Wählen Sie die Anleitung für Ihr Modell
und Ihren Anschluss; Tuya und Modbus benötigen unterschiedliche Kopplungsdaten.

| Treiber | Installation | Standard-Dashboard |
| --- | --- | --- |
| Aurora I/II über Tuya | [Lokaler Schlüssel und Gerätedaten](setup/Tuya_LocalKey_Homey_Guide_DE.pdf), [Protokollversion](setup/PROTOCOL_VERSION_GUIDE.de.md) | `http://HOMEY-IP:8092` |
| Aurora I/II über Modbus | [RS485 und Modbus-TCP-Gateway](setup/modbus-elfin-ew11-setup.md) (Niederländisch), Einstellungen für Aurora I/II verwenden | `http://HOMEY-IP:8090` |
| Aurora III über Modbus | [RS485 und Modbus-TCP-Gateway](setup/modbus-elfin-ew11-setup.md) (Niederländisch), Einstellungen für Aurora III verwenden | `http://HOMEY-IP:8091` |

Ersetzen Sie HOMEY-IP durch die lokale IP-Adresse Ihres Homey Pro. Verwenden
Sie Ihren eingestellten Port, falls Sie ihn geändert haben. Beachten Sie die
[Dashboard-Übersicht für alle drei Treiber](../README.md#local-dashboards)
(Englisch) und den [Modbus-Dashboard-Leitfaden](setup/MODBUS_DASHBOARD_GUIDE.de.md).
Die [Tuya-Dashboard-Entscheidung](architecture/ADR-068-TUYA-DASHBOARD.md)
(Niederländisch) beschreibt den technischen Aufbau und die Einschränkungen von Tuya.

## Finden Sie die passende Anleitung

| Ihre Frage | Dokumentation |
| --- | --- |
| Einstellungen und tägliche Nutzung | [Konfiguration](setup/advanced-settings/CONFIGURATION_GUIDE.de.md), [Homey Flows](setup/guide/FLOW_CARDS_GUIDE.de.md), [erweiterte Flow-Karten](setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.de.md) |
| Heizkurven und adaptive Regelung | [Erweiterte Funktionen](setup/advanced-control/Advanced_Features_Intro.de.md), [Regelungsübersicht](ADAPTIVE_CONTROL_OVERVIEW.de.md), [praktische Anleitung](setup/guide/ADAPTIVE_CONTROL_GUIDE.de.md) |
| COP, SCOP und Gebäudeeinblicke | [COP einrichten](setup/COP%20flow-card-setup.de.md), [Berechnungsmethoden](COP%20calculation/), [Gebäudemodell](BUILDINGMODEL_INSIGHTS_OVERVIEW.de.md), [Gebäudeeinblicke nutzen](setup/guide/BUILDING_INSIGHTS_GUIDE.de.md) |
| Probleme oder Umstieg | [Tuya-Fehlerbehebung](setup/USER_QUICK_FIX.de.md), [Modbus-Diagnose](setup/MODBUS_DASHBOARD_GUIDE.de.md), [Aurora-III-Migration](setup/MIGRATION_AURORA3.de.md) |
| Technische Details und Entwicklung | [Spezifikationen und Zuordnungen](Heatpump%20specs/), [Architektur und Entwurfsentscheidungen](architecture/), [Entwicklerressourcen](Dev%20support/), [Verifikation und Testszenarien](testing/) |

Funktionen und Einstellungen unterscheiden sich je nach Treiber und
Wärmepumpenmodell. Die meisten Benutzeranleitungen sind übersetzt; einige
technische Referenzen sind nur auf Niederländisch oder Englisch verfügbar.

---

## 🗂️ Verzeichnisübersicht

| Verzeichnis | Beschreibung | Zielgruppe |
|-------------|--------------|------------|
| [**setup/**](setup/) | Installationsanleitungen, Konfiguration und Benutzer-Tutorials | 👤 Endbenutzer, Installateure |
| [**COP calculation/**](COP%20calculation/) | COP- und SCOP-Berechnungsmethodik und Algorithmen | 👤 Fortgeschrittene Benutzer, HVAC-Profis |
| [**Heatpump specs/**](Heatpump%20specs/) | DPS-Mappings, Capabilities und Gerätespezifikationen | 🔧 Entwickler, technische Integratoren |
| [**architecture/**](architecture/) | App-Architektur, Service-Patterns und Code-Design | 🔧 Entwickler, Mitwirkende |
| [**Dev support/**](Dev%20support/) | Entwicklungstools, Testanleitungen und interne Docs | 🔧 Nur Entwickler |

---

## 🌍 Verfügbare Sprachen

Der Großteil der Benutzerdokumentation ist in vier Sprachen verfügbar:

| Dokument | 🇳🇱 NL | 🇬🇧 EN | 🇩🇪 DE | 🇫🇷 FR |
|----------|--------|--------|--------|--------|
| Einführung Erweiterte Funktionen | [NL](setup/advanced-control/Advanced_Features_Intro.nl.md) | [EN](setup/advanced-control/Advanced_Features_Intro.en.md) | [DE](setup/advanced-control/Advanced_Features_Intro.de.md) | [FR](setup/advanced-control/Advanced_Features_Intro.fr.md) |
| Erweiterter Flow-Karten-Leitfaden | [NL](setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.nl.md) | [EN](setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.en.md) | [DE](setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.de.md) | [FR](setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.fr.md) |
| **Adaptive Regelung Übersicht** | [NL](ADAPTIVE_CONTROL_OVERVIEW.nl.md) | [EN](ADAPTIVE_CONTROL_OVERVIEW.en.md) | [DE](ADAPTIVE_CONTROL_OVERVIEW.de.md) | [FR](ADAPTIVE_CONTROL_OVERVIEW.fr.md) |
| **Gebäudemodell & Insights Übersicht** | [NL](BUILDINGMODEL_INSIGHTS_OVERVIEW.nl.md) | [EN](BUILDINGMODEL_INSIGHTS_OVERVIEW.en.md) | [DE](BUILDINGMODEL_INSIGHTS_OVERVIEW.de.md) | [FR](BUILDINGMODEL_INSIGHTS_OVERVIEW.fr.md) |
| Flow-Karten-Implementierungsleitfaden | [NL](setup/guide/FLOW_CARDS_GUIDE.nl.md) | [EN](setup/guide/FLOW_CARDS_GUIDE.en.md) | [DE](setup/guide/FLOW_CARDS_GUIDE.de.md) | [FR](setup/guide/FLOW_CARDS_GUIDE.fr.md) |
| Adaptive Regelung Leitfaden | [NL](setup/guide/ADAPTIVE_CONTROL_GUIDE.nl.md) | [EN](setup/guide/ADAPTIVE_CONTROL_GUIDE.en.md) | [DE](setup/guide/ADAPTIVE_CONTROL_GUIDE.de.md) | [FR](setup/guide/ADAPTIVE_CONTROL_GUIDE.fr.md) |
| Building Insights Leitfaden | [NL](setup/guide/BUILDING_INSIGHTS_GUIDE.nl.md) | [EN](setup/guide/BUILDING_INSIGHTS_GUIDE.en.md) | [DE](setup/guide/BUILDING_INSIGHTS_GUIDE.de.md) | [FR](setup/guide/BUILDING_INSIGHTS_GUIDE.fr.md) |
| COP Flow-Karten-Einrichtung | [NL](setup/COP%20flow-card-setup.nl.md) | [EN](setup/COP%20flow-card-setup.en.md) | [DE](setup/COP%20flow-card-setup.de.md) | [FR](setup/COP%20flow-card-setup.fr.md) |
| Protokollversions-Leitfaden | [NL](setup/PROTOCOL_VERSION_GUIDE.nl.md) | [EN](setup/PROTOCOL_VERSION_GUIDE.en.md) | [DE](setup/PROTOCOL_VERSION_GUIDE.de.md) | [FR](setup/PROTOCOL_VERSION_GUIDE.fr.md) |
| Konfigurationshandbuch | [NL](setup/advanced-settings/CONFIGURATION_GUIDE.nl.md) | [EN](setup/advanced-settings/CONFIGURATION_GUIDE.en.md) | [DE](setup/advanced-settings/CONFIGURATION_GUIDE.de.md) | [FR](setup/advanced-settings/CONFIGURATION_GUIDE.fr.md) |
| Tuya LocalKey-Anleitung | [NL](setup/Tuya_LocalKey_Homey_Guide_NL.pdf) | [EN](setup/Tuya_LocalKey_Homey_Guide_EN.pdf) | [DE](setup/Tuya_LocalKey_Homey_Guide_DE.pdf) | [FR](setup/Tuya_LocalKey_Homey_Guide_FR.pdf) |
| Schnelle Problemlösung | [NL](setup/USER_QUICK_FIX.nl.md) | [EN](setup/USER_QUICK_FIX.en.md) | [DE](setup/USER_QUICK_FIX.de.md) | [FR](setup/USER_QUICK_FIX.fr.md) |
| Modbus-Dashboard-Leitfaden (Aurora I/II und III) | [NL](setup/MODBUS_DASHBOARD_GUIDE.nl.md) | [EN](setup/MODBUS_DASHBOARD_GUIDE.en.md) | [DE](setup/MODBUS_DASHBOARD_GUIDE.de.md) | [FR](setup/MODBUS_DASHBOARD_GUIDE.fr.md) |
| Aurora III-Umstiegsleitfaden | [NL](setup/MIGRATION_AURORA3.nl.md) | [EN](setup/MIGRATION_AURORA3.en.md) | [DE](setup/MIGRATION_AURORA3.de.md) | [FR](setup/MIGRATION_AURORA3.fr.md) |

---

## 📁 Detaillierter Inhalt

### 👤 setup/ — Benutzerdokumentation
*Für: Endbenutzer, Installateure, HVAC-Profis*

- **Einführung Erweiterte Funktionen** — So schalten Sie erweiterte Funktionen mit externen Daten frei
- **COP Flow-Karten-Einrichtung** — Schritt-für-Schritt COP-Messkonfiguration
- **Protokollversions-Leitfaden** — Tuya-Protokollversion-Auswahl (3.3/3.4/3.5)
- **Konfigurationshandbuch** — Vollständige Einstellungsreferenz
- **Tuya LocalKey-Anleitung** — So erhalten Sie Tuya-Anmeldedaten (PDF)
- **Schnelle Problemlösung** — Häufige Probleme und Lösungen
- **Elfin EW11 Modbus-Einrichtung** — [Modbus-TCP-Gateway-Leitfaden](setup/modbus-elfin-ew11-setup.md) für Aurora I/II und III (Niederländisch)
- **Modbus-Dashboard-Leitfaden** — Lokale Dashboards pro Modbus-Modell (Ports 8090 und 8091)
- **Aurora III-Umstiegsleitfaden** — Umstieg von der separaten Aurora III-App
- **guide/** — Zusätzliche detaillierte Anleitungen (Flow-Karten, adaptive Regelung, Building Insights)

### 📊 COP calculation/ — Effizienz-Algorithmen
*Für: Fortgeschrittene Benutzer, HVAC-Profis, Entwickler*

- **COP-calculation.md** — Echtzeit-COP-Berechnungsmethodik
- **SCOP-calculation.md** — Saison-COP (SCOP) Algorithmen

### 🔌 Heatpump specs/ — Gerätespezifikationen
*Für: Entwickler, technische Integratoren*

- **capabilities-overview.md** — Alle Homey Capabilities erklärt
- **DPsettings2.pdf/xlsx** — Vollständige DPS (Data Point) Zuordnung
- **R290/** — R290-Kältemittel-spezifische Parameter
- **R32/** — R32-Kältemittel-spezifische Parameter

### 🏗️ architecture/ — Code-Architektur
*Für: Entwickler, Mitwirkende*

- **SERVICE_ARCHITECTURE.md** — Microservice Design-Patterns
- **DPS_MAPPING.md** — Tuya DPS zu Capability-Zuordnung
- **ERROR_HANDLING.md** — Fehlerbehandlungsstrategien
- **HEARTBEAT_MECHANISM.md** — Verbindungs-Keepalive-Design
- **KEY_PATTERNS.md** — Kern-Code-Patterns und Konventionen

### 🔧 Dev support/ — Entwickler-Ressourcen
*Für: Nur Entwickler*

- **Architectural overview/** — Systemdiagramme und Design-Docs
- **Flow Card handling/** — Flow-Karten-Implementierungsdetails
- **Image design/** — Icon- und UI-Asset-Quellen
- **CALCULATORS.md** — Calculator Flow-Karten-Implementierung
- **PHASE2_TESTING_GUIDE.md** — Testverfahren

---



*Letzte Aktualisierung: 2026-11-10*
