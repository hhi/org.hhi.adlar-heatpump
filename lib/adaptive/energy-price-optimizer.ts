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

/**
 * Financial components for calculating effective energy price
 * Storage fee and energy tax are INCL. VAT (as received from supplier)
 * VAT percentage is applied only to the base market price
 */
export interface FinancialComponents {
  storageFee: number;   // Inkoopvergoeding / leveranciersopslag (€/kWh, INCL. BTW)
  energyTax: number;    // Energiebelasting (€/kWh, INCL. BTW)
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

  // Financial components (set via device settings)
  private financialComponents: FinancialComponents = {
    storageFee: 0.0182,    // Default supplier fee (incl. VAT)
    energyTax: 0.11085,    // Default energy tax (incl. VAT)
    vatPercentage: 21,     // Default 21% VAT in Netherlands
  };

  // Price calculation mode: 'market', 'market_plus', 'all_in'
  private priceMode: 'market' | 'market_plus' | 'all_in' = 'all_in';

  constructor(config: EnergyOptimizerConfig) {
    this.config = config;
    this.logger = config.logger || (() => { });
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
   */
  public getEffectivePrice(): number {
    const currentPrice = this.getCurrentPrice(Date.now());
    if (!currentPrice) return 0;

    const { storageFee, energyTax, vatPercentage } = this.financialComponents;

    // Market price with VAT (always included)
    const marketPriceIncVat = currentPrice.price * (1 + vatPercentage / 100);

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
      `EnergyPriceOptimizer: Financial components updated: `
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
