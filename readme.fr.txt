Cette application vous donne un contrôle total sur votre pompe à chaleur Adlar Castra Aurora directement via votre système domotique Homey. Vous pouvez surveiller, contrôler et optimiser votre pompe à chaleur sans dépendre de connexions Internet.

Langues supportées
🇬🇧 English
🇩🇪 Deutsch
🇫🇷 Français
🇳🇱 Nederlands

PRINCIPAUX AVANTAGES

CONTRÔLE LOCAL
- Connexion directe avec votre pompe à chaleur via le réseau local
- Aucune connexion Internet nécessaire pour l'utilisation quotidienne
- Temps de réponse rapides et connexion fiable

SURVEILLANCE AVANCÉE
- Mesures de température en temps réel (capteurs internes de la pompe à chaleur)
- Surveillance de la consommation électrique et de l'efficacité
- Calcul automatique du COP (coefficient de performance) avec 8 méthodes différentes
- Analyse SCOP saisonnière selon les normes européennes
- Capacités étendues pour un contrôle complet

FONCTIONNEMENT COMPLET
- Réglage de la température et modes de chauffage
- Ajustements de la courbe de chauffe
- Contrôle de la température de l'eau sanitaire
- Minuterie et fonctions automatiques

AUTOMATISATION INTELLIGENTE
- Cartes de flux étendues pour une automatisation avancée
- Détection intelligente des erreurs et récupération
- Optimisation dépendante de la météo
- Tendances et alertes d'efficacité énergétique
- Planification temporelle et détection du mode saisonnier
- Régulation de température adaptative avec régulateur PI
- Apprentissage du modèle du bâtiment avec apprentissage automatique
- Insights & Recommandations du bâtiment avec estimations ROI
- Optimisation du prix de l'énergie avec tarifs day-ahead
- Optimisation COP pour une efficacité maximale
- Outils de diagnostic complets pour le dépannage
- Intégration du vent et du soleil pour le modèle du bâtiment
  * Vitesse du vent externe pour la correction windchill de la perte de chaleur
  * Rayonnement solaire et puissance PV pour un calcul précis des gains solaires
  * Améliore la précision d'apprentissage du modèle du bâtiment avec des données météo en temps réel

CONVIVIAL
- Interface entièrement française
- Affichage adapté aux mobiles
- Indicateurs d'état clairs
- Messages d'erreur compréhensibles

INSTALLATION

DE QUOI AVEZ-VOUS BESOIN?
- Homey Pro (version firmware 12.2.0 ou supérieure)
- Pompe à chaleur Adlar Castra Aurora
- Connexion réseau local avec la pompe à chaleur
- Données de l'appareil (ID, Clé locale, adresse IP locale)

COMMENT OBTENIR LES DONNÉES DE L'APPAREIL?
Vous pouvez obtenir la clé locale requise et d'autres données en suivant les instructions dans:
/docs/setup/Tuya_LocalKey_Homey_Guide_NL.pdf sur la page du code source de cette application.

ÉTAPES D'INSTALLATION
1. Installez l'application via le Homey App Store
2. Ajoutez un nouveau périphérique et sélectionnez "Intelligent Heat Pump"
3. Entrez vos données d'appareil:
   - ID de l'appareil
   - Clé locale
   - Adresse IP locale
   - Version du protocole (choisissez 3.3, 3.4 ou 3.5)
4. Terminez le processus de couplage

SÉLECTION DE LA VERSION DU PROTOCOLE
La version du protocole détermine comment l'application communique avec votre pompe à chaleur:
- 3.3 (Standard): Fonctionne pour la plupart des pompes à chaleur Adlar/Aurora
- 3.4: Requis pour certains modèles plus récents
- 3.5: Requis pour les versions firmware les plus récentes

En cas de problèmes de connexion (interruptions fréquentes, erreurs ECONNRESET),
essayez une autre version de protocole via les paramètres de l'appareil.
- ECONNRESET à 00:00 se produit généralement en raison du redémarrage quotidien de votre routeur
- Erreur HMAC: la version de protocole par défaut est 3.3, passez à 3.4 (ou 3.5)
- ECONNREFUSED <adresse-ip>: très probablement une mauvaise adresse IP,
  attribuez une adresse statique (DHCP) à votre pompe à chaleur

FONCTIONNALITÉS IMPORTANTES

SURVEILLANCE DE TEMPÉRATURE
- Températures d'entrée et de sortie de l'eau
- Température extérieure
- Température de l'eau sanitaire
- Températures du compresseur
- Températures de l'échangeur de chaleur

ÉNERGIE ET EFFICACITÉ
- Consommation électrique en temps réel
- Consommation d'énergie quotidienne et totale
- Calcul COP (comment votre pompe à chaleur fonctionne efficacement)
- Analyse de tendance pour l'optimisation
- Surveillance des performances saisonnières
- Calcul des coûts horaires et quotidiens

CONTRÔLE DU SYSTÈME
- Marche/arrêt
- Sélection du mode de chauffage
- Réglage des objectifs de température
- Ajustements de la courbe de chauffe
- Paramètres de l'eau sanitaire

AUTOMATISATION AVEC CARTES DE FLUX
- Alertes de température
- Surveillance de la consommation d'énergie
- Optimisation de l'efficacité
- Ajustements dépendants de la météo
- Notifications de minuterie système
- Calculateur de courbe dynamique pour optimisation avancée

CALCULATEUR DE COURBE (Fonction avancée)
Calculez les valeurs de sortie basées sur des courbes configurables pour une automatisation intelligente:
- Chauffage dépendant de la météo: Ajustement automatique du point de consigne basé sur la température extérieure
- Optimisation temporelle: Ajustements de paramètres par heure/jour/saison
- Réglage fin basé sur le COP: Ajustements dynamiques de température basés sur l'efficacité
- Supporte 6 opérateurs: >, >=, <, <=, ==, != avec fallback par défaut
- Maximum 50 entrées de courbe pour des scénarios complexes
- Calcul en temps réel avec messages d'erreur conviviaux

Exemple: Chauffage dépendant de la météo
"Lorsque la température extérieure change, calculer le point de consigne de chauffage avec courbe:
< -5°C : 60°C, < 0°C : 55°C, < 5°C : 50°C, < 10°C : 45°C, default : 35°C"
Résultat: Ajuste automatiquement le chauffage en fonction des conditions météorologiques.
Le champ de saisie accepte les nombres, variables ou syntaxe {{ expression }} supportée par Homey.

CALCULATEUR DE COURBE DE CHAUFFE PERSONNALISÉE ADLAR (L28/L29)
Calcule la température de départ directement à partir des paramètres de courbe de chauffe personnalisée Adlar:

Qu'est-ce que L28 et L29?
- L29: Température de départ souhaitée à -15°C température extérieure (point de référence, par ex. 55°C)
- L28: Degré de pente par 10°C de changement de température (par ex. -5 = -0.5°C par degré)

Comment ça marche?
La formule y = ax + b est automatiquement calculée:
- Pente (a) = L28 ÷ 10
- Interception (b) = L29 - (pente × -15°C)
Exemple: L29=55°C, L28=-5 → formule: y = -0.5x + 47.5

Exemple de flux:
"Lorsque la température extérieure change, calculer la courbe de chauffe personnalisée
avec L29=55°C à -15°C, L28=-5 par 10°C, temp ext {{outdoor_temperature}}"
Résultat à 5°C ext → temp départ 45°C

Retour:
- supply_temperature: Température de départ calculée (°C)
- formula: Formule mathématique (par ex. "y = -0.5x + 47.5")

Avantages par rapport au calculateur de courbe général:
- Utilise les mêmes valeurs L28/L29 que l'affichage de votre pompe à chaleur
- Aucune définition manuelle de courbe nécessaire
- Mathématiquement exact selon la spécification Adlar

PLANIFICATION TEMPORELLE & MODE SAISONNIER (Fonctions avancées)
Deux calculateurs pour une automatisation intelligente basée sur le temps et les saisons:

Planification temporelle:
Calculez les valeurs basées sur des plannings journaliers pour la programmation quotidienne de température.
Exemple: "06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, 23:00-06:00: 18"
- Supporte les plages nocturnes (par ex. 23:00-06:00)
- Maximum 30 plages horaires avec fallback par défaut
- Parfait pour la planification du confort et l'optimisation temps-d'utilisation

Détection du mode saisonnier:
Détection automatique de la saison de chauffage/refroidissement basée sur la date.
- Saison de chauffage: 1er oct - 15 mai (conforme à la norme EN 14825 SCOP)
- Retourne le mode, drapeaux de saison et jours jusqu'au changement de saison
- Parfait pour basculer automatiquement entre les plannings hiver/été

SURVEILLANCE DU COP (COEFFICIENT DE PERFORMANCE)

L'application calcule automatiquement l'efficacité de votre pompe à chaleur:
- Valeur COP: Rapport entre chaleur produite et électricité consommée
- Moyennes quotidiennes: Tendances 24 heures
- Analyse hebdomadaire: Performance à long terme
- Surveillance saisonnière: SCOP selon les normes européennes
- Retour diagnostique: Ce qui influence l'efficacité
- Détection des valeurs aberrantes: Signalement des valeurs irréalistes (< 0.5 ou > 8.0)

QUE SIGNIFIENT LES VALEURS COP?
- COP 2.0-3.0: Performance moyenne
- COP 3.0-4.0: Bonne performance
- COP 4.0+: Excellente performance


FONCTIONNALITÉS AVANCÉES
Voir l'introduction dans /docs/setup/advanced-control/Advanced_Features_Intro.nl.md
Pour activer les composants suivants, l'expérience consiste d'abord à connecter les sources de données externes.
Ensuite, activez la Régulation Adaptative de Température en combinaison avec les composants suivants selon les besoins.

RÉGULATION ADAPTATIVE DE TEMPÉRATURE
Régulation automatique de la température cible basée sur un capteur de température intérieure externe:
- Régulateur PI (Proportionnel-Intégral) pour une température intérieure stable
- Performance: Stabilité ±0.3°C
- Requis: Capteur de température externe via carte de flux

APPRENTISSAGE DU MODÈLE DU BÂTIMENT
Algorithme d'apprentissage automatique qui apprend les propriétés thermiques de votre maison:
- Apprend 4 paramètres thermiques (C, UA, g, P_int)
- Temps d'apprentissage: 24-72 heures pour modèle de base, 2-4 semaines pour modèle précis
- Sélection du type de bâtiment: Léger/Moyen/Lourd/Passif
- Gains de chaleur internes dynamiques par période
- Ajustement saisonnier des gains solaires

INSIGHTS & RECOMMANDATIONS DU BÂTIMENT
Analyse automatisée du modèle thermique du bâtiment:
- Recommandations d'économie d'énergie avec estimations ROI
- Les insights apparaissent après 24-48 heures d'apprentissage (70% de confiance)
- "Heure de réveil" configurable pour calculs de préchauffage
- Paramètre de réduction nocturne pour estimations d'économies
- Nombre maximum d'insights actifs configurable (1-5)

OPTIMISATION DU PRIX DE L'ÉNERGIE
Optimisation automatique basée sur les prix de l'énergie day-ahead:
- Source de données: API EnergyZero (gratuit, pas de compte nécessaire)
- Économie estimée: €400-600 par an
- Seuils de prix: Très Bas/Bas/Normal/Élevé basés sur les percentiles 2024
- Mode de calcul des prix: Prix marché/Marché+/Prix all-in
- Majoration fournisseur et taxe énergétique configurables
- Détection de bloc de prix pour les périodes les moins/plus chères

OPTIMISATION COP
Optimisation automatique de la température de départ pour une efficacité maximale:
- Apprend la température de départ optimale par température extérieure
- Économie estimée: €200-300/an
- Stratégies: Conservatif/Équilibré/Agressif

FACTEURS DE PONDÉRATION DE RÉGULATION ADAPTATIVE
Quatre priorités qui déterminent ensemble comment le système prend des décisions:
- Priorité Confort (par défaut 50%): Poids pour la régulation de température PI
- Priorité Efficacité (par défaut 15%): Poids pour l'optimisation COP
- Priorité Coût (par défaut 15%): Poids pour l'optimisation des prix
- Priorité Chaleur Thermique (par défaut 20%): Poids pour la prise en compte des propriétés thermiques du bâtiment
- Les valeurs sont automatiquement normalisées pour un total de 100%

DIAGNOSTIC DU MODÈLE DU BÂTIMENT
Dépannage pour problèmes d'apprentissage thermique lorsque votre modèle du bâtiment ne se met pas à jour:
- Carte de flux diagnostique complète
- Vérifier l'état du capteur de température intérieure/extérieure
- Surveiller le processus d'apprentissage (échantillons, confiance, constante de temps)
- Identifier les raisons de blocage spécifiques avec solutions
- Suivre la chronologie d'apprentissage (T+0 → T+50min → T+24h)

INTÉGRATION VENT & SOLEIL
Améliorez la précision du modèle thermique du bâtiment avec des données météorologiques externes:

Correction de la vitesse du vent:
- Ajustement automatique de la perte de chaleur basé sur l'effet windchill
- Carte de flux: "Définir la vitesse du vent externe" (km/h)
- Réduit le temps d'apprentissage du modèle du bâtiment de 30-50%
- Compatible avec l'application météo KNMI et autres capteurs de vent

Intégration du rayonnement solaire:
- Calcul précis des gains solaires via la surface du bâtiment
- Carte de flux: "Définir le rayonnement solaire externe" (W/m²)
- Ajustement saisonnier (hiver 60%, été 130%)
- Supporte les données de rayonnement solaire KNMI

Suivi de la puissance PV:
- Surveillance en temps réel du rendement des panneaux solaires
- Carte de flux: "Définir la puissance PV externe" (W)
- Utilisé pour la correction des gains de chaleur internes
- Améliore la confiance du modèle du bâtiment jusqu'à 85%+


INTÉGRATION CROSS-APP

Sources de données: Application météo KNMI, application Homey Energy ou vos propres capteurs

Connectez-vous avec des applications Homey conformes pour un calcul COP amélioré et une régulation adaptative et un modèle de bâtiment:
- Mesures de puissance externes (de votre compteur intelligent)
- Données de débit d'eau externes
- Données de température extérieure externes (par ex. application météo KNMI)
- Température intérieure externe pour régulation adaptative
- Données de vitesse du vent pour compensation windchill
- Intensité du rayonnement solaire pour calcul des gains solaires
- Puissance PV pour gains d'énergie solaire en temps réel


SÉCURITÉ ET FIABILITÉ

SURVEILLANCE AUTOMATIQUE
- Alertes de température critiques
- Vérification de l'état de connexion
- Détection d'erreur système
- Notifications de minuterie système
- Détection de valeurs aberrantes COP

RÉCUPÉRATION INTELLIGENTE
- Reconnexion automatique
- Correction d'erreur
- Récupération d'état
- Messages d'erreur conviviaux

DÉPANNAGE ET SUPPORT

CONFIGURATION D'INTÉGRATION AVANCÉE ET DOCUMENTATION

Pour des instructions détaillées et l'intégration de données externes:
- Guide de Régulation Adaptative de Température: /docs/setup/guide/ADAPTIVE_CONTROL_GUIDE.nl.md
- Composants de régulation adaptative: /docs/setup/advanced-control/ADAPTIVE_CONTROL_COMPONENTS.nl.md
- Cartes de flux des fonctionnalités avancées: /docs/setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.nl.md
- Configuration Vent & Soleil: /docs/setup/guide/BUILDING_INSIGHTS_GUIDE.nl.md
- Guide des cartes de flux: /docs/setup/guide/FLOW_CARDS_GUIDE.nl.md
- Configuration complète: /docs/setup/advanced-settings/CONFIGURATION_GUIDE.nl.md
- Info et spécifications pompe à chaleur: répertoire /docs/Heatpump specs/
- Méthodes de calcul COP: /docs/COP calculation/COP-calculation.md
- Calcul SCOP: /docs/COP calculation/SCOP-calculation.md

PROBLÈMES COURANTS

Problèmes de connexion (Erreurs ECONNRESET)
Si votre appareil se déconnecte continuellement ou affiche des erreurs de réinitialisation:

SOLUTION RAPIDE (prend moins de 2 minutes):
1. Ouvrez les paramètres de l'appareil dans l'application Homey
2. Faites défiler vers le haut jusqu'aux paramètres de connexion
3. Changez la version du protocole en 3.4 (ou essayez 3.5 si 3.4 ne fonctionne pas)
4. Optionnel: Mettez à jour d'autres données (adresse IP locale, Clé locale, ID de l'appareil)
5. Cliquez sur "Enregistrer" et attendez 1-2 minutes pour la reconnexion

Indicateurs de succès:
- L'état de connexion affiche "connecté"
- Plus d'erreurs ECONNRESET
- Les données du capteur sont mises à jour normalement
- L'appareil reste disponible

Autres problèmes courants:
- Pas de connexion: Vérifiez l'adresse IP locale, la clé locale et la connectivité réseau
- Valeurs fluctuantes: Normal pendant le démarrage du système
- Codes d'erreur: Voir l'application pour une explication spécifique par code d'erreur
- Échec du couplage: Essayez différentes versions de protocole (3.3, 3.4, 3.5)

MISE À JOUR DES DONNÉES DE L'APPAREIL
Vous pouvez mettre à jour les données de l'appareil sans recoupler:
1. Allez dans les paramètres de l'appareil dans l'application Homey
2. Faites défiler vers le haut jusqu'aux paramètres de connexion
3. Mettez à jour les données (adresse IP locale, Clé locale, ID de l'appareil, Version du protocole)
4. Cliquez sur "Enregistrer" - l'appareil se reconnecte automatiquement

BESOIN D'AIDE?
- Documentation: Consultez le répertoire /docs dans le code source sur GitHub pour des informations détaillées
- Guide de configuration: /docs/setup/advanced-settings/CONFIGURATIEGIDS.md (référence complète des paramètres)
- Communauté: Forum Communauté Homey (Topic ID: 143690)
- Problèmes: Signalez les problèmes sur GitHub
