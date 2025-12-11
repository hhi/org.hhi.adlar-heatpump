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

EXPLOITATION COMPLÈTE
- Réglage de la température et modes de chauffage
- Ajustements de la courbe de chauffe
- Contrôle de la température de l'eau chaude
- Fonctions de minuterie et automatiques

AUTOMATISATION INTELLIGENTE
- 67 cartes de flux pour une automatisation avancée
- Détection et récupération intelligentes des erreurs
- Optimisation en fonction de la météo
- Tendances et avertissements d'efficacité énergétique

CONVIVIAL
- Interface entièrement localisée (Français/Anglais/Néerlandais/Allemand)
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
/docs/Tuya_LocalKey_Homey_Guide_FR.pdf

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
essayez une version de protocole différente via la réparation de l'appareil (voir section Dépannage).
- ECONNRESET à 00:00 heure se produit généralement en raison de la réinitialisation quotidienne de votre routeur ;
- HMAC mismatch, la valeur par défaut est la version de protocole 3.3, passez à 3.4 (ou 3.5)
- ECONNREFUSED <adresse-ip> probablement dû à une adresse IP incorrecte,
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
Résultat : Ajuste automatiquement le chauffage en fonction des conditions météorologiques
Le champ d'entrée accepte des nombres, des variables ou la syntaxe {{ expression }} prise en charge par Homey.

PLANIFICATEUR TEMPOREL & MODE SAISONNIER (Fonctionnalités avancées)
Deux nouveaux calculateurs pour une automatisation intelligente basée sur le temps et la saison :

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

Exemple combiné :
Utilisez les trois calculateurs ensemble pour une automatisation ultime :
Compensation météo (temp. extérieure) + Planification temporelle (confort) + Mode saisonnier (hiver/été)
Résultat : Chauffage dynamique qui s'adapte à la météo, à l'heure de la journée et à la saison

SURVEILLANCE DU COP (COEFFICIENT DE PERFORMANCE)

L'application calcule automatiquement l'efficacité de fonctionnement de votre pompe à chaleur (voir répertoire /docs/COP calculation dans le code source) :
- Valeur COP : Rapport entre la chaleur générée et l'électricité consommée
- Moyennes quotidiennes : Tendances sur 24 heures
- Analyse hebdomadaire : Performance à long terme
- Surveillance saisonnière : SCOP selon les normes européennes
- Retour diagnostique : Ce qui affecte l'efficacité

QUE SIGNIFIENT LES VALEURS COP ?
- COP 2.0-3.0 : Performance moyenne
- COP 3.0-4.0 : Bonne performance
- COP 4.0+ : Excellente performance

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

RÉINITIALISATION MANUELLE DE LA CONNEXION (Solution temporaire)
Si votre appareil affiche l'état « Déconnecté » et ne se reconnecte pas automatiquement :

SOLUTION RAPIDE ALTERNATIVE :
1. Ouvrez les commandes de l'appareil dans l'application Homey
2. Changez le Mode de fonctionnement vers une valeur différente (par ex. de « Chauffage » à « Refroidissement »)
3. Attendez 5-10 secondes
4. Remettez le Mode de fonctionnement à la valeur d'origine
5. La connexion se rétablit généralement en quelques secondes

Cette méthode fonctionne car changer le mode de fonctionnement envoie une commande active
à l'appareil, ce qui réactive les connexions en veille.

NOTE : À partir de la v1.0.12, l'application résout cela automatiquement en 10 minutes.
Cette méthode manuelle n'est nécessaire que pour les anciennes versions de l'application ou comme solution de secours d'urgence.

METTRE À JOUR LES IDENTIFIANTS DE L'APPAREIL
Vous pouvez mettre à jour les identifiants de l'appareil sans réappairage :
1. Accédez aux Paramètres de l'appareil dans l'application Homey
2. Faites défiler vers le haut jusqu'aux paramètres de connexion
3. Mettez à jour les identifiants (Adresse IP, Clé locale, ID de l'appareil, Version du protocole)
4. Cliquez sur "Enregistrer" - l'appareil se reconnecte automatiquement

BESOIN D'AIDE ?
- Documentation : Consultez le dossier /docs dans le code source sur Github pour des informations détaillées
- Communauté : Forum de la communauté Homey (ID de sujet : 143690)
- Problèmes : Signalez les problèmes sur GitHub

FONCTIONNALITÉS AVANCÉES

PARAMÈTRES DE L'APPAREIL (Configurer par appareil)
Accès via les Paramètres de l'appareil dans l'application Homey :

Paramètres de connexion :
- Version du protocole : Version du protocole Tuya (3.3, 3.4, 3.5)
- ID de l'appareil, Clé locale, Adresse IP : Identifiants de connexion

Paramètres de calcul du COP :
- Activer/désactiver le calcul du COP
- Intégration de mesures de puissance externes
- Intégration de données de débit externes
- Intégration de température ambiante externe

Contrôle des cartes de flux :
Vous pouvez contrôler quelles cartes de flux sont visibles (désactivé/auto/activé) :
- Avertissements de température : Alertes de seuil de température
- Surveillance tension/courant : Surveillance du système électrique
- Avertissements de puissance : Alertes de consommation électrique
- Changements d'état du système : Compresseur, dégivrage, états du système
- Surveillance de l'efficacité : Tendances COP et valeurs aberrantes
- Fonctions d'expert : Cartes de flux de diagnostic avancées

Mode Auto (recommandé) :
Affiche uniquement les cartes de flux pour les capteurs avec des données adéquates (mises à jour récemment, pas d'erreurs).


Contrôles de courbe (optionnel) :
- Activez les contrôles de sélection pour les courbes de chauffage et d'eau chaude
- Par défaut : Désactivé (capteurs toujours visibles, sélecteurs masqués)
- Activez pour les utilisateurs avancés qui souhaitent un ajustement direct de la courbe

Paramètres de mesure de puissance :
- Activer/désactiver les mesures de puissance de la pompe à chaleur
- Gère automatiquement la visibilité des cartes de flux associées
- Utile si vous avez une surveillance de puissance externe

INTÉGRATION INTER-APPLICATIONS
Connectez-vous à d'autres applications Homey pour un calcul COP amélioré (voir /docs/COP flow-card-setup.md) :
- Mesures de puissance externes (de votre compteur intelligent)
- Données de débit d'eau externes
- Données de température ambiante externes

SÉCURITÉ ET FIABILITÉ

SURVEILLANCE AUTOMATIQUE
- Avertissements de température critiques
- Contrôle de l'état de connexion
- Détection d'erreur système
- Notifications de minuterie système

RÉCUPÉRATION INTELLIGENTE
- Reconnexion automatique
- Correction d'erreur
- Récupération d'état
- Messages d'erreur conviviaux

