# Guide Rapide de Configuration des Cartes de Flux

## Vue d'ensemble

La pompe à chaleur Adlar peut recevoir des données de mesure externes d'autres appareils Homey en utilisant des cartes de flux pour améliorer la précision du calcul du COP. Cela crée un système de partage de données direct où les capteurs externes envoient automatiquement leurs mesures à la pompe à chaleur.

**Architecture de Service (v0.99.23+)** : L'intégration des données externes est gérée par le **EnergyTrackingService** et traitée par le service **COPCalculator** pour des calculs d'efficacité améliorés.

![Configuration de Mesure de Puissance Externe](/docs/COP%20calculation/COP%20-%20external%20power%20measure.png)

## Composants Requis vs Optionnels

### ✅ **Composants Requis**

- **Carte QUAND** : Déclencheur d'appareil externe (par ex., "La puissance a changé")
- **Carte ALORS** : Action d'envoi de données (par ex., "Envoyer les données de puissance à la pompe à chaleur")
- **Connexion de Données** : La valeur de mesure doit être transmise du déclencheur à l'action

### ⚠️ **Composants Optionnels**

- **Conditions ET** : Ajouter des vérifications de fiabilité (appareil en ligne, données valides, etc.)
- **Actions SINON** : Gestion des erreurs et notifications

## ⚠️ Important : Fraîcheur des Données

**Les appareils externes envoient des données lorsque leurs mesures changent.** Le **EnergyTrackingService** de la pompe à chaleur stocke les données les plus récentes reçues au cours des 5 dernières minutes. Le service **COPCalculator** utilise ces données mises en cache pour les calculs de COP. Des mises à jour plus fréquentes donnent des calculs de COP plus précis.

**Délai d'expiration du Service** : Les demandes de données externes expirent après 5 secondes (`DeviceConstants.EXTERNAL_DEVICE_QUERY_TIMEOUT_MS`), configurable dans les paramètres de l'appareil.

## Configuration de Base (Partage de Données Direct)

### Étape 1 : Créer un Flux de Données Externes

#### QUAND (Déclencheur)

- [Votre Compteur Électrique] La puissance a changé
- Appareil : Votre appareil de mesure de puissance externe (par ex., "Pompe à chaleur kWh - Boîte compteur")

#### ALORS (Action)

- Envoyer les données de puissance à la pompe à chaleur pour le calcul du COP
- Appareil : [Votre Pompe à Chaleur] (par ex., "Intelligent Heat Pump - Maison")
- power_value : `{{power}}` *(du jeton déclencheur - mesure actuelle)*

Ce flux permet aux compteurs électriques externes de partager automatiquement leurs mesures avec l'appareil pompe à chaleur, permettant des calculs de COP plus précis en utilisant la consommation électrique réellement mesurée.

## Configuration Avancée (Avec Conditions ET)

### QUAND (Déclencheur Avancé)

- [Votre Compteur Électrique] La puissance a changé

### ET *(Optionnel mais Recommandé)*

- Le compteur intelligent est disponible
- Lecture de puissance > 0W ET < 50000W
- La lecture de puissance est différente de la valeur précédente

### ALORS (Action Avancée)

- Envoyer les données de puissance à la pompe à chaleur pour le calcul du COP

### SINON *(Gestion d'Erreur Optionnelle)*

- Envoyer une notification : "Données de puissance invalides détectées"

## Types de Données Pris en Charge

| Type | Déclencheur Appareil Externe | Carte d'Action Pompe à Chaleur | Champ de Données |
|------|------------------------------|-------------------------------|-----------------|
| Puissance | Mesure de puissance de l'appareil modifiée | `receive_external_power_data` | `power_value` (W) |
| Débit | Mesure de débit de l'appareil modifiée | `receive_external_flow_data` | `flow_value` (L/min) |
| Température | Température de l'appareil modifiée | `receive_external_ambient_data` | `temperature_value` (°C) |

## Problèmes Courants & Solutions

### ❌ "Les données externes ne sont pas utilisées"

**Cause** : Le flux ne se déclenche pas ou les données n'atteignent pas la pompe à chaleur
**Solutions** :

- Vérifier que le flux est activé et fonctionne
- Vérifier que l'appareil externe est en ligne et signale des données
- Tester le flux manuellement pour s'assurer que la carte d'action s'exécute

### ❌ "Les valeurs de données semblent incorrectes"

**Cause** : Mauvais jeton ou incompatibilité d'unité de mesure
**Solutions** :

- Vérifier que le bon jeton déclencheur est utilisé (par ex., `{{power}}` pour les mesures de puissance)
- Vérifier que les unités de mesure correspondent aux valeurs attendues (W pour la puissance, L/min pour le débit, °C pour la température)

### ❌ Les données ne sont pas utilisées dans le calcul du COP

**Cause** : Valeurs de données invalides ou réponses tardives
**Solutions** :

- Assurer des plages de données réalistes (puissance : 100-50000W)
- Vérifier les journaux de l'appareil pour les erreurs de validation
- Tester l'exécution manuelle du flux

## Intégration de l'Architecture de Service (v0.99.23+)

### Comment les Données Externes Circulent à Travers les Services

1. **Déclencheur de Flux** : L'appareil externe (compteur électrique, capteur de débit) déclenche le flux Homey
2. **Action de Flux** : Le flux de l'utilisateur exécute la carte d'action "Envoyer [type de données] à la pompe à chaleur"
3. **EnergyTrackingService** : Reçoit et valide les données externes (vérifications de plage, validation null)
4. **Mise en Cache des Données** : EnergyTrackingService stocke les données avec horodatage (TTL de 5 minutes)
5. **Demande COPCalculator** : Lorsque le calcul du COP s'exécute, interroge EnergyTrackingService pour des données fraîches
6. **Sélection de Méthode** : COPCalculator passe automatiquement à une méthode de précision supérieure si des données externes sont disponibles
7. **Calcul du COP** : Utilise les données externes dans la méthode Thermique Directe (précision ±5%)
8. **Émission d'Événement** : COPCalculator émet un événement `cop-calculated` avec le résultat
9. **RollingCOPCalculator** : S'abonne à l'événement, ajoute un point de données au tampon de séries temporelles
10. **Publication de l'Appareil** : Les valeurs COP mises à jour sont publiées aux capacités Homey

**Avantages de la Coordination des Services** :

- **Sélection Automatique de Méthode** : Le service COPCalculator choisit automatiquement la meilleure méthode en fonction des données disponibles
- **Validation des Données** : EnergyTrackingService valide les données externes avant utilisation
- **Isolation des Services** : La gestion des données externes est isolée de la logique de calcul
- **Piloté par Événements** : Les services communiquent via des événements, pas de couplage étroit

## Avantages par Type de Données

### Intégration des Données de Puissance

- **Précision** : ±5% vs ±30% avec estimations internes
- **Méthode** : Passe au calcul "Thermique Direct" (COPCalculator Méthode 1)
- **Service** : EnergyTrackingService stocke les données de puissance externes
- **Exigences** : Compteur intelligent avec lectures de puissance en temps réel
- **Configuration** : Compteur électrique externe → déclencheur "puissance modifiée" → action "Envoyer données de puissance à la pompe à chaleur" (traité par EnergyTrackingService)

### Intégration des Données de Débit

- **Précision** : ±8% calculs thermiques
- **Méthode** : Permet des calculs précis de transfert de chaleur (COPCalculator Méthodes 1-3)
- **Service** : EnergyTrackingService met en cache les mesures de débit
- **Exigences** : Capteur de débit d'eau dans le circuit de chauffage

### Intégration des Données de Température

- **Précision** : ±12% compensation ambiante
- **Méthode** : Meilleure efficacité ajustée aux conditions météorologiques (COPCalculator Méthode 5 : Estimation de Carnot)
- **Service** : EnergyTrackingService valide les données de température ambiante
- **Exigences** : Capteur de température extérieure

## Tester Votre Configuration

1. **Test Manuel** : Déclencher votre appareil externe pour générer de nouvelles mesures
2. **Vérifier le Flux** : Vérifier que le flux s'exécute lorsque les données de l'appareil externe changent
3. **Vérifier les Journaux** : Les journaux de la pompe à chaleur montrent les données externes entrantes (journaux EnergyTrackingService)
4. **Vérifier les Données** : Les données externes apparaissent dans les diagnostics de la pompe à chaleur (capacité "External Power Measurement")
5. **Surveiller la Méthode COP** : Vérifier la capacité `adlar_cop_method` - devrait afficher "Thermique Direct" lors de l'utilisation de données de puissance externes
6. **Santé du Service** : Utiliser les diagnostics des paramètres de l'appareil pour vérifier qu'EnergyTrackingService a des données externes récentes

**Diagnostics du Service** (Paramètres de l'Appareil → Diagnostics des Capacités) :

- **État d'EnergyTrackingService** : Affiche la disponibilité des données externes et les horodatages
- **Méthode COPCalculator** : Affiche la méthode de calcul actuelle et pourquoi elle a été sélectionnée
- **Fraîcheur des Données** : Indique le temps écoulé depuis la dernière réception de données externes

Le **service COPCalculator** choisit automatiquement la meilleure méthode de calcul en fonction des sources de données disponibles, les données externes permettant les calculs de COP les plus précis possibles (Thermique Direct ±5%).
