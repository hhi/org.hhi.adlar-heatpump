/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */

/**
 * Single COP data point for rolling calculations
 */
export interface COPDataPoint {
  timestamp: number; // Unix timestamp
  cop: number; // Calculated COP value
  method: string; // Calculation method used
  confidence: 'high' | 'medium' | 'low'; // Data confidence level
  electricalPower?: number; // Power consumption (Watts)
  thermalOutput?: number; // Heat output (Watts)
  ambientTemperature?: number; // Ambient temperature (°C)
  compressorRuntime?: number; // Minutes compressor was running
  isIdlePeriod?: boolean; // Flag indicating this represents an idle period
}

/**
 * Rolling COP calculation result
 */
export interface RollingCOPResult {
  averageCOP: number;
  dataPoints: number;
  timeSpan: number; // Minutes
  confidenceLevel: 'high' | 'medium' | 'low';
  trend: 'improving' | 'stable' | 'degrading';
  trendStrength: number; // 0-1, how strong the trend is
  lastUpdated: number; // Unix timestamp
  calculationDetails: {
    weightedAverage: number;
    simpleAverage: number;
    runtimeWeighted: number;
    thermalWeighted: number;
    excludedOutliers: number;
  };
}

/**
 * Configuration for rolling COP calculations
 */
export interface RollingCOPConfig {
  timeWindow: number; // Minutes to include in rolling calculation
  minDataPoints: number; // Minimum points required for valid calculation
  outlierThreshold: number; // Standard deviations for outlier detection
  weightingMethod: 'simple' | 'time_weighted' | 'runtime_weighted' | 'thermal_weighted';
  trendSensitivity: number; // 0-1, sensitivity for trend detection
  confidenceThresholds: {
    high: number; // Minimum percentage of high-confidence data points
    medium: number; // Minimum percentage of medium+ confidence data points
  };
  logger?: (message: string, ...args: unknown[]) => void; // Optional logger function
}

/**
 * Rolling COP Calculator - manages time-series COP data and calculations
 */
export class RollingCOPCalculator {
  private dataPoints: COPDataPoint[] = [];
  private readonly maxDataPoints: number;
  private readonly config: RollingCOPConfig;
  private logger: (message: string, ...args: unknown[]) => void;

  constructor(config: Partial<RollingCOPConfig> = {}) {
    // Default configuration
    this.config = {
      timeWindow: 24 * 60, // 24 hours in minutes
      minDataPoints: 12, // At least 12 data points (6 hours with 30min interval)
      outlierThreshold: 2.5, // 2.5 standard deviations
      weightingMethod: 'runtime_weighted',
      trendSensitivity: 0.15, // 15% change threshold for trend detection
      confidenceThresholds: {
        high: 0.6, // 60% high-confidence data for high overall confidence
        medium: 0.8, // 80% medium+ confidence data for medium overall confidence
      },
      ...config,
    };

    // Initialize logger (fallback to no-op if not provided)
    this.logger = this.config.logger || (() => {});

    // Calculate max data points to store (with some buffer)
    this.maxDataPoints = Math.ceil((this.config.timeWindow * 1.5) / 30); // Assume 30min intervals
  }

  /**
   * Add a new COP data point to the rolling calculation
   */
  public addDataPoint(dataPoint: COPDataPoint): void {
    // Add timestamp if not provided
    if (!dataPoint.timestamp) {
      dataPoint.timestamp = Date.now();
    }

    // Add to array
    this.dataPoints.push(dataPoint);

    // Sort by timestamp (newest first)
    this.dataPoints.sort((a, b) => b.timestamp - a.timestamp);

    // Limit array size to prevent memory issues
    if (this.dataPoints.length > this.maxDataPoints) {
      this.dataPoints = this.dataPoints.slice(0, this.maxDataPoints);
    }

    // Clean old data points outside time window
    this.cleanOldDataPoints();
  }

  /**
   * Calculate rolling COP for the configured time window
   */
  public calculateRollingCOP(timeWindow?: number): RollingCOPResult | null {
    const window = timeWindow || this.config.timeWindow;
    const cutoffTime = Date.now() - (window * 60 * 1000); // Convert minutes to milliseconds

    // Get data points within time window
    const windowData = this.dataPoints.filter((point) => point.timestamp >= cutoffTime);

    // Check if we have enough data points
    if (windowData.length < this.config.minDataPoints) {
      return null;
    }

    // Remove outliers
    const { validData, excludedCount } = this.removeOutliers(windowData);

    if (validData.length < this.config.minDataPoints) {
      return null;
    }

    // Calculate various averages
    const simpleAverage = this.calculateSimpleAverage(validData);
    const weightedAverage = this.calculateWeightedAverage(validData);
    const runtimeWeighted = this.calculateRuntimeWeightedAverage(validData);
    const thermalWeighted = this.calculateThermalWeightedAverage(validData);

    // Choose primary average based on weighting method
    let primaryAverage: number;
    switch (this.config.weightingMethod) {
      case 'time_weighted':
        primaryAverage = weightedAverage;
        break;
      case 'runtime_weighted':
        primaryAverage = runtimeWeighted || weightedAverage;
        break;
      case 'thermal_weighted':
        primaryAverage = thermalWeighted || weightedAverage;
        break;
      default:
        primaryAverage = simpleAverage;
    }

    // Calculate trend
    const { trend, trendStrength } = this.calculateTrend(validData);

    // Determine overall confidence level
    const confidenceLevel = this.calculateConfidenceLevel(validData);

    return {
      averageCOP: Number(primaryAverage.toFixed(2)),
      dataPoints: validData.length,
      timeSpan: Math.round(window),
      confidenceLevel,
      trend,
      trendStrength: Number(trendStrength.toFixed(3)),
      lastUpdated: Date.now(),
      calculationDetails: {
        weightedAverage: Number(weightedAverage.toFixed(2)),
        simpleAverage: Number(simpleAverage.toFixed(2)),
        runtimeWeighted: Number((runtimeWeighted || 0).toFixed(2)),
        thermalWeighted: Number((thermalWeighted || 0).toFixed(2)),
        excludedOutliers: excludedCount,
      },
    };
  }

  /**
   * Get daily COP (24-hour rolling average)
   */
  public getDailyCOP(): RollingCOPResult | null {
    return this.calculateRollingCOP(24 * 60); // 24 hours
  }

  /**
   * Get daily COP with idle period awareness
   * Returns null if system has been mostly idle, adjusted COP if partially idle
   */
  public getDailyCOPWithIdleAwareness(): RollingCOPResult | null {
    const result = this.calculateRollingCOP(24 * 60);
    if (!result) return null;

    // Get data points in the 24-hour window
    const windowData = this.getDataPointsInWindow(24 * 60);

    // Calculate idle characteristics
    const idlePoints = windowData.filter((p) => p.isIdlePeriod === true || (p.cop === 0 && p.method === 'idle_period')).length;
    const idleRatio = windowData.length > 0 ? idlePoints / windowData.length : 0;

    // Check for data freshness - if newest data point is > 4 hours old, consider stale
    const newestDataPoint = windowData.length > 0 ? Math.max(...windowData.map((p) => p.timestamp)) : 0;
    const dataAge = (Date.now() - newestDataPoint) / (1000 * 60 * 60); // Hours
    const isStaleData = dataAge > 4; // More than 4 hours old

    // Return null (no meaningful COP) if:
    // 1. More than 70% of window is idle periods, or
    // 2. Data is stale (> 4 hours old), or
    // 3. Very few data points suggesting limited operation
    if (idleRatio > 0.7 || isStaleData || windowData.length < 6) {
      return null;
    }

    // If 30-70% idle, adjust the COP downward to reflect reduced operation
    if (idleRatio > 0.3) {
      const adjustmentFactor = 1 - (idleRatio * 0.5); // Reduce by up to 50%
      result.averageCOP = Number((result.averageCOP * adjustmentFactor).toFixed(2));
      result.confidenceLevel = 'medium'; // Lower confidence for mixed operation

      // Update calculation details to show adjustment
      result.calculationDetails.weightedAverage = Number((result.calculationDetails.weightedAverage * adjustmentFactor).toFixed(2));
      result.calculationDetails.excludedOutliers += idlePoints;
    }

    return result;
  }

  /**
   * Get hourly COP (60-minute rolling average)
   */
  public getHourlyCOP(): RollingCOPResult | null {
    return this.calculateRollingCOP(60); // 1 hour
  }

  /**
   * Get weekly COP (7-day rolling average)
   */
  public getWeeklyCOP(): RollingCOPResult | null {
    return this.calculateRollingCOP(7 * 24 * 60); // 7 days
  }

  /**
   * Get monthly COP (30-day rolling average)
   */
  public getMonthlyCOP(): RollingCOPResult | null {
    return this.calculateRollingCOP(30 * 24 * 60); // 30 days
  }

  /**
   * Get trend analysis for a specific time period
   */
  public getTrendAnalysis(hours: number = 24): { trend: string; strength: number; trendKey: string } | null {
    const result = this.calculateRollingCOP(hours * 60);
    if (!result) return null;

    let trendKey: string;
    const strength = result.trendStrength;

    if (result.trend === 'improving') {
      if (strength > 0.3) trendKey = 'strong_improvement';
      else if (strength > 0.15) trendKey = 'moderate_improvement';
      else trendKey = 'slight_improvement';
    } else if (result.trend === 'degrading') {
      if (strength > 0.3) trendKey = 'significant_decline';
      else if (strength > 0.15) trendKey = 'moderate_decline';
      else trendKey = 'slight_decline';
    } else {
      trendKey = 'stable';
    }

    return {
      trend: result.trend,
      strength,
      trendKey, // Return the translation key instead of translated text
    };
  }

  /**
   * Get data points within a specific time window (in minutes)
   */
  public getDataPointsInWindow(timeWindow: number): COPDataPoint[] {
    const cutoffTime = Date.now() - (timeWindow * 60 * 1000); // Convert minutes to milliseconds
    return this.dataPoints.filter((point) => point.timestamp >= cutoffTime);
  }

  /**
   * Export data for persistence (e.g., to device settings)
   */
  public exportData(): { dataPoints: COPDataPoint[]; config: RollingCOPConfig } {
    return {
      dataPoints: this.dataPoints,
      config: this.config,
    };
  }

  /**
   * Import data from persistence
   */
  public importData(data: { dataPoints: COPDataPoint[]; config?: Partial<RollingCOPConfig> }): void {
    this.dataPoints = data.dataPoints || [];
    if (data.config) {
      Object.assign(this.config, data.config);
    }
    this.cleanOldDataPoints();
  }

  /**
   * Get diagnostic information about the rolling COP data
   */
  public getDiagnosticInfo(): {
    totalDataPoints: number;
    dataPointsInWindow: number;
    oldestDataPoint: number;
    newestDataPoint: number;
    averageInterval: number;
    confidenceDistribution: Record<string, number>;
    idleRatio: number;
    dataFreshness: number; // Hours since newest data point
    } {
    const now = Date.now();
    const windowData = this.getDataPointsInWindow(this.config.timeWindow);

    // Calculate average interval between data points
    let totalInterval = 0;
    if (windowData.length > 1) {
      const sortedData = [...windowData].sort((a, b) => a.timestamp - b.timestamp);
      for (let i = 1; i < sortedData.length; i++) {
        totalInterval = totalInterval + sortedData[i].timestamp - sortedData[i - 1].timestamp;
      }
    }
    const averageInterval = windowData.length > 1 ? totalInterval / (windowData.length - 1) / (1000 * 60) : 0; // Minutes

    // Calculate confidence distribution
    const confidenceDistribution: Record<string, number> = { high: 0, medium: 0, low: 0 };
    windowData.forEach((point) => {
      confidenceDistribution[point.confidence] = (confidenceDistribution[point.confidence] || 0) + 1;
    });

    // Calculate idle ratio
    const idlePoints = windowData.filter((p) => p.isIdlePeriod === true || (p.cop === 0 && p.method === 'idle_period')).length;
    const idleRatio = windowData.length > 0 ? idlePoints / windowData.length : 0;

    // Calculate data freshness
    const newestDataPoint = windowData.length > 0 ? Math.max(...windowData.map((p) => p.timestamp)) : 0;
    const dataFreshness = newestDataPoint > 0 ? (now - newestDataPoint) / (1000 * 60 * 60) : 999; // Hours

    return {
      totalDataPoints: this.dataPoints.length,
      dataPointsInWindow: windowData.length,
      oldestDataPoint: windowData.length > 0 ? Math.min(...windowData.map((p) => p.timestamp)) : 0,
      newestDataPoint,
      averageInterval: Number(averageInterval.toFixed(1)),
      confidenceDistribution,
      idleRatio: Number(idleRatio.toFixed(3)),
      dataFreshness: Number(dataFreshness.toFixed(1)),
    };
  }

  /**
   * Private method to remove old data points outside time window
   */
  private cleanOldDataPoints(): void {
    const cutoffTime = Date.now() - (this.config.timeWindow * 2 * 60 * 1000); // Keep 2x window for analysis
    this.dataPoints = this.dataPoints.filter((point) => point.timestamp >= cutoffTime);
  }

  /**
   * Private method to remove statistical outliers
   */
  private removeOutliers(data: COPDataPoint[]): { validData: COPDataPoint[]; excludedCount: number } {
    if (data.length < 3) return { validData: data, excludedCount: 0 };

    const copValues = data.map((point) => point.cop);
    const mean = copValues.reduce((sum, val) => sum + val, 0) / copValues.length;
    const stdDev = Math.sqrt(copValues.reduce((sum, val) => sum + (val - mean) ** 2, 0) / copValues.length);

    const threshold = this.config.outlierThreshold * stdDev;
    const validData = data.filter((point) => Math.abs(point.cop - mean) <= threshold);

    return {
      validData,
      excludedCount: data.length - validData.length,
    };
  }

  /**
   * Private method to calculate simple average
   */
  private calculateSimpleAverage(data: COPDataPoint[]): number {
    return data.reduce((sum, point) => sum + point.cop, 0) / data.length;
  }

  /**
   * Private method to calculate time-weighted average (newer data has higher weight)
   */
  private calculateWeightedAverage(data: COPDataPoint[]): number {
    const now = Date.now();
    let weightedSum = 0;
    let totalWeight = 0;

    data.forEach((point) => {
      const age = (now - point.timestamp) / (1000 * 60 * 60); // Hours
      const weight = Math.exp(-age / 12); // Exponential decay, half-life of 12 hours
      weightedSum += point.cop * weight;
      totalWeight += weight;
    });

    return weightedSum / totalWeight;
  }

  /**
   * Private method to calculate runtime-weighted average
   */
  private calculateRuntimeWeightedAverage(data: COPDataPoint[]): number | null {
    const dataWithRuntime = data.filter((point) => point.compressorRuntime !== undefined);
    if (dataWithRuntime.length === 0) return null;

    let weightedSum = 0;
    let totalWeight = 0;

    dataWithRuntime.forEach((point) => {
      const weight = point.compressorRuntime || 1;
      weightedSum += point.cop * weight;
      totalWeight += weight;
    });

    return weightedSum / totalWeight;
  }

  /**
   * Private method to calculate thermal output weighted average
   */
  private calculateThermalWeightedAverage(data: COPDataPoint[]): number | null {
    const dataWithThermal = data.filter((point) => point.thermalOutput !== undefined && point.thermalOutput > 0);
    if (dataWithThermal.length === 0) return null;

    let weightedSum = 0;
    let totalWeight = 0;

    dataWithThermal.forEach((point) => {
      const weight = point.thermalOutput || 1;
      weightedSum += point.cop * weight;
      totalWeight += weight;
    });

    return weightedSum / totalWeight;
  }

  /**
   * Private method to calculate trend direction and strength
   */
  private calculateTrend(data: COPDataPoint[]): { trend: 'improving' | 'stable' | 'degrading'; trendStrength: number } {
    if (data.length < 6) {
      return { trend: 'stable', trendStrength: 0 };
    }

    // Sort by timestamp (oldest first for trend calculation)
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);

    // Split into first and last third for comparison
    const thirdSize = Math.floor(sortedData.length / 3);
    const firstThird = sortedData.slice(0, thirdSize);
    const lastThird = sortedData.slice(-thirdSize);

    const firstAvg = firstThird.reduce((sum, point) => sum + point.cop, 0) / firstThird.length;
    const lastAvg = lastThird.reduce((sum, point) => sum + point.cop, 0) / lastThird.length;

    const changePercent = (lastAvg - firstAvg) / firstAvg;
    const strength = Math.abs(changePercent);

    let trend: 'improving' | 'stable' | 'degrading';
    if (changePercent > this.config.trendSensitivity) {
      trend = 'improving';
    } else if (changePercent < -this.config.trendSensitivity) {
      trend = 'degrading';
    } else {
      trend = 'stable';
    }

    return { trend, trendStrength: strength };
  }

  /**
   * Private method to calculate overall confidence level
   */
  private calculateConfidenceLevel(data: COPDataPoint[]): 'high' | 'medium' | 'low' {
    const highConfidenceCount = data.filter((point) => point.confidence === 'high').length;
    const mediumPlusCount = data.filter((point) => point.confidence === 'high' || point.confidence === 'medium').length;

    const highRatio = highConfidenceCount / data.length;
    const mediumPlusRatio = mediumPlusCount / data.length;

    if (highRatio >= this.config.confidenceThresholds.high) {
      return 'high';
    }
    if (mediumPlusRatio >= this.config.confidenceThresholds.medium) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Cleanup method to release memory and prevent leaks
   * Clears all accumulated data points
   */
  public destroy(): void {
    // Log buffer size before clearing (v1.0.2 - diagnostics)
    const bufferSize = this.dataPoints.length;
    const estimatedMemoryMB = (bufferSize * 200) / (1024 * 1024); // ~200 bytes per data point

    // Clear the circular buffer containing all COP data points
    // This releases ~10-20 MB (1440 data points × ~200 bytes each)
    this.dataPoints = [];

    // Log for debugging memory management
    this.logger(`RollingCOPCalculator: Destroyed - cleared ${bufferSize} data points (~${estimatedMemoryMB.toFixed(1)} MB)`);
  }
}
