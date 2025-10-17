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
   */
  private async updateCumulativeEnergy(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

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
