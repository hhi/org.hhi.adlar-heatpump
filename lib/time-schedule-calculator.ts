/* eslint-disable import/prefer-default-export */
/**
 * TimeScheduleCalculator - Production-ready utility for time-based value calculation
 *
 * Evaluates current time against user-defined schedules to calculate output values.
 * Commonly used for daily temperature schedules, time-of-use pricing,
 * and time-based automation rules.
 *
 * @example
 * // Daily temperature schedule
 * const schedule = "06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, 23:00-06:00: 18";
 * const targetTemp = TimeScheduleCalculator.evaluate(schedule);
 */

/**
 * Single time range entry in a schedule definition
 */
export interface TimeRangeEntry {
  /** Start hour (0-23) */
  startHour: number;
  /** Start minute (0-59) */
  startMinute: number;
  /** End hour (0-23) */
  endHour: number;
  /** End minute (0-59) */
  endMinute: number;
  /** Output value when current time falls within this range */
  outputValue: number;
  /** Whether this range spans midnight (e.g., 23:00-06:00) */
  isOvernight: boolean;
  /** Original line number (for error reporting) */
  lineNumber?: number;
}

/**
 * Result of schedule validation
 */
export interface ScheduleValidationResult {
  /** Whether the schedule is valid */
  valid: boolean;
  /** Array of validation error messages */
  errors: string[];
  /** Parsed schedule entries (only if valid) */
  parsedEntries?: TimeRangeEntry[];
}

/**
 * TimeScheduleCalculator - Static utility class for time-based value calculation
 *
 * Features:
 * - Time range format: HH:MM-HH:MM: value
 * - Supports overnight ranges (23:00-06:00)
 * - Default fallback support (24-hour coverage)
 * - Comma or newline separated entries
 * - Production-ready error handling
 * - Maximum entry limit (30) against abuse
 * - Input validation and sanitization
 */
export class TimeScheduleCalculator {
  /** Maximum allowed schedule entries to prevent abuse */
  private static readonly MAX_SCHEDULE_ENTRIES = 30;

  /** Regex pattern for parsing time range entries: "HH:MM-HH:MM: value" */
  private static readonly TIME_RANGE_PATTERN =
    /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\s*:\s*(-?[\d.]+)$/;

  /** Regex pattern for default/catch-all entries: "default: value" or "*: value" */
  private static readonly DEFAULT_PATTERN = /^(default|\*)\s*:\s*(-?[\d.]+)$/i;

  /**
   * Parse schedule string into structured time range entries
   *
   * @param scheduleString - Schedule definition string (comma or newline separated)
   * @returns Array of parsed time range entries
   * @throws Error if syntax is invalid with detailed error message
   *
   * @example
   * const entries = TimeScheduleCalculator.parseSchedule(
   *   "06:00-09:00: 22, 09:00-17:00: 19, default: 18"
   * );
   */
  static parseSchedule(scheduleString: string): TimeRangeEntry[] {
    // Input validation
    if (!scheduleString || typeof scheduleString !== 'string') {
      throw new Error('Schedule definition must be a non-empty string');
    }

    const trimmed = scheduleString.trim();
    if (trimmed === '') {
      throw new Error('Schedule definition cannot be empty');
    }

    // Split by comma or newline
    const lines = trimmed.split(/[\n,]+/);
    const entries: TimeRangeEntry[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const lineNumber = i + 1;

      // Check for default/catch-all entry
      const defaultMatch = line.match(this.DEFAULT_PATTERN);
      if (defaultMatch) {
        const outputValue = parseFloat(defaultMatch[2]);
        if (Number.isNaN(outputValue)) {
          throw new Error(
            `Invalid output value at line ${lineNumber}: '${defaultMatch[2]}'\n`
            + 'Output value must be a valid number',
          );
        }

        // Default covers full 24 hours (00:00-23:59)
        entries.push({
          startHour: 0,
          startMinute: 0,
          endHour: 23,
          endMinute: 59,
          outputValue,
          isOvernight: false,
          lineNumber,
        });
        continue;
      }

      // Parse time range entry
      const match = line.match(this.TIME_RANGE_PATTERN);
      if (!match) {
        throw new Error(
          `Invalid schedule syntax at line ${lineNumber}: '${line}'\n`
          + 'Expected format: \'HH:MM-HH:MM: value\' or \'default: value\'\n'
          + 'Examples: \'06:00-09:00: 22\', \'23:00-06:00: 18\', \'default: 20\'',
        );
      }

      // Extract time components
      const startHour = parseInt(match[1], 10);
      const startMinute = parseInt(match[2], 10);
      const endHour = parseInt(match[3], 10);
      const endMinute = parseInt(match[4], 10);
      const outputValue = parseFloat(match[5]);

      // Validate time components
      this.validateTimeComponent(startHour, 'start hour', lineNumber, 0, 23);
      this.validateTimeComponent(startMinute, 'start minute', lineNumber, 0, 59);
      this.validateTimeComponent(endHour, 'end hour', lineNumber, 0, 23);
      this.validateTimeComponent(endMinute, 'end minute', lineNumber, 0, 59);

      // Validate output value
      if (Number.isNaN(outputValue)) {
        throw new Error(
          `Invalid output value at line ${lineNumber}: '${match[5]}'\n`
          + 'Output value must be a valid number',
        );
      }

      // Check for same start and end time (invalid range)
      if (startHour === endHour && startMinute === endMinute) {
        throw new Error(
          `Invalid time range at line ${lineNumber}: start and end times are identical\n`
          + `${this.formatTime(startHour, startMinute)}-${this.formatTime(endHour, endMinute)}\n`
          + 'Time ranges must have different start and end times',
        );
      }

      // Determine if range spans midnight
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      const isOvernight = endMinutes <= startMinutes;

      entries.push({
        startHour,
        startMinute,
        endHour,
        endMinute,
        outputValue,
        isOvernight,
        lineNumber,
      });
    }

    // Validate total entries
    if (entries.length === 0) {
      throw new Error('Schedule definition must contain at least one valid entry');
    }

    if (entries.length > this.MAX_SCHEDULE_ENTRIES) {
      throw new Error(
        `Schedule definition exceeds maximum allowed entries (${this.MAX_SCHEDULE_ENTRIES}).\n`
        + `Current: ${entries.length} entries. Please simplify your schedule.`,
      );
    }

    return entries;
  }

  /**
   * Validate a time component (hour or minute)
   *
   * @param value - Time component value
   * @param name - Component name for error message
   * @param lineNumber - Line number for error reporting
   * @param min - Minimum allowed value
   * @param max - Maximum allowed value
   * @throws Error if value is out of range
   */
  private static validateTimeComponent(
    value: number,
    name: string,
    lineNumber: number,
    min: number,
    max: number,
  ): void {
    if (value < min || value > max) {
      throw new Error(
        `Invalid ${name} at line ${lineNumber}: ${value}\n`
        + `${name.charAt(0).toUpperCase() + name.slice(1)} must be between ${min} and ${max}`,
      );
    }
  }

  /**
   * Format time components as HH:MM string
   *
   * @param hour - Hour (0-23)
   * @param minute - Minute (0-59)
   * @returns Formatted time string
   */
  private static formatTime(hour: number, minute: number): string {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  /**
   * Validate schedule definition without throwing exceptions
   *
   * @param scheduleString - Schedule definition string
   * @returns Validation result with errors array
   *
   * @example
   * const result = TimeScheduleCalculator.validateSchedule(userInput);
   * if (!result.valid) {
   *   console.error(result.errors);
   * }
   */
  static validateSchedule(scheduleString: string): ScheduleValidationResult {
    try {
      const parsedEntries = this.parseSchedule(scheduleString);
      return {
        valid: true,
        errors: [],
        parsedEntries,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error'],
      };
    }
  }

  /**
   * Check if current time falls within a time range
   *
   * @param currentMinutes - Current time in minutes since midnight (0-1439)
   * @param entry - Time range entry to check
   * @returns True if current time is within range
   */
  private static isTimeInRange(currentMinutes: number, entry: TimeRangeEntry): boolean {
    const startMinutes = entry.startHour * 60 + entry.startMinute;
    const endMinutes = entry.endHour * 60 + entry.endMinute;

    if (entry.isOvernight) {
      // Overnight range: 23:00-06:00 matches if time >= 23:00 OR time <= 06:00
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
    // Normal range: 06:00-09:00 matches if time >= 06:00 AND time <= 09:00
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  /**
   * Evaluate schedule for current time (or provided time)
   *
   * Evaluates entries from top to bottom, returns the first matching value.
   *
   * @param scheduleString - Schedule definition string
   * @param now - Date object to evaluate (defaults to current time)
   * @returns Calculated output value
   * @throws Error if no match found and no default fallback exists
   *
   * @example
   * // Evaluate for current time
   * const targetTemp = TimeScheduleCalculator.evaluate(
   *   "06:00-09:00: 22, 09:00-17:00: 19, default: 18"
   * );
   *
   * @example
   * // Evaluate for specific time
   * const testTime = new Date('2024-01-15T14:30:00');
   * const targetTemp = TimeScheduleCalculator.evaluate(schedule, testTime);
   */
  static evaluate(scheduleString: string, now: Date = new Date()): number {
    // Parse schedule
    const entries = this.parseSchedule(scheduleString);

    // Calculate current time in minutes since midnight (0-1439)
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Evaluate entries from top to bottom (first match wins)
    for (const entry of entries) {
      if (this.isTimeInRange(currentMinutes, entry)) {
        return entry.outputValue;
      }
    }

    // No match found and no default
    const currentTimeStr = this.formatTime(now.getHours(), now.getMinutes());
    throw new Error(
      `No matching time range found for current time: ${currentTimeStr}\n`
      + 'Suggestion: Add \'default: <value>\' as last line to provide a fallback',
    );
  }

  /**
   * Evaluate schedule with fallback value (never throws)
   *
   * Safe variant of evaluate() that returns fallback instead of throwing.
   *
   * @param scheduleString - Schedule definition string
   * @param fallbackValue - Value to return if evaluation fails
   * @param now - Date object to evaluate (defaults to current time)
   * @returns Calculated output value or fallback
   *
   * @example
   * const temp = TimeScheduleCalculator.evaluateWithFallback(schedule, 20);
   * // Returns 20 if schedule evaluation fails for any reason
   */
  static evaluateWithFallback(
    scheduleString: string,
    fallbackValue: number,
    now: Date = new Date(),
  ): number {
    try {
      return this.evaluate(scheduleString, now);
    } catch (error) {
      // Return fallback on any error
      return fallbackValue;
    }
  }
}
