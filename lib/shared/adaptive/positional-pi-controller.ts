/**
 * ADR-065: positional PI with a true integral on top of the heating curve, shared by all three drivers.
 *
 *   recommendation = round( clamp( basis + correction, setpoint range ) )
 *   u = clamp( Kp·e + I, ±Umax )                      e = desired indoor − indoor (°C)
 *   I = clamp( I + Ki·e, ±Imax ) per cycle            Ki = Kp / (Ti in cycles)
 *
 * The integral is not updated (anti-windup, D3) when |e| ≤ 0.1 °C, when the observed setpoint is
 * more than 1 °C away from the previous recommendation (the user's flow lags or does not apply it),
 * when the previous recommendation sat at a setpoint limit in the direction of the error, or while
 * the caller pauses it (coast, defrost, domestic hot water). There is no other dead zone (D4).
 */

/** Tuning of the positional PI. */
export interface PositionalPIParams {
  kp: number; // K/K
  tiHours: number; // integral time
}

export interface PositionalPIOptions {
  cycleMinutes?: number; // control cycle, default 5
  iMax?: number; // K, default 6
  uMax?: number; // K, default 8
  integrationThreshold?: number; // °C, default 0.1
  flowLagThreshold?: number; // °C, default 1
}

/** Why the integral was not updated in a cycle. */
export type IntegralHoldReason = 'small_error' | 'flow_behind' | 'at_limit' | 'coast' | 'defrost' | 'dhw';

/** Reasons the caller can pass to pause the integral. */
export type IntegralPauseReason = 'coast' | 'defrost' | 'dhw';

export interface PositionalPIInput {
  error: number; // desired indoor − indoor (°C)
  currentSetpoint: number | null; // setpoint observed on the heat pump
  lastRecommendation: number | null; // previous rounded recommendation
  lastRawRecommendation: number | null; // previous recommendation before rounding and clamping
  range: { min: number; max: number } | null; // effective setpoint range
  pause?: IntegralPauseReason | null;
}

export interface PositionalPIStep {
  error: number;
  p: number; // Kp·e
  i: number; // integral after this cycle
  u: number; // clamped PI output
  integrated: boolean;
  holdReason: IntegralHoldReason | null;
}

const DEFAULTS: Required<PositionalPIOptions> = {
  cycleMinutes: 5,
  iMax: 6,
  uMax: 8,
  integrationThreshold: 0.1,
  flowLagThreshold: 1,
};

const clamp = (value: number, limit: number): number => Math.max(-limit, Math.min(limit, value));

export class PositionalPIController {
  private params: PositionalPIParams;
  private readonly options: Required<PositionalPIOptions>;
  private integral = 0;

  constructor(params: PositionalPIParams, options: PositionalPIOptions = {}) {
    this.params = { ...params };
    this.options = { ...DEFAULTS, ...options };
  }

  setParams(params: PositionalPIParams): void {
    this.params = { ...params };
  }

  getParams(): PositionalPIParams {
    return { ...this.params };
  }

  /** Ki per cycle: Kp divided by Ti expressed in cycles. */
  get ki(): number {
    const cycles = (this.params.tiHours * 60) / this.options.cycleMinutes;
    return cycles > 0 ? this.params.kp / cycles : 0;
  }

  getIntegral(): number {
    return this.integral;
  }

  /** Restores a persisted integral, clamped to ±Imax. */
  restoreIntegral(value: number): void {
    this.integral = Number.isFinite(value) ? clamp(value, this.options.iMax) : 0;
  }

  reset(): void {
    this.integral = 0;
  }

  /** PI output for an error without updating the integral (e.g. the coast reference). */
  output(error: number): number {
    return clamp(this.params.kp * error + this.integral, this.options.uMax);
  }

  /** One control cycle: conditional integration, then the clamped output. */
  step(input: PositionalPIInput): PositionalPIStep {
    const holdReason = this.holdReason(input);
    if (holdReason === null) {
      this.integral = clamp(this.integral + this.ki * input.error, this.options.iMax);
    }
    const p = this.params.kp * input.error;
    return {
      error: input.error,
      p,
      i: this.integral,
      u: clamp(p + this.integral, this.options.uMax),
      integrated: holdReason === null,
      holdReason,
    };
  }

  private holdReason(input: PositionalPIInput): IntegralHoldReason | null {
    if (input.pause) return input.pause;
    if (Math.abs(input.error) <= this.options.integrationThreshold) return 'small_error';
    if (input.currentSetpoint !== null && input.lastRecommendation !== null
      && Math.abs(input.currentSetpoint - input.lastRecommendation) > this.options.flowLagThreshold) {
      return 'flow_behind';
    }
    const last = input.lastRawRecommendation;
    if (last !== null && input.range
      && ((last >= input.range.max && input.error > 0) || (last <= input.range.min && input.error < 0))) {
      return 'at_limit';
    }
    return null;
  }
}

// ============================================================================
// Emitter presets (ADR-065 D8)
// ============================================================================

export type ControlMode = 'classic' | 'positional';
export type EmitterType = 'radiator' | 'floor' | 'manual';

/** Preset per emitter type: Ti and coast depend strongly on the emitter, Kp hardly (ADR-065 §3.3). */
export const EMITTER_PRESETS: Record<Exclude<EmitterType, 'manual'>, PositionalPIParams & { coastEnabled: boolean }> = {
  radiator: { kp: 3, tiHours: 3, coastEnabled: false },
  floor: { kp: 3, tiHours: 6, coastEnabled: true },
};

export const POSITIONAL_DEFAULTS = { kp: 3, tiHours: 3 };

/** Settings read by resolveControlParams (values as stored by Homey, possibly missing). */
/* eslint-disable camelcase */
export interface ControlSettings {
  adaptive_control_mode?: unknown;
  adaptive_pos_kp?: unknown;
  adaptive_pos_ti?: unknown;
  adaptive_coast_enabled?: unknown;
}
/* eslint-enable camelcase */

export interface ControlParams extends PositionalPIParams {
  mode: ControlMode;
  emitter: EmitterType;
  coastEnabled: boolean;
  source: 'preset' | 'manual';
}

const asNumber = (value: unknown, fallback: number): number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
);

/**
 * Effective control parameters from the single control setting (ADR-065 D8, opzet B):
 * positional_radiator and positional_floor use their preset and ignore the fields;
 * positional_manual uses adaptive_pos_kp, adaptive_pos_ti and adaptive_coast_enabled. Classic
 * (also for a missing or unknown value) keeps its own Kp and Ki; only the coast switch applies.
 */
export function resolveControlParams(settings: ControlSettings): ControlParams {
  const value = settings.adaptive_control_mode;
  if (value === 'positional_radiator' || value === 'positional_floor') {
    const emitter = value === 'positional_radiator' ? 'radiator' : 'floor';
    const preset = EMITTER_PRESETS[emitter];
    return {
      mode: 'positional', emitter, source: 'preset', kp: preset.kp, tiHours: preset.tiHours, coastEnabled: preset.coastEnabled,
    };
  }
  return {
    mode: value === 'positional_manual' ? 'positional' : 'classic',
    emitter: 'manual',
    source: 'manual',
    kp: asNumber(settings.adaptive_pos_kp, POSITIONAL_DEFAULTS.kp),
    tiHours: asNumber(settings.adaptive_pos_ti, POSITIONAL_DEFAULTS.tiHours),
    coastEnabled: settings.adaptive_coast_enabled !== false,
  };
}

// ============================================================================
// Basis: heating curve (ADR-065 D1/O2)
// ============================================================================

export type BasisSource = 'heat_pump_curve' | 'app_curve' | 'flat';

export interface CurveBasis {
  value: number; // °C
  source: BasisSource;
}

/** Default app curve (°C at −15 °C and +15 °C outdoor); the integral absorbs an offset (ADR-065 §3.3). */
export const APP_CURVE_DEFAULTS = { atMinus15: 40, atPlus15: 25 };

/** Plausible range for a curve setpoint (°C). */
const CURVE_PLAUSIBLE_MIN_C = 15;
const CURVE_PLAUSIBLE_MAX_C = 70;

/** A curve setpoint, or null when missing or implausible (wrong scale, unset parameters). */
export function plausibleCurveValue(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return value >= CURVE_PLAUSIBLE_MIN_C && value <= CURVE_PLAUSIBLE_MAX_C ? value : null;
}

/**
 * App heating curve through two points: supply temperature at −15 °C and at +15 °C outdoor.
 * Same form as the Aurora II DIY curve k·(T + 15) + b, with b = the value at −15 °C.
 */
export function appCurveValue(atMinus15: number, atPlus15: number, outdoorTemp: number): number {
  const k = (atPlus15 - atMinus15) / 30;
  return k * (outdoorTemp + 15) + atMinus15;
}

export interface BasisInputs {
  curveSource: 'auto' | 'app';
  heatPumpCurve: number | null; // value of the heat pump's own curve at the current outdoor temperature
  appCurve: { atMinus15: number; atPlus15: number };
  outdoorTemp: number | null;
  flatBasis: number | null; // setpoint stored when the positional mode started
}

/**
 * Basis for the recommendation. 'auto': the heat pump's curve when plausible, else a flat line on
 * the setpoint at activation. 'app': the app curve at the current outdoor temperature (flat when
 * no outdoor temperature is known). Null when nothing is available yet.
 */
export function resolveBasis(inputs: BasisInputs): CurveBasis | null {
  if (inputs.curveSource === 'app' && inputs.outdoorTemp !== null) {
    const value = plausibleCurveValue(appCurveValue(inputs.appCurve.atMinus15, inputs.appCurve.atPlus15, inputs.outdoorTemp));
    if (value !== null) return { value, source: 'app_curve' };
  }
  if (inputs.curveSource === 'auto') {
    const value = plausibleCurveValue(inputs.heatPumpCurve);
    if (value !== null) return { value, source: 'heat_pump_curve' };
  }
  return inputs.flatBasis !== null ? { value: inputs.flatBasis, source: 'flat' } : null;
}
