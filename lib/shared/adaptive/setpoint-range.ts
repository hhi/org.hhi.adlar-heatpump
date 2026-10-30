/**
 * Water temperature range of the adaptive control (settings adaptive_min_setpoint and
 * adaptive_max_setpoint), shared by all three drivers.
 */

/** Smallest allowed gap between the minimum and maximum water temperature (°C). */
export const SETPOINT_RANGE_MIN_GAP = 2;

/** True when the maximum lies at least SETPOINT_RANGE_MIN_GAP above the minimum. */
export function isSetpointRangeValid(minSetpoint: number, maxSetpoint: number): boolean {
  return maxSetpoint >= minSetpoint + SETPOINT_RANGE_MIN_GAP;
}

/**
 * Effective upper limit: the configured maximum, never above the driver's hard maximum.
 * A missing setting (devices paired before the setting existed) falls back to the hard maximum.
 */
export function resolveMaxSetpoint(configured: number | null | undefined, hardMax: number): number {
  return Math.min(hardMax, configured ?? hardMax);
}
