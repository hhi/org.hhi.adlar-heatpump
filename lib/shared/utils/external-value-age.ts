/* eslint-disable import/prefer-default-export */
/**
 * Age check for values that flow cards push into the app (e.g. the external outdoor temperature)
 *
 * @module lib/shared/utils/external-value-age
 */

/**
 * Whether a flow-card value received at `timestamp` is still fresh at `now`
 *
 * A missing or invalid timestamp counts as stale: the age of the value is unknown.
 */
export function isExternalValueFresh(timestamp: unknown, now: number, ttlMs: number): boolean {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return false;
  return now - timestamp <= ttlMs;
}
