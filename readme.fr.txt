Cette application vous donne un contrôle complet sur votre pompe à chaleur Adlar Castra Aurora directement via votre système domotique Homey. Vous pouvez surveiller, exploiter et optimiser votre pompe à chaleur sans dépendre de connexions Internet.

Langues prises en charge
🇬🇧 English
🇩🇪 Deutsch
🇫🇷 Français
🇳🇱 Nederlands

PRINCIPAUX AVANTAGES

CONTRÔLE LOCAL
- Connexion directe à votre pompe à chaleur via le réseau local
- Aucune connexion Internet nécessaire pour une utilisation quotidienne
- Temps de réponse rapides et connexion fiable

SURVEILLANCE AVANCÉE
- Mesures de température en temps réel (12 capteurs différents)
- Surveillance de la consommation électrique et de l'efficacité
- Calcul automatique du COP (coefficient de performance) avec 8 méthodes différentes
- Analyse SCOP saisonnière selon les normes européennes
- Plus de 60 fonctionnalités dans 9 catégories

EXPLOITATION COMPLÈTE
- Réglage de la température et modes de chauffage
- Ajustements de la courbe de chauffe
- Contrôle de la température de l'eau chaude
- Fonctions de minuterie et automatiques

AUTOMATISATION INTELLIGENTE
- 78 cartes de flux pour une automatisation avancée
- Détection et récupération intelligentes des erreurs
- Optimisation en fonction de la météo
- Tendances et avertissements d'efficacité énergétique
- Planification temporelle et détection du mode saisonnier
- Régulation adaptative de la température avec contrôleur PI (v2.0+)
- Apprentissage du modèle de bâtiment avec machine learning (v2.0+)
- Insights & Recommandations Bâtiment avec estimations ROI (v2.4+)
- Optimisation des prix de l'énergie avec tarifs day-ahead (v2.0+)
- Optimisation COP pour une efficacité maximale (v2.0+)
- Outils de diagnostic complets pour le dépannage (v2.0.1+)

CONVIVIAL
- Interface entièrement localisée
- Affichage adapté aux mobiles
- Indicateurs d'état clairs
- Messages d'erreur compréhensibles

INSTALLATION

DE QUOI AVEZ-VOUS BESOIN ?
- Homey Pro (version du micrologiciel 12.2.0 ou supérieure)
- Pompe à chaleur Adlar Castra Aurora
- Connexion réseau local à la pompe à chaleur
- Identifiants de l'appareil (ID, Clé locale, Adresse IP)

COMMENT OBTENIR LES IDENTIFIANTS DE L'APPAREIL ?
Vous pouvez obtenir la clé locale requise et d'autres données en suivant les instructions dans :
/docs/setup/Tuya_LocalKey_Homey_Guide_FR.pdf

ÉTAPES D'INSTALLATION
1. Installez l'application via le Homey App Store
2. Ajoutez un nouvel appareil et sélectionnez "Intelligent Heat Pump"
3. Entrez vos identifiants d'appareil :
   - ID de l'appareil
   - Clé locale
   - Adresse IP
   - Version du protocole (choisissez 3.3, 3.4 ou 3.5)
4. Terminez le processus d'appairage

SÉLECTION DE LA VERSION DU PROTOCOLE
La version du protocole détermine comment l'application communique avec votre pompe à chaleur :
- 3.3 (Par défaut) : Fonctionne pour la plupart des pompes à chaleur Adlar/Aurora
- 3.4 : Requis pour certains modèles plus récents
- 3.5 : Requis pour les dernières versions de micrologiciel

Si vous rencontrez des problèmes de connexion (déconnexions fréquentes, erreurs ECONNRESET),
essayez une version de protocole différente via les paramètres de l'appareil.
- ECONNRESET à 00:00 se produit généralement en raison de la réinitialisation quotidienne de votre routeur
- HMAC mismatch : la valeur par défaut est la version de protocole 3.3, passez à 3.4 (ou 3.5)
- ECONNREFUSED <adresse-ip> : probablement une adresse IP incorrecte,
  attribuez une adresse statique (DHCP) à votre pompe à chaleur

CAPACITÉS IMPORTANTES

SURVEILLANCE DE LA TEMPÉRATURE
- Températures d'entrée et de sortie d'eau
- Température ambiante
- Température de l'eau chaude
- Températures du compresseur
- Températures de l'échangeur de chaleur

ÉNERGIE ET EFFICACITÉ
- Consommation électrique en temps réel
- Consommation d'énergie quotidienne et totale
- Calcul du COP (efficacité de fonctionnement de votre pompe à chaleur)
- Analyse des tendances pour l'optimisation
- Surveillance des performances saisonnières
- Calcul des coûts horaires et quotidiens

CONTRÔLE DU SYSTÈME
- Commutation marche/arrêt
- Sélection du mode de chauffage
- Réglage de la température cible
- Ajustements de la courbe de chauffe
- Réglages de l'eau chaude

AUTOMATISATION AVEC DES CARTES DE FLUX
- Avertissements de température
- Surveillance de la consommation d'énergie
- Optimisation de l'efficacité
- Ajustements en fonction de la météo
- Notifications de minuterie du système
- Calculateur de courbe dynamique pour optimisation avancée

CALCULATEUR DE COURBE (Fonctionnalité avancée)
Calculez des valeurs de sortie basées sur des courbes configurables pour une automatisation intelligente :
- Chauffage compensé par la météo : Ajustement automatique du point de consigne basé sur la température extérieure
- Optimisation temporelle : Ajuster les paramètres par heure/jour/saison
- Réglage fin basé sur le COP : Ajustements dynamiques de température basés sur l'efficacité
- Prend en charge 6 opérateurs : >, >=, <, <=, ==, != avec solution de repli par défaut
- Maximum 50 entrées de courbe pour des scénarios complexes
- Calcul en temps réel avec messages d'erreur conviviaux

Exemple : Chauffage compensé par la météo
"Lorsque la température extérieure change, calculez le point de consigne de chauffage avec la courbe :
< -5°C : 60°C, < 0°C : 55°C, < 5°C : 50°C, < 10°C : 45°C, default : 35°C"
Résultat : Ajuste automatiquement le chauffage en fonction des conditions météorologiques.
Le champ d'entrée accepte des nombres, des variables ou la syntaxe {{ expression }} prise en charge par Homey.

CALCULATEUR DE COURBE DE CHAUFFE ADLAR CUSTOM (L28/L29)
Calcule la température de départ directement à partir des paramètres de courbe de chauffe Adlar Custom :

Que sont L28 et L29 ?
- L29 : Température de départ souhaitée à -15°C température extérieure (point de référence, ex. 55°C)
- L28 : Degré de pente par 10°C de changement de température (ex. -5 = -0,5°C par degré)

Comment ça fonctionne ?
La formule y = ax + b est calculée automatiquement :
- Pente (a) = L28 ÷ 10
- Ordonnée à l'origine (b) = L29 - (pente × -15°C)
Exemple : L29=55°C, L28=-5 → formule : y = -0,5x + 47,5

Exemple de flux :
"Lorsque la température extérieure change, calculez la courbe de chauffe Custom
avec L29=55°C à -15°C, L28=-5 par 10°C, temp extérieure {{outdoor_temperature}}"
Résultat à 5°C extérieur → temp de départ 45°C

Valeurs retournées :
- supply_temperature : Température de départ calculée (°C)
- formula : Formule mathématique (ex. "y = -0,5x + 47,5")

Avantages par rapport au Calculateur de Courbe général :
- Utilise les mêmes valeurs L28/L29 que l'affichage de votre pompe à chaleur
- Aucune définition manuelle de courbe nécessaire
- Mathématiquement exact selon les spécifications Adlar

PLANIFICATEUR TEMPOREL & MODE SAISONNIER (Fonctionnalités avancées)
Deux calculateurs pour une automatisation intelligente basée sur le temps et la saison :

Planificateur temporel :
Calculez des valeurs basées sur des horaires journaliers pour la programmation quotidienne de température.
Exemple : "06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, 23:00-06:00: 18"
- Prend en charge les plages nocturnes (par ex. 23:00-06:00)
- Maximum 30 plages horaires avec solution de repli par défaut
- Parfait pour la planification du confort et l'optimisation des heures d'utilisation

Détection du mode saisonnier :
Détection automatique de la saison de chauffage/refroidissement basée sur la date.
- Saison de chauffage : 1er oct - 15 mai (aligné sur la norme EN 14825 SCOP)
- Renvoie le mode, les indicateurs de saison et les jours jusqu'au changement de saison
- Parfait pour le basculement automatique des plannings hiver/été

SURVEILLANCE DU COP (COEFFICIENT DE PERFORMANCE)

L'application calcule automatiquement l'efficacité de fonctionnement de votre pompe à chaleur :
- Valeur COP : Rapport entre la chaleur générée et l'électricité consommée
- Moyennes quotidiennes : Tendances sur 24 heures
- Analyse hebdomadaire : Performance à long terme
- Surveillance saisonnière : SCOP selon les normes européennes
- Retour diagnostique : Ce qui affecte l'efficacité
- Détection des valeurs aberrantes : Signalement des valeurs irréalistes (< 0,5 ou > 8,0)

QUE SIGNIFIENT LES VALEURS COP ?
- COP 2.0-3.0 : Performance moyenne
- COP 3.0-4.0 : Bonne performance
- COP 4.0+ : Excellente performance

PARAMÈTRES AVANCÉS

RÉGULATION ADAPTATIVE DE LA TEMPÉRATURE
Régulation automatique de la température cible basée sur un capteur de température intérieure externe :
- Contrôleur PI (Proportionnel-Intégral) pour une température intérieure stable
- Performance : ±0,3°C de stabilité
- Requis : Capteur de température externe via carte de flux

APPRENTISSAGE DU MODÈLE DE BÂTIMENT
Algorithme d'apprentissage automatique qui apprend les propriétés thermiques de votre maison :
- Apprend 4 paramètres thermiques (C, UA, g, P_int)
- Temps d'apprentissage : 24-72 heures pour le modèle de base, 2-4 semaines pour un modèle précis
- Sélection du type de bâtiment : Léger/Moyen/Lourd/Passif
- Gains de chaleur internes dynamiques par heure de la journée
- Ajustement saisonnier du gain solaire

INSIGHTS & RECOMMANDATIONS BÂTIMENT (NOUVEAU v2.4)
Analyse automatisée du modèle thermique du bâtiment :
- Recommandations d'économie d'énergie avec estimations ROI
- Les insights apparaissent après 24-48 heures d'apprentissage (70% de confiance)
- "Heure de réveil" configurable pour les calculs de préchauffage
- Paramètre de réduction nocturne pour les estimations d'économies
- Nombre maximum d'insights actifs configurable (1-5)

OPTIMISATION DES PRIX DE L'ÉNERGIE
Optimisation automatique basée sur les prix de l'énergie day-ahead :
- Source de données : API EnergyZero (gratuit, aucun compte nécessaire)
- Économies estimées : 400-600 € par an
- Seuils de prix : Très Bas/Bas/Normal/Élevé basés sur les percentiles 2024
- Mode de calcul des prix : Marché/Marché+/Prix tout compris
- Frais de fournisseur et taxe énergétique configurables
- Détection des blocs de prix pour les périodes les moins/plus chères

OPTIMISATION COP
Optimisation automatique de la température de départ pour une efficacité maximale :
- Apprend la température de départ optimale par température extérieure
- Économies estimées : 200-300 €/an
- Stratégies : Conservateur/Équilibré/Agressif

FACTEURS DE PONDÉRATION DE LA RÉGULATION ADAPTATIVE
Trois priorités qui déterminent ensemble comment le système prend ses décisions :
- Priorité Confort (défaut 60%) : Poids pour la régulation de température PI
- Priorité Efficacité (défaut 25%) : Poids pour l'optimisation COP
- Priorité Coût (défaut 15%) : Poids pour l'optimisation des prix
- Les valeurs sont automatiquement normalisées à 100%

DÉPANNAGE ET SUPPORT

PROBLÈMES COURANTS

Problèmes de connexion (Erreurs ECONNRESET)
Si votre appareil se déconnecte en permanence ou affiche des erreurs de réinitialisation de connexion :

SOLUTION RAPIDE (prend moins de 2 minutes) :
1. Ouvrez les Paramètres de l'appareil dans l'application Homey
2. Faites défiler vers le haut jusqu'aux paramètres de connexion
3. Changez la Version du protocole à 3.4 (ou essayez 3.5 si 3.4 ne fonctionne pas)
4. Facultatif : mettez à jour d'autres identifiants (Adresse IP, Clé locale, ID de l'appareil)
5. Cliquez sur "Enregistrer" et attendez 1-2 minutes pour la reconnexion

Indicateurs de succès :
- L'état de connexion affiche "connecté"
- Plus d'erreurs ECONNRESET
- Les données des capteurs se mettent à jour normalement
- L'appareil reste disponible

Autres problèmes courants :
- Pas de connexion : Vérifiez l'adresse IP, la clé locale et la connectivité réseau
- Valeurs fluctuantes : Normal pendant le démarrage du système
- Codes d'erreur : Voir l'application pour une explication spécifique par code d'erreur
- L'appairage échoue : Essayez différentes versions de protocole (3.3, 3.4, 3.5)

METTRE À JOUR LES IDENTIFIANTS DE L'APPAREIL
Vous pouvez mettre à jour les identifiants de l'appareil sans réappairage :
1. Accédez aux Paramètres de l'appareil dans l'application Homey
2. Faites défiler vers le haut jusqu'aux paramètres de connexion
3. Mettez à jour les identifiants (Adresse IP, Clé locale, ID de l'appareil, Version du protocole)
4. Cliquez sur "Enregistrer" - l'appareil se reconnecte automatiquement

BESOIN D'AIDE ?
- Documentation : Consultez le dossier /docs sur GitHub pour des informations détaillées
- Guide de configuration : /docs/setup/advanced-settings/CONFIGURATIEGIDS.md (référence complète des paramètres)
- Communauté : Forum de la communauté Homey (ID de sujet : 143690)
- Problèmes : Signalez les problèmes sur GitHub

INTÉGRATION INTER-APPLICATIONS
Connectez-vous à d'autres applications Homey pour un calcul COP amélioré :
- Mesures de puissance externes (de votre compteur intelligent)
- Données de débit d'eau externes
- Données de température ambiante externes
- Température intérieure externe pour régulation adaptative

DIAGNOSTIC DU MODÈLE DE BÂTIMENT (v2.0.1+)
Dépannage pour les problèmes d'apprentissage thermique lorsque votre modèle de bâtiment ne se met pas à jour :
- Carte de flux de diagnostic complète
- Vérifier l'état des capteurs de température intérieure/extérieure
- Surveiller le processus d'apprentissage (échantillons, confiance, constante de temps)
- Identifier les raisons de blocage spécifiques avec des solutions
- Suivre la chronologie d'apprentissage (T+0 → T+50min → T+24h)

Utilisation : Créez le flux "Diagnostiquer l'apprentissage du modèle de bâtiment" pour voir l'état détaillé dans les logs de l'application

SÉCURITÉ ET FIABILITÉ

SURVEILLANCE AUTOMATIQUE
- Avertissements de température critiques
- Contrôle de l'état de connexion
- Détection d'erreur système
- Notifications de minuterie système
- Détection des valeurs COP aberrantes

RÉCUPÉRATION INTELLIGENTE
- Reconnexion automatique
- Correction d'erreur
- Récupération d'état
- Messages d'erreur conviviaux
