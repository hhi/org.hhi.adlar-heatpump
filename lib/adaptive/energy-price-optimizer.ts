/**
 * Energy Price Optimizer - Component 3 of Adaptive Control System
 *
 * Receives energy prices via flow card to optimize heating schedule
 * based on electricity prices.
 *
 * Strategy (thresholds based on 2024 EPEX NL spot price percentiles):
 * - VERY_LOW prices (<€0.04/kWh, P10): Pre-heat maximally (+1.5°C)
 * - LOW prices (€0.04-0.06, P10-P30): Pre-heat moderately (+0.75°C)
 * - NORMAL prices (€0.06-0.10, P30-P70): Maintain (0°C)
 * - HIGH prices (€0.10-0.12, P70-P90): Reduce moderately (-0.5°C)
 * - VERY_HIGH prices (>€0.12/kWh, P90): Reduce maximally (-1.0°C)
 *
 * Note: Thresholds apply to RAW market price (excl. VAT/fees).
 * The 2024 NL average was ~€0.077/kWh with σ≈€0.028/kWh.
 *
 * @version 1.4.0
 * @since 1.4.0
 */

export enum PriceCategory {
  VERY_LOW = 'very_low',
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}

export interface PriceThresholds {
  veryLow: number; // €0.04/kWh (P10 percentile)
  low: number; // €0.06/kWh (P30 percentile)
  normal: number; // €0.10/kWh (P70 percentile)
  high: number; // €0.12/kWh (P90 percentile)
}

export interface PriceData {
  timestamp: number; // Unix timestamp (ms)
  price: number; // €/kWh (including VAT)
  category: PriceCategory;
}

export interface EnergyOptimizerConfig {
  thresholds: PriceThresholds;
  maxPreHeatOffset: number; // 1.5°C
  maxReduceOffset: number; // -1.0°C
  lookAheadHours: number; // 4 hours
  logger?: (msg: string, ...args: unknown[]) => void;
}

/**
 * Financial components for calculating effective energy price
 * Storage fee and energy tax are INCL. VAT (as received from supplier)
 * VAT percentage is applied only to the base market price
 */
export interface FinancialComponents {
  storageFee: number; // Inkoopvergoeding / leveranciersopslag (€/kWh, INCL. BTW)
  energyTax: number; // Energiebelasting (€/kWh, INCL. BTW)
  vatPercentage: number; // BTW-percentage (e.g., 21 for 21%)
}

export interface PriceAction {
  action: 'preheat' | 'maintain' | 'reduce';
  magnitude: number; // °C adjustment
  priority: 'low' | 'medium' | 'high';
  reason: string;
  currentPrice: number;
  futurePrice?: number;
}

/**
 * Block analysis result for cheapest/expensive time windows
 * @since v2.5.0
 */
export interface BlockAnalysis {
  startTime: Date;
  endTime: Date;
  avgPrice: number; // €/kWh (average price for block)
  totalHours: number;
}

/**
 * Statistical analysis of price data
 * @since v2.5.0
 */
export interface PriceStats {
  min: number; // €/kWh
  max: number; // €/kWh
  avg: number; // €/kWh
  median: number; // €/kWh
  stdDev: number; // €/kWh (standard deviation)
  sampleSize: number;
}

/**
 * Price trend classification
 * @since v2.5.0
 */
export type PriceTrend = 'rising' | 'falling' | 'stable';

/**
 * Price trend analysis result with confidence
 * @since v2.5.0
 */
export interface PriceTrendAnalysis {
  trend: PriceTrend;
  slope: number; // €/kWh per hour (positive = rising, negative = falling)
  confidence: number; // 0.0-1.0 (R² from linear regression)
}

/**
 * Energy Price Optimizer
 *
 * Fetches day-ahead electricity prices and provides temperature adjustment
 * recommendations based on price categories.
 */
export class EnergyPriceOptimizer {
  private config: EnergyOptimizerConfig;
  private priceData: PriceData[] = [];
  private lastFetch: number = 0;
  private logger: (msg: string, ...args: unknown[]) => void;

  // Cost accumulation state
  private accumulatedDailyCost: number = 0;
  private lastEnergyTotal: number = 0;

  // Hourly cost accumulation (actual costs for current hour)
  private accumulatedHourlyCost: number = 0;
  private hourStartEnergy: number = 0;
  private currentHour: number = new Date().getHours();

  // Financial components (MUST be set via device settings - setFinancialComponents())
  // Initial values are placeholders; actual values come from loadPriceSettings()
  private financialComponents: FinancialComponents = {
    storageFee: 0, // Will be set by loadPriceSettings()
    energyTax: 0, // Will be set by loadPriceSettings()
    vatPercentage: 0, // Will be set by loadPriceSettings()
  };

  // Price calculation mode: 'market', 'market_plus', 'all_in'
  private priceMode: 'market' | 'market_plus' | 'all_in' = 'all_in';

  constructor(config: EnergyOptimizerConfig) {
    this.config = config;
    this.logger = config.logger || (() => { });
  }

  /**
   * Update price thresholds from device settings
   * @version 2.4.7 - Bug fix: thresholds were hardcoded, now loaded from settings
   */
  public setThresholds(thresholds: {
    veryLow: number;
    low: number;
    normal: number;
    high: number;
  }): void {
    this.config.thresholds = thresholds;
    this.logger('EnergyPriceOptimizer: Thresholds updated', {
      veryLow: `€${thresholds.veryLow.toFixed(4)}/kWh`,
      low: `€${thresholds.low.toFixed(4)}/kWh`,
      normal: `€${thresholds.normal.toFixed(4)}/kWh`,
      high: `€${thresholds.high.toFixed(4)}/kWh`,
    });
  }

  /**
   * Categorize price into bands
   */
  private categorizePrice(price: number): PriceCategory {
    if (price < this.config.thresholds.veryLow) return PriceCategory.VERY_LOW;
    if (price < this.config.thresholds.low) return PriceCategory.LOW;
    if (price < this.config.thresholds.normal) return PriceCategory.NORMAL;
    if (price < this.config.thresholds.high) return PriceCategory.HIGH;
    return PriceCategory.VERY_HIGH;
  }

  /**
   * Calculate recommended action based on current and future prices
   */
  public calculateAction(currentIndoorTemp: number, targetTemp: number): PriceAction | null {
    if (this.priceData.length === 0) {
      this.logger('EnergyPriceOptimizer: No price data available');
      return null;
    }

    const now = Date.now();
    const currentPrice = this.getCurrentPrice(now);
    const futurePrice = this.getAveragePrice(now, this.config.lookAheadHours);

    if (!currentPrice) {
      this.logger('EnergyPriceOptimizer: No current price found');
      return null;
    }

    // Decision logic based on price category
    const { category } = currentPrice;

    switch (category) {
      case PriceCategory.VERY_LOW:
        // Pre-heat maximum if cheap period
        if (currentIndoorTemp < targetTemp + this.config.maxPreHeatOffset) {
          return {
            action: 'preheat',
            magnitude: this.config.maxPreHeatOffset,
            priority: 'high',
            reason: `Very low price (€${currentPrice.price.toFixed(4)}/kWh) - pre-heating maximally`,
            currentPrice: currentPrice.price,
            futurePrice: futurePrice?.price,
          };
        }
        break;

      case PriceCategory.LOW:
        // Pre-heat moderately
        if (currentIndoorTemp < targetTemp + this.config.maxPreHeatOffset / 2) {
          return {
            action: 'preheat',
            magnitude: this.config.maxPreHeatOffset / 2,
            priority: 'medium',
            reason: `Low price (€${currentPrice.price.toFixed(4)}/kWh) - pre-heating moderately`,
            currentPrice: currentPrice.price,
            futurePrice: futurePrice?.price,
          };
        }
        break;

      case PriceCategory.HIGH:
        // Reduce moderately
        if (currentIndoorTemp > targetTemp + this.config.maxReduceOffset / 2) {
          return {
            action: 'reduce',
            magnitude: this.config.maxReduceOffset / 2,
            priority: 'medium',
            reason: `High price (€${currentPrice.price.toFixed(4)}/kWh) - reducing moderately`,
            currentPrice: currentPrice.price,
            futurePrice: futurePrice?.price,
          };
        }
        break;

      case PriceCategory.VERY_HIGH:
        // Reduce maximally
        if (currentIndoorTemp > targetTemp + this.config.maxReduceOffset) {
          return {
            action: 'reduce',
            magnitude: this.config.maxReduceOffset,
            priority: 'high',
            reason: `Very high price (€${currentPrice.price.toFixed(4)}/kWh) - reducing maximally`,
            currentPrice: currentPrice.price,
            futurePrice: futurePrice?.price,
          };
        }
        break;

      case PriceCategory.NORMAL:
      default:
        // Maintain current behavior
        return {
          action: 'maintain',
          magnitude: 0,
          priority: 'low',
          reason: `Normal price (€${currentPrice.price.toFixed(4)}/kWh) - maintaining`,
          currentPrice: currentPrice.price,
          futurePrice: futurePrice?.price,
        };
    }

    // Default: maintain
    return {
      action: 'maintain',
      magnitude: 0,
      priority: 'low',
      reason: 'No optimization action needed',
      currentPrice: currentPrice.price,
      futurePrice: futurePrice?.price,
    };
  }

  /**
   * Get current price data point
   * @version 2.4.8 - Category is now calculated on-demand with current thresholds
   */
  public getCurrentPrice(timestamp: number): PriceData | null {
    // Find price for current hour
    const hourStart = new Date(timestamp);
    hourStart.setMinutes(0, 0, 0);

    const found = this.priceData.find((p) => {
      const priceHour = new Date(p.timestamp);
      priceHour.setMinutes(0, 0, 0);
      return priceHour.getTime() === hourStart.getTime();
    });

    if (!found) return null;

    // v2.4.8: Always calculate category on-demand with current thresholds
    // This ensures threshold changes and restarts use correct categories
    return {
      ...found,
      category: this.categorizePrice(found.price),
    };
  }

  /**
   * Get average price for next N hours
   * @version 2.5.0 - Bug fix: now returns effective price based on priceMode
   */
  public getAveragePrice(timestamp: number, hoursAhead: number): PriceData | null {
    const endTime = timestamp + hoursAhead * 3600000;

    const futurePrices = this.priceData.filter((p) => p.timestamp >= timestamp && p.timestamp <= endTime);

    if (futurePrices.length === 0) return null;

    // Calculate effective prices and average them
    const effectivePrices = futurePrices.map((p) => this.calculateEffectivePrice(p.price));
    const avgPrice = effectivePrices.reduce((sum, p) => sum + p, 0) / effectivePrices.length;
    const avgCategory = this.categorizePrice(avgPrice);

    return {
      timestamp: timestamp + (hoursAhead / 2) * 3600000,
      price: avgPrice,
      category: avgCategory,
    };
  }

  /**
   * Find cheapest consecutive N-hour block in available price data
   * Uses sliding window algorithm for O(n) efficiency
   *
   * @param hours - Block size in hours (1-12)
   * @returns Block analysis with start/end times and average price, or null if insufficient data
   * @since v2.5.0
   * @version 2.5.0 - Bug fix: now uses effective prices based on priceMode
   */
  public findCheapestBlock(hours: number): BlockAnalysis | null {
    // Input validation
    if (hours <= 0 || hours > 12) {
      this.logger('EnergyPriceOptimizer: Invalid block hours', { hours });
      return null;
    }

    if (this.priceData.length < hours) {
      this.logger('EnergyPriceOptimizer: Insufficient price data for block analysis', {
        required: hours,
        available: this.priceData.length,
      });
      return null;
    }

    let minAvgPrice = Infinity;
    let bestStartIndex = 0;

    // Sliding window: calculate average effective price for each possible window position
    for (let i = 0; i <= this.priceData.length - hours; i++) {
      const windowPrices = this.priceData.slice(i, i + hours);
      const avgPrice = windowPrices.reduce((sum, p) => sum + this.calculateEffectivePrice(p.price), 0) / hours;

      if (avgPrice < minAvgPrice) {
        minAvgPrice = avgPrice;
        bestStartIndex = i;
      }
    }

    // Build result
    const startTime = new Date(this.priceData[bestStartIndex].timestamp);
    const endTime = new Date(this.priceData[bestStartIndex + hours - 1].timestamp);
    endTime.setHours(endTime.getHours() + 1); // End of last hour

    return {
      startTime,
      endTime,
      avgPrice: minAvgPrice,
      totalHours: hours,
    };
  }

  /**
   * Find most expensive consecutive N-hour block in available price data
   * Inverse of findCheapestBlock()
   *
   * @param hours - Block size in hours (1-12)
   * @returns Block analysis with start/end times and average price, or null if insufficient data
   * @since v2.5.0
   * @version 2.5.0 - Bug fix: now uses effective prices based on priceMode
   */
  public findMostExpensiveBlock(hours: number): BlockAnalysis | null {
    // Input validation
    if (hours <= 0 || hours > 12) {
      this.logger('EnergyPriceOptimizer: Invalid block hours', { hours });
      return null;
    }

    if (this.priceData.length < hours) {
      this.logger('EnergyPriceOptimizer: Insufficient price data for block analysis', {
        required: hours,
        available: this.priceData.length,
      });
      return null;
    }

    let maxAvgPrice = -Infinity;
    let bestStartIndex = 0;

    // Sliding window: calculate average effective price for each possible window position
    for (let i = 0; i <= this.priceData.length - hours; i++) {
      const windowPrices = this.priceData.slice(i, i + hours);
      const avgPrice = windowPrices.reduce((sum, p) => sum + this.calculateEffectivePrice(p.price), 0) / hours;

      if (avgPrice > maxAvgPrice) {
        maxAvgPrice = avgPrice;
        bestStartIndex = i;
      }
    }

    // Build result
    const startTime = new Date(this.priceData[bestStartIndex].timestamp);
    const endTime = new Date(this.priceData[bestStartIndex + hours - 1].timestamp);
    endTime.setHours(endTime.getHours() + 1); // End of last hour

    return {
      startTime,
      endTime,
      avgPrice: maxAvgPrice,
      totalHours: hours,
    };
  }

  /**
   * Calculate statistical measures for price data
   *
   * @param hoursAhead - Optional: only analyze next N hours (default: all data)
   * @returns Price statistics including min, max, avg, median, std deviation
   * @since v2.5.0
   * @version 2.5.0 - Bug fix: now uses effective prices based on priceMode
   */
  public getPriceStatistics(hoursAhead?: number): PriceStats | null {
    let dataToAnalyze = this.priceData;

    // Filter by time window if specified
    if (hoursAhead !== undefined) {
      const now = Date.now();
      const endTime = now + hoursAhead * 3600000;
      dataToAnalyze = this.priceData.filter((p) => p.timestamp >= now && p.timestamp <= endTime);
    }

    if (dataToAnalyze.length === 0) {
      this.logger('EnergyPriceOptimizer: No price data available for statistics');
      return null;
    }

    // Extract and transform to effective prices
    const prices = dataToAnalyze.map((p) => this.calculateEffectivePrice(p.price));

    // Calculate basic statistics
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const sum = prices.reduce((acc, p) => acc + p, 0);
    const avg = sum / prices.length;

    // Calculate median
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sortedPrices.length / 2);
    const median = sortedPrices.length % 2 === 0
      ? (sortedPrices[mid - 1] + sortedPrices[mid]) / 2
      : sortedPrices[mid];

    // Calculate standard deviation
    const variance = prices.reduce((acc, p) => acc + Math.pow(p - avg, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);

    return {
      min,
      max,
      avg,
      median,
      stdDev,
      sampleSize: prices.length,
    };
  }

  /**
   * Calculate price trend using simple linear regression
   *
   * @param hoursAhead - Number of hours to analyze (minimum 3)
   * @returns Trend analysis with direction, slope, and confidence (R²)
   * @since v2.5.0
   * @version 2.5.0 - Bug fix: now uses effective prices based on priceMode
   */
  public calculatePriceTrend(hoursAhead: number): PriceTrendAnalysis | null {
    const now = Date.now();
    const endTime = now + hoursAhead * 3600000;

    const futurePrices = this.priceData.filter((p) => p.timestamp >= now && p.timestamp <= endTime);

    if (futurePrices.length < 3) {
      this.logger('EnergyPriceOptimizer: Insufficient data for trend analysis', {
        required: 3,
        available: futurePrices.length,
      });
      return null;
    }

    // Linear regression: y = mx + b
    const n = futurePrices.length;
    const x = futurePrices.map((_, i) => i); // Time index (0, 1, 2, ...)
    const y = futurePrices.map((p) => this.calculateEffectivePrice(p.price)); // Effective prices

    const sumX = x.reduce((acc, val) => acc + val, 0);
    const sumY = y.reduce((acc, val) => acc + val, 0);
    const sumXY = x.reduce((acc, val, i) => acc + val * y[i], 0);
    const sumX2 = x.reduce((acc, val) => acc + val * val, 0);

    // Calculate slope (m)
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Calculate R² (coefficient of determination) for confidence
    const meanY = sumY / n;
    const ssTotal = y.reduce((acc, val) => acc + Math.pow(val - meanY, 2), 0);
    const intercept = (sumY - slope * sumX) / n;
    const ssResidual = y.reduce((acc, val, i) => acc + Math.pow(val - (slope * x[i] + intercept), 2), 0);
    const rSquared = 1 - (ssResidual / ssTotal);

    // Classify trend (threshold: ±0.0001 €/kWh per hour)
    const threshold = 0.0001;
    let trend: PriceTrend;
    if (slope > threshold) {
      trend = 'rising';
    } else if (slope < -threshold) {
      trend = 'falling';
    } else {
      trend = 'stable';
    }

    return {
      trend,
      slope,
      confidence: Math.max(0, Math.min(1, rSquared)), // Clamp to 0-1
    };
  }

  /**
   * Check if current hour has lowest price in ±windowHours range
   *
   * @param windowHours - Time window to check (hours before and after current)
   * @returns True if current hour is a local minimum
   * @since v2.5.0
   */
  public isLocalMinimum(windowHours: number): boolean {
    const now = Date.now();
    const currentPrice = this.getCurrentPrice(now);

    if (!currentPrice) {
      return false;
    }

    const windowStart = now - windowHours * 3600000;
    const windowEnd = now + windowHours * 3600000;

    const windowPrices = this.priceData.filter(
      (p) => p.timestamp >= windowStart && p.timestamp <= windowEnd,
    );

    if (windowPrices.length === 0) {
      return false;
    }

    // Check if current price is minimum in window
    const minPrice = Math.min(...windowPrices.map((p) => p.price));
    return currentPrice.price <= minPrice;
  }

  /**
   * Check if current hour has highest price in ±windowHours range
   *
   * @param windowHours - Time window to check (hours before and after current)
   * @returns True if current hour is a local maximum
   * @since v2.5.0
   */
  public isLocalMaximum(windowHours: number): boolean {
    const now = Date.now();
    const currentPrice = this.getCurrentPrice(now);

    if (!currentPrice) {
      return false;
    }

    const windowStart = now - windowHours * 3600000;
    const windowEnd = now + windowHours * 3600000;

    const windowPrices = this.priceData.filter(
      (p) => p.timestamp >= windowStart && p.timestamp <= windowEnd,
    );

    if (windowPrices.length === 0) {
      return false;
    }

    // Check if current price is maximum in window
    const maxPrice = Math.max(...windowPrices.map((p) => p.price));
    return currentPrice.price >= maxPrice;
  }

  /**
   * Calculate current hourly cost based on power and effective price
   * Includes financial components (storage fee, energy tax, VAT)
   */
  public calculateCurrentCost(currentPowerWatts: number): number {
    const effectivePrice = this.getEffectivePrice();
    if (effectivePrice === 0) return 0;

    // Convert W to kW, multiply by effective price
    return (currentPowerWatts / 1000) * effectivePrice;
  }

  /**
   * Calculate effective price from raw market price (respects priceMode)
   * Internal helper for transforming raw market prices to effective prices.
   *
   * @param rawPrice - Raw market price (€/kWh, excl. VAT) from priceData
   * @returns Effective price (€/kWh) based on priceMode setting
   * @version 2.5.0 - Bug fix: price capabilities now use effective prices
   * @private
   */
  private calculateEffectivePrice(rawPrice: number): number {
    const { storageFee, energyTax, vatPercentage } = this.financialComponents;

    // Market price with VAT (always included)
    const marketPriceIncVat = rawPrice * (1 + vatPercentage / 100);

    // Calculate based on price mode
    switch (this.priceMode) {
      case 'market':
        // Only market price + VAT
        return marketPriceIncVat;

      case 'market_plus':
        // Market + VAT + supplier fee
        return marketPriceIncVat + storageFee;

      case 'all_in':
      default:
        // Market + VAT + supplier fee + energy tax
        return marketPriceIncVat + storageFee + energyTax;
    }
  }

  /**
   * Get effective price based on price calculation mode
   *
   * Formulas:
   * - market:      P_market_ex × (1 + vat)
   * - market_plus: P_market_ex × (1 + vat) + P_fee_inc
   * - all_in:      P_market_ex × (1 + vat) + P_fee_inc + P_tax_inc
   *
   * Where:
   * - P_market_ex = spot market price EXCL. VAT (from priceData)
   * - P_fee_inc = storage/supplier fee INCL. VAT
   * - P_tax_inc = energy tax INCL. VAT
   * - vat = VAT percentage (e.g., 0.21 for 21%)
   *
   * @param timestamp - Optional timestamp (ms), defaults to current time
   */
  public getEffectivePrice(timestamp?: number): number {
    const ts = timestamp ?? Date.now();
    const priceData = this.getCurrentPrice(ts);
    if (!priceData) return 0;

    return this.calculateEffectivePrice(priceData.price);
  }

  /**
   * Set the price calculation mode
   * @param mode - 'market', 'market_plus', or 'all_in'
   */
  public setPriceMode(mode: 'market' | 'market_plus' | 'all_in'): void {
    this.priceMode = mode;
    this.logger(`EnergyPriceOptimizer: Price mode set to ${mode}`);
  }

  /**
   * Get current price calculation mode
   */
  public getPriceMode(): string {
    return this.priceMode;
  }

  /**
   * Accumulate cost based on energy consumption delta
   * Called from EnergyTrackingService every 10 seconds
   *
   * @param deltaKWh - Energy consumed since last update (kWh)
   * @returns The cost increment that was added (€)
   */
  public accumulateCost(deltaKWh: number): number {
    if (deltaKWh <= 0) return 0;

    const effectivePrice = this.getEffectivePrice();
    if (effectivePrice === 0) {
      this.logger('EnergyPriceOptimizer: No price data available for cost accumulation');
      return 0;
    }

    const costIncrement = deltaKWh * effectivePrice;
    this.accumulatedDailyCost += costIncrement;

    this.logger(
      `EnergyPriceOptimizer: Cost accumulated: +€${costIncrement.toFixed(4)} `
      + `(${deltaKWh.toFixed(4)} kWh × €${effectivePrice.toFixed(4)}/kWh), `
      + `daily total: €${this.accumulatedDailyCost.toFixed(2)}`,
    );

    return costIncrement;
  }

  /**
   * Get accumulated daily cost
   * @returns Accumulated daily cost in €
   */
  public getAccumulatedDailyCost(): number {
    return this.accumulatedDailyCost;
  }

  /**
   * Accumulate hourly cost based on energy delta
   * Detects hour boundaries and resets accumulator when new hour starts
   *
   * @param currentEnergyTotal - Current total energy (kWh) from adlar_external_energy_daily
   * @returns The accumulated hourly cost so far (€)
   */
  public accumulateHourlyCost(currentEnergyTotal: number): number {
    const now = new Date();
    const hour = now.getHours();

    // Detect hour boundary - reset if new hour
    if (hour !== this.currentHour) {
      this.logger(`EnergyPriceOptimizer: Hour boundary crossed (${this.currentHour} → ${hour}), resetting hourly cost`);
      this.accumulatedHourlyCost = 0;
      this.hourStartEnergy = currentEnergyTotal;
      this.currentHour = hour;
    }

    // Initialize hourStartEnergy if not set (first call)
    if (this.hourStartEnergy === 0) {
      this.hourStartEnergy = currentEnergyTotal;
    }

    // Calculate delta energy for this hour
    const deltaKWh = currentEnergyTotal - this.hourStartEnergy;

    // Calculate cost for this delta using effective price
    const effectivePrice = this.getEffectivePrice();
    if (effectivePrice > 0 && deltaKWh > 0) {
      this.accumulatedHourlyCost = deltaKWh * effectivePrice;
    }

    this.logger(`EnergyPriceOptimizer DEBUG: Hourly Cost Check - Total=${currentEnergyTotal.toFixed(3)}, Start=${this.hourStartEnergy.toFixed(3)}, Delta=${deltaKWh.toFixed(5)}, Price=${effectivePrice.toFixed(3)}, Cost=${this.accumulatedHourlyCost.toFixed(4)}`);

    return this.accumulatedHourlyCost;
  }

  /**
   * Get accumulated hourly cost (actual cost for current hour)
   * @returns Accumulated hourly cost in €
   */
  public getAccumulatedHourlyCost(): number {
    return this.accumulatedHourlyCost;
  }

  /**
   * Reset daily cost accumulator (called at midnight)
   */
  public resetDailyCost(): void {
    const previousTotal = this.accumulatedDailyCost;
    this.accumulatedDailyCost = 0;
    this.lastEnergyTotal = 0;

    this.logger(`EnergyPriceOptimizer: Daily cost reset (previous: €${previousTotal.toFixed(2)})`);
  }

  /**
   * Set financial components from device settings
   * @param components - Financial components (storage fee, energy tax, VAT)
   */
  public setFinancialComponents(components: Partial<FinancialComponents>): void {
    this.financialComponents = {
      ...this.financialComponents,
      ...components,
    };

    this.logger(
      'EnergyPriceOptimizer: Financial components updated: '
      + `storage=€${this.financialComponents.storageFee.toFixed(4)}/kWh, `
      + `tax=€${this.financialComponents.energyTax.toFixed(4)}/kWh, `
      + `VAT=${this.financialComponents.vatPercentage}%`,
    );
  }

  /**
   * Get current financial components
   */
  public getFinancialComponents(): FinancialComponents {
    return { ...this.financialComponents };
  }

  /**
   * Calculate daily cost - now returns accumulated cost instead of estimate
   * @deprecated Use getAccumulatedDailyCost() for real-time accumulated cost
   */
  public calculateDailyCost(dailyConsumptionKWh: number): number {
    // Return accumulated cost if available, otherwise fall back to estimate
    if (this.accumulatedDailyCost > 0) {
      return this.accumulatedDailyCost;
    }

    // Fallback: estimate using average price (legacy behavior)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPrices = this.priceData.filter((p) => p.timestamp >= today.getTime());

    if (todayPrices.length === 0) return 0;

    const avgPrice = todayPrices.reduce((sum, p) => sum + p.price, 0) / todayPrices.length;
    return dailyConsumptionKWh * avgPrice;
  }

  /**
   * Get all price data (for UI display)
   */
  public getPriceData(): PriceData[] {
    return this.priceData;
  }

  /**
   * Set energy prices from external source (flow card)
   *
   * Accepts hourly prices from external flow card in format:
   * {"0": 0.11, "1": 0.10, "2": 0.09, ...}
   * where keys are hour offsets from now (0 = current hour, 1 = next hour, etc.)
   *
   * @param pricesObject - Object with hour offsets as keys and prices (€/kWh) as values
   * @throws Error if prices object is invalid or empty
   */
  public setExternalPrices(pricesObject: Record<string, number>): void {
    const now = Date.now();

    // Validate input
    if (!pricesObject || typeof pricesObject !== 'object') {
      throw new Error('Invalid prices object: must be an object with hour offsets as keys');
    }

    const entries = Object.entries(pricesObject);
    if (entries.length === 0) {
      throw new Error('Invalid prices object: must contain at least one price entry');
    }

    // Convert external prices to internal format
    const newPriceData: PriceData[] = [];

    for (const [hourOffsetStr, price] of entries) {
      // Validate hour offset
      const hourOffset = parseInt(hourOffsetStr, 10);
      if (Number.isNaN(hourOffset) || hourOffset < 0) {
        this.logger(`EnergyPriceOptimizer: Skipping invalid hour offset: ${hourOffsetStr}`);
        continue;
      }

      // Validate price value
      if (typeof price !== 'number' || Number.isNaN(price) || price < 0) {
        this.logger(`EnergyPriceOptimizer: Skipping invalid price for hour ${hourOffset}: ${price}`);
        continue;
      }

      // Calculate timestamp for this hour
      // Round current time to start of hour, then add offset
      const hourStart = new Date(now);
      hourStart.setMinutes(0, 0, 0);
      const timestamp = hourStart.getTime() + (hourOffset * 3600000);

      // Create price data entry (use price as-is, no VAT or adjustments)
      // Note: category is stored for backwards compatibility but getCurrentPrice()
      // recalculates it on-demand with current thresholds (v2.4.8)
      newPriceData.push({
        timestamp,
        price, // €/kWh as provided (raw market price)
        category: this.categorizePrice(price),
      });
    }

    if (newPriceData.length === 0) {
      throw new Error('No valid price entries found in input');
    }

    // Sort by timestamp (ascending)
    newPriceData.sort((a, b) => a.timestamp - b.timestamp);

    // Replace existing price data
    this.priceData = newPriceData;
    this.lastFetch = now;

    this.logger(
      `EnergyPriceOptimizer: Set ${newPriceData.length} external prices `
      + `(hours ${Object.keys(pricesObject).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).join(', ')})`,
    );
  }

  /**
   * Export state for persistence
   */
  public getState() {
    return {
      priceData: this.priceData,
      lastFetch: this.lastFetch,
      accumulatedDailyCost: this.accumulatedDailyCost,
      lastEnergyTotal: this.lastEnergyTotal,
      financialComponents: this.financialComponents,
      priceMode: this.priceMode,
      // Hourly cost state
      accumulatedHourlyCost: this.accumulatedHourlyCost,
      hourStartEnergy: this.hourStartEnergy,
      currentHour: this.currentHour,
    };
  }

  /**
   * Restore state from persistence
   */
  public restoreState(state: {
    priceData: PriceData[];
    lastFetch: number;
    accumulatedDailyCost?: number;
    lastEnergyTotal?: number;
    financialComponents?: FinancialComponents;
    priceMode?: 'market' | 'market_plus' | 'all_in';
    accumulatedHourlyCost?: number;
    hourStartEnergy?: number;
    currentHour?: number;
  }): void {
    this.priceData = state.priceData || [];
    this.lastFetch = state.lastFetch || 0;
    this.accumulatedDailyCost = state.accumulatedDailyCost || 0;
    this.lastEnergyTotal = state.lastEnergyTotal || 0;
    if (state.financialComponents) {
      this.financialComponents = state.financialComponents;
    }
    if (state.priceMode) {
      this.priceMode = state.priceMode;
    }
    // Restore hourly cost state
    this.accumulatedHourlyCost = state.accumulatedHourlyCost || 0;
    this.hourStartEnergy = state.hourStartEnergy || 0;
    // Only restore hour if it matches current hour (otherwise reset)
    const now = new Date();
    if (state.currentHour === now.getHours()) {
      this.currentHour = state.currentHour;
    } else {
      // Hour changed during restart - reset hourly accumulator
      this.currentHour = now.getHours();
      this.accumulatedHourlyCost = 0;
      this.hourStartEnergy = 0;
      this.logger('EnergyPriceOptimizer: Hour changed during restart, resetting hourly cost');
    }
  }

  /**
   * Destroy and release all memory (v2.0.1+)
   *
   * Called during device deletion to prevent memory leaks.
   * Clears the price data array.
   */
  public destroy(): void {
    const dataSize = this.priceData.length;

    this.priceData = [];
    this.lastFetch = 0;

    this.logger(`EnergyPriceOptimizer: Destroyed - released ${dataSize} price data points`);
  }
}
