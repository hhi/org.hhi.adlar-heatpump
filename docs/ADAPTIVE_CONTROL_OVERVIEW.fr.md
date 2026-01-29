# 🚀 Nouvelle Fonctionnalité : Contrôle Adaptatif de Température

> **Statut** : Disponible à partir de la version 2.5.x  
> **Prérequis** : Capteur de température intérieure externe via Homey Flow

---

## Qu'est-ce que le Contrôle Adaptatif de Température ?

L'application Adlar **apprend** maintenant comment votre maison se comporte et ajuste automatiquement la pompe à chaleur pour un confort optimal et des économies maximales.

### Les 4 Piliers : Confort • Efficacité • Coût • Thermique

| Facteur | Ce qu'il fait | Paramètre |
|---------|---------------|-----------|
| 🛋️ **Confort** | Température intérieure stable (±0.3°C) via contrôle PI | 50% (par défaut) |
| ⚡ **Efficacité** | COP optimal grâce à une température d'alimentation intelligente | 15% (par défaut) |
| 💰 **Coût** | Préchauffage pendant l'électricité bon marché, réduction pendant les pics | 15% (par défaut) |
| 🏠 **Thermique** | Contrôle prédictif via modèle de bâtiment appris (τ, C, UA) | 20% (par défaut) |

*Les pondérations sont réglables et se normalisent automatiquement à 100%.*

---

## Que Peut-il Accomplir ?

### 1. Température Plus Stable
- **Problème** : Les thermostats traditionnels réagissent lentement, la température fluctue de 1-2°C
- **Solution** : Contrôleur PI avec prédiction → température intérieure reste dans ±0.3°C

### 2. Factures d'Énergie Plus Basses
- **Optimisation COP** : Apprend la température d'alimentation optimale par température extérieure → €200-300/an
- **Optimisation des Prix** : Préchauffe pendant les heures bon marché → €400-600/an

### 3. Modèle de Bâtiment Plus Intelligent (v2.6.0+)

L'application apprend automatiquement :

- **Masse thermique (C)** : À quelle vitesse votre maison refroidit
- **Perte de chaleur (UA)** : Qualité d'isolation
- **Constante de temps (τ)** : Heures jusqu'à température stable
- **Gain solaire (g)** : Contribution du chauffage par le soleil (si capteur disponible)
- **Correction du vent** : Perte de chaleur supplémentaire par vent fort (v2.7.0+)

**Période d'apprentissage** : 48-72 heures pour un modèle fiable  
**Mises à jour** : Apprentissage continu en fonction des conditions

---

## Configuration Requise

```
┌─────────────────────────────────────────────────────┐
│   Capteur Externe   →   Carte de Flux  →    App     │
│   (thermostat)          (déclencheur)     (apprend) │
└─────────────────────────────────────────────────────┘
```

**Exigences minimales :**
1. ✅ Capteur de température intérieure (ex. Aqara, Tado, thermostat Homey)
2. ✅ Flux : `QUAND temp change` → `Envoyer à la pompe à chaleur`

**Optionnel pour fonctionnalités supplémentaires :**
- Capteur de température extérieure (service météo, station météo)
- Compteur de puissance externe (pour COP)
- Contrat d'énergie dynamique (pour optimisation des prix)
- Capteur de vitesse du vent (pour correction du vent sur les pertes de chaleur)
- Capteur de rayonnement solaire (pour apprentissage du gain solaire)

---

## Comment Activer ?

1. **Paramètres Appareil** → Activer `Contrôle adaptatif de température`
2. Créer un flux pour la température intérieure
3. Attendre 48-72 heures pour l'apprentissage du modèle de bâtiment
4. Optionnel : Activer l'optimisation COP/Prix
5. Optionnel : Configurer les capteurs vent/solaire pour optimisation supplémentaire

---

*Plus d'infos : [Advanced Features Introduction](setup/advanced-control/Advanced_Features_Intro.fr.md)*
*Plus d'infos : [Configuration Guide](setup/advanced-settings/CONFIGURATION_GUIDE.fr.md) - Section 5*
