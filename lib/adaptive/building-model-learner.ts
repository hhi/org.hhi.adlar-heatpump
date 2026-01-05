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
  forgettingFactor: number; // 0.995-0.999 = adapt to seasonal changes
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
    this.logger = config.logger || (() => {});

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
    if (this.sampleCount === 0) {
      this.lastMeasurement = data;
      this.sampleCount++;
      this.logger('BuildingModelLearner: First measurement stored');
      return;
    }

    // Calculate temperature change rate (dT/dt)
    const dt = (data.timestamp - this.lastMeasurement!.timestamp) / 3600000; // Convert ms to hours
    if (dt <= 0) {
      this.logger('BuildingModelLearner: Invalid time delta, skipping measurement');
      return;
    }

    const dT = data.tIndoor - this.lastMeasurement!.tIndoor;
    const dtDt = dT / dt; // °C/hour

    // Apply time-of-day P_int multiplier if enabled
    const hour = new Date(data.timestamp).getHours();
    const pIntMultiplier = this.enableDynamicPInt
      ? getDynamicPInt(hour, this.basePInt) / this.basePInt
      : 1.0;

    // Apply seasonal solar gain multiplier if enabled
    const month = new Date(data.timestamp).getMonth();
    const solarMultiplier = this.enableSeasonalG
      ? getSeasonalGMultiplier(month)
      : 1.0;

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
    this.P = this.P.map((row, i) => row.map((val, j) => (val - KXP[i][j]) / this.lambda));
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
   * - Parameter certainty (inverse of covariance trace)
   *
   * @version 2.4.6 - Threshold increased from 400 to 500 to show learning progress from initialization
   */
  private calculateConfidence(): number {
    // Component 1: Sample count coverage
    const sampleCoverage = Math.min(this.sampleCount / this.minSamplesForConfidence, 1.0);

    // Component 2: Parameter certainty (lower covariance = higher certainty)
    // Trace range: 400 (init) → 100 (converged) → 10-50 (fully learned)
    // Threshold 500 allows showing confidence from initialization onwards
    const trace = this.P.reduce((sum, row, i) => sum + row[i], 0);
    const covarianceConfidence = Math.max(0, 1 - trace / 500);

    // Combined confidence
    return sampleCoverage * covarianceConfidence * 100;
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
      this.logger('   Using DEFAULT state instead (sample count preserved for diagnostics)');

      // Keep sample count for diagnostics, but reset parameters to defaults
      this.sampleCount = state.sampleCount || 0;
      // theta and P already initialized with defaults in constructor
      this.logger(`   ✅ State restore prevented corruption (kept ${this.sampleCount} sample count)`);
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
