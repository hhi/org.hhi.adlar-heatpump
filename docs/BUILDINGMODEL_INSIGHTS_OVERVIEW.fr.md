# 🏠 Nouvelle Fonctionnalité : Modèle de Bâtiment & Building Insights

> **Statut** : Disponible à partir de la version 2.5.x  
> **Prérequis** : Contrôle Adaptatif de Température actif + température intérieure/extérieure

---

## Qu'est-ce que le Modèle de Bâtiment ?

L'application **apprend automatiquement** les propriétés thermiques de votre maison en analysant les données de température. Après 24-48 heures, l'application connaît votre maison mieux que vous.

### Qu'Apprend l'Application ?

| Paramètre | Ce que ça signifie | Exemple |
|-----------|---------------------|---------|
| **C** (Masse thermique) | Combien de chaleur votre maison peut stocker | Sol en béton = élevé, ossature bois = faible |
| **UA** (Perte de chaleur) | À quelle vitesse la chaleur s'échappe | Bien isolé = UA faible |
| **τ** (Constante de temps) | Heures jusqu'à température stable | τ = 50h = refroidissement lent |
| **g** (Gain solaire) | Contribution du chauffage par le soleil | Vitrage sud = g élevé |
| **P_int** (Chaleur interne) | Production de chaleur par occupants/appareils | Famille avec PCs = P_int plus élevé |

---

## Qu'est-ce que Building Insights ?

Après avoir appris votre bâtiment, l'application fournit des **recommandations concrètes** avec un ROI estimé (Retour sur Investissement).

### Exemples d'Insights :

| Insight | Recommandation | Économies Estimées |
|---------|----------------|---------------------|
| 🌡️ **UA élevé** | "Envisager l'isolation du toit" | €200-400/an |
| ⏰ **τ long** | "Le préchauffage est efficace" | €100-150/an |
| ☀️ **Valeur g élevée** | "Ombrage = moins de refroidissement nécessaire" | €50-100/an |
| 🔥 **P_int élevé** | "La température nocturne peut être plus basse" | €50-80/an |

---

## Comment Ça Fonctionne ?

```
┌─────────────────────────────────────────────────────────────┐
│  Étape 1 : Collecter les Données                            │
│  ───────────────────────────────                            │
│  • Température intérieure (capteur)                         │
│  • Température extérieure (service météo/capteur)           │
│  • Puissance pompe à chaleur (optionnel)                    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Étape 2 : Machine Learning                                 │
│  ──────────────────────────                                 │
│  • Après 10 échantillons : première analyse                 │
│  • Après 24 heures : 70% de confiance                       │
│  • Après 1 semaine : configuration de profil complète       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Étape 3 : Générer les Insights                             │
│  ──────────────────────────────                             │
│  • Comparaison avec valeurs de référence                    │
│  • Calcul ROI par recommandation                            │
│  • Max 3 insights actifs à la fois                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Niveaux de Confiance

| Confiance | Ce que ça signifie | Action |
|-----------|---------------------|--------|
| 0-30% | Données insuffisantes | Attendre plus d'échantillons |
| 30-70% | Modèle de base | Premières prédictions possibles |
| 70-90% | Modèle fiable | Insights disponibles |
| 90-100% | Profil complet | Ajustements saisonniers actifs |

**Par défaut** : Les insights n'apparaissent qu'à 70% de confiance (configurable).

---

## Paramètres

| Paramètre | Par défaut | Description |
|-----------|------------|-------------|
| `building_model_enabled` | Désactivé | Activer l'apprentissage du modèle |
| `building_insights_enabled` | Désactivé | Activer les recommandations |
| `building_insights_min_confidence` | 70% | Certitude minimale pour insights |
| `building_insights_max_active` | 3 | Max recommandations simultanées |

---

## Prérequis

**Minimum :**
- ✅ Contrôle adaptatif de température actif
- ✅ Capteur de température intérieure

**Recommandé :**
- ✅ Température extérieure externe (service météo/station météo)
- ✅ Mesure de puissance externe (pour économies € dans insights)

---

*Plus d'infos : [Advanced Features Introduction](setup/Advanced_Features_Intro.fr.md)*
*Plus d'infos : [Configuration Guide](setup/advanced-settings/CONFIGURATION_GUIDE.fr.md) - Section 6 & 7*
