# Guide de Dépannage des Versions de Protocole

## Pour les Utilisateurs Rencontrant des Problèmes ECONNRESET ou de Connexion

Si vous rencontrez des réinitialisations de connexion fréquentes, des déconnexions ou que l'appareil devient indisponible de manière répétée, le problème peut être causé par une **incompatibilité de version de protocole** entre l'application et votre appareil pompe à chaleur.

### Symptômes d'Incompatibilité de Version de Protocole

- ✗ Erreurs "ECONNRESET" fréquentes dans les journaux
- ✗ L'appareil se reconnecte constamment (le statut affiche "reconnexion")
- ✗ L'appareil devient indisponible de manière répétée
- ✗ La connexion fonctionne brièvement puis échoue
- ✗ L'application semble planter ou ne plus répondre

### Comment Corriger : Mettre à Jour Votre Version de Protocole

#### Étape 1 : Déterminer la Version de Protocole de Votre Appareil

La plupart des pompes à chaleur Adlar/Castra utilisent la version de protocole **3.3** (par défaut), mais certains modèles plus récents nécessitent **3.4** ou **3.5**.

**Si vous n'êtes pas sûr de la version utilisée par votre appareil :**
- Consultez le manuel de votre appareil ou les spécifications
- Contactez le support Adlar avec votre numéro de modèle d'appareil
- Essayez les versions dans l'ordre : 3.4 d'abord (alternative la plus courante), puis 3.5

#### Étape 2 : Mettre à Jour la Version de Protocole dans les Paramètres de l'Appareil

1. **Ouvrez l'application Homey** sur votre téléphone/tablette
2. **Accédez à votre appareil pompe à chaleur**
3. **Appuyez sur l'icône paramètres (engrenage)** en haut à droite
4. **Faites défiler vers le haut** jusqu'à la section des paramètres de connexion
5. **Mettez à jour vos identifiants d'appareil :**
   - **Version du Protocole** ← **SÉLECTIONNEZ LA VERSION CORRECTE ICI**
     - Essayez **3.4** si vous avez des problèmes de connexion
     - Essayez **3.5** si 3.4 ne fonctionne pas
   - ID de l'appareil (garder identique ou mettre à jour si nécessaire)
   - Clé locale (garder identique ou mettre à jour si nécessaire)
   - Adresse IP (garder identique ou mettre à jour si nécessaire)
6. **Appuyez sur "Enregistrer"** et attendez la reconnexion

#### Étape 3 : Vérifier la Connexion

Après la mise à jour des paramètres :
- Vérifiez l'état de l'appareil - il devrait afficher "connecté" dans un délai de 1-2 minutes
- Vérifiez la capacité d'état de connexion : `adlar_connection_status`
- Surveillez pendant 10-15 minutes pour assurer une connexion stable
- Si vous rencontrez toujours des problèmes, essayez une version de protocole différente

### Référence des Versions de Protocole

| Version | Cas d'Utilisation Courant |
|---------|---------------------------|
| **3.3** | Modèles Adlar/Aurora plus anciens (PAR DÉFAUT) |
| **3.4** | Modèles Adlar plus récents, alternative la plus courante |
| **3.5** | Derniers modèles, moins courant |

### Indicateurs de Succès

✓ L'état de connexion affiche "connecté" et reste connecté
✓ Aucune erreur ECONNRESET dans les journaux
✓ Les données des capteurs se mettent à jour régulièrement (toutes les 20-30 secondes)
✓ Les commandes de l'appareil fonctionnent immédiatement
✓ Aucun message "indisponible"

### Vous Rencontrez Toujours des Problèmes ?

Si vous avez essayé les trois versions de protocole et que vous avez toujours des problèmes de connexion :

1. **Vérifier la connectivité réseau :**
   - La pompe à chaleur dispose d'une connexion WiFi/LAN stable
   - Homey peut atteindre l'adresse IP de la pompe à chaleur
   - Aucun pare-feu ne bloque la communication

2. **Vérifier les identifiants de l'appareil :**
   - L'ID de l'appareil est correct
   - La clé locale n'a pas changé
   - L'adresse IP est actuelle (n'a pas changé via DHCP)

3. **Contacter le support :**
   - Partagez les versions de protocole que vous avez essayées
   - Partagez les journaux d'erreurs de Homey
   - Fournissez votre numéro de modèle d'appareil

## Pour un Nouvel Appairage d'Appareil

Lors de l'appairage d'un nouvel appareil, vous verrez maintenant le menu déroulant de version de protocole :

1. Entrez l'ID de l'appareil, la Clé locale et l'Adresse IP
2. **Sélectionnez la Version du Protocole :**
   - **3.3 (Par défaut)** - Commencez ici pour la plupart des appareils
   - **3.4** - Essayez si 3.3 a des problèmes de connexion
   - **3.5** - Essayez si 3.4 a des problèmes de connexion
3. Continuez avec l'appairage

**Astuce :** Si vous n'êtes pas sûr, commencez avec 3.3. Vous pouvez toujours le changer plus tard dans les paramètres de l'appareil.

## Contexte Technique

La version du protocole Tuya détermine comment l'application communique avec votre appareil au niveau réseau. L'utilisation de la mauvaise version provoque :
- Des paquets réseau malformés
- Des erreurs de connexion socket (ECONNRESET)
- Des échecs d'authentification
- Une corruption de données

Différents modèles de pompes à chaleur/versions de micrologiciel nécessitent différentes versions de protocole. Il n'y a aucun risque à essayer différentes versions - mettez simplement à jour la version du protocole dans les paramètres de l'appareil pour changer.

## Historique des Versions

- **v0.99.62** - Flux de réparation supprimé, identifiants désormais modifiables directement dans les paramètres de l'appareil
- **v0.99.59** - Ajout de la sélection de version de protocole pendant l'appairage
- **v0.99.58 et antérieures** - Codé en dur à la version 3.3 (a causé des problèmes pour certains utilisateurs)

---

**Besoin d'Aide ?** Signalez les problèmes sur : https://github.com/your-repo/issues
