# 📚 Documentation Pompe à Chaleur Adlar

Bienvenue dans la documentation de l'application Homey Adlar Heat Pump.

[Nederlands](README.nl.md) · [English](README.en.md) · [Deutsch](README.de.md) · [Français](README.fr.md)

## Commencez par votre pilote

Cette application prend en charge trois pilotes. Choisissez les instructions
adaptées à votre modèle et à votre connexion ; Tuya et Modbus nécessitent des
informations d'appairage différentes.

| Pilote | Installation | Tableau de bord par défaut |
| --- | --- | --- |
| Aurora I/II via Tuya | [Clé locale et informations de l'appareil](setup/Tuya_LocalKey_Homey_Guide_FR.pdf), [version du protocole](setup/PROTOCOL_VERSION_GUIDE.fr.md) | `http://HOMEY-IP:8092` |
| Aurora I/II via Modbus | [RS485 et passerelle Modbus TCP](setup/modbus-elfin-ew11-setup.md) (néerlandais), suivre les réglages Aurora I/II | `http://HOMEY-IP:8090` |
| Aurora III via Modbus | [RS485 et passerelle Modbus TCP](setup/modbus-elfin-ew11-setup.md) (néerlandais), suivre les réglages Aurora III | `http://HOMEY-IP:8091` |

Remplacez HOMEY-IP par l'adresse IP locale de votre Homey Pro. Utilisez le port
configuré si vous l'avez modifié. Consultez la [présentation des tableaux de
bord des trois pilotes](../README.md#local-dashboards) (anglais) et le
[guide des tableaux de bord Modbus](setup/MODBUS_DASHBOARD_GUIDE.fr.md).
La [décision sur le tableau de bord Tuya](architecture/ADR-068-TUYA-DASHBOARD.md)
(néerlandais) décrit sa conception technique et ses limites.

## Trouvez le bon guide

| Votre question | Documentation |
| --- | --- |
| Réglages et utilisation quotidienne | [Configuration](setup/advanced-settings/CONFIGURATION_GUIDE.fr.md), [Flows Homey](setup/guide/FLOW_CARDS_GUIDE.fr.md), [cartes Flow avancées](setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.fr.md) |
| Courbes de chauffe et régulation adaptative | [Fonctions avancées](setup/advanced-control/Advanced_Features_Intro.fr.md), [présentation de la régulation](ADAPTIVE_CONTROL_OVERVIEW.fr.md), [guide pratique](setup/guide/ADAPTIVE_CONTROL_GUIDE.fr.md) |
| COP, SCOP et analyse du bâtiment | [Configurer le COP](setup/COP%20flow-card-setup.fr.md), [méthodes de calcul](COP%20calculation/), [modèle du bâtiment](BUILDINGMODEL_INSIGHTS_OVERVIEW.fr.md), [utiliser les analyses du bâtiment](setup/guide/BUILDING_INSIGHTS_GUIDE.fr.md) |
| Problèmes ou migration | [Dépannage Tuya](setup/USER_QUICK_FIX.fr.md), [Diagnostic Modbus](setup/MODBUS_DASHBOARD_GUIDE.fr.md), [migration Aurora III](setup/MIGRATION_AURORA3.fr.md) |
| Détails techniques et développement | [Spécifications et correspondances](Heatpump%20specs/), [architecture et décisions de conception](architecture/), [ressources pour développeurs](Dev%20support/), [vérification et scénarios de test](testing/) |

Les fonctions et réglages varient selon le pilote et le modèle de pompe à
chaleur. La plupart des guides utilisateur sont traduits ; certaines références
techniques sont disponibles uniquement en néerlandais ou en anglais.

---

## 🗂️ Aperçu des Répertoires

| Répertoire | Description | Public Cible |
|------------|-------------|--------------|
| [**setup/**](setup/) | Guides d'installation, configuration et tutoriels utilisateur | 👤 Utilisateurs finaux, installateurs |
| [**COP calculation/**](COP%20calculation/) | Méthodologie et algorithmes de calcul COP et SCOP | 👤 Utilisateurs avancés, professionnels HVAC |
| [**Heatpump specs/**](Heatpump%20specs/) | Mappings DPS, capacités et spécifications d'appareil | 🔧 Développeurs, intégrateurs techniques |
| [**architecture/**](architecture/) | Architecture de l'app, patterns de service et design de code | 🔧 Développeurs, contributeurs |
| [**Dev support/**](Dev%20support/) | Outils de développement, guides de test et docs internes | 🔧 Développeurs uniquement |

---

## 🌍 Langues Disponibles

La plupart de la documentation utilisateur est disponible en quatre langues :

| Document | 🇳🇱 NL | 🇬🇧 EN | 🇩🇪 DE | 🇫🇷 FR |
|----------|--------|--------|--------|--------|
| Introduction Fonctions Avancées | [NL](setup/advanced-control/Advanced_Features_Intro.nl.md) | [EN](setup/advanced-control/Advanced_Features_Intro.en.md) | [DE](setup/advanced-control/Advanced_Features_Intro.de.md) | [FR](setup/advanced-control/Advanced_Features_Intro.fr.md) |
| Guide des Flow Cards avancées | [NL](setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.nl.md) | [EN](setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.en.md) | [DE](setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.de.md) | [FR](setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.fr.md) |
| **Aperçu Contrôle Adaptatif** | [NL](ADAPTIVE_CONTROL_OVERVIEW.nl.md) | [EN](ADAPTIVE_CONTROL_OVERVIEW.en.md) | [DE](ADAPTIVE_CONTROL_OVERVIEW.de.md) | [FR](ADAPTIVE_CONTROL_OVERVIEW.fr.md) |
| **Aperçu Modèle Bâtiment & Insights** | [NL](BUILDINGMODEL_INSIGHTS_OVERVIEW.nl.md) | [EN](BUILDINGMODEL_INSIGHTS_OVERVIEW.en.md) | [DE](BUILDINGMODEL_INSIGHTS_OVERVIEW.de.md) | [FR](BUILDINGMODEL_INSIGHTS_OVERVIEW.fr.md) |
| Guide d'implémentation des cartes Flow | [NL](setup/guide/FLOW_CARDS_GUIDE.nl.md) | [EN](setup/guide/FLOW_CARDS_GUIDE.en.md) | [DE](setup/guide/FLOW_CARDS_GUIDE.de.md) | [FR](setup/guide/FLOW_CARDS_GUIDE.fr.md) |
| Guide du contrôle adaptatif | [NL](setup/guide/ADAPTIVE_CONTROL_GUIDE.nl.md) | [EN](setup/guide/ADAPTIVE_CONTROL_GUIDE.en.md) | [DE](setup/guide/ADAPTIVE_CONTROL_GUIDE.de.md) | [FR](setup/guide/ADAPTIVE_CONTROL_GUIDE.fr.md) |
| Guide Building Insights | [NL](setup/guide/BUILDING_INSIGHTS_GUIDE.nl.md) | [EN](setup/guide/BUILDING_INSIGHTS_GUIDE.en.md) | [DE](setup/guide/BUILDING_INSIGHTS_GUIDE.de.md) | [FR](setup/guide/BUILDING_INSIGHTS_GUIDE.fr.md) |
| Configuration Cartes de Flux COP | [NL](setup/COP%20flow-card-setup.nl.md) | [EN](setup/COP%20flow-card-setup.en.md) | [DE](setup/COP%20flow-card-setup.de.md) | [FR](setup/COP%20flow-card-setup.fr.md) |
| Guide Version du Protocole | [NL](setup/PROTOCOL_VERSION_GUIDE.nl.md) | [EN](setup/PROTOCOL_VERSION_GUIDE.en.md) | [DE](setup/PROTOCOL_VERSION_GUIDE.de.md) | [FR](setup/PROTOCOL_VERSION_GUIDE.fr.md) |
| Guide de Configuration | [NL](setup/advanced-settings/CONFIGURATION_GUIDE.nl.md) | [EN](setup/advanced-settings/CONFIGURATION_GUIDE.en.md) | [DE](setup/advanced-settings/CONFIGURATION_GUIDE.de.md) | [FR](setup/advanced-settings/CONFIGURATION_GUIDE.fr.md) |
| Guide Tuya LocalKey | [NL](setup/Tuya_LocalKey_Homey_Guide_NL.pdf) | [EN](setup/Tuya_LocalKey_Homey_Guide_EN.pdf) | [DE](setup/Tuya_LocalKey_Homey_Guide_DE.pdf) | [FR](setup/Tuya_LocalKey_Homey_Guide_FR.pdf) |
| Résolution Rapide de Problèmes | [NL](setup/USER_QUICK_FIX.nl.md) | [EN](setup/USER_QUICK_FIX.en.md) | [DE](setup/USER_QUICK_FIX.de.md) | [FR](setup/USER_QUICK_FIX.fr.md) |
| Guide des tableaux de bord Modbus (Aurora I/II et III) | [NL](setup/MODBUS_DASHBOARD_GUIDE.nl.md) | [EN](setup/MODBUS_DASHBOARD_GUIDE.en.md) | [DE](setup/MODBUS_DASHBOARD_GUIDE.de.md) | [FR](setup/MODBUS_DASHBOARD_GUIDE.fr.md) |
| Guide de migration Aurora III | [NL](setup/MIGRATION_AURORA3.nl.md) | [EN](setup/MIGRATION_AURORA3.en.md) | [DE](setup/MIGRATION_AURORA3.de.md) | [FR](setup/MIGRATION_AURORA3.fr.md) |

---

## 📁 Contenu Détaillé

### 👤 setup/ — Documentation Utilisateur
*Pour : Utilisateurs finaux, installateurs, professionnels HVAC*

- **Introduction Fonctions Avancées** — Comment débloquer les fonctions avancées avec des données externes
- **Configuration Cartes de Flux COP** — Configuration de mesure COP étape par étape
- **Guide Version du Protocole** — Sélection de la version du protocole Tuya (3.3/3.4/3.5)
- **Guide de Configuration** — Référence complète des paramètres
- **Guide Tuya LocalKey** — Comment obtenir les identifiants Tuya (PDF)
- **Résolution Rapide de Problèmes** — Problèmes courants et solutions
- **Configuration Elfin EW11 Modbus** — [Guide de la passerelle Modbus TCP](setup/modbus-elfin-ew11-setup.md) pour Aurora I/II et III (en néerlandais)
- **Guide des tableaux de bord Modbus** — Tableaux de bord locaux par modèle Modbus (ports 8090 et 8091)
- **Guide de migration Aurora III** — Passer de l'application Aurora III distincte
- **guide/** — Guides détaillés supplémentaires (cartes de flux, contrôle adaptatif, building insights)

### 📊 COP calculation/ — Algorithmes d'Efficacité
*Pour : Utilisateurs avancés, professionnels HVAC, développeurs*

- **COP-calculation.md** — Méthodologie de calcul COP en temps réel
- **SCOP-calculation.md** — Algorithmes COP saisonnier (SCOP)

### 🔌 Heatpump specs/ — Spécifications d'Appareil
*Pour : Développeurs, intégrateurs techniques*

- **capabilities-overview.md** — Toutes les capacités Homey expliquées
- **DPsettings2.pdf/xlsx** — Mapping complet des DPS (Data Point)
- **R290/** — Paramètres spécifiques au réfrigérant R290
- **R32/** — Paramètres spécifiques au réfrigérant R32

### 🏗️ architecture/ — Architecture du Code
*Pour : Développeurs, contributeurs*

- **SERVICE_ARCHITECTURE.md** — Patterns de design microservice
- **DPS_MAPPING.md** — Mapping Tuya DPS vers capacité
- **ERROR_HANDLING.md** — Stratégies de gestion des erreurs
- **HEARTBEAT_MECHANISM.md** — Design de keepalive de connexion
- **KEY_PATTERNS.md** — Patterns de code principaux et conventions

### 🔧 Dev support/ — Ressources Développeur
*Pour : Développeurs uniquement*

- **Architectural overview/** — Diagrammes système et docs de design
- **Flow Card handling/** — Détails d'implémentation des cartes de flux
- **Image design/** — Sources d'icônes et assets UI
- **CALCULATORS.md** — Implémentation des cartes de flux calculateur
- **PHASE2_TESTING_GUIDE.md** — Procédures de test

---



*Dernière mise à jour : 2026-11-10*
