/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';
import { TuyaErrorCategorizer } from '../../shared/error-types';
import { calculatePreHeatDuration } from '../../shared/utils/preheat-calculator';
import type { BuildingInsightsService, InsightCategory } from './building-insights-service';
import { PerformanceReportService } from './performance-report-service';
import { SeasonalModeCalculator } from '../../shared/seasonal-mode-calculator';
import { CurveCalculator } from '../../shared/curve-calculator';
import { TimeScheduleCalculator } from '../../shared/time-schedule-calculator';
import { formatHourMinute, nextLocalTime, resolveHomeyTimezone } from '../../shared/utils/time-format';

/* eslint-disable camelcase */
interface PreHeatArgs {
  target_indoor_temp: number;
  target_clock_time: string;
}

interface PerformanceReportTokens {
  overall_score: number;
  rating: string;
  summary: string;
  recommendations: string;
  report_json: string;
}
/* eslint-enable camelcase */

interface TriggerCardLike {
  trigger: (device: unknown, tokens: PerformanceReportTokens) => Promise<void>;
}

interface FlowActionDevice {
  setCapabilityValue: (capability: string, value: unknown) => Promise<void>;
  triggerCapabilityListener?: (capability: string, value: unknown, opts: Record<string, unknown>) => Promise<void>;
  getName: () => string;
  hasCapability: (capability: string) => boolean;
}

type GenericFlowArgs = Record<string, unknown>;

const HEATING_MODE_TO_MODBUS: Record<string, number> = {
  off: 0,
  cool: 1,
  heat: 2,
  auto: 4,
};

const HEATING_SETPOINT_MIN_C = 15;
const HEATING_SETPOINT_MAX_C = 60;
const DHW_SETPOINT_MIN_C = 20;
const DHW_SETPOINT_MAX_C = 75;
const INDOOR_TARGET_MIN_C = 15;
const INDOOR_TARGET_MAX_C = 25;

const THRESHOLD_TRIGGER_CARDS: Array<{
  cardId: string;
  thresholdArg: string;
  stateField: string;
}> = [
  { cardId: 'ambient_temperature_changed_aurora3', thresholdArg: 'temperature', stateField: 'temperature' },
  { cardId: 'inlet_temperature_changed_aurora3', thresholdArg: 'temperature', stateField: 'temperature' },
  { cardId: 'outlet_temperature_changed_aurora3', thresholdArg: 'temperature', stateField: 'temperature' },
  { cardId: 'coiler_temperature_alert_aurora3', thresholdArg: 'temperature', stateField: 'temperature' },
  { cardId: 'tank_temperature_alert_aurora3', thresholdArg: 'temperature', stateField: 'temperature' },
  { cardId: 'suction_temperature_alert_aurora3', thresholdArg: 'temperature', stateField: 'temperature' },
  { cardId: 'discharge_temperature_alert_aurora3', thresholdArg: 'temperature', stateField: 'temperature' },
  { cardId: 'eev_pulse_steps_alert_aurora3', thresholdArg: 'pulse_steps', stateField: 'pulse_steps' },
  { cardId: 'evi_pulse_steps_alert_aurora3', thresholdArg: 'pulse_steps', stateField: 'pulse_steps' },
  { cardId: 'water_flow_alert_aurora3', thresholdArg: 'flow_rate', stateField: 'flow_rate' },
  { cardId: 'compressor_efficiency_alert_aurora3', thresholdArg: 'frequency', stateField: 'frequency' },
  { cardId: 'fan_motor_efficiency_alert_aurora3', thresholdArg: 'frequency', stateField: 'frequency' },
];

function hasTrigger(value: unknown): value is TriggerCardLike {
  return typeof value === 'object'
    && value !== null
    && 'trigger' in value
    && typeof (value as { trigger?: unknown }).trigger === 'function';
}

export interface FlowCardManagerOptions {
  device: Homey.Device;
  logger?: (message: string, ...args: unknown[]) => void;
  onExternalPowerData?: (powerValue: number) => Promise<void>;
  onExternalPricesData?: (pricesObject: Record<string, number>) => Promise<void>;
  buildingInsightsService?: BuildingInsightsService; // v2.5.0: Building insights flow cards
  onModbusRead?: (address: number) => Promise<number>; // ADR-045: direct register lezen
  onModbusWrite?: (address: number, rawValue: number) => Promise<void>; // ADR-045: direct register schrijven
}

export class FlowCardManagerService {
  private device: Homey.Device;
  private logger: (message: string, ...args: unknown[]) => void;
  private onExternalPowerData: (powerValue: number) => Promise<void>;
  private onExternalPricesData: (pricesObject: Record<string, number>) => Promise<void>;
  private buildingInsightsService?: BuildingInsightsService; // v2.5.0
  private onModbusRead: (address: number) => Promise<number>;
  private onModbusWrite: (address: number, rawValue: number) => Promise<void>;
  private flowCardListeners = new Map<string, unknown>();
  private isInitialized = false;
  private initializationRetryTimer: NodeJS.Timeout | null = null;
  private dailyReportTimer: NodeJS.Timeout | null = null;
  private dailyReportInterval: NodeJS.Timeout | null = null;
  private hourlyScoreInterval: NodeJS.Timeout | null = null;
  private initReportScheduled: boolean = false;
  /** Handle for the one-time init performance report timeout (ADR-022) */
  private initReportTimeout: NodeJS.Timeout | null = null;
  private reportReadyTriggerCard: unknown = null;

  /**
   * FlowCardManagerService manages registering/unregistering and invoking flow cards
   * based on device capabilities and user preferences.
   * @param options.device - device instance
   * @param options.logger - optional logger
   * @param options.onExternalPowerData - callback to delegate external power data to EnergyTrackingService
   * @param options.onExternalPricesData - callback to delegate external prices data to AdaptiveControlService
   * @param options.buildingInsightsService - v2.5.0: optional building insights service for flow cards
   */
  constructor(options: FlowCardManagerOptions) {
    this.device = options.device;
    this.logger = options.logger || (() => { });
    this.onExternalPowerData = options.onExternalPowerData || (async () => { });
    this.onExternalPricesData = options.onExternalPricesData || (async () => { });
    this.buildingInsightsService = options.buildingInsightsService; // v2.5.0
    this.onModbusRead = options.onModbusRead ?? (() => Promise.reject(new Error('Modbus lezen niet beschikbaar')));
    this.onModbusWrite = options.onModbusWrite ?? (() => Promise.reject(new Error('Modbus schrijven niet beschikbaar')));
  }

  private formatDiagnosticTimestamp(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  /**
   * Initialize flow card registration. This will evaluate available capabilities,
   * user preferences and register/unregister flow cards accordingly.
   */
  async initialize(): Promise<void> {
    this.logger('FlowCardManagerService: Initializing flow cards');

    try {
      await this.updateFlowCards();
      this.isInitialized = true;
      this.logger('FlowCardManagerService: Flow cards initialized successfully');
    } catch (error) {
      const categorizedError = TuyaErrorCategorizer.categorize(error as Error, 'Initializing flow cards');
      this.logger('FlowCardManagerService: Error initializing flow cards:', categorizedError.userMessage);

      if (categorizedError.retryable) {
        this.logger('FlowCardManagerService: Will retry flow card initialization in 5 seconds');
        this.initializationRetryTimer = this.device.homey.setTimeout(() => this.initialize(), 5000);
      }
    }
  }

  /**
   * Refresh the set of flow cards.
   */
  async updateFlowCards(_capabilitiesWithData?: string[]): Promise<void> {
    try {
      // Don't proceed if device isn't fully initialized yet
      if (!this.isInitialized && Object.keys(this.device.homey.drivers.getDrivers()).length === 0) {
        this.logger('FlowCardManagerService: Skipping flow card update - system not ready');
        return;
      }

      // Unregister all current flow card listeners
      this.unregisterAllFlowCards();

      // Register Modbus-specific trigger filters and simple action cards.
      await this.registerModbusTriggerRunListeners();
      await this.registerModbusSimpleActionCards();

      // Register action-based condition cards (always available)
      await this.registerActionBasedConditionCards();

      // Register Building Insights cards (v2.5.0 - always available if service exists)
      if (this.buildingInsightsService) {
        await this.registerBuildingInsightsCards();
      }

      // Register external data action cards (v2.6.1 - consolidates from device.ts)
      await this.registerExternalDataActionCards();

      // Register Performance Report action card (v2.9.0)
      await this.registerPerformanceReportCard();

      // Register utility action cards (ADR-036 §4.1 — stateless calculators)
      await this.registerUtilityActionCards();

      // Register Modbus direct-access action cards (ADR-045)
      await this.registerModbusDirectAccessCards();

      this.logger('FlowCardManagerService: Flow cards updated successfully');
    } catch (error) {
      this.logger('FlowCardManagerService: Error updating flow cards:', error);
    }
  }

  private async registerModbusTriggerRunListeners(): Promise<void> {
    try {
      for (const { cardId, thresholdArg, stateField } of THRESHOLD_TRIGGER_CARDS) {
        const card = this.device.homey.flow.getDeviceTriggerCard(cardId);
        const listener = card.registerRunListener(async (args, state) => {
          const currentValue = this.getStateNumber(state, stateField);
          const threshold = this.getArgNumber(args as GenericFlowArgs, thresholdArg);
          const condition = String((args as GenericFlowArgs).condition ?? '');
          const result = this.evaluateThreshold(condition, currentValue, threshold);

          this.logger('FlowCardManagerService: Threshold trigger evaluated', {
            cardId,
            condition,
            stateField,
            currentValue,
            threshold,
            result,
          });

          return result;
        });
        this.flowCardListeners.set(cardId, listener);
      }

      const faultCard = this.device.homey.flow.getDeviceTriggerCard('fault_detected_aurora3');
      const faultListener = faultCard.registerRunListener(async (args, state) => {
        const requestedCode = String((args as GenericFlowArgs).fault_code ?? '').trim().toLowerCase();
        const actualCode = String((state as GenericFlowArgs | undefined)?.faultCode ?? '').trim().toLowerCase();

        if (!requestedCode || !actualCode) return false;
        return requestedCode === actualCode;
      });
      this.flowCardListeners.set('fault_detected_aurora3', faultListener);

      this.logger('FlowCardManagerService: Modbus trigger run listeners registered');
    } catch (error) {
      this.logger('FlowCardManagerService: Error registering Modbus trigger run listeners:', error);
    }
  }

  private async registerModbusSimpleActionCards(): Promise<void> {
    try {
      this.registerCapabilityAction('set_target_temperature_aurora3', async (args) => {
        const temperature = this.normalizeTemperatureArg(args, 'temperature', String(args.decimal_handling ?? 'round'));
        this.assertHeatingSetpointRange(temperature);
        await this.triggerSelectedDeviceCapability(args, 'target_temperature', temperature);
        return true;
      });

      this.registerCapabilityAction('set_hotwater_temperature_aurora3', async (args) => {
        const temperature = this.normalizeTemperatureArg(args, 'temperature', 'round');
        this.assertSetpointRange('DHW setpoint', temperature, DHW_SETPOINT_MIN_C, DHW_SETPOINT_MAX_C);
        await this.triggerSelectedDeviceCapability(args, 'target_temperature.dhw', temperature);
        return true;
      });

      this.registerCapabilityAction('set_desired_indoor_temperature_aurora3', async (args) => {
        const temperature = this.getRequiredNumberArg(args, 'temperature');
        this.assertSetpointRange('Desired indoor temperature', temperature, INDOOR_TARGET_MIN_C, INDOOR_TARGET_MAX_C);
        await this.triggerSelectedDeviceCapability(args, 'target_temperature.indoor', temperature);
        return true;
      });

      this.registerCapabilityAction('set_heating_mode_aurora3', async (args) => {
        const modeId = String(args.mode ?? '');
        const modbusMode = HEATING_MODE_TO_MODBUS[modeId];
        if (modbusMode === undefined) {
          throw new Error(`Unsupported heating mode: ${modeId}`);
        }
        await this.triggerSelectedDeviceCapability(args, 'adlar_mode_aurora3', String(modbusMode));
        return true;
      });

      this.registerCapabilityAction('set_silent_mode', async (args) => {
        const level = String(args.level ?? '');
        if (!['0', '1', '2'].includes(level)) {
          throw new Error(`Unsupported silent mode level: ${level}`);
        }
        await this.triggerSelectedDeviceCapability(args, 'adlar_silent_mode', level);
        return true;
      });

      this.registerCapabilityAction('set_dhw_function', async (args) => {
        await this.triggerSelectedDeviceCapability(args, 'adlar_dhw_enabled', args.state === 'on');
        return true;
      });

      this.registerCapabilityAction('set_backup_heater', async (args) => {
        await this.triggerSelectedDeviceCapability(args, 'adlar_backup_heater_forced', args.state === 'on');
        return true;
      });

      this.logger('FlowCardManagerService: Modbus simple action cards registered');
    } catch (error) {
      this.logger('FlowCardManagerService: Error registering Modbus simple action cards:', error);
    }
  }

  private registerCapabilityAction(cardId: string, handler: (args: GenericFlowArgs) => Promise<boolean>): void {
    const card = this.device.homey.flow.getActionCard(cardId);
    const listener = card.registerRunListener(async (args) => {
      this.logger('FlowCardManagerService: Modbus action triggered', { cardId, args });
      return handler(args as GenericFlowArgs);
    });
    this.flowCardListeners.set(cardId, listener);
  }

  private async triggerSelectedDeviceCapability(args: GenericFlowArgs, capability: string, value: unknown): Promise<void> {
    const selectedDevice = args.device as FlowActionDevice | undefined;
    if (!selectedDevice) {
      throw new Error('No device selected for flow action');
    }
    if (!selectedDevice.hasCapability(capability)) {
      throw new Error(`Device ${selectedDevice.getName()} does not support ${capability}`);
    }

    if (typeof selectedDevice.triggerCapabilityListener === 'function') {
      await selectedDevice.triggerCapabilityListener(capability, value, {});
      return;
    }

    await selectedDevice.setCapabilityValue(capability, value);
    this.logger(`FlowCardManagerService: Used setCapabilityValue fallback for ${capability}`);
  }

  private normalizeTemperatureArg(args: GenericFlowArgs, key: string, decimalHandling: string): number {
    const value = this.getRequiredNumberArg(args, key);
    if (Number.isInteger(value)) return value;
    if (decimalHandling === 'error') {
      throw new Error(`Temperature ${value} must be a whole number for this device`);
    }
    return Math.round(value);
  }

  private assertHeatingSetpointRange(value: number): void {
    this.assertSetpointRange('Heating setpoint', value, HEATING_SETPOINT_MIN_C, HEATING_SETPOINT_MAX_C);
  }

  private assertSetpointRange(label: string, value: number, min: number, max: number): void {
    if (value < min || value > max) {
      throw new Error(`${label} ${value}°C outside supported range ${min}-${max}°C`);
    }
  }

  private getRequiredNumberArg(args: GenericFlowArgs, key: string): number {
    const value = Number(args[key]);
    if (!Number.isFinite(value)) {
      throw new Error(`Missing or invalid numeric argument: ${key}`);
    }
    return value;
  }

  private getArgNumber(args: GenericFlowArgs, key: string): number | null {
    const value = Number(args[key]);
    return Number.isFinite(value) ? value : null;
  }

  private getStateNumber(state: unknown, key: string): number | null {
    const value = Number((state as GenericFlowArgs | undefined)?.[key]);
    return Number.isFinite(value) ? value : null;
  }

  private evaluateThreshold(condition: string, currentValue: number | null, threshold: number | null): boolean {
    if (currentValue === null || threshold === null) return false;
    if (condition === 'above') return currentValue > threshold;
    if (condition === 'below') return currentValue < threshold;
    return false;
  }

  /**
   * Register action-based condition cards built from patterns in the app.
   */
  private async registerActionBasedConditionCards(): Promise<void> {
    try {
      // Device power state condition
      const devicePowerCard = this.device.homey.flow.getConditionCard('device_power_is_aurora3');
      const devicePowerListener = devicePowerCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Device power condition triggered', { args });
        const currentValue = this.device.getCapabilityValue('onoff');
        const expectedState = args.state === 'on';
        return currentValue === expectedState;
      });
      this.flowCardListeners.set('device_power_is_aurora3', devicePowerListener);

      // Target temperature condition
      const targetTempCard = this.device.homey.flow.getConditionCard('target_temperature_is_aurora3');
      const targetTempListener = targetTempCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Target temperature condition triggered', { args });
        const currentValue = this.device.getCapabilityValue('target_temperature') || 0;
        const targetValue = args.temperature || 0;

        switch (args.comparison) {
          case 'equal':
            return Math.abs(currentValue - targetValue) < 0.5;
          case 'greater':
            return currentValue > targetValue;
          case 'less':
            return currentValue < targetValue;
          default:
            return false;
        }
      });
      this.flowCardListeners.set('target_temperature_is_aurora3', targetTempListener);

      // Hot water temperature condition
      const hotWaterTempCard = this.device.homey.flow.getConditionCard('hotwater_temperature_is_aurora3');
      const hotWaterTempListener = hotWaterTempCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Hot water temperature condition triggered', { args });
        const currentValue = this.device.getCapabilityValue('target_temperature.dhw') || 0;
        const targetValue = args.temperature || 0;

        switch (args.comparison) {
          case 'equal':
            return Math.abs(currentValue - targetValue) < 1;
          case 'greater':
            return currentValue > targetValue;
          case 'less':
            return currentValue < targetValue;
          default:
            return false;
        }
      });
      this.flowCardListeners.set('hotwater_temperature_is_aurora3', hotWaterTempListener);

      // Heating mode condition
      const heatingModeCard = this.device.homey.flow.getConditionCard('heating_mode_is_aurora3');
      const heatingModeListener = heatingModeCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Heating mode condition triggered', { args });
        const currentValue = String(this.device.getCapabilityValue('adlar_mode_aurora3') ?? '');
        const expectedMode = HEATING_MODE_TO_MODBUS[String(args.mode ?? '')];
        return expectedMode !== undefined && currentValue === String(expectedMode);
      });
      this.flowCardListeners.set('heating_mode_is_aurora3', heatingModeListener);

      // Silent mode condition
      const silentModeCard = this.device.homey.flow.getConditionCard('silent_mode_is');
      const silentModeListener = silentModeCard.registerRunListener(async (args) => {
        return String(this.device.getCapabilityValue('adlar_silent_mode') ?? '') === String(args.level ?? '');
      });
      this.flowCardListeners.set('silent_mode_is', silentModeListener);

      // DHW heating active condition
      const dhwActiveCard = this.device.homey.flow.getConditionCard('dhw_heating_active');
      const dhwActiveListener = dhwActiveCard.registerRunListener(async () => {
        return this.device.getCapabilityValue('adlar_dhw_active') === true;
      });
      this.flowCardListeners.set('dhw_heating_active', dhwActiveListener);

      // Fault active condition
      const faultActiveCard = this.device.homey.flow.getConditionCard('fault_active_aurora3');
      const faultActiveListener = faultActiveCard.registerRunListener(async () => {
        const faultCount = Number(this.device.getCapabilityValue('adlar_fault') ?? 0);
        const activeFaultText = String(this.device.getCapabilityValue('adlar_fault_active') ?? '').trim();
        return faultCount > 0 || activeFaultText.length > 0;
      });
      this.flowCardListeners.set('fault_active_aurora3', faultActiveListener);

      // Compressor running condition
      const compressorRunningCard = this.device.homey.flow.getConditionCard('compressor_running_aurora3');
      const compressorRunningListener = compressorRunningCard.registerRunListener(async () => {
        const compressorOn = this.device.getCapabilityValue('adlar_compressor_on');
        const compressorState = this.device.getCapabilityValue('adlar_state_compressor_state');
        const compressorFrequency = Number(this.device.getCapabilityValue('measure_frequency.compressor_freq') ?? 0);
        return compressorOn === true || compressorState === true || compressorFrequency > 0;
      });
      this.flowCardListeners.set('compressor_running_aurora3', compressorRunningListener);

      // Ambient temperature above condition
      const temperatureAboveCard = this.device.homey.flow.getConditionCard('temperature_above_aurora3');
      const temperatureAboveListener = temperatureAboveCard.registerRunListener(async (args) => {
        const currentValue = Number(this.device.getCapabilityValue('measure_temperature.ambient'));
        const threshold = Number(args.temperature);
        return Number.isFinite(currentValue) && Number.isFinite(threshold) && currentValue > threshold;
      });
      this.flowCardListeners.set('temperature_above_aurora3', temperatureAboveListener);

      // Power above threshold condition
      const powerAboveCard = this.device.homey.flow.getConditionCard('power_above_threshold_aurora3');
      const powerAboveListener = powerAboveCard.registerRunListener(async (args) => {
        const currentValue = Number(this.device.getCapabilityValue('measure_power'));
        const threshold = Number(args.threshold);
        return Number.isFinite(currentValue) && Number.isFinite(threshold) && currentValue > threshold;
      });
      this.flowCardListeners.set('power_above_threshold_aurora3', powerAboveListener);

      // Total consumption above condition
      const totalConsumptionCard = this.device.homey.flow.getConditionCard('total_consumption_above_aurora3');
      const totalConsumptionListener = totalConsumptionCard.registerRunListener(async (args) => {
        const currentValue = Number(this.device.getCapabilityValue('meter_power'));
        const threshold = Number(args.threshold);
        return Number.isFinite(currentValue) && Number.isFinite(threshold) && currentValue > threshold;
      });
      this.flowCardListeners.set('total_consumption_above_aurora3', totalConsumptionListener);

      // COP efficiency check condition (v1.0.7)
      const copEfficiencyCard = this.device.homey.flow.getConditionCard('cop_efficiency_check_aurora3');
      const copEfficiencyListener = copEfficiencyCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: COP efficiency check triggered', { args });

        // Get current COP value from capability
        const currentCOP = this.device.getCapabilityValue('adlar_cop') as number || 0;
        const threshold = args.threshold || 2.0;

        // Check if compressor is actually running (COP only meaningful when active)
        const compressorFrequency = this.device.getCapabilityValue('measure_frequency.compressor_freq') as number || 0;

        if (compressorFrequency === 0) {
          // Compressor idle - COP not meaningful
          this.logger('FlowCardManagerService: COP check skipped - compressor idle');
          return false;
        }

        return currentCOP > threshold;
      });
      this.flowCardListeners.set('cop_efficiency_check_aurora3', copEfficiencyListener);

      // Daily COP above threshold condition (v1.0.7)
      const dailyCOPCard = this.device.homey.flow.getConditionCard('daily_cop_above_threshold_aurora3');
      const dailyCOPListener = dailyCOPCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Daily COP check triggered', { args });

        const dailyCOP = this.device.getCapabilityValue('adlar_cop_daily') as number || 0;
        const threshold = args.threshold || 2.5;

        // Need sufficient data for reliable daily average
        if (dailyCOP === 0) {
          this.logger('FlowCardManagerService: Daily COP check skipped - insufficient data');
          return false;
        }

        return dailyCOP > threshold;
      });
      this.flowCardListeners.set('daily_cop_above_threshold_aurora3', dailyCOPListener);

      // Monthly COP above threshold condition (v1.0.7)
      const monthlyCOPCard = this.device.homey.flow.getConditionCard('monthly_cop_above_threshold_aurora3');
      const monthlyCOPListener = monthlyCOPCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Monthly COP check triggered', { args });

        const monthlyCOP = this.device.getCapabilityValue('adlar_cop_monthly') as number || 0;
        const threshold = args.threshold || 3.0;

        // Need sufficient data for reliable monthly average
        if (monthlyCOP === 0) {
          this.logger('FlowCardManagerService: Monthly COP check skipped - insufficient data');
          return false;
        }

        return monthlyCOP > threshold;
      });
      this.flowCardListeners.set('monthly_cop_above_threshold_aurora3', monthlyCOPListener);

      // COP trend analysis condition (v1.0.8)
      const copTrendCard = this.device.homey.flow.getConditionCard('cop_trend_analysis_aurora3');
      const copTrendListener = copTrendCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: COP trend analysis triggered', { args });

        // Get service coordinator to access RollingCOPCalculator
        const { serviceCoordinator } = this.device as unknown as {
          serviceCoordinator?: {
            getRollingCOPCalculator: () => {
              getTrendAnalysis: (hours: number) => { trend: string; strength: number; trendKey: string } | null;
            };
          };
        };

        if (!serviceCoordinator) {
          this.logger('FlowCardManagerService: Service coordinator not available');
          return false;
        }

        const rollingCOPCalculator = serviceCoordinator.getRollingCOPCalculator();
        if (!rollingCOPCalculator) {
          this.logger('FlowCardManagerService: RollingCOPCalculator not available');
          return false;
        }

        const hours = args.hours || 24;
        const trendAnalysis = rollingCOPCalculator.getTrendAnalysis(hours);

        if (!trendAnalysis) {
          this.logger('FlowCardManagerService: COP trend analysis skipped - insufficient data');
          return false;
        }

        // The flow card uses !{{improving|stable|degrading}} syntax
        // This means args will have the selected value, and we check if it matches
        // The trend value from getTrendAnalysis is 'improving', 'stable', or 'degrading'
        this.logger('FlowCardManagerService: COP trend analysis result', {
          hours,
          trend: trendAnalysis.trend,
          strength: trendAnalysis.strength,
          trendKey: trendAnalysis.trendKey,
        });

        // Note: Homey's !{{option1|option2|option3}} returns true for first option, false for others
        // So we return true if trend matches the "improving" state, false otherwise
        // This is controlled by the flow card UI selection
        return trendAnalysis.trend === 'improving';
      });
      this.flowCardListeners.set('cop_trend_analysis_aurora3', copTrendListener);

      // Price in cheapest hours condition (v2.5.0)
      const priceInCheapestHoursCard = this.device.homey.flow.getConditionCard('price_in_cheapest_hours_aurora3');
      const priceInCheapestHoursListener = priceInCheapestHoursCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Price in cheapest hours condition triggered', { args });

        // Get service coordinator to access EnergyPriceOptimizer
        const { serviceCoordinator } = this.device as unknown as {
          serviceCoordinator?: {
            getAdaptiveControl: () => {
              getEnergyPriceOptimizer: () => {
                findCheapestBlock: (hours: number) => { startTime: Date; endTime: Date; avgPrice: number; totalHours: number } | null;
              } | null;
            } | null;
          };
        };

        if (!serviceCoordinator?.getAdaptiveControl) {
          this.logger('FlowCardManagerService: Adaptive control not available');
          return false;
        }

        const adaptiveControl = serviceCoordinator.getAdaptiveControl();
        if (!adaptiveControl) {
          this.logger('FlowCardManagerService: Adaptive control service not available');
          return false;
        }

        const energyOptimizer = adaptiveControl.getEnergyPriceOptimizer();
        if (!energyOptimizer) {
          this.logger('FlowCardManagerService: Energy price optimizer not available');
          return false;
        }

        const hours = args.hours || 4;
        const cheapestBlock = energyOptimizer.findCheapestBlock(hours);

        if (!cheapestBlock) {
          this.logger('FlowCardManagerService: No cheapest block found - insufficient price data');
          return false;
        }

        // Check if current time is within the cheapest block
        const now = Date.now();
        const isInBlock = now >= cheapestBlock.startTime.getTime() && now < cheapestBlock.endTime.getTime();

        this.logger('FlowCardManagerService: Price in cheapest hours result', {
          hours,
          blockStart: cheapestBlock.startTime.toISOString(),
          blockEnd: cheapestBlock.endTime.toISOString(),
          avgPrice: cheapestBlock.avgPrice,
          isInBlock,
        });

        return isInBlock;
      });
      this.flowCardListeners.set('price_in_cheapest_hours_aurora3', priceInCheapestHoursListener);

      // Price trend is condition (v2.5.0)
      const priceTrendIsCard = this.device.homey.flow.getConditionCard('price_trend_is_aurora3');
      const priceTrendIsListener = priceTrendIsCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Price trend is condition triggered', { args });

        // Get service coordinator to access EnergyPriceOptimizer
        const { serviceCoordinator } = this.device as unknown as {
          serviceCoordinator?: {
            getAdaptiveControl: () => {
              getEnergyPriceOptimizer: () => {
                calculatePriceTrend: (hours: number) => { trend: 'rising' | 'falling' | 'stable'; slope: number; confidence: number } | null;
              } | null;
            } | null;
          };
        };

        if (!serviceCoordinator?.getAdaptiveControl) {
          this.logger('FlowCardManagerService: Adaptive control not available');
          return false;
        }

        const adaptiveControl = serviceCoordinator.getAdaptiveControl();
        if (!adaptiveControl) {
          this.logger('FlowCardManagerService: Adaptive control service not available');
          return false;
        }

        const energyOptimizer = adaptiveControl.getEnergyPriceOptimizer();
        if (!energyOptimizer) {
          this.logger('FlowCardManagerService: Energy price optimizer not available');
          return false;
        }

        const hours = args.hours || 6;
        const expectedTrend = args.trend || 'stable';
        const trendAnalysis = energyOptimizer.calculatePriceTrend(hours);

        if (!trendAnalysis) {
          this.logger('FlowCardManagerService: No trend analysis available - insufficient price data');
          return false;
        }

        // Only trust trends with confidence > 0.5 (R² from linear regression)
        if (trendAnalysis.confidence <= 0.5) {
          this.logger('FlowCardManagerService: Trend confidence too low', {
            confidence: trendAnalysis.confidence,
            threshold: 0.5,
          });
          return false;
        }

        const trendsMatch = trendAnalysis.trend === expectedTrend;

        this.logger('FlowCardManagerService: Price trend is result', {
          hours,
          expectedTrend,
          actualTrend: trendAnalysis.trend,
          slope: trendAnalysis.slope,
          confidence: trendAnalysis.confidence,
          trendsMatch,
        });

        return trendsMatch;
      });
      this.flowCardListeners.set('price_trend_is_aurora3', priceTrendIsListener);

      // Price vs daily average condition (v2.5.0)
      const priceVsDailyAverageCard = this.device.homey.flow.getConditionCard('price_vs_daily_average_aurora3');
      const priceVsDailyAverageListener = priceVsDailyAverageCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Price vs daily average condition triggered', { args });

        // Get service coordinator to access EnergyPriceOptimizer
        const { serviceCoordinator } = this.device as unknown as {
          serviceCoordinator?: {
            getAdaptiveControl: () => {
              getEnergyPriceOptimizer: () => {
                getCurrentPrice: (timestamp: number) => { price: number; category: string } | null;
                getDeviationFromAverage: (timestamp: number, minSamples?: number) => {
                  current: number; average: number; deviationPercent: number; sampleSize: number;
                } | null;
              } | null;
            } | null;
          };
        };

        if (!serviceCoordinator?.getAdaptiveControl) {
          this.logger('FlowCardManagerService: Adaptive control not available');
          return false;
        }

        const adaptiveControl = serviceCoordinator.getAdaptiveControl();
        if (!adaptiveControl) {
          this.logger('FlowCardManagerService: Adaptive control service not available');
          return false;
        }

        const energyOptimizer = adaptiveControl.getEnergyPriceOptimizer();
        if (!energyOptimizer) {
          this.logger('FlowCardManagerService: Energy price optimizer not available');
          return false;
        }

        const margin = args.margin || 10;
        const now = Date.now();

        if (!energyOptimizer.getCurrentPrice(now)) {
          this.logger('FlowCardManagerService: No current price available');
          return false;
        }

        // v3.4.1: current and average both as effective price; no division by an average near zero
        const deviation = energyOptimizer.getDeviationFromAverage(now, 6);
        if (!deviation) {
          this.logger('FlowCardManagerService: Insufficient price data for daily average', { required: 6 });
          return false;
        }

        const { current: currentPrice, average: dailyAverage, deviationPercent } = deviation;
        const absDeviationPercent = Math.abs(deviationPercent);

        // Check if deviation meets the margin requirement
        const meetsMargin = absDeviationPercent >= margin;

        // The !{{below|above}} syntax means:
        // - Return true if price is below average AND deviation meets margin
        // - Return false if price is above average OR deviation doesn't meet margin
        const isBelow = deviationPercent < 0;
        const result = isBelow && meetsMargin;

        this.logger('FlowCardManagerService: Price vs daily average result', {
          currentPrice,
          dailyAverage,
          deviationPercent: deviationPercent.toFixed(2),
          margin,
          meetsMargin,
          isBelow,
          result,
        });

        return result;
      });
      this.flowCardListeners.set('price_vs_daily_average_aurora3', priceVsDailyAverageListener);

      // Temperature differential condition (ADR-036 §4.1)
      const temperatureDifferentialCard = this.device.homey.flow.getConditionCard('temperature_differential_aurora3');
      const temperatureDifferentialListener = temperatureDifferentialCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Temperature differential condition triggered', { args });

        const inlet = this.device.getCapabilityValue('measure_temperature.inlet') as number | null;
        const outlet = this.device.getCapabilityValue('measure_temperature.outlet') as number | null;

        if (inlet === null || outlet === null) {
          this.logger('FlowCardManagerService: Temperature differential skipped — inlet or outlet unavailable');
          return false;
        }

        const differential = Math.abs(inlet - outlet);
        const threshold = args.differential || 5;

        this.logger(`FlowCardManagerService: ΔT=${differential.toFixed(1)}°C (inlet=${inlet}°C, outlet=${outlet}°C, threshold=${threshold}°C)`);
        return differential > threshold;
      });
      this.flowCardListeners.set('temperature_differential_aurora3', temperatureDifferentialListener);

      // Water flow rate check condition (ADR-036 §4.1)
      const waterFlowRateCard = this.device.homey.flow.getConditionCard('water_flow_rate_check_aurora3');
      const waterFlowRateListener = waterFlowRateCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Water flow rate check triggered', { args });

        const waterFlow = this.device.getCapabilityValue('measure_water') as number | null;

        if (waterFlow === null) {
          this.logger('FlowCardManagerService: Water flow rate check skipped — capability unavailable');
          return false;
        }

        const threshold = args.flow_rate || 10;

        this.logger(`FlowCardManagerService: Water flow=${waterFlow} L/min, threshold=${threshold} L/min`);
        return waterFlow > threshold;
      });
      this.flowCardListeners.set('water_flow_rate_check_aurora3', waterFlowRateListener);

      this.logger('FlowCardManagerService: Action-based condition cards registered');
    } catch (error) {
      this.logger('FlowCardManagerService: Error registering action-based condition cards:', error);
    }
  }

  /**
   * Register Building Insights flow cards (v2.5.0)
   * - 4 action cards: dismiss, force analysis, reset history, set threshold
   * - 3 condition cards: insight active, confidence above, savings above
   */
  private async registerBuildingInsightsCards(): Promise<void> {
    if (!this.buildingInsightsService) {
      this.logger('FlowCardManagerService: Building Insights service not available, skipping cards');
      return;
    }

    try {
      // ==================== ACTION CARDS ====================

      // Action: Force insight analysis
      const forceAnalysisCard = this.device.homey.flow.getActionCard('force_insight_analysis_aurora3');
      const forceAnalysisListener = forceAnalysisCard.registerRunListener(async () => {
        this.logger('FlowCardManagerService: Force insight analysis action triggered');

        if (!this.buildingInsightsService) {
          throw new Error('Building Insights service not available');
        }

        const result = await this.buildingInsightsService.forceInsightAnalysis() as unknown as Record<string, unknown>;
        this.logger(`FlowCardManagerService: Force analysis complete - ${result['insights_detected']} insights at ${result['confidence']}% confidence`);

        // Return tokens for use in flows
        return result;
      });
      this.flowCardListeners.set('force_insight_analysis_aurora3', forceAnalysisListener);

      // Action: Calculate pre-heat start time (v2.6.0)
      const calculatePreHeatCard = this.device.homey.flow.getActionCard('calculate_preheat_time_aurora3');
      const calculatePreHeatListener = calculatePreHeatCard.registerRunListener(async (args: PreHeatArgs) => {
        this.logger('FlowCardManagerService: Calculate pre-heat time action triggered', args);

        if (!this.buildingInsightsService) {
          throw new Error('Building Insights service not available');
        }

        // Get building model parameters via BuildingModelService
        // @ts-expect-error - Accessing MyDevice.serviceCoordinator
        const buildingModelService = this.device.serviceCoordinator
          ?.getAdaptiveControl()
          ?.getBuildingModelService();

        if (!buildingModelService) {
          throw new Error('Building model service not available');
        }

        const model = buildingModelService.getLearner().getModel();
        const tau = model.C / model.UA; // Time constant in hours
        const { confidence } = model;

        // Get current indoor temperature
        // @ts-expect-error - Accessing MyDevice.serviceCoordinator
        const indoorTemp: number | null = this.device.serviceCoordinator
          ?.getAdaptiveControl()
          ?.getExternalTemperatureService()
          ?.getIndoorTemperature() || null;

        if (indoorTemp === null) {
          throw new Error('No indoor temperature available');
        }

        // Parse target time
        const [targetHour, targetMinute] = args.target_clock_time.split(':').map(Number);
        if (Number.isNaN(targetHour) || Number.isNaN(targetMinute)) {
          throw new Error('Invalid time format. Use HH:MM');
        }

        // Calculate temperature delta
        const tempDelta = args.target_indoor_temp - indoorTemp;
        if (tempDelta <= 0) {
          // Already at or above target
          return {
            start_time: 'Now',
            duration_hours: 0,
            suggested_setpoint_boost: 0,
            confidence,
          };
        }

        // Use central helper for empirical pre-heat time calculation
        const durationHours = calculatePreHeatDuration(tau, tempDelta);

        // Validate result is reasonable
        if (!Number.isFinite(durationHours) || durationHours < 0) {
          throw new Error('Unable to calculate pre-heat time');
        }

        // Calculate start time in Homey's timezone (the app process runs in UTC).
        // A target time that has already passed today means the next day.
        const timeZone = resolveHomeyTimezone(this.device.homey);
        const targetTime = nextLocalTime(targetHour, targetMinute, timeZone);

        const startTime = new Date(targetTime.getTime() - durationHours * 3600 * 1000);
        const startTimeStr = formatHourMinute(startTime, timeZone);

        // Calculate suggested setpoint boost based on duration
        const suggestedBoost = Math.min(3.0, Math.max(1.0, tempDelta * 0.5));

        this.logger(`FlowCardManagerService: Pre-heat calculation - start: ${startTimeStr}, duration: ${durationHours.toFixed(1)}h, boost: ${suggestedBoost.toFixed(1)}°C`);

        return {
          start_time: startTimeStr,
          duration_hours: Number(durationHours.toFixed(1)),
          suggested_setpoint_boost: Number(suggestedBoost.toFixed(1)),
          confidence,
        };
      });
      this.flowCardListeners.set('calculate_preheat_time_aurora3', calculatePreHeatListener);

      // ==================== CONDITION CARDS ====================

      // Condition 1: Insight is active
      const insightActiveCard = this.device.homey.flow.getConditionCard('insight_is_active_aurora3');
      const insightActiveListener = insightActiveCard.registerRunListener(async (args: { category: string }) => {
        this.logger('FlowCardManagerService: Insight is active condition triggered', { category: args.category });

        if (!this.buildingInsightsService) {
          this.logger('FlowCardManagerService: Building Insights service not available, returning false');
          return false;
        }

        const isActive = this.buildingInsightsService.isInsightActive(args.category as InsightCategory);
        this.logger(`FlowCardManagerService: Insight ${args.category} is ${isActive ? 'active' : 'not active'}`);
        return isActive;
      });
      this.flowCardListeners.set('insight_is_active_aurora3', insightActiveListener);

      // Condition 2: Confidence above threshold
      const confidenceAboveCard = this.device.homey.flow.getConditionCard('confidence_above_aurora3');
      const confidenceAboveListener = confidenceAboveCard.registerRunListener(async (args: { threshold: number }) => {
        this.logger('FlowCardManagerService: Confidence above condition triggered', { threshold: args.threshold });

        if (!this.buildingInsightsService) {
          this.logger('FlowCardManagerService: Building Insights service not available, returning false');
          return false;
        }

        const isAbove = await this.buildingInsightsService.isConfidenceAbove(args.threshold);
        this.logger(`FlowCardManagerService: Confidence is ${isAbove ? 'above' : 'below'} ${args.threshold}%`);
        return isAbove;
      });
      this.flowCardListeners.set('confidence_above_aurora3', confidenceAboveListener);

      // Condition 3: Savings above threshold
      const savingsAboveCard = this.device.homey.flow.getConditionCard('savings_above_aurora3');
      const savingsAboveListener = savingsAboveCard.registerRunListener(async (args: { category: string; threshold: number }) => {
        this.logger('FlowCardManagerService: Savings above condition triggered', { category: args.category, threshold: args.threshold });

        if (!this.buildingInsightsService) {
          this.logger('FlowCardManagerService: Building Insights service not available, returning false');
          return false;
        }

        const isAbove = this.buildingInsightsService.areSavingsAbove(args.category as InsightCategory, args.threshold);
        this.logger(`FlowCardManagerService: Savings for ${args.category} are ${isAbove ? 'above' : 'below'} €${args.threshold}/month`);
        return isAbove;
      });
      this.flowCardListeners.set('savings_above_aurora3', savingsAboveListener);

      this.logger('FlowCardManagerService: Building Insights flow cards registered (4 actions + 3 conditions)');
    } catch (error) {
      this.logger('FlowCardManagerService: Error registering Building Insights flow cards:', error);
    }
  }

  /**
   * Register Performance Report flow cards (v2.9.0)
   * - Action: Generate performance report (on-demand)
   * - Trigger: Performance report ready (daily at 23:00)
   */
  private async registerPerformanceReportCard(): Promise<void> {
    try {
      // ── Action Card: Generate Performance Report ──
      const generateReportCard = this.device.homey.flow.getActionCard('generate_performance_report_aurora3');
      const generateReportListener = generateReportCard.registerRunListener(async () => {
        this.logger('FlowCardManagerService: Generate performance report action triggered');
        return this.generateAndStoreReport();
      });
      this.flowCardListeners.set('generate_performance_report_aurora3', generateReportListener);

      // ── Trigger Card: Performance Report Ready (daily) ──
      // Store as a dedicated class property — NOT in flowCardListeners.
      // This prevents unregisterAllFlowCards() from calling unregister() on it
      // and keeps the 23:00 timer lifecycle independent from flow card re-registration.
      this.reportReadyTriggerCard = this.device.homey.flow.getDeviceTriggerCard('performance_report_ready_aurora3');

      // Schedule daily report at 23:00 only if not already scheduled.
      // The timer must survive updateFlowCards() calls — it is only cleared in destroy().
      if (this.dailyReportTimer === null && this.dailyReportInterval === null) {
        this.scheduleDailyReportTimer(this.reportReadyTriggerCard);
      }

      // Hourly silent score update for Homey Insights (v2.9.13)
      if (this.hourlyScoreInterval === null) {
        this.hourlyScoreInterval = this.device.homey.setInterval(() => {
          this.refreshPerformanceReportSilently().catch((error) => {
            this.logger('FlowCardManagerService: Hourly silent report refresh failed:', error);
          });
        }, 60 * 60 * 1000);
        this.logger('FlowCardManagerService: Hourly performance score update scheduled');
      }

      // Schedule one-time init report 2 minutes after startup (v2.9.11)
      if (!this.initReportScheduled) {
        this.initReportScheduled = true;
        this.initReportTimeout = this.device.homey.setTimeout(() => {
          this.refreshPerformanceReportSilently().catch((error) => {
            this.logger('FlowCardManagerService: Init silent report refresh failed:', error);
          });
          this.initReportTimeout = null; // Auto-cleanup na uitvoering
        }, 2 * 60 * 1000);
        this.logger('FlowCardManagerService: Init performance report scheduled in 2 minutes');
      }

      this.logger('FlowCardManagerService: Performance Report cards registered (1 action + 1 trigger)');
    } catch (error) {
      this.logger('FlowCardManagerService: Error registering Performance Report cards:', error);
    }
  }

  /**
   * Silently refresh the performance report and store result in capabilities.
   * Does NOT fire the performance_report_ready trigger card.
   * Called on app init (after 2 min delay) and on domain-affecting settings changes.
   */
  public async refreshPerformanceReportSilently(): Promise<void> {
    try {
      await this.generateAndStoreReport();
      this.logger('FlowCardManagerService: Performance report refreshed silently');
    } catch (error) {
      this.logger('FlowCardManagerService: Silent report refresh failed:', error);
    }
  }

  /**
   * Generate a performance report, store it in the capability, and return tokens.
   */
  private async generateAndStoreReport(): Promise<PerformanceReportTokens> {
    const reportService = new PerformanceReportService({
      device: this.device,
      logger: this.logger,
    });

    const report = reportService.generateReport();

    // Store report in capabilities
    const reportJson = JSON.stringify(report);
    if (this.device.hasCapability('adlar_performance_score')) {
      await this.device.setCapabilityValue('adlar_performance_score', report.overallScore);
    }
    if (this.device.hasCapability('adlar_performance_report')) {
      await this.device.setCapabilityValue('adlar_performance_report', reportJson);
    }

    this.logger(`FlowCardManagerService: Performance report generated — score ${report.overallScore}, ${report.scoredDomains}/${report.totalDomains} domains`);

    /* eslint-disable camelcase */
    return {
      overall_score: report.overallScore,
      rating: report.rating,
      summary: report.summary,
      recommendations: report.recommendations.join('\n'),
      report_json: reportJson,
    };
    /* eslint-enable camelcase */
  }

  /**
   * Schedule daily performance report trigger at 23:00 local time.
   * Uses setTimeout to align to the next 23:00, then setInterval for subsequent days.
   */
  private scheduleDailyReportTimer(triggerCard: unknown): void {
    // Clear any existing timer
    if (this.dailyReportTimer !== null) {
      this.device.homey.clearTimeout(this.dailyReportTimer);
      this.dailyReportTimer = null;
    }
    if (this.dailyReportInterval !== null) {
      this.device.homey.clearInterval(this.dailyReportInterval);
      this.dailyReportInterval = null;
    }

    // Calculate ms until next 23:00
    const now = new Date();
    const next2300 = new Date();
    next2300.setHours(23, 0, 0, 0);
    if (now >= next2300) {
      next2300.setDate(next2300.getDate() + 1);
    }
    const msUntil2300 = next2300.getTime() - now.getTime();

    this.logger(`FlowCardManagerService: Daily report scheduled in ${(msUntil2300 / 3600000).toFixed(1)}h (${next2300.toISOString()})`);

    const fireDailyReport = async () => {
      try {
        const tokens = await this.generateAndStoreReport();

        // Fire trigger card with tokens
        if (hasTrigger(triggerCard)) {
          await triggerCard.trigger(this.device, tokens);
          this.logger('FlowCardManagerService: Daily performance report trigger fired');
        }
      } catch (error) {
        this.logger('FlowCardManagerService: Error firing daily report trigger:', error);
      }
    };

    // First fire: align to 23:00
    this.dailyReportTimer = this.device.homey.setTimeout(() => {
      fireDailyReport()
        .then(() => {
          // Subsequent fires: every 24 hours
          this.dailyReportInterval = this.device.homey.setInterval(
            () => {
              fireDailyReport().catch((error) => {
                this.logger('FlowCardManagerService: Scheduled daily report failed:', error);
              });
            },
            24 * 60 * 60 * 1000,
          );
        })
        .catch((error) => {
          this.logger('FlowCardManagerService: Initial daily report schedule failed:', error);
        });
    }, msUntil2300);
  }

  /**
   * Register utility action cards (ADR-036 §4.1)
   * Stateless calculator actions: seasonal mode, curve, time schedule
   */
  private async registerUtilityActionCards(): Promise<void> {
    try {
      // Action 1: Get seasonal mode (ADR-036)
      const getSeasonalModeCard = this.device.homey.flow.getActionCard('get_seasonal_mode_aurora3');
      const getSeasonalModeListener = getSeasonalModeCard.registerRunListener(async () => {
        this.logger('FlowCardManagerService: Get seasonal mode action triggered');

        const result = SeasonalModeCalculator.getCurrentSeason();

        this.logger(`FlowCardManagerService: Seasonal mode=${result.mode}, heating=${result.isHeatingSeason}, days_until_change=${result.daysUntilSeasonChange}`);

        return {
          mode: result.mode,
          is_heating_season: result.isHeatingSeason,
          is_cooling_season: result.isCoolingSeason,
          days_until_season_change: result.daysUntilSeasonChange ?? 0,
        };
      });
      this.flowCardListeners.set('get_seasonal_mode_aurora3', getSeasonalModeListener);

      // Action 2: Calculate curve value (ADR-036)
      const calculateCurveCard = this.device.homey.flow.getActionCard('calculate_curve_value_aurora3');
      const calculateCurveListener = calculateCurveCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Calculate curve value action triggered', { args });

        const inputValue = parseFloat(String(args.input_value));
        if (Number.isNaN(inputValue) || !Number.isFinite(inputValue)) {
          throw new Error(`Invalid input value: '${args.input_value}'. Must be a number.`);
        }

        const resultValue = CurveCalculator.evaluate(inputValue, args.curve);

        this.logger(`FlowCardManagerService: Curve result: input=${inputValue} → output=${resultValue}`);

        return { result_value: resultValue };
      });
      this.flowCardListeners.set('calculate_curve_value_aurora3', calculateCurveListener);

      // Action 3: Calculate time-based value (ADR-036)
      const calculateTimeBasedCard = this.device.homey.flow.getActionCard('calculate_time_based_value_aurora3');
      const calculateTimeBasedListener = calculateTimeBasedCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Calculate time-based value action triggered', { args });

        const resultValue = TimeScheduleCalculator.evaluate(args.schedule);

        this.logger(`FlowCardManagerService: Time schedule result: ${resultValue}`);

        return { result_value: resultValue };
      });
      this.flowCardListeners.set('calculate_time_based_value_aurora3', calculateTimeBasedListener);

      this.logger('FlowCardManagerService: Utility action cards registered (3 cards)');
    } catch (error) {
      this.logger('FlowCardManagerService: Error registering utility action cards:', error);
    }
  }

  /**
   * Parse a Modbus register address from a string (hex 0x… or decimal).
   * Throws when the input cannot be converted to a valid integer.
   */
  private parseModbusAddress(input: string): number {
    const trimmed = input.trim();
    const parsed = trimmed.toLowerCase().startsWith('0x')
      ? parseInt(trimmed, 16)
      : parseInt(trimmed, 10);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 0xFFFF) {
      throw new Error(`Ongeldig registeradres: '${input}'. Gebruik hex (0x0301) of decimaal (769).`);
    }
    return parsed;
  }

  /**
   * Register Modbus direct-access action flow cards (ADR-045).
   * - modbus_read_register  — leest één holding register en geeft de waarde terug als token
   * - modbus_write_register — schrijft een ruwe waarde naar één holding register
   */
  private async registerModbusDirectAccessCards(): Promise<void> {
    try {
      // Action: Read Modbus register
      const readCard = this.device.homey.flow.getActionCard('modbus_read_register_aurora3');
      const readListener = readCard.registerRunListener(async (args: { address: string }) => {
        const addr = this.parseModbusAddress(args.address);
        this.logger(`FlowCardManagerService: modbus_read_register addr=0x${addr.toString(16).toUpperCase()}`);
        const rawValue = await this.onModbusRead(addr);
        this.logger(`FlowCardManagerService: modbus_read_register result=${rawValue}`);
        return { raw_value: rawValue }; // eslint-disable-line camelcase
      });
      this.flowCardListeners.set('modbus_read_register_aurora3', readListener);

      // Action: Write Modbus register
      const writeCard = this.device.homey.flow.getActionCard('modbus_write_register_aurora3');
      const writeListener = writeCard.registerRunListener(async (args: { address: string; value: number }) => {
        const addr = this.parseModbusAddress(args.address);
        const raw = Math.round(args.value);
        this.logger(`FlowCardManagerService: modbus_write_register addr=0x${addr.toString(16).toUpperCase()} value=${raw}`);
        await this.onModbusWrite(addr, raw);
        this.logger('FlowCardManagerService: modbus_write_register done');
        return true;
      });
      this.flowCardListeners.set('modbus_write_register_aurora3', writeListener);

      this.logger('FlowCardManagerService: Modbus direct-access cards registered (2 cards)');
    } catch (error) {
      this.logger('FlowCardManagerService: Error registering Modbus direct-access cards:', error);
    }
  }

  /**
   * Register external data action cards (v2.6.1)
   * Consolidates all receive_external_* action cards and diagnose_building_model
   * Previously in device.ts registerFlowCardActionListeners()
   */
  private async registerExternalDataActionCards(): Promise<void> {
    try {
      // 1. Receive external power data
      const receiveExternalPowerCard = this.device.homey.flow.getActionCard('receive_external_power_data_aurora3');
      const receiveExternalPowerListener = receiveExternalPowerCard.registerRunListener(
        // eslint-disable-next-line camelcase
        async (args: { power_value: number }) => {
          this.logger(`FlowCardManagerService: 📊 Received external power data: ${args.power_value}W`);
          await this.handleReceiveExternalPowerData(args);
          return true;
        },
      );
      this.flowCardListeners.set('receive_external_power_data_aurora3', receiveExternalPowerListener);

      // 2. Receive external flow data
      const receiveExternalFlowCard = this.device.homey.flow.getActionCard('receive_external_flow_data_aurora3');
      const receiveExternalFlowListener = receiveExternalFlowCard.registerRunListener(
        // eslint-disable-next-line camelcase
        async (args: { flow_value: number }) => {
          this.logger(`FlowCardManagerService: 🌊 Received external flow data: ${args.flow_value}L/min`);
          await this.handleReceiveExternalFlowData(args);
          return true;
        },
      );
      this.flowCardListeners.set('receive_external_flow_data_aurora3', receiveExternalFlowListener);

      // 3. Receive external ambient data
      const receiveExternalAmbientCard = this.device.homey.flow.getActionCard('receive_external_ambient_data_aurora3');
      const receiveExternalAmbientListener = receiveExternalAmbientCard.registerRunListener(
        // eslint-disable-next-line camelcase
        async (args: { temperature_value: number }) => {
          this.logger(`FlowCardManagerService: 🌡️ Received external ambient data: ${args.temperature_value}°C`);
          await this.handleReceiveExternalAmbientData(args);
          return true;
        },
      );
      this.flowCardListeners.set('receive_external_ambient_data_aurora3', receiveExternalAmbientListener);

      // 4. Receive external indoor temperature
      const receiveExternalIndoorCard = this.device.homey.flow.getActionCard('receive_external_indoor_temperature_aurora3');
      const receiveExternalIndoorListener = receiveExternalIndoorCard.registerRunListener(
        // eslint-disable-next-line camelcase
        async (args: { temperature_value: number | string }) => {
          const { temperature_value: temperatureValueRaw } = args;

          let temperatureValue: number;
          if (typeof temperatureValueRaw === 'number') {
            temperatureValue = temperatureValueRaw;
          } else if (typeof temperatureValueRaw === 'string') {
            temperatureValue = parseFloat(temperatureValueRaw);
          } else {
            throw new Error('Temperature value must be a number or numeric string');
          }

          if (Number.isNaN(temperatureValue) || !Number.isFinite(temperatureValue)) {
            throw new Error(`Temperature value must be a valid number (received: "${temperatureValueRaw}")`);
          }

          this.logger(`FlowCardManagerService: 🏠 Received external indoor temperature: ${temperatureValue}°C`);

          // Call AdaptiveControlService to store the temperature
          // @ts-expect-error - serviceCoordinator exists in MyDevice
          const adaptiveControl = this.device.serviceCoordinator?.getAdaptiveControl();
          if (adaptiveControl) {
            await adaptiveControl.receiveExternalTemperature(temperatureValue);
          }
          return true;
        },
      );
      this.flowCardListeners.set('receive_external_indoor_temperature_aurora3', receiveExternalIndoorListener);

      // 5. Receive external energy prices
      const receiveExternalPricesCard = this.device.homey.flow.getActionCard('receive_external_energy_prices_aurora3');
      const receiveExternalPricesListener = receiveExternalPricesCard.registerRunListener(
        // eslint-disable-next-line camelcase
        async (args: { prices_json: string }) => {
          this.logger(`FlowCardManagerService: 💰 Received external energy prices (${args.prices_json.length} chars)`);
          await this.handleReceiveExternalEnergyPrices(args);
          return true;
        },
      );
      this.flowCardListeners.set('receive_external_energy_prices_aurora3', receiveExternalPricesListener);

      // 6. Receive external wind data
      const receiveExternalWindCard = this.device.homey.flow.getActionCard('receive_external_wind_data_aurora3');
      const receiveExternalWindListener = receiveExternalWindCard.registerRunListener(
        // eslint-disable-next-line camelcase
        async (args: { wind_speed: number }) => {
          this.logger(`FlowCardManagerService: 💨 Received external wind speed: ${args.wind_speed} km/h`);
          await this.handleReceiveExternalWindData(args);
          return true;
        },
      );
      this.flowCardListeners.set('receive_external_wind_data_aurora3', receiveExternalWindListener);

      // 7. Receive external solar power
      const receiveExternalSolarPowerCard = this.device.homey.flow.getActionCard('receive_external_solar_power_aurora3');
      const receiveExternalSolarPowerListener = receiveExternalSolarPowerCard.registerRunListener(
        // eslint-disable-next-line camelcase
        async (args: { power_value: number }) => {
          this.logger(`FlowCardManagerService: ☀️ Received external solar power: ${args.power_value} W`);
          await this.handleReceiveExternalSolarPower(args);
          return true;
        },
      );
      this.flowCardListeners.set('receive_external_solar_power_aurora3', receiveExternalSolarPowerListener);

      // 8. Receive external solar radiation
      const receiveExternalSolarRadiationCard = this.device.homey.flow.getActionCard('receive_external_solar_radiation_aurora3');
      const receiveExternalSolarRadiationListener = receiveExternalSolarRadiationCard.registerRunListener(
        // eslint-disable-next-line camelcase
        async (args: { radiation_value: number }) => {
          this.logger(`FlowCardManagerService: 🌞 Received external solar radiation: ${args.radiation_value} W/m²`);
          await this.handleReceiveExternalSolarRadiation(args);
          return true;
        },
      );
      this.flowCardListeners.set('receive_external_solar_radiation_aurora3', receiveExternalSolarRadiationListener);

      this.logger('FlowCardManagerService: External data action cards registered (8 cards)');
    } catch (error) {
      this.logger('FlowCardManagerService: Error registering external data action cards:', error);
    }
  }

  /**
   * Unregister all flow card listeners that were previously registered by this service.
   */
  private unregisterAllFlowCards(): void {
    this.flowCardListeners.forEach((listener, cardId) => {
      try {
        if (listener && typeof (listener as { unregister?: () => void }).unregister === 'function') {
          (listener as { unregister: () => void }).unregister();
        }
        this.logger(`Unregistered flow card: ${cardId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger(`Flow card ${cardId} was not registered or already unregistered:`, errorMessage);
      }
    });
    this.flowCardListeners.clear();

    // Note: dailyReportTimer and dailyReportInterval are intentionally NOT cleared here.
    // The 23:00 scheduler lifecycle is independent from flow card re-registration.
    // Timers are only cleared in destroy() when the service is fully shut down.

    this.logger('All flow card listeners unregistered');
  }

  /**
   * Safely trigger a flow card by id with tokens; catches and logs errors.
   * @param cardId - id of the flow card to trigger
   * @param tokens - token object used to populate flow card tokens
   */
  private async triggerFlowCard(cardId: string, tokens: Record<string, unknown>) {
    try {
      // Check if the flow card is registered and should be triggered
      const flowCard = this.flowCardListeners.get(cardId);
      if (!flowCard) {
        this.logger(`Flow card ${cardId} not registered, skipping trigger`);
        return;
      }

      // Check if trigger method exists on the flow card
      if (flowCard && typeof (flowCard as { trigger?: (device: unknown, tokens: unknown, state?: unknown) => Promise<void> }).trigger === 'function') {
        await (flowCard as { trigger: (device: unknown, tokens: unknown, state?: unknown) => Promise<void> }).trigger(this, tokens, { device: this });
        this.logger(`Triggered flow card: ${cardId}`, tokens);
      } else {
        // Geen terugval op app-level triggers: de app heeft er geen voor _aurora3-kaarten
        // (ADR-004 §5, 4c), en een ongetypeerde app-cast zou dat verhullen.
        this.logger(`Flow card trigger method not found: ${cardId}`);
      }
    } catch (error) {
      this.logger(`Failed to trigger flow card ${cardId}:`, error);
      throw error;
    }
  }

  /**
   * Handler for receive external ambient data action flow.
   * Updates the device using FlowCardManagerService -> EnergyTrackingService.
   * @param args - { temperature_value }
   */
  // eslint-disable-next-line camelcase
  async handleReceiveExternalAmbientData(args: { temperature_value: number }): Promise<void> {
    try {
      if (this.device.hasCapability('adlar_external_ambient')) {
        await this.device.setCapabilityValue('adlar_external_ambient', args.temperature_value); // eslint-disable-line camelcase
        (this.device as unknown as { registerExternalDataReceived(cap: string): void }).registerExternalDataReceived('adlar_external_ambient');
        this.logger(`FlowCardManagerService: External ambient temperature updated: ${args.temperature_value}°C`); // eslint-disable-line camelcase

        // Store for persistence across app updates
        await this.device.setStoreValue('external_outdoor_temp', args.temperature_value);
        await this.device.setStoreValue('external_outdoor_temp_timestamp', Date.now());

        // Update diagnostic capability
        if (this.device.hasCapability('adlar_last_outdoor_temp_received')) {
          const ts = this.formatDiagnosticTimestamp();
          await this.device.setCapabilityValue('adlar_last_outdoor_temp_received', `${ts} | ${args.temperature_value.toFixed(1)}°C`); // eslint-disable-line camelcase
        }

        // Emit event for other services
        this.device.emit('external-data:ambient', args.temperature_value);
      }
    } catch (error) {
      this.logger('FlowCardManagerService: Error receiving external ambient data:', error);
      throw error;
    }
  }

  /**
   * Handler for receive external flow action flow.
   */
  // eslint-disable-next-line camelcase
  async handleReceiveExternalFlowData(args: { flow_value: number }): Promise<void> {
    try {
      if (this.device.hasCapability('adlar_external_flow')) {
        await this.device.setCapabilityValue('adlar_external_flow', args.flow_value); // eslint-disable-line camelcase
        (this.device as unknown as { registerExternalDataReceived(cap: string): void }).registerExternalDataReceived('adlar_external_flow');
        this.logger(`FlowCardManagerService: External flow data updated: ${args.flow_value} L/min`); // eslint-disable-line camelcase

        // Emit event for other services
        this.device.emit('external-data:flow', args.flow_value);
      }
    } catch (error) {
      this.logger('FlowCardManagerService: Error receiving external flow data:', error);
      throw error;
    }
  }

  /**
   * Handler for receive external power action flow.
   */
  // eslint-disable-next-line camelcase
  async handleReceiveExternalPowerData(args: { power_value: number }): Promise<void> {
    try {
      if (this.device.hasCapability('adlar_external_power')) {
        await this.device.setCapabilityValue('adlar_external_power', args.power_value); // eslint-disable-line camelcase
        (this.device as unknown as { registerExternalDataReceived(cap: string): void }).registerExternalDataReceived('adlar_external_power');
        this.logger(`FlowCardManagerService: External power data updated: ${args.power_value}W`); // eslint-disable-line camelcase

        // Update defrost active power if applicable
        if (this.device.hasCapability('defrost_active_power')) {
          const isDefrosting = this.device.getCapabilityValue('adlar_defrosting') || false;
          const newValue = isDefrosting ? args.power_value : 0; // eslint-disable-line camelcase
          await this.device.setCapabilityValue('defrost_active_power', newValue);
        }

        // Delegate to EnergyTrackingService for energy calculations via callback
        await this.onExternalPowerData(args.power_value); // eslint-disable-line camelcase
      }
    } catch (error) {
      this.logger('FlowCardManagerService: Error receiving external power data:', error);
      throw error;
    }
  }

  /**
   * Handler for receive external energy prices action flow (v2.4.0+).
   * Accepts hourly energy prices from external sources to replace EnergyZero API.
   *
   * v2.8.2: Supports two input formats:
   * - Array (primary):  [0.0829, 0.083, ...] where index = hour offset from current hour
   * - Object (legacy):  {"0": 0.2747, "1": 0.2510, ...} with hour offsets as keys
   *
   * @param args.prices_json - JSON string with prices in either format
   */
  // eslint-disable-next-line camelcase
  async handleReceiveExternalEnergyPrices(args: { prices_json: string }): Promise<void> {
    try {
      const { prices_json: pricesJsonRaw } = args;

      this.logger(`FlowCardManagerService: Received external energy prices (${pricesJsonRaw.length} chars)`);

      // v2.8.2: Parse JSON string — supports two formats:
      // 1. Array (primary):  [0.0829, 0.083, ...] where index = hour offset from current hour
      // 2. Object (legacy):  {"0": 0.2747, "1": 0.2510, ...} with hour offsets as keys
      let pricesObject: Record<string, number>;
      try {
        const parsed = JSON.parse(pricesJsonRaw);

        if (Array.isArray(parsed)) {
          // Primary format: array → convert to object with index as hour offset key
          pricesObject = {};
          for (let i = 0; i < parsed.length; i++) {
            if (typeof parsed[i] === 'number' && !Number.isNaN(parsed[i])) {
              pricesObject[String(i)] = parsed[i];
            }
          }
          this.logger(`FlowCardManagerService: Converted array format (${parsed.length} entries) to hour-offset object`);
        } else if (typeof parsed === 'object' && parsed !== null) {
          // Legacy format: object with hour offsets as keys
          pricesObject = parsed as Record<string, number>;
        } else {
          throw new Error('Prices must be an array [0.11, 0.10, ...] or object {"0":0.11, "1":0.10, ...}');
        }
      } catch (error) {
        this.device.error('❌ FlowCardManagerService: Failed to parse prices JSON:', error);
        throw new Error(`Invalid JSON format: ${(error as Error).message}`);
      }

      // Validate that we have at least one price entry
      if (Object.keys(pricesObject).length === 0) {
        throw new Error('Prices object must contain at least one hour:price entry');
      }

      // Get ServiceCoordinator to access EnergyPriceOptimizer
      // @ts-expect-error - Accessing device.serviceCoordinator (not in Homey.Device base type)
      const energyOptimizer = this.device.serviceCoordinator?.getAdaptiveControl()?.getEnergyPriceOptimizer();
      if (!energyOptimizer) {
        throw new Error('Price optimizer not available. Enable adaptive control and price optimization in settings.');
      }

      // Update price optimizer with external prices
      energyOptimizer.setExternalPrices(pricesObject);

      const priceCount = Object.keys(pricesObject).length;
      this.logger(`FlowCardManagerService: External energy prices updated: ${priceCount} hours received`);

      if (this.device.hasCapability('energy_prices_data')) {
        // Hour labels in Homey's timezone (the app process runs in UTC)
        const timeZone = resolveHomeyTimezone(this.device.homey);

        // Build rich JSON schedule from EnergyPriceOptimizer data
        const priceDataArray = energyOptimizer.getPriceData();
        const cheapestBlock = energyOptimizer.findCheapestBlock(4); // 4-hour block
        const expensiveBlock = energyOptimizer.findMostExpensiveBlock(2); // 2-hour block

        // Build per-hour schedule with category and advice
        const schedule = priceDataArray.map((pd: { timestamp: number; price: number; category: string }) => {
          const hourDate = new Date(pd.timestamp);
          const hourStr = formatHourMinute(hourDate, timeZone);

          // Determine advice based on category
          let advice = 'maintain';
          if (pd.category === 'very_low' || pd.category === 'low') {
            advice = 'preheat';
          } else if (pd.category === 'high' || pd.category === 'very_high') {
            advice = 'reduce';
          }

          return {
            hour: hourStr,
            price: Math.round(pd.price * 10000) / 10000, // 4 decimals
            category: pd.category,
            advice,
          };
        });

        // Build summary
        const summary: Record<string, unknown> = {};
        if (cheapestBlock) {
          summary.cheapestBlock = {
            start: formatHourMinute(cheapestBlock.startTime, timeZone),
            end: formatHourMinute(cheapestBlock.endTime, timeZone),
            avgPrice: Math.round(cheapestBlock.avgPrice * 10000) / 10000,
            hours: cheapestBlock.totalHours,
          };
        }
        if (expensiveBlock) {
          summary.expensiveBlock = {
            start: formatHourMinute(expensiveBlock.startTime, timeZone),
            end: formatHourMinute(expensiveBlock.endTime, timeZone),
            avgPrice: Math.round(expensiveBlock.avgPrice * 10000) / 10000,
            hours: expensiveBlock.totalHours,
          };
        }

        const richData = {
          timestamp: new Date().toISOString(),
          hoursAvailable: priceDataArray.length,
          summary,
          schedule,
        };

        await this.device.setCapabilityValue('energy_prices_data', JSON.stringify(richData));
        this.logger(`FlowCardManagerService: energy_prices_data updated with ${priceDataArray.length} hours of data`);
      }

      // Delegate to AdaptiveControlService for immediate capability updates via callback
      await this.onExternalPricesData(pricesObject);
    } catch (error) {
      this.device.error('❌ FlowCardManagerService: Error receiving external energy prices:', error);
      throw error;
    }
  }

  /**
   * Handler for receive external wind data action flow (v2.7.0+).
   * Updates the wind speed capability for wind correction calculations.
   *
   * @param args.wind_speed - Wind speed in km/h
   */
  // eslint-disable-next-line camelcase
  async handleReceiveExternalWindData(args: { wind_speed: number }): Promise<void> {
    try {
      const { wind_speed: windSpeed } = args;

      // Validate wind speed
      if (typeof windSpeed !== 'number' || Number.isNaN(windSpeed)) {
        throw new Error(`Invalid wind speed value: ${windSpeed}`);
      }

      if (windSpeed < 0 || windSpeed > 200) {
        throw new Error(`Wind speed out of valid range: ${windSpeed} km/h (must be 0-200 km/h)`);
      }

      // Update capability
      if (this.device.hasCapability('adlar_external_wind_speed')) {
        await this.device.setCapabilityValue('adlar_external_wind_speed', windSpeed);
        this.logger(`FlowCardManagerService: External wind speed updated: ${windSpeed} km/h`);
      }

      // Store for persistence
      await this.device.setStoreValue('external_wind_speed', windSpeed);
      await this.device.setStoreValue('external_wind_speed_timestamp', Date.now());

      // Update diagnostic capability
      if (this.device.hasCapability('adlar_last_wind_received')) {
        const ts = this.formatDiagnosticTimestamp();
        await this.device.setCapabilityValue('adlar_last_wind_received', `${ts} | ${windSpeed.toFixed(0)}km/h`);
      }

    } catch (error) {
      this.logger('FlowCardManagerService: Error receiving external wind data:', error);
      throw error;
    }
  }

  /**
   * Handler for receive external solar power action flow (v2.7.0+).
   * Updates the solar power capability for solar radiation calculations.
   *
   * @param args.power_value - Solar panel power in Watts
   */
  // eslint-disable-next-line camelcase
  async handleReceiveExternalSolarPower(args: { power_value: number }): Promise<void> {
    try {
      const { power_value: powerValue } = args;

      // Validate power value
      if (typeof powerValue !== 'number' || Number.isNaN(powerValue)) {
        throw new Error(`Invalid solar power value: ${powerValue}`);
      }

      if (powerValue < 0 || powerValue > 50000) {
        throw new Error(`Solar power out of valid range: ${powerValue} W (must be 0-50000 W)`);
      }

      // Update capability
      if (this.device.hasCapability('adlar_external_solar_power')) {
        await this.device.setCapabilityValue('adlar_external_solar_power', powerValue);
        this.logger(`FlowCardManagerService: External solar power updated: ${powerValue} W`);
      }

      // Store for persistence
      await this.device.setStoreValue('external_solar_power', powerValue);
      await this.device.setStoreValue('external_solar_power_timestamp', Date.now());

      // Update diagnostic capability
      if (this.device.hasCapability('adlar_last_solar_power_received')) {
        const ts = this.formatDiagnosticTimestamp();
        await this.device.setCapabilityValue('adlar_last_solar_power_received', `${ts} | ${powerValue.toFixed(0)}W`);
      }

    } catch (error) {
      this.logger('FlowCardManagerService: Error receiving external solar power:', error);
      throw error;
    }
  }

  /**
   * Handler for receive external solar radiation action flow (v2.7.0+).
   * Updates the solar radiation capability for building model calculations.
   *
   * @param args.radiation_value - Solar radiation in W/m²
   */
  // eslint-disable-next-line camelcase
  async handleReceiveExternalSolarRadiation(args: { radiation_value: number }): Promise<void> {
    try {
      const { radiation_value: radiationValue } = args;

      // Validate radiation value
      if (typeof radiationValue !== 'number' || Number.isNaN(radiationValue)) {
        throw new Error(`Invalid solar radiation value: ${radiationValue}`);
      }

      if (radiationValue < 0 || radiationValue > 1500) {
        throw new Error(`Solar radiation out of valid range: ${radiationValue} W/m² (must be 0-1500 W/m²)`);
      }

      // Update capability
      if (this.device.hasCapability('adlar_external_solar_radiation')) {
        await this.device.setCapabilityValue('adlar_external_solar_radiation', radiationValue);
        this.logger(`FlowCardManagerService: External solar radiation updated: ${radiationValue} W/m²`);
      }

      // Store for persistence
      await this.device.setStoreValue('external_solar_radiation', radiationValue);
      await this.device.setStoreValue('external_solar_radiation_timestamp', Date.now());

      // Update diagnostic capability
      if (this.device.hasCapability('adlar_last_solar_radiation_received')) {
        const ts = this.formatDiagnosticTimestamp();
        await this.device.setCapabilityValue('adlar_last_solar_radiation_received', `${ts} | ${radiationValue.toFixed(0)}W/m²`);
      }

    } catch (error) {
      this.logger('FlowCardManagerService: Error receiving external solar radiation:', error);
      throw error;
    }
  }

  /**
   * Return the list of registered flow-card IDs.
   */
  getRegisteredFlowCards(): string[] {
    return Array.from(this.flowCardListeners.keys());
  }

  /**
   * Return whether the flow manager has finished initialization.
   */
  getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  /**
   * Update internal registration based on changed settings.
   * @param changedKeys - array of settings keys that were modified
   */
  async updateSettings(changedKeys: string[]): Promise<void> {
    void changedKeys;
  }

  /**
   * Destroy service and unregister flow cards/listeners.
   */
  destroy(): void {
    this.logger('FlowCardManagerService: Destroying service');

    // Clear any pending retry timer to prevent orphaned setTimeout callbacks
    if (this.initializationRetryTimer) {
      clearTimeout(this.initializationRetryTimer);
      this.initializationRetryTimer = null;
    }

    // Clear hourly score interval
    if (this.hourlyScoreInterval !== null) {
      this.device.homey.clearInterval(this.hourlyScoreInterval);
      this.hourlyScoreInterval = null;
    }

    // Clear daily report timer — only place where these are intentionally destroyed
    if (this.dailyReportTimer !== null) {
      this.device.homey.clearTimeout(this.dailyReportTimer);
      this.dailyReportTimer = null;
    }
    if (this.dailyReportInterval !== null) {
      this.device.homey.clearInterval(this.dailyReportInterval);
      this.dailyReportInterval = null;
    }

    // Clear init performance report timeout (ADR-022)
    if (this.initReportTimeout) {
      this.device.homey.clearTimeout(this.initReportTimeout);
      this.initReportTimeout = null;
    }

    this.unregisterAllFlowCards();
    this.isInitialized = false;
    this.logger('FlowCardManagerService: Service destroyed');
  }
}
