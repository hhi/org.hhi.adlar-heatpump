/**
 * Energy Price Optimizer - Component 3 of Adaptive Control System
 *
 * Receives energy prices via flow card to optimize heating schedule
 * based on electricity prices.
 *
 * Strategy:
 * - VERY_LOW prices (<€0.10/kWh): Pre-heat maximally (+1.5°C)
 * - LOW prices (€0.10-0.15): Pre-heat moderately (+0.75°C)
 * - NORMAL prices (€0.15-0.25): Maintain (0°C)
 * - HIGH prices (€0.25-0.35): Reduce moderately (-0.5°C)
 * - VERY_HIGH prices (>€0.35): Reduce maximally (-1.0°C)
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
  veryLow: number; // €0.10/kWh
  low: number; // €0.15/kWh
  normal: number; // €0.25/kWh
  high: number; // €0.35/kWh
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

export interface PriceAction {
  action: 'preheat' | 'maintain' | 'reduce';
  magnitude: number; // °C adjustment
  priority: 'low' | 'medium' | 'high';
  reason: string;
  currentPrice: number;
  futurePrice?: number;
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

  constructor(config: EnergyOptimizerConfig) {
    this.config = config;
    this.logger = config.logger || (() => {});
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
   */
  public getCurrentPrice(timestamp: number): PriceData | null {
    // Find price for current hour
    const hourStart = new Date(timestamp);
    hourStart.setMinutes(0, 0, 0);

    return (
      this.priceData.find((p) => {
        const priceHour = new Date(p.timestamp);
        priceHour.setMinutes(0, 0, 0);
        return priceHour.getTime() === hourStart.getTime();
      }) || null
    );
  }

  /**
   * Get average price for next N hours
   */
  public getAveragePrice(timestamp: number, hoursAhead: number): PriceData | null {
    const endTime = timestamp + hoursAhead * 3600000;

    const futurePrices = this.priceData.filter((p) => p.timestamp >= timestamp && p.timestamp <= endTime);

    if (futurePrices.length === 0) return null;

    const avgPrice = futurePrices.reduce((sum, p) => sum + p.price, 0) / futurePrices.length;
    const avgCategory = this.categorizePrice(avgPrice);

    return {
      timestamp: timestamp + (hoursAhead / 2) * 3600000,
      price: avgPrice,
      category: avgCategory,
    };
  }

  /**
   * Calculate current hourly cost based on power and price
   */
  public calculateCurrentCost(currentPowerWatts: number): number {
    const currentPrice = this.getCurrentPrice(Date.now());
    if (!currentPrice) return 0;

    // Convert W to kW, multiply by price
    return (currentPowerWatts / 1000) * currentPrice.price;
  }

  /**
   * Calculate daily cost based on consumption and average price
   */
  public calculateDailyCost(dailyConsumptionKWh: number): number {
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
      if (isNaN(hourOffset) || hourOffset < 0) {
        this.logger(`EnergyPriceOptimizer: Skipping invalid hour offset: ${hourOffsetStr}`);
        continue;
      }

      // Validate price value
      if (typeof price !== 'number' || isNaN(price) || price < 0) {
        this.logger(`EnergyPriceOptimizer: Skipping invalid price for hour ${hourOffset}: ${price}`);
        continue;
      }

      // Calculate timestamp for this hour
      // Round current time to start of hour, then add offset
      const hourStart = new Date(now);
      hourStart.setMinutes(0, 0, 0);
      const timestamp = hourStart.getTime() + (hourOffset * 3600000);

      // Create price data entry (use price as-is, no VAT or adjustments)
      newPriceData.push({
        timestamp,
        price, // €/kWh as provided
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
    };
  }

  /**
   * Restore state from persistence
   */
  public restoreState(state: { priceData: PriceData[]; lastFetch: number }): void {
    this.priceData = state.priceData || [];
    this.lastFetch = state.lastFetch || 0;
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
