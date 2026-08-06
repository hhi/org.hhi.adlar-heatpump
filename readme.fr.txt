Pilotez et surveillez localement votre pompe à chaleur Adlar Castra Aurora avec
Homey Pro. Cette application unique prend en charge deux méthodes de connexion :
l'API Tuya Local et Modbus RS485 via une passerelle Modbus TCP. Choisissez le
pilote correspondant à votre installation ; les deux fonctionnent sur votre
réseau local sans connexion cloud au quotidien.

🇬🇧 English  🇩🇪 Deutsch 🇫🇷 Français 🇳🇱 Nederlands

CHOISIR UN PILOTE

API TUYA LOCAL
- Sélectionnez "Adlar Castra Aurora Heat Pump (Tuya)"
- Nécessite l'ID de l'appareil, la clé locale, l'adresse IP locale et la
  version du protocole Tuya (3.3, 3.4 ou 3.5) de la pompe à chaleur
- Utilisez ce pilote pour une pompe à chaleur connectée en Wi-Fi

PASSERELLE MODBUS TCP
- Sélectionnez "Adlar Castra Aurora Heat Pump (Modbus)"
- Nécessite une connexion RS485/Modbus et une passerelle Modbus TCP accessible,
  telle qu'une Elfin EW11A
- Saisissez l'adresse IP de la passerelle, le port TCP et l'ID d'unité Modbus
- Les valeurs habituelles sont le port 502 et l'ID d'unité 1

FONCTIONNALITÉS PRINCIPALES
- Températures locales, état de fonctionnement, dégivrage, antigel,
  stérilisation et informations de défaut décodées
- Mesures de puissance, énergie, tension, courant, compresseur, ventilateur,
  vanne, pompe et débit d'eau lorsque la pompe à chaleur les prend en charge
- Commande marche/arrêt, mode de fonctionnement, consignes de chauffage, de
  refroidissement et d'eau chaude, ainsi que les courbes prises en charge
- Suivi du COP et de l'efficacité saisonnière avec les données disponibles de
  puissance, d'écart de température et de débit d'eau
- Cartes Flow Homey pour alertes, défauts, consignes, données externes et
  calculs avancés de courbe, de planning et de saison
- Régulation de température adaptative facultative, apprentissage du modèle du
  bâtiment, optimisation COP et du prix de l'énergie, et conseils météo

TABLEAUX DE BORD MODBUS

Le pilote Modbus fournit par défaut des tableaux de bord locaux sur
http://<homey-ip>:8090/ :
- /              aperçu en direct de la pompe à chaleur
- /interactive   aperçu avec commande directe des consignes
- /live          toutes les capacités par catégorie
- /expert        registres Modbus, ID de paramètres P/L et outils de lecture/écriture
- /changelog     changements de registres et recommandations d'interrogation
- /heating-curve éditeur de courbe de chauffe personnalisée

Remplacez <homey-ip> par l'adresse IP de votre Homey Pro. Le port des tableaux
de bord peut être modifié dans les paramètres de l'appareil.

IMPORTANT
- Les outils d'écriture Modbus avancés peuvent modifier le comportement de la
  pompe à chaleur. Utilisez-les uniquement si vous connaissez le registre et
  avez noté sa valeur d'origine.
- Le pilote Modbus cible la carte de registres R32 et avertit pour les autres
  fluides frigorigènes.
- Le COP peut être indisponible ou moins précis si les données de puissance ou
  de débit exploitables manquent.
- Un bail DHCP fixe ou une adresse IP statique pour la pompe à chaleur ou la
  passerelle aide à éviter les problèmes de reconnexion.

DOCUMENTATION

La page du code source contient les guides d'installation, de Flows, de COP et
de régulation avancée. Pour l'appairage Tuya :
/docs/setup/Tuya_LocalKey_Homey_Guide_FR.pdf et
/docs/setup/PROTOCOL_VERSION_GUIDE.fr.md.
