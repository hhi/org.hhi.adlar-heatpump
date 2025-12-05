/* eslint-disable import/prefer-default-export */
/**
 * SeasonalModeCalculator - Production-ready utility for seasonal mode determination
 *
 * Determines the current seasonal mode (heating/cooling) based on date ranges.
 * Uses the same heating season definition as SCOP calculations (Oct 1 - May 15).
 *
 * @example
 * // Check current season
 * const result = SeasonalModeCalculator.getCurrentSeason();
 * if (result.isHeatingSeason) {
 *   console.log('Heating mode active');
 * }
 */

/**
 * Seasonal mode types
 */
export type SeasonalMode = 'heating' | 'cooling' | 'auto';

/**
 * Result of seasonal mode calculation
 */
export interface SeasonalModeResult {
  /** Current seasonal mode */
  mode: SeasonalMode;
  /** Whether currently in heating season (Oct 1 - May 15) */
  isHeatingSeason: boolean;
  /** Whether currently in cooling season (May 16 - Sep 30) */
  isCoolingSeason: boolean;
  /** Current month (1-12) */
  month: number;
  /** Current day of month (1-31) */
  day: number;
  /** Number of days until season changes */
  daysUntilSeasonChange?: number;
}

/**
 * SeasonalModeCalculator - Static utility class for seasonal mode determination
 *
 * Features:
 * - Heating season: October 1 - May 15 (aligns with EN 14825 SCOP standard)
 * - Cooling season: May 16 - September 30
 * - Thread-safe static methods
 * - European climate optimized
 * - Integration with SCOP calculation periods
 */
export class SeasonalModeCalculator {
  /**
   * Heating season start: October 1
   */
  private static readonly HEATING_SEASON_START_MONTH = 10;
  private static readonly HEATING_SEASON_START_DAY = 1;

  /**
   * Heating season end: May 15
   */
  private static readonly HEATING_SEASON_END_MONTH = 5;
  private static readonly HEATING_SEASON_END_DAY = 15;

  /**
   * Determine if given date falls within heating season
   *
   * Heating season: October 1 - May 15 (inclusive)
   * This matches the SCOP calculation period per EN 14825 standard.
   *
   * @param date - Date to check (defaults to current date)
   * @returns True if date is within heating season
   *
   * @example
   * SeasonalModeCalculator.isHeatingSeason(new Date('2024-01-15')); // true
   * SeasonalModeCalculator.isHeatingSeason(new Date('2024-07-15')); // false
   */
  static isHeatingSeason(date: Date = new Date()): boolean {
    const month = date.getMonth() + 1; // JavaScript months are 0-based
    const day = date.getDate();

    // Heating season spans year boundary: Oct-Dec + Jan-May 15
    if (month >= this.HEATING_SEASON_START_MONTH) {
      // October, November, December
      return true;
    }

    if (month < this.HEATING_SEASON_END_MONTH) {
      // January, February, March, April
      return true;
    }

    if (month === this.HEATING_SEASON_END_MONTH) {
      // May: only 1-15 inclusive
      return day <= this.HEATING_SEASON_END_DAY;
    }

    // June, July, August, September
    return false;
  }

  /**
   * Determine if given date falls within cooling season
   *
   * Cooling season: May 16 - September 30 (inclusive)
   *
   * @param date - Date to check (defaults to current date)
   * @returns True if date is within cooling season
   *
   * @example
   * SeasonalModeCalculator.isCoolingSeason(new Date('2024-07-15')); // true
   * SeasonalModeCalculator.isCoolingSeason(new Date('2024-01-15')); // false
   */
  static isCoolingSeason(date: Date = new Date()): boolean {
    return !this.isHeatingSeason(date);
  }

  /**
   * Get seasonal mode for given date
   *
   * @param date - Date to evaluate (defaults to current date)
   * @returns 'heating' or 'cooling' mode
   *
   * @example
   * const mode = SeasonalModeCalculator.getSeasonalMode();
   * console.log(mode); // 'heating' or 'cooling'
   */
  static getSeasonalMode(date: Date = new Date()): SeasonalMode {
    return this.isHeatingSeason(date) ? 'heating' : 'cooling';
  }

  /**
   * Calculate days until next season change
   *
   * @param date - Date to evaluate (defaults to current date)
   * @returns Number of days until season changes
   */
  static getDaysUntilSeasonChange(date: Date = new Date()): number {
    const currentYear = date.getFullYear();
    const currentMonth = date.getMonth() + 1;
    const currentDay = date.getDate();

    let nextSeasonChangeDate: Date;

    if (this.isHeatingSeason(date)) {
      // Currently heating season → next change is May 16
      if (currentMonth <= this.HEATING_SEASON_END_MONTH) {
        // Still in current year's heating season
        nextSeasonChangeDate = new Date(
          currentYear,
          this.HEATING_SEASON_END_MONTH - 1, // JS months are 0-based
          this.HEATING_SEASON_END_DAY + 1, // May 16
        );
      } else {
        // In Oct-Dec, next change is next year's May 16
        nextSeasonChangeDate = new Date(
          currentYear + 1,
          this.HEATING_SEASON_END_MONTH - 1,
          this.HEATING_SEASON_END_DAY + 1,
        );
      }
    } else {
      // Currently cooling season → next change is October 1
      nextSeasonChangeDate = new Date(
        currentYear,
        this.HEATING_SEASON_START_MONTH - 1, // JS months are 0-based
        this.HEATING_SEASON_START_DAY,
      );
    }

    // Calculate difference in days
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffMs = nextSeasonChangeDate.getTime() - date.getTime();
    return Math.ceil(diffMs / msPerDay);
  }

  /**
   * Get comprehensive seasonal mode information
   *
   * Returns all seasonal mode data including mode, season flags, date info,
   * and days until next season change.
   *
   * @param date - Date to evaluate (defaults to current date)
   * @returns Complete seasonal mode result
   *
   * @example
   * const result = SeasonalModeCalculator.getCurrentSeason();
   * console.log(result);
   * // {
   * //   mode: 'heating',
   * //   isHeatingSeason: true,
   * //   isCoolingSeason: false,
   * //   month: 1,
   * //   day: 15,
   * //   daysUntilSeasonChange: 120
   * // }
   */
  static getCurrentSeason(date: Date = new Date()): SeasonalModeResult {
    const isHeating = this.isHeatingSeason(date);

    return {
      mode: isHeating ? 'heating' : 'cooling',
      isHeatingSeason: isHeating,
      isCoolingSeason: !isHeating,
      month: date.getMonth() + 1,
      day: date.getDate(),
      daysUntilSeasonChange: this.getDaysUntilSeasonChange(date),
    };
  }

  /**
   * Check if date is near season boundary (within N days)
   *
   * Useful for triggering preparation flows before season changes.
   *
   * @param date - Date to check (defaults to current date)
   * @param daysThreshold - Number of days before season change (default: 7)
   * @returns True if within threshold days of season change
   *
   * @example
   * // Check if within 7 days of season change
   * if (SeasonalModeCalculator.isNearSeasonBoundary()) {
   *   console.log('Prepare for season change!');
   * }
   */
  static isNearSeasonBoundary(date: Date = new Date(), daysThreshold = 7): boolean {
    const daysUntilChange = this.getDaysUntilSeasonChange(date);
    return daysUntilChange <= daysThreshold;
  }

  /**
   * Format seasonal mode result as human-readable string
   *
   * @param result - Seasonal mode result to format
   * @param language - Language for output ('en' or 'nl')
   * @returns Formatted string
   *
   * @example
   * const result = SeasonalModeCalculator.getCurrentSeason();
   * const text = SeasonalModeCalculator.formatSeasonInfo(result, 'nl');
   * console.log(text); // "Verwarmingsseizoen (nog 120 dagen)"
   */
  static formatSeasonInfo(
    result: SeasonalModeResult,
    language: 'en' | 'nl' = 'en',
  ): string {
    const seasonName = language === 'nl'
      ? (result.isHeatingSeason ? 'Verwarmingsseizoen' : 'Koelseizoen')
      : (result.isHeatingSeason ? 'Heating season' : 'Cooling season');

    const daysText = language === 'nl'
      ? `nog ${result.daysUntilSeasonChange} dagen`
      : `${result.daysUntilSeasonChange} days remaining`;

    return `${seasonName} (${daysText})`;
  }
}
