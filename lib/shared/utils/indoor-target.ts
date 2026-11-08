/**
 * Desired indoor temperature range (capability `target_temperature.indoor`)
 *
 * The flow card "Desired indoor temperature" can receive a value from another
 * device, for example a thermostat in frost protection (7 °C). Since v3.7.1 such
 * a value is limited to the supported range instead of failing the flow, so the
 * room target never silently stays at its previous value.
 *
 * @module lib/shared/utils/indoor-target
 */

export const INDOOR_TARGET_MIN_C = 15;
export const INDOOR_TARGET_MAX_C = 25;

export interface ClampedIndoorTarget {
  /** Value within the supported range */
  value: number;
  /** True when the requested value was outside the range */
  clamped: boolean;
}

/**
 * Limit a requested indoor target to the supported range.
 *
 * @param requested - Value from the flow card
 * @returns The value within 15–25 °C and whether it was limited
 * @throws When the value is not a finite number
 */
export function clampIndoorTarget(requested: number): ClampedIndoorTarget {
  if (!Number.isFinite(requested)) {
    throw new Error(`Invalid desired indoor temperature: ${requested}`);
  }
  const value = Math.min(INDOOR_TARGET_MAX_C, Math.max(INDOOR_TARGET_MIN_C, requested));
  return { value, clamped: value !== requested };
}
