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

interface EnergyTrackingService {
  getCurrentPowerMeasurement(): { value: number } | null;
}

interface ServiceCoordinator {
  getEnergyTracking(): EnergyTrackingService | null;
}

interface DeviceWithServiceCoordinator extends Homey.Device {
  serviceCoordinator?: ServiceCoordinator;
}

// Minimal interface to avoid circular dependency with WeatherForecastService
interface IWeatherForecastService {
  getCurrentSolarRadiation(): number | null;
}

export interface BuildingModelServiceConfig {
  device: Homey.Device;
  buildingProfile?: BuildingProfileType;
  forgettingFactor?: number;
  enableDynamicPInt?: boolean;
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
  private weatherForecast: IWeatherForecastService | null = null;

  // v2.8.1: Track blocking reason for user-visible guard rail status
  // Set during each collectAndLearn() cycle; null = data flowing normally
  private lastBlockingReason: string | null = null;
  // Locale key for the blocking reason (used in Tau title)
  private lastBlockingReasonKey: string | null = null;

  constructor(config: BuildingModelServiceConfig) {
    this.device = config.device;
    this.logger = config.logger || (() => { });

    // Get forgetting factor from config or device settings
    // Fallback 0.999 needed for backward compatibility (devices updated before setting existed)
    // Must match default in driver.settings.compose.json
    const forgettingFactor = config.forgettingFactor
      ?? this.device.getSetting('building_model_forgetting_factor')
      ?? 0.999;

    // Configure learner with optimal parameters
    const learnerConfig: BuildingModelConfig = {
      forgettingFactor, // From settings or default
      initialCovariance: 100, // High initial uncertainty
      minSamplesForConfidence: 288, // 24 hours @ 5min intervals
      buildingProfile: config.buildingProfile || 'average', // Default to average building
      enableDynamicPInt: config.enableDynamicPInt ?? true, // Enable by default
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

    // Update diagnostics capability with initial state
    await this.updateDiagnosticsCapability();

    // Start periodic updates (every 5 minutes)
    this.updateInterval = this.device.homey.setInterval(
      () => this.collectAndLearn().catch((err) => this.logger('Learning error:', err)),
      this.UPDATE_INTERVAL_MS,
    );

    this.logger(`BuildingModelService: Initialized successfully - timer started (interval: ${this.UPDATE_INTERVAL_MS / 1000}s)`);
  }

  /**
   * Collect current sensor data and update model
   */
  private async collectAndLearn(): Promise<void> {
    // Heartbeat log - fires every 5 minutes to verify timer is running
    this.logger('BuildingModelService: Timer tick - collecting data...');

    try {
      // Check if building model learning is enabled
      const enabled = await this.device.getSetting('building_model_enabled');
      if (!enabled) {
        this.lastBlockingReason = 'Learning disabled in settings';
        this.lastBlockingReasonKey = 'building_model.blocked_disabled';
        this.logger('BuildingModelService: Learning disabled, skipping');
        await this.updateModelCapabilities(); // Update UI to show blocked status
        return;
      }

      // Get indoor temperature from external sensor
      // @ts-expect-error - Accessing MyDevice.serviceCoordinator (not in Homey.Device base type)
      const indoorTemp = this.device.serviceCoordinator
        .getAdaptiveControl()
        .getExternalTemperatureService()
        .getIndoorTemperature();

      if (indoorTemp === null) {
        this.lastBlockingReason = 'No indoor temperature (external sensor flow not running)';
        this.lastBlockingReasonKey = 'building_model.blocked_no_indoor_temp';
        this.logger('BuildingModelService: ❌ EXIT - No indoor temp available, skipping');
        await this.updateModelCapabilities(); // Update UI to show blocked status
        return;
      }
      this.logger(`BuildingModelService: ✅ Indoor temp OK: ${indoorTemp.toFixed(1)}°C`);

      // Get outdoor temperature with priority fallback (v2.0.2)
      // Uses device helper method: external sensor → heat pump sensor
      // @ts-expect-error - Accessing MyDevice.getOutdoorTemperatureWithFallback() (not in Homey.Device base type)
      const outdoorTemp = this.device.getOutdoorTemperatureWithFallback();

      if (outdoorTemp === null) {
        this.lastBlockingReason = 'No outdoor temperature (ambient sensor not available)';
        this.lastBlockingReasonKey = 'building_model.blocked_no_outdoor_temp';
        this.logger('BuildingModelService: ❌ EXIT - No outdoor temp available, skipping');
        await this.updateModelCapabilities(); // Update UI to show blocked status
        return;
      }
      this.logger(`BuildingModelService: ✅ Outdoor temp OK: ${outdoorTemp.toFixed(1)}°C`);

      // Get electrical power consumption
      // FIX: Use EnergyTrackingService to get the best available power measurement (internal or external)
      // This solves the issue where measure_power is 0 or unavailable (causing phantom high Tau values)
      let powerElectric = 0;
      // usage of EnergyTrackingService is MANDATORY for correct power readings
      // If this fails, we skip the cycle rather than using unreliable fallback data
      const energyTracking = (this.device as DeviceWithServiceCoordinator).serviceCoordinator?.getEnergyTracking();
      const powerMeasurement = energyTracking?.getCurrentPowerMeasurement();

      if (!powerMeasurement || typeof powerMeasurement.value !== 'number') {
        this.lastBlockingReason = 'No valid power measurement available';
        this.lastBlockingReasonKey = 'building_model.blocked_no_power';
        this.logger('BuildingModelService: ❌ EXIT - No valid power measurement available - skipping cycle');
        await this.updateModelCapabilities(); // Update UI to show blocked status
        return;
      }
      powerElectric = powerMeasurement.value;

      // Calculate thermal power using COP estimation
      const cop = (this.device.getCapabilityValue('adlar_cop') as number) || 3.0;

      // Skip sample if COP=0 with active power: indicates sensor inconsistency
      if (cop <= 0 && powerElectric > 0) {
        this.logger('BuildingModelService: ⚠️ Skipping sample — COP=0 with active power (sensor inconsistency)');
        return;
      }

      const thermalPower = (powerElectric / 1000) * cop; // Convert W to kW

      // Get solar radiation with priority cascade (panel > KNMI > estimation)
      const { radiation: solarRadiation, source: solarSource } = this.getSolarRadiationWithPriority();
      this.logger(`BuildingModelService: Solar radiation ${solarRadiation.toFixed(0)} W/m² (source: ${solarSource})`);

      // Create measurement data (v2.7.0: include solarSource for conditional seasonal g)
      const measurement: MeasurementData = {
        timestamp: Date.now(),
        tIndoor: indoorTemp,
        tOutdoor: outdoorTemp,
        pHeating: thermalPower,
        solarRadiation,
        solarSource: solarSource as 'solar_panels' | 'knmi_radiation' | 'estimation',
        deltaTPerHour: 0, // Calculated by learner
      };

      // Add measurement to learner
      this.learner.addMeasurement(measurement);

      // Clear blocking reason - data is flowing successfully
      this.lastBlockingReason = null;
      this.lastBlockingReasonKey = null;

      const state = this.learner.getState();
      this.logger(`BuildingModelService: ✅ Sample #${state.sampleCount} added (power: ${thermalPower.toFixed(2)}kW, COP: ${cop.toFixed(1)})`);

      // Update capabilities every 10 samples (every 50 minutes)
      if (state.sampleCount % 10 === 0) {
        await this.updateModelCapabilities();
        await this.updateDiagnosticsCapability();
        await this.persistState();
        this.logger(`BuildingModelService: 💾 Capabilities + diagnostics + state persisted (sample ${state.sampleCount})`);
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

    // v2.8.1: 3-state status model: BLOCKED → LEARNING → learned
    // Priority: blocked reason > learning phase > learned
    const confidencePercent = model.confidence.toFixed(1); // v2.5.21: Show 1 decimal for visible progress
    let confidenceEmoji = '🔴'; // Default: low confidence
    if (model.confidence >= 70) {
      confidenceEmoji = '🟢'; // High confidence
    } else if (model.confidence >= 40) {
      confidenceEmoji = '🟡'; // Medium confidence
    }

    // Update capabilities with smart info distribution (v2.3.1)
    // C: confidence indicator (emoji + percentage)
    await this.updateCapabilityIfPresent('adlar_building_c', model.C, {
      title: `${this.device.homey.__('building_model.thermal_mass_title')} ${confidenceEmoji} ${confidencePercent}%`,
    });

    // UA: clean title
    await this.updateCapabilityIfPresent('adlar_building_ua', model.UA, {
      title: this.device.homey.__('building_model.heat_loss_title'),
    });

    // Tau: 3-state status display with guard rail (v2.8.1)
    // State 1: BLOCKED - external data source not available (user-visible guard rail)
    // State 2: LEARNING - data flowing, samples accumulating
    // State 3: Learned - minimum samples reached
    const minSamples = 288;
    const tauBaseTitle = this.device.homey.__('building_model.time_constant_title');
    let tauTitle: string;

    if (this.lastBlockingReasonKey) {
      // BLOCKED: Show localized blocked status only (reason shown in Building Insights)
      const blockedStatus = this.device.homey.__('building_model.status_blocked');
      tauTitle = `${tauBaseTitle} (${blockedStatus})`;
    } else if (state.sampleCount >= minSamples) {
      // Learned: Show sample count only
      tauTitle = `${tauBaseTitle} (#${state.sampleCount})`;
    } else {
      // LEARNING: Show status with progress ratio
      const learningStatus = this.device.homey.__('building_model.status_learned');
      tauTitle = `${tauBaseTitle} (${learningStatus}, #${state.sampleCount}/${minSamples})`;
    }

    await this.updateCapabilityIfPresent('adlar_building_tau', model.tau, {
      title: tauTitle,
    });

    // g: solar gain factor (v2.9.6 - seasonal multiplier removed, astronomical estimation encodes seasonality)
    const now = new Date();
    const hour = now.getHours();

    // Get localized short month name using browser's locale
    const lang = this.device.homey.i18n.getLanguage();
    const monthName = now.toLocaleDateString(lang, { month: 'short' });
    await this.updateCapabilityIfPresent('adlar_building_g', model.g, {
      title: `${this.device.homey.__('building_model.solar_gain_title')} (${monthName})`,
    });

    // P_int: internal gains with time-of-day variation (v2.3.1 - localized)
    let periodKey = 'building_model.period_day';
    let pIntMultiplier = 1.0;
    if (hour >= 23 || hour < 6) {
      periodKey = 'building_model.period_night';
      pIntMultiplier = 0.4;
    } else if (hour >= 18) {
      periodKey = 'building_model.period_evening';
      pIntMultiplier = 1.8;
    }
    const periodName = this.device.homey.__(periodKey);
    await this.updateCapabilityIfPresent('adlar_building_pint', model.pInt, {
      title: `${this.device.homey.__('building_model.internal_gains_title')} (${periodName} ×${pIntMultiplier.toFixed(1)})`,
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

  /**
   * Update building_model_diagnostics capability with current diagnostic data
   * Called automatically every 10 samples (50 minutes) alongside updateModelCapabilities()
   * Also available on-demand via "Diagnose building model" flow card action
   */
  private async updateDiagnosticsCapability(): Promise<void> {
    if (!this.device.hasCapability('building_model_diagnostics')) {
      return; // Capability not present, skip silently (may be old device)
    }

    try {
      const diagnostics = await this.getDiagnostics();
      await this.device.setCapabilityValue('building_model_diagnostics', JSON.stringify(diagnostics));
      this.logger('BuildingModelService: 📊 building_model_diagnostics capability updated');
    } catch (error) {
      this.logger('BuildingModelService: Failed to update building_model_diagnostics capability:', error);
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
   * Calculate thermal adjustment for weighted decision maker
   * v2.6.0: Building model integration - 4th component
   *
   * This method provides a temperature adjustment recommendation based on
   * the building's thermal properties (τ, C, UA, g, pInt) and current conditions.
   *
   * Corrections applied:
   * - g (solar gain): reduces effective τ during sunny periods
   * - pInt (internal gains): reduces effective τ based on time of day (evening ×1.8)
   *
   * Logic:
   * - Far from target (>1°C, >2h predicted): boost +0.5°C
   * - Near target (<0.5°C, <0.5h predicted): slowdown -0.3°C (overshoot prevention)
   * - Otherwise: maintain (0°C)
   *
   * @param params - Current indoor/target/outdoor temps
   * @returns ThermalAction with adjustment and reason
   */
  public calculateThermalAdjustment(params: {
    indoorTemp: number;
    targetIndoorTemp: number;
    outdoorTemp: number;
  }): { adjustment: number; reason: string; priority: 'low' | 'medium' | 'high' } {
    const model = this.learner.getModel();

    // Check confidence - if too low, return no adjustment
    if (model.confidence < 50) {
      return {
        adjustment: 0,
        reason: `Thermal: confidence ${model.confidence.toFixed(0)}% < 50% - disabled`,
        priority: 'low',
      };
    }

    const tempDelta = params.targetIndoorTemp - params.indoorTemp;

    // Can't calculate if we're already at or above target
    if (tempDelta <= 0) {
      return {
        adjustment: 0,
        reason: 'Thermal: at or above target',
        priority: 'low',
      };
    }

    // v2.6.0: Apply g and pInt corrections to thermal prediction
    // g = solar gain coefficient (kW per kW/m² radiation)
    // pInt = internal gains (kW from occupants/appliances)
    const hour = new Date().getHours();

    // Time-based pInt multiplier (evening when people are home)
    const pIntMultiplier = (hour >= 17 && hour <= 22) ? 1.8 : 1.0;
    const effectivePInt = model.pInt * pIntMultiplier;

    // Calculate solar gain using priority cascade (panel > KNMI > estimation)
    // getSolarRadiationWithPriority returns W/m², g is kW per kW/m²
    const { radiation: solarRadiation } = this.getSolarRadiationWithPriority();
    const solarGain = model.g * (solarRadiation / 1000); // kW

    // Total extra gains (kW)
    const totalGains = solarGain + effectivePInt;

    // Calculate base tau
    const baseTau = model.C / model.UA;

    // Correct tau for extra gains
    // Extra gains reduce effective tau (building warms faster)
    // Formula: effectiveTau = baseTau / (1 + totalGains / (UA × ΔT))
    const gainCorrection = tempDelta > 0.1 ? totalGains / (model.UA * tempDelta) : 0;
    const effectiveTau = baseTau / Math.max(1.0, 1 + gainCorrection);

    // Predict time to reach target using corrected thermal model
    // T(t) = T_final × (1 - e^(-t/τ)) → t = τ × ln(ΔT_target / ΔT_residual)
    const residualDelta = 0.3; // Acceptable residual error
    const predictedHours = tempDelta > residualDelta
      ? effectiveTau * Math.log(tempDelta / residualDelta)
      : 0;

    this.logger('BuildingModelService: Thermal adjustment calculation', {
      baseTau: baseTau.toFixed(1),
      effectiveTau: effectiveTau.toFixed(1),
      tempDelta: tempDelta.toFixed(2),
      predictedHours: predictedHours.toFixed(1),
      g: model.g.toFixed(3),
      solarRadiation: solarRadiation.toFixed(0),
      solarGain: solarGain.toFixed(3),
      pInt: model.pInt.toFixed(3),
      effectivePInt: effectivePInt.toFixed(3),
      totalGains: totalGains.toFixed(3),
      confidence: model.confidence.toFixed(0),
    });

    // Decision logic
    if (predictedHours > 2.0 && tempDelta > 1.0) {
      // Far from target: boost setpoint to accelerate heating
      return {
        adjustment: +0.5,
        reason: `Thermal: τ=${effectiveTau.toFixed(0)}h (corr.), ${predictedHours.toFixed(1)}h to target → +0.5°C boost`,
        priority: 'medium',
      };
    }
    if (predictedHours < 0.5 && tempDelta < 0.5) {
      // Near target: reduce setpoint to prevent overshoot
      return {
        adjustment: -0.3,
        reason: `Thermal: τ=${effectiveTau.toFixed(0)}h (corr.), approaching target → -0.3°C slowdown`,
        priority: 'medium',
      };
    }

    // Default: maintain
    return {
      adjustment: 0,
      reason: `Thermal: τ=${effectiveTau.toFixed(0)}h (corr.), maintain`,
      priority: 'low',
    };
  }

  /** Returns day of year (1–365/366) for a given Date */
  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    return Math.floor((date.getTime() - start.getTime()) / 86400000);
  }

  /**
   * Compute astronomical sunrise and sunset times as decimal hours (local solar time).
   *
   * Algorithm: solar declination angle + hour angle (NOAA simplified equations).
   *
   * Edge cases:
   *   - Polar night (cosω > 1)  → { sunrise: 12, sunset: 12 } → 0 radiation all day
   *   - Polar day  (cosω < -1) → { sunrise: 0, sunset: 24 }  → radiation 24 h
   *   - Latitude clamped to ±89.9° to avoid tan(90°) = ±Infinity
   */
  private computeSunriseSunset(lat: number, dayOfYear: number): { sunrise: number; sunset: number } {
    const latRad = (Math.max(-89.9, Math.min(89.9, lat)) * Math.PI) / 180;
    const declRad = (23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81)) * Math.PI) / 180;
    const cosOmega = -Math.tan(latRad) * Math.tan(declRad);
    if (cosOmega > 1) return { sunrise: 12, sunset: 12 }; // polar night
    if (cosOmega < -1) return { sunrise: 0, sunset: 24 };  // polar day
    const halfDay = (Math.acos(cosOmega) * 180) / Math.PI / 15;
    return { sunrise: 12 - halfDay, sunset: 12 + halfDay };
  }

  /**
   * Estimate solar radiation using astronomical sunrise/sunset times.
   *
   * Location-aware (latitude) and season-aware (day of year):
   *   - Strictly 0 outside the sunrise–sunset window
   *   - Peak irradiance scales with solar declination: ~200 W/m² (winter) → ~800 W/m² (summer)
   *   - Sinusoidal curve between sunrise and sunset with peak at solar noon
   *
   * @param hour      - Fractional local hour (e.g. 14.5 = 14:30)
   * @param lat       - Latitude in degrees from settings (default 52.37 = Amsterdam)
   * @param dayOfYear - Day of year 1–365
   */
  private estimateSolarRadiation(hour: number, lat: number, dayOfYear: number): number {
    const { sunrise, sunset } = this.computeSunriseSunset(lat, dayOfYear);
    const dayLength = sunset - sunrise;
    if (dayLength <= 0 || hour < sunrise || hour > sunset) return 0;
    const declDeg = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
    const peak = 500 + (declDeg / 23.45) * 300; // 200–800 W/m²
    return Math.max(0, peak * Math.sin(((hour - sunrise) / dayLength) * Math.PI));
  }

  /**
   * Set WeatherForecastService for Open Meteo solar radiation fallback.
   * Called by AdaptiveControlService after all services are initialized.
   */
  public setWeatherForecastService(service: IWeatherForecastService): void {
    this.weatherForecast = service;
  }

  /**
   * Get solar radiation with priority cascade
   *
   * Priority order:
   * 1. Solar panel power (most accurate - hyperlocal measurement)
   * 2. Flow card input / KNMI (regional measurement via external source)
   * 3. Open Meteo shortwave_radiation (model-based, already fetched)
   * 4. Sinusoidal estimation (last fallback)
   *
   * @returns Solar radiation in W/m² and the source used
   */
  public getSolarRadiationWithPriority(): { radiation: number; source: string } {
    const source = this.device.getSetting('solar_source') as string || 'auto';

    // Priority 1: Solar panels (convert W to W/m²)
    if (source === 'auto' || source === 'solar_panels') {
      const power = this.device.getCapabilityValue('adlar_external_solar_power') as number | null;
      const wp = this.device.getSetting('solar_panel_wp') as number || 0;
      const eff = this.device.getSetting('solar_panel_efficiency') as number || 0.85;

      if (power !== null && power > 0 && wp > 0) {
        // At STC: 1000 W/m² → Wp output
        // radiation = power / (Wp / 1000) / efficiency
        const radiation = Math.min((power / (wp / 1000)) / eff, 1200);
        this.logger('Solar radiation from panels', {
          power,
          wp,
          efficiency: eff,
          radiation: radiation.toFixed(0),
        });
        return { radiation, source: 'solar_panels' };
      }
    }

    // Priority 2: Flow card input / KNMI radiation (direct W/m²)
    if (source === 'auto' || source === 'knmi_radiation') {
      const radiation = this.device.getCapabilityValue('adlar_external_solar_radiation') as number | null;
      if (radiation !== null && radiation >= 0) {
        this.logger('Solar radiation from flow card / KNMI', { radiation });
        return { radiation, source: 'knmi_radiation' };
      }
    }

    // Priority 3: Open Meteo shortwave_radiation (already fetched, no extra API cost)
    if (source === 'auto' && this.weatherForecast) {
      const radiation = this.weatherForecast.getCurrentSolarRadiation();
      if (radiation !== null && radiation >= 0) {
        this.logger('Solar radiation from Open Meteo', { radiation: radiation.toFixed(0) });
        return { radiation, source: 'open_meteo' };
      }
    }

    // Priority 4: Astronomical estimation (last fallback - location & season aware)
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    const lat = (this.device.getSetting('forecast_location_lat') as number) ?? 52.37;
    const dayOfYear = this.getDayOfYear(now);
    const radiation = this.estimateSolarRadiation(hour, lat, dayOfYear);
    this.logger('Solar estimation (astronomical)', {
      hour: hour.toFixed(2), lat, dayOfYear, radiation: radiation.toFixed(0),
    });
    return { radiation, source: 'estimation' };
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
    // v2.8.1: Use live lastBlockingReason from collectAndLearn() cycles
    // This is more accurate than re-checking sensors here, because it reflects
    // the actual last attempt to collect data (including power measurement check)
    let blockingReason: string | null = this.lastBlockingReason;
    if (!enabled) {
      blockingReason = 'Learning disabled in settings';
    } else if (blockingReason === null) {
      // No blocking from collectAndLearn, but check initial samples phase
      if (indoorTemp === null) {
        blockingReason = 'No indoor temperature (external sensor flow not running)';
      } else if (outdoorTemp === null || outdoorTemp === undefined) {
        blockingReason = 'No outdoor temperature (ambient sensor not available)';
      } else if (state.sampleCount < 10) {
        blockingReason = `Collecting initial samples (${state.sampleCount}/10)`;
      }
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
   * Get diagnostic data as structured JSON for building_model_diagnostics capability
   * @returns Diagnostic data object with all building model learning information
   */
  public async getDiagnostics(): Promise<object> {
    const status = await this.getDiagnosticStatus();
    const state = this.learner.getState();
    const model = this.learner.getModel();

    // Determine learning status
    let learningStatus: string;
    if (!status.enabled) {
      learningStatus = 'disabled';
    } else if (status.blockingReason) {
      learningStatus = 'insufficient_data';
    } else if (status.isDefault) {
      learningStatus = 'learning';
    } else {
      learningStatus = 'converged';
    }

    // Calculate P matrix trace for validation
    const pTrace = state.P.reduce((sum, row, i) => sum + row[i], 0);

    // Determine parameter sources
    const parameterSource = status.isDefault ? 'default' : 'learned';

    // Build recommendations
    const recommendations: string[] = [];
    if (status.blockingReason) {
      if (status.blockingReason.includes('indoor temperature')) {
        recommendations.push('Configure indoor temperature sensor in device settings');
      }
      if (status.blockingReason.includes('outdoor temperature')) {
        recommendations.push('Check ambient temperature sensor availability');
      }
      if (status.blockingReason.includes('disabled')) {
        recommendations.push('Enable building model learning in advanced settings');
      }
      if (status.blockingReason.includes('initial samples')) {
        recommendations.push(`Wait for ${10 - status.sampleCount} more samples (${(10 - status.sampleCount) * 5} minutes)`);
      }
    }

    // Validation warnings
    const warnings: string[] = [];
    if (model.C <= 0 || model.C > 100) {
      warnings.push(`⚠️ Unrealistic thermal mass C=${model.C.toFixed(1)} kWh/°C (expected 0-100)`);
    }
    if (model.UA <= 0 || model.UA > 2) {
      warnings.push(`⚠️ Unrealistic heat loss UA=${model.UA.toFixed(3)} kW/°C (expected 0-2)`);
    }
    if (model.tau < 0) {
      warnings.push(`🚨 CRITICAL: Negative time constant τ=${model.tau.toFixed(1)}h indicates RLS corruption`);
    } else if (model.tau > 500) {
      warnings.push(`⚠️ Unrealistic time constant τ=${model.tau.toFixed(1)}h (expected 0-500)`);
    }
    if (pTrace > 400) {
      warnings.push('⚠️ P matrix trace abnormally high - possible RLS state corruption');
    } else if (pTrace < 10) {
      warnings.push('⚠️ P matrix trace very low - algorithm may be over-confident');
    }

    return {
      timestamp: Date.now(),
      timestampReadable: new Date().toLocaleString('nl-NL'),
      enabled: status.enabled,
      status: learningStatus,
      dataAvailability: {
        hasIndoorTemp: status.hasIndoorTemp,
        hasOutdoorTemp: status.hasOutdoorTemp,
        indoorTempValue: status.indoorTempValue,
        outdoorTempValue: status.outdoorTempValue,
      },
      learning: {
        samplesCollected: status.sampleCount,
        confidence: status.confidence,
        isDefault: status.isDefault,
        blockingReason: status.blockingReason,
        nextUpdateIn: {
          samples: 10 - status.lastUpdateSamples,
          minutes: (10 - status.lastUpdateSamples) * 5,
        },
      },
      parameters: {
        tau: {
          value: Number(model.tau.toFixed(1)),
          unit: 'hours',
          source: parameterSource,
          description: 'Time constant (thermal inertia)',
        },
        C: {
          value: Number(model.C.toFixed(1)),
          unit: 'kWh/°C',
          source: parameterSource,
          description: 'Thermal mass (heat capacity)',
        },
        UA: {
          value: Number(model.UA.toFixed(3)),
          unit: 'kW/°C',
          source: parameterSource,
          description: 'Heat loss coefficient',
        },
        g: {
          value: Number(model.g.toFixed(3)),
          unit: 'dimensionless',
          source: parameterSource,
          description: 'Solar gain factor',
        },
        pInt: {
          value: Number(model.pInt.toFixed(2)),
          unit: 'kW',
          source: parameterSource,
          description: 'Internal heat gains',
        },
      },
      rlsState: {
        theta: state.theta.map((v) => Number(v.toFixed(6))),
        P_diag: state.P.map((row, i) => Number(row[i].toFixed(3))),
        P_trace: Number(pTrace.toFixed(1)),
        sampleCount: state.sampleCount,
      },
      validation: {
        parametersRealistic: warnings.length === 0,
        warnings,
      },
      recommendations,
    };
  }

  /**
   * Log diagnostic status for troubleshooting
   * Enhanced with RLS state verification (v2.4.4 - detect corrupt state after app restart)
   */
  public async logDiagnosticStatus(): Promise<void> {
    const status = await this.getDiagnosticStatus();
    const state = this.learner.getState();
    const model = this.learner.getModel();

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

    // Enhanced diagnostics: RLS algorithm state verification
    this.logger('');
    this.logger('📊 RLS Algorithm Internal State:');

    // Calculate P matrix trace (sum of diagonal elements)
    const pTrace = state.P.reduce((sum, row, i) => sum + row[i], 0);
    let pTraceStatus = '✅ OK';
    if (pTrace > 400) {
      pTraceStatus = '⚠️ ABNORMALLY HIGH (corrupt?)';
    } else if (pTrace < 10) {
      pTraceStatus = '⚠️ TOO LOW (over-confident?)';
    }
    this.logger(`   P matrix trace: ${pTrace.toFixed(1)} ${pTraceStatus}`);
    this.logger(`   P[0][0]: ${state.P[0][0].toFixed(3)} (1/C variance)`);
    this.logger(`   P[1][1]: ${state.P[1][1].toFixed(3)} (UA/C variance)`);

    // Theta parameters (RLS internal parameters)
    this.logger('');
    this.logger('🔢 Theta Parameters (RLS):');
    this.logger(`   θ[0] (1/C):    ${state.theta[0].toFixed(6)} ${state.theta[0] <= 0 ? '❌ NEGATIVE!' : '✅'}`);
    this.logger(`   θ[1] (UA/C):   ${state.theta[1].toFixed(6)} ${state.theta[1] <= 0 ? '❌ NEGATIVE!' : '✅'}`);
    this.logger(`   θ[2] (g/C):    ${state.theta[2].toFixed(6)}`);
    this.logger(`   θ[3] (P_int/C): ${state.theta[3].toFixed(6)}`);

    // Physical building parameters
    this.logger('');
    this.logger('🏠 Learned Building Parameters:');
    const cStatus = model.C > 0 && model.C < 100 ? '✅' : '⚠️ UNREALISTIC';
    const uaStatus = model.UA > 0 && model.UA < 2 ? '✅' : '⚠️ UNREALISTIC';
    let tauStatus = '⚠️ UNREALISTIC';
    if (model.tau > 0 && model.tau < 500) {
      tauStatus = '✅';
    } else if (model.tau < 0) {
      tauStatus = '❌ NEGATIVE (IMPOSSIBLE!)';
    }
    this.logger(`   C (Thermal Mass):  ${model.C.toFixed(1)} kWh/°C ${cStatus}`);
    this.logger(`   UA (Heat Loss):    ${model.UA.toFixed(3)} kW/°C ${uaStatus}`);
    this.logger(`   τ (Time Constant): ${model.tau.toFixed(1)}h ${tauStatus}`);
    this.logger(`   g (Solar Gain):    ${model.g.toFixed(3)}`);
    this.logger(`   P_int (Internal):  ${model.pInt.toFixed(2)} kW`);

    // State persistence verification
    const stateJson = JSON.stringify(state);
    const stateSize = stateJson.length;
    const pMatrixValid = Array.isArray(state.P) && state.P.length === 4
      && state.P.every((row) => Array.isArray(row) && row.length === 4);

    this.logger('');
    this.logger('💾 State Persistence Check:');
    this.logger(`   State JSON size: ${(stateSize / 1024).toFixed(2)} KB`);
    this.logger(`   P matrix structure: ${pMatrixValid ? '✅ Valid 4×4' : '❌ CORRUPT'}`);
    this.logger(`   Sample count: ${state.sampleCount} ${state.sampleCount > 0 ? '✅' : '❌ Zero'}`);

    // Diagnosis summary
    if (model.tau < 0 || model.C < 0 || model.UA < 0) {
      this.logger('');
      this.logger('🚨 CRITICAL: Negative parameters detected!');
      this.logger('   This indicates RLS state corruption.');
      this.logger('   Recommendation: Reset building model via flow card action.');
    } else if (pTrace > 400) {
      this.logger('');
      this.logger('⚠️ WARNING: High covariance matrix trace detected.');
      this.logger('   This may indicate state restore failure after app restart.');
      this.logger('   Recommendation: Reset building model if confidence remains 0%.');
    }

    this.logger('═══════════════════════════════════════');
  }

  /**
   * Reset building model - reinitialize learner with building profile defaults
   * Clears all learned parameters and restarts learning from scratch
   */
  public async reset(): Promise<void> {
    this.logger('BuildingModelService: Resetting to building profile defaults...');

    try {
      // Log old learned values before reset
      const oldModel = this.learner.getModel();
      this.logger('═══════════════════════════════════════');
      this.logger('📊 Old Learned Values (being cleared):');
      this.logger(`   C (Thermal Mass):       ${oldModel.C.toFixed(1)} kWh/°C`);
      this.logger(`   UA (Heat Loss):         ${oldModel.UA.toFixed(2)} kW/°C`);
      this.logger(`   τ (Time Constant):      ${oldModel.tau.toFixed(1)} hours`);
      this.logger(`   g (Solar Gain):         ${oldModel.g.toFixed(3)} kW/(W/m²)`);
      this.logger(`   P_int (Internal Gains): ${oldModel.pInt.toFixed(2)} kW`);
      this.logger(`   Confidence:             ${oldModel.confidence.toFixed(0)}%`);
      this.logger('═══════════════════════════════════════');

      // Get current settings for building profile and features
      const buildingProfile = this.device.getSetting('building_profile') || 'average';
      const enableDynamicPInt = this.device.getSetting('enable_dynamic_pint') ?? true;
      const forgettingFactor = this.device.getSetting('building_model_forgetting_factor') ?? 0.999;

      // Create new learner instance with building profile defaults (no restored state)
      const learnerConfig: BuildingModelConfig = {
        forgettingFactor,
        initialCovariance: 100, // High initial uncertainty
        minSamplesForConfidence: 288, // 24 hours @ 5min intervals
        buildingProfile, // Will use profile defaults
        enableDynamicPInt,
        logger: this.logger,
      };

      this.learner = new BuildingModelLearner(learnerConfig);

      // Log new default values
      const newModel = this.learner.getModel();
      this.logger('📊 New Default Values (from building profile):');
      this.logger(`   Building Profile:       ${buildingProfile}`);
      this.logger(`   C (Thermal Mass):       ${newModel.C.toFixed(1)} kWh/°C`);
      this.logger(`   UA (Heat Loss):         ${newModel.UA.toFixed(2)} kW/°C`);
      this.logger(`   τ (Time Constant):      ${newModel.tau.toFixed(1)} hours`);
      this.logger(`   g (Solar Gain):         ${newModel.g.toFixed(3)} kW/(W/m²)`);
      this.logger(`   P_int (Internal Gains): ${newModel.pInt.toFixed(2)} kW`);
      this.logger(`   Forgetting Factor:      ${forgettingFactor}`);
      this.logger('═══════════════════════════════════════');

      // Update capabilities to show default values from building profile
      await this.updateModelCapabilities();

      // Persist the reset state (empty state with profile defaults)
      await this.persistState();

      this.logger(`✅ BuildingModelService: Reset complete - using ${buildingProfile} building profile`);
      this.logger('🔄 RLS learning will restart from scratch (sample count: 0)');
      this.logger('⏱️  Expected timeline: T+50min first update → T+24h confidence builds');

    } catch (error) {
      this.logger('BuildingModelService: Failed to reset:', error);
      throw error;
    }
  }

  /**
   * Destroy service - persist final state and cleanup timers
   */
  public async destroy(): Promise<void> {
    // Persist final state before destruction to prevent data loss on app restart/update
    try {
      await this.persistState();
      this.logger('BuildingModelService: Final state persisted before destruction');
    } catch (error) {
      this.logger('BuildingModelService: Failed to persist final state:', error);
    }

    // Cleanup timers
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      this.logger('BuildingModelService: ⚠️ Timer STOPPED (clearInterval called)');
    }
    this.logger('BuildingModelService: Destroyed');
  }
}
