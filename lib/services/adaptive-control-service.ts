/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';
import { HeatingController, SensorData } from '../adaptive/heating-controller';
import { ExternalTemperatureService } from './external-temperature-service';
import { BuildingModelService } from './building-model-service';
import { EnergyPriceOptimizer, type PriceTrend } from '../adaptive/energy-price-optimizer';
import { COPOptimizer } from '../adaptive/cop-optimizer';
import { DefrostLearner } from '../adaptive/defrost-learner';
import { WeightedDecisionMaker, type ConfidenceMetrics } from '../adaptive/weighted-decision-maker';
import { WindCorrectionService } from './wind-correction-service';
import { WeatherForecastService, type ForecastAdvice } from './weather-forecast-service';
import { DeviceConstants } from '../constants';

/**
 * AdaptiveControlService - Main Orchestrator for Adaptive Temperature Control
 *
 * Manages PI-based temperature control using external room temperature sensor.
 * Integrates with ServiceCoordinator following existing patterns.
 *
 * Architecture:
 * - External pattern: zero modifications to device class
 * - Reads device capabilities, adjusts target_temperature
 * - 5-minute control loop (configurable)
 * - Persistent PI controller history
 * - Flow card triggers for transparency
 *
 * Control Flow:
 * 1. Read external indoor temperature (via ExternalTemperatureService)
 * 2. Read target temperature from device
 * 3. Calculate adjustment (HeatingController PI algorithm)
 * 4. Apply adjustment to target_temperature capability
 * 5. Emit flow card triggers
 * 6. Save state to device store
 *
 * @version 1.0.0 (Fase 1 MVP)
 */

export interface AdaptiveControlServiceConfig {
  device: Homey.Device;
  logger?: (message: string, ...args: unknown[]) => void;
}

export interface AdaptiveControlStatus {
  enabled: boolean;
  lastControlCycle: number | null;
  controlIntervalMinutes: number;
  hasExternalTemperature: boolean;
  currentIndoorTemp: number | null;
  currentTargetTemp: number | null;
  piControllerStatus: {
    Kp: number;
    Ki: number;
    deadband: number;
    historySize: number;
    currentError: number;
    averageError: number;
  };
}

export class AdaptiveControlService {
  private device: Homey.Device;
  private logger: (message: string, ...args: unknown[]) => void;

  // Sub-services (Component 1: Heating Controller)
  private heatingController: HeatingController;
  private externalTemperature: ExternalTemperatureService;

  // Component 2: Building Model Learner
  private buildingModel: BuildingModelService;

  // Component 3: Energy Price Optimizer
  private energyOptimizer: EnergyPriceOptimizer;

  // Component 4: COP Optimizer
  private copOptimizer: COPOptimizer;

  // Integration: Weighted Decision Maker
  private decisionMaker: WeightedDecisionMaker;

  // Component 5: Wind Correction Service (v2.7.0+)
  private windCorrection: WindCorrectionService;

  // Component 6: Weather Forecast Service (v2.8.0+)
  private weatherForecast: WeatherForecastService;
  private lastForecastAdviceSignature: string | null = null;

  // Component 7: Defrost Learner (v2.9.0+)
  private defrostLearner: DefrostLearner;

  // Control loop state
  private controlLoopInterval: NodeJS.Timeout | null = null;
  private isEnabled = false;
  private isSimulateMode = true; // Always true - simulates adjustments, user executes via flows (v2.5.0: implicit, no setting)
  private simulatedTargetTemp: number | null = null; // Simulated target temp (tracked for Insights)
  private lastControlCycleTime: number = 0;
  private lastAdjustmentTime: number = 0; // Last time target_temperature was adjusted (throttling)
  private controlIntervalMs: number = 5 * 60 * 1000; // 5 minutes default
  private accumulatedAdjustment: number = 0; // Accumulates fractional adjustments until ≥0.5°C (for step:1 rounding)

  // Energy price tracking (for change detection and flow card triggers)
  private lastPriceCategory: string | null = null; // Track category changes
  private lastDailyCostCheck: number = 0; // Rate limit daily cost checks
  private dailyCostThresholdTriggered = false; // Reset daily at midnight

  // Block detection state (v2.5.0+)
  private lastCheapestBlockStart: number = 0; // Timestamp of last cheapest block start
  private lastExpensiveBlockWarning: number = 0; // Timestamp of last expensive block warning
  private lastPriceTrend: PriceTrend | null = null; // Last known price trend

  // Persistence keys
  private readonly STORE_KEY_PI_HISTORY = 'adaptive_pi_history';
  private readonly STORE_KEY_LAST_ACTION = 'adaptive_last_action';
  private readonly STORE_KEY_LAST_ADJUSTMENT = 'adaptive_last_adjustment_time';
  private readonly STORE_KEY_ENABLED = 'adaptive_control_enabled';
  private readonly STORE_KEY_ACCUMULATED_ADJUSTMENT = 'adaptive_accumulated_adjustment';
  private readonly STORE_KEY_LAST_DPS4 = 'adaptive_last_dps4'; // v2.5.1: Store last known DPS 4 for capability sync

  /**
   * @param config.device - Owning Homey device
   * @param config.logger - Logger callback
   */
  constructor(config: AdaptiveControlServiceConfig) {
    this.device = config.device;
    this.logger = config.logger || (() => { });

    // Initialize Component 1: Heating Controller (PI control)
    this.heatingController = new HeatingController({
      logger: this.logger,
    });

    this.externalTemperature = new ExternalTemperatureService({
      device: this.device,
      logger: this.logger,
    });

    // Initialize Component 2: Building Model Learner
    this.buildingModel = new BuildingModelService({
      device: this.device,
      buildingProfile: this.device.getSetting('building_profile') || 'average',
      forgettingFactor: this.device.getSetting('building_model_forgetting_factor') ?? 0.999,
      enableDynamicPInt: this.device.getSetting('enable_dynamic_pint') ?? true,
      logger: this.logger,
    });

    // Initialize Component 3: Energy Price Optimizer
    // Note: thresholds here are defaults, will be overwritten by loadPriceSettings()
    this.energyOptimizer = new EnergyPriceOptimizer({
      thresholds: {
        veryLow: 0.04, // P10 percentile (2024 NL EPEX)
        low: 0.06, // P30 percentile
        normal: 0.10, // P70 percentile
        high: 0.12, // P90 percentile
      },
      maxPreHeatOffset: 1.5,
      maxReduceOffset: -1.0,
      lookAheadHours: 4,
      logger: this.logger,
    });

    // Initialize Component 4: COP Optimizer
    this.copOptimizer = new COPOptimizer({
      minAcceptableCOP: 2.5,
      targetCOP: 3.5,
      strategy: 'balanced',
      minSupplyTemp: 25,
      maxSupplyTemp: 55,
      historySize: 1000,
      logger: this.logger,
      // v2.6.1: Callback to update cop_optimizer_diagnostics capability
      onDiagnosticsUpdate: async (diagnosticsJson: string) => {
        if (this.device.hasCapability('cop_optimizer_diagnostics')) {
          await this.device.setCapabilityValue('cop_optimizer_diagnostics', diagnosticsJson);
        }
      },
    });

    // Initialize Integration: Weighted Decision Maker
    this.decisionMaker = new WeightedDecisionMaker({
      comfort: 0.60,
      efficiency: 0.25,
      cost: 0.15,
      thermal: 0.20,
    });

    // Initialize Component 5: Wind Correction Service (v2.7.0+)
    this.windCorrection = new WindCorrectionService({
      device: this.device,
      logger: this.logger,
    });

    // Initialize Component 7: Defrost Learner (v2.9.0+)
    this.defrostLearner = new DefrostLearner({
      logger: this.logger,
    });

    // Initialize Component 6: Weather Forecast Service (v2.8.0+)
    this.weatherForecast = new WeatherForecastService({
      device: this.device,
      logger: this.logger,
      defrostLearner: this.defrostLearner,
    });

    // Wire WeatherForecastService to BuildingModelService and WindCorrectionService
    // for Open Meteo solar radiation and wind speed fallbacks
    this.buildingModel.setWeatherForecastService(this.weatherForecast);
    this.windCorrection.setWeatherForecastService(this.weatherForecast);

    this.logger('AdaptiveControlService: Initialized with all 7 components');
  }

  /**
   * Get the EnergyPriceOptimizer instance for dependency injection
   * Used by EnergyTrackingService for cost accumulation
   */
  public getEnergyOptimizer(): EnergyPriceOptimizer {
    return this.energyOptimizer;
  }

  /**
   * Check if dynamic pricing data is available (for insights and recommendations)
   */
  public hasDynamicPricing(): boolean {
    const priceOptimizerEnabled = this.device.getSetting('price_optimizer_enabled');
    if (priceOptimizerEnabled === false) {
      return false;
    }

    return this.energyOptimizer.getPriceData().length > 0;
  }

  /**
   * Initialize adaptive control service
   * Called after ServiceCoordinator initialization
   */
  async initialize(): Promise<void> {
    this.logger('AdaptiveControlService: Starting initialization');

    try {
      // v2.5.1 CRITICAL FIX: Restore adlar_simulated_target EARLY, before ANY potentially-failing operations
      // This ensures the capability is synchronized even if later initialization steps fail
      // (e.g., building model init, price settings, updateEnergyPriceCapabilities)
      if (this.device.hasCapability('adlar_simulated_target')) {
        const storedDPS4 = await this.device.getStoreValue(this.STORE_KEY_LAST_DPS4);
        if (typeof storedDPS4 === 'number') {
          await this.device.setCapabilityValue('adlar_simulated_target', storedDPS4);
          this.logger('AdaptiveControlService: Early restore - synced adlar_simulated_target with stored DPS 4', {
            value: `${storedDPS4}°C`,
          });
        } else {
          // No stored value yet - try current DPS 4 as fallback
          const currentDPS4 = this.device.getCapabilityValue('target_temperature') as number | null;
          if (currentDPS4 !== null) {
            await this.device.setCapabilityValue('adlar_simulated_target', currentDPS4);
            this.logger('AdaptiveControlService: Early restore - synced adlar_simulated_target with current DPS 4 (no stored value)', {
              value: `${currentDPS4}°C`,
            });
          } else {
            // Device not connected yet - set to null
            await this.device.setCapabilityValue('adlar_simulated_target', null);
            this.logger('AdaptiveControlService: Early restore - DPS 4 unavailable, set adlar_simulated_target to null');
          }
        }
      }

      // Restore enabled state from device store
      const savedEnabled = await this.device.getStoreValue(this.STORE_KEY_ENABLED);
      if (typeof savedEnabled === 'boolean') {
        this.isEnabled = savedEnabled;
        this.logger('AdaptiveControlService: Restored enabled state', { enabled: this.isEnabled });
      } else {
        // Fallback: Sync from device setting if store value is missing (v2.4.11: settings/store sync fix)
        // This handles cases where the setting was enabled but store was never written (e.g., old version, failed start)
        const settingEnabled = this.device.getSetting('adaptive_control_enabled');
        if (settingEnabled === true) {
          this.isEnabled = true;
          this.logger('AdaptiveControlService: Enabled state synced from device setting (store was missing)', { enabled: true });
        }
      }

      // Restore last adjustment timestamp (for throttling)
      const savedLastAdjustment = await this.device.getStoreValue(this.STORE_KEY_LAST_ADJUSTMENT);
      if (typeof savedLastAdjustment === 'number' && savedLastAdjustment > 0) {
        this.lastAdjustmentTime = savedLastAdjustment;
        const minutesSinceAdjustment = Math.round((Date.now() - savedLastAdjustment) / 60000);
        this.logger('AdaptiveControlService: Restored last adjustment time', {
          minutesAgo: minutesSinceAdjustment,
        });
      }

      // Restore accumulated adjustment (for step:1 rounding continuity)
      const savedAccumulated = await this.device.getStoreValue(this.STORE_KEY_ACCUMULATED_ADJUSTMENT);
      if (typeof savedAccumulated === 'number') {
        this.accumulatedAdjustment = savedAccumulated;
        this.logger('AdaptiveControlService: Restored accumulated adjustment', {
          accumulated: this.accumulatedAdjustment.toFixed(2),
        });
      }

      // Restore PI controller history from device store
      await this.restorePIHistory();

      // Always start weather forecast — used as TTL fallback for wind/temp/solar even without forecast sensors
      this.weatherForecast.startUpdates();

      // Initialize Component 2: Building Model Service
      await this.buildingModel.initialize();

      // Load price settings from device settings BEFORE restoring optimizer state
      // This ensures priceMode is set correctly when the optimizer processes prices
      await this.loadPriceSettings();

      // Restore Component 3: Energy Price Optimizer state
      const energyState = await this.device.getStoreValue('energy_optimizer_state');
      if (energyState) {
        this.energyOptimizer.restoreState(energyState);

        // v2.5.1 Fix: Wrap price capability update in try-catch to prevent initialization failure
        // If no price data available yet, this would previously stop the entire initialization
        // Now it fails gracefully and will update when prices become available
        try {
          await this.updateEnergyPriceCapabilities();
        } catch (error) {
          this.logger('AdaptiveControlService: Price capabilities update failed (will retry when prices available)', {
            error: (error as Error).message,
          });
        }

        // v2.4.8 Fix: Also sync cost capabilities with restored optimizer values
        if (this.device.hasCapability('adlar_energy_cost_daily')) {
          const dailyCost = this.energyOptimizer.getAccumulatedDailyCost();
          await this.device.setCapabilityValue('adlar_energy_cost_daily',
            Math.round(dailyCost * 100) / 100);
          this.logger('AdaptiveControlService: Restored daily cost capability', {
            dailyCost: `€${dailyCost.toFixed(2)}`,
          });
        }
        if (this.device.hasCapability('adlar_energy_cost_hourly')) {
          const hourlyCost = this.energyOptimizer.getAccumulatedHourlyCost();
          await this.device.setCapabilityValue('adlar_energy_cost_hourly',
            Math.round(hourlyCost * 100) / 100);
          this.logger('AdaptiveControlService: Restored hourly cost capability', {
            hourlyCost: `€${hourlyCost.toFixed(2)}`,
          });
        }
      }

      // Restore raw External Energy Prices (v1.1.2 - Persistence Fix)
      // If optimizer state was lost/stale, we rebuild it from the raw prices
      const storedPrices = await this.device.getStoreValue('external_energy_prices');
      if (storedPrices && typeof storedPrices === 'object') {
        try {
          this.energyOptimizer.setExternalPrices(storedPrices);

          // Also update capabilities immediately based on these restored prices
          await this.updateEnergyPriceCapabilities();

          this.logger(`AdaptiveControlService: Restored ${Object.keys(storedPrices).length} external energy prices from store`);
        } catch (error) {
          this.logger('AdaptiveControlService: Failed to restore external energy prices', { error: (error as Error).message });
        }
      }

      // Restore Component 4: COP Optimizer state
      const copState = await this.device.getStoreValue('cop_optimizer_state');
      if (copState) {
        this.copOptimizer.restoreState(copState);
      }

      // Restore Component 7: Defrost Learner state (v2.9.0+)
      const defrostState = await this.device.getStoreValue('defrost_learning_state');
      if (defrostState) {
        this.defrostLearner.restoreState(defrostState);
      }

      // Load priority settings from device settings (v2.4.1: bug fix - settings were defined but not used)
      await this.loadPrioritySettings();

      // v2.5.1: Removed late sync code - now done EARLY at start of initialize() (before any failing operations)

      // Start control loop if enabled
      if (this.isEnabled) {
        await this.start();
      }

      this.logger('AdaptiveControlService: Initialization complete (all 4 components ready)');

    } catch (error) {
      this.logger('AdaptiveControlService: Initialization error', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Start adaptive control (enable control loop)
   */
  async start(): Promise<void> {
    if (this.controlLoopInterval !== null) {
      this.logger('AdaptiveControlService: Already running, skipping start');
      return;
    }

    // Validate external temperature is available
    if (!this.externalTemperature.isConfigured()) {
      throw new Error('Cannot start adaptive control: no external indoor temperature configured. Please send temperature via flow card first.');
    }

    this.isEnabled = true;
    await this.device.setStoreValue(this.STORE_KEY_ENABLED, true);

    // Simulate mode is now implicit (always true, no setting) - v2.5.0
    // v2.4.8 Fix: ALWAYS initialize simulated target to current DPS 4
    const currentTargetTemp = this.device.getCapabilityValue('target_temperature') as number | null;

    if (currentTargetTemp === null) {
      throw new Error('Cannot start adaptive control: target_temperature (DPS 4) is not available. Device may not be connected.');
    }

    // Always start with current DPS 4 as baseline
    this.simulatedTargetTemp = currentTargetTemp;
    this.logger('AdaptiveControlService: Simulated target initialized to current DPS 4', {
      value: `${currentTargetTemp}°C`,
    });

    // Update simulated target capability
    if (this.device.hasCapability('adlar_simulated_target')) {
      await this.device.setCapabilityValue('adlar_simulated_target', this.simulatedTargetTemp);
    }

    // Start control loop using Homey timer management
    this.controlLoopInterval = this.device.homey.setInterval(
      async () => {
        await this.executeControlCycle();
      },
      this.controlIntervalMs,
    );

    // Execute first cycle shortly after start — non-blocking to prevent onSettings timeout (v2.10.0)
    // Homey enforces a 10s timeout on onSettings; running the full cycle inline risks exceeding it.
    this.device.homey.setTimeout(() => {
      this.executeControlCycle().catch((err) => {
        this.device.error('AdaptiveControlService: Initial cycle failed:', err);
      });
    }, 1000);

    // Emit status change trigger
    await this.triggerStatusChange(
      'simulate',
      'Adaptive control started in SIMULATION mode (implicit)',
    );

    this.logger('AdaptiveControlService: Started', {
      mode: 'SIMULATE (implicit)',
      intervalMinutes: this.controlIntervalMs / 60000,
    });
  }

  /**
   * Stop adaptive control (disable control loop)
   */
  async stop(): Promise<void> {
    if (this.controlLoopInterval !== null) {
      clearInterval(this.controlLoopInterval);
      this.controlLoopInterval = null;
    }

    // Log final simulated state (v2.5.0: no commit option, always simulate mode)
    if (this.simulatedTargetTemp !== null) {
      const actualTemp = this.device.getCapabilityValue('target_temperature') as number;
      this.logger('AdaptiveControlService: Final simulated state', {
        simulatedTemp: this.simulatedTargetTemp.toFixed(1),
        actualTemp: actualTemp?.toFixed(1) || 'unknown',
        delta: (this.simulatedTargetTemp - (actualTemp || 0)).toFixed(1),
      });
    }

    // Clear simulated target (will be reinitialized on next start)
    this.simulatedTargetTemp = null;

    this.isEnabled = false;
    await this.device.setStoreValue(this.STORE_KEY_ENABLED, false);

    // Save PI history before stopping
    await this.savePIHistory();

    // Emit status change trigger
    await this.triggerStatusChange('disabled', 'Adaptive temperature control disabled');

    this.logger('AdaptiveControlService: Stopped');
  }

  /**
   * Get effective target temperature for calculations
   *
   * CASCADE CONTROL: Returns the current warmtepomp setpoint (DPS 4) that will be adjusted
   * with the delta calculated by the PI controller based on indoor temperature error.
   *
   * IMPORTANT: Always returns the REAL DPS 4 value, even in simulate mode.
   * This prevents the simulation from diverging from reality.
   * The difference between simulate and active mode is only WHERE the result is applied:
   * - Active mode: writes to actual DPS 4
   * - Simulate mode: writes to simulatedTargetTemp (shows what WOULD happen)
   *
   * @returns Current warmtepomp setpoint (DPS 4)
   */
  private getEffectiveTargetTemp(): number | null {
    // Always read current warmtepomp setpoint (DPS 4) - this is the base for all adjustments
    // In simulate mode, we still need the real value to calculate "what would happen"
    if (!this.device.hasCapability('target_temperature')) {
      this.logger('AdaptiveControlService: target_temperature capability not available');
      return null;
    }

    const currentSetpoint = this.device.getCapabilityValue('target_temperature') as number | null;

    if (currentSetpoint === null || currentSetpoint === undefined) {
      this.logger('AdaptiveControlService: No current warmtepomp setpoint available');
      return null;
    }

    return currentSetpoint;
  }

  /**
   * Execute one control cycle
   * Called every 5 minutes (or configured interval)
   *
   * Enhanced with all 4 components + weighted decision making
   */
  private async executeControlCycle(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    this.logger('=== Adaptive Control Cycle (All Components) ===');

    try {
      // Step 1: Read external indoor temperature
      const indoorTemp = this.externalTemperature.getIndoorTemperature();
      if (indoorTemp === null) {
        this.logger('AdaptiveControlService: No external temperature available, skipping cycle');
        return;
      }

      // Step 2: Check temperature data health
      const tempHealth = this.externalTemperature.getTemperatureHealth(10); // 10 min max age
      if (!tempHealth.hasValidData) {
        this.logger('AdaptiveControlService: Temperature data unhealthy, skipping cycle', {
          error: tempHealth.error,
        });
        return;
      }

      // Step 3: Read current warmtepomp setpoint (simulated or actual DPS 4)
      const currentSetpoint = this.getEffectiveTargetTemp();
      if (currentSetpoint === null) {
        this.logger('AdaptiveControlService: No warmtepomp setpoint available, skipping cycle');
        return;
      }

      // Step 3b: Read desired indoor temperature for PI calculation
      const desiredIndoorTemp = this.device.getCapabilityValue('target_temperature.indoor') as number | null;
      if (desiredIndoorTemp === null) {
        this.logger('AdaptiveControlService: No desired indoor temperature set, skipping cycle');
        return;
      }

      this.logger(
        `Indoor: ${indoorTemp.toFixed(1)}°C, Desired: ${desiredIndoorTemp.toFixed(1)}°C, `
        + `Setpoint: ${currentSetpoint.toFixed(1)}°C [DPS 4]`,
      );

      // Step 4A: Component 1 - Heating Controller (PI control)
      // PI controller calculates delta based on indoor temp error
      const sensorData: SensorData = {
        indoorTemp,
        targetTemp: desiredIndoorTemp, // Use desired indoor temp for error calculation
        timestamp: Date.now(),
      };

      const heatingAction = await this.heatingController.calculateAction(sensorData);

      // Step 4B: Component 3 - Energy Price Optimizer (if enabled)
      let priceAction = null;
      const priceOptimizerEnabled = await this.device.getSetting('price_optimizer_enabled');
      if (priceOptimizerEnabled) {
        try {
          priceAction = this.energyOptimizer.calculateAction(indoorTemp, desiredIndoorTemp);

          // Update energy price/cost capabilities
          await this.updateEnergyPriceCapabilities();

          // Check and trigger flow cards
          await this.checkPriceThresholdCrossed();
          await this.checkDailyCostThreshold();

          // Step 4D: Price Block Detection (v2.5.0+)
          await this.detectPriceBlocks();
        } catch (err) {
          this.device.error('Energy optimizer failed:', err);
        }
      }

      // Step 4C: Component 4 - COP Optimizer (if enabled AND cop_calculation is enabled)
      let copAction = null;
      const copOptimizerEnabled = await this.device.getSetting('cop_optimizer_enabled');
      const copCalculationEnabled = this.device.getSetting('cop_calculation_enabled') !== false; // default true
      if (copOptimizerEnabled && copCalculationEnabled) {
        try {
          const currentCOP = (this.device.getCapabilityValue('adlar_cop') as number) || 0;
          const dailyCOP = (this.device.getCapabilityValue('adlar_cop_daily') as number) || 0;
          // Get outdoor temperature with TTL-based source priority (v2.10.0): flow card → Open-Meteo → heat pump sensor
          const outdoorTemp = await this.getEffectiveOutdoorTemp();

          // COP optimizer uses current warmtepomp setpoint for efficiency calculation
          copAction = this.copOptimizer.calculateAction(currentCOP, dailyCOP, outdoorTemp, currentSetpoint);

          // Collect COP measurement for learning
          const compressorFreq = (this.device.getCapabilityValue('measure_frequency.compressor_strength') as number) || 0;
          if (currentCOP > 0 && compressorFreq > 0) {
            this.copOptimizer.addMeasurement({
              timestamp: Date.now(),
              outdoorTemp,
              supplyTemp: currentSetpoint, // Use current warmtepomp setpoint
              cop: currentCOP,
              compressorFreq,
            });
          }
        } catch (err) {
          this.device.error('COP optimizer failed:', err);
        }
      } else if (copOptimizerEnabled && !copCalculationEnabled) {
        // Log warning: optimizer enabled but calculation disabled - misconfiguration
        this.logger('⚠️ COP optimizer skipped: cop_calculation_enabled is off (required dependency)');
      }

      // Step 5: Collect confidence metrics for adaptive weighting (v2.4.14+)
      const buildingDiagnostics = await this.buildingModel.getDiagnosticStatus();

      const confidenceMetrics: ConfidenceMetrics = {
        // COP optimizer confidence: based on bucket quality distribution
        copConfidence: this.calculateCOPConfidence(),

        // Building model confidence: from RLS algorithm (0-100%, convert to 0.0-1.0)
        buildingModelConfidence: buildingDiagnostics.confidence / 100,

        // Energy price data availability: binary check
        priceDataAvailable: this.energyOptimizer.getPriceData().length > 0,
      };

      this.logger(
        `📊 Confidence: COP=${(confidenceMetrics.copConfidence * 100).toFixed(0)}%, `
        + `Building=${(confidenceMetrics.buildingModelConfidence * 100).toFixed(0)}%, `
        + `Price=${confidenceMetrics.priceDataAvailable ? 'Yes' : 'No'}`,
      );

      // v2.6.0: Step 5B - Building Model Integration
      // Pass building parameters to controllers for predictive features
      const buildingModel = this.buildingModel.getLearner().getModel();
      const tau = buildingModel.C / buildingModel.UA;

      // Update HeatingController with thermal inertia (for overshoot prevention)
      this.heatingController.setThermalInertia(tau);
      this.heatingController.setDynamicDeadbandUA(buildingModel.UA);

      // Update EnergyPriceOptimizer with thermal capacity (for load shifting)
      this.energyOptimizer.setThermalCapacity(buildingModel.C);

      // Get outdoor temperature for thermal calculation with TTL-based source priority (v2.10.0)
      const outdoorTempForThermal = await this.getEffectiveOutdoorTemp();

      // Step 5B.5: Update weather forecast advice (v2.8.0+)
      await this.updateWeatherForecastAdvice(outdoorTempForThermal);

      // Step 5C: Calculate thermal action (4th component)
      const thermalAction = this.buildingModel.calculateThermalAdjustment({
        indoorTemp,
        targetIndoorTemp: desiredIndoorTemp,
        outdoorTemp: outdoorTempForThermal,
      });

      // Step 5D: Calculate wind correction (5th component, v2.7.0+)
      // Wind correction adds to thermal adjustment to compensate for wind-induced heat loss
      let windCorrectionValue = 0;
      if (this.device.getSetting('wind_correction_enabled')) {
        const windResult = this.windCorrection.calculateCorrection(indoorTemp, outdoorTempForThermal);
        windCorrectionValue = windResult.correction;

        if (windCorrectionValue > 0) {
          this.logger(
            `💨 Wind correction: +${windCorrectionValue.toFixed(2)}°C `
            + `(wind: ${windResult.windSpeed} km/h, ΔT: ${windResult.deltaT.toFixed(1)}°C, `
            + `α: ${windResult.alpha.toFixed(4)} [${windResult.alphaSource}]${windResult.capped ? ' CAPPED' : ''})`,
          );
          // Add wind correction to thermal adjustment
          thermalAction.adjustment += windCorrectionValue;
        }
      }

      // Step 6: Combine actions using Weighted Decision Maker with 4-way thermal weighting
      const combinedAction = this.decisionMaker.combineActionsWithThermal(
        heatingAction,
        copAction,
        priceAction,
        thermalAction,
        confidenceMetrics,
      );

      // Log effective weights (confidence-adjusted)
      if (combinedAction.effectiveWeights) {
        this.logger(
          `⚖️ Effective Weights: Comfort=${(combinedAction.effectiveWeights.comfort * 100).toFixed(1)}%, `
          + `Efficiency=${(combinedAction.effectiveWeights.efficiency * 100).toFixed(1)}%, `
          + `Cost=${(combinedAction.effectiveWeights.cost * 100).toFixed(1)}%, `
          + `Thermal=${((combinedAction.effectiveWeights.thermal || 0) * 100).toFixed(1)}%`,
        );
      }

      // Step 7: Log combined decision
      this.logger(
        `Breakdown: Comfort=${combinedAction.breakdown.comfort.toFixed(2)}°C, `
        + `Efficiency=${combinedAction.breakdown.efficiency.toFixed(2)}°C, `
        + `Cost=${combinedAction.breakdown.cost.toFixed(2)}°C, `
        + `Thermal=${(combinedAction.breakdown.thermal || 0).toFixed(2)}°C`,
      );
      this.logger(`Final Adjustment: ${combinedAction.finalAdjustment.toFixed(2)}°C (${combinedAction.priority} priority)`);
      combinedAction.reasoning.forEach((reason) => this.logger(`  - ${reason}`));

      // Step 6.5: Update diagnostic capability with weighted decision breakdown
      await this.updateDiagnosticsCapability(combinedAction);

      // Step 6.6: Trigger simulation update flow card (v2.6.0: revived for monitoring)
      // This fires EVERY cycle with full breakdown for monitoring/logging purposes
      await this.triggerSimulationUpdate(
        currentSetpoint,
        combinedAction,
        confidenceMetrics,
      );

      // Step 7: Check if significant action is needed
      if (heatingAction === null && Math.abs(combinedAction.finalAdjustment) < 0.1) {
        this.logger('AdaptiveControlService: No significant action needed');

        // v2.5.1 Fix: Always update adlar_simulated_target to current setpoint to prevent stale values
        // Without this, the capability could retain an old value from a previous session
        this.simulatedTargetTemp = currentSetpoint;
        if (this.device.hasCapability('adlar_simulated_target')) {
          await this.device.setCapabilityValue('adlar_simulated_target', this.simulatedTargetTemp);
        }

        this.lastControlCycleTime = Date.now();
        return;
      }

      // Step 9: Flow-assisted mode (v2.5.0: automatic mode removed)
      // Always trigger recommendation flow card - user controls execution via flows
      this.logger('⚙️ FLOW-ASSISTED MODE: Triggering recommendation for user flow execution');

      // Calculate recommended warmtepomp setpoint (integer adjusted, clamped to realistic range)
      const integerAdjustment = Math.round(this.accumulatedAdjustment + combinedAction.finalAdjustment);
      const recommendedTemp = Math.max(
        DeviceConstants.ADAPTIVE_MIN_SETPOINT,
        Math.min(DeviceConstants.ADAPTIVE_MAX_SETPOINT, currentSetpoint + integerAdjustment),
      );

      // Trigger recommendation flow card (with confidence for user filtering)
      await this.triggerTemperatureRecommendation(
        currentSetpoint,
        recommendedTemp,
        combinedAction,
        confidenceMetrics.buildingModelConfidence,
      );

      // Always update recommended temp for Insights tracking (v2.5.0: simulate mode implicit)
      this.simulatedTargetTemp = recommendedTemp;
      if (this.device.hasCapability('adlar_simulated_target')) {
        await this.device.setCapabilityValue('adlar_simulated_target', this.simulatedTargetTemp);
      }

      this.lastControlCycleTime = Date.now();

    } catch (error) {
      this.logger('AdaptiveControlService: Control cycle error', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Apply temperature adjustment to warmtepomp setpoint (CASCADE CONTROL)
   *
   * The PI controller calculates a delta based on indoor temperature error,
   * and this delta is applied to the current warmtepomp setpoint (DPS 4).
   *
   * @param currentSetpoint - Current warmtepomp setpoint (simulated or actual DPS 4)
   * @param combinedAction - Combined action from weighted decision maker
   */
  private async applyTemperatureAdjustment(
    currentSetpoint: number,
    combinedAction: { finalAdjustment: number; breakdown: { comfort: number; efficiency: number; cost: number }; reasoning: string[]; priority: string },
  ): Promise<void> {
    // Accumulate fractional adjustment (for step:1 rounding)
    this.accumulatedAdjustment += combinedAction.finalAdjustment;

    this.logger('AdaptiveControlService: Combined adjustment calculated', {
      combinedAdjustment: combinedAction.finalAdjustment.toFixed(2),
      accumulatedTotal: this.accumulatedAdjustment.toFixed(2),
      reasoning: combinedAction.reasoning.join('; '),
    });

    // Round accumulated adjustment to nearest integer (step:1 requirement)
    const integerAdjustment = Math.round(this.accumulatedAdjustment);

    // Only apply if rounded adjustment is non-zero
    if (integerAdjustment === 0) {
      this.logger('AdaptiveControlService: Accumulating adjustment (waiting for ≥0.5°C)', {
        accumulated: this.accumulatedAdjustment.toFixed(2),
        needMore: (0.5 - Math.abs(this.accumulatedAdjustment)).toFixed(2),
      });

      // Persist accumulator even when not applying
      await this.device.setStoreValue(this.STORE_KEY_ACCUMULATED_ADJUSTMENT, this.accumulatedAdjustment);
      this.lastControlCycleTime = Date.now();
      return;
    }

    // Throttling check - minimum 20 minutes between actual adjustments
    const timeSinceLastAdjustment = Date.now() - this.lastAdjustmentTime;
    const minWaitTime = DeviceConstants.ADAPTIVE_MIN_WAIT_BETWEEN_ADJUSTMENTS_MS;

    if (this.lastAdjustmentTime > 0 && timeSinceLastAdjustment < minWaitTime) {
      const minutesRemaining = Math.ceil((minWaitTime - timeSinceLastAdjustment) / 60000);
      this.logger('AdaptiveControlService: Adjustment throttled (anti-oscillation)', {
        minutesSinceLastAdjustment: Math.round(timeSinceLastAdjustment / 60000),
        minutesUntilNextAllowed: minutesRemaining,
        integerAdjustment,
        accumulated: this.accumulatedAdjustment.toFixed(2),
      });
      this.lastControlCycleTime = Date.now();
      return;
    }

    // Calculate new warmtepomp setpoint with integer adjustment (cascade control)
    const newSetpoint = currentSetpoint + integerAdjustment;

    // Safety: clamp warmtepomp setpoint to realistic range (25-65°C for floor heating/radiators)
    const clampedSetpoint = Math.max(
      DeviceConstants.ADAPTIVE_MIN_SETPOINT,
      Math.min(DeviceConstants.ADAPTIVE_MAX_SETPOINT, newSetpoint),
    );

    // Calculate actual applied adjustment (may differ if clamped)
    const actualAdjustment = clampedSetpoint - currentSetpoint;

    this.logger('AdaptiveControlService: Applying warmtepomp setpoint adjustment (CASCADE CONTROL)', {
      mode: this.isSimulateMode ? 'SIMULATE' : 'ACTIVE',
      currentSetpoint,
      delta: integerAdjustment,
      actualDelta: actualAdjustment,
      newSetpoint: clampedSetpoint,
      accumulated: this.accumulatedAdjustment.toFixed(2),
      reasoning: combinedAction.reasoning.join('; '),
      priority: combinedAction.priority,
    });

    if (this.isSimulateMode) {
      // SIMULATE MODE: Update internal simulated warmtepomp setpoint AND capability
      this.simulatedTargetTemp = clampedSetpoint;

      // Update capability for Insights
      if (this.device.hasCapability('adlar_simulated_target')) {
        await this.device.setCapabilityValue('adlar_simulated_target', this.simulatedTargetTemp);
      }

      // Get actual warmtepomp setpoint (DPS 4) for delta calculation
      const actualSetpoint = this.device.getCapabilityValue('target_temperature') as number;
      const delta = this.simulatedTargetTemp - actualSetpoint;

      this.logger('Simulated warmtepomp setpoint updated', {
        simulated: this.simulatedTargetTemp.toFixed(1),
        actual: actualSetpoint.toFixed(1),
        delta: delta.toFixed(1),
      });

      // Trigger simulation flow card
      await this.device.homey.flow
        .getDeviceTriggerCard('adaptive_simulation_update')
        .trigger(this.device, {
          simulated_target: this.simulatedTargetTemp,
          actual_target: actualSetpoint,
          delta,
          adjustment: actualAdjustment,
          comfort_component: combinedAction.breakdown.comfort,
          efficiency_component: combinedAction.breakdown.efficiency,
          cost_component: combinedAction.breakdown.cost,
          reasoning: combinedAction.reasoning.join('; '),
        })
        .catch((err) => this.logger('Failed to trigger simulation card:', err));

    } else {
      // ACTIVE MODE: Write to actual warmtepomp setpoint (DPS 4)
      await this.device.setCapabilityValue('target_temperature', clampedSetpoint);
    }

    // Subtract applied adjustment from accumulator
    this.accumulatedAdjustment -= actualAdjustment;

    this.logger('AdaptiveControlService: Accumulator updated after application', {
      appliedAdjustment: actualAdjustment,
      remainingAccumulated: this.accumulatedAdjustment.toFixed(2),
    });

    // Save state for all components
    await this.savePIHistory();
    await this.device.setStoreValue(this.STORE_KEY_LAST_ACTION, Date.now());
    await this.device.setStoreValue(this.STORE_KEY_ACCUMULATED_ADJUSTMENT, this.accumulatedAdjustment);

    // Persist optimizer states
    await this.device.setStoreValue('energy_optimizer_state', this.energyOptimizer.getState());
    await this.device.setStoreValue('cop_optimizer_state', this.copOptimizer.getState());
    await this.device.setStoreValue('defrost_learning_state', this.defrostLearner.getState());

    // Update and persist last adjustment timestamp (throttling)
    this.lastAdjustmentTime = Date.now();
    await this.device.setStoreValue(this.STORE_KEY_LAST_ADJUSTMENT, this.lastAdjustmentTime);

    this.lastControlCycleTime = Date.now();

    this.logger('AdaptiveControlService: Temperature adjustment applied successfully');
  }

  /**
   * Save PI controller error history to device store
   */
  private async savePIHistory(): Promise<void> {
    try {
      const history = this.heatingController.getErrorHistory();
      await this.device.setStoreValue(this.STORE_KEY_PI_HISTORY, history);
      this.logger('AdaptiveControlService: PI history saved', {
        historySize: history.length,
      });
    } catch (error) {
      this.logger('AdaptiveControlService: Failed to save PI history', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Restore PI controller error history from device store
   */
  private async restorePIHistory(): Promise<void> {
    try {
      const history = await this.device.getStoreValue(this.STORE_KEY_PI_HISTORY);
      if (Array.isArray(history) && history.length > 0) {
        this.heatingController.restoreHistory(history);
        this.logger('AdaptiveControlService: PI history restored', {
          historySize: history.length,
        });
      }
    } catch (error) {
      this.logger('AdaptiveControlService: Failed to restore PI history', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Trigger: adaptive_status_change
   * Fired when adaptive control is enabled/disabled
   */
  private async triggerStatusChange(status: string, reason: string): Promise<void> {
    try {
      const trigger = this.device.homey.flow.getDeviceTriggerCard('adaptive_status_change');
      await trigger.trigger(this.device, {
        status,
        reason,
      });
      this.logger('AdaptiveControlService: Triggered adaptive_status_change flow card');
    } catch (error) {
      this.logger('AdaptiveControlService: Failed to trigger adaptive_status_change', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Trigger: temperature_adjustment_recommended
   * Fired when adaptive control recommends a temperature adjustment in flow-assisted mode
   * @version 2.6.0 - Added building_model_confidence token for user filtering
   */
  private async triggerTemperatureRecommendation(
    currentTemp: number,
    recommendedTemp: number,
    combinedAction: { finalAdjustment: number; reasoning: string[]; priority: string },
    buildingModelConfidence: number = 0,
  ): Promise<void> {
    try {
      const trigger = this.device.homey.flow.getDeviceTriggerCard('temperature_adjustment_recommended');
      await trigger.trigger(this.device, {
        current_temperature: currentTemp,
        recommended_temperature: recommendedTemp,
        adjustment: combinedAction.finalAdjustment,
        reason: combinedAction.reasoning.join('; '),
        controller: 'weighted', // All 4 components combined
        building_model_confidence: Math.round(buildingModelConfidence * 100), // 0-100%
      });
      this.logger('AdaptiveControlService: Triggered temperature_adjustment_recommended flow card', {
        confidence: `${Math.round(buildingModelConfidence * 100)}%`,
      });
    } catch (error) {
      this.logger('AdaptiveControlService: Failed to trigger temperature_adjustment_recommended', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Trigger: adaptive_simulation_update
   * Fired EVERY control cycle with full breakdown for monitoring/logging
   * @version 2.6.0 - Revived from dead code, now fires every cycle with confidence metrics
   */
  private async triggerSimulationUpdate(
    currentSetpoint: number,
    combinedAction: { finalAdjustment: number; breakdown: { comfort: number; efficiency: number; cost: number }; reasoning: string[]; priority: string },
    confidenceMetrics: ConfidenceMetrics,
  ): Promise<void> {
    try {
      // Calculate simulated target (what the system recommends)
      const integerAdjustment = Math.round(this.accumulatedAdjustment + combinedAction.finalAdjustment);
      const simulatedTarget = Math.max(
        DeviceConstants.ADAPTIVE_MIN_SETPOINT,
        Math.min(DeviceConstants.ADAPTIVE_MAX_SETPOINT, currentSetpoint + integerAdjustment),
      );
      const delta = simulatedTarget - currentSetpoint;

      const trigger = this.device.homey.flow.getDeviceTriggerCard('adaptive_simulation_update');
      await trigger.trigger(this.device, {
        simulated_target: simulatedTarget,
        actual_target: currentSetpoint,
        delta,
        adjustment: combinedAction.finalAdjustment,
        comfort_component: combinedAction.breakdown.comfort,
        efficiency_component: combinedAction.breakdown.efficiency,
        cost_component: combinedAction.breakdown.cost,
        building_model_confidence: Math.round(confidenceMetrics.buildingModelConfidence * 100), // 0-100%
        cop_confidence: Math.round(confidenceMetrics.copConfidence * 100), // 0-100%
        reasoning: combinedAction.reasoning.join('; '),
      });
      this.logger('AdaptiveControlService: Triggered adaptive_simulation_update flow card', {
        simulated: `${simulatedTarget}°C`,
        delta: `${delta}°C`,
        confidence: `${Math.round(confidenceMetrics.buildingModelConfidence * 100)}%`,
      });
    } catch (error) {
      this.logger('AdaptiveControlService: Failed to trigger adaptive_simulation_update', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get effective outdoor temperature with TTL-based source priority:
   * 1. Flow card (adlar_external_ambient) — if received within 2 hours
   * 2. Open-Meteo current hour — already fetched, no extra API cost
   * 3. Heat pump internal sensor — last resort
   *
   * @version 2.10.0
   */
  private async getEffectiveOutdoorTemp(): Promise<number> {
    const TTL_MS = 1 * 60 * 60 * 1000;

    // Priority 1: Flow card — only if timestamp is within TTL
    const storedTs = await this.device.getStoreValue('external_outdoor_temp_timestamp') as number | null;
    if (storedTs !== null && (Date.now() - storedTs) < TTL_MS) {
      const flowTemp = this.device.getCapabilityValue('adlar_external_ambient') as number | null;
      if (flowTemp !== null && flowTemp > -50 && flowTemp < 60) {
        this.logger('AdaptiveControlService: Using flow card outdoor temp', {
          temp: flowTemp.toFixed(1),
          ageMin: Math.round((Date.now() - storedTs) / 60000),
        });
        return flowTemp;
      }
    }

    // Priority 2: Open-Meteo current hour
    if (this.weatherForecast) {
      const forecastTemp = this.weatherForecast.getTempAt(0);
      if (forecastTemp !== null) {
        this.logger('AdaptiveControlService: Using Open-Meteo outdoor temp (flow card stale/absent)', {
          temp: forecastTemp.toFixed(1),
        });
        return forecastTemp;
      }
    }

    // Priority 3: Heat pump internal sensor (last resort)
    // @ts-expect-error - Accessing MyDevice.getOutdoorTemperatureWithFallback() (not in Homey.Device base type)
    return this.device.getOutdoorTemperatureWithFallback() || 0;
  }

  /**
   * Update weather forecast advice capabilities and flow trigger
   * @version 2.8.0
   */
  private async updateWeatherForecastAdvice(currentOutdoorTemp: number): Promise<void> {
    if (this.device.getSetting('enable_weather_forecast') !== true) {
      return;
    }

    try {
      // Refresh forecast if cache is stale
      if (!this.weatherForecast.hasFreshForecast()) {
        await this.weatherForecast.updateForecast();
      }

      const advice = this.weatherForecast.calculateAdvice(currentOutdoorTemp, 6);
      if (!advice) {
        return;
      }

      if (this.device.hasCapability('adlar_forecast_advice')) {
        await this.device.setCapabilityValue('adlar_forecast_advice', advice.adviceText);
      }

      if (this.device.hasCapability('adlar_optimal_delay')) {
        await this.device.setCapabilityValue('adlar_optimal_delay', advice.delayHours);
      }

      // v2.9.0: Update weather correction percentage
      const correctionPct = this.weatherForecast.getCurrentCopCorrectionPct();
      if (correctionPct !== null && this.device.hasCapability('adlar_forecast_cop_correction')) {
        await this.device.setCapabilityValue('adlar_forecast_cop_correction', correctionPct);
      }

      // Trigger flow card only when advice meaningfully changes
      const signature = `${advice.delayHours}|${advice.currentCop.toFixed(2)}|${advice.expectedCop.toFixed(2)}`;
      if (signature !== this.lastForecastAdviceSignature) {
        this.lastForecastAdviceSignature = signature;
        await this.triggerForecastHeatingAdvice(advice);
      }
    } catch (error) {
      this.logger('AdaptiveControlService: Weather forecast advice update failed', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Trigger: forecast_heating_advice
   * Fired when weather forecast advice changes
   * @version 2.8.0
   */
  private async triggerForecastHeatingAdvice(advice: ForecastAdvice): Promise<void> {
    try {
      const trigger = this.device.homey.flow.getDeviceTriggerCard('forecast_heating_advice');
      await trigger.trigger(this.device, {
        delay_hours: advice.delayHours,
        expected_cop: advice.expectedCop,
        current_cop: advice.currentCop,
        advice_text: advice.adviceText,
      });
      this.logger('AdaptiveControlService: Triggered forecast_heating_advice flow card', {
        delayHours: advice.delayHours,
        currentCop: advice.currentCop.toFixed(2),
        expectedCop: advice.expectedCop.toFixed(2),
      });
    } catch (error) {
      this.logger('AdaptiveControlService: Failed to trigger forecast_heating_advice', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Record a completed defrost cycle for the DefrostLearner.
   * Called by ServiceCoordinator when DPS 33 transitions true→false.
   * @version 2.9.0
   */
  async onDefrostComplete(outdoorTemp: number, durationSec: number): Promise<void> {
    // Get current humidity from forecast if available
    let humidity: number | null = null;
    const forecast = this.weatherForecast.getForecast();
    if (forecast && forecast.hourly.length > 0) {
      humidity = forecast.hourly[0].humidity ?? null;
    }

    this.defrostLearner.recordEvent(outdoorTemp, durationSec, humidity);

    this.logger('AdaptiveControlService: Defrost event recorded', {
      outdoorTemp: `${outdoorTemp.toFixed(1)}°C`,
      durationSec: `${durationSec.toFixed(0)}s`,
      humidity: humidity !== null ? `${humidity}%` : 'unknown',
      totalEvents: this.defrostLearner.getEventCount(),
    });
  }

  /**
   * Receive external indoor temperature (called by flow card handler)
   */
  async receiveExternalTemperature(temperature: number): Promise<void> {
    await this.externalTemperature.receiveExternalTemperature(temperature);
  }

  /**
   * Load priority settings from device settings
   * Called during initialization and when settings change
   * @version 2.4.1 - Bug fix: priority settings existed in UI but were not used
   */
  private async loadPrioritySettings(): Promise<void> {
    try {
      // Read priority settings (percentages 0-100)
      const comfortPct = (await this.device.getSetting('priority_comfort')) ?? 60;
      const efficiencyPct = (await this.device.getSetting('priority_efficiency')) ?? 25;
      const costPct = (await this.device.getSetting('priority_cost')) ?? 15;
      const thermalPct = (await this.device.getSetting('priority_thermal')) ?? 20;

      // Validate: at least one priority must be > 0
      if (comfortPct === 0 && efficiencyPct === 0 && costPct === 0 && thermalPct === 0) {
        this.logger('AdaptiveControlService: All priorities are 0%, using defaults (60/25/15/20)');
        this.decisionMaker.setPriorities({
          comfort: 0.60,
          efficiency: 0.25,
          cost: 0.15,
          thermal: 0.20,
        });
        return;
      }

      // Convert percentages to 0.0-1.0 range and update decision maker
      // WeightedDecisionMaker automatically normalizes to sum = 1.0
      this.decisionMaker.setPriorities({
        comfort: comfortPct / 100,
        efficiency: efficiencyPct / 100,
        cost: costPct / 100,
        thermal: thermalPct / 100,
      });

      this.logger('AdaptiveControlService: Priorities loaded from settings', {
        comfort: `${comfortPct}%`,
        efficiency: `${efficiencyPct}%`,
        cost: `${costPct}%`,
        thermal: `${thermalPct}%`,
        normalized: this.decisionMaker.getPriorities(),
      });
    } catch (error) {
      this.logger('AdaptiveControlService: Failed to load priority settings, using defaults', {
        error: (error as Error).message,
      });
      // Fallback to defaults
      this.decisionMaker.setPriorities({
        comfort: 0.60,
        efficiency: 0.25,
        cost: 0.15,
        thermal: 0.20,
      });
    }
  }

  /**
   * Load price settings from device settings
   * Called during initialization and when settings change
   * @version 2.4.6 - Bug fix: price settings existed in UI but were not loaded on init
   * @version 2.4.7 - Bug fix: price thresholds were not loaded, always used hardcoded defaults
   */
  private async loadPriceSettings(): Promise<void> {
    try {
      // Read price calculation mode (default: all_in)
      const priceMode = (await this.device.getSetting('price_calculation_mode')) ?? 'all_in';

      // Read financial components (with defaults matching energy-price-optimizer.ts)
      const supplierFee = (await this.device.getSetting('supplier_fee_inc_vat')) ?? 0.0182;
      const energyTax = (await this.device.getSetting('electricity_tax_inc_vat')) ?? 0.11085;
      const vatPercentage = (await this.device.getSetting('vat_percentage')) ?? 21;

      // Read price thresholds (2024 NL spot market defaults based on EPEX data)
      const thresholdVeryLow = (await this.device.getSetting('price_threshold_very_low')) ?? 0.04;
      const thresholdLow = (await this.device.getSetting('price_threshold_low')) ?? 0.06;
      const thresholdNormal = (await this.device.getSetting('price_threshold_normal')) ?? 0.10;
      const thresholdHigh = (await this.device.getSetting('price_threshold_high')) ?? 0.12;

      // Apply price mode to optimizer
      this.energyOptimizer.setPriceMode(priceMode as 'market' | 'market_plus' | 'all_in');

      // Apply financial components to optimizer
      this.energyOptimizer.setFinancialComponents({
        storageFee: supplierFee,
        energyTax,
        vatPercentage,
      });

      // Apply price thresholds to optimizer (v2.5.0 bug fix)
      this.energyOptimizer.setThresholds({
        veryLow: thresholdVeryLow,
        low: thresholdLow,
        normal: thresholdNormal,
        high: thresholdHigh,
      });

      this.logger('AdaptiveControlService: Price settings loaded from device settings', {
        priceMode,
        supplierFee: `€${supplierFee.toFixed(4)}/kWh`,
        energyTax: `€${energyTax.toFixed(5)}/kWh`,
        vatPercentage: `${vatPercentage}%`,
        thresholds: {
          veryLow: `€${thresholdVeryLow.toFixed(4)}/kWh`,
          low: `€${thresholdLow.toFixed(4)}/kWh`,
          normal: `€${thresholdNormal.toFixed(4)}/kWh`,
          high: `€${thresholdHigh.toFixed(4)}/kWh`,
        },
      });
    } catch (error) {
      this.logger('AdaptiveControlService: Failed to load price settings, using defaults', {
        error: (error as Error).message,
      });
      // Fallback to defaults from settings schema (driver.settings.compose.json)
      this.energyOptimizer.setPriceMode('all_in');
      this.energyOptimizer.setFinancialComponents({
        storageFee: 0.0182,
        energyTax: 0.11085,
        vatPercentage: 21,
      });
      this.energyOptimizer.setThresholds({
        veryLow: 0.04,
        low: 0.06,
        normal: 0.10,
        high: 0.12,
      });
    }
  }

  /**
   * Update PI controller parameters (Expert Mode)
   */
  updatePIParameters(Kp: number, Ki: number, deadband: number): void {
    this.heatingController.updateParameters(Kp, Ki, deadband);
    this.logger('AdaptiveControlService: PI parameters updated', { Kp, Ki, deadband });
  }

  /**
   * Reset PI controller history (useful after mode changes)
   */
  async resetPIHistory(): Promise<void> {
    this.heatingController.resetHistory();
    await this.device.setStoreValue(this.STORE_KEY_PI_HISTORY, []);

    // Also reset accumulator when resetting PI history
    this.accumulatedAdjustment = 0;
    await this.device.setStoreValue(this.STORE_KEY_ACCUMULATED_ADJUSTMENT, 0);

    this.logger('AdaptiveControlService: PI history and accumulator reset');
  }

  /**
   * Get current adaptive control status
   */
  getStatus(): AdaptiveControlStatus {
    return {
      enabled: this.isEnabled,
      lastControlCycle: this.lastControlCycleTime > 0 ? this.lastControlCycleTime : null,
      controlIntervalMinutes: this.controlIntervalMs / 60000,
      hasExternalTemperature: this.externalTemperature.isConfigured(),
      currentIndoorTemp: this.externalTemperature.getIndoorTemperature(),
      currentTargetTemp: this.device.getCapabilityValue('target_temperature') as number | null,
      piControllerStatus: this.heatingController.getStatus(),
    };
  }

  /**
   * Check if adaptive control is enabled
   */
  isAdaptiveControlEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Handle settings changes (called by ServiceCoordinator)
   */
  async onSettings(
    oldSettings: Record<string, unknown>,
    newSettings: Record<string, unknown>,
    changedKeys: string[],
  ): Promise<void> {
    this.logger('AdaptiveControlService: Settings changed', { changedKeys });

    // Handle adaptive_control_enabled toggle
    if (changedKeys.includes('adaptive_control_enabled')) {
      const enabled = newSettings.adaptive_control_enabled as boolean;
      if (enabled && !this.isEnabled) {
        try {
          await this.start();
        } catch (error) {
          // v2.6.1: Prevent unhandled exception when starting without required data
          // This can happen if user enables adaptive control before sending indoor temperature via flow card
          this.logger('AdaptiveControlService: Failed to start - resetting setting', {
            error: (error as Error).message,
          });
          // Reset the setting to false since start failed
          // Use setTimeout to avoid race condition with onSettings still pending
          this.device.homey.setTimeout(async () => {
            try {
              await this.device.setSettings({ adaptive_control_enabled: false });
              this.logger('AdaptiveControlService: adaptive_control_enabled reset to false');
            } catch (settingsError) {
              this.logger('AdaptiveControlService: Failed to reset adaptive_control_enabled setting:', settingsError);
            }
          }, 100);
        }
      } else if (!enabled && this.isEnabled) {
        await this.stop();
      }
    }

    // Handle weather forecast sensor visibility toggle (v2.10.0: API always runs, toggle only controls output sensors)
    if (changedKeys.includes('enable_weather_forecast')) {
      const enabled = newSettings.enable_weather_forecast as boolean;
      if (!enabled) {
        this.lastForecastAdviceSignature = null;
      }
      this.logger(`AdaptiveControlService: Weather forecast sensors ${enabled ? 'enabled' : 'disabled'}`);
    }

    // Handle weather forecast location changes — always refresh regardless of sensor toggle
    if (changedKeys.includes('forecast_location_lat') || changedKeys.includes('forecast_location_lon')) {
      await this.weatherForecast.updateForecast();
      this.logger('AdaptiveControlService: Weather forecast location updated and forecast refreshed');
    }

    // Handle priority settings changes (v2.4.1: bug fix - settings were defined but not used)
    if (changedKeys.includes('priority_comfort')
      || changedKeys.includes('priority_efficiency')
      || changedKeys.includes('priority_cost')
      || changedKeys.includes('priority_thermal')) {
      await this.loadPrioritySettings();

      // Log the change for transparency
      const priorities = this.decisionMaker.getPriorities();
      this.logger('AdaptiveControlService: Priority weights updated', {
        comfort: `${Math.round(priorities.comfort * 100)}%`,
        efficiency: `${Math.round(priorities.efficiency * 100)}%`,
        cost: `${Math.round(priorities.cost * 100)}%`,
        thermal: priorities.thermal ? `${Math.round(priorities.thermal * 100)}%` : 'N/A',
      });
    }

    // Handle PI parameter changes (Expert Mode)
    if (changedKeys.includes('adaptive_pi_kp') || changedKeys.includes('adaptive_pi_ki') || changedKeys.includes('adaptive_pi_deadband')) {
      const Kp = newSettings.adaptive_pi_kp as number || 3.0;
      const Ki = newSettings.adaptive_pi_ki as number || 1.5;
      const deadband = newSettings.adaptive_pi_deadband as number || 0.3;
      this.updatePIParameters(Kp, Ki, deadband);
    }

    // Handle energy price settings changes
    if (changedKeys.includes('price_calculation_mode')) {
      const mode = newSettings.price_calculation_mode as 'market' | 'market_plus' | 'all_in';
      this.energyOptimizer.setPriceMode(mode);
    }

    // Handle financial component changes
    if (changedKeys.includes('supplier_fee_inc_vat')
      || changedKeys.includes('electricity_tax_inc_vat')
      || changedKeys.includes('vat_percentage')) {
      this.energyOptimizer.setFinancialComponents({
        storageFee: newSettings.supplier_fee_inc_vat as number,
        energyTax: newSettings.electricity_tax_inc_vat as number,
        vatPercentage: newSettings.vat_percentage as number,
      });
    }

    // v2.5.1 Fix: Handle price threshold settings changes
    // Previously thresholds were only loaded at initialization, changes were ignored
    if (changedKeys.includes('price_threshold_very_low')
      || changedKeys.includes('price_threshold_low')
      || changedKeys.includes('price_threshold_normal')
      || changedKeys.includes('price_threshold_high')) {
      this.energyOptimizer.setThresholds({
        veryLow: newSettings.price_threshold_very_low as number ?? 0.04,
        low: newSettings.price_threshold_low as number ?? 0.06,
        normal: newSettings.price_threshold_normal as number ?? 0.10,
        high: newSettings.price_threshold_high as number ?? 0.12,
      });
      this.logger('AdaptiveControlService: Price thresholds updated from settings', {
        veryLow: `€${(newSettings.price_threshold_very_low as number)?.toFixed(2) || '0.04'}/kWh`,
        low: `€${(newSettings.price_threshold_low as number)?.toFixed(2) || '0.06'}/kWh`,
        normal: `€${(newSettings.price_threshold_normal as number)?.toFixed(2) || '0.10'}/kWh`,
        high: `€${(newSettings.price_threshold_high as number)?.toFixed(2) || '0.12'}/kWh`,
      });
    }

    // Handle building model reset toggle
    if (changedKeys.includes('reset_building_model')) {
      const shouldReset = newSettings.reset_building_model as boolean;
      if (shouldReset) {
        this.logger('AdaptiveControlService: Building model reset requested via settings');
        try {
          // Execute reset
          await this.buildingModel.reset();

          // Automatically turn off the toggle
          await this.device.setSettings({ reset_building_model: false });
          this.logger('✅ Building model reset complete - toggle automatically disabled');
        } catch (error) {
          this.device.error('❌ Building model reset failed:', error);
          // Still turn off toggle to prevent repeated failures
          await this.device.setSettings({ reset_building_model: false });
        }
      }
    }
  }

  /**
   * Update diagnostic capability with weighted decision breakdown
   *
   * Provides real-time transparency into adaptive control decision-making process
   * by publishing JSON data showing:
   * - Final temperature adjustment
   * - Breakdown per component (comfort/efficiency/cost)
   * - Current priority weights
   * - Reasoning from each controller
   * - PI controller state (error, P-term, I-term)
   *
   * @param combinedAction - Combined action from weighted decision maker
   */
  private async updateDiagnosticsCapability(
    combinedAction: {
      finalAdjustment: number;
      breakdown: { comfort: number; efficiency: number; cost: number };
      reasoning: string[];
      priority: string;
      effectiveWeights?: { comfort: number; efficiency: number; cost: number };
    },
  ): Promise<void> {
    try {
      // Check if capability exists (should always be true, but defensive)
      if (!this.device.hasCapability('adaptive_control_diagnostics')) {
        return;
      }

      // Get current priorities from decision maker
      const priorities = this.decisionMaker.getPriorities();

      // Get PI controller state
      const piStatus = this.heatingController.getStatus();

      // Get COP optimizer diagnostics
      const copDiag = this.copOptimizer.getDiagnostics();

      // Compile diagnostic data as JSON
      const diagnostics = {
        timestamp: new Date().toISOString(),
        finalAdjustment: Number(combinedAction.finalAdjustment.toFixed(2)),
        breakdown: {
          comfort: Number(combinedAction.breakdown.comfort.toFixed(2)),
          efficiency: Number(combinedAction.breakdown.efficiency.toFixed(2)),
          cost: Number(combinedAction.breakdown.cost.toFixed(2)),
        },
        priorities: {
          comfort: Number(priorities.comfort.toFixed(2)),
          efficiency: Number(priorities.efficiency.toFixed(2)),
          cost: Number(priorities.cost.toFixed(2)),
          thermal: Number((priorities.thermal ?? 0).toFixed(2)),
        },
        effectiveWeights: combinedAction.effectiveWeights ? {
          comfort: Number(combinedAction.effectiveWeights.comfort.toFixed(2)),
          efficiency: Number(combinedAction.effectiveWeights.efficiency.toFixed(2)),
          cost: Number(combinedAction.effectiveWeights.cost.toFixed(2)),
          thermal: Number(((combinedAction.effectiveWeights as { thermal?: number }).thermal ?? 0).toFixed(2)),
        } : undefined,
        reasoning: combinedAction.reasoning,
        priority: combinedAction.priority,
        piController: {
          currentError: Number(piStatus.currentError.toFixed(2)),
          averageError: Number(piStatus.averageError.toFixed(2)),
          historySize: piStatus.historySize,
          maxHistorySize: piStatus.maxHistorySize,
          parameters: {
            Kp: piStatus.Kp,
            Ki: piStatus.Ki,
            deadband: piStatus.deadband,
          },
        },
        copOptimizer: {
          samplesCollected: copDiag.samplesCollected,
          historyCapacity: copDiag.historyCapacity,
          fillPercentage: copDiag.fillPercentage,
          bucketsLearned: copDiag.bucketsLearned,
          confidenceLevels: {
            low: copDiag.bucketDetails.filter((b) => b.confidence === 'low').length,
            medium: copDiag.bucketDetails.filter((b) => b.confidence === 'medium').length,
            high: copDiag.bucketDetails.filter((b) => b.confidence === 'high').length,
          },
          configuration: copDiag.configuration,
        },
        buildingModel: await this.getBuildingModelDiagnostics(),
      };

      // Update capability with JSON string
      await this.device.setCapabilityValue('adaptive_control_diagnostics', JSON.stringify(diagnostics));

      this.logger('📊 Diagnostic capability updated', {
        adjustment: diagnostics.finalAdjustment,
        priority: diagnostics.priority,
      });
    } catch (error) {
      this.device.error('⚠️ Failed to update diagnostic capability:', error);
      // Non-critical: don't throw, just log warning
    }
  }

  /**
   * Get Building Model diagnostics for inclusion in adaptive_control_diagnostics
   * @returns Object with tau, confidence, sampleCount, enabled status
   * @since v2.6.0
   */
  private async getBuildingModelDiagnostics(): Promise<{
    enabled: boolean;
    tau: number;
    confidence: number;
    sampleCount: number;
    thermalMass: number;
    heatLoss: number;
  } | null> {
    try {
      if (!this.buildingModel) {
        return null;
      }
      const status = await this.buildingModel.getDiagnosticStatus();
      const model = this.buildingModel.getLearner().getModel();

      return {
        enabled: status.enabled,
        tau: Number(status.tau.toFixed(1)),
        confidence: Number(status.confidence.toFixed(1)),
        sampleCount: status.sampleCount,
        thermalMass: model ? Number(model.C.toFixed(2)) : 0,
        heatLoss: model ? Number(model.UA.toFixed(3)) : 0,
      };
    } catch (error) {
      this.device.error('⚠️ Failed to get building model diagnostics:', error);
      return null;
    }
  }

  /**
   * Calculate COP optimizer confidence score (0.0-1.0)
   *
   * Confidence based on bucket quality distribution:
   * - High confidence buckets (30+ samples): 1.0 weight
   * - Medium confidence buckets (10-29 samples): 0.5 weight
   * - Low confidence buckets (<10 samples): 0.0 weight
   *
   * Overall confidence = weighted average across all buckets
   *
   * @returns Confidence score 0.0-1.0
   * @version 2.4.14
   * @since 2.4.14
   */
  private calculateCOPConfidence(): number {
    const copDiagnostics = this.copOptimizer.getDiagnostics();

    // No buckets learned yet = zero confidence
    if (copDiagnostics.bucketsLearned === 0) {
      return 0.0;
    }

    // Calculate weighted confidence based on bucket quality
    const { bucketDetails } = copDiagnostics;
    let totalWeight = 0;
    let weightedSum = 0;

    bucketDetails.forEach((bucket) => {
      let weight: number;
      if (bucket.confidence === 'high') {
        weight = 1.0; // 30+ samples = full confidence
      } else if (bucket.confidence === 'medium') {
        weight = 0.5; // 10-29 samples = partial confidence
      } else {
        weight = 0.0; // <10 samples = no confidence
      }

      totalWeight += 1.0;
      weightedSum += weight;
    });

    // Return weighted average
    return totalWeight > 0 ? weightedSum / totalWeight : 0.0;
  }

  /**
   * Destroy service and clean up resources
   */
  async destroy(): Promise<void> {
    this.logger('AdaptiveControlService: Destroying service (all components)');

    // Stop control loop
    if (this.controlLoopInterval !== null) {
      clearInterval(this.controlLoopInterval);
      this.controlLoopInterval = null;
    }

    // CRITICAL: Save optimizer states BEFORE destroying (ensures cost persistence across app restarts)
    try {
      await this.device.setStoreValue('energy_optimizer_state', this.energyOptimizer.getState());
      await this.device.setStoreValue('cop_optimizer_state', this.copOptimizer.getState());
      await this.device.setStoreValue('defrost_learning_state', this.defrostLearner.getState());
      this.logger('AdaptiveControlService: Saved optimizer states before destroy');
    } catch (error) {
      this.device.error('AdaptiveControlService: Error saving optimizer states during destroy:', error);
    }

    // Destroy all sub-services (v2.0.1+: added missing components)
    this.heatingController.destroy();
    this.externalTemperature.destroy();
    await this.buildingModel.destroy(); // Await to persist final building model state
    this.copOptimizer.destroy();
    this.energyOptimizer.destroy();
    this.decisionMaker.destroy();
    await this.windCorrection.destroy(); // v2.7.0+: Persist learned alpha
    this.weatherForecast.destroy(); // v2.8.0+: Stop forecast updates and clear cache
    this.defrostLearner.destroy(); // v2.9.0+: Clear defrost learning history

    this.logger('AdaptiveControlService: Destroyed (all 9 components cleaned up)');
  }

  /**
   * Save energy optimizer state externally (for periodic saves from EnergyTrackingService)
   */
  public async saveEnergyOptimizerState(): Promise<void> {
    await this.device.setStoreValue('energy_optimizer_state', this.energyOptimizer.getState());
  }

  /**
   * Store DPS 4 (target_temperature) value for capability synchronization
   * Called from device.ts when target_temperature capability changes
   * @param value - Current DPS 4 value
   * @version 2.4.9 - Fix: Store DPS 4 to ensure adlar_simulated_target sync on restart
   */
  public async storeDPS4Value(value: number): Promise<void> {
    try {
      await this.device.setStoreValue(this.STORE_KEY_LAST_DPS4, value);
      this.logger('AdaptiveControlService: Stored DPS 4 value', { value: `${value}°C` });
    } catch (error) {
      this.logger('AdaptiveControlService: Failed to store DPS 4 value', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get ExternalTemperatureService instance (for flow card integration)
   */
  public getExternalTemperatureService(): ExternalTemperatureService {
    return this.externalTemperature;
  }

  /**
   * Get BuildingModelService instance (for other components)
   */
  public getBuildingModelService(): BuildingModelService {
    return this.buildingModel;
  }

  /**
   * Get EnergyPriceOptimizer instance
   */
  public getEnergyPriceOptimizer(): EnergyPriceOptimizer {
    return this.energyOptimizer;
  }

  /**
   * Get COPOptimizer instance
   */
  public getCOPOptimizer(): COPOptimizer {
    return this.copOptimizer;
  }

  /**
   * Update weighted priorities (Expert Mode / Settings)
   */
  public updatePriorities(priorities: { comfort: number; efficiency: number; cost: number; thermal?: number }): void {
    this.decisionMaker.setPriorities(priorities);
    this.logger('AdaptiveControlService: Updated priorities', priorities);
  }

  /**
   * Set external energy prices from flow card
   *
   * Accepts hourly energy prices from external sources (e.g., dynamic tariff providers)
   * and forwards them to the EnergyPriceOptimizer.
   *
   * @param pricesObject - Object with hour offsets as keys (0 = current hour) and prices (€/kWh) as values
   * @throws Error if prices object is invalid
   */
  public setExternalEnergyPrices(pricesObject: Record<string, number>): void {
    try {
      this.energyOptimizer.setExternalPrices(pricesObject);
      this.logger(
        'AdaptiveControlService: External energy prices received',
        `(${Object.keys(pricesObject).length} hours)`,
      );
    } catch (error) {
      this.device.error('AdaptiveControlService: Failed to set external energy prices:', error);
      throw error;
    }
  }

  /**
   * Receive and persist external energy prices, then update capabilities immediately
   * Called when flow card provides new price data
   * @param pricesObject - Price data by hour offset
   */
  async receiveExternalPricesData(pricesObject: Record<string, number>): Promise<void> {
    try {
      // Store prices for persistence (survives app restarts)
      await this.device.setStoreValue('external_energy_prices', pricesObject);
      await this.device.setStoreValue('external_energy_prices_timestamp', Date.now());

      this.logger(`AdaptiveControlService: Stored ${Object.keys(pricesObject).length} hourly prices for persistence`);

      // Update capabilities immediately
      await this.updateEnergyPriceCapabilities();
    } catch (error) {
      this.device.error('AdaptiveControlService: Error receiving external prices data:', error);
      throw error;
    }
  }

  /**
   * Update energy price/cost capabilities (Component 3)
   * Called during control cycle when price optimizer is enabled, or immediately after receiving new prices
   */
  private async updateEnergyPriceCapabilities(): Promise<void> {
    try {
      const now = Date.now();
      const nextHourTimestamp = now + 3600000;
      const currentPrice = this.energyOptimizer.getCurrentPrice(now);

      if (!currentPrice) {
        // No price data available yet - cannot update capabilities
        return;
      }

      // Get effective prices (respects priceMode setting: market/market_plus/all_in)
      const effectiveCurrentPrice = this.energyOptimizer.getEffectivePrice(now);
      const effectiveNextPrice = this.energyOptimizer.getEffectivePrice(nextHourTimestamp);

      // Update price capabilities with EFFECTIVE price (includes VAT, fees, tax based on mode)
      await this.device.setCapabilityValue('adlar_energy_price_current',
        Math.round(effectiveCurrentPrice * 10000) / 10000);

      // Category always based on RAW market price (for correct threshold detection)
      // v2.7.8: Emoji prefix removed - enum capabilities require exact enum values without modification
      // The Homey SDK validates enum values and rejects any string that doesn't match the defined enum IDs
      await this.device.setCapabilityValue('adlar_energy_price_category', currentPrice.category);

      // Next hour price (effective)
      if (effectiveNextPrice > 0) {
        await this.device.setCapabilityValue('adlar_energy_price_next',
          Math.round(effectiveNextPrice * 10000) / 10000);
      } else {
        await this.device.setCapabilityValue('adlar_energy_price_next', null);
      }

      // Update forecast capabilities (v2.5.0+)
      if (this.device.hasCapability('adlar_price_forecast_4h')) {
        const forecast4h = this.energyOptimizer.getAveragePrice(now, 4);
        if (forecast4h) {
          await this.device.setCapabilityValue('adlar_price_forecast_4h',
            Math.round(forecast4h.price * 10000) / 10000);
        }
      }

      if (this.device.hasCapability('adlar_price_forecast_24h')) {
        const forecast24h = this.energyOptimizer.getAveragePrice(now, 24);
        if (forecast24h) {
          await this.device.setCapabilityValue('adlar_price_forecast_24h',
            Math.round(forecast24h.price * 10000) / 10000);
        }
      }

      // Update cheapest block start time
      if (this.device.hasCapability('adlar_cheapest_block_start')) {
        const blockHours = (await this.device.getSetting('adaptive_price_block_hours')) || 4;
        const cheapestBlock = this.energyOptimizer.findCheapestBlock(blockHours);
        if (cheapestBlock) {
          const formatTime = (date: Date) => {
            return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          };
          // v2.7.8: Show full block range (e.g., "01:00-05:00") instead of just start time
          await this.device.setCapabilityValue('adlar_cheapest_block_start',
            `${formatTime(cheapestBlock.startTime)}-${formatTime(cheapestBlock.endTime)}`);
        } else {
          await this.device.setCapabilityValue('adlar_cheapest_block_start', 'N/A');
        }
      }

      // Calculate and update daily savings potential
      if (this.device.hasCapability('adlar_price_savings_potential')) {
        const savingsPotential = this.calculateDailySavingsPotential();
        await this.device.setCapabilityValue('adlar_price_savings_potential',
          Math.round(savingsPotential * 100) / 100);
      }

      this.logger(
        `Energy prices updated: Current €${effectiveCurrentPrice.toFixed(4)}/kWh (${currentPrice.category}), `
        + `Next €${effectiveNextPrice > 0 ? effectiveNextPrice.toFixed(4) : 'N/A'}/kWh, Mode: ${this.energyOptimizer.getPriceMode()}`,
      );
    } catch (err) {
      // Use device.error() for exceptions to show ❌ instead of debug 🔍
      this.device.error('Failed to update energy price capabilities:', err);
    }
  }

  /**
   * Check if price category crossed threshold and trigger flow card
   * Implements change detection to prevent duplicate triggers
   */
  private async checkPriceThresholdCrossed(): Promise<void> {
    try {
      const now = Date.now();
      const currentPrice = this.energyOptimizer.getCurrentPrice(now);

      if (!currentPrice) {
        return;
      }

      // Change detection: only trigger when category changes
      if (this.lastPriceCategory !== null && this.lastPriceCategory !== currentPrice.category) {
        const nextHourPrice = this.energyOptimizer.getCurrentPrice(now + 3600000);

        this.logger(
          `Price threshold crossed: ${this.lastPriceCategory} → ${currentPrice.category} `
          + `(€${currentPrice.price.toFixed(4)}/kWh)`,
        );

        await this.device.homey.flow
          .getDeviceTriggerCard('price_threshold_crossed')
          .trigger(this.device, {
            category: currentPrice.category,
            price: currentPrice.price,
            next_hour_price: nextHourPrice?.price || 0,
          })
          .catch((err) => this.logger('Failed to trigger price_threshold_crossed:', err));
      }

      // Update last known category
      this.lastPriceCategory = currentPrice.category;
    } catch (err) {
      this.logger('Failed to check price threshold:', err);
    }
  }

  /**
   * Check if daily cost exceeded user-defined threshold and trigger flow card
   * Rate-limited to prevent spam (max 1 trigger per hour)
   * Resets daily at midnight
   */
  private async checkDailyCostThreshold(): Promise<void> {
    try {
      const now = Date.now();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Reset trigger flag at midnight
      if (now - today.getTime() < this.controlIntervalMs) {
        this.dailyCostThresholdTriggered = false;
      }

      // Rate limiting: max 1 check per hour
      if (now - this.lastDailyCostCheck < 60 * 60 * 1000) {
        return;
      }
      this.lastDailyCostCheck = now;

      // Get daily consumption and calculate cost
      const dailyConsumption = (this.device.getCapabilityValue('adlar_external_energy_daily') as number) || 0;
      if (dailyConsumption === 0) {
        return; // No consumption data available
      }

      const dailyCost = this.energyOptimizer.calculateDailyCost(dailyConsumption);

      // Check against user-defined threshold (default €10)
      const costThreshold = (await this.device.getSetting('daily_cost_threshold')) || 10;

      if (dailyCost > costThreshold && !this.dailyCostThresholdTriggered) {
        this.logger(
          `Daily cost threshold exceeded: €${dailyCost.toFixed(2)} > €${costThreshold} `
          + `(${dailyConsumption.toFixed(1)} kWh consumed)`,
        );

        // Calculate average price today
        const todayPrices = this.energyOptimizer.getPriceData().filter((p) => p.timestamp >= today.getTime());
        const avgPrice = todayPrices.length > 0
          ? todayPrices.reduce((sum, p) => sum + p.price, 0) / todayPrices.length
          : 0;

        await this.device.homey.flow
          .getDeviceTriggerCard('daily_cost_threshold')
          .trigger(
            this.device,
            {
              daily_cost: dailyCost,
              daily_consumption: dailyConsumption,
              average_price: avgPrice,
            },
            { threshold: costThreshold }, // Args for filtering in flow
          )
          .catch((err) => this.logger('Failed to trigger daily_cost_threshold:', err));

        this.dailyCostThresholdTriggered = true; // Prevent retriggering today
      }
    } catch (err) {
      this.logger('Failed to check daily cost threshold:', err);
    }
  }

  /**
   * Calculate daily savings potential using price optimization
   * Conservative estimate based on load shifting opportunities
   *
   * @returns Estimated savings in € per day
   * @since v2.5.0
   */
  private calculateDailySavingsPotential(): number {
    try {
      // Get price statistics (require 6+ hours of data)
      const priceStats = this.energyOptimizer.getPriceStatistics();
      if (!priceStats || priceStats.sampleSize < 6) {
        this.logger('EnergyPriceOptimizer: Insufficient price data for savings calculation');
        return 0;
      }

      // Get daily consumption
      const dailyKWh = (this.device.getCapabilityValue('adlar_external_energy_daily') as number) || 0;
      if (dailyKWh === 0) {
        return 0; // No consumption data
      }

      // Calculate always-on cost (baseline)
      const alwaysOnCost = dailyKWh * priceStats.avg;

      // Conservative assumptions:
      // - Only 20% of load is shiftable (thermal storage, pre-heating)
      // - Shifted load pays 30% less (avg price → cheapest period)
      const shiftableLoad = dailyKWh * 0.20;
      const priceReduction = 0.30; // 30% savings on shifted load

      const optimizedCost = ((dailyKWh - shiftableLoad) * priceStats.avg)
        + (shiftableLoad * priceStats.avg * (1 - priceReduction));

      const savings = alwaysOnCost - optimizedCost;

      // Sanity check: savings must be positive and < 50% of always-on cost
      if (savings < 0 || savings > alwaysOnCost * 0.50) {
        this.logger('EnergyPriceOptimizer: Sanity check failed', {
          savings: `€${savings.toFixed(2)}`,
          alwaysOnCost: `€${alwaysOnCost.toFixed(2)}`,
        });
        return 0;
      }

      this.logger(`EnergyPriceOptimizer: Daily savings potential: €${savings.toFixed(2)} (${dailyKWh.toFixed(1)} kWh × 20% shifted × 30% cheaper)`);
      return savings;
    } catch (error) {
      this.device.error('EnergyPriceOptimizer: Error calculating savings potential:', error);
      return 0;
    }
  }

  /**
   * Detect price blocks and trigger flow cards
   * Checks for cheapest block entry, approaching expensive blocks, and trend changes
   *
   * @since v2.5.0
   */
  private async detectPriceBlocks(): Promise<void> {
    try {
      const now = Date.now();

      // Get block settings
      const blockHours = (await this.device.getSetting('adaptive_price_block_hours')) || 4;
      const warningHours = (await this.device.getSetting('adaptive_price_warning_hours')) || 2;
      const trendHours = (await this.device.getSetting('adaptive_price_trend_hours')) || 6;

      // === 1. Cheapest Block Detection ===
      const cheapestBlock = this.energyOptimizer.findCheapestBlock(blockHours);
      if (cheapestBlock) {
        const blockStart = cheapestBlock.startTime.getTime();
        const blockEnd = cheapestBlock.endTime.getTime();

        // Check if we just entered the cheapest block
        const isInBlock = now >= blockStart && now < blockEnd;
        const isNewBlock = this.lastCheapestBlockStart !== blockStart;

        if (isInBlock && isNewBlock) {
          // Format times as HH:MM
          const formatTime = (date: Date) => {
            return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          };

          this.logger(
            `💰 Cheapest ${blockHours}-hour block started: ${formatTime(cheapestBlock.startTime)} - ${formatTime(cheapestBlock.endTime)} `
            + `(avg €${cheapestBlock.avgPrice.toFixed(4)}/kWh)`,
          );

          // Trigger flow card
          await this.device.homey.flow
            .getDeviceTriggerCard('cheapest_block_started')
            .trigger(
              this.device,
              {
                block_start: formatTime(cheapestBlock.startTime),
                block_end: formatTime(cheapestBlock.endTime),
                avg_price: cheapestBlock.avgPrice,
                hours: blockHours,
              },
            )
            .catch((err) => this.logger('Failed to trigger cheapest_block_started:', err));

          // Update state to prevent duplicate triggers
          this.lastCheapestBlockStart = blockStart;
        }
      }

      // === 2. Expensive Block Warning ===
      const expensiveBlock = this.energyOptimizer.findMostExpensiveBlock(blockHours);
      if (expensiveBlock) {
        const blockStart = expensiveBlock.startTime.getTime();
        const warningTime = blockStart - (warningHours * 3600000);

        // Check if we're in the warning window
        const isWarningTime = now >= warningTime && now < blockStart;
        const isNewWarning = this.lastExpensiveBlockWarning !== blockStart;

        if (isWarningTime && isNewWarning) {
          const formatTime = (date: Date) => {
            return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          };

          this.logger(
            `⚠️ Expensive period approaching: starts at ${formatTime(expensiveBlock.startTime)} `
            + `(avg €${expensiveBlock.avgPrice.toFixed(4)}/kWh)`,
          );

          // Trigger flow card
          await this.device.homey.flow
            .getDeviceTriggerCard('expensive_block_approaching')
            .trigger(
              this.device,
              {
                starts_at: formatTime(expensiveBlock.startTime),
                avg_price: expensiveBlock.avgPrice,
                duration: blockHours,
              },
            )
            .catch((err) => this.logger('Failed to trigger expensive_block_approaching:', err));

          // Update state to prevent duplicate triggers
          this.lastExpensiveBlockWarning = blockStart;
        }
      }

      // === 3. Price Trend Detection ===
      const trendAnalysis = this.energyOptimizer.calculatePriceTrend(trendHours);
      if (trendAnalysis && trendAnalysis.confidence > 0.5) {
        const currentTrend = trendAnalysis.trend;

        // Check if trend changed
        if (this.lastPriceTrend !== null && this.lastPriceTrend !== currentTrend) {
          this.logger(
            `📈 Price trend changed: ${this.lastPriceTrend} → ${currentTrend} `
            + `(confidence: ${(trendAnalysis.confidence * 100).toFixed(0)}%, slope: ${trendAnalysis.slope.toFixed(6)})`,
          );

          // Trigger flow card
          await this.device.homey.flow
            .getDeviceTriggerCard('price_trend_changed')
            .trigger(
              this.device,
              {
                old_trend: this.lastPriceTrend,
                new_trend: currentTrend,
                hours_analyzed: trendHours,
              },
            )
            .catch((err) => this.logger('Failed to trigger price_trend_changed:', err));
        }

        // Update state
        this.lastPriceTrend = currentTrend;
      }
    } catch (error) {
      this.device.error('AdaptiveControlService: Error detecting price blocks:', error);
    }
  }
}
