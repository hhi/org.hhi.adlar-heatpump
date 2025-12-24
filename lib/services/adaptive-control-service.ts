/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';
import { HeatingController, SensorData } from '../adaptive/heating-controller';
import { ExternalTemperatureService } from './external-temperature-service';
import { BuildingModelService } from './building-model-service';
import { EnergyPriceOptimizer } from '../adaptive/energy-price-optimizer';
import { COPOptimizer } from '../adaptive/cop-optimizer';
import { WeightedDecisionMaker } from '../adaptive/weighted-decision-maker';
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

  // Control loop state
  private controlLoopInterval: NodeJS.Timeout | null = null;
  private isEnabled = false;
  private isMonitoringMode = true; // Start in monitoring mode for safety
  private lastControlCycleTime: number = 0;
  private lastAdjustmentTime: number = 0; // Last time target_temperature was adjusted (throttling)
  private controlIntervalMs: number = 5 * 60 * 1000; // 5 minutes default
  private accumulatedAdjustment: number = 0; // Accumulates fractional adjustments until ≥0.5°C (for step:1 rounding)

  // Energy price tracking (for change detection and flow card triggers)
  private lastPriceCategory: string | null = null; // Track category changes
  private lastDailyCostCheck: number = 0; // Rate limit daily cost checks
  private dailyCostThresholdTriggered = false; // Reset daily at midnight

  // Persistence keys
  private readonly STORE_KEY_PI_HISTORY = 'adaptive_pi_history';
  private readonly STORE_KEY_LAST_ACTION = 'adaptive_last_action';
  private readonly STORE_KEY_LAST_ADJUSTMENT = 'adaptive_last_adjustment_time';
  private readonly STORE_KEY_ENABLED = 'adaptive_control_enabled';
  private readonly STORE_KEY_ACCUMULATED_ADJUSTMENT = 'adaptive_accumulated_adjustment';

  /**
   * @param config.device - Owning Homey device
   * @param config.logger - Logger callback
   */
  constructor(config: AdaptiveControlServiceConfig) {
    this.device = config.device;
    this.logger = config.logger || (() => {});

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
      logger: this.logger,
    });

    // Initialize Component 3: Energy Price Optimizer
    this.energyOptimizer = new EnergyPriceOptimizer({
      apiUrl: 'https://api.energyzero.nl/v1/energyprices',
      updateIntervalHours: 1,
      thresholds: {
        veryLow: 0.10,
        low: 0.15,
        normal: 0.25,
        high: 0.35,
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
    });

    // Initialize Integration: Weighted Decision Maker
    this.decisionMaker = new WeightedDecisionMaker({
      comfort: 0.60,
      efficiency: 0.25,
      cost: 0.15,
    });

    this.logger('AdaptiveControlService: Initialized with all 4 components');
  }

  /**
   * Initialize adaptive control service
   * Called after ServiceCoordinator initialization
   */
  async initialize(): Promise<void> {
    this.logger('AdaptiveControlService: Starting initialization');

    try {
      // Restore enabled state from device store
      const savedEnabled = await this.device.getStoreValue(this.STORE_KEY_ENABLED);
      if (typeof savedEnabled === 'boolean') {
        this.isEnabled = savedEnabled;
        this.logger('AdaptiveControlService: Restored enabled state', { enabled: this.isEnabled });
      }

      // Restore monitoring mode state
      const savedMonitoringMode = await this.device.getStoreValue('monitoring_mode_enabled');
      if (typeof savedMonitoringMode === 'boolean') {
        this.isMonitoringMode = savedMonitoringMode;
        this.logger('AdaptiveControlService: Restored monitoring mode', { monitoring: this.isMonitoringMode });
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

      // Initialize Component 2: Building Model Service
      await this.buildingModel.initialize();

      // Restore Component 3: Energy Price Optimizer state
      const energyState = await this.device.getStoreValue('energy_optimizer_state');
      if (energyState) {
        this.energyOptimizer.restoreState(energyState);
      }

      // Fetch initial energy prices (non-blocking) - only if price optimizer is enabled
      const priceOptimizerEnabled = await this.device.getSetting('price_optimizer_enabled');
      if (priceOptimizerEnabled) {
        this.energyOptimizer.updatePrices().catch((err) => this.logger('Initial price fetch failed:', err));
      }

      // Restore Component 4: COP Optimizer state
      const copState = await this.device.getStoreValue('cop_optimizer_state');
      if (copState) {
        this.copOptimizer.restoreState(copState);
      }

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

    // Start control loop using Homey timer management
    this.controlLoopInterval = this.device.homey.setInterval(
      async () => {
        await this.executeControlCycle();
      },
      this.controlIntervalMs,
    );

    // Execute first cycle immediately
    await this.executeControlCycle();

    // Emit status change trigger
    await this.triggerStatusChange('enabled', 'Adaptive temperature control enabled');

    this.logger('AdaptiveControlService: Started', {
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

    this.isEnabled = false;
    await this.device.setStoreValue(this.STORE_KEY_ENABLED, false);

    // Save PI history before stopping
    await this.savePIHistory();

    // Emit status change trigger
    await this.triggerStatusChange('disabled', 'Adaptive temperature control disabled');

    this.logger('AdaptiveControlService: Stopped');
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

      // Step 3: Read current target temperature from device
      const targetTemp = this.device.getCapabilityValue('target_temperature') as number | null;
      if (targetTemp === null) {
        this.logger('AdaptiveControlService: No target temperature available, skipping cycle');
        return;
      }

      this.logger(`Indoor: ${indoorTemp.toFixed(1)}°C, Target: ${targetTemp.toFixed(1)}°C`);

      // Step 4A: Component 1 - Heating Controller (PI control)
      const sensorData: SensorData = {
        indoorTemp,
        targetTemp,
        timestamp: Date.now(),
      };

      const heatingAction = await this.heatingController.calculateAction(sensorData);

      // Step 4B: Component 3 - Energy Price Optimizer (if enabled)
      let priceAction = null;
      const priceOptimizerEnabled = await this.device.getSetting('price_optimizer_enabled');
      if (priceOptimizerEnabled) {
        try {
          priceAction = this.energyOptimizer.calculateAction(indoorTemp, targetTemp);

          // Update energy price/cost capabilities
          await this.updateEnergyPriceCapabilities();

          // Check and trigger flow cards
          await this.checkPriceThresholdCrossed();
          await this.checkDailyCostThreshold();
        } catch (err) {
          this.logger('Energy optimizer failed:', err);
        }
      }

      // Step 4C: Component 4 - COP Optimizer (if enabled)
      let copAction = null;
      const copOptimizerEnabled = await this.device.getSetting('cop_optimizer_enabled');
      if (copOptimizerEnabled) {
        try {
          const currentCOP = (this.device.getCapabilityValue('adlar_cop') as number) || 0;
          const dailyCOP = (this.device.getCapabilityValue('adlar_cop_daily') as number) || 0;
          // Get outdoor temperature with priority fallback (v2.0.2): external sensor → heat pump sensor
          // @ts-expect-error - Accessing MyDevice.getOutdoorTemperatureWithFallback() (not in Homey.Device base type)
          const outdoorTemp = this.device.getOutdoorTemperatureWithFallback() || 0;

          copAction = this.copOptimizer.calculateAction(currentCOP, dailyCOP, outdoorTemp, targetTemp);

          // Collect COP measurement for learning
          const compressorFreq = (this.device.getCapabilityValue('measure_frequency.compressor_strength') as number) || 0;
          if (currentCOP > 0 && compressorFreq > 0) {
            this.copOptimizer.addMeasurement({
              timestamp: Date.now(),
              outdoorTemp,
              supplyTemp: targetTemp,
              cop: currentCOP,
              compressorFreq,
            });
          }
        } catch (err) {
          this.logger('COP optimizer failed:', err);
        }
      }

      // Step 5: Combine actions using Weighted Decision Maker
      const combinedAction = this.decisionMaker.combineActions(
        heatingAction,
        copAction,
        priceAction,
      );

      // Step 6: Log combined decision
      this.logger(
        `Breakdown: Comfort=${combinedAction.breakdown.comfort.toFixed(2)}°C, `
        + `Efficiency=${combinedAction.breakdown.efficiency.toFixed(2)}°C, `
        + `Cost=${combinedAction.breakdown.cost.toFixed(2)}°C`,
      );
      this.logger(`Final Adjustment: ${combinedAction.finalAdjustment.toFixed(2)}°C (${combinedAction.priority} priority)`);
      combinedAction.reasoning.forEach((reason) => this.logger(`  - ${reason}`));

      // Step 7: Check monitoring mode
      if (this.isMonitoringMode) {
        this.logger('⚠️ MONITORING MODE: Action logged but NOT executed');

        // Trigger monitoring flow card
        await this.device.homey.flow
          .getDeviceTriggerCard('adaptive_monitoring_log')
          .trigger(this.device, {
            adjustment: combinedAction.finalAdjustment,
            comfort_component: combinedAction.breakdown.comfort,
            efficiency_component: combinedAction.breakdown.efficiency,
            cost_component: combinedAction.breakdown.cost,
            reasoning: combinedAction.reasoning.join('; '),
          })
          .catch((err) => this.logger('Failed to trigger monitoring card:', err));

        this.lastControlCycleTime = Date.now();
        return;
      }

      // Step 8: Active mode - check execution mode setting
      if (heatingAction === null && Math.abs(combinedAction.finalAdjustment) < 0.1) {
        this.logger('AdaptiveControlService: No significant action needed');
        this.lastControlCycleTime = Date.now();
        return;
      }

      // Step 8a: Check adaptive control execution mode
      const executionMode = await this.device.getSetting('adaptive_control_mode');

      if (executionMode === DeviceConstants.ADAPTIVE_MODE_FLOW_ASSISTED) {
        this.logger('⚙️ FLOW-ASSISTED MODE: Triggering recommendation for user flow execution');

        // Calculate recommended temperature (integer adjusted, clamped)
        const integerAdjustment = Math.round(this.accumulatedAdjustment + combinedAction.finalAdjustment);
        const recommendedTemp = Math.max(15, Math.min(28, targetTemp + integerAdjustment));

        // Trigger recommendation flow card
        await this.triggerTemperatureRecommendation(targetTemp, recommendedTemp, combinedAction);

        this.lastControlCycleTime = Date.now();
        return;
      }

      // Step 9: Automatic mode - accumulate fractional adjustment (for step:1 rounding)
      // target_temperature uses step:1, but weighted decision maker calculates fractional adjustments
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

      // Step 5c: Throttling check - minimum 20 minutes between actual adjustments
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

      // Step 6: Calculate new target temperature with integer adjustment
      const newTargetTemp = targetTemp + integerAdjustment;

      // Safety: clamp target temperature to reasonable range (15-28°C)
      const clampedTargetTemp = Math.max(15, Math.min(28, newTargetTemp));

      // Calculate actual applied adjustment (may differ if clamped)
      const actualAdjustment = clampedTargetTemp - targetTemp;

      this.logger('AdaptiveControlService: Applying integer temperature adjustment', {
        currentTarget: targetTemp,
        integerAdjustment,
        actualAdjustment,
        newTarget: clampedTargetTemp,
        accumulated: this.accumulatedAdjustment.toFixed(2),
        reasoning: combinedAction.reasoning.join('; '),
        priority: combinedAction.priority,
      });

      // Update target_temperature capability (step:1 compatible)
      await this.device.setCapabilityValue('target_temperature', clampedTargetTemp);

      // Subtract applied adjustment from accumulator
      this.accumulatedAdjustment -= actualAdjustment;

      this.logger('AdaptiveControlService: Accumulator updated after application', {
        appliedAdjustment: actualAdjustment,
        remainingAccumulated: this.accumulatedAdjustment.toFixed(2),
      });

      // Step 10: Emit flow card trigger (with actual applied adjustment)
      await this.triggerTemperatureAdjusted(targetTemp, clampedTargetTemp, combinedAction);

      // Step 11: Save state for all components
      await this.savePIHistory();
      await this.device.setStoreValue(this.STORE_KEY_LAST_ACTION, Date.now());
      await this.device.setStoreValue(this.STORE_KEY_ACCUMULATED_ADJUSTMENT, this.accumulatedAdjustment);

      // Persist optimizer states
      await this.device.setStoreValue('energy_optimizer_state', this.energyOptimizer.getState());
      await this.device.setStoreValue('cop_optimizer_state', this.copOptimizer.getState());

      // Update and persist last adjustment timestamp (throttling)
      this.lastAdjustmentTime = Date.now();
      await this.device.setStoreValue(this.STORE_KEY_LAST_ADJUSTMENT, this.lastAdjustmentTime);

      this.lastControlCycleTime = Date.now();

      this.logger('AdaptiveControlService: Control cycle completed successfully (all components)');

    } catch (error) {
      this.logger('AdaptiveControlService: Control cycle error', {
        error: (error as Error).message,
      });
    }
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
   * Trigger: target_temperature_adjusted
   * Fired when adaptive control adjusts the target temperature
   */
  private async triggerTemperatureAdjusted(
    oldTemp: number,
    newTemp: number,
    combinedAction: { finalAdjustment: number; reasoning: string[]; priority: string },
  ): Promise<void> {
    try {
      const trigger = this.device.homey.flow.getTriggerCard('target_temperature_adjusted');
      await trigger.trigger(this.device, {
        old_temperature: oldTemp,
        new_temperature: newTemp,
        adjustment: combinedAction.finalAdjustment,
        reason: combinedAction.reasoning.join('; '),
        controller: 'weighted', // All 4 components combined
      });
      this.logger('AdaptiveControlService: Triggered target_temperature_adjusted flow card');
    } catch (error) {
      this.logger('AdaptiveControlService: Failed to trigger target_temperature_adjusted', {
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
      const trigger = this.device.homey.flow.getTriggerCard('adaptive_status_change');
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
   */
  private async triggerTemperatureRecommendation(
    currentTemp: number,
    recommendedTemp: number,
    combinedAction: { finalAdjustment: number; reasoning: string[]; priority: string },
  ): Promise<void> {
    try {
      const trigger = this.device.homey.flow.getTriggerCard('temperature_adjustment_recommended');
      await trigger.trigger(this.device, {
        current_temperature: currentTemp,
        recommended_temperature: recommendedTemp,
        adjustment: combinedAction.finalAdjustment,
        reason: combinedAction.reasoning.join('; '),
        controller: 'weighted', // All 4 components combined
      });
      this.logger('AdaptiveControlService: Triggered temperature_adjustment_recommended flow card');
    } catch (error) {
      this.logger('AdaptiveControlService: Failed to trigger temperature_adjustment_recommended', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Receive external indoor temperature (called by flow card handler)
   */
  async receiveExternalTemperature(temperature: number): Promise<void> {
    await this.externalTemperature.receiveExternalTemperature(temperature);
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
        await this.start();
      } else if (!enabled && this.isEnabled) {
        await this.stop();
      }
    }

    // Handle PI parameter changes (Expert Mode)
    if (changedKeys.includes('adaptive_pi_kp') || changedKeys.includes('adaptive_pi_ki') || changedKeys.includes('adaptive_pi_deadband')) {
      const Kp = newSettings.adaptive_pi_kp as number || 3.0;
      const Ki = newSettings.adaptive_pi_ki as number || 1.5;
      const deadband = newSettings.adaptive_pi_deadband as number || 0.3;
      this.updatePIParameters(Kp, Ki, deadband);
    }
  }

  /**
   * Destroy service and clean up resources
   */
  destroy(): void {
    this.logger('AdaptiveControlService: Destroying service (all components)');

    // Stop control loop
    if (this.controlLoopInterval !== null) {
      clearInterval(this.controlLoopInterval);
      this.controlLoopInterval = null;
    }

    // Destroy all sub-services (v2.0.1+: added missing components)
    this.heatingController.destroy();
    this.externalTemperature.destroy();
    this.buildingModel.destroy();
    this.copOptimizer.destroy();
    this.energyOptimizer.destroy();
    this.decisionMaker.destroy();

    this.logger('AdaptiveControlService: Destroyed (all 6 components cleaned up)');
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
  public updatePriorities(priorities: { comfort: number; efficiency: number; cost: number }): void {
    this.decisionMaker.setPriorities(priorities);
    this.logger('AdaptiveControlService: Updated priorities', priorities);
  }

  /**
   * Update energy price/cost capabilities (Component 3)
   * Called during control cycle when price optimizer is enabled
   */
  private async updateEnergyPriceCapabilities(): Promise<void> {
    try {
      const now = Date.now();
      const currentPrice = this.energyOptimizer.getCurrentPrice(now);
      const nextHourPrice = this.energyOptimizer.getAveragePrice(now + 3600000, 1); // Next hour

      if (currentPrice) {
        // Update price capabilities
        await this.device.setCapabilityValue('adlar_energy_price_current', currentPrice.price);
        await this.device.setCapabilityValue('adlar_energy_price_category', currentPrice.category);

        if (nextHourPrice) {
          await this.device.setCapabilityValue('adlar_energy_price_next', nextHourPrice.price);
        }

        // Update cost capabilities
        const currentPowerWatts = (this.device.getCapabilityValue('measure_power') as number) || 0;
        const hourlyCost = this.energyOptimizer.calculateCurrentCost(currentPowerWatts);
        await this.device.setCapabilityValue('adlar_energy_cost_hourly', hourlyCost);

        // Calculate daily cost (requires daily consumption capability)
        const dailyConsumption = (this.device.getCapabilityValue('adlar_external_energy_daily') as number) || 0;
        if (dailyConsumption > 0) {
          const dailyCost = this.energyOptimizer.calculateDailyCost(dailyConsumption);
          await this.device.setCapabilityValue('adlar_energy_cost_daily', dailyCost);
        }

        this.logger(
          `Energy prices updated: Current €${currentPrice.price.toFixed(3)}/kWh (${currentPrice.category}), `
          + `Hourly cost €${hourlyCost.toFixed(2)}/h`,
        );
      }
    } catch (err) {
      this.logger('Failed to update energy price capabilities:', err);
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
        const nextHourPrice = this.energyOptimizer.getAveragePrice(now + 3600000, 1);

        this.logger(
          `Price threshold crossed: ${this.lastPriceCategory} → ${currentPrice.category} `
          + `(€${currentPrice.price.toFixed(3)}/kWh)`,
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
}
