# 📚 Adlar Warmtepomp Documentatie

Welkom bij de documentatie voor de Adlar Warmtepomp Homey app.

[Nederlands](README.nl.md) · [English](README.en.md) · [Deutsch](README.de.md) · [Français](README.fr.md)

## Begin bij uw driver

Deze app ondersteunt drie drivers. Kies de handleiding die past bij uw model
en aansluiting; Tuya en Modbus gebruiken verschillende koppelgegevens.

| Driver | Installatie | Dashboard, standaard |
| --- | --- | --- |
| Aurora I/II via Tuya | [Local Key en apparaatgegevens](setup/Tuya_LocalKey_Homey_Guide_NL.pdf), [protocolversie](setup/PROTOCOL_VERSION_GUIDE.nl.md) | `http://HOMEY-IP:8092` |
| Aurora I/II via Modbus | [RS485 en Modbus TCP-gateway](setup/modbus-elfin-ew11-setup.md), volg de Aurora I/II-instellingen | `http://HOMEY-IP:8090` |
| Aurora III via Modbus | [RS485 en Modbus TCP-gateway](setup/modbus-elfin-ew11-setup.md), volg de Aurora III-instellingen | `http://HOMEY-IP:8091` |

Vervang HOMEY-IP door het lokale IP-adres van Homey Pro. Gebruik uw ingestelde
poort als u deze hebt gewijzigd. Bekijk het [dashboardoverzicht voor alle drie
drivers](../README.md#local-dashboards) (Engels) en de
[Modbus-dashboardhandleiding](setup/MODBUS_DASHBOARD_GUIDE.nl.md).
De [Tuya-dashboardbeslissing](architecture/ADR-068-TUYA-DASHBOARD.md) beschrijft
de technische opzet en beperkingen van Tuya.

## Vind de juiste handleiding

| Uw vraag | Documentatie |
| --- | --- |
| Instellingen en dagelijks gebruik | [Configuratie](setup/advanced-settings/CONFIGURATION_GUIDE.nl.md), [Homey Flows](setup/guide/FLOW_CARDS_GUIDE.nl.md), [geavanceerde Flow-kaarten](setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.nl.md) |
| Stooklijnen en adaptieve regeling | [Geavanceerde functies](setup/advanced-control/Advanced_Features_Intro.nl.md), [overzicht regeling](ADAPTIVE_CONTROL_OVERVIEW.nl.md), [praktische handleiding](setup/guide/ADAPTIVE_CONTROL_GUIDE.nl.md) |
| COP, SCOP en gebouwinzichten | [COP instellen](setup/COP%20flow-card-setup.nl.md), [berekeningsmethoden](COP%20calculation/), [gebouwmodel](BUILDINGMODEL_INSIGHTS_OVERVIEW.nl.md), [gebouwinzichten gebruiken](setup/guide/BUILDING_INSIGHTS_GUIDE.nl.md) |
| Problemen of overstappen | [Tuya-probleemoplossing](setup/USER_QUICK_FIX.nl.md), [Modbus-diagnose](setup/MODBUS_DASHBOARD_GUIDE.nl.md), [Aurora III-migratie](setup/MIGRATION_AURORA3.nl.md) |
| Technische verdieping en ontwikkeling | [Specificaties en mappings](Heatpump%20specs/), [architectuur en ontwerpbesluiten](architecture/), [ontwikkelaarshulpmiddelen](Dev%20support/), [verificatie en testscenario's](testing/) |

Functies en instellingen verschillen per driver en warmtepompmodel. De meeste
gebruikershandleidingen zijn vertaald; technische referenties zijn soms alleen
in het Nederlands of Engels beschikbaar.

---

## 🗂️ Mappenstructuur Overzicht

| Map | Beschrijving | Doelgroep |
|-----|--------------|-----------|
| [**setup/**](setup/) | Installatiehandleidingen, configuratie en gebruikerstutorials | 👤 Eindgebruikers, installateurs |
| [**COP calculation/**](COP%20calculation/) | COP en SCOP berekeningsmethodiek en algoritmes | 👤 Gevorderde gebruikers, HVAC professionals |
| [**Heatpump specs/**](Heatpump%20specs/) | DPS mappings, capabilities en apparaatspecificaties | 🔧 Ontwikkelaars, technische integrators |
| [**architecture/**](architecture/) | App architectuur, service patterns en code design | 🔧 Ontwikkelaars, contributors |
| [**Dev support/**](Dev%20support/) | Development tools, testgidsen en interne docs | 🔧 Alleen ontwikkelaars |

---

## 🌍 Beschikbare Talen

De meeste gebruikersdocumentatie is beschikbaar in vier talen:

| Document | 🇳🇱 NL | 🇬🇧 EN | 🇩🇪 DE | 🇫🇷 FR |
|----------|--------|--------|--------|--------|
| Introductie Geavanceerde Functies | [NL](setup/advanced-control/Advanced_Features_Intro.nl.md) | [EN](setup/advanced-control/Advanced_Features_Intro.en.md) | [DE](setup/advanced-control/Advanced_Features_Intro.de.md) | [FR](setup/advanced-control/Advanced_Features_Intro.fr.md) |
| Geavanceerde Flow Cards Gids | [NL](setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.nl.md) | [EN](setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.en.md) | [DE](setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.de.md) | [FR](setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.fr.md) |
| **Adaptieve Regeling Overzicht** | [NL](ADAPTIVE_CONTROL_OVERVIEW.nl.md) | [EN](ADAPTIVE_CONTROL_OVERVIEW.en.md) | [DE](ADAPTIVE_CONTROL_OVERVIEW.de.md) | [FR](ADAPTIVE_CONTROL_OVERVIEW.fr.md) |
| **Gebouwmodel & Insights Overzicht** | [NL](BUILDINGMODEL_INSIGHTS_OVERVIEW.nl.md) | [EN](BUILDINGMODEL_INSIGHTS_OVERVIEW.en.md) | [DE](BUILDINGMODEL_INSIGHTS_OVERVIEW.de.md) | [FR](BUILDINGMODEL_INSIGHTS_OVERVIEW.fr.md) |
| Flow Cards Implementatiegids | [NL](setup/guide/FLOW_CARDS_GUIDE.nl.md) | [EN](setup/guide/FLOW_CARDS_GUIDE.en.md) | [DE](setup/guide/FLOW_CARDS_GUIDE.de.md) | [FR](setup/guide/FLOW_CARDS_GUIDE.fr.md) |
| Adaptieve Regeling Gids | [NL](setup/guide/ADAPTIVE_CONTROL_GUIDE.nl.md) | [EN](setup/guide/ADAPTIVE_CONTROL_GUIDE.en.md) | [DE](setup/guide/ADAPTIVE_CONTROL_GUIDE.de.md) | [FR](setup/guide/ADAPTIVE_CONTROL_GUIDE.fr.md) |
| Building Insights Gids | [NL](setup/guide/BUILDING_INSIGHTS_GUIDE.nl.md) | [EN](setup/guide/BUILDING_INSIGHTS_GUIDE.en.md) | [DE](setup/guide/BUILDING_INSIGHTS_GUIDE.de.md) | [FR](setup/guide/BUILDING_INSIGHTS_GUIDE.fr.md) |
| COP Flow Card Setup | [NL](setup/COP%20flow-card-setup.nl.md) | [EN](setup/COP%20flow-card-setup.en.md) | [DE](setup/COP%20flow-card-setup.de.md) | [FR](setup/COP%20flow-card-setup.fr.md) |
| Protocolversie Gids | [NL](setup/PROTOCOL_VERSION_GUIDE.nl.md) | [EN](setup/PROTOCOL_VERSION_GUIDE.en.md) | [DE](setup/PROTOCOL_VERSION_GUIDE.de.md) | [FR](setup/PROTOCOL_VERSION_GUIDE.fr.md) |
| Configuratiegids | [NL](setup/advanced-settings/CONFIGURATION_GUIDE.nl.md) | [EN](setup/advanced-settings/CONFIGURATION_GUIDE.en.md) | [DE](setup/advanced-settings/CONFIGURATION_GUIDE.de.md) | [FR](setup/advanced-settings/CONFIGURATION_GUIDE.fr.md) |
| Tuya LocalKey Handleiding | [NL](setup/Tuya_LocalKey_Homey_Guide_NL.pdf) | [EN](setup/Tuya_LocalKey_Homey_Guide_EN.pdf) | [DE](setup/Tuya_LocalKey_Homey_Guide_DE.pdf) | [FR](setup/Tuya_LocalKey_Homey_Guide_FR.pdf) |
| Snelle Probleemoplossing | [NL](setup/USER_QUICK_FIX.nl.md) | [EN](setup/USER_QUICK_FIX.en.md) | [DE](setup/USER_QUICK_FIX.de.md) | [FR](setup/USER_QUICK_FIX.fr.md) |
| Modbus-dashboardgids (Aurora I/II en III) | [NL](setup/MODBUS_DASHBOARD_GUIDE.nl.md) | [EN](setup/MODBUS_DASHBOARD_GUIDE.en.md) | [DE](setup/MODBUS_DASHBOARD_GUIDE.de.md) | [FR](setup/MODBUS_DASHBOARD_GUIDE.fr.md) |
| Migratiehandleiding Aurora III | [NL](setup/MIGRATION_AURORA3.nl.md) | [EN](setup/MIGRATION_AURORA3.en.md) | [DE](setup/MIGRATION_AURORA3.de.md) | [FR](setup/MIGRATION_AURORA3.fr.md) |

---

## 📁 Gedetailleerde Inhoud

### 👤 setup/ — Gebruikersdocumentatie
*Voor: Eindgebruikers, installateurs, HVAC professionals*

- **Introductie Geavanceerde Functies** — Hoe geavanceerde functies ontgrendelen met externe data
- **COP Flow Card Setup** — Stapsgewijze COP metingsconfiguratie
- **Protocolversie Gids** — Tuya protocolversie selectie (3.3/3.4/3.5)
- **Configuratiegids** — Complete instellingenreferentie
- **Tuya LocalKey Handleiding** — Hoe Tuya credentials verkrijgen (PDF)
- **Elfin EW11 Modbus Setup Guide** — [Modbus TCP-gateway handleiding](setup/modbus-elfin-ew11-setup.md) voor Aurora I/II en III
- **Snelle Probleemoplossing** — Veelvoorkomende problemen en oplossingen
- **Modbus-dashboardgids** — Lokale dashboards per Modbus-model (poorten 8090 en 8091)
- **Migratiehandleiding Aurora III** — Overstappen vanuit de aparte Aurora III-app
- **guide/** — Extra gedetailleerde gidsen (flow cards, adaptieve regeling, building insights)

### 📊 COP calculation/ — Efficiëntie Algoritmes
*Voor: Gevorderde gebruikers, HVAC professionals, ontwikkelaars*

- **COP-calculation.md** — Real-time COP berekeningsmethodiek
- **SCOP-calculation.md** — Seizoens-COP (SCOP) algoritmes

### 🔌 Heatpump specs/ — Apparaatspecificaties
*Voor: Ontwikkelaars, technische integrators*

- **capabilities-overview.md** — Alle Homey capabilities uitgelegd
- **DPsettings2.pdf/xlsx** — Complete DPS (Data Point) mapping
- **R290/** — R290 koelmiddel specifieke parameters
- **R32/** — R32 koelmiddel specifieke parameters

### 🏗️ architecture/ — Code Architectuur
*Voor: Ontwikkelaars, contributors*

- **SERVICE_ARCHITECTURE.md** — Microservice design patterns
- **DPS_MAPPING.md** — Tuya DPS naar capability mapping
- **ERROR_HANDLING.md** — Error handling strategieën
- **HEARTBEAT_MECHANISM.md** — Connectie keepalive design
- **KEY_PATTERNS.md** — Kerncode patterns en conventies

### 🔧 Dev support/ — Developer Resources
*Voor: Alleen ontwikkelaars*

- **Architectural overview/** — Systeemdiagrammen en design docs
- **Flow Card handling/** — Flow card implementatiedetails
- **Image design/** — Icon en UI asset bronnen
- **CALCULATORS.md** — Calculator flow card implementatie
- **PHASE2_TESTING_GUIDE.md** — Testprocedures

---



*Laatst bijgewerkt: 2026-11-10*
