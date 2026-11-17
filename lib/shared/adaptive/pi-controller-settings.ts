/**
 * Device settings of the Classic heating controller (R31), shared by all three drivers. The
 * controller takes them at construction, so they survive a restart, and again when they change.
 * A missing value, or one outside the range the controller accepts, falls back to the default
 * of the setting.
 */

export const DEFAULT_PI_KP = 5.0;
export const DEFAULT_PI_KI = 1.5;
export const DEFAULT_PI_DEADBAND = 0.3;

function inRangeOr(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

/** Setting adaptive_pi_kp: proportional gain; the controller accepts 0.1–10. */
export function resolvePiKp(value: unknown): number {
  return inRangeOr(value, 0.1, 10, DEFAULT_PI_KP);
}

/** Setting adaptive_pi_ki: integral gain; the controller accepts 0.1–10. */
export function resolvePiKi(value: unknown): number {
  return inRangeOr(value, 0.1, 10, DEFAULT_PI_KI);
}

/**
 * Setting adaptive_pi_deadband in °C; the controller accepts 0.1–2. It only counts while the
 * building model is switched off; otherwise the controller derives the dead zone from UA.
 */
export function resolvePiDeadband(value: unknown): number {
  return inRangeOr(value, 0.1, 2, DEFAULT_PI_DEADBAND);
}

/** The three settings as the controller takes them. */
export function resolvePiControllerSettings(getSetting: (key: string) => unknown): {
  Kp: number;
  Ki: number;
  deadband: number;
} {
  return {
    Kp: resolvePiKp(getSetting('adaptive_pi_kp')),
    Ki: resolvePiKi(getSetting('adaptive_pi_ki')),
    deadband: resolvePiDeadband(getSetting('adaptive_pi_deadband')),
  };
}
