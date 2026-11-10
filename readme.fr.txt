Pilotez et surveillez localement votre pompe à chaleur Adlar Castra Aurora avec Homey Pro.
Cette application comprend trois pilotes pour une connexion via Tuya ou Modbus.
Les communications quotidiennes passent par votre réseau local.

CHOISISSEZ VOTRE PILOTE

Aurora I/II via Tuya
Pour une Aurora I/II avec une connexion Wi-Fi Tuya. Nécessite l'ID de l'appareil, la clé locale, l'adresse IP locale et la version du protocole Tuya de la pompe à chaleur.
Tableau de bord local : http://HOMEY-IP:8092

Aurora I/II via Modbus
Pour une Aurora I/II avec une connexion RS485/Modbus. Nécessite une passerelle Modbus TCP. Lors de l'appairage, saisissez l'adresse IP de la passerelle, le port TCP et l'ID d'unité Modbus.
Tableau de bord local : http://HOMEY-IP:8090

Aurora III via Modbus
Pour une Aurora III avec une connexion RS485/Modbus. Nécessite une passerelle Modbus TCP et utilise la table de registres propre à l'Aurora III. Lors de l'appairage, saisissez l'adresse IP de la passerelle, le port TCP et l'ID d'unité Modbus.
Tableau de bord local : http://HOMEY-IP:8091

Remplacez HOMEY-IP par l'adresse IP locale de votre Homey Pro. Les ports indiqués sont les valeurs par défaut. Si vous avez modifié le port, utilisez celui que vous avez configuré.

SURVEILLANCE ET COMMANDE

Consultez les températures, l'état de fonctionnement, les défauts et les mesures disponibles de puissance, de consommation d'énergie et de débit d'eau. Commandez la marche et l'arrêt, le mode de fonctionnement, les consignes et les choix de courbe de chauffe pris en charge.

Utilisez les Flows Homey pour la commande, les notifications et les mesures externes. Suivez le COP et l'efficacité saisonnière ou utilisez la régulation adaptative facultative, l'apprentissage du modèle du bâtiment et l'optimisation du prix de l'énergie et du COP.

Les mesures, réglages et cartes Flow disponibles varient selon le modèle et le pilote. Les calculs du COP dépendent de données exploitables de puissance, de température et de débit d'eau.

TABLEAUX DE BORD LOCAUX

Les trois pilotes proposent des pages de tableau de bord pour la surveillance, la commande et le diagnostic.

Dashboard et Live affichent les valeurs disponibles et l'état de fonctionnement. La page interactive permet de modifier les réglages pris en charge. Expert offre une vue consultable par recherche des points de données ou des registres. La vue des modifications affiche les valeurs et les changements enregistrés. La page de courbe de chauffe présente les réglages de courbe et la régulation disponibles.

Tuya affiche les points de données DPS. Les pilotes Modbus affichent les registres du modèle de pompe à chaleur correspondant. Les fonctions disponibles dans les tableaux de bord varient selon le pilote.

INSTALLATION

Lors de l'ajout d'un appareil, choisissez le pilote correspondant au modèle de votre pompe à chaleur et à sa connexion.

Tuya nécessite les informations locales de l'appareil. Pour Modbus, la passerelle doit d'abord être correctement raccordée et configurée. Consultez le guide d'installation de votre modèle.

Une adresse IP locale fixe ou une réservation DHCP pour la pompe à chaleur ou la passerelle aide à éviter les problèmes de connexion.

Les commandes d'écriture avancées peuvent modifier les réglages de la pompe à chaleur. Vérifiez la fonction d'un réglage et notez sa valeur d'origine avant de le modifier.

DOCUMENTATION

La page du code source propose des guides sur l'appairage Tuya, les connexions Modbus, la configuration des passerelles, les tableaux de bord, les Flows Homey, le diagnostic des défauts, le COP, les courbes de chauffe et la régulation adaptative.
