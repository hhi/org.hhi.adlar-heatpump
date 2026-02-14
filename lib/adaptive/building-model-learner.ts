/**
 * Building Model Learner - Component 2 of Adaptive Control System
 *
 * Implements Recursive Least Squares (RLS) algorithm to learn thermal properties
 * of the building (thermal mass C, heat loss coefficient UA, solar gain g, internal gains P_int).
 *
 * Physical model:
 * dT/dt = (1/C) × [P_heating - UA×(T_in - T_out) + g×Solar + P_int]
 *
 * RLS formulation:
 * y = X^T × θ
 * where:
 *   y = dT/dt (temperature change rate)
 *   X = [P_heating, (T_in - T_out), Solar, 1] (input vector)
 *   θ = [1/C, UA/C, g/C, P_int/C] (parameters to learn)
 *
 * @version 2.2.0 - Added building profiles, dynamic P_int, seasonal g-factor
 * @since 1.4.0
 */

/**
 * Building type profiles with typical parameter ranges
 * Based on thermal characteristics and construction type
 */
export type BuildingProfileType = 'light' | 'average' | 'heavy' | 'passive';

export interface BuildingProfile {
  C: number; // Thermal mass (kWh/°C)
  UA: number; // Heat loss coefficient (kW/°C)
  g: number; // Solar gain factor (base value)
  pInt: number; // Internal heat gains (kW, daytime average)
}

/**
 * Predefined building profiles based on construction type and insulation
 */
export const BUILDING_PROFILES: Record<BuildingProfileType, BuildingProfile> = {
  light: {
    C: 7, // Low thermal mass - quick temperature response
    UA: 0.35, // Moderate heat loss
    g: 0.4, // Moderate solar gain
    pInt: 0.3, // Standard internal gains
  },
  average: {
    C: 15, // Medium thermal mass
    UA: 0.3, // Average insulation
    g: 0.5, // Good solar gain
    pInt: 0.3, // Standard internal gains
  },
  heavy: {
    C: 20, // High thermal mass - slow temperature response
    UA: 0.25, // Better insulation
    g: 0.4, // Lower solar gain (more mass to heat)
    pInt: 0.35, // Slightly higher internal gains
  },
  passive: {
    C: 30, // Very high thermal mass
    UA: 0.05, // Excellent insulation
    g: 0.6, // High solar gain utilization
    pInt: 0.25, // Lower internal gains (less needed)
  },
};

/**
 * Get internal gains based on time of day
 * Pattern: Low at night, moderate during day, higher in evening
 */
export function getDynamicPInt(hour: number, basePInt: number): number {
  if (hour >= 23 || hour < 6) {
    return basePInt * 0.4; // Night: 40% of base (0.12 kW for base 0.3)
  }
  if (hour >= 6 && hour < 18) {
    return basePInt * 1.0; // Day: 100% of base (0.3 kW)
  }
  return basePInt * 1.8; // Evening: 180% of base (0.54 kW)
}

/**
 * Get seasonal solar gain multiplier
 * Accounts for sun angle and seasonal variation
 */
export function getSeasonalGMultiplier(month: number): number {
  const seasonalFactors: Record<number, number> = {
    0: 0.6, // Jan: Low sun angle
    1: 0.7, // Feb
    2: 0.9, // Mar
    3: 1.0, // Apr
    4: 1.1, // May
    5: 1.3, // Jun: High sun angle
    6: 1.3, // Jul
    7: 1.2, // Aug
    8: 1.0, // Sep
    9: 0.9, // Oct
    10: 0.7, // Nov
    11: 0.6, // Dec
  };

  return seasonalFactors[month] || 1.0;
}

export interface BuildingModelConfig {
  forgettingFactor: number; // 0.995-0.9995, default 0.999 = balance stability/adaptivity
  initialCovariance: number; // 100 = high initial uncertainty
  minSamplesForConfidence: number; // 288 = 24 hours @ 5min intervals
  buildingProfile?: BuildingProfileType; // Building type for initial parameters
  enableDynamicPInt?: boolean; // Enable time-of-day P_int adjustment
  enableSeasonalG?: boolean; // Enable seasonal g-factor adjustment
  logger?: (msg: string, ...args: unknown[]) => void;
}

export interface MeasurementData {
  timestamp: number; // Unix timestamp (ms)
  tIndoor: number; // Indoor temperature (°C)
  tOutdoor: number; // Outdoor temperature (°C)
  pHeating: number; // Thermal heating power (kW)
  solarRadiation?: number; // Solar radiation (W/m²) - optional
  solarSource?: 'solar_panels' | 'knmi_radiation' | 'open_meteo' | 'estimation'; // Source of solar data (v2.7.0)
  deltaTPerHour: number; // Temperature change rate (°C/h) - calculated internally
}

export interface BuildingModel {
  C: number; // Thermal mass (kWh/°C)
  UA: number; // Heat loss coefficient (kW/°C)
  g: number; // Solar gain factor (dimensionless)
  pInt: number; // Internal heat gains (kW)
  tau: number; // Time constant C/UA (hours)
  confidence: number; // 0-100% confidence level
}

/**
 * Building Model Learner using Recursive Least Squares algorithm
 */
export class BuildingModelLearner {
  private theta: number[]; // [1/C, UA/C, g/C, P_int/C]
  private P: number[][]; // Covariance matrix (4x4)
  private lambda: number; // Forgetting factor
  private sampleCount: number;
  private lastMeasurement: MeasurementData | null;
  private minSamplesForConfidence: number;
  private logger: (message: string, ...args: unknown[]) => void;
  private enableDynamicPInt: boolean;
  private enableSeasonalG: boolean;
  private basePInt: number; // Base P_int value for dynamic calculation

  // =========================================================================
  // DEFENSIVE LAYER 1: Measurement Validation Bounds
  // Reject physically impossible or extreme measurement values BEFORE RLS update
  // =========================================================================
  private static readonly MEASUREMENT_BOUNDS = {
    dT_dt_max: 10.0, // ±10°C/hour max realistic temperature change rate
    pHeating_min: 0.0, // Minimum thermal power (kW)
    pHeating_max: 20.0, // Maximum thermal power (kW) - based on 5kW electric × 4 COP
    tIndoor_min: 5.0, // Minimum indoor temp (°C)
    tIndoor_max: 30.0, // Maximum indoor temp (°C)
    tOutdoor_min: -10.0, // Minimum outdoor temp (°C)
    tOutdoor_max: 50.0, // Maximum outdoor temp (°C)
    solarRadiation_max: 1200.0, // Maximum solar radiation (W/m²)
  };

  // =========================================================================
  // DEFENSIVE LAYER 2: Theta Parameter Bounds
  // Detect RLS algorithm divergence by checking physical parameter ranges
  // Derived from BUILDING_PROFILES (lines 37-62)
  // =========================================================================
  private static readonly THETA_BOUNDS = {
    theta0_min: 1 / 40, // Min 1/C (max C = 40 kWh/°C, passive house)
    theta0_max: 1 / 5, // Max 1/C (min C = 5 kWh/°C, light building)
    theta1_min: 0.05 / 40, // Min UA/C (UA=0.05 kW/°C, C=40) - v2.7.1: tightened from 0.02
    theta1_max: 1.0 / 5, // Max UA/C (UA=1.0 kW/°C poor insulation, C=5)
    theta1_theta0_ratio_min: 0.002, // θ[1]/θ[0] > 0.002 ensures τ < 500h (v2.7.1: NEW)
    theta1_theta0_ratio_max: 0.8, // θ[1]/θ[0] < 0.8 ensures τ > 1.25h
    g_c_min: 0.2 / 40, // Min g/C (g=0.2 base × 0.6 seasonal winter)
    g_c_max: 0.8 / 5, // Max g/C (g=0.8 base × 1.3 seasonal summer)
    pint_c_min: 0.1 / 40, // Min P_int/C (0.1kW base × 0.4 night)
    pint_c_max: 0.6 / 5, // Max P_int/C (0.6kW base × 1.8 evening)
  };

  constructor(config: BuildingModelConfig) {
    // Get building profile (default to 'average' if not specified)
    const profile = config.buildingProfile
      ? BUILDING_PROFILES[config.buildingProfile]
      : BUILDING_PROFILES.average;

    // Initialize theta using building profile parameters
    this.theta = [
      1 / profile.C, // 1/C
      profile.UA / profile.C, // UA/C
      profile.g / profile.C, // g/C
      profile.pInt / profile.C, // P_int/C
    ];

    this.basePInt = profile.pInt; // Store for dynamic P_int calculation
    this.enableDynamicPInt = config.enableDynamicPInt ?? false;
    this.enableSeasonalG = config.enableSeasonalG ?? false;

    // Initialize covariance matrix with high uncertainty
    const initCov = config.initialCovariance;
    this.P = [
      [initCov, 0, 0, 0],
      [0, initCov, 0, 0],
      [0, 0, initCov, 0],
      [0, 0, 0, initCov],
    ];

    this.lambda = config.forgettingFactor;
    this.sampleCount = 0;
    this.lastMeasurement = null;
    this.minSamplesForConfidence = config.minSamplesForConfidence;
    this.logger = config.logger || (() => { });

    this.logger(
      `BuildingModelLearner: Initialized with profile ${config.buildingProfile || 'average'} `
      + `(C=${profile.C}, UA=${profile.UA}, g=${profile.g}, P_int=${profile.pInt})`,
    );
  }

  /**
   * Add new measurement and update model using RLS algorithm
   */
  public addMeasurement(data: MeasurementData): void {
    // First measurement - just store it
    // DEFENSIVE: Also treat as first if lastMeasurement is null (corrupted state recovery)
    if (this.sampleCount === 0 || this.lastMeasurement === null) {
      this.lastMeasurement = data;
      this.sampleCount++;
      this.logger(`BuildingModelLearner: First measurement stored (count was ${this.sampleCount - 1})`);
      return;
    }

    // Calculate temperature change rate (dT/dt)
    const dt = (data.timestamp - this.lastMeasurement.timestamp) / 3600000; // Convert ms to hours
    if (dt <= 0) {
      this.logger('BuildingModelLearner: Invalid time delta, skipping measurement');
      return;
    }

    const dT = data.tIndoor - this.lastMeasurement!.tIndoor;
    const dtDt = dT / dt; // °C/hour

    // =========================================================================
    // DEFENSIVE LAYER 1: Measurement Validation
    // Reject physically impossible or extreme values BEFORE RLS update
    // =========================================================================
    const bounds = BuildingModelLearner.MEASUREMENT_BOUNDS;
    let validationFailure: string | null = null;

    // Check temperature change rate (most critical - indicates sensor errors)
    if (Math.abs(dtDt) > bounds.dT_dt_max) {
      validationFailure = `Temperature change rate too high: ${dtDt.toFixed(2)}°C/h (max: ±${bounds.dT_dt_max})`;
    } else if (data.pHeating < bounds.pHeating_min || data.pHeating > bounds.pHeating_max) {
      // Check heating power bounds
      validationFailure = `Heating power out of bounds: ${data.pHeating.toFixed(2)}kW (valid: ${bounds.pHeating_min}-${bounds.pHeating_max})`;
    } else if (data.tIndoor < bounds.tIndoor_min || data.tIndoor > bounds.tIndoor_max) {
      // Check indoor temperature bounds
      validationFailure = `Indoor temperature out of bounds: ${data.tIndoor.toFixed(1)}°C (valid: ${bounds.tIndoor_min}-${bounds.tIndoor_max})`;
    } else if (data.tOutdoor < bounds.tOutdoor_min || data.tOutdoor > bounds.tOutdoor_max) {
      // Check outdoor temperature bounds
      validationFailure = `Outdoor temperature out of bounds: ${data.tOutdoor.toFixed(1)}°C (valid: ${bounds.tOutdoor_min}-${bounds.tOutdoor_max})`;
    } else if (data.solarRadiation !== undefined
      && (data.solarRadiation < 0 || data.solarRadiation > bounds.solarRadiation_max)) {
      // Check solar radiation bounds (if provided)
      validationFailure = `Solar radiation out of bounds: ${data.solarRadiation.toFixed(0)}W/m² (valid: 0-${bounds.solarRadiation_max})`;
    }

    // If validation failed, log and skip RLS update
    if (validationFailure) {
      this.logger('BuildingModelLearner: ⚠️ INVALID MEASUREMENT - skipping RLS update');
      this.logger(`  Reason: ${validationFailure}`);
      this.logger(
        `  Values: dT/dt=${dtDt.toFixed(2)}°C/h, pHeating=${data.pHeating.toFixed(2)}kW, `
        + `tIn=${data.tIndoor.toFixed(1)}°C, tOut=${data.tOutdoor.toFixed(1)}°C`,
      );
      // Early return - do NOT update lastMeasurement, do NOT increment sampleCount
      // This preserves learning continuity while rejecting bad data
      return;
    }

    // Apply time-of-day P_int multiplier if enabled
    const hour = new Date(data.timestamp).getHours();
    const pIntMultiplier = this.enableDynamicPInt
      ? getDynamicPInt(hour, this.basePInt) / this.basePInt
      : 1.0;

    // Apply seasonal solar gain multiplier if enabled
    // v2.7.0: Only apply seasonal correction for estimated solar data
    // External sources (solar_panels, knmi_radiation, open_meteo) already include seasonal/weather effects
    const month = new Date(data.timestamp).getMonth();
    const useEstimation = data.solarSource === 'estimation' || data.solarSource === undefined;
    const applySeasonalG = this.enableSeasonalG && useEstimation;
    const solarMultiplier = applySeasonalG
      ? getSeasonalGMultiplier(month)
      : 1.0;

    // Log when seasonal g is skipped due to external solar data (first occurrence per session)
    if (this.enableSeasonalG && !useEstimation && this.sampleCount % 100 === 1) {
      this.logger(`ℹ️ Seasonal g-factor disabled: using ${data.solarSource} radiation data`);
    }

    // Build input vector X = [pHeating, (tIn - tOut), Solar, constant_term]
    // Apply dynamic adjustments to solar radiation and internal gains
    const X = [
      data.pHeating, // Heating power (kW)
      data.tIndoor - data.tOutdoor, // Temperature difference (°C)
      (data.solarRadiation || 0) * solarMultiplier, // Solar with seasonal adjustment
      pIntMultiplier, // Constant term scaled for time-varying P_int
    ];

    // Perform RLS update
    this.updateRLS(X, dtDt);

    // Store measurement for next iteration
    this.lastMeasurement = data;
    this.sampleCount++;

    // Log progress at milestones
    if (this.sampleCount % 100 === 0) {
      const model = this.getModel();
      this.logger(
        `BuildingModelLearner: ${this.sampleCount} samples - `
        + `C=${model.C.toFixed(1)} kWh/°C, UA=${model.UA.toFixed(2)} kW/°C, `
        + `confidence=${model.confidence.toFixed(0)}%`,
      );
    }
  }

  /**
   * RLS algorithm implementation
   *
   * Update equations:
   * K = P × X / (λ + X^T × P × X)         (Kalman gain)
   * θ = θ + K × (y - X^T × θ)             (Parameter update)
   * P = (1/λ) × (P - K × X^T × P)         (Covariance update)
   */
  private updateRLS(X: number[], y: number): void {
    // =========================================================================
    // DEFENSIVE LAYER 3: Variable Forgetting Factor (VFF-RLS)
    // v2.7.7: Error-based adaptive λ - key insight from scientific literature:
    // - Small prediction error → λ → 0.9999 (stable, minimal learning)
    // - Large prediction error → λ → 0.995 (fast tracking)
    // This prevents both convergence stalling AND rapid divergence
    // Reference: University of Michigan RLS research, IEEE VFF-RLS papers
    // =========================================================================
    const prediction = this.dotProduct(X, this.theta);
    const predictionError = Math.abs(y - prediction);

    // Normalize error: 2.0°C/h considered maximum reasonable error
    const errorNormalized = Math.min(predictionError / 2.0, 1.0);

    // Sigmoid mapping: smooth transition between stable and tracking modes
    // At error=0.5°C/h → sigmoid ≈ 0.5 (balanced)
    // At error<0.2°C/h → sigmoid ≈ 0.1 (stable mode)
    // At error>1.0°C/h → sigmoid ≈ 0.9 (tracking mode)
    const sigmoid = 1 / (1 + Math.exp(-5 * (errorNormalized - 0.25)));

    // Adaptive lambda: 0.9999 (stable) to 0.995 (fast tracking)
    const vffLambda = 0.9999 - sigmoid * (0.9999 - 0.995);

    // Also apply sample-count based warmup (existing logic)
    const warmupLambda = Math.max(
      this.lambda, // Configured value (default 0.998)
      0.999 - this.sampleCount / 100000, // Gradual decrease during warmup
    );

    // Use the more conservative (larger) of the two
    const adaptiveLambda = Math.max(vffLambda, warmupLambda);

    // Log VFF activity at milestones
    if (this.sampleCount % 100 === 0) {
      this.logger(
        `BuildingModelLearner: VFF λ=${adaptiveLambda.toFixed(4)} `
        + `(error=${predictionError.toFixed(3)}°C/h, sigmoid=${sigmoid.toFixed(2)})`,
      );
    }

    // Step 1: Compute Kalman gain K = P × X / (λ + X^T × P × X)
    const PX = this.matrixVectorMultiply(this.P, X);
    const denominator = adaptiveLambda + this.dotProduct(X, PX);
    const K = PX.map((val) => val / denominator);

    // Step 2: Update parameters θ = θ + K × (y - X^T × θ)
    const error = y - prediction; // prediction already calculated above for VFF

    // =========================================================================
    // DEFENSIVE LAYER 2: Save theta before update for potential reversion
    // =========================================================================
    const thetaPrevious = [...this.theta]; // Shallow copy (4 numbers)

    this.theta = this.theta.map((val, i) => val + K[i] * error);

    // =========================================================================
    // DEFENSIVE LAYER 2: Theta Parameter Bounds Checking
    // Detect RLS divergence by validating physical parameter ranges
    // =========================================================================
    const bounds = BuildingModelLearner.THETA_BOUNDS;
    const theta0Valid = this.theta[0] >= bounds.theta0_min && this.theta[0] <= bounds.theta0_max;
    const theta1Valid = this.theta[1] >= bounds.theta1_min && this.theta[1] <= bounds.theta1_max;
    const theta2Valid = this.theta[2] >= bounds.g_c_min && this.theta[2] <= bounds.g_c_max;
    const theta3Valid = this.theta[3] >= bounds.pint_c_min && this.theta[3] <= bounds.pint_c_max;
    // v2.7.1: Added ratio minimum check to prevent τ > 500h (θ[1]/θ[0] > 0.002)
    const ratioMinValid = this.theta[1] > this.theta[0] * bounds.theta1_theta0_ratio_min;
    const ratioMaxValid = this.theta[1] < this.theta[0] * bounds.theta1_theta0_ratio_max;

    const allValid = theta0Valid && theta1Valid && theta2Valid && theta3Valid && ratioMinValid && ratioMaxValid;

    if (!allValid) {
      // RLS algorithm has diverged - log detailed diagnostics and revert
      const tauEstimate = this.theta[0] / this.theta[1]; // 1/C ÷ UA/C = 1/UA × C/1 = C/UA = τ
      this.logger('BuildingModelLearner: ⚠️ RLS DIVERGENCE DETECTED - reverting theta');
      this.logger(`  θ[0] (1/C):     ${this.theta[0].toFixed(6)} [valid: ${bounds.theta0_min.toFixed(6)} - ${bounds.theta0_max.toFixed(6)}] ${theta0Valid ? '✅' : '❌'}`);
      this.logger(`  θ[1] (UA/C):    ${this.theta[1].toFixed(6)} [valid: ${bounds.theta1_min.toFixed(6)} - ${bounds.theta1_max.toFixed(6)}] ${theta1Valid ? '✅' : '❌'}`);
      this.logger(`  θ[2] (g/C):     ${this.theta[2].toFixed(6)} [valid: ${bounds.g_c_min.toFixed(6)} - ${bounds.g_c_max.toFixed(6)}] ${theta2Valid ? '✅' : '❌'}`);
      this.logger(`  θ[3] (P_int/C): ${this.theta[3].toFixed(6)} [valid: ${bounds.pint_c_min.toFixed(6)} - ${bounds.pint_c_max.toFixed(6)}] ${theta3Valid ? '✅' : '❌'}`);
      this.logger(`  θ[1]/θ[0] ratio: ${(this.theta[1] / this.theta[0]).toFixed(6)} [valid: ${bounds.theta1_theta0_ratio_min} - ${bounds.theta1_theta0_ratio_max}] ${ratioMinValid && ratioMaxValid ? '✅' : '❌'}`);
      this.logger(`  τ estimate: ${tauEstimate.toFixed(1)}h [valid: 1.25 - 500]`);
      this.logger('  Action: Reverted to previous theta, kept P matrix for uncertainty tracking');

      // REVERT: Restore previous theta (keep P matrix to maintain uncertainty)
      this.theta = thetaPrevious;

      // Skip P matrix update by returning early
      return;
    }

    // =========================================================================
    // DEFENSIVE LAYER 4: Parameter Rate Limiting (NEW in v2.7.7)
    // Prevents rapid parameter changes that cause C to jump (e.g., 13→5)
    // Scientific basis: "parameter constraints" from RLS literature
    // Each θ component limited to max 5% change per sample
    // =========================================================================
    const MAX_THETA_CHANGE_RATIO = 0.05; // 5% max change per sample
    let rateLimited = false;

    for (let i = 0; i < 4; i++) {
      const maxChange = Math.abs(thetaPrevious[i]) * MAX_THETA_CHANGE_RATIO;
      const actualChange = this.theta[i] - thetaPrevious[i];

      if (Math.abs(actualChange) > maxChange && maxChange > 0) {
        this.theta[i] = thetaPrevious[i] + Math.sign(actualChange) * maxChange;
        rateLimited = true;
      }
    }

    if (rateLimited && this.sampleCount % 10 === 0) {
      const newC = 1 / this.theta[0];
      this.logger(
        `BuildingModelLearner: Rate-limited θ changes (max 5%/sample), C=${newC.toFixed(1)} kWh/°C`,
      );
    }

    // Step 3: Update covariance P = (1/λ) × (P - K × X^T × P)
    // =========================================================================
    // DEFENSIVE LAYER 5: Covariance Bounding (Enhanced in v2.7.7)
    // P_FLOOR: Prevents covariance collapse (algorithm stops learning)
    // P_CEILING: Prevents covariance wind-up (algorithm becomes too sensitive)
    // Scientific basis: "aI ≤ P ≤ bI" from University of Michigan RLS research
    // =========================================================================
    const P_FLOOR = 0.0001;   // Minimum uncertainty - prevents P[i,i]=0
    const P_CEILING = 1.0;    // Maximum uncertainty - equals initial covariance

    const KX = this.outerProduct(K, X);
    const KXP = this.matrixMultiply(KX, this.P);
    this.P = this.P.map((row, i) => row.map((val, j) => {
      const updated = (val - KXP[i][j]) / adaptiveLambda;
      // Apply floor AND ceiling to diagonal elements
      if (i === j) {
        return Math.max(P_FLOOR, Math.min(P_CEILING, updated));
      }
      return updated;
    }));
  }

  /**
   * Get current building model estimate
   */
  public getModel(): BuildingModel {
    // Convert theta parameters back to physical parameters
    const C = 1 / this.theta[0];
    const UA = this.theta[1] * C;
    const g = this.theta[2] * C;
    const pInt = this.theta[3] * C;
    const tau = C / UA;

    // Calculate confidence level
    const confidence = this.calculateConfidence();

    return {
      C, UA, g, pInt, tau, confidence,
    };
  }

  /**
   * Predict indoor temperature N hours ahead
   *
   * Uses simplified exponential decay model:
   * T(t) = T_eq + (T_0 - T_eq) × exp(-t/τ)
   *
   * where T_eq = equilibrium temperature under given conditions
   */
  public predictTemperature(
    currentIndoor: number,
    futureOutdoor: number,
    futureSolar: number,
    heatingPower: number,
    hoursAhead: number,
  ): number {
    const model = this.getModel();

    // Calculate equilibrium temperature
    // At equilibrium: dT/dt = 0
    // 0 = pHeating - UA×(tIn - tOut) + g×Solar + pInt
    // tEq = tOut + (pHeating + g×Solar + pInt) / UA
    const heatBalance = heatingPower + (model.g * (futureSolar / 1000)) + model.pInt; // Convert W/m² to kW
    const equilibriumTemp = futureOutdoor + heatBalance / model.UA;

    // Exponential approach to equilibrium
    const tempChange = (equilibriumTemp - currentIndoor) * (1 - Math.exp(-hoursAhead / model.tau));

    return currentIndoor + tempChange;
  }

  /**
   * Calculate confidence level based on sample count and covariance
   *
   * Confidence combines:
   * - Sample count coverage (0-100% based on minSamplesForConfidence)
   * - Bonus for samples beyond minimum (logarithmic scale, max 15%)
   * - Parameter certainty (inverse of covariance trace)
   *
   * @version 2.4.6 - Threshold increased from 400 to 500 to show learning progress from initialization
   * @version 2.5.21 - Added logarithmic bonus for samples beyond minimum for visible progress
   * @version 2.5.22 - Added final clamp to ensure confidence never exceeds 100%
   */
  private calculateConfidence(): number {
    // Component 1: Sample count coverage (base + bonus for extra samples)
    const baseCoverage = Math.min(this.sampleCount / this.minSamplesForConfidence, 1.0);

    // Bonus for samples beyond minimum: logarithmic scale for diminishing returns
    // Gives visible progress credit for continued data collection
    // At 850 samples (2.95x min): bonus ≈ 5.4% → ~63% instead of 60%
    // At 1440 samples (5x min): bonus ≈ 8% → ~65% instead of 60%
    // At 2880 samples (10x min): bonus ≈ 11.5% → ~68% instead of 60%
    const extraSamplesBonus = this.sampleCount > this.minSamplesForConfidence
      ? 0.05 * Math.log(this.sampleCount / this.minSamplesForConfidence)
      : 0;

    // Cap total sample coverage at 1.15 (max 15% bonus from extra samples)
    const sampleCoverage = Math.min(baseCoverage + extraSamplesBonus, 1.15);

    // Component 2: Parameter certainty (lower covariance = higher certainty)
    // Trace range: 400 (init) → 100 (converged) → 10-50 (fully learned)
    // Threshold 500 allows showing confidence from initialization onwards
    const trace = this.P.reduce((sum, row, i) => sum + row[i], 0);
    const covarianceConfidence = Math.max(0, 1 - trace / 500);

    // Combined confidence, clamped to 0-100%
    const rawConfidence = sampleCoverage * covarianceConfidence * 100;
    return Math.min(Math.max(rawConfidence, 0), 100);
  }

  /**
   * Export state for persistence
   */
  public getState() {
    return {
      theta: this.theta,
      P: this.P,
      sampleCount: this.sampleCount,
      lastMeasurement: this.lastMeasurement,
      basePInt: this.basePInt,
      enableDynamicPInt: this.enableDynamicPInt,
      enableSeasonalG: this.enableSeasonalG,
    };
  }

  /**
   * Restore state from persistence
   */
  public restoreState(state: {
    theta: number[];
    P: number[][];
    sampleCount: number;
    lastMeasurement: MeasurementData | null;
    basePInt?: number;
    enableDynamicPInt?: boolean;
    enableSeasonalG?: boolean;
  }): void {
    // DEFENSIVE VALIDATION: Prevent corrupt state from being restored
    let stateIsValid = true;
    const validationErrors: string[] = [];

    // Validate theta parameters (must be physically possible)
    if (state.theta && state.theta.length === 4) {
      // θ[0] = 1/C must be positive (C > 0)
      if (state.theta[0] <= 0) {
        validationErrors.push(`θ[0]=${state.theta[0]} (must be positive, represents 1/C)`);
        stateIsValid = false;
      }
      // θ[1] = UA/C must be positive (UA > 0)
      if (state.theta[1] <= 0) {
        validationErrors.push(`θ[1]=${state.theta[1]} (must be positive, represents UA/C)`);
        stateIsValid = false;
      }
      // θ[1] must be smaller than θ[0] (otherwise tau < 1 hour, unrealistic)
      if (state.theta[1] >= state.theta[0]) {
        validationErrors.push(`θ[1]=${state.theta[1]} >= θ[0]=${state.theta[0]} (would give tau < 1h)`);
        stateIsValid = false;
      }
    } else {
      validationErrors.push('theta array missing or wrong size');
      stateIsValid = false;
    }

    // Validate P matrix (covariance matrix trace should be reasonable)
    if (state.P && state.P.length === 4 && state.P[0].length === 4) {
      const pTrace = state.P.reduce((sum, row, i) => sum + row[i], 0);
      // Abnormally high trace indicates corruption (healthy range: 10-400)
      if (pTrace > 400 || pTrace < 0) {
        validationErrors.push(`P matrix trace=${pTrace.toFixed(1)} (healthy: 10-400)`);
        stateIsValid = false;
      }
    } else {
      validationErrors.push('P matrix missing or wrong dimensions');
      stateIsValid = false;
    }

    // If validation failed, REJECT corrupt state and use defaults
    if (!stateIsValid) {
      this.logger('⚠️ BuildingModelLearner: CORRUPT STATE DETECTED - rejecting restore');
      this.logger('   Validation errors:');
      validationErrors.forEach((err) => this.logger(`   - ${err}`));
      this.logger('   Using DEFAULT state instead (resetting to fresh start)');

      // CRITICAL FIX: Reset sample count to 0, not preserve it!
      // Preserving sample count but not lastMeasurement causes null pointer crash in addMeasurement()
      this.sampleCount = 0;
      this.lastMeasurement = null;
      // theta and P already initialized with defaults in constructor
      this.logger('   ✅ State restore prevented corruption - learning will restart from sample 0');
      return;
    }

    // State is valid - restore normally
    this.theta = state.theta;
    this.P = state.P;
    this.sampleCount = state.sampleCount;
    this.lastMeasurement = state.lastMeasurement;
    // Restore configuration (with defaults for backward compatibility)
    this.basePInt = state.basePInt ?? 0.3;
    this.enableDynamicPInt = state.enableDynamicPInt ?? false;
    this.enableSeasonalG = state.enableSeasonalG ?? false;
    this.logger(`BuildingModelLearner: Restored VALID state with ${this.sampleCount} samples`);
  }

  // ========================================================================
  // Matrix Operation Helper Methods
  // ========================================================================

  /**
   * Matrix-vector multiplication: M × v
   */
  private matrixVectorMultiply(M: number[][], v: number[]): number[] {
    return M.map((row) => this.dotProduct(row, v));
  }

  /**
   * Dot product: a · b
   */
  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  /**
   * Outer product: a ⊗ b (produces matrix)
   */
  private outerProduct(a: number[], b: number[]): number[][] {
    return a.map((ai) => b.map((bi) => ai * bi));
  }

  /**
   * Matrix-matrix multiplication: A × B
   */
  private matrixMultiply(A: number[][], B: number[][]): number[][] {
    return A.map((row) => B[0].map((_, j) => row.reduce((sum, val, k) => sum + val * B[k][j], 0)));
  }
}
