/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';

/**
 * WindCorrectionService - Wind-based Heat Loss Correction
 *
 * Receives wind speed data from external sources (KNMI, weather apps) via flow cards
 * and calculates target temperature corrections to compensate for wind-induced heat loss.
 *
 * Key Features:
 * - Learns wind sensitivity coefficient (α) from residual heat loss errors
 * - Applies real-time target temperature correction based on wind speed
 * - Respects configurable maximum correction limits
 *
 * Formula: correction = α × windSpeed × ΔT / 100
 * Where:
 * - α = wind sensitivity coefficient (learned or manual, typical 0.003-0.01)
 * - windSpeed = wind speed in km/h
 * - ΔT = indoor - outdoor temperature difference
 *
 * @version 1.0.0
 */

export interface WindCorrectionServiceConfig {
  device: Homey.Device;
  logger?: (message: string, ...args: unknown[]) => void;
}

export interface WindCorrectionResult {
  correction: number;
  windSpeed: number;
  deltaT: number;
  alpha: number;
  alphaSource: 'learned' | 'manual' | 'default';
  capped: boolean;
}

export interface WindDataHealth {
  hasValidData: boolean;
  windSpeed: number | null;
  lastUpdated: number | null;
  timeSinceUpdate: number | null;
  learnedAlpha: number;
  error?: string;
}

export class WindCorrectionService {
  private device: Homey.Device;
  private logger: (message: string, ...args: unknown[]) => void;
  private lastReceivedTimestamp: number = 0;
  private learnedAlpha: number = 0.006; // Default starting value
  private learningCount: number = 0;

  // Constants for alpha learning
  private static readonly DEFAULT_ALPHA = 0.006;
  private static readonly MIN_ALPHA = 0.001;
  private static readonly MAX_ALPHA = 0.02;
  private static readonly LEARNING_RATE = 0.01; // EMA smoothing factor
  private static readonly MIN_WIND_FOR_LEARNING = 5; // km/h
  private static readonly MIN_DELTA_T_FOR_LEARNING = 5; // °C

  /**
   * @param config.device - Owning Homey device
   * @param config.logger - Logger callback
   */
  constructor(config: WindCorrectionServiceConfig) {
    this.device = config.device;
    this.logger = config.logger || (() => {});

    // Restore learned alpha from device store
    this.restoreLearnedAlpha();

    this.logger('WindCorrectionService: Initialized');
  }

  /**
   * Restore learned alpha coefficient from device store
   */
  private async restoreLearnedAlpha(): Promise<void> {
    try {
      const storedAlpha = this.device.getStoreValue('wind_learned_alpha') as number | null;
      const storedCount = this.device.getStoreValue('wind_learning_count') as number | null;

      if (storedAlpha !== null && storedAlpha > 0) {
        this.learnedAlpha = storedAlpha;
        this.learningCount = storedCount || 0;
        this.logger('WindCorrectionService: Restored learned alpha', {
          alpha: this.learnedAlpha.toFixed(4),
          learningCount: this.learningCount,
        });
      }
    } catch (error) {
      this.logger('WindCorrectionService: Error restoring learned alpha', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Persist learned alpha coefficient to device store
   */
  private async persistLearnedAlpha(): Promise<void> {
    try {
      await this.device.setStoreValue('wind_learned_alpha', this.learnedAlpha);
      await this.device.setStoreValue('wind_learning_count', this.learningCount);
    } catch (error) {
      this.logger('WindCorrectionService: Error persisting learned alpha', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get current wind speed from external sensor
   *
   * Reads the `adlar_external_wind_speed` capability which is
   * updated by the `receive_external_wind_data` flow card.
   *
   * @returns Wind speed in km/h, or null if no data received yet
   */
  getWindSpeed(): number | null {
    try {
      if (!this.device.hasCapability('adlar_external_wind_speed')) {
        return null;
      }

      const windSpeed = this.device.getCapabilityValue('adlar_external_wind_speed') as number | null;

      if (windSpeed === null || windSpeed === undefined) {
        return null;
      }

      // Sanity check: wind speed should be within reasonable range
      if (windSpeed < 0 || windSpeed > 200) {
        this.logger('WindCorrectionService: Wind speed out of valid range', {
          windSpeed,
          validRange: '0-200 km/h',
        });
        return null;
      }

      return windSpeed;

    } catch (error) {
      this.logger('WindCorrectionService: Error reading wind speed', {
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Receive external wind speed data (called by flow card handler)
   *
   * @param windSpeed - Wind speed in km/h
   */
  async receiveExternalWindSpeed(windSpeed: number): Promise<void> {
    try {
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
      }

      // Store for persistence
      await this.device.setStoreValue('external_wind_speed', windSpeed);

      this.lastReceivedTimestamp = Date.now();

      this.logger('WindCorrectionService: Received external wind speed', {
        windSpeed,
        timestamp: new Date(this.lastReceivedTimestamp).toISOString(),
      });

    } catch (error) {
      this.logger('WindCorrectionService: Error receiving wind speed', {
        windSpeed,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get the effective alpha coefficient
   *
   * Priority:
   * 1. Manual override from settings (if > 0)
   * 2. Learned value (if learning has occurred)
   * 3. Default value
   *
   * @returns Alpha coefficient and its source
   */
  getEffectiveAlpha(): { alpha: number; source: 'learned' | 'manual' | 'default' } {
    const manualAlpha = this.device.getSetting('wind_alpha_manual') as number || 0;

    if (manualAlpha > 0) {
      return { alpha: manualAlpha, source: 'manual' };
    }

    if (this.learningCount > 10 && this.learnedAlpha > 0) {
      return { alpha: this.learnedAlpha, source: 'learned' };
    }

    return { alpha: WindCorrectionService.DEFAULT_ALPHA, source: 'default' };
  }

  /**
   * Calculate target temperature correction based on wind speed
   *
   * Formula: correction = α × windSpeed × ΔT / 100
   *
   * @param indoorTemp - Current indoor temperature (°C)
   * @param outdoorTemp - Current outdoor temperature (°C)
   * @returns Correction result with details
   */
  calculateCorrection(indoorTemp: number, outdoorTemp: number): WindCorrectionResult {
    const windSpeed = this.getWindSpeed();
    const deltaT = indoorTemp - outdoorTemp;
    const { alpha, source } = this.getEffectiveAlpha();
    const maxCorrection = (this.device.getSetting('wind_max_correction') as number) || 3.0;

    // Default result for when correction is not applicable
    const noCorrection: WindCorrectionResult = {
      correction: 0,
      windSpeed: windSpeed || 0,
      deltaT,
      alpha,
      alphaSource: source,
      capped: false,
    };

    // Skip if wind correction is disabled
    if (!this.device.getSetting('wind_correction_enabled')) {
      return noCorrection;
    }

    // Skip if no wind data
    if (windSpeed === null || windSpeed < 5) {
      return noCorrection;
    }

    // Skip if temperature difference is too small
    if (deltaT <= 5) {
      return noCorrection;
    }

    // Calculate raw correction
    // Formula: α × windSpeed × ΔT / 100
    const rawCorrection = alpha * windSpeed * deltaT / 100;

    // Apply cap
    const cappedCorrection = Math.min(rawCorrection, maxCorrection);
    const wasCapped = rawCorrection > maxCorrection;

    this.logger('WindCorrectionService: Calculated correction', {
      windSpeed,
      deltaT: deltaT.toFixed(1),
      alpha: alpha.toFixed(4),
      alphaSource: source,
      rawCorrection: rawCorrection.toFixed(2),
      cappedCorrection: cappedCorrection.toFixed(2),
      wasCapped,
    });

    return {
      correction: cappedCorrection,
      windSpeed,
      deltaT,
      alpha,
      alphaSource: source,
      capped: wasCapped,
    };
  }

  /**
   * Learn alpha coefficient from residual heat loss errors
   *
   * This method should be called by BuildingModelService after each
   * measurement cycle to refine the wind sensitivity coefficient.
   *
   * @param predictedLoss - Predicted heat loss from building model (kW)
   * @param actualLoss - Actual heat loss from measurements (kW)
   * @param baseUA - Building UA value from model (kW/K)
   */
  async learnAlphaFromResidual(
    predictedLoss: number,
    actualLoss: number,
    baseUA: number,
  ): Promise<void> {
    try {
      const windSpeed = this.getWindSpeed();
      const indoorTemp = this.device.getCapabilityValue('measure_temperature.indoor') as number | null;
      const outdoorTemp = this.device.getCapabilityValue('measure_temperature.around_temp') as number | null;

      // Skip if conditions aren't suitable for learning
      if (windSpeed === null || windSpeed < WindCorrectionService.MIN_WIND_FOR_LEARNING) {
        return;
      }

      if (indoorTemp === null || outdoorTemp === null) {
        return;
      }

      const deltaT = indoorTemp - outdoorTemp;
      if (deltaT < WindCorrectionService.MIN_DELTA_T_FOR_LEARNING) {
        return;
      }

      // Residual = actual - predicted (positive = more loss than expected)
      const residual = actualLoss - predictedLoss;

      // Only learn from positive residuals (wind causing extra loss)
      if (residual <= 0) {
        return;
      }

      // Calculate implied alpha from residual
      // residual = alpha × wind × deltaT × baseUA / 100
      // alpha = residual × 100 / (wind × deltaT × baseUA)
      const impliedAlpha = (residual * 100) / (windSpeed * deltaT * baseUA);

      // Validate implied alpha is reasonable
      if (impliedAlpha < WindCorrectionService.MIN_ALPHA ||
          impliedAlpha > WindCorrectionService.MAX_ALPHA) {
        this.logger('WindCorrectionService: Implied alpha out of reasonable range, skipping', {
          impliedAlpha: impliedAlpha.toFixed(4),
          validRange: `${WindCorrectionService.MIN_ALPHA}-${WindCorrectionService.MAX_ALPHA}`,
        });
        return;
      }

      // Apply exponential moving average
      const oldAlpha = this.learnedAlpha;
      this.learnedAlpha = (1 - WindCorrectionService.LEARNING_RATE) * this.learnedAlpha +
                          WindCorrectionService.LEARNING_RATE * impliedAlpha;
      this.learningCount++;

      // Persist periodically (every 10 learning cycles)
      if (this.learningCount % 10 === 0) {
        await this.persistLearnedAlpha();
      }

      this.logger('WindCorrectionService: Learned alpha updated', {
        oldAlpha: oldAlpha.toFixed(4),
        newAlpha: this.learnedAlpha.toFixed(4),
        impliedAlpha: impliedAlpha.toFixed(4),
        learningCount: this.learningCount,
        residual: residual.toFixed(2),
        windSpeed,
        deltaT: deltaT.toFixed(1),
      });

    } catch (error) {
      this.logger('WindCorrectionService: Error learning alpha', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Check if wind data is available and recent
   *
   * @param maxAgeMinutes - Maximum age of data in minutes (default: 15)
   * @returns Health status with diagnostics
   */
  getWindDataHealth(maxAgeMinutes: number = 15): WindDataHealth {
    try {
      const windSpeed = this.getWindSpeed();

      if (windSpeed === null) {
        return {
          hasValidData: false,
          windSpeed: null,
          lastUpdated: null,
          timeSinceUpdate: null,
          learnedAlpha: this.learnedAlpha,
          error: 'No external wind data received yet',
        };
      }

      const now = Date.now();
      const timeSinceUpdate = this.lastReceivedTimestamp > 0
        ? now - this.lastReceivedTimestamp
        : null;

      const maxAgeMs = maxAgeMinutes * 60 * 1000;
      const isStale = timeSinceUpdate !== null && timeSinceUpdate > maxAgeMs;

      if (isStale) {
        return {
          hasValidData: false,
          windSpeed,
          lastUpdated: this.lastReceivedTimestamp,
          timeSinceUpdate,
          learnedAlpha: this.learnedAlpha,
          error: `Data is stale (${Math.round(timeSinceUpdate! / 60000)} minutes old, max ${maxAgeMinutes} minutes)`,
        };
      }

      return {
        hasValidData: true,
        windSpeed,
        lastUpdated: this.lastReceivedTimestamp,
        timeSinceUpdate,
        learnedAlpha: this.learnedAlpha,
      };

    } catch (error) {
      return {
        hasValidData: false,
        windSpeed: null,
        lastUpdated: null,
        timeSinceUpdate: null,
        learnedAlpha: this.learnedAlpha,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Check if wind correction is enabled and has data
   *
   * @returns true if wind correction is enabled and wind data is available
   */
  isConfigured(): boolean {
    return this.device.getSetting('wind_correction_enabled') === true &&
           this.device.hasCapability('adlar_external_wind_speed') &&
           this.getWindSpeed() !== null;
  }

  /**
   * Get lookup table for wind correction values (reference)
   *
   * @returns Table showing corrections for different wind/ΔT combinations
   */
  getLookupTable(): { wind: number; deltaT: number; correction: number }[] {
    const { alpha } = this.getEffectiveAlpha();
    const maxCorrection = (this.device.getSetting('wind_max_correction') as number) || 3.0;
    const table: { wind: number; deltaT: number; correction: number }[] = [];

    const winds = [10, 20, 30, 40, 50];
    const deltaTs = [10, 15, 20, 25];

    for (const wind of winds) {
      for (const deltaT of deltaTs) {
        const raw = alpha * wind * deltaT / 100;
        table.push({
          wind,
          deltaT,
          correction: Math.min(raw, maxCorrection),
        });
      }
    }

    return table;
  }

  /**
   * Get diagnostic information
   *
   * @returns Diagnostic object for debugging
   */
  getDiagnostics(): Record<string, unknown> {
    const { alpha, source } = this.getEffectiveAlpha();
    return {
      enabled: this.device.getSetting('wind_correction_enabled') === true,
      windSpeed: this.getWindSpeed(),
      lastReceivedTimestamp: this.lastReceivedTimestamp > 0
        ? new Date(this.lastReceivedTimestamp).toISOString()
        : null,
      effectiveAlpha: alpha,
      alphaSource: source,
      learnedAlpha: this.learnedAlpha,
      learningCount: this.learningCount,
      maxCorrection: this.device.getSetting('wind_max_correction') || 3.0,
    };
  }

  /**
   * Destroy service and clean up resources
   */
  async destroy(): Promise<void> {
    // Persist learned alpha before destruction
    if (this.learningCount > 0) {
      await this.persistLearnedAlpha();
    }
    this.lastReceivedTimestamp = 0;
    this.logger('WindCorrectionService: Destroyed');
  }
}
