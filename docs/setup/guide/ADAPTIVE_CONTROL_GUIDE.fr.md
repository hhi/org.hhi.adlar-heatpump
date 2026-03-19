# Adaptive Temperature Control
## Guide utilisateur v2.7.x

Régulation intelligente de la température pour une **température intérieure constante** avec une efficacité optimale.

---

## Table des matières

1. [Aperçu](#aperçu)
2. [Comment ça fonctionne ?](#comment-ça-fonctionne)
3. [Pour commencer](#pour-commencer)
4. [Flow Cards](#flow-cards)
5. [Paramètres](#paramètres)
6. [Exemples pratiques](#exemples-pratiques)
7. [Dépannage](#dépannage)
8. [Mode Expert](#mode-expert)
9. [FAQ](#faq)

---

## Aperçu

**Adaptive Control** ajuste automatiquement la température cible de votre pompe à chaleur pour maintenir une **température intérieure constante**. Le système fonctionne en collaboration avec votre thermostat ou capteur de température.

### Avantages

| Avantage | Description |
|----------|-------------|
| 🎯 **Température constante** | Reste dans ±0,3°C de votre température souhaitée |
| ⚡ **Efficacité supérieure** | L'algorithme PI évite les cycles marche/arrêt |
| 🔄 **Ajustement automatique** | Réagit aux conditions changeantes |
| 💰 **Économie d'énergie** | Jusqu'à 25% d'amélioration d'efficacité possible |

### Quand utiliser ?

- ✅ Vous avez un thermostat ou capteur de température dans le salon
- ✅ Vous voulez une température intérieure **exacte** (par ex. 21,0°C constant)
- ✅ Votre pompe à chaleur a souvent des fluctuations de température
- ✅ Vous voulez optimiser l'efficacité

---

## Comment ça fonctionne ?

Adaptive Control utilise un **système de régulation PI** (Proportional-Integral controller) — la même technologie utilisée dans les systèmes industriels professionnels.

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1️⃣ MESURER                                                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Le capteur envoie la température (par ex. 20,5°C)             │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2️⃣ COMPARER                                                         │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Souhaité: 21,0°C   Réel: 20,5°C   Écart: -0,5°C              │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3️⃣ ALGORITHME PI                                                    │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Terme P: 3,0 × -0,5 = -1,5°C                                  │  │
│  │ Terme I: correction historique                                │  │
│  │ Total: -1,5°C                                                 │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4️⃣ AJUSTER                                                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Consigne: 45°C → 43°C                                         │  │
│  │ Max 1x par 20 min │ Max ±3°C par fois                         │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │
                                   └──────────── Prochain cycle ──┐
                                                                  │
                                   ┌──────────────────────────────┘
                                   ▼
                            (Retour à MESURER)
```

### Caractéristiques

| Caractéristique | Valeur | Description |
|-----------------|--------|-------------|
| ⏱️ Intervalle de contrôle | 5 min | Fréquence d'évaluation |
| 🔒 Anti-oscillation | 20 min | Minimum entre ajustements |
| 🎯 Deadband | ±0,3°C | Zone de tolérance (pas d'action) |
| 🛡️ Limites de sécurité | ±3°C / 15-28°C | Ajustement max et plage absolue |
| 🔢 Smart Accumulator | Fractional → Integer | Collecte les petites corrections |

### Pourquoi des degrés entiers ?

La consigne de la pompe à chaleur utilise des **pas de 1°C**. Cependant, le régulateur PI calcule des ajustements fractionnaires (par ex. +0,7°C).

**Solution**: Le **Smart Accumulator** collecte les calculs fractionnaires:

```
Cycle 1: PI = +0,3°C → Accumulateur: 0,3 → Attendre
Cycle 2: PI = +0,4°C → Accumulateur: 0,7 → Appliquer +1°C, Reste: -0,3
Cycle 3: PI = +0,2°C → Accumulateur: -0,1 → Attendre
```

### Système de décision pondérée à 5 piliers (v2.6.0+)

Adaptive Control combine **5 composants intelligents** dans chaque décision:

| Composant | Poids | Fonction |
|-----------|-------|----------|
| 🛋️ **Confort** | 50% | Régulation PI pour température intérieure stable |
| ⚡ **Efficacité** | 15% | Optimisation COP via température de départ |
| 💰 **Coûts** | 15% | Optimisation des prix (préchauffage avec électricité bon marché) |
| 🏠 **Thermique** | 20% | Régulation prédictive via modèle de bâtiment appris |
| ❄️ **Coast** | 80% (si actif) | Refroidissement passif — empêche le chauffage au-dessus de la consigne |

**Exemple de calcul (normal):**

```
Confort veut: +2,0°C (trop froid)
Efficacité veut: -0,5°C (temp de départ plus basse pour meilleur COP)
Coût veut: +1,0°C (électricité bon marché, préchauffer)
Thermique veut: +0,5°C (bâtiment refroidit rapidement, chauffage anticipatif)

Total pondéré: (2,0×50% + -0,5×15% + 1,0×15% + 0,5×20%) = 1,15°C
```

**Exemple de calcul (mode coast actif):**

```
Coast veut: -4,0°C (sortie - offset) ← dominant 80%
Confort veut: -1,0°C (PI détecte dépassement)
Autres composants: mis à l’échelle par 0,20

Résultat: -3,31°C → compresseur s'arrête ✅
```

**Résultat**: La consigne augmente de +1°C (arrondi), ou diminue fortement en mode coast.

> [!NOTE]
> Les poids sont **configurables** via les paramètres de l'appareil (Mode Expert). Les valeurs par défaut sont optimisées pour la plupart des situations.

---

## Pour commencer

### Prérequis

- **Homey Pro** avec Adlar Heat Pump App v2.7.0+
- **Pompe à chaleur fonctionnelle** avec connexion stable
- **Capteur de température** (Tado, Nest, Netatmo, Fibaro, Xiaomi, etc.)

**Optionnel pour optimisation avancée (v2.7.0+):**

- ☁️ Capteur de vitesse du vent (pour correction de vent du modèle de bâtiment)
- ☀️ Capteur de rayonnement solaire (pour optimisation du gain solaire)
- 💰 Contrat d'énergie dynamique (pour optimisation des prix)

### Étape 1: Flow de données de température

Créez un flow qui envoie la température intérieure:

**Thermostat Tado:**
```
WHEN: Tado → La température a changé
THEN: Adlar Heat Pump → Envoyer température intérieure
      └─ Température: {{Tado température}}
```

**Capteur Fibaro:**
```
WHEN: Fibaro Motion Sensor → La température a changé
THEN: Adlar Heat Pump → Envoyer température intérieure
      └─ Température: {{Fibaro température}}
```

**Plusieurs capteurs (moyenne):**
```
WHEN: Minuterie toutes les 5 minutes
THEN: Adlar Heat Pump → Envoyer température intérieure
      └─ Température: {{(Capteur1 + Capteur2 + Capteur3) / 3}}
```

> [!TIP]
> Envoyez la température au minimum toutes les 10 minutes. Les données de plus de 10 minutes sont considérées comme obsolètes.

### Étape 2: Activer

1. Ouvrez **Adlar Heat Pump** → **Paramètres** ⚙️
2. Faites défiler jusqu'à **Adaptive Temperature Control**
3. Cochez: **Enable adaptive temperature control** ✅
4. Cliquez sur **Enregistrer**

### Étape 3: Vérifier

Vérifiez les points suivants:

- ✅ La capacité **External Indoor Temperature** affiche la valeur actuelle
- ✅ Flow de test: "La régulation adaptative recommande un ajustement de température" se déclenche
- ✅ Insights: le graphique montre des données de température continues

---

## Flow Cards

### Action: Envoyer température intérieure

**ID:** `receive_external_indoor_temperature`

| Paramètre | Type | Plage | Exemple |
|-----------|------|-------|---------|
| Température | Number | -10 à +50°C | `{{Tado température}}` |

---

### Trigger: Ajustement de température recommandé

**ID:** `temperature_adjustment_recommended`

Se déclenche lorsque Adaptive Control calcule un changement de consigne.

| Token | Type | Description |
|-------|------|-------------|
| `current_temperature` | Number | Consigne actuelle (°C) |
| `recommended_temperature` | Number | Consigne recommandée (°C) |
| `adjustment` | Number | Ajustement calculé |
| `reason` | String | Explication du calcul |
| `controller` | String | Type de contrôleur |
| `control_mode` | String | `heating` ou `cooldown` (v2.8.0+) |
| `coast_component` | Number | Contribution coast à la recommandation (v2.8.0+) |

> [!NOTE]
> `adjustment` est la recommandation calculée et peut être fractionnaire. L'ajustement réel est toujours un nombre entier.

**Exemple:**
```
WHEN: La régulation adaptative recommande un ajustement de température
AND: {{recommended_temperature}} - {{current_temperature}} > 2
THEN: Envoyer notification
      └─ "Recommandé: {{recommended_temperature}}°C - {{reason}}"
```

---

### Trigger: Température simulée ajustée

**ID:** `adaptive_simulation_update`

Se déclenche pour surveillance/journalisation sans ajustements réels.

| Token | Type | Description |
|-------|------|-------------|
| `simulated_target` | Number | Température cible simulée |
| `actual_target` | Number | Consigne réelle |
| `delta` | Number | Différence |
| `comfort_component` | Number | Contribution confort (°C) |
| `efficiency_component` | Number | Contribution efficacité (°C) |
| `cost_component` | Number | Contribution coûts (°C) |
| `thermal_component` | Number | Contribution modèle thermique (°C) (v2.6.0+) |
| `coast_component` | Number | Contribution coast (°C) (v2.8.0+) |
| `reasoning` | String | Raisonnement |

---

### Trigger: Changement de statut adaptatif

**ID:** `adaptive_status_change`

| Token | Type | Description |
|-------|------|-------------|
| `status` | String | `enabled` ou `disabled` |
| `reason` | String | Raison du changement |

**Exemple:**
```
WHEN: Changement de statut adaptatif
AND: Le statut est 'enabled'
THEN: Envoyer notification "✅ Contrôle adaptatif activé"
```

---

## Paramètres

### Paramètres de base

| Paramètre | Par défaut | Description |
|-----------|------------|-------------|
| Enable adaptive temperature control | Désactivé | Interrupteur principal |

### Paramètres Expert

> [!IMPORTANT]
> Les paramètres Expert ne sont visibles qu'avec **Cartes de fonction HVAC Expert** activées.

| Paramètre | Par défaut | Plage | Description |
|-----------|------------|-------|-------------|
| **Kp** (Proportional Gain) | 3,0 | 0,5 - 10,0 | Réaction directe à l'écart |
| **Ki** (Integral Gain) | 1,5 | 0,1 - 5,0 | Correction écart de longue durée |
| **Deadband** | 0,3°C | 0,1 - 1,0°C | Zone de tolérance |

**Conseils de réglage:**

| Problème | Solution |
|----------|----------|
| Oscillation/dépassement | Diminuez Kp (par ex. 3,0 → 2,0) |
| Réaction trop lente | Augmentez Kp (par ex. 3,0 → 4,0) |
| Écart structurel | Augmentez Ki (par ex. 1,5 → 2,0) |
| Trop de petites corrections | Augmentez deadband (par ex. 0,3 → 0,5) |

### Paramètres Coast (v2.8.0+)

| Paramètre | Par défaut | Plage | Description |
|-----------|------------|-------|-------------|
| **Coast Offset** | 1,0°C | 0,5 - 5,0°C | Degrés en dessous de la température de sortie pour cible coast |
| **Coast Hystérésis** | 0,3°C | 0,1 - 1,0°C | Marge de dépassement au-dessus de la consigne pour activation |
| **Coast Force** | 0,80 | 0,60 - 0,95 | Part de poids dans la décision pondérée |

---

## Exemples pratiques

### Configuration de base (Tado)

**Objectif:** 21°C constant avec thermostat Tado

```
# Flow 1: Données de température
WHEN: Tado Salon → La température a changé
THEN: Adlar Heat Pump → Envoyer température intérieure
      └─ Température: {{Tado température}}

# Flow 2: Surveillance
WHEN: La régulation adaptative recommande un ajustement de température
THEN: Log "Recommandé: {{recommended_temperature}}°C ({{reason}})"
```

**Comportement attendu:**
- 20,5°C mesuré → Consigne pompe à chaleur augmente
- 21,3°C mesuré → Consigne pompe à chaleur diminue
- En 1-2 heures: stable à 21,0°C ±0,3°C

---

### Plusieurs pièces (moyenne)

```
WHEN: Minuterie toutes les 5 minutes
THEN:
  avg_temp = ({{Salon}} + {{Cuisine}} + {{Couloir}}) / 3
  Envoyer température intérieure → {{avg_temp}}
```

**Avantage:** Évite la surréaction aux fluctuations locales (par ex. soleil sur 1 capteur)

---

### Mode Nuit/Jour

**Objectif:** 21°C le jour, 18°C la nuit

```
WHEN: L'heure est 23:00
THEN: Variable logique 'Target' = 18,0

WHEN: L'heure est 07:00
THEN: Variable logique 'Target' = 21,0

WHEN: Capteur → La température a changé
THEN: error = {{Target}} - {{Capteur}}
      adjusted = {{Capteur}} + {{error}}
      Envoyer température intérieure → {{adjusted}}
```

---

### Compensation météorologique

```
WHEN: Buienradar → La température extérieure a changé
THEN:
  IF: Temp ext < 0°C  → offset = +1,0°C
  IF: Temp ext < -5°C → offset = +2,0°C
  ELSE: offset = 0°C

  Envoyer température intérieure → {{Capteur}} + {{offset}}
```

---

## Dépannage

### ❌ "No external indoor temperature configured"

**Cause:** Aucune donnée de température reçue

**Solution:**
1. Vérifiez que le flow de température est correct
2. Déclenchez le flow manuellement pour les premières données
3. Vérifiez la capacité "External Indoor Temperature"

---

### ❌ Aucun ajustement

| Cause | Vérifier | Solution |
|-------|----------|----------|
| Dans la deadband | Écart < 0,3°C? | Comportement normal |
| Throttling actif | Logs: "Adjustment throttled" | Attendez 20 min |
| Données obsolètes | Horodatage > 10 min? | Augmentez fréquence du flow |
| Désactivé | Paramètres de l'appareil | Activer |

---

### ❌ Température oscille

**Symptôme:** La température dépasse constamment l'objectif

**Causes possibles & solutions:**

| Cause | Solution |
|-------|----------|
| Kp trop élevé | Diminuer à 2,0 |
| Ki trop élevé | Diminuer à 1,0 |
| Deadband trop petite | Augmenter à 0,5°C |
| Capteur près source de chaleur | Déplacer capteur ou utiliser moyenne |

**Approche:**
1. Commencez par diminuer Kp (plus grand impact)
2. Surveillez 24 heures
3. Ajustez Ki si nécessaire

---

### ❌ Réaction lente

**Symptôme:** Prend des heures pour atteindre l'objectif

| Cause | Solution |
|-------|----------|
| Kp trop bas | Augmenter à 4,0 ou 5,0 |
| Grande masse thermique | Augmentez Ki pour meilleure correction à long terme |
| Plage de consigne limitée | Vérifiez consigne manuelle |

---

### ❄️ La PAC chauffe à haute température de pièce (v2.8.0+)

**Symptôme:** La pièce est plus chaude que la consigne, mais la PAC continue de chauffer

| Cause | Solution |
|-------|----------|
| Coast pas encore actif | Attendre au moins 10 min (2 cycles) |
| Hystérésis trop haute | Diminuer hystérésis coast (par ex. 0,3 → 0,2°C) |
| Tendance en baisse | Coast ne s'active pas si temp est en baisse — comportement normal |

---

### ❄️ Oscillation après phase de refroidissement

**Symptôme:** La température dépasse après sortie du mode coast

| Cause | Solution |
|-------|----------|
| Terme I non réinitialisé | Redémarrer contrôle adaptatif |
| Kp trop haut après coast | Diminuer Kp à 2,0-2,5 |

---

## Mode Expert

> [!CAUTION]
> Ajustez les paramètres Expert uniquement si vous avez des problèmes mesurables et pouvez tester pendant 24-48 heures.

### Paramètres PI

#### Kp — Proportional Gain

Détermine la réaction directe à l'écart actuel.

**Formule:** `Terme P = Kp × erreur`

| Kp | Erreur -0,5°C | Effet |
|----|---------------|-------|
| 2,0 | -1,0°C | Prudent |
| 3,0 | -1,5°C | **Par défaut** |
| 5,0 | -2,5°C | Agressif |

**Sweet Spot:** 2,5 - 4,0

---

#### Ki — Integral Gain

Corrige les écarts de longue durée que le terme P ne résout pas.

**Formule:** `Terme I = Ki × (erreur moyenne dernières 2h)`

**Sweet Spot:** 1,0 - 2,0

---

#### Deadband

Zone dans laquelle aucune action n'est entreprise.

**Exemple** (objectif 21,0°C, deadband 0,3°C):
- 20,8°C: Dans la zone → Pas d'action ✅
- 21,2°C: Dans la zone → Pas d'action ✅
- 21,4°C: Hors zone → Action ⚡

**Sweet Spot:**
- **Confort:** 0,2 - 0,4°C
- **Efficacité:** 0,4 - 0,6°C

---

### Stratégie de réglage

#### Phase 1: Baseline (semaine 1)
- Utilisez les valeurs par défaut
- Surveillez 7 jours via Homey Insights
- Notez: oscillation? trop lent? dépassement?

#### Phase 2: Ajuster Kp (semaine 2)
- **Oscillation:** Diminuez 20% (3,0 → 2,4)
- **Trop lent:** Augmentez 30% (3,0 → 3,9)
- Testez 3 jours

#### Phase 3: Ajuster Ki (semaine 3)
- **Structurellement trop froid/chaud:** Augmentez 20%
- **Oscillation lente:** Diminuez 30%
- Testez 5 jours

#### Phase 4: Deadband (semaine 4)
- **Trop de petits ajustements:** +0,1°C
- **Trop grandes fluctuations:** -0,1°C

---

### Problèmes avancés

#### "Hunting Behavior"

**Symptôme:** Oscillation avec période 1-3 heures

```
19:00 → 20,5°C → Ajustement +2,0°C
20:00 → 21,5°C → Ajustement -1,5°C
21:00 → 20,7°C → Ajustement +1,0°C
...
```

**Solution:**
1. Diminuez Kp de 30%
2. Augmentez deadband à 0,4-0,5°C
3. Diminuez Ki de 20%

---

#### "Integral Windup"

**Symptôme:** Grande surcorrection après écart de longue durée

**Solution:**
1. Diminuez Ki de 40%
2. Vérifiez facteurs externes (soleil, fenêtre ouverte)
3. Réinitialisez terme I: contrôle adaptatif off/on

---

## FAQ

### Général

**Dois-je laisser Adaptive Control activé 24/7?**
> Oui, le système apprend de l'historique et performe mieux plus il fonctionne longtemps.

**Fonctionne-t-il avec chauffage au sol?**
> Oui, mais attendez-vous à une réponse plus lente (6-12h). Utilisez Ki plus élevé, Kp plus bas.

**Fonctionne-t-il avec radiateurs?**
> Oui, réponse plus rapide (1-3h). Les valeurs par défaut sont optimisées pour cela.

**Puis-je contrôler plusieurs zones?**
> Un contrôle adaptatif par pompe à chaleur. Pour plusieurs zones: utilisez moyenne des capteurs.

---

### Technique

**Que se passe-t-il au redémarrage de Homey?**
> Adaptive Control redémarre automatiquement avec l'historique sauvegardé. Premier contrôle dans les 5 minutes.

**Que se passe-t-il si le capteur de température tombe en panne?**
> Après 10 minutes, Adaptive Control se met en pause. La pompe à chaleur revient à la consigne manuelle.

**Puis-je ajuster le throttling de 20 minutes?**
> Non, c'est une valeur de sécurité fixe.

---

### Confidentialité & Sécurité

**Les données sont-elles envoyées vers le cloud?**
> Non, tous les calculs sont effectués localement sur Homey.

**Quelles sont les limites de sécurité?**
> Plage absolue: 15-28°C. Max par ajustement: ±3°C. Codé en dur pour la sécurité.

**Adaptive Control peut-il endommager la pompe à chaleur?**
> Non, le throttling de 20 minutes empêche les cycles marche/arrêt excessifs.

---
