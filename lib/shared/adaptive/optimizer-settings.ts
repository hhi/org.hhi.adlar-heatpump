/**
 * Device settings of the COP optimizer and the price optimizer (ADR-067 D1), shared by all three
 * drivers. Each function turns a stored setting into the value the optimizer works with; a missing
 * or unusable value falls back to the default of the setting.
 */

export type CopStrategy = 'conservative' | 'balanced' | 'aggressive';

export const DEFAULT_COP_MIN_ACCEPTABLE = 2.5;
export const DEFAULT_COP_TARGET = 3.5;
export const DEFAULT_COP_STRATEGY: CopStrategy = 'balanced';
export const DEFAULT_MAX_PREHEAT_OFFSET = 1.5;

const COP_STRATEGIES: readonly CopStrategy[] = ['conservative', 'balanced', 'aggressive'];

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Setting cop_min_acceptable: below this COP the optimizer intervenes. */
export function resolveCopMinAcceptable(value: unknown): number {
  return numberOr(value, DEFAULT_COP_MIN_ACCEPTABLE);
}

/** Setting cop_target: the COP the optimizer works toward. */
export function resolveCopTarget(value: unknown): number {
  return numberOr(value, DEFAULT_COP_TARGET);
}

/** Setting cop_strategy: how large the steps of the optimizer are. */
export function resolveCopStrategy(value: unknown): CopStrategy {
  return COP_STRATEGIES.find((strategy) => strategy === value) ?? DEFAULT_COP_STRATEGY;
}

/** Setting price_max_preheat_offset: highest pre-heat in °C; never negative. */
export function resolveMaxPreHeatOffset(value: unknown): number {
  return Math.max(0, numberOr(value, DEFAULT_MAX_PREHEAT_OFFSET));
}

/** The three COP settings as the optimizer takes them at construction. */
export function resolveCopOptimizerSettings(getSetting: (key: string) => unknown): {
  minAcceptableCOP: number;
  targetCOP: number;
  strategy: CopStrategy;
} {
  return {
    minAcceptableCOP: resolveCopMinAcceptable(getSetting('cop_min_acceptable')),
    targetCOP: resolveCopTarget(getSetting('cop_target')),
    strategy: resolveCopStrategy(getSetting('cop_strategy')),
  };
}
