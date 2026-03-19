# Pompe à Chaleur Adlar — Système de Contrôle Adaptatif

**Version :** 2.8.x | **Date :** Mars 2026

---

## Aperçu

Ce système contrôle intelligemment votre pompe à chaleur Adlar Castra pour :

- **Température intérieure constante** (±0.3°C)
- **Mode de refroidissement passif** (coast) — empêche le chauffage inutile
- **Optimisation énergétique** via prix dynamiques
- **Maximisation du COP** pour une efficacité maximale
- **Apprentissage automatique** de la réponse de votre maison

### Économies Estimées

| Composant | Économies/an |
|-----------|--------------|
| Optimisation du Prix de l'Énergie | 400-600€ |
| Optimisation COP | 200-300€ |
| **Total** | **600-900€** |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           HOMEY PRO                                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │          Adlar Heat Pump Device - Main Controller             │  │
│  └─────────────────────────────┬─────────────────────────────────┘  │
│                                │                                    │
│        ┌───────────┬───────────┼───────────┬───────────┬───────────┐  │
│        │           │           │           │           │           │  │
│        ▼           ▼           ▼           ▼           ▼           │  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│  │  Comfort  │ │ Building  │ │  Energy   │ │    COP    │ │ Thermique │ │
│  │  Control  │ │  Learner  │ │ Optimizer │ │ Optimizer │ │  Model    │ │
│  │    50%    │ │   Info    │ │    15%    │ │    15%    │ │    20%    │ │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ │
│        │             │             │             │                  │
└────────┼─────────────┼─────────────┼─────────────┼──────────────────┘
         │             │             │             │
         ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       POMPE À CHALEUR                               │
│  ┌───────────────────┐  ┌───────────────────────────────────────┐   │
│  │ DPS 4:            │  │ DPS 21/22: Départ/Retour              │   │
│  │ Temp Cible        │  │ DPS 26: Temp Extérieure               │   │
│  └───────────────────┘  └───────────────────────────────────────┘   │
│  ┌───────────────────┐                                              │
│  │ DPS 13:           │                                              │
│  │ Courbe Chauffe=OFF│                                              │
│  └───────────────────┘                                              │
└─────────────────────────────────────────────────────────────────────┘
         ▲
         │
┌─────────────────────────────────────────────────────────────────────┐
│                       DONNÉES EXTERNES                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │
│  │Temp Intérieure│  │ Prix Énergie  │  │   API Météo   │            │
│  └───────────────┘  └───────────────┘  └───────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

### Boucle de Contrôle (toutes les 5 min)

1. **Collecter les données** — Temp intérieure/extérieure, puissance, prix
2. **Détection de refroidissement** — Tist > Tsoll + hystérésis ? → Mode coast
3. **Calculer les contrôleurs** — Chaque composant fournit des conseils
4. **Décision pondérée** — 50% confort + 15% efficacité + 15% coût + 20% thermique (+ 80% coast si actif)
5. **Exécuter** — Mettre à jour la température cible (DPS 4)

---

## Composant 1 : Contrôleur de Chauffage

### Contrôleur PI

Le **contrôleur PI (Proportionnel-Intégral)** combine :

| Composant | Fonction | Formule |
|-----------|----------|---------|
| **P** (Proportionnel) | Corriger la déviation actuelle | `Kp × erreur` |
| **I** (Intégral) | Éliminer la déviation structurelle | `Ki × erreur_moyenne` |

**Correction totale :** `(Kp × erreur_actuelle) + (Ki × erreur_moyenne)`

### Paramètres

| Paramètre | Défaut | Plage | Effet |
|-----------|--------|-------|-------|
| Kp | 3.0 | 1.0-5.0 | Vitesse de réponse |
| Ki | 1.5 | 0.5-3.0 | Correction long terme |
| Bande morte | 0.3°C | 0.1-1.0°C | Zone de tolérance |
| Attente min | 20 min | 10-60 min | Anti-oscillation |

### Profils de Réglage

| Profil | Kp | Ki | Bande morte | Cas d'Usage |
|--------|----|----|-------------|-------------|
| Agressif | 4.0-5.0 | 2.0-3.0 | 0.2°C | Mauvaise isolation |
| **Équilibré** | 3.0 | 1.5 | 0.3°C | **Recommandé** |
| Conservateur | 2.0 | 1.0 | 0.5°C | Bonne isolation |

---

## Composant 5 : Stratégie Coast (Mode de Refroidissement Passif)

> Nouveau dans v2.8.0 — [ADR-024](../../../plans/decisions/ADR-024-adaptive-cooldown-mode.md)

### Que fait-il ?

Lorsque la température de la pièce est **au-dessus de la consigne** (par ex. en raison d'apports solaires), le système détecte cela et **empêche le chauffage inutile**. La pompe à chaleur reste éteinte pendant que la pièce refroidit passivement au niveau souhaité.

### Comment ça marche ?

| Étape | Description |
|-------|--------------|
| 1️⃣ **Détection** | Tist > Tsoll + hystérésis (défaut 0.3°C) |
| 2️⃣ **Confirmation** | Au moins 2 mesures consécutives (~10 min) |
| 3️⃣ **Vérification tendance** | Température en hausse ou stable (pas en baisse) |
| 4️⃣ **Coast actif** | Température cible → en dessous de la température d'eau actuelle |
| 5️⃣ **Sortie** | Quand Tist < Tsoll + hystérésis/2 → retour au chauffage |

### Poids dans la Décision

La stratégie coast reçoit un **poids dominant** (défaut 80%) dans la décision pondérée :

```
En mode coast actif :
  Coast :    80%  (dominant — empêche le chauffage)
  Confort :  10%  (PI — aussi négatif, renforce le coast)
  Thermique : 4%  (correction du vent, négligeable)
  Autre :     6%  (COP + prix)
```

> [!NOTE]
> Le contrôleur PI est **réinitialisé** (terme I effacé) en quittant le mode coast pour éviter un biais.

### Réglages

| Réglage | Défaut | Effet |
|---------|--------|-------|
| Coast Offset | 1°C | Degrés en dessous de la température de sortie pour cible coast |
| Coast Hystérésis | 0.3°C | Marge de dépassement au-dessus de la consigne pour activation |
| Coast Force | 0.80 | Part de poids dans la décision pondérée |

---

## Composant 2 : Apprentissage du Modèle de Bâtiment

### Paramètres Appris

| Paramètre | Symbole | Unité | Valeur typique |
|-----------|---------|-------|----------------|
| Masse thermique | C | kWh/°C | 10-25 |
| Perte de chaleur | UA | kW/°C | 0.1-0.4 |
| Facteur gain solaire | g | - | 0.3-0.6 |
| Chaleur interne | P_int | kW | 0.2-0.5 |
| Correction du vent | W_corr | - | 0.03-0.12 |
| Constante de temps | τ | heure | 4-16 |

### Apprentissage Automatique : RLS

Le système utilise les **Moindres Carrés Récursifs** (RLS) :

- ✅ Apprend en temps réel pendant l'utilisation
- ✅ S'adapte aux saisons
- ✅ Léger en calcul (fonctionne sur Homey)
- ✅ Fournit un indicateur de confiance

**Progression de l'apprentissage :**

| Période | Confiance | Prédiction |
|---------|-----------|------------|
| Jour 1 | 25% | ±2°C |
| Jour 3 | 45% | ±1°C |
| Semaine 1 | 72% | ±0.5°C |
| Semaine 4 | 91% | ±0.2°C |

### Catégories de Type de Bâtiment

| Type | C (kWh/°C) | UA (kW/°C) | τ (heure) |
|------|------------|------------|-----------|
| Léger (bois/préfabriqué) | 5-8 | 0.35-0.45 | 2-4 |
| Moyen (maison NL) | 10-15 | 0.25-0.35 | 4-8 |
| Lourd (béton) | 15-25 | 0.15-0.25 | 8-16 |
| Maison passive | 25-40 | <0.05 | 16-48 |

---

## Composant 3 : Optimiseur de Prix de l'Énergie

### Catégories de Prix

| Catégorie | Seuil | Action | Décalage |
|-----------|-------|--------|----------|
| Très Bas | ≤0.04€/kWh | Préchauffage MAX | +1.5°C |
| Bas | ≤0.06€/kWh | Préchauffage | +0.75°C |
| Normal | ≤0.10€/kWh | Maintenir | 0°C |
| Élevé | ≤0.12€/kWh | Réduire | -0.5°C |
| Très Élevé | >0.12€/kWh | Réduire MAX | -1.0°C |

> [!NOTE]
> Les seuils sont basés sur les percentiles des prix spot 2024.

### Modes de Calcul des Coûts

| Mode | Formule |
|------|---------|
| Prix du marché | Spot + TVA |
| Prix du marché+ | Spot + marge + TVA |
| **Tout compris** | Spot + marge + taxe + TVA |

### Exemple d'Économies

```
SANS optimisation : 18€/jour
AVEC optimisation : 10€/jour
─────────────────────────────
Économies :         8€/jour = ~2 900€/an (max)
Réaliste :          400-600€/an
```

---

## Composant 4 : Contrôleur COP

### Qu'est-ce que le COP ?

**COP = Production de Chaleur / Consommation Électrique**

| COP | Signification | Coût (0.25€/kWh) |
|-----|---------------|------------------|
| 2.0 | Mauvais | 0.25€/heure pour 4kW |
| 3.5 | Bon | 0.14€/heure pour 4kW |
| 5.0 | Excellent | 0.10€/heure pour 4kW |

> [!IMPORTANT]
> Différence entre COP 2.0 et 5.0 = **2.5× moins cher !**

### Facteurs Affectant le COP

| Facteur | Effet | Optimisation |
|---------|-------|--------------|
| Différence de temp | Plus grande = COP plus bas | Temp départ plus basse |
| Temp extérieure | Plus chaud = COP plus élevé | Préchauffage par temps doux |
| Temp de départ | Plus basse = COP plus élevé | Temp minimale nécessaire |

### Analyse Multi-Horizon

L'application utilise des capacités COP intégrées :

| Capacité | Horizon | Utilisation |
|----------|---------|-------------|
| `adlar_cop` | Temps réel | Ajustements directs |
| `adlar_cop_daily` | Moyenne 24h | Modèle journalier |
| `adlar_cop_weekly` | Moyenne 7j | Tendances |
| `adlar_cop_monthly` | Moyenne 30j | Saison |
| `adlar_scop` | Saison (EN 14825) | Annuel |

### Zones d'Efficacité

| Zone | COP | Action |
|------|-----|--------|
| 🟢 Excellent | ≥4.0 | Maintenir |
| 🟢 Bon | 3.5-4.0 | Maintenir |
| 🟡 Acceptable | 3.0-3.5 | Surveiller |
| 🟠 Modéré | 2.5-3.0 | Optimiser |
| 🔴 Mauvais | <2.5 | **Urgent !** |

---

## Intégration Système

### Priorités & Pondérations

Les facteurs de pondération sont **configurables** via Paramètres de l'Appareil → Facteurs de Pondération du Contrôle Adaptatif :

| Priorité | Défaut | Plage | Fonction |
|----------|--------|-------|----------|
| **Confort** | 50% | 0-100% | Poids pour contrôle de température PI |
| **Efficacité** | 15% | 0-100% | Poids pour optimisation COP |
| **Coût** | 15% | 0-100% | Poids pour optimisation des prix |
| **Thermique** | 20% | 0-100% | Poids pour modèle thermique |

> [!NOTE]
> Les valeurs sont automatiquement normalisées à 100% au total.

### Résolution de Conflits

**Exemple :**
```
Contrôleur Confort : "Augmenter +2°C" (trop froid !)
Optimiseur COP :     "Diminuer -1°C" (mauvais COP)
Optimiseur Prix :    "Diminuer -1°C" (prix élevé)
Modèle Thermique :   "Augmenter +0.5°C" (prédiction)

Calcul :
+2.0 × 0.50 = +1.00°C
-1.0 × 0.15 = -0.15°C
-1.0 × 0.15 = -0.15°C
+0.5 × 0.20 = +0.10°C
─────────────────────
Total :    +0.80°C
```

### Exemple : Mode Coast Actif

```
Contrôleur Confort : "Diminuer -1°C" (PI détecte dépassement)
Optimiseur COP :     "Diminuer -0.5°C" (départ plus bas = COP plus élevé)
Optimiseur Prix :    "Maintenir 0°C" (prix normal)
Modèle Thermique :   "Augmenter +0.3°C" (correction du vent)
Stratégie Coast :    "Diminuer -4°C" (cible coast = sortie - offset)

Calcul (avec force coast = 0.80) :
-4.0 × 0.80       = -3.20°C  (coast dominant)
-1.0 × 0.50 × 0.20 = -0.10°C  (confort mis à l'échelle)
-0.5 × 0.15 × 0.20 = -0.02°C  (COP mis à l'échelle)
 0.0 × 0.15 × 0.20 =  0.00°C  (prix mis à l'échelle)
+0.3 × 0.20 × 0.20 = +0.01°C  (thermique mis à l'échelle)
───────────────────────────────
Total :            -3.31°C → Consigne << P111 → compresseur s'arrête ✅
```

### Règles de Priorité

1. **Sécurité d'abord** — Hors de la plage 15-28°C : ignorer tout
2. **Minimum Confort** — Trop froid : 100% priorité confort
3. **Opportunité Efficacité** — Marge + faible COP : augmenter poids COP

---

## Installation & Configuration

### Démarrage Rapide (5 minutes)

1. **Installer l'app** sur Homey Pro
2. **Configurer le capteur externe** (thermostat)
3. **Courbe de chauffe → OFF** (l'app le fait automatiquement)
4. **Attendre 48-72 heures** pour les premiers résultats
5. **Activer les optimisations** après 1 semaine

### Phases d'Installation

| Phase | Jour | Action | Attendu |
|-------|------|--------|---------|
| Apprentissage | 1-3 | Collecter les données | 30-50% confiance |
| Base | 3-7 | Contrôle Adaptatif ON | Temp stable |
| Complet | 10+ | COP + Prix ON | Toutes optimisations |

### Configuration

````carousel
```json
// Contrôleur de Chauffage
{
  "adaptive_control_enabled": true,
  "target_temperature": 20,
  "control_deadband": 0.3,
  "control_kp": 3.0,
  "control_ki": 1.5,
  "min_wait_between_changes": 20
}
```
<!-- slide -->
```json
// Optimiseur d'Énergie
{
  "price_optimizer_enabled": true,
  "price_calculation_mode": "all_in",
  "price_threshold_very_low": 0.04,
  "price_threshold_low": 0.06,
  "price_threshold_normal": 0.10,
  "price_threshold_high": 0.12,
  "price_max_preheat_offset": 1.5
}
```
<!-- slide -->
```json
// Contrôleur COP
{
  "cop_optimizer_enabled": true,
  "cop_min_acceptable": 2.5,
  "cop_target": 3.5,
  "cop_strategy": "balanced"
}
```
<!-- slide -->
```json
// Stratégie Coast (Mode de Refroidissement Passif)
{
  "adaptive_cooldown_offset": 1.0,
  "adaptive_cooldown_hysteresis": 0.3,
  "adaptive_cooldown_strength": 0.80
}
```
````

---

## Exemples de Flux

### Basique : Notification

```
QUAND : Consigne ajustée automatiquement
ALORS : Envoyer notification
        "🌡️ Cible : {{old}}°C → {{new}}°C"
```

### Avancé : Arrivée GPS à la Maison

```
QUAND : Quelqu'un arrive à la maison
SI : Tout le monde était absent ET Temp actuelle < 19°C
ALORS : Définir cible adaptative à 20°C
        Envoyer notification "🏠 Préchauffage démarré"
```

### Optimisation des Prix

```
QUAND : L'heure est 23:00
SI : Prix actuel < 0.08€/kWh
     ET Prix demain 07:00 > 0.30€/kWh
     ET Bâtiment τ > 6 heures
ALORS : Définir cible +1.5°C (préchauffage)
        Envoyer notification "⚡💰 Préchauffage"
```

### Rapport COP Multi-Horizon

```
QUAND : L'heure est Dimanche 20:00
ALORS : Obtenir métriques COP
        Envoyer notification :
        "📈 Rapport COP Hebdomadaire
         Actuel : {{adlar_cop}}
         Journalier : {{adlar_cop_daily}}
         Hebdo : {{adlar_cop_weekly}}
         SCOP : {{adlar_scop}}"
```

---

## Dépannage

### Problèmes Courants

| Problème | Cause | Solution |
|----------|-------|----------|
| "Courbe de chauffe non OFF" | Modifié manuellement | Paramètres → Réinitialiser Mode Contrôle |
| Temp ne répond pas | Problèmes capteur externe | Vérifier connexion capteur |
| Confiance modèle basse | Données incohérentes | Attendre plus longtemps ou réinitialiser modèle |
| Pas de données prix | Problèmes API | Vérifier connexion internet |
| COP irréaliste | PAC en transition | Attendre 24h pour stabilisation |
| PAC chauffe à haute temp pièce | Coast non actif | Vérifier réglage hystérésis, attendre 10 min |
| Oscillation après refroidissement | Biais terme I | Réinitialisation coast exit ne fonctionne pas → redémarrer contrôle adaptatif |

### Problèmes de Réglage

| Symptôme | Ajustement |
|----------|------------|
| Oscille trop | Augmenter bande morte, baisser Kp |
| Répond trop lentement | Diminuer bande morte, augmenter Kp |
| Structurellement trop froid/chaud | Augmenter Ki |
| Trop de petites corrections | Augmenter min_wait |

### Mode Debug

```bash
# Activer via Paramètres → Niveau de Log → DEBUG

# Fournit des logs supplémentaires :
# - Statut contrôleur toutes les 5 min
# - Mises à jour RLS et erreurs de prédiction
# - Calculs COP
# - Décisions catégorie de prix
```

---

## Annexe : Détails Techniques

### Mapping DPS

| DPS | Capacité | Description |
|-----|----------|-------------|
| 4 | `target_temperature` | Température cible (contrôle direct) |
| 13 | `adlar_enum_countdown_set` | Courbe de chauffe (**DOIT être OFF !**) |
| 21 | `measure_temperature.temp_top` | Température de départ |
| 22 | `measure_temperature.temp_bottom` | Température de retour |
| 26 | `measure_temperature.around_temp` | Température extérieure |
| 27 | `adlar_state_compressor_state` | État compresseur |

> [!CAUTION]
> Ne **JAMAIS** modifier manuellement la courbe de chauffe (DPS 13) ! Elle doit toujours être sur OFF pour le contrôle adaptatif.

### Formules

**Bilan Thermique :**
```
dT/dt = (1/C) × [P_chauffage - UA×(T_int - T_ext) + P_solaire + P_interne]
```

**Calcul COP :**
```
COP = Q_thermique / P_électrique
Q_thermique = ṁ × c_p × ΔT
```

**Contrôleur PI :**
```
Correction = (Kp × erreur_actuelle) + (Ki × erreur_moyenne)
```

### Métriques de Performance

| Métrique | Cible | Typique |
|----------|-------|---------|
| Stabilité Temp | ±0.3°C | ±0.2°C |
| Temps de Réponse | <30 min | 15-20 min |
| Amélioration COP | +20% | +25-35% |
| Réduction Coûts | 30% | 35-45% |
| Économies annuelles | 500€ | 600-800€ |

---
