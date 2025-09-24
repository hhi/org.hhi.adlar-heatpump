import Homey from 'homey';

export interface SettingsManagerOptions {
  device: Homey.Device;
  logger?: (message: string, ...args: any[]) => void;
}

export interface SettingsUpdate {
  key: string;
  value: any;
}

export interface SettingsValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class SettingsManagerService {
  private device: Homey.Device;
  private logger: (message: string, ...args: any[]) => void;
  private settingsUpdateQueue: SettingsUpdate[] = [];
  private isUpdatingSettings = false;
  private deferredSettingsTimeout: NodeJS.Timeout | null = null;

  constructor(options: SettingsManagerOptions) {
    this.device = options.device;
    this.logger = options.logger || (() => {});
  }

  async onSettings(
    oldSettings: Record<string, any>,
    newSettings: Record<string, any>,
    changedKeys: string[]
  ): Promise<void> {
    this.logger('SettingsManagerService: Processing settings changes', { changedKeys });

    try {
      this.isUpdatingSettings = true;

      // Validate settings changes
      const validation = this.validateSettings(newSettings, changedKeys);
      if (!validation.isValid) {
        throw new Error(`Settings validation failed: ${validation.errors.join(', ')}`);
      }

      // Log any warnings
      validation.warnings.forEach(warning => {
        this.logger('SettingsManagerService: Warning', warning);
      });

      // Handle special settings that require immediate processing
      await this.handleImmediateSettings(oldSettings, newSettings, changedKeys);

      // Queue deferred settings updates
      this.queueDeferredSettings(oldSettings, newSettings, changedKeys);

    } catch (error) {
      this.logger('SettingsManagerService: Error in onSettings', error);
      throw error;
    } finally {
      this.isUpdatingSettings = false;
    }
  }

  private validateSettings(
    newSettings: Record<string, any>,
    changedKeys: string[]
  ): SettingsValidationResult {
    const result: SettingsValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    changedKeys.forEach(key => {
      switch (key) {
        case 'cop_min_threshold':
          if (newSettings[key] < 0.1 || newSettings[key] > 2) {
            result.errors.push('COP minimum threshold must be between 0.1 and 2');
            result.isValid = false;
          }
          break;

        case 'cop_max_threshold':
          if (newSettings[key] < 4 || newSettings[key] > 15) {
            result.errors.push('COP maximum threshold must be between 4 and 15');
            result.isValid = false;
          }
          break;

        case 'enable_power_measurements':
          if (typeof newSettings[key] !== 'boolean') {
            result.errors.push('Power measurements setting must be a boolean');
            result.isValid = false;
          }
          break;

        case 'enable_slider_controls':
          if (typeof newSettings[key] !== 'boolean') {
            result.errors.push('Slider controls setting must be a boolean');
            result.isValid = false;
          }
          break;

        case 'flow_temperature_alerts':
        case 'flow_voltage_alerts':
        case 'flow_current_alerts':
        case 'flow_power_alerts':
        case 'flow_pulse_steps_alerts':
        case 'flow_state_alerts':
        case 'flow_efficiency_alerts':
          if (!['disabled', 'auto', 'enabled'].includes(newSettings[key])) {
            result.errors.push(`Flow setting ${key} must be 'disabled', 'auto', or 'enabled'`);
            result.isValid = false;
          }
          break;
      }
    });

    return result;
  }

  private async handleImmediateSettings(
    oldSettings: Record<string, any>,
    newSettings: Record<string, any>,
    changedKeys: string[]
  ): Promise<void> {
    // Handle diagnostic settings that need immediate action
    if (changedKeys.includes('capability_diagnostics') && newSettings.capability_diagnostics) {
      this.logger('SettingsManagerService: Generating capability diagnostics report');
      await this.generateCapabilityDiagnostics();

      // Reset the checkbox
      setTimeout(() => {
        this.device.setSettings({ capability_diagnostics: false }).catch(error => {
          this.logger('SettingsManagerService: Error resetting capability_diagnostics', error);
        });
      }, 1000);
    }

    // Handle energy reset settings
    if (changedKeys.includes('reset_external_energy_total') && newSettings.reset_external_energy_total) {
      this.logger('SettingsManagerService: Resetting external energy total');
      await this.resetExternalEnergyTotal();

      setTimeout(() => {
        this.device.setSettings({ reset_external_energy_total: false }).catch(error => {
          this.logger('SettingsManagerService: Error resetting energy total checkbox', error);
        });
      }, 1000);
    }

    if (changedKeys.includes('reset_external_energy_daily') && newSettings.reset_external_energy_daily) {
      this.logger('SettingsManagerService: Resetting external energy daily');
      await this.resetExternalEnergyDaily();

      setTimeout(() => {
        this.device.setSettings({ reset_external_energy_daily: false }).catch(error => {
          this.logger('SettingsManagerService: Error resetting energy daily checkbox', error);
        });
      }, 1000);
    }
  }

  private queueDeferredSettings(
    oldSettings: Record<string, any>,
    newSettings: Record<string, any>,
    changedKeys: string[]
  ): void {
    const deferredChanges: SettingsUpdate[] = [];

    // Handle power measurements setting changes
    if (changedKeys.includes('enable_power_measurements')) {
      const powerEnabled = newSettings.enable_power_measurements;

      if (!powerEnabled) {
        // Auto-disable related flow settings when power measurements are disabled
        deferredChanges.push(
          { key: 'flow_power_alerts', value: 'disabled' },
          { key: 'flow_voltage_alerts', value: 'disabled' },
          { key: 'flow_current_alerts', value: 'disabled' }
        );
      } else if (oldSettings.enable_power_measurements === false) {
        // Re-enable related flow settings when power measurements are enabled
        deferredChanges.push(
          { key: 'flow_power_alerts', value: 'auto' },
          { key: 'flow_voltage_alerts', value: 'auto' },
          { key: 'flow_current_alerts', value: 'auto' }
        );
      }
    }

    // Queue any deferred changes
    if (deferredChanges.length > 0) {
      this.settingsUpdateQueue.push(...deferredChanges);
      this.processDeferredSettings();
    }
  }

  private processDeferredSettings(): void {
    // Cancel any existing timeout
    if (this.deferredSettingsTimeout) {
      clearTimeout(this.deferredSettingsTimeout);
    }

    // Process deferred settings after a short delay to avoid race conditions
    this.deferredSettingsTimeout = setTimeout(async () => {
      if (this.settingsUpdateQueue.length === 0 || this.isUpdatingSettings) {
        return;
      }

      try {
        const updates = [...this.settingsUpdateQueue];
        this.settingsUpdateQueue = [];

        const settingsObject: Record<string, any> = {};
        updates.forEach(update => {
          settingsObject[update.key] = update.value;
        });

        this.logger('SettingsManagerService: Applying deferred settings', settingsObject);
        await this.device.setSettings(settingsObject);

      } catch (error) {
        this.logger('SettingsManagerService: Error applying deferred settings', error);
        // Re-queue failed updates for retry
        this.settingsUpdateQueue.unshift(...this.settingsUpdateQueue);
      }
    }, 500);
  }

  private async generateCapabilityDiagnostics(): Promise<void> {
    try {
      const capabilities = this.device.getCapabilities();
      const diagnostics: Record<string, any> = {
        timestamp: new Date().toISOString(),
        totalCapabilities: capabilities.length,
        workingCapabilities: 0,
        nullCapabilities: 0,
        details: {}
      };

      for (const capability of capabilities) {
        try {
          const value = this.device.getCapabilityValue(capability);
          const isWorking = value !== null && value !== undefined;

          diagnostics.details[capability] = {
            value,
            isWorking,
            type: typeof value
          };

          if (isWorking) {
            diagnostics.workingCapabilities++;
          } else {
            diagnostics.nullCapabilities++;
          }
        } catch (error) {
          diagnostics.details[capability] = {
            error: error instanceof Error ? error.message : 'Unknown error',
            isWorking: false
          };
          diagnostics.nullCapabilities++;
        }
      }

      this.logger('SettingsManagerService: Capability Diagnostics Report', diagnostics);

      // Emit event for other services to use
      this.device.emit('diagnostics:capability-report', diagnostics);

    } catch (error) {
      this.logger('SettingsManagerService: Error generating capability diagnostics', error);
    }
  }

  private async resetExternalEnergyTotal(): Promise<void> {
    try {
      if (this.device.hasCapability('adlar_external_energy_total')) {
        await this.device.setCapabilityValue('adlar_external_energy_total', 0);
        this.logger('SettingsManagerService: External energy total reset to 0');

        // Emit event for other services
        this.device.emit('energy:total-reset');
      }
    } catch (error) {
      this.logger('SettingsManagerService: Error resetting external energy total', error);
    }
  }

  private async resetExternalEnergyDaily(): Promise<void> {
    try {
      if (this.device.hasCapability('adlar_external_energy_daily')) {
        await this.device.setCapabilityValue('adlar_external_energy_daily', 0);
        this.logger('SettingsManagerService: External energy daily reset to 0');

        // Emit event for other services
        this.device.emit('energy:daily-reset');
      }
    } catch (error) {
      this.logger('SettingsManagerService: Error resetting external energy daily', error);
    }
  }

  getSetting<T = any>(key: string): T | undefined {
    try {
      return this.device.getSetting(key);
    } catch (error) {
      this.logger('SettingsManagerService: Error getting setting', key, error);
      return undefined;
    }
  }

  async setSetting(key: string, value: any): Promise<void> {
    try {
      await this.device.setSettings({ [key]: value });
      this.logger('SettingsManagerService: Setting updated', { key, value });
    } catch (error) {
      this.logger('SettingsManagerService: Error setting value', key, error);
      throw error;
    }
  }

  async setMultipleSettings(settings: Record<string, any>): Promise<void> {
    try {
      await this.device.setSettings(settings);
      this.logger('SettingsManagerService: Multiple settings updated', settings);
    } catch (error) {
      this.logger('SettingsManagerService: Error setting multiple values', error);
      throw error;
    }
  }

  destroy(): void {
    if (this.deferredSettingsTimeout) {
      clearTimeout(this.deferredSettingsTimeout);
      this.deferredSettingsTimeout = null;
    }
    this.settingsUpdateQueue = [];
    this.logger('SettingsManagerService: Service destroyed');
  }
}