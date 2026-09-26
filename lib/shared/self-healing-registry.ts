/* eslint-disable import/prefer-default-export */
/**
 * Interface for Homey timer management methods
 */
interface HomeyTimers {
  setTimeout: (callback: () => void, ms: number) => NodeJS.Timeout;
  setInterval: (callback: () => void, ms: number) => NodeJS.Timeout;
}

/**
 * Self-Healing Feature Registry (v1.3.5)
 *
 * Automatically disables problematic features that generate recurring errors,
 * preventing permanent device failure from bugs in non-critical components.
 *
 * Key Features:
 * - Tracks error frequency per feature (50 errors/hour threshold)
 * - Auto-disables features exceeding threshold (graceful degradation)
 * - Auto-re-enables after cooldown period (1 hour)
 * - Fail-open strategy: disabled features fall back to safe mode
 * - Persistent error tracking across feature instances
 *
 * Use Cases:
 * - Flow card runListeners with recurring validation errors
 * - Service components with intermittent failures
 * - Network operations with connection issues
 *
 * Benefits:
 * - Prevents crash loops from recurring bugs
 * - Isolates failures to specific features
 * - Maintains core functionality during issues
 * - Automatic recovery without manual intervention
 */

interface ErrorData {
  count: number;
  lastError: number;
  firstError: number;
}

interface DisabledFeature {
  disabledAt: number;
  errorCount: number;
  reason: string;
}

export class SelfHealingRegistry {
  private errorCounts: Map<string, ErrorData> = new Map();
  private disabledFeatures: Map<string, DisabledFeature> = new Map();
  private logger: (message: string, ...args: unknown[]) => void;
  private homey: HomeyTimers; // Homey instance for managed timers

  // Configuration
  private readonly MAX_ERRORS_PER_HOUR = 50; // Threshold for auto-disable
  private readonly ERROR_WINDOW_MS = 60 * 60 * 1000; // 1 hour rolling window
  private readonly DISABLE_DURATION_MS = 60 * 60 * 1000; // 1 hour cooldown
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  private cleanupTimer: NodeJS.Timeout | null = null;
  private reenableTimers: Map<string, NodeJS.Timeout> = new Map(); // Track re-enable timers

  constructor(
    logger?: (message: string, ...args: unknown[]) => void,
    homey?: HomeyTimers,
  ) {
    this.logger = logger || (() => {}); // No-op if no logger provided

    if (!homey) {
      throw new Error('Homey instance is required for timer management');
    }
    this.homey = homey;

    // Start periodic cleanup of old error data
    this.startCleanup();
  }

  /**
   * Track error for a feature. Auto-disables if threshold exceeded.
   *
   * @param featureName - Unique identifier for the feature (e.g., 'ambient_temperature_changed')
   * @param errorDetails - Optional error details for logging
   * @returns true if feature should continue executing, false if disabled
   */
  trackError(featureName: string, errorDetails?: unknown): boolean {
    const now = Date.now();

    // Don't track errors for already-disabled features
    if (this.disabledFeatures.has(featureName)) {
      return false;
    }

    // Get or create error data
    let errorData = this.errorCounts.get(featureName);
    if (!errorData) {
      errorData = { count: 0, lastError: 0, firstError: now };
    }

    // Reset counter if outside error window (1 hour)
    if (now - errorData.firstError > this.ERROR_WINDOW_MS) {
      errorData = { count: 1, lastError: now, firstError: now };
    } else {
      errorData.count++;
      errorData.lastError = now;
    }

    this.errorCounts.set(featureName, errorData);

    // Check if threshold exceeded
    if (errorData.count >= this.MAX_ERRORS_PER_HOUR) {
      const reason = `${errorData.count} errors in ${Math.round((now - errorData.firstError) / 60000)} minutes`;
      this.disableFeature(featureName, errorData.count, reason);
      return false;
    }

    // Log warning at halfway point (25 errors)
    if (errorData.count === Math.floor(this.MAX_ERRORS_PER_HOUR / 2)) {
      this.logger(
        `⚠️  Self-Healing: Feature '${featureName}' has ${errorData.count} errors (halfway to auto-disable threshold)`,
        errorDetails,
      );
    }

    return true;
  }

  /**
   * Disable a feature due to excessive errors.
   *
   * @param featureName - Feature to disable
   * @param errorCount - Total errors that triggered disable
   * @param reason - Human-readable reason for disable
   */
  private disableFeature(featureName: string, errorCount: number, reason: string): void {
    if (this.disabledFeatures.has(featureName)) return;

    const now = Date.now();

    this.logger(
      `🚨 SELF-HEALING: Auto-disabling feature '${featureName}' (${reason})`,
      `Will re-enable after ${this.DISABLE_DURATION_MS / 60000} minute cooldown`,
    );

    this.disabledFeatures.set(featureName, {
      disabledAt: now,
      errorCount,
      reason,
    });

    // Schedule auto-re-enable after cooldown using Homey's managed timer
    const timer = this.homey.setTimeout(() => {
      this.reenableTimers.delete(featureName);
      this.reenableFeature(featureName);
    }, this.DISABLE_DURATION_MS);

    // Track timer for cleanup
    this.reenableTimers.set(featureName, timer);
  }

  /**
   * Re-enable a previously disabled feature after cooldown.
   *
   * @param featureName - Feature to re-enable
   */
  private reenableFeature(featureName: string): void {
    const disabledData = this.disabledFeatures.get(featureName);
    if (!disabledData) return;

    this.logger(
      `✅ SELF-HEALING: Re-enabling feature '${featureName}' after cooldown`,
      `Was disabled for: ${disabledData.reason}`,
    );

    this.disabledFeatures.delete(featureName);
    this.errorCounts.delete(featureName); // Clear error history
  }

  /**
   * Check if a feature is currently enabled.
   *
   * @param featureName - Feature to check
   * @returns true if enabled, false if disabled
   */
  isFeatureEnabled(featureName: string): boolean {
    return !this.disabledFeatures.has(featureName);
  }

  /**
   * Get current error count for a feature.
   *
   * @param featureName - Feature to query
   * @returns Error count in current window, or 0 if none
   */
  getErrorCount(featureName: string): number {
    const errorData = this.errorCounts.get(featureName);
    if (!errorData) return 0;

    const now = Date.now();
    // Return 0 if outside error window
    if (now - errorData.firstError > this.ERROR_WINDOW_MS) {
      return 0;
    }

    return errorData.count;
  }

  /**
   * Get list of currently disabled features with details.
   *
   * @returns Map of disabled features with metadata
   */
  getDisabledFeatures(): Map<string, DisabledFeature> {
    return new Map(this.disabledFeatures);
  }

  /**
   * Get summary of self-healing status for diagnostics.
   *
   * @returns Human-readable status string
   */
  getStatus(): string {
    const disabledCount = this.disabledFeatures.size;
    const trackedCount = this.errorCounts.size;

    if (disabledCount === 0 && trackedCount === 0) {
      return 'All features healthy';
    }

    const parts: string[] = [];

    if (disabledCount > 0) {
      const features = Array.from(this.disabledFeatures.keys()).join(', ');
      parts.push(`${disabledCount} disabled: ${features}`);
    }

    if (trackedCount > 0) {
      const highErrorFeatures = Array.from(this.errorCounts.entries())
        .filter(([, data]) => data.count > 10)
        .map(([name, data]) => `${name}(${data.count})`);

      if (highErrorFeatures.length > 0) {
        parts.push(`High error count: ${highErrorFeatures.join(', ')}`);
      }
    }

    return parts.join(' | ');
  }

  /**
   * Manually reset error tracking for a feature (for testing/recovery).
   *
   * @param featureName - Feature to reset
   */
  resetFeature(featureName: string): void {
    this.errorCounts.delete(featureName);
    this.disabledFeatures.delete(featureName);
    this.logger(`🔄 Self-Healing: Manually reset feature '${featureName}'`);
  }

  /**
   * Start periodic cleanup of stale error data.
   */
  private startCleanup(): void {
    this.cleanupTimer = this.homey.setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Clean up stale error data outside the tracking window.
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [featureName, errorData] of this.errorCounts.entries()) {
      // Remove if outside error window
      if (now - errorData.firstError > this.ERROR_WINDOW_MS) {
        this.errorCounts.delete(featureName);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger(`🧹 Self-Healing: Cleaned up ${cleaned} stale error records`);
    }
  }

  /**
   * Stop cleanup timer and release resources.
   */
  destroy(): void {
    // Clear cleanup interval timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Clear all re-enable timeout timers
    this.reenableTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.reenableTimers.clear();

    this.errorCounts.clear();
    this.disabledFeatures.clear();

    this.logger('Self-Healing Registry destroyed');
  }
}
