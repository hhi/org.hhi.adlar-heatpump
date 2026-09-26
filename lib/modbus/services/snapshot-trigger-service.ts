/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import { DataSnapshot } from '../protocol/adlar2-modbus-service';
import { MODE_OPTIONS } from '../protocol/adlar-modbus-registers';
import { FAULT_DESCRIPTIONS } from '../protocol/adlar-fault-descriptions';
import { userModeToWorkModeId } from '../protocol/adlar-enum-mappers';

const CARD_PROFILES: Record<string, { threshold: number; stateField: string }> = {
  ambient_temperature_changed: { threshold: 0.5, stateField: 'temperature' },
  inlet_temperature_changed: { threshold: 0.5, stateField: 'temperature' },
  outlet_temperature_changed: { threshold: 0.5, stateField: 'temperature' },
  coiler_temperature_alert: { threshold: 2, stateField: 'temperature' },
  incoiler_temperature_alert: { threshold: 2, stateField: 'temperature' },
  tank_temperature_alert: { threshold: 2, stateField: 'temperature' },
  suction_temperature_alert: { threshold: 2, stateField: 'temperature' },
  discharge_temperature_alert: { threshold: 2, stateField: 'temperature' },
  economizer_inlet_temperature_alert: { threshold: 2, stateField: 'temperature' },
  economizer_outlet_temperature_alert: { threshold: 2, stateField: 'temperature' },
  high_pressure_temperature_alert: { threshold: 2, stateField: 'temperature' },
  low_pressure_temperature_alert: { threshold: 2, stateField: 'temperature' },
  eev_pulse_steps_alert: { threshold: 20, stateField: 'pulse_steps' },
  evi_pulse_steps_alert: { threshold: 20, stateField: 'pulse_steps' },
  water_flow_alert: { threshold: 1, stateField: 'flow_rate' },
  compressor_efficiency_alert: { threshold: 5, stateField: 'frequency' },
  fan_motor_efficiency_alert: { threshold: 5, stateField: 'frequency' },
};

type TriggerFn = (
  cardId: string,
  tokens: Record<string, unknown>,
  state: Record<string, unknown>,
) => void;

/**
 * SnapshotTriggerService vergelijkt opeenvolgende DataSnapshots en roept
 * de meegegeven trigger-callback aan wanneer een significante wijziging
 * wordt gedetecteerd.
 *
 * Heeft geen Homey-dependency — werkt puur op DataSnapshot en een
 * framework-agnostische trigger-functie.
 */
export class SnapshotTriggerService {
  private _lastValues = new Map<string, number>();
  private _lastHeatingMode: number | null = null;
  private _lastActiveFaults: string[] = [];
  private _lastWorkMode: number | null = null;

  detect(snap: DataSnapshot, trigger: TriggerFn): void {
    this._detectChangedTriggers(snap, trigger);
    this._detectAlertTriggers(snap, trigger);
  }

  private _detectChangedTriggers(snap: DataSnapshot, trigger: TriggerFn): void {
    this._detectNumericChange('ambient', snap.sensors.ambientT1?.value, 'ambient_temperature_changed_modbus', trigger, (value) => ({
      current_temperature: this._round1(value),
    }));
    this._detectInletOutletChange('inlet', snap.sensors.inletT6?.value, 'inlet_temperature_changed_modbus', 'inlet_temperature_value_changed', trigger);
    this._detectInletOutletChange('outlet', snap.sensors.outletT7?.value, 'outlet_temperature_changed_modbus', 'outlet_temperature_value_changed', trigger);

    const { mode } = snap.control;
    if (this._lastHeatingMode !== null && mode !== this._lastHeatingMode) {
      trigger('heating_mode_changed',
        {
          mode: MODE_OPTIONS[mode as keyof typeof MODE_OPTIONS] ?? String(mode),
          previous_mode: MODE_OPTIONS[this._lastHeatingMode as keyof typeof MODE_OPTIONS] ?? String(this._lastHeatingMode),
        },
        {});
    }
    this._lastHeatingMode = mode;

    const workMode = snap.control.userMode;
    if (this._lastWorkMode !== null && workMode !== this._lastWorkMode) {
      trigger('work_mode_changed',
        {
          mode: userModeToWorkModeId(workMode),
          previous_mode: userModeToWorkModeId(this._lastWorkMode),
        },
        {});
    }
    this._lastWorkMode = workMode;

    const currentFaults = snap.status.activeFaults;
    const newFaults = currentFaults.filter((f) => !this._lastActiveFaults.includes(f));
    for (const fault of newFaults) {
      trigger('fault_detected_modbus',
        { fault_code: fault, fault_description: FAULT_DESCRIPTIONS[fault] ?? fault },
        { faultCode: fault, fault_description: FAULT_DESCRIPTIONS[fault] ?? fault });
    }
    this._lastActiveFaults = [...currentFaults];
  }

  private _detectAlertTriggers(snap: DataSnapshot, trigger: TriggerFn): void {
    this._detectTemperatureAlert('dhwTank', snap.sensors.dhwTankTemp?.value, 'tank_temperature_alert_modbus', trigger);
    this._detectTemperatureAlert('outerCoil', snap.sensors.outerCoilT2?.value, 'coiler_temperature_alert_modbus', trigger);
    this._detectTemperatureAlert('innerCoil', snap.sensors.innerCoilT3?.value, 'incoiler_temperature_alert_modbus', trigger);
    this._detectTemperatureAlert('suction', snap.sensors.suctionT4?.value, 'suction_temperature_alert_modbus', trigger);
    this._detectTemperatureAlert('exhaust', snap.sensors.exhaustT5?.value, 'discharge_temperature_alert_modbus', trigger);
    this._detectTemperatureAlert('econIn', snap.sensors.econInT8?.value, 'economizer_inlet_temperature_alert_modbus', trigger);
    this._detectTemperatureAlert('econOut', snap.sensors.econOutT9?.value, 'economizer_outlet_temperature_alert_modbus', trigger);
    this._detectTemperatureAlert('hpSat', snap.sensors.hpSatTemp?.value, 'high_pressure_temperature_alert_modbus', trigger);
    this._detectTemperatureAlert('lpSat', snap.sensors.lpSatTemp?.value, 'low_pressure_temperature_alert_modbus', trigger);

    this._detectNumericChange('eevStep', snap.sensors.eevStep?.value, 'eev_pulse_steps_alert_modbus', trigger, (value) => ({
      current_pulse_steps: Math.round(value),
      threshold_pulse_steps: value,
    }));
    this._detectNumericChange('eviStep', snap.sensors.eviStep?.value, 'evi_pulse_steps_alert_modbus', trigger, (value) => ({
      current_pulse_steps: Math.round(value),
      threshold_pulse_steps: value,
    }));
    this._detectNumericChange('waterFlow', snap.sensors.waterFlow?.value, 'water_flow_alert_modbus', trigger, (value) => ({
      current_flow_rate: this._round1(value),
      threshold_flow_rate: value,
    }));
    this._detectNumericChange('compFreq', snap.sensors.compRunningFreq?.value, 'compressor_efficiency_alert_modbus', trigger, (value) => ({
      current_frequency: this._round1(value),
      threshold_frequency: value,
    }));
    this._detectNumericChange('fanSpeed', snap.sensors.fanSpeed?.value, 'fan_motor_efficiency_alert_modbus', trigger, (value) => ({
      current_fan_frequency: this._round1(value),
      threshold_frequency: value,
    }));
  }

  private _detectInletOutletChange(
    key: string,
    value: number | undefined,
    thresholdCardId: string,
    pureChangeCardId: string,
    trigger: TriggerFn,
  ): void {
    if (value === undefined) return;

    const previousValue = this._lastValues.get(key);
    if (previousValue !== undefined && Math.abs(value - previousValue) >= 0.5) {
      const condition = value > previousValue ? 'above' : 'below';
      trigger(thresholdCardId, { current_temperature: this._round1(value) }, { condition, temperature: value, currentValue: value });
      trigger(pureChangeCardId, {
        current_temperature: this._round1(value),
        previous_temperature: this._round1(previousValue),
        delta_temperature: this._round1(value - previousValue),
      }, {});
    }

    this._lastValues.set(key, value);
  }

  private _detectTemperatureAlert(key: string, value: number | undefined, cardId: string, trigger: TriggerFn): void {
    this._detectNumericChange(key, value, cardId, trigger, (currentValue) => ({
      current_temperature: this._round1(currentValue),
      threshold_temperature: currentValue,
    }));
  }

  private _detectNumericChange(
    key: string,
    value: number | undefined,
    cardId: string,
    trigger: TriggerFn,
    tokensForValue: (value: number) => Record<string, unknown>,
  ): void {
    if (value === undefined) return;

    const profile = CARD_PROFILES[cardId] ?? { threshold: 0.5, stateField: 'currentValue' };
    const previousValue = this._lastValues.get(key);
    if (previousValue !== undefined && Math.abs(value - previousValue) >= profile.threshold) {
      const condition = value > previousValue ? 'above' : 'below';
      trigger(cardId, tokensForValue(value), { condition, [profile.stateField]: value, currentValue: value });
    }

    this._lastValues.set(key, value);
  }

  private _round1(value: number): number {
    return Math.round(value * 10) / 10;
  }
}
