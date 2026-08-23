# Guide des Diagnostics et Tableaux de Bord Modbus (Adlar Castra Aurora)

Ce guide décrit les outils intégrés de diagnostic et de maintenance du **pilote Modbus** dans l'application Homey Adlar Castra.

---

## 1. Vue d'ensemble

Le pilote Modbus (`intelligent-heatpump-modbus`) comprend un service HTTP local optionnel pour le diagnostic approfondi, la surveillance en temps réel et l'inspection avancée des registres. Cet outil s'exécute directement sur votre Homey Pro et est accessible depuis votre navigateur web local.

### Points forts
- **100 % local** : Aucune connexion cloud externe requise.
- **Surveillance en temps réel** : Affichage en direct des températures, pressions, vitesses de ventilateur et états du compresseur.
- **Éditeur de courbe de chauffe** : Ajustement visuel et simulation de votre courbe de chauffe.
- **Inspection des registres** : Vue détaillée des registres Modbus (paramètres P et L).

---

## 2. Accès et Configuration

### Configuration du port
Par défaut, le service HTTP est actif sur le port **8090**. Vous pouvez modifier ce port dans l'application Homey :
1. Ouvrez l'application Homey sur votre smartphone ou ordinateur.
2. Accédez à votre pompe à chaleur Modbus.
3. Ouvrez **Paramètres** (icône d'engrenage) → **Paramètres avancés**.
4. Localisez la section **Tableaux de bord locaux** et modifiez le **Port du tableau de bord** si le port 8090 est déjà utilisé.

### Ouvrir le tableau de bord
Ouvrez un navigateur web sur un appareil connecté au même réseau local et accédez à :

```text
http://<homey-ip>:8090/
```

*(Remplacez `<homey-ip>` par l'adresse IP locale de votre Homey Pro, par exemple `http://192.168.1.50:8090/`)*

---

## 3. Vues et Points de Terminaison Disponibles

| Point d'accès | Description | Objectif |
|---|---|---|
| `/` | **Aperçu en direct** | Vue principale avec état en temps réel, températures, puissance et COP. |
| `/interactive` | **Commandes interactives** | Aperçu avec réglage direct des consignes et modes de fonctionnement. |
| `/live` | **Capacités par catégorie** | Toutes les capacités Homey actives regroupées par catégorie. |
| `/expert` | **Vue expert des registres** | Tableau complet des registres Modbus avec outils de lecture et d'écriture. |
| `/changelog` | **Journal des registres** | Historique des modifications de registres et conseils d'interrogation. |
| `/heating-curve` | **Éditeur de courbe de chauffe** | Simulateur et outil de configuration pour courbes personnalisées. |

---

## 4. Consignes de Sécurité pour les Outils Experts

> [!WARNING]
> **Prudence lors de l'écriture dans les registres**
> La modification manuelle des registres Modbus via la vue `/expert` affecte directement le contrôleur de la pompe à chaleur.
> - Ne modifiez des registres que si vous connaissez les spécifications techniques du fabricant Adlar.
> - Notez systématiquement la valeur d'origine avant toute modification.
> - Le mappage de registres est principalement optimisé pour la série R32.
