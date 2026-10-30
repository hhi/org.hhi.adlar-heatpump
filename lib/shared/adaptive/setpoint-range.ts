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

/** A water temperature range in °C. */
export interface WaterTempLimits {
  min: number;
  max: number;
}

/**
 * Plausible bounds for heating limits read from the heat pump (Aurora II P111/P110 allow 15–80°C).
 * Values outside (not read yet, wrong temperature scale) are ignored.
 */
const HEATING_LIMIT_PLAUSIBLE_MIN_C = 10;
const HEATING_LIMIT_PLAUSIBLE_MAX_C = 85;

/**
 * Heating limits as read from the heat pump, or null when missing or implausible.
 * Aurora II: active limits 0x00FB/0x00FA. Aurora III: zone 1 limits 3-0013/3-0012.
 */
export function plausibleHeatingLimits(min: number | null, max: number | null): WaterTempLimits | null {
  if (min === null || max === null || !Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min >= max || min < HEATING_LIMIT_PLAUSIBLE_MIN_C || max > HEATING_LIMIT_PLAUSIBLE_MAX_C) return null;
  return { min: +min.toFixed(1), max: +max.toFixed(1) };
}

/** Which layer determines a bound of the effective range. */
export type SetpointLimitSource = 'register' | 'heat_pump' | 'setting';

export interface EffectiveSetpointRange extends WaterTempLimits {
  minSource: SetpointLimitSource;
  maxSource: SetpointLimitSource;
}

/**
 * Intersection of the setpoint register range, the heat pump's own limits and the user's settings.
 * On equal values the innermost layer (setting, then heat pump) is reported as the source.
 */
export function resolveEffectiveRange(
  register: WaterTempLimits,
  heatPump: WaterTempLimits | null,
  setting: WaterTempLimits,
): EffectiveSetpointRange {
  const layers: Array<[SetpointLimitSource, WaterTempLimits]> = [['setting', setting]];
  if (heatPump) layers.push(['heat_pump', heatPump]);
  layers.push(['register', register]);

  let [minSource, { min }] = layers[0];
  let [maxSource, { max }] = layers[0];
  for (const [source, limits] of layers.slice(1)) {
    if (limits.min > min) [minSource, min] = [source, limits.min];
    if (limits.max < max) [maxSource, max] = [source, limits.max];
  }
  return {
    min, max, minSource, maxSource,
  };
}
