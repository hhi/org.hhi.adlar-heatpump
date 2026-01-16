# 📚 Documentation Pompe à Chaleur Adlar

Bienvenue dans la documentation de l'application Homey Adlar Heat Pump.

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
| Introduction Fonctions Avancées | [NL](setup/Advanced_Features_Intro.nl.md) | [EN](setup/Advanced_Features_Intro.en.md) | [DE](setup/Advanced_Features_Intro.de.md) | [FR](setup/Advanced_Features_Intro.fr.md) |
| **Aperçu Contrôle Adaptatif** | [NL](ADAPTIVE_CONTROL_OVERVIEW.nl.md) | [EN](ADAPTIVE_CONTROL_OVERVIEW.en.md) | [DE](ADAPTIVE_CONTROL_OVERVIEW.de.md) | [FR](ADAPTIVE_CONTROL_OVERVIEW.fr.md) |
| **Aperçu Modèle Bâtiment & Insights** | [NL](BUILDINGMODEL_INSIGHTS_OVERVIEW.nl.md) | [EN](BUILDINGMODEL_INSIGHTS_OVERVIEW.en.md) | [DE](BUILDINGMODEL_INSIGHTS_OVERVIEW.de.md) | [FR](BUILDINGMODEL_INSIGHTS_OVERVIEW.fr.md) |
| Configuration Cartes de Flux COP | [NL](setup/COP%20flow-card-setup.nl.md) | [EN](setup/COP%20flow-card-setup.en.md) | [DE](setup/COP%20flow-card-setup.de.md) | [FR](setup/COP%20flow-card-setup.fr.md) |
| Guide Version du Protocole | [NL](setup/PROTOCOL_VERSION_GUIDE.nl.md) | [EN](setup/PROTOCOL_VERSION_GUIDE.en.md) | [DE](setup/PROTOCOL_VERSION_GUIDE.de.md) | [FR](setup/PROTOCOL_VERSION_GUIDE.fr.md) |
| Guide de Configuration | [NL](setup/advanced-settings/CONFIGURATION_GUIDE.nl.md) | [EN](setup/advanced-settings/CONFIGURATION_GUIDE.en.md) | [DE](setup/advanced-settings/CONFIGURATION_GUIDE.de.md) | [FR](setup/advanced-settings/CONFIGURATION_GUIDE.fr.md) |
| Guide Tuya LocalKey | [NL](setup/Tuya_LocalKey_Homey_Guide_NL.pdf) | [EN](setup/Tuya_LocalKey_Homey_Guide_EN.pdf) | [DE](setup/Tuya_LocalKey_Homey_Guide_DE.pdf) | [FR](setup/Tuya_LocalKey_Homey_Guide_FR.pdf) |
| Résolution Rapide de Problèmes | [NL](setup/USER_QUICK_FIX.nl.md) | [EN](setup/USER_QUICK_FIX.en.md) | [DE](setup/USER_QUICK_FIX.de.md) | [FR](setup/USER_QUICK_FIX.fr.md) |

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
- **guide/** — Guides détaillés supplémentaires (cartes de flux, contrôle adaptatif)

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

## 🚀 Démarrage Rapide

**Nouvel utilisateur ?** Commencez ici :
1. [Guide Tuya LocalKey](setup/Tuya_LocalKey_Homey_Guide_FR.pdf) — Obtenez vos identifiants
2. [Guide Version du Protocole](setup/PROTOCOL_VERSION_GUIDE.fr.md) — Choisissez le bon protocole
3. [Introduction Fonctions Avancées](setup/Advanced_Features_Intro.fr.md) — Débloquez toutes les fonctionnalités

**Des problèmes ?** Consultez la [Résolution Rapide de Problèmes](setup/USER_QUICK_FIX.fr.md)

---

*Dernière mise à jour : 2026-01-16*
