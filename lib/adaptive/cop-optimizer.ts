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
  onDiagnosticsUpdate?: (diagnosticsJson: string) => Promise<void>; // v2.6.1: callback for diagnostics capability
}

export interface COPAction {
  action: 'increase' | 'decrease' | 'maintain';
  magnitude: number; // °C adjustment to supply temp
  priority: 'low' | 'medium-low' | 'medium' | 'medium-high' | 'high';
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
    this.logger = config.logger || (() => { });
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

    // v2.6.1: Update diagnostics capability periodically (every 10 samples)
    if (this.history.length % 10 === 0 && this.config.onDiagnosticsUpdate) {
      this.updateDiagnosticsCapability().catch((error) => {
        this.logger(`COPOptimizer: Failed to update diagnostics capability: ${error}`);
      });
    }
  }

  /**
   * Update cop_optimizer_diagnostics capability with current diagnostic data (v2.6.1)
   */
  private async updateDiagnosticsCapability(): Promise<void> {
    if (!this.config.onDiagnosticsUpdate) {
      return;
    }

    const diagnostics = this.getDiagnostics();
    const diagnosticsJson = JSON.stringify({
      samples: diagnostics.samplesCollected,
      capacity: diagnostics.historyCapacity,
      fillPercent: diagnostics.fillPercentage,
      bucketsLearned: diagnostics.bucketsLearned,
      buckets: diagnostics.bucketDetails.map((b) => ({
        temp: b.outdoorTemp,
        optimal: b.optimalSupplyTemp,
        count: b.sampleCount,
        conf: b.confidence,
      })),
      config: diagnostics.configuration,
      timestamp: new Date().toISOString(),
    });

    await this.config.onDiagnosticsUpdate(diagnosticsJson);
    this.logger('COPOptimizer: 📊 Diagnostics capability updated');
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
      // Calculate normalized position within medium zone (0 = at minimum, 1 = at target)
      const range = this.config.targetCOP - this.config.minAcceptableCOP;
      const position = (currentCOP - this.config.minAcceptableCOP) / range;

      // Determine sub-priority: closer to minimum = higher priority
      let subPriority: 'medium-high' | 'medium' | 'medium-low';
      if (position < 0.33) {
        subPriority = 'medium-high';
      } else if (position < 0.67) {
        subPriority = 'medium';
      } else {
        subPriority = 'medium-low';
      }

      const optimalSupply = this.getOptimalSupplyTemp(outdoorTemp);

      // Lower threshold for higher sub-priority (medium-high: 2°C, medium: 2.5°C, medium-low: 3°C)
      const thresholdMap: Record<'medium-high' | 'medium' | 'medium-low', number> = {
        'medium-high': 2,
        'medium': 2.5,
        'medium-low': 3,
      };
      const threshold = thresholdMap[subPriority];

      if (optimalSupply && Math.abs(currentSupplyTemp - optimalSupply) > threshold) {
        const adjustment = this.calculateAdjustment(currentSupplyTemp, optimalSupply, this.config.strategy);

        return {
          action: adjustment > 0 ? 'increase' : 'decrease',
          magnitude: Math.abs(adjustment),
          priority: subPriority,
          reason:
            `COP ${currentCOP.toFixed(1)} below target ${this.config.targetCOP} (priority: ${subPriority}). `
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
   * Estimate COP at a given outdoor temperature using learned data.
   *
   * Three-layer lookup strategy:
   * 1. Exact bucket match (2°C buckets, ≥5 samples)
   * 2. Linear interpolation between two nearest known buckets
   * 3. Linear extrapolation from the two nearest edge buckets
   *
   * Returns null if fewer than 2 learned buckets exist (insufficient data).
   *
   * @param outdoorTemp - Outdoor temperature to estimate COP for
   * @returns Estimated COP or null if not enough learned data
   */
  public getEstimatedCopAtTemp(outdoorTemp: number): number | null {
    // Build average COP per bucket from history
    const bucketCop = this.getAverageCopPerBucket();
    if (bucketCop.size === 0) return null;

    const queryBucket = Math.round(outdoorTemp / 2) * 2;

    // Layer 1: Exact bucket match
    if (bucketCop.has(queryBucket)) {
      return bucketCop.get(queryBucket)!;
    }

    // Sort known buckets for interpolation/extrapolation
    const sortedBuckets = Array.from(bucketCop.entries())
      .sort((a, b) => a[0] - b[0]);

    if (sortedBuckets.length < 2) {
      // Only one bucket: return its COP as best guess
      return sortedBuckets[0][1];
    }

    // Layer 2: Interpolation — find two buckets that surround the query
    let lower: [number, number] | null = null;
    let upper: [number, number] | null = null;

    for (const entry of sortedBuckets) {
      if (entry[0] <= queryBucket) lower = entry;
      if (entry[0] >= queryBucket && !upper) upper = entry;
    }

    if (lower && upper && lower[0] !== upper[0]) {
      // Linear interpolation between two surrounding buckets
      const fraction = (outdoorTemp - lower[0]) / (upper[0] - lower[0]);
      return lower[1] + fraction * (upper[1] - lower[1]);
    }

    // Layer 3: Extrapolation — query is outside known range
    if (outdoorTemp < sortedBuckets[0][0]) {
      // Below lowest bucket: extrapolate from two lowest
      const [t1, cop1] = sortedBuckets[0];
      const [t2, cop2] = sortedBuckets[1];
      const slope = (cop2 - cop1) / (t2 - t1);
      return cop1 + slope * (outdoorTemp - t1);
    }

    // Above highest bucket: extrapolate from two highest
    const [tA, copA] = sortedBuckets[sortedBuckets.length - 2];
    const [tB, copB] = sortedBuckets[sortedBuckets.length - 1];
    const slope = (copB - copA) / (tB - tA);
    return copB + slope * (outdoorTemp - tB);
  }

  /**
   * Get average COP per outdoor temperature bucket (2°C buckets, ≥5 samples)
   */
  private getAverageCopPerBucket(): Map<number, number> {
    const grouped = new Map<number, number[]>();

    this.history.forEach((point) => {
      const bucket = Math.round(point.outdoorTemp / 2) * 2;
      if (!grouped.has(bucket)) {
        grouped.set(bucket, []);
      }
      grouped.get(bucket)!.push(point.cop);
    });

    const result = new Map<number, number>();
    grouped.forEach((cops, bucket) => {
      if (cops.length >= 5) { // Same threshold as updateOptimalSettings
        result.set(bucket, cops.reduce((a, b) => a + b, 0) / cops.length);
      }
    });

    return result;
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

  /**
   * Get diagnostic statistics for monitoring and debugging
   *
   * Returns detailed statistics about the optimizer's learning status,
   * including sample counts, bucket distribution, and confidence levels.
   *
   * @returns Diagnostic statistics object
   */
  public getDiagnostics(): {
    samplesCollected: number;
    historyCapacity: number;
    fillPercentage: number;
    bucketsLearned: number;
    bucketDetails: Array<{
      outdoorTemp: number;
      optimalSupplyTemp: number;
      sampleCount: number;
      confidence: 'low' | 'medium' | 'high';
    }>;
    configuration: {
      minAcceptableCOP: number;
      targetCOP: number;
      strategy: string;
      tempRange: string;
    };
  } {
    // Calculate samples per bucket for confidence assessment
    const bucketSamples = new Map<number, number>();
    this.history.forEach((point) => {
      const bucket = Math.round(point.outdoorTemp / 2) * 2;
      bucketSamples.set(bucket, (bucketSamples.get(bucket) || 0) + 1);
    });

    // Build detailed bucket information
    const bucketDetails = Array.from(this.optimalSettings.entries())
      .map(([outdoorTemp, optimalSupply]) => {
        const sampleCount = bucketSamples.get(outdoorTemp) || 0;
        let confidence: 'low' | 'medium' | 'high';

        if (sampleCount < 10) {
          confidence = 'low';
        } else if (sampleCount < 30) {
          confidence = 'medium';
        } else {
          confidence = 'high';
        }

        return {
          outdoorTemp,
          optimalSupplyTemp: optimalSupply,
          sampleCount,
          confidence,
        };
      })
      .sort((a, b) => a.outdoorTemp - b.outdoorTemp); // Sort by outdoor temp

    return {
      samplesCollected: this.history.length,
      historyCapacity: this.config.historySize,
      fillPercentage: Math.round((this.history.length / this.config.historySize) * 100),
      bucketsLearned: this.optimalSettings.size,
      bucketDetails,
      configuration: {
        minAcceptableCOP: this.config.minAcceptableCOP,
        targetCOP: this.config.targetCOP,
        strategy: this.config.strategy,
        tempRange: `${this.config.minSupplyTemp}-${this.config.maxSupplyTemp}°C`,
      },
    };
  }

  /**
   * Log detailed diagnostic status (for flow action)
   *
   * Outputs comprehensive diagnostic information to logs for troubleshooting
   * and monitoring the COP optimizer's learning progress.
   */
  public logDiagnosticStatus(): void {
    const diag = this.getDiagnostics();

    this.logger('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger('🔍 COP Optimizer Diagnostic Report');
    this.logger('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger('');
    this.logger('📊 Data Collection Status:');
    this.logger(`  • Total samples: ${diag.samplesCollected}`);
    this.logger(`  • History capacity: ${diag.historyCapacity} samples`);
    this.logger(`  • Fill level: ${diag.fillPercentage}%`);
    this.logger('');
    this.logger('📈 Learning Status:');
    this.logger(`  • Outdoor temp buckets learned: ${diag.bucketsLearned}`);

    if (diag.bucketDetails.length === 0) {
      this.logger('  • ⚠️ No optimal settings learned yet (need minimum 5 samples per bucket)');
    } else {
      const lowConf = diag.bucketDetails.filter((b) => b.confidence === 'low').length;
      const medConf = diag.bucketDetails.filter((b) => b.confidence === 'medium').length;
      const highConf = diag.bucketDetails.filter((b) => b.confidence === 'high').length;

      this.logger(`  • Low confidence buckets: ${lowConf} (5-9 samples)`);
      this.logger(`  • Medium confidence buckets: ${medConf} (10-29 samples)`);
      this.logger(`  • High confidence buckets: ${highConf} (30+ samples)`);
    }

    this.logger('');
    this.logger('🎯 Optimal Settings Learned:');

    if (diag.bucketDetails.length === 0) {
      this.logger('  • None yet - keep collecting data');
    } else {
      diag.bucketDetails.forEach((bucket) => {
        let confidenceSymbol: string;
        if (bucket.confidence === 'high') {
          confidenceSymbol = '✅';
        } else if (bucket.confidence === 'medium') {
          confidenceSymbol = '⚠️';
        } else {
          confidenceSymbol = '❌';
        }

        this.logger(
          `  • ${bucket.outdoorTemp}°C outdoor → ${bucket.optimalSupplyTemp}°C supply `
          + `(${bucket.sampleCount} samples) ${confidenceSymbol} ${bucket.confidence}`,
        );
      });
    }

    this.logger('');
    this.logger('⚙️ Configuration:');
    this.logger(`  • Min acceptable COP: ${diag.configuration.minAcceptableCOP}`);
    this.logger(`  • Target COP: ${diag.configuration.targetCOP}`);
    this.logger(`  • Strategy: ${diag.configuration.strategy}`);
    this.logger(`  • Temperature range: ${diag.configuration.tempRange}`);
    this.logger('');
    this.logger('💾 Persistence: State is saved after each temperature adjustment');
    this.logger('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * Destroy and release all memory (v2.0.1+)
   *
   * Called during device deletion to prevent memory leaks.
   * Clears the history array and optimal settings map.
   */
  public destroy(): void {
    const historySize = this.history.length;
    const settingsSize = this.optimalSettings.size;

    this.history = [];
    this.optimalSettings.clear();

    this.logger(`COPOptimizer: Destroyed - released ${historySize} data points, ${settingsSize} optimal settings`);
  }
}
