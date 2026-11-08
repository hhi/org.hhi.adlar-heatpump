/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
/**
 * Emitter delay tracker (ADR-066)
 *
 * Device-side wrapper around EmitterDelayEstimator, shared by the three building-model
 * services: start value from the settings and the heat-pump mode, persistence in the
 * device store, and the settings that change the start value.
 *
 * @module lib/shared/adaptive/emitter-delay-tracker
 */

import type Homey from 'homey';
import {
  EmitterDelayEstimator,
  emitterDelayStartMinutes,
  resolveEmitterType,
  type EmitterDelayAddResult,
  type EmitterDelaySample,
  type EmitterType,
} from './emitter-delay';

/** Settings that change the start value */
export const EMITTER_DELAY_SETTING_KEYS = [
  'building_model_emitter_type',
  'building_model_buffer_volume',
  'adaptive_control_mode',
] as const;

export class EmitterDelayTracker {
  static readonly STORE_KEY = 'building_model_emitter_delay';

  private device: Homey.Device;
  /** Capability with the heat-pump mode, or null when the modes do not tell floor from radiators */
  private modeCapability: string | null;
  private logger: (message: string, ...args: unknown[]) => void;
  private estimator: EmitterDelayEstimator;
  private emitterType: EmitterType | undefined;

  constructor(device: Homey.Device, modeCapability: string | null, logger?: (message: string, ...args: unknown[]) => void) {
    this.device = device;
    this.modeCapability = modeCapability;
    this.logger = logger || (() => { });
    const { type, minutes } = this.resolveStart();
    this.emitterType = type;
    this.estimator = new EmitterDelayEstimator(minutes, this.logger);
  }

  /** Start value from the settings; values from a pending save win over the stored ones */
  private resolveStart(overrides: Record<string, unknown> = {}): { type: EmitterType; minutes: number } {
    const setting = (key: string): unknown => (key in overrides ? overrides[key] : this.device.getSetting(key));
    let heatPumpMode: unknown = null;
    if (this.modeCapability && this.device.hasCapability(this.modeCapability)) {
      heatPumpMode = this.device.getCapabilityValue(this.modeCapability);
    }
    let type = resolveEmitterType(setting('building_model_emitter_type'), setting('adaptive_control_mode'), heatPumpMode);
    // A mode without a heating circuit (hot water only, cooling) or a missing value says nothing
    // about the emitters: keep the type found before, so a learned delay is not dropped.
    if (type === 'unknown' && this.emitterType !== undefined && this.emitterType !== 'unknown') {
      type = this.emitterType;
    }
    return { type, minutes: emitterDelayStartMinutes(type, setting('building_model_buffer_volume')) };
  }

  async restore(): Promise<void> {
    try {
      if (this.estimator.restoreState(await this.device.getStoreValue(EmitterDelayTracker.STORE_KEY))) {
        const diag = this.estimator.getDiagnostics();
        this.logger(`EmitterDelayTracker: restored — ${diag.delayMinutes} min (${diag.source}), ${diag.usableHours} hours`);
      }
    } catch (error) {
      this.logger('EmitterDelayTracker: restore failed, fresh start:', error);
    }
  }

  async persist(): Promise<void> {
    try {
      await this.device.setStoreValue(EmitterDelayTracker.STORE_KEY, this.estimator.getState());
    } catch (error) {
      this.logger('EmitterDelayTracker: ⚠️ Failed to persist:', error);
    }
  }

  /**
   * Recompute the start value (settings or heat-pump mode changed). Returns true when the
   * active delay changed.
   */
  refreshStart(overrides: Record<string, unknown> = {}): boolean {
    const { type, minutes } = this.resolveStart(overrides);
    if (type === this.emitterType && minutes === this.estimator.getDiagnostics().startMinutes) return false;
    this.logger(`EmitterDelayTracker: start value ${this.emitterType} → ${type}, ${minutes} min`);
    this.emitterType = type;
    return this.estimator.setStartMinutes(minutes);
  }

  /** Feed one accepted sample (measured power); persists after a complete hour */
  async addSample(sample: EmitterDelaySample): Promise<EmitterDelayAddResult> {
    const result = this.estimator.addSample(sample);
    if (result.rowAdded) {
      if (this.refreshStart()) result.delayChanged = true;
      await this.persist();
    }
    return result;
  }

  interrupt(): void {
    this.estimator.interrupt();
  }

  getDelayMinutes(): number {
    return this.estimator.getDelayMinutes();
  }

  getDiagnostics(): ReturnType<EmitterDelayEstimator['getDiagnostics']> & { emitterType: EmitterType } {
    return { ...this.estimator.getDiagnostics(), emitterType: this.emitterType ?? 'unknown' };
  }
}
