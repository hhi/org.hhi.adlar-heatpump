/**
 * Rolling 24-hour defrost statistics (v3.7.1, R17)
 *
 * Keeps the completed defrost cycles of the past 24 hours and gives their number and
 * total duration for the capabilities adlar_defrost_count_24h and adlar_defrost_minutes_24h.
 * The events are plain data, so the device store can persist them across restarts.
 *
 * @module lib/shared/defrost-24h-counter
 */

export interface DefrostEvent {
  /** End of the defrost cycle (ms since epoch) */
  timestamp: number;
  /** Duration of the defrost cycle in seconds */
  durationSec: number;
}

export interface Defrost24hStats {
  count: number;
  /** Total minutes, rounded to 0.1 */
  minutes: number;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

export class Defrost24hCounter {
  private events: DefrostEvent[] = [];

  /**
   * Restore from a stored value; invalid entries are dropped.
   */
  static restore(raw: unknown, now: number = Date.now()): Defrost24hCounter {
    const counter = new Defrost24hCounter();
    if (Array.isArray(raw)) {
      counter.events = raw.filter((e): e is DefrostEvent => typeof e === 'object' && e !== null
        && Number.isFinite((e as DefrostEvent).timestamp)
        && Number.isFinite((e as DefrostEvent).durationSec)
        && (e as DefrostEvent).durationSec >= 0);
    }
    counter.trim(now);
    return counter;
  }

  /**
   * Record a completed defrost cycle.
   */
  record(durationSec: number, now: number = Date.now()): void {
    if (!Number.isFinite(durationSec) || durationSec < 0) return;
    this.events.push({ timestamp: now, durationSec });
    this.trim(now);
  }

  /**
   * Drop events older than 24 hours.
   */
  trim(now: number = Date.now()): void {
    const cutoff = now - WINDOW_MS;
    this.events = this.events.filter((e) => e.timestamp >= cutoff);
  }

  getStats(now: number = Date.now()): Defrost24hStats {
    this.trim(now);
    const totalMinutes = this.events.reduce((sum, e) => sum + e.durationSec / 60, 0);
    return { count: this.events.length, minutes: Math.round(totalMinutes * 10) / 10 };
  }

  /** Events for persistence */
  getEvents(): DefrostEvent[] {
    return [...this.events];
  }
}
