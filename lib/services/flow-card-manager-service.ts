/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';
import { TuyaErrorCategorizer } from '../error-types';
import { CapabilityCategories, UserFlowPreferences } from '../types/shared-interfaces';
import type { BuildingInsightsService } from './building-insights-service';

export interface FlowCardManagerOptions {
  device: Homey.Device;
  logger?: (message: string, ...args: unknown[]) => void;
  onExternalPowerData?: (powerValue: number) => Promise<void>;
  onExternalPricesData?: (pricesObject: Record<string, number>) => Promise<void>;
  buildingInsightsService?: BuildingInsightsService; // v2.5.0: Building insights flow cards
}

export class FlowCardManagerService {
  private device: Homey.Device;
  private logger: (message: string, ...args: unknown[]) => void;
  private onExternalPowerData: (powerValue: number) => Promise<void>;
  private onExternalPricesData: (pricesObject: Record<string, number>) => Promise<void>;
  private buildingInsightsService?: BuildingInsightsService; // v2.5.0
  private flowCardListeners = new Map<string, unknown>();
  private isInitialized = false;
  private initializationRetryTimer: NodeJS.Timeout | null = null;

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
   * Refresh the set of flow cards (re-register based on current capabilities and data availability).
   * @param capabilitiesWithData - optional list of capabilities known to have recent data
   */
  async updateFlowCards(capabilitiesWithData?: string[]): Promise<void> {
    try {
      // Don't proceed if device isn't fully initialized yet
      if (!this.isInitialized && Object.keys(this.device.homey.drivers.getDrivers()).length === 0) {
        this.logger('FlowCardManagerService: Skipping flow card update - system not ready');
        return;
      }

      // Unregister all current flow card listeners
      this.unregisterAllFlowCards();

      // Get current user preferences and available capabilities
      const userPrefs = this.getUserFlowPreferences();
      const availableCaps = this.getAvailableCapabilities();
      const healthyCapabilities = capabilitiesWithData || await this.detectCapabilitiesWithData();

      // Register flow cards based on settings
      await this.registerFlowCardsByCategory('temperature', availableCaps.temperature, userPrefs.flow_temperature_alerts, healthyCapabilities);
      await this.registerFlowCardsByCategory('voltage', availableCaps.voltage, userPrefs.flow_voltage_alerts, healthyCapabilities);
      await this.registerFlowCardsByCategory('current', availableCaps.current, userPrefs.flow_current_alerts, healthyCapabilities);
      await this.registerFlowCardsByCategory('power', availableCaps.power, userPrefs.flow_power_alerts, healthyCapabilities);
      await this.registerFlowCardsByCategory('pulseSteps', availableCaps.pulseSteps, userPrefs.flow_pulse_steps_alerts, healthyCapabilities);
      await this.registerFlowCardsByCategory('states', availableCaps.states, userPrefs.flow_state_alerts, healthyCapabilities);
      await this.registerFlowCardsByCategory('efficiency', availableCaps.efficiency, userPrefs.flow_efficiency_alerts, healthyCapabilities);

      // Expert feature cards
      if (userPrefs.flow_expert_mode) {
        await this.registerExpertFeatureCards();
      }

      // Register action-based condition cards (always available)
      await this.registerActionBasedConditionCards();

      // Register Building Insights cards (v2.5.0 - always available if service exists)
      if (this.buildingInsightsService) {
        await this.registerBuildingInsightsCards();
      }

      // Register external data action cards (v2.6.1 - consolidates from device.ts)
      await this.registerExternalDataActionCards();

      this.logger('FlowCardManagerService: Flow cards updated successfully');
    } catch (error) {
      this.logger('FlowCardManagerService: Error updating flow cards:', error);
    }
  }

  /**
   * Read user preferences related to flow card registration and return defaults if missing.
   */
  private getUserFlowPreferences(): UserFlowPreferences {
    return {
      flow_temperature_alerts: this.device.getSetting('flow_temperature_alerts') || 'auto',
      flow_voltage_alerts: this.device.getSetting('flow_voltage_alerts') || 'auto',
      flow_current_alerts: this.device.getSetting('flow_current_alerts') || 'auto',
      flow_power_alerts: this.device.getSetting('flow_power_alerts') || 'auto',
      flow_pulse_steps_alerts: this.device.getSetting('flow_pulse_steps_alerts') || 'auto',
      flow_state_alerts: this.device.getSetting('flow_state_alerts') || 'auto',
      flow_efficiency_alerts: this.device.getSetting('flow_efficiency_alerts') || 'auto',
      flow_expert_mode: this.device.getSetting('flow_expert_mode') || false,
    };
  }

  /**
   * Return available capabilities grouped by category (temperature, voltage, etc).
   */
  private getAvailableCapabilities(): CapabilityCategories {
    const capabilities = this.device.getCapabilities();
    const result: CapabilityCategories = {
      temperature: [],
      voltage: [],
      current: [],
      power: [],
      pulseSteps: [],
      states: [],
      efficiency: [],
      calculated: [], // v1.2.3: COP/SCOP calculations
      external: [], // v1.2.3: External integrations
      monitoring: [], // v1.3.14: Connection monitoring (excluded from health)
      building_model: [], // v1.3.14: Building model learned parameters (excluded from health)
      energy_pricing: [], // v1.3.14: Energy price/cost data (excluded from health)
    };

    capabilities.forEach((capability) => {
      const category = this.getCapabilityCategory(capability);
      if (category in result) {
        result[category as keyof CapabilityCategories].push(capability);
      }
    });

    return result;
  }

  /**
   * Map a capability id to a flow-card category key.
   * @returns one of the CapabilityCategories keys
   */
  private getCapabilityCategory(capability: string): keyof CapabilityCategories {
    if (capability.startsWith('measure_temperature')) return 'temperature';
    if (capability.startsWith('measure_voltage')) return 'voltage';
    if (capability.startsWith('measure_current')) return 'current';
    if (capability.includes('power') || capability.includes('energy')) return 'power';
    if (capability.includes('pulse_steps')) return 'pulseSteps';
    if (capability.startsWith('adlar_state')) return 'states';
    if (capability.includes('cop') || capability.includes('scop')) return 'efficiency';
    return 'temperature'; // Default fallback
  }

  /**
   * Detect capabilities that actually have recent data (for 'auto' registration mode).
   * By default this delegates to CapabilityHealthService; a simplified fallback is provided here.
   */
  private async detectCapabilitiesWithData(): Promise<string[]> {
    // This would typically get data from the CapabilityHealthService
    // For now, return all capabilities as having data
    const capabilitiesWithData: string[] = [];
    const capabilities = this.device.getCapabilities();

    for (const capability of capabilities) {
      const value = this.device.getCapabilityValue(capability);
      if (value !== null && value !== undefined) {
        capabilitiesWithData.push(capability);
      }
    }

    return capabilitiesWithData;
  }

  /**
   * Register trigger/action/condition flow cards for a specific category if user settings permit it.
   */
  private async registerFlowCardsByCategory(
    category: keyof CapabilityCategories,
    availableCaps: string[],
    userSetting: 'disabled' | 'auto' | 'enabled',
    capabilitiesWithData: string[],
  ): Promise<void> {
    const shouldRegister = this.shouldRegisterCategory(category, availableCaps, userSetting, capabilitiesWithData);

    if (!shouldRegister) {
      const withDataCount = availableCaps.filter((cap) => capabilitiesWithData.includes(cap)).length;
      this.logger(`FlowCardManagerService: Skipping ${category} flow cards - setting: ${userSetting}`);
      this.logger(`FlowCardManagerService: Available: ${availableCaps.length}, with data: ${withDataCount}`);
      return;
    }

    this.logger(`FlowCardManagerService: Registering ${category} flow cards - available capabilities:`, availableCaps.filter((cap) => capabilitiesWithData.includes(cap)));

    // Flow cards are handled by the pattern-based system in app.ts
    // No device-level registration needed for trigger cards
    this.logger(`FlowCardManagerService: Category ${category} flow cards managed by pattern-based system`);
  }

  /**
   * Decide whether cards for a category should be registered based on availability and user preference.
   */
  private shouldRegisterCategory(
    _category: keyof CapabilityCategories,
    availableCaps: string[],
    userSetting: string,
    capabilitiesWithData: string[],
  ): boolean {
    switch (userSetting) {
      case 'disabled':
        return false;

      case 'enabled':
        return availableCaps.length > 0; // Has capabilities

      case 'auto':
      default:
        // Auto mode: require both capability AND data
        return availableCaps.length > 0
          && availableCaps.some((cap) => capabilitiesWithData.includes(cap));
    }
  }

  /**
   * Register advanced/expert-only flow cards. Called only when user enables expert features.
   */
  private async registerExpertFeatureCards(): Promise<void> {
    try {
      // v1.3.12: Expert trigger cards now registered in app.ts with full threshold monitoring
      // This method kept for compatibility but no longer registers cards here
      // Cards: compressor_efficiency_alert, fan_motor_efficiency_alert, water_flow_alert

      this.logger('FlowCardManagerService: Expert feature cards registration skipped (handled in app.ts)');
    } catch (error) {
      this.logger('FlowCardManagerService: Error in registerExpertFeatureCards:', error);
    }
  }

  /**
   * Register action-based condition cards built from patterns in the app.
   */
  private async registerActionBasedConditionCards(): Promise<void> {
    try {
      // Device power state condition
      const devicePowerCard = this.device.homey.flow.getConditionCard('device_power_is');
      const devicePowerListener = devicePowerCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Device power condition triggered', { args });
        const currentValue = this.device.getCapabilityValue('onoff');
        const expectedState = args.state === 'on';
        return currentValue === expectedState;
      });
      this.flowCardListeners.set('device_power_is', devicePowerListener);

      // Target temperature condition
      const targetTempCard = this.device.homey.flow.getConditionCard('target_temperature_is');
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
      this.flowCardListeners.set('target_temperature_is', targetTempListener);

      // Hot water temperature condition
      const hotWaterTempCard = this.device.homey.flow.getConditionCard('hotwater_temperature_is');
      const hotWaterTempListener = hotWaterTempCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Hot water temperature condition triggered', { args });
        const currentValue = this.device.getCapabilityValue('adlar_hotwater') || 0;
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
      this.flowCardListeners.set('hotwater_temperature_is', hotWaterTempListener);

      // Heating mode condition
      const heatingModeCard = this.device.homey.flow.getConditionCard('heating_mode_is');
      const heatingModeListener = heatingModeCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Heating mode condition triggered', { args });
        const currentValue = this.device.getCapabilityValue('adlar_enum_mode');
        return currentValue === args.mode;
      });
      this.flowCardListeners.set('heating_mode_is', heatingModeListener);

      // Work mode condition
      const workModeCard = this.device.homey.flow.getConditionCard('work_mode_is');
      const workModeListener = workModeCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Work mode condition triggered', { args });
        const currentValue = this.device.getCapabilityValue('adlar_enum_work_mode');
        return currentValue === args.mode;
      });
      this.flowCardListeners.set('work_mode_is', workModeListener);

      // Water mode condition
      const waterModeCard = this.device.homey.flow.getConditionCard('water_mode_is');
      const waterModeListener = waterModeCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Water mode condition triggered', { args });
        const currentValue = this.device.getCapabilityValue('adlar_enum_water_mode') || 0;
        const targetValue = args.mode || 0;

        switch (args.comparison) {
          case 'equal':
            return currentValue === targetValue;
          case 'greater':
            return currentValue > targetValue;
          case 'less':
            return currentValue < targetValue;
          default:
            return false;
        }
      });
      this.flowCardListeners.set('water_mode_is', waterModeListener);

      // Capacity setting condition
      const capacitySettingCard = this.device.homey.flow.getConditionCard('capacity_setting_is');
      const capacitySettingListener = capacitySettingCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Capacity setting condition triggered', { args });
        const currentValue = this.device.getCapabilityValue('adlar_enum_capacity_set');
        return currentValue === args.capacity;
      });
      this.flowCardListeners.set('capacity_setting_is', capacitySettingListener);

      // Heating curve condition
      const heatingCurveCard = this.device.homey.flow.getConditionCard('heating_curve_is');
      const heatingCurveListener = heatingCurveCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Heating curve condition triggered', { args });
        const currentValue = this.device.getCapabilityValue('adlar_enum_countdown_set');
        return currentValue === args.curve;
      });
      this.flowCardListeners.set('heating_curve_is', heatingCurveListener);

      // Volume setting condition
      const volumeSettingCard = this.device.homey.flow.getConditionCard('volume_setting_is');
      const volumeSettingListener = volumeSettingCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Volume setting condition triggered', { args });
        const currentValue = this.device.getCapabilityValue('adlar_enum_volume_set') || 0;
        const targetValue = args.level || 0;

        switch (args.comparison) {
          case 'equal':
            return currentValue === targetValue;
          case 'greater':
            return currentValue > targetValue;
          case 'less':
            return currentValue < targetValue;
          default:
            return false;
        }
      });
      this.flowCardListeners.set('volume_setting_is', volumeSettingListener);

      // COP efficiency check condition (v1.0.7)
      const copEfficiencyCard = this.device.homey.flow.getConditionCard('cop_efficiency_check');
      const copEfficiencyListener = copEfficiencyCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: COP efficiency check triggered', { args });

        // Get current COP value from capability
        const currentCOP = this.device.getCapabilityValue('adlar_cop') as number || 0;
        const threshold = args.threshold || 2.0;

        // Check if compressor is actually running (COP only meaningful when active)
        const compressorFrequency = this.device.getCapabilityValue('measure_frequency.compressor_strength') as number || 0;

        if (compressorFrequency === 0) {
          // Compressor idle - COP not meaningful
          this.logger('FlowCardManagerService: COP check skipped - compressor idle');
          return false;
        }

        return currentCOP > threshold;
      });
      this.flowCardListeners.set('cop_efficiency_check', copEfficiencyListener);

      // Daily COP above threshold condition (v1.0.7)
      const dailyCOPCard = this.device.homey.flow.getConditionCard('daily_cop_above_threshold');
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
      this.flowCardListeners.set('daily_cop_above_threshold', dailyCOPListener);

      // Monthly COP above threshold condition (v1.0.7)
      const monthlyCOPCard = this.device.homey.flow.getConditionCard('monthly_cop_above_threshold');
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
      this.flowCardListeners.set('monthly_cop_above_threshold', monthlyCOPListener);

      // COP trend analysis condition (v1.0.8)
      const copTrendCard = this.device.homey.flow.getConditionCard('cop_trend_analysis');
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
      this.flowCardListeners.set('cop_trend_analysis', copTrendListener);

      // Price in cheapest hours condition (v2.5.0)
      const priceInCheapestHoursCard = this.device.homey.flow.getConditionCard('price_in_cheapest_hours');
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
      this.flowCardListeners.set('price_in_cheapest_hours', priceInCheapestHoursListener);

      // Price trend is condition (v2.5.0)
      const priceTrendIsCard = this.device.homey.flow.getConditionCard('price_trend_is');
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
      this.flowCardListeners.set('price_trend_is', priceTrendIsListener);

      // Price vs daily average condition (v2.5.0)
      const priceVsDailyAverageCard = this.device.homey.flow.getConditionCard('price_vs_daily_average');
      const priceVsDailyAverageListener = priceVsDailyAverageCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Price vs daily average condition triggered', { args });

        // Get service coordinator to access EnergyPriceOptimizer
        const { serviceCoordinator } = this.device as unknown as {
          serviceCoordinator?: {
            getAdaptiveControl: () => {
              getEnergyPriceOptimizer: () => {
                getCurrentPrice: (timestamp: number) => { price: number; category: string } | null;
                getPriceStatistics: () => { avg: number; sampleSize: number } | null;
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

        const currentPriceData = energyOptimizer.getCurrentPrice(now);
        if (!currentPriceData) {
          this.logger('FlowCardManagerService: No current price available');
          return false;
        }

        const priceStats = energyOptimizer.getPriceStatistics();
        if (!priceStats || priceStats.sampleSize < 6) {
          this.logger('FlowCardManagerService: Insufficient price data for daily average', {
            sampleSize: priceStats?.sampleSize || 0,
            required: 6,
          });
          return false;
        }

        const currentPrice = currentPriceData.price;
        const dailyAverage = priceStats.avg;

        // Calculate percentage deviation from average
        const deviationPercent = ((currentPrice - dailyAverage) / dailyAverage) * 100;
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
      this.flowCardListeners.set('price_vs_daily_average', priceVsDailyAverageListener);

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
      const forceAnalysisCard = this.device.homey.flow.getActionCard('force_insight_analysis');
      const forceAnalysisListener = forceAnalysisCard.registerRunListener(async () => {
        this.logger('FlowCardManagerService: Force insight analysis action triggered');

        if (!this.buildingInsightsService) {
          throw new Error('Building Insights service not available');
        }

        const result = await this.buildingInsightsService.forceInsightAnalysis();
        this.logger(`FlowCardManagerService: Force analysis complete - ${result.insights_detected} insights at ${result.confidence}% confidence`);

        // Return tokens for use in flows
        return result;
      });
      this.flowCardListeners.set('force_insight_analysis', forceAnalysisListener);

      // Action: Calculate pre-heat start time (v2.6.0)
      const calculatePreHeatCard = this.device.homey.flow.getActionCard('calculate_preheat_time');
      const calculatePreHeatListener = calculatePreHeatCard.registerRunListener(async (args: {
        target_indoor_temp: number;
        target_clock_time: string;
      }) => {
        this.logger('FlowCardManagerService: Calculate pre-heat time action triggered', {
          target_indoor_temp: args.target_indoor_temp,
          target_clock_time: args.target_clock_time,
        });

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
        const confidence = model.confidence;

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

        // Calculate pre-heat duration using thermal model
        // t = τ × ln(ΔT_target / ΔT_residual)
        const residualDelta = 0.3; // °C acceptable residual
        const durationHours = tau * Math.log(tempDelta / residualDelta);

        // Calculate start time
        const targetTime = new Date();
        targetTime.setHours(targetHour, targetMinute, 0, 0);
        if (targetTime <= new Date()) {
          // Target is in the past, assume next day
          targetTime.setDate(targetTime.getDate() + 1);
        }

        const startTime = new Date(targetTime.getTime() - durationHours * 3600 * 1000);
        const startTimeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;

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
      this.flowCardListeners.set('calculate_preheat_time', calculatePreHeatListener);

      // ==================== CONDITION CARDS ====================

      // Condition 1: Insight is active
      const insightActiveCard = this.device.homey.flow.getConditionCard('insight_is_active');
      const insightActiveListener = insightActiveCard.registerRunListener(async (args: { category: string }) => {
        this.logger('FlowCardManagerService: Insight is active condition triggered', { category: args.category });

        if (!this.buildingInsightsService) {
          this.logger('FlowCardManagerService: Building Insights service not available, returning false');
          return false;
        }

        const isActive = this.buildingInsightsService.isInsightActive(args.category as any);
        this.logger(`FlowCardManagerService: Insight ${args.category} is ${isActive ? 'active' : 'not active'}`);
        return isActive;
      });
      this.flowCardListeners.set('insight_is_active', insightActiveListener);

      // Condition 2: Confidence above threshold
      const confidenceAboveCard = this.device.homey.flow.getConditionCard('confidence_above');
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
      this.flowCardListeners.set('confidence_above', confidenceAboveListener);

      // Condition 3: Savings above threshold
      const savingsAboveCard = this.device.homey.flow.getConditionCard('savings_above');
      const savingsAboveListener = savingsAboveCard.registerRunListener(async (args: { category: string; threshold: number }) => {
        this.logger('FlowCardManagerService: Savings above condition triggered', { category: args.category, threshold: args.threshold });

        if (!this.buildingInsightsService) {
          this.logger('FlowCardManagerService: Building Insights service not available, returning false');
          return false;
        }

        const isAbove = this.buildingInsightsService.areSavingsAbove(args.category as any, args.threshold);
        this.logger(`FlowCardManagerService: Savings for ${args.category} are ${isAbove ? 'above' : 'below'} €${args.threshold}/month`);
        return isAbove;
      });
      this.flowCardListeners.set('savings_above', savingsAboveListener);

      this.logger('FlowCardManagerService: Building Insights flow cards registered (4 actions + 3 conditions)');
    } catch (error) {
      this.logger('FlowCardManagerService: Error registering Building Insights flow cards:', error);
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
      const receiveExternalPowerCard = this.device.homey.flow.getActionCard('receive_external_power_data');
      const receiveExternalPowerListener = receiveExternalPowerCard.registerRunListener(
        // eslint-disable-next-line camelcase
        async (args: { power_value: number }) => {
          this.logger(`FlowCardManagerService: 📊 Received external power data: ${args.power_value}W`);
          await this.handleReceiveExternalPowerData(args);

          // Trigger intelligent power update if enabled
          const energyTrackingEnabled = this.device.getSetting('enable_intelligent_energy_tracking');
          if (energyTrackingEnabled) {
            // @ts-expect-error - updateIntelligentPowerMeasurement exists in MyDevice
            await this.device.updateIntelligentPowerMeasurement?.();
          }
          return true;
        },
      );
      this.flowCardListeners.set('receive_external_power_data', receiveExternalPowerListener);

      // 2. Receive external flow data
      const receiveExternalFlowCard = this.device.homey.flow.getActionCard('receive_external_flow_data');
      const receiveExternalFlowListener = receiveExternalFlowCard.registerRunListener(
        // eslint-disable-next-line camelcase
        async (args: { flow_value: number }) => {
          this.logger(`FlowCardManagerService: 🌊 Received external flow data: ${args.flow_value}L/min`);
          await this.handleReceiveExternalFlowData(args);
          return true;
        },
      );
      this.flowCardListeners.set('receive_external_flow_data', receiveExternalFlowListener);

      // 3. Receive external ambient data
      const receiveExternalAmbientCard = this.device.homey.flow.getActionCard('receive_external_ambient_data');
      const receiveExternalAmbientListener = receiveExternalAmbientCard.registerRunListener(
        // eslint-disable-next-line camelcase
        async (args: { temperature_value: number }) => {
          this.logger(`FlowCardManagerService: 🌡️ Received external ambient data: ${args.temperature_value}°C`);
          await this.handleReceiveExternalAmbientData(args);
          return true;
        },
      );
      this.flowCardListeners.set('receive_external_ambient_data', receiveExternalAmbientListener);

      // 4. Receive external indoor temperature
      const receiveExternalIndoorCard = this.device.homey.flow.getActionCard('receive_external_indoor_temperature');
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
      this.flowCardListeners.set('receive_external_indoor_temperature', receiveExternalIndoorListener);

      // 5. Receive external energy prices
      const receiveExternalPricesCard = this.device.homey.flow.getActionCard('receive_external_energy_prices');
      const receiveExternalPricesListener = receiveExternalPricesCard.registerRunListener(
        // eslint-disable-next-line camelcase
        async (args: { prices_json: string }) => {
          this.logger(`FlowCardManagerService: 💰 Received external energy prices (${args.prices_json.length} chars)`);
          await this.handleReceiveExternalEnergyPrices(args);
          return true;
        },
      );
      this.flowCardListeners.set('receive_external_energy_prices', receiveExternalPricesListener);

      this.logger('FlowCardManagerService: External data action cards registered (5 cards)');
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
        // Fallback to app-level trigger for compatibility
        const app = this.device.homey.app as unknown as { [key: string]: { trigger?: (device: unknown, tokens: unknown) => Promise<void> } };
        const triggerName = `${cardId.replace(/_/g, '')}Trigger`;

        if (app[triggerName]?.trigger) {
          await app[triggerName].trigger(this, tokens);
          this.logger(`Triggered flow card via app: ${cardId}`, tokens);
        } else {
          this.logger(`Flow card trigger method not found: ${cardId}`);
        }
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
        this.logger(`FlowCardManagerService: External ambient temperature updated: ${args.temperature_value}°C`); // eslint-disable-line camelcase

        // Store for persistence across app updates
        await this.device.setStoreValue('external_outdoor_temp', args.temperature_value);

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
        this.logger(`FlowCardManagerService: External power data updated: ${args.power_value}W`); // eslint-disable-line camelcase

        // Update defrost active power if applicable
        if (this.device.hasCapability('defrost_active_power')) {
          const isDefrosting = this.device.getCapabilityValue('adlar_state_defrost_state') || false;
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
   * @param args.prices_json - JSON string with hour offsets as keys: {"0":0.11,"1":0.10,...}
   */
  // eslint-disable-next-line camelcase
  async handleReceiveExternalEnergyPrices(args: { prices_json: string }): Promise<void> {
    try {
      const { prices_json: pricesJsonRaw } = args;

      this.logger(`FlowCardManagerService: Received external energy prices (${pricesJsonRaw.length} chars)`);

      // Parse JSON string to object
      let pricesObject: Record<string, number>;
      try {
        const parsed = JSON.parse(pricesJsonRaw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Prices must be an object with hour offsets as keys (e.g., {"0":0.11,"1":0.10,...})');
        }
        pricesObject = parsed as Record<string, number>;
      } catch (error) {
        this.logger('FlowCardManagerService: Failed to parse prices JSON:', error);
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
        // Build rich JSON schedule from EnergyPriceOptimizer data
        const priceDataArray = energyOptimizer.getPriceData();
        const cheapestBlock = energyOptimizer.findCheapestBlock(4); // 4-hour block
        const expensiveBlock = energyOptimizer.findMostExpensiveBlock(2); // 2-hour block

        // Build per-hour schedule with category and advice
        const schedule = priceDataArray.map((pd: { timestamp: number; price: number; category: string }) => {
          const hourDate = new Date(pd.timestamp);
          const hourStr = `${hourDate.getHours().toString().padStart(2, '0')}:00`;

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
            advice: advice,
          };
        });

        // Build summary
        const summary: Record<string, unknown> = {};
        if (cheapestBlock) {
          summary.cheapestBlock = {
            start: `${cheapestBlock.startTime.getHours().toString().padStart(2, '0')}:00`,
            end: `${cheapestBlock.endTime.getHours().toString().padStart(2, '0')}:00`,
            avgPrice: Math.round(cheapestBlock.avgPrice * 10000) / 10000,
            hours: cheapestBlock.totalHours,
          };
        }
        if (expensiveBlock) {
          summary.expensiveBlock = {
            start: `${expensiveBlock.startTime.getHours().toString().padStart(2, '0')}:00`,
            end: `${expensiveBlock.endTime.getHours().toString().padStart(2, '0')}:00`,
            avgPrice: Math.round(expensiveBlock.avgPrice * 10000) / 10000,
            hours: expensiveBlock.totalHours,
          };
        }

        const richData = {
          timestamp: new Date().toISOString(),
          hoursAvailable: priceDataArray.length,
          summary: summary,
          schedule: schedule,
        };

        await this.device.setCapabilityValue('energy_prices_data', JSON.stringify(richData));
        this.logger(`FlowCardManagerService: energy_prices_data updated with ${priceDataArray.length} hours of data`);
      }

      // Delegate to AdaptiveControlService for immediate capability updates via callback
      await this.onExternalPricesData(pricesObject);
    } catch (error) {
      this.logger('FlowCardManagerService: Error receiving external energy prices:', error);
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
    // Check if any flow-related settings changed
    const flowSettingKeys = [
      'flow_temperature_alerts',
      'flow_voltage_alerts',
      'flow_current_alerts',
      'flow_power_alerts',
      'flow_pulse_steps_alerts',
      'flow_state_alerts',
      'flow_efficiency_alerts',
      'flow_expert_mode',
    ];

    const flowSettingsChanged = changedKeys.some((key) => flowSettingKeys.includes(key));

    if (flowSettingsChanged) {
      this.logger('FlowCardManagerService: Flow settings changed, updating flow cards');
      await this.updateFlowCards();
    }
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

    this.unregisterAllFlowCards();
    this.isInitialized = false;
    this.logger('FlowCardManagerService: Service destroyed');
  }
}
