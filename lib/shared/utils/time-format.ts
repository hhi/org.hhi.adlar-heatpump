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
