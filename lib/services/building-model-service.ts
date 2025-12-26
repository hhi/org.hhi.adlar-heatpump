/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
/**
 * Building Model Service - Service wrapper for BuildingModelLearner
 *
 * Manages lifecycle, data collection, and capability updates for the building
 * thermal model learning component.
 *
 * @version 1.4.0
 * @since 1.4.0
 */

import Homey from 'homey';
import {
  BuildingModelLearner,
  type BuildingModelConfig,
  type MeasurementData,
  type BuildingProfileType,
} from '../adaptive/building-model-learner';

export interface BuildingModelServiceConfig {
  device: Homey.Device;
  buildingProfile?: BuildingProfileType;
  enableDynamicPInt?: boolean;
  enableSeasonalG?: boolean;
  logger?: (msg: string, ...args: unknown[]) => void;
}

/**
 * Building Model Service
 *
 * Responsibilities:
 * - Initialize and manage BuildingModelLearner instance
 * - Collect sensor data every 5 minutes
 * - Update building model capabilities
 * - Persist state to device store
 * - Trigger milestone flow cards
 */
export class BuildingModelService {
  private device: Homey.Device;
  private learner: BuildingModelLearner;
  private logger: (msg: string, ...args: unknown[]) => void;
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private missingCapabilitiesLogged = new Set<string>();

  constructor(config: BuildingModelServiceConfig) {
    this.device = config.device;
    this.logger = config.logger || (() => {});

    // Configure learner with optimal parameters
    const learnerConfig: BuildingModelConfig = {
      forgettingFactor: 0.998, // Moderate adaptation rate
      initialCovariance: 100, // High initial uncertainty
      minSamplesForConfidence: 288, // 24 hours @ 5min intervals
      buildingProfile: config.buildingProfile || 'average', // Default to average building
      enableDynamicPInt: config.enableDynamicPInt ?? true, // Enable by default
      enableSeasonalG: config.enableSeasonalG ?? true, // Enable by default
      logger: this.logger,
    };

    this.learner = new BuildingModelLearner(learnerConfig);
  }

  /**
   * Initialize service
   * - Restore persisted state
   * - Start periodic data collection
   * - Update capabilities with current model
   */
  public async initialize(): Promise<void> {
    this.logger('BuildingModelService: Initializing...');

    // Restore state from device store
    const storedState = await this.device.getStoreValue('building_model_state');
    if (storedState) {
      this.learner.restoreState(storedState);
      this.logger('BuildingModelService: Restored state from storage');
    }

    // Update capabilities with current model
    await this.updateModelCapabilities();

    // Start periodic updates (every 5 minutes)
    this.updateInterval = this.device.homey.setInterval(
      () => this.collectAndLearn().catch((err) => this.logger('Learning error:', err)),
      this.UPDATE_INTERVAL_MS,
    );

    this.logger('BuildingModelService: Initialized successfully');
  }

  /**
   * Collect current sensor data and update model
   */
  private async collectAndLearn(): Promise<void> {
    try {
      // Check if building model learning is enabled
      const enabled = await this.device.getSetting('building_model_enabled');
      if (!enabled) {
        this.logger('BuildingModelService: Learning disabled, skipping');
        return;
      }

      // Get indoor temperature from external sensor
      // @ts-expect-error - Accessing MyDevice.serviceCoordinator (not in Homey.Device base type)
      const indoorTemp = this.device.serviceCoordinator
        .getAdaptiveControl()
        .getExternalTemperatureService()
        .getIndoorTemperature();

      if (indoorTemp === null) {
        this.logger('BuildingModelService: No indoor temp available, skipping');
        return;
      }

      // Get outdoor temperature with priority fallback (v2.0.2)
      // Uses device helper method: external sensor → heat pump sensor
      // @ts-expect-error - Accessing MyDevice.getOutdoorTemperatureWithFallback() (not in Homey.Device base type)
      const outdoorTemp = this.device.getOutdoorTemperatureWithFallback();

      if (outdoorTemp === null) {
        this.logger('BuildingModelService: No outdoor temp available, skipping');
        return;
      }

      // Get electrical power consumption
      const powerElectric = (this.device.getCapabilityValue('measure_power') as number) || 0;

      // Calculate thermal power using COP estimation
      const cop = (this.device.getCapabilityValue('adlar_cop') as number) || 3.0;
      const thermalPower = (powerElectric / 1000) * cop; // Convert W to kW

      // Estimate solar radiation (placeholder - can be improved with actual sensor data)
      const hour = new Date().getHours();
      const solarRadiation = this.estimateSolarRadiation(hour);

      // Create measurement data
      const measurement: MeasurementData = {
        timestamp: Date.now(),
        tIndoor: indoorTemp,
        tOutdoor: outdoorTemp,
        pHeating: thermalPower,
        solarRadiation,
        deltaTPerHour: 0, // Calculated by learner
      };

      // Add measurement to learner
      this.learner.addMeasurement(measurement);

      // Update capabilities every 10 samples (every 50 minutes)
      const state = this.learner.getState();
      if (state.sampleCount % 10 === 0) {
        await this.updateModelCapabilities();
        await this.persistState();
      }
    } catch (error) {
      this.logger('BuildingModelService: Error during learning:', error);
    }
  }

  /**
   * Update device capabilities with current building model
   */
  private async updateModelCapabilities(): Promise<void> {
    const model = this.learner.getModel();
    const state = this.learner.getState();

    // Determine if using default values (v2.0.3)
    const isDefault = Math.abs(model.tau - 50) < 0.5 && state.sampleCount < 10;

    // Determine learning status and confidence emoji (v2.0.3)
    const statusKey = isDefault ? 'building_model.status_default' : 'building_model.status_learned';
    const status = this.device.homey.__(statusKey);
    const confidencePercent = Math.round(model.confidence);
    let confidenceEmoji = '🔴'; // Default: low confidence
    if (confidencePercent >= 70) {
      confidenceEmoji = '🟢'; // High confidence
    } else if (confidencePercent >= 40) {
      confidenceEmoji = '🟡'; // Medium confidence
    }

    // Update capabilities with dynamic titles showing status and confidence (v2.0.3)
    await this.updateCapabilityIfPresent('adlar_building_c', model.C, {
      title: this.device.homey.__('building_model.thermal_mass_title'),
    });

    await this.updateCapabilityIfPresent('adlar_building_ua', model.UA, {
      title: `${this.device.homey.__('building_model.heat_loss_title')} ${confidenceEmoji} (${status}, ${confidencePercent}%)`,
    });

    await this.updateCapabilityIfPresent('adlar_building_tau', model.tau, {
      title: this.device.homey.__('building_model.time_constant_title'),
    });

    await this.updateCapabilityIfPresent('adlar_building_g', model.g, {
      title: this.device.homey.__('building_model.solar_gain_title'),
    });

    await this.updateCapabilityIfPresent('adlar_building_pint', model.pInt, {
      title: this.device.homey.__('building_model.internal_gains_title'),
    });

    this.logger(
      'BuildingModelService: Model updated - '
      + `C=${model.C.toFixed(1)} kWh/°C, `
      + `UA=${model.UA.toFixed(2)} kW/°C, `
      + `τ=${model.tau.toFixed(1)}h, `
      + `g=${model.g.toFixed(2)}, `
      + `P_int=${model.pInt.toFixed(2)} kW, `
      + `confidence=${model.confidence.toFixed(0)}%`,
    );

    // Trigger milestone flow card at 70% confidence
    if (model.confidence >= 70 && model.confidence < 75) {
      await this.device.homey.flow
        .getDeviceTriggerCard('learning_milestone_reached')
        .trigger(this.device, {
          confidence: model.confidence,
          milestone: '70%',
          thermal_mass: model.C,
          time_constant: model.tau,
        })
        .catch((err: unknown) => this.logger('Failed to trigger milestone card:', err));
    }
  }

  private async updateCapabilityIfPresent(
    capability: string,
    value: number,
    options?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.device.hasCapability(capability)) {
      if (!this.missingCapabilitiesLogged.has(capability)) {
        this.logger(`BuildingModelService: Skipping missing capability ${capability}`);
        this.missingCapabilitiesLogged.add(capability);
      }
      return;
    }

    try {
      await this.device.setCapabilityValue(capability, value);
    } catch (error) {
      this.logger(`BuildingModelService: Failed to set ${capability} value:`, error);
      return;
    }

    if (options) {
      try {
        await this.device.setCapabilityOptions(capability, options);
      } catch (error) {
        this.logger(`BuildingModelService: Failed to set ${capability} options:`, error);
      }
    }
  }

  /**
   * Persist learner state to device store
   */
  private async persistState(): Promise<void> {
    const state = this.learner.getState();
    await this.device.setStoreValue('building_model_state', state);
  }

  /**
   * Get learner instance (for use by other components)
   */
  public getLearner(): BuildingModelLearner {
    return this.learner;
  }

  /**
   * Estimate solar radiation based on time of day
   *
   * Simplified model: 0 at night, peak at noon
   * Can be enhanced with actual solar sensor data or API integration
   */
  private estimateSolarRadiation(hour: number): number {
    // Night hours (18:00 - 06:00)
    if (hour < 6 || hour > 20) return 0;

    // Daytime hours (06:00 - 20:00)
    // Peak at noon (12:00), sinusoidal curve
    const solarHour = hour - 6; // 0-14 range
    return Math.max(0, 500 * Math.sin((solarHour / 14) * Math.PI));
  }

  /**
   * Get diagnostic status of building model learning
   * Useful for troubleshooting why tau/C/UA values are not updating
   */
  public async getDiagnosticStatus(): Promise<{
    enabled: boolean;
    hasIndoorTemp: boolean;
    hasOutdoorTemp: boolean;
    indoorTempValue: number | null;
    outdoorTempValue: number | null;
    sampleCount: number;
    confidence: number;
    tau: number;
    lastUpdateSamples: number;
    isDefault: boolean;
    blockingReason: string | null;
  }> {
    const enabled = await this.device.getSetting('building_model_enabled');

    // Get indoor temperature from external sensor
    let indoorTemp: number | null = null;
    try {
      // @ts-expect-error - Accessing MyDevice.serviceCoordinator
      indoorTemp = this.device.serviceCoordinator
        .getAdaptiveControl()
        .getExternalTemperatureService()
        .getIndoorTemperature();
    } catch (err) {
      // Service not available
    }

    // Get outdoor temperature with priority fallback (v2.0.2)
    // @ts-expect-error - Accessing MyDevice.getOutdoorTemperatureWithFallback() (not in Homey.Device base type)
    const outdoorTemp = this.device.getOutdoorTemperatureWithFallback();

    // Get model state
    const model = this.learner.getModel();
    const state = this.learner.getState();

    // Determine blocking reason
    let blockingReason: string | null = null;
    if (!enabled) {
      blockingReason = 'Learning disabled in settings';
    } else if (indoorTemp === null) {
      blockingReason = 'No indoor temperature (external sensor flow not running)';
    } else if (outdoorTemp === null || outdoorTemp === undefined) {
      blockingReason = 'No outdoor temperature (ambient sensor not available)';
    } else if (state.sampleCount < 10) {
      blockingReason = `Collecting initial samples (${state.sampleCount}/10)`;
    }

    // Check if still using default values
    const isDefault = Math.abs(model.tau - 50) < 0.5 && state.sampleCount < 10;

    return {
      enabled,
      hasIndoorTemp: indoorTemp !== null,
      hasOutdoorTemp: outdoorTemp !== null && outdoorTemp !== undefined,
      indoorTempValue: indoorTemp,
      outdoorTempValue: outdoorTemp,
      sampleCount: state.sampleCount,
      confidence: model.confidence,
      tau: model.tau,
      lastUpdateSamples: state.sampleCount % 10,
      isDefault,
      blockingReason,
    };
  }

  /**
   * Log diagnostic status for troubleshooting
   */
  public async logDiagnosticStatus(): Promise<void> {
    const status = await this.getDiagnosticStatus();

    this.logger('═══ Building Model Diagnostic Status ═══');
    this.logger(`Enabled: ${status.enabled ? '✅' : '❌'}`);
    this.logger(`Indoor temp: ${status.hasIndoorTemp ? `✅ ${status.indoorTempValue}°C` : '❌ Not available'}`);
    this.logger(`Outdoor temp: ${status.hasOutdoorTemp ? `✅ ${status.outdoorTempValue}°C` : '❌ Not available'}`);
    this.logger(`Samples collected: ${status.sampleCount}`);
    this.logger(`Confidence: ${status.confidence.toFixed(0)}%`);
    this.logger(`Current tau: ${status.tau.toFixed(1)}h ${status.isDefault ? '(DEFAULT)' : '(LEARNED)'}`);
    this.logger(`Next update in: ${10 - status.lastUpdateSamples} samples (${(10 - status.lastUpdateSamples) * 5}min)`);

    if (status.blockingReason) {
      this.logger(`⚠️ BLOCKING REASON: ${status.blockingReason}`);
    } else {
      this.logger('✅ Learning active, collecting data');
    }

    this.logger('═══════════════════════════════════════');
  }

  /**
   * Destroy service - cleanup timers
   */
  public destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.logger('BuildingModelService: Destroyed');
  }
}
