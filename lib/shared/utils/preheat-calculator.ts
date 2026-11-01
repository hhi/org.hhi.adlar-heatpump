/**
 * Pre-heat Duration Calculator
 *
 * Central utility for empirical pre-heat time estimation based on building time constant (τ).
 * Used by flow cards, building insights, and pre-heat triggers to ensure consistency.
 *
 * Replaces duplicated logic in:
 * - flow-card-manager-service.ts (calculate_preheat_time flow card)
 * - building-insights-service.ts (detectPreHeatingInsights)
 * - building-insights-service.ts (triggerPreHeatRecommendation)
 *
 * @module lib/utils/preheat-calculator
 * @version 2.7.6
 */

/**
 * Pre-heat category with associated properties
 */
export interface PreHeatCategory {
    /** Category identifier for insights */
    category: string;
    /** Estimated hours to heat 2°C */
    hoursFor2DegC: number;
    /** Priority for building insights (higher = more urgent) */
    priority: number;
}

/**
 * Empirical pre-heat time categories based on building time constant (τ)
 *
 * Categories based on practical experience with different building types:
 * - Very fast (τ<5h):   Lightweight, poor insulation, quick response
 * - Fast (τ<10h):       Light construction, moderate insulation
 * - Normal (τ<20h):     Average construction and insulation
 * - Slow (τ<40h):       Good insulation OR heavy construction
 * - Very slow (τ<80h):  Excellent insulation + heavy mass
 * - Extreme (τ≥80h):    Passive house or very heavy construction
 */
export function getPreHeatCategory(tau: number): PreHeatCategory {
  if (tau < 5) return { category: 'very_fast_response', hoursFor2DegC: 2, priority: 80 };
  if (tau < 10) return { category: 'fast_response', hoursFor2DegC: 4, priority: 75 };
  if (tau < 20) return { category: 'medium_response', hoursFor2DegC: 8, priority: 60 };
  if (tau < 40) return { category: 'slow_response', hoursFor2DegC: 16, priority: 50 };
  if (tau < 80) return { category: 'very_slow_response', hoursFor2DegC: 24, priority: 40 };
  return { category: 'extremely_slow_response', hoursFor2DegC: 32, priority: 30 };
}

/**
 * Calculate empirical pre-heat duration based on building time constant (τ)
 *
 * This function uses empirical ranges rather than theoretical formulas because:
 * - Theoretical formulas require unknowable future parameters (weather, COP, power)
 * - Empirical ranges are based on observed behavior of real buildings
 * - Results are conservative, ensuring users aren't caught with cold homes
 *
 * @param tau - Building time constant in hours (C/UA)
 * @param tempDelta - Temperature difference to heat (°C)
 * @param maxHours - Maximum duration cap (default: 48 hours)
 * @returns Duration in hours to achieve tempDelta
 */
export function calculatePreHeatDuration(
  tau: number,
  tempDelta: number,
  maxHours: number = 48,
): number {
  // No heating needed if already at or above target
  if (!Number.isFinite(tempDelta) || tempDelta <= 0) {
    return 0;
  }

  // Validate tau
  if (!Number.isFinite(tau) || tau <= 0) {
    // Fallback to average building assumption
    tau = 20;
  }

  const { hoursFor2DegC } = getPreHeatCategory(tau);

  // Scale linearly with temperature delta, cap at maxHours
  return Math.min(maxHours, (hoursFor2DegC * tempDelta) / 2.0);
}

/**
 * Current conditions for the physical pre-heat estimate (G14, ADR-062 B7)
 */
export interface PreHeatConditions {
  /** Heat loss coefficient (kW/°C) */
  UA: number;
  /** Internal gains (kW) */
  pInt: number;
  /** Current outdoor temperature (°C) */
  outdoorTemp: number;
  /** Highest hourly mean thermal power of the past week (kW) */
  maxHeatingPowerKw: number;
}

/** The room counts as warm 0.3 °C below the target */
export const PREHEAT_GOAL_MARGIN = 0.3;
/** Up to this rise the classes alone apply; the control loop's slow tail sets the time there */
export const PREHEAT_BLEND_START = 0.5;
/** Over this range the weight shifts from the classes to the physical estimate */
export const PREHEAT_BLEND_WIDTH = 1.0;
/** Step for the "never shorter than a smaller rise" scan */
const PREHEAT_MONOTONE_STEP = 0.05;

/**
 * Hours to reach the goal at full heating power: t = τ·ln((T_eq − T_in) / (T_eq − goal)),
 * with T_eq = T_out + (P + P_int) / UA. Infinity when the goal lies at or above T_eq.
 */
function physicalPreHeatHours(tau: number, indoorTemp: number, targetTemp: number, c: PreHeatConditions): number {
  const goal = targetTemp - PREHEAT_GOAL_MARGIN;
  if (indoorTemp >= goal) return 0;
  const tEq = c.outdoorTemp + (c.maxHeatingPowerKw + c.pInt) / c.UA;
  if (tEq <= goal) return Infinity;
  return tau * Math.log((tEq - indoorTemp) / (tEq - goal));
}

function blendedPreHeatHours(
  tau: number,
  indoorTemp: number,
  targetTemp: number,
  c: PreHeatConditions,
  maxHours: number,
): number {
  const delta = targetTemp - indoorTemp;
  const classes = calculatePreHeatDuration(tau, delta, maxHours);
  const w = Math.max(0, Math.min(1, (delta - PREHEAT_BLEND_START) / PREHEAT_BLEND_WIDTH));
  if (w === 0) return classes;
  const physical = physicalPreHeatHours(tau, indoorTemp, targetTemp, c);
  if (!Number.isFinite(physical)) return Infinity;
  return (1 - w) * classes + w * physical;
}

function isValidConditions(c: PreHeatConditions | null | undefined): c is PreHeatConditions {
  return !!c
    && Number.isFinite(c.UA) && c.UA > 0
    && Number.isFinite(c.pInt)
    && Number.isFinite(c.outdoorTemp)
    && Number.isFinite(c.maxHeatingPowerKw) && c.maxHeatingPowerKw > 0;
}

/**
 * Pre-heat duration from the building model, the outdoor temperature and the measured heating power
 * (G14, ADR-062 B7). Without conditions it falls back to the empirical classes.
 *
 * - Rises up to 0.5 °C use the classes; from 1.5 °C the physical estimate; a smooth blend in between.
 * - The result is never shorter than for a smaller rise, so a larger rise never gives an earlier start.
 * - Unreachable with the measured power (goal at or above the equilibrium temperature): maxHours.
 *
 * @param tau - Building time constant in hours (C/UA)
 * @param indoorTemp - Current indoor temperature (°C)
 * @param targetTemp - Target indoor temperature (°C)
 * @param conditions - Current conditions, or null when no power history is available yet
 * @param maxHours - Maximum duration cap (default: 48 hours)
 */
export function estimatePreHeatDuration(
  tau: number,
  indoorTemp: number,
  targetTemp: number,
  conditions: PreHeatConditions | null,
  maxHours: number = 48,
): number {
  const delta = targetTemp - indoorTemp;
  if (!isValidConditions(conditions)) {
    return calculatePreHeatDuration(tau, delta, maxHours);
  }
  if (!Number.isFinite(delta) || delta <= 0) {
    return 0;
  }
  const effectiveTau = Number.isFinite(tau) && tau > 0 ? tau : 20;

  let hours = blendedPreHeatHours(effectiveTau, indoorTemp, targetTemp, conditions, maxHours);
  for (let d = PREHEAT_BLEND_START; d < delta && hours < maxHours; d += PREHEAT_MONOTONE_STEP) {
    hours = Math.max(hours, blendedPreHeatHours(effectiveTau, targetTemp - d, targetTemp, conditions, maxHours));
  }
  return Math.min(maxHours, hours);
}
