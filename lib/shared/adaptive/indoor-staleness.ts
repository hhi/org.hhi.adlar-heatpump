/* eslint-disable import/prefer-default-export */

/**
 * ADR-067 D2 (R27): an indoor sensor that has stopped (empty battery, a flow that keeps sending the
 * last value) shows up as an indoor temperature that does not change. The incoming flow is trusted;
 * only a value that stays equal for an implausibly long time is not.
 */

/** Hours without a change after which the user is told */
export const INDOOR_UNCHANGED_WARN_HOURS = 12;

/** Hours without a change after which control and learning stop using the value */
export const INDOOR_UNCHANGED_STALE_HOURS = 24;

/** Store key: time (ms) at which the received indoor temperature last differed from the previous one */
export const STORE_KEY_INDOOR_CHANGED_AT = 'external_indoor_temp_changed_at';

/** Reason in adaptive_control_diagnostics while the control does not correct on the indoor temperature */
export const SKIP_REASON_INDOOR_UNCHANGED = 'indoor_temperature_unchanged';

export type IndoorStaleness = 'fresh' | 'warn' | 'stale';

const HOUR_MS = 60 * 60 * 1000;

/**
 * @param unchangedMs - Time since the indoor temperature last changed; null when unknown
 */
export function classifyIndoorStaleness(unchangedMs: number | null): IndoorStaleness {
  if (unchangedMs === null || !Number.isFinite(unchangedMs)) return 'fresh';
  if (unchangedMs >= INDOOR_UNCHANGED_STALE_HOURS * HOUR_MS) return 'stale';
  if (unchangedMs >= INDOOR_UNCHANGED_WARN_HOURS * HOUR_MS) return 'warn';
  return 'fresh';
}

/** True when two received indoor temperatures count as the same reading */
export function sameIndoorReading(previous: number | null | undefined, next: number): boolean {
  return typeof previous === 'number' && Math.abs(previous - next) < 0.005;
}
