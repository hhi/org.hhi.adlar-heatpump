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
}

export interface CombinedAction {
  finalAdjustment: number; // °C to adjust target_temperature
  breakdown: {
    comfort: number;
    efficiency: number;
    cost: number;
  };
  reasoning: string[];
  priority: 'low' | 'medium' | 'high';
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
