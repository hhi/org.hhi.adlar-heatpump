/* eslint-disable import/prefer-default-export */
/**
 * CurveCalculator - Production-ready utility for dynamic value calculation based on curves
 *
 * Evaluates input values against user-defined curves to calculate output values.
 * Commonly used for weather-compensated heating curves, time-based optimizations,
 * and COP-based efficiency adjustments.
 *
 * @example
 * // Weather-compensated heating curve
 * const curve = "< 0 : 55, < 5 : 50, < 10 : 45, < 15 : 40, default : 35";
 * const targetTemp = CurveCalculator.evaluate(outdoorTemp, curve);
 */

/**
 * Supported comparison operators for curve conditions
 */
export type CurveOperator = '>' | '>=' | '<' | '<=' | '==' | '!=' | 'default';

/**
 * Single entry in a curve definition
 */
export interface CurveEntry {
  /** Comparison operator */
  operator: CurveOperator;
  /** Threshold value (undefined for 'default' operator) */
  threshold?: number;
  /** Output value when condition matches */
  outputValue: number;
  /** Original line number (for error reporting) */
  lineNumber?: number;
}

/**
 * Result of curve validation
 */
export interface CurveValidationResult {
  /** Whether the curve is valid */
  valid: boolean;
  /** Array of validation error messages */
  errors: string[];
  /** Parsed curve entries (only if valid) */
  parsedEntries?: CurveEntry[];
}

/**
 * CurveCalculator - Static utility class for curve-based value calculation
 *
 * Features:
 * - Supports 6 comparison operators: >, >=, <, <=, ==, !=
 * - Default fallback value support
 * - Comma or newline separated entries
 * - Production-ready error handling
 * - Maximum entry limit (50) against abuse
 * - Input validation and sanitization
 */
export class CurveCalculator {
  /** Maximum allowed curve entries to prevent abuse */
  private static readonly MAX_CURVE_ENTRIES = 50;

  /** Supported comparison operators */
  private static readonly SUPPORTED_OPERATORS: CurveOperator[] = ['>', '>=', '<', '<=', '==', '!='];

  /** Regex pattern for parsing curve entries */
  private static readonly ENTRY_PATTERN = /^([><=!]+)?\s*(-?[\d.]+)$/;

  /**
   * Parse curve string into structured entries
   *
   * @param curveString - Curve definition string (comma or newline separated)
   * @returns Array of parsed curve entries
   * @throws Error if syntax is invalid with detailed error message
   *
   * @example
   * const entries = CurveCalculator.parseCurve("< 0 : 55, >= 10 : 40, default : 35");
   */
  static parseCurve(curveString: string): CurveEntry[] {
    // Input validation
    if (!curveString || typeof curveString !== 'string') {
      throw new Error('Curve definition must be a non-empty string');
    }

    const trimmed = curveString.trim();
    if (trimmed === '') {
      throw new Error('Curve definition cannot be empty');
    }

    // Split by comma or newline
    const lines = trimmed.split(/[\n,]+/);
    const entries: CurveEntry[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const lineNumber = i + 1;

      // Split into condition and value parts
      const parts = line.split(':');
      if (parts.length !== 2) {
        throw new Error(
          `Invalid curve syntax at line ${lineNumber}: '${line}'\n`
          + 'Expected format: \'[operator] threshold : value\' or \'default : value\'',
        );
      }

      const conditionPart = parts[0].trim();
      const valuePart = parts[1].trim();

      // Parse output value
      const outputValue = parseFloat(valuePart);
      if (Number.isNaN(outputValue)) {
        throw new Error(
          `Invalid output value at line ${lineNumber}: '${valuePart}'\n`
          + 'Output value must be a valid number',
        );
      }

      // Check for 'default' or '*' catch-all
      if (conditionPart.toLowerCase() === 'default' || conditionPart === '*') {
        entries.push({
          operator: 'default',
          outputValue,
          lineNumber,
        });
        continue;
      }

      // Parse operator and threshold
      const match = conditionPart.match(this.ENTRY_PATTERN);
      if (!match) {
        throw new Error(
          `Invalid condition syntax at line ${lineNumber}: '${conditionPart}'\n`
          + 'Expected format: \'[operator] number\' (e.g., \'> 10\', \'<= 5\', \'15\')',
        );
      }

      const operator = (match[1] || '>=') as CurveOperator; // Default to >= if no operator
      const threshold = parseFloat(match[2]);

      if (Number.isNaN(threshold)) {
        throw new Error(
          `Invalid threshold value at line ${lineNumber}: '${match[2]}'`,
        );
      }

      // Validate operator
      if (operator !== '>=' && !this.SUPPORTED_OPERATORS.includes(operator)) {
        throw new Error(
          `Unsupported operator at line ${lineNumber}: '${operator}'\n`
          + `Supported operators: ${this.SUPPORTED_OPERATORS.join(', ')}`,
        );
      }

      entries.push({
        operator,
        threshold,
        outputValue,
        lineNumber,
      });
    }

    // Validate total entries
    if (entries.length === 0) {
      throw new Error('Curve definition must contain at least one valid entry');
    }

    if (entries.length > this.MAX_CURVE_ENTRIES) {
      throw new Error(
        `Curve definition exceeds maximum allowed entries (${this.MAX_CURVE_ENTRIES}).\n`
        + `Current: ${entries.length} entries. Please simplify your curve.`,
      );
    }

    return entries;
  }

  /**
   * Validate curve definition without throwing exceptions
   *
   * @param curveString - Curve definition string
   * @returns Validation result with errors array
   *
   * @example
   * const result = CurveCalculator.validateCurve(userInput);
   * if (!result.valid) {
   *   console.error(result.errors);
   * }
   */
  static validateCurve(curveString: string): CurveValidationResult {
    try {
      const parsedEntries = this.parseCurve(curveString);
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
   * Evaluate curve for given input value
   *
   * Evaluates entries from top to bottom, returns the first matching value.
   *
   * @param inputValue - Input value to evaluate (e.g., outdoor temperature)
   * @param curveString - Curve definition string
   * @returns Calculated output value
   * @throws Error if no match found and no default fallback exists
   *
   * @example
   * const targetTemp = CurveCalculator.evaluate(12, "< 0 : 55, < 10 : 45, default : 35");
   * // Returns: 45 (because 12 is NOT < 10, so checks < 10 which is false, then default)
   */
  static evaluate(inputValue: number, curveString: string): number {
    // Input validation
    if (typeof inputValue !== 'number' || Number.isNaN(inputValue)) {
      throw new Error('Input value must be a valid number');
    }

    // Parse curve
    const entries = this.parseCurve(curveString);

    // Evaluate entries from top to bottom (first match wins)
    for (const entry of entries) {
      // Handle default fallback
      if (entry.operator === 'default') {
        return entry.outputValue;
      }

      // Evaluate condition
      const threshold = entry.threshold!; // Safe: non-default entries always have threshold
      let matches = false;

      switch (entry.operator) {
        case '>':
          matches = inputValue > threshold;
          break;
        case '>=':
          matches = inputValue >= threshold;
          break;
        case '<':
          matches = inputValue < threshold;
          break;
        case '<=':
          matches = inputValue <= threshold;
          break;
        case '==':
          matches = inputValue === threshold;
          break;
        case '!=':
          matches = inputValue !== threshold;
          break;
        default:
          // Should never happen due to parsing validation
          matches = inputValue >= threshold;
      }

      if (matches) {
        return entry.outputValue;
      }
    }

    // No match found and no default
    throw new Error(
      `No matching curve condition found for input value: ${inputValue}\n`
      + 'Suggestion: Add \'default : <value>\' as last line to provide a fallback',
    );
  }

  /**
   * Evaluate curve with fallback value (never throws)
   *
   * Safe variant of evaluate() that returns fallback instead of throwing.
   *
   * @param inputValue - Input value to evaluate
   * @param curveString - Curve definition string
   * @param fallbackValue - Value to return if evaluation fails
   * @returns Calculated output value or fallback
   *
   * @example
   * const temp = CurveCalculator.evaluateWithFallback(outdoorTemp, curve, 35);
   * // Returns 35 if curve evaluation fails for any reason
   */
  static evaluateWithFallback(
    inputValue: number,
    curveString: string,
    fallbackValue: number,
  ): number {
    try {
      return this.evaluate(inputValue, curveString);
    } catch (error) {
      // Return fallback on any error
      return fallbackValue;
    }
  }
}
