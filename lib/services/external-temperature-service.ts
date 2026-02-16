/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';

/**
 * ExternalTemperatureService - External Indoor Temperature Management
 *
 * Receives indoor temperature from external sensors via flow cards.
 * Follows the same pattern as adlar_external_power, adlar_external_ambient, etc.
 *
 * Pattern:
 * 1. User creates flow: "WHEN sensor changes THEN Send indoor temperature to heat pump"
 * 2. Flow card updates `adlar_external_indoor_temperature` capability
 * 3. This service reads the capability value
 * 4. Adaptive control uses the temperature
 *
 * Brand-agnostic: Works with ANY Homey temperature sensor (Nest, Tado, Zigbee, etc.)
 *
 * @version 1.0.0 (Fase 1 MVP)
 */

export interface ExternalTemperatureServiceConfig {
  device: Homey.Device;
  logger?: (message: string, ...args: unknown[]) => void;
}

export interface TemperatureHealth {
  hasValidData: boolean;
  temperature: number | null;
  lastUpdated: number | null;
  timeSinceUpdate: number | null;
  error?: string;
}

export class ExternalTemperatureService {
  private device: Homey.Device;
  private logger: (message: string, ...args: unknown[]) => void;
  private lastReceivedTimestamp: number = 0;

  /**
   * @param config.device - Owning Homey device
   * @param config.logger - Logger callback
   */
  constructor(config: ExternalTemperatureServiceConfig) {
    this.device = config.device;
    this.logger = config.logger || (() => {});

    this.logger('ExternalTemperatureService: Initialized (flow card pattern)');
  }

  /**
   * Get current indoor temperature from external sensor
   *
   * Reads the `measure_temperature.indoor` subcapability which is
   * updated by the `receive_external_indoor_temperature` flow card.
   *
   * @returns Temperature in °C, or null if no data received yet
   */
  getIndoorTemperature(): number | null {
    try {
      if (!this.device.hasCapability('measure_temperature.indoor')) {
        this.logger('ExternalTemperatureService: Capability measure_temperature.indoor not available');
        return null;
      }

      const temperature = this.device.getCapabilityValue('measure_temperature.indoor') as number | null;

      if (temperature === null || temperature === undefined) {
        this.logger('ExternalTemperatureService: No external indoor temperature received yet');
        return null;
      }

      // Sanity check: temperature should be within reasonable range
      if (temperature < -10 || temperature > 50) {
        this.logger('ExternalTemperatureService: Temperature out of valid range', {
          temperature,
          validRange: '-20°C to +50°C',
        });
        return null;
      }

      this.logger('ExternalTemperatureService: Indoor temperature', { temperature });
      return temperature;

    } catch (error) {
      this.logger('ExternalTemperatureService: Error reading indoor temperature', {
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Receive external indoor temperature (called by flow card handler)
   *
   * This method is called when the `receive_external_indoor_temperature`
   * flow card is triggered. It updates the capability and records timestamp.
   *
   * @param temperature - Indoor temperature in °C
   */
  async receiveExternalTemperature(temperature: number): Promise<void> {
    try {
      // Validate temperature
      if (typeof temperature !== 'number' || Number.isNaN(temperature)) {
        throw new Error(`Invalid temperature value: ${temperature}`);
      }

      if (temperature < -10 || temperature > 50) {
        throw new Error(`Temperature out of valid range: ${temperature}°C (must be -10°C to +50°C)`);
      }

      // Update NEW capability (v2.3.5+)
      if (this.device.hasCapability('measure_temperature.indoor')) {
        await this.device.setCapabilityValue('measure_temperature.indoor', temperature);
      }

      // Update LEGACY capability (backwards compatibility - CRITICAL!)
      if (this.device.hasCapability('adlar_external_indoor_temperature')) {
        await this.device.setCapabilityValue('adlar_external_indoor_temperature', temperature);
      }

      // Store for persistence across app updates
      await this.device.setStoreValue('external_indoor_temp', temperature);

      this.lastReceivedTimestamp = Date.now();

      this.logger('ExternalTemperatureService: Received external indoor temperature', {
        temperature,
        timestamp: new Date(this.lastReceivedTimestamp).toISOString(),
      });

      // Update diagnostic capability
      if (this.device.hasCapability('adlar_last_indoor_temp_received')) {
        const d = new Date(this.lastReceivedTimestamp);
        const ts = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        await this.device.setCapabilityValue('adlar_last_indoor_temp_received', `${ts} | ${temperature.toFixed(1)}°C`);
      }

    } catch (error) {
      this.logger('ExternalTemperatureService: Error receiving external temperature', {
        temperature,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Check if external temperature data is available and recent
   *
   * @param maxAgeMinutes - Maximum age of data in minutes (default: 10)
   * @returns Health status with diagnostics
   */
  getTemperatureHealth(maxAgeMinutes: number = 10): TemperatureHealth {
    try {
      const temperature = this.getIndoorTemperature();

      if (temperature === null) {
        return {
          hasValidData: false,
          temperature: null,
          lastUpdated: null,
          timeSinceUpdate: null,
          error: 'No external indoor temperature received yet',
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
          temperature,
          lastUpdated: this.lastReceivedTimestamp,
          timeSinceUpdate,
          error: `Data is stale (${Math.round(timeSinceUpdate! / 60000)} minutes old, max ${maxAgeMinutes} minutes)`,
        };
      }

      return {
        hasValidData: true,
        temperature,
        lastUpdated: this.lastReceivedTimestamp,
        timeSinceUpdate,
      };

    } catch (error) {
      return {
        hasValidData: false,
        temperature: null,
        lastUpdated: null,
        timeSinceUpdate: null,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Check if external temperature is configured and has data
   *
   * @returns true if capability exists and has valid temperature
   */
  isConfigured(): boolean {
    return this.device.hasCapability('measure_temperature.indoor')
      && this.getIndoorTemperature() !== null;
  }

  /**
   * Get time since last temperature update
   *
   * @returns Milliseconds since last update, or null if no data received
   */
  getTimeSinceLastUpdate(): number | null {
    if (this.lastReceivedTimestamp === 0) {
      return null;
    }
    return Date.now() - this.lastReceivedTimestamp;
  }

  /**
   * Destroy service and clean up resources
   */
  destroy(): void {
    this.lastReceivedTimestamp = 0;
    this.logger('ExternalTemperatureService: Destroyed');
  }
}
