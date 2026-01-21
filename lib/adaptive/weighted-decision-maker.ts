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

export interface CombinedAction {
  finalAdjustment: number; // °C to adjust target_temperature
  breakdown: {
    comfort: number;
    efficiency: number;
    cost: number;
    thermal?: number; // v2.6.0: building model component
  };
  reasoning: string[];
  priority: 'low' | 'medium' | 'high';
  effectiveWeights?: { // Added v2.4.14 - shows confidence-adjusted weights
    comfort: number;
    efficiency: number;
    cost: number;
    thermal?: number; // v2.6.0
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
    const total = priorities.comfort + priorities.efficiency + priorities.cost;
    this.priorities = {
      comfort: priorities.comfort / total,
      efficiency: priorities.efficiency / total,
      cost: priorities.cost / total,
    };
  }

  /**
   * Combine all controller actions into single weighted decision
   * WITH confidence-aware weighting (v2.4.14+)
   *
   * Reduces influence of optimizers with low confidence:
   * - COP optimizer with few samples gets reduced weight
   * - Building model with low confidence gets reduced weight
   * - Energy price without data gets zero weight
   * Unused weights are redistributed to comfort (safe fallback)
   *
   * @param heatingAction - PI controller action (always trusted)
   * @param copAction - COP optimizer action
   * @param priceAction - Energy price optimizer action
   * @param confidenceMetrics - Confidence levels for adaptive weighting
   * @returns Combined action with effective weights
   *
   * @version 2.4.14
   * @since 2.4.14
   */
  public combineActionsWithConfidence(
    heatingAction: ControllerAction | null,
    copAction: COPAction | null,
    priceAction: PriceAction | null,
    confidenceMetrics: ConfidenceMetrics,
  ): CombinedAction {
    const reasoning: string[] = [];

    // Extract adjustments from each controller
    const comfortAdjust = heatingAction?.temperatureAdjustment || 0;
    const efficiencyAdjust = this.extractCOPAdjustment(copAction);
    const costAdjust = this.extractPriceAdjustment(priceAction);

    // =========================================================================
    // CONFIDENCE-AWARE WEIGHT ADJUSTMENT
    // Reduce weights for low-confidence optimizers, redistribute to comfort
    // =========================================================================

    // Apply confidence multipliers to configured weights
    const effectiveEfficiencyWeight = this.priorities.efficiency * confidenceMetrics.copConfidence;
    const effectiveCostWeight = this.priorities.cost * (confidenceMetrics.priceDataAvailable ? 1.0 : 0.0);

    // Calculate total effective weight (comfort always at full weight)
    const totalEffectiveWeight = this.priorities.comfort + effectiveEfficiencyWeight + effectiveCostWeight;

    // Normalize weights to sum to 1.0 (redistributes unused weight to comfort)
    const normalizedWeights = {
      comfort: this.priorities.comfort / totalEffectiveWeight,
      efficiency: effectiveEfficiencyWeight / totalEffectiveWeight,
      cost: effectiveCostWeight / totalEffectiveWeight,
    };

    // Add reasoning for each component
    if (heatingAction) {
      reasoning.push(`Comfort: ${heatingAction.reason}`);
    }
    if (copAction && copAction.action !== 'maintain') {
      reasoning.push(`Efficiency: ${copAction.reason}`);
      // Add confidence warning if COP confidence is low
      if (confidenceMetrics.copConfidence < 0.3) {
        reasoning.push(`⚠️ COP optimizer has low confidence (${(confidenceMetrics.copConfidence * 100).toFixed(0)}%), reduced weight`);
      }
    }
    if (priceAction && priceAction.action !== 'maintain') {
      reasoning.push(`Cost: ${priceAction.reason}`);
    } else if (!confidenceMetrics.priceDataAvailable) {
      reasoning.push('Cost: No price data available, weight redistributed to comfort');
    }

    // Apply normalized weights (confidence-adjusted)
    const finalAdjustment = comfortAdjust * normalizedWeights.comfort
      + efficiencyAdjust * normalizedWeights.efficiency
      + costAdjust * normalizedWeights.cost;

    // Determine overall priority (highest wins)
    const priority = this.determinePriority(heatingAction, copAction, priceAction);

    return {
      finalAdjustment,
      breakdown: {
        comfort: comfortAdjust * normalizedWeights.comfort,
        efficiency: efficiencyAdjust * normalizedWeights.efficiency,
        cost: costAdjust * normalizedWeights.cost,
      },
      reasoning,
      priority,
      effectiveWeights: normalizedWeights, // Show confidence-adjusted weights
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
  ): CombinedAction {
    const reasoning: string[] = [];

    // Extract adjustments from each controller
    const comfortAdjust = heatingAction?.temperatureAdjustment || 0;
    const efficiencyAdjust = this.extractCOPAdjustment(copAction);
    const costAdjust = this.extractPriceAdjustment(priceAction);
    const thermalAdjust = thermalAction?.adjustment || 0;

    // =========================================================================
    // 4-WAY CONFIDENCE-AWARE WEIGHT ADJUSTMENT
    // Reduce weights for low-confidence optimizers, redistribute to comfort
    // =========================================================================

    // Default priorities for 4-way: comfort=50%, efficiency=15%, cost=15%, thermal=20%
    const basePriorities = {
      comfort: this.priorities.thermal !== undefined ? 0.50 : this.priorities.comfort,
      efficiency: this.priorities.thermal !== undefined ? 0.15 : this.priorities.efficiency,
      cost: this.priorities.thermal !== undefined ? 0.15 : this.priorities.cost,
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

    // Apply confidence multipliers
    const effectiveEfficiencyWeight = basePriorities.efficiency * confidenceMetrics.copConfidence;
    const effectiveCostWeight = basePriorities.cost * costMultiplier * (confidenceMetrics.priceDataAvailable ? 1.0 : 0.0);
    const effectiveThermalWeight = basePriorities.thermal * (confidenceMetrics.buildingModelConfidence >= 0.5 ? 1.0 : 0.0);

    // Calculate total effective weight
    const totalEffectiveWeight = basePriorities.comfort + effectiveEfficiencyWeight + effectiveCostWeight + effectiveThermalWeight;

    // Normalize weights to sum to 1.0
    const normalizedWeights = {
      comfort: basePriorities.comfort / totalEffectiveWeight,
      efficiency: effectiveEfficiencyWeight / totalEffectiveWeight,
      cost: effectiveCostWeight / totalEffectiveWeight,
      thermal: effectiveThermalWeight / totalEffectiveWeight,
    };

    // Add reasoning for each component
    if (heatingAction) {
      reasoning.push(`Comfort: ${heatingAction.reason}`);
    }
    if (copAction && copAction.action !== 'maintain') {
      reasoning.push(`Efficiency: ${copAction.reason}`);
    }
    if (priceAction && priceAction.action !== 'maintain') {
      reasoning.push(`Cost: ${priceAction.reason}`);
    }
    if (thermalAction && thermalAction.adjustment !== 0) {
      reasoning.push(`${thermalAction.reason}`);
    } else if (confidenceMetrics.buildingModelConfidence < 0.5) {
      reasoning.push('⚠️ Thermal: confidence <50%, disabled');
    }

    // Apply normalized weights (4-way)
    const finalAdjustment = comfortAdjust * normalizedWeights.comfort
      + efficiencyAdjust * normalizedWeights.efficiency
      + costAdjust * normalizedWeights.cost
      + thermalAdjust * normalizedWeights.thermal;

    // Determine overall priority (highest wins)
    const allPriorities = [
      heatingAction?.priority,
      copAction?.priority,
      priceAction?.priority,
      thermalAction?.priority,
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
      },
      reasoning,
      priority,
      effectiveWeights: normalizedWeights,
    };
  }

  /**
   * Combine all controller actions into single weighted decision
   * LEGACY METHOD without confidence-aware weighting
   *
   * @deprecated Use combineActionsWithConfidence() for confidence-aware weighting
   */
  public combineActions(
    heatingAction: ControllerAction | null,
    copAction: COPAction | null,
    priceAction: PriceAction | null,
  ): CombinedAction {
    const reasoning: string[] = [];

    // Extract adjustments from each controller
    const comfortAdjust = heatingAction?.temperatureAdjustment || 0;
    const efficiencyAdjust = this.extractCOPAdjustment(copAction);
    const costAdjust = this.extractPriceAdjustment(priceAction);

    // Add reasoning for each component
    if (heatingAction) {
      reasoning.push(`Comfort: ${heatingAction.reason}`);
    }
    if (copAction && copAction.action !== 'maintain') {
      reasoning.push(`Efficiency: ${copAction.reason}`);
    }
    if (priceAction && priceAction.action !== 'maintain') {
      reasoning.push(`Cost: ${priceAction.reason}`);
    }

    // Apply weighted combination
    const finalAdjustment = comfortAdjust * this.priorities.comfort
      + efficiencyAdjust * this.priorities.efficiency
      + costAdjust * this.priorities.cost;

    // Determine overall priority (highest wins)
    const priority = this.determinePriority(heatingAction, copAction, priceAction);

    return {
      finalAdjustment,
      breakdown: {
        comfort: comfortAdjust * this.priorities.comfort,
        efficiency: efficiencyAdjust * this.priorities.efficiency,
        cost: costAdjust * this.priorities.cost,
      },
      reasoning,
      priority,
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
   * Determine overall priority from individual priorities
   *
   * Uses highest priority among all controllers
   */
  private determinePriority(
    heating: ControllerAction | null,
    cop: COPAction | null,
    price: PriceAction | null,
  ): 'low' | 'medium' | 'high' {
    // High if ANY controller says high priority
    if (heating?.priority === 'high' || cop?.priority === 'high' || price?.priority === 'high') {
      return 'high';
    }

    // Medium if ANY controller says medium
    if (heating?.priority === 'medium' || cop?.priority === 'medium' || price?.priority === 'medium') {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Update priorities
   *
   * Automatically normalizes to ensure sum = 1.0
   */
  public setPriorities(priorities: WeightedPriorities): void {
    const total = priorities.comfort + priorities.efficiency + priorities.cost;
    this.priorities = {
      comfort: priorities.comfort / total,
      efficiency: priorities.efficiency / total,
      cost: priorities.cost / total,
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
    this.priorities = { comfort: 0.6, efficiency: 0.25, cost: 0.15 };
  }
}
