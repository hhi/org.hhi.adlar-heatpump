# 🚀 Nouvelle Fonctionnalité : Contrôle Adaptatif de Température

> **Statut** : Disponible à partir de la version 2.5.x  
> **Prérequis** : Capteur de température intérieure externe via Homey Flow

---

## Qu'est-ce que le Contrôle Adaptatif de Température ?

L'application Adlar **apprend** maintenant comment votre maison se comporte et ajuste automatiquement la pompe à chaleur pour un confort optimal et des économies maximales.

### Les 3 Piliers : Confort • Efficacité • Coût

| Facteur | Ce qu'il fait | Paramètre |
|---------|---------------|-----------|
| 🛋️ **Confort** | Température intérieure stable (±0.3°C) via contrôle PI | 60% (par défaut) |
| ⚡ **Efficacité** | COP optimal grâce à une température d'alimentation intelligente | 25% (par défaut) |
| 💰 **Coût** | Préchauffage pendant l'électricité bon marché, réduction pendant les pics | 15% (par défaut) |

*Les pondérations sont réglables et se normalisent automatiquement à 100%.*

---

## Que Peut-il Accomplir ?

### 1. Température Plus Stable
- **Problème** : Les thermostats traditionnels réagissent lentement, la température fluctue de 1-2°C
- **Solution** : Contrôleur PI avec prédiction → température intérieure reste dans ±0.3°C

### 2. Factures d'Énergie Plus Basses
- **Optimisation COP** : Apprend la température d'alimentation optimale par température extérieure → €200-300/an
- **Optimisation des Prix** : Préchauffe pendant les heures bon marché → €400-600/an

### 3. Modèle de Bâtiment Plus Intelligent
L'application apprend automatiquement :
- **Masse thermique (C)** : À quelle vitesse votre maison refroidit
- **Perte de chaleur (UA)** : Qualité d'isolation
- **Constante de temps (τ)** : Heures jusqu'à température stable
- **Gain solaire (g)** : Contribution du chauffage par le soleil

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

---

## Comment Activer ?

1. **Paramètres Appareil** → Activer `Contrôle adaptatif de température`
2. Créer un flux pour la température intérieure
3. Attendre 24-48 heures pour l'apprentissage du modèle de bâtiment
4. Optionnel : Activer l'optimisation COP/Prix

---

*Plus d'infos : [Advanced Features Introduction](setup/advanced-control/Advanced_Features_Intro.fr.md)*
*Plus d'infos : [Configuration Guide](setup/advanced-settings/CONFIGURATION_GUIDE.fr.md) - Section 5*
