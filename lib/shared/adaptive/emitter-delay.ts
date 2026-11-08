/**
 * Emitter delay (ADR-066)
 *
 * Heat measured at the heat pump reaches the room later: a buffer tank, radiators and a floor
 * screed store it first. The building model learner gets the measured power through a
 * first-order filter with this delay. This module holds the start value from the settings and an
 * estimator that learns the delay from the accepted building-model samples.
 *
 * The estimator keeps one filter per candidate delay and one row per complete clock hour. Every
 * six hours it fits `ΔT_indoor per hour = a·P_filtered + b·(T_out − T_in) + c·solar + e·m + d` per
 * candidate by least squares. Candidates within TOLERANCE of the smallest residual explain the data
 * equally well; of those the shortest delay is chosen, and the active delay only changes when it
 * falls outside that set.
 *
 * @module lib/shared/adaptive/emitter-delay
 */

export type EmitterType = 'radiator' | 'floor' | 'unknown';

export const EMITTER_DELAY = {
  /** Start value per emitter type (minutes) */
  BASE_MINUTES: { radiator: 30, floor: 180, unknown: 60 } as Record<EmitterType, number>,
  /** Buffer tank: one minute per litre (≈ 0.07 kW/°C emitter output; rough, corrected by learning) */
  MINUTES_PER_LITRE: 1,
  MAX_MINUTES: 360,
  MAX_BUFFER_LITRES: 2000,
} as const;

/** Heat-pump modes that point to floor heating or to radiators (Tuya enum ids and Aurora I/II 0x0304) */
const FLOOR_MODES = ['floor_heating', 'floor_heatign_and_hot_water', '3', '7'];
const RADIATOR_MODES = ['heating', 'heating_and_hot_water', '1', '5'];

/**
 * Emitter type from the setting; "auto" uses the control mode (ADR-065 presets) and then the
 * heat-pump mode. Pass heatPumpMode null for a driver whose modes do not tell floor from radiators.
 */
export function resolveEmitterType(setting: unknown, controlMode: unknown, heatPumpMode: unknown): EmitterType {
  if (setting === 'radiator' || setting === 'floor') return setting;
  if (controlMode === 'positional_radiator') return 'radiator';
  if (controlMode === 'positional_floor') return 'floor';
  if (typeof heatPumpMode === 'string') {
    if (FLOOR_MODES.includes(heatPumpMode)) return 'floor';
    if (RADIATOR_MODES.includes(heatPumpMode)) return 'radiator';
  }
  return 'unknown';
}

/**
 * Start value of the emitter delay (minutes): base per emitter type plus the buffer tank.
 */
export function emitterDelayStartMinutes(type: EmitterType, bufferLitres: unknown): number {
  const litres = typeof bufferLitres === 'number' && Number.isFinite(bufferLitres)
    ? Math.min(EMITTER_DELAY.MAX_BUFFER_LITRES, Math.max(0, bufferLitres))
    : 0;
  const minutes = EMITTER_DELAY.BASE_MINUTES[type] + litres * EMITTER_DELAY.MINUTES_PER_LITRE;
  return Math.min(EMITTER_DELAY.MAX_MINUTES, Math.round(minutes));
}

export interface EmitterDelaySample {
  timestamp: number;
  tIndoor: number;
  tOutdoor: number;
  /** Measured (unfiltered) thermal power (kW) */
  pHeating: number;
  /** W/m² */
  solarRadiation?: number;
  /** Time-of-day P_int multiplier (same as the learner); 1 when dynamic P_int is off */
  pIntMultiplier?: number;
}

export interface EmitterDelayRow {
  hour: number;
  /** Mean filtered power per candidate (kW) */
  p: number[];
  /** Mean T_out − T_in (°C) */
  d: number;
  /** Mean solar radiation (kW/m²) */
  s: number;
  /** Indoor temperature change over the hour (°C) */
  dT: number;
  /** Mean P_int multiplier (absent in rows stored before it existed: 1) */
  m?: number;
}

interface HourAccumulator {
  hour: number;
  count: number;
  tInStart: number;
  sums: number[];
  sumDiff: number;
  sumSolar: number;
  sumMult?: number;
  broken: boolean;
}

export interface EmitterDelayEvaluation {
  at: number;
  rows: number;
  meanPowerKw: number;
  bestMinutes: number | null;
  sseBest: number | null;
  sseZero: number | null;
  adopted: boolean;
  /** Shortest delay within TOLERANCE of the best fit */
  shortestGoodMinutes: number | null;
  reason: 'adopted' | 'kept' | 'too_few_hours' | 'low_power' | 'no_fit';
}

export interface EmitterDelayEstimatorState {
  version: 1;
  learnedMinutes: number | null;
  filters: number[] | null;
  last: { timestamp: number; tIndoor: number } | null;
  current: HourAccumulator | null;
  rows: EmitterDelayRow[];
  hoursSinceEvaluation: number;
  evaluationPending: boolean;
  lastEvaluation: EmitterDelayEvaluation | null;
}

export interface EmitterDelayAddResult {
  /** A complete hour was stored (persist the state) */
  rowAdded: boolean;
  /** The active delay changed (pass it to the learner) */
  delayChanged: boolean;
}

const MS_PER_HOUR = 3600 * 1000;

export class EmitterDelayEstimator {
  static readonly CANDIDATES = [0, 15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360];
  static readonly MAX_ROWS = 168;
  static readonly MIN_ROWS = 72;
  static readonly MIN_SAMPLES_PER_HOUR = 10;
  /** A gap above one missed 5-minute sample breaks the hour (same as the learner window) */
  static readonly MAX_GAP_MINUTES = 7.5;
  /** After a longer gap the filters restart at the measured power */
  static readonly FILTER_RESET_GAP_MINUTES = 60;
  static readonly EVALUATE_EVERY_HOURS = 6;
  /** Below this mean power (heating off season) the rows carry too little information */
  static readonly MIN_MEAN_POWER_KW = 0.3;
  /** Candidates within 0.2% of the smallest residual count as equally good */
  static readonly TOLERANCE = 0.002;

  private startMinutes: number;
  private learnedMinutes: number | null = null;
  private filters: number[] | null = null;
  private last: { timestamp: number; tIndoor: number } | null = null;
  private current: HourAccumulator | null = null;
  private rows: EmitterDelayRow[] = [];
  private hoursSinceEvaluation = 0;
  private evaluationPending = false;
  private lastEvaluation: EmitterDelayEvaluation | null = null;
  private logger: (message: string, ...args: unknown[]) => void;

  constructor(startMinutes: number, logger?: (message: string, ...args: unknown[]) => void) {
    this.startMinutes = EmitterDelayEstimator.clampMinutes(startMinutes);
    this.logger = logger || (() => { });
  }

  private static clampMinutes(minutes: number): number {
    return Number.isFinite(minutes) ? Math.min(EMITTER_DELAY.MAX_MINUTES, Math.max(0, minutes)) : 0;
  }

  /** Active delay: learned, otherwise the start value (minutes) */
  getDelayMinutes(): number {
    return this.learnedMinutes ?? this.startMinutes;
  }

  getSource(): 'learned' | 'start' {
    return this.learnedMinutes === null ? 'start' : 'learned';
  }

  /**
   * New start value from the settings (ADR-066 D5): the learned choice is dropped, the hourly rows
   * stay and the next complete hour is evaluated. Returns true when the active delay changed.
   */
  setStartMinutes(minutes: number): boolean {
    const before = this.getDelayMinutes();
    this.startMinutes = EmitterDelayEstimator.clampMinutes(minutes);
    this.learnedMinutes = null;
    this.evaluationPending = true;
    return this.getDelayMinutes() !== before;
  }

  /** A sample that did not reach the learner breaks the current hour */
  interrupt(): void {
    if (this.current) this.current.broken = true;
  }

  addSample(sample: EmitterDelaySample): EmitterDelayAddResult {
    const result: EmitterDelayAddResult = { rowAdded: false, delayChanged: false };
    const { timestamp, tIndoor, tOutdoor } = sample;
    if (![timestamp, tIndoor, tOutdoor, sample.pHeating].every(Number.isFinite)) return result;
    const p = Math.max(0, sample.pHeating);
    const solarKw = Number.isFinite(sample.solarRadiation) ? Math.max(0, sample.solarRadiation as number) / 1000 : 0;
    const multiplier = Number.isFinite(sample.pIntMultiplier) ? sample.pIntMultiplier as number : 1;

    const gapMinutes = this.last ? (timestamp - this.last.timestamp) / 60000 : Infinity;
    if (gapMinutes <= 0) return result;

    // One first-order filter per candidate
    if (!this.filters || gapMinutes > EmitterDelayEstimator.FILTER_RESET_GAP_MINUTES) {
      this.filters = EmitterDelayEstimator.CANDIDATES.map(() => p);
    } else {
      this.filters = this.filters.map((f, i) => {
        const tau = EmitterDelayEstimator.CANDIDATES[i];
        return tau <= 0 ? p : f + (1 - Math.exp(-gapMinutes / tau)) * (p - f);
      });
    }

    const hour = Math.floor(timestamp / MS_PER_HOUR);
    const contiguous = gapMinutes <= EmitterDelayEstimator.MAX_GAP_MINUTES;
    if (this.current && this.current.hour !== hour) {
      const done = this.current;
      this.current = null;
      if (contiguous && hour === done.hour + 1 && !done.broken
        && done.count >= EmitterDelayEstimator.MIN_SAMPLES_PER_HOUR) {
        this.rows.push({
          hour: done.hour,
          p: done.sums.map((sum) => sum / done.count),
          d: done.sumDiff / done.count,
          s: done.sumSolar / done.count,
          m: (done.sumMult ?? done.count) / done.count,
          dT: tIndoor - done.tInStart,
        });
        result.rowAdded = true;
      }
      this.hoursSinceEvaluation++;
    } else if (this.current && !contiguous) {
      this.current.broken = true;
    }

    if (!this.current) {
      this.current = {
        hour,
        count: 0,
        tInStart: tIndoor,
        sums: EmitterDelayEstimator.CANDIDATES.map(() => 0),
        sumDiff: 0,
        sumSolar: 0,
        sumMult: 0,
        broken: false,
      };
    }
    const acc = this.current;
    acc.count++;
    this.filters.forEach((f, i) => {
      acc.sums[i] += f;
    });
    acc.sumDiff += tOutdoor - tIndoor;
    acc.sumSolar += solarKw;
    acc.sumMult = (acc.sumMult ?? 0) + multiplier;
    this.last = { timestamp, tIndoor };

    // Keep one week of hours
    const oldest = hour - EmitterDelayEstimator.MAX_ROWS;
    this.rows = this.rows.filter((row) => row.hour >= oldest).slice(-EmitterDelayEstimator.MAX_ROWS);

    if (result.rowAdded && (this.evaluationPending
      || this.hoursSinceEvaluation >= EmitterDelayEstimator.EVALUATE_EVERY_HOURS)) {
      const before = this.getDelayMinutes();
      this.evaluate(timestamp);
      result.delayChanged = this.getDelayMinutes() !== before;
    }
    return result;
  }

  /**
   * Least-squares fit per candidate; adopt the best one (with hysteresis against the current one).
   */
  private evaluate(now: number): void {
    const { rows } = this;
    const meanPowerKw = rows.length > 0 ? rows.reduce((sum, row) => sum + row.p[0], 0) / rows.length : 0;
    const evaluation: EmitterDelayEvaluation = {
      at: now,
      rows: rows.length,
      meanPowerKw,
      bestMinutes: null,
      sseBest: null,
      sseZero: null,
      shortestGoodMinutes: null,
      adopted: false,
      reason: 'kept',
    };
    this.lastEvaluation = evaluation;
    if (rows.length < EmitterDelayEstimator.MIN_ROWS) {
      evaluation.reason = 'too_few_hours';
      return; // stays pending: evaluated again at the next complete hour
    }
    this.hoursSinceEvaluation = 0;
    this.evaluationPending = false;
    if (meanPowerKw < EmitterDelayEstimator.MIN_MEAN_POWER_KW) {
      evaluation.reason = 'low_power';
      return;
    }

    const sse = EmitterDelayEstimator.CANDIDATES.map((_, i) => EmitterDelayEstimator.fitResidual(rows, i));
    let best = -1;
    sse.forEach((value, i) => {
      if (Number.isFinite(value) && (best < 0 || value < sse[best])) best = i;
    });
    evaluation.sseZero = Number.isFinite(sse[0]) ? sse[0] : null;
    if (best < 0) {
      evaluation.reason = 'no_fit';
      return;
    }
    const bestMinutes = EmitterDelayEstimator.CANDIDATES[best];
    evaluation.bestMinutes = bestMinutes;
    evaluation.sseBest = sse[best];

    // Candidates that explain the data equally well; the shortest one is the target
    const limit = sse[best] * (1 + EmitterDelayEstimator.TOLERANCE);
    const good = EmitterDelayEstimator.CANDIDATES.filter((_, i) => sse[i] <= limit);
    const target = good[0];
    evaluation.shortestGoodMinutes = target;
    if (this.learnedMinutes === null || !good.includes(this.learnedMinutes)) {
      if (this.learnedMinutes !== target) {
        this.logger(`EmitterDelayEstimator: delay ${this.getDelayMinutes()} → ${target} min (${rows.length} hours)`);
      }
      this.learnedMinutes = target;
      evaluation.adopted = true;
      evaluation.reason = 'adopted';
    }
  }

  /**
   * Residual sum of squares of the fit for one candidate; Infinity when the fit is singular or
   * not physical (the heating coefficient must be positive).
   */
  private static fitResidual(rows: EmitterDelayRow[], candidate: number): number {
    // Solar and the P_int rhythm only as columns when they vary (otherwise the fit is singular)
    const varies = (value: (row: EmitterDelayRow) => number): boolean => {
      const mean = rows.reduce((sum, row) => sum + value(row), 0) / rows.length;
      return rows.some((row) => Math.abs(value(row) - mean) > 1e-4);
    };
    const useSolar = varies((row) => row.s);
    const useRhythm = varies((row) => row.m ?? 1);
    const X = rows.map((row) => [
      row.p[candidate],
      row.d,
      ...(useSolar ? [row.s] : []),
      ...(useRhythm ? [row.m ?? 1] : []),
      1,
    ]);
    const y = rows.map((row) => row.dT);
    const theta = EmitterDelayEstimator.leastSquares(X, y);
    if (!theta || !(theta[0] > 0)) return Infinity;
    return X.reduce((sum, x, r) => {
      const e = y[r] - x.reduce((acc, v, j) => acc + v * theta[j], 0);
      return sum + e * e;
    }, 0);
  }

  /** Normal equations with partial pivoting; null when singular */
  private static leastSquares(X: number[][], y: number[]): number[] | null {
    const n = X[0].length;
    const M = Array.from({ length: n }, () => new Array(n + 1).fill(0));
    X.forEach((x, r) => {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) M[i][j] += x[i] * x[j];
        M[i][n] += x[i] * y[r];
      }
    });
    const scale = Math.max(...M.map((row, i) => Math.abs(row[i])), 1e-12);
    for (let i = 0; i < n; i++) {
      let pivot = i;
      for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[pivot][i])) pivot = k;
      if (Math.abs(M[pivot][i]) < 1e-10 * scale) return null;
      [M[i], M[pivot]] = [M[pivot], M[i]];
      for (let k = 0; k < n; k++) {
        if (k === i) continue;
        const factor = M[k][i] / M[i][i];
        for (let j = i; j <= n; j++) M[k][j] -= factor * M[i][j];
      }
    }
    return M.map((row, i) => row[n] / row[i]);
  }

  getDiagnostics(): {
    delayMinutes: number;
    source: 'learned' | 'start';
    startMinutes: number;
    usableHours: number;
    lastEvaluation: EmitterDelayEvaluation | null;
    } {
    return {
      delayMinutes: this.getDelayMinutes(),
      source: this.getSource(),
      startMinutes: this.startMinutes,
      usableHours: this.rows.length,
      lastEvaluation: this.lastEvaluation,
    };
  }

  getState(): EmitterDelayEstimatorState {
    const round = (v: number): number => Math.round(v * 10000) / 10000;
    return {
      version: 1,
      learnedMinutes: this.learnedMinutes,
      filters: this.filters ? this.filters.map(round) : null,
      last: this.last,
      current: this.current,
      rows: this.rows.map((row) => ({
        hour: row.hour, p: row.p.map(round), d: round(row.d), s: round(row.s), m: round(row.m ?? 1), dT: round(row.dT),
      })),
      hoursSinceEvaluation: this.hoursSinceEvaluation,
      evaluationPending: this.evaluationPending,
      lastEvaluation: this.lastEvaluation,
    };
  }

  /**
   * Restore a persisted state; an unusable state is ignored (fresh start). Returns true when restored.
   */
  restoreState(state: unknown): boolean {
    const s = state as Partial<EmitterDelayEstimatorState> | null | undefined;
    const n = EmitterDelayEstimator.CANDIDATES.length;
    if (!s || s.version !== 1 || !Array.isArray(s.rows)) return false;
    const rowsValid = s.rows.every((row) => row && Array.isArray(row.p) && row.p.length === n
      && [row.hour, row.d, row.s, row.dT, ...row.p].every(Number.isFinite));
    if (!rowsValid) return false;
    if (s.filters && (s.filters.length !== n || !s.filters.every(Number.isFinite))) return false;
    if (s.current && (!Array.isArray(s.current.sums) || s.current.sums.length !== n)) return false;
    const learned = s.learnedMinutes ?? null;
    this.learnedMinutes = learned !== null && EmitterDelayEstimator.CANDIDATES.includes(learned) ? learned : null;
    this.filters = s.filters ?? null;
    this.last = s.last ?? null;
    this.current = s.current ?? null;
    this.rows = s.rows.slice(-EmitterDelayEstimator.MAX_ROWS);
    this.hoursSinceEvaluation = s.hoursSinceEvaluation ?? 0;
    this.evaluationPending = s.evaluationPending ?? false;
    this.lastEvaluation = s.lastEvaluation ?? null;
    return true;
  }
}
