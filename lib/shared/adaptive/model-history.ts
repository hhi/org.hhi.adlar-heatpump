/**
 * Model History (G19)
 *
 * Keeps the mean of the learned building model (C, UA, P_int) per clock hour for the past day.
 * The learned values follow a daily pattern: the time constant drops by a fifth within an hour
 * on afternoons and recovers overnight. The pre-heat estimate uses the mean over the day, so
 * its outcome does not depend on the hour at which it is asked.
 *
 * C, UA and P_int are averaged together: the estimate uses all three, and a mean time constant
 * next to a momentary UA describes a building that does not exist.
 *
 * @module lib/shared/adaptive/model-history
 */

export interface ModelParameters {
  /** Thermal mass (kWh/°C) */
  C: number;
  /** Heat loss coefficient (kW/°C) */
  UA: number;
  /** Internal heat gains (kW) */
  pInt: number;
}

export interface HourlyModelEntry extends ModelParameters {
  /** Hour index: Math.floor(timestamp / 3 600 000) */
  hour: number;
}

export interface ModelHistoryState {
  hours: HourlyModelEntry[];
  current: (ModelParameters & { hour: number; count: number }) | null;
}

const MS_PER_HOUR = 3600 * 1000;

function isValidModel(m: unknown): m is ModelParameters {
  if (!m || typeof m !== 'object') return false;
  const { C, UA, pInt } = m as ModelParameters;
  return Number.isFinite(C) && C > 0 && Number.isFinite(UA) && UA > 0 && Number.isFinite(pInt);
}

export class ModelHistory {
  /** One day of hours */
  static readonly MAX_HOURS = 24;
  /** An hour counts with at least half of its twelve 5-minute samples */
  static readonly MIN_SAMPLES_PER_HOUR = 6;
  /** With fewer hours the mean leans on one part of the day; the caller keeps the momentary model */
  static readonly MIN_HOURS = 18;

  private hours: HourlyModelEntry[] = [];
  private current: (ModelParameters & { hour: number; count: number }) | null = null;

  /**
   * Add the model after one accepted sample. Returns true when an hour was completed, so the
   * caller knows to persist. An invalid model is ignored.
   */
  addSample(timestampMs: number, model: ModelParameters): boolean {
    if (!Number.isFinite(timestampMs) || !isValidModel(model)) return false;
    const hour = Math.floor(timestampMs / MS_PER_HOUR);
    let completed = false;

    if (this.current && this.current.hour !== hour) {
      completed = this.closeCurrentHour();
    }
    if (!this.current) {
      this.current = {
        hour, C: 0, UA: 0, pInt: 0, count: 0,
      };
    }
    this.current.C += model.C;
    this.current.UA += model.UA;
    this.current.pInt += model.pInt;
    this.current.count++;

    this.prune(hour);
    return completed;
  }

  /**
   * Mean model over the completed hours of the past day, or null with fewer than MIN_HOURS hours.
   */
  getMean(nowMs: number): ModelParameters | null {
    const nowHour = Math.floor(nowMs / MS_PER_HOUR);
    const recent = this.hours.filter((h) => h.hour >= nowHour - ModelHistory.MAX_HOURS && h.hour <= nowHour);
    if (recent.length < ModelHistory.MIN_HOURS) return null;
    const mean = (pick: (h: HourlyModelEntry) => number) => recent.reduce((sum, h) => sum + pick(h), 0) / recent.length;
    return { C: mean((h) => h.C), UA: mean((h) => h.UA), pInt: mean((h) => h.pInt) };
  }

  getHourCount(): number {
    return this.hours.length;
  }

  /** Forget everything: after a model reset the old hours describe another model */
  clear(): void {
    this.hours = [];
    this.current = null;
  }

  getState(): ModelHistoryState {
    return {
      hours: this.hours.map((h) => ({ ...h })),
      current: this.current ? { ...this.current } : null,
    };
  }

  /**
   * Restore persisted state. Invalid entries are dropped; returns false when nothing usable was found.
   */
  restoreState(raw: unknown): boolean {
    if (!raw || typeof raw !== 'object') return false;
    const state = raw as Partial<ModelHistoryState>;
    this.hours = Array.isArray(state.hours)
      ? state.hours
        .filter((h): h is HourlyModelEntry => isValidModel(h) && Number.isFinite((h as HourlyModelEntry).hour))
        .map((h) => ({
          hour: h.hour, C: h.C, UA: h.UA, pInt: h.pInt,
        }))
      : [];
    this.hours.sort((a, b) => a.hour - b.hour);
    const c = state.current;
    // The running hour holds sums; they are valid when their mean is a valid model
    this.current = c && Number.isFinite(c.hour) && Number.isFinite(c.count) && c.count > 0
      && isValidModel({ C: c.C / c.count, UA: c.UA / c.count, pInt: c.pInt / c.count })
      ? {
        hour: c.hour, C: c.C, UA: c.UA, pInt: c.pInt, count: c.count,
      }
      : null;
    return this.hours.length > 0 || this.current !== null;
  }

  private closeCurrentHour(): boolean {
    const c = this.current;
    this.current = null;
    if (!c || c.count < ModelHistory.MIN_SAMPLES_PER_HOUR) return false;
    this.hours.push({
      hour: c.hour, C: c.C / c.count, UA: c.UA / c.count, pInt: c.pInt / c.count,
    });
    return true;
  }

  private prune(nowHour: number): void {
    const oldest = nowHour - ModelHistory.MAX_HOURS;
    if (this.hours.length > 0 && this.hours[0].hour < oldest) {
      this.hours = this.hours.filter((h) => h.hour >= oldest);
    }
  }
}
