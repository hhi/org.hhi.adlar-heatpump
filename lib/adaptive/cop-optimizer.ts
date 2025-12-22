/**
 * COP Optimizer - Component 4 of Adaptive Control System
 *
 * Optimizes Coefficient of Performance (COP) by learning the relationship
 * between outdoor temperature, supply temperature, and actual COP achieved.
 *
 * Strategy:
 * - Collect COP measurements with outdoor temp and supply temp
 * - Build historical database grouped by outdoor temperature buckets
 * - Find optimal supply temperature for each outdoor temperature
 * - Recommend adjustments to improve COP
 *
 * Uses existing Adlar capabilities:
 * - adlar_cop (real-time COP)
 * - adlar_cop_daily (24-hour average)
 * - adlar_cop_weekly (7-day average)
 * - adlar_cop_monthly (30-day average)
 * - adlar_scop (seasonal COP per EN 14825)
 *
 * @version 1.4.0
 * @since 1.4.0
 */

export interface COPDataPoint {
  timestamp: number;
  outdoorTemp: number;
  supplyTemp: number; // DPS 4 (target_temperature)
  cop: number;
  compressorFreq: number;
}

export interface COPOptimizerConfig {
  minAcceptableCOP: number; // 2.5
  targetCOP: number; // 3.5
  strategy: 'conservative' | 'balanced' | 'aggressive';
  minSupplyTemp: number; // 25°C
  maxSupplyTemp: number; // 55°C
  historySize: number; // 1000 data points
  logger?: (msg: string, ...args: unknown[]) => void;
}

export interface COPAction {
  action: 'increase' | 'decrease' | 'maintain';
  magnitude: number; // °C adjustment to supply temp
  priority: 'low' | 'medium' | 'high';
  reason: string;
  currentCOP: number;
  targetCOP: number;
}

/**
 * COP Optimizer
 *
 * Learns optimal supply temperature settings for different outdoor temperatures
 * to maximize heat pump efficiency.
 */
export class COPOptimizer {
  private config: COPOptimizerConfig;
  private history: COPDataPoint[] = [];
  private logger: (msg: string, ...args: unknown[]) => void;

  // Optimal settings lookup: outdoor temp → optimal supply temp
  private optimalSettings: Map<number, number> = new Map();

  constructor(config: COPOptimizerConfig) {
    this.config = config;
    this.logger = config.logger || (() => {});
  }

  /**
   * Add new COP measurement to history
   */
  public addMeasurement(dataPoint: COPDataPoint): void {
    this.history.push(dataPoint);

    // Keep history size manageable
    if (this.history.length > this.config.historySize) {
      this.history.shift();
    }

    // Update optimal settings lookup
    this.updateOptimalSettings();

    // Log milestone
    if (this.history.length % 100 === 0) {
      this.logger(`COPOptimizer: Collected ${this.history.length} data points`);
    }
  }

  /**
   * Update optimal supply temperature for each outdoor temperature bucket
   *
   * Groups historical data by outdoor temperature (±2°C buckets) and finds
   * the supply temperature that achieved the best average COP in each bucket.
   */
  private updateOptimalSettings(): void {
    // Group by outdoor temperature (rounded to nearest 2°C)
    const grouped = new Map<number, COPDataPoint[]>();

    this.history.forEach((point) => {
      const tempBucket = Math.round(point.outdoorTemp / 2) * 2;
      if (!grouped.has(tempBucket)) {
        grouped.set(tempBucket, []);
      }
      grouped.get(tempBucket)!.push(point);
    });

    // For each temperature bucket, find supply temp with best average COP
    grouped.forEach((points, outdoorTemp) => {
      if (points.length < 5) return; // Need minimum samples

      // Group by supply temp
      const bySupply = new Map<number, number[]>();
      points.forEach((p) => {
        const supplyBucket = Math.round(p.supplyTemp / 2) * 2;
        if (!bySupply.has(supplyBucket)) {
          bySupply.set(supplyBucket, []);
        }
        bySupply.get(supplyBucket)!.push(p.cop);
      });

      // Find supply temp with highest average COP
      let bestSupply = 40; // Default
      let bestCOP = 0;

      bySupply.forEach((cops, supply) => {
        const avgCOP = cops.reduce((a, b) => a + b, 0) / cops.length;
        if (avgCOP > bestCOP) {
          bestCOP = avgCOP;
          bestSupply = supply;
        }
      });

      this.optimalSettings.set(outdoorTemp, bestSupply);
    });
  }

  /**
   * Calculate recommended action based on current COP performance
   */
  public calculateAction(
    currentCOP: number,
    dailyCOP: number,
    outdoorTemp: number,
    currentSupplyTemp: number,
  ): COPAction {
    // Check if COP is below minimum acceptable
    if (currentCOP < this.config.minAcceptableCOP) {
      // COP too low - try to improve
      const optimalSupply = this.getOptimalSupplyTemp(outdoorTemp);

      if (optimalSupply && Math.abs(currentSupplyTemp - optimalSupply) > 2) {
        // Historical data suggests different supply temp is better
        const adjustment = this.calculateAdjustment(currentSupplyTemp, optimalSupply, this.config.strategy);

        return {
          action: adjustment > 0 ? 'increase' : 'decrease',
          magnitude: Math.abs(adjustment),
          priority: 'high',
          reason:
            `COP ${currentCOP.toFixed(1)} below minimum ${this.config.minAcceptableCOP}. `
            + `Historical optimal at ${outdoorTemp}°C is ${optimalSupply}°C supply`,
          currentCOP,
          targetCOP: this.config.targetCOP,
        };
      }

      // No historical data, use heuristic: lower supply = higher COP
      const adjustment = this.config.strategy === 'aggressive' ? -3 : -2;

      return {
        action: 'decrease',
        magnitude: Math.abs(adjustment),
        priority: 'high',
        reason: `COP ${currentCOP.toFixed(1)} below minimum. Reducing supply temp to improve efficiency`,
        currentCOP,
        targetCOP: this.config.targetCOP,
      };
    }

    // COP acceptable but check if we can do better
    if (currentCOP < this.config.targetCOP && dailyCOP < this.config.targetCOP) {
      const optimalSupply = this.getOptimalSupplyTemp(outdoorTemp);

      if (optimalSupply && Math.abs(currentSupplyTemp - optimalSupply) > 3) {
        const adjustment = this.calculateAdjustment(currentSupplyTemp, optimalSupply, this.config.strategy);

        return {
          action: adjustment > 0 ? 'increase' : 'decrease',
          magnitude: Math.abs(adjustment),
          priority: 'medium',
          reason:
            `COP ${currentCOP.toFixed(1)} below target ${this.config.targetCOP}. `
            + 'Optimizing toward historical best',
          currentCOP,
          targetCOP: this.config.targetCOP,
        };
      }
    }

    // COP is good - maintain
    return {
      action: 'maintain',
      magnitude: 0,
      priority: 'low',
      reason: `COP ${currentCOP.toFixed(1)} is acceptable (target: ${this.config.targetCOP})`,
      currentCOP,
      targetCOP: this.config.targetCOP,
    };
  }

  /**
   * Get optimal supply temperature for given outdoor temperature
   */
  private getOptimalSupplyTemp(outdoorTemp: number): number | null {
    const bucket = Math.round(outdoorTemp / 2) * 2;
    return this.optimalSettings.get(bucket) || null;
  }

  /**
   * Calculate adjustment magnitude based on strategy
   */
  private calculateAdjustment(current: number, optimal: number, strategy: string): number {
    const diff = optimal - current;

    switch (strategy) {
      case 'conservative':
        return Math.sign(diff) * Math.min(Math.abs(diff), 1);
      case 'balanced':
        return Math.sign(diff) * Math.min(Math.abs(diff), 2);
      case 'aggressive':
        return Math.sign(diff) * Math.min(Math.abs(diff), 3);
      default:
        return Math.sign(diff) * Math.min(Math.abs(diff), 2);
    }
  }

  /**
   * Get history data points
   */
  public getHistory(): COPDataPoint[] {
    return this.history;
  }

  /**
   * Get optimal settings map
   */
  public getOptimalSettings(): Map<number, number> {
    return this.optimalSettings;
  }

  /**
   * Export state for persistence
   */
  public getState() {
    return {
      history: this.history,
      optimalSettings: Array.from(this.optimalSettings.entries()),
    };
  }

  /**
   * Restore state from persistence
   */
  public restoreState(state: { history: COPDataPoint[]; optimalSettings: [number, number][] }): void {
    this.history = state.history || [];
    this.optimalSettings = new Map(state.optimalSettings || []);
    this.logger(`COPOptimizer: Restored state with ${this.history.length} data points`);
  }
}
