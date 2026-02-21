/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
/**
 * Defrost Learner - Learning model for defrost cycle COP impact
 *
 * Learns the relationship between outdoor temperature, humidity, and defrost
 * frequency/duration from observed DPS 33 events. Uses this learned data to
 * predict COP penalty factors for weather forecast COP estimation.
 *
 * Architecture follows the COPOptimizer pattern:
 * - Rolling FIFO history of defrost events
 * - 2°C temperature buckets for lookup
 * - 3-layer lookup: exact bucket → interpolation → extrapolation
 * - Falls back to static humidity model when insufficient learned data
 * - getState() / restoreState() for persistence via setStoreValue
 *
 * @version 2.9.0
 * @since 2.9.0
 */

import { DeviceConstants } from '../constants';

/** A single observed defrost event */
export interface DefrostEvent {
  /** When defrost started (unix ms) */
  timestamp: number;
  /** Outdoor temperature at defrost start (°C) */
  outdoorTemp: number;
  /** Relative humidity at defrost start (%, null if unavailable) */
  humidity: number | null;
  /** Defrost cycle duration (seconds) */
  durationSec: number;
}

/** Aggregated statistics for a temperature bucket */
export interface DefrostBucket {
  /** Rounded temperature (2°C steps) */
  tempBucket: number;
  /** Number of defrost events in this bucket */
  eventCount: number;
  /** Average defrost duration (seconds) */
  avgDurationSec: number;
  /** Average interval between consecutive defrosts (minutes) */
  avgIntervalMin: number;
  /** Estimated defrost minutes per operational hour */
  defrostMinPerHour: number;
  /** Learned COP penalty factor (0.85–1.0, multiplicative) */
  copPenaltyFactor: number;
}

export interface DefrostLearnerConfig {
  logger?: (msg: string, ...args: unknown[]) => void;
}

/** Serializable state for persistence */
export interface DefrostLearnerState {
  history: DefrostEvent[];
  bucketMap: [number, DefrostBucket][];
}

/**
 * DefrostLearner
 *
 * Learns defrost cycle patterns from real observations and provides
 * COP penalty factor predictions for weather forecast optimization.
 */
export class DefrostLearner {
  private history: DefrostEvent[] = [];
  private bucketMap: Map<number, DefrostBucket> = new Map();
  private logger: (msg: string, ...args: unknown[]) => void;

  private static readonly CONSTANTS = DeviceConstants.FORECAST_DEFROST;

  constructor(config: DefrostLearnerConfig = {}) {
    this.logger = config.logger || (() => { });
  }

  /**
   * Get COP penalty factor for a given outdoor temperature and humidity.
   *
   * Three-layer lookup (matching COPOptimizer pattern):
   * 1. Exact bucket match (≥ MIN_EVENTS_PER_BUCKET events)
   * 2. Linear interpolation between two surrounding known buckets
   * 3. Linear extrapolation from the two nearest edge buckets
   *
   * Falls back to static humidity model when insufficient learned data.
   *
   * @returns Multiplicative COP factor: 0.85–1.0 (1.0 = no penalty)
   */
  public getDefrostPenalty(outdoorTemp: number, humidity?: number | null): number {
    const constants = DefrostLearner.CONSTANTS;
    const bucketSize = constants.BUCKET_SIZE;
    const queryBucket = Math.round(outdoorTemp / bucketSize) * bucketSize;

    // Check if outside defrost temperature band entirely
    if (outdoorTemp < constants.TEMP_LOW || outdoorTemp > constants.TEMP_HIGH) {
      return 1.0; // No defrost penalty outside the icing band
    }

    // Try learned data first
    const learnedPenalty = this.lookupLearnedPenalty(queryBucket, outdoorTemp);
    if (learnedPenalty !== null) {
      return learnedPenalty;
    }

    // Fallback: static humidity-based model
    return this.staticHumidityModel(outdoorTemp, humidity ?? undefined);
  }

  /**
   * 3-layer lookup from learned bucket data.
   * Returns null if insufficient data for any layer.
   */
  private lookupLearnedPenalty(queryBucket: number, outdoorTemp: number): number | null {
    const minEvents = DefrostLearner.CONSTANTS.MIN_EVENTS_PER_BUCKET;

    // Filter buckets with sufficient data
    const qualifiedBuckets = Array.from(this.bucketMap.entries())
      .filter(([, b]) => b.eventCount >= minEvents)
      .sort((a, b) => a[0] - b[0]);

    if (qualifiedBuckets.length === 0) return null;

    // Layer 1: Exact bucket match
    const exactMatch = qualifiedBuckets.find(([temp]) => temp === queryBucket);
    if (exactMatch) {
      return exactMatch[1].copPenaltyFactor;
    }

    // Need at least 2 buckets for interpolation/extrapolation
    if (qualifiedBuckets.length < 2) {
      // Single bucket: use its penalty as best guess
      return qualifiedBuckets[0][1].copPenaltyFactor;
    }

    // Layer 2: Interpolation — find two surrounding buckets
    let lower: [number, DefrostBucket] | null = null;
    let upper: [number, DefrostBucket] | null = null;

    for (const entry of qualifiedBuckets) {
      if (entry[0] <= queryBucket) lower = entry;
      if (entry[0] >= queryBucket && !upper) upper = entry;
    }

    if (lower && upper && lower[0] !== upper[0]) {
      const fraction = (outdoorTemp - lower[0]) / (upper[0] - lower[0]);
      return lower[1].copPenaltyFactor + fraction * (upper[1].copPenaltyFactor - lower[1].copPenaltyFactor);
    }

    // Layer 3: Extrapolation
    if (outdoorTemp < qualifiedBuckets[0][0]) {
      const [t1, b1] = qualifiedBuckets[0];
      const [t2, b2] = qualifiedBuckets[1];
      const slope = (b2.copPenaltyFactor - b1.copPenaltyFactor) / (t2 - t1);
      return Math.max(0.80, Math.min(1.0, b1.copPenaltyFactor + slope * (outdoorTemp - t1)));
    }

    const [tA, bA] = qualifiedBuckets[qualifiedBuckets.length - 2];
    const [tB, bB] = qualifiedBuckets[qualifiedBuckets.length - 1];
    const slope = (bB.copPenaltyFactor - bA.copPenaltyFactor) / (tB - tA);
    return Math.max(0.80, Math.min(1.0, bB.copPenaltyFactor + slope * (outdoorTemp - tB)));
  }

  /**
   * Static humidity-based defrost model (fallback when no learned data).
   *
   * - Tent function centered at 0°C (worst frosting conditions)
   * - Humidity linear from threshold (80%) to 100%
   * - Max penalty: FALLBACK_MAX_PENALTY (15%)
   */
  private staticHumidityModel(temperature: number, humidity?: number): number {
    const constants = DefrostLearner.CONSTANTS;

    // If no humidity data, apply half the max penalty as conservative estimate
    if (humidity === undefined || humidity === null) {
      const tempRange = constants.TEMP_HIGH;
      const tempDist = Math.abs(temperature);
      const tempFactor = Math.max(0, 1.0 - tempDist / tempRange);
      return 1.0 - (constants.FALLBACK_MAX_PENALTY * 0.5 * tempFactor);
    }

    // Below humidity threshold: negligible defrost risk
    if (humidity <= constants.HUMIDITY_THRESHOLD) return 1.0;

    // Temperature factor: tent function, worst at 0°C, tapers to 0 at ±7°C
    const tempRange = constants.TEMP_HIGH;
    const tempDist = Math.abs(temperature);
    const tempFactor = Math.max(0, 1.0 - tempDist / tempRange);

    // Humidity factor: linear from threshold to 100%
    const humidityFactor = (humidity - constants.HUMIDITY_THRESHOLD)
      / (100.0 - constants.HUMIDITY_THRESHOLD);

    const penalty = constants.FALLBACK_MAX_PENALTY * tempFactor * humidityFactor;
    return 1.0 - penalty;
  }

  /**
   * Rebuild bucket statistics from full history.
   * Called after every new event addition.
   */
  private rebuildBuckets(): void {
    const bucketSize = DefrostLearner.CONSTANTS.BUCKET_SIZE;
    const grouped = new Map<number, DefrostEvent[]>();

    // Group events by temperature bucket
    for (const event of this.history) {
      const bucket = Math.round(event.outdoorTemp / bucketSize) * bucketSize;
      if (!grouped.has(bucket)) {
        grouped.set(bucket, []);
      }
      grouped.get(bucket)!.push(event);
    }

    // Compute statistics per bucket
    this.bucketMap.clear();

    grouped.forEach((events, bucket) => {
      const avgDuration = events.reduce((sum, e) => sum + e.durationSec, 0) / events.length;

      // Calculate average interval between consecutive defrosts in this bucket
      let avgIntervalMin = 60; // Default: 1 defrost per hour
      if (events.length >= 2) {
        const sortedByTime = [...events].sort((a, b) => a.timestamp - b.timestamp);
        let totalInterval = 0;
        let intervalCount = 0;

        for (let i = 1; i < sortedByTime.length; i++) {
          const intervalMs = sortedByTime[i].timestamp - sortedByTime[i - 1].timestamp;
          // Only count intervals < 4 hours (same operating session)
          if (intervalMs < 4 * 60 * 60 * 1000) {
            totalInterval += intervalMs;
            intervalCount++;
          }
        }

        if (intervalCount > 0) {
          avgIntervalMin = (totalInterval / intervalCount) / (60 * 1000);
        }
      }

      // Defrost minutes per operational hour
      // = (avgDurationSec / 60) × (60 / avgIntervalMin) = avgDurationSec / avgIntervalMin
      const defrostMinPerHour = Math.min(15, avgDuration / avgIntervalMin);

      // COP penalty: proportion of time spent defrosting
      // During defrost, the heat pump produces no useful heating
      const copPenaltyFactor = Math.max(0.80, 1.0 - (defrostMinPerHour / 60));

      this.bucketMap.set(bucket, {
        tempBucket: bucket,
        eventCount: events.length,
        avgDurationSec: avgDuration,
        avgIntervalMin,
        defrostMinPerHour,
        copPenaltyFactor,
      });
    });
  }

  /**
   * Record a complete defrost event directly (when duration is already known).
   * Used when the caller (device.ts) tracks start/end times externally.
   */
  public recordEvent(outdoorTemp: number, durationSec: number, humidity?: number | null): void {
    // Validate duration
    if (durationSec < 10 || durationSec > 1200) {
      this.logger(`DefrostLearner: Event duration ${durationSec.toFixed(0)}s outside valid range (10-1200s) — skipped`);
      return;
    }

    const event: DefrostEvent = {
      timestamp: Date.now(),
      outdoorTemp,
      humidity: humidity ?? null,
      durationSec,
    };

    this.history.push(event);

    if (this.history.length > DefrostLearner.CONSTANTS.MAX_HISTORY_SIZE) {
      this.history.shift();
    }

    this.rebuildBuckets();

    this.logger(`DefrostLearner: Event recorded — ${durationSec.toFixed(0)}s at ${outdoorTemp.toFixed(1)}°C (${this.history.length} total)`);
  }

  /**
   * Get the number of learned events
   */
  public getEventCount(): number {
    return this.history.length;
  }

  /**
   * Get qualified bucket count (buckets with enough data)
   */
  public getQualifiedBucketCount(): number {
    const minEvents = DefrostLearner.CONSTANTS.MIN_EVENTS_PER_BUCKET;
    return Array.from(this.bucketMap.values()).filter((b) => b.eventCount >= minEvents).length;
  }

  /**
   * Export state for persistence via setStoreValue
   */
  public getState(): DefrostLearnerState {
    return {
      history: this.history,
      bucketMap: Array.from(this.bucketMap.entries()),
    };
  }

  /**
   * Restore state from persistence via getStoreValue
   */
  public restoreState(state: DefrostLearnerState): void {
    if (!state || !Array.isArray(state.history)) {
      this.logger('DefrostLearner: Invalid state — starting fresh');
      return;
    }

    this.history = state.history;
    this.bucketMap = new Map(state.bucketMap || []);

    // Validate: rebuild buckets from history to ensure consistency
    if (this.history.length > 0) {
      this.rebuildBuckets();
    }

    this.logger(`DefrostLearner: Restored state with ${this.history.length} events, ${this.bucketMap.size} buckets`);
  }

  /**
   * Cleanup and release memory
   */
  public destroy(): void {
    const eventCount = this.history.length;
    const bucketCount = this.bucketMap.size;

    this.history = [];
    this.bucketMap.clear();

    this.logger(`DefrostLearner: Destroyed — released ${eventCount} events, ${bucketCount} buckets`);
  }
}
