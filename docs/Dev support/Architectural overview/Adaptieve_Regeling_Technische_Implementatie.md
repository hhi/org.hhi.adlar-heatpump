# Adlar Warmtepomp - Adaptieve Regeling: Technische Implementatie

**Versie:** 2.2.0
**Datum:** December 2025
**Voor:** Developers & System Architects

---

## Inhoudsopgave

1. [Component 1: PI Controller - Code Implementatie](#component-1-pi-controller)
2. [Component 2: Building Model Learner - RLS Algoritme](#component-2-building-model-learner)
3. [Component 3: Energy Price Optimizer - API Integratie](#component-3-energy-price-optimizer)
4. [Component 4: COP Controller - Multi-Horizon Logic](#component-4-cop-controller)
5. [Systeem Integratie - Code Flow](#systeem-integratie---complete-control-flow)
6. [Performance Specificaties](#performance-specificaties)

---

## Component 1: PI Controller

### Code Structuur

```typescript
class HeatingController {
  private kp = 3.0;              // Proportional gain
  private ki = 1.5;              // Integral gain
  private deadband = 0.3;        // °C
  private integrationWindow = 2; // hours

  // State
  private lastAdjustment = Date.now();
  private errorHistory: Array<{time: number, error: number}> = [];

  async calculateAdjustment(
    currentTemp: number,
    targetTemp: number
  ): Promise<number> {
    // 1. Calculate current error
    const error = targetTemp - currentTemp;

    // 2. Check deadband (hysteresis)
    if (Math.abs(error) <= this.deadband) {
      return 0; // No adjustment needed
    }

    // 3. Calculate P-term (proportional)
    const pTerm = this.kp * error;

    // 4. Calculate I-term (integral)
    this.errorHistory.push({
      time: Date.now(),
      error: error
    });

    // Remove errors outside integration window
    const cutoff = Date.now() - this.integrationWindow * 3600000;
    this.errorHistory = this.errorHistory.filter(e => e.time > cutoff);

    // Average error over window
    const avgError = this.errorHistory.reduce((sum, e) => sum + e.error, 0)
                     / this.errorHistory.length;
    const iTerm = this.ki * avgError;

    // 5. Total adjustment (limited to ±3°C)
    const adjustment = Math.max(-3, Math.min(3, pTerm + iTerm));

    // 6. Min wait time check (20 minutes)
    const timeSinceLastAdjustment = Date.now() - this.lastAdjustment;
    if (timeSinceLastAdjustment < 20 * 60 * 1000) {
      return 0; // Too soon, skip
    }

    // 7. Record and return
    this.lastAdjustment = Date.now();
    return adjustment;
  }
}
```

### Tuning Guidelines

**Verhoog Kp (snellere reactie):**
- Symptomen: Temperatuur loopt langzaam terug naar doel
- Gevaar: Te hoog → oscillatie/overshoot
- Typisch bereik: 2.0 - 4.0

**Verhoog Ki (betere steady-state):**
- Symptomen: Blijvende offset (bijv. altijd 0.5°C te laag)
- Gevaar: Te hoog → instabiliteit
- Typisch bereik: 1.0 - 2.5

**Verlaag Deadband (tighter control):**
- Effect: Meer schakelen, nauwkeuriger
- Gevaar: Lagere COP door frequenter schakelen
- Typisch bereik: 0.2°C - 0.5°C

---

## Component 2: Building Model Learner

### Recursive Least Squares (RLS) Algoritme Implementatie

#### Wiskundige Basis

**Fysisch Model:**
```
dT/dt = (1/C) × [P_heating - UA×(T_in - T_out) + g×Solar + P_int]
```

**Lineaire Vorm voor RLS:**
```
y = X^T × θ

waar:
y = dT/dt                                    (output)
X = [P_heating, (T_in - T_out), Solar, 1]   (input vector)
θ = [1/C, UA/C, g/C, P_int/C]               (parameters)
```

#### RLS Update Vergelijkingen

**1. Prediction Error:**
```
e(k) = y(k) - X(k)^T × θ(k-1)
```

**2. Kalman Gain:**
```
K(k) = P(k-1) × X(k) / (λ + X(k)^T × P(k-1) × X(k))

waar λ = forgetting factor (0.998)
```

**3. Parameter Update:**
```
θ(k) = θ(k-1) + K(k) × e(k)
```

**4. Covariance Update:**
```
P(k) = (P(k-1) - K(k) × X(k)^T × P(k-1)) / λ
```

### Code Implementatie (v2.2.0)

```typescript
export const BUILDING_PROFILES: Record<BuildingProfileType, BuildingProfile> = {
  light: {
    C: 7,        // Low thermal mass - quick temperature response
    UA: 0.35,    // Moderate heat loss
    g: 0.4,      // Moderate solar gain
    pInt: 0.3,   // Standard internal gains
  },
  average: {
    C: 15,       // Medium thermal mass
    UA: 0.3,     // Average insulation
    g: 0.5,      // Good solar gain
    pInt: 0.3,   // Standard internal gains
  },
  heavy: {
    C: 20,       // High thermal mass - slow temperature response
    UA: 0.25,    // Better insulation
    g: 0.4,      // Lower solar gain (more mass to heat)
    pInt: 0.35,  // Slightly higher internal gains
  },
  passive: {
    C: 30,       // Very high thermal mass
    UA: 0.05,    // Excellent insulation
    g: 0.6,      // High solar gain utilization
    pInt: 0.25,  // Lower internal gains (less needed)
  },
};

export function getDynamicPInt(hour: number, basePInt: number): number {
  if (hour >= 23 || hour < 6) {
    return basePInt * 0.4;  // Night: 40% of base
  }
  if (hour >= 6 && hour < 18) {
    return basePInt * 1.0;  // Day: 100% of base
  }
  return basePInt * 1.8;    // Evening: 180% of base
}

export function getSeasonalGMultiplier(month: number): number {
  const seasonalFactors: Record<number, number> = {
    0: 0.6,   // Jan: Low sun angle
    1: 0.7,   // Feb
    2: 0.9,   // Mar
    3: 1.0,   // Apr
    4: 1.1,   // May
    5: 1.3,   // Jun: High sun angle
    6: 1.3,   // Jul
    7: 1.2,   // Aug
    8: 1.0,   // Sep
    9: 0.9,   // Oct
    10: 0.7,  // Nov
    11: 0.6,  // Dec
  };
  return seasonalFactors[month] || 1.0;
}

class BuildingModelLearner {
  private theta: number[];                // [1/C, UA/C, g/C, P_int/C]
  private P: number[][];                  // Covariance matrix (4x4)
  private lambda: number;                 // Forgetting factor = 0.998
  private enableDynamicPInt: boolean;
  private enableSeasonalG: boolean;
  private basePInt: number;

  constructor(config: BuildingModelConfig) {
    // Get building profile (default to 'average' if not specified)
    const profile = config.buildingProfile
      ? BUILDING_PROFILES[config.buildingProfile]
      : BUILDING_PROFILES.average;

    // Initialize theta using building profile parameters
    this.theta = [
      1 / profile.C,              // 1/C
      profile.UA / profile.C,     // UA/C
      profile.g / profile.C,      // g/C
      profile.pInt / profile.C,   // P_int/C
    ];

    this.basePInt = profile.pInt;
    this.enableDynamicPInt = config.enableDynamicPInt ?? false;
    this.enableSeasonalG = config.enableSeasonalG ?? false;
    this.lambda = config.forgettingFactor;

    // Initialize covariance matrix with high uncertainty
    const initCov = config.initialCovariance;  // typically 100
    this.P = [
      [initCov, 0, 0, 0],
      [0, initCov, 0, 0],
      [0, 0, initCov, 0],
      [0, 0, 0, initCov],
    ];
  }

  public addMeasurement(data: MeasurementData): void {
    // Calculate temperature change rate
    const dt = (data.timestamp - this.lastMeasurement!.timestamp) / 3600000; // hours
    const dT = data.tIndoor - this.lastMeasurement!.tIndoor;
    const dtDt = dT / dt;  // °C/hour

    // Apply dynamic adjustments (v2.2.0)
    const hour = new Date(data.timestamp).getHours();
    const pIntMultiplier = this.enableDynamicPInt
      ? getDynamicPInt(hour, this.basePInt) / this.basePInt
      : 1.0;

    const month = new Date(data.timestamp).getMonth();
    const solarMultiplier = this.enableSeasonalG
      ? getSeasonalGMultiplier(month)
      : 1.0;

    // Build input vector with adjustments
    const X = [
      data.pHeating,                                  // Heating power (kW)
      data.tIndoor - data.tOutdoor,                   // Temperature difference (°C)
      (data.solarRadiation || 0) * solarMultiplier,   // Solar with seasonal adjustment
      pIntMultiplier,                                 // Constant term scaled for time-varying P_int
    ];

    // Perform RLS update
    this.updateRLS(X, dtDt);
  }

  private updateRLS(X: number[], y: number): void {
    // Step 1: Compute Kalman gain K = P × X / (λ + X^T × P × X)
    const PX = this.matrixVectorMultiply(this.P, X);
    const denominator = this.lambda + this.dotProduct(X, PX);
    const K = PX.map((val) => val / denominator);

    // Step 2: Update parameters θ = θ + K × (y - X^T × θ)
    const prediction = this.dotProduct(X, this.theta);
    const error = y - prediction;
    this.theta = this.theta.map((val, i) => val + K[i] * error);

    // Step 3: Update covariance P = (1/λ) × (P - K × X^T × P)
    const KX = this.outerProduct(K, X);
    const KXP = this.matrixMultiply(KX, this.P);
    this.P = this.P.map((row, i) =>
      row.map((val, j) => (val - KXP[i][j]) / this.lambda)
    );
  }

  public getModel(): BuildingModel {
    // Convert theta parameters back to physical parameters
    const C = 1 / this.theta[0];
    const UA = this.theta[1] * C;
    const g = this.theta[2] * C;
    const pInt = this.theta[3] * C;
    const tau = C / UA;

    // Calculate confidence level
    const confidence = this.calculateConfidence();

    return { C, UA, g, pInt, tau, confidence };
  }

  private calculateConfidence(): number {
    // Component 1: Sample count coverage
    const sampleCoverage = Math.min(
      this.sampleCount / this.minSamplesForConfidence,
      1.0
    );

    // Component 2: Parameter certainty (lower covariance = higher certainty)
    const trace = this.P.reduce((sum, row, i) => sum + row[i], 0);
    const covarianceConfidence = Math.max(0, 1 - trace / 400);

    // Combined confidence
    return sampleCoverage * covarianceConfidence * 100;
  }
}
```

### Matrix Helper Functions

```typescript
private matrixVectorMultiply(M: number[][], v: number[]): number[] {
  return M.map((row) => this.dotProduct(row, v));
}

private dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

private outerProduct(a: number[], b: number[]): number[][] {
  return a.map((ai) => b.map((bi) => ai * bi));
}

private matrixMultiply(A: number[][], B: number[][]): number[][] {
  return A.map((row) =>
    B[0].map((_, j) =>
      row.reduce((sum, val, k) => sum + val * B[k][j], 0)
    )
  );
}
```

---

## Component 3: Energy Price Optimizer

### EnergyZero API Integratie

**Endpoint:**
```
GET https://api.energyzero.nl/v1/energyprices
?fromDate=2024-12-26T00:00:00.000Z
&tillDate=2024-12-26T23:59:59.999Z
&interval=4
&usageType=1
&inclBtw=true
```

**Response Format:**
```json
{
  "Prices": [
    {
      "readingDate": "2024-12-26T00:00:00+00:00",
      "price": 0.15234
    },
    {
      "readingDate": "2024-12-26T01:00:00+00:00",
      "price": 0.14892
    }
    // ... 24 uur data
  ]
}
```

### Code Implementatie

```typescript
class EnergyPriceOptimizer {
  private apiUrl: string;
  private priceCache: Map<string, number> = new Map();
  private thresholds = {
    veryLow: 0.10,
    low: 0.15,
    normal: 0.25,
    high: 0.35,
  };

  async fetchDayAheadPrices(): Promise<void> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const url = `${this.apiUrl}?fromDate=${tomorrow.toISOString()}`
              + `&tillDate=${this.getEndOfDay(tomorrow)}`
              + `&interval=4&usageType=1&inclBtw=true`;

    const response = await fetch(url);
    const data = await response.json();

    // Cache prices by hour
    data.Prices.forEach((entry: any) => {
      const hour = new Date(entry.readingDate).getHours();
      const key = `${tomorrow.toISOString().split('T')[0]}_${hour}`;
      this.priceCache.set(key, entry.price);
    });
  }

  getCurrentPrice(): number {
    const now = new Date();
    const key = `${now.toISOString().split('T')[0]}_${now.getHours()}`;
    return this.priceCache.get(key) || 0.25; // fallback to normal
  }

  getPriceCategory(price: number): string {
    if (price <= this.thresholds.veryLow) return 'very_low';
    if (price <= this.thresholds.low) return 'low';
    if (price <= this.thresholds.normal) return 'normal';
    if (price <= this.thresholds.high) return 'high';
    return 'very_high';
  }

  calculatePreHeatRecommendation(
    buildingModel: BuildingModel,
    currentTemp: number,
    targetTemp: number,
    nextHourPrice: number
  ): { shouldPreHeat: boolean; targetAdjustment: number } {
    const category = this.getPriceCategory(nextHourPrice);

    if (category === 'very_low' || category === 'low') {
      // Calculate how much we can pre-heat
      const maxSafeOverheat = 1.5; // °C above target
      const thermalMass = buildingModel.C;

      // More thermal mass = more pre-heat capacity
      const preheatAmount = Math.min(
        maxSafeOverheat,
        thermalMass / 20  // scale by thermal mass
      );

      return {
        shouldPreHeat: true,
        targetAdjustment: +preheatAmount
      };
    }

    if (category === 'high' || category === 'very_high') {
      // Reduce setpoint during expensive hours
      const comfortMargin = 0.5; // Don't go more than 0.5°C below target
      return {
        shouldPreHeat: false,
        targetAdjustment: -comfortMargin
      };
    }

    return { shouldPreHeat: false, targetAdjustment: 0 };
  }
}
```

---

## Component 4: COP Controller

### Multi-Horizon Decision Logic

```typescript
interface COPMetrics {
  current: number;    // Real-time COP
  daily: number;      // 24h rolling average
  weekly: number;     // 7d rolling average
  monthly: number;    // 30d rolling average
  seasonal: number;   // SCOP (EN 14825)
}

class COPController {
  private minAcceptableCOP = 2.5;
  private targetCOP = 3.5;

  analyzeAndRecommend(
    cops: COPMetrics,
    buildingModel: BuildingModel,
    currentTemp: number,
    targetTemp: number,
    priceSignal: string
  ): ControlAction {

    // IMMEDIATE: Critical low COP
    if (cops.current < 2.0) {
      return {
        action: 'immediate_reduce',
        adjustment: -2.0,
        reason: `Critical COP: ${cops.current.toFixed(1)} < 2.0`,
        urgency: 'critical',
        horizon: 'immediate'
      };
    }

    // DAILY: Trending below acceptable
    if (cops.daily < this.minAcceptableCOP && cops.current < 2.8) {
      return {
        action: 'daily_optimize',
        adjustment: -1.0,
        reason: `Daily COP: ${cops.daily.toFixed(1)} < ${this.minAcceptableCOP}`,
        urgency: 'high',
        horizon: 'daily'
      };
    }

    // WEEKLY: Trend analysis
    const weeklyTrend = cops.weekly - cops.daily;
    if (weeklyTrend < -0.3) {  // Declining trend
      return {
        action: 'weekly_correct',
        adjustment: -0.5,
        reason: `Declining trend: ${weeklyTrend.toFixed(2)}/day`,
        urgency: 'medium',
        horizon: 'weekly'
      };
    }

    // SEASONAL: Long-term underperformance
    if (cops.seasonal < 3.2) {
      return {
        action: 'seasonal_optimize',
        adjustment: this.calculateSeasonalAdjustment(cops.seasonal),
        reason: `Low SCOP: ${cops.seasonal.toFixed(1)}, needs review`,
        urgency: 'low',
        horizon: 'seasonal'
      };
    }

    // EXCELLENT PERFORMANCE: Consider pre-heating
    if (cops.current >= 4.0 && cops.daily >= 3.8 && priceSignal === 'low') {
      return {
        action: 'preheat_opportunity',
        adjustment: +0.5,
        reason: `Excellent COP: ${cops.current.toFixed(1)}, low price`,
        urgency: 'low',
        horizon: 'immediate'
      };
    }

    // NO ACTION NEEDED
    return {
      action: 'maintain',
      adjustment: 0,
      reason: 'All metrics within acceptable range',
      urgency: 'none',
      horizon: 'none'
    };
  }

  private calculateSeasonalAdjustment(scop: number): number {
    // More aggressive adjustment for worse SCOP
    if (scop < 2.8) return -1.5;
    if (scop < 3.0) return -1.0;
    if (scop < 3.2) return -0.5;
    return 0;
  }
}
```

## Component 5: Coast-Strategie (Passieve Koelmodus)

> Referentie: [ADR-024 — Adaptive Control: Passieve Afkoelmodus](../../../plans/decisions/ADR-024-adaptive-cooldown-mode.md)

### Probleem

Wanneer de kamertemperatuur boven het setpoint ligt (bijv. door zonnewinst of restwarmte), blijft de PI-regelaar een positieve correctie berekenen — de I-term accumuleert een "te koud" fout die in werkelijkheid niet bestaat. Hierdoor blijft de warmtepomp onnodig actief terwijl passief afkoelen het gewenste gedrag is.

### Detectie: Drie Criteria

```typescript
// Alle drie moeten true zijn voor activatie
private _isCooldownConfirmed(indoorTemp: number, targetTemp: number): boolean {
  const effectiveHysteresis = this.settings.adaptive_cooldown_hysteresis;
  
  // Criterium 1: MAGNITUDE — Tist > Tsoll + hysterese
  const aboveSetpoint = indoorTemp > targetTemp + effectiveHysteresis;
  
  // Criterium 2: DUUR — Minimaal 2 opeenvolgende cycles
  if (aboveSetpoint) {
    this._cooldownCycleCount++;
  } else {
    this._cooldownCycleCount = 0;
    return false;
  }
  const durationMet = this._cooldownCycleCount >= 2;
  
  // Criterium 3: TREND — Temperatuur stijgt of is stabiel
  const trendRising = this._isTemperatureRising();
  
  return aboveSetpoint && durationMet && trendRising;
}
```

### Coast Delta Berekening

```text
coastAdjust = (uitlaatTemperatuur − offset) − huidigSetpoint

Voorbeeld: uitlaat = 27°C, offset = 1°C, setpoint = 30°C
→ coastAdjust = (27 − 1) − 30 = −4°C
```

Het resultaat is altijd negatief — het systeem stuurt het setpoint ver onder de huidige watertemperatuur zodat de warmtepomp het interne minimum (P111, typisch 24–26°C) bereikt en de compressor stopt.

### ADR-040A: Conditioneel Gewicht

> Referentie: [ADR-040 — Coast Effectiviteitsverbetering](../../../plans/decisions/ADR-040-coast-effectiviteitsverbetering.md)

**Probleem:** Na elke setpoint-verlaging loopt de gemeten uitlaattemperatuur door hydraulische traagheid tijdelijk achter. In die periode is `coastAdjust = 0`, maar coast claimde toch 88% van het gewichtsbudget — waardoor de PI-controller slechts ~11% gewicht had.

**Oplossing:** Coast krijgt alleen gewicht wanneer het daadwerkelijk bijdraagt:

```typescript
// ADR-040A: Coast krijgt alleen gewicht wanneer coastAdjust < 0
// Consistent patroon met effectiveCostWeight en effectiveThermalWeight
const effectiveCoastWeight = (coastAdjust < 0) ? coastStrength : 0;
```

Bij `coastAdjust = 0` (hydraulische vertraging) valt het coast-gewicht terug naar nul, waardoor PI het volledige budget overneemt en de volledige bijsturing kan leveren.

### ADR-040B: Outlet-Dalingstrend als Leading Indicator

**Motivatie:** De huidige coast-formule gebruikt een momenteel verschil (lagging indicator). De uitlaattemperatuur reageert op setpoint-wijzigingen binnen minuten — dit is een leading indicator die al vroeg signaleert of de installatie voldoende reageert.

**Sliding window:** 4 metingen × 5 min = 20 min venster

```typescript
private _outletTempHistory: number[] = [];
private static readonly OUTLET_TREND_WINDOW_SIZE = 4;

// °C/cyclus (negatief = dalend)
private _calculateOutletDropRate(): number {
  if (this._outletTempHistory.length < AdaptiveControlService.OUTLET_TREND_WINDOW_SIZE) {
    return 0; // Graceful fallback: geen schaling bij onvoldoende data
  }
  const oldest = this._outletTempHistory[0];
  const newest = this._outletTempHistory[this._outletTempHistory.length - 1];
  return (newest - oldest) / AdaptiveControlService.OUTLET_TREND_WINDOW_SIZE;
}
```

**Schaalfactor in `_buildCoastAction()`:**

```typescript
const outletDropRate = this._calculateOutletDropRate();
const dropRateMultiplier = outletDropRate < 0
  ? Math.max(0.3, 1.0 + outletDropRate * 0.5)
  : 1.0;
const adjustment = baseAdjustment * dropRateMultiplier;
```

| outletDropRate | multiplier | Betekenis |
| --- | --- | --- |
| 0,0 °C/cyclus | 1,00 | Trage daling — volledige coast correctie |
| −0,5 °C/cyclus | 0,75 | Matige daling — coast 25% gereduceerd |
| −1,0 °C/cyclus | 0,50 | Snelle daling — coast 50% gereduceerd |
| ≤ −1,4 °C/cyclus | 0,30 | Zeer snelle daling — minimum coast correctie |

### I-term Reset bij Exit

```typescript
// Bij exit van cooldown: PI-historie wissen
private _handleCooldownExit(): void {
  if (this._coastActive) {
    this.heatingController.resetHistory();  // I-term → 0
    this._coastActive = false;
    this._cooldownCycleCount = 0;
    this.logger('Coast exit: I-term reset, PI start met schone historie');
  }
}
```

Dit voorkomt dat de PI-regelaar na de afkoelfase een **post-coast bias** heeft door de geaccumuleerde I-term.

### Integratie in WeightedDecisionMaker

De `CoastAction` wordt doorgegeven als een dominant gewogen component:

```typescript
interface CoastAction {
  adjustment: number;   // altijd negatief tijdens actieve coast
  reason: string;
  priority: 'high';
  strength: number;     // 0.0–1.0, standaard 0.80
}
```

De bestaande 4 componenten worden geschaald met `existingScale = 1 - strength`:

```text
Bij strength = 0.80:
  coast    ≈ 82.5%  (dominant)
  comfort  ≈ 10.3%  (PI — ook negatief, versterkt coast)
  thermal  ≈  4.1%  (wind correctie max +0.06°C → verwaarloosbaar)
  overig   ≈  3.1%
```

### Gebruikersinstellingen

| Instelling | Default | Bereik | Functie |
|------------|---------|--------|---------|
| `adaptive_cooldown_offset` | 1°C | 0.5–5°C | Graden onder uitlaattemperatuur voor coast-doel |
| `adaptive_cooldown_hysteresis` | 0.3°C | 0.1–1.0°C | Overshoot-marge boven setpoint voor activatie |
| `adaptive_cooldown_strength` | 0.80 | 0.60–0.95 | Gewichtsaandeel van coast-component |

---

## Systeem Integratie - Complete Control Flow

```typescript
class AdaptiveControlService {
  private heatingController: HeatingController;
  private buildingModel: BuildingModelLearner;
  private priceOptimizer: EnergyPriceOptimizer;
  private copController: COPController;
  private weightedDecisionMaker: WeightedDecisionMaker;

  // Coast state (in-memory, reset bij stop())
  private _coastActive = false;
  private _cooldownCycleCount = 0;
  private _indoorTempHistory: number[] = [];

  async executeControlCycle(): Promise<void> {
    // 1. Collect current state
    const currentTemp = await this.getIndoorTemperature();
    const targetTemp = await this.getTargetTemperature();
    const copMetrics = await this.getCOPMetrics();
    const currentPrice = this.priceOptimizer.getCurrentPrice();
    const buildingModel = this.buildingModel.getModel();

    // 2. Record indoor temp in sliding window (max 3, FIFO)
    this._indoorTempHistory.push(currentTemp);
    if (this._indoorTempHistory.length > 3) {
      this._indoorTempHistory.shift();
    }

    // 3. Check coast EXIT condition (lower hysteresis to prevent flip-flop)
    if (this._coastActive) {
      const exitHysteresis = this.settings.adaptive_cooldown_hysteresis / 2;
      if (currentTemp < targetTemp + exitHysteresis) {
        this.heatingController.resetHistory();  // I-term reset!
        this._coastActive = false;
        this._cooldownCycleCount = 0;
      }
    }

    // 4. Check coast ACTIVATION (magnitude + duration + trend)
    if (!this._coastActive && this._isCooldownConfirmed(currentTemp, targetTemp)) {
      this._coastActive = true;
    }

    // 5. Get recommendations from each component
    const heatingAction = this.heatingController.calculateAction(currentTemp, targetTemp);
    const copAction = this.copController.analyzeAndRecommend(
      copMetrics, buildingModel, currentTemp, targetTemp,
      this.priceOptimizer.getPriceCategory(currentPrice)
    );
    const priceAction = this.priceOptimizer.calculatePreHeatRecommendation(
      buildingModel, currentTemp, targetTemp, currentPrice
    );
    const thermalAction = buildingModel.calculateThermalAction();

    // 6. Build coast action (null if coast not active)
    const coastAction = this._coastActive
      ? this._buildCoastAction(targetTemp)
      : null;

    // 7. Combined weighted decision (5 components)
    const combinedAction = this.weightedDecisionMaker.combineActionsWithThermal(
      heatingAction, copAction, priceAction, thermalAction,
      this.getConfidenceMetrics(),
      coastAction,  // null → geen effect, backwards-compatible
    );

    // 8. Apply adjustment via smart accumulator
    if (await this.isActiveMode()) {
      await this.applySetpointAdjustment(combinedAction.finalAdjustment);
    }

    // 9. Trigger flow cards with coast-aware tokens
    await this.triggerFlowCards({
      ...combinedAction,
      control_mode: this._coastActive ? 'cooldown' : 'heating',
      coast_component: combinedAction.breakdown.coast ?? 0,
    });

    // 10. Log decision
    this.logControlDecision({
      currentTemp, targetTemp,
      finalAdjustment: combinedAction.finalAdjustment,
      breakdown: combinedAction.breakdown,
      coastActive: this._coastActive,
      controlMode: this._coastActive ? 'cooldown' : 'heating',
    });
  }
}
```

---

## Performance Specificaties

### Computational Requirements

| Resource | Requirement | Actual Usage |
|----------|-------------|--------------|
| **CPU** | < 5% average | 2-3% |
| **Memory** | < 50 MB | 15-30 MB |
| **Storage** | < 5 MB (model data) | 2-4 MB |
| **Network** | < 1 MB/day (API calls) | 0.5 MB/day |

### Timing Characteristics

| Operation | Target | Typical |
|-----------|--------|---------|
| PI Control Cycle | < 1s | 200-400ms |
| RLS Update | < 500ms | 100-200ms |
| COP Analysis | < 1s | 300-500ms |
| Full Control Loop | < 5s | 2-3s |

### Learning Performance

| Metric | Target | Achieved |
|--------|--------|----------|
| Initial Convergence (24h) | 30% confidence | 35-40% |
| Week Confidence | 60%+ | 70-75% |
| Month Confidence | 85%+ | 90-95% |
| Prediction Accuracy (1 week) | ±1°C | ±0.5-0.8°C |
| Prediction Accuracy (1 month) | ±0.5°C | ±0.3-0.5°C |

### Optimization Results

| KPI | Baseline (Manual) | With Adaptive Control | Improvement |
|-----|-------------------|----------------------|-------------|
| **Average COP** | 2.8 | 3.6 | +29% |
| **Daily Energy Use** | 35 kWh | 25 kWh | -29% |
| **Daily Cost** | €4.20 | €2.50 | -40% |
| **Annual Cost** | €1,533 | €913 | **€620 savings** |
| **Temperature Stability** | ±1.5°C | ±0.3°C | +80% |
| **Response Time** | 30-60 min | 15-20 min | +50% faster |

---

## Versie Historie

**v2.4.0 (April 2026)** - Coast Effectiviteitsverbetering (ADR-040)

- ✨ Conditioneel coast-gewicht: `effectiveCoastWeight = (coastAdjust < 0) ? coastStrength : 0`
- ✨ Outlet-temperatuur sliding window (4 × 5 min = 20 min) als leading indicator
- ✨ `dropRateMultiplier` schaalt coast-correctie op basis van dalingsnelheid outlet (min 0,3×)
- ✨ `_outletTempHistory` gereset in `stop()` lifecycle methode
- 📖 ADR-040A en ADR-040B secties toegevoegd aan technische documentatie

**v2.3.0 (Maart 2026)** - Passieve Koelmodus (Coast-Strategie)

- ✨ Coast-strategie geïmplementeerd (ADR-024)
- ✨ WeightedDecisionMaker uitgebreid met `CoastAction` interface
- ✨ 3-criteria koeldetectie (magnitude + duur + trend)
- ✨ I-term reset bij coast-exit om post-coast bias te voorkomen
- ✨ Flow card `temperature_adjustment_recommended` uitgebreid met `control_mode` token
- ✨ Flow card `adaptive_simulation_update` uitgebreid met `coast_component` token
- 🔧 3 nieuwe gebruikersinstellingen: offset, hysterese, sterkte
- 📖 Component 5 sectie toegevoegd aan technische documentatie

**v2.2.0 (December 2025)** - Building Model Enhancements

- ✨ Gebouwtype profielen (Light, Average, Heavy, Passive)
- ✨ Dynamische interne warmtewinsten (tijd-van-de-dag afhankelijk)
- ✨ Seizoensgebonden zonnewinst factor (maandelijkse aanpassing)
- 🔧 Verbeterde forgetting factor (0.998 voor stabielere adaptatie)
- 🔧 State persistence voor nieuwe configuratieparameters
- 🎯 10-15% verbetering in voorspellingsnauwkeurigheid

**v2.0.7 (December 2025)** - State Change Flow Cards Fix

- 🐛 Fix timeline notificaties voor status triggers
- 🐛 Fix COP capability null state bij opstart
- 🔧 Debug logging voor flow cards

**v1.0 (December 2025)**

- Initial release met alle 4 componenten
- PI temperature controller
- Building model learner (RLS)
- Energy price optimization
- COP-based control

---

*Dit document bevat de technische implementatie details. Voor conceptuele uitleg en gebruikersinstructies, zie "Adaptieve Regeling Systeem - Gebruikershandleiding".*
