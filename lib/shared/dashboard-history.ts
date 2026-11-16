/* eslint-disable import/prefer-default-export */

export interface SchemaHistoryPoint {
  ts: number;
  t1: number | null;
  t6: number | null;
  t7: number | null;
  dhw: number | null;
  room: number | null;
  hz: number | null;
  cop: number | null;
}

const MAX_POINTS = 288;
const WARMUP_POINTS = 12;
const WARMUP_INTERVAL_MS = 15_000;
const STEADY_INTERVAL_MS = 300_000;

function finiteOrNull(val: unknown): number | null {
  return typeof val === 'number' && Number.isFinite(val)
    ? Math.round(val * 100) / 100
    : null;
}

/**
 * In-memory 24-hour ringbuffer for `/processchema` temperature & compressor trend lines.
 * Records every 15s for the first 12 points (so live trends appear quickly after startup),
 * then every 5 minutes up to 288 points (24 hours).
 */
export class SchemaHistoryBuffer {
  private points: SchemaHistoryPoint[] = [];

  record(point: Omit<SchemaHistoryPoint, 'ts'> & { ts?: number }): void {
    const now = point.ts ?? Date.now();
    const last = this.points[this.points.length - 1];
    const minInterval = this.points.length < WARMUP_POINTS ? WARMUP_INTERVAL_MS : STEADY_INTERVAL_MS;
    if (last && now - last.ts < minInterval) {
      return;
    }
    this.points.push({
      ts: now,
      t1: finiteOrNull(point.t1),
      t6: finiteOrNull(point.t6),
      t7: finiteOrNull(point.t7),
      dhw: finiteOrNull(point.dhw),
      room: finiteOrNull(point.room),
      hz: finiteOrNull(point.hz),
      cop: finiteOrNull(point.cop),
    });
    if (this.points.length > MAX_POINTS) {
      this.points.shift();
    }
  }

  getAll(): SchemaHistoryPoint[] {
    return this.points;
  }
}
