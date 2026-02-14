/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';
import { DeviceConstants } from '../constants';
import { DefrostLearner } from '../adaptive/defrost-learner';

/**
 * Hourly temperature forecast data point
 */
export interface HourlyForecast {
  hour: number; // Hours from now (0 = current hour)
  timestamp: number; // Unix timestamp (ms)
  temperature: number; // Outdoor temperature °C
  cloudCover?: number; // Cloud cover 0-100%
  humidity?: number; // Relative humidity 2m, 0-100%
  windSpeed?: number; // Wind speed 10m, km/h
}

/**
 * Complete weather forecast response
 */
export interface WeatherForecast {
  receivedAt: number; // Unix timestamp when received
  validUntil: number; // Max cache validity
  latitude: number;
  longitude: number;
  hourly: HourlyForecast[];
}

/**
 * COP timing advice based on forecast
 */
export interface ForecastAdvice {
  delayHours: number; // Recommended delay (0 = heat now)
  expectedCop: number; // Expected COP at recommended time
  currentCop: number; // Current COP
  expectedTemp: number; // Expected outdoor temp at recommended time
  currentTemp: number; // Current outdoor temp
  pctSavings: number; // % zuiniger (positive) or % minder rendement (negative)
  trend: 'rising' | 'dropping' | 'stable'; // Temperature trend
  adviceText: string; // Human readable advice
}

export interface WeatherForecastServiceOptions {
  device: Homey.Device;
  logger?: (message: string, ...args: unknown[]) => void;
  /**
   * Optional COP lookup from learned data (e.g. COPOptimizer).
   * Receives outdoor temperature, returns estimated COP or null if unknown.
   * When null/undefined, the service falls back to a linear model.
   */
  copLookup?: (outdoorTemp: number) => number | null;
  /**
   * Optional DefrostLearner for learned defrost COP penalties.
   * When null/undefined, falls back to static humidity model.
   */
  defrostLearner?: DefrostLearner | null;
}

/**
 * WeatherForecastService fetches temperature forecasts from Open-Meteo API
 * and provides COP-optimized heating timing advice.
 *
 * @version 2.8.0
 * @since 2.8.0
 */
export class WeatherForecastService {
  private device: Homey.Device;
  private logger: (message: string, ...args: unknown[]) => void;
  private copLookup: ((outdoorTemp: number) => number | null) | null;
  private defrostLearner: DefrostLearner | null;

  // Cached forecast data
  private forecast: WeatherForecast | null = null;

  // API configuration
  private static readonly API_BASE = 'https://api.open-meteo.com/v1/forecast';
  private static readonly CACHE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
  private static readonly MAX_CACHE_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours fallback
  private static readonly FORECAST_HOURS = 48;

  // COP estimation fallback curve (used when no learned data available)
  // Based on typical air-source heat pump performance
  private static readonly COP_REFERENCE_TEMP = 7; // °C (A7/W35 standard)
  private static readonly COP_REFERENCE_VALUE = 4.0;
  private static readonly COP_TEMP_COEFFICIENT = 0.08; // COP change per °C (realistic)

  // Advice thresholds
  private static readonly SAVINGS_THRESHOLD_PCT = 5; // Minimum % to recommend action
  private static readonly GOOD_ENOUGH_RATIO = 0.90; // 90% of max benefit = good enough

  // Update interval
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(options: WeatherForecastServiceOptions) {
    this.device = options.device;
    this.logger = options.logger || (() => { });
    this.copLookup = options.copLookup ?? null;
    this.defrostLearner = options.defrostLearner ?? null;
    this.logger(`WeatherForecastService: Initialized (COP source: ${this.copLookup ? 'learned' : 'linear model'}, defrost: ${this.defrostLearner ? 'learned' : 'static model'})`);
  }

  /**
   * Update COP lookup function (e.g. when COPOptimizer becomes available)
   */
  public setCopLookup(lookup: ((outdoorTemp: number) => number | null) | null): void {
    this.copLookup = lookup;
    this.logger(`WeatherForecastService: COP source changed to ${lookup ? 'learned' : 'linear model'}`);
  }

  /**
   * Update DefrostLearner reference (e.g. when learner becomes available after init)
   */
  public setDefrostLearner(learner: DefrostLearner | null): void {
    this.defrostLearner = learner;
    this.logger(`WeatherForecastService: Defrost source changed to ${learner ? 'learned' : 'static model'}`);
  }

  /**
   * Start periodic forecast updates
   */
  public startUpdates(intervalMs: number = 2 * 60 * 60 * 1000): void {
    // Prevent duplicate intervals when settings are toggled repeatedly
    if (this.updateInterval) {
      this.stopUpdates();
    }

    this.logger(`WeatherForecastService: Starting updates every ${intervalMs / 1000 / 60} minutes`);

    // Initial fetch
    this.updateForecast().catch((err) => {
      this.logger(`WeatherForecastService: Initial fetch failed: ${err.message}`);
    });

    // Periodic updates
    this.updateInterval = this.device.homey.setInterval(() => {
      this.updateForecast().catch((err) => {
        this.logger(`WeatherForecastService: Periodic fetch failed: ${err.message}`);
      });
    }, intervalMs);
  }

  /**
   * Stop periodic updates
   */
  public stopUpdates(): void {
    if (this.updateInterval) {
      this.device.homey.clearInterval(this.updateInterval);
      this.updateInterval = null;
      this.logger('WeatherForecastService: Stopped updates');
    }
  }

  /**
   * Fetch forecast from Open-Meteo API
   */
  public async updateForecast(): Promise<WeatherForecast | null> {
    const settings = this.device.getSettings();
    const lat = settings.forecast_location_lat ?? 52.37;
    const lon = settings.forecast_location_lon ?? 4.90;

    const hourlyParams = 'temperature_2m,cloud_cover,relative_humidity_2m,wind_speed_10m';
    const url = `${WeatherForecastService.API_BASE}?latitude=${lat}&longitude=${lon}&hourly=${hourlyParams}&forecast_hours=${WeatherForecastService.FORECAST_HOURS}&timezone=auto`;

    this.logger('WeatherForecastService: Fetching from Open-Meteo API');

    try {
      const data = await this.httpGet(url);

      // Parse response into our format
      const now = Date.now();
      const hourly: HourlyForecast[] = data.hourly.time.map((time: string, index: number) => ({
        hour: index,
        timestamp: new Date(time).getTime(),
        temperature: data.hourly.temperature_2m[index],
        cloudCover: data.hourly.cloud_cover?.[index],
        humidity: data.hourly.relative_humidity_2m?.[index],
        windSpeed: data.hourly.wind_speed_10m?.[index],
      }));

      this.forecast = {
        receivedAt: now,
        validUntil: now + WeatherForecastService.CACHE_DURATION_MS,
        latitude: data.latitude,
        longitude: data.longitude,
        hourly,
      };

      this.logger(`WeatherForecastService: Received ${hourly.length} hours of forecast data`);
      return this.forecast;
    } catch (error) {
      const err = error as Error;
      this.logger(`WeatherForecastService: Fetch error: ${err.message}`);

      // Return cached data if available and not too old
      if (this.forecast && (Date.now() - this.forecast.receivedAt) < WeatherForecastService.MAX_CACHE_AGE_MS) {
        this.logger('WeatherForecastService: Using cached forecast (fallback)');
        return this.forecast;
      }

      return null;
    }
  }

  /**
   * HTTP GET helper using native fetch (Node 18+)
   * Native fetch is recommended by Homey for Node 22 compatibility
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async httpGet(url: string): Promise<any> {
    const controller = new AbortController();
    const timeout = this.device.homey.setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } finally {
      this.device.homey.clearTimeout(timeout);
    }
  }

  /**
   * Get temperature forecast for a specific hour ahead
   * @param hoursAhead - Number of hours from now (0 = current)
   */
  public getTempAt(hoursAhead: number): number | null {
    if (!this.forecast || hoursAhead < 0 || hoursAhead >= this.forecast.hourly.length) {
      return null;
    }
    return this.forecast.hourly[hoursAhead].temperature;
  }

  /**
   * Estimate COP for a given outdoor temperature with optional weather corrections.
   *
   * Correction pipeline:
   * 1. Base COP from learned data (COPOptimizer) or linear fallback model
   * 2. Wind boost: forced convection improves effective evaporator temperature
   * 3. Defrost penalty: learned or humidity-based COP reduction
   *
   * @param outdoorTemp - Outdoor temperature (°C)
   * @param humidity - Optional relative humidity (0-100%)
   * @param windSpeed - Optional wind speed (km/h)
   */
  public estimateCop(outdoorTemp: number, humidity?: number, windSpeed?: number): number {
    // Step 1: Base COP (learned or linear model)
    let baseCop: number;
    if (this.copLookup) {
      const learnedCop = this.copLookup(outdoorTemp);
      if (learnedCop != null && learnedCop > 0) {
        baseCop = Math.max(1.5, Math.min(7.0, learnedCop));
      } else {
        baseCop = this.linearCopModel(outdoorTemp);
      }
    } else {
      baseCop = this.linearCopModel(outdoorTemp);
    }

    // Step 2: Wind-driven evaporator convection boost
    const effectiveTemp = this.calculateEffectiveEvaporatorTemp(outdoorTemp, windSpeed);
    if (effectiveTemp !== outdoorTemp) {
      const windCopBoost = (effectiveTemp - outdoorTemp) * WeatherForecastService.COP_TEMP_COEFFICIENT;
      baseCop += windCopBoost;
    }

    // Step 3: Defrost penalty (learned or static humidity model)
    let defrostFactor = 1.0;
    if (this.defrostLearner) {
      defrostFactor = this.defrostLearner.getDefrostPenalty(outdoorTemp, humidity);
    } else {
      defrostFactor = this.staticDefrostFallback(outdoorTemp, humidity);
    }
    const correctedCop = baseCop * defrostFactor;

    return Math.max(1.5, Math.min(7.0, correctedCop));
  }

  /**
   * Linear COP fallback model (used when no learned data available)
   */
  private linearCopModel(outdoorTemp: number): number {
    const tempDiff = outdoorTemp - WeatherForecastService.COP_REFERENCE_TEMP;
    const cop = WeatherForecastService.COP_REFERENCE_VALUE + (tempDiff * WeatherForecastService.COP_TEMP_COEFFICIENT);
    return Math.max(1.5, Math.min(7.0, cop));
  }

  /**
   * Calculate effective evaporator temperature accounting for wind-driven convection.
   *
   * Forced airflow across the evaporator improves heat transfer, effectively
   * raising the temperature the evaporator "sees". This is a small positive
   * effect (max +2°C), not to be confused with human wind chill.
   */
  private calculateEffectiveEvaporatorTemp(temperature: number, windSpeed?: number): number {
    if (windSpeed === undefined || windSpeed === null || windSpeed <= 0) return temperature;

    const windConst = DeviceConstants.FORECAST_WIND_EVAPORATOR;

    // No correction above the upper limit (evaporator not limited at warm temps)
    if (temperature > windConst.TEMP_UPPER_LIMIT) return temperature;

    // Enhanced convection: Nu ~ Re^0.5 ~ windSpeed^0.5
    const tempBelowThreshold = Math.max(0, windConst.TEMP_UPPER_LIMIT - temperature);
    const normalizedTempFactor = Math.min(tempBelowThreshold / windConst.TEMP_UPPER_LIMIT, 1.0);
    const windBoost = windConst.CONVECTION_FACTOR * Math.sqrt(windSpeed) * normalizedTempFactor;

    return temperature + Math.min(windConst.MAX_TEMP_BOOST, windBoost);
  }

  /**
   * Static defrost penalty when no DefrostLearner is available.
   * Delegates to DefrostLearner's static model for consistency.
   */
  private staticDefrostFallback(temperature: number, humidity?: number): number {
    const constants = DeviceConstants.FORECAST_DEFROST;

    // Outside icing band: no penalty
    if (temperature < constants.TEMP_LOW || temperature > constants.TEMP_HIGH) return 1.0;

    // No humidity data: apply half the max penalty as conservative estimate
    if (humidity === undefined || humidity === null) {
      const tempDist = Math.abs(temperature);
      const tempFactor = Math.max(0, 1.0 - tempDist / constants.TEMP_HIGH);
      return 1.0 - (constants.FALLBACK_MAX_PENALTY * 0.5 * tempFactor);
    }

    // Below humidity threshold: negligible
    if (humidity <= constants.HUMIDITY_THRESHOLD) return 1.0;

    // Tent function at 0°C × linear humidity scaling
    const tempFactor = Math.max(0, 1.0 - Math.abs(temperature) / constants.TEMP_HIGH);
    const humidityFactor = (humidity - constants.HUMIDITY_THRESHOLD)
      / (100.0 - constants.HUMIDITY_THRESHOLD);

    return 1.0 - (constants.FALLBACK_MAX_PENALTY * tempFactor * humidityFactor);
  }

  /**
   * Calculate optimal heating timing advice based on the full forecast curve.
   *
   * Analyzes the complete 48h temperature curve to detect three scenarios:
   * - RISING: temperature will increase → recommend waiting for better COP
   * - DROPPING: temperature will decrease → recommend heating now
   * - STABLE: no significant change → no forecast advantage
   *
   * Uses "first good enough" strategy: recommends the earliest hour that
   * captures at least 90% of the maximum benefit, avoiding unnecessarily
   * long delays for marginal improvement.
   *
   * @param currentOutdoorTemp - Current outdoor temperature (from sensor)
   * @param maxDelayHours - Maximum hours to look ahead (default 12)
   * @returns Advice on optimal heating timing
   */
  public calculateAdvice(currentOutdoorTemp: number, maxDelayHours: number = 12): ForecastAdvice | null {
    if (!this.forecast || this.forecast.hourly.length < 2) {
      this.logger('WeatherForecastService: No forecast data for advice');
      return null;
    }

    // Current COP: no weather corrections (actual conditions already experienced)
    const currentCop = this.estimateCop(currentOutdoorTemp);
    const lookAhead = Math.min(maxDelayHours, this.forecast.hourly.length - 1);

    // Step 1: Find peak and trough within lookahead window
    // Use weather-corrected COP for forecast hours (includes humidity + wind effects)
    let peakHour = 0;
    let peakTemp = currentOutdoorTemp;
    let peakCop = currentCop;
    let troughHour = 0;
    let troughTemp = currentOutdoorTemp;
    let troughCop = currentCop;

    for (let h = 1; h <= lookAhead; h++) {
      const entry = this.forecast.hourly[h];
      if (!entry || entry.temperature === undefined) continue;
      const hourCop = this.estimateCop(entry.temperature, entry.humidity, entry.windSpeed);
      if (hourCop > peakCop) {
        peakHour = h;
        peakTemp = entry.temperature;
        peakCop = hourCop;
      }
      if (hourCop < troughCop) {
        troughHour = h;
        troughTemp = entry.temperature;
        troughCop = hourCop;
      }
    }

    // Step 2: Calculate potential savings (rising) and losses (dropping)
    const pctRising = currentCop > 0 ? (1 - currentCop / peakCop) * 100 : 0;
    const pctDropping = currentCop > 0 ? (1 - troughCop / currentCop) * 100 : 0;

    // Step 3: Determine trend and build advice
    const threshold = WeatherForecastService.SAVINGS_THRESHOLD_PCT;

    // --- RISING: worth waiting for better COP ---
    if (pctRising >= threshold && peakHour > 0) {
      // Find "first good enough" hour (90% of max benefit)
      const goodEnoughCop = currentCop + (peakCop - currentCop) * WeatherForecastService.GOOD_ENOUGH_RATIO;
      let bestHour = peakHour;

      for (let h = 1; h < peakHour; h++) {
        const entry = this.forecast.hourly[h];
        if (entry && entry.temperature !== undefined) {
          const hourCop = this.estimateCop(entry.temperature, entry.humidity, entry.windSpeed);
          if (hourCop >= goodEnoughCop) {
            bestHour = h;
            break;
          }
        }
      }

      // Check thermal feasibility: can the building wait this long?
      if (!this.isDelayFeasible(bestHour)) {
        // Building can't hold heat that long, reduce delay
        bestHour = this.getMaxFeasibleDelay();
        if (bestHour <= 0) {
          return this.buildStableAdvice(currentOutdoorTemp, currentCop);
        }
      }

      const bestEntry = this.forecast.hourly[bestHour];
      const bestTemp = bestEntry?.temperature ?? peakTemp;
      const bestCop = this.estimateCop(bestTemp, bestEntry?.humidity, bestEntry?.windSpeed);
      const actualSavings = (1 - currentCop / bestCop) * 100;

      const risingDefrost = this.getDefrostSuffix(currentOutdoorTemp, this.forecast.hourly[0]?.humidity);
      return {
        delayHours: bestHour,
        expectedCop: bestCop,
        currentCop,
        expectedTemp: bestTemp,
        currentTemp: currentOutdoorTemp,
        pctSavings: Math.round(actualSavings),
        trend: 'rising',
        adviceText: `Wacht ${bestHour}u, ${Math.round(actualSavings)}% zuiniger bij ${bestTemp.toFixed(0)}°C${risingDefrost}`,
      };
    }

    // --- DROPPING: temperature falling, heat now ---
    if (pctDropping >= threshold && troughHour > 0) {
      const droppingDefrost = this.getDefrostSuffix(currentOutdoorTemp, this.forecast.hourly[0]?.humidity);
      return {
        delayHours: -troughHour,
        expectedCop: troughCop,
        currentCop,
        expectedTemp: troughTemp,
        currentTemp: currentOutdoorTemp,
        pctSavings: -Math.round(pctDropping),
        trend: 'dropping',
        adviceText: `Verwarm nú, over ${troughHour}u ${Math.round(pctDropping)}% minder rendement${droppingDefrost}`,
      };
    }

    // --- STABLE: no significant change ---
    return this.buildStableAdvice(currentOutdoorTemp, currentCop);
  }

  /**
   * Build advice for stable temperature conditions
   */
  private buildStableAdvice(currentTemp: number, currentCop: number): ForecastAdvice {
    const stableDefrost = this.getDefrostSuffix(currentTemp, this.forecast?.hourly[0]?.humidity);
    return {
      delayHours: 0,
      expectedCop: currentCop,
      currentCop,
      expectedTemp: currentTemp,
      currentTemp,
      pctSavings: 0,
      trend: 'stable',
      adviceText: `Geen forecast-voordeel${stableDefrost}`,
    };
  }

  /**
   * Returns a parenthesised defrost-pattern suffix when the DefrostLearner has
   * sufficient learned data and the penalty exceeds the display threshold.
   *
   * Example: " (❄️-9%)" or "" when not applicable.
   */
  private getDefrostSuffix(outdoorTemp: number, humidity?: number): string {
    if (!this.defrostLearner) return '';
    if (this.defrostLearner.getQualifiedBucketCount() === 0) return '';

    const penalty = this.defrostLearner.getDefrostPenalty(outdoorTemp, humidity);
    const pct = Math.round((1 - penalty) * 100);

    if (pct < 3) return '';
    return ` (❄️-${pct}%)`;
  }

  /**
   * Check if the building can sustain comfort during the proposed delay
   * Uses the learned thermal time constant (τ) from the building model.
   * Rule: delay should not exceed τ/3 to keep temperature drop acceptable.
   */
  private isDelayFeasible(delayHours: number): boolean {
    try {
      const tau = this.device.getCapabilityValue('adlar_building_tau');
      if (tau == null || tau <= 0) return true; // No data, allow delay
      return delayHours <= tau / 3;
    } catch {
      return true; // Capability not available, allow delay
    }
  }

  /**
   * Get the maximum feasible delay in hours based on thermal time constant
   */
  private getMaxFeasibleDelay(): number {
    try {
      const tau = this.device.getCapabilityValue('adlar_building_tau');
      if (tau == null || tau <= 0) return 12; // Default max
      return Math.floor(tau / 3);
    } catch {
      return 12;
    }
  }

  /**
   * Check if forecast data is available and fresh
   */
  public hasFreshForecast(): boolean {
    if (!this.forecast) return false;
    return Date.now() < this.forecast.validUntil;
  }

  /**
   * Get the full forecast (if available)
   */
  public getForecast(): WeatherForecast | null {
    return this.forecast;
  }

  /**
   * Calculate the net COP correction percentage for the current forecast hour.
   *
   * Compares base COP (temperature only) to corrected COP (with wind + defrost).
   * Positive = beneficial (wind boost), negative = penalty (defrost).
   *
   * @returns Correction percentage (e.g. -8.5 means 8.5% COP reduction) or null
   */
  public getCurrentCopCorrectionPct(): number | null {
    if (!this.forecast || this.forecast.hourly.length === 0) return null;

    const current = this.forecast.hourly[0];
    if (!current) return null;

    const baseCop = this.estimateCop(current.temperature);
    const correctedCop = this.estimateCop(current.temperature, current.humidity, current.windSpeed);

    if (baseCop === 0) return null;
    return Math.round(((correctedCop - baseCop) / baseCop) * 1000) / 10;
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.stopUpdates();
    this.forecast = null;
    this.logger('WeatherForecastService: Destroyed');
  }
}
