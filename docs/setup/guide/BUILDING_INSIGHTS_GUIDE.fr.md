# Guide des Aperçus & Recommandations du Bâtiment

**Version** : 3.4.0+ | **Dernière mise à jour** : Octobre 2026

---

## Table des matières

1. [Introduction](#introduction)
2. [Que sont les Aperçus du Bâtiment ?](#que-sont-les-aperçus-du-bâtiment)
3. [Comment ça fonctionne](#comment-ça-fonctionne)
4. [Sources de Rayonnement Solaire](#sources-de-rayonnement-solaire)
5. [Catégories d'aperçus](#catégories-daperçus)
6. [Comprendre vos aperçus](#comprendre-vos-aperçus)
7. [Passer à l'action](#passer-à-laction)
8. [Exemples de Flows](#exemples-de-flows)
9. [Paramètres](#paramètres)
10. [Dépannage](#dépannage)
11. [FAQ](#faq)

---

## Introduction

La fonctionnalité **Aperçus & Recommandations du Bâtiment** transforme votre pompe à chaleur d'un simple contrôleur de température en un conseiller énergétique intelligent. Après environ 1 à 2 jours d'apprentissage des caractéristiques thermiques de votre bâtiment, le système fournit des **recommandations concrètes et exploitables** avec des économies estimées en euros par mois.

### Avantages clés

| Avantage | Économies |
|----------|-----------|
| 💰 Aperçus d'isolation | 10-30% |
| ⏱️ Optimisation du préchauffage | 5-10% |
| 🏠 Stratégies de stockage thermique | 10-25% (avec tarification dynamique) |
| 📊 Transparence du ROI | Chaque recommandation inclut les économies mensuelles |

---

## Que sont les Aperçus du Bâtiment ?

Les Aperçus du Bâtiment analysent les paramètres du Modèle du Bâtiment : 4 paramètres appris (C, UA, g, P_int), la constante de temps τ = C/UA et la correction du vent, apprise séparément :

| Paramètre | Symbole | Signification | Plage typique |
|-----------|---------|---------------|---------------|
| **Masse thermique** | C | Capacité thermique - énergie nécessaire pour 1°C | 7-30 kWh/°C |
| **Coefficient de perte thermique** | UA | Taux de perte de chaleur par degré de différence | 0,05-0,5 kW/°C |
| **Constante de temps** | τ (tau) | Vitesse de chauffage/refroidissement (τ = C/UA) | 20-600 heures (valeurs de profil) |
| **Facteur de gain solaire** | g | Efficacité du rayonnement solaire | 0,3-0,6 |
| **Gains thermiques internes** | P_int | Chaleur des personnes, appareils, cuisine | 0,2-0,5 kW |
| **Correction du vent** | W_corr | Perte de chaleur supplémentaire par vent fort (v2.7.0+) | 0-50 W/°C |

Le système compare les valeurs apprises avec :
- **Votre profil de bâtiment sélectionné** (Léger/Moyen/Lourd/Passif)
- **Les valeurs typiques pour des bâtiments bien isolés**
- **Vos données de prix de l'énergie** (si disponibles)

Lorsque des opportunités d'optimisation sont détectées, il génère des **aperçus** avec des recommandations spécifiques.

---

## Comment ça fonctionne

### Phase d'apprentissage (1 à 2 jours)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│Collecte données │───▶│Apprentissage    │───▶│ Confiance croît │
│  toutes 5 min   │    │  algorithme RLS │    │    0% → 100%    │
└─────────────────┘    └─────────────────┘    └────────┬────────┘
                                                       │
         ┌─────────────────────────────────────────────┘
         ▼
   ┌───────────┐
   │   ≥70% ?  │
   └─────┬─────┘
         │
    ┌────┴────┐
    │         │
   Oui       Non ───────────────────────────────┐
    │                                           │
    ▼                                           │
┌─────────────────┐                             │
│    Aperçus      │                             │
│   disponibles   │          ┌──────────────────┘
└─────────────────┘          │
                             ▼
                  (Retour à la collecte de données)
```

**Données collectées :**
- Température intérieure (capteur externe)
- Température extérieure (pompe à chaleur ou capteur externe)
- Puissance électrique
- Rayonnement solaire estimé

**Génération des aperçus :**
- Le système évalue toutes les 50 minutes (10 échantillons)
- Détecte les patterns : mauvaise isolation, potentiel de stockage thermique, opportunités de préchauffage
- Génère des recommandations avec estimations de ROI

### Surveillance continue

- **S'adapte aux saisons** (multiplicateurs de gain solaire, patterns de chaleur interne)
- **Met à jour les aperçus** lors de dérive des paramètres >10%
- **Limitation du débit** pour éviter la "fatigue des conseils" (max 1 aperçu par catégorie par jour)

---

## Sources de Rayonnement Solaire

Le modèle du bâtiment utilise le rayonnement solaire pour calculer le gain de chaleur par les fenêtres. À partir de la version 2.7.0, le système prend en charge **trois sources de données** avec priorisation automatique.

### Le Facteur de Gain Solaire (g)

Le **facteur g** (0,3-0,6) détermine quelle proportion du rayonnement solaire incident réchauffe effectivement votre bâtiment :

| Valeur g | Signification | Bâtiment typique |
|----------|---------------|------------------|
| **0,3** | Faible gain solaire | Petites fenêtres, orientation nord |
| **0,45** | Gain solaire moyen | Logement standard |
| **0,6** | Gain solaire élevé | Grandes fenêtres orientées sud |

**Formule :** `Gain solaire (kW) = g × Rayonnement (W/m²) / 1000 × Surface vitrée effective`

### Cascade de Priorité du Rayonnement (v2.7.0)

Le système choisit automatiquement la meilleure source disponible :

```
┌─────────────────────────────────────────────────────────────┐
│  PRIORITÉ 1 : Panneaux solaires                             │
│  - Données temps réel les plus précises                     │
│  - Converti en rayonnement : P_panneau / Wc × 1000 W/m²     │
│  - Requiert : carte Flow "Recevoir puissance solaire"       │
└─────────────────────────────────────────────────────────────┘
                         ↓ (non disponible)
┌─────────────────────────────────────────────────────────────┐
│  PRIORITÉ 2 : Données KNMI                                  │
│  - Rayonnement réellement mesuré                            │
│  - Requiert : carte Flow "Recevoir rayonnement externe"     │
│  - Source : ex. app météo ou intégration station météo      │
└─────────────────────────────────────────────────────────────┘
                         ↓ (non disponible)
┌─────────────────────────────────────────────────────────────┐
│  PRIORITÉ 3 : Estimation sinusoïdale (fallback)             │
│  - Calculé selon l'heure et la date                         │
│  - Formule : max(0, sin(π × (heure-6)/12)) × pic            │
│  - Valeurs de pic saisonnières (hiver 200, été 800)         │
└─────────────────────────────────────────────────────────────┘
```

### Correction Saisonnière (multiplicateur g)

Le paramètre **"Gain solaire saisonnier (g)"** ajuste l'efficacité du rayonnement solaire par saison :

| Mois | Multiplicateur | Raison |
|------|----------------|--------|
| Déc-Fév | 60% | Soleil bas d'hiver, beaucoup de nuages |
| Mars, Nov | 80% | Périodes de transition |
| Avr, Oct | 100% | Référence de base |
| Mai, Sep | 120% | Soleil plus haut, meilleur angle |
| Juin-Août | 130% | Rayonnement maximal d'été |

> [!IMPORTANT]
> **Détection automatique (v2.7.0) :** La correction saisonnière est **uniquement** appliquée au rayonnement estimé. Lors de l'utilisation de panneaux solaires ou de données KNMI, la correction est automatiquement désactivée, car ces sources contiennent déjà l'effet réel de saison et de météo.

### Quelle source utiliser ?

| Source | Avantages | Inconvénients | Configuration |
|--------|-----------|---------------|---------------|
| **Panneaux** | Plus précis, temps réel | Nécessite intégration panneau | Flow : panneau → ADLAR |
| **KNMI** | Données mesurées, pas de panneaux | Peut être retardé 10-60 min | Flow : app météo → ADLAR |
| **Estimation** | Pas de config nécessaire | Moins précis par temps nuageux | Automatiquement actif |

**Recommandation :** Si vous avez des panneaux solaires, transmettez leur puissance. Sinon, l'estimation sinusoïdale avec correction saisonnière est suffisamment précise pour la plupart des situations.

---

## Catégories d'aperçus

Le système fournit **4 capteurs spécifiques par catégorie** (v2.5.10+) :

### 1. 🏠 Aperçus de Performance d'Isolation

**Ce qui est détecté :**
- Perte de chaleur élevée (UA > attendu)
- Excellente isolation (UA < attendu)

**Exemple d'aperçu :**
> « 🏠 Perte de chaleur élevée - UA 0,52 kW/°C (attendu : 0,30) »

**Exemple de recommandation :**
> « Envisagez des améliorations d'isolation : toit (25% d'économies), murs (15%), fenêtres (10%). Économies est. : €120/mois »

**Quand ça se déclenche :**
- Confiance ≥ 70%
- UA > 1,5× UA du profil **OU** UA > 0,5 kW/°C (seuil absolu)

**Que faire :**
1. **Vérifier la mesure** - Vérifier si portes/fenêtres étaient ouvertes pendant l'apprentissage
2. **Prioriser les améliorations** - L'isolation du toit offre le meilleur ROI (25% des économies totales)
3. **Obtenir des devis** - Utiliser l'estimation €120/mois pour calculer le délai d'amortissement
4. **Implémenter la réduction nocturne** - Réduire les pertes pendant les heures inoccupées

---

### 2. ⏱️ Aperçus de Stratégie de Préchauffage

**Ce qui est détecté :** six classes de réponse, selon τ (l'aperçu s'affiche en anglais) :

| Réponse | τ | Exemple d'aperçu |
|---|---|---|
| Très rapide | <5h | Very fast (~2 hours for 2°C) |
| Rapide | 5–10h | Fast (~4 hours for 2°C) |
| Normale | 10–20h | Normal (~8 hours for 2°C) |
| Lente | 20–40h | Slow (~16 hours for 2°C) |
| Très lente | 40–80h | Very slow (~24 hours for 2°C) |
| Extrêmement lente | ≥80h | Extremely slow (~32 hours for 2°C) |

Aucun aperçu de préchauffage n'apparaît lorsque τ dépasse 250 heures (par ex. maison passive).

---

### 3. 💰 Aperçus d'Optimisation du Stockage Thermique

**Ce qui est détecté :**
- Bâtiments à haute masse thermique (C > 18 kWh/°C) avec réponse lente (τ > 12h)
- Capacité à stocker l'énergie pendant les heures creuses, coaster pendant les heures de pointe

**Exemple d'aperçu (avec tarification dynamique) :**
> « 💰 Potentiel de stockage thermique - C=24 kWh/°C, τ=18h »

**Exemple de recommandation :**
> « Préchauffez +2°C pendant les heures creuses (02:00-06:00), coastez -1°C pendant les pointes (17:00-21:00). Économies est. : €95/mois »

**Exemple d'aperçu (sans tarification dynamique) :**
> « 💡 Bâtiment adapté au stockage thermique - C=24 kWh/°C, τ=18h »

**Exemple de recommandation :**
> « Ajoutez les prix de l'énergie dynamiques via la carte Flow 'Recevoir les prix de l'énergie externes' pour activer l'optimisation des coûts. Économies potentielles : 15-25% »

**Calcul du stockage thermique :**
```
Énergie stockée = C × Décalage temp = 24 kWh/°C × 2°C = 48 kWh
Économies quotidiennes = Énergie stockée × Différentiel de prix × Facteur d'utilisation
                       = 48 kWh × €0,15/kWh × 0,70 = €5,04/jour
Économies mensuelles = €5,04 × 30 = €151/mois
```

---

### 4. 🔄 Discordance du Profil de Bâtiment (Diagnostic)

**Ce qui est détecté :**
- Le profil de bâtiment sélectionné ne correspond pas au comportement appris
- >30% de déviation dans la constante de temps (τ)

**Exemple d'aperçu :**
> « 🔄 Le bâtiment se comporte comme 'lourd' (τ=80h vs 'moyen' τ=50h) »

**Exemple de recommandation :**
> « Changez le profil de bâtiment vers 'lourd' dans les paramètres de l'appareil pour un apprentissage plus rapide et de meilleurs paramètres initiaux »

**Caractéristiques des profils :**

| Profil | C (kWh/°C) | UA (kW/°C) | τ (heures) | Type de bâtiment |
|--------|-----------|-----------|------------|------------------|
| **Léger** | 7 | 0,35 | 20 | Ossature bois, isolation basique, changements rapides |
| **Moyen** | 15 | 0,30 | 50 | Brique, murs creux, double vitrage (typique FR) |
| **Lourd** | 20 | 0,25 | 80 | Béton/pierre, bonne isolation, verre HR++ |
| **Passif** | 30 | 0,05 | 600 | Maison passive, HR+++, étanche à l'air, VMC |

---

## Comprendre vos aperçus

### Où les trouver

**Capacités de l'appareil (v2.5.10+)** - Chaque catégorie a son propre capteur :
1. **Aperçu Isolation** (`building_insight_insulation`) — Analyse des pertes thermiques
2. **Aperçu Préchauffage** (`building_insight_preheating`) — Conseil de réponse thermique
3. **Aperçu Stockage Thermique** (`building_insight_thermal_storage`) — Potentiel de délestage
4. **Aperçu Profil Bâtiment** (`building_insight_profile`) — Détection de discordance de profil
5. **Diagnostics des Aperçus du Bâtiment (JSON)** — Données techniques détaillées

**Cartes de déclenchement Flow :**
1. **« Nouvel aperçu du bâtiment détecté »** — Se déclenche sur les nouveaux aperçus
2. **« Recommandation d'heure de préchauffage »** — Déclenche quand ΔT > 1.5°C (max 1x par 4 heures)
3. **« Discordance du profil de bâtiment détectée »** — Déclenchement unique

### Cycle de vie des aperçus

| Statut | Icône | Description |
|--------|-------|-------------|
| Nouveau | 🆕 | Vient d'être détecté, notification envoyée |
| Actif | ✅ | Affiché dans les capacités |
| Acquitté | 👀 | L'utilisateur l'a vu |
| Rejeté | 🚫 | Masqué pour 30 jours |
| Résolu | ✔️ | Action implémentée |

### Système de priorité

Les aperçus sont classés 0-100 basé sur :
- **Confiance** (30%) — Certitude du modèle
- **Potentiel d'économies d'énergie** (40%) — Estimation €/mois
- **Simplicité d'action** (20%) — Facilité d'implémentation
- **Impact immédiat** (10%) — Bénéfice rapide vs long terme

**Règle d'affichage :** Chaque catégorie a son propre capteur - tous les aperçus sont affichés en parallèle (v2.5.10)

---

## Passer à l'action

### Guide d'action étape par étape

#### Pour les aperçus d'isolation :

| Délai | Actions |
|-------|---------|
| **Immédiat** (0-1 semaine) | ✅ Activer la réduction nocturne<br/>✅ Vérifier les fuites d'air et les colmater |
| **Court terme** (1-3 mois) | ✅ Obtenir des devis pour l'isolation du toit (€3000-6000, amortissement 2-4 ans)<br/>✅ Envisager l'isolation des murs creux (€1500-3000)<br/>✅ Évaluer les fenêtres pour verre HR++ |
| **Long terme** (6-12 mois) | ✅ Planifier un package d'isolation complet<br/>✅ Vérifier les subventions (MaPrimeRénov', aides locales)<br/>✅ Calculer le ROI total avec les économies mensuelles |

#### Pour les aperçus de préchauffage :

| Délai | Actions |
|-------|---------|
| **Immédiat** | ✅ Créer un flow d'automatisation avec déclencheur `pre_heat_recommendation`<br/>✅ Tester la réduction nocturne (commencer conservateur : réduction de 2°C) |
| **Optimisation** | ✅ Affiner la réduction selon le confort<br/>✅ Ajuster le paramètre d'heure de réveil si nécessaire |

#### Pour les aperçus de stockage thermique :

| Délai | Actions |
|-------|---------|
| **Prérequis** (1-2 semaines) | ✅ S'inscrire à un contrat d'énergie dynamique<br/>✅ Installer l'application Energy Prices<br/>✅ Configurer un flow pour transmettre les prix |
| **Implémentation** | ✅ Créer l'automatisation de stockage thermique<br/>✅ Commencer conservateur (ajustements de ±1°C) |
| **Optimisation** | ✅ Augmenter le décalage de température si confortable<br/>✅ Ajuster le timing selon votre courbe de prix |

---

## Exemples de Flows

### Flow 1 : Programme de Préchauffage Automatique

```
QUAND Recommandation d'heure de préchauffage
  (se déclenche quotidiennement à 23:00 avec l'heure de démarrage optimale)

ALORS
  1. Régler la température cible à 17°C à 22:00
     (réduction nocturne - le bâtiment refroidit lentement)

  2. Régler la température cible à 21°C à {{start_time}} token
     (le préchauffage commence - calculé selon τ)

  3. Notification : « Préchauffage programmé pour {{start_time}} ({{duration_hours}}h) »
```

---

### Flow 2 : Stockage Thermique avec Tarification Dynamique

```
QUAND Bloc d'énergie le moins cher démarré
  (depuis l'application Energy Prices - typiquement 02:00-06:00)

ET Aperçu du bâtiment détecté, catégorie = « thermal_storage »

ALORS
  1. Augmenter la température cible de 2°C (stocker l'énergie thermique)
  2. Notification : « Stockage thermique : préchauffage à {{target}}°C »
```

```
QUAND Bloc d'énergie le plus cher démarré
  (typiquement 17:00-21:00)

ALORS
  1. Diminuer la température cible de 1°C (coaster sur l'énergie stockée)
  2. Notification : « Stockage thermique : coasting à {{target}}°C »
```

---

### Flow 3 : Notifications d'Aperçus Haute Priorité

```
QUAND Nouvel aperçu du bâtiment détecté

ET {{estimated_savings_eur_month}} est supérieur à 70
ET {{priority}} est supérieur à 70

ALORS
  Envoyer notification :
    « 💰 Opportunité d'économies d'énergie ! »
    « {{insight}} »
    « Action : {{recommendation}} »
    « Potentiel : €{{estimated_savings_eur_month}}/mois »
```

---

### Flow 4 : Auto-correction du Profil Inadéquat

```
QUAND Discordance du profil de bâtiment détectée

ET {{deviation_percent}} est supérieur à 40

ALORS
  1. Modifier le paramètre d'appareil "building_profile" vers {{suggested_profile}}
  2. Notification :
     "Profil du bâtiment mis à jour de {{current_profile}} à {{suggested_profile}}"
```

---

### Flow 5 : Forcer l'Analyse des Aperçus (On-Demand)

```
QUAND l'utilisateur appuie sur le bouton virtuel "Analyser le bâtiment maintenant"
  (ou quotidiennement à 08:00 pour le rapport du matin)

ALORS
  1. Forcer l'analyse des aperçus
     (action : Force insight analysis)
     Retourne : {{insights_detected}}, {{confidence}}

  2. QUAND {{insights_detected}} est supérieur à 0
     ALORS Notification :
       "Analyse du bâtiment : {{insights_detected}} aperçu(s) trouvés"
       "Fiabilité du modèle : {{confidence}}%"
```

**Use case :** Vérifier immédiatement après des changements majeurs (météo, réglages) sans attendre 50 minutes.

---

### Flow 6 : Notifier Seulement les Aperçus à Fort ROI (Condition)

```
QUAND Aperçu du bâtiment détecté

ET Économies estimées au-dessus de €100/mois
  (condition : Savings above threshold - category, €100)

ET Confiance du modèle au-dessus de 75%
  (condition : Confidence above threshold - 75%)

ALORS
  Envoyer une notification push :
    "💰 Grande opportunité d'économies !"
    "{{insight}}"
    "Action : {{recommendation}}"
    "Potentiel : €{{estimated_savings_eur_month}}/mois"
```

**Use case :** Filtrer le "bruit" des conseils - seulement les notifications pour des économies significatives avec forte certitude.

---

### Flow 7 : Stockage Thermique Seulement Quand Actif (Condition)

```
QUAND Bloc d'énergie le moins cher démarré
  (de l'app Energy Prices)

ET Aperçu de stockage thermique est actif
  (condition : Insight is active - category "thermal_storage")

ALORS
  Augmenter la température cible de 2°C
  Notification : "Stockage thermique : préchauffage actif"

SINON
  (Aucune action - stockage thermique pas possible pour ce bâtiment)
```

**Use case :** Automatisation conditionnelle - appliquer la stratégie de stockage thermique uniquement si le bâtiment est adapté.

---

## Référence des cartes Flow

### Cartes de déclenchement (3)

#### 1. Nouvel aperçu du bâtiment détecté

**Déclenche :** Quand un nouvel aperçu est détecté (≥70% confiance, max 1× par catégorie par jour)

**Tokens :**

- `category` (string) - Catégorie : insulation_performance / pre_heating / thermal_storage
- `insight` (string) - Message d'aperçu lisible
- `recommendation` (string) - Action recommandée
- `priority` (number 0-100) - Score de priorité
- `confidence` (number 0-100) - Fiabilité du modèle
- `estimated_savings_eur_month` (number) - Économies mensuelles en EUR (si applicable)

**Fréquence :** Max 1× par catégorie par 24 heures (prévention de la fatigue des conseils)

---

#### 2. Recommandation d'heure de préchauffage

**Déclenche :** Quand ΔT (cible - intérieur) > 1.5°C (max 1x par 4 heures)

**Tokens (v2.6.0) :**

- `duration_hours` (number) - Durée de préchauffage en heures
- `temp_rise` (number) - Hausse de température requise en °C
- `current_temp` (number) - Température intérieure actuelle en °C
- `target_temp` (number) - Température cible en °C
- `confidence` (number 0-100) - Fiabilité du modèle

**Conditions :** Uniquement si confiance ≥70%, max 1x par 4 heures

---

#### 3. Discordance du profil de bâtiment détectée

**Déclenche :** Une seule fois quand le comportement appris dévie significativement du profil sélectionné

**Tokens :**

- `current_profile` (string) - Profil actuel (ex : « average »)
- `suggested_profile` (string) - Profil suggéré (ex : « heavy »)
- `tau_learned` (number) - Constante de temps apprise en heures
- `tau_profile` (number) - Constante de temps du profil en heures
- `deviation_percent` (number) - Pourcentage de déviation
- `confidence` (number 0-100) - Fiabilité du modèle (min 50%)

**Conditions :** Déviation >30%, confiance ≥50%

---

### Cartes d'action (2)

#### 1. Forcer l'analyse des aperçus

**Fonction :** Déclencher une évaluation immédiate (ne pas attendre l'intervalle de 50 min)

**Retourne :**

- `insights_detected` (number) - Nombre d'aperçus détectés
- `confidence` (number) - Fiabilité actuelle du modèle

**Usage :** Analyse à la demande, débogage, rapport quotidien

---

#### 2. Calculer la durée de préchauffage (v2.6.0)

**Fonction :** Calcule le temps nécessaire pour X°C de hausse de température

**Paramètres :**

- `temperature_rise` (number) - Hausse de température souhaitée en °C (ex : 2.0)

**Retourne :**

- `preheat_hours` (number) - Durée de préchauffage en heures
- `confidence` (number) - Fiabilité du modèle (%)
- `building_tau` (number) - Constante de temps thermique τ (heures)

**Usage :** Planifier le préchauffage pour des moments spécifiques, automatisation du stockage thermique

**Exemple de flow :**
```
QUAND Bloc le moins cher approche (2 heures à l'avance)
ALORS
  1. Calculer la durée de préchauffage (temperature_rise = 2.0)
  2. IF preheat_hours < 3 THEN
       → Démarrer le préchauffage maintenant
```

---

### Cartes de condition (3)

#### 1. L'aperçu est actif

**Fonction :** Vérifier si une catégorie spécifique est actuellement active

**Paramètres :**

- `category` (liste déroulante) - Catégorie à vérifier

**Retourne :** `true` si actif ET non rejeté, sinon `false`

**Usage :** Automatisation conditionnelle (stockage thermique uniquement si aperçu actif)

---

#### 2. La confiance du modèle est au-dessus du seuil

**Fonction :** Porte de qualité pour les flows

**Paramètres :**

- `threshold` (number 0-100) - Seuil de confiance en %

**Retourne :** `true` si confiance du modèle > seuil

**Usage :** Notifications/actions uniquement à haute certitude (ex : >80%)

---

#### 3. Les économies estimées sont au-dessus du seuil

**Fonction :** Filtrage basé sur le ROI

**Paramètres :**

- `category` (liste déroulante) - Catégorie à vérifier (insulation_performance / pre_heating / thermal_storage)
- `threshold` (number 0-500) - Seuil €/mois

**Retourne :** `true` si économies mensuelles estimées > seuil

**Usage :** Filtre pour économies significatives (ex : notifier uniquement si >€100/mois)

---

## Paramètres

### Paramètres des aperçus

**Emplacement :** Paramètres de l'appareil → Aperçus & Recommandations du Bâtiment

| Paramètre | Défaut | Plage | Description |
|-----------|--------|-------|-------------|
| **Activer les Aperçus du Bâtiment** | OUI | OUI/NON | Interrupteur principal |
| **Confiance Minimale (%)** | 70% | 50-90% | Seuil pour afficher les aperçus |

> **Note (v2.6.0) :** Les paramètres `wake_time` et `night_setback_delta` ont été supprimés. Le préchauffage est maintenant calculé dynamiquement basé sur les températures intérieure/cible actuelles.

### Préchauffage Dynamique (v2.6.0)

Le système se déclenche automatiquement quand ΔT (cible - intérieur) > 1.5°C :

**Formule :**
```
Durée_préchauffage = τ × ln(ΔT / 0.3)
```

**Exemple :**
- Température cible : **21°C**
- Température intérieure : **18°C**
- τ (constante de temps) : **10 heures**
- ΔT = 21 - 18 = **3°C**

```
Durée_préchauffage = 10 × ln(3 / 0.3) = 10 × 2.30 = 23 heures → plafonné
```

**Résultats pratiques :**

| τ (heures) | ΔT 2°C | ΔT 3°C | ΔT 4°C |
|------------|--------|--------|--------|
| 4 | 0.8h | 0.9h | 1.0h |
| 10 | 1.9h | 2.3h | 2.6h |
| 15 | 2.9h | 3.5h | 3.9h |

### Paramètres recommandés par type d'utilisateur

| Type | Confiance |
|------|-----------|
| **Débutant** (premières 2 semaines) | 70% |
| **Intermédiaire** (après 1 mois) | 65% |
| **Avancé** (après 3 mois) | 60% |

---

## Dépannage

### Pas d'aperçus après 48 heures

| Cause | Solution |
|-------|----------|
| Confiance du modèle <70% | Attendre plus longtemps (jusqu'à 72 heures) ou baisser le seuil à 65% |
| Aperçus désactivés | Vérifier Paramètres de l'appareil → Activer les Aperçus du Bâtiment |
| Le bâtiment se comporte exactement comme prévu | Bonne nouvelle ! Pas d'optimisation nécessaire |
| Sources de données manquantes | S'assurer que le capteur de température intérieure externe est connecté |

### Les aperçus montrent de mauvaises estimations d'économies

| Cause | Impact | Solution |
|-------|--------|----------|
| Prix de l'énergie ≠ €0,30/kWh | Estimations proportionnelles | Multiplier par (votre prix / 0,30) |
| COP ≠ 3,5 | COP plus élevé = économies plus élevées | Les estimations sont conservatives |
| Heures de chauffage ≠ 4000h/an | Plus d'heures = économies plus élevées | Surveiller les économies réelles après 1 mois |

### La recommandation de préchauffage ne se déclenche pas

| Cause | Solution |
|-------|----------|
| Confiance du modèle <70% | Attendre l'apprentissage |
| Heure de réveil non configurée | Définir via Paramètres de l'appareil |
| Carte Flow non créée | Créer un flow avec déclencheur « Recommandation d'heure de préchauffage » |

---

## FAQ

### Q : Combien de temps dure l'apprentissage ?

**R :** Environ 1 à 2 jours pour 70% de confiance (seuil par défaut). Vous pouvez baisser à 50% pour des aperçus plus précoces (moins précis). La convergence complète prend 1-3 semaines.

### Q : Les aperçus se mettent-ils à jour si j'améliore l'isolation ?

**R :** Oui ! Le modèle apprend continuellement. Après des améliorations d'isolation, le UA devrait diminuer sur 3-7 jours. L'aperçu « mauvaise isolation » disparaît et peut être remplacé par « excellente isolation » ou « opportunité de stockage thermique ».

### Q : Et si mon bâtiment ne correspond à aucun profil ?

**R :** Les profils ne sont que des points de départ pour accélérer l'apprentissage. Après 48 heures, les paramètres appris remplacent complètement le profil.

### Q : Pourquoi mon τ (constante de temps) semble-t-il élevé/bas ?

**R :** τ dépend à la fois de la masse thermique (C) et des pertes thermiques (UA) :
- **τ élevé** (≥80h) : Bâtiment lourd (C élevé) OU excellente isolation (UA faible)
- **τ faible** (<20h) : Bâtiment léger (C faible) OU mauvaise isolation (UA élevé)

### Q : Quelle est la précision des estimations d'économies ?

**R :** La précision cible est de ±20%. Elles sont basées sur des hypothèses conservatives (COP 3,5, 4000 heures de chauffage, €0,30/kWh). Surveillez les économies réelles via Homey Energy après implémentation.

### Q : Que se passe-t-il si je modifie les paramètres de l'appareil pendant l'apprentissage ?

**R :** Impact minimal. Le modèle apprend les caractéristiques du bâtiment, pas les paramètres de la pompe à chaleur. Mais évitez :
- Changer le profil de bâtiment en cours d'apprentissage (réinitialise les paramètres)
- Réinitialiser le modèle du bâtiment (perd toutes les données apprises)
- Changements de mode fréquents (confond le modèle)
