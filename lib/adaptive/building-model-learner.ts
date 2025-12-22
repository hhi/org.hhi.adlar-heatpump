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
 * @version 1.4.0
 * @since 1.4.0
 */

export interface BuildingModelConfig {
  forgettingFactor: number; // 0.995-0.999 = adapt to seasonal changes
  initialCovariance: number; // 100 = high initial uncertainty
  minSamplesForConfidence: number; // 288 = 24 hours @ 5min intervals
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

  constructor(config: BuildingModelConfig) {
    // Initialize with reasonable default parameters
    // Assumptions:
    // - C = 15 kWh/°C (typical residential thermal mass)
    // - UA = 0.3 kW/°C (typical heat loss coefficient)
    // - g = 0.5 (moderate solar gain)
    // - P_int = 0.3 kW (typical internal gains from appliances, people)
    this.theta = [
      1 / 15, // 1/C
      0.3 / 15, // UA/C
      0.5 / 15, // g/C
      0.3 / 15, // P_int/C
    ];

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

    // Build input vector X = [pHeating, (tIn - tOut), Solar, 1]
    const X = [
      data.pHeating, // Heating power (kW)
      data.tIndoor - data.tOutdoor, // Temperature difference (°C)
      data.solarRadiation || 0, // Solar radiation (W/m²)
      1, // Constant term (for pInt)
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
   */
  private calculateConfidence(): number {
    // Component 1: Sample count coverage
    const sampleCoverage = Math.min(this.sampleCount / this.minSamplesForConfidence, 1.0);

    // Component 2: Parameter certainty (lower covariance = higher certainty)
    const trace = this.P.reduce((sum, row, i) => sum + row[i], 0);
    const covarianceConfidence = Math.max(0, 1 - trace / 400);

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
  }): void {
    this.theta = state.theta;
    this.P = state.P;
    this.sampleCount = state.sampleCount;
    this.lastMeasurement = state.lastMeasurement;
    this.logger(`BuildingModelLearner: Restored state with ${this.sampleCount} samples`);
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
