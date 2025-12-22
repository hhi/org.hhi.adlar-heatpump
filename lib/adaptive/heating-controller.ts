/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */

/**
 * HeatingController - PI (Proportional-Integral) Temperature Control
 *
 * Maintains stable indoor temperature (±0.3°C) using PI control algorithm.
 * Designed for external adaptive control - does NOT modify device class.
 *
 * Key Features:
 * - Deadband tolerance (0.3°C default) prevents oscillation
 * - Safety clamp (±3°C max adjustment per cycle)
 * - 24-point error history (2 hours at 5-minute intervals)
 * - Persistence support via error history restoration
 *
 * @version 1.0.0 (Fase 1 MVP)
 */

export interface PIControllerConfig {
  logger?: (message: string, ...args: unknown[]) => void;
  Kp?: number; // Proportional gain (default: 3.0)
  Ki?: number; // Integral gain (default: 1.5)
  deadband?: number; // Temperature tolerance in °C (default: 0.3)
}

export interface SensorData {
  indoorTemp: number;
  targetTemp: number;
  timestamp: number;
}

export interface ControllerAction {
  temperatureAdjustment: number; // °C change to apply
  reason: string; // Human-readable explanation
  priority: 'low' | 'medium' | 'high';
  controller: 'heating';
}

export interface PIControllerStatus {
  Kp: number;
  Ki: number;
  deadband: number;
  historySize: number;
  currentError: number;
  averageError: number;
  maxHistorySize: number;
}

export class HeatingController {
  private logger: (message: string, ...args: unknown[]) => void;
  private Kp: number;
  private Ki: number;
  private deadband: number;
  private errorHistory: number[] = [];
  private readonly maxHistorySize = 24; // 2 hours at 5-minute intervals

  /**
   * @param config.logger - Logger callback (uses Homey logging system)
   * @param config.Kp - Proportional gain (default: 3.0)
   * @param config.Ki - Integral gain (default: 1.5)
   * @param config.deadband - Deadband in °C (default: 0.3)
   */
  constructor(config: PIControllerConfig = {}) {
    this.logger = config.logger || (() => {});
    this.Kp = config.Kp ?? 3.0;
    this.Ki = config.Ki ?? 1.5;
    this.deadband = config.deadband ?? 0.3;

    this.logger('HeatingController: Initialized', {
      Kp: this.Kp,
      Ki: this.Ki,
      deadband: this.deadband,
    });
  }

  /**
   * Calculate temperature adjustment using PI control algorithm
   *
   * @param data - Current sensor readings
   * @returns ControllerAction if adjustment needed, null if within deadband
   */
  async calculateAction(data: SensorData): Promise<ControllerAction | null> {
    const error = data.targetTemp - data.indoorTemp;

    this.logger('HeatingController: Calculating action', {
      targetTemp: data.targetTemp,
      indoorTemp: data.indoorTemp,
      error: error.toFixed(2),
    });

    // No action if within deadband
    if (Math.abs(error) < this.deadband) {
      this.logger('HeatingController: Within deadband, no action needed');
      return null;
    }

    // Add error to history for integral term
    this.errorHistory.push(error);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // Calculate PI terms
    const pTerm = this.Kp * error;
    const avgError = this.errorHistory.reduce((sum, e) => sum + e, 0) / this.errorHistory.length;
    const iTerm = this.Ki * avgError;

    // Total adjustment
    const adjustment = pTerm + iTerm;

    // Safety clamp: ±3°C maximum per cycle
    const clampedAdjustment = Math.max(-3, Math.min(3, adjustment));

    this.logger('HeatingController: PI calculation', {
      pTerm: pTerm.toFixed(2),
      iTerm: iTerm.toFixed(2),
      adjustment: adjustment.toFixed(2),
      clamped: clampedAdjustment.toFixed(2),
      historySize: this.errorHistory.length,
    });

    // Only return action if adjustment is significant (≥ 0.1°C)
    if (Math.abs(clampedAdjustment) < 0.1) {
      this.logger('HeatingController: Adjustment too small (<0.1°C), no action');
      return null;
    }

    // Determine priority based on error magnitude
    let priority: 'low' | 'medium' | 'high' = 'medium';
    if (Math.abs(error) > 2.0) {
      priority = 'high';
    } else if (Math.abs(error) < 0.5) {
      priority = 'low';
    }

    return {
      temperatureAdjustment: clampedAdjustment,
      reason: `PI Control: Error=${error.toFixed(1)}°C, P=${pTerm.toFixed(1)}°C, I=${iTerm.toFixed(1)}°C`,
      priority,
      controller: 'heating',
    };
  }

  /**
   * Update PI controller parameters (Expert Mode)
   *
   * @param Kp - Proportional gain (0.1 - 10.0)
   * @param Ki - Integral gain (0.1 - 10.0)
   * @param deadband - Deadband in °C (0.1 - 2.0)
   */
  updateParameters(Kp: number, Ki: number, deadband: number): void {
    // Validate ranges
    if (Kp < 0.1 || Kp > 10.0) {
      throw new Error(`Invalid Kp: ${Kp} (must be 0.1-10.0)`);
    }
    if (Ki < 0.1 || Ki > 10.0) {
      throw new Error(`Invalid Ki: ${Ki} (must be 0.1-10.0)`);
    }
    if (deadband < 0.1 || deadband > 2.0) {
      throw new Error(`Invalid deadband: ${deadband} (must be 0.1-2.0)`);
    }

    this.Kp = Kp;
    this.Ki = Ki;
    this.deadband = deadband;

    this.logger('HeatingController: Parameters updated', { Kp, Ki, deadband });
  }

  /**
   * Reset error history (useful after mode changes or long idle periods)
   */
  resetHistory(): void {
    this.errorHistory = [];
    this.logger('HeatingController: Error history reset');
  }

  /**
   * Get current PI controller status
   */
  getStatus(): PIControllerStatus {
    const currentError = this.errorHistory.length > 0
      ? this.errorHistory[this.errorHistory.length - 1]
      : 0;

    const averageError = this.errorHistory.length > 0
      ? this.errorHistory.reduce((sum, e) => sum + e, 0) / this.errorHistory.length
      : 0;

    return {
      Kp: this.Kp,
      Ki: this.Ki,
      deadband: this.deadband,
      historySize: this.errorHistory.length,
      currentError,
      averageError,
      maxHistorySize: this.maxHistorySize,
    };
  }

  /**
   * Get error history for persistence
   */
  getErrorHistory(): number[] {
    return [...this.errorHistory]; // Return copy
  }

  /**
   * Restore error history from device store
   *
   * @param history - Previously saved error history
   */
  restoreHistory(history: number[]): void {
    if (!Array.isArray(history)) {
      this.logger('HeatingController: Invalid history format, ignoring');
      return;
    }

    // Limit to max history size
    this.errorHistory = history.slice(-this.maxHistorySize);

    this.logger('HeatingController: History restored', {
      points: this.errorHistory.length,
    });
  }

  /**
   * Destroy controller and clean up resources
   */
  destroy(): void {
    this.errorHistory = [];
    this.logger('HeatingController: Destroyed');
  }
}
