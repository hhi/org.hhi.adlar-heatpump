# Configurer le contrôle adaptatif

Un guide des réglages du contrôle adaptatif : les six groupes dont le titre
commence par **Contrôle adaptatif**. Quel choix faire, quels réglages comptent
pour ce choix et lesquels vous pouvez laisser tels quels.
S'applique à la version 3.6.2 et aux trois pilotes (Tuya, Aurora I/II et
Aurora III) ; les différences figurent sous [Différences par
pilote](#différences-par-pilote).

## Sommaire

- [En bref](#en-bref)
- [Étape par étape](#étape-par-étape)
- [Quel réglage compte dans quel mode](#quel-réglage-compte-dans-quel-mode)
- [Classique et Positionnel](#classique-et-positionnel)
- [La courbe de chauffe en Positionnel](#la-courbe-de-chauffe-en-positionnel)
- [Coast](#coast)
- [Les réglages un par un](#les-réglages-un-par-un)
- [Température extérieure](#température-extérieure)
- [Différences par pilote](#différences-par-pilote)
- [Questions](#questions)

## En bref

- Toutes les 5 minutes, l'app calcule une **recommandation** pour la
  température de l'eau. Vous la voyez dans **Température Cible Simulée**
  (`adlar_simulated_target`).
- La recommandation ne change rien sur la pompe à chaleur. Seul un flow qui
  l'applique en fait une régulation.
- La pompe à chaleur ne garde une consigne envoyée de l'extérieur que si sa
  propre sélection de courbe de chauffe est sur **OFF** (Aurora I/II : sélection
  de courbe de chauffe ; Tuya : courbe de chauffe).
- Le **mode de régulation** détermine comment la recommandation est calculée.
  Dans chaque mode, seule une partie des réglages compte ; vous pouvez laisser
  le reste tel quel.

## Étape par étape

### 1. Conditions

- Un flow qui envoie la température intérieure toutes les quelques minutes avec
  la carte **Envoyer la température intérieure à la pompe à chaleur**. Sans
  température intérieure, la régulation ne démarre pas.
- Activez **Contrôle adaptatif activé**. Tant qu'il est désactivé, aucune
  recommandation n'est calculée et les autres réglages ne comptent pas.
- La cible de la pièce est **Température Intérieure Souhaitée** sur l'appareil.
  Réglez-la là ou avec la carte **Régler la température intérieure souhaitée**
  (15–25 °C). Sans cible, chaque cycle est ignoré.

### 2. Recommandation seule ou vraie régulation ?

| Vous voulez | Ce que vous faites |
| --- | --- |
| D'abord voir ce que l'app ferait | Pas de flow qui applique la recommandation. Laissez la sélection de courbe de chauffe de la pompe à chaleur telle quelle |
| Laisser l'app réguler | Un flow avec le déclencheur **Contrôle adaptatif recommande un ajustement de température** qui règle la température cible de la pompe à chaleur sur `recommended_temperature`. Mettez la sélection de courbe de chauffe de la pompe à chaleur sur **OFF** |

Dans les deux cas, observez d'abord pendant une journée. Comparez la
recommandation avec ce que fait la pompe à chaleur elle-même actuellement.

En Positionnel sans flow qui applique la recommandation, le terme I reste à
l'arrêt dès que la consigne de la pompe à chaleur s'écarte de plus de 1 °C de la
recommandation. Vous voyez alors surtout la courbe de chauffe plus le terme P,
pas la manière dont la régulation corrige avec le temps.

### 3. Choisir le mode de régulation

| Situation | Mode de régulation |
| --- | --- |
| Vous régulez déjà avec l'app et cela fonctionne bien | Classique |
| Radiateurs ou ventilo-convecteurs, la consigne dérive ou oscille | Positionnel – Radiateurs |
| Plancher chauffant, la consigne dérive ou oscille | Positionnel – Plancher chauffant |
| Mixte : plancher et radiateurs | Positionnel – Plancher chauffant si le plancher est l'émetteur le plus grand ou le plus lent, sinon – Radiateurs |
| Vous voulez choisir Kp, Ti ou coast vous-même | Positionnel – Manuel |

Les modes positionnels sont **expérimentaux** : meilleurs que Classique en
simulation, encore peu testés en pratique. Revenir en arrière est toujours
possible.

### 4. Choisir la courbe de chauffe (Positionnel uniquement)

| Ce que la pompe à chaleur utilise actuellement | Ce que vous choisissez |
| --- | --- |
| Une courbe fixe (HH1–HH8, HL1–HL8 ; Tuya H1–H8, L1–L8) | **Copier une fois dans la courbe de l'app** → cette courbe. Ensuite, la sélection de courbe de chauffe sur OFF |
| Sa propre courbe de chauffe DIY (Aurora I/II, L28/L29) | Copier une fois avec **Copier une fois dans la courbe de l'app** → **Courbe de chauffe DIY**, ou suivre en continu avec **Base de la recommandation** → **Courbe de la pompe à chaleur (suivie en continu)**. Voir [Copier une fois ou suivre en continu](#copier-une-fois-ou-suivre-en-continu) |
| Je ne sais pas | Rien : l'app remplit une courbe de départ lorsque vous choisissez le mode de régulation |

### 5. Limites

Réglez **Température d'eau la plus basse recommandée** et **la plus haute**. Avec un plancher
chauffant : autour de la plage de votre propre courbe de chauffe, par exemple
2 °C en dessous et 3 °C au-dessus, avec de la marge pour le temps froid.

### 6. Vérifier

- **Température Cible Simulée** : la recommandation suit-elle la température
  extérieure à peu près comme votre courbe de chauffe ?
- **Diagnostics de contrôle adaptatif** (`adaptive_control_diagnostics`) :
  affiche le mode, Kp et Ti avec leur source, la base (courbe de chauffe) avec
  sa source, et les termes P et I.
- Si le terme I reste au-dessus de 0 pendant des jours, la courbe de chauffe est
  trop basse ; en dessous de 0, trop haute. Voir [Ajuster la courbe de
  chauffe](#ajuster-la-courbe-de-chauffe).

## Quel réglage compte dans quel mode

Homey affiche toujours tous les réglages. Ils sont répartis en six groupes ; le
titre d'un groupe indique dans quel mode de régulation il compte. Ce tableau
montre lesquels comptent.

| Groupe : réglages | Classique | Positionnel – Radiateurs / Plancher chauffant | Positionnel – Manuel |
| --- | --- | --- | --- |
| Contrôle adaptatif : activé, mode de régulation, température d'eau la plus basse et la plus haute | Oui | Oui | Oui |
| Courbe de chauffe (Positionnel) : base de la recommandation, copier une fois, eau à −15 °C et +15 °C | Non | Oui | Oui |
| Réglage fin (Positionnel – Manuel) : Kp, Ti | Non | Non, valeurs fixes | Oui |
| Réglage fin (Classique) : Kp, Ki, zone morte | Oui | Non | Non |
| Coast (Classique, Positionnel – Manuel) | Oui | Non, coast est toujours désactivé | Oui |
| Facteurs de pondération : Confort, Modèle du bâtiment | Oui | Non | Non |
| Facteurs de pondération : Efficacité, Coût | Oui | Oui, uniquement pour le décalage de la cible de la pièce | Oui, idem |

## Classique et Positionnel

### Classique

Toutes les 5 minutes, l'app calcule une petite correction et l'ajoute à la
recommandation actuelle. Ces pas s'additionnent : après une nuit froide, la
recommandation peut être montée très haut, et il faut un moment pour qu'elle
redescende. À l'intérieur de la zone morte (0,3 °C par défaut), rien ne change.
Classique n'a pas besoin de courbe de chauffe.

### Positionnel

La recommandation est recalculée toutes les 5 minutes à partir de trois parties :

1. **Base** : la température de l'eau qui correspond à la température
   extérieure, tirée d'une courbe de chauffe.
2. **Terme P** : Kp × (cible de la pièce − température intérieure). Réagit tout
   de suite.
3. **Terme I** : croît lentement tant qu'il fait trop froid ou trop chaud, et
   compense ainsi une courbe de chauffe un peu trop haute ou trop basse. Ti
   détermine la lenteur.

Exemple : 5 °C dehors, une courbe de chauffe 50 / 35 donne une base de 40 °C.
20,5 °C à l'intérieur pour une cible de 21 °C donne un terme P de
3 × 0,5 = 1,5 °C. La recommandation est alors de 41,5 °C plus le terme I,
arrondie au degré entier.

Limites : les termes P et I ensemble au plus ±8 °C, le terme I seul au plus
±6 °C. Le terme I reste à l'arrêt pour un écart jusqu'à 0,1 °C, pendant le
dégivrage et l'eau chaude, sur une limite, et tant que la pompe à chaleur n'a
pas encore repris la recommandation précédente.

### Les trois variantes positionnelles

| | Radiateurs | Plancher chauffant | Manuel |
| --- | --- | --- | --- |
| Kp | 3 | 3 | Réglage, 3 par défaut |
| Ti | 3 heures | 6 heures | Réglage, 3 heures par défaut |
| Coast | Désactivé | Désactivé | Interrupteur **Coast activé**, **activé par défaut** |
| Courbe de départ | 50 / 35 | 35 / 27 | Aucune |

Seul Ti diffère entre les types d'émetteurs : un plancher ne réagit qu'après
des heures, le terme I doit donc croître plus lentement. Kp dépend peu du type
d'émetteur.

Attention avec **Manuel** : avec les valeurs par défaut, il équivaut à
Radiateurs, **mais avec coast activé**. Si vous ne le souhaitez pas, désactivez
**Coast activé**.

## La courbe de chauffe en Positionnel

### Courbe de l'app

Une droite passant par deux points : la température de l'eau à −15 °C et à
+15 °C extérieur. Entre ces points, l'app calcule la valeur ; au-delà, la droite
se prolonge, dans les limites.

Lorsque vous choisissez un mode positionnel, l'app remplit une courbe de départ
(Radiateurs 50 / 35, Plancher chauffant 35 / 27). Elle ne le fait que tant que
vous n'avez jamais modifié vous-même les deux valeurs. Si vous les avez
modifiées une fois, ou fait remplir depuis une courbe fixe, elles restent, même
si vous changez de mode plus tard.

### Reprendre une courbe fixe

**Copier une fois dans la courbe de l'app** remplit une fois les deux
valeurs à partir d'une courbe de la pompe à chaleur. La liste revient ensuite à
"—". Rouvrez les réglages pour voir les nouvelles valeurs.

| Courbe | −15 °C | +15 °C | Courbe | −15 °C | +15 °C |
| --- | --- | --- | --- | --- | --- |
| HH1 | 54 | 51 | HL1 | 37 | 33 |
| HH2 | 54 | 46 | HL2 | 34 | 31 |
| HH3 | 53 | 42 | HL3 | 32 | 30 |
| HH4 | 49 | 46 | HL4 | 34 | 29 |
| HH5 | 49 | 41 | HL5 | 32 | 29 |
| HH6 | 44 | 41 | HL6 | 30 | 27 |
| HH7 | 44 | 36 | HL7 | 28 | 27 |
| HH8 | 39 | 36 | HL8 | 28 | 25 |

Les courbes fixes sont des escaliers avec des marches de 1 °C. Les valeurs
suivent le milieu de cet escalier, arrondies au degré entier.

Aurora I/II avec une courbe de chauffe DIY : choisissez **Courbe de chauffe DIY
de la pompe à chaleur (L28/L29)**. L'app reprend L29 comme valeur à −15 °C et
L29 + 30 × L28 comme valeur à +15 °C. Exemple : L28 = −0,5 et L29 = 55 donne
55 / 40. Si l'app ne peut pas encore lire la courbe DIY, ou si elle n'est pas
utilisable, vous recevez un message et rien ne change.

### Copier une fois ou suivre en continu

Avec l'Aurora I/II, vous pouvez utiliser une courbe de chauffe DIY de deux
manières :

| | Copier une fois | Suivre en continu |
| --- | --- | --- |
| Réglage | Copier une fois dans la courbe de l'app → **Courbe de chauffe DIY de la pompe à chaleur** | Base de la recommandation → **Courbe de la pompe à chaleur (suivie en continu)** |
| Ce que fait l'app | Reprend une fois les valeurs DIY dans la courbe de l'app | Calcule à chaque cycle avec la courbe DIY de la pompe à chaleur |
| Température extérieure | Celle de l'app (voir [Température extérieure](#température-extérieure)) | Le capteur de la pompe à chaleur |
| Vous modifiez la courbe DIY plus tard | L'app ne la reprend pas ; copier à nouveau | L'app suit immédiatement |
| DIY est désactivé ou inutilisable | Message à l'enregistrement, rien ne change | L'app utilise la courbe de l'app sans message |

Vous pouvez combiner les deux : copier d'abord, puis suivre. Si le suivi
tombe, l'app continue avec la même courbe.

Sur l'Aurora III, **Courbe de la pompe à chaleur** désigne la courbe climatique
de la pompe à chaleur. Ne la choisissez que si vous avez réglé cette courbe
vous-même. Tuya n'a pas ce choix.

### Ajuster la courbe de chauffe

| Ce que vous constatez | Modification |
| --- | --- |
| Trop froid par gel, bien par temps doux | Valeur à −15 °C 1–2 °C plus haute |
| Trop froid par temps doux | Valeur à +15 °C 1–2 °C plus haute |
| Un peu trop froid partout | Les deux valeurs 1 °C plus hautes |
| Trop chaud | L'inverse : baisser |

Modifiez une valeur à la fois et attendez une journée (plancher chauffant : deux
jours).

## Coast

### Ce que fait coast

Coast laisse la maison refroidir passivement lorsqu'il fait trop chaud. Si la
pièce dépasse la cible de plus que le seuil de démarrage (**Coast : seuil de
démarrage au-dessus du souhaité**, 0,3 °C par défaut) pendant deux cycles de
suite et ne baisse pas, coast tire la recommandation vers la température
actuelle de l'eau moins **Coast : recommandation sous la température d'eau**
(1 °C par défaut). La pompe à
chaleur arrête alors de chauffer.

Coast s'arrête lorsque la pièce descend sous la cible plus la moitié du
seuil de démarrage (par défaut 21,15 °C pour une cible de 21 °C), lorsque la pièce
baisse et que coast n'agit presque plus, ou après le nombre maximal de cycles
(Aurora : 24 par défaut, 2 heures).

### Pourquoi Positionnel sans coast

**À quoi servait coast.** Classique ajoute un petit pas à la recommandation
toutes les 5 minutes. Après une période froide, la recommandation est montée
très haut. S'il fait ensuite trop chaud, tous ces pas doivent d'abord être
défaits, et pendant ce temps la pompe à chaleur continue de chauffer : la pièce
dépasse la cible. Coast a été ajouté comme frein d'urgence : il tire la
recommandation sous la température de l'eau pour que le compresseur s'arrête.

**Pourquoi Positionnel n'a pas besoin de ce frein.** Positionnel recalcule la
recommandation à chaque cycle à partir de la courbe de chauffe. Il n'y a pas de
pas accumulés à défaire d'abord. S'il fait trop chaud, le terme P est
immédiatement négatif : 0,5 °C de trop donne, dans le même cycle, une
recommandation 1,5 °C plus basse, 1 °C de trop 3 °C plus basse. Le terme I suit
ensuite lentement.

**Ce qui ne va pas avec coast en Positionnel.** Coast vise la température de
l'eau moins 1 °C, et cette température varie avec le compresseur :

1. La pièce est trop chaude. Coast tire la recommandation vers le bas et le
   compresseur s'arrête.
2. Coast se termine. La recommandation revient en un cycle à la courbe de
   chauffe plus les termes P et I, jusqu'à 9 °C plus haut en simulation.
3. Le compresseur redémarre et la température de l'eau dépasse la
   recommandation. Coast tombe donc tant que le compresseur tourne, et
   intervient de nouveau dès qu'il s'arrête.
4. Si la courbe de chauffe est un peu trop haute, la pièce reste trop chaude et
   les étapes 1 à 3 se répètent.

En simulation, cela donnait 14 à 23 démarrages du compresseur par jour. De
nombreux démarrages courts usent le compresseur et coûtent du rendement.

**Ce que le test a montré.** 24 situations simulées : trois maisons (moyenne,
légère, lourde), temps doux et froid, quatre courbes de chauffe (adaptée,
35 / 27, HL2 trop haute, HL8 trop basse), 14 jours chacune. Coast désactivé
contre coast activé :

| Résultat | Nombre |
| --- | --- |
| Coast désactivé meilleur | 11 |
| Égal | 9 |
| Coast désactivé un peu moins bon | 4, tous avec la courbe trop basse HL8 : jusqu'à environ 1 heure par jour à plus de 0,5 °C trop froid par temps doux |

Avec coast désactivé, le compresseur démarrait en moyenne 0,4 fois par jour,
avec coast activé 2,9 fois. Un saut de plus de 1 °C dans la recommandation ne
s'est pas produit avec coast désactivé. Avec une courbe de chauffe trop basse,
la solution est de relever la courbe, pas coast.

**Ce qui a été essayé pour garder coast.** Fixer la cible de coast à sa valeur
la plus basse (moins bon), laisser la recommandation remonter progressivement
après coast (aide à peine), et seulement mettre en pause le terme I sans tirer
la recommandation vers le bas (moins bon avec une courbe trop haute).

**Historique.** En 3.5.0 et 3.5.1, coast était activé pour Plancher chauffant.
Ce choix venait de simulations avec une courbe de chauffe parfaitement adaptée ;
là, coast change peu de choses. Avec la courbe de l'app à deux points, telle que
les utilisateurs l'ont, l'oscillation est apparue. Depuis 3.5.2, coast est
désactivé dans les deux préréglages.

**Coast malgré tout ?** Choisissez Positionnel – Manuel et activez **Coast activé**.
L'oscillation décrite ci-dessus peut alors toujours se produire. Aucune
situation n'a été testée dans laquelle coast fait mieux en Positionnel.

Les préréglages désactivent coast, quoi qu'indique l'interrupteur **Coast activé**. En
Classique et en Manuel, l'interrupteur compte.

## Les réglages un par un

Dans l'ordre des groupes.

| Réglage | Ce qu'il fait | Compte dans | Par défaut |
| --- | --- | --- | --- |
| **Groupe Contrôle adaptatif** | | | |
| Contrôle adaptatif activé | Active le calcul de la recommandation | Tous | Désactivé |
| Mode de régulation | Classique ou l'une des trois variantes positionnelles | Tous | Classique |
| Température d'eau la plus basse recommandée | Recommandation la plus basse ; à accorder avec P111 | Tous | 18 °C |
| Température d'eau la plus haute recommandée | Recommandation la plus haute ; au moins 2 °C au-dessus du minimum | Tous | 60 °C (Tuya 65 °C) |
| **Groupe courbe de chauffe (Positionnel)** | | | |
| Base de la recommandation | Courbe de l'app ou courbe de la pompe à chaleur (suivie en continu) | Positionnel | Courbe de l'app |
| Copier une fois dans la courbe de l'app | Remplit une fois les deux valeurs ci-dessous | Positionnel | — |
| Courbe de l'app : eau à −15 °C / +15 °C extérieur | Les deux points de la courbe de l'app | Positionnel | 45 / 30, ou la courbe de départ du mode |
| **Groupe réglage fin (Positionnel – Manuel)** | | | |
| Kp : degrés d'eau par degré intérieur | Degrés de température d'eau par degré d'écart intérieur | Manuel | 3 |
| Ti : temps d'intégration | Lenteur de croissance du terme I | Manuel | 3 heures |
| **Groupe réglage fin (Classique)** | | | |
| Kp : gain proportionnel | Taille de la correction par degré d'écart | Classique | 5,0 |
| Ki : gain intégral | Force de la correction d'un écart durable | Classique | 1,5 |
| Zone morte | Écart à l'intérieur duquel rien ne change | Classique | 0,3 °C |
| **Groupe coast** | | | |
| Coast activé | Coast activé ou désactivé | Classique, Manuel | Activé |
| Coast : recommandation sous la température d'eau | De combien de degrés sous la température de l'eau coast vise | Classique, Manuel | 1 °C |
| Coast : seuil de démarrage au-dessus du souhaité | Marge au-dessus de la cible avant que coast ne démarre | Classique, Manuel | 0,3 °C |
| Coast : part dans la recommandation | Poids de coast | Classique, Manuel | 0,80 |
| Coast : durée maximale (Aurora) | Nombre maximal de cycles de 5 minutes | Classique, Manuel | 24 |
| **Groupe facteurs de pondération** | | | |
| Confort — Classique uniquement | Poids de la régulation de température | Classique | 50 % |
| Efficacité | Poids de l'optimisation COP | Tous | 15 % |
| Coût | Poids de l'optimisation des prix | Tous | 15 % |
| Modèle du bâtiment — Classique uniquement | Poids du modèle de bâtiment | Classique | 20 % |

Les facteurs de pondération sont ramenés ensemble à 100 %. Efficacité et Coût n'agissent que
si l'optimisation COP ou des prix est activée. En Positionnel, elles décalent la
cible de la pièce, d'au plus 1,5 °C ; la courbe de chauffe suit.

## Température extérieure

La régulation, et surtout la courbe de chauffe en Positionnel, utilise la
température extérieure. L'app prend la première disponible :

1. la température extérieure d'une carte de flow, si elle a moins d'une heure ;
2. la prévision météo d'Open-Meteo pour l'heure en cours ;
3. le capteur extérieur de la pompe à chaleur.

Tant que la localisation est celle par défaut (Amsterdam), le capteur extérieur
de la pompe à chaleur passe avant la prévision météo (depuis v3.7.1).

La prévision est récupérée toutes les heures, même lorsque **Activer
l'intégration des prévisions météo** est désactivé ; cet interrupteur ne fait
qu'afficher ou masquer les capteurs de prévision. La prévision vaut pour la
localisation indiquée dans les réglages. Saisissez-y votre propre localisation,
ou envoyez la température extérieure au moins toutes les heures via une carte de
flow.

Exception : **Courbe de la pompe à chaleur** utilise le capteur extérieur de la
pompe à chaleur.

## Différences par pilote

| | Tuya | Aurora I/II | Aurora III |
| --- | --- | --- | --- |
| Base de la recommandation | Absent : toujours la courbe de l'app | Courbe de l'app ou courbe DIY | Courbe de l'app ou courbe climatique |
| Copier une fois | H1–H8, L1–L8 | HH1–HH8, HL1–HL8 et DIY (L28/L29) | Absent |
| Coast : durée maximale | Non réglable | Réglable | Réglable |
| Température d'eau la plus haute recommandée | 25–65 °C, 65 °C par défaut | 25–60 °C, 60 °C par défaut | 25–60 °C, 60 °C par défaut |
| La consigne ne reste qu'avec | Courbe de chauffe OFF | Sélection de courbe de chauffe OFF | — |

## Questions

**La recommandation change, mais pas la pompe à chaleur.**
Aucun flow n'applique la recommandation, ou la sélection de courbe de chauffe de
la pompe à chaleur n'est pas sur OFF.

**La consigne revient en arrière au bout d'un moment.**
La sélection de courbe de chauffe (Tuya : courbe de chauffe) n'est pas sur OFF.
La pompe à chaleur remet alors sa propre valeur de courbe.

**La recommandation ne bouge pas.**
**Contrôle adaptatif activé** est-il activé, la température intérieure
arrive-t-elle, et **Température Intérieure Souhaitée** a-t-elle une valeur ?
Sans les trois, aucune nouvelle recommandation n'est calculée. La régulation ne
le signale que dans le journal de débogage.

**J'ai modifié Kp, mais rien ne change.**
En Positionnel, **Kp : gain proportionnel** (groupe réglage fin Classique) ne
compte pas ; c'est **Kp : degrés d'eau par degré intérieur** qui s'applique, et
seulement en Manuel.

**J'ai enregistré un réglage, mais rien ne change.**
Rouvrez l'écran des réglages et vérifiez que la valeur a été conservée. Après
un message d'erreur, l'écran peut encore afficher la valeur saisie alors que
l'app garde l'ancienne. Avant 3.6.2, un facteur d'oubli inférieur à 0,9985
bloquait chaque enregistrement ; 3.6.2 remplace une telle valeur par 0,999.

**J'ai désactivé, ou activé, coast, mais rien ne change.**
En Positionnel – Radiateurs et – Plancher chauffant, coast est toujours
désactivé.

**Après avoir choisi un mode, les valeurs de courbe ne sont pas 50 / 35.**
Vous avez modifié les valeurs vous-même auparavant, ou les avez fait remplir
depuis une courbe fixe. L'app n'écrase pas votre propre courbe de chauffe.

**La recommandation est loin de ce que fait la pompe à chaleur actuellement.**
La courbe de chauffe de l'app diffère de celle de la pompe à chaleur. Reprenez
la courbe de la pompe à chaleur (voir [Choisir la courbe de
chauffe](#4-choisir-la-courbe-de-chauffe-positionnel-uniquement)). Vérifiez
aussi la localisation utilisée pour la température extérieure.
