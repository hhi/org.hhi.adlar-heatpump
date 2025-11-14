/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';
import { TuyaErrorCategorizer } from '../error-types';
import { CapabilityCategories, UserFlowPreferences } from '../types/shared-interfaces';

export interface FlowCardManagerOptions {
  device: Homey.Device;
  logger?: (message: string, ...args: unknown[]) => void;
}

export class FlowCardManagerService {
  private device: Homey.Device;
  private logger: (message: string, ...args: unknown[]) => void;
  private flowCardListeners = new Map<string, unknown>();
  private isInitialized = false;
  private initializationRetryTimer: NodeJS.Timeout | null = null;

  /**
   * FlowCardManagerService manages registering/unregistering and invoking flow cards
   * based on device capabilities and user preferences.
   * @param options.device - device instance
   * @param options.logger - optional logger
   */
  constructor(options: FlowCardManagerOptions) {
    this.device = options.device;
    this.logger = options.logger || (() => {});
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
      // Expert efficiency condition
      const efficiencyCard = this.device.homey.flow.getConditionCard('compressor_efficiency_above');
      const efficiencyListener = efficiencyCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Efficiency condition triggered', { args });

        const rawPower = this.device.getCapabilityValue('measure_power');
        const rawCompressorState = this.device.getCapabilityValue('adlar_state_compressor_state');
        const powerIsNull = rawPower === null || rawPower === undefined;
        const compressorStateIsNull = rawCompressorState === null || rawCompressorState === undefined;
        const power = rawPower || 0;
        const compressorState = rawCompressorState || 0;
        const efficiency = compressorState > 0 && power > 0 ? (compressorState / power) * 100 : 0;
        const result = efficiency > (args.threshold || 50);

        if (powerIsNull || compressorStateIsNull) {
          this.logger('FlowCardManagerService: Efficiency condition using fallback values for null capabilities', {
            powerRaw: rawPower,
            powerFallback: power,
            powerIsNull,
            compressorStateRaw: rawCompressorState,
            compressorStateFallback: compressorState,
            compressorStateIsNull,
            efficiency,
            threshold: args.threshold || 50,
            result,
          });
        }

        return result;
      });
      this.flowCardListeners.set('compressor_efficiency_above', efficiencyListener);

      // Expert trigger cards
      const expertTriggerCards = [
        'compressor_efficiency_alert',
        'fan_motor_efficiency_alert',
        'water_flow_alert',
      ];

      expertTriggerCards.forEach((cardId) => {
        try {
          const triggerCard = this.device.homey.flow.getDeviceTriggerCard(cardId);
          this.flowCardListeners.set(cardId, triggerCard);
        } catch (err) {
          this.logger(`FlowCardManagerService: Expert trigger card ${cardId} not found, skipping`);
        }
      });

      this.logger('FlowCardManagerService: Expert feature cards registered');
    } catch (error) {
      this.logger('FlowCardManagerService: Error registering expert feature cards:', error);
    }
  }

  /**
   * Register action-based condition cards built from patterns in the app.
   */
  private async registerActionBasedConditionCards(): Promise<void> {
    try {
      // Device power state condition
      const devicePowerCard = this.device.homey.flow.getConditionCard('device_power_is');
      devicePowerCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Device power condition triggered', { args });
        const currentValue = this.device.getCapabilityValue('onoff');
        const expectedState = args.state === 'on';
        return currentValue === expectedState;
      });

      // Target temperature condition
      const targetTempCard = this.device.homey.flow.getConditionCard('target_temperature_is');
      targetTempCard.registerRunListener(async (args) => {
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

      // Hot water temperature condition
      const hotWaterTempCard = this.device.homey.flow.getConditionCard('hotwater_temperature_is');
      hotWaterTempCard.registerRunListener(async (args) => {
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

      // Heating mode condition
      const heatingModeCard = this.device.homey.flow.getConditionCard('heating_mode_is');
      heatingModeCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Heating mode condition triggered', { args });
        const currentValue = this.device.getCapabilityValue('adlar_enum_mode');
        return currentValue === args.mode;
      });

      // Work mode condition
      const workModeCard = this.device.homey.flow.getConditionCard('work_mode_is');
      workModeCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Work mode condition triggered', { args });
        const currentValue = this.device.getCapabilityValue('adlar_enum_work_mode');
        return currentValue === args.mode;
      });

      // Water mode condition
      const waterModeCard = this.device.homey.flow.getConditionCard('water_mode_is');
      waterModeCard.registerRunListener(async (args) => {
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

      // Capacity setting condition
      const capacitySettingCard = this.device.homey.flow.getConditionCard('capacity_setting_is');
      capacitySettingCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Capacity setting condition triggered', { args });
        const currentValue = this.device.getCapabilityValue('adlar_enum_capacity_set');
        return currentValue === args.capacity;
      });

      // Heating curve condition
      const heatingCurveCard = this.device.homey.flow.getConditionCard('heating_curve_is');
      heatingCurveCard.registerRunListener(async (args) => {
        this.logger('FlowCardManagerService: Heating curve condition triggered', { args });
        const currentValue = this.device.getCapabilityValue('adlar_enum_countdown_set');
        return currentValue === args.curve;
      });

      // Volume setting condition
      const volumeSettingCard = this.device.homey.flow.getConditionCard('volume_setting_is');
      volumeSettingCard.registerRunListener(async (args) => {
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

      // COP efficiency check condition (v1.0.7)
      const copEfficiencyCard = this.device.homey.flow.getConditionCard('cop_efficiency_check');
      copEfficiencyCard.registerRunListener(async (args) => {
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

      // Daily COP above threshold condition (v1.0.7)
      const dailyCOPCard = this.device.homey.flow.getConditionCard('daily_cop_above_threshold');
      dailyCOPCard.registerRunListener(async (args) => {
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

      // Monthly COP above threshold condition (v1.0.7)
      const monthlyCOPCard = this.device.homey.flow.getConditionCard('monthly_cop_above_threshold');
      monthlyCOPCard.registerRunListener(async (args) => {
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

      // COP trend analysis condition (v1.0.8)
      const copTrendCard = this.device.homey.flow.getConditionCard('cop_trend_analysis');
      copTrendCard.registerRunListener(async (args) => {
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

      this.logger('FlowCardManagerService: Action-based condition cards registered');
    } catch (error) {
      this.logger('FlowCardManagerService: Error registering action-based condition cards:', error);
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

        // Emit event for other services (especially EnergyTrackingService)
        this.device.emit('external-data:power', args.power_value);
      }
    } catch (error) {
      this.logger('FlowCardManagerService: Error receiving external power data:', error);
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
