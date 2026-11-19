# Cartes Flow : référence

Cette référence décrit chaque carte Flow de l'application : ce que fait la
carte, pour quels pilotes elle existe, ses champs et un exemple.

Elle est générée à partir des cartes de l'application ; ne pas la modifier à la
main.

Les cartes avec au-dessus ou en dessous et un seuil se déclenchent à chaque
mesure qui change suffisamment tant que la valeur remplit la condition, donc pas
une seule fois au franchissement du seuil. Si une telle carte envoie une
notification, utilisez une variable Oui/Non pour éviter les répétitions (voir
l'exemple de l'alerte de débit d'eau).

Une introduction détaillée avec des scénarios se trouve dans
[FLOW_CARDS_GUIDE.fr.md](FLOW_CARDS_GUIDE.fr.md).

## Sommaire

- [Déclencheurs](#déclencheurs)
- [Conditions](#conditions)
- [Actions](#actions)

## Déclencheurs

### Déclencheurs: Commande et modes

#### Mode d'eau changé

**Déclencheur** · Aurora I/II via Tuya

Se déclenche lorsque le mode d'eau change

Tokens: Mode d'eau, Mode d'eau précédent

**Exemple:** c'est un réglage d'installation qui ne change normalement pas ;
créez une notification quand il change.

```text
QUAND Mode d'eau changé
ALORS Créer une notification « Mode d'eau changé en [Mode d'eau] »
```

#### Mode de chauffage changé

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque le mode de chauffage change

Tokens: Mode de chauffage, Mode de chauffage précédent

**Exemple:** recevez une notification quand quelqu'un change le mode sur le
panneau de commande.

```text
QUAND Mode de chauffage changé
ALORS Envoyer une notification push « Mode actuel : [Mode de chauffage] »
```

#### Mode de fonctionnement changé

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus

Se déclenche lorsque le mode de fonctionnement change (ECO, Normal, Boost)

Tokens: Mode de fonctionnement, Mode de fonctionnement précédent

**Exemple:** gardez une trace du moment où Boost s'active.

```text
QUAND Mode de fonctionnement changé
ET Le mode de fonctionnement est Boost
ALORS Envoyer une notification push « Boost est actif »
```

### Déclencheurs: Températures, défauts et alertes

#### Alerte d'efficacité du compresseur (Expert)

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Aurora I/II via Tuya, Aurora III via Modbus: Se déclenche lorsque la fréquence
du compresseur dépasse ou descend en dessous d'un niveau spécifié. Nécessite
'Activer les cartes de fonctionnalités d'expert' dans les paramètres de
l'appareil.

Aurora I/II via Modbus: Se déclenche lorsque la fréquence du compresseur dépasse
ou descend en dessous d'un niveau spécifié.

- Condition: au-dessus, en dessous
- Fréquence : nombre, 10 à 200 Hz

Tokens: Fréquence actuelle, Fréquence seuil

**Exemple:** notez quand le compresseur tourne à haut régime. La version Tuya
exige que le réglage des cartes Expert soit activé.

```text
QUAND Fréquence du compresseur au-dessus 90 Hz
ALORS Créer une notification « Compresseur à [Fréquence actuelle] Hz »
```

#### Alerte d'efficacité du moteur de ventilateur (Expert)

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Aurora I/II via Tuya, Aurora III via Modbus: Se déclenche lorsque la fréquence
du moteur de ventilateur dépasse ou descend en dessous d'un niveau spécifié.
Nécessite 'Activer les cartes de fonctionnalités d'expert' dans les paramètres
de l'appareil.

Aurora I/II via Modbus: Se déclenche lorsque la fréquence du moteur de
ventilateur dépasse ou descend en dessous d'un niveau spécifié.

- Condition: au-dessus, en dessous
- Fréquence : nombre, 10 à 100 Hz

Tokens: Fréquence actuelle du ventilateur, Fréquence seuil

**Exemple:** notez quand le ventilateur tourne à haut régime. La version Tuya
exige que le réglage des cartes Expert soit activé.

```text
QUAND Fréquence du moteur de ventilateur au-dessus 60 Hz
ALORS Créer une notification
    « Ventilateur à [Fréquence actuelle du ventilateur] Hz »
```

#### Alerte de débit d'eau (Expert)

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Aurora I/II via Tuya, Aurora III via Modbus: Se déclenche lorsque le débit d'eau
dépasse ou descend en dessous d'un niveau spécifié. Nécessite 'Activer les
cartes de fonctionnalités d'expert' dans les paramètres de l'appareil.

Aurora I/II via Modbus: Se déclenche lorsque le débit d'eau dépasse ou descend
en dessous d'un niveau spécifié.

- Condition: au-dessus, en dessous
- Débit (L/min): nombre, 0 à 100 L/min

Tokens: Débit actuel, Débit seuil

**Exemple:** une seule notification en cas de débit trop faible, avec une
variable Oui/Non Alerte débit contre les répétitions. La version Tuya exige que
le réglage des cartes Expert soit activé.

```text
QUAND Débit d'eau en dessous 10 L/min
ET Le compresseur est en marche
ET Alerte débit est égal à non
ALORS Envoyer une notification push « Débit faible : [Débit actuel] L/min »
ET Définir une variable Oui/Non : Alerte débit sur oui

QUAND Débit d'eau au-dessus 15 L/min
ALORS Définir une variable Oui/Non : Alerte débit sur non
```

#### Alerte de pas d'impulsion EEV

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque les pas d'impulsion du détendeur électronique (EEV)
dépassent ou descendent en dessous d'un niveau spécifié

- Condition: au-dessus, en dessous
- Pas: nombre, 0 à 500 Pulse-steps

Tokens: Pas d'impulsion d'ouverture EEV actuels, Pas d'impulsion seuil

**Exemple:** notez quand le détendeur se ferme fortement, pour aider à
rechercher un défaut.

```text
QUAND Pas d'impulsion EEV en dessous 50
ALORS Créer une notification « EEV [Pas d'impulsion d'ouverture EEV actuels] »
```

#### Alerte de pas d'impulsion EVI

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque les pas d'impulsion Enhanced Vapor Injection (EVI)
dépassent ou descendent en dessous d'un niveau spécifié

- Condition: au-dessus, en dessous
- Pas: nombre, 0 à 500 Pulse-steps

Tokens: Pas d'impulsion d'ouverture EVI actuels, Pas d'impulsion seuil

**Exemple:** notez à quel point la vanne EVI s'ouvre, pour aider à rechercher un
défaut.

```text
QUAND Pas d'impulsion d'ouverture EVI au-dessus 300
ALORS Créer une notification « EVI [Pas d'impulsion d'ouverture EVI actuels] »
```

#### Alerte de température basse pression

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus

Se déclenche lorsque la température de saturation basse pression dépasse ou
descend en dessous d'un niveau spécifié

- Condition: au-dessus, en dessous
- Température : nombre, -30 à 50 °C

Tokens: Température basse pression actuelle, Température seuil

**Exemple:** notez quand le côté basse pression devient très froid.

```text
QUAND Température basse pression en dessous -20°C
ALORS Créer une notification « [Température basse pression actuelle] °C »
```

#### Alerte de température d'aspiration

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque la température d'aspiration dépasse ou descend en dessous
d'un niveau spécifié

- Condition: au-dessus, en dessous
- Température : nombre, -30 à 50 °C

Tokens: Température d'aspiration actuelle, Température seuil

**Exemple:** notez quand le gaz d'aspiration devient très froid.

```text
QUAND Température d'aspiration en dessous -20°C
ALORS Créer une notification
    « Aspiration [Température d'aspiration actuelle] °C »
```

#### Alerte de température d'entrée de l'économiseur

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus

Se déclenche lorsque la température d'entrée de l'économiseur dépasse ou descend
en dessous d'un niveau spécifié

- Condition: au-dessus, en dessous
- Température : nombre, -30 à 80 °C

Tokens: Température d'entrée actuelle de l'économiseur, Température seuil

**Exemple:** suivez l'économiseur (échangeur EVI) lors de la recherche d'un
défaut.

```text
QUAND Température d'entrée de l'économiseur en dessous -10°C
ALORS Créer une notification
    « [Température d'entrée actuelle de l'économiseur] °C »
```

#### Alerte de température de refoulement

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque la température de refoulement dépasse ou descend en dessous
d'un niveau spécifié

- Condition: au-dessus, en dessous
- Température : nombre, 0 à 120 °C

Tokens: Température de refoulement actuelle, Température seuil

**Exemple:** envoyez une notification quand le compresseur devient trop chaud.

```text
QUAND Température de refoulement au-dessus 105°C
ALORS Envoyer une notification push « Refoulement au-dessus de 105 °C »
```

#### Alerte de température de sortie de l'économiseur

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus

Se déclenche lorsque la température de sortie de l'économiseur dépasse ou
descend en dessous d'un niveau spécifié

- Condition: au-dessus, en dessous
- Température : nombre, -30 à 80 °C

Tokens: Température de sortie actuelle de l'économiseur, Température seuil

**Exemple:** suivez l'économiseur (échangeur EVI) lors de la recherche d'un
défaut.

```text
QUAND Température de sortie de l'économiseur au-dessus 60°C
ALORS Créer une notification
    « [Température de sortie actuelle de l'économiseur] °C »
```

#### Alerte de température du ballon

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque la température du ballon dépasse ou descend en dessous d'un
niveau spécifié

- Condition: au-dessus, en dessous
- Température : nombre, 0 à 90 °C

Tokens: Température actuelle du ballon, Température seuil

**Exemple:** indiquez avec un interrupteur virtuel si le ballon est chaud.

```text
QUAND Température du ballon au-dessus 50°C
ALORS Allumer Ballon chaud (interrupteur virtuel)

QUAND Température du ballon en dessous 40°C
ALORS Éteindre Ballon chaud
```

#### Alerte de température du condenseur

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus

Se déclenche lorsque la température du condenseur dépasse ou descend en dessous
d'un niveau spécifié

- Condition: au-dessus, en dessous
- Température : nombre, -20 à 80 °C

Tokens: Température actuelle du condenseur, Température seuil

**Exemple:** notez quand le condenseur devient très chaud.

```text
QUAND Température du condenseur au-dessus 60°C
ALORS Créer une notification
    « Condenseur [Température actuelle du condenseur] °C »
```

#### Alerte de température du serpentin

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque la température du serpentin dépasse ou descend en dessous
d'un niveau spécifié

- Condition: au-dessus, en dessous
- Température : nombre, -20 à 80 °C

Tokens: Température actuelle du serpentin, Température seuil

**Exemple:** notez quand le serpentin extérieur devient très froid, pour aider à
rechercher le givrage.

```text
QUAND Température du serpentin en dessous -15°C
ALORS Créer une notification « [Température actuelle du serpentin] °C »
```

#### Alerte de température haute pression

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus

Se déclenche lorsque la température de saturation haute pression dépasse ou
descend en dessous d'un niveau spécifié

- Condition: au-dessus, en dessous
- Température : nombre, -20 à 100 °C

Tokens: Température haute pression actuelle, Température seuil

**Exemple:** notez quand le côté haute pression devient très chaud.

```text
QUAND Température haute pression au-dessus 55°C
ALORS Créer une notification « [Température haute pression actuelle] °C »
```

#### Défaut détecté

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsqu'un défaut du système est détecté

- code (Aurora I/II via Tuya): nombre, 1 à 100
- code (Aurora I/II via Modbus, Aurora III via Modbus): texte

Tokens: Code de défaut, Description du défaut

**Exemple:** recevez une notification pour un défaut précis. Sur les pilotes
Modbus, le code est un texte comme sur l'afficheur (par exemple F1.1 ou E03),
sur Tuya un nombre. Pour tous les défauts ensemble, utilisez la condition Le
défaut est actif.

```text
QUAND Défaut F1.1 détecté
ALORS Envoyer une notification push
    « Défaut [Code de défaut] : [Description du défaut] »
```

#### La température d'entrée a changé

**Déclencheur** · Aurora I/II via Modbus · Aurora III via Modbus

Se déclenche lorsque la température d'entrée d'eau change d'au moins 0,5°C

Tokens: Température d'entrée actuelle, Température d'entrée précédente,
Variation de température

**Exemple:** gardez la température de retour dans une variable numérique, par
exemple pour un autre flow. La carte se déclenche à chaque variation d'au moins
0,5 °C.

```text
QUAND La température d'entrée a changé
ALORS Définir une variable numérique : Retour sur
    [Température d'entrée actuelle]
```

#### La température de sortie a changé

**Déclencheur** · Aurora I/II via Modbus · Aurora III via Modbus

Se déclenche lorsque la température de sortie d'eau change d'au moins 0,5°C

Tokens: Température de sortie actuelle, Température de sortie précédente,
Variation de température

**Exemple:** gardez la température de départ dans une variable numérique. La
carte se déclenche à chaque variation d'au moins 0,5 °C.

```text
QUAND La température de sortie a changé
ALORS Définir une variable numérique : Départ sur
    [Température de sortie actuelle]
```

#### Température ambiante changée

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Déclenché lorsque la température ambiante change au-dessus ou en dessous d'un
niveau spécifié - utile pour la compensation météorologique

- Condition: au-dessus, en dessous
- Température : nombre, -30 à 50 °C

Tokens: Température ambiante actuelle

**Exemple:** éteignez un interrupteur virtuel Saison de chauffage quand il fait
chaud dehors. Un interrupteur déjà éteint reste éteint, les répétitions ne
posent donc pas de problème.

```text
QUAND Température ambiante changée au-dessus 18°C
ALORS Éteindre Saison de chauffage (interrupteur virtuel)
```

#### Température d'entrée changée

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque la température d'entrée d'eau dépasse ou descend en dessous
d'un niveau spécifié

- Condition: au-dessus, en dessous
- Température : nombre, -20 à 80 °C

Tokens: Température d'entrée actuelle

**Exemple:** allumez un interrupteur virtuel Retour chaud dès que l'eau de
retour est assez chaude.

```text
QUAND Température d'entrée changée au-dessus 30°C
ALORS Allumer Retour chaud (interrupteur virtuel)
```

#### Température de sortie changée

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque la température de sortie d'eau dépasse ou descend en
dessous d'un niveau spécifié

- Condition: au-dessus, en dessous
- Température : nombre, -20 à 80 °C

Tokens: Température de sortie actuelle

**Exemple:** avertissez quand le départ devient trop chaud pour le plancher
chauffant. La carte se déclenche à nouveau à chaque hausse supplémentaire de 0,5
°C.

```text
QUAND Température de sortie changée au-dessus 45°C
ET Le mode de chauffage est Chauffage au sol
ALORS Envoyer une notification push
    « Départ [Température de sortie actuelle] °C »
```

### Déclencheurs: Énergie et rendement (COP)

#### Efficacité COP changée

**Déclencheur** · Aurora I/II via Tuya

Se déclenche lorsque le coefficient de performance (COP) dépasse ou descend en
dessous d'un seuil spécifié

- Condition: au-dessus, en dessous
- Seuil COP: nombre, 1 à 8 COP

Tokens: COP actuel, COP précédent, Changement du COP, Méthode de calcul
utilisée, Niveau de confiance

**Exemple:** notez un COP bas, avec la méthode de calcul utilisée. La carte
réagit à chaque variation d'au moins 0,3.

```text
QUAND Efficacité COP changée en dessous 2
ET Le compresseur est en marche
ALORS Créer une notification « COP [COP actuel] ([Méthode de calcul utilisée]) »
```

#### Efficacité COP mensuelle changée

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque le COP moyen sur 30 jours dépasse ou descend en dessous
d'un seuil spécifié

- Condition: au-dessus, en dessous
- Seuil COP mensuel: nombre, 1 à 8 COP

Tokens: COP mensuel actuel, COP mensuel précédent, Changement du COP

**Exemple:** suivez le rendement sur 30 jours. La carte réagit à chaque
variation d'au moins 0,2.

```text
QUAND Efficacité COP mensuelle changée en dessous 3
ALORS Envoyer une notification push « COP mensuel [COP mensuel actuel] »
```

#### Efficacité COP quotidienne changée

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque le COP moyen sur 24 heures dépasse ou descend en dessous
d'un seuil spécifié

- Condition: au-dessus, en dessous
- Seuil COP quotidien: nombre, 1 à 8 COP

Tokens: COP quotidien actuel, COP quotidien précédent, Changement du COP

**Exemple:** notez quand le COP quotidien passe sous une limite. La carte réagit
à chaque variation d'au moins 0,2.

```text
QUAND Efficacité COP quotidienne changée en dessous 3
ALORS Créer une notification « COP quotidien [COP quotidien actuel] »
```

#### Jalon de consommation totale atteint

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque la consommation totale d'électricité atteint les jalons
spécifiés

- Jalon de consommation (kWh): nombre, 100 à 50000 kWh

Tokens: Consommation totale, Valeur jalon

**Exemple:** un rappel à un jalon de consommation, par exemple pour l'entretien.

```text
QUAND Consommation totale atteinte 10000 kWh
ALORS Envoyer une notification push
    « [Consommation totale] kWh : prévoir l'entretien »
```

#### Le rapport de performance est prêt

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Déclenché quotidiennement à 23h00 avec un rapport de performance complet.
Utilisez en combinaison avec une action de notification pour recevoir des
résumés quotidiens.

Tokens: Score global (0-100), Évaluation, Résumé, Recommandations, Rapport
complet (JSON)

**Exemple:** recevez un court résumé chaque soir à 23:00.

```text
QUAND Le rapport de performance est prêt
ALORS Envoyer une notification push « [Évaluation] : [Résumé] »
```

#### Seuil de consommation quotidienne atteint

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque la consommation d'électricité quotidienne atteint le seuil
spécifié

- Seuil quotidien (kWh): nombre, 1 à 100 kWh

Tokens: Consommation quotidienne, Valeur seuil

**Exemple:** recevez une notification par jour dès que la consommation atteint
une limite.

```text
QUAND Consommation quotidienne atteinte 30 kWh
ALORS Envoyer une notification push
    « Déjà [Consommation quotidienne] kWh aujourd'hui »
```

#### Seuil de coût énergétique quotidien dépassé

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque le coût énergétique total d'aujourd'hui dépasse le montant
spécifié (nécessite l'optimiseur de prix)

- Seuil de coût (€): nombre, 1 à 50

Tokens: Coût Total Aujourd'hui (€), Consommation Aujourd'hui (kWh), Prix Moyen
Aujourd'hui (€/kWh)

**Exemple:** recevez une notification par jour quand les coûts d'énergie
dépassent un montant. Fonctionne seulement avec l'optimisation des prix et une
mesure d'énergie externe.

```text
QUAND Coût quotidien dépassé €5
ALORS Envoyer une notification push
    « Coût aujourd'hui € [Coût Total Aujourd'hui (€)] »
```

#### Seuil de puissance dépassé

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque la consommation dépasse le seuil spécifié (nécessite la
surveillance de la puissance)

- Seuil de puissance (W): nombre, 100 à 10000 W

Tokens: Consommation actuelle, Puissance seuil

**Exemple:** notez quand la pompe à chaleur demande beaucoup de puissance. La
carte se déclenche une fois au dépassement, et à nouveau seulement après une
baisse de la puissance. Nécessite une mesure de puissance.

```text
QUAND Consommation dépassée 3000 W
ALORS Créer une notification « Puissance [Consommation actuelle] W »
```

#### Tendance COP détectée

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque le COP montre une tendance significative à l'amélioration
ou à la dégradation au cours des dernières 24 heures

- Type de tendance: amélioration, détérioration, tout changement de tendance

Tokens: Direction de la tendance, Force de la tendance, Description de la
tendance, COP quotidien actuel

**Exemple:** recevez une notification quand le rendement baisse nettement sur
les dernières 24 heures.

```text
QUAND Tendance COP détectée: détérioration
ALORS Envoyer une notification push « [Description de la tendance] »
```

#### Valeur aberrante COP détectée

**Déclencheur** · Aurora I/II via Tuya

Se déclenche lorsqu'une valeur COP invalide ou suspecte est détectée, indiquant
des problèmes potentiels de capteur

Tokens: Valeur COP aberrante, Raison de l'aberration, Méthode de calcul utilisée

**Exemple:** une valeur aberrante indique souvent un capteur faux ou une mesure
de puissance manquante ; notez-la dans la chronologie.

```text
QUAND Valeur aberrante COP détectée
ALORS Créer une notification
    « COP [Valeur COP aberrante] : [Raison de l'aberration] »
```

### Déclencheurs: Prix de l'énergie

#### Bloc le moins cher commencé

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque le bloc de prix d'électricité le moins cher de la journée
commence. Utilisez-le pour maximiser la consommation d'énergie pendant les
périodes à bas prix.

Tokens: Heure de Début du Bloc, Heure de Fin du Bloc, Prix Moyen (€/kWh), Durée
du Bloc (heures)

**Exemple:** chauffez davantage l'eau chaude dans le bloc le moins cher et
remettez-la ensuite, avec un délai sur la deuxième carte d'action. La durée du
bloc se règle dans Taille du Bloc de Prix (heures), 4 par défaut. Fonctionne
seulement si le contrôle adaptatif tourne (avec une température intérieure), si
l'optimisation des prix est activée et si les prix arrivent par Envoyer les prix
de l'énergie externes.

```text
QUAND Bloc le moins cher commencé
ALORS Régler la température de l'eau chaude sur 55
ET Régler la température de l'eau chaude sur 48 (délai 4 heures)
```

#### Période coûteuse approche

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche N heures avant le début du bloc de prix d'électricité le plus cher.
Utilisez-le pour préchauffer ou préparer avant les périodes à prix élevés.

Tokens: Heure de Début du Bloc, Prix Moyen (€/kWh), Durée du Bloc (heures)

**Exemple:** passez la pompe à chaleur en ECO avant le début de la période
coûteuse. Le nombre d'heures d'avance se règle dans Temps d'Avertissement Bloc
Coûteux (heures), 2 par défaut. L'Aurora III n'a pas d'ECO. Fonctionne seulement
si le contrôle adaptatif tourne (avec une température intérieure), si
l'optimisation des prix est activée et si les prix arrivent par Envoyer les prix
de l'énergie externes.

```text
QUAND Période coûteuse approche
ALORS Régler le mode de fonctionnement sur ECO
ET Envoyer une notification push « Cher à partir de [Heure de Début du Bloc] »
```

#### Seuil de prix de l'énergie franchi

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque la catégorie de prix de l'énergie change (very_low, low,
normal, high, very_high)

Tokens: Catégorie de Prix, Prix Actuel (€/kWh), Prix Heure Suivante (€/kWh)

**Exemple:** ECO à un prix très élevé et retour à Normal pour toute autre
catégorie. La catégorie est un code : very_low, low, normal, high ou very_high.
Fonctionne seulement si le contrôle adaptatif tourne (avec une température
intérieure), si l'optimisation des prix est activée et si les prix arrivent par
Envoyer les prix de l'énergie externes.

```text
QUAND Seuil de prix de l'énergie franchi
ET [Catégorie de Prix] est exactement very_high
ALORS Régler le mode de fonctionnement sur ECO
SINON Régler le mode de fonctionnement sur Normal
```

#### Tendance des prix changée

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque la direction de la tendance des prix de l'électricité
change (en hausse, en baisse, stable). Basé sur une analyse de régression
linéaire avec seuil de confiance.

Tokens: Tendance Précédente, Nouvelle Tendance, Heures Analysées

**Exemple:** créez une notification quand les prix commencent à monter ou à
baisser. Fonctionne seulement si le contrôle adaptatif tourne (avec une
température intérieure), si l'optimisation des prix est activée et si les prix
arrivent par Envoyer les prix de l'énergie externes.

```text
QUAND Tendance des prix changée
ALORS Créer une notification
    « Tendance [Tendance Précédente] vers [Nouvelle Tendance] »
```

### Déclencheurs: Contrôle adaptatif et modèle de bâtiment

#### Conseil de chauffage prévisionnel disponible

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsqu'un nouveau conseil de chauffage optimisé COP est disponible
basé sur la prévision de température

Tokens: Délai (heures), COP attendu, COP actuel, Conseil

**Exemple:** recevez le conseil basé sur la température extérieure prévue :
attendre parce qu'il fera plus chaud et donc plus efficace plus tard, ou
chauffer maintenant. La carte se déclenche quand le conseil change. Nécessite
les prévisions météo dans les réglages. Le texte du conseil est actuellement
toujours en néerlandais.

```text
QUAND Conseil de chauffage prévisionnel disponible
ALORS Créer une notification « [Conseil] »
```

#### Contrôle adaptatif recommande un ajustement de température

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Déclenché lorsque le contrôle adaptatif calcule un ajustement recommandé
(uniquement si action significative). Utilisez building_model_confidence pour
filtrer. Utilisez 'Régler la température cible (consigne)' pour appliquer.
Aurora I/II via Modbus : la recommandation suit le mode de la pompe à chaleur
(consigne de chauffage en modes chauffage, consigne de plancher chauffant en
modes plancher chauffant) ; appliquez-la avec 'Régler la température de consigne
(par mode)' sur Auto.

Tokens: Température cible actuelle, Température cible recommandée, Ajustement de
température, Raison de l'ajustement, Contrôleur, Confiance du Modèle (%), Mode
de contrôle

**Exemple:** c'est le cœur du contrôle adaptatif : le contrôle ne règle pas
lui-même la consigne, ce flow exécute la recommandation. Sur l'Aurora I/II via
Modbus, la recommandation suit le mode ; utilisez-y Régler la température de
consigne (par mode) sur Auto. Sur l'Aurora I/II, la consigne ne reste que si la
courbe de chauffage est sur ARRÊT.

```text
QUAND Contrôle adaptatif recommande un ajustement de température
ALORS Régler la température cible (consigne) sur
    [Température cible recommandée] Arrondir automatiquement (recommandé)
```

#### Désaccord de profil de bâtiment détecté

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque le comportement du bâtiment appris diffère
significativement du profil sélectionné (>30% de déviation). Suggère un profil
optimal pour un apprentissage plus rapide.

Tokens: Profil Actuel, Profil Suggéré, τ Appris (heures), τ du Profil (heures),
Déviation (%), Confiance (%)

**Exemple:** le comportement appris ne correspond pas au type de bâtiment
choisi. Choisissez le type proposé dans les réglages (Type de Bâtiment) pour
apprendre plus vite.

```text
QUAND Désaccord de profil de bâtiment détecté
ALORS Envoyer une notification push « Le type [Profil Suggéré] convient mieux »
```

#### État du contrôle adaptatif modifié

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Déclenché lorsque le contrôle adaptatif de température est activé ou désactivé

Tokens: État, Raison

**Exemple:** recevez une notification quand le contrôle adaptatif s'active ou se
désactive.

```text
QUAND État du contrôle adaptatif modifié
ALORS Envoyer une notification push « Contrôle adaptatif [État] : [Raison] »
```

#### Jalon d'apprentissage du modèle de bâtiment

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque le modèle thermique du bâtiment atteint un jalon
d'apprentissage (par exemple, 70% de confiance)

Tokens: Jalon, Confiance, Masse Thermique (kWh/°C), Constante de Temps (heures)

**Exemple:** recevez une notification quand le modèle de bâtiment atteint 70% de
confiance. Après un nouveau départ de l'apprentissage, la carte se déclenche à
nouveau.

```text
QUAND Jalon d'apprentissage du modèle de bâtiment
ALORS Envoyer une notification push « Modèle de bâtiment : [Jalon] »
```

#### Nouvel aperçu du bâtiment détecté

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque le modèle du bâtiment détecte un aperçu de performance
actionnable (≥70% de confiance). Utilisez des jetons pour filtrer par catégorie
et potentiel d'économies.

Tokens: Catégorie, Aperçu, Recommandation, Priorité (0-100), Confiance (%),
Économies Estimées (€/mois, plus calculées)

**Exemple:** recevez un nouvel aperçu sur le logement dès que le modèle de
bâtiment est assez fiable (réglage Confiance Minimale (%), 70% par défaut).

```text
QUAND Nouvel aperçu du bâtiment détecté
ALORS Envoyer une notification push « [Aperçu] [Recommandation] »
```

#### Recommandation de temps de préchauffage

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche lorsque ΔT (cible - intérieur) dépasse 1.5°C. Fournit la durée de
préchauffage basée sur la réponse thermique du bâtiment (τ). Nécessite ≥70% de
confiance du modèle. Max 1x par 4 heures.

Tokens: Durée (heures), Augmentation de Température (°C), Température Actuelle
(°C), Température Cible (°C), Confiance (%)

**Exemple:** la carte se déclenche quand il fait plus de 1,5 °C de moins que
souhaité et que le modèle de bâtiment est assez fiable (réglage Confiance
Minimale (%), 70% par défaut), au plus une fois toutes les 4 heures.

```text
QUAND Recommandation de temps de préchauffage
ALORS Envoyer une notification push
    « Le réchauffage dure [Durée (heures)] heures »
```

#### Température simulée mise à jour

**Déclencheur** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Se déclenche à chaque cycle de contrôle (5 min) avec une répartition complète du
calcul du contrôle adaptatif. Utilisez pour la surveillance, la journalisation
et le filtrage basé sur la confiance. Filtrez sur building_model_confidence pour
n'agir que sur des recommandations à haute confiance.

Tokens: Cible Simulée (°C), Cible Réelle (°C), Différence (°C), Ajustement (°C),
Composante Confort (°C), Composante Efficacité (°C), Composante Coût (°C),
Confiance du Modèle de Bâtiment (%), Confiance COP (%), Composante coast (°C),
Raisonnement

**Exemple:** la carte se déclenche à chaque cycle de régulation (environ toutes
les 5 minutes). Utilisez-la pour garder des valeurs, pas pour des notifications.

```text
QUAND Température cible simulée mise à jour
ALORS Définir une variable numérique : Conseil sur [Cible Simulée (°C)]
```

## Conditions

### Conditions: Commande et modes

#### L'alimentation de l'appareil est

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si l'état d'alimentation de l'appareil correspond à l'état sélectionné

- État d'alimentation: Marche, Arrêt

**Exemple:** n'abaissez la consigne que si la pompe à chaleur est en marche.

```text
QUAND La dernière personne part
ET L'alimentation de l'appareil est Marche
ALORS Régler la température cible (consigne) sur 30
```

#### L'eau chaude est en chauffe

**Condition** · Aurora III via Modbus

Vérifier si la pompe à chaleur chauffe actuellement l'eau chaude sanitaire

**Exemple:** n'activez le mode silencieux qu'une fois que la pompe à chaleur ne
chauffe plus l'eau chaude.

```text
QUAND L'heure est 22:00
ET L'eau chaude n'est pas en chauffe
ALORS Régler le mode silencieux sur Niveau 2
```

#### La température cible (consigne) est

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si la température cible (consigne) correspond à la condition spécifiée

- Comparaison: Égal à, Supérieur à, Inférieur à
- Température (Aurora I/II via Tuya): nombre, 5 à 60 °C
- Température (Aurora I/II via Modbus, Aurora III via Modbus): nombre, 15 à 60
  °C

**Exemple:** n'abaissez la consigne la nuit que si elle est plus haute que la
valeur de nuit.

```text
QUAND L'heure est 23:00
ET La température cible (consigne) est Supérieur à 35°C
ALORS Régler la température cible (consigne) sur 32
```

#### La température de l'eau chaude est

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si la température de l'eau chaude correspond à la condition spécifiée

- Comparaison: Égal à, Supérieur à, Inférieur à
- Température de l'eau chaude : nombre, 20 à 75 °C

**Exemple:** la carte compare la consigne d'eau chaude, pas la température
mesurée du ballon. Remettez la consigne si elle est restée trop haute après une
hausse.

```text
QUAND L'heure est 23:00
ET La température de l'eau chaude est Supérieur à 50°C
ALORS Régler la température de l'eau chaude sur 48
```

#### La vérification de la consommation électrique est

**Condition** · Aurora I/II via Tuya

Vérifier si le niveau de vérification de la consommation électrique correspond à
la condition spécifiée

- Comparaison: Égal à, Supérieur à, Inférieur à
- Vérification de la consommation électrique: nombre, 0 à 2

**Exemple:** ce réglage indique quel module de puissance équipe la pompe à
chaleur (0 = aucun, 1 = monophasé, 2 = triphasé). Utilisez la carte pour
vérifier que la valeur est toujours correcte, par exemple après un défaut.

```text
QUAND L'heure est 08:00
ET La vérification de la consommation électrique n'est pas Égal à 1
ALORS Envoyer une notification push « Réglage du module de puissance modifié »
```

#### Le compresseur est en marche

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si le compresseur est actuellement en marche

**Exemple:** recevez une notification si le compresseur tourne encore quand une
période coûteuse commence.

```text
QUAND Période coûteuse approche
ET Le compresseur est en marche
ALORS Envoyer une notification push « La pompe tourne en période coûteuse »
```

#### Le mode de chauffage est

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si le mode de chauffage correspond au mode sélectionné

- Mode de chauffage (Aurora I/II via Tuya, Aurora I/II via Modbus): Froid,
  Chauffage, Chauffage au sol, Eau chaude, Froid et eau chaude, Chauffage et eau
  chaude, Chauffage au sol et eau chaude
- Mode de chauffage (Aurora III via Modbus): Arrêt, Froid, Chauffage, Auto

**Exemple:** passez en mai à l'eau chaude seule, mais seulement si la pompe à
chaleur est encore sur chauffage et eau chaude. L'Aurora III a d'autres modes
(Refroidissement, Chauffage, Auto) et pas de mode eau chaude séparé.

```text
QUAND L'heure est 08:00
ET Le jour et le mois sont 1er mai
ET Le mode de chauffage est Chauffage et eau chaude
ALORS Régler le mode de chauffage sur Eau chaude
```

#### Le mode de contrôle de l'eau est

**Condition** · Aurora I/II via Tuya

Vérifier si le mode de contrôle de l'eau correspond à la condition spécifiée

- Comparaison: Égal à, Supérieur à, Inférieur à
- Mode de contrôle de l'eau: nombre, 0 à 1

**Exemple:** c'est un réglage d'installation ; utilisez la carte pour signaler
une valeur inattendue.

```text
QUAND L'heure est 08:00
ET Le mode de contrôle de l'eau n'est pas Égal à 0
ALORS Envoyer une notification push « Mode de contrôle de l'eau sur 1 »
```

#### Le mode de fonctionnement est

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus

Vérifier si le mode de fonctionnement correspond au mode sélectionné

- Mode de fonctionnement: ECO, Normal, Boost

**Exemple:** remettez la pompe à chaleur sur Normal le matin si elle est encore
sur ECO.

```text
QUAND L'heure est 07:00
ET Le mode de fonctionnement est ECO
ALORS Régler le mode de fonctionnement sur Normal
```

#### Le mode silencieux est

**Condition** · Aurora III via Modbus

Vérifier le niveau du mode silencieux de la pompe à chaleur

- Mode silencieux: Arrêt, Niveau 1, Niveau 2

**Exemple:** désactivez le mode silencieux le matin s'il est encore actif.

```text
QUAND L'heure est 07:00
ET Le mode silencieux n'est pas Arrêt
ALORS Régler le mode silencieux sur Arrêt
```

#### Le réglage de la courbe d'eau chaude est

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus

Vérifier si le réglage de la courbe d'eau chaude correspond au réglage
sélectionné

- Réglage de la courbe d'eau chaude: ARRÊT, H1, H2, H3, H4

**Exemple:** réactivez la courbe d'eau chaude le soir si elle est arrêtée.

```text
QUAND L'heure est 22:00
ET Le réglage de la courbe d'eau chaude est ARRÊT
ALORS Régler la courbe d'eau chaude sur H2
```

#### Le réglage de la courbe de chauffage est

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus

Vérifier si le réglage de la courbe de chauffage correspond à la courbe
sélectionnée

- Courbe de chauffage: ARRÊT, H1, H2, H3, H4, H5, H6, H7, H8, L1, L2, L3, L4,
  L5, L6, L7, L8 - Courbe personnalisée

**Exemple:** ne modifiez la consigne que si la courbe de chauffage est sur ARRÊT
; avec une courbe, la pompe à chaleur fixe elle-même la température de départ et
ne garde pas une consigne réglée.

```text
QUAND L'heure est 06:00
ET Le réglage de la courbe de chauffage est ARRÊT
ALORS Régler la température cible (consigne) sur 40
```

### Conditions: Températures, défauts et alertes

#### Température ambiante au-dessus

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si la température ambiante est au-dessus ou en dessous d'une valeur
spécifique

- Température: nombre, -30 à 50 °C

**Exemple:** chauffez davantage l'eau chaude dans le bloc le moins cher, mais
seulement quand il fait froid dehors.

```text
QUAND Bloc le moins cher commencé
ET La température ambiante est en dessous de 5°C
ALORS Régler la température de l'eau chaude sur 55
ET Régler la température de l'eau chaude sur 48 (délai 4 heures)
```

#### Un défaut est actif

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si un défaut est actuellement actif (code défaut > 0)

**Exemple:** recevez un rappel chaque matin tant qu'un défaut est encore actif.

```text
QUAND L'heure est 08:00
ET Le défaut est actif
ALORS Envoyer une notification push
    « La pompe à chaleur signale encore un défaut »
```

#### Vérification de l'équilibre électrique

**Condition** · Aurora I/II via Tuya

Vérifier si les courants électriques triphasés sont équilibrés dans la tolérance
spécifiée

- Tolérance d'équilibre : nombre, 1 à 20 %

**Exemple:** vérifiez chaque jour si les trois phases sont chargées à peu près
également.

```text
QUAND L'heure est 12:00
ET Le compresseur est en marche
ET L'équilibre électrique triphasé est hors de 10% de tolérance
ALORS Envoyer une notification push « Phases chargées inégalement »
```

#### Vérification du débit d'eau

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si le débit d'eau est au-dessus ou en dessous du seuil spécifié

- Débit (L/min): nombre, 1 à 100 L/min

**Exemple:** vérifiez le débit à heure fixe pendant que le compresseur tourne.

```text
QUAND L'heure est 10:00
ET Le compresseur est en marche
ET Le débit d'eau est en dessous de 15 L/min
ALORS Envoyer une notification push « Débit faible, vérifiez le filtre »
```

#### Vérification du différentiel de température

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si la différence de température entre l'entrée et la sortie est
au-dessus ou en dessous d'un seuil

- Différentiel de température : nombre, 1 à 50 °C

**Exemple:** un grand écart entre départ et retour peut indiquer un débit trop
faible.

```text
QUAND L'heure est 14:00
ET Le compresseur est en marche
ET Le différentiel de température est au-dessus de 8°C
ALORS Envoyer une notification push « Grand écart départ et retour »
```

#### Vérification du différentiel des pas d'impulsion

**Condition** · Aurora I/II via Tuya

Vérifier si la différence des pas d'impulsion entre EEV et EVI est au-dessus ou
en dessous d'un seuil

- Différentiel des pas d'impulsion: nombre, 0 à 1000 Pulse-steps

**Exemple:** notez la différence entre les vannes EEV et EVI, pour aider à
rechercher un défaut.

```text
QUAND L'heure est 14:00
ET Le différentiel des pas d'impulsion est au-dessus de 300
ALORS Créer une notification « Grand écart EEV et EVI »
```

### Conditions: Énergie et rendement (COP)

#### Analyse de tendance COP

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier la tendance de performance COP sur une période spécifiée

- Période : nombre, 1 à 168 h

**Exemple:** un contrôle hebdomadaire du rendement.

```text
QUAND L'heure est 10:00
ET Aujourd'hui est un dimanche
ET La tendance COP est en dégradation sur 168 heures
ALORS Envoyer une notification push « Le rendement baisse cette semaine »
```

#### Consommation électrique au-dessus

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si la consommation électrique actuelle est au-dessus ou en dessous d'un
seuil (nécessite le support de surveillance de puissance)

- Seuil de puissance (W): nombre, 100 à 10000 W

**Exemple:** passez la pompe à chaleur en ECO si elle demande beaucoup de
puissance en période coûteuse. Nécessite une mesure de puissance ; l'Aurora III
n'a pas de mode ECO.

```text
QUAND Période coûteuse approche
ET La consommation électrique est au-dessus de 1500 watts
ALORS Régler le mode de fonctionnement sur ECO
```

#### Consommation totale au-dessus du seuil

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si la consommation électrique totale est au-dessus ou en dessous d'un
seuil

- Seuil de consommation (kWh): nombre, 100 à 50000 kWh

**Exemple:** un rappel annuel dès que la consommation totale a dépassé une
limite.

```text
QUAND L'heure est 08:00
ET Le jour et le mois sont 1er septembre
ET La consommation totale est au-dessus de 20000 kWh
ALORS Envoyer une notification push « C'est l'heure de l'entretien »
```

#### COP mensuel au-dessus du seuil

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si le COP moyen sur 30 jours est au-dessus ou en dessous d'un seuil

- Seuil COP mensuel: nombre, 1 à 8 COP

**Exemple:** notez quand le COP mensuel est sous une limite.

```text
QUAND Le rapport de performance est prêt
ET Le COP mensuel est en dessous de 3
ALORS Créer une notification « COP mensuel sous 3 »
```

#### COP quotidien au-dessus du seuil

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si le COP moyen sur 24 heures est au-dessus ou en dessous d'un seuil

- Seuil COP quotidien: nombre, 1 à 8 COP

**Exemple:** ajoutez un avertissement au rapport du soir si le COP quotidien
était bas.

```text
QUAND Le rapport de performance est prêt
ET Le COP quotidien est en dessous de 2,5
ALORS Envoyer une notification push « COP quotidien bas : [Résumé] »
```

#### L'efficacité COP est

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si le coefficient de performance (COP) actuel est au-dessus ou en
dessous d'un seuil

- Seuil COP: nombre, 1 à 8 COP

**Exemple:** chauffez davantage l'eau chaude l'après-midi si la pompe à chaleur
est efficace à ce moment-là, et remettez la consigne le soir.

```text
QUAND L'heure est 14:00
ET L'efficacité COP est au-dessus de 4
ALORS Régler la température de l'eau chaude sur 55

QUAND L'heure est 18:00
ALORS Régler la température de l'eau chaude sur 48
```

#### La méthode de calcul COP est

**Condition** · Aurora I/II via Tuya

Vérifier quelle méthode de calcul a été utilisée pour la valeur COP actuelle -
utile pour l'automatisation basée sur la disponibilité des données

- Méthode de calcul: Thermique direct (plus précis), Estimation Carnot
  (précision moyenne), Différence de température (basique), Données
  insuffisantes

**Exemple:** ne réagissez à un COP bas que s'il a été calculé à partir du débit,
des températures et de la consommation mesurés.

```text
QUAND Efficacité COP changée en dessous 2
ET La méthode de calcul COP est Thermique direct (plus précis)
ALORS Envoyer une notification push « COP bas : [COP actuel] »
```

### Conditions: Prix de l'énergie

#### Les économies d'aperçu sont au-dessus du seuil

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

**Obsolète : n'est plus disponible dans les nouveaux Flows.**

Vérifier si les économies mensuelles estimées pour une catégorie d'aperçu
dépassent un seuil (en EUR/mois). Utiliser pour le filtrage basé sur le ROI (par
exemple, agir uniquement sur les économies >€100/mois).

- Catégorie: Performance d'isolation, Stratégie de préchauffage, Stockage
  thermique
- Seuil (EUR/mois): nombre, 0 à 500

**Exemple:** depuis la version 3.4.2, l'application n'estime plus d'économie en
euros, car elle ne peut pas être justifiée avec des prix dynamiques. La carte
renvoie toujours faux. Utilisez plutôt L'aperçu est actif.

#### Prix dans les heures les moins chères

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si l'heure actuelle se trouve dans le bloc de N heures les moins chères
aujourd'hui. Utile pour exécuter des tâches gourmandes en énergie pendant les
périodes à bas prix.

- Taille du bloc (heures): nombre, 1 à 12 h

**Exemple:** ne chauffez l'eau chaude que pendant les trois heures les moins
chères de la journée. Nécessite des prix via Envoyer les prix de l'énergie
externes.

```text
QUAND Toutes les 1 heure
ET L'heure actuelle est dans les 3 heures les moins chères aujourd'hui
ALORS Régler la température de l'eau chaude sur 55
SINON Régler la température de l'eau chaude sur 48
```

#### Prix vs moyenne quotidienne

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si le prix actuel de l'électricité s'écarte de la moyenne quotidienne
d'au moins le pourcentage de marge spécifié. Utile pour détecter des prix
significativement bas ou élevés.

- Marge (%): nombre, 0 à 50 %

**Exemple:** Boost quand le prix est nettement sous la moyenne du jour, sinon
Normal. Nécessite des prix via Envoyer les prix de l'énergie externes ; l'Aurora
III n'a pas de Boost.

```text
QUAND Toutes les 1 heure
ET Le prix actuel est inférieur à la moyenne quotidienne de 20%
ALORS Régler le mode de fonctionnement sur Boost
SINON Régler le mode de fonctionnement sur Normal
```

#### Tendance des prix est

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si les prix de l'électricité augmentent, diminuent ou sont stables dans
les N prochaines heures. Basé sur une régression linéaire avec mesure de
confiance.

- Fenêtre d'analyse (heures): nombre, 1 à 24 h
- Tendance: En hausse, En baisse, Stable

**Exemple:** chauffez l'eau chaude le matin si les prix montent dans les
prochaines heures, et remettez-la plus tard. Nécessite des prix via Envoyer les
prix de l'énergie externes.

```text
QUAND L'heure est 06:00
ET Tendance des prix pour les 6 prochaines heures est En hausse
ALORS Régler la température de l'eau chaude sur 55
ET Régler la température de l'eau chaude sur 48 (délai 3 heures)
```

### Conditions: Contrôle adaptatif et modèle de bâtiment

#### L'aperçu est actif

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si une catégorie d'aperçu spécifique est actuellement active (visible
dans les capacités). Retourne faux si ignoré ou non détecté.

- Catégorie: Performance d'isolation, Stratégie de préchauffage, Stockage
  thermique, Incompatibilité de profil de bâtiment

**Exemple:** un rappel hebdomadaire d'un aperçu ouvert.

```text
QUAND L'heure est 09:00
ET Aujourd'hui est un lundi
ET L'aperçu Performance d'isolation est actif
ALORS Envoyer une notification push « Il y a un aperçu sur l'isolation »
```

#### La confiance du modèle est au-dessus du seuil

**Condition** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Vérifier si la confiance du modèle de bâtiment dépasse un seuil (0-100%).
Utiliser comme porte de qualité pour les flux (par exemple, envoyer des
notifications uniquement lorsque la confiance >80%).

- Seuil (%): nombre, 0 à 100

**Exemple:** n'exécutez la recommandation que si le modèle de bâtiment est assez
fiable.

```text
QUAND Contrôle adaptatif recommande un ajustement de température
ET La confiance du modèle est au-dessus de 70%
ALORS Régler la température cible (consigne) sur
    [Température cible recommandée] Arrondir automatiquement (recommandé)
```

## Actions

### Actions: Commande et modes

#### Commuter l'appoint électrique forcé

**Action** · Aurora III via Modbus

Force l'appoint électrique ou le libère

- État: marche, arrêt

**Exemple:** forcez l'appoint électrique par grand froid et libérez-le quand il
fait moins froid.

```text
QUAND Température ambiante changée en dessous -10°C
ALORS Commuter l'appoint électrique forcé sur marche

QUAND Température ambiante changée au-dessus -5°C
ALORS Commuter l'appoint électrique forcé sur arrêt
```

#### Commuter la fonction eau chaude

**Action** · Aurora III via Modbus

Active ou désactive la production d'eau chaude sanitaire

- État: marche, arrêt

**Exemple:** coupez la production d'eau chaude pendant les vacances, avec une
variable Oui/Non Vacances.

```text
QUAND Une variable a changé (Vacances)
ET Vacances est égal à oui
ALORS Commuter la fonction eau chaude sur arrêt
```

#### Régler l'alimentation de l'appareil

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus

Régler l'état d'alimentation de l'appareil

- État d'alimentation: Allumé, Éteint

**Exemple:** allumez et éteignez la pompe à chaleur avec un bouton virtuel.

```text
QUAND Le bouton virtuel Pompe à chaleur est éteint
ALORS Régler l'alimentation de l'appareil sur Éteint
```

#### Régler la courbe (par mode)

**Action** · Aurora I/II via Modbus

Régler la courbe, dirigée vers chauffage, refroidissement, plancher chauffant ou
eau chaude. Auto suit le mode actuel de la pompe à chaleur.

- Appliquer à: Auto (suivre le mode actuel), Chauffage, Refroidissement,
  Plancher chauffant, Eau chaude
- Réglage de la courbe: ÉTEINT, H1, H2, H3, H4, H5, H6, H7, H8, L1, L2, L3, L4,
  L5, L6, L7, L8 - courbe personnalisée

**Exemple:** réglez la courbe du plancher chauffant au début de la saison de
chauffage.

```text
QUAND L'heure est 08:00
ET Le jour et le mois sont 1er octobre
ALORS Régler la courbe sur L3 pour Plancher chauffant
```

#### Régler la courbe d'eau chaude

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus

Régler la courbe d'eau chaude pour une efficacité optimale

- Réglage de la courbe d'eau chaude: ÉTEINT, H1, H2, H3, H4

**Exemple:** une courbe d'eau chaude plus haute le matin pour le pic des
douches.

```text
QUAND L'heure est 05:30
ALORS Régler la courbe d'eau chaude sur H3

QUAND L'heure est 09:00
ALORS Régler la courbe d'eau chaude sur H1
```

#### Régler la courbe de chauffage

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus

Régler le paramètre de la courbe de chauffage

- Réglage de la courbe de chauffage: ÉTEINT, H1, H2, H3, H4, H5, H6, H7, H8, L1,
  L2, L3, L4, L5, L6, L7, L8 - courbe personnalisée

**Exemple:** une courbe de chauffage plus haute dès la saison de chauffage.

```text
QUAND L'heure est 08:00
ET Le jour et le mois sont 1er octobre
ALORS Régler la courbe de chauffage sur H4
```

#### Régler la courbe de chauffe personnalisée (L28/L29)

**Action** · Aurora I/II via Modbus

Écrit la courbe de chauffe DIY directement dans les registres Modbus L27, L28 et
L29. slope est le coefficient k (ex. -0.5), intercept est la température de
départ à -15°C ext. (L29, ex. 55). Plage valide: slope -5.0..0.0, intercept
30..80. Les capabilities heating_curve_slope et heating_curve_intercept sont
mises à jour sous 30 secondes via polling.

- Pente (k, ex. -0.5): nombre
- Ordonnée (temp. départ à -15°C, ex. 55): nombre

**Exemple:** réglez une courbe de chauffe personnalisée au début de la saison de
chauffage. La carte active aussi la courbe personnalisée ; une pente de -0,5 et
50 °C à -15 °C extérieur donne 40 °C de départ à 5 °C extérieur.

```text
QUAND L'heure est 08:00
ET Le jour et le mois sont 1er octobre
ALORS Régler la courbe de chauffe personnalisée: pente -0.5, ordonnée 50°C
```

#### Régler la température cible (consigne)

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Régler la température cible (consigne) pour la pompe à chaleur

- Température (°C) (Aurora I/II via Tuya): nombre, 5 à 75 °C
- Température (°C) (Aurora I/II via Modbus, Aurora III via Modbus): nombre, 15 à
  60 °C
- Si valeur décimale: Arrondir automatiquement (recommandé), Afficher erreur

**Exemple:** c'est ainsi que vous appliquez la recommandation du contrôle
adaptatif : le contrôle ne règle pas lui-même la consigne, il donne une
recommandation que votre flow exécute. Sur l'Aurora I/II, la consigne ne reste
que si la courbe de chauffage est sur ARRÊT. Ne réglez pas aussi la consigne
avec un autre flow, sinon les deux se contrarient.

```text
QUAND Contrôle adaptatif recommande un ajustement de température
ALORS Régler la température cible (consigne) sur
    [Température cible recommandée] Arrondir automatiquement (recommandé)
```

#### Régler la température de consigne (par mode)

**Action** · Aurora I/II via Modbus

Régler la température de consigne, dirigée vers chauffage, refroidissement ou
plancher chauffant. Auto suit le mode actuel de la pompe à chaleur.

- Température (°C): nombre, 7 à 60 °C
- Appliquer à: Auto (suivre le mode actuel), Chauffage, Refroidissement,
  Plancher chauffant
- Si valeur décimale: Arrondir automatiquement (recommandé), Afficher erreur

**Exemple:** une consigne plus basse pour le plancher chauffant la nuit. La
consigne ne reste que si la courbe de chauffage est sur ARRÊT.

```text
QUAND L'heure est 23:00
ALORS Régler la consigne sur 30 pour Plancher chauffant
    Arrondir automatiquement (recommandé)
```

#### Régler la température de l'eau chaude

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Régler la température de l'eau chaude

- Température de l'eau chaude (°C): nombre, 20 à 75 °C

**Exemple:** chauffez davantage l'eau chaude dans le bloc le moins cher.

```text
QUAND Bloc le moins cher commencé
ALORS Régler la température de l'eau chaude sur 55

QUAND Période coûteuse approche
ALORS Régler la température de l'eau chaude sur 48
```

#### Régler le contrôle de la consommation électrique

**Action** · Aurora I/II via Tuya

Régler le niveau de contrôle de la consommation électrique

- Contrôle de la consommation électrique: nombre, 0 à 2

**Exemple:** ce réglage indique quel module de puissance équipe la pompe à
chaleur (0 = aucun, 1 = monophasé, 2 = triphasé). Ne le modifiez que sur
indication de l'installateur ; n'utilisez pas la carte dans un flow automatique.

#### Régler le mode de chauffage

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Régler le mode de fonctionnement du chauffage

- Mode de chauffage (Aurora I/II via Tuya, Aurora I/II via Modbus): Froid,
  Chauffage, Chauffage au sol, Eau chaude, Eau froide et eau chaude, Chauffage
  et eau chaude, Chauffage au sol et eau chaude
- Mode de chauffage (Aurora III via Modbus): Froid, Chauffage, Auto

**Exemple:** revenez au chauffage et à l'eau chaude au début de la saison de
chauffage. Sur l'Aurora III, choisissez ici Chauffage.

```text
QUAND L'heure est 08:00
ET Le jour et le mois sont 1er octobre
ALORS Régler le mode de chauffage sur Chauffage et eau chaude
```

#### Régler le mode de contrôle de l'eau

**Action** · Aurora I/II via Tuya

Régler le paramètre du mode de contrôle de l'eau

- Mode de contrôle de l'eau: nombre, 0 à 1

**Exemple:** c'est un réglage d'installation. Ne le modifiez que sur indication
de l'installateur ; n'utilisez pas la carte dans un flow automatique.

#### Régler le mode de fonctionnement

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus

Régler le mode de fonctionnement du système

- Mode de fonctionnement: ECO, Normal, Boost

**Exemple:** Boost dans le bloc le moins cher, ECO dans la période coûteuse.

```text
QUAND Bloc le moins cher commencé
ALORS Régler le mode de fonctionnement sur Boost

QUAND Période coûteuse approche
ALORS Régler le mode de fonctionnement sur ECO
```

#### Régler le mode silencieux

**Action** · Aurora III via Modbus

Règle le niveau du mode silencieux de la pompe à chaleur

- Mode silencieux: Arrêt, Niveau 1, Niveau 2

**Exemple:** fonctionner plus silencieusement la nuit.

```text
QUAND L'heure est 22:00
ALORS Régler le mode silencieux sur Niveau 2

QUAND L'heure est 07:00
ALORS Régler le mode silencieux sur Arrêt
```

### Actions: Énergie et rendement (COP)

#### Générer un rapport de performance

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Générez un rapport complet de performance de la pompe à chaleur avec des scores
dans 7 domaines (efficacité, bâtiment, dégivrage, énergie, prix, télémétrie,
santé). Retourne le score global, l'évaluation et des recommandations pratiques.

Tokens: Score global (0-100), Évaluation, Résumé, Recommandations, Rapport
complet (JSON)

**Exemple:** créez le rapport à un autre moment que 23:00 et transmettez le
résultat.

```text
QUAND L'heure est 18:00
ET Aujourd'hui est un dimanche
ALORS Générer un rapport de performance
ET Envoyer une notification push « [Évaluation] : [Résumé] »
```

### Actions: Prix de l'énergie

#### Envoyer les prix de l'énergie à la pompe à chaleur

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Envoie les prix horaires de l'énergie (€/kWh) depuis une source externe pour
l'optimisation basée sur les prix. Accepte deux formats: Array [0.11,0.10,...]
où index=décalage horaire (0=heure actuelle), ou Objet {"0":0.11,"1":0.10,...}
avec clés horaires.

- Prix de l'énergie (JSON): texte

**Exemple:** l'application ne récupère pas elle-même les prix. Envoyez-les sous
forme de texte depuis une autre application, une variable ou une requête HTTP,
par exemple [0.21,0.19,0.18,...] en €/kWh, le premier nombre étant l'heure
actuelle. Les prix s'appliquent à partir de leur réception ; envoyez-en de
nouveaux dès qu'ils sont disponibles, par exemple chaque après-midi après la
publication des prix du lendemain.

```text
QUAND L'heure est 14:30
ALORS Envoyer les prix de l'énergie externes [Prix] pour l'optimisation des prix
```

### Actions: Contrôle adaptatif et modèle de bâtiment

#### Calculer l'heure de démarrage du préchauffage

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Calcule quand commencer à chauffer pour atteindre la température intérieure
souhaitée à une heure précise. Utilise la constante de temps thermique (τ) du
modèle de bâtiment pour une prédiction précise.

- Température intérieure cible (°C): nombre, 16 à 28
- Prêt à (HH:MM): texte

Tokens: Heure de démarrage, Durée (heures), Augmentation de consigne suggérée
(°C), Confiance du modèle (%)

**Exemple:** calculez la nuit quand le chauffage doit démarrer pour atteindre 21
°C à 07:00. Saisissez l'heure au format HH:MM.

```text
QUAND L'heure est 04:00
ALORS Calculer quand commencer à chauffer pour atteindre 21°C à 07:00
ET Envoyer une notification push « Démarrer à [Heure de démarrage] »
```

#### Forcer l'analyse des aperçus

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Évaluer immédiatement les aperçus du bâtiment (sans attendre l'intervalle de 50
minutes). Retourne le nombre d'aperçus détectés et la confiance actuelle du
modèle.

Tokens: Aperçus détectés, Confiance du modèle (%)

**Exemple:** mettez à jour les aperçus tout de suite au lieu d'attendre la
prochaine analyse (toutes les 50 minutes).

```text
QUAND L'heure est 08:00
ALORS Forcer l'analyse des aperçus
ET Créer une notification « [Aperçus détectés] aperçus »
```

#### Régler la température intérieure souhaitée

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Réglez la température ambiante souhaitée pour le contrôle adaptatif. Le système
adaptatif ajustera la consigne de la pompe à chaleur pour atteindre cette
température.

- Température intérieure : nombre, 15 à 25 °C

**Exemple:** une température intérieure souhaitée plus basse la nuit. Le
contrôle adaptatif adapte sa recommandation en conséquence.

```text
QUAND L'heure est 22:30
ALORS Régler la température intérieure souhaitée sur 19°C

QUAND L'heure est 06:30
ALORS Régler la température intérieure souhaitée sur 21°C
```

### Actions: Données externes

#### Envoyer la puissance solaire à la pompe à chaleur

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Envoie la production solaire pour un calcul précis du rayonnement. À utiliser
avec SolarEdge, Enphase, etc.

- Puissance solaire (W): nombre, 0 à 50000

**Exemple:** l'application convertit la puissance des panneaux solaires en
rayonnement solaire pour le modèle de bâtiment. Renseignez pour cela Taille du
système solaire (Wp) dans les réglages. Une valeur compte pendant une heure ;
ensuite, l'application revient aux prévisions météo.

```text
QUAND La puissance a changé (onduleur solaire)
ALORS Envoyer puissance solaire [Puissance]W à la pompe à chaleur
```

#### Envoyer la température ambiante à la pompe à chaleur

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Envoie les données de température ambiante à la pompe à chaleur pour des calculs
COP/masse thermique améliorés

- Température ambiante (°C): nombre, -50 à 50

**Exemple:** utilisez votre propre capteur extérieur au lieu du capteur de la
pompe à chaleur. Une valeur compte pendant une heure ; ensuite, le contrôle
adaptatif revient aux prévisions météo et au capteur de la pompe à chaleur.

```text
QUAND La température a changé (capteur extérieur)
ALORS Envoyer [Température]°C à la pompe à chaleur pour le calcul COP/masse
    thermique
```

#### Envoyer la température intérieure à la pompe à chaleur

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Envoie la température intérieure actuelle d'un capteur externe pour activer le
contrôle adaptatif de la température

- Température intérieure (°C): texte

**Exemple:** le contrôle adaptatif ne fonctionne qu'avec une température
intérieure. Envoyez-la à chaque changement d'un capteur de pièce, de préférence
avec le token du capteur. Si la valeur reste identique pendant 12 heures,
l'application le signale ; après 24 heures, le contrôle ne corrige plus dessus.
Si vous saisissez une valeur vous-même, utilisez un point (21.5).

```text
QUAND La température a changé (capteur du salon)
ALORS Envoyer [Température]°C température intérieure pour contrôle adaptatif
```

#### Envoyer la vitesse du vent à la pompe à chaleur

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Envoie la vitesse du vent pour correction des pertes de chaleur. À utiliser avec
l'app météo KNMI.

- Vitesse du vent (km/h): nombre, 0 à 200

**Exemple:** envoyez la vitesse du vent pour la correction des pertes de
chaleur. La carte attend des km/h ; une valeur en m/s multipliée par 3,6 donne
des km/h. Une valeur compte pendant une heure ; ensuite, l'application revient
aux prévisions météo.

```text
QUAND Toutes les 15 minutes
ALORS Envoyer vitesse du vent [Vent de votre application météo] km/h à la
    pompe à chaleur
```

#### Envoyer le rayonnement solaire à la pompe à chaleur

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Envoie le rayonnement solaire pour le modèle de bâtiment. À utiliser avec l'app
météo KNMI.

- Rayonnement solaire (W/m²): nombre, 0 à 1500

**Exemple:** envoyez le rayonnement solaire mesuré, par exemple depuis une
application météo. Les panneaux solaires sont prioritaires s'ils envoient aussi
des données. Une valeur compte pendant une heure.

```text
QUAND Toutes les 15 minutes
ALORS Envoyer rayonnement solaire [Rayonnement de votre application météo]
    W/m² à la pompe à chaleur
```

#### Envoyer les données de débit à la pompe à chaleur

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Envoie les données de débit d'eau à la pompe à chaleur pour des calculs COP
améliorés

- Débit d'eau (L/min): nombre, 0 à 200

**Exemple:** envoyez le débit d'un débitmètre externe, si la pompe à chaleur ne
le mesure pas elle-même. Une valeur compte pendant une heure.

```text
QUAND (déclencheur de votre débitmètre à chaque nouvelle mesure)
ALORS Envoyer [Débit]L/min à la pompe à chaleur pour le calcul COP
```

#### Envoyer les données de puissance à la pompe à chaleur

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Envoie les données de consommation électrique à la pompe à chaleur pour des
calculs COP améliorés

- Consommation électrique (W): nombre, 0 à 50000

**Exemple:** envoyez la puissance mesurée d'un compteur kWh ou d'une prise
connectée, même quand elle tombe à 0 W. Cela donne le calcul COP le plus précis
et alimente la consommation et le coût du jour. Pour le COP, une valeur compte
pendant une heure ; la consommation du jour continue de compter avec la dernière
valeur reçue.

```text
QUAND La puissance a changé (compteur kWh de la pompe à chaleur)
ALORS Envoyer [Puissance]W à la pompe à chaleur pour le calcul COP
```

### Actions: Outils de calcul

#### Calculer courbe de chauffage Custom (L28/L29)

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus

Calcule la température de départ avec courbe de chauffage Adlar Custom. Utilise
L29 (température réglée à -15°C) et L28 (pente par 10°C). Exemple: L29=55°C à
-15°C avec L28=-5 donne pente -0.5/°C, formule y = -0.5x + 47.5. Pour temp
extérieure 5°C → temp départ 45°C.

- Température extérieure: texte
- L29: Temp réglée à -15°C extérieur (°C): nombre
- L28: Pente (par 10°C): nombre

Tokens: Température de départ, Formule Courbe de Chauffage

**Exemple:** calculez la température de départ d'une courbe droite comme la
courbe personnalisée de la pompe à chaleur : L29 est le départ à -15 °C
extérieur, L28 la pente par 10 °C. Avec 55 et -5, 5 °C extérieur donne 45 °C de
départ. Pratique pour essayer une courbe d'abord.

```text
QUAND Toutes les 30 minutes
ALORS Calculer courbe de chauffage: L29=55°C à -15°C, L28=-5/10°C
    avec temp extérieure [Température ambiante de la pompe à chaleur]
ET Créer une notification « La courbe donne [Température de départ] °C »
```

#### Calculer la valeur à partir du planning horaire

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Évalue l'heure actuelle par rapport à un planning quotidien pour calculer les
valeurs de sortie. Parfait pour la planification de température basée sur le
temps, la tarification à l'heure d'utilisation et les routines quotidiennes
automatisées.

- Planning horaire: texte

Tokens: Valeur résultante

**Exemple:** un programme journalier pour la température intérieure souhaitée.
Les périodes à cheval sur minuit sont permises ; default : valeur couvre le
reste.

```text
QUAND Toutes les 30 minutes
ALORS Calculer la valeur à partir des périodes de temps
    06:00-22:00: 21, 22:00-06:00: 19
ET Régler la température intérieure souhaitée sur [Valeur résultante]°C
```

#### Calculer une valeur à partir de règles de courbe

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Calcule les valeurs de sortie en fonction de l'entrée (par ex. température
extérieure → consigne de chauffage). Format : '[opérateur] seuil : valeur'.
Opérateurs : >, >=, <, <=, ==, !=. Évalue de haut en bas, renvoie la première
correspondance. Utilisez 'default : valeur' comme solution de secours. Exemple
courbe de chauffage : '< 0 : 55, < 5 : 50, < 10 : 45, default : 35'

- Valeur d'entrée: texte
- Définition de courbe: texte

Tokens: Valeur résultante

**Exemple:** créez votre propre courbe de chauffe par paliers : la première
règle qui correspond détermine le résultat. Sur l'Aurora I/II, la consigne ne
reste que si la courbe de la pompe à chaleur est sur ARRÊT ; ne l'utilisez pas
avec le contrôle adaptatif.

```text
QUAND Toutes les 30 minutes
ALORS Calculer une valeur via [Température ambiante de la pompe à chaleur]
    avec règles de courbe < 0 : 55, < 5 : 50, < 10 : 45, default : 35
ET Régler la température cible (consigne) sur [Valeur résultante]
    Arrondir automatiquement (recommandé)
```

#### Obtenir le mode saisonnier actuel

**Action** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Renvoie le mode chauffage/refroidissement basé sur la date actuelle. Saison de
chauffage : 1er oct - 15 mai (conforme à la norme EN 14825 SCOP). Parfait pour
basculer automatiquement entre les programmes d'hiver et d'été.

Tokens: Mode, Est saison de chauffage, Est saison de refroidissement, Jours
avant le changement de saison

**Exemple:** la saison de chauffage va du 1er octobre au 15 mai. Enregistrez le
résultat dans une variable Oui/Non, pour que d'autres flows puissent la tester.

```text
QUAND L'heure est 00:05
ALORS Obtenir le mode saisonnier
ET Définir une variable Oui/Non : Saison de chauffage sur
    [Est saison de chauffage]
```

### Actions: Registres Modbus

#### Écrire dans un registre Modbus

**Action** · Aurora I/II via Modbus · Aurora III via Modbus

Écrit une valeur brute dans un registre Modbus holding (FC06). Adresse en hex
(0x0301) ou décimal (769). Les registres de température attendent ×10 — saisir
450 pour 45 °C. Utiliser avec prudence.

- Adresse du registre: texte
- Valeur du registre: nombre

**Exemple:** n'écrivez que dans un registre dont vous savez ce qu'il fait ; une
valeur erronée peut dérégler la pompe à chaleur. Les températures sont ×10 : 350
vaut 35 °C. Sur l'Aurora I/II, la consigne de chauffage (0x0301) ne reste que si
la courbe de chauffage est sur ARRÊT.

```text
QUAND L'heure est 06:00
ALORS Écrire 350 dans le registre Modbus 0x0301
```

#### Lire un registre Modbus

**Action** · Aurora I/II via Modbus · Aurora III via Modbus

Lit un registre Modbus holding (FC03) et retourne la valeur brute en tant que
token de flow. Adresse en hex (0x0301) ou décimal (769). Les registres de
température stockent ×10 — diviser par 10 pour obtenir °C.

- Adresse du registre: texte

Tokens: Valeur du registre

**Exemple:** lisez un registre que l'application n'affiche pas. Sur l'Aurora
I/II, l'adresse est en hexadécimal ou décimal (0x0301 = 769, la consigne de
chauffage) ; les températures sont stockées ×10. Sur l'Aurora III, utilisez le
nombre après 4- (4-2100 devient 2100) ; les registres d'entrée (3-) ne sont pas
lisibles avec cette carte.

```text
QUAND L'heure est 12:00
ALORS Lire le registre Modbus 0x0301
ET Créer une notification « Registre 0x0301 : [Valeur du registre] »
```
