# Guide Rapide pour les Problèmes de Connexion ECONNRESET

## 🚨 Pour les Utilisateurs Rencontrant des Réinitialisations de Connexion

Si votre pompe à chaleur se déconnecte en permanence avec des erreurs ECONNRESET, le problème est probablement une **incompatibilité de version de protocole**.

## ✅ Solution : Changer la Version du Protocole à 3.4

### Étapes (prend 2 minutes) :

1. Ouvrez l'**application Homey** → Accédez à votre appareil pompe à chaleur
2. Appuyez sur **⚙️ Paramètres** (en haut à droite)
3. Faites défiler vers le **haut** jusqu'à la section des paramètres de connexion
4. Mettez à jour vos paramètres :
   - **Version du Protocole : SÉLECTIONNEZ 3.4** ← **CHANGEZ CECI**
   - ID de l'appareil : *(garder identique ou mettre à jour si nécessaire)*
   - Clé locale : *(garder identique ou mettre à jour si nécessaire)*
   - Adresse IP : *(garder identique ou mettre à jour si nécessaire)*
5. Appuyez sur **Enregistrer**
6. Attendez 1-2 minutes pour la reconnexion

### Résultat Attendu :
- ✓ L'état de connexion affiche "connecté"
- ✓ Plus d'erreurs ECONNRESET
- ✓ Les données des capteurs se mettent à jour correctement
- ✓ L'appareil reste connecté

### Toujours Pas de Résultat ?
Essayez la version du protocole **3.5** en suivant les mêmes étapes (changez la Version du Protocole dans les Paramètres à 3.5).

### Pourquoi Cela Se Produit-il ?
Différents modèles de pompes à chaleur utilisent différentes versions du protocole Tuya. L'application utilisait auparavant 3.3 par défaut, mais de nombreux modèles plus récents nécessitent 3.4 ou 3.5.

---

**Version 0.99.59** a ajouté la sélection de la version du protocole pour résoudre ce problème définitivement.

**Besoin d'aide détaillée ?** Voir [PROTOCOL_VERSION_GUIDE.md](PROTOCOL_VERSION_GUIDE.md)
