/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';
import { DeviceConstants } from '../constants';

export interface EnergyTrackingOptions {
  device: Homey.Device;
  logger?: (message: string, ...args: unknown[]) => void;
}

export interface PowerMeasurement {
  value: number;
  source: 'external' | 'internal' | 'calculated';
  confidence: 'high' | 'medium' | 'low';
  timestamp: number;
}

export class EnergyTrackingService {
  private device: Homey.Device;
  private logger: (message: string, ...args: unknown[]) => void;
  private energyTrackingInterval: NodeJS.Timeout | null = null;
  private dailyResetTimeout: NodeJS.Timeout | null = null;
  private dailyResetInterval: NodeJS.Timeout | null = null;
  private lastExternalPowerUpdate: number = 0;
  private lastEnergyCalculation: number = 0;
  private isEnabled = false;

  // Overlap protection guard (v1.0.2)
  private energyCalculationInProgress = false;

  // Power threshold monitoring (v1.0.7 - power_threshold_exceeded trigger)
  private powerAboveThreshold = false;
  private lastPowerThresholdTrigger = 0;
  private readonly POWER_THRESHOLD_HYSTERESIS = 0.05; // 5% hysteresis
  private readonly POWER_THRESHOLD_RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * EnergyTrackingService tracks energy/power measurements, updates power-related capabilities,
   * and maintains daily/cumulative energy totals.
   * @param options.device - The Homey device that owns this service.
   * @param options.logger - Optional logger function.
   */
  constructor(options: EnergyTrackingOptions) {
    this.device = options.device;
    this.logger = options.logger || (() => {});
  }

  /**
   * Calculate and return the most reliable power measurement using:
   * 1) external flow card value (`adlar_external_power`),
   * 2) internal DPS-based measurement,
   * 3) calculated estimation.
   * Returns null if tracking is disabled.
   */
  async updateIntelligentPowerMeasurement(): Promise<PowerMeasurement | null> {
    if (!this.isEnabled) {
      return null;
    }

    try {
      let powerValue: number | null = null;
      let powerSource: 'external' | 'internal' | 'calculated' = 'calculated';
      let confidence: 'high' | 'medium' | 'low' = 'low';

      // Priority 1: External power measurement (from flow cards)
      const externalPower = this.device.getCapabilityValue('adlar_external_power');
      if (externalPower !== null && externalPower > 0) {
        powerValue = externalPower;
        powerSource = 'external';
        confidence = 'high';
      }

      // Priority 2: Internal power measurement (DPS 104)
      if (powerValue === null) {
        const internalPower = await this.getInternalPowerMeasurement();
        if (internalPower !== null && internalPower > 0) {
          powerValue = internalPower;
          powerSource = 'internal';
          confidence = 'high';
        }
      }

      // Priority 3: Calculated estimation based on system state
      if (powerValue === null) {
        powerValue = this.calculateEstimatedPower();
        powerSource = 'calculated';
        confidence = 'medium';
      }

      const measurement: PowerMeasurement = {
        value: powerValue || 0,
        source: powerSource,
        confidence,
        timestamp: Date.now(),
      };

      // Update measure_power capability with the selected power source
      if (powerValue !== null && this.device.hasCapability('measure_power')) {
        await this.device.setCapabilityValue('measure_power', Math.round(powerValue));
        this.logger(`EnergyTrackingService: Power updated: ${Math.round(powerValue)}W (source: ${powerSource}, confidence: ${confidence})`);

        // Check power threshold for trigger (v1.0.7 - power_threshold_exceeded)
        await this.checkPowerThreshold(powerValue);

        // Update cumulative energy based on the new power measurement
        await this.updateCumulativeEnergy();
      }

      return measurement;

    } catch (error) {
      this.logger('EnergyTrackingService: Error in intelligent power measurement update:', error);
      return null;
    }
  }

  /**
   * Get internal power measurement from DPS 104 via device capability.
   * Note: Direct TuyAPI access removed - now uses device capabilities only.
   */
  private getInternalPowerMeasurement(): number | null {
    try {
      // Access internal power through device capability if available
      // This avoids direct TuyAPI dependency and uses proper device abstraction
      const internalPower = this.device.getCapabilityValue('measure_power.internal');
      if (typeof internalPower === 'number' && internalPower > 0) {
        return internalPower;
      }
    } catch (error) {
      this.logger('Could not access internal power capability:', error);
    }

    // Fallback: Return null to trigger calculated estimation
    return null;
  }

  /**
   * Estimate the current power use based on system state (compressor, flow, temperatures).
   * Used as a fallback when direct measurement is unavailable.
   */
  private calculateEstimatedPower(): number {
    try {
      const compressorRunning = this.device.getCapabilityValue('adlar_state_compressor_state');
      const compressorFreq = this.device.getCapabilityValue('measure_frequency.compressor_strength') || 0;
      const fanFreq = this.device.getCapabilityValue('measure_frequency.fan_motor_frequency') || 0;
      const defrosting = this.device.getCapabilityValue('adlar_state_defrost_state');

      // Base standby power
      let estimatedPower = 150;

      if (compressorRunning) {
        // Compressor power estimation based on frequency
        // Typical heat pump: 15-80Hz = 800-4000W
        const normalizedFreq = Math.max(0, Math.min(1, (compressorFreq - 15) / 65));
        const compressorPower = 800 + (normalizedFreq * 3200);
        estimatedPower += compressorPower;

        // Fan motor contribution
        const fanPower = (fanFreq / 100) * 200; // 0-200W based on fan speed
        estimatedPower += fanPower;

        // Defrost mode adds extra power
        if (defrosting) {
          estimatedPower += 500;
        }
      }

      this.logger(`EnergyTrackingService: Estimated power: ${Math.round(estimatedPower)}W (compressor: ${compressorRunning}, freq: ${compressorFreq}Hz)`);
      return Math.round(estimatedPower);

    } catch (error) {
      this.logger('EnergyTrackingService: Error calculating estimated power, using default:', error);
      return 2500; // Default average consumption
    }
  }

  /**
   * Initialize persistent values used for tracking (store values, last update times).
   */
  private async initializeEnergyTracking(): Promise<void> {
    try {
      // Initialize energy tracking timestamp if not exists
      const lastUpdate = await this.device.getStoreValue('last_energy_update');
      if (!lastUpdate) {
        await this.device.setStoreValue('last_energy_update', Date.now());
        this.logger('EnergyTrackingService: Energy tracking initialized');
      }

      // Initialize external energy tracking timestamp if not exists
      const lastExternalUpdate = await this.device.getStoreValue('last_external_energy_update');
      if (!lastExternalUpdate) {
        await this.device.setStoreValue('last_external_energy_update', Date.now());
        this.logger('EnergyTrackingService: External energy tracking initialized');
      }

      // Initialize cumulative energy if meter capabilities are zero/null
      if (this.device.hasCapability('meter_power.electric_total')) {
        const currentTotal = this.device.getCapabilityValue('meter_power.electric_total');
        if (!currentTotal || currentTotal === 0) {
          // Check if we have stored cumulative energy from previous sessions
          const storedTotal = await this.device.getStoreValue('cumulative_energy_kwh') || 0;
          if (storedTotal > 0) {
            await this.device.setCapabilityValue('meter_power.electric_total', storedTotal);
            this.logger(`EnergyTrackingService: Restored cumulative energy: ${storedTotal} kWh`);
          }
        }
      }

      // Initialize external energy tracking capability
      if (this.device.hasCapability('adlar_external_energy_total')) {
        const currentExternalTotal = this.device.getCapabilityValue('adlar_external_energy_total');
        if (!currentExternalTotal || currentExternalTotal === 0) {
          // Check if we have stored external energy from previous sessions
          const storedExternalTotal = await this.device.getStoreValue('external_cumulative_energy_kwh') || 0;
          if (storedExternalTotal > 0) {
            await this.device.setCapabilityValue('adlar_external_energy_total', storedExternalTotal);
            this.logger(`EnergyTrackingService: Restored external energy: ${storedExternalTotal} kWh`);
          }
        }
      }

      // Initialize external daily energy tracking capability
      if (this.device.hasCapability('adlar_external_energy_daily')) {
        const currentExternalDaily = this.device.getCapabilityValue('adlar_external_energy_daily');
        if (!currentExternalDaily || currentExternalDaily === 0) {
          // Check if we have stored external daily energy from previous sessions
          const storedExternalDaily = await this.device.getStoreValue('external_daily_consumption_kwh') || 0;
          if (storedExternalDaily > 0) {
            await this.device.setCapabilityValue('adlar_external_energy_daily', storedExternalDaily);
            this.logger(`EnergyTrackingService: Restored external daily energy: ${storedExternalDaily} kWh`);
          }
        }
      }

    } catch (error) {
      this.logger('EnergyTrackingService: Error initializing energy tracking:', error);
    }
  }

  /**
   * Update cumulative energy totals (daily/total) based on new power measurement(s).
   * Protected against overlapping executions (v1.0.2)
   */
  private async updateCumulativeEnergy(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    // Prevent overlapping executions (v1.0.2 - fixes queue buildup)
    if (this.energyCalculationInProgress) {
      this.logger('EnergyTrackingService: Skipping update - calculation already in progress');
      return;
    }

    this.energyCalculationInProgress = true;

    try {
      const currentPower = this.device.getCapabilityValue('measure_power') || 0;
      const externalPower = this.device.getCapabilityValue('adlar_external_power') || 0;

      const lastUpdate = await this.device.getStoreValue('last_energy_update') || Date.now();
      const currentTime = Date.now();
      const hoursElapsed = (currentTime - lastUpdate) / (1000 * 60 * 60);

      // Only accumulate internal energy when we have reliable internal power data
      if (currentPower > 0) {
        // Calculate energy increment in kWh
        const energyIncrement = (currentPower / 1000) * hoursElapsed;

        // Update total cumulative energy
        if (this.device.hasCapability('meter_power.electric_total')) {
          const currentTotal = this.device.getCapabilityValue('meter_power.electric_total') || 0;
          const newTotal = currentTotal + energyIncrement;
          await this.device.setCapabilityValue('meter_power.electric_total', Math.round(newTotal * 100) / 100);

          // Store in device storage for persistence
          await this.device.setStoreValue('cumulative_energy_kwh', newTotal);

          // Check for energy milestones (v1.0.7 - total_consumption_milestone trigger)
          await this.checkEnergyMilestones(newTotal);
        }

        // Update daily consumption
        if (this.device.hasCapability('meter_power.power_consumption')) {
          const dailyConsumption = await this.device.getStoreValue('daily_consumption_kwh') || 0;
          const newDailyTotal = dailyConsumption + energyIncrement;
          await this.device.setCapabilityValue('meter_power.power_consumption', Math.round(newDailyTotal * 100) / 100);
          await this.device.setStoreValue('daily_consumption_kwh', newDailyTotal);
        }

        this.logger(`EnergyTrackingService: Energy updated: +${(energyIncrement * 1000).toFixed(1)}Wh (power: ${currentPower}W, time: ${(hoursElapsed * 60).toFixed(1)}min)`);
      }

      // Track external energy separately when external power is being used
      await this.updateExternalEnergy(externalPower, currentTime);

      // Update timestamp for next calculation
      if (currentPower > 0 || externalPower > 0) {
        await this.device.setStoreValue('last_energy_update', currentTime);
      }

    } catch (error) {
      this.logger('EnergyTrackingService: Error updating cumulative energy:', error);
    } finally {
      // Always release guard (v1.0.2)
      this.energyCalculationInProgress = false;
    }
  }

  /**
   * Update external energy counters using the provided external power and elapsed time.
   * Stores updates to device capabilities `adlar_external_energy_total` / `adlar_external_energy_daily`.
   * @param externalPower - external power in Watts
   * @param currentTime - current timestamp (ms)
   */
  private async updateExternalEnergy(externalPower: number, currentTime: number): Promise<void> {
    const lastExternalUpdate = await this.device.getStoreValue('last_external_energy_update') || (currentTime - 10000);
    const externalHoursElapsed = (currentTime - lastExternalUpdate) / (1000 * 60 * 60);

    this.logger(`EnergyTrackingService: External energy check: power=${externalPower}W, `
      + `hasCapability=${this.device.hasCapability('adlar_external_energy_total')}, `
      + `externalHoursElapsed=${externalHoursElapsed.toFixed(6)}h`);

    if (externalPower > 0 && this.device.hasCapability('adlar_external_energy_total')) {
      // Check if this is the first external energy update
      const isFirstExternalUpdate = !(await this.device.getStoreValue('last_external_energy_update'));

      // Use a small threshold for frequent updates (minimum 3.6 seconds OR first update)
      if (externalHoursElapsed > 0.001 || isFirstExternalUpdate) {
        // For first update, use minimum time increment to avoid zero energy calculation
        const effectiveHoursElapsed = isFirstExternalUpdate ? 0.002778 : externalHoursElapsed; // 10 seconds minimum

        const externalEnergyIncrement = (externalPower / 1000) * effectiveHoursElapsed;
        const currentExternalTotal = this.device.getCapabilityValue('adlar_external_energy_total') || 0;
        const newExternalTotal = currentExternalTotal + externalEnergyIncrement;
        await this.device.setCapabilityValue('adlar_external_energy_total', Math.round(newExternalTotal * 1000) / 1000);

        // Also update external daily energy consumption
        if (this.device.hasCapability('adlar_external_energy_daily')) {
          const currentExternalDaily = this.device.getCapabilityValue('adlar_external_energy_daily') || 0;
          const newExternalDaily = currentExternalDaily + externalEnergyIncrement;
          const roundedDaily = Math.round(newExternalDaily * 1000000) / 1000000;
          await this.device.setCapabilityValue('adlar_external_energy_daily', roundedDaily);

          // Store external daily energy for persistence and reset functionality
          await this.device.setStoreValue('external_daily_consumption_kwh', newExternalDaily);
        }

        // Store external energy in device storage for persistence
        await this.device.setStoreValue('external_cumulative_energy_kwh', newExternalTotal);
        // Update external energy timestamp
        await this.device.setStoreValue('last_external_energy_update', currentTime);

        this.logger(`EnergyTrackingService: External energy updated: +${(externalEnergyIncrement * 1000).toFixed(1)}Wh `
          + `(external power: ${externalPower}W, time: ${(effectiveHoursElapsed * 60).toFixed(2)}min, `
          + `total: ${newExternalTotal.toFixed(3)}kWh)${isFirstExternalUpdate ? ' [FIRST UPDATE]' : ''}`);
      }
    }
  }

  /**
   * Start the frequent energy tracking interval (e.g. every 30s).
   * Uses Homey timers and stores the interval reference for later clearing.
   */
  private startEnergyTrackingInterval(): void {
    // Start frequent energy tracking interval (every 30 seconds)
    this.energyTrackingInterval = this.device.homey.setInterval(() => {
      this.updateCumulativeEnergy().catch((error) => {
        this.logger('EnergyTrackingService: Error in energy tracking interval:', error);
      });
    }, DeviceConstants.ENERGY_TRACKING_INTERVAL_MS);

    this.logger('EnergyTrackingService: Started energy tracking interval');
  }

  /**
   * Stop the energy tracking interval if running.
   */
  private stopEnergyTrackingInterval(): void {
    if (this.energyTrackingInterval) {
      clearInterval(this.energyTrackingInterval);
      this.energyTrackingInterval = null;
      this.logger('EnergyTrackingService: Stopped energy tracking interval');
    }
  }

  /**
   * Receive and process external power data pushed via flow/action cards.
   * Updates the external-power capability and triggers energy recalculation.
   * @param powerValue - power in Watts
   */
  async receiveExternalPowerData(powerValue: number): Promise<void> {
    try {
      if (this.device.hasCapability('adlar_external_power')) {
        await this.device.setCapabilityValue('adlar_external_power', powerValue);
        this.logger(`EnergyTrackingService: External power data received: ${powerValue}W`);

        // Trigger immediate power measurement update
        await this.updateIntelligentPowerMeasurement();
      }
    } catch (error) {
      this.logger('EnergyTrackingService: Error receiving external power data:', error);
    }
  }

  /**
   * Run once initialization for the EnergyTrackingService (non-scheduled setup).
   */
  async initialize(): Promise<void> {
    this.logger('EnergyTrackingService: Initializing energy tracking service');
    // Start energy tracking updates
    await this.updateIntelligentPowerMeasurement();
    this.logger('EnergyTrackingService: Energy tracking service initialized');
  }

  /**
   * Check if power exceeds user-defined threshold and trigger flow card (v1.0.7)
   * Implements hysteresis and rate limiting to prevent trigger spam
   * @param currentPower - Current power consumption in watts
   */
  private async checkPowerThreshold(currentPower: number): Promise<void> {
    try {
      // Get user-defined threshold from settings (default 3000W)
      const userThreshold = (this.device.getSetting('power_threshold_watts') as number) || 3000;
      const now = Date.now();

      // Hysteresis calculation: 5% below threshold = reset state
      const thresholdReset = userThreshold * (1 - this.POWER_THRESHOLD_HYSTERESIS);
      const isAboveThreshold = currentPower > userThreshold;
      const isBelowReset = currentPower < thresholdReset;

      // Check if we should trigger (crossing threshold upward)
      if (isAboveThreshold && !this.powerAboveThreshold) {
        // Rate limiting: max 1 trigger per 5 minutes
        if (now - this.lastPowerThresholdTrigger > this.POWER_THRESHOLD_RATE_LIMIT_MS) {
          // Trigger the flow card
          try {
            const triggerCard = this.device.homey.flow.getDeviceTriggerCard('power_threshold_exceeded');
            await triggerCard.trigger(this.device, {
              current_power: Math.round(currentPower),
              threshold_power: userThreshold,
            }, {});

            this.logger(`EnergyTrackingService: ⚡ Power threshold exceeded: ${Math.round(currentPower)}W > ${userThreshold}W`);
            this.lastPowerThresholdTrigger = now;
          } catch (err) {
            this.logger('EnergyTrackingService: Failed to trigger power_threshold_exceeded:', err);
          }
        } else {
          this.logger(`EnergyTrackingService: Power threshold exceeded but rate limited (${Math.round((now - this.lastPowerThresholdTrigger) / 1000)}s since last trigger)`);
        }

        this.powerAboveThreshold = true;
      } else if (isBelowReset && this.powerAboveThreshold) {
        // Reset state when power drops below hysteresis threshold
        this.powerAboveThreshold = false;
        this.logger(`EnergyTrackingService: Power below reset threshold: ${Math.round(currentPower)}W < ${Math.round(thresholdReset)}W`);
      }
    } catch (error) {
      this.logger('EnergyTrackingService: Error in power threshold check:', error);
    }
  }

  /**
   * Check if cumulative energy has reached milestone thresholds and trigger flow card (v1.0.7)
   * Milestones are triggered at 100 kWh increments (100, 200, 300, etc.)
   * Uses deduplication to prevent multiple triggers for the same milestone
   * @param currentTotal - Current cumulative energy in kWh
   */
  private async checkEnergyMilestones(currentTotal: number): Promise<void> {
    try {
      // Milestone increment (100 kWh steps)
      const MILESTONE_INCREMENT = 100;

      // Get list of already triggered milestones from store
      const triggeredMilestones = (await this.device.getStoreValue('triggered_energy_milestones') as number[]) || [];

      // Calculate which milestones have been reached
      // Example: currentTotal = 523 kWh → milestones reached: 100, 200, 300, 400, 500
      const highestMilestone = Math.floor(currentTotal / MILESTONE_INCREMENT) * MILESTONE_INCREMENT;

      // Check each milestone from last triggered to current
      for (let milestone = MILESTONE_INCREMENT; milestone <= highestMilestone; milestone += MILESTONE_INCREMENT) {
        // Only trigger if this milestone hasn't been triggered before
        if (!triggeredMilestones.includes(milestone)) {
          try {
            // Trigger the flow card
            const triggerCard = this.device.homey.flow.getDeviceTriggerCard('total_consumption_milestone');
            await triggerCard.trigger(this.device, {
              total_consumption: Math.round(currentTotal * 100) / 100,
              milestone_value: milestone,
            }, {});

            this.logger(`EnergyTrackingService: 🎯 Energy milestone reached: ${milestone} kWh (total: ${Math.round(currentTotal * 100) / 100} kWh)`);

            // Add to triggered list
            triggeredMilestones.push(milestone);
          } catch (err) {
            this.logger(`EnergyTrackingService: Failed to trigger milestone ${milestone}:`, err);
          }
        }
      }

      // Save updated triggered milestones list (if any new milestones were added)
      if (triggeredMilestones.length > 0) {
        await this.device.setStoreValue('triggered_energy_milestones', triggeredMilestones);
      }
    } catch (error) {
      this.logger('EnergyTrackingService: Error checking energy milestones:', error);
    }
  }

  /**
   * Stop timers and cleanup; safe to call during device destruction.
   */
  destroy(): void {
    this.logger('EnergyTrackingService: Destroying service');

    // Stop energy tracking interval
    this.stopEnergyTrackingInterval();

    // Clear daily reset timers if they exist
    if (this.dailyResetTimeout) {
      clearTimeout(this.dailyResetTimeout);
      this.dailyResetTimeout = null;
    }

    if (this.dailyResetInterval) {
      clearInterval(this.dailyResetInterval);
      this.dailyResetInterval = null;
    }

    this.logger('EnergyTrackingService: Service destroyed - all timers cleared');
  }
}
