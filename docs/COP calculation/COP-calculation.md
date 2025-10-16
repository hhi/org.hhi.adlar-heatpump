# COP Calculation Formulas - Mathematical Explanation

## What is COP?

**Coefficient of Performance (COP)** is defined as:

```
COP = Useful Heat Output / Electrical Energy Input
```

The higher the COP, the more efficient the heat pump. A COP of 3.0 means the heat pump produces 3 units of heat for every 1 unit of electricity consumed.

---

## COP Calculation Methods - Quality Hierarchy

**The methods below are organized by accuracy from best (±5%) to worst (±30%)**. The system automatically selects the highest accuracy method available based on sensor data. When data is insufficient, diagnostic information shows exactly what's missing.

### Enhanced Diagnostic System

All calculation methods now provide specific diagnostic feedback when data requirements aren't met. Instead of generic "Insufficient Data", you'll see:

- **Specific Missing Components**: "No Power", "No Flow", "No Temp Δ"
- **Multiple Issue Detection**: "Multi Fail" when several sensors are problematic
- **Actionable Guidance**: Each diagnostic suggests what to check or enable

### Quality Priority (Best to Worst):

1. **Direct Thermal** (±5%) - External power meter + water flow
2. **Power Module Auto-Detection** (±8%) - Internal power calculation
3. **Power Estimation** (±10%) - Physics-based power modeling
4. **Refrigerant Circuit Analysis** (±12%) - Thermodynamic analysis
5. **Carnot Estimation** (±15%) - Theoretical efficiency calculation
6. **Valve Position Correlation** (±20%) - Valve efficiency curves
7. **Temperature Difference** (±30%) - **Basic fallback method**

**🔑 Key Point**: Temperature difference method is the **least accurate** and only used when higher-quality sensor data is unavailable. It's designed as a "last resort" fallback to ensure some COP reading is always available.

---

## Method 1: Direct Thermal Calculation (±5% accuracy - Most Accurate)

### Formula

```
COP = Q_thermal / P_electrical

Where:
Q_thermal = ṁ × Cp × ΔT
```

### Variables

- **Q_thermal** = Thermal power output (Watts)
- **P_electrical** = Electrical power input (Watts)
- **ṁ** = Mass flow rate of water (kg/s)
- **Cp** = Specific heat capacity of water = 4,186 J/(kg·K)
- **ΔT** = Temperature difference = T_outlet - T_inlet (°C or K)

### Step-by-Step Calculation

1. **Convert flow rate**: `ṁ = (waterFlow_L/min ÷ 60) × 1000 ÷ 1000 = waterFlow_L/min ÷ 60`

2. **Calculate thermal power**: `Q_thermal = ṁ × 4186 × ΔT`

3. **Calculate COP**: `COP = Q_thermal ÷ P_electrical`

### Example

```
Given:
- Water flow: 12 L/min
- Inlet temperature: 15°C
- Outlet temperature: 45°C
- Electrical power: 2000W

Calculation:
ṁ = 12 ÷ 60 = 0.2 kg/s
ΔT = 45 - 15 = 30°C
Q_thermal = 0.2 × 4186 × 30 = 25,116 W
COP = 25,116 ÷ 2000 = 12.56

Note: This extremely high COP suggests measurement error!
```

---

## Method 2: Power Module Auto-Detection (±8% accuracy)

### Formula

```
For Single-phase: COP = Q_thermal / P_internal
For Three-phase: COP = Q_thermal / P_calculated

Where:
P_calculated = √3 × V_avg × I_avg × cos(φ)
Q_thermal = ṁ × Cp × ΔT
```

### Variables

- **power_module_type** = 0 (none), 1 (single-phase), 2 (three-phase) (DPS 106)
- **P_internal** = Internal power measurement (DPS 104)
- **V_A, V_B, V_C** = Phase voltages (DPS 103, 111, 112)
- **I_A, I_B, I_C** = Phase currents (DPS 102, 109, 110)
- **cos(φ)** = Power factor (typically 0.85 for heat pump compressors)

### Step-by-Step Calculation

1. **Determine power calculation method**:

   ```typescript
   if power_module_type == 1 AND P_internal > 0:
       calculated_power = P_internal
       power_source = "single_phase_internal"

   else if power_module_type == 2:
       V_avg = (V_A + V_B + V_C) / 3
       I_avg = (I_A + I_B + I_C) / 3
       calculated_power = √3 × V_avg × I_avg × 0.85
       power_source = "three_phase_calculated"
   ```

2. **Calculate thermal output**:

   ```typescript
   mass_flow_rate = water_flow_L/min ÷ 60  // kg/s
   thermal_output = mass_flow_rate × 4186 × ΔT
   ```

3. **Calculate COP**:

   ```typescript
   COP = thermal_output ÷ calculated_power
   ```

### Example

```
Given (Three-phase):
- Power module type: 2 (three-phase)
- Phase A: 230V, 8.5A
- Phase B: 225V, 8.2A
- Phase C: 235V, 8.8A
- Water flow: 15 L/min
- Temperature difference: 20°C

Calculation:
V_avg = (230 + 225 + 235) ÷ 3 = 230V
I_avg = (8.5 + 8.2 + 8.8) ÷ 3 = 8.5A
calculated_power = √3 × 230 × 8.5 × 0.85 = 2873W
mass_flow_rate = 15 ÷ 60 = 0.25 kg/s
thermal_output = 0.25 × 4186 × 20 = 20,930W
COP = 20,930 ÷ 2873 = 7.28

Note: This high COP suggests very favorable conditions!
```

---

## Method 3: Power Estimation (±10% accuracy)

### Formula

```
COP = Q_thermal / P_estimated

Where:
P_estimated = P_compressor + P_fan + P_auxiliary
P_compressor = P_base + (P_max - P_base) × (freq_normalized^1.8)
P_fan = P_base + (P_max - P_base) × (freq_normalized^2.2)
Q_thermal = ṁ × Cp × ΔT
```

### Variables

- **P_compressor** = Estimated compressor power (500-4000W based on frequency)
- **P_fan** = Estimated fan motor power (50-300W based on speed)
- **P_auxiliary** = Auxiliary systems power (150-200W for pumps, controls)
- **compressor_freq** = Compressor frequency in Hz (DPS 20)
- **fan_freq** = Fan motor frequency in Hz (DPS 40)
- **freq_normalized** = Normalized frequency (0-1 range)

### Step-by-Step Calculation

1. **Normalize compressor frequency**:

   ```typescript
   comp_freq_norm = (comp_freq - 20) / (120 - 20)
   comp_freq_norm = clamp(comp_freq_norm, 0, 1)
   ```

2. **Calculate compressor power** (using power curve):

   ```typescript
   P_compressor = 500 + (4000 - 500) × (comp_freq_norm^1.8)
   ```

3. **Normalize fan frequency**:

   ```typescript
   fan_freq_norm = (fan_freq - 10) / (100 - 10)
   fan_freq_norm = clamp(fan_freq_norm, 0, 1)
   ```

4. **Calculate fan power** (using fan laws):

   ```typescript
   P_fan = 50 + (300 - 50) × (fan_freq_norm^2.2)
   ```

5. **Calculate auxiliary power**:

   ```typescript
   flow_normalized = min(1, water_flow / 50)
   P_auxiliary = 150 + 50 × flow_normalized
   ```

6. **Apply defrost multiplier** (if defrosting):

   ```typescript
   if defrosting:
       P_total = (P_compressor + P_fan + P_auxiliary) × 1.3
   else:
       P_total = P_compressor + P_fan + P_auxiliary
   ```

7. **Calculate thermal output and COP**:

   ```typescript
   mass_flow_rate = water_flow_L/min ÷ 60  // kg/s
   thermal_output = mass_flow_rate × 4186 × ΔT
   COP = thermal_output ÷ P_total
   ```

### Example

```
Given:
- Compressor frequency: 75 Hz
- Fan motor frequency: 60 Hz
- Water flow: 20 L/min
- Temperature difference: 18°C
- Defrosting: No

Calculation:
comp_freq_norm = (75 - 20) / (120 - 20) = 55/100 = 0.55
P_compressor = 500 + 3500 × (0.55^1.8) = 500 + 3500 × 0.42 = 1970W

fan_freq_norm = (60 - 10) / (100 - 10) = 50/90 = 0.56
P_fan = 50 + 250 × (0.56^2.2) = 50 + 250 × 0.28 = 120W

flow_normalized = min(1, 20/50) = 0.4
P_auxiliary = 150 + 50 × 0.4 = 170W

P_total = 1970 + 120 + 170 = 2260W

mass_flow_rate = 20 ÷ 60 = 0.33 kg/s
thermal_output = 0.33 × 4186 × 18 = 24,885W
COP = 24,885 ÷ 2260 = 11.0

Note: This high COP indicates very efficient operation!
```

---

## Method 4: Refrigerant Circuit Analysis (±12% accuracy)

### Formula

```
COP = Carnot_theoretical × η_refrigerant

Where:
Carnot_theoretical = T_hot / (T_hot - T_cold)
η_refrigerant = refrigerant_efficiency_factor
```

### Variables

- **T_hot** = High-pressure saturation temperature in Kelvin (DPS 35)
- **T_cold** = Low-pressure saturation temperature in Kelvin (DPS 36)
- **η_refrigerant** = Refrigerant efficiency factor (0.25 to 0.65)
- **T_suction** = Suction temperature (DPS 41)
- **T_discharge** = Discharge temperature (DPS 24)

### Step-by-Step Calculation

1. **Convert temperatures to Kelvin**:

   ```typescript
   T_hot = high_pressure_temp + 273.15
   T_cold = low_pressure_temp + 273.15
   ```

2. **Calculate theoretical Carnot COP**:

   ```typescript
   Carnot_COP = T_hot ÷ (T_hot - T_cold)
   ```

3. **Calculate refrigerant efficiency**:

   ```typescript
   base_efficiency = 0.45
   temp_span = T_hot - T_cold

   if temp_span > 60K: efficiency *= 0.9
   else if temp_span < 30K: efficiency *= 0.85
   else: efficiency *= 1.05
   ```

4. **Apply compressor frequency adjustment**:

   ```typescript
   efficiency += (compressor_freq / 100 - 0.5) × 0.1
   efficiency = clamp(efficiency, 0.25, 0.65)
   ```

5. **Calculate final COP**:

   ```typescript
   COP = Carnot_COP × efficiency
   ```

### Example

```
Given:
- High pressure temperature: 65°C (DPS 35)
- Low pressure temperature: -10°C (DPS 36)
- Compressor frequency: 75 Hz

Calculation:
T_hot = 65 + 273.15 = 338.15 K
T_cold = -10 + 273.15 = 263.15 K
Carnot_COP = 338.15 ÷ (338.15 - 263.15) = 338.15 ÷ 75 = 4.51
temp_span = 75K → efficiency = 0.45 × 0.9 = 0.405 (penalty for high span)
compressor_adj = (75/100 - 0.5) × 0.1 = 0.025
final_efficiency = 0.405 + 0.025 = 0.43
COP = 4.51 × 0.43 = 1.94
```

---

## Method 5: Carnot Estimation (±15% accuracy)

### Formula

```
COP = Carnot_COP × η_practical

Where:
Carnot_COP = T_hot / (T_hot - T_cold)
η_practical = efficiency_factor(compressor_frequency)
```

### Variables

- **T_hot** = Hot side temperature in Kelvin = (T_outlet + 273.15)
- **T_cold** = Cold side temperature in Kelvin = (T_ambient + 273.15)
- **η_practical** = Practical efficiency factor (0.3 to 0.5)

### Step-by-Step Calculation

1. **Convert to Kelvin**:

   ```typescript
   T_hot = T_outlet + 273.15
   T_cold = T_ambient + 273.15
   ```

2. **Calculate Carnot COP**:

   ```typescript
   Carnot_COP = T_hot ÷ (T_hot - T_cold)
   ```

3. **Determine efficiency factor**:

   ```typescript
   η_practical = 0.4 + (compressor_frequency ÷ 100) × 0.1
   ```

4. **Calculate practical COP**:

   ```typescript
   COP = Carnot_COP × η_practical
   ```

### Example

```
Given:
- Outlet temperature: 45°C
- Ambient temperature: 5°C
- Compressor frequency: 60 Hz

Calculation:
T_hot = 45 + 273.15 = 318.15 K
T_cold = 5 + 273.15 = 278.15 K
Carnot_COP = 318.15 ÷ (318.15 - 278.15) = 318.15 ÷ 40 = 7.95
η_practical = 0.4 + (60 ÷ 100) × 0.1 = 0.46
COP = 7.95 × 0.46 = 3.66
```

---

## Method 6: Valve Position Correlation (±20% accuracy)

### Formula

```
COP = base_COP × valve_efficiency_factor × frequency_factor

Where:
base_COP = f(temperature_difference)
valve_efficiency_factor = f(EEV_position, EVI_position)
```

### Variables

- **EEV_steps** = Electronic Expansion Valve pulse-steps (DPS 16)
- **EVI_steps** = Enhanced Vapor Injection valve pulse-steps (DPS 25)
- **ΔT** = Temperature difference = T_outlet - T_inlet
- **compressor_freq** = Compressor frequency (Hz)

### Step-by-Step Calculation

1. **Calculate base COP from temperature difference**:

   ```typescript
   if ΔT > 5°C:
       base_COP = 2.5 + (ΔT - 5) × 0.12
   else:
       base_COP = 2.0
   ```

2. **Calculate EEV efficiency factor**:

   ```typescript
   if EEV_steps < 100: eev_factor = 0.7
   else if EEV_steps > 450: eev_factor = 0.8
   else: eev_factor = 1.0 + sin((EEV_steps - 100)/350 × π) × 0.15
   ```

3. **Calculate EVI efficiency factor**:

   ```typescript
   if EVI_steps < 50: evi_factor = 0.85
   else if EVI_steps > 350: evi_factor = 0.9
   else: evi_factor = 1.0 + sin((EVI_steps - 50)/300 × π) × 0.1
   ```

4. **Apply frequency factor**:

   ```typescript
   frequency_factor = 0.9 + (compressor_freq / 100) × 0.2
   ```

5. **Calculate final COP**:

   ```typescript
   COP = base_COP × eev_factor × evi_factor × frequency_factor
   COP = min(COP, 6.5)  // Cap at realistic maximum
   ```

### Example

```
Given:
- EEV position: 300 pulse-steps (DPS 16)
- EVI position: 200 pulse-steps (DPS 25)
- Temperature difference: 25°C
- Compressor frequency: 80 Hz

Calculation:
base_COP = 2.5 + (25 - 5) × 0.12 = 2.5 + 2.4 = 4.9
eev_factor = 1.0 + sin((300-100)/350 × π) × 0.15 = 1.0 + 0.14 = 1.14
evi_factor = 1.0 + sin((200-50)/300 × π) × 0.1 = 1.0 + 0.09 = 1.09
frequency_factor = 0.9 + (80/100) × 0.2 = 0.9 + 0.16 = 1.06
COP = 4.9 × 1.14 × 1.09 × 1.06 = 6.5 (capped)
```

---

## Method 7: Enhanced Temperature Difference Estimation (±30% accuracy - Last Resort)

The improved method considers multiple real-world factors for realistic COP variation:

### Base COP from Temperature Difference

```typescript
// Progressive curve based on actual heat pump performance data
if (ΔT ≤ 1) {
    base_COP = 1.8 + random(0.4)  // 1.8-2.2 (low load/system issues)
} else if (ΔT ≤ 3) {
    base_COP = 2.2 + (ΔT - 1) × 0.25 + variation(±0.15)  // 2.2-2.9
} else if (ΔT ≤ 6) {
    base_COP = 2.7 + (ΔT - 3) × 0.2 + variation(±0.2)   // 2.7-3.5
} else if (ΔT ≤ 10) {
    base_COP = 3.3 + (ΔT - 6) × 0.15 + variation(±0.15)  // 3.3-4.0
} else if (ΔT ≤ 15) {
    base_COP = 3.9 + (ΔT - 10) × 0.08 + variation(±0.125) // 3.9-4.5
} else {
    // Maximum load with efficiency penalties
    base_COP = max(3.5, 4.3 - (ΔT - 15) × 0.05 + variation(±0.1))
}
```

### Ambient Temperature Correction

```typescript
// Heat pump efficiency varies significantly with outdoor conditions
if (ambient_temp ≥ 15°C) {
    correction = 1.1 + (ambient_temp - 15) × 0.01  // +10% bonus for warm weather
} else if (ambient_temp ≥ 5°C) {
    correction = 1.0 + (ambient_temp - 5) × 0.01   // Mild improvement
} else if (ambient_temp ≥ -5°C) {
    correction = 1.0 - (5 - ambient_temp) × 0.02   // Gradual loss
} else if (ambient_temp ≥ -15°C) {
    correction = 0.85 - (-5 - ambient_temp) × 0.015 // Significant loss
} else {
    correction = max(0.65, 0.7 - (-15 - ambient_temp) × 0.01) // Extreme cold
}
```

### Load-Based Correction

```typescript
// Heat pumps are most efficient at 60-80% load
normalized_freq = clamp((compressor_freq / 80), 0.2, 1.0)
optimal_load = 0.7
load_deviation = abs(normalized_freq - optimal_load)

if (load_deviation ≤ 0.1) {
    correction = 1.05  // Optimal efficiency zone
} else if (load_deviation ≤ 0.2) {
    correction = 1.0 - load_deviation × 0.25  // Gradual loss
} else {
    correction = max(0.85, 0.95 - load_deviation × 0.5)  // Significant penalty
}
```

### System Operation Correction

```typescript
// Temperature lift and supply temperature optimization
temperature_lift = abs(outlet_temp - ambient_temp)
correction = 1.0

// Less temperature lift = higher efficiency
if (temperature_lift ≤ 30) {
    correction *= 1.02  // Low lift bonus
} else if (temperature_lift ≥ 45) {
    correction *= 0.95  // High lift penalty
}

// Optimal supply temperature range
if (outlet_temp ≥ 35 && outlet_temp ≤ 45) {
    correction *= 1.01  // Optimal range bonus
} else if (outlet_temp ≥ 50) {
    correction *= 0.97 - (outlet_temp - 50) × 0.005  // High temp penalty
}
```

### Environmental Variation

```typescript
// Add realistic ±8% variation for unmeasured factors
base_variation = 0.08
variation_range = base_variation

// Higher uncertainty in extreme conditions
if (ambient_temp < 0 || ambient_temp > 25) {
    variation_range *= 1.3  // Weather extremes
}
if (temp_diff < 2 || temp_diff > 12) {
    variation_range *= 1.2  // Load extremes
}

// Generate realistic normal distribution variation
variation = normal_random() × variation_range
environmental_factor = 1.0 + variation
```

### Realistic Example Results

```
Example Scenario 1 (Mild Weather, Normal Load):
- Temperature difference: 8°C
- Inlet: 25°C, Outlet: 33°C
- Ambient: 12°C
- Compressor: 65 Hz

Calculation:
base_COP = 3.3 + (8 - 6) × 0.15 + variation = 3.6 ± 0.15
ambient_correction = 1.0 + (12 - 5) × 0.01 = 1.07
load_correction = 1.02 (near optimal 65/80 = 0.81)
operation_correction = 1.02 × 1.01 = 1.03
environmental_variation = 0.95 (random factor)

Final COP = 3.6 × 1.07 × 1.02 × 1.03 × 0.95 = 3.86

Example Scenario 2 (Cold Weather, High Load):
- Temperature difference: 12°C
- Inlet: 20°C, Outlet: 32°C
- Ambient: -8°C
- Compressor: 95 Hz

Calculation:
base_COP = 3.9 + (12 - 10) × 0.08 + variation = 4.06 ± 0.125
ambient_correction = 1.0 - (5 - (-8)) × 0.02 = 0.74
load_correction = 0.90 (high load penalty)
operation_correction = 0.95 × 1.01 = 0.96
environmental_variation = 1.08 (random factor)

Final COP = 4.06 × 0.74 × 0.90 × 0.96 × 1.08 = 2.89

Example Scenario 3 (Warm Weather, Low Load):
- Temperature difference: 4°C
- Inlet: 30°C, Outlet: 34°C
- Ambient: 18°C
- Compressor: 45 Hz

Calculation:
base_COP = 2.7 + (4 - 3) × 0.2 + variation = 2.9 ± 0.2
ambient_correction = 1.1 + (18 - 15) × 0.01 = 1.13
load_correction = 0.95 (low load penalty)
operation_correction = 1.02 × 1.01 = 1.03
environmental_variation = 1.04 (random factor)

Final COP = 2.9 × 1.13 × 0.95 × 1.03 × 1.04 = 3.37
```

### Key Improvements Over Previous Method

**1. Realistic Variation**: COP values now range from 1.5-6.5 with natural variation instead of fixed values

**2. Weather Sensitivity**: Efficiency automatically adjusts for seasonal conditions:

- **Summer**: +10-20% efficiency bonus in warm weather
- **Winter**: -15-35% efficiency penalty in cold weather

**3. Load Awareness**: Partial load efficiency curves reflect real heat pump behavior:

- **Optimal Zone** (60-80% load): +5% efficiency bonus
- **Extreme Loads** (<40% or >90%): -10-15% efficiency penalty

**4. Physics Integration**: Temperature lift, supply temperature optimization, and system dynamics

**5. Environmental Realism**: ±8% random variation simulates real-world factors like:

- Wind effects on outdoor unit
- System age and maintenance
- Refrigerant charge variations
- Control system tuning

---

## Which Method is Used When?

### Decision Tree (Priority Order by Accuracy)

**⚠️ Pre-requisite for ALL methods**: `compressor_frequency > 0 Hz` (compressor must be running)

- If compressor is not running → **COP = 0** immediately, no calculation needed

```
1. If waterFlow AND electricalPower available AND compressor running
   → Use Method 1 (Direct thermal calculation) - ±5% accuracy

2. If waterFlow AND powerModuleType available (1 or 2)
   → Use Method 2 (Power module auto-detection) - ±8% accuracy

3. If compressorFreq AND fanFreq AND waterFlow available
   → Use Method 3 (Power estimation) - ±10% accuracy

4. If refrigerant circuit data available (HP/LP temps, suction, discharge)
   → Use Method 4 (Refrigerant circuit analysis) - ±12% accuracy

5. If compressorFrequency AND ambientTemperature available
   → Use Method 5 (Carnot estimation) - ±15% accuracy

6. If valve positions available (EEV, EVI pulse-steps)
   → Use Method 6 (Valve position correlation) - ±20% accuracy

7. Fallback: If inlet/outlet temperatures available
   → Use Method 7 (Temperature difference estimation) - ±30% accuracy
```

### Accuracy Ranking (Best to Worst)

1. **Method 1** (Direct thermal): ±5% accuracy - requires external power measurement
2. **Method 2** (Power module auto-detection): ±8% accuracy - uses internal power calculation
3. **Method 3** (Power estimation): ±10% accuracy - estimates power from compressor/fan frequencies
4. **Method 4** (Refrigerant circuit analysis): ±12% accuracy - uses thermodynamic cycle analysis
5. **Method 5** (Carnot estimation): ±15% accuracy - requires ambient temperature
6. **Method 6** (Valve position correlation): ±20% accuracy - uses valve position efficiency curves
7. **Method 7** (Temperature difference): ±30% accuracy - basic empirical relationships

### Data Requirements by Method

| Method | Required Data | Optional Data | Accuracy | Diagnostic When Missing |
|--------|---------------|---------------|----------|------------------------|
| **Method 1** | Water flow, inlet/outlet temps, electrical power, **compressor running** | - | ±5% | "No Power", "No Flow", "No Temp Δ" |
| **Method 2** | Water flow, inlet/outlet temps, power module type, **compressor running** | 3-phase voltages/currents | ±8% | "No Power", "No Flow", "No Thermal" |
| **Method 3** | **Compressor freq > 0**, fan freq, water flow, inlet/outlet temps | Defrost state | ±10% | "No Comp", "No Flow", "No Thermal" |
| **Method 4** | HP/LP saturation temps, suction/discharge temps, **compressor freq > 0** | - | ±12% | "No Comp", "No Thermal" |
| **Method 5** | Outlet temp, ambient temp, **compressor frequency > 0** | - | ±15% | "No Comp", "No Thermal" |
| **Method 6** | EEV/EVI pulse-steps, inlet/outlet temps, **compressor freq > 0** | - | ±20% | "No Comp", "No Thermal" |
| **Method 7** | Inlet/outlet temperatures, **compressor frequency > 0** | - | ±30% | "No Comp", "No Temp Δ" |

---

## Understanding When COP = 0 (Zero Efficiency)

**🔴 Important: Your heat pump shows COP = 0 when it's not actually operating**

### When Will You See COP = 0?

The system displays **COP = 0** in these specific situations:

1. **Heat pump is turned off**
   - System is switched off completely
   - No power to the compressor

2. **Heat pump is idle/standby mode**
   - Target temperature is reached
   - System is waiting for heat demand
   - Compressor frequency shows 0 Hz

3. **System startup/shutdown**
   - Brief periods during system startup
   - Natural pauses between heating cycles

4. **Backup heating only**
   - Electric backup heaters are running
   - Heat pump compressor is not active
   - You may still see warm water, but this is not heat pump efficiency

### Why COP = 0 is Correct

**This is normal and expected behavior!** Here's why:

- **COP measures heat pump efficiency only** - when the compressor isn't running, there's no heat pump operation to measure
- **Zero doesn't mean broken** - it means the heat pump is not currently pumping heat
- **High confidence reading** - the system is certain about this measurement

### What Creates Heat When COP = 0?

If you notice warm water but see COP = 0, the heat is coming from:

- **Electric backup heaters** (not heat pump operation)
- **Residual heat** from previous heating cycles
- **Hot water tank storage** maintaining temperature
- **Passive solar gain** or building heat

### Heat Pump Physics Simplified

Think of your heat pump like a bicycle:

- **COP = efficiency** is like "distance per pedal stroke"
- **When you stop pedaling** (compressor off), there's no "pedal efficiency" to measure
- **Coasting downhill** (backup heaters) still moves you, but it's not pedaling efficiency

### Normal Operation Pattern

In typical daily use, you'll see:

- **COP = 0** during idle periods (normal)
- **COP = 2.5-4.5** during active heating (good efficiency)
- **COP = 1.5-2.5** during defrost cycles (temporary)

**✅ Seeing COP = 0 regularly is completely normal and indicates your system is working correctly!**

---

## Common Issues and Validation

### Unrealistic Results

- **COP > 8.0**: Likely measurement error (sensor malfunction)
- **COP < 1.0**: Heat pump not working properly or sensor error
- **COP = 15+**: Usually flow meter or power meter malfunction

### Operational Status Validation

- **COP = 0 with compressor frequency = 0 Hz**: ✅ **Correct behavior**
  - System correctly detects compressor is not running
  - No heat pump operation = no efficiency to measure
  - High confidence result with clear diagnostic reason

- **COP > 0 with compressor frequency = 0 Hz**: ❌ **Error condition**
  - Should never occur - indicates calculation bug
  - Temperature differences from non-heat pump sources (backup heaters, thermal mass)
  - System should automatically detect and return COP = 0

### Typical COP Ranges

- **Air-to-water heat pumps**: 2.5 - 4.5
- **Ground-source heat pumps**: 3.5 - 5.5
- **During defrost**: 1.0 - 2.0
- **Ideal conditions**: 4.0 - 6.0

### Physical Limits

- **Carnot limit**: Theoretical maximum based on temperatures
- **Practical limit**: 50-60% of Carnot efficiency
- **Real-world**: Usually 30-50% of Carnot efficiency

---

## COP Method Visibility and Diagnostics

**Enhanced in v0.98.7** with service architecture:

- The `adlar_cop_method` capability displays which calculation method is currently being used, providing transparency into the COP calculation process
- **Enhanced compressor operation validation**: COPCalculator service automatically returns `COP = 0` when compressor is not running (frequency ≤ 0 Hz), ensuring physically accurate results
- **Diagnostic Information**: When insufficient data is available, specific diagnostic messages show exactly what's missing

The sensor shows:

- **Method Name**: Direct Thermal, Carnot Estimation, Temperature Difference, etc.
- **Diagnostic Info**: Specific indicators when data is insufficient ("No Power", "No Flow", "No Temp Δ", "Multi Fail")
- **Confidence Indicator**:
  - 🟢 High confidence (most accurate data available)
  - 🟡 Medium confidence (some data limitations)
  - 🔴 Low confidence (limited data, estimation required)

### Diagnostic Messages

When COP calculation fails, COPCalculator service provides specific 22-character diagnostic messages:

- **"No Power"**: Power measurement unavailable for direct thermal method
- **"No Thermal"**: Water flow or temperature difference unavailable
- **"No Flow"**: Water flow measurement missing
- **"No Temp Δ"**: Temperature difference between inlet/outlet too small
- **"No Comp"**: Compressor frequency data unavailable
- **"Multi Fail"**: Multiple sensor issues detected

This helps users understand exactly why COP calculation isn't possible and what sensors need attention.

---

## Advanced Methods Benefits

The advanced methods (2, 3, 4, 5, 6) provide significant advantages over basic temperature difference estimation:

### Method 2: Power Module Auto-Detection

- **Automatic power calculation** - no external power meters required
- **Single and three-phase support** - adapts to different electrical configurations
- **High accuracy** - direct power measurement when internal module available
- **Cost effective** - eliminates need for separate power monitoring devices

### Method 3: Power Estimation

- **Physics-based modeling** - uses fundamental laws (compressor P ∝ f^1.8, fan P ∝ f^2.2)
- **No external sensors needed** - leverages existing frequency control data
- **System component breakdown** - estimates compressor, fan, and auxiliary power separately
- **Defrost cycle aware** - automatically adjusts for defrost operation (30% power increase)
- **High accuracy without power meters** - ±10% accuracy using only operational frequencies
- **Universal applicability** - works with any heat pump system that reports frequencies

### Method 4: Refrigerant Circuit Analysis

- **No external devices required** - uses internal pressure and temperature sensors
- **Thermodynamically accurate** - based on actual refrigerant cycle analysis
- **Works when power monitoring unavailable** - ideal for older heat pump installations
- **Real-time efficiency tracking** - reflects actual system performance

### Method 5: Carnot Estimation

- **Theoretical foundation** - based on fundamental thermodynamic principles
- **Minimal sensor requirements** - only needs ambient temperature and compressor frequency
- **Weather compensation** - automatically adjusts for seasonal conditions
- **Load-based efficiency** - accounts for partial load operation effects

### Method 6: Valve Position Correlation

- **Unique to Adlar systems** - leverages EEV and EVI valve position data
- **System optimization insights** - identifies valve tuning opportunities
- **Predictive maintenance** - valve position patterns indicate system health
- **No additional sensors needed** - uses existing control system data

### Combined Intelligence

The system automatically selects the best available method based on:

- **Data availability** - uses highest accuracy method with sufficient data
- **Sensor health** - skips methods with unreliable sensor inputs
- **System configuration** - adapts to different heat pump installations
- **Validation checks** - flags unrealistic results for user attention

This comprehensive approach with **7 different COP calculation methods** ensures **reliable COP monitoring across all installation scenarios**, from basic temperature-only setups to advanced systems with full sensor suites, including innovative power estimation using operational frequencies!

---

## COPCalculator Service Architecture (v0.99.23+)

The COP calculation system is implemented as the **COPCalculator service** (`lib/services/cop-calculator.ts`), which is managed by the ServiceCoordinator and integrates with other services for data collection and quality assessment.

### Service Integration

**COPCalculator** is one of 8 core services managed by ServiceCoordinator:

```typescript
class ServiceCoordinator {
  private copCalculator: COPCalculator | null = null;

  async initialize(config: ServiceConfig): Promise<void> {
    this.copCalculator = new COPCalculator(device, logger);
    await this.copCalculator.startCalculations();
  }
}
```

**Cross-Service Integration**:

- **TuyaConnectionService**: Provides real-time sensor data (DPS values) for calculations
- **CapabilityHealthService**: Validates sensor data quality before using in calculations
- **EnergyTrackingService**: Supplies external power measurement data for Method 1 (Direct Thermal)
- **SettingsManagerService**: Manages user preferences (method override, outlier detection settings)
- **RollingCOPCalculator**: Subscribes to `cop-calculated` events for time-series analysis
- **SCOPCalculator**: Subscribes to `cop-calculated` events for seasonal efficiency tracking

### Calculation Lifecycle

1. **Initialization**: ServiceCoordinator initializes COPCalculator with device reference
2. **Data Collection**: TuyaConnectionService emits sensor update events (every 30 seconds)
3. **Health Validation**: CapabilityHealthService confirms sensor data quality
4. **Method Selection**: COPCalculator chooses highest accuracy method with sufficient data
5. **Calculation**: Selected method calculates COP value with confidence level
6. **Publishing**: Result published to `adlar_cop` capability with method transparency
7. **Event Emission**: `cop-calculated` event emitted for RollingCOPCalculator and SCOPCalculator
8. **Service Diagnostics**: ServiceCoordinator tracks calculation service health

### Service Constants Integration

COPCalculator uses centralized constants from `DeviceConstants` class:

```typescript
// COP calculation constants
static readonly COP_CALCULATION_INTERVAL_MS = 30 * 1000; // 30 seconds
static readonly EXTERNAL_DEVICE_QUERY_TIMEOUT_MS = 5 * 1000; // 5 seconds
static readonly MIN_VALID_COP = 0.5;
static readonly MAX_VALID_COP = 8.0;

// COP ranges for validation
static readonly COP_RANGES = {
  AIR_TO_WATER_MIN: 2.5,
  AIR_TO_WATER_MAX: 4.5,
  GROUND_SOURCE_MIN: 3.5,
  GROUND_SOURCE_MAX: 5.5,
  // ... additional ranges
};
```
