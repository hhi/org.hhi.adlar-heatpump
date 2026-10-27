/**
 * Classification of building model blocking reasons (v3.4.3)
 *
 * A sample that does not reach the learner carries a blocking reason (locale key
 * building_model.blocked_*). Some reasons belong to normal operation and last only a
 * cycle or two: a compressor start without flow (no COP), a defrost cycle, a hot-water
 * run or auxiliary heating. Building insights show those only once they persist, so a
 * single skipped sample no longer replaces every insight with "Blocked" until the next
 * evaluation (50 min). Reasons that need user action (missing source, learning
 * disabled) are shown immediately.
 *
 * @module lib/shared/adaptive/building-model-blocking
 */

/** Blocking reasons that are part of normal operation and usually short-lived */
export const TRANSIENT_BLOCKING_KEYS: ReadonlySet<string> = new Set([
  'building_model.blocked_no_cop',
  'building_model.blocked_defrost',
  'building_model.blocked_dhw_active',
  'building_model.blocked_dhw_mode',
  'building_model.blocked_aux_heating',
]);

/** Consecutive blocked cycles (5 min each) before a transient reason is shown: 30 min */
export const TRANSIENT_BLOCK_CYCLES = 6;

/** True when the blocking reason is part of normal operation (see TRANSIENT_BLOCKING_KEYS) */
export function isTransientBlockingKey(key: string | null): boolean {
  return key !== null && TRANSIENT_BLOCKING_KEYS.has(key);
}

/** Minimal diagnostics needed to decide whether insights show the blocked status */
export interface BlockingDiagnostics {
  blockingReason: string | null;
  blockingReasonKey: string | null;
  blockingStreak: number;
  sampleCount: number;
}

/**
 * True when building insights should show the blocked status instead of an insight:
 * - never during the initial sample phase ("Collecting initial samples (n/10)");
 * - immediately for reasons that need user action;
 * - for transient reasons only after TRANSIENT_BLOCK_CYCLES consecutive blocked cycles.
 */
export function shouldShowBlocked(diagnostics: BlockingDiagnostics): boolean {
  if (!diagnostics.blockingReason) return false;
  if (diagnostics.blockingReason === `Collecting initial samples (${diagnostics.sampleCount}/10)`) return false;
  if (!isTransientBlockingKey(diagnostics.blockingReasonKey)) return true;
  return diagnostics.blockingStreak >= TRANSIENT_BLOCK_CYCLES;
}
