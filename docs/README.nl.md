# 📚 Adlar Warmtepomp Documentatie

Welkom bij de documentatie voor de Adlar Warmtepomp Homey app.

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
| **Adaptieve Regeling Overzicht** | [NL](ADAPTIVE_CONTROL_OVERVIEW.nl.md) | [EN](ADAPTIVE_CONTROL_OVERVIEW.en.md) | [DE](ADAPTIVE_CONTROL_OVERVIEW.de.md) | [FR](ADAPTIVE_CONTROL_OVERVIEW.fr.md) |
| **Gebouwmodel & Insights Overzicht** | [NL](BUILDINGMODEL_INSIGHTS_OVERVIEW.nl.md) | [EN](BUILDINGMODEL_INSIGHTS_OVERVIEW.en.md) | [DE](BUILDINGMODEL_INSIGHTS_OVERVIEW.de.md) | [FR](BUILDINGMODEL_INSIGHTS_OVERVIEW.fr.md) |
| COP Flow Card Setup | [NL](setup/COP%20flow-card-setup.nl.md) | [EN](setup/COP%20flow-card-setup.en.md) | [DE](setup/COP%20flow-card-setup.de.md) | [FR](setup/COP%20flow-card-setup.fr.md) |
| Protocolversie Gids | [NL](setup/PROTOCOL_VERSION_GUIDE.nl.md) | [EN](setup/PROTOCOL_VERSION_GUIDE.en.md) | [DE](setup/PROTOCOL_VERSION_GUIDE.de.md) | [FR](setup/PROTOCOL_VERSION_GUIDE.fr.md) |
| Configuratiegids | [NL](setup/advanced-settings/CONFIGURATION_GUIDE.nl.md) | [EN](setup/advanced-settings/CONFIGURATION_GUIDE.en.md) | [DE](setup/advanced-settings/CONFIGURATION_GUIDE.de.md) | [FR](setup/advanced-settings/CONFIGURATION_GUIDE.fr.md) |
| Tuya LocalKey Handleiding | [NL](setup/Tuya_LocalKey_Homey_Guide_NL.pdf) | [EN](setup/Tuya_LocalKey_Homey_Guide_EN.pdf) | [DE](setup/Tuya_LocalKey_Homey_Guide_DE.pdf) | [FR](setup/Tuya_LocalKey_Homey_Guide_FR.pdf) |
| Snelle Probleemoplossing | [NL](setup/USER_QUICK_FIX.nl.md) | [EN](setup/USER_QUICK_FIX.en.md) | [DE](setup/USER_QUICK_FIX.de.md) | [FR](setup/USER_QUICK_FIX.fr.md) |

---

## 📁 Gedetailleerde Inhoud

### 👤 setup/ — Gebruikersdocumentatie
*Voor: Eindgebruikers, installateurs, HVAC professionals*

- **Introductie Geavanceerde Functies** — Hoe geavanceerde functies ontgrendelen met externe data
- **COP Flow Card Setup** — Stapsgewijze COP metingsconfiguratie
- **Protocolversie Gids** — Tuya protocolversie selectie (3.3/3.4/3.5)
- **Configuratiegids** — Complete instellingenreferentie
- **Tuya LocalKey Handleiding** — Hoe Tuya credentials verkrijgen (PDF)
- **Snelle Probleemoplossing** — Veelvoorkomende problemen en oplossingen
- **guide/** — Extra gedetailleerde gidsen (flow cards, adaptieve regeling)

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

## 🚀 Snel Starten

**Nieuwe gebruiker?** Begin hier:
1. [Tuya LocalKey Handleiding](setup/Tuya_LocalKey_Homey_Guide_NL.pdf) — Verkrijg je credentials
2. [Protocolversie Gids](setup/PROTOCOL_VERSION_GUIDE.nl.md) — Kies het juiste protocol
3. [Introductie Geavanceerde Functies](setup/advanced-control/Advanced_Features_Intro.nl.md) — Ontgrendel volledige functionaliteit

**Problemen?** Check de [Snelle Probleemoplossing](setup/USER_QUICK_FIX.nl.md)

---

*Laatst bijgewerkt: 2026-01-16*
