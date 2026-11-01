/**
 * Heating Power History (G14, ADR-062 B7)
 *
 * Keeps the mean thermal power per clock hour for the past week. The highest
 * hourly mean is what the heat pump and its control loop actually delivered,
 * which the pre-heat estimate uses as the available heating power.
 *
 * Hours with the compressor off count as 0 kW, so a modulating heat pump in
 * mild weather gives a low value: the estimate then errs on the long side.
 *
 * @module lib/shared/adaptive/heating-power-history
 */

export interface HourlyPowerEntry {
  /** Hour index: Math.floor(timestamp / 3 600 000) */
  hour: number;
  /** Mean thermal power over the accepted samples in that hour (kW) */
  meanKw: number;
}

export interface HeatingPowerHistoryState {
  hours: HourlyPowerEntry[];
  current: { hour: number; sumKw: number; count: number } | null;
}

const MS_PER_HOUR = 3600 * 1000;

export class HeatingPowerHistory {
  /** One week of hours */
  static readonly MAX_HOURS = 168;
  /** An hour counts with at least half of its twelve 5-minute samples */
  static readonly MIN_SAMPLES_PER_HOUR = 6;
  /** Below one day of hours the estimate keeps the empirical classes */
  static readonly MIN_HOURS = 24;
  /** A single wrong COP reading must not raise an hourly mean much */
  static readonly MAX_PLAUSIBLE_COP = 8;
  static readonly MAX_PLAUSIBLE_POWER_KW = 20;

  private hours: HourlyPowerEntry[] = [];
  private current: { hour: number; sumKw: number; count: number } | null = null;

  /**
   * Thermal power of one accepted building-model sample, capped at plausible values.
   * A COP of null means the compressor was off: the building received no heat-pump heat.
   */
  static thermalPowerKw(electricPowerW: number, cop: number | null): number {
    if (cop === null || !Number.isFinite(cop) || cop <= 0 || !Number.isFinite(electricPowerW) || electricPowerW <= 0) {
      return 0;
    }
    const kw = (electricPowerW / 1000) * Math.min(cop, HeatingPowerHistory.MAX_PLAUSIBLE_COP);
    return Math.min(kw, HeatingPowerHistory.MAX_PLAUSIBLE_POWER_KW);
  }

  /**
   * Add one sample. Returns true when an hour was completed, so the caller knows to persist.
   */
  addSample(timestampMs: number, thermalPowerKw: number): boolean {
    if (!Number.isFinite(timestampMs) || !Number.isFinite(thermalPowerKw)) return false;
    const hour = Math.floor(timestampMs / MS_PER_HOUR);
    const kw = Math.max(0, thermalPowerKw);
    let completed = false;

    if (this.current && this.current.hour !== hour) {
      completed = this.closeCurrentHour();
    }
    if (!this.current) {
      this.current = { hour, sumKw: 0, count: 0 };
    }
    this.current.sumKw += kw;
    this.current.count++;

    this.prune(hour);
    return completed;
  }

  /**
   * Highest hourly mean of the past week, or null with less than MIN_HOURS of hours.
   */
  getMaxHourlyMeanKw(nowMs: number): number | null {
    const nowHour = Math.floor(nowMs / MS_PER_HOUR);
    const recent = this.hours.filter((h) => h.hour > nowHour - HeatingPowerHistory.MAX_HOURS && h.hour <= nowHour);
    if (recent.length < HeatingPowerHistory.MIN_HOURS) return null;
    const max = Math.max(...recent.map((h) => h.meanKw));
    return max > 0 ? max : null;
  }

  getHourCount(): number {
    return this.hours.length;
  }

  getState(): HeatingPowerHistoryState {
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
    const state = raw as Partial<HeatingPowerHistoryState>;
    const isValidEntry = (h: unknown): h is HourlyPowerEntry => !!h && typeof h === 'object'
      && Number.isFinite((h as HourlyPowerEntry).hour)
      && Number.isFinite((h as HourlyPowerEntry).meanKw)
      && (h as HourlyPowerEntry).meanKw >= 0;
    this.hours = Array.isArray(state.hours)
      ? state.hours.filter(isValidEntry).map((h) => ({ hour: h.hour, meanKw: Math.min(h.meanKw, HeatingPowerHistory.MAX_PLAUSIBLE_POWER_KW) }))
      : [];
    this.hours.sort((a, b) => a.hour - b.hour);
    const c = state.current;
    this.current = c && Number.isFinite(c.hour) && Number.isFinite(c.sumKw) && Number.isFinite(c.count) && c.count > 0
      ? { hour: c.hour, sumKw: c.sumKw, count: c.count }
      : null;
    return this.hours.length > 0 || this.current !== null;
  }

  private closeCurrentHour(): boolean {
    const c = this.current;
    this.current = null;
    if (!c || c.count < HeatingPowerHistory.MIN_SAMPLES_PER_HOUR) return false;
    this.hours.push({ hour: c.hour, meanKw: c.sumKw / c.count });
    return true;
  }

  private prune(nowHour: number): void {
    const oldest = nowHour - HeatingPowerHistory.MAX_HOURS;
    if (this.hours.length > 0 && this.hours[0].hour <= oldest) {
      this.hours = this.hours.filter((h) => h.hour > oldest);
    }
  }
}
