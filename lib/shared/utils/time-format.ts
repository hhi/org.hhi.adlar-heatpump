/**
 * Time formatting in Homey's configured timezone
 *
 * The Homey app process runs in UTC, so Date.getHours() returns UTC hours.
 * Times shown to the user (capabilities, flow tokens, JSON data) must use
 * the timezone configured on the Homey instead.
 *
 * @module lib/shared/utils/time-format
 */

/**
 * Minimal shape of the Homey instance needed to resolve the timezone
 */
export interface HomeyClockProvider {
  clock: {
    getTimezone(): string;
  };
}

/**
 * Resolve Homey's configured timezone, falling back to the process timezone
 */
export function resolveHomeyTimezone(homey: HomeyClockProvider): string {
  return homey.clock.getTimezone() || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format a date as "HH:MM" (24-hour clock) in the given timezone
 *
 * @example formatHourMinute(new Date('2026-10-24T18:00:00Z'), 'Europe/Amsterdam') // "20:00"
 */
export function formatHourMinute(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(date);

  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

/**
 * Wall-clock date and time of an instant in a timezone (month is 1-12)
 */
interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * Offset of the timezone from UTC at the given instant, in milliseconds (e.g. +7200000 for CEST)
 */
function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const instant = Math.floor(date.getTime() / 1000) * 1000;
  return wallAsUtc - instant;
}

/**
 * Convert a wall-clock time in the given timezone to an instant
 *
 * Day (and month) overflow is normalised, so day + 1 gives the next calendar day.
 * A time that does not exist (spring-forward gap) resolves to the time after the gap;
 * an ambiguous time (fall-back) resolves to its second occurrence.
 *
 * @param month - 1-12
 * @example zonedTimeToUtc(2026, 10, 24, 7, 0, 'Europe/Amsterdam') // 2026-10-24T05:00:00Z
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Two passes: the offset at the first guess corrects for a DST change between both instants
  const firstGuess = wallAsUtc - getTimezoneOffsetMs(new Date(wallAsUtc), timeZone);
  return new Date(wallAsUtc - getTimezoneOffsetMs(new Date(firstGuess), timeZone));
}

/**
 * Start (00:00) of the local day that contains the given instant
 *
 * @example startOfLocalDay(new Date('2026-10-24T23:30:00Z'), 'Europe/Amsterdam') // 2026-10-24T22:00:00Z
 */
export function startOfLocalDay(date: Date, timeZone: string): Date {
  const p = getZonedParts(date, timeZone);
  return zonedTimeToUtc(p.year, p.month, p.day, 0, 0, timeZone);
}

/**
 * First local midnight strictly after the given instant
 *
 * @example nextLocalMidnight(new Date('2026-10-24T18:00:00Z'), 'Europe/Amsterdam') // 2026-10-24T22:00:00Z
 */
export function nextLocalMidnight(date: Date, timeZone: string): Date {
  const p = getZonedParts(date, timeZone);
  return zonedTimeToUtc(p.year, p.month, p.day + 1, 0, 0, timeZone);
}

/**
 * Next occurrence of a local wall-clock time (HH:MM) strictly after the given instant
 *
 * @example nextLocalTime(7, 0, 'Europe/Amsterdam', new Date('2026-10-24T18:00:00Z')) // 2026-10-25T06:00:00Z
 */
export function nextLocalTime(hour: number, minute: number, timeZone: string, now: Date = new Date()): Date {
  const p = getZonedParts(now, timeZone);
  const today = zonedTimeToUtc(p.year, p.month, p.day, hour, minute, timeZone);
  if (today.getTime() > now.getTime()) {
    return today;
  }
  return zonedTimeToUtc(p.year, p.month, p.day + 1, hour, minute, timeZone);
}
