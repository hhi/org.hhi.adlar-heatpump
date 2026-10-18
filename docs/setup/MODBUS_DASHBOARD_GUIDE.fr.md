# Guide des Diagnostics et Tableaux de Bord Modbus (Adlar Castra Aurora)

Ce guide décrit les outils intégrés de diagnostic et de maintenance des **pilotes Modbus** dans l'application Homey Adlar Castra : le pilote Aurora II et le pilote Aurora III.

---

## 1. Vue d'ensemble

Les deux pilotes Modbus (`intelligent-heatpump-modbus` pour Aurora II, `intelligent-heatpump-aurora3` pour Aurora III) comprennent un service HTTP local optionnel pour le diagnostic approfondi, la surveillance en temps réel et l'inspection avancée des registres. Cet outil s'exécute directement sur votre Homey Pro et est accessible depuis votre navigateur web local. Chaque modèle dispose de son propre serveur de tableaux de bord sur son propre port.

### Points forts
- **100 % local** : Aucune connexion cloud externe requise.
- **Surveillance en temps réel** : Affichage en direct des températures, pressions, vitesses de ventilateur et états du compresseur.
- **Éditeur de courbe de chauffe** (Aurora II uniquement) : Ajustement visuel et simulation de votre courbe de chauffe.
- **Inspection des registres** : Vue détaillée des registres Modbus (paramètres P et L sur Aurora II, registres d'entrée et de maintien sur Aurora III).

---

## 2. Accès et Configuration

### Configuration du port

| Modèle | Port par défaut |
|---|---|
| Aurora II | **8090** |
| Aurora III | **8091** |

Le serveur de tableaux de bord démarre dès qu'un appareil de ce modèle est associé. Vous pouvez modifier le port dans l'application Homey :
1. Ouvrez l'application Homey sur votre smartphone ou ordinateur.
2. Accédez à votre pompe à chaleur Modbus.
3. Ouvrez **Paramètres** (icône d'engrenage) → **Paramètres avancés**.
4. Localisez la section **Tableaux de bord locaux** et modifiez le **Port du tableau de bord** si le port est déjà utilisé.

Ne choisissez pas le même port pour les deux modèles : seul le premier serveur de tableaux de bord démarrerait.

### Ouvrir le tableau de bord
Ouvrez un navigateur web sur un appareil connecté au même réseau local et accédez à :

```text
http://<homey-ip>:8090/   (Aurora II)
http://<homey-ip>:8091/   (Aurora III)
```

*(Remplacez `<homey-ip>` par l'adresse IP locale de votre Homey Pro, par exemple `http://192.168.1.50:8090/`)*

---

## 3. Vues et Points de Terminaison Disponibles

| Point d'accès | Description | Objectif | Aurora II | Aurora III |
|---|---|---|---|---|
| `/` | **Aperçu en direct** | Vue principale avec état en temps réel, températures, puissance et COP. | ✓ | ✓ |
| `/interactive` | **Commandes interactives** | Aperçu avec réglage direct des consignes et modes de fonctionnement. Sur Aurora III également la fonction eau chaude, le mode silencieux, l'appoint électrique et (expérimental) marche/arrêt. | ✓ | ✓ |
| `/live` | **Capacités par catégorie** | Toutes les capacités Homey actives regroupées par catégorie. | ✓ | ✓ |
| `/expert` | **Vue expert des registres** | Tableau complet des registres Modbus avec outils de lecture et d'écriture. | ✓ | ✓ |
| `/changelog` | **Journal des registres** | Historique des modifications de registres et conseils d'interrogation. | ✓ | ✓ |
| `/heating-curve` | **Éditeur de courbe de chauffe** | Simulateur et outil de configuration pour courbes personnalisées. | ✓ | — |

---

## 4. Consignes de Sécurité pour les Outils Experts

> [!WARNING]
> **Prudence lors de l'écriture dans les registres**
> La modification manuelle des registres Modbus via la vue `/expert` affecte directement le contrôleur de la pompe à chaleur.
> - Ne modifiez des registres que si vous connaissez les spécifications techniques du fabricant Adlar.
> - Notez systématiquement la valeur d'origine avant toute modification.
> - Le mappage de registres du pilote Aurora II est principalement optimisé pour la série R32.

> [!IMPORTANT]
> **Pas de mot de passe sur les tableaux de bord**
> Les tableaux de bord sont accessibles sans connexion depuis tout appareil de votre réseau local, y compris les fonctions d'écriture. Avec un appareil de chaque modèle, deux ports de ce type sont ouverts. Utilisez les tableaux de bord uniquement sur un réseau de confiance et ne les exposez pas à Internet.
