/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import { DeviceConstants } from '../constants';

/**
 * Minimal Homey interface for logging functionality
 */
interface HomeyLogger {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Temperature bin data structure for SCOP calculation
 */
interface TemperatureBin {
  temp: number; // matches usage in line 287
  hours: number;
  weightedCOP: number; // matches usage in line 290
  binName: string; // based on error message
}

/**
 * Quality metrics for SCOP calculation confidence assessment
 */
interface QualityMetrics {
  highQualityHours: number; // matches usage in error
  method3Contribution: number;
  overallQualityScore: number; // matches usage in error
}

/**
 * Individual COP measurement with metadata
 */
export interface COPMeasurement {
  cop: number;
  method: 'direct_thermal' | 'power_module' | 'refrigerant_circuit' | 'carnot_estimation' | 'valve_correlation' | 'temperature_difference';
  timestamp: number;
  ambientTemperature: number;
  loadRatio: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Daily COP summary for SCOP calculation
 */
export interface DailyCOPSummary {
  date: string; // YYYY-MM-DD format
  dayOfYear: number;
  weightedCOP: number;
  totalHours: number;
  methodBreakdown: Record<string, number>; // method -> hours
  qualityScore: number; // 0-1, higher is better
  ambientTempAverage: number;
  measurements: COPMeasurement[];
}

/**
 * SCOP calculation result
 */
export interface SCOPResult {
  scop: number;
  confidence: 'high' | 'medium' | 'low';
  dataQuality: string; // Human readable quality description
  seasonalCoverage: number; // 0-1, percentage of heating season covered
  totalHours: number;
  methodContribution: Record<string, number>; // method -> percentage
  temperatureBins: Array<{
    temp: number;
    hours: number;
    weightedCOP: number;
    binName: string;
  }>;
  qualityMetrics: {
    highQualityHours: number;
    method3Contribution: number;
    overallQualityScore: number;
  };
}

/**
 * SCOP Calculator - implements EN 14825 compliant seasonal calculation
 * with quality weighting to mitigate Method 3 accuracy issues
 */
export class SCOPCalculator {
  private homey: HomeyLogger;
  private dailyData: Map<string, DailyCOPSummary> = new Map();
  private currentSeasonStart: number = 0;

  constructor(homey: HomeyLogger) {
    this.homey = homey;
    this.initializeCurrentSeason();
  }

  /**
   * Initialize current heating season boundaries
   */
  private initializeCurrentSeason(): void {
    const now = new Date();
    const currentYear = now.getFullYear();
    const dayOfYear = this.getDayOfYear(now);

    // Heating season spans Oct 1 - May 15 (crosses year boundary)
    if (dayOfYear >= DeviceConstants.SCOP_SEASON_START_DAY) {
      // Oct-Dec: season starts this year
      this.currentSeasonStart = currentYear;
    } else {
      // Jan-May: season started last year
      this.currentSeasonStart = currentYear - 1;
    }
  }

  /**
   * Add a COP measurement to the seasonal data
   */
  public addCOPMeasurement(measurement: COPMeasurement): void {
    if (!this.isInHeatingSeason(measurement.timestamp)) {
      return; // Ignore measurements outside heating season
    }

    const date = this.getDateString(measurement.timestamp);
    let dailySummary = this.dailyData.get(date);

    if (!dailySummary) {
      dailySummary = this.createEmptyDailySummary(date, measurement.timestamp);
      this.dailyData.set(date, dailySummary);
    }

    // Add measurement to daily summary
    dailySummary.measurements.push(measurement);
    dailySummary.totalHours += 1; // Assuming hourly measurements

    // Update method breakdown
    const { method } = measurement;
    dailySummary.methodBreakdown[method] = (dailySummary.methodBreakdown[method] || 0) + 1;

    // Recalculate daily weighted COP and quality
    this.updateDailySummary(dailySummary);

    // Cleanup old data if needed
    this.cleanupOldSeasonalData();
  }

  /**
   * Calculate current SCOP based on accumulated data
   */
  public calculateSCOP(): SCOPResult | null {
    const seasonalData = this.getCurrentSeasonData();

    if (seasonalData.length === 0) {
      return null; // No data available
    }

    // Check minimum data requirements
    const totalHours = seasonalData.reduce((sum, day) => sum + day.totalHours, 0);
    if (totalHours < DeviceConstants.SCOP_QUALITY_REQUIREMENTS.HIGH_QUALITY_HOURS_MIN) {
      this.homey.log(`⚠️ SCOP: Insufficient data (${totalHours}h < ${DeviceConstants.SCOP_QUALITY_REQUIREMENTS.HIGH_QUALITY_HOURS_MIN}h required)`);
    }

    // Map daily data to temperature bins
    const temperatureBins = this.mapToTemperatureBins(seasonalData);

    // Calculate quality metrics
    const qualityMetrics = this.calculateQualityMetrics(seasonalData);

    // Calculate weighted SCOP using EN 14825 method
    const scop = this.calculateWeightedSCOP(temperatureBins);

    // Determine confidence level
    const confidence = this.determineConfidence(qualityMetrics, totalHours);

    // Calculate method contribution percentages
    const methodContribution = this.calculateMethodContribution(seasonalData);

    // Calculate seasonal coverage
    const seasonalCoverage = this.calculateSeasonalCoverage(seasonalData);

    return {
      scop,
      confidence,
      dataQuality: this.formatDataQualityDescription(qualityMetrics, totalHours),
      seasonalCoverage,
      totalHours,
      methodContribution,
      temperatureBins,
      qualityMetrics,
    };
  }

  /**
   * Create empty daily summary structure
   */
  private createEmptyDailySummary(date: string, timestamp: number): DailyCOPSummary {
    return {
      date,
      dayOfYear: this.getDayOfYear(new Date(timestamp)),
      weightedCOP: 0,
      totalHours: 0,
      methodBreakdown: {},
      qualityScore: 0,
      ambientTempAverage: 0,
      measurements: [],
    };
  }

  /**
   * Update daily summary with weighted calculations
   */
  private updateDailySummary(daily: DailyCOPSummary): void {
    if (daily.measurements.length === 0) {
      return;
    }

    // Calculate quality-weighted COP
    let totalWeightedCOP = 0;
    let totalWeight = 0;

    for (const measurement of daily.measurements) {
      const methodWeight = DeviceConstants.SCOP_METHOD_WEIGHTS[measurement.method] || 0.1;
      totalWeightedCOP += measurement.cop * methodWeight;
      totalWeight += methodWeight;
    }

    daily.weightedCOP = totalWeight > 0 ? totalWeightedCOP / totalWeight : 0;

    // Calculate quality score (0-1)
    const highQualityMethods = ['direct_thermal', 'power_module', 'refrigerant_circuit', 'carnot_estimation'];
    const highQualityHours = daily.measurements.filter((m) => highQualityMethods.includes(m.method)).length;
    daily.qualityScore = daily.totalHours > 0 ? highQualityHours / daily.totalHours : 0;

    // Calculate average ambient temperature
    daily.ambientTempAverage = daily.measurements.reduce((sum, m) => sum + m.ambientTemperature, 0) / daily.measurements.length;
  }

  /**
   * Map daily data to EN 14825 temperature bins
   */
  private mapToTemperatureBins(seasonalData: DailyCOPSummary[]) {
    const bins = DeviceConstants.SCOP_TEMPERATURE_BINS.map((bin) => ({
      ...bin,
      hours: 0,
      weightedCOP: 0,
      totalWeight: 0,
    }));

    // Map daily data to closest temperature bins
    for (const daily of seasonalData) {
      const closestBinIndex = this.findClosestTemperatureBin(daily.ambientTempAverage);
      const bin = bins[closestBinIndex];

      bin.hours += daily.totalHours;
      bin.weightedCOP += daily.weightedCOP * daily.totalHours * daily.qualityScore;
      bin.totalWeight += daily.totalHours * daily.qualityScore;
    }

    // Finalize weighted COPs
    for (const bin of bins) {
      if (bin.totalWeight > 0) {
        bin.weightedCOP /= bin.totalWeight;
      } else {
        // Use estimated COP for empty bins
        bin.weightedCOP = this.estimateCOPForTemperature(bin.temp);
      }
    }

    return bins.map((bin) => ({
      temp: bin.temp,
      hours: bin.hours,
      weightedCOP: bin.weightedCOP,
      binName: bin.bin_name,
    }));
  }

  /**
   * Calculate weighted SCOP using EN 14825 methodology
   */
  private calculateWeightedSCOP(temperatureBins: TemperatureBin[]): number {
    let totalWeightedEfficiency = 0;
    let totalHours = 0;

    for (const bin of temperatureBins) {
      // Use EN 14825 load ratios for weighting
      const standardBin = DeviceConstants.SCOP_TEMPERATURE_BINS.find((std) => std.temp === bin.temp);
      const loadRatio = standardBin?.load_ratio || 0.5;

      totalWeightedEfficiency += bin.weightedCOP * bin.hours * loadRatio;
      totalHours += bin.hours * loadRatio;
    }

    return totalHours > 0 ? totalWeightedEfficiency / totalHours : 0;
  }

  /**
   * Calculate quality metrics for confidence determination
   */
  private calculateQualityMetrics(seasonalData: DailyCOPSummary[]) {
    const totalHours = seasonalData.reduce((sum, day) => sum + day.totalHours, 0);
    let highQualityHours = 0;
    let method3Hours = 0;
    let totalQualityScore = 0;

    for (const daily of seasonalData) {
      highQualityHours += daily.totalHours * daily.qualityScore;
      method3Hours += daily.methodBreakdown.temperature_difference || 0;
      totalQualityScore += daily.qualityScore * daily.totalHours;
    }

    const method3Contribution = totalHours > 0 ? method3Hours / totalHours : 0;
    const overallQualityScore = totalHours > 0 ? totalQualityScore / totalHours : 0;

    return {
      highQualityHours,
      method3Contribution,
      overallQualityScore,
    };
  }

  /**
   * Determine confidence level based on data quality
   */
  private determineConfidence(qualityMetrics: QualityMetrics, totalHours: number): 'high' | 'medium' | 'low' {
    const { overallQualityScore, method3Contribution } = qualityMetrics;

    if (totalHours < DeviceConstants.SCOP_QUALITY_REQUIREMENTS.HIGH_QUALITY_HOURS_MIN) {
      return 'low';
    }

    if (method3Contribution > DeviceConstants.SCOP_QUALITY_REQUIREMENTS.METHOD3_MAX_CONTRIBUTION) {
      return 'low'; // Too much reliance on inaccurate Method 3
    }

    if (overallQualityScore >= DeviceConstants.SCOP_QUALITY_REQUIREMENTS.HIGH_CONFIDENCE_THRESHOLD) {
      return 'high';
    }

    if (overallQualityScore >= DeviceConstants.SCOP_QUALITY_REQUIREMENTS.MEDIUM_CONFIDENCE_THRESHOLD) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Calculate method contribution percentages
   */
  private calculateMethodContribution(seasonalData: DailyCOPSummary[]): Record<string, number> {
    const totalHours = seasonalData.reduce((sum, day) => sum + day.totalHours, 0);
    const methodTotals: Record<string, number> = {};

    for (const daily of seasonalData) {
      for (const [method, hours] of Object.entries(daily.methodBreakdown)) {
        methodTotals[method] = (methodTotals[method] || 0) + hours;
      }
    }

    // Convert to percentages
    const contribution: Record<string, number> = {};
    for (const [method, hours] of Object.entries(methodTotals)) {
      contribution[method] = totalHours > 0 ? (hours / totalHours) * 100 : 0;
    }

    return contribution;
  }

  /**
   * Utility methods
   */
  private isInHeatingSeason(timestamp: number): boolean {
    const date = new Date(timestamp);
    const dayOfYear = this.getDayOfYear(date);

    return dayOfYear >= DeviceConstants.SCOP_SEASON_START_DAY
           || dayOfYear <= DeviceConstants.SCOP_SEASON_END_DAY;
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private getDateString(timestamp: number): string {
    return new Date(timestamp).toISOString().split('T')[0];
  }

  private getCurrentSeasonData(): DailyCOPSummary[] {
    const currentSeason: DailyCOPSummary[] = [];

    for (const [date, daily] of this.dailyData.entries()) {
      const dateObj = new Date(date);
      const year = dateObj.getFullYear();

      // Include data from current heating season
      if (year === this.currentSeasonStart || year === this.currentSeasonStart + 1) {
        currentSeason.push(daily);
      }
    }

    return currentSeason;
  }

  private findClosestTemperatureBin(temperature: number): number {
    let closestIndex = 0;
    let minDiff = Math.abs(DeviceConstants.SCOP_TEMPERATURE_BINS[0].temp - temperature);

    for (let i = 1; i < DeviceConstants.SCOP_TEMPERATURE_BINS.length; i++) {
      const diff = Math.abs(DeviceConstants.SCOP_TEMPERATURE_BINS[i].temp - temperature);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  private estimateCOPForTemperature(ambientTemp: number): number {
    // Simple linear estimation based on ambient temperature
    // Higher ambient temp = higher COP (less temperature lift required)
    if (ambientTemp >= 10) {
      return 4.0; // Good conditions
    } if (ambientTemp >= 0) {
      return 3.0 + (ambientTemp / 10); // 3.0-4.0 range
    } if (ambientTemp >= -10) {
      return 2.5 + ((ambientTemp + 10) / 10) * 0.5; // 2.5-3.0 range
    }
    return 2.0; // Very cold conditions

  }

  private calculateSeasonalCoverage(seasonalData: DailyCOPSummary[]): number {
    if (seasonalData.length === 0) return 0;

    // Heating season is approximately 165 days (Oct 1 - May 15)
    const maxSeasonDays = 165;
    const actualDays = seasonalData.length;

    return Math.min(actualDays / maxSeasonDays, 1.0);
  }

  private formatDataQualityDescription(qualityMetrics: QualityMetrics, totalHours: number): string {
    const { overallQualityScore, method3Contribution } = qualityMetrics;

    if (totalHours < 100) {
      return 'Insufficient data - collect more measurements';
    }

    if (method3Contribution > 0.5) {
      return `Low quality - ${Math.round(method3Contribution * 100)}% from inaccurate temperature method`;
    }

    if (overallQualityScore >= 0.8) {
      return `High quality - ${Math.round(overallQualityScore * 100)}% reliable methods`;
    }

    if (overallQualityScore >= 0.5) {
      return `Medium quality - ${Math.round(overallQualityScore * 100)}% reliable methods`;
    }

    return `Low quality - ${Math.round(overallQualityScore * 100)}% reliable methods`;
  }

  private cleanupOldSeasonalData(): void {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - DeviceConstants.SCOP_DATA_LIMITS.MAX_SEASONAL_HISTORY);

    for (const [date] of this.dailyData.entries()) {
      if (new Date(date) < cutoffDate) {
        this.dailyData.delete(date);
      }
    }
  }

  /**
   * Get current SCOP data for debugging/diagnostics
   */
  public getSeasonalSummary() {
    const currentData = this.getCurrentSeasonData();
    const totalHours = currentData.reduce((sum, day) => sum + day.totalHours, 0);
    const avgQuality = currentData.reduce((sum, day) => sum + day.qualityScore, 0) / currentData.length;

    return {
      seasonStart: this.currentSeasonStart,
      daysWithData: currentData.length,
      totalHours,
      avgQualityScore: avgQuality || 0,
      currentSCOP: this.calculateSCOP(),
    };
  }
}
