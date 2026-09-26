/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
/**
 * Weighted Decision Maker - Integration Component for Adaptive Control
 *
 * Combines recommendations from all 4 controllers into a single weighted decision:
 * - Component 1: HeatingController (PI temperature control)
 * - Component 2: BuildingModelLearner (thermal predictions)
 * - Component 3: EnergyPriceOptimizer (cost optimization)
 * - Component 4: COPOptimizer (efficiency optimization)
 *
 * Default priorities:
 * - 60% Comfort (HeatingController) - Always highest priority
 * - 25% Efficiency (COPOptimizer) - Within comfort bounds
 * - 15% Cost (EnergyPriceOptimizer) - Within comfort + efficiency bounds
 *
 * @version 1.4.0
 * @since 1.4.0
 */

import type { ControllerAction } from './heating-controller';
import type { PriceAction } from './energy-price-optimizer';
import type { COPAction } from './cop-optimizer';

export interface WeightedPriorities {
  comfort: number; // 0.0 - 1.0
  efficiency: number; // 0.0 - 1.0
  cost: number; // 0.0 - 1.0
  thermal?: number; // 0.0 - 1.0 (v2.6.0: building model component)
}

/**
 * Confidence metrics for adaptive weighting
 * Allows reducing influence of optimizers with insufficient data
 *
 * @version 2.4.14
 * @since 2.4.14
 */
export interface ConfidenceMetrics {
  copConfidence: number; // 0.0 - 1.0 (COP optimizer confidence based on sample quality)
  buildingModelConfidence: number; // 0.0 - 1.0 (Building model confidence from RLS)
  priceDataAvailable: boolean; // Whether energy price data is available
}

export interface CoastAction {
  adjustment: number; // (uitlaatTemp − offset) − huidigSetpoint (always negative when coast active)
  reason: string;
  priority: 'high';
  strength: number; // 0.0–1.0, share of total weight (default: 0.80)
}

export interface CombinedAction {
  finalAdjustment: number; // °C to adjust target_temperature
  breakdown: {
    comfort: number;
    efficiency: number;
    cost: number;
    thermal?: number; // v2.6.0: building model component
    coast?: number; // v2.10.0: passive cooldown coast component
    wind?: number; // ADR-059 W3: unweighted additive wind correction (applied after weighting)
  };
  reasoning: string[];
  priority: 'low' | 'medium' | 'high';
  effectiveWeights?: { // Added v2.4.14 - shows confidence-adjusted weights
    comfort: number;
    efficiency: number;
    cost: number;
    thermal?: number; // v2.6.0
    coast?: number; // v2.10.0
  };
}

/**
 * Weighted Decision Maker
 *
 * Combines multiple controller recommendations into a single action using
 * configurable weighted priorities.
 */
export class WeightedDecisionMaker {
  private priorities: WeightedPriorities;

  constructor(priorities: WeightedPriorities) {
    // Normalize priorities to sum to 1.0
    const total = priorities.comfort + priorities.efficiency + priorities.cost + (priorities.thermal ?? 0);
    this.priorities = {
      comfort: priorities.comfort / total,
      efficiency: priorities.efficiency / total,
      cost: priorities.cost / total,
      thermal: priorities.thermal ? priorities.thermal / total : undefined,
    };
  }

  /**
   * Combine all controller actions with thermal component (4-way weighting)
   * v2.6.0: Building model integration
   *
   * Weights: comfort=50%, efficiency=15%, cost=15%, thermal=20%
   * Dynamic cost multiplier: ×2-3 for reduce, ×1.2-1.5 for preheat
   * (when all components have sufficient confidence)
   *
   * @param heatingAction - PI controller action (always trusted)
   * @param copAction - COP optimizer action
   * @param priceAction - Energy price optimizer action
   * @param thermalAction - Building model thermal action
   * @param confidenceMetrics - Confidence levels for adaptive weighting
   * @returns Combined action with 4-component breakdown
   *
   * @version 2.7.0
   * @since 2.7.0
   */
  public combineActionsWithThermal(
    heatingAction: ControllerAction | null,
    copAction: COPAction | null,
    priceAction: PriceAction | null,
    thermalAction: { adjustment: number; reason: string; priority: 'low' | 'medium' | 'high' } | null,
    confidenceMetrics: ConfidenceMetrics,
    coastAction?: CoastAction | null, // v2.10.0: optional passive cooldown coast component
  ): CombinedAction {
    const reasoning: string[] = [];

    // Extract adjustments from each controller
    const comfortAdjust = heatingAction?.temperatureAdjustment || 0;
    const efficiencyAdjust = this.extractCOPAdjustment(copAction);
    const costAdjust = this.extractPriceAdjustment(priceAction);
    const thermalAdjust = thermalAction?.adjustment || 0;

    // =========================================================================
    // 5-WAY CONFIDENCE-AWARE WEIGHT ADJUSTMENT
    // v2.10.0: Coast scales all existing weights to (1 - coastStrength).
    // When coastAction is null: coastStrength=0, existingScale=1.0 → identical to prior behaviour.
    // =========================================================================

    // Use configured priorities (or fallback to defaults if thermal not configured)
    const basePriorities = {
      comfort: this.priorities.comfort,
      efficiency: this.priorities.efficiency,
      cost: this.priorities.cost,
      thermal: this.priorities.thermal ?? 0.20,
    };

    // v2.6.0: Dynamic cost multiplier based on price action urgency
    // - reduce action = high prices → boost cost weight ×2.0-3.0
    // - preheat action = low prices → boost cost weight ×1.5
    // - maintain = normal → no boost
    let costMultiplier = 1.0;
    if (priceAction) {
      if (priceAction.action === 'reduce') {
        // High prices - stronger reduce response
        costMultiplier = priceAction.priority === 'high' ? 3.0 : 2.0;
      } else if (priceAction.action === 'preheat') {
        // Low prices - moderate preheat boost
        costMultiplier = priceAction.priority === 'high' ? 1.5 : 1.2;
      }
    }

    // =========================================================================
    // ADR-059 W2: Fixed comfort anchor — the PI contribution is NOT renormalized
    // against optimizer confidence. Renormalizing made the effective loop gain
    // (Kp × comfort weight) drift between ~0.35× and ~0.95× depending on data
    // availability, making PI tuning unpredictable. The anchor keeps the loop
    // gain constant; only the optimizers renormalize within their own budget.
    // Coast keeps its displacement mechanism (ADR-024/040A, intentional design).
    // =========================================================================
    const coastAdjust = coastAction?.adjustment ?? 0;
    // ADR-040A: Coast krijgt alleen gewicht wanneer het daadwerkelijk bijdraagt (coastAdjust < 0).
    // Bij hydraulische vertraging na setpoint-verlaging is coastAdjust = 0 — dan geldt het normale anker.
    const effectiveCoastWeight = (coastAdjust < 0) ? (coastAction?.strength ?? 0) : 0;
    const existingScale = 1 - effectiveCoastWeight;

    // Comfort anchor: comfort share within the classic trio (comfort/efficiency/cost,
    // default 0.6/0.25/0.15 → anchor 0.6). ADR-060: deliberately EXCLUDES thermal from
    // the denominator — the constructor normalizes over all four priorities (total 1.2),
    // which silently lowered the anchor to 0.5 and the effective loop gain to Kp × 0.5.
    // Thermal competes within the optimizer budget like the other optimizers.
    const trioTotal = this.priorities.comfort + this.priorities.efficiency + this.priorities.cost;
    const comfortAnchor = trioTotal > 0 ? this.priorities.comfort / trioTotal : 0.6;

    // Optimizers renormalize within their own budget (1 - anchor); an unavailable
    // optimizer redistributes to the other optimizers, never to comfort
    const rawEfficiency = basePriorities.efficiency * confidenceMetrics.copConfidence;
    const rawCost = basePriorities.cost * costMultiplier * (confidenceMetrics.priceDataAvailable ? 1.0 : 0.0);
    const rawThermal = basePriorities.thermal * (confidenceMetrics.buildingModelConfidence >= 0.5 ? 1.0 : 0.0);
    const rawOptimizerSum = rawEfficiency + rawCost + rawThermal;
    const optimizerBudget = (1 - comfortAnchor) * existingScale;

    const normalizedWeights = {
      comfort: comfortAnchor * existingScale,
      efficiency: rawOptimizerSum > 0 ? (rawEfficiency / rawOptimizerSum) * optimizerBudget : 0,
      cost: rawOptimizerSum > 0 ? (rawCost / rawOptimizerSum) * optimizerBudget : 0,
      thermal: rawOptimizerSum > 0 ? (rawThermal / rawOptimizerSum) * optimizerBudget : 0,
      coast: effectiveCoastWeight,
    };

    // Add reasoning for each component WITH weight percentages
    const comfortPct = Math.round(normalizedWeights.comfort * 100);
    const efficiencyPct = Math.round(normalizedWeights.efficiency * 100);
    const costPct = Math.round(normalizedWeights.cost * 100);
    const thermalPct = Math.round(normalizedWeights.thermal * 100);
    const coastPct = Math.round(normalizedWeights.coast * 100);

    // Cost multiplier indicator for transparency
    const costMultiplierStr = costMultiplier > 1 ? `×${costMultiplier.toFixed(0)}` : '';

    if (heatingAction) {
      reasoning.push(`Comfort (${comfortPct}%): ${heatingAction.reason}`);
    }
    if (copAction && copAction.action !== 'maintain') {
      reasoning.push(`Efficiency (${efficiencyPct}%): ${copAction.reason}`);
    }
    if (priceAction && priceAction.action !== 'maintain') {
      reasoning.push(`Cost (${costPct}%${costMultiplierStr}): ${priceAction.reason}`);
    }
    if (thermalAction && thermalAction.adjustment !== 0) {
      reasoning.push(`Thermal (${thermalPct}%): ${thermalAction.reason}`);
    } else if (confidenceMetrics.buildingModelConfidence < 0.5) {
      reasoning.push('⚠️ Thermal (0%): conf <50%, disabled');
    }
    if (coastAction) {
      reasoning.push(`Coast (${coastPct}%): ${coastAction.reason}`);
    }

    // Apply normalized weights (5-way)
    const finalAdjustment = comfortAdjust * normalizedWeights.comfort
      + efficiencyAdjust * normalizedWeights.efficiency
      + costAdjust * normalizedWeights.cost
      + thermalAdjust * normalizedWeights.thermal
      + coastAdjust * normalizedWeights.coast;

    // Determine overall priority (highest wins)
    const allPriorities = [
      heatingAction?.priority,
      copAction?.priority,
      priceAction?.priority,
      thermalAction?.priority,
      coastAction?.priority,
    ].filter(Boolean) as ('low' | 'medium' | 'high')[];

    let priority: 'low' | 'medium' | 'high' = 'low';
    if (allPriorities.includes('high')) priority = 'high';
    else if (allPriorities.includes('medium')) priority = 'medium';

    return {
      finalAdjustment,
      breakdown: {
        comfort: comfortAdjust * normalizedWeights.comfort,
        efficiency: efficiencyAdjust * normalizedWeights.efficiency,
        cost: costAdjust * normalizedWeights.cost,
        thermal: thermalAdjust * normalizedWeights.thermal,
        coast: coastAdjust * normalizedWeights.coast,
      },
      reasoning,
      priority,
      effectiveWeights: normalizedWeights,
    };
  }

  /**
   * Extract temperature adjustment from COP action
   *
   * COP controller adjusts supply temp, which maps approximately 1:1 to target temp
   * (lower supply = lower target for comparable results)
   */
  private extractCOPAdjustment(action: COPAction | null): number {
    if (!action || action.action === 'maintain') return 0;

    // COP actions adjust supply temp - map to target temp adjustment
    return action.action === 'decrease' ? -action.magnitude : action.magnitude;
  }

  /**
   * Extract temperature adjustment from price action
   */
  private extractPriceAdjustment(action: PriceAction | null): number {
    if (!action || action.action === 'maintain') return 0;

    // Price optimizer already provides target temp adjustment
    return action.magnitude;
  }

  /**
   * Update priorities
   *
   * Automatically normalizes to ensure sum = 1.0
   */
  public setPriorities(priorities: WeightedPriorities): void {
    const total = priorities.comfort + priorities.efficiency + priorities.cost + (priorities.thermal ?? 0);
    this.priorities = {
      comfort: priorities.comfort / total,
      efficiency: priorities.efficiency / total,
      cost: priorities.cost / total,
      thermal: priorities.thermal ? priorities.thermal / total : undefined,
    };
  }

  /**
   * Get current priorities (normalized)
   */
  public getPriorities(): WeightedPriorities {
    return { ...this.priorities };
  }

  /**
   * Destroy and release all state (v2.0.1+)
   *
   * Called during device deletion for consistency.
   * Resets priorities to defaults.
   */
  public destroy(): void {
    // Reset to neutral priorities
    this.priorities = {
      comfort: 0.6, efficiency: 0.25, cost: 0.15, thermal: undefined,
    };
  }
}
