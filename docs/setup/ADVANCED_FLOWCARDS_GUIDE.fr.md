# 🔧 Documentation des Flow Cards : Fonctions Avancées

> **Version** : 2.5.x  
> **Objectif** : Flow cards pour le contrôle adaptatif, modèle de bâtiment, optimiseur d'énergie, optimiseur COP et aperçus du bâtiment

---

## 📊 Aperçu par Module

| Module | Triggers | Conditions | Actions | Total |
|--------|----------|------------|---------|-------|
| Contrôle Adaptatif | 3 | 2 | 2 | **7** |
| Modèle de Bâtiment | 1 | 1 | 2 | **4** |
| Optimiseur Énergie/Prix | 2 | 3 | 1 | **6** |
| Optimiseur COP | 5 | 5 | 1 | **11** |
| Aperçus du Bâtiment | 1 | 1 | 4 | **6** |

---

## 1️⃣ Contrôle Adaptatif de Température

### 🔵 TRIGGERS

| Flow ID | Titre | Description |
|---------|-------|-------------|
| `adaptive_simulation_update` ⭐ | Température simulée mise à jour | Trigger central (toutes les 5 min) avec répartition complète |
| `temperature_adjustment_recommended` ⭐ | Ajustement de température recommandé | Trigger pour mode flow-assisted avec recommandation |
| `adaptive_status_change` | État du contrôle adaptatif changé | Changement d'état (on/off/erreur) |

#### `temperature_adjustment_recommended` - Tokens
| Token | Type | Description |
|-------|------|-------------|
| `current_temperature` | number | Température cible actuelle (°C) |
| `recommended_temperature` | number | Température cible recommandée (°C) |
| `adjustment` | number | Ajustement de température (°C) |
| `reason` | string | Raison de l'ajustement |
| `controller` | string | Type de contrôleur (weighted) |
| `building_model_confidence` | number | Confiance du modèle de bâtiment (%) |

#### `adaptive_simulation_update` - Tokens
| Token | Type | Description |
|-------|------|-------------|
| `simulated_target` | number | Température cible simulée (°C) |
| `actual_target` | number | Cible réelle (°C) |
| `delta` | number | Différence (°C) |
| `adjustment` | number | Ajustement proposé (°C) |
| `comfort_component` | number | Contribution confort (°C) |
| `efficiency_component` | number | Contribution COP (°C) |
| `cost_component` | number | Contribution coût (°C) |
| `building_model_confidence` | number | Confiance du modèle de bâtiment (%) |
| `cop_confidence` | number | Confiance COP (%) |
| `reasoning` | string | Explication du calcul |

---

### 🟢 ACTIONS

| Flow ID | Titre | Description |
|---------|-------|-------------|
| `receive_external_indoor_temperature` ⭐ | Envoyer température intérieure à la pompe à chaleur | **ESSENTIEL** - Connecter capteur externe |
| `receive_external_ambient_data` | Envoyer température extérieure | Température extérieure externe |

#### `receive_external_indoor_temperature` - Paramètres
| Paramètre | Type | Description |
|-----------|------|-------------|
| `temperature_value` | text | Température en °C |

---

### 🟡 CONDITIONS

| Flow ID | Titre | Description |
|---------|-------|-------------|
| `confidence_above` | Confiance du modèle au-dessus du seuil | Porte de qualité |

---

## 2️⃣ Apprentissage du Modèle de Bâtiment

### 🟢 ACTIONS

| Flow ID | Titre | Description |
|---------|-------|-------------|
| `diagnose_building_model` | Diagnostiquer l'apprentissage du modèle | Journalise l'état τ/C/UA |

---

### 🟡 CONDITIONS

| Flow ID | Titre | Description |
|---------|-------|-------------|
| `confidence_above` | Confiance du modèle au-dessus du seuil | Vérifier le niveau de confiance |

---

## 3️⃣ Optimiseur Énergie/Prix

### 🔵 TRIGGERS

| Flow ID | Titre | Description |
|---------|-------|-------------|
| `price_trend_changed` ⭐ | Tendance des prix changée | rising → falling → stable |
| `price_threshold_crossed` | Seuil de prix dépassé | Catégorie changée |

#### `price_trend_changed` - Tokens
| Token | Type | Description |
|-------|------|-------------|
| `old_trend` | string | Tendance précédente |
| `new_trend` | string | Nouvelle tendance |
| `hours_analyzed` | number | Heures analysées |

---

### 🟢 ACTIONS

| Flow ID | Titre | Description |
|---------|-------|-------------|
| `receive_external_energy_prices` ⭐ | Envoyer prix de l'énergie à la pompe à chaleur | Format JSON `{"0":0.11,...}` |

---

### 🟡 CONDITIONS

| Flow ID | Titre | Description |
|---------|-------|-------------|
| `price_in_cheapest_hours` | Prix dans les heures les moins chères | Vérifie si l'heure actuelle est dans les X heures les moins chères |
| `price_vs_daily_average` | Prix vs moyenne journalière | Au-dessus/en dessous de X% de la moyenne |
| `price_trend_is` | Tendance des prix est | rising/falling/stable |

---

## 4️⃣ Optimiseur COP

### 🔵 TRIGGERS

| Flow ID | Titre | Description |
|---------|-------|-------------|
| `cop_efficiency_changed` | Efficacité COP changée | COP actuel changé |
| `cop_outlier_detected` | Valeur aberrante COP détectée | Valeur < 0.5 ou > 8.0 |
| `cop_trend_detected` | Tendance COP détectée | Classification de tendance |
| `daily_cop_efficiency_changed` | COP journalier changé | Moyenne 24 heures |
| `monthly_cop_efficiency_changed` | COP mensuel changé | Moyenne 30 jours |

---

### 🟢 ACTIONS

| Flow ID | Titre | Description |
|---------|-------|-------------|
| `diagnose_cop_optimizer` | Diagnostiquer l'apprentissage optimiseur COP | Journalise les échantillons par bucket de temp |

---

### 🟡 CONDITIONS

| Flow ID | Titre | Description |
|---------|-------|-------------|
| `cop_efficiency_check` | COP au-dessus/en dessous du seuil | Vérification de seuil |
| `cop_calculation_method_is` | Méthode COP est | auto, direct_thermal, etc. |
| `cop_trend_analysis` | Tendance COP est | Classification de tendance |
| `daily_cop_above_threshold` | COP journalier au-dessus du seuil | Vérification 24 heures |
| `monthly_cop_above_threshold` | COP mensuel au-dessus du seuil | Vérification 30 jours |

---

## 5️⃣ Aperçus du Bâtiment

### 🔵 TRIGGERS

| Flow ID | Titre | Description |
|---------|-------|-------------|
| `building_insight_detected` ⭐ | Nouvel aperçu du bâtiment | Déclenche à ≥70% de confiance |

#### `building_insight_detected` - Tokens
| Token | Type | Description |
|-------|------|-------------|
| `category` | string | Catégorie (thermal_storage, etc.) |
| `insight` | string | Description de l'aperçu |
| `recommendation` | string | Recommandation |
| `priority` | number | Priorité (0-100) |
| `confidence` | number | Confiance (%) |
| `estimated_savings_eur_month` | number | Économies estimées €/mois |

---

### 🟢 ACTIONS

| Flow ID | Titre | Description |
|---------|-------|-------------|
| `force_insight_analysis` | Forcer l'analyse des aperçus | Évaluer immédiatement (tokens: insights_detected, confidence) |
| `dismiss_insight` | Ignorer l'aperçu | Masquer la catégorie pendant X jours |
| `reset_insight_history` | Réinitialiser l'historique des aperçus | Effacer tous les aperçus ignorés |
| `set_confidence_threshold` | Définir le seuil de confiance | Ajuster dynamiquement (50-90%) |

---

### 🟡 CONDITIONS

| Flow ID | Titre | Description |
|---------|-------|-------------|
| `insight_is_active` | Aperçu est actif | Vérifie si la catégorie est active |

---

## 📁 Emplacements du Code Source

### Définitions JSON
```
.homeycompose/flow/
├── triggers/   → Définitions des triggers de flux
├── conditions/ → Définitions des conditions de flux
└── actions/    → Définitions des actions de flux
```

### Référence d'Implémentation du Code

> **Légende** : Trigger = où le flow est appelé | RunListener = où le filtrage/args sont traités

#### TRIGGERS

| Flow ID | Emplacement Trigger | Emplacement RunListener |
|---------|---------------------|-------------------------|
| `adaptive_simulation_update` | `adaptive-control-service.ts:945` | - |
| `temperature_adjustment_recommended` | `adaptive-control-service.ts:907` | - |
| `adaptive_status_change` | `adaptive-control-service.ts:882` | - |
| `building_insight_detected` | `building-insights-service.ts:748` | - |
| `price_trend_changed` | `adaptive-control-service.ts:1919` | - |
| `price_threshold_crossed` | `adaptive-control-service.ts:1678` | - |
| `cop_efficiency_changed` | `device.ts:2043` | `app.ts:988` |
| `cop_outlier_detected` | `device.ts:2019` | - |
| `cop_trend_detected` | `rolling-cop-calculator.ts:586` | - |
| `daily_cop_efficiency_changed` | `rolling-cop-calculator.ts:618` | `app.ts:1022` |
| `monthly_cop_efficiency_changed` | `rolling-cop-calculator.ts:636` | `app.ts:1056` |

#### ACTIONS

| Flow ID | Emplacement Handler |
|---------|---------------------|
| `receive_external_indoor_temperature` | `flow-card-manager-service.ts:988` |
| `receive_external_energy_prices` | `flow-card-manager-service.ts:1021` |
| `receive_external_power_data` | `flow-card-manager-service.ts:945` |
| `receive_external_flow_data` | `flow-card-manager-service.ts:964` |
| `receive_external_ambient_data` | `flow-card-manager-service.ts:976` |
| `diagnose_building_model` | `flow-card-manager-service.ts:1033` |
| `diagnose_cop_optimizer` | `flow-card-manager-service.ts:857` |
| `force_insight_analysis` | `flow-card-manager-service.ts:745` |
| `dismiss_insight` | `flow-card-manager-service.ts:731` |
| `reset_insight_history` | `flow-card-manager-service.ts:762` |
| `set_confidence_threshold` | `flow-card-manager-service.ts:782` |

#### CONDITIONS

| Flow ID | Emplacement Handler |
|---------|---------------------|
| `confidence_above` | `flow-card-manager-service.ts:814` |
| `insight_is_active` | `flow-card-manager-service.ts:798` |
| `price_in_cheapest_hours` | `flow-card-manager-service.ts:506` |
| `price_vs_daily_average` | `flow-card-manager-service.ts:629` |
| `price_trend_is` | `flow-card-manager-service.ts:563` |
| `savings_above` | `flow-card-manager-service.ts:830` |

---

*Voir : [Configuration Guide](./advanced-settings/CONFIGURATION_GUIDE.fr.md) pour tous les paramètres*
