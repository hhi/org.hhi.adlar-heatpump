/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';
import TuyaDevice from 'tuyapi';
import { AdlarMapping } from '../../lib/definitions/adlar-mapping';
import { DeviceConstants } from '../../lib/constants';
import { TuyaErrorCategorizer, type CategorizedError } from '../../lib/error-types';
import { COPCalculator, type COPDataSources, type COPCalculationResult } from '../../lib/services/cop-calculator';
import { SCOPCalculator, type COPMeasurement } from '../../lib/services/scop-calculator';
import { RollingCOPCalculator, type COPDataPoint, type RollingCOPResult } from '../../lib/services/rolling-cop-calculator';

// Extract allCapabilities and allArraysSwapped from AdlarMapping
const { allCapabilities, allArraysSwapped } = AdlarMapping;

// Types for combined flow card management
interface CapabilityCategories {
  temperature: string[];
  voltage: string[];
  current: string[];
  power: string[];
  pulseSteps: string[];
  states: string[];
  efficiency: string[];
}

/* eslint-disable camelcase */
interface UserFlowPreferences {
  flow_temperature_alerts: 'disabled' | 'auto' | 'enabled';
  flow_voltage_alerts: 'disabled' | 'auto' | 'enabled';
  flow_current_alerts: 'disabled' | 'auto' | 'enabled';
  flow_power_alerts: 'disabled' | 'auto' | 'enabled';
  flow_pulse_steps_alerts: 'disabled' | 'auto' | 'enabled';
  flow_state_alerts: 'disabled' | 'auto' | 'enabled';
  flow_efficiency_alerts: 'disabled' | 'auto' | 'enabled';
  flow_expert_mode: boolean;
}
/* eslint-enable camelcase */

interface COPSettings {
  enableCOP: boolean;
  calculationMethod: 'auto' | 'direct_thermal' | 'carnot_estimation' | 'temperature_difference';
  enableOutlierDetection: boolean;
  customOutlierThresholds: {
    minCOP: number;
    maxCOP: number;
  };
  externalDevices: {
    power: { enabled: boolean; deviceId: string; capability: string };
    flow: { enabled: boolean; deviceId: string; capability: string };
    ambient: { enabled: boolean; deviceId: string; capability: string };
  };
}

class MyDevice extends Homey.Device {
  tuya: TuyaDevice | undefined;
  tuyaConnected: boolean = false;
  allCapabilities: Record<string, number[]> = allCapabilities;
  allArraysSwapped: Record<number, string> = allArraysSwapped;
  settableCapabilities: string[] = [];
  reconnectInterval: NodeJS.Timeout | undefined;
  consecutiveFailures: number = 0;
  lastNotificationTime: number = 0;
  lastNotificationKey: string = '';

  // Flow card management
  private flowCardListeners: Map<string, unknown> = new Map();
  private isFlowCardsInitialized: boolean = false;

  // Capability health monitoring
  private capabilityHealthMap = new Map<string, {
    isHealthy: boolean;
    lastSeenData: number;
    nullCount: number;
    dataCount: number;
    lastValue: unknown;
  }>();

  private readonly CAPABILITY_TIMEOUT_MS = DeviceConstants.CAPABILITY_TIMEOUT_MS;

  private readonly NULL_THRESHOLD = DeviceConstants.NULL_THRESHOLD;

  private healthCheckInterval: NodeJS.Timeout | null = null;

  // COP (Coefficient of Performance) calculation
  private copCalculationInterval: NodeJS.Timeout | null = null;
  private copSettings: COPSettings | null = null;

  // SCOP (Seasonal Coefficient of Performance) calculation
  private scopCalculator: SCOPCalculator | null = null;
  private scopUpdateInterval: NodeJS.Timeout | null = null;

  // Rolling COP calculation
  private rollingCOPCalculator: RollingCOPCalculator | null = null;
  private lastRollingCOPUpdate: number = 0;

  // Debug-conditional logging method
  private debugLog(...args: unknown[]) {
    if (process.env.DEBUG === '1') {
      this.log(...args);
    }
  }

  /**
   * Handle and log categorized Tuya errors with enhanced information
   * @param error - The original error
   * @param context - Context where error occurred
   * @returns Categorized error information
   */
  private handleTuyaError(error: Error, context: string): CategorizedError {
    const categorizedError = TuyaErrorCategorizer.categorize(error, context);

    // Log the categorized error
    this.error(TuyaErrorCategorizer.formatForLogging(categorizedError));

    // Log debug information if enabled
    if (process.env.DEBUG === '1') {
      this.debugLog('Error categorization details:', {
        type: categorizedError.type,
        recoverable: categorizedError.recoverable,
        retryable: categorizedError.retryable,
        userMessage: categorizedError.userMessage,
        recoveryActions: categorizedError.recoveryActions,
      });
    }

    return categorizedError;
  }

  private async sendCriticalNotification(title: string, message: string) {
    const now = Date.now();
    const notificationKey = `${title}:${message}`;

    // Prevent spam - only send notifications every 30 minutes for the same device
    // Also prevent duplicate notifications within 5 seconds (for duplicate events)
    if (now - this.lastNotificationTime > DeviceConstants.NOTIFICATION_THROTTLE_MS
        || (this.lastNotificationKey !== notificationKey && now - this.lastNotificationTime > DeviceConstants.NOTIFICATION_KEY_CHANGE_THRESHOLD_MS)) {
      try {
        await this.homey.notifications.createNotification({
          excerpt: `${this.getName()}: ${title}`,
        });
        this.lastNotificationTime = now;
        this.lastNotificationKey = notificationKey;
        this.log(`Critical notification sent: ${title}`);
      } catch (err) {
        this.error('Failed to send notification:', err);
      }
    }
  }

  /**
   * Connect to the Tuya device with proper error handling
   * @returns Promise that resolves when connection is established
   * @throws Error if connection fails or device is not initialized
   */
  async connectTuya(): Promise<void> {
    if (!this.tuyaConnected) {
      try {
        // Discover the device on the network first
        if (this.tuya) {
          await this.tuya.find();
          // Then connect to the device
          await this.tuya.connect();
          this.tuyaConnected = true;
          this.debugLog('Connected to Tuya device');
        } else {
          throw new Error('Tuya device is not initialized');
        }
      } catch (err) {
        const categorizedError = this.handleTuyaError(err as Error, 'Tuya device connection');

        // Send user notification for non-recoverable errors
        if (!categorizedError.recoverable) {
          await this.sendCriticalNotification(
            'Device Connection Failed',
            categorizedError.userMessage,
          );
        }

        // Don't throw here to allow reconnection attempts
      }
    }
  }

  private startReconnectInterval() {
    // Clear any existing interval
    this.stopReconnectInterval();

    // Start new interval for reconnection attempts
    this.reconnectInterval = this.homey.setInterval(async () => {
      if (!this.tuyaConnected) {
        this.debugLog('Attempting to reconnect to Tuya device...');
        try {
          await this.connectTuya();
          // Reset failure counter on successful connection
          this.consecutiveFailures = 0;
        } catch (err) {
          const categorizedError = this.handleTuyaError(err as Error, 'Reconnection attempt');
          this.consecutiveFailures++;

          // Send notification after max consecutive failures (100 seconds)
          if (this.consecutiveFailures === DeviceConstants.MAX_CONSECUTIVE_FAILURES) {
            await this.sendCriticalNotification(
              'Device Connection Lost',
              `Heat pump has been disconnected for over 1 minute. ${categorizedError.userMessage}`,
            );
          }
        }
      }
    }, DeviceConstants.RECONNECTION_INTERVAL_MS);
  }

  private stopReconnectInterval() {
    if (this.reconnectInterval) {
      this.homey.clearInterval(this.reconnectInterval);
      this.reconnectInterval = undefined;
    }
  }

  /**
   * Set up Tuya device event handlers
   * Extracted for reuse during connection recreation
   */
  private setupTuyaEventHandlers(): void {
    if (!this.tuya) {
      throw new Error('Cannot setup event handlers: Tuya device not initialized');
    }

    // TUYA ON EVENT (from dp id to capability name)
    this.tuya.on('data', (data: { dps: Record<number, unknown> }): void => {
      // Suppose data contains updated values, e.g., { dps: { 1: true, 4: 22 } }
      const dpsFetched = data.dps || {};
      this.log('Data received from Tuya:', dpsFetched);
      // Update Homey capabilities based on the fetched DPS data
      this.updateCapabilitiesFromDps(dpsFetched);
      this.setAvailable()
        .then(() => this.log('Device set as available'))
        .catch((err) => this.error('Error setting device as available:', err));
    });

    // TUYA DP_REFRESH event (from dp id to capability name)
    this.tuya.on('dp-refresh', (data: { dps: Record<number, unknown> }): void => {
      // Suppose data contains updated values, e.g., { dps: { 1: true, 4: 22 } }
      const dpsFetched = data.dps || {};
      this.log('DP-Refresh received from Tuya:', dpsFetched);
      // Update Homey capabilities based on the fetched DPS data
      this.updateCapabilitiesFromDps(dpsFetched);
    });

    // Fixing promise handling for setAvailable and setUnavailable
    this.tuya.on('connected', (): void => {
      this.log('Device', 'Connected to device!');
      this.setAvailable()
        .then(() => this.log('Device set as available'))
        .catch((err) => this.error('Error setting device as available:', err));
    });

    this.tuya.on('disconnected', (): void => {
      this.log('Device', 'Disconnected from device!');
      this.tuyaConnected = false;
      this.setUnavailable('Device disconnected')
        .then(() => this.log('Device set as unavailable'))
        .catch((err) => this.error('Error setting device as unavailable:', err));
    });
  }

  /**
   * Update capability health tracking when value changes
   */
  private updateCapabilityHealth(capability: string, value: unknown): void {
    const now = Date.now();
    const health = this.capabilityHealthMap.get(capability) || {
      isHealthy: true,
      lastSeenData: now,
      nullCount: 0,
      dataCount: 0,
      lastValue: null,
    };

    const isNull = value === null || value === undefined;

    if (isNull) {
      health.nullCount++;
    } else {
      health.nullCount = 0; // Reset null count on valid data
      health.dataCount++;
      health.lastSeenData = now;
      health.lastValue = value;
    }

    // Update health status - consider capability unhealthy when DPS value is null
    const wasHealthy = health.isHealthy;
    health.isHealthy = !isNull && health.nullCount < this.NULL_THRESHOLD && (now - health.lastSeenData) < this.CAPABILITY_TIMEOUT_MS;

    // Log health status changes
    if (wasHealthy !== health.isHealthy) {
      if (health.isHealthy) {
        this.log(`Capability ${capability} recovered - now healthy`);
      } else {
        this.log(`Capability ${capability} became unhealthy - nullCount: ${health.nullCount}, timeSinceData: ${now - health.lastSeenData}ms`);
      }
    }

    this.capabilityHealthMap.set(capability, health);
  }

  /**
   * Get capability health status
   */
  private getCapabilityHealth(capability: string): boolean {
    const health = this.capabilityHealthMap.get(capability);
    if (!health) return false;

    const now = Date.now();
    const isHealthy = health.nullCount < this.NULL_THRESHOLD && (now - health.lastSeenData) < this.CAPABILITY_TIMEOUT_MS;

    // Update health status if it has changed
    if (health.isHealthy !== isHealthy) {
      health.isHealthy = isHealthy;
      this.capabilityHealthMap.set(capability, health);
    }

    return isHealthy;
  }

  /**
   * Get all capability health statuses
   */
  private getAllCapabilityHealthStatuses(): Record<string, {
    isHealthy: boolean;
    lastSeenData: number;
    nullCount: number;
    dataCount: number;
    lastValue: unknown;
    timeSinceLastData: number;
  }> {
    const now = Date.now();
    const statuses: Record<string, {
      isHealthy: boolean;
      lastSeenData: number;
      nullCount: number;
      dataCount: number;
      lastValue: unknown;
      timeSinceLastData: number;
    }> = {};

    for (const [capability, health] of this.capabilityHealthMap.entries()) {
      statuses[capability] = {
        ...health,
        timeSinceLastData: now - health.lastSeenData,
      };
    }

    return statuses;
  }

  /**
   * Get available capabilities organized by category (Option A)
   */
  private getAvailableCapabilities(): CapabilityCategories {
    const caps = Object.keys(this.allCapabilities);

    return {
      temperature: caps.filter((cap) => cap.startsWith('measure_temperature')),
      voltage: caps.filter((cap) => cap.startsWith('measure_voltage')),
      current: caps.filter((cap) => cap.startsWith('measure_current')),
      power: caps.filter((cap) => cap.includes('power')),
      pulseSteps: caps.filter((cap) => cap.includes('pulse_steps')),
      states: caps.filter((cap) => cap.startsWith('adlar_state')),
      efficiency: caps.filter((cap) => cap.includes('cop') || cap.includes('scop')),
    };
  }

  /**
   * Get user flow preferences from device settings (Option B)
   */
  private getUserFlowPreferences(): UserFlowPreferences {
    return {
      flow_temperature_alerts: this.getSetting('flow_temperature_alerts') || 'auto',
      flow_voltage_alerts: this.getSetting('flow_voltage_alerts') || 'auto',
      flow_current_alerts: this.getSetting('flow_current_alerts') || 'auto',
      flow_power_alerts: this.getSetting('flow_power_alerts') || 'auto',
      flow_pulse_steps_alerts: this.getSetting('flow_pulse_steps_alerts') || 'auto',
      flow_state_alerts: this.getSetting('flow_state_alerts') || 'auto',
      flow_efficiency_alerts: this.getSetting('flow_efficiency_alerts') || 'auto',
      flow_expert_mode: this.getSetting('flow_expert_mode') || false,
    };
  }

  /**
   * Detect capabilities that have actual data (Option C)
   */
  private async detectCapabilitiesWithData(): Promise<string[]> {
    const capabilitiesWithData: string[] = [];

    // Check which capabilities have actual data (not null/undefined)
    for (const capability of Object.keys(this.allCapabilities)) {
      try {
        const value = this.getCapabilityValue(capability);
        // Update health tracking for this capability
        this.updateCapabilityHealth(capability, value);

        // Check if capability is currently healthy (has recent valid data)
        if (this.getCapabilityHealth(capability)) {
          capabilitiesWithData.push(capability);
          this.debugLog(`Capability ${capability} is healthy with data:`, value);
        } else {
          this.debugLog(`Capability ${capability} is unhealthy - excluding from flow cards`);
        }
      } catch (err) {
        this.debugLog(`Capability ${capability} not available:`, err);
      }
    }

    return capabilitiesWithData;
  }

  /**
   * Get healthy capabilities by category for dynamic flow card management
   */
  private getHealthyCapabilitiesByCategory(): CapabilityCategories {
    const caps = Object.keys(this.allCapabilities).filter((cap) => this.getCapabilityHealth(cap));

    return {
      temperature: caps.filter((cap) => cap.startsWith('measure_temperature')),
      voltage: caps.filter((cap) => cap.startsWith('measure_voltage')),
      current: caps.filter((cap) => cap.startsWith('measure_current')),
      power: caps.filter((cap) => cap.includes('power')),
      pulseSteps: caps.filter((cap) => cap.includes('pulse_steps')),
      states: caps.filter((cap) => cap.startsWith('adlar_state')),
      efficiency: caps.filter((cap) => cap.includes('cop') || cap.includes('scop')),
    };
  }

  /**
   * Periodically update flow cards based on capability health changes
   */
  private async updateFlowCardsBasedOnHealth(): Promise<void> {
    try {
      // Get current healthy capabilities
      const healthyCapabilities = this.getHealthyCapabilitiesByCategory();
      const userPrefs = this.getUserFlowPreferences();

      // Check if any categories need flow card updates due to health changes
      const categoriesToUpdate: (keyof CapabilityCategories)[] = [];

      for (const category of Object.keys(healthyCapabilities) as (keyof CapabilityCategories)[]) {
        const currentHealthyCaps = healthyCapabilities[category];
        const availableCaps = this.getAvailableCapabilities()[category];

        // If healthy capabilities differ significantly from available capabilities, update
        if (currentHealthyCaps.length !== availableCaps.length
            || !currentHealthyCaps.every((cap) => availableCaps.includes(cap))) {
          categoriesToUpdate.push(category);
        }
      }

      if (categoriesToUpdate.length > 0) {
        this.log(`Updating flow cards for categories with health changes: ${categoriesToUpdate.join(', ')}`);

        // Unregister existing flow cards for affected categories
        for (const category of categoriesToUpdate) {
          await this.unregisterFlowCardsForCategory(category);
        }

        // Re-register flow cards with current healthy capabilities
        const capabilitiesWithData = await this.detectCapabilitiesWithData();
        for (const category of categoriesToUpdate) {
          await this.registerFlowCardsByCategory(
            category,
            healthyCapabilities[category],
            userPrefs[`flow_${category}_alerts` as keyof typeof userPrefs] as 'disabled' | 'auto' | 'enabled',
            capabilitiesWithData,
          );
        }
      }
    } catch (error) {
      this.error('Error updating flow cards based on health:', error);
    }
  }

  /**
   * Unregister flow cards for a specific category
   */
  private async unregisterFlowCardsForCategory(category: keyof CapabilityCategories): Promise<void> {
    const categoryFlowCards = this.getCategoryFlowCards(category);

    for (const cardId of categoryFlowCards) {
      const listener = this.flowCardListeners.get(cardId);
      if (listener) {
        try {
          if (typeof (listener as { unregister?: () => void }).unregister === 'function') {
            (listener as { unregister: () => void }).unregister();
          }
          this.flowCardListeners.delete(cardId);
          this.debugLog(`Unregistered flow card: ${cardId} for category: ${category}`);
        } catch (error) {
          this.error(`Error unregistering flow card ${cardId}:`, error);
        }
      }
    }
  }

  /**
   * Get flow card IDs for a specific category
   */
  private getCategoryFlowCards(category: keyof CapabilityCategories): string[] {
    const categoryCards: Record<keyof CapabilityCategories, string[]> = {
      temperature: [
        'temperature_above', 'coiler_temperature_alert', 'incoiler_temperature_alert',
        'tank_temperature_alert', 'suction_temperature_alert', 'discharge_temperature_alert',
        'ambient_temperature_changed', 'inlet_temperature_changed', 'outlet_temperature_changed',
        'high_pressure_temperature_alert', 'low_pressure_temperature_alert',
        'economizer_inlet_temperature_alert', 'economizer_outlet_temperature_alert',
      ],
      voltage: ['phase_a_voltage_alert', 'phase_b_voltage_alert', 'phase_c_voltage_alert'],
      current: ['phase_b_current_alert', 'phase_c_current_alert'],
      power: ['power_above_threshold', 'power_threshold_exceeded', 'total_consumption_above'],
      pulseSteps: ['eev_pulse_steps_alert', 'evi_pulse_steps_alert'],
      states: ['compressor_running', 'compressor_state_changed', 'defrost_state_changed', 'backwater_state_changed'],
      efficiency: [
        'cop_efficiency_changed', 'cop_outlier_detected', 'cop_calculation_method_is',
        'cop_efficiency_check',
        'daily_cop_efficiency_changed', 'cop_trend_detected',
        'daily_cop_above_threshold', 'cop_trend_analysis',
        'request_external_ambient_data', 'request_external_flow_data', 'request_external_power_data',
      ],
    };

    return categoryCards[category] || [];
  }

  /**
   * Start periodic health checks for dynamic flow card management
   */
  private startHealthCheckInterval(): void {
    // Check capability health every 2 minutes
    try {
      const interval = this.homey.setInterval(() => {
        this.updateFlowCardsBasedOnHealth().catch((error) => {
          this.error('Error during health check update:', error);
        });
      }, DeviceConstants.HEALTH_CHECK_INTERVAL_MS);
      if (interval) {
        this.healthCheckInterval = interval;
        this.log('Started capability health check interval');
      } else {
        this.healthCheckInterval = null;
        this.error('Failed to start health check interval: setInterval returned undefined');
      }
    } catch (err) {
      this.healthCheckInterval = null;
      this.error('Error starting health check interval:', err);
    }
  }

  /**
   * Stop periodic health checks
   */
  private stopHealthCheckInterval(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      this.log('Stopped capability health check interval');
    }
  }

  /**
   * Generate a human-readable capability diagnostic report
   */
  private generateCapabilityDiagnosticReport(healthStatuses: Record<string, {
    isHealthy: boolean;
    lastSeenData: number;
    nullCount: number;
    dataCount: number;
    lastValue: unknown;
    timeSinceLastData: number;
  }>): string {
    const report: string[] = [];
    const categories = this.getAvailableCapabilities();

    report.push('=== CAPABILITY HEALTH STATUS ===\n');

    // Overall summary
    const totalCapabilities = Object.keys(healthStatuses).length;
    const healthyCapabilities = Object.values(healthStatuses).filter(
      (status: unknown) => typeof status === 'object' && status !== null
        && 'isHealthy' in status && (status as { isHealthy: boolean }).isHealthy,
    ).length;
    const unhealthyCapabilities = totalCapabilities - healthyCapabilities;

    report.push('📊 SUMMARY:');
    report.push(`   Total Capabilities: ${totalCapabilities}`);
    report.push(`   ❌ Unhealthy: ${unhealthyCapabilities}`);
    report.push(`   ✅ Healthy: ${healthyCapabilities}`);

    report.push('');

    // Unhealthy capabilities first
    const unhealthy = Object.entries(healthStatuses).filter(([, status]) => !status.isHealthy);
    if (unhealthy.length > 0) {
      report.push('🚨 UNHEALTHY CAPABILITIES:');
      for (const [capability, health] of unhealthy) {
        const timeAgo = this.formatTimeAgo(health.timeSinceLastData);
        const reason = health.nullCount >= this.NULL_THRESHOLD
          ? `Too many null values (${health.nullCount})`
          : `No recent data (${timeAgo})`;
        const lastValue = health.lastValue !== null && health.lastValue !== undefined
          ? ` = ${health.lastValue}`
          : ' = null';
        report.push(`   ❌ ${capability}${lastValue}`);
        report.push(`      ${reason}, last data: ${timeAgo}`);
      }
      report.push('');
    }

    // Healthy capabilities by category
    for (const [categoryName, capabilities] of Object.entries(categories)) {
      if (capabilities.length === 0) continue;

      const healthyInCategory = capabilities.filter((cap: string | number) => healthStatuses[cap]?.isHealthy || !healthStatuses[cap]);

      if (healthyInCategory.length === 0) continue;

      report.push(`📁 ${categoryName.toUpperCase()} - HEALTHY (${healthyInCategory.length} capabilities):`);

      const reportcaps: string[] = [];
      for (const capability of healthyInCategory) {
        const health = healthStatuses[capability];
        if (health) {
          // reportcaps.push(`✅ ${capability}$ `);
        } else {
          reportcaps.push(`⚠️  ${capability} = no health data `);
        }
      }
      // report.push(reportcaps.join(' '));
    }
    report.push('');
    report.push('💡 TIP: Unhealthy capabilities are excluded from flow cards in "auto" mode.');
    report.push('    Use "enabled" mode to force flow cards for all capabilities.');

    return report.join('\n');
  }

  /**
   * Format time difference in human-readable format
   */
  private formatTimeAgo(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / DeviceConstants.MS_PER_SECOND);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ago`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s ago`;
    return `${seconds}s ago`;
  }

  /**
   * Format COP method for user-friendly display with internationalization and diagnostics
   */
  private formatCOPMethodDisplay(method: string, confidence: string, diagnosticInfo?: any): string {
    // Get localized method names using Homey's i18n system
    const getLocalizedMethodName = (methodKey: string): string => {
      const i18nKey = `cop_method.${methodKey}`;
      try {
        return this.homey.__(i18nKey) || methodKey;
      } catch (error) {
        // Fallback to English if translation fails
        const fallbackNames: Record<string, string> = {
          direct_thermal: 'Direct Thermal',
          power_module: 'Power Module',
          power_estimation: 'Power Estimation',
          refrigerant_circuit: 'Refrigerant Circuit',
          carnot_estimation: 'Carnot Estimation',
          valve_correlation: 'Valve Correlation',
          temperature_difference: 'Temperature Difference',
          insufficient_data: 'Insufficient Data',
        };
        return fallbackNames[methodKey] || methodKey;
      }
    };

    let methodName = getLocalizedMethodName(method);

    // For insufficient_data, add diagnostic information if available
    if (method === 'insufficient_data' && diagnosticInfo?.primaryIssue) {
      const diagnosticKey = `cop_diagnostics.${diagnosticInfo.primaryIssue}`;
      const localizedDiagnostic = this.homey.__(diagnosticKey) || diagnosticInfo.primaryIssue;
      methodName = `${methodName}: ${localizedDiagnostic}`;
    }

    // Format with confidence indicator
    let confidenceIndicator = '🔴'; // default low confidence
    if (confidence === 'high') {
      confidenceIndicator = '🟢';
    } else if (confidence === 'medium') {
      confidenceIndicator = '🟡';
    }

    return `${methodName} ${confidenceIndicator}`;
  }

  /**
   * Add COP measurement to SCOP calculator and update seasonal performance
   */
  private async addCOPMeasurementToSCOP(copResult: COPCalculationResult, combinedData: COPDataSources): Promise<void> {
    if (!this.scopCalculator || !this.hasCapability('adlar_scop')) {
      return;
    }

    try {
      // Map COP calculation method to SCOP-compatible method
      const getSCOPMethod = (method: COPCalculationResult['method']): COPMeasurement['method'] => {
        switch (method) {
          case 'power_estimation':
            return 'power_module'; // Map power estimation to power module
          case 'insufficient_data':
            return 'temperature_difference'; // Fallback to basic method
          default:
            return method as COPMeasurement['method'];
        }
      };

      // Create SCOP measurement from COP result
      const scopMeasurement: COPMeasurement = {
        cop: copResult.cop,
        method: getSCOPMethod(copResult.method),
        timestamp: Date.now(),
        ambientTemperature: combinedData.ambientTemperature || 10, // Default if not available
        loadRatio: this.estimateLoadRatio(combinedData),
        confidence: copResult.confidence,
      };

      // Add measurement to SCOP calculator
      this.scopCalculator.addCOPMeasurement(scopMeasurement);

      // Calculate current SCOP
      const scopResult = this.scopCalculator.calculateSCOP();

      if (scopResult) {
        // Update SCOP capabilities
        const roundedSCOP = Math.round(scopResult.scop * 10) / 10;
        await this.setCapabilityValue('adlar_scop', roundedSCOP);
        await this.setCapabilityValue('adlar_scop_quality', scopResult.dataQuality);

        this.debugLog(`📊 SCOP updated: ${roundedSCOP} (confidence: ${scopResult.confidence}, coverage: ${Math.round(scopResult.seasonalCoverage * 100)}%)`);
      } else {
        // Update status to show insufficient data with localized message
        const insufficientStatus = this.getSCOPStatusMessage('insufficient_data');
        await this.setCapabilityValue('adlar_scop_quality', insufficientStatus);
        this.debugLog('📊 SCOP: Insufficient seasonal data for calculation');
      }
    } catch (error) {
      this.error('Failed to add COP measurement to SCOP calculator:', error);
    }
  }

  /**
   * Estimate load ratio based on current system conditions
   */
  private estimateLoadRatio(data: COPDataSources): number {
    // Simple load ratio estimation based on compressor frequency and ambient conditions
    if (data.compressorFrequency && data.compressorFrequency > 0) {
      const maxFrequency = 120; // Typical max compressor frequency
      const baseLoadRatio = Math.min(data.compressorFrequency / maxFrequency, 1.0);

      // Adjust for ambient temperature (colder = higher load)
      if (data.ambientTemperature !== undefined) {
        let tempAdjustment = 0;
        if (data.ambientTemperature < 0) {
          tempAdjustment = 0.2;
        } else if (data.ambientTemperature < 5) {
          tempAdjustment = 0.1;
        }
        return Math.min(baseLoadRatio + tempAdjustment, 1.0);
      }

      return baseLoadRatio;
    }

    // Default load ratio if no frequency data
    return 0.5;
  }

  /**
   * Add COP measurement to rolling COP calculator
   */
  private async addCOPMeasurementToRolling(copResult: COPCalculationResult, combinedData: COPDataSources): Promise<void> {
    if (!this.rollingCOPCalculator) {
      return;
    }

    try {
      // Create rolling COP data point
      const dataPoint: COPDataPoint = {
        timestamp: Date.now(),
        cop: copResult.cop,
        method: copResult.method,
        confidence: copResult.confidence,
        electricalPower: combinedData.electricalPower,
        thermalOutput: copResult.calculationDetails?.thermalOutput,
        ambientTemperature: combinedData.ambientTemperature,
        compressorRuntime: this.getCompressorRuntime(),
      };

      // Add data point to rolling calculator
      this.rollingCOPCalculator.addDataPoint(dataPoint);

      // Update rolling COP capabilities (every 5 minutes to avoid excessive updates)
      const now = Date.now();
      if (now - this.lastRollingCOPUpdate >= 5 * 60 * 1000) { // 5 minutes
        await this.updateRollingCOPCapabilities();
        this.lastRollingCOPUpdate = now;
      }

      this.debugLog('📈 Rolling COP: Added data point with COP', copResult.cop);
    } catch (error) {
      this.error('Failed to add COP measurement to rolling calculator:', error);
    }
  }

  /**
   * Force refresh of trend capability with translation - for debugging
   */
  public async forceRefreshTrendCapability(): Promise<void> {
    try {
      if (!this.hasCapability('adlar_cop_trend')) {
        this.log('⚠️ adlar_cop_trend capability not available');
        return;
      }

      const trendAnalysis = this.rollingCOPCalculator?.getTrendAnalysis(24);
      if (trendAnalysis) {
        const translatedDescription = this.homey.__(`trend_descriptions.${trendAnalysis.trendKey}`);
        this.log('🔄 Force refreshing trend capability:');
        this.log('  - trendKey:', trendAnalysis.trendKey);
        this.log('  - translated:', translatedDescription);
        this.log('  - fallback test (stable):', this.homey.__('trend_descriptions.stable'));

        await this.setCapabilityValue('adlar_cop_trend', translatedDescription);
        this.log('✅ Trend capability force refreshed');
      } else {
        // Set a test translation to verify the system works
        const testTranslation = this.homey.__('trend_descriptions.stable');
        this.log('🧪 Setting test translation:', testTranslation);
        this.log('🧪 Direct translation test:', this.homey.__('trend_descriptions.stable'));
        this.log('🧪 All available keys check:', {
          stable: this.homey.__('trend_descriptions.stable'),
          strong_improvement: this.homey.__('trend_descriptions.strong_improvement'),
          moderate_decline: this.homey.__('trend_descriptions.moderate_decline')
        });
        await this.setCapabilityValue('adlar_cop_trend', testTranslation);
      }
    } catch (error) {
      this.error('Failed to force refresh trend capability:', error);
    }
  }

  /**
   * Update rolling COP capabilities with latest calculations
   */
  private async updateRollingCOPCapabilities(): Promise<void> {
    if (!this.rollingCOPCalculator) {
      return;
    }

    try {
      // Calculate daily COP
      const dailyCOP = this.rollingCOPCalculator.getDailyCOP();
      if (dailyCOP && this.hasCapability('adlar_cop_daily')) {
        await this.setCapabilityValue('adlar_cop_daily', dailyCOP.averageCOP);
        this.debugLog('📅 Daily COP updated:', dailyCOP.averageCOP, `(${dailyCOP.dataPoints} points, ${dailyCOP.confidenceLevel} confidence)`);

        // Trigger daily COP efficiency flow cards
        await this.triggerDailyCOPFlowCards(dailyCOP);
      }

      // Calculate weekly COP
      const weeklyCOP = this.rollingCOPCalculator.getWeeklyCOP();
      if (weeklyCOP && this.hasCapability('adlar_cop_weekly')) {
        await this.setCapabilityValue('adlar_cop_weekly', weeklyCOP.averageCOP);
        this.debugLog('📊 Weekly COP updated:', weeklyCOP.averageCOP, `(${weeklyCOP.dataPoints} points, ${weeklyCOP.confidenceLevel} confidence)`);
      }

      // Update trend analysis
      const trendAnalysis = this.rollingCOPCalculator.getTrendAnalysis(24);
      if (trendAnalysis && this.hasCapability('adlar_cop_trend')) {
        // Translate the trend description using the device's translation system
        const translatedDescription = this.homey.__(`trend_descriptions.${trendAnalysis.trendKey}`);

        // Debug logging to help troubleshoot internationalization
        this.log('🔍 Trend Analysis Debug:');
        this.log('  - trendKey:', trendAnalysis.trendKey);
        this.log('  - translation result:', translatedDescription);
        this.log('  - current locale:', this.homey.i18n.getLanguage());

        await this.setCapabilityValue('adlar_cop_trend', translatedDescription);
        this.debugLog('📈 COP Trend updated:', translatedDescription, `(${trendAnalysis.strength.toFixed(3)} strength)`);

        // Trigger trend flow cards (need to pass the translated description)
        await this.triggerCOPTrendFlowCards({ ...trendAnalysis, description: translatedDescription }, dailyCOP);
      }
    } catch (error) {
      this.error('Failed to update rolling COP capabilities:', error);
    }
  }

  /**
   * Trigger daily COP efficiency flow cards
   */
  private async triggerDailyCOPFlowCards(dailyCOP: RollingCOPResult): Promise<void> {
    // Check for threshold crossing triggers (simplified - would need to store previous values)
    // This is a basic implementation - could be enhanced with threshold storage
    if (this.hasCapability('adlar_cop_daily')) {
      const tokens = {
        current_daily_cop: dailyCOP.averageCOP,
        threshold_cop: 3.0, // Example threshold - would be configurable
        data_points: dailyCOP.dataPoints,
        confidence_level: dailyCOP.confidenceLevel,
      };

      // Note: Actual threshold comparison would be done in flow card listener
      this.debugLog('📅 Daily COP flow tokens ready:', tokens);
    }
  }

  /**
   * Trigger COP trend flow cards
   */
  private async triggerCOPTrendFlowCards(trendAnalysis: { trend: string; strength: number; description: string }, dailyCOP: RollingCOPResult | null): Promise<void> {
    if (trendAnalysis.strength > 0.15) { // Only trigger for significant trends
      const tokens = {
        trend_direction: trendAnalysis.trend,
        trend_strength: trendAnalysis.strength,
        trend_description: trendAnalysis.description,
        current_daily_cop: dailyCOP?.averageCOP || 0,
      };

      await this.triggerFlowCard('cop_trend_detected', tokens);
      this.debugLog('📈 COP trend flow card triggered:', tokens);
    }
  }

  /**
   * Get current compressor runtime (simplified estimation)
   */
  private getCompressorRuntime(): number {
    // This is a simplified implementation
    // In a real system, you'd track actual runtime
    const compressorState = this.getCapabilityValue('adlar_state_compressor_state');
    return compressorState ? 30 : 0; // 30 minutes if running, 0 if not
  }

  /**
   * Initialize rolling COP calculator
   */
  private async initializeRollingCOP(): Promise<void> {
    try {
      // Initialize with default config - could be made configurable
      this.rollingCOPCalculator = new RollingCOPCalculator({
        timeWindow: 24 * 60, // 24 hours
        minDataPoints: 12, // Minimum 12 points (6 hours worth)
        weightingMethod: 'runtime_weighted',
        trendSensitivity: 0.15, // 15% change for trend detection
      });

      // Try to restore data from settings
      await this.restoreRollingCOPData();

      this.debugLog('📈 Rolling COP calculator initialized');
    } catch (error) {
      this.error('Failed to initialize rolling COP calculator:', error);
    }
  }

  /**
   * Restore rolling COP data from device settings
   */
  private async restoreRollingCOPData(): Promise<void> {
    try {
      const savedData = this.getSetting('rolling_cop_data');
      if (savedData && this.rollingCOPCalculator) {
        this.rollingCOPCalculator.importData(savedData);
        this.debugLog('📈 Rolling COP data restored from settings');
      }
    } catch (error) {
      this.debugLog('No rolling COP data to restore:', error);
    }
  }

  /**
   * Save rolling COP data to device settings
   */
  private async saveRollingCOPData(): Promise<void> {
    try {
      if (this.rollingCOPCalculator) {
        const dataToSave = this.rollingCOPCalculator.exportData();
        await this.setSettings({ rolling_cop_data: dataToSave });
        this.debugLog('📈 Rolling COP data saved to settings');
      }
    } catch (error) {
      this.error('Failed to save rolling COP data:', error);
    }
  }

  /**
   * Simple direct external device access methods
   */

  /**
   * Get external power data from capability (fed via flow card)
   */
  private async getExternalPowerData(): Promise<number | null> {
    // Check if we have external power data from flow card
    if (this.hasCapability('adlar_external_power')) {
      const value = this.getCapabilityValue('adlar_external_power');
      if (typeof value === 'number' && !Number.isNaN(value) && value > 0) {
        this.debugLog(`📊 Using external power data: ${value}W (from flow card)`);
        return value;
      }
    }

    this.debugLog('📊 No external power data available - use "Send power data to heat pump" flow card to provide external power');
    return null;
  }

  /**
   * Get external flow data directly from configured device
   */
  private async getExternalFlowData(): Promise<number | null> {
    const deviceId = this.getSetting('external_flow_device_id');
    const capability = this.getSetting('external_flow_capability') || 'measure_water';

    if (!deviceId || deviceId.trim() === '') {
      return null;
    }

    try {
      // Use getAllDevices to find the device by ID
      const allDevices = Object.values(this.homey.drivers.getDrivers())
        .flatMap((driver) => Object.values(driver.getDevices()));
      const device = allDevices.find((d) => d.getData().id === deviceId);
      if (device && device.hasCapability(capability)) {
        const value = device.getCapabilityValue(capability);
        if (typeof value === 'number' && !Number.isNaN(value)) {
          this.debugLog(`💧 External flow data: ${value}L/min from device ${deviceId}`);
          return value;
        }
      }
    } catch (error) {
      this.error(`Failed to read external flow from device ${deviceId}:`, error);
    }

    return null;
  }

  /**
   * Get external ambient temperature data directly from configured device
   */
  private async getExternalAmbientData(): Promise<number | null> {
    const deviceId = this.getSetting('external_ambient_device_id');
    const capability = this.getSetting('external_ambient_capability') || 'measure_temperature';

    if (!deviceId || deviceId.trim() === '') {
      return null;
    }

    try {
      // Use getAllDevices to find the device by ID
      const allDevices = Object.values(this.homey.drivers.getDrivers())
        .flatMap((driver) => Object.values(driver.getDevices()));
      const device = allDevices.find((d) => d.getData().id === deviceId);
      if (device && device.hasCapability(capability)) {
        const value = device.getCapabilityValue(capability);
        if (typeof value === 'number' && !Number.isNaN(value)) {
          this.debugLog(`🌡️ External ambient data: ${value}°C from device ${deviceId}`);
          return value;
        }
      }
    } catch (error) {
      this.error(`Failed to read external ambient temperature from device ${deviceId}:`, error);
    }

    return null;
  }

  /**
   * Get all external data in a simple, efficient way
   */
  private async getExternalDeviceData(): Promise<{
    electricalPower?: number;
    waterFlowRate?: number;
    ambientTemperature?: number;
  }> {
    const externalData: { electricalPower?: number; waterFlowRate?: number; ambientTemperature?: number } = {};

    // Get external power data
    const powerData = await this.getExternalPowerData();
    if (powerData !== null) {
      externalData.electricalPower = powerData;
    }

    // Get external flow data
    const flowData = await this.getExternalFlowData();
    if (flowData !== null) {
      externalData.waterFlowRate = flowData;
    }

    // Get external ambient data
    const ambientData = await this.getExternalAmbientData();
    if (ambientData !== null) {
      externalData.ambientTemperature = ambientData;
    }

    return externalData;
  }

  /**
   * Get localized SCOP status message
   */
  private getSCOPStatusMessage(statusKey: string): string {
    const i18nKey = `scop_status.${statusKey}`;
    try {
      return this.homey.__(i18nKey) || statusKey;
    } catch (error) {
      // Fallback to English if translation fails
      const fallbackMessages: Record<string, string> = {
        initializing: 'Initializing seasonal data collection...',
        collecting: 'Collecting seasonal performance data',
        insufficient_data: 'Insufficient seasonal data (need 7+ days)',
        calculating: 'Calculating seasonal performance...',
      };
      return fallbackMessages[statusKey] || statusKey;
    }
  }

  /**
   * Initialize COP calculation system
   */
  private async initializeCOP(): Promise<void> {
    try {
      // Initialize SCOP calculator for seasonal performance tracking
      this.scopCalculator = new SCOPCalculator(this.homey);
      this.log('SCOP calculator initialized');

      // Initialize SCOP quality capability with localized message
      if (this.hasCapability('adlar_scop_quality')) {
        const initialStatus = this.getSCOPStatusMessage('initializing');
        await this.setCapabilityValue('adlar_scop_quality', initialStatus);
        this.log('SCOP quality capability initialized with status message');
      }

      // Load COP settings from device settings
      await this.loadCOPSettings();

      // Check if COP capability is available
      if (this.hasCapability('adlar_cop')) {
        // Start COP calculation interval if enabled
        const copEnabled = this.copSettings?.enableCOP !== false; // default enabled
        if (copEnabled) {
          this.startCOPCalculationInterval();
          // Update SCOP quality to collecting status once COP starts
          if (this.hasCapability('adlar_scop_quality')) {
            const collectingStatus = this.getSCOPStatusMessage('collecting');
            await this.setCapabilityValue('adlar_scop_quality', collectingStatus);
          }
          this.log('COP calculation system initialized and started');
        } else {
          // Update SCOP quality to show COP is disabled
          if (this.hasCapability('adlar_scop_quality')) {
            const disabledMessage = this.homey.__('COP calculation disabled') || 'COP calculation disabled';
            await this.setCapabilityValue('adlar_scop_quality', disabledMessage);
          }
          this.log('COP calculation disabled by settings');
        }
      } else {
        this.log('COP capability not available on device');
      }

      // Initialize SCOP updates if capability is available
      if (this.hasCapability('adlar_scop') && this.scopCalculator) {
        this.startSCOPUpdateInterval();
        this.log('SCOP update system initialized');
      }

      // Initialize external power capability with default value
      if (this.hasCapability('adlar_external_power')) {
        await this.setCapabilityValue('adlar_external_power', null);
        this.log('External power capability initialized with default value (null W)');
      }

      // Initialize external flow capability with default value
      if (this.hasCapability('adlar_external_flow')) {
        await this.setCapabilityValue('adlar_external_flow', null);
        this.log('External flow capability initialized with default value (null L/min)');
      }

      // Initialize external ambient temperature capability with default value
      if (this.hasCapability('adlar_external_ambient')) {
        await this.setCapabilityValue('adlar_external_ambient', null);
        this.log('External ambient capability initialized with default value (null°C)');
      }
    } catch (error) {
      this.error('Error initializing COP system:', error);
    }
  }

  /**
   * Load COP settings from device settings
   */
  private async loadCOPSettings(): Promise<void> {
    try {
      const settings = this.getSettings();

      this.copSettings = {
        enableCOP: settings.cop_calculation_enabled !== false, // default true
        calculationMethod: settings.cop_calculation_method || 'auto',
        enableOutlierDetection: settings.cop_outlier_detection_enabled !== false, // default true
        customOutlierThresholds: {
          minCOP: settings.cop_min_threshold || DeviceConstants.MIN_VALID_COP,
          maxCOP: settings.cop_max_threshold || DeviceConstants.MAX_VALID_COP,
        },
        externalDevices: {
          power: {
            deviceId: settings.external_power_device_id || '',
            capability: settings.external_power_capability || 'measure_power',
            enabled: !!settings.external_power_enabled,
          },
          flow: {
            deviceId: settings.external_flow_device_id || '',
            capability: settings.external_flow_capability || 'measure_water',
            enabled: !!settings.external_flow_enabled,
          },
          ambient: {
            deviceId: settings.external_ambient_device_id || '',
            capability: settings.external_ambient_capability || 'measure_temperature',
            enabled: !!settings.external_ambient_enabled,
          },
        },
      };

      this.debugLog('COP settings loaded:', this.copSettings);

      // Debug COP capability status immediately after loading settings
      this.debugCOPCapabilityStatus();
    } catch (error) {
      this.error('Error loading COP settings:', error);
      // Set default settings on error
      this.copSettings = {
        enableCOP: true,
        calculationMethod: 'auto',
        enableOutlierDetection: true,
        customOutlierThresholds: {
          minCOP: DeviceConstants.MIN_VALID_COP,
          maxCOP: DeviceConstants.MAX_VALID_COP,
        },
        externalDevices: {
          power: { deviceId: '', capability: 'measure_power', enabled: false },
          flow: { deviceId: '', capability: 'measure_water', enabled: false },
          ambient: { deviceId: '', capability: 'measure_temperature', enabled: false },
        },
      };
    }
  }

  /**
   * Debug method to check COP capability status and configuration
   */
  public debugCOPCapabilityStatus(): void {
    this.log('🔧 COP Capability Debug Status:');
    this.log(`  📋 hasCapability('adlar_cop'): ${this.hasCapability('adlar_cop')}`);
    this.log(`  ⚙️  cop_calculation_enabled setting: ${this.getSetting('cop_calculation_enabled')}`);
    this.log(`  🏗️  copSettings?.enableCOP: ${this.copSettings?.enableCOP}`);

    // List all current capabilities
    const allCaps = this.getCapabilities();
    this.log(`  📊 Total capabilities: ${allCaps.length}`);
    this.log(`  🔍 COP in capability list: ${allCaps.includes('adlar_cop')}`);

    if (process.env.DEBUG === '1') {
      this.log(`  📝 All capabilities: ${allCaps.join(', ')}`);
    }

    // Check if capability definition exists in app.json
    try {
      const capabilityDefinition = this.homey.manifest.capabilities?.adlar_cop;
      this.log(`  📋 COP capability definition exists: ${!!capabilityDefinition}`);
      if (capabilityDefinition) {
        this.log(`  📋 COP definition type: ${capabilityDefinition.type}`);
      }
    } catch (error) {
      this.log(`  ❌ Error checking capability definition: ${error}`);
    }
  }

  /**
   * Start COP calculation interval
   */
  private startCOPCalculationInterval(): void {
    try {
      const interval = this.homey.setInterval(async () => {
        try {
          await this.calculateAndUpdateCOP();
        } catch (error) {
          this.error('Error during COP calculation:', error);
        }
      }, DeviceConstants.COP_CALCULATION_INTERVAL_MS);

      if (interval) {
        this.copCalculationInterval = interval;
        this.log('Started COP calculation interval');
      } else {
        this.copCalculationInterval = null;
        this.error('Failed to start COP calculation interval: setInterval returned undefined');
      }
    } catch (err) {
      this.copCalculationInterval = null;
      this.error('Error starting COP calculation interval:', err);
    }
  }

  /**
   * Stop COP calculation interval
   */
  private stopCOPCalculationInterval(): void {
    if (this.copCalculationInterval) {
      clearInterval(this.copCalculationInterval);
      this.copCalculationInterval = null;
      this.log('Stopped COP calculation interval');
    }
  }

  /**
   * Start SCOP update interval for daily/periodic SCOP recalculation
   */
  private startSCOPUpdateInterval(): void {
    try {
      const interval = this.homey.setInterval(async () => {
        try {
          await this.updateSCOPCapabilities();
        } catch (error) {
          this.error('Error during SCOP update:', error);
        }
      }, DeviceConstants.SCOP_CALCULATION_INTERVAL_MS);

      if (interval) {
        this.scopUpdateInterval = interval;
        this.log('Started SCOP update interval (daily)');
      } else {
        this.error('Failed to start SCOP update interval: setInterval returned undefined');
      }
    } catch (err) {
      this.error('Error starting SCOP update interval:', err);
    }
  }

  /**
   * Stop SCOP update interval
   */
  private stopSCOPUpdateInterval(): void {
    if (this.scopUpdateInterval) {
      clearInterval(this.scopUpdateInterval);
      this.scopUpdateInterval = null;
      this.log('Stopped SCOP update interval');
    }
  }

  /**
   * Update SCOP capabilities with latest seasonal calculation
   */
  private async updateSCOPCapabilities(): Promise<void> {
    if (!this.scopCalculator || !this.hasCapability('adlar_scop')) {
      return;
    }

    try {
      const scopResult = this.scopCalculator.calculateSCOP();

      if (scopResult) {
        const roundedSCOP = Math.round(scopResult.scop * 10) / 10;
        await this.setCapabilityValue('adlar_scop', roundedSCOP);
        await this.setCapabilityValue('adlar_scop_quality', scopResult.dataQuality);

        this.log(`📊 SCOP daily update: ${roundedSCOP} (confidence: ${scopResult.confidence}, ${Math.round(scopResult.seasonalCoverage * 100)}% coverage)`);

        // Log seasonal summary in debug mode
        this.debugLog('SCOP seasonal summary:', this.scopCalculator.getSeasonalSummary());
      } else {
        // Update status to show insufficient data with localized message
        const insufficientStatus = this.getSCOPStatusMessage('insufficient_data');
        await this.setCapabilityValue('adlar_scop_quality', insufficientStatus);
        this.debugLog('📊 SCOP daily update: Insufficient data for calculation');
      }
    } catch (error) {
      this.error('Failed to update SCOP capabilities:', error);
    }
  }

  /**
   * Calculate and update COP value with enhanced debugging
   */
  private async calculateAndUpdateCOP(): Promise<void> {
    if (!this.hasCapability('adlar_cop') || !this.copSettings?.enableCOP) {
      this.debugLog('COP calculation skipped - capability not available or disabled');
      return;
    }

    try {
      // Gather data sources from device capabilities
      const deviceData = this.gatherDeviceDataSources();
      this.debugLog('Device data sources gathered:', deviceData);

      // Get external device data via direct access if configured
      let externalData = {};
      const externalDataSources: string[] = [];

      this.log('🔍 Checking external device configurations...');

      // Use simplified direct device access
      const externalDeviceData = await this.getExternalDeviceData();

      if (externalDeviceData.electricalPower !== null) {
        externalData = { ...externalData, electricalPower: externalDeviceData.electricalPower };
        externalDataSources.push('power(direct)');
      }

      if (externalDeviceData.waterFlowRate !== null) {
        externalData = { ...externalData, waterFlowRate: externalDeviceData.waterFlowRate };
        externalDataSources.push('flow(direct)');
      }

      if (externalDeviceData.ambientTemperature !== null) {
        externalData = { ...externalData, ambientTemperature: externalDeviceData.ambientTemperature };
        externalDataSources.push('ambient(direct)');
      }

      this.debugLog('External data sources:', externalDataSources.length > 0 ? externalDataSources.join(', ') : 'none');
      this.debugLog('External data retrieved via direct access:', externalData);

      // Combine device and external data (external data takes precedence, unless undefined)
      const combinedData = {
        ...deviceData,
        ...Object.fromEntries(
          Object.entries(externalData ?? {}).filter(([, v]) => v !== undefined),
        ),
      };
      this.debugLog('Combined data for COP calculation:', combinedData);

      // Log data availability for each calculation method with detailed analysis
      this.logDataAvailabilityForMethods(combinedData);

      // Enhanced method selection logging
      this.logCOPMethodSelection(combinedData);

      // Calculate COP using the calculator service
      const copConfig = {
        forceMethod: this.copSettings.calculationMethod as 'auto' | 'direct_thermal' | 'carnot_estimation' | 'temperature_difference',
        enableOutlierDetection: this.copSettings.enableOutlierDetection,
        customOutlierThresholds: this.copSettings.customOutlierThresholds,
      };

      this.debugLog('COP calculation config:', copConfig);

      const copResult = COPCalculator.calculateCOP(combinedData, copConfig);

      // Note: External device source enhancement removed in simplified approach

      // Enhanced result logging
      this.logCOPCalculationResult(copResult);

      // Update COP capability if valid
      if (copResult.cop > 0 && !copResult.isOutlier) {
        const roundedCOP = Math.round(copResult.cop * 100) / 100;
        await this.setCapabilityValue('adlar_cop', roundedCOP);

        // Update COP method capability
        const methodDisplayName = this.formatCOPMethodDisplay(copResult.method, copResult.confidence, copResult.diagnosticInfo);
        await this.setCapabilityValue('adlar_cop_method', methodDisplayName);

        this.log(`✅ COP updated: ${roundedCOP} (method: ${copResult.method}, confidence: ${copResult.confidence})`);

        // Log method description for debugging
        this.debugLog('Method details:', COPCalculator.getMethodDescription(copResult.method));

        // Add measurement to SCOP calculator if available
        await this.addCOPMeasurementToSCOP(copResult, combinedData);

        // Add measurement to rolling COP calculator
        await this.addCOPMeasurementToRolling(copResult, combinedData);
      } else if (copResult.isOutlier) {
        this.log(`⚠️ COP outlier detected (${copResult.cop.toFixed(2)}): ${copResult.outlierReason}`);
        this.debugLog('Outlier data sources:', copResult.dataSources);

        // Update COP method capability to show outlier status
        const methodDisplayName = `${this.formatCOPMethodDisplay(copResult.method, 'low', copResult.diagnosticInfo)} (Outlier)`;
        await this.setCapabilityValue('adlar_cop_method', methodDisplayName);

        // Trigger outlier flow card if configured
        if (this.hasCapability('adlar_cop')) {
          await this.triggerFlowCard('cop_outlier_detected', {
            outlier_cop: copResult.cop,
            outlier_reason: copResult.outlierReason || 'Unknown reason',
            calculation_method: copResult.method,
          });
        }
      } else {
        this.log(`❌ COP calculation failed: ${copResult.method}`);
        this.debugLog('Failed calculation data:', combinedData);

        // Update capabilities to reflect failed calculation
        if (copResult.method === 'insufficient_data') {
          await this.setCapabilityValue('adlar_cop', 0);
          const failedMethodName = this.formatCOPMethodDisplay('insufficient_data', 'low', copResult.diagnosticInfo);
          await this.setCapabilityValue('adlar_cop_method', failedMethodName);
          this.log('✅ COP capabilities updated to reflect insufficient data condition');
        }
      }

      // Trigger COP efficiency flow card if thresholds are met
      await this.checkCOPEfficiencyTriggers(copResult);

    } catch (error) {
      this.error('❌ Error calculating COP:', error);

      // Log debugging information on error
      if (process.env.DEBUG === '1') {
        this.error('COP calculation error context:', {
          hasCapability: this.hasCapability('adlar_cop'),
          copSettings: this.copSettings,
        });
      }
    }
  }

  /**
   * Log data availability for each COP calculation method
   */
  private logDataAvailabilityForMethods(data: COPDataSources): void {
    const methodRequirements = {
      'Direct Thermal': ['electricalPower', 'waterFlowRate', 'inletTemperature', 'outletTemperature'],
      'Carnot Estimation': ['outletTemperature', 'ambientTemperature', 'compressorFrequency'],
      'Temperature Difference': ['inletTemperature', 'outletTemperature'],
    };

    this.debugLog('🔍 COP Method Data Availability:');

    Object.entries(methodRequirements).forEach(([method, required]) => {
      const available = required.filter((field) => {
        const value = data[field as keyof COPDataSources];
        return value !== undefined && value !== null && value !== 0;
      });

      const canUse = available.length === required.length;
      const status = canUse ? '✅' : '❌';

      this.debugLog(`  ${status} ${method}: ${available.length}/${required.length} fields available`);

      if (!canUse) {
        const missing = required.filter((field) => {
          const value = data[field as keyof COPDataSources];
          return value === undefined || value === null || value === 0;
        });
        this.debugLog(`      Missing: ${missing.join(', ')}`);
      }
    });
  }

  /**
   * Log comprehensive COP calculation result with calculation expressions
   */
  private logCOPCalculationResult(result: {
    method: string;
    cop: number;
    confidence: string;
    isOutlier: boolean;
    outlierReason?: string;
    dataSources: Record<string, { value: number | string; source: string }>;
    calculationDetails?: Record<string, unknown>;
  }): void {
    const methodIcons = {
      direct_thermal: '🎯',
      carnot_estimation: '🧮',
      temperature_difference: '📏',
      insufficient_data: '❌',
    };

    const confidenceIcons = {
      high: '🟢',
      medium: '🟡',
      low: '🔴',
    };

    this.log('📊 COP Calculation Result:');
    this.log(`  ${methodIcons[result.method as keyof typeof methodIcons]} Method: ${result.method}`);
    this.log(`  🎯 COP Value: ${result.cop.toFixed(3)}`);
    this.log(`  ${confidenceIcons[result.confidence as keyof typeof confidenceIcons]} Confidence: ${result.confidence}`);

    if (result.isOutlier) {
      this.log(`  ⚠️ Outlier: ${result.outlierReason}`);
    }

    // Log calculation expression and formula used
    this.logCalculationExpression(result);

    // Log data sources used
    if (Object.keys(result.dataSources).length > 0) {
      this.log('  📊 Data Sources Used:');
      Object.entries(result.dataSources).forEach(([key, value]) => {
        this.log(`    • ${key}: ${value.value} (${value.source})`);
      });
    }

    // Log calculation details if available
    if (result.calculationDetails && Object.keys(result.calculationDetails).length > 0) {
      this.log('  🔬 Calculation Details:');
      Object.entries(result.calculationDetails).forEach(([key, value]) => {
        if (typeof value === 'number') {
          this.log(`    • ${key}: ${value.toFixed(3)}`);
        } else {
          this.log(`    • ${key}: ${value}`);
        }
      });
    }

    // Log method description for context
    const methodDescription = this.getCOPMethodDescription(result.method);
    if (methodDescription) {
      this.log(`  📖 Method Info: ${methodDescription}`);
    }
  }

  /**
   * Log COP method selection logic with detailed reasoning
   */
  private logCOPMethodSelection(data: COPDataSources): void {
    this.log('🎯 COP Method Selection Analysis:');

    // Check Direct Thermal method
    const canDirectThermal = !!(
      data.waterFlowRate && data.waterFlowRate > 0
      && data.inletTemperature !== undefined && data.inletTemperature !== null
      && data.outletTemperature !== undefined && data.outletTemperature !== null
      && data.electricalPower && data.electricalPower > 0
    );

    this.log(`  🎯 Direct Thermal: ${canDirectThermal ? '✅ Available' : '❌ Not available'}`);
    if (!canDirectThermal) {
      const missing = [];
      if (!data.waterFlowRate || data.waterFlowRate <= 0) missing.push('waterFlowRate');
      if (data.inletTemperature === undefined || data.inletTemperature === null) missing.push('inletTemperature');
      if (data.outletTemperature === undefined || data.outletTemperature === null) missing.push('outletTemperature');
      if (!data.electricalPower || data.electricalPower <= 0) missing.push('electricalPower');
      this.log(`    Missing: ${missing.join(', ')}`);
    }

    // Check Carnot Estimation method
    const canCarnot = !!(
      data.outletTemperature !== undefined && data.outletTemperature !== null
      && data.ambientTemperature !== undefined && data.ambientTemperature !== null
      && data.compressorFrequency && data.compressorFrequency > 0
    );

    this.log(`  🧮 Carnot Estimation: ${canCarnot ? '✅ Available' : '❌ Not available'}`);
    if (!canCarnot) {
      const missing = [];
      if (data.outletTemperature === undefined || data.outletTemperature === null) missing.push('outletTemperature');
      if (data.ambientTemperature === undefined || data.ambientTemperature === null) missing.push('ambientTemperature');
      if (!data.compressorFrequency || data.compressorFrequency <= 0) missing.push('compressorFrequency');
      this.log(`    Missing: ${missing.join(', ')}`);
    } else {
      this.log('    ✅ All required data available:');
      this.log(`      • outletTemperature: ${data.outletTemperature}°C`);
      this.log(`      • ambientTemperature: ${data.ambientTemperature}°C`);
      this.log(`      • compressorFrequency: ${data.compressorFrequency}Hz`);
    }

    // Check Temperature Difference method
    const canTempDiff = !!(
      data.inletTemperature !== undefined && data.inletTemperature !== null
      && data.outletTemperature !== undefined && data.outletTemperature !== null
    );

    this.log(`  📏 Temperature Difference: ${canTempDiff ? '✅ Available' : '❌ Not available'}`);
    if (!canTempDiff) {
      const missing = [];
      if (data.inletTemperature === undefined || data.inletTemperature === null) missing.push('inletTemperature');
      if (data.outletTemperature === undefined || data.outletTemperature === null) missing.push('outletTemperature');
      this.log(`    Missing: ${missing.join(', ')}`);
    }

    // Determine which method will be selected
    let selectedMethod = 'insufficient_data';
    if (canDirectThermal) {
      selectedMethod = 'direct_thermal';
    } else if (canCarnot) {
      selectedMethod = 'carnot_estimation';
    } else if (canTempDiff) {
      selectedMethod = 'temperature_difference';
    }

    this.log(`  🏆 Selected Method: ${selectedMethod}`);

    // Special case analysis for your scenario
    if (!canDirectThermal && canCarnot) {
      this.log('  💡 Analysis: Direct thermal unavailable due to missing electrical power, using Carnot estimation (good choice!)');
    } else if (!canDirectThermal && !canCarnot && canTempDiff) {
      this.log('  ⚠️  Analysis: Both direct thermal and Carnot unavailable, falling back to less accurate temperature difference method');
    }
  }

  /**
   * Enhance COP result with external device source information
   */
  private enhanceCOPResultWithExternalSources(
    copResult: { dataSources: Record<string, { value: number | string; source: string }> },
    externalDeviceInfo: Record<string, { deviceName: string; value: number; source: string }>,
  ): void {
    // Update data sources to include external device names where applicable
    Object.entries(copResult.dataSources).forEach(([key, dataSource]) => {
      const externalInfo = externalDeviceInfo[key];
      if (externalInfo && dataSource.source.startsWith('external:')) {
        // Replace generic external source with device name
        dataSource.source = `${externalInfo.deviceName} (${externalInfo.source})`;
      }
    });
  }

  /**
   * Log the specific calculation expression used for the COP calculation
   */
  private logCalculationExpression(result: {
    method: string;
    cop: number;
    dataSources: Record<string, { value: number | string; source: string }>;
    calculationDetails?: Record<string, unknown>;
  }): void {
    const ds = result.dataSources;
    const cd = result.calculationDetails;

    switch (result.method) {
      case 'direct_thermal': {
        if (ds.electricalPower && ds.waterFlowRate && ds.temperatureDifference && cd?.massFlowRate && cd?.thermalOutput) {
          this.log('  🧮 Formula: COP = Q_thermal / P_electrical');
          this.log('  📐 Expression: Q_thermal = ṁ × Cp × ΔT');
          this.log(`    Where: ṁ = ${(cd.massFlowRate as number).toFixed(3)} kg/s (${ds.waterFlowRate.value} L/min)`);
          this.log(`           Cp = ${DeviceConstants.WATER_SPECIFIC_HEAT_CAPACITY} J/(kg·K) (water specific heat)`);
          this.log(`           ΔT = ${ds.temperatureDifference.value}°C (outlet - inlet temp)`);
          this.log(`  🔢 Calculation: ${(cd.thermalOutput as number).toFixed(1)} W / ${ds.electricalPower.value} W = ${result.cop.toFixed(3)}`);
        }
        break;
      }

      case 'carnot_estimation': {
        if (ds.ambientTemperature && cd?.carnotCOP && cd?.efficiencyFactor) {
          const ambientValue = typeof ds.ambientTemperature.value === 'number' ? ds.ambientTemperature.value : 0;
          const tempDiffValue = ds.temperatureDifference && typeof ds.temperatureDifference.value === 'number'
            ? ds.temperatureDifference.value : 0;
          const outletTemp = ds.temperatureDifference
            ? (ambientValue + tempDiffValue) : 'unknown';
          this.log('  🧮 Formula: COP = Carnot_COP × η_practical');
          this.log('  📐 Expression: Carnot_COP = T_hot / (T_hot - T_cold)');
          this.log(`    Where: T_hot = ${outletTemp}K, T_cold = ${(ambientValue + 273.15).toFixed(1)}K`);
          this.log(`           η_practical = ${(cd.efficiencyFactor as number).toFixed(3)} (efficiency factor)`);
          this.log(`  🔢 Calculation: ${(cd.carnotCOP as number).toFixed(3)} × ${(cd.efficiencyFactor as number).toFixed(3)} = ${result.cop.toFixed(3)}`);
        }
        break;
      }

      case 'temperature_difference': {
        if (ds.temperatureDifference) {
          this.log('  🧮 Formula: COP = f(ΔT) using empirical relationships');
          this.log(`  📐 Expression: Based on ΔT = ${ds.temperatureDifference.value}°C`);

          const tempDiff = typeof ds.temperatureDifference.value === 'number' ? ds.temperatureDifference.value : 0;
          const thresholds = DeviceConstants.COP_TEMP_DIFF_THRESHOLDS;

          if (tempDiff < thresholds.LOW_EFFICIENCY_TEMP_DIFF) {
            const logMsg = `  🔢 Calculation: ΔT < ${thresholds.LOW_EFFICIENCY_TEMP_DIFF}°C → COP = ${thresholds.LOW_EFFICIENCY_COP}`;
            this.log(logMsg);
          } else if (tempDiff < thresholds.MODERATE_EFFICIENCY_TEMP_DIFF) {
            const calculatedCOP = thresholds.MODERATE_EFFICIENCY_COP_BASE
              + (tempDiff - thresholds.LOW_EFFICIENCY_TEMP_DIFF) * thresholds.MODERATE_EFFICIENCY_SLOPE;
            const formula = `COP = ${thresholds.MODERATE_EFFICIENCY_COP_BASE} + (${tempDiff} - ${thresholds.LOW_EFFICIENCY_TEMP_DIFF}) × ${thresholds.MODERATE_EFFICIENCY_SLOPE}`;
            this.log(`  🔢 Calculation: ${formula} = ${calculatedCOP.toFixed(3)}`);
          } else {
            const logMsg = `  🔢 Calculation: ΔT ≥ ${thresholds.MODERATE_EFFICIENCY_TEMP_DIFF}°C → COP = ${thresholds.HIGH_EFFICIENCY_COP} (capped)`;
            this.log(logMsg);
          }
        }
        break;
      }

      case 'insufficient_data': {
        this.log('  ❌ Expression: No calculation performed - insufficient data available');
        break;
      }

      default: {
        this.log(`  ❓ Expression: Unknown method '${result.method}'`);
        break;
      }
    }
  }

  /**
   * Get human-readable description of COP calculation method with internationalization
   */
  private getCOPMethodDescription(method: string): string | null {
    const i18nKey = `cop_method_description.${method}`;
    try {
      const description = this.homey.__(i18nKey);
      if (description && description !== i18nKey) {
        return description;
      }
    } catch (error) {
      // Fall through to fallback descriptions
    }

    // Fallback to English descriptions if translation not available
    switch (method) {
      case 'direct_thermal':
        return 'Direct thermal calculation using water flow and temperature difference (±5% accuracy)';
      case 'carnot_estimation':
        return 'Carnot-based estimation using compressor frequency and ambient temperature (±15% accuracy)';
      case 'temperature_difference':
        return 'Temperature difference estimation using empirical relationships (±30% accuracy)';
      case 'insufficient_data':
        return 'Insufficient data available for any COP calculation method';
      default:
        return null;
    }
  }

  /**
   * Check and trigger COP efficiency flow cards
   */
  private async checkCOPEfficiencyTriggers(copResult: { cop: number; isOutlier: boolean; method: string; confidence: string }): Promise<void> {
    if (!copResult.cop || copResult.cop <= 0 || copResult.isOutlier) {
      return;
    }

    try {
      // Get previous COP value to detect significant changes
      const previousCOP = this.getCapabilityValue('adlar_cop') || 0;
      const copChange = Math.abs(copResult.cop - previousCOP);

      // Trigger COP efficiency changed if change is significant (> 0.5)
      if (copChange > 0.5 && previousCOP > 0) {
        // Determine condition based on thresholds
        const goodEfficiencyThreshold = 3.0;
        const excellentEfficiencyThreshold = 4.0;

        let condition: 'above' | 'below';
        let threshold: number;

        if (copResult.cop >= excellentEfficiencyThreshold) {
          condition = 'above';
          threshold = excellentEfficiencyThreshold;
        } else if (copResult.cop < goodEfficiencyThreshold) {
          condition = 'below';
          threshold = goodEfficiencyThreshold;
        } else {
          // In middle range, use previous value to determine direction
          condition = copResult.cop > previousCOP ? 'above' : 'below';
          threshold = goodEfficiencyThreshold;
        }

        await this.triggerFlowCard('cop_efficiency_changed', {
          current_cop: copResult.cop,
          threshold_cop: threshold,
          calculation_method: copResult.method,
          confidence_level: copResult.confidence,
        });

        this.debugLog(`🎯 COP efficiency trigger fired: ${copResult.cop.toFixed(2)} ${condition} ${threshold}`);
      }

    } catch (error) {
      this.debugLog('Error checking COP efficiency triggers:', error);
    }
  }

  /**
   * Gather data sources from device capabilities
   */
  private gatherDeviceDataSources(): COPDataSources {
    const data: COPDataSources = {};

    try {
      // Electrical power (from internal or external source)
      if (this.hasCapability('measure_power')) {
        const power = this.getCapabilityValue('measure_power');
        if (typeof power === 'number' && power > 0) {
          data.electricalPower = power;
        }
      }

      // Water flow rate
      if (this.hasCapability('measure_water')) {
        const flow = this.getCapabilityValue('measure_water');
        if (typeof flow === 'number' && flow > 0) {
          data.waterFlowRate = flow;
        }
      }

      // Temperature measurements
      if (this.hasCapability('measure_temperature.temp_top')) {
        const temp = this.getCapabilityValue('measure_temperature.temp_top');
        if (typeof temp === 'number') {
          data.inletTemperature = temp;
        }
      }

      if (this.hasCapability('measure_temperature.temp_bottom')) {
        const temp = this.getCapabilityValue('measure_temperature.temp_bottom');
        if (typeof temp === 'number') {
          data.outletTemperature = temp;
        }
      }

      if (this.hasCapability('measure_temperature.around_temp')) {
        const temp = this.getCapabilityValue('measure_temperature.around_temp');
        if (typeof temp === 'number') {
          data.ambientTemperature = temp;
        }
      }

      // Compressor frequency for Carnot estimation
      if (this.hasCapability('measure_frequency.compressor_strength')) {
        const freq = this.getCapabilityValue('measure_frequency.compressor_strength');
        if (typeof freq === 'number') {
          data.compressorFrequency = freq;
        }
      }

      // System states
      if (this.hasCapability('adlar_state_defrost_state')) {
        const defrost = this.getCapabilityValue('adlar_state_defrost_state');
        data.isDefrosting = Boolean(defrost);
      }

      if (this.hasCapability('adlar_enum_mode')) {
        const mode = this.getCapabilityValue('adlar_enum_mode');
        if (typeof mode === 'string') {
          data.systemMode = mode;
        }
      }

    } catch (error) {
      this.error('Error gathering device data sources:', error);
    }

    return data;
  }

  /**
   * Determine if a category should register flow cards based on combined logic
   */
  private shouldRegisterCategory(
    _category: keyof CapabilityCategories,
    availableCaps: string[],
    userSetting: string,
    capabilitiesWithData: string[],
  ): boolean {

    switch (userSetting) {
      case 'disabled':
        return false;

      case 'enabled':
        return availableCaps.length > 0; // Has capabilities

      case 'auto':
      default:
        // Auto mode: require both capability AND data
        return availableCaps.length > 0
               && availableCaps.some((cap) => capabilitiesWithData.includes(cap));
    }
  }

  /**
   * Get category for a capability
   */
  private getCapabilityCategory(capability: string): keyof CapabilityCategories {
    if (capability.startsWith('measure_temperature')) return 'temperature';
    if (capability.startsWith('measure_voltage')) return 'voltage';
    if (capability.startsWith('measure_current')) return 'current';
    if (capability.includes('power')) return 'power';
    if (capability.includes('pulse_steps')) return 'pulseSteps';
    if (capability.startsWith('adlar_state')) return 'states';
    if (capability.includes('cop') || capability.includes('scop')) return 'efficiency';
    return 'temperature'; // Default fallback
  }

  /**
   * Updates Homey capabilities based on fetched DPS data.
   * @param {Record<string, unknown>} dpsFetched The DPS data fetched from the Tuya device.
   */
  private updateCapabilitiesFromDps(dpsFetched: Record<string, unknown>): void {
    Object.entries(dpsFetched).forEach(([dpsId, value]) => {
      const dpsNumber = Number(dpsId);

      // Find all capabilities that map to this DPS ID (handle dual capabilities)
      const matchingCapabilities: string[] = [];
      Object.entries(this.allCapabilities).forEach(([capabilityName, dpsArray]) => {
        if (dpsArray.includes(dpsNumber)) {
          matchingCapabilities.push(capabilityName);
        }
      });

      this.debugLog(`DPS ${dpsId} received with value:`, value);
      this.debugLog(`Found ${matchingCapabilities.length} capabilities for dpsId ${dpsId}:`, matchingCapabilities);

      // Special debug for DPS 13 (heating curve)
      if (dpsNumber === 13) {
        this.log('DPS 13 (heating curve) update:', value);
        this.log('All capabilities mapping:', Object.keys(this.allCapabilities));
        this.log('adlar_enum_countdown_set mapping:', this.allCapabilities['adlar_enum_countdown_set']);
      }

      if (matchingCapabilities.length > 0) {
        // Update all matching capabilities
        matchingCapabilities.forEach((capability) => {
          // Update capability health tracking
          this.updateCapabilityHealth(capability, value);

          // Check for critical conditions before updating
          this.checkForCriticalConditions(capability, value).catch((err) => this.error('Error checking critical conditions:', err));

          // Update the capability value in Homey - but only if capability exists
          if (this.hasCapability(capability)) {
            this.setCapabilityValue(capability, (value as boolean | number | string))
              .then(() => this.debugLog(`Updated ${capability} to`, String(value)))
              .catch((err) => {
                const categorizedError = TuyaErrorCategorizer.categorize(err as Error, `Setting capability ${capability}`);
                this.error(TuyaErrorCategorizer.formatForLogging(categorizedError));

                // Only attempt recovery for retryable errors
                if (categorizedError.retryable) {
                  this.homey.setTimeout(() => {
                    if (this.hasCapability(capability)) {
                      this.setCapabilityValue(capability, (value as boolean | number | string))
                        .catch((retryErr) => this.error(`Retry failed for ${capability}:`, retryErr));
                    }
                  }, DeviceConstants.CAPABILITY_RETRY_DELAY_MS);
                }
              });
          } else {
            this.debugLog(`Skipping capability update for ${capability} - capability not available on device`);
          }
        });
      } else {
        this.debugLog(`No capability mapping found for DPS ${dpsId}`);
      }
    });
  }

  private async checkForCriticalConditions(capability: string, value: unknown) {
    // Check user preferences first
    const category = this.getCapabilityCategory(capability);
    const userSettings = this.getUserFlowPreferences();

    // Map category to correct property name
    const settingMap: Record<keyof CapabilityCategories, keyof UserFlowPreferences> = {
      temperature: 'flow_temperature_alerts',
      voltage: 'flow_voltage_alerts',
      current: 'flow_current_alerts',
      power: 'flow_power_alerts',
      pulseSteps: 'flow_pulse_steps_alerts',
      states: 'flow_state_alerts',
      efficiency: 'flow_efficiency_alerts',
    };

    const userSetting = userSettings[settingMap[category]];

    if (userSetting === 'disabled') {
      return; // User disabled this category
    }

    // Check if capability should trigger based on combined logic
    const availableCaps = this.getAvailableCapabilities();
    const capabilitiesWithData = [capability]; // This capability clearly has data

    if (!this.shouldRegisterCategory(category, availableCaps[category], userSetting as string, capabilitiesWithData)) {
      return; // Doesn't meet combined criteria
    }

    // System fault detection (always enabled - critical for safety)
    if (capability === 'adlar_fault' && value !== 0) {
      await this.sendCriticalNotification(
        'System Fault Detected',
        `Heat pump fault code: ${value}. Please check system immediately.`,
      );
      // Fire fault trigger
      await this.triggerFlowCard('fault_detected', { fault_code: value });
    }

    // Temperature safety checks and flow triggers
    const temperatureCapabilityMap: Record<string, string> = {
      'measure_temperature.coiler_temp': 'coiler_temperature_alert',
      'measure_temperature.bottom_temp_f': 'incoiler_temperature_alert',
      'measure_temperature.around_temp_f': 'tank_temperature_alert',
      'measure_temperature.coiler_temp_f': 'suction_temperature_alert',
      'measure_temperature.venting_temp': 'discharge_temperature_alert',
      'measure_temperature.evlin': 'economizer_inlet_temperature_alert',
      'measure_temperature.eviout': 'economizer_outlet_temperature_alert',
      'measure_temperature.temp_current_f': 'high_pressure_temperature_alert',
      'measure_temperature.top_temp_f': 'low_pressure_temperature_alert',
    };

    if (temperatureCapabilityMap[capability] && typeof value === 'number') {
      // Fire temperature alert flow cards for any significant threshold (customize as needed)
      if (value > 60 || value < 0) {
        await this.triggerFlowCard(temperatureCapabilityMap[capability], {
          temperature: value,
          sensor_type: capability.split('.')[1] || 'unknown',
        });
      }

      // Critical temperature safety checks
      if (value > 80 || value < -20) {
        await this.sendCriticalNotification(
          'Temperature Alert',
          `Extreme temperature detected (${value}°C). System safety may be compromised.`,
        );
      }
    }

    // Voltage alert flow triggers
    const voltageCapabilityMap: Record<string, string> = {
      'measure_voltage.voltage_current': 'phase_a_voltage_alert',
      'measure_voltage.bv': 'phase_b_voltage_alert',
      'measure_voltage.cv': 'phase_c_voltage_alert',
    };

    if (voltageCapabilityMap[capability] && typeof value === 'number') {
      // Fire voltage alert for values outside typical range (customize thresholds)
      if (value > 250 || value < 200) {
        await this.triggerFlowCard(voltageCapabilityMap[capability], {
          voltage: value,
          phase: capability.split('.')[1] || 'unknown',
        });
      }
    }

    // Current alert flow triggers
    const currentCapabilityMap: Record<string, string> = {
      'measure_current.b_cur': 'phase_b_current_alert',
      'measure_current.c_cur': 'phase_c_current_alert',
    };

    if (currentCapabilityMap[capability] && typeof value === 'number') {
      // Fire current alert for high current values (customize threshold)
      if (value > 20) {
        await this.triggerFlowCard(currentCapabilityMap[capability], {
          current: value,
          phase: capability.split('.')[1] || 'unknown',
        });
      }
    }

    // Pulse-steps alerts and flow triggers
    const pulseStepsCapabilityMap: Record<string, string> = {
      adlar_measure_pulse_steps_temp_current: 'eev_pulse_steps_alert',
      adlar_measure_pulse_steps_effluent_temp: 'evi_pulse_steps_alert',
    };

    if (pulseStepsCapabilityMap[capability] && typeof value === 'number') {
      // Fire pulse-steps alert flow cards for values outside operational range
      if (value > 450 || value < 10) {
        await this.triggerFlowCard(pulseStepsCapabilityMap[capability], {
          pulse_steps: value,
          valve_type: capability.includes('temp_current') ? 'eev' : 'evi',
        });
      }

      // Critical pulse-steps safety checks
      if (value > 480 || value < 0) {
        await this.sendCriticalNotification(
          'Pulse-Steps Alert',
          `Critical pulse-steps reading (${value}). System may require immediate attention.`,
        );
      }
    }

    // State change triggers
    const stateCapabilityMap: Record<string, string> = {
      adlar_state_defrost_state: 'defrost_state_changed',
      adlar_state_compressor_state: 'compressor_state_changed',
      adlar_state_backwater_state: 'backwater_state_changed',
    };

    if (stateCapabilityMap[capability]) {
      await this.triggerFlowCard(stateCapabilityMap[capability], {
        new_state: value,
        state_type: capability.split('_').pop() || 'unknown',
      });
    }

    // Temperature change triggers (threshold-based)
    const tempChangeCapabilityMap: Record<string, string> = {
      'measure_temperature.around_temp': 'ambient_temperature_changed',
      'measure_temperature.temp_top': 'inlet_temperature_changed',
      'measure_temperature.temp_bottom': 'outlet_temperature_changed',
    };

    if (tempChangeCapabilityMap[capability] && typeof value === 'number') {
      // Store previous value and check for significant changes
      const prevValueKey = `prev_${capability.replace(/\./g, '_')}`;
      const previousValue = this.getStoreValue(prevValueKey) || value;

      // Fire trigger if temperature changed by more than 2°C
      if (Math.abs(value - previousValue) >= 2) {
        await this.triggerFlowCard(tempChangeCapabilityMap[capability], {
          temperature: value,
          previous_temperature: previousValue,
          change: value - previousValue,
          sensor_type: capability.split('.')[1] || 'unknown',
        });

        // Store new value for next comparison
        await this.setStoreValue(prevValueKey, value);
      }
    }

    // Power and consumption threshold triggers
    if (capability === 'measure_power' && typeof value === 'number') {
      // Fire power threshold exceeded for values above 5kW
      if (value > DeviceConstants.HIGH_POWER_ALERT_THRESHOLD_W) {
        await this.triggerFlowCard('power_threshold_exceeded', {
          power: value,
          threshold: DeviceConstants.HIGH_POWER_ALERT_THRESHOLD_W,
        });
      }
    }

    if (capability === 'meter_power.electric_total' && typeof value === 'number') {
      // Fire consumption milestone for every increment
      const milestoneIncrement = DeviceConstants.CONSUMPTION_MILESTONE_INCREMENT_KWH;
      const currentMilestone = Math.floor(value / milestoneIncrement);
      const lastMilestone = this.getStoreValue('last_consumption_milestone') || 0;

      if (currentMilestone > lastMilestone) {
        await this.triggerFlowCard('total_consumption_milestone', {
          consumption: value,
          milestone: currentMilestone * milestoneIncrement,
        });
        await this.setStoreValue('last_consumption_milestone', currentMilestone);
      }
    }

    if (capability === 'meter_power.electric_today' && typeof value === 'number') {
      // Fire daily consumption threshold for values above threshold
      if (value > DeviceConstants.DAILY_CONSUMPTION_THRESHOLD_KWH) {
        await this.triggerFlowCard('daily_consumption_threshold', {
          daily_consumption: value,
          threshold: DeviceConstants.DAILY_CONSUMPTION_THRESHOLD_KWH,
        });
      }
    }

    // Water flow alert
    if (capability === 'measure_water' && typeof value === 'number') {
      // Fire water flow alert for low flow rates (below 10 L/min)
      if (value < 10) {
        await this.triggerFlowCard('water_flow_alert', {
          flow_rate: value,
          threshold: 10,
          alert_type: 'low_flow',
        });
      }
    }

    // Efficiency alerts
    if (capability === 'adlar_state_compressor_state' && typeof value === 'number') {
      // Calculate efficiency based on power consumption vs state
      const power = this.getCapabilityValue('measure_power') || 0;
      const efficiency = value > 0 && power > 0 ? (value / power) * 100 : 0;

      if (efficiency < DeviceConstants.LOW_EFFICIENCY_THRESHOLD_PERCENT && power > DeviceConstants.DEFAULT_POWER_THRESHOLD_W) { // Low efficiency with significant power draw
        await this.triggerFlowCard('compressor_efficiency_alert', {
          efficiency,
          power,
          threshold: DeviceConstants.LOW_EFFICIENCY_THRESHOLD_PERCENT,
        });
      }
    }

    // Electrical load alert
    const totalCurrentCapabilities = ['measure_current.cur_current', 'measure_current.b_cur', 'measure_current.c_cur'];
    if (totalCurrentCapabilities.includes(capability) && typeof value === 'number') {
      const currentA = this.getCapabilityValue('measure_current.cur_current') || 0;
      const currentB = this.getCapabilityValue('measure_current.b_cur') || 0;
      const currentC = this.getCapabilityValue('measure_current.c_cur') || 0;
      const totalLoad = Number(currentA) + Number(currentB) + Number(currentC);

      if (totalLoad > 50) { // Total electrical load above 50A
        await this.triggerFlowCard('electrical_load_alert', {
          total_load: totalLoad,
          phase_a: currentA,
          phase_b: currentB,
          phase_c: currentC,
          threshold: 50,
        });
      }
    }

    // Fan motor efficiency alert (based on fan speed vs power consumption)
    if (capability === 'adlar_enum_volume_set' && typeof value === 'number') {
      const power = this.getCapabilityValue('measure_power') || 0;
      const expectedPowerRatio = value * 100; // Expected: volume setting * 100W

      if (power > expectedPowerRatio * 1.5) { // 50% higher than expected
        await this.triggerFlowCard('fan_motor_efficiency_alert', {
          volume_setting: value,
          actual_power: power,
          expected_power: expectedPowerRatio,
          efficiency_ratio: expectedPowerRatio / power,
        });
      }
    }

    // Countdown timer finished
    if (capability === 'adlar_countdowntimer' && value === 0) {
      const previousTimer = this.getStoreValue('prev_countdown') || 0;
      if (previousTimer > 0) { // Timer was running and now finished
        await this.triggerFlowCard('countdown_timer_finished', {
          timer_duration: previousTimer,
          completion_time: new Date().toISOString(),
        });
      }
      await this.setStoreValue('prev_countdown', value);
    } else if (capability === 'adlar_countdowntimer' && typeof value === 'number') {
      await this.setStoreValue('prev_countdown', value);
    }
  }

  /**
   * Initialize flow cards based on current settings (called once during device init)
   */
  private async initializeFlowCards(): Promise<void> {
    try {
      await this.updateFlowCards();
      this.isFlowCardsInitialized = true;
      this.log('Flow cards initialized successfully');
    } catch (error) {
      const categorizedError = TuyaErrorCategorizer.categorize(error as Error, 'Initializing flow cards');
      this.error(TuyaErrorCategorizer.formatForLogging(categorizedError));

      if (categorizedError.retryable) {
        this.log('Will retry flow card initialization in 5 seconds');
        this.homey.setTimeout(() => this.initializeFlowCards(), 5000);
      }
    }
  }

  /**
   * Update all flow cards based on current settings (called when settings change)
   */
  private async updateFlowCards(): Promise<void> {
    try {
      // Don't proceed if device isn't fully initialized yet
      if (!this.isFlowCardsInitialized && Object.keys(this.homey.drivers.getDrivers()).length === 0) {
        this.log('Skipping flow card update - system not ready');
        return;
      }

      // Unregister all current flow card listeners
      this.unregisterAllFlowCards();

      // Get current user preferences and available capabilities
      const userPrefs = this.getUserFlowPreferences();
      const availableCaps = this.getAvailableCapabilities();
      const capabilitiesWithData = await this.detectCapabilitiesWithData();

      // Register flow cards based on settings
      await this.registerFlowCardsByCategory('temperature', availableCaps.temperature, userPrefs.flow_temperature_alerts, capabilitiesWithData);
      await this.registerFlowCardsByCategory('voltage', availableCaps.voltage, userPrefs.flow_voltage_alerts, capabilitiesWithData);
      await this.registerFlowCardsByCategory('current', availableCaps.current, userPrefs.flow_current_alerts, capabilitiesWithData);
      await this.registerFlowCardsByCategory('power', availableCaps.power, userPrefs.flow_power_alerts, capabilitiesWithData);
      await this.registerFlowCardsByCategory('pulseSteps', availableCaps.pulseSteps, userPrefs.flow_pulse_steps_alerts, capabilitiesWithData);
      await this.registerFlowCardsByCategory('states', availableCaps.states, userPrefs.flow_state_alerts, capabilitiesWithData);
      await this.registerFlowCardsByCategory('efficiency', availableCaps.efficiency, userPrefs.flow_efficiency_alerts, capabilitiesWithData);

      // Expert feature cards
      if (userPrefs.flow_expert_mode) {
        await this.registerExpertFeatureCards();
      }

      // Register action-based condition cards (always available)
      await this.registerActionBasedConditionCards();

      this.log('Flow cards updated successfully');
    } catch (error) {
      this.error('Error updating flow cards:', error);
    }
  }

  /**
   * Register flow cards for a specific category based on user setting
   */
  private async registerFlowCardsByCategory(
    category: keyof CapabilityCategories,
    availableCaps: string[],
    userSetting: 'disabled' | 'auto' | 'enabled',
    capabilitiesWithData: string[],
  ): Promise<void> {
    const shouldRegister = this.shouldRegisterCategory(category, availableCaps, userSetting, capabilitiesWithData);

    if (!shouldRegister) {
      this.log(`Skipping ${category} flow cards - setting: ${userSetting}, available: ${availableCaps.length}, with data: ${availableCaps.filter((cap) => capabilitiesWithData.includes(cap)).length}`);
      return;
    }

    this.log(`Registering ${category} flow cards - available capabilities:`, availableCaps.filter((cap) => capabilitiesWithData.includes(cap)));

    // Flow cards are handled by the pattern-based system in app.ts
    // No device-level registration needed
    this.debugLog(`Category ${category} flow cards managed by pattern-based system`);
    this.log(`Skipping device-level registration for ${category} - managed by app-level pattern system`);
  }

  /**
   * Register expert feature cards (when expert mode is enabled)
   */
  private async registerExpertFeatureCards(): Promise<void> {
    try {
      // Expert efficiency condition
      const efficiencyCard = this.homey.flow.getConditionCard('compressor_efficiency_above');
      const efficiencyListener = efficiencyCard.registerRunListener(async (args) => {
        this.debugLog('Efficiency condition triggered', { args });
        const rawPower = this.getCapabilityValue('measure_power');
        const rawCompressorState = this.getCapabilityValue('adlar_state_compressor_state');
        const powerIsNull = rawPower === null || rawPower === undefined;
        const compressorStateIsNull = rawCompressorState === null || rawCompressorState === undefined;
        const power = rawPower || 0;
        const compressorState = rawCompressorState || 0;
        const efficiency = compressorState > 0 && power > 0 ? (compressorState / power) * 100 : 0;
        const result = efficiency > (args.threshold || 50);

        if (powerIsNull || compressorStateIsNull) {
          this.debugLog('Efficiency condition: using fallback values for null capabilities', {
            powerRaw: rawPower,
            powerFallback: power,
            powerIsNull,
            compressorStateRaw: rawCompressorState,
            compressorStateFallback: compressorState,
            compressorStateIsNull,
            efficiency,
            threshold: args.threshold || 50,
            result,
          });
        } else {
          this.debugLog('Efficiency condition result', {
            power,
            compressorState,
            efficiency,
            threshold: args.threshold || 50,
            result,
          });
        }
        return result;
      });
      this.flowCardListeners.set('compressor_efficiency_above', efficiencyListener);

      // Expert trigger cards
      const expertTriggerCards = [
        'compressor_efficiency_alert',
        'fan_motor_efficiency_alert',
        'water_flow_alert',
      ];

      expertTriggerCards.forEach((cardId) => {
        try {
          const triggerCard = this.homey.flow.getDeviceTriggerCard(cardId);
          this.flowCardListeners.set(cardId, triggerCard);
        } catch (err) {
          this.log(`Expert trigger card ${cardId} not found, skipping`);
        }
      });

      this.log('Expert feature cards registered');
    } catch (error) {
      this.error('Error registering expert feature cards:', error);
    }
  }

  /**
   * Register action-based condition flow cards
   */
  private async registerActionBasedConditionCards(): Promise<void> {
    try {
      // Device power state condition
      const devicePowerCard = this.homey.flow.getConditionCard('device_power_is');
      devicePowerCard.registerRunListener(async (args) => {
        this.debugLog('Device power condition triggered', { args });
        const currentValue = this.getCapabilityValue('onoff');
        const expectedState = args.state === 'on';
        return currentValue === expectedState;
      });

      // Target temperature condition
      const targetTempCard = this.homey.flow.getConditionCard('target_temperature_is');
      targetTempCard.registerRunListener(async (args) => {
        this.debugLog('Target temperature condition triggered', { args });
        const currentValue = this.getCapabilityValue('target_temperature') || 0;
        const targetValue = args.temperature || 0;

        switch (args.comparison) {
          case 'equal':
            return Math.abs(currentValue - targetValue) < 0.5;
          case 'greater':
            return currentValue > targetValue;
          case 'less':
            return currentValue < targetValue;
          default:
            return false;
        }
      });

      // Hot water temperature condition
      const hotWaterTempCard = this.homey.flow.getConditionCard('hotwater_temperature_is');
      hotWaterTempCard.registerRunListener(async (args) => {
        this.debugLog('Hot water temperature condition triggered', { args });
        const currentValue = this.getCapabilityValue('adlar_hotwater') || 0;
        const targetValue = args.temperature || 0;

        switch (args.comparison) {
          case 'equal':
            return Math.abs(currentValue - targetValue) < 1;
          case 'greater':
            return currentValue > targetValue;
          case 'less':
            return currentValue < targetValue;
          default:
            return false;
        }
      });

      // Heating mode condition
      const heatingModeCard = this.homey.flow.getConditionCard('heating_mode_is');
      heatingModeCard.registerRunListener(async (args) => {
        this.debugLog('Heating mode condition triggered', { args });
        const currentValue = this.getCapabilityValue('adlar_enum_mode');
        return currentValue === args.mode;
      });

      // Work mode condition
      const workModeCard = this.homey.flow.getConditionCard('work_mode_is');
      workModeCard.registerRunListener(async (args) => {
        this.debugLog('Work mode condition triggered', { args });
        const currentValue = this.getCapabilityValue('adlar_enum_work_mode');
        return currentValue === args.mode;
      });

      // Water mode condition
      const waterModeCard = this.homey.flow.getConditionCard('water_mode_is');
      waterModeCard.registerRunListener(async (args) => {
        this.debugLog('Water mode condition triggered', { args });
        const currentValue = this.getCapabilityValue('adlar_enum_water_mode') || 0;
        const targetValue = args.mode || 0;

        switch (args.comparison) {
          case 'equal':
            return currentValue === targetValue;
          case 'greater':
            return currentValue > targetValue;
          case 'less':
            return currentValue < targetValue;
          default:
            return false;
        }
      });

      // Capacity setting condition
      const capacitySettingCard = this.homey.flow.getConditionCard('capacity_setting_is');
      capacitySettingCard.registerRunListener(async (args) => {
        this.debugLog('Capacity setting condition triggered', { args });
        const currentValue = this.getCapabilityValue('adlar_enum_capacity_set');
        return currentValue === args.capacity;
      });

      // Heating curve condition
      const heatingCurveCard = this.homey.flow.getConditionCard('heating_curve_is');
      heatingCurveCard.registerRunListener(async (args) => {
        this.debugLog('Heating curve condition triggered', { args });
        const currentValue = this.getCapabilityValue('adlar_enum_countdown_set');
        return currentValue === args.curve;
      });

      // Volume setting condition
      const volumeSettingCard = this.homey.flow.getConditionCard('volume_setting_is');
      volumeSettingCard.registerRunListener(async (args) => {
        this.debugLog('Volume setting condition triggered', { args });
        const currentValue = this.getCapabilityValue('adlar_enum_volume_set') || 0;
        const targetValue = args.level || 0;

        switch (args.comparison) {
          case 'equal':
            return currentValue === targetValue;
          case 'greater':
            return currentValue > targetValue;
          case 'less':
            return currentValue < targetValue;
          default:
            return false;
        }
      });

      this.log('Action-based condition cards registered');
    } catch (error) {
      this.error('Error registering action-based condition cards:', error);
    }
  }

  /**
   * Unregister all flow card listeners
   */
  private unregisterAllFlowCards(): void {
    this.flowCardListeners.forEach((listener, cardId) => {
      try {
        if (listener && typeof (listener as { unregister?: () => void }).unregister === 'function') {
          (listener as { unregister: () => void }).unregister();
        }
        this.log(`Unregistered flow card: ${cardId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.log(`Flow card ${cardId} was not registered or already unregistered:`, errorMessage);
      }
    });
    this.flowCardListeners.clear();
    this.log('All flow card listeners unregistered');
  }

  /**
   * Helper method to trigger flow cards safely
   */
  private async triggerFlowCard(cardId: string, tokens: Record<string, unknown>) {
    try {
      // Check if the flow card is registered and should be triggered
      const flowCard = this.flowCardListeners.get(cardId);
      if (!flowCard) {
        this.debugLog(`Flow card ${cardId} not registered, skipping trigger`);
        return;
      }

      // Check if trigger method exists on the flow card
      if (flowCard && typeof (flowCard as { trigger?: (device: unknown, tokens: unknown, state?: unknown) => Promise<void> }).trigger === 'function') {
        await (flowCard as { trigger: (device: unknown, tokens: unknown, state?: unknown) => Promise<void> }).trigger(this, tokens, { device: this });
        this.debugLog(`Triggered flow card: ${cardId}`, tokens);
      } else {
        // Fallback to app-level trigger for compatibility
        const app = this.homey.app as unknown as { [key: string]: { trigger?: (device: unknown, tokens: unknown) => Promise<void> } };
        const triggerName = `${cardId.replace(/_/g, '')}Trigger`;

        if (app[triggerName]?.trigger) {
          await app[triggerName].trigger(this, tokens);
          this.debugLog(`Triggered flow card via app: ${cardId}`, tokens);
        } else {
          this.debugLog(`Flow card trigger method not found: ${cardId}`);
        }
      }
    } catch (error) {
      this.error(`Failed to trigger flow card ${cardId}:`, error);
    }
  }

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    await this.setUnavailable(); // Set the device as unavailable initially

    const { manifest } = Homey;
    const myDriver = manifest.drivers[0];
    // this.log('MyDevice overview:', myDriver);

    const capList = myDriver.capabilities;
    this.debugLog('Capabilities list:', capList);

    const builtinCapOptList = myDriver.capabilitiesOptions || {};
    this.debugLog('Capabilities options list:', builtinCapOptList);

    // Extract keys where `setable` exists and is `true`
    const setableBuiltInCapsKeys = Object.keys(builtinCapOptList).filter(
      (key) => builtinCapOptList[key].setable === true,
    );
    this.debugLog('Setable built-in capabilities from driver manifest:', setableBuiltInCapsKeys);

    // Verify heating curve capability (single capability for both display and control)
    const heatingCurveCapability = 'adlar_enum_countdown_set';
    this.debugLog(`Checking heating curve capability: ${heatingCurveCapability}`);
    this.debugLog('Capability exists in manifest:', capList.includes(heatingCurveCapability));
    this.debugLog('Capability available on device:', this.hasCapability(heatingCurveCapability));

    const setableCustomCapsKeys = Object.keys(manifest.capabilities).filter(
      (key) => manifest.capabilities[key].setable === true,
    );
    this.debugLog('Setable custom capabilities from app manifest:', setableCustomCapsKeys);

    // Default setable built-in capabilities (per Homey SDK standards)
    const defaultSetableBuiltInCaps = [
      'target_temperature',
      'onoff',
    ];

    // Filter only capabilities that are actually present in the device
    const availableDefaultSetableCaps = defaultSetableBuiltInCaps.filter((cap) => capList.includes(cap));
    this.debugLog('Available default setable built-in capabilities:', availableDefaultSetableCaps);

    // Combine and deduplicate setable capabilities
    this.settableCapabilities = [
      ...new Set([
        ...setableBuiltInCapsKeys,
        ...setableCustomCapsKeys,
        ...availableDefaultSetableCaps,
      ]),
    ];
    this.debugLog('Setable capabilities:', this.settableCapabilities); // Output: []

    // Register enhanced capability listeners with validation and error handling
    this.settableCapabilities.forEach((capability: string) => {
      this.debugLog(`Registering capability listener for ${capability}`);
      this.registerCapabilityListener(capability, async (value, _opts) => {
        this.log(`${capability} set to`, value);

        try {
          // Map capability to Tuya DP (data point)
          const dpArray = this.allCapabilities[capability];
          const dp = Array.isArray(dpArray) ? dpArray[0] : undefined;

          if (dp === undefined) {
            const errorMsg = `No Tuya DP mapping found for capability: ${capability}`;
            this.error(errorMsg);
            throw new Error(errorMsg);
          }

          // Validate value based on capability type
          const validatedValue = this.validateCapabilityValue(capability, value);

          // Ensure Tuya connection
          await this.connectTuya();

          if (!this.tuya) {
            throw new Error('Tuya device is not initialized');
          }

          // Send command to device
          await this.tuya.set({ dps: dp, set: validatedValue as string | number | boolean });
          this.log(`Successfully sent to Tuya: dp ${dp} = ${validatedValue}`);

          // Update Homey capability value to confirm change
          if (this.hasCapability(capability)) {
            await this.setCapabilityValue(capability, validatedValue).catch((err) => {
              this.error(`Failed to update Homey capability ${capability}:`, err);
            });
          } else {
            this.error(`Cannot update capability ${capability} - capability not available on device`);
          }

          // Note: Using single capability for heating curve - both display and control

        } catch (error) {
          const categorizedError = this.handleTuyaError(error as Error, `Capability update: ${capability}`);

          // Use categorized error message for better user experience
          const { userMessage } = categorizedError;

          throw new Error(userMessage);
        }
      });
    });

    // Register flow card action listeners
    await this.registerFlowCardActionListeners();

    // Handle optional capabilities based on settings
    await this.handleOptionalCapabilities();

    // Get Tuya device settings from Homey
    const id = (this.getStoreValue('device_id') || '').toString().trim();
    const key = (this.getStoreValue('local_key') || '').toString().trim();
    const ip = (this.getStoreValue('ip_address') || '').toString().trim();
    const version = '3.3';

    if (!id || !key) {
      this.error('Tuya credentials missing: device_id or local_key not set.');
      await this.setUnavailable('Missing Tuya credentials');
      return;
    }

    // Initialize TuyaDevice
    this.tuya = new TuyaDevice({
      id,
      key,
      ip,
      version,
    });

    // Attempt initial connection (non-blocking to allow device initialization)
    try {
      await this.connectTuya();
      this.log('Initial Tuya connection established during startup');
    } catch (error) {
      this.error('Initial Tuya connection failed during startup, will retry via reconnection interval:', error);
      // Don't throw - allow device initialization to continue
      // The reconnection interval will handle establishing connection
    }

    // Start reconnection interval
    this.startReconnectInterval();

    // Initialize flow cards based on current settings
    await this.initializeFlowCards();

    // Start periodic health checks for dynamic flow card management
    this.startHealthCheckInterval();

    // Initialize COP calculation system
    await this.initializeCOP();

    // Initialize rolling COP calculator
    await this.initializeRollingCOP();

    // Force refresh trend capability to ensure proper translation
    await this.forceRefreshTrendCapability();

    // Set up Tuya device event handlers
    this.setupTuyaEventHandlers();

    // Set device as available after successful initialization
    await this.setAvailable();
    this.log('✅ Device initialization completed - device is now available in Homey');

  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('MyDevice has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    this.log('MyDevice settings changed:', changedKeys);

    // Handle device credential changes (for repair scenarios)
    const credentialKeysChanged = changedKeys.filter(
      (key) => ['device_id', 'local_key', 'ip_address'].includes(key),
    );

    if (credentialKeysChanged.length > 0) {
      this.log('🔧 Device credentials changed:', credentialKeysChanged);

      // Update store values to match settings
      for (const key of credentialKeysChanged) {
        const newValue = newSettings[key];
        if (newValue && typeof newValue === 'string') {
          await this.setStoreValue(key, newValue);
          this.log(`Updated store value: ${key} = ${newValue}`);
        }
      }

      this.log('Device credentials updated, connection will be re-established automatically');
      return `Device credentials updated successfully. New ${credentialKeysChanged.join(', ')} will be used on next connection attempt.`;
    }

    // Check if any flow card settings were changed
    const flowSettingsChanged = changedKeys.some((key) => key.startsWith('flow_'));

    if (flowSettingsChanged) {
      this.log('Flow card settings changed, updating flow card availability');

      // Log the changes for debugging
      changedKeys.forEach((key) => {
        if (key.startsWith('flow_')) {
          this.log(`${key}: ${oldSettings[key]} → ${newSettings[key]}`);
        }
      });

      return 'Flow card settings updated. Changes will take effect immediately.';
    }

    // Handle capability diagnostics request
    if (changedKeys.includes('capability_diagnostics') && newSettings.capability_diagnostics === true) {
      const healthStatuses = this.getAllCapabilityHealthStatuses();
      const diagnosticReport = this.generateCapabilityDiagnosticReport(healthStatuses);

      this.log('Capability diagnostic report generated:', diagnosticReport);

      // Reset the trigger setting after onSettings completes to avoid race condition
      this.homey.setTimeout(async () => {
        try {
          await this.setSettings({ capability_diagnostics: false });
        } catch (error) {
          this.error('Failed to reset diagnostics checkbox:', error);
        }
      }, DeviceConstants.SETTINGS_DEFER_DELAY_MS);

      return `Capability Diagnostics Report:\n\n${diagnosticReport}`;
    }

    // Handle flow trigger test
    if (changedKeys.includes('flow_trigger_test') && newSettings.flow_trigger_test === true) {
      this.log('🧪 Flow trigger test requested via settings');

      // Execute test asynchronously
      this.testExternalDataFlowTriggers()
        .then(() => {
          this.log('✅ Flow trigger test completed - check logs for detailed results');
        })
        .catch((error) => {
          this.error('❌ Flow trigger test failed:', error);
        });

      // Reset the checkbox after a short delay
      this.homey.setTimeout(async () => {
        try {
          await this.setSettings({ flow_trigger_test: false });
        } catch (error) {
          this.error('Failed to reset flow trigger test checkbox:', error);
        }
      }, DeviceConstants.SETTINGS_DEFER_DELAY_MS);

      return 'Flow trigger test started - check device logs for detailed results';
    }

    // Handle power measurement settings
    if (changedKeys.includes('enable_power_measurements')) {
      const enablePower = newSettings.enable_power_measurements;

      // Auto-manage all power-related flow alert settings
      const powerFlowSettings = ['flow_power_alerts', 'flow_voltage_alerts', 'flow_current_alerts'];
      const settingsToUpdate: Record<string, string> = {};

      if (!enablePower) {
        // Disable all power-related flow alerts when power measurements are disabled
        for (const setting of powerFlowSettings) {
          if (oldSettings[setting] !== 'disabled') {
            settingsToUpdate[setting] = 'disabled';
          }
        }
      } else if (enablePower && oldSettings.enable_power_measurements === false) {
        // Reset all to auto when power measurements are re-enabled
        for (const setting of powerFlowSettings) {
          settingsToUpdate[setting] = 'auto';
        }
      }

      // Only call setSettings once if there are settings to update
      if (Object.keys(settingsToUpdate).length > 0) {
        // Use setTimeout to avoid race condition with onSettings still being pending
        this.homey.setTimeout(async () => {
          try {
            await this.setSettings(settingsToUpdate);
            this.log('Auto-updated power-related flow alerts:', Object.keys(settingsToUpdate));
            // Trigger flow cards update after settings are applied
            await this.updateFlowCards();
          } catch (error) {
            this.error('Failed to update power-related flow alert settings:', error);
          }
        }, DeviceConstants.SETTINGS_DEFER_DELAY_MS);
      }

      await this.handleOptionalCapabilities();
      this.log('Power measurement settings updated');
      return 'Power measurement settings updated. Capabilities and flow cards will be updated shortly.';
    }

    // Handle slider controls settings
    if (changedKeys.includes('enable_slider_controls')) {
      // For now, no related flow settings to auto-manage for sliders
      // But we use the same pattern for consistency and future extensibility
      const settingsToUpdate: Record<string, string> = {};

      // No additional settings to auto-manage currently, but pattern preserved
      // for future enhancements (e.g., slider-related flow cards)

      // Only call setSettings if there are settings to update
      if (Object.keys(settingsToUpdate).length > 0) {
        // Use setTimeout to avoid race condition with onSettings still being pending
        this.homey.setTimeout(async () => {
          try {
            await this.setSettings(settingsToUpdate);
            this.log('Auto-updated slider-related settings:', Object.keys(settingsToUpdate));
          } catch (error) {
            this.error('Failed to update slider-related settings:', error);
          }
        }, DeviceConstants.SETTINGS_DEFER_DELAY_MS);
      }

      await this.handleOptionalCapabilities();
      this.log('Slider control settings updated');
      return 'Slider control settings updated. Capabilities will be updated shortly.';
    }

    // Handle COP settings changes
    const copSettingsChanged = changedKeys.some((key) => key.startsWith('cop_') || key.startsWith('enable_cop') || key.startsWith('external_'));

    if (copSettingsChanged) {
      this.log('COP settings changed, reloading COP configuration');

      // Reload COP settings
      await this.loadCOPSettings();

      // Restart COP calculation if enabled
      if (this.copSettings?.enableCOP && this.hasCapability('adlar_cop')) {
        this.stopCOPCalculationInterval();
        this.startCOPCalculationInterval();
        this.log('COP calculation restarted with new settings');

        // Also restart SCOP updates if available
        if (this.hasCapability('adlar_scop') && this.scopCalculator) {
          this.stopSCOPUpdateInterval();
          this.startSCOPUpdateInterval();
          this.log('SCOP updates restarted with COP settings');
        }
      } else {
        this.stopCOPCalculationInterval();
        this.stopSCOPUpdateInterval();
        this.log('COP calculation and SCOP updates stopped');
      }

      return 'COP and SCOP settings updated and calculation systems restarted.';
    }

    return undefined;
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} _name The new name
   */
  async onRenamed(_name: string) {
    this.log('MyDevice was renamed');
  }

  /**
   * Handle optional capabilities based on settings
   */
  private async handleOptionalCapabilities(): Promise<void> {
    const enablePowerMeasurements = this.getSetting('enable_power_measurements') ?? true;
    const enableSliderControls = this.getSetting('enable_slider_controls') ?? true;
    const enableCOPCalculation = this.getSetting('cop_calculation_enabled') !== false; // default true

    const powerCapabilities = [
      'measure_power',
      'meter_power.power_consumption',
      'meter_power.electric_total',
      'measure_current.cur_current',
      'measure_current.b_cur',
      'measure_current.c_cur',
      'measure_voltage.voltage_current',
      'measure_voltage.bv',
      'measure_voltage.cv',
    ];

    const sliderCapabilities = [
      'adlar_enum_volume_set',
      'adlar_enum_water_mode',
      'adlar_hotwater',
    ];

    const copCapabilities = [
      'adlar_cop',
      'adlar_cop_method',
      'adlar_external_power',
      'adlar_external_flow',
      'adlar_external_ambient',
      'adlar_scop',
      'adlar_scop_quality',
      'adlar_cop_daily',
      'adlar_cop_weekly',
      'adlar_cop_trend',
    ];

    // Process power capabilities
    await this.processCapabilityGroup(powerCapabilities, enablePowerMeasurements, 'power measurement');

    // Process slider capabilities
    await this.processCapabilityGroup(sliderCapabilities, enableSliderControls, 'slider control');

    // Process COP capabilities
    await this.processCapabilityGroup(copCapabilities, enableCOPCalculation, 'COP calculation');
  }

  /**
   * Process a group of capabilities based on enable/disable setting
   */
  private async processCapabilityGroup(
    capabilities: string[],
    enableFeature: boolean,
    featureName: string,
  ): Promise<void> {
    for (const capability of capabilities) {
      try {
        if (enableFeature) {
          if (!this.hasCapability(capability)) {
            await this.addCapability(capability);
            this.log(`Added optional ${featureName} capability: ${capability}`);
          }
          // Enable insights when feature is enabled
          try {
            await this.setCapabilityOptions(capability, { insights: true });
            this.debugLog(`Enabled insights for ${featureName} capability: ${capability}`);
          } catch (error) {
            this.debugLog(`Could not enable insights for ${capability}:`, error);
          }
        } else if (this.hasCapability(capability)) {
          // Feature is disabled - remove capability if it exists
          // Disable insights before removing capability to clear historical data visibility
          try {
            await this.setCapabilityOptions(capability, { insights: false });
            this.debugLog(`Disabled insights for ${featureName} capability: ${capability}`);
          } catch (error) {
            this.debugLog(`Could not disable insights for ${capability}:`, error);
          }

          await this.removeCapability(capability);
          this.log(`Removed optional ${featureName} capability: ${capability}`);
        }
      } catch (error) {
        // Enhanced error handling with more context
        const action = enableFeature ? 'add' : 'remove';
        this.error(`Failed to ${action} ${featureName} capability ${capability}:`, error);

        // For validation errors during capability operations, log additional context
        if (error instanceof Error && error.message.includes('Invalid Capability')) {
          this.error(`Capability validation error for ${capability}. This may be due to timing during device initialization.`);
          this.log(`Settings: ${featureName} = ${enableFeature}, capability exists = ${this.hasCapability(capability)}`);
        }
      }
    }
  }

  /**
   * Validate capability values based on capability type
   * @param capability - The capability name to validate
   * @param value - The value to validate
   * @returns The validated and possibly converted value
   * @throws Error if value is invalid for the capability
   */
  private validateCapabilityValue(capability: string, value: unknown): unknown {
    // Check for null/undefined values first
    if (value === null || value === undefined) {
      throw new Error(`Value for capability ${capability} cannot be null or undefined`);
    }
    switch (capability) {
      case 'target_temperature': {
        const temp = Number(value);
        if (Number.isNaN(temp) || temp < DeviceConstants.MIN_TARGET_TEMPERATURE || temp > DeviceConstants.MAX_TARGET_TEMPERATURE) {
          throw new Error(`Temperature ${temp}°C is outside valid range (${DeviceConstants.MIN_TARGET_TEMPERATURE}-${DeviceConstants.MAX_TARGET_TEMPERATURE}°C)`);
        }
        return temp;
      }

      case 'onoff':
        return Boolean(value);

      case 'adlar_enum_mode':
      case 'adlar_enum_countdown_set':
      case 'adlar_enum_work_mode':
        if (typeof value !== 'string') {
          throw new Error(`Invalid enum value for ${capability}: ${value}`);
        }
        return value;

      case 'adlar_hotwater': {
        const hotWaterTemp = Number(value);
        if (Number.isNaN(hotWaterTemp) || hotWaterTemp < DeviceConstants.MIN_HOTWATER_TEMPERATURE || hotWaterTemp > DeviceConstants.MAX_HOTWATER_TEMPERATURE) {
          throw new Error(`Hot water temperature ${hotWaterTemp}°C is outside valid range (${DeviceConstants.MIN_HOTWATER_TEMPERATURE}-${DeviceConstants.MAX_HOTWATER_TEMPERATURE}°C)`);
        }
        return hotWaterTemp;
      }

      default:
        return value;
    }
  }

  /**
   * Register flow card action listeners
   * Note: Most ACTION cards are now handled by the app-level pattern-based system in app.ts/flow-helpers.ts
   * Only custom/complex ACTION cards should be registered here
   */
  private async registerFlowCardActionListeners(): Promise<void> {
    this.debugLog('Registering device-level flow card action listeners');

    try {
      // All simple ACTION cards (set_target_temperature, set_device_onoff, set_heating_mode,
      // set_heating_curve, set_work_mode) are now handled by the app-level pattern-based system
      this.debugLog('Simple ACTION cards are managed by app-level pattern-based system');

      // Reserve this method for custom/complex ACTION cards that need device-specific logic

      // Register external power data action card
      const receiveExternalPowerAction = this.homey.flow.getActionCard('receive_external_power_data');
      // eslint-disable-next-line camelcase
      receiveExternalPowerAction.registerRunListener(async (args: { device: MyDevice; power_value: number }) => {
        this.debugLog(`📊 Received external power data: ${args.power_value}W`);

        // Store the external power value in the capability
        if (this.hasCapability('adlar_external_power')) {
          await this.setCapabilityValue('adlar_external_power', args.power_value);
        }

        this.log(`✅ External power data updated: ${args.power_value}W`);
      });

      // Register external flow data action card
      const receiveExternalFlowAction = this.homey.flow.getActionCard('receive_external_flow_data');
      // eslint-disable-next-line camelcase
      receiveExternalFlowAction.registerRunListener(async (args: { device: MyDevice; flow_value: number }) => {
        this.debugLog(`🌊 Received external flow data: ${args.flow_value}L/min`);

        // Store the external flow value in the capability
        if (this.hasCapability('adlar_external_flow')) {
          await this.setCapabilityValue('adlar_external_flow', args.flow_value);
        }

        this.log(`✅ External flow data updated: ${args.flow_value}L/min`);
      });

      // Register external ambient temperature data action card
      const receiveExternalAmbientAction = this.homey.flow.getActionCard('receive_external_ambient_data');
      // eslint-disable-next-line camelcase
      receiveExternalAmbientAction.registerRunListener(async (args: { device: MyDevice; temperature_value: number }) => {
        this.debugLog(`🌡️ Received external ambient data: ${args.temperature_value}°C`);

        // Store the external ambient temperature value in the capability
        if (this.hasCapability('adlar_external_ambient')) {
          await this.setCapabilityValue('adlar_external_ambient', args.temperature_value);
        }

        this.log(`✅ External ambient data updated: ${args.temperature_value}°C`);
      });

      // Currently no custom ACTION cards require device-level registration
    } catch (error) {
      this.error('Error registering flow card action listeners:', error);
    }
  }

  /**
   * Diagnostic method to test external device direct access system
   * This method can be called to manually test if direct device access is working
   */
  async testExternalDataFlowTriggers(): Promise<void> {
    this.log('🧪 Starting external device direct access diagnostic test...');

    try {
      // Test direct device access
      this.log('📡 Testing direct device access...');
      const externalData = await this.getExternalDeviceData();

      this.log('📊 External device access test results:', JSON.stringify({
        hasPowerData: externalData.electricalPower !== null,
        hasFlowData: externalData.waterFlowRate !== null,
        hasAmbientData: externalData.ambientTemperature !== null,
        powerValue: externalData.electricalPower,
        flowValue: externalData.waterFlowRate,
        ambientValue: externalData.ambientTemperature,
      }));

      // Test individual device configurations
      const powerDeviceId = this.getSetting('external_power_device_id');
      const flowDeviceId = this.getSetting('external_flow_device_id');
      const ambientDeviceId = this.getSetting('external_ambient_device_id');

      this.log('🔍 Device configuration:', JSON.stringify({
        powerDeviceConfigured: !!(powerDeviceId && powerDeviceId.trim()),
        flowDeviceConfigured: !!(flowDeviceId && flowDeviceId.trim()),
        ambientDeviceConfigured: !!(ambientDeviceId && ambientDeviceId.trim()),
        powerDeviceId: powerDeviceId || 'not configured',
        flowDeviceId: flowDeviceId || 'not configured',
        ambientDeviceId: ambientDeviceId || 'not configured',
      }));

      if (externalData.electricalPower === null && externalData.waterFlowRate === null && externalData.ambientTemperature === null) {
        this.log('ℹ️ No external devices configured - this is normal if you want to use internal sensors only');
      } else {
        this.log('✅ External device access test completed successfully');
      }

    } catch (error) {
      this.error('❌ Error during external device diagnostic test:', error);
    }

    this.log('🧪 External device direct access diagnostic test completed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('MyDevice has been deleted');

    // Stop reconnection interval
    this.stopReconnectInterval();

    // Stop health check interval
    this.stopHealthCheckInterval();

    // Stop COP calculation interval
    this.stopCOPCalculationInterval();

    // Save rolling COP data before shutdown
    await this.saveRollingCOPData();

    // Stop SCOP update interval
    this.stopSCOPUpdateInterval();

    if (this.tuya) {
      try {
        // Remove all event listeners to prevent memory leaks
        this.tuya.removeAllListeners();

        // Disconnect if connected
        if (this.tuyaConnected) {
          this.tuya.disconnect();
          this.log('Disconnected from Tuya device');
        }
      } catch (err) {
        this.error('Error cleaning up Tuya device:', err);
      }
    }

    // Clean up flow card listeners
    this.unregisterAllFlowCards();

    // Reset connection state
    this.tuyaConnected = false;
    this.tuya = undefined;
  }
}

module.exports = MyDevice;
