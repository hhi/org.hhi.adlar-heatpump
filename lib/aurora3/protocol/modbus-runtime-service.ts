/* eslint-disable import/prefer-default-export */
/**
 * ADR-031: ModbusRuntimeService<TSnapshot>
 *
 * Protocol-agnostisch interface voor een Modbus-deviceservice.
 * ModbusConnectionService werkt uitsluitend via dit interface — geen directe
 * afhankelijkheid van een concrete Modbus-service.
 *
 * De default type-parameter TSnapshot = DataSnapshot zorgt ervoor dat bestaande
 * code zonder type-argument ongewijzigd blijft.
 */

import { RegisterChangeEntry, RegisterChangeLogMode } from './modbus-tcp-service';

/** Writable device functions beyond setpoints/mode/on-off. Value: boolean flag or enum level. */
export type DeviceFeature = 'dhw_enabled' | 'silent_mode' | 'backup_heater_forced';

export interface ModbusRuntimeService<TSnapshot> {
  // ── Verbinding ──────────────────────────────────────────────────────────────
  connect(): Promise<void>;
  destroy(): Promise<void>;
  startPolling(ms?: {
    superfast?: number;
    superfastAdaptive?: boolean;
    superfastAdaptiveMs?: number;
    fast?: number;
    medium?: number;
    slow?: number;
    staggerMs?: number;
  }): void;

  // ── Schrijfoperaties ────────────────────────────────────────────────────────
  setTemperature(type: string, value: number): Promise<void>;
  setMainSwitch(value: boolean): Promise<void>;
  setMode(mode: number): Promise<void>;
  setFeature(feature: DeviceFeature, value: number): Promise<void>;
  setExternalFlow(lpm: number | null): void;
  getChangeLog?(mode?: RegisterChangeLogMode): Map<number, RegisterChangeEntry>;

  // ── Events ──────────────────────────────────────────────────────────────────
  on(event: 'connected', cb: () => void): this;
  on(event: 'disconnected', cb: (reason: string) => void): this;
  on(event: 'reconnecting', cb: (attempt: number, delayMs: number) => void): this;
  on(event: 'error', cb: (err: Error, ctx: string) => void): this;
  on(event: 'data', cb: (snapshot: TSnapshot) => void): this;
  on(event: 'poll-group-succeeded', cb: (groupName: string) => void): this;
}
