# Application Pompe à Chaleur Adlar - Introduction aux Fonctions Avancées

Ce guide vous montre comment activer les fonctions avancées de l'application Adlar Heat Pump en connectant des données externes, et présente les puissantes cartes de flux calculateur.

---

## Partie 1 : Connexion des Données Externes (Configuration)

Pour exploiter pleinement les fonctionnalités de l'application, vous pouvez connecter des capteurs et données externes via les flux Homey. Cela déverrouille des fonctions telles que le calcul COP, le contrôle adaptatif de température et l'optimisation des prix.

### 1.1 Connexion de la Puissance Externe (pour le Calcul COP)

Connectez un compteur de puissance externe (par ex. de votre tableau électrique) pour un calcul COP précis.

![Configuration puissance externe](../images/Setup%20-%20extern%20vermogen.png)

**Comment configurer :**
```
QUAND : [Compteur kWh pompe à chaleur] La puissance a changé
ALORS : [Intelligent Heat Pump] Envoyer {{Puissance}} W à la pompe à chaleur pour le calcul COP
```

**Ce que cela déverrouille :**
- ✅ Calcul COP en temps réel précis (±5% de précision)
- ✅ Tendances COP quotidiennes et mensuelles
- ✅ Déclencheurs et conditions de cartes de flux COP
- ✅ Fonction d'optimisation COP

> [!NOTE]
> **Et si vous n'avez pas de mesure de puissance ?**
> 
> Si vous n'avez **pas** de compteur de puissance externe et que votre pompe à chaleur n'a **pas** de mesure de puissance interne (pas de DPS pour tension/courant/puissance), alors les fonctions suivantes ne sont **pas disponibles** :
>
> | ❌ Non Disponible | ✅ Fonctionne Toujours |
> |-------------------|------------------------|
> | Calcul COP en temps réel | Contrôle adaptatif de température |
> | COP quotidien/mensuel | Apprentissage du modèle de bâtiment |
> | Optimisation COP | Building Insights (sans économies €) |
> | Cartes de flux COP | Compensation météo courbe de chauffe |
> | Intégration Energy Dashboard | Surveillance statut/mode |
> | Calcul des coûts énergétiques | Optimisation des prix (théorique) |
>
> **Solutions :**
> - **Prise intelligente avec mesure de puissance** (Shelly PM, FIBARO) - Note : doit supporter 2000-4000W
> - **Compteur kWh séparé dans le tableau électrique** (Qubino, Eastron SDM) - Plus précis, nécessite installation
> - **Sous-groupe compteur P1** - Si votre application P1 peut distinguer les groupes

---

### 1.2 Connexion de la Température Intérieure Externe (pour le Contrôle Adaptatif)

Connectez un thermostat d'ambiance ou un capteur de température pour le contrôle adaptatif de température.

![Configuration température intérieure externe](../images/Setup%20-%20externe%20binnentemperatuur.png)

**Comment configurer :**
```
QUAND : [Capteur salon] La température a changé
ALORS : [Intelligent Heat Pump] Envoyer {{Température}} °C température intérieure pour contrôle adaptatif
```

**Ce que cela déverrouille :**
- ✅ Contrôle adaptatif de température (régulateur PI)
- ✅ Température intérieure stable (±0.3°C)
- ✅ Apprentissage du modèle de bâtiment (masse thermique, isolation)
- ✅ Building Insights avec recommandations d'économies

---

### 1.3 Connexion de la Température Extérieure Externe (pour le Modèle Thermique)

Connectez une station météo ou des données de service météo pour de meilleures prédictions thermiques.

![Configuration température extérieure externe](../images/Setup%20-%20externe%20buitentemperatuur.png)

**Comment configurer :**
```
QUAND : [Service météo] La température actuelle a changé
ALORS : [Intelligent Heat Pump] Envoyer {{Température actuelle}} °C à la pompe à chaleur pour calcul COP/masse thermique
```

**Ce que cela déverrouille :**
- ✅ Calcul COP amélioré (référence Carnot)
- ✅ Apprentissage du modèle de bâtiment plus précis
- ✅ Compensation météo pour courbe de chauffe
- ✅ Optimisations saisonnières

> [!NOTE]
> **Cela fonctionne-t-il sans température extérieure externe ?**
> 
> Oui ! L'application utilise automatiquement le **capteur ambient interne (DPS 25)** de la pompe à chaleur comme solution de repli. Toutes les fonctions fonctionnent avec ce capteur, mais avec une précision réduite.
>
> | Source | Précision | Note |
> |--------|-----------|------|
> | **Capteur externe** (service météo, station météo) | ±0.5°C | Recommandé pour les meilleurs résultats |
> | **Capteur interne** (DPS 25) | ±2-3°C | Affecté par la chaleur perdue de l'unité extérieure |
>
> **Impact sur les fonctions :**
> - Modèle de bâtiment : τ (constante de temps) peut dévier de ~10%
> - Référence COP Carnot : ~5% moins précis
> - Prédictions : Planification légèrement moins précise
>
> **Conclusion :** La connexion externe est *optionnelle* pour une meilleure précision, pas requise.

---

### 1.4 Connexion des Prix de l'Énergie Externes (pour l'Optimisation des Prix)

Connectez une application de prix d'énergie dynamique (par ex. PBTH ou EnergyZero) pour une optimisation intelligente des prix.

![Configuration prix de l'énergie externes](../images/Setup%20-%20externe%20energietarieven.png)

**Comment configurer :**
```
QUAND : [Application prix énergie] Nouveaux prix reçus pour les heures à venir
ALORS : [Intelligent Heat Pump] Envoyer les prix d'énergie externes {{Prix}} pour l'optimisation des prix
```

**Ce que cela déverrouille :**
- ✅ Optimisation automatique des prix
- ✅ Préchauffage pendant les heures bon marché
- ✅ Évitement des prix de pointe
- ✅ Économies estimées : 400-600€/an

---

### 1.5 Connecter le Rayonnement Solaire Externe (pour Gain Solaire du Modèle de Bâtiment)

Connectez un capteur de rayonnement solaire (par ex. KNMI) pour un calcul précis du gain solaire dans le modèle de bâtiment.

![Configuration intensité rayonnement KNMI](../images/Setup%20-%20KNMI%20stralingsintensiteit.png)

**Comment configurer :**
```
QUAND : [KNMI] L'intensité de rayonnement a changé
ALORS : [Intelligent Heat Pump] Envoyer rayonnement solaire {{Intensité rayonnement}} W/m² à la pompe à chaleur
```

**Ce que cela déverrouille :**

- ✅ Facteur g précis (coefficient de gain solaire) dans le modèle de bâtiment
- ✅ Meilleure prévision du besoin de chauffage lors de journées ensoleillées
- ✅ Utilisation optimale du gain solaire passif
- ✅ Besoin de chauffage réduit lors de forte irradiation

> [!NOTE]
> **Avantage d'un capteur de rayonnement solaire externe :**
>
> Sans capteur externe, l'application ne peut déduire le gain solaire qu'indirectement à partir des augmentations de température. Avec une mesure directe du rayonnement, le **facteur g est 30-40% plus précis**.
>
> | Source | Précision facteur g | Remarque |
> |--------|---------------------|----------|
> | **Avec capteur rayonnement** | ±15% | Mesure directe irradiation |
> | **Sans capteur** | ±40-50% | Déduit des deltas temp |
>
> **Impact :**
>
> - Modèle de bâtiment : le facteur g représente la surface et l'orientation réelles du vitrage
> - Prévisions : Meilleure anticipation des périodes ensoleillées
> - Économie d'énergie : Jusqu'à 5-10% de réduction du besoin de chauffage les jours ensoleillés
>
> **Conclusion :** La connexion externe est *optionnelle* mais offre une modélisation du gain solaire nettement meilleure.

---

### 1.6 Connecter la Vitesse du Vent Externe (pour Correction de Vent du Modèle de Bâtiment)

Connectez un capteur de vitesse du vent (par ex. KNMI) pour un calcul précis des pertes de chaleur liées au vent.

![Configuration vitesse du vent KNMI](../images/Setup%20-%20KNMI%20windsnelheid%20kmh.png)

**Comment configurer :**
```
QUAND : [KNMI] La vitesse du vent a changé
ALORS : [Intelligent Heat Pump] Envoyer vitesse du vent {{Vitesse vent}} km/h à la pompe à chaleur
```

**Ce que cela déverrouille :**

- ✅ Paramètre W_corr dans le modèle de bâtiment (facteur de correction vent)
- ✅ Correction dynamique UA lors de vent fort (+20-50% perte de chaleur supplémentaire)
- ✅ Meilleure prévision du besoin de chauffage lors de tempêtes
- ✅ Calcul τ (constante de temps) plus précis

> [!NOTE]
> **Impact du vent sur les pertes de chaleur :**
>
> Le vent augmente les pertes de chaleur par **refroidissement convectif** des façades. Lors de tempêtes (>50 km/h), les pertes de chaleur peuvent être **20-50% plus élevées** qu'en air calme.
>
> | Vitesse du vent | Perte de chaleur extra | W_corr typique |
> |-----------------|------------------------|---------------:|
> | 0-10 km/h | Négligeable | 0.00-0.03 |
> | 10-30 km/h | +5-15% | 0.03-0.07 |
> | 30-50 km/h | +15-30% | 0.07-0.10 |
> | >50 km/h | +30-50% | 0.10-0.12 |
>
> **Fonctions sans correction vent :**
>
> - Le modèle de bâtiment fonctionne toujours, mais la valeur UA est une moyenne sans correction vent
> - Lors de tempêtes, la prévision peut dévier de 10-20%
>
> **Conclusion :** La connexion externe est *optionnelle* mais offre des prévisions nettement meilleures lors de vent variable.

---

### 1.7 Connecter la Puissance des Panneaux Solaires Externe (pour Calcul du Rayonnement Solaire)

Connectez votre onduleur solaire (par ex. SolarEdge, Enphase) pour un calcul précis du rayonnement solaire basé sur la puissance PV actuelle.

![Configuration puissance PV actuelle](../images/Setup%20-%20PV%20actueel%20vermogen.png)

**Comment configurer :**
```
QUAND : [SolarEdge] La puissance a changé
ALORS : [Intelligent Heat Pump] Envoyer puissance panneau solaire {{Puissance}}W à la pompe à chaleur
```

**Ce que cela déverrouille :**

- ✅ Calcul du rayonnement solaire à partir de la puissance PV et des spécifications des panneaux
- ✅ Alternative au capteur de rayonnement direct (si non disponible)
- ✅ Détermination précise du facteur g dans le modèle de bâtiment
- ✅ Modélisation optimale du gain solaire

> [!NOTE]
> **Déduire le rayonnement solaire de la puissance PV :**
>
> L'application peut **calculer** le rayonnement solaire à partir de la puissance actuelle de vos panneaux solaires :
>
> **Formule :** `Rayonnement (W/m²) = Puissance PV (W) / (Surface panneau (m²) × Rendement (%))`
>
> **Exemple :**
>
> - 10 panneaux de 1,7m² avec 20% de rendement = 3,4 m² de surface effective
> - À 2000W de puissance PV → Rayonnement = 2000 / 3,4 = ~588 W/m²
>
> **Avantages vs. capteur de rayonnement direct :**
>
> - ✅ Pas de capteur supplémentaire nécessaire (utilise le monitoring PV existant)
> - ✅ Représente le rayonnement réel à votre emplacement et orientation
> - ⚠️ Cependant moins précis avec panneaux sales ou ombragés
>
> **Choix entre puissance PV et capteur de rayonnement :**
>
> | Situation | Meilleur choix |
> |-----------|----------------|
> | Panneaux solaires disponibles | Puissance PV (pragmatique) |
> | Pas de panneaux solaires | Capteur rayonnement KNMI |
> | Précision optimale | Connecter les deux (app utilise meilleure source) |
>
> **Conclusion :** La puissance PV est une *source alternative intelligente* pour les données de rayonnement solaire.

---

### 1.8 Aperçu : Fonctions et Dépendances

Le diagramme ci-dessous montre la relation entre les fonctions avancées et leurs sources de données requises.

![Feature Dependencies Diagram](../images/feature_dependencies.png)

**Légende :**
| Couleur | Signification |
|---------|---------------|
| 🔵 **Bleu** | Fonctions (activables via les paramètres) |
| 🟢 **Vert** | Sources de données externes (via Cartes de Flux) |
| ⚫ **Gris** | Capacités internes |

**Flèches :**
- **Ligne continue** → Dépendance requise
- **Ligne pointillée** → Dépendance optionnelle/améliorante

**Points clés :**
1. **Adaptive Temperature Control** est le cœur - nécessite température intérieure et température cible
2. **Energy Price Optimizer** et **COP Optimizer** s'appuient sur Adaptive Control
3. **Building Model Learning** nécessite température intérieure + température extérieure
4. **Building Insights** nécessite d'abord un Building Model fonctionnel
5. **Weight Calculator** combine les trois optimiseurs pour les décisions

---

## Partie 2 : Fonctions Avancées des Cartes de Flux (Exemples de Démonstration)

Après avoir connecté les données externes, vous pouvez utiliser de puissantes cartes de flux calculateur.

### 2.1 Calculateur de Courbe - Compensation Météo

Calculez automatiquement la température de départ optimale en fonction de la température extérieure avec une courbe de chauffe.

![Démo calculateur de courbe](../images/Curve%20calculator.png)

**Comment cela fonctionne :**
```
QUAND : [Aqara] La température a changé
ALORS : [Intelligent Heat Pump] Calculer la valeur pour {{Température}} 
     avec courbe : -10:35, -5:30, 0:27, 5:26, 10:25, 15:24, 20:22..., défaut : 35
ALORS : [Timeline] Créer notification avec Valeur de chauffe : {{Valeur Calculée}} 
     pour temp extérieure : {{Température}}
```

**Définition de la courbe expliquée :**
| Temp Extérieure | Temp Départ |
|-----------------|-------------|
| -10°C | 35°C |
| -5°C | 30°C |
| 0°C | 27°C |
| +10°C | 25°C |
| +20°C | 22°C |

**Applications :**
- 🌡️ Compensation météo courbe de chauffe (paramètres L28/L29)
- 🏠 Économies d'énergie grâce à des températures de départ plus basses par temps doux
- ⚡ Interpolation entre les points pour des transitions douces

---

### 2.2 Courbe de Chauffe Personnalisée - Calcul Linéaire

Calculez une courbe de chauffe avec une formule mathématique (y = ax + b), parfait pour les paramètres Adlar L28/L29.

![Démo courbe de chauffe personnalisée](../images/custom%20stooklijn.png)

**Comment cela fonctionne :**
```
QUAND : La température actuelle a changé
ALORS : [Intelligent Heat Pump] Calculer courbe de chauffe : L29=55°C à -15°C, L28=-5/10°C avec temp extérieure
ALORS : [Timeline] Créer notification avec courbe de chauffe personnalisée :
     {{Température pièce}} avec formule : {{Formule Courbe de Chauffe}} 
     de {{Ancienne valeur}} à {{Nouvelle valeur}}
```

**Explication de la formule :**
- **L29** : Température de référence (55°C à -15°C température extérieure)
- **L28** : Pente (-5°C par 10°C de différence de température)
- **Résultat** : `y = -0.5x + 47.5` → à 0°C extérieur = 47.5°C départ

**Applications :**
- 📐 Réplication exacte des paramètres de courbe de chauffe Adlar
- 🔧 Ajustement en temps réel via les flux
- 📊 Journalisation des formules pour analyse

---

### 2.3 Créneaux Horaires avec Variables - Programmation Journalière

Calculez des valeurs à partir de périodes de temps avec prise en charge des variables dynamiques.

![Démo créneaux horaires avec variables](../images/tijdsloten%20met%20vars.png)

**Comment cela fonctionne :**
```
QUAND : Toutes les 5 minutes
ALORS : [Intelligent Heat Pump] Calculer valeur depuis périodes de temps :
     00:00-20:00 : {{Prix_energie}} +1}}
     20:00-23:59 : {{Numéro_automatisation}} +1}}
ALORS : [Timeline] Créer notification avec Valeur à {{Heure}} est : {{Valeur résultat}}
```

**Exemples de résultats (de l'image) :**
| Heure | Résultat | Source |
|-------|----------|--------|
| 20:01 | 1.2445 | Prix_energie + 1 |
| 20:05 | 1.256 | Prix_energie + 1 |
| 19:58 | 1.256 | Numéro_automatisation + 1 |

**Applications :**
- ⏰ Programmation de température jour/nuit
- 💰 Calculs de prix dynamiques par créneau horaire
- 🏠 Programmes confort vs. économies
- 📅 Plannings week-end vs. semaine

---

## Résumé : Qu'est-ce qui Déverrouille Quoi ?

| Données Externes | Fonctions Déverrouillées |
|------------------|--------------------------|
| **Puissance** (compteur kWh) | Calcul COP, tendances d'efficacité, optimisation COP |
| **Température Intérieure** (capteur) | Contrôle adaptatif, modèle de bâtiment, building insights |
| **Température Extérieure** (météo) | Modèle thermique, compensation météo, ajustement saisonnier |
| **Prix de l'Énergie** (dynamique) | Optimisation des prix, préchauffage, économies de coûts |

---

## Prochaines Étapes

1. **Commencez par le COP** : Connectez d'abord le compteur de puissance pour des insights immédiats
2. **Activez le Contrôle Adaptatif** : Connectez le capteur de température intérieure
3. **Ajoutez les Données Météo** : Pour de meilleures prédictions
4. **Activez l'Optimisation des Prix** : Économies maximales avec les tarifs dynamiques

---

*Voir aussi :*
- [Guide de Configuration](../advanced-settings/CONFIGURATION_GUIDE.fr.md) - Tous les paramètres expliqués
- [Guide Flow Cards](../guide/FLOW_CARDS_GUIDE.fr.md) - Documentation complète des cartes de flux
- [Guide Contrôle Adaptatif](../guide/ADAPTIVE_CONTROL_GUIDE.fr.md) - Explication approfondie du contrôle adaptatif

---

*Dernière mise à jour : 2026-01-16*
*Version : 2.5.9*
