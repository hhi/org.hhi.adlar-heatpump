# Application Pompe à Chaleur Adlar - Guide de Configuration

Ce guide décrit tous les paramètres configurables de l'application Homey Adlar Heat Pump. Chaque paramètre est expliqué avec des exemples pratiques et des recommandations.

---

## 🔗 Groupes de Paramètres & Dépendances

| # | Groupe | Requis | Optionnel |
|---|--------|--------|-----------|
| 1 | **Paramètres de Connexion** | - | - |
| 2 | **Paramètres COP** | - | Mesure de puissance (pour précision) |
| 3 | **Paramètres de Fonctionnalités** | Redémarrage app | - |
| 4 | **Gestion des Cartes de Flux** | Redémarrage app | - |
| 5 | **Contrôle Adaptatif de Température** | Capteur temp externe | - |
| 6 | **Apprentissage du Modèle de Bâtiment** | - | - |
| 7 | **Aperçus du Bâtiment** | Modèle Bâtiment ON | Confiance min. |
| 8 | **Optimisation du Prix de l'Énergie** | Contrôle Adaptatif ON, Internet | Tarif dynamique |
| 9 | **Optimisation COP** | Calcul COP ON, Contrôle Adaptatif | 1+ semaine données |
| 10 | **Facteurs de Pondération** | Contrôle Adaptatif ON | - |
| 11 | **Diagnostics** | - | - |
| 12 | **Gestion de l'Énergie** | - | Mesure de puissance |

```
┌──────────────────┐
│ 1. Connexion     │  Base - toujours nécessaire
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ 2. COP Settings  │────▶│ 9. COP Optimizer │
└──────────────────┘     └──────────────────┘
         │                        ▲
         │                        │
         ▼                        │
┌──────────────────┐              │
│ 5. Adaptive Temp │──────────────┤
│    Control       │              │
└────────┬─────────┘              │
         │                        │
    ┌────┴────┬───────────────────┤
    ▼         ▼                   │
┌────────┐ ┌────────────────┐     │
│ 10.    │ │ 8. Price       │─────┘
│Weights │ │    Optimizer   │
└────────┘ └────────────────┘

┌──────────────────┐     ┌──────────────────┐
│ 6. Building      │────▶│ 7. Building      │
│    Model         │     │    Insights      │
└──────────────────┘     └──────────────────┘
```

---

## 📖 Table des Matières

1. [Paramètres de Connexion](#1-paramètres-de-connexion)
2. [Paramètres COP (Coefficient de Performance)](#2-paramètres-cop-coefficient-de-performance)
3. [Paramètres de Fonctionnalités](#3-paramètres-de-fonctionnalités)
4. [Gestion des Cartes de Flux](#4-gestion-des-cartes-de-flux)
5. [Contrôle Adaptatif de Température](#5-contrôle-adaptatif-de-température)
6. [Apprentissage du Modèle de Bâtiment](#6-apprentissage-du-modèle-de-bâtiment)
7. [Aperçus et Recommandations du Bâtiment](#7-aperçus-et-recommandations-du-bâtiment)
8. [Optimisation du Prix de l'Énergie](#8-optimisation-du-prix-de-lénergie)
9. [Optimisation COP](#9-optimisation-cop)
10. [Facteurs de Pondération du Contrôle Adaptatif](#10-facteurs-de-pondération-du-contrôle-adaptatif)
11. [Diagnostics](#11-diagnostics)
12. [Gestion de l'Énergie](#12-gestion-de-lénergie)

---

## 1. Paramètres de Connexion

Ces paramètres sont nécessaires pour connecter votre pompe à chaleur Adlar via le protocole Tuya local.

### ID de l'Appareil
- **Fonction** : Identification unique de votre pompe à chaleur
- **Format** : Code alphanumérique (ex. : `bf1234567890abcdef`)
- **Comment l'obtenir** : Via Tuya IoT Platform ou pendant le processus d'appairage
- **Remarque** : La modification déclenche une reconnexion automatique

### Clé Locale
- **Fonction** : Clé de sécurité pour la communication chiffrée
- **Format** : Chaîne hexadécimale (ex. : `a1b2c3d4e5f6g7h8`)
- **Comment l'obtenir** : Via Tuya IoT Platform ou pendant le processus d'appairage
- **Sécurité** : Stockée chiffrée dans Homey

### Adresse IP
- **Fonction** : Adresse réseau local de votre pompe à chaleur
- **Valeur** : Format IPv4 (ex. : `192.168.1.100`)
- **Recommandation** : Définissez une adresse IP statique via votre routeur (réservation DHCP)
- **Pourquoi IP statique** : Évite les problèmes de connexion après redémarrage du routeur

### Version du Protocole
- **Fonction** : Version du protocole de communication Tuya
- **Options** :
  - **3.3** (par défaut) - Le plus courant pour les appareils plus anciens
  - **3.4** - Appareils plus récents à partir de 2020
  - **3.5** - Dernier protocole avec sécurité améliorée
- **Comment choisir** : Vérifiez dans Tuya IoT Platform ou utilisez 3.3 par défaut
- **Reconnexion automatique** : L'appareil se reconnecte automatiquement après modification

---

## 2. Paramètres COP (Coefficient de Performance)

Le COP mesure l'efficacité de votre pompe à chaleur : combien de chaleur (kW) vous obtenez par électricité consommée (kW). Par exemple : COP 4.0 signifie 4 kW de chaleur à partir de 1 kW d'électricité.

### Activer le Calcul COP
- **Par défaut** : Activé
- **Fonction** : Calcule automatiquement l'efficacité de votre pompe à chaleur
- **Pourquoi utile** :
  - Aperçu des performances
  - Détection précoce des problèmes (COP < 2.0 peut indiquer un dysfonctionnement)
  - Base pour les algorithmes d'optimisation
- **Recommandation** : Toujours garder activé

### Méthode de Calcul COP
L'application prend en charge 6 méthodes de calcul différentes avec une précision variable :

| Méthode | Précision | Capteurs Requis | Quand Utiliser |
|---------|-----------|-----------------|----------------|
| **Auto** (recommandé) | Meilleure disponible | Automatique | Par défaut - choisit la meilleure méthode |
| Thermique direct | ±5% | Capteur de puissance thermique | Plus précis, si disponible |
| Module de puissance | ±8% | Compteur de puissance externe | Avec prise intelligente ou compteur kWh |
| Circuit réfrigérant | ±12% | Capteurs de température + pression | Capteurs internes standard |
| Estimation Carnot | ±15% | Températures entrée/sortie | Approximation théorique |
| Corrélation vanne | ±20% | Positions des vannes | Basé sur le comportement du système |
| Différence de température | ±30% | Températures uniquement | Moins précis, estimation de base |

### Détection des Valeurs Aberrantes COP
- **Par défaut** : Activé
- **Fonction** : Détecte les valeurs COP irréalistes indiquant :
  - Dysfonctionnements de capteurs
  - Mesures incorrectes
  - Déviations temporaires du système
- **Pourquoi important** : Empêche les données erronées de fausser vos moyennes et optimisations

### COP Valide Minimum
- **Par défaut** : 0.5
- **Plage** : 0.1 - 2.0
- **Fonction** : Les valeurs en dessous de ce seuil sont marquées comme aberrantes

### COP Valide Maximum
- **Par défaut** : 8.0
- **Plage** : 4.0 - 15.0
- **Fonction** : Les valeurs au-dessus de ce seuil sont marquées comme aberrantes

---

## 3. Paramètres de Fonctionnalités

Ces paramètres déterminent quelles fonctionnalités sont visibles dans l'interface de l'application Homey. **Remarque : Les modifications nécessitent un redémarrage et la fermeture de l'application.**

### Afficher les Paramètres de Contrôle de Courbe
- **Par défaut** : Désactivé
- **Fonction** : Affiche/masque les contrôles d'ajustement pour les courbes de chauffage et d'eau chaude
- **Cartes de flux** : Fonctionnent toujours, quel que soit ce paramètre

### Capacités de Mesure de Puissance Interne
- **Par défaut** : Désactivé
- **Fonction** : Affiche/masque 9 mesures de puissance DPS (consommation, tension, courant)
- **Quand activer** : Votre pompe à chaleur a une mesure de puissance intégrée

### Capacités de Gestion des Curseurs
- **Par défaut** : Désactivé
- **Fonction** : Affiche/masque 3 curseurs (température eau chaude, mode eau, volume)

### Suivi Intelligent de l'Énergie
- **Par défaut** : Activé
- **Fonction** : Sélection intelligente de la source de mesure de puissance
- **Fonctionnement** :
  1. **Priorité 1** : Mesure de puissance externe (via carte de flux)
  2. **Priorité 2** : Capteurs internes (si disponibles)
- **Tableau de Bord Énergie Homey** : L'appareil apparaît automatiquement avec des données précises

---

## 4. Gestion des Cartes de Flux

Détermine quelles cartes de flux sont visibles dans l'éditeur de flux Homey. **Redémarrage recommandé après modifications.**

### Options Générales (pour toutes les catégories) :
- **Désactivé** : Cartes de flux toujours masquées
- **Auto** (recommandé) : Afficher uniquement si les capteurs pertinents sont disponibles
- **Forcer l'activation** : Toujours afficher, même sans capteurs

### Catégories Disponibles :
| Catégorie | Par défaut | Description |
|-----------|------------|-------------|
| Alarmes liées à la température | Auto | Déclencheurs pour seuils de température |
| Alarmes liées à la tension | Auto | Déclencheurs pour déviations de tension |
| Alarmes liées au courant | Auto | Déclencheurs pour déviations de courant |
| Alarmes liées à la puissance | Auto | Déclencheurs pour déviations de puissance |
| Alarmes liées aux impulsions | Auto | Déclencheurs pour positions vanne/compresseur |
| Alarmes de changement d'état | Auto | Déclencheurs pour changements d'état opérationnel |
| Alarmes d'efficacité (S)COP | Auto | Déclencheurs pour efficacité COP et SCOP |

### Cartes de Fonction Expert HVAC
- **Par défaut** : Activé
- **Fonction** : Déclencheurs de diagnostic avancés (compresseur, ventilateur, débit d'eau)
- **Public cible** : Professionnels HVAC, utilisateurs avancés

### Compteur de Déconnexions Quotidien
- **Par défaut** : Désactivé
- **Fonction** : Compte combien de fois la connexion a été perdue
- **Capacité** : Lorsqu'il est activé, ajoute le capteur `adlar_daily_disconnect_count` à votre appareil
- **Persistance** : Le paramètre persiste après les mises à jour de l'app et les redémarrages de Homey
- **Valeur normale** : 0-2 par jour
- **Problématique** : > 5 par jour → améliorer le signal WiFi ou définir une IP statique

---

## 5. Contrôle Adaptatif de Température

Régulation automatique de la température cible basée sur un capteur de température intérieure externe.

### Activer le Contrôle Adaptatif de Température
- **Par défaut** : Désactivé
- **Fonction** : Contrôleur PI (Proportionnel-Intégral) pour une température intérieure stable
- **Prérequis** :
  - Capteur de température externe (via carte de flux)
  - Température cible définie
  - Flux "Envoyer température intérieure" actif
- **Performance** : Stabilité ±0.3°C (bande morte ajustable)

### Paramètres du Contrôleur PI (Expert)

**Visible uniquement avec "Cartes de fonction expert HVAC" activé**

#### Gain Proportionnel (Kp)
- **Par défaut** : 3.0
- **Plage** : 0.5 - 10.0
- **Fonction** : Détermine la rapidité de réponse du système à l'erreur actuelle
- **Valeur plus élevée** : Correction plus rapide, risque de dépassement
- **Valeur plus basse** : Contrôle plus stable, correction plus lente

#### Gain Intégral (Ki)
- **Par défaut** : 1.5
- **Plage** : 0.1 - 5.0
- **Fonction** : Élimine les déviations persistantes (erreur à l'état stable)

#### Bande Morte
- **Par défaut** : 0.3°C
- **Plage** : 0.1 - 1.0°C
- **Fonction** : Tolérance avant que les ajustements soient effectués

---

## 6. Apprentissage du Modèle de Bâtiment

Algorithme d'apprentissage automatique qui apprend les propriétés thermiques de votre maison.

### Activer l'Apprentissage du Modèle de Bâtiment
- **Par défaut** : Activé
- **Fonction** : Apprend 4 paramètres thermiques (C, UA, g, P_int)
- **Temps d'apprentissage** : 24-72 heures pour le modèle de base, 2-4 semaines pour un modèle précis
- **Algorithme** : Moindres carrés récursifs (RLS) avec facteur d'oubli

### Facteur d'Oubli (Expert)
- **Par défaut** : 0.999
- **Plage** : 0.990 - 0.9995
- **Fonction** : Rapidité d'adaptation du modèle aux changements. Plus haut = plus stable, meilleure confiance (~75%). Plus bas = adaptation plus rapide aux changements saisonniers.
- **Visible uniquement** : Avec "Cartes de fonction expert HVAC" activé

### Type de Bâtiment
- **Par défaut** : Moyen (maison NL typique)
- **Options** :
  - **Léger** : Bois/préfabriqué, isolation de base, changements de temp rapides
  - **Moyen** : Brique, murs creux, double vitrage (maison NL typique)
  - **Lourd** : Béton/pierre, bonne isolation, verre HR++, stable
  - **Passif** : Maison passive, verre HR+++, étanche à l'air, récupération de chaleur

### Réinitialiser l'Apprentissage du Modèle de Bâtiment
- **Par défaut** : Désactivé
- **Type** : Action unique (case à cocher)
- **Fonction** : Réinitialise tous les paramètres de bâtiment appris (C, UA, τ, g, P_int) et redémarre avec le profil de bâtiment sélectionné
- **Réinitialisation automatique** : Se désactive automatiquement après la réinitialisation
- **Quand utiliser** : Les diagnostics montrent un état corrompu (valeurs négatives, 0% de confiance avec beaucoup d'échantillons)

### Gains de Chaleur Internes Dynamiques
- **Par défaut** : Activé
- **Fonction** : Prend en compte la chaleur variable des personnes/appareils selon l'heure
- **Modèle journalier** :
  - Nuit (23h00-06h00) : 40% (sommeil)
  - Jour (06h00-18h00) : 100% (normal)
  - Soir (18h00-23h00) : 180% (cuisine, TV)
- **Amélioration de la précision** : ~10-15%

### Ajustement Saisonnier du Gain Solaire
- **Par défaut** : Activé
- **Fonction** : Corrige l'angle solaire changeant tout au long de l'année
- **Multiplicateurs saisonniers** :
  - Hiver (Dec-Fév) : 60%
  - Été (Jun-Jul) : 130%
- **Contribution à la précision** : 5-20% de la chaleur totale

---

## 7. Aperçus et Recommandations du Bâtiment

Analyse automatisée du modèle thermique du bâtiment avec recommandations d'économie d'énergie et estimations de ROI.

### Activer les Aperçus du Bâtiment
- **Par défaut** : Activé
- **Fonction** : Analyse le modèle thermique du bâtiment et fournit des recommandations d'économie d'énergie
- **Temps d'apprentissage** : Les aperçus apparaissent après 48-72 heures d'apprentissage
- **Prérequis** : L'apprentissage du modèle de bâtiment doit être activé

### Confiance Minimum
- **Par défaut** : 70%
- **Plage** : 50% - 90%
- **Fonction** : Affiche les aperçus uniquement lorsque la confiance du modèle de bâtiment dépasse ce seuil
- **70%** : ~48-72 heures d'apprentissage
- **Valeurs inférieures** : Aperçus plus tôt, moins de précision

### Max Aperçus Actifs
- **Par défaut** : 3
- **Plage** : 1 - 5
- **Fonction** : Nombre maximum d'aperçus à afficher simultanément
- **Priorité** : Les aperçus les plus importants sont affichés en premier

---

## 8. Optimisation du Prix de l'Énergie

Optimisation automatique basée sur les prix de l'énergie day-ahead (contrat dynamique requis).

### Activer l'Optimisation des Prix
- **Par défaut** : Désactivé
- **Fonction** : Utilise les prix bas, évite les prix élevés
- **Source de données** : API EnergyZero (gratuit, pas de compte nécessaire)
- **Économies estimées** : 400-600€ par an

### Mode de Calcul des Prix
- **Par défaut** : Prix tout compris (coûts complets)
- **Options** :
  - **Prix du marché** : Prix spot + TVA
  - **Prix du marché+** : Prix spot + marge fournisseur + TVA
  - **Prix tout compris** : Coûts complets incluant taxe énergétique

### Marge Fournisseur (€/kWh TTC)
- **Par défaut** : 0.0182€/kWh
- **Plage** : 0€ - 0.50€/kWh
- **Fonction** : Votre marge fournisseur par kWh, TVA incluse
- **Conseil** : Vérifiez votre contrat d'énergie pour cette valeur

### Taxe Énergétique (€/kWh TTC)
- **Par défaut** : 0.11085€/kWh
- **Plage** : 0€ - 0.50€/kWh
- **Fonction** : Taxe énergétique par kWh, TVA incluse
- **Pays-Bas 2024** : ~0.11085€

### Pourcentage TVA
- **Par défaut** : 21%
- **Plage** : 0 - 30%
- **Fonction** : Pourcentage de TVA appliqué au prix du marché
- **Pays-Bas** : 21% (standard), 9% (taux réduit)

### Seuils de Prix

Les seuils sont basés sur les percentiles des prix spot 2024 :

| Seuil | Par défaut | Percentile | Action |
|-------|------------|------------|--------|
| Très Bas | 0.04€/kWh | P10 | Préchauffage maximum (+1.5°C) |
| Bas | 0.06€/kWh | P30 | Préchauffage modéré (+0.75°C) |
| Normal | 0.10€/kWh | P70 | Maintenir (0°C ajustement) |
| Élevé | 0.12€/kWh | P90 | Légère réduction (-0.5°C) |

> [!NOTE]
> Les prix au-dessus du seuil "Élevé" déclenchent l'action "Très élevé" avec réduction de -1.0°C.

### Offset Maximum de Préchauffage
- **Par défaut** : 1.5°C
- **Plage** : 0.0 - 3.0°C
- **Fonction** : Limite combien plus chaud que souhaité pendant les périodes de prix très bas

### Seuil d'Avertissement de Coût Quotidien
- **Par défaut** : 10€/jour
- **Plage** : 1€ - 50€/jour
- **Fonction** : Déclenche la carte de flux en cas de dépassement

### Taille du Bloc de Prix
- **Par défaut** : 4 heures
- **Plage** : 1 - 12 heures
- **Fonction** : Taille des blocs les moins chers/plus chers pour la planification day-ahead
- **Utilisé par** : Déclencheur 'Bloc le moins cher démarré' et détection de bloc

### Temps d'Avertissement Bloc Cher
- **Par défaut** : 2 heures
- **Plage** : 1 - 4 heures
- **Fonction** : Déclenche le flux 'période chère approche' N heures avant le début du bloc cher
- **Utilisation** : Pour préchauffer le bâtiment

### Fenêtre d'Analyse de Tendance des Prix
- **Par défaut** : 6 heures
- **Plage** : 3 - 24 heures
- **Fonction** : Nombre d'heures futures à analyser pour la détection de tendance (hausse/baisse/stable)
- **Utilisé par** : Déclencheur 'Tendance des prix changée'

---

## 9. Optimisation COP

Optimisation automatique de la température de départ pour une efficacité maximale.

### Activer l'Optimisation COP
- **Par défaut** : Désactivé
- **Fonction** : Apprend la température de départ optimale par température extérieure
- **Prérequis** :
  - Calcul COP actif
  - Minimum 1 semaine de données
  - Contrôle adaptatif activé
- **Économies estimées** : 200-300€/an
- **Temps d'apprentissage** : 2-4 semaines pour une optimisation fiable

### COP Minimum Acceptable
- **Par défaut** : 2.5
- **Plage** : 1.5 - 4.0
- **Fonction** : Déclencheur pour action d'optimisation lorsque le COP tombe en dessous de la valeur

### COP Cible
- **Par défaut** : 3.5
- **Plage** : 2.0 - 5.0
- **Fonction** : Valeur cible pour l'algorithme d'optimisation

### Stratégie d'Optimisation
- **Par défaut** : Équilibré (recommandé)
- **Options** :
  - **Conservateur** : Lent, sûr - petites étapes, longue observation
  - **Équilibré** : Étapes modérées, observation normale (recommandé)
  - **Agressif** : Rapide, expérimental - grandes étapes, itération rapide

---

## 10. Facteurs de Pondération du Contrôle Adaptatif

Ces quatre priorités déterminent ensemble comment le système prend des décisions. **Les valeurs sont automatiquement normalisées à 100% au total.**

### Priorité Confort
- **Par défaut** : 50%
- **Plage** : 0 - 100%
- **Fonction** : Poids pour le contrôle de température PI
- **Confort élevé** (70-80%) : Température toujours stable dans ±0.3°C

### Priorité Efficacité
- **Par défaut** : 15%
- **Plage** : 0 - 100%
- **Fonction** : Poids pour l'optimisation COP
- **Haute efficacité** (30-40%) : Focus sur le COP maximum

### Priorité Coût
- **Par défaut** : 15%
- **Plage** : 0 - 100%
- **Fonction** : Poids pour l'optimisation des prix
- **Multiplicateur dynamique** (v2.6.0) :
  - Prix ÉLEVÉS (réduire) : poids ×2.0 à ×3.0
  - Prix BAS (préchauffer) : poids ×1.2 à ×1.5
- **Coût élevé** (25-35%) : Économies maximales sur les coûts énergétiques

### Priorité Prédiction Thermique
- **Par défaut** : 20%
- **Plage** : 0 - 50%
- **Fonction** : Poids pour les prédictions thermiques (τ/C/UA)
- **Prérequis** : Confiance du modèle de bâtiment ≥50%
- **0%** : Désactivé (pas d'influence du modèle de bâtiment)

**Profils Pratiques** :

| Profil | Confort | Efficacité | Coût | Thermique | Cas d'Utilisation |
|--------|---------|------------|------|-----------|-------------------|
| Famille avec Bébé | 80% | 5% | 5% | 10% | Max confort |
| Télétravailleur | 50% | 15% | 15% | 20% | Équilibré (défaut) |
| Focus Budget | 35% | 10% | 35% | 20% | Contrat dynamique |
| Souvent Absent | 30% | 40% | 10% | 20% | Max efficacité |

---

## 11. Diagnostics

Outils pour le dépannage et l'analyse du système.

### Forcer la Reconnexion
- **Type** : Action unique (case à cocher)
- **Fonction** : Reconnexion immédiate à l'appareil Tuya
- **Quand utiliser** :
  - Le statut affiche "Déconnecté"
  - Après redémarrage du routeur WiFi
  - Après mise à jour du firmware de la pompe à chaleur

### Générer le Rapport de Diagnostic des Capacités
- **Type** : Action unique (case à cocher)
- **Fonction** : Aperçu détaillé de l'état de toutes les capacités
- **Sortie** : Enregistré dans les logs de l'application Homey

### Niveau de Log
- **Par défaut** : ERROR (recommandé en production)
- **Options** :
  - **ERROR** : Uniquement les erreurs critiques (recommandé)
  - **WARN** : Erreurs + avertissements
  - **INFO** : Erreurs + avertissements + événements importants
  - **DEBUG** : Tous les logs (dépannage) - utiliser temporairement !

---

## 12. Gestion de l'Énergie

Gestion des compteurs d'énergie pour le suivi et les rapports.

### Réinitialiser le Compteur Total d'Énergie Externe
- **Type** : Action unique (case à cocher)
- **Fonction** : Met le compteur d'énergie cumulé à zéro
- **Source de données** : Mesures via carte de flux "Entrer mesure de puissance externe"
- **Remarque** : L'action est irréversible, les données seront perdues

### Réinitialiser le Compteur Quotidien d'Énergie Externe
- **Type** : Action unique (case à cocher)
- **Fonction** : Met le compteur d'énergie quotidien à zéro
- **Réinitialisation automatique** : Se produit normalement automatiquement à 00:00

---

## 💡 Scénarios de Configuration Courants

### Scénario 1 : "Je veux juste une température de pièce stable"
```
✅ Contrôle Adaptatif de Température : ON
   - Kp : 3.0, Ki : 1.5, Bande morte : 0.3°C
✅ Apprentissage du Modèle de Bâtiment : ON
   - Type de bâtiment : Moyen (ou votre type)
   - P_int dynamique : ON
   - g saisonnier : ON
❌ Optimisation des Prix : OFF (d'abord maîtriser le confort)
❌ Optimisation COP : OFF (d'abord laisser le système se stabiliser)

Priorités :
- Confort : 80%
- Efficacité : 5%
- Coût : 5%
- Thermique : 10%
```

### Scénario 2 : "Économies maximales, j'ai un contrat dynamique"
```
✅ Contrôle Adaptatif de Température : ON
✅ Apprentissage du Modèle de Bâtiment : ON
✅ Optimisation des Prix : ON
   - Mode de calcul des prix : Prix tout compris
   - Seuils : Vérifiez les pourcentages de votre contrat
   - Max préchauffage : 1.5°C
✅ Optimisation COP : ON (après 2 semaines)
   - Min COP : 2.5
   - Cible : 3.5
   - Stratégie : Équilibré

Priorités :
- Confort : 35%
- Efficacité : 10%
- Coût : 35%
- Thermique : 20%
```

### Scénario 3 : "Maison passive, l'efficacité est clé"
```
✅ Contrôle Adaptatif de Température : ON
   - Kp : 2.0 (plus bas pour masse thermique lente)
   - Ki : 1.0
   - Bande morte : 0.5°C (plus de tolérance)
✅ Apprentissage du Modèle de Bâtiment : ON
   - Type de bâtiment : Passif
   - Facteur d'oubli : 0.999 (adaptation lente)
✅ Optimisation COP : ON
   - Stratégie : Agressif (maison passive tolère les expériences)

Priorités :
- Confort : 25%
- Efficacité : 40%
- Coût : 10%
- Thermique : 25%
```

### Scénario 4 : "Souvent absent, supervision minimale"
```
✅ Suivi intelligent de l'énergie : ON
✅ Calcul COP : ON
   - Détection des valeurs aberrantes : ON
✅ Modèle de bâtiment : ON (pour les aperçus)
❌ Toute optimisation : OFF (configurer et oublier)
✅ Alertes de flux : Auto
✅ Seuil de coût quotidien : 10€ (notification en cas de coûts élevés)

Utiliser les flux pour :
- Notification lorsque COP < 2.0 (problème possible)
- Notification lorsque déconnexion > 5/jour
- Notification lorsque coût quotidien > 10€
```

---
