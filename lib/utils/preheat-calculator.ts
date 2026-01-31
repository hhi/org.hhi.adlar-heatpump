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
