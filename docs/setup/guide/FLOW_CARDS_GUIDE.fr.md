# Guide d'Implémentation des Cartes Flow (v1.0.7)

Ce guide documente les cartes flow nouvellement implémentées dans la version 1.0.7, offrant des exemples pratiques, des conseils de configuration et de l'aide au dépannage.

---

## Aperçu

La version 1.0.7 introduit **5 nouvelles cartes flow** qui comblent des lacunes fonctionnelles critiques identifiées lors de l'audit complet des cartes flow :

| Carte Flow | Type | Catégorie | Priorité |
|-----------|------|-----------|----------|
| `fault_detected` | Déclencheur | Sécurité appareil | 🔴 Critique |
| `power_threshold_exceeded` | Déclencheur | Gestion énergie | 🔴 Critique |
| `total_consumption_milestone` | Déclencheur | Suivi objectifs | 🔴 Critique |
| `cop_efficiency_check` | Condition | Performance | 🔴 Critique |
| `daily_cop_above_threshold` | Condition | Performance | 🔴 Critique |
| `monthly_cop_above_threshold` | Condition | Performance | 🔴 Critique |

De plus, **1 carte flow existante** a été vérifiée comme prête pour la production :
- `temperature_differential` (Condition) - Santé système ✅

---

## Déclencheurs

### 1. 🚨 Défaut détecté

**ID** : `fault_detected`
**Catégorie** : Sécurité appareil
**Quand ça se déclenche** : Quand la pompe à chaleur signale un défaut système (DPS 15 > 0)

#### Configuration

```yaml
QUAND : Code défaut [fault_code] détecté
```

**Paramètres** :
- `fault_code` (plage 1-100) : Code défaut spécifique à surveiller
  - Laisser vide pour déclencher sur N'IMPORTE QUEL défaut
  - Spécifier le code (ex : 3) pour déclencher uniquement sur ce défaut

**Tokens disponibles** :
- `fault_code` (number) : Le numéro du code défaut
- `fault_description` (string) : Description lisible dans votre langue

#### Codes défaut supportés

| Code | Français | English |
|------|----------|---------|
| 0 | Pas de défaut | No fault |
| 1 | Protection haute pression | High pressure protection |
| 2 | Protection basse pression | Low pressure protection |
| 3 | Surchauffe compresseur | Compressor overheating |
| 4 | Température de refoulement trop élevée | Discharge temperature too high |
| 5 | Défaut capteur débit d'eau | Water flow sensor fault |
| 6 | Défaut capteur température entrée | Inlet temperature sensor fault |
| 7 | Défaut capteur température sortie | Outlet temperature sensor fault |
| 8 | Défaut capteur température ambiante | Ambient temperature sensor fault |
| 9 | Défaut capteur température serpentin | Coil temperature sensor fault |
| 10 | Protection faible débit d'eau | Low water flow protection |
| 11 | Protection antigel active | Antifreeze protection active |
| 12 | Perte de phase ou phase inversée | Phase loss or reverse phase |
| 13 | Erreur de communication | Communication error |
| 14 | Défaut vanne EEV | EEV valve fault |
| 15 | Pression système anormale | System pressure abnormal |

#### Exemples de Flows

**Notification défaut critique** :
```
QUAND : Défaut détecté
  ET fault_code est 1, 2, 3 ou 4
ALORS : Envoyer notification "Défaut critique pompe à chaleur : {{fault_description}}"
  ET Éteindre l'appareil
  ET Envoyer email à la maintenance
```

**Auto-récupération défaut capteur** :
```
QUAND : Défaut détecté
  ET fault_code est 6, 7, 8 ou 9
ALORS : Attendre 5 minutes
  ET Redémarrer l'appareil
  ET Vérifier si défaut résolu
```

#### Détails techniques

- **Détection** : Surveille DPS 15 (capability `adlar_fault`)
- **Logique de déclenchement** : Ne déclenche que sur les **nouveaux** défauts (détection de changement)
- **Déduplication** : Le même code défaut ne redéclenchera pas jusqu'à résolution (code revient à 0)
- **Support linguistique** : Descriptions des défauts automatiquement localisées (EN/NL/FR)
- **Performance** : Aucun overhead quand pas de défaut présent

---

### 2. ⚡ Seuil de puissance dépassé

**ID** : `power_threshold_exceeded`
**Catégorie** : Gestion de l'énergie
**Quand ça se déclenche** : Quand la consommation électrique dépasse le seuil configuré

#### Configuration

```yaml
QUAND : Consommation électrique dépassée [threshold] W
```

**Paramètres** :
- `threshold` (100-10000W) : Seuil de puissance en watts
  - Défaut : 3000W
  - Recommandé : Régler à 120% du maximum normal

**Tokens disponibles** :
- `current_power` (number) : Consommation électrique actuelle en watts
- `threshold_power` (number) : Le seuil configuré

#### Fonctionnalités intelligentes

**Protection par hystérésis** (5%) :
- Une fois déclenché à 3000W, doit descendre sous 2850W pour se réinitialiser
- Empêche le spam de déclenchement lors des oscillations de puissance

**Limitation de débit** (5 minutes) :
- Maximum 1 déclenchement par 5 minutes
- Empêche l'inondation de notifications lors d'une surcharge soutenue

#### Exemples de Flows

**Alerte haute consommation** :
```
QUAND : Seuil de puissance dépassé 3500W
ALORS : Envoyer notification "Haute consommation électrique : {{current_power}}W"
  ET Journaliser dans Google Sheets avec horodatage
```

**Protection contre surcharge** :
```
QUAND : Seuil de puissance dépassé 4500W
ALORS : Diminuer la température cible de 2°C
  ET Attendre 5 minutes
  ET Vérifier si puissance descendue sous 4000W
```

---

### 3. 🎯 Jalon de consommation totale

**ID** : `total_consumption_milestone`
**Catégorie** : Suivi des objectifs
**Quand ça se déclenche** : Quand la consommation d'énergie cumulée atteint des jalons de 100 kWh

#### Configuration

```yaml
QUAND : Consommation totale atteinte [milestone] kWh
```

**Paramètres** :
- `milestone` (100-50000 kWh) : Valeur du jalon
  - Auto-déclenchement à : 100, 200, 300, ..., 1000, 1100, etc.
  - **Incrément** : Fixé à des paliers de 100 kWh

**Tokens disponibles** :
- `total_consumption` (number) : Consommation totale actuelle en kWh
- `milestone_value` (number) : Le jalon atteint

#### Comportement des jalons

**Rattrapage initial** :
Si vous installez l'application avec une consommation existante (ex : 523 kWh) :
- Déclenchera pour TOUS les jalons : 100, 200, 300, 400, 500
- C'est intentionnel pour rattraper les jalons manqués
- Les jalons suivants déclenchent normalement (uniquement les nouveaux)

**Déduplication** :
- Chaque jalon ne déclenche qu'une seule fois (jamais)
- Suivi dans le stockage de l'appareil : `triggered_energy_milestones`
- Survit aux redémarrages et mises à jour de l'application
- Peut être réinitialisé manuellement si nécessaire

---

## Conditions

### 4. 🎯 Vérification d'efficacité COP

**ID** : `cop_efficiency_check`
**Catégorie** : Surveillance des performances
**Quand c'est vrai** : Quand le COP actuel dépasse le seuil ET que le compresseur tourne

#### Configuration

```yaml
SI : L'efficacité COP est au-dessus/en-dessous de [threshold]
```

**Paramètres** :
- `threshold` (1.0-8.0) : Valeur seuil COP
  - Défaut : 2.0
  - Plage typique : 2.5-4.5 pour les pompes à chaleur
  - Excellent : > 4.0, Bon : 3.0-4.0, Faible : < 2.5

#### Comportement intelligent

**Vérification de l'état du compresseur** :
- **Retourne `false` quand le compresseur est au repos** (même si COP > seuil)
- Pourquoi ? COP=0 au repos est techniquement correct mais trompeur dans les flows
- Empêche les faux positifs dans les flows "SI COP < 2.0"

---

### 5. 📊 COP journalier au-dessus du seuil

**ID** : `daily_cop_above_threshold`
**Catégorie** : Surveillance des performances
**Quand c'est vrai** : Quand la moyenne glissante COP sur 24h dépasse le seuil

#### Configuration

```yaml
SI : Le COP journalier est au-dessus/en-dessous de [threshold]
```

**Paramètres** :
- `threshold` (1.0-8.0) : Seuil COP journalier
  - Défaut : 2.5
  - Recommandé : 3.0 pour une bonne performance quotidienne

#### Exemples de Flows

**Rapport de performance quotidien** :
```
CHAQUE JOUR à 23:59 :
SI : COP journalier au-dessus de 3.0
ALORS : Envoyer notification "Bonne efficacité quotidienne : {{adlar_cop_daily}}"
SINON : Envoyer notification "En-dessous de l'objectif : {{adlar_cop_daily}} (objectif : 3.0)"
```

---

### 6. 📈 COP mensuel au-dessus du seuil

**ID** : `monthly_cop_above_threshold`
**Catégorie** : Performance long terme
**Quand c'est vrai** : Quand la moyenne glissante COP sur 30 jours dépasse le seuil

#### Configuration

```yaml
SI : Le COP mensuel est au-dessus/en-dessous de [threshold]
```

**Paramètres** :
- `threshold` (1.0-8.0) : Seuil COP mensuel
  - Défaut : 3.0
  - Objectif : > 3.5 pour une excellente performance saisonnière

---

### 7. ✅ Différentiel de température

**ID** : `temperature_differential`
**Catégorie** : Santé système
**Statut** : ✅ **Prêt pour production depuis v0.99** (vérifié en v1.0.7)

#### Configuration

```yaml
SI : Le différentiel de température est au-dessus/en-dessous de [differential]°C
```

**Paramètres** :
- `differential` (1-50°C) : Seuil de différence de température
  - Typique : 5-10°C pour un fonctionnement efficace
  - Trop bas (< 3°C) : Mauvais transfert thermique
  - Trop élevé (> 15°C) : Problèmes de débit possibles

---

## Actions

### 8. 🕐 Calculer valeur depuis planning horaire

**ID** : `calculate_time_based_value`
**Catégorie** : Automatisation basée sur le temps
**Objectif** : Évaluer l'heure actuelle par rapport aux plannings quotidiens pour calculer les valeurs de sortie

#### Configuration

```yaml
ACTION : Calculer valeur depuis planning horaire
  Planning : 06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, 23:00-06:00: 18
  Retourne : {{result_value}}
```

**Paramètres** :

- `schedule` (texte) : Chaîne de définition du planning (séparée par virgules ou retours à la ligne)

**Retourne** :

- `result_value` (number) : Valeur de sortie calculée basée sur l'heure actuelle

#### Format du planning

**Syntaxe** : `HH:MM-HH:MM: valeur_sortie`

**Fonctionnalités** :
- Supporte les **plages de nuit** (ex : `23:00-06:00` traverse minuit)
- Maximum **30 plages horaires** par planning
- Support du **fallback par défaut** (`default: valeur`)

#### Exemples de Flows

**Programmation température quotidienne** :
```
TOUTES LES 5 MINUTES :
ALORS : Calculer valeur depuis planning horaire
      Planning : 06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, 23:00-06:00: 18
  ET Régler température cible sur {{result_value}}
```

---

### 9. 🌡️ Obtenir le mode saisonnier

**ID** : `get_seasonal_mode`
**Catégorie** : Automatisation saisonnière
**Objectif** : Détecter automatiquement la saison de chauffage/refroidissement basée sur la date actuelle

#### Configuration

```yaml
ACTION : Obtenir le mode saisonnier
  Retourne 4 tokens :
    - {{mode}} - "heating" ou "cooling"
    - {{is_heating_season}} - true/false
    - {{is_cooling_season}} - true/false
    - {{days_until_season_change}} - nombre
```

#### Définitions des saisons

**Saison de chauffage** : 1er octobre - 15 mai (227 jours)
- Aligné sur le **standard EN 14825 SCOP**
- Saison de chauffage européenne typique

**Saison de refroidissement** : 16 mai - 30 septembre (138 jours)
- Période intermédiaire + été

#### Exemples de Flows

**Changement automatique de planning** :
```
CHAQUE JOUR à 00:00 :
ALORS : Obtenir le mode saisonnier
  ET SI {{is_heating_season}} est vrai
    ALORS : Activer planning hivernal (températures élevées)
    SINON : Activer planning estival (températures plus basses)
```

---

### 10. 📊 Calculer valeur depuis courbe

**ID** : `calculate_curve_value`
**Catégorie** : Optimisation dynamique
**Objectif** : Calculer des valeurs de sortie basées sur des conditions d'entrée utilisant des courbes configurables

#### Aperçu

Le calculateur de courbe est un outil puissant pour les calculs de valeurs dynamiques. Principalement conçu pour le **chauffage compensé en fonction de la météo** (température extérieure → consigne de chauffage), il est suffisamment polyvalent pour tout scénario de mapping entrée-sortie.

#### Configuration

```yaml
ACTION : Calculer valeur depuis courbe
  Valeur d'entrée : {{outdoor_temperature}}
  Définition de courbe : < 0 : 55, < 5 : 50, < 10 : 45, default : 35
  Retourne : {{result_value}}
```

**Paramètres** :

- `input_value` (nombre ou expression) : La valeur d'entrée à évaluer
- `curve` (texte) : Chaîne de définition de courbe

**Retourne** :

- `result_value` (number) : Valeur de sortie calculée basée sur la courbe

#### Format de courbe

**Syntaxe** : `[opérateur] seuil : valeur_sortie`

**Opérateurs supportés** :

- `>` - Supérieur à
- `>=` - Supérieur ou égal (défaut si pas d'opérateur spécifié)
- `<` - Inférieur à
- `<=` - Inférieur ou égal
- `==` - Égal à
- `!=` - Différent de
- `default` ou `*` - Valeur de repli (correspond toujours, utiliser en dernière ligne)

#### Exemples de Flows

**Chauffage compensé météo** (Cas d'usage principal) :
```
QUAND : Température extérieure changée
ALORS : Calculer valeur depuis courbe
      Entrée : {{outdoor_temperature}}
      Courbe : < -5 : 60, < 0 : 55, < 5 : 50, < 10 : 45, < 15 : 40, default : 35
  ET Régler température cible sur {{result_value}}
```

**Ajustement dynamique basé sur COP** :
```
QUAND : COP changé
ALORS : Calculer valeur depuis courbe
      Entrée : {{adlar_cop}}
      Courbe : < 2.0 : -5, < 2.5 : -3, >= 3.5 : +2, default : 0
  ET Ajuster température cible de {{result_value}}°C
```

#### Bonnes pratiques

**✅ À FAIRE** :
- Toujours ajouter `default : <valeur>` en dernière ligne (empêche les erreurs)
- Utiliser retours à la ligne ou virgules pour séparer les règles
- Tester votre courbe avec différentes entrées avant déploiement
- Garder les courbes simples (moins de 20 entrées recommandé)

**⚠️ À NE PAS FAIRE** :
- Dépasser 50 entrées (limite stricte)
- Oublier le fallback par défaut (cause des erreurs si pas de correspondance)
- Mélanger logique chauffage/refroidissement dans la même courbe (utiliser des flows séparés)

#### Messages d'erreur

| Message d'erreur | Cause | Solution |
|------------------|-------|----------|
| `"La valeur d'entrée doit être un nombre valide"` | Tag d'entrée invalide ou valeur nulle | Vérifier votre token/variable d'entrée |
| `"Aucune condition de courbe correspondante pour la valeur : X"` | Aucune condition correspondante et pas de défaut | Ajouter `default : <valeur>` en dernière ligne |
| `"Syntaxe de courbe invalide à la ligne N"` | Condition mal formée | Vérifier le format : `opérateur seuil : valeur` |

---

## Configuration des paramètres

### Paramètre de seuil de puissance

Pour configurer un seuil de puissance personnalisé :
1. Aller dans Paramètres de l'appareil → Avancé
2. Trouver le paramètre "Seuil de puissance (W)"
3. Définir le seuil souhaité (100-10000W)
4. Défaut : 3000W

---

## Guide de dépannage

### Problèmes généraux

**Les cartes flow ne sont pas visibles dans l'application Homey** :
1. Vérifier que la version de l'application est 1.0.7 ou supérieure
2. Redémarrer l'application Homey
3. Vérifier les paramètres des cartes flow : Paramètres de l'appareil → Contrôle des cartes flow
4. S'assurer que la capability concernée a des données (pas null)

**Les déclencheurs se lancent mais les flows ne s'exécutent pas** :
1. Vérifier que le flow est activé (pas en pause)
2. Vérifier les conditions de logique du flow
3. Vérifier les logs d'exécution des flows de Homey
4. Tester d'abord avec un flow simple (juste notification)

**Les conditions retournent toujours false** :
1. Vérifier que la capability a des données valides (pas null/0)
2. Vérifier que l'appareil est opérationnel (pas hors ligne)
3. Vérifier les exigences spécifiques de la condition (ex : compresseur en marche pour COP)
4. Activer le mode debug et vérifier les logs

---

## Bonnes pratiques

### Conception des flows

**1. Utiliser une granularité appropriée** :
- COP temps réel : Pour alertes immédiates
- COP journalier : Pour rapports quotidiens
- COP mensuel : Pour analyse de tendances

**2. Combiner les conditions** :
```
SI : COP en-dessous de 2.0
  ET Puissance au-dessus de 3000W
  ET En fonctionnement depuis > 15 minutes
ALORS : Investiguer (pas normal d'avoir COP bas avec puissance élevée)
```

**3. Ajouter de l'hystérésis dans les flows** :
```
QUAND : Seuil de puissance dépassé
ALORS : Attendre 5 minutes
  ET SI toujours au-dessus du seuil
    ALORS Prendre des mesures
```

### Gestion des notifications

**Prévenir le spam** :
- Utiliser la limitation de débit (intégrée pour les déclencheurs puissance/défaut)
- Ajouter des conditions basées sur le temps (pas entre 22:00-08:00)
- Combiner plusieurs vérifications avant de notifier

**Prioriser les alertes** :
- Critique : Défauts, surcharge de puissance → Notification immédiate
- Avertissement : COP bas, consommation élevée → Résumé quotidien
- Info : Jalons, bonnes performances → Résumé hebdomadaire
