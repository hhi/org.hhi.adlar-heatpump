/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';
import { DataSnapshot } from '../protocol/adlar2-modbus-service';
import { FAN_RPM_MULTIPLIER } from '../protocol/adlar-modbus-registers';
import {
  COPCalculator,
  type COPCalculationResult,
  type COPDataSources,
} from '../../shared/services/cop-calculator';
import { RollingCOPCalculator, type COPDataPoint } from '../../shared/services/rolling-cop-calculator';
import { SCOPCalculator, type COPMeasurement } from './scop-calculator';

type CapabilitySetter = (capability: string, value: unknown) => void;

interface ModbusCOPServiceOptions {
  device: Homey.Device;
  logger?: (message: string, ...args: unknown[]) => void;
}

const COP_CAPABILITY_UPDATE_INTERVAL_MS = 5 * 60 * 1000;
const ROLLING_COP_MEASUREMENT_INTERVAL_MS = 30 * 60 * 1000;
const SCOP_MEASUREMENT_INTERVAL_MS = 60 * 60 * 1000;
const SINGLE_PHASE_POWER_MODULE = 1;
const THREE_PHASE_POWER_MODULE = 2;

const SCOP_SUPPORTED_METHODS = new Set<COPMeasurement['method']>([
  'direct_thermal',
  'power_module',
  'power_estimation',
  'refrigerant_circuit',
  'carnot_estimation',
  'valve_correlation',
  'temperature_difference',
]);

export class ModbusCOPService {
  private readonly device: Homey.Device;
  private readonly logger: (message: string, ...args: unknown[]) => void;
  private readonly rollingCOP: RollingCOPCalculator;
  private readonly scopCalc: SCOPCalculator;
  private lastCapabilityUpdateMs = 0;
  private lastRollingMeasurementMs = 0;
  private lastScopMeasurementMs = 0;

  constructor(options: ModbusCOPServiceOptions) {
    this.device = options.device;
    this.logger = options.logger || (() => {});
    this.rollingCOP = new RollingCOPCalculator({
      logger: this.logger,
      device: {
        triggerFlowCard: (cardId, tokens, state) => this.triggerFlowCard(cardId, tokens, state),
        getCapabilityValue: (capability) => this.device.getCapabilityValue(capability),
      },
    });
    this.scopCalc = new SCOPCalculator(this.device);
  }

  public getRollingCOPCalculator(): RollingCOPCalculator {
    return this.rollingCOP;
  }

  public async restore(): Promise<void> {
    try {
      const rollingData = await this.device.getStoreValue('rolling_cop_data');
      if (rollingData) {
        this.rollingCOP.importData(rollingData);
        this.logger('Restored rolling COP data');
      }

      const scopData = await this.device.getStoreValue('scop_data');
      if (scopData) {
        this.scopCalc.importData(scopData);
        this.logger('Restored SCOP data');
      }
    } catch (error) {
      this.logger('Failed to restore COP data:', (error as Error).message);
    }
  }

  public async save(): Promise<void> {
    try {
      await this.device.setStoreValue('rolling_cop_data', this.rollingCOP.exportData());
      await this.device.setStoreValue('scop_data', this.scopCalc.exportData());
    } catch (error) {
      this.logger('Failed to save COP data:', (error as Error).message);
    }
  }

  public destroy(): void {
    this.rollingCOP.destroy();
    this.scopCalc.destroy();
  }

  public processSnapshot(snap: DataSnapshot, set: CapabilitySetter): void {
    const data = this.gatherDeviceDataSources(snap);
    const result = COPCalculator.calculateCOP(data, { enableOutlierDetection: true });
    const methodDisplay = this.formatCOPMethodDisplay(result);

    if (result.cop > 0 && !result.isOutlier) {
      set('adlar_cop', Number(result.cop.toFixed(2)));
      set('adlar_cop_method', methodDisplay);
      this.addCOPMeasurement(result, data, snap);
      this.maybeUpdateRollingCOPCapabilities(set);
      return;
    }

    set('adlar_cop', 0);
    set('adlar_cop_method', methodDisplay);
  }

  private gatherDeviceDataSources(snap: DataSnapshot): COPDataSources {
    const { sensors } = snap;
    const externalPower = this.getNumberCapability('adlar_external_power');
    const externalFlow = this.getNumberCapability('adlar_external_flow');
    const externalAmbient = this.getNumberCapability('adlar_external_ambient');

    const internalPowerW = this.firstPositive(
      snap.power.inputPowerKw * 1000,
      snap.power.derivedPowerKw * 1000,
      sensors.unitPower?.value !== undefined ? sensors.unitPower.value * 1000 : undefined,
    );

    const voltageA = this.firstPositive(sensors.unitVoltage?.value, sensors.acVoltage?.value);
    const currentA = this.firstPositive(sensors.unitCurrent?.value, sensors.acCurrent?.value);
    const voltageB = this.firstPositive(sensors.bPhaseVoltage?.value);
    const currentB = this.firstPositive(sensors.bPhaseCurrent?.value);
    const voltageC = this.firstPositive(sensors.cPhaseVoltage?.value);
    const currentC = this.firstPositive(sensors.cPhaseCurrent?.value);

    return {
      electricalPower: this.firstPositive(externalPower, internalPowerW),
      waterFlowRate: this.firstPositive(externalFlow, sensors.waterFlow?.value),
      inletTemperature: sensors.inletT6?.value,
      outletTemperature: sensors.outletT7?.value,
      compressorFrequency: sensors.compRunningFreq?.value,
      ambientTemperature: this.firstDefined(externalAmbient, sensors.ambientT1?.value),
      fanMotorFrequency: sensors.fanSpeed?.value !== undefined
        ? sensors.fanSpeed.value / FAN_RPM_MULTIPLIER
        : undefined,
      highPressureTemperature: sensors.hpSatTemp?.value,
      lowPressureTemperature: sensors.lpSatTemp?.value,
      suctionTemperature: sensors.suctionT4?.value,
      dischargeTemperature: sensors.exhaustT5?.value,
      economizerInletTemperature: sensors.econInT8?.value,
      economizerOutletTemperature: sensors.econOutT9?.value,
      eevPulseSteps: sensors.eevStep?.value,
      eviPulseSteps: sensors.eviStep?.value,
      powerModuleType: this.inferPowerModuleType(internalPowerW, voltageB, currentB, voltageC, currentC),
      voltageA,
      currentA,
      voltageB,
      currentB,
      voltageC,
      currentC,
      internalPower: internalPowerW,
      isDefrosting: snap.status.defrosting,
      systemMode: snap.control.modeName,
    };
  }

  private addCOPMeasurement(result: COPCalculationResult, data: COPDataSources, snap: DataSnapshot): void {
    const now = Date.now();
    const ambientTemperature = data.ambientTemperature ?? 0;
    const { method } = result;

    if (now - this.lastRollingMeasurementMs >= ROLLING_COP_MEASUREMENT_INTERVAL_MS) {
      this.lastRollingMeasurementMs = now;
      const dataPoint: COPDataPoint = {
        timestamp: now,
        cop: result.cop,
        method,
        confidence: result.confidence,
        electricalPower: data.electricalPower,
        thermalOutput: result.calculationDetails?.thermalOutput,
        ambientTemperature,
      };
      this.rollingCOP.addDataPoint(dataPoint);
    }

    if (!SCOP_SUPPORTED_METHODS.has(method as COPMeasurement['method'])) return;
    if (now - this.lastScopMeasurementMs < SCOP_MEASUREMENT_INTERVAL_MS) return;
    this.lastScopMeasurementMs = now;

    const compressorFrequency = snap.sensors.compRunningFreq?.value ?? 0;
    const measurement: COPMeasurement = {
      cop: result.cop,
      method: method as COPMeasurement['method'],
      timestamp: now,
      ambientTemperature,
      loadRatio: Math.min(1, compressorFrequency / 60),
      confidence: result.confidence,
    };
    this.scopCalc.addCOPMeasurement(measurement);
  }

  private maybeUpdateRollingCOPCapabilities(set: CapabilitySetter): void {
    const now = Date.now();
    if (now - this.lastCapabilityUpdateMs < COP_CAPABILITY_UPDATE_INTERVAL_MS) return;
    this.lastCapabilityUpdateMs = now;

    const daily = this.rollingCOP.getDailyCOP();
    if (daily) {
      set('adlar_cop_daily', Number(daily.averageCOP.toFixed(2)));
      const trend = this.rollingCOP.getTrendAnalysis(24);
      if (trend) {
        set('adlar_cop_trend', trend.trend);
      }
    }

    const weekly = this.rollingCOP.getWeeklyCOP();
    if (weekly) set('adlar_cop_weekly', Number(weekly.averageCOP.toFixed(2)));

    const monthly = this.rollingCOP.getMonthlyCOP();
    if (monthly) set('adlar_cop_monthly', Number(monthly.averageCOP.toFixed(2)));

    const scopResult = this.scopCalc.calculateSCOP();
    if (scopResult) {
      set('adlar_scop', Number(scopResult.scop.toFixed(2)));
      set('adlar_scop_quality', scopResult.dataQuality);
    }
  }

  private formatCOPMethodDisplay(result: COPCalculationResult): string {
    if (result.isOutlier && result.outlierReason) {
      return `${this.translate(`cop_method.${result.method}`, result.method)} ⚠ ${result.outlierReason}`;
    }

    if (result.method === 'idle_mode') {
      return 'Idle - compressor uit';
    }

    const method = this.translate(`cop_method.${result.method}`, result.method);
    const issueKey = result.diagnosticInfo?.primaryIssue;
    if (!issueKey) return method;

    const issue = this.translate(`cop_diagnostics.${issueKey}`, issueKey);
    return `${method} ${issue} 🔴`;
  }

  private inferPowerModuleType(
    internalPowerW: number | undefined,
    voltageB: number | undefined,
    currentB: number | undefined,
    voltageC: number | undefined,
    currentC: number | undefined,
  ): number {
    if (voltageB && currentB && voltageC && currentC) return THREE_PHASE_POWER_MODULE;
    if (internalPowerW && internalPowerW > 0) return SINGLE_PHASE_POWER_MODULE;
    return 0;
  }

  private getNumberCapability(capability: string): number | undefined {
    if (!this.device.hasCapability(capability)) return undefined;
    const value = this.device.getCapabilityValue(capability);
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private firstPositive(...values: Array<number | undefined>): number | undefined {
    return values.find((value) => value !== undefined && Number.isFinite(value) && value > 0);
  }

  private firstDefined(...values: Array<number | undefined>): number | undefined {
    return values.find((value) => value !== undefined && Number.isFinite(value));
  }

  private translate(key: string, fallback: string): string {
    const translated = this.device.homey.__(key);
    return translated === key ? fallback : translated;
  }

  private async triggerFlowCard(
    cardId: string,
    tokens: Record<string, unknown>,
    state?: Record<string, unknown>,
  ): Promise<void> {
    const triggerDevice = this.device as unknown as {
      triggerFlowCard?: (id: string, cardTokens: Record<string, unknown>, cardState?: Record<string, unknown>) => Promise<void>;
    };
    if (typeof triggerDevice.triggerFlowCard === 'function') {
      await triggerDevice.triggerFlowCard(cardId, tokens, state);
    }
  }
}
