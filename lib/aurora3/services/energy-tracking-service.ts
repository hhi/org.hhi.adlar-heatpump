/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';
import { InternalPowerReading, selectMeasuredPower } from '../../shared/measured-power';
import { DeviceConstants } from '../constants';
import { EnergyPriceOptimizer } from '../../modbus/adaptive/energy-price-optimizer';
import { nextLocalMidnight, resolveHomeyTimezone } from '../../shared/utils/time-format';

export interface EnergyTrackingOptions {
  device: Homey.Device;
  readInternalPower?: () => InternalPowerReading | null;
  logger?: (message: string, ...args: unknown[]) => void;
  energyPriceOptimizer?: EnergyPriceOptimizer;
}

export interface PowerMeasurement {
  value: number;
  source: 'external' | 'internal';
  confidence: 'high' | 'medium' | 'low';
  timestamp: number;
  validUntil?: number;
}

export class EnergyTrackingService {
  private device: Homey.Device;
  private logger: (message: string, ...args: unknown[]) => void;
  private energyTrackingInterval: NodeJS.Timeout | null = null;
  private dailyResetTimeout: NodeJS.Timeout | null = null;
  private lastExternalPowerUpdate: number = 0;
  private powerUpdateInProgress = false;
  private readonly readInternalPower?: () => InternalPowerReading | null;
  private isEnabled = false;
  private isDeviceConnected = false;

  // State tracking for flow card triggers (v1.0.8)
  private dailyThresholdTriggered = false; // Reset daily at midnight
  private lastDailyConsumptionCheck = 0; // For rate limiting

  // Overlap protection guard (v1.0.2)
  private energyCalculationInProgress = false;

  // Power threshold monitoring (v1.0.7 - power_threshold_exceeded trigger)
  private powerAboveThreshold = false;
  private lastPowerThresholdTrigger = 0;
  private readonly POWER_THRESHOLD_HYSTERESIS = 0.05; // 5% hysteresis
  private readonly POWER_THRESHOLD_RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

  // Power measurement state (v1.1.0)
  private lastPowerMeasurement: PowerMeasurement | null = null;

  // Cumulative energy state (v1.1.2 - internal tracking for robust cost calculation)
  private currentCumulativeEnergy: number = 0;

  /**
   * EnergyTrackingService tracks energy/power measurements, updates power-related capabilities,
   * and maintains daily/cumulative energy totals.
   * @param options.device - The Homey device that owns this service.
   * @param options.logger - Optional logger function.
   * @param options.energyPriceOptimizer - Optional energy price optimizer for cost accumulation.
   */
  // Energy price optimizer for cost accumulation (injected dependency)
  private energyPriceOptimizer: EnergyPriceOptimizer | null = null;

  constructor(options: EnergyTrackingOptions) {
    this.device = options.device;
    this.readInternalPower = options.readInternalPower;
    this.logger = options.logger || (() => { });
    this.energyPriceOptimizer = options.energyPriceOptimizer || null;
  }

  /**
   * Get the current power measurement (value, source, confidence)
   * accessible regardless of capability availability
   */
  public getCurrentPowerMeasurement(): PowerMeasurement | null {
    return this.lastPowerMeasurement;
  }

  /** Track actual external or internal readings; unavailable measurements stay unknown. */
  async updateIntelligentPowerMeasurement(): Promise<PowerMeasurement | null> {
    if (!this.isEnabled || this.powerUpdateInProgress) return this.lastPowerMeasurement;
    this.powerUpdateInProgress = true;
    try {
      const now = Date.now();
      let external: unknown = null;
      if (this.device.hasCapability('adlar_external_power')) {
        external = this.device.getCapabilityValue('adlar_external_power');
        if (external !== null && external !== undefined
          && now > this.lastExternalPowerUpdate + DeviceConstants.EXTERNAL_DATA_TTL_MS) {
          await this.device.setCapabilityValue('adlar_external_power', null);
          external = null;
        }
      }
      let internal: InternalPowerReading | null = null;
      if (this.isDeviceConnected) {
        if (this.readInternalPower) internal = this.readInternalPower();
        else {
          const value = this.getInternalPowerMeasurement();
          if (value !== null) internal = { value, timestamp: now };
        }
      }
      const measurement = selectMeasuredPower(
        external, this.lastExternalPowerUpdate, DeviceConstants.EXTERNAL_DATA_TTL_MS,
        internal, 60_000, now,
      );
      const previous = this.lastPowerMeasurement;
      this.lastPowerMeasurement = measurement;
      if (this.device.getSetting('enable_power_measurements') !== false && this.device.hasCapability('measure_power')) {
        await this.device.setCapabilityValue('measure_power', measurement ? Math.round(measurement.value) : null);
      }
      if (measurement) {
        await this.checkPowerThreshold(measurement.value);
        await this.updateCumulativeEnergy(previous, now);
      } else {
        // Break the integration interval: the next reading must not backfill this gap.
        await this.device.setStoreValue('last_energy_update', now);
        await this.device.setStoreValue('last_external_energy_update', now);
      }
      return measurement;
    } catch (error) {
      this.lastPowerMeasurement = null;
      this.logger('EnergyTrackingService: Error updating measured power:', error);
      return null;
    } finally {
      this.powerUpdateInProgress = false;
    }
  }

  /**
   * Get the driver's internal power measurement via its raw capability.
   * Note: Direct TuyAPI access removed - now uses device capabilities only.
   */
  private getInternalPowerMeasurement(): number | null {
    try {
      // Access internal power through device capability if available
      // This avoids direct TuyAPI dependency and uses proper device abstraction
      const internalPower = this.device.getCapabilityValue('measure_power');
      if (typeof internalPower === 'number' && Number.isFinite(internalPower) && internalPower >= 0) {
        return internalPower;
      }
    } catch (error) {
      this.logger('Could not access internal power capability:', error);
    }

    // Fallback: Return null to trigger unavailable measurements
    return null;
  }

  /**
   * Initialize persistent values used for tracking (store values, last update times).
   */
  private async initializeEnergyTracking(): Promise<void> {
    try {
      const now = Date.now();
      const timeZone = resolveHomeyTimezone(this.device.homey);
      const day = (timestamp: number) => new Date(timestamp).toLocaleDateString('en-CA', { timeZone });
      const oldTimestamp = await this.device.getStoreValue('last_energy_update');
      const previousDay = await this.device.getStoreValue('energy_tracking_day')
        ?? (typeof oldTimestamp === 'number' ? day(oldTimestamp) : null);
      if (previousDay && previousDay !== day(now)) await this.performDailyReset();
      await this.device.setStoreValue('energy_tracking_day', day(now));
      await this.device.setStoreValue('last_energy_update', now);
      await this.device.setStoreValue('last_external_energy_update', now);

      // Initialize cumulative energy from store (authoritative source)
      const storedEnergy = await this.device.getStoreValue('cumulative_energy_kwh');
      if (typeof storedEnergy === 'number') {
        this.currentCumulativeEnergy = storedEnergy;
      }

      // Restore meter_power capability from store
      if (this.device.hasCapability('meter_power')) {
        const currentTotal = this.device.getCapabilityValue('meter_power');
        if ((!currentTotal || currentTotal === 0) && this.currentCumulativeEnergy > 0) {
          await this.device.setCapabilityValue('meter_power', this.currentCumulativeEnergy);
          this.logger(`EnergyTrackingService: Restored cumulative energy: ${this.currentCumulativeEnergy} kWh`);
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

      // Restore hourly cost capability from store (survives app restarts)
      if (this.device.hasCapability('adlar_energy_cost_hourly')) {
        const storedHourlyCost = await this.device.getStoreValue('hourly_cost_cache') || 0;
        if (storedHourlyCost > 0) {
          await this.device.setCapabilityValue('adlar_energy_cost_hourly', storedHourlyCost);
          this.logger(`EnergyTrackingService: Restored hourly cost: €${storedHourlyCost.toFixed(2)}`);
        }
      }

      // Restore daily cost capability from store (survives app restarts)
      if (this.device.hasCapability('adlar_energy_cost_daily')) {
        const storedDailyCost = await this.device.getStoreValue('daily_cost_cache') || 0;
        if (storedDailyCost > 0) {
          await this.device.setCapabilityValue('adlar_energy_cost_daily', storedDailyCost);
          this.logger(`EnergyTrackingService: Restored daily cost: €${storedDailyCost.toFixed(2)}`);
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
  private async updateCumulativeEnergy(previous: PowerMeasurement | null, currentTime: number): Promise<void> {
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
      const currentPower = previous?.value ?? 0;
      const lastUpdate = previous?.timestamp ?? currentTime;
      const intervalEnd = Math.min(currentTime, previous?.validUntil ?? currentTime);
      const consecutive = currentTime - lastUpdate <= 60_000;
      const hoursElapsed = consecutive ? Math.max(0, intervalEnd - lastUpdate) / (1000 * 60 * 60) : 0;

      // Only accumulate internal energy when we have reliable positive power data
      if (currentPower > 0 && hoursElapsed > 0) {
        // Calculate energy increment in kWh
        const energyIncrement = (currentPower / 1000) * hoursElapsed;

        // Update total cumulative energy (Internal State v1.1.2)
        this.currentCumulativeEnergy += energyIncrement;
        const newTotal = this.currentCumulativeEnergy;

        // Store in device storage for persistence
        await this.device.setStoreValue('cumulative_energy_kwh', newTotal);

        // Update capability if it exists (for visualization only - decoupling v1.1.2)
        if (this.device.hasCapability('meter_power')) {
          await this.device.setCapabilityValue('meter_power', Math.round(newTotal * 100) / 100);
        }

        // Check for energy milestones (v1.0.7 - total_consumption_milestone trigger)
        await this.checkEnergyMilestones(newTotal);

        // Update daily consumption (store only — no dedicated capability)
        const dailyConsumption = await this.device.getStoreValue('daily_consumption_kwh') || 0;
        const newDailyTotal = dailyConsumption + energyIncrement;
        await this.device.setStoreValue('daily_consumption_kwh', newDailyTotal);

        // Check daily consumption threshold (v1.0.8)
        await this.checkDailyConsumptionThreshold(newDailyTotal);

        // === UNIFIED COST CALCULATION (v1.1.0) ===
        // Calculate costs regardless of power source (internal/external/calculated)
        if (this.energyPriceOptimizer?.getCurrentPrice(currentTime)) {
          const effectivePrice = this.energyPriceOptimizer.getEffectivePrice();
          this.logger(`EnergyTrackingService DEBUG: Power=${currentPower}W, Increment=${(energyIncrement * 1000).toFixed(4)}Wh, Price=€${effectivePrice.toFixed(4)}/kWh`);

          // 1. Accumulate Daily Cost
          // Adds incremental cost to the daily total based on current energy increment and effective price
          this.energyPriceOptimizer.accumulateCost(energyIncrement);

          if (this.device.hasCapability('adlar_energy_cost_daily')) {
            const dailyCost = this.energyPriceOptimizer.getAccumulatedDailyCost();
            const roundedDailyCost = Math.round(dailyCost * 10000) / 10000;
            await this.device.setCapabilityValue('adlar_energy_cost_daily', roundedDailyCost);
            // Persist for app restart recovery
            await this.device.setStoreValue('daily_cost_cache', roundedDailyCost);
          }

          // 2. Accumulate Hourly Cost
          // Use INTERNAL total energy counter to track hourly deltas (Decoupled from capability v1.1.2)
          if (this.device.hasCapability('adlar_energy_cost_hourly')) {
            // We use the monotonic internal counter for correct delta tracking
            // This works even if meter_power.electric_total capability is disabled/missing
            const hourlyCost = this.energyPriceOptimizer.accumulateHourlyCost(this.currentCumulativeEnergy);

            const roundedHourlyCost = Math.round(hourlyCost * 10000) / 10000;
            await this.device.setCapabilityValue('adlar_energy_cost_hourly', roundedHourlyCost);
            // Persist for app restart recovery
            await this.device.setStoreValue('hourly_cost_cache', roundedHourlyCost);
          }

          // Persist optimizer state to ensure hourStartEnergy and accumulated costs are saved immediately
          // This makes the calculation resilient to app restarts (v1.1.1)
          await this.device.setStoreValue('energy_optimizer_state', this.energyPriceOptimizer.getState());
        }

        this.logger(`EnergyTrackingService: Energy updated: +${(energyIncrement * 1000).toFixed(1)}Wh (power: ${currentPower}W, time: ${(hoursElapsed * 60).toFixed(1)}min)`);
      }

      if (previous?.source === 'external' && hoursElapsed > 0) {
        await this.updateExternalEnergy((currentPower / 1000) * hoursElapsed);
      }
      // Zero is a valid reading and must advance the cursor, too.
      await this.device.setStoreValue('last_energy_update', currentTime);
      await this.device.setStoreValue('last_external_energy_update', currentTime);

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
  private async updateExternalEnergy(energyIncrement: number): Promise<void> {
    if (energyIncrement <= 0) return;
    const stored = await this.device.getStoreValue('external_cumulative_energy_kwh');
    const capability = this.device.hasCapability('adlar_external_energy_total')
      ? this.device.getCapabilityValue('adlar_external_energy_total') : null;
    const total = (typeof stored === 'number' ? stored : (capability ?? 0)) + energyIncrement;
    await this.device.setStoreValue('external_cumulative_energy_kwh', total);
    if (this.device.hasCapability('adlar_external_energy_total')) {
      await this.device.setCapabilityValue('adlar_external_energy_total', Math.round(total * 1000) / 1000);
    }
    const daily = (await this.device.getStoreValue('external_daily_consumption_kwh') ?? 0) + energyIncrement;
    await this.device.setStoreValue('external_daily_consumption_kwh', daily);
    if (this.device.hasCapability('adlar_external_energy_daily')) {
      await this.device.setCapabilityValue('adlar_external_energy_daily', Math.round(daily * 1000000) / 1000000);
    }
  }

  private startEnergyTrackingInterval(): void {
    // Start frequent energy tracking interval (every 30 seconds)
    this.energyTrackingInterval = this.device.homey.setInterval(() => {
      // Refresh intelligent power measurement continuously
      // This ensures we have the latest power data AND triggers accumulation via the update chain
      this.updateIntelligentPowerMeasurement().catch((error) => {
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
      this.device.homey.clearInterval(this.energyTrackingInterval);
      this.energyTrackingInterval = null;
      this.logger('EnergyTrackingService: Stopped energy tracking interval');
    }
  }

  /**
   * Schedule midnight reset for daily counters
   * Uses a timeout to the next local midnight (Homey timezone), rescheduled after each reset
   * so days of 23 or 25 hours (DST changes) keep the reset at 00:00
   *
   * @param from - Instant to plan from; after a reset this is the midnight that just passed
   */
  private scheduleMidnightReset(from: Date = new Date()): void {
    if (this.dailyResetTimeout) {
      this.device.homey.clearTimeout(this.dailyResetTimeout);
      this.dailyResetTimeout = null;
    }

    const timeZone = resolveHomeyTimezone(this.device.homey);
    const midnight = nextLocalMidnight(from, timeZone);
    const msUntilMidnight = Math.max(0, midnight.getTime() - Date.now());

    this.logger(`EnergyTrackingService: Scheduling midnight reset in ${Math.round(msUntilMidnight / 60000)} minutes (${timeZone})`);

    this.dailyResetTimeout = this.device.homey.setTimeout(() => {
      this.dailyResetTimeout = null;
      this.performDailyReset().catch((error) => {
        this.logger('EnergyTrackingService: Error in daily reset timeout:', error);
      });

      // Plan from this midnight, so a timer firing a few ms early cannot pick the same midnight again
      this.scheduleMidnightReset(midnight);
    }, msUntilMidnight);
  }

  /**
   * Perform daily reset of energy and cost counters
   * Called at midnight
   */
  private async performDailyReset(): Promise<void> {
    this.logger('EnergyTrackingService: Performing daily reset at midnight');
    const timeZone = resolveHomeyTimezone(this.device.homey);
    await this.device.setStoreValue('energy_tracking_day', new Date().toLocaleDateString('en-CA', { timeZone }));

    try {
      // Reset external daily energy
      if (this.device.hasCapability('adlar_external_energy_daily')) {
        await this.device.setCapabilityValue('adlar_external_energy_daily', 0);
        await this.device.setStoreValue('external_daily_consumption_kwh', 0);
      }

      // Reset internal daily consumption (store only — no dedicated capability)
      await this.device.setStoreValue('daily_consumption_kwh', 0);

      // Reset daily cost via EnergyPriceOptimizer
      this.resetDailyCost();

      // Reset daily cost capability and cache
      if (this.device.hasCapability('adlar_energy_cost_daily')) {
        await this.device.setCapabilityValue('adlar_energy_cost_daily', 0);
        await this.device.setStoreValue('daily_cost_cache', 0);
      }

      // Reset hourly cost cache as well (new day starts fresh)
      await this.device.setStoreValue('hourly_cost_cache', 0);

      // Reset daily threshold trigger flag
      this.dailyThresholdTriggered = false;

      this.logger('EnergyTrackingService: Daily reset completed');
    } catch (error) {
      this.logger('EnergyTrackingService: Error during daily reset:', error);
    }
  }

  /**
   * Receive and process external power data pushed via flow/action cards.
   * Updates the external-power capability and triggers energy recalculation.
   * @param powerValue - power in Watts
   */
  /**
   * Notify the service of Tuya connection state changes.
   * On disconnect: clears stale power data and resets measure_power to 0.
   * On connect: resumes power measurement updates.
   */
  async setConnectionState(connected: boolean): Promise<void> {
    if (this.isDeviceConnected !== connected && this.lastPowerMeasurement?.source === 'internal') {
      this.lastPowerMeasurement = null;
    }
    this.isDeviceConnected = connected;
    // A Shelly reading remains usable while the heat pump connection is offline.
    await this.updateIntelligentPowerMeasurement();
  }

  async receiveExternalPowerData(powerValue: number): Promise<void> {
    if (!Number.isFinite(powerValue) || powerValue < 0) throw new Error('External power must be a finite non-negative number of watts');
    this.lastExternalPowerUpdate = Date.now();
    try {
      if (this.device.hasCapability('adlar_external_power')) {
        await this.device.setCapabilityValue('adlar_external_power', powerValue);
        this.logger(`EnergyTrackingService: External power data received: ${powerValue}W`);

        // Update defrost active power if applicable
        if (this.device.hasCapability('defrost_active_power')) {
          const isDefrosting = this.device.getCapabilityValue('adlar_defrosting') || false;
          const newValue = isDefrosting ? powerValue : 0;
          await this.device.setCapabilityValue('defrost_active_power', newValue);
        }

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
    if (this.isEnabled) return;
    this.isEnabled = true;
    this.lastPowerMeasurement = null;
    await this.initializeEnergyTracking();
    this.startEnergyTrackingInterval();
    this.scheduleMidnightReset();
    await this.updateIntelligentPowerMeasurement();
    this.logger('EnergyTrackingService: Always-on measured energy tracking initialized');
  }

  async onSettings(
    _oldSettings: Record<string, unknown>,
    _newSettings: Record<string, unknown>,
    _changedKeys: string[],
  ): Promise<void> {
    // Tracking is always active. Display settings do not disable energy accounting.
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
   * Check and trigger daily consumption threshold (v1.0.8)
   * Fires when daily energy consumption exceeds specified threshold
   * Resets daily at midnight
   */
  private async checkDailyConsumptionThreshold(dailyConsumption: number): Promise<void> {
    try {
      const settings = await this.device.getSettings();
      const threshold = settings.daily_consumption_threshold_kwh || 50; // Default 50 kWh

      // Only trigger once per day when threshold is exceeded
      if (!this.dailyThresholdTriggered && dailyConsumption >= threshold) {
        // Fire trigger - cast device to access triggerFlowCard method
        const deviceWithTrigger = this.device as unknown as {
          triggerFlowCard: (cardId: string, tokens: Record<string, unknown>) => Promise<void>;
        };

        await deviceWithTrigger.triggerFlowCard('daily_consumption_threshold', {
          daily_consumption: Math.round(dailyConsumption * 100) / 100,
          threshold_value: threshold,
          exceeded_by: Math.round((dailyConsumption - threshold) * 100) / 100,
        });

        this.dailyThresholdTriggered = true;
        this.logger(`Daily consumption threshold exceeded: ${dailyConsumption.toFixed(2)} kWh >= ${threshold} kWh`);
      }
    } catch (error) {
      this.logger('Error in checkDailyConsumptionThreshold:', error);
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
    this.isEnabled = false;
    this.lastPowerMeasurement = null;

    // Stop energy tracking interval
    this.stopEnergyTrackingInterval();

    // Clear daily reset timers if they exist
    if (this.dailyResetTimeout) {
      this.device.homey.clearTimeout(this.dailyResetTimeout);
      this.dailyResetTimeout = null;
    }

    this.logger('EnergyTrackingService: Service destroyed - all timers cleared');
  }

  /**
   * Set the energy price optimizer for cost accumulation
   * Used for late dependency injection after constructor
   */
  public setEnergyPriceOptimizer(optimizer: EnergyPriceOptimizer): void {
    this.energyPriceOptimizer = optimizer;
    this.logger('EnergyTrackingService: EnergyPriceOptimizer injected');
  }

  /**
   * Reset daily cost accumulator (called at midnight)
   * Delegates to EnergyPriceOptimizer if available
   */
  public resetDailyCost(): void {
    if (this.energyPriceOptimizer) {
      this.energyPriceOptimizer.resetDailyCost();
      this.logger('EnergyTrackingService: Daily cost reset delegated to EnergyPriceOptimizer');
    }
  }
}
