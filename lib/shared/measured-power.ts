/* eslint-disable import/prefer-default-export */

export interface MeasuredPower {
  value: number;
  source: 'external' | 'internal';
  confidence: 'high' | 'medium';
  timestamp: number;
  validUntil: number;
}

export interface InternalPowerReading {
  value: number;
  timestamp: number;
}

/** Select actual non-negative readings; absence never becomes an estimated standby load. */
export function selectMeasuredPower(
  externalValue: unknown,
  externalReceivedAt: number,
  externalTtlMs: number,
  internal: InternalPowerReading | null,
  internalTtlMs: number,
  now: number,
): MeasuredPower | null {
  if (typeof externalValue === 'number' && Number.isFinite(externalValue) && externalValue >= 0
    && externalReceivedAt > 0 && now >= externalReceivedAt && now <= externalReceivedAt + externalTtlMs) {
    return {
      value: externalValue,
      source: 'external',
      confidence: 'high',
      timestamp: now,
      validUntil: externalReceivedAt + externalTtlMs,
    };
  }
  if (internal && Number.isFinite(internal.value) && internal.value >= 0
    && Number.isFinite(internal.timestamp) && internal.timestamp > 0
    && now >= internal.timestamp && now <= internal.timestamp + internalTtlMs) {
    return {
      value: internal.value,
      source: 'internal',
      confidence: 'medium',
      timestamp: now,
      validUntil: internal.timestamp + internalTtlMs,
    };
  }
  return null;
}
