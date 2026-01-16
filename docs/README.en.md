# 📚 Adlar Heat Pump Documentation

Welcome to the documentation for the Adlar Heat Pump Homey app.

---

## 🗂️ Directory Overview

| Directory | Description | Target Audience |
|-----------|-------------|-----------------|
| [**setup/**](setup/) | Installation guides, configuration, and user tutorials | 👤 End users, installers |
| [**COP calculation/**](COP%20calculation/) | COP and SCOP calculation methodology and algorithms | 👤 Advanced users, HVAC professionals |
| [**Heatpump specs/**](Heatpump%20specs/) | DPS mappings, capabilities, and device specifications | 🔧 Developers, technical integrators |
| [**architecture/**](architecture/) | App architecture, service patterns, and code design | 🔧 Developers, contributors |
| [**Dev support/**](Dev%20support/) | Development tools, testing guides, and internal docs | 🔧 Developers only |

---

## 🌍 Available Languages

Most user documentation is available in four languages:

| Document | 🇳🇱 NL | 🇬🇧 EN | 🇩🇪 DE | 🇫🇷 FR |
|----------|--------|--------|--------|--------|
| Advanced Features Introduction | [NL](setup/Advanced_Features_Intro.nl.md) | [EN](setup/Advanced_Features_Intro.en.md) | [DE](setup/Advanced_Features_Intro.de.md) | [FR](setup/Advanced_Features_Intro.fr.md) |
| COP Flow Card Setup | [NL](setup/COP%20flow-card-setup.nl.md) | [EN](setup/COP%20flow-card-setup.en.md) | [DE](setup/COP%20flow-card-setup.de.md) | [FR](setup/COP%20flow-card-setup.fr.md) |
| Protocol Version Guide | [NL](setup/PROTOCOL_VERSION_GUIDE.nl.md) | [EN](setup/PROTOCOL_VERSION_GUIDE.en.md) | [DE](setup/PROTOCOL_VERSION_GUIDE.de.md) | [FR](setup/PROTOCOL_VERSION_GUIDE.fr.md) |
| Configuration Guide | [NL](setup/advanced-settings/CONFIGURATION_GUIDE.nl.md) | [EN](setup/advanced-settings/CONFIGURATION_GUIDE.en.md) | [DE](setup/advanced-settings/CONFIGURATION_GUIDE.de.md) | [FR](setup/advanced-settings/CONFIGURATION_GUIDE.fr.md) |
| Tuya LocalKey Guide | [NL](setup/Tuya_LocalKey_Homey_Guide_NL.pdf) | [EN](setup/Tuya_LocalKey_Homey_Guide_EN.pdf) | [DE](setup/Tuya_LocalKey_Homey_Guide_DE.pdf) | [FR](setup/Tuya_LocalKey_Homey_Guide_FR.pdf) |
| Quick Fix Guide | [NL](setup/USER_QUICK_FIX.nl.md) | [EN](setup/USER_QUICK_FIX.en.md) | [DE](setup/USER_QUICK_FIX.de.md) | [FR](setup/USER_QUICK_FIX.fr.md) |

---

## 📁 Detailed Contents

### 👤 setup/ — User Documentation
*For: End users, installers, HVAC professionals*

- **Advanced Features Introduction** — How to unlock advanced features with external data
- **COP Flow Card Setup** — Step-by-step COP measurement configuration
- **Protocol Version Guide** — Tuya protocol version selection (3.3/3.4/3.5)
- **Configuration Guide** — Complete settings reference
- **Tuya LocalKey Guide** — How to obtain Tuya credentials (PDF)
- **Quick Fix Guide** — Common problems and solutions
- **guide/** — Additional detailed guides (flow cards, adaptive control)

### 📊 COP calculation/ — Efficiency Algorithms
*For: Advanced users, HVAC professionals, developers*

- **COP-calculation.md** — Real-time COP calculation methodology
- **SCOP-calculation.md** — Seasonal COP (SCOP) algorithms

### 🔌 Heatpump specs/ — Device Specifications
*For: Developers, technical integrators*

- **capabilities-overview.md** — All Homey capabilities explained
- **DPsettings2.pdf/xlsx** — Complete DPS (Data Point) mapping
- **R290/** — R290 refrigerant specific parameters
- **R32/** — R32 refrigerant specific parameters

### 🏗️ architecture/ — Code Architecture
*For: Developers, contributors*

- **SERVICE_ARCHITECTURE.md** — Microservice design patterns
- **DPS_MAPPING.md** — Tuya DPS to capability mapping
- **ERROR_HANDLING.md** — Error handling strategies
- **HEARTBEAT_MECHANISM.md** — Connection keepalive design
- **KEY_PATTERNS.md** — Core code patterns and conventions

### 🔧 Dev support/ — Developer Resources
*For: Developers only*

- **Architectural overview/** — System diagrams and design docs
- **Flow Card handling/** — Flow card implementation details
- **Image design/** — Icon and UI asset sources
- **CALCULATORS.md** — Calculator flow card implementation
- **PHASE2_TESTING_GUIDE.md** — Testing procedures

---

## 🚀 Quick Start

**New user?** Start here:
1. [Tuya LocalKey Guide](setup/Tuya_LocalKey_Homey_Guide_EN.pdf) — Get your credentials
2. [Protocol Version Guide](setup/PROTOCOL_VERSION_GUIDE.en.md) — Choose the right protocol
3. [Advanced Features Introduction](setup/Advanced_Features_Intro.en.md) — Unlock full functionality

**Having issues?** Check the [Quick Fix Guide](setup/USER_QUICK_FIX.en.md)

---

*Last updated: 2026-01-16*
