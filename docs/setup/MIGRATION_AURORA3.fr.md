# Passer au pilote Aurora III

Ce guide s'adresse aux utilisateurs de l'application distincte **Adlar Castra Pompe à Chaleur (Aurora-III Modbus)**. À partir de la version 3.2.0, la prise en charge d'Aurora III fait partie de l'application **Pompe à chaleur Adlar Castra**, sous la forme du pilote *Adlar Castra Aurora III Heat Pump (Modbus)*.

Homey ne peut pas déplacer des appareils d'une application à une autre. Passer à la nouvelle application signifie : associer à nouveau l'appareil dans la nouvelle application et recréer vos flows.

## Ce qui est perdu

- **Flows** : les flows qui utilisent des cartes de l'ancienne application doivent être recréés.
- **Paramètres** : les paramètres de l'appareil ne sont pas repris.
- **Insights** : l'historique de l'ancien appareil n'est pas transféré au nouvel appareil.

## Étape 1 — Préparer

1. Notez les paramètres de l'ancien appareil que vous avez modifiés (par exemple les intervalles d'interrogation, la régulation adaptative, les prix de l'énergie, la mesure de puissance).
2. Notez quels flows utilisent l'ancien appareil. Une capture d'écran par flow aide à les recréer.
3. Notez l'adresse IP, le port TCP et l'ID d'unité Modbus de la passerelle.

## Étape 2 — Arrêter l'ancienne application

Ne laissez **pas** l'ancienne application et le nouveau pilote communiquer en même temps avec la même pompe à chaleur. Les deux interrogeraient et écriraient via la même passerelle (consignes, régulation adaptative), avec un risque de délais dépassés et de commandes contradictoires.

Faites donc d'abord l'une des deux choses suivantes :

- supprimez l'appareil de l'ancienne application, ou
- dans l'ancienne application, désactivez la régulation adaptative et tous les flows qui écrivent vers la pompe à chaleur.

## Étape 3 — Associer dans la nouvelle application

1. Installez ou mettez à jour l'application **Pompe à chaleur Adlar Castra** en version 3.2.0 ou supérieure.
2. Ajoutez un appareil et choisissez **Adlar Castra Aurora III Heat Pump (Modbus)**. Ne choisissez pas le pilote Aurora II : il utilise d'autres adresses de registres.
3. Saisissez l'adresse IP, le port TCP et l'ID d'unité Modbus de la passerelle.
4. Rétablissez les paramètres notés dans les paramètres de l'appareil.

Les réglages de la passerelle ne changent pas. Pour Aurora III, ils restent `9600 8N2` avec `Serial protocol` = `Modbus` ; voir le [guide Elfin](modbus-elfin-ew11-setup.md) (en néerlandais).

## Étape 4 — Recréer les flows

Recréez les flows avec le nouvel appareil. Les cartes portent les mêmes titres que dans l'ancienne application. Dans l'éditeur de Flow, chaque appareil affiche les cartes de son propre pilote ; sélectionnez donc toujours l'appareil Aurora III.

Nouveau, réservé à Aurora III : régler le mode silencieux, commuter la fonction eau chaude, commuter l'appoint électrique forcé, ainsi que les conditions *L'eau chaude est en chauffe* et *Le mode silencieux est*. Voir le [guide des cartes de flux](guide/FLOW_CARDS_GUIDE.fr.md).

## Étape 5 — Tableaux de bord

Le tableau de bord local du pilote Aurora III fonctionne par défaut sur le port **8091** (l'ancienne application utilisait 8090) :

```text
http://<homey-ip>:8091/
```

Voir le [guide des tableaux de bord](MODBUS_DASHBOARD_GUIDE.fr.md).

## Étape 6 — Supprimer l'ancienne application

Lorsque tout fonctionne dans la nouvelle application, supprimez l'ancienne application **Adlar Castra Pompe à Chaleur (Aurora-III Modbus)**.
