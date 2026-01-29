# 🔧 Documentation des Flow Cards : Fonctions Avancées

> **Version** : 2.7.x  
> **Objectif** : Flow cards pour le contrôle adaptatif, modèle de bâtiment, optimiseur d'énergie, optimiseur COP, aperçus du bâtiment et données vent/rayonnement solaire

---

## 📊 Aperçu par Module

| Module | Triggers | Conditions | Actions | Total |
|--------|----------|------------|---------|-------|
| Contrôle Adaptatif | 3 | 2 | 2 | **7** |
| Modèle de Bâtiment | 1 | 1 | 0 | **2** |
| Optimiseur Énergie/Prix | 2 | 3 | 1 | **6** |
| Optimiseur COP | 5 | 5 | 0 | **10** |
| Aperçus du Bâtiment | 2 | 1 | 2 | **5** |
| Vent & Rayonnement Solaire (v2.7.0) | 0 | 0 | 3 | **3** |

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
| `thermal_component` | number | Contribution modèle thermique (°C) |
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

> **Note**: Les diagnostics du modèle de bâtiment sont automatiquement mis à jour vers la capacité `building_model_diagnostics`.

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

> **Note**: Les diagnostics de l'optimiseur COP sont automatiquement mis à jour vers la capacité `cop_optimizer_diagnostics`.

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
| `pre_heat_recommendation` ⭐ | Recommandation de préchauffage | Déclenche quand ΔT > 1.5°C (v2.6.0) |

#### `building_insight_detected` - Tokens
| Token | Type | Description |
|-------|------|-------------|
| `category` | string | Catégorie (thermal_storage, etc.) |
| `insight` | string | Description de l'aperçu |
| `recommendation` | string | Recommandation |
| `priority` | number | Priorité (0-100) |
| `confidence` | number | Confiance (%) |
| `estimated_savings_eur_month` | number | Économies estimées €/mois |

#### `pre_heat_recommendation` - Tokens (v2.6.0)
| Token | Type | Description |
|-------|------|-------------|
| `duration_hours` | number | Durée de préchauffage en heures |
| `temp_rise` | number | Élévation de température requise (°C) |
| `current_temp` | number | Température intérieure actuelle (°C) |
| `target_temp` | number | Température cible (°C) |
| `confidence` | number | Confiance du modèle (%) |

**Conditions de déclenchement :**
- ΔT (cible - intérieur) > 1.5°C
- Confiance du modèle ≥ 70%
- Max 1x par 4 heures (prévention de fatigue)

---

### 🟢 ACTIONS

| Flow ID | Titre | Description |
|---------|-------|-------------|
| `force_insight_analysis` | Forcer l'analyse des aperçus | Évaluer immédiatement (tokens: insights_detected, confidence) |
| `calculate_preheat_time` ⭐ | Calculer durée préchauffage | Calcule le temps nécessaire pour ±X°C (v2.6.0) |

#### `calculate_preheat_time` - Paramètres & Retours
| Paramètre | Type | Description |
|-----------|------|-------------|
| `temperature_rise` | number | Élévation de température souhaitée en °C (ex: 2.0) |

| Token de Retour | Type | Description |
|-----------------|------|-------------|
| `preheat_hours` | number | Durée de préchauffage en heures |
| `confidence` | number | Confiance du modèle (%) |
| `building_tau` | number | Constante de temps thermique τ (heures) |

**Exemple de flow :**
```
WHEN Bloc de prix le moins cher approche (2 heures à l'avance)
THEN
  1. Calculer durée de préchauffage (temperature_rise = 2.0)
  2. IF preheat_hours < 3 THEN
       → Démarrer le préchauffage maintenant
  3. Notification : "Le préchauffage dure {{preheat_hours}}h"
```

---

### 🟡 CONDITIONS

| Flow ID | Titre | Description |
|---------|-------|-------------|
| `insight_is_active` | Aperçu est actif | Vérifie si la catégorie est active |

---

## 6️⃣ Données Vent & Rayonnement Solaire (v2.7.0)

> **Nouveau en v2.7.0** : Données externes de vent et de radiation solaire pour un modèle de bâtiment plus précis et une correction du vent.

### 🟢 ACTIONS

| Flow ID | Titre | Description |
|---------|-------|-------------|
| `receive_external_wind_data` ⭐ | Envoyer vitesse du vent à la pompe à chaleur | Données de vent pour correction des pertes de chaleur |
| `receive_external_solar_power` ⭐ | Envoyer puissance solaire à la pompe à chaleur | Puissance des panneaux solaires (W) |
| `receive_external_solar_radiation` | Envoyer radiation solaire à la pompe à chaleur | Radiation directe (W/m²) |

#### `receive_external_wind_data` - Paramètres
| Paramètre | Type | Plage | Description |
|-----------|------|-------|-------------|
| `wind_speed` | number | 0-200 km/h | Vitesse du vent en kilomètres par heure |

**Formule de correction du vent :**
```
correction = α × windSpeed × ΔT / 100
```
* `α` = coefficient de sensibilité au vent (appris ou manuel)
* `ΔT` = (T_indoor - T_outdoor)

**Table de référence α du vent (v2.7.0) :**
| α value | Signification | Bâtiment typique |
|---------|---------------|------------------|
| 0.03-0.05 | Faible sensibilité au vent | Emplacement abrité |
| 0.05-0.08 | Moyenne | Maison standard |
| 0.08-0.12 | Sensible au vent | Détachée, exposée |

**Exemple de flow :**
```
WHEN Vitesse du vent changée (weather app)
THEN Envoyer vitesse du vent à la pompe à chaleur ({{wind_speed}})
```

---

#### `receive_external_solar_power` - Paramètres
| Paramètre | Type | Plage | Description |
|-----------|------|-------|-------------|
| `power_value` | number | 0-50000 W | Puissance actuelle des panneaux solaires en watts |

**Conversion en radiation :**
```
radiation = P_panel / Wp × 1000 W/m²
```
* `Wp` = Puissance crête des panneaux solaires (paramètre : solar_panel_wp)

**Exemple de flow :**
```
WHEN Puissance panneau solaire changée (SolarEdge/Enphase app)
THEN Envoyer puissance solaire à la pompe à chaleur ({{current_power}})
```

> [!TIP]
> Configurez `solar_panel_wp` dans les paramètres de l’appareil pour une conversion précise.

---

#### `receive_external_solar_radiation` - Paramètres
| Paramètre | Type | Plage | Description |
|-----------|------|-------|-------------|
| `radiation_value` | number | 0-1500 W/m² | Radiation solaire directe en W/m² |

**Exemple de flow :**
```
WHEN Radiation solaire changée (station météo/KNMI app)
THEN Envoyer radiation solaire à la pompe à chaleur ({{radiation}})
```

**Cascade de priorité :** Lorsque la puissance solaire et la radiation sont reçues, la puissance solaire a la priorité (plus précise).

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
| `force_insight_analysis` | `flow-card-manager-service.ts:745` |
| `receive_external_wind_data` | `flow-card-manager-service.ts:984` |
| `receive_external_solar_power` | `flow-card-manager-service.ts:996` |
| `receive_external_solar_radiation` | `flow-card-manager-service.ts:1008` |

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

*Voir : [Configuration Guide](../advanced-settings/CONFIGURATION_GUIDE.fr.md) pour tous les paramètres*
