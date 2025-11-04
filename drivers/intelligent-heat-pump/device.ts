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
import { ServiceCoordinator } from '../../lib/services/service-coordinator';

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

/* eslint-disable camelcase, @typescript-eslint/no-unused-vars */
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
/* eslint-enable camelcase, @typescript-eslint/no-unused-vars */

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

/**
 * Fault code mapping for DPS 15 (adlar_fault)
 * Maps numeric fault codes to human-readable descriptions
 * Note: These codes are specific to Adlar heat pump systems
 */
const FAULT_CODE_DESCRIPTIONS: Record<number, { en: string; nl: string }> = {
  0: {
    en: 'No fault',
    nl: 'Geen storing',
  },
  1: {
    en: 'High pressure protection',
    nl: 'Hogedrukbeveiliging',
  },
  2: {
    en: 'Low pressure protection',
    nl: 'Lagedrukbeveiliging',
  },
  3: {
    en: 'Compressor overheating',
    nl: 'Compressor oververhitting',
  },
  4: {
    en: 'Discharge temperature too high',
    nl: 'Uitlaattemperatuur te hoog',
  },
  5: {
    en: 'Water flow sensor fault',
    nl: 'Waterdoorstroomsensor storing',
  },
  6: {
    en: 'Inlet temperature sensor fault',
    nl: 'Inlaattemperatuursensor storing',
  },
  7: {
    en: 'Outlet temperature sensor fault',
    nl: 'Uitlaattemperatuursensor storing',
  },
  8: {
    en: 'Ambient temperature sensor fault',
    nl: 'Omgevingstemperatuursensor storing',
  },
  9: {
    en: 'Coil temperature sensor fault',
    nl: 'Spoeltemperatuursensor storing',
  },
  10: {
    en: 'Low water flow protection',
    nl: 'Lage waterdoorstroom beveiliging',
  },
  11: {
    en: 'Antifreeze protection active',
    nl: 'Vorstbeveiliging actief',
  },
  12: {
    en: 'Phase loss or reverse phase',
    nl: 'Faseuitval of omkeerde fase',
  },
  13: {
    en: 'Communication error',
    nl: 'Communicatiefout',
  },
  14: {
    en: 'EEV valve fault',
    nl: 'EEV-klep storing',
  },
  15: {
    en: 'System pressure abnormal',
    nl: 'Systeemdruk abnormaal',
  },
};

/**
 * Get fault description in user's language
 * @param faultCode - Numeric fault code from DPS 15
 * @param language - Language code ('en' or 'nl')
 * @returns Human-readable fault description
 */
function getFaultDescription(faultCode: number, language: 'en' | 'nl' = 'en'): string {
  const description = FAULT_CODE_DESCRIPTIONS[faultCode];
  if (description) {
    return description[language];
  }
  // Fallback for unknown fault codes
  return language === 'nl'
    ? `Onbekende storing (code: ${faultCode})`
    : `Unknown fault (code: ${faultCode})`;
}

class MyDevice extends Homey.Device {
  tuya: TuyaDevice | undefined;
  allCapabilities: Record<string, number[]> = allCapabilities;
  allArraysSwapped: Record<number, string> = allArraysSwapped;
  settableCapabilities: string[] = [];
  reconnectInterval: NodeJS.Timeout | undefined;
  consecutiveFailures: number = 0;
  lastNotificationTime: number = 0;
  lastNotificationKey: string = '';

  // Enhanced error recovery state
  private backoffMultiplier: number = 1;
  private maxBackoffSeconds: number = 300; // 5 minutes max
  private circuitBreakerOpen: boolean = false;
  private circuitBreakerOpenTime: number = 0;
  private circuitBreakerResetTime: number = 60000; // 1 minute before attempting reset

  // Note: Flow card management now handled by FlowCardManagerService via ServiceCoordinator
  private isFlowCardsInitialized: boolean = false;

  // Note: Capability health monitoring now handled by CapabilityHealthService via ServiceCoordinator

  // Note: Energy tracking interval now managed by EnergyTrackingService via ServiceCoordinator

  // COP (Coefficient of Performance) calculation
  private copCalculationInterval: NodeJS.Timeout | null = null;
  private copSettings: COPSettings | null = null;

  // SCOP (Seasonal Coefficient of Performance) calculation
  private scopCalculator: SCOPCalculator | null = null;
  private scopUpdateInterval: NodeJS.Timeout | null = null;

  // Rolling COP calculation
  private rollingCOPCalculator: RollingCOPCalculator | null = null;
  private lastRollingCOPUpdate: number = 0;
  // Idle period monitoring
  private idleCheckInterval: NodeJS.Timeout | null = null;
  private lastCOPDataPointTime: number = 0;
  private compressorStateHistory: Array<{timestamp: number, running: boolean}> = [];

  // State tracking for flow card triggers (v1.0.8)
  private lastCOPOutlierStatus = false;  // For cop_outlier_detected trigger
  private lastCOPValue = 0;              // For cop_efficiency_changed trigger
  private lastInletTemp: number | null = null;   // For inlet_temperature_changed
  private lastOutletTemp: number | null = null;  // For outlet_temperature_changed
  private lastAmbientTemp: number | null = null; // For ambient_temperature_changed

  // External power energy tracking
  private lastExternalPowerTimestamp: number | null = null;

  // Debounce map for temperature critical alerts (per capability)
  private lastTempAlertAt: Map<string, number> = new Map();

  // Fault detection state tracking (v1.0.7 - fault_detected trigger)
  private lastFaultCode: number = 0;

  // Service Coordinator - manages all device services
  private serviceCoordinator: ServiceCoordinator | null = null;

  // Debug-conditional logging method
  private debugLog(...args: unknown[]) {
    if (process.env.DEBUG === '1') {
      this.log(...args);
    }
  }

  /**
   * Initialize direct Tuya device for fallback purposes
   */
  private async initializeFallbackTuyaDevice(): Promise<void> {
    if (this.tuya) return; // Already initialized

    const id = (this.getStoreValue('device_id') || '').toString().trim();
    const key = (this.getStoreValue('local_key') || '').toString().trim();
    const ip = (this.getStoreValue('ip_address') || '').toString().trim();
    const version = (this.getStoreValue('protocol_version') || '3.3').toString().trim();

    if (!id || !key) {
      throw new Error('Tuya credentials missing for fallback initialization');
    }

    this.tuya = new TuyaDevice({
      id,
      key,
      ip,
      version,
    });

    this.debugLog(`Initialized fallback TuyaDevice for direct communication (Protocol: ${version})`);
  }

  /**
   * Send a command to Tuya device via ServiceCoordinator or direct fallback
   * @param dp - Tuya data point number
   * @param value - Value to send
   * @returns Promise that resolves when command is sent
   */
  private async sendTuyaCommand(dp: number, value: string | number | boolean): Promise<void> {
    // Try to send via ServiceCoordinator's TuyaConnectionService
    if (this.serviceCoordinator) {
      try {
        const tuyaService = this.serviceCoordinator.getTuyaConnection();
        // Send value with correct type (string/number/boolean) - DO NOT convert to string!
        await tuyaService.sendCommand({ [dp]: value });
        this.log(`Successfully sent to Tuya via ServiceCoordinator: dp ${dp} = ${value} (${typeof value})`);
        return;
      } catch (err) {
        this.error('ServiceCoordinator Tuya command failed, falling back to direct method:', err);
        // Fall through to direct method
      }
    }

    // Fallback to direct Tuya command
    await this.initializeFallbackTuyaDevice();
    await this.connectTuya();

    if (!this.tuya) {
      throw new Error('Tuya device is not initialized for fallback');
    }

    // TuyAPI syntax: set({ multiple: true, data: { [dp]: value } })
    await this.tuya.set({ multiple: true, data: { [dp]: value } });
    this.log(`Successfully sent to Tuya (direct fallback): dp ${dp} = ${value} (${typeof value})`);
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
   * Check if device is currently connected to Tuya
   * Delegates to ServiceCoordinator for authoritative connection state
   * @returns true if device is connected, false otherwise
   */
  private isDeviceConnected(): boolean {
    // Primary path: ServiceCoordinator's TuyaConnectionService (v0.99.23+)
    if (this.serviceCoordinator) {
      return this.serviceCoordinator.getTuyaConnection()?.isDeviceConnected() ?? false;
    }

    // Fallback path: Legacy tuya instance (should be rare/never used)
    // Only reached if ServiceCoordinator initialization failed
    return this.tuya?.isConnected() ?? false;
  }

  /**
   * Connect to the Tuya device with proper error handling
   * @returns Promise that resolves when connection is established
   * @throws Error if connection fails or device is not initialized
   */
  async connectTuya(): Promise<void> {
    // Delegate to ServiceCoordinator's TuyaConnectionService if available
    if (this.serviceCoordinator) {
      try {
        const tuyaService = this.serviceCoordinator.getTuyaConnection();
        await tuyaService.connectTuya();
        // No need to sync state - isDeviceConnected() will query service directly
        this.debugLog('Connected to Tuya device via ServiceCoordinator');
        return;
      } catch (err) {
        this.error('ServiceCoordinator Tuya connection failed, falling back to direct method:', err);
        // Fall through to original implementation
      }
    }

    // Fallback to original direct connection method
    if (!this.isDeviceConnected()) {
      try {
        // Initialize fallback Tuya device if not already done
        await this.initializeFallbackTuyaDevice();

        // Discover the device on the network first
        if (this.tuya) {
          await this.tuya.find();
          // Then connect to the device
          await this.tuya.connect();
          // No need to sync state - isDeviceConnected() will check tuya.isConnected()
          this.debugLog('Connected to Tuya device (direct fallback)');
        } else {
          throw new Error('Tuya device fallback initialization failed');
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
    // If ServiceCoordinator is available, it handles reconnection internally
    if (this.serviceCoordinator) {
      this.debugLog('Reconnection managed by ServiceCoordinator TuyaConnectionService');
      return;
    }

    // Fallback to direct reconnection management
    this.debugLog('Using direct reconnection fallback');
    // Clear any existing interval
    this.stopReconnectInterval();

    // Start enhanced reconnection with adaptive interval
    this.scheduleNextReconnectionAttempt();
  }

  /**
   * Enhanced reconnection logic with exponential backoff and circuit breaker
   */
  private scheduleNextReconnectionAttempt() {
    // Check circuit breaker state
    if (this.circuitBreakerOpen) {
      const timeSinceOpen = Date.now() - this.circuitBreakerOpenTime;
      if (timeSinceOpen < this.circuitBreakerResetTime) {
        // Still in cooldown period
        this.debugLog(`Circuit breaker open, cooling down for ${Math.round((this.circuitBreakerResetTime - timeSinceOpen) / 1000)}s more`);
        this.reconnectInterval = this.homey.setTimeout(() => {
          try {
            this.scheduleNextReconnectionAttempt();
          } catch (error) {
            this.error('MyDevice: Error during circuit breaker cooldown check:', error);
          }
        }, 10000); // Check every 10 seconds during cooldown
        return;
      }
      // Try to reset circuit breaker
      this.debugLog('Attempting to reset circuit breaker...');
      this.circuitBreakerOpen = false;
      this.backoffMultiplier = 1; // Reset backoff

    }

    // Calculate adaptive interval with exponential backoff
    const baseInterval = DeviceConstants.RECONNECTION_INTERVAL_MS;
    const adaptiveInterval = Math.min(
      baseInterval * this.backoffMultiplier,
      this.maxBackoffSeconds * 1000,
    );

    this.debugLog(`Next reconnection attempt in ${Math.round(adaptiveInterval / 1000)}s (backoff: ${this.backoffMultiplier}x)`);

    this.reconnectInterval = this.homey.setTimeout(() => {
      this.attemptReconnectionWithRecovery().catch((error) => {
        // Prevent unhandled rejection crash
        this.error('MyDevice: Critical error in scheduled reconnection:', error);

        // Apply aggressive backoff and schedule retry
        this.backoffMultiplier = Math.min(this.backoffMultiplier * 2, 32);
        this.consecutiveFailures++;
        this.scheduleNextReconnectionAttempt();
      });
    }, adaptiveInterval);
  }

  /**
   * Attempt reconnection with enhanced error recovery
   */
  private async attemptReconnectionWithRecovery(): Promise<void> {
    if (this.isDeviceConnected()) {
      // Already connected, reset backoff and exit
      this.resetErrorRecoveryState();
      return;
    }

    this.debugLog(`Attempting to reconnect to Tuya device... (attempt ${this.consecutiveFailures + 1})`);

    try {
      await this.connectTuya();

      // Success! Reset all error recovery state
      this.resetErrorRecoveryState();
      this.debugLog('Reconnection successful, error recovery state reset');

    } catch (err) {
      const categorizedError = this.handleTuyaError(err as Error, 'Enhanced reconnection attempt');
      this.consecutiveFailures++;

      // Determine recovery strategy based on error type
      this.updateRecoveryStrategy(categorizedError);

      // Send notifications based on failure patterns
      await this.handleReconnectionFailureNotification(categorizedError);

      // Schedule next attempt with updated strategy
      this.scheduleNextReconnectionAttempt();
    }
  }

  /**
   * Update recovery strategy based on error patterns
   */
  private updateRecoveryStrategy(error: CategorizedError): void {
    // Exponential backoff for recoverable errors
    if (error.recoverable) {
      this.backoffMultiplier = Math.min(this.backoffMultiplier * 1.5, 16); // Cap at 16x
    } else {
      // For non-recoverable errors, use more aggressive backoff
      this.backoffMultiplier = Math.min(this.backoffMultiplier * 2, 32); // Cap at 32x
    }

    // Activate circuit breaker after severe failure patterns
    if (this.consecutiveFailures >= DeviceConstants.MAX_CONSECUTIVE_FAILURES * 2) {
      this.debugLog(`Activating circuit breaker after ${this.consecutiveFailures} consecutive failures`);
      this.circuitBreakerOpen = true;
      this.circuitBreakerOpenTime = Date.now();
    }
  }

  /**
   * Handle notifications for reconnection failures with smart throttling
   */
  private async handleReconnectionFailureNotification(error: CategorizedError): Promise<void> {
    // Immediate notification for critical infrastructure failures
    if (!error.recoverable && this.consecutiveFailures <= 3) {
      await this.sendCriticalNotification(
        'Critical Device Error',
        `Heat pump connection failed: ${error.userMessage}. Manual intervention may be required.`,
      );
      return;
    }

    // Standard notification after initial failure threshold
    if (this.consecutiveFailures === DeviceConstants.MAX_CONSECUTIVE_FAILURES) {
      await this.sendCriticalNotification(
        'Device Connection Lost',
        `Heat pump has been disconnected for over 1 minute. ${error.userMessage}`,
      );
      return;
    }

    // Extended outage notification
    if (this.consecutiveFailures === DeviceConstants.MAX_CONSECUTIVE_FAILURES * 3) {
      await this.sendCriticalNotification(
        'Extended Device Outage',
        `Heat pump has been offline for over 5 minutes. Connection issues persist: ${error.userMessage}`,
      );
    }
  }

  /**
   * Reset error recovery state after successful connection
   */
  private resetErrorRecoveryState(): void {
    this.consecutiveFailures = 0;
    this.backoffMultiplier = 1;
    this.circuitBreakerOpen = false;
    this.circuitBreakerOpenTime = 0;
  }

  private stopReconnectInterval() {
    // If ServiceCoordinator is available, it manages reconnection internally
    if (this.serviceCoordinator) {
      this.debugLog('Reconnection stop managed by ServiceCoordinator');
      return;
    }

    // Fallback to direct interval cleanup
    if (this.reconnectInterval) {
      // Enhanced interval can be either setTimeout or setInterval
      this.homey.clearTimeout(this.reconnectInterval);
      this.homey.clearInterval(this.reconnectInterval);
      this.reconnectInterval = undefined;
    }
  }

  // Note: Tuya event handlers now managed by TuyaConnectionService via ServiceCoordinator

  // Note: updateCapabilityHealth now delegated to CapabilityHealthService via ServiceCoordinator

  // Note: Capability health methods now delegated to CapabilityHealthService via ServiceCoordinator

  private getCapabilityHealth(capability: string): boolean {
    return this.serviceCoordinator?.getCapabilityHealth()?.isCapabilityHealthy(capability) ?? false;
  }

  // Note: Capability health categorization now handled by CapabilityHealthService via ServiceCoordinator

  // Note: Flow card health management now delegated to FlowCardManagerService via ServiceCoordinator

  // Note: Flow card unregistration now handled by FlowCardManagerService via ServiceCoordinator

  // Note: Flow card categories now managed by FlowCardManagerService via ServiceCoordinator

  // Note: Health check intervals now managed by CapabilityHealthService via ServiceCoordinator

  // Note: Energy tracking methods now delegated to EnergyTrackingService via ServiceCoordinator

  // Note: Capability diagnostic reporting now handled by CapabilityHealthService via ServiceCoordinator

  /**
   * Format COP method for user-friendly display with internationalization and diagnostics
   */
  private formatCOPMethodDisplay(method: string, confidence: string, diagnosticInfo?: { primaryIssue?: string }): string {
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
      methodName = `${methodName} ${localizedDiagnostic}`;
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
      const totalDataPoints = this.rollingCOPCalculator.exportData().dataPoints.length;
      this.log('📈 Rolling COP: Added data point with COP', copResult.cop, `(total points: ${totalDataPoints})`);

      // Track when we last added a COP data point for idle monitoring
      this.lastCOPDataPointTime = Date.now();

      // Update rolling COP capabilities (every 5 minutes to avoid excessive updates)
      const now = Date.now();
      if (now - this.lastRollingCOPUpdate >= 5 * 60 * 1000) { // 5 minutes
        this.log('🔄 Updating rolling COP capabilities (5 minute interval reached)');
        await this.updateRollingCOPCapabilities();
        this.lastRollingCOPUpdate = now;
      } else {
        const timeUntilUpdate = Math.round((5 * 60 * 1000 - (now - this.lastRollingCOPUpdate)) / 1000);
        this.debugLog(`⏳ Next rolling COP update in ${timeUntilUpdate} seconds`);
      }
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
          moderate_decline: this.homey.__('trend_descriptions.moderate_decline'),
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
      // Use idle-aware calculation for daily COP
      const dailyCOP = this.rollingCOPCalculator.getDailyCOPWithIdleAwareness?.()
                       || this.rollingCOPCalculator.getDailyCOP();

      // Get diagnostic info for better logging
      const diagnostics = this.rollingCOPCalculator.getDiagnosticInfo?.();

      this.log(`📅 Daily COP calculation result: ${dailyCOP ? `${dailyCOP.averageCOP} (${dailyCOP.dataPoints} points)` : 'null/undefined'}`);

      if (diagnostics) {
        this.log(`📊 COP Diagnostics: ${diagnostics.dataPointsInWindow} points in window, ${(diagnostics.idleRatio * 100).toFixed(1)}% idle, data age: ${diagnostics.dataFreshness}h`);
      }

      if (dailyCOP && this.hasCapability('adlar_cop_daily')) {
        await this.setCapabilityValue('adlar_cop_daily', dailyCOP.averageCOP);
        this.log('📅 Daily COP updated:', dailyCOP.averageCOP, `(${dailyCOP.dataPoints} points, ${dailyCOP.confidenceLevel} confidence)`);

        // Trigger daily COP efficiency flow cards
        await this.triggerDailyCOPFlowCards(dailyCOP);
      } else if (!dailyCOP) {
        // Explicitly set to null when no meaningful data (mostly idle or stale)
        if (this.hasCapability('adlar_cop_daily')) {
          await this.setCapabilityValue('adlar_cop_daily', null);
        }

        const reason = diagnostics
          ? `idle ratio: ${(diagnostics.idleRatio * 100).toFixed(1)}%, data age: ${diagnostics.dataFreshness.toFixed(1)}h`
          : 'no data points in rolling window';
        this.log(`⚠️ Daily COP set to null - ${reason}`);
      } else if (!this.hasCapability('adlar_cop_daily')) {
        this.log('⚠️ Daily COP capability not available');
      }

      // Calculate weekly COP
      const weeklyCOP = this.rollingCOPCalculator.getWeeklyCOP();
      if (weeklyCOP && this.hasCapability('adlar_cop_weekly')) {
        await this.setCapabilityValue('adlar_cop_weekly', weeklyCOP.averageCOP);
        this.debugLog('📊 Weekly COP updated:', weeklyCOP.averageCOP, `(${weeklyCOP.dataPoints} points, ${weeklyCOP.confidenceLevel} confidence)`);
      }

      // Calculate monthly COP
      const monthlyCOP = this.rollingCOPCalculator.getMonthlyCOP();
      if (monthlyCOP && this.hasCapability('adlar_cop_monthly')) {
        await this.setCapabilityValue('adlar_cop_monthly', monthlyCOP.averageCOP);
        this.debugLog('📅 Monthly COP updated:', monthlyCOP.averageCOP, `(${monthlyCOP.dataPoints} points, ${monthlyCOP.confidenceLevel} confidence)`);
      }

      // Check and trigger daily/monthly COP change flow cards (v1.0.8)
      const dailyValue = dailyCOP?.averageCOP || 0;
      const monthlyValue = monthlyCOP?.averageCOP || 0;
      if (dailyValue > 0 && monthlyValue > 0) {
        // Call through the service method (non-blocking)
        // Note: This is a workaround since rollingCOPCalculator already has device reference
        // In v1.0.9+, consider refactoring to use event emitter pattern
        if (this.rollingCOPCalculator) {
          (this.rollingCOPCalculator as unknown as {
            checkAndTriggerCOPChanges?: (daily: number, monthly: number) => Promise<void>;
          }).checkAndTriggerCOPChanges?.(dailyValue, monthlyValue)?.catch((err) => {
            this.error('Failed to trigger COP change checks:', err);
          });
        }
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
   * Get current compressor runtime with enhanced tracking
   */
  private getCompressorRuntime(): number {
    const currentState = this.getCapabilityValue('adlar_state_compressor_state');
    const now = Date.now();

    // Track state changes for better runtime calculation
    if (this.compressorStateHistory.length === 0
        || this.compressorStateHistory[this.compressorStateHistory.length - 1].running !== currentState) {
      this.compressorStateHistory.push({ timestamp: now, running: currentState });

      // Keep only last 48 hours of state history
      const cutoff = now - (48 * 60 * 60 * 1000);
      this.compressorStateHistory = this.compressorStateHistory.filter((entry) => entry.timestamp >= cutoff);
    }

    // Calculate actual runtime in the last period (30 minutes for COP calculation)
    const periodStart = now - (30 * 60 * 1000); // 30 minutes ago
    let runtimeMinutes = 0;

    for (let i = this.compressorStateHistory.length - 1; i >= 0; i--) {
      const entry = this.compressorStateHistory[i];
      if (entry.timestamp < periodStart) break;

      const nextEntry = this.compressorStateHistory[i + 1];
      const periodEnd = nextEntry ? nextEntry.timestamp : now;
      const duration = (periodEnd - Math.max(entry.timestamp, periodStart)) / (1000 * 60);

      if (entry.running && duration > 0) {
        runtimeMinutes += duration;
      }
    }

    return Math.round(Math.max(0, Math.min(30, runtimeMinutes))); // Clamp between 0 and 30 minutes
  }

  /**
   * Start idle period monitoring
   */
  private startIdleMonitoring(): void {
    try {
      // Check every 30 minutes if we should add idle data points
      const interval = this.homey.setInterval(async () => {
        try {
          await this.handleIdlePeriodTracking();
        } catch (error) {
          this.error('Error during idle period tracking:', error);
        }
      }, 30 * 60 * 1000); // 30 minutes

      if (interval) {
        this.idleCheckInterval = interval;
        this.log('Started idle period monitoring (30 minute intervals)');
      } else {
        this.idleCheckInterval = null;
        this.error('Failed to start idle monitoring interval');
      }
    } catch (err) {
      this.idleCheckInterval = null;
      this.error('Error starting idle monitoring interval:', err);
    }
  }

  /**
   * Stop idle period monitoring
   */
  private stopIdleMonitoring(): void {
    if (this.idleCheckInterval) {
      this.homey.clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
      this.log('Stopped idle period monitoring');
    }
  }

  /**
   * Handle idle period tracking and add zero-COP data points when needed
   */
  private async handleIdlePeriodTracking(): Promise<void> {
    if (!this.rollingCOPCalculator) return;

    const now = Date.now();
    const compressorState = this.getCapabilityValue('adlar_state_compressor_state');
    const timeSinceLastCOP = this.lastCOPDataPointTime > 0 ? now - this.lastCOPDataPointTime : 0;

    // If compressor is idle for > 1 hour AND no COP data added recently, add idle data point
    if (!compressorState && timeSinceLastCOP > 60 * 60 * 1000) { // 1 hour
      const idleDataPoint: COPDataPoint = {
        timestamp: now,
        cop: 0, // Zero COP during idle
        method: 'idle_period',
        confidence: 'high', // High confidence that COP is 0 when idle
        compressorRuntime: 0,
        electricalPower: this.getIdlePowerConsumption(),
        isIdlePeriod: true, // Mark as idle period
      };

      this.rollingCOPCalculator.addDataPoint(idleDataPoint);
      this.lastCOPDataPointTime = now; // Update tracking time
      this.log('🕒 Added idle period data point (COP: 0) - compressor idle for > 1 hour');

      // Update rolling COP capabilities to reflect the idle state
      await this.updateRollingCOPCapabilities();
    }
  }

  /**
   * Get idle power consumption (standby power)
   */
  private getIdlePowerConsumption(): number {
    // Get actual standby power or estimate (pumps, controls, etc.)
    const powerValue = this.getCapabilityValue('measure_power');

    // If we have a power reading and it's low (< 500W), use it
    // Otherwise estimate typical standby consumption
    if (powerValue && powerValue < 500) {
      return powerValue;
    }

    // Estimate standby power: pumps (20W) + controls (10W) + electronics (20W)
    return 50; // 50W estimated standby
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
        logger: (message: string, ...args: unknown[]) => this.log(message, ...args),
        device: {
          // Device reference for flow card triggers (v1.0.8)
          triggerFlowCard: (cardId: string, tokens: Record<string, unknown>) => this.triggerFlowCard(cardId, tokens),
          getCapabilityValue: (capability: string) => this.getCapabilityValue(capability),
        },
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
   * Get external flow rate data from flow card input
   * Note: External flow data must be provided via Advanced Flow using the
   * "Send Flow Rate to heat pump for COP calculation" action card
   */
  private async getExternalFlowData(): Promise<number | null> {
    if (this.hasCapability('adlar_external_flow')) {
      const value = this.getCapabilityValue('adlar_external_flow');
      if (typeof value === 'number' && !Number.isNaN(value)) {
        this.debugLog(`💧 External flow data: ${value}L/min (from flow card)`);
        return value;
      }
    }
    this.debugLog('💧 No external flow data - use "Send Flow Rate" flow card to provide data');
    return null;
  }

  /**
   * Get external ambient temperature data from flow card input
   * Note: External ambient data must be provided via Advanced Flow using the
   * "Send Ambient Temperature to heat pump for COP calculation" action card
   */
  private async getExternalAmbientData(): Promise<number | null> {
    if (this.hasCapability('adlar_external_ambient')) {
      const value = this.getCapabilityValue('adlar_external_ambient');
      if (typeof value === 'number' && !Number.isNaN(value)) {
        this.debugLog(`🌡️ External ambient data: ${value}°C (from flow card)`);
        return value;
      }
    }
    this.debugLog('🌡️ No external ambient data - use "Send Ambient Temperature" flow card to provide data');
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
          this.startIdleMonitoring(); // Start idle period monitoring
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

      // Initialize external energy total capability with storage-aware restoration
      if (this.hasCapability('adlar_external_energy_total')) {
        const storedExternalTotal = await this.getStoreValue('external_cumulative_energy_kwh') || 0;
        await this.setCapabilityValue('adlar_external_energy_total', storedExternalTotal);
        this.log(`External energy total capability initialized: ${storedExternalTotal} kWh ${storedExternalTotal > 0 ? '(restored from storage)' : '(starting fresh)'}`);
      }

      // Initialize external energy daily capability with storage-aware restoration
      if (this.hasCapability('adlar_external_energy_daily')) {
        const storedExternalDaily = await this.getStoreValue('external_daily_consumption_kwh') || 0;
        await this.setCapabilityValue('adlar_external_energy_daily', storedExternalDaily);
        this.log(`External energy daily capability initialized: ${storedExternalDaily} kWh ${storedExternalDaily > 0 ? '(restored from storage)' : '(starting fresh)'}`);
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
   * Public method to manually trigger and debug COP calculation process
   */
  public async debugDailyCOPIssue(): Promise<void> {
    this.log('🔍 === DEBUGGING DAILY COP ISSUE ===');

    // Check COP calculation status
    this.debugCOPCapabilityStatus();

    // Check if the rolling calculator exists and has data
    if (this.rollingCOPCalculator) {
      const totalDataPoints = this.rollingCOPCalculator.exportData().dataPoints.length;
      this.log(`📊 Rolling COP calculator exists with ${totalDataPoints} data points`);

      // Try to get daily COP manually
      const dailyCOP = this.rollingCOPCalculator.getDailyCOP();
      this.log(`📅 Manual daily COP check: ${dailyCOP ? `${dailyCOP.averageCOP} (${dailyCOP.dataPoints} points)` : 'null/undefined'}`);
    } else {
      this.log('❌ Rolling COP calculator not initialized');
    }

    // Force a COP calculation attempt
    this.log('🚀 Forcing COP calculation attempt...');
    await this.calculateAndUpdateCOP();

    this.log('🔍 === END DEBUG ===');
  }

  /**
   * Public method to debug external energy accumulation
   */
  public async debugExternalEnergyAccumulation(): Promise<void> {
    this.log('🔋 === DEBUGGING EXTERNAL ENERGY ACCUMULATION ===');

    // Check current values
    const currentPower = this.getCapabilityValue('adlar_external_power');
    const currentEnergy = this.getCapabilityValue('adlar_external_energy_total');
    const lastTimestamp = this.lastExternalPowerTimestamp;

    this.log(`📊 Current external power: ${currentPower}W`);
    this.log(`🔋 Current external energy total: ${currentEnergy?.toFixed ? currentEnergy.toFixed(6) : currentEnergy}kWh`);
    this.log(`⏱️ Last power timestamp: ${lastTimestamp ? new Date(lastTimestamp).toISOString() : 'none'}`);

    // Check capabilities
    this.log(`📋 Has adlar_external_power capability: ${this.hasCapability('adlar_external_power')}`);
    this.log(`📋 Has adlar_external_energy_total capability: ${this.hasCapability('adlar_external_energy_total')}`);

    // Show reset functionality
    this.log('💡 To reset energy counter: Use device settings > Energy Management > Reset external energy total counter');

    this.log('🔋 === END DEBUG ===');
  }

  /**
   * Reset external energy total counter to zero
   */
  public async resetExternalEnergyTotal(): Promise<void> {
    this.log('🔄 Resetting external energy total counter...');

    try {
      // Check if capability exists
      if (!this.hasCapability('adlar_external_energy_total')) {
        this.log('⚠️ External energy total capability not available');
        return;
      }

      // Reset the capability value to zero
      await this.setCapabilityValue('adlar_external_energy_total', 0);

      // Reset the timestamp to start fresh accumulation
      this.lastExternalPowerTimestamp = null;

      this.log('✅ External energy total reset to 0.000000 kWh');
      this.log('✅ Energy accumulation timestamp reset - next measurement will use default interval');

      // Reset the setting back to false to prevent repeated triggers
      this.homey.setTimeout(() => {
        this.setSettings({ reset_external_energy_total: false })
          .then(() => this.log('🔄 Reset setting cleared'))
          .catch((error) => this.error('Failed to clear reset setting:', error));
      }, 1000);

    } catch (error) {
      this.error('Failed to reset external energy total:', error);
      throw new Error(`Failed to reset external energy total: ${error}`);
    }
  }

  /**
   * Reset external daily energy counter to zero
   */
  public async resetExternalEnergyDaily(): Promise<void> {
    this.log('🔄 Resetting external energy daily counter...');

    try {
      // Check if capability exists
      if (!this.hasCapability('adlar_external_energy_daily')) {
        this.log('⚠️ External energy daily capability not available');
        return;
      }

      // Reset the capability value to zero
      await this.setCapabilityValue('adlar_external_energy_daily', 0);

      // Reset the stored value for persistence
      await this.setStoreValue('external_daily_consumption_kwh', 0);

      this.log('✅ External energy daily reset to 0.000 kWh');

      // Reset the setting back to false to prevent repeated triggers
      this.homey.setTimeout(() => {
        this.setSettings({ reset_external_energy_daily: false })
          .then(() => this.log('🔄 Daily reset setting cleared'))
          .catch((error) => this.error('Failed to clear daily reset setting:', error));
      }, 1000);

    } catch (error) {
      this.error('Failed to reset external energy daily:', error);
      throw new Error(`Failed to reset external energy daily: ${error}`);
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
    // Enhanced debugging for daily COP investigation
    const hasCapability = this.hasCapability('adlar_cop');
    const copEnabled = this.copSettings?.enableCOP;

    this.log('🔍 COP calculation attempt:');
    this.log(`  📋 hasCapability('adlar_cop'): ${hasCapability}`);
    this.log(`  ⚙️  copSettings?.enableCOP: ${copEnabled}`);
    this.log(`  🎯 Will calculate COP: ${hasCapability && copEnabled}`);

    if (!hasCapability || !copEnabled) {
      this.log('❌ COP calculation skipped - capability not available or disabled');
      this.debugCOPCapabilityStatus();
      return;
    }

    this.log('✅ Proceeding with COP calculation...');

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
        forceMethod: (this.copSettings?.calculationMethod || 'auto') as 'auto' | 'direct_thermal' | 'carnot_estimation' | 'temperature_difference',
        enableOutlierDetection: this.copSettings?.enableOutlierDetection !== false,
        customOutlierThresholds: this.copSettings?.customOutlierThresholds || { minCOP: 0.5, maxCOP: 8.0 },
      };

      this.debugLog('COP calculation config:', copConfig);

      const copResult = COPCalculator.calculateCOP(combinedData, copConfig);

      // Note: External device source enhancement removed in simplified approach

      // Enhanced result logging
      this.logCOPCalculationResult(copResult);

      // Check and trigger COP outlier detection (v1.0.8)
      if (copResult.isOutlier && !this.lastCOPOutlierStatus) {
        // Fire and forget pattern - don't block COP calculation
        this.triggerFlowCard('cop_outlier_detected', {
          outlier_cop: Math.round(copResult.cop * 100) / 100,
          outlier_reason: copResult.outlierReason || 'Unknown reason',
          calculation_method: copResult.method,
        }).catch((err) => {
          this.error('Failed to trigger cop_outlier_detected flow card:', err);
        });

        this.log(`🚨 COP Outlier Detected: ${copResult.cop.toFixed(2)} - ${copResult.outlierReason}`);
      }
      this.lastCOPOutlierStatus = copResult.isOutlier;

      // Update COP capability if valid
      if (copResult.cop > 0 && !copResult.isOutlier) {
        const roundedCOP = Math.round(copResult.cop * 100) / 100;
        await this.setCapabilityValue('adlar_cop', roundedCOP);

        // COP efficiency changed trigger (v1.0.8)
        // Trigger when COP changes significantly (±0.3 threshold)
        const COP_CHANGE_THRESHOLD = 0.3;
        if (this.lastCOPValue > 0 && Math.abs(roundedCOP - this.lastCOPValue) >= COP_CHANGE_THRESHOLD) {
          this.triggerFlowCard('cop_efficiency_changed', {
            current_cop: roundedCOP,
            previous_cop: Math.round(this.lastCOPValue * 100) / 100,
            change: Math.round((roundedCOP - this.lastCOPValue) * 100) / 100,
          }).catch((err) => {
            this.error('Failed to trigger cop_efficiency_changed:', err);
          });
        }
        this.lastCOPValue = roundedCOP;

        // Update COP method capability
        const methodDisplayName = this.formatCOPMethodDisplay(copResult.method, copResult.confidence, copResult.diagnosticInfo);
        await this.setCapabilityValue('adlar_cop_method', methodDisplayName);

        this.log(`✅ COP updated: ${roundedCOP} (method: ${copResult.method}, confidence: ${copResult.confidence})`);

        // Log method description for debugging
        this.debugLog('Method details:', COPCalculator.getMethodDescription(copResult.method));

        // Add measurement to SCOP calculator if available
        await this.addCOPMeasurementToSCOP(copResult, combinedData);

        // Add measurement to rolling COP calculator
        this.log('📊 Adding COP measurement to rolling calculator:', roundedCOP);
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

  // Note: COP result enhancement with external sources now handled by EnergyTrackingService via ServiceCoordinator

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
   * Process DPS data received from Tuya device and update corresponding Homey capabilities
   * This method is called by the ServiceCoordinator when TuyAPI receives data or dp-refresh events
   * v0.99.96: Refactored to batch async operations to prevent TuyAPI event loop blocking
   * @param dps - DPS data object from Tuya device
   */
  updateCapabilitiesFromDps(dps: Record<string, unknown>): void {
    // Defensive guard: handle null/undefined dps parameter (v0.99.63 - crash fix)
    if (!dps || typeof dps !== 'object') {
      this.error('updateCapabilitiesFromDps called with invalid dps parameter:', dps);
      return;
    }

    this.debugLog('Processing DPS data:', dps);

    // Collect all capability updates as promises for batching (v0.99.96)
    const updatePromises: Promise<void>[] = [];

    // Convert string keys to numbers and process each DPS value
    Object.entries(dps).forEach(([dpsKey, value]) => {
      const dpsId = Number(dpsKey);
      if (Number.isNaN(dpsId)) {
        this.debugLog(`Skipping invalid DPS key: ${dpsKey}`);
        return;
      }

      // Map DPS ID to ALL associated capabilities using multi-capability mapping (v0.99.54+)
      // This supports dual picker/sensor architecture where one DPS updates multiple capabilities
      const capabilities = AdlarMapping.dpsToCapabilities[dpsId];
      if (!capabilities || capabilities.length === 0) {
        this.debugLog(`No capability mapping found for DPS ${dpsId} (value: ${value})`);
        return;
      }

      // Update ALL capabilities mapped to this DPS
      // Example: DPS 11 updates both adlar_enum_capacity_set (picker) and adlar_sensor_capacity_set (sensor)
      capabilities.forEach((capability) => {
        // Check if device has this capability
        if (!this.hasCapability(capability)) {
          this.debugLog(`Device does not have capability ${capability} for DPS ${dpsId}`);
          return;
        }

        try {
          // Apply DPS scale transformation (v1.0.10+)
          // Transforms raw Tuya integer values to actual decimal values
          // Example: DPS 104 (power) raw 25000 → 2500 W (scale 1: ÷ 10)
          // Example: DPS 103 (voltage) raw 2305 → 230.5 V (scale 3: ÷ 1000)
          const transformedValue = AdlarMapping.transformDpsValue(dpsId, value);

          // Collect capability update promise for batching
          const updatePromise = this.setCapabilityValue(capability, transformedValue)
            .then(() => {
              this.debugLog(`✅ Updated capability ${capability} = ${transformedValue} (DPS ${dpsId}, raw: ${value})`);
            })
            .catch((error) => {
              this.error(`Failed to update capability ${capability} with value ${transformedValue} (DPS ${dpsId}):`, error);
            });

          updatePromises.push(updatePromise);

          // Update capability health tracking via service coordinator (synchronous)
          // Use transformed value for health checks
          this.serviceCoordinator?.getCapabilityHealth()?.updateCapabilityHealth(capability, transformedValue);

          // Fault detection for DPS 15 (adlar_fault) - v1.0.7 feature
          // Trigger fault_detected flow card when new fault code appears
          if (dpsId === 15 && capability === 'adlar_fault') {
            // Use transformedValue for consistency (DPS 15 has no scale, so same as raw value)
            const faultCode = typeof transformedValue === 'number' ? transformedValue : 0;

            // Only trigger on NEW faults (not on every DPS update)
            // faultCode > 0 = active fault, faultCode changed = new/different fault
            if (faultCode > 0 && faultCode !== this.lastFaultCode) {
              // Fire-and-forget pattern to prevent blocking DPS processing
              this.triggerFlowCard('fault_detected', {
                fault_code: faultCode,
                fault_description: getFaultDescription(faultCode, this.homey.i18n.getLanguage() as 'en' | 'nl'),
              }).catch((err) => {
                this.error('Failed to trigger fault_detected flow card:', err);
              });

              this.log(`🚨 Fault detected: Code ${faultCode} - ${getFaultDescription(faultCode, 'en')}`);
              this.lastFaultCode = faultCode;
            } else if (faultCode === 0 && this.lastFaultCode !== 0) {
              // Fault cleared - log but don't trigger (users may want separate "fault_cleared" trigger in future)
              this.log(`✅ Fault cleared: Previous code ${this.lastFaultCode} resolved`);
              this.lastFaultCode = 0;
            }
          }

          // Temperature change detection (v1.0.8) - inlet, outlet, ambient
          // Trigger when temperature changes significantly (±0.5°C threshold)
          const TEMP_CHANGE_THRESHOLD = 0.5; // Minimum °C change to trigger

          // Inlet temperature (measure_temperature.temp_top)
          if (capability === 'measure_temperature.temp_top' && typeof transformedValue === 'number') {
            if (this.lastInletTemp !== null && Math.abs(transformedValue - this.lastInletTemp) >= TEMP_CHANGE_THRESHOLD) {
              this.triggerFlowCard('inlet_temperature_changed', {
                current_temperature: Math.round(transformedValue * 10) / 10,
                previous_temperature: Math.round(this.lastInletTemp * 10) / 10,
              }).catch((err) => {
                this.error('Failed to trigger inlet_temperature_changed:', err);
              });
            }
            this.lastInletTemp = transformedValue;
          }

          // Outlet temperature (measure_temperature.temp_bottom)
          if (capability === 'measure_temperature.temp_bottom' && typeof transformedValue === 'number') {
            if (this.lastOutletTemp !== null && Math.abs(transformedValue - this.lastOutletTemp) >= TEMP_CHANGE_THRESHOLD) {
              this.triggerFlowCard('outlet_temperature_changed', {
                current_temperature: Math.round(transformedValue * 10) / 10,
                previous_temperature: Math.round(this.lastOutletTemp * 10) / 10,
              }).catch((err) => {
                this.error('Failed to trigger outlet_temperature_changed:', err);
              });
            }
            this.lastOutletTemp = transformedValue;
          }

          // Ambient temperature (measure_temperature.around_temp)
          if (capability === 'measure_temperature.around_temp' && typeof transformedValue === 'number') {
            if (this.lastAmbientTemp !== null && Math.abs(transformedValue - this.lastAmbientTemp) >= TEMP_CHANGE_THRESHOLD) {
              this.triggerFlowCard('ambient_temperature_changed', {
                current_temperature: Math.round(transformedValue * 10) / 10,
                previous_temperature: Math.round(this.lastAmbientTemp * 10) / 10,
              }).catch((err) => {
                this.error('Failed to trigger ambient_temperature_changed:', err);
              });
            }
            this.lastAmbientTemp = transformedValue;
          }

        } catch (error) {
          this.error(`Error processing DPS ${dpsId} -> ${capability}:`, error);
        }
      });
    });

    // Execute all updates in parallel with proper error isolation (v0.99.96)
    // Use fire-and-forget pattern to prevent blocking TuyAPI event loop
    if (updatePromises.length > 0) {
      Promise.allSettled(updatePromises)
        .then((results) => {
          const failures = results.filter((r) => r.status === 'rejected').length;
          if (failures > 0) {
            this.error(`DPS update completed with ${failures} failures out of ${results.length} operations`);
          } else {
            this.debugLog(`✅ Successfully batched ${results.length} capability updates`);
          }
        })
        .catch((error) => {
          // This should never happen with allSettled, but defensive catch for safety
          this.error('Unexpected error in batched capability updates:', error);
        });
    }
  }

  private getCapabilityFriendlyTitle(capability: string): string {
    try {
    // Prefer the title from driver.compose.json capabilitiesOptions if present
      const deviceWithDriver = this as unknown as { driver?: { manifest?: { capabilitiesOptions?: Record<string, { title?: { en?: string; nl?: string } }> } } };
      const opt = deviceWithDriver?.driver?.manifest?.capabilitiesOptions?.[capability];
      const title = opt?.title?.en || opt?.title?.nl;
      if (title) return title;
    } catch {
    // ignore typing/runtime issues and fall back below
    }

    // Fallback mapping by capability suffix
    const part = capability.split('.')[1] || capability;
    const map: Record<string, string> = {
      around_temp: 'Ambient temp',
      temp_top: 'Inlet temp',
      temp_bottom: 'Outlet temp',
      coiler_temp: 'Coiler temp',
      venting_temp: 'Discharge temp',
      temp_current_f: 'High pressure temp',
      top_temp_f: 'Low pressure temp',
      bottom_temp_f: 'Incoiler temp',
      coiler_temp_f: 'Suction temp',
      evlin: 'Economizer inlet',
      eviout: 'Economizer outlet',
    };
    return map[part] || capability;
  }

  // Note: Critical conditions and flow card triggering now handled by FlowCardManagerService via ServiceCoordinator

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
   * Initialize connection status tracking (v0.99.47)
   * Updates adlar_connection_status capability every 5 seconds
   */
  private async initializeConnectionStatusTracking(): Promise<void> {
    // Immediate initial update
    await this.updateConnectionStatus();

    // Set up periodic updates (every 5 seconds)
    this.homey.setInterval(async () => {
      await this.updateConnectionStatus();
    }, 5000);

    this.log('Connection status tracking initialized');
  }

  /**
   * Update the adlar_connection_status capability based on TuyaConnectionService state (v0.99.61: now includes timestamp)
   */
  private async updateConnectionStatus(): Promise<void> {
    if (!this.hasCapability('adlar_connection_status')) {
      return;
    }

    try {
      // Get formatted status with timestamp from ServiceCoordinator if available
      if (this.serviceCoordinator) {
        const tuyaService = this.serviceCoordinator.getTuyaConnection();
        const formattedStatus = tuyaService.getFormattedConnectionStatus();
        await this.setCapabilityValue('adlar_connection_status', formattedStatus);
      }
    } catch (error) {
      this.error('Failed to update connection status capability:', error);
    }
  }

  /**
   * Update all flow cards based on current settings (called when settings change)
   */
  private async updateFlowCards(): Promise<void> {
    try {
      // Flow card registration is fully handled by FlowCardManagerService via ServiceCoordinator
      // ServiceCoordinator automatically updates flow cards based on capability health events
      if (this.serviceCoordinator) {
        await this.serviceCoordinator.getFlowCardManager()?.updateFlowCards();
        this.log('Flow cards updated via FlowCardManagerService');
      } else {
        this.log('ServiceCoordinator not available, skipping flow card update');
      }
    } catch (error) {
      this.error('Error updating flow cards:', error);
    }
  }

  /**
   * Unregister all flow card listeners - delegated to FlowCardManagerService
   */
  private unregisterAllFlowCards(): void {
    // Flow card unregistration is handled automatically by FlowCardManagerService
    this.log('Flow card unregistration delegated to FlowCardManagerService');
  }

  /**
   * Helper method to trigger flow cards safely - delegated to FlowCardManagerService
   */
  private async triggerFlowCard(cardId: string, tokens: Record<string, unknown>) {
    // Flow card triggering is handled automatically by FlowCardManagerService
    // For now, use the standard Homey trigger approach for compatibility
    try {
      const triggerCard = this.homey.flow.getDeviceTriggerCard(cardId);
      await triggerCard.trigger(this, tokens, {});
      this.debugLog(`Triggered flow card: ${cardId}`, tokens);
    } catch (error) {
      this.debugLog(`Flow card ${cardId} not available or trigger failed:`, error);
    }
  }

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    await this.setUnavailable(); // Set the device as unavailable initially

    // Migrate adlar_connection_status from enum to string type (v0.99.61 migration)
    // Existing devices have the old enum-type capability which causes "unknown_error_getting_file" errors
    if (this.hasCapability('adlar_connection_status')) {
      try {
        // Check if migration flag exists to avoid repeated migrations
        const migrationFlag = this.getStoreValue('connection_status_migrated_v0_99_61');
        if (!migrationFlag) {
          this.log('🔄 Migrating adlar_connection_status capability from enum to string type...');
          await this.removeCapability('adlar_connection_status');
          await this.addCapability('adlar_connection_status');
          await this.setStoreValue('connection_status_migrated_v0_99_61', true);
          this.log('✅ Successfully migrated adlar_connection_status capability to string type');
        }
      } catch (error) {
        this.error('Failed to migrate adlar_connection_status capability:', error);
      }
    } else {
      // Add capability for brand new devices
      try {
        await this.addCapability('adlar_connection_status');
        await this.setStoreValue('connection_status_migrated_v0_99_61', true);
        this.log('✅ Added adlar_connection_status capability to new device');
      } catch (error) {
        this.error('Failed to add adlar_connection_status capability:', error);
      }
    }

    // Add missing curve sensor capabilities for existing devices (v0.99.54 migration)
    if (!this.hasCapability('adlar_sensor_capacity_set')) {
      try {
        await this.addCapability('adlar_sensor_capacity_set');
        this.log('✅ Added adlar_sensor_capacity_set capability to existing device (v0.99.54 migration)');
      } catch (error) {
        this.error('Failed to add adlar_sensor_capacity_set capability:', error);
      }
    }

    if (!this.hasCapability('adlar_picker_countdown_set')) {
      try {
        await this.addCapability('adlar_picker_countdown_set');
        this.log('✅ Added adlar_picker_countdown_set capability to existing device (v0.99.54 migration)');
      } catch (error) {
        this.error('Failed to add adlar_picker_countdown_set capability:', error);
      }
    }

    // Add connection insights capability for existing devices (v1.0.12 migration)
    if (!this.hasCapability('adlar_connection_active')) {
      try {
        await this.addCapability('adlar_connection_active');
        this.log('✅ Added adlar_connection_active capability to existing device (v1.0.12 migration)');

        // Initialize with current connection status
        // Note: Services not yet initialized at this point, will be set correctly after service init
        await this.setCapabilityValue('adlar_connection_active', false);
        this.log('🔄 Connection insights capability initialized (will update after service initialization)');
      } catch (error) {
        this.error('Failed to add adlar_connection_active capability:', error);
      }
    }

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

          // OPTIMISTIC UPDATE (v0.99.52): Set capability value immediately for responsive UI
          // This ensures getCapabilityValue() returns the new value right away, even before
          // the device confirms the change. If device responds with different value,
          // updateCapabilitiesFromDps() will override this optimistic value.
          await this.setCapabilityValue(capability, validatedValue);
          this.debugLog(`Optimistic update: ${capability} = ${validatedValue}`);

          // Send command to device via ServiceCoordinator or fallback
          await this.sendTuyaCommand(dp, validatedValue as string | number | boolean);

          // Device response will arrive via updateCapabilitiesFromDps() and will:
          // 1. Confirm the optimistic update (same value) - no visible change
          // 2. Override with actual device value if different - ensures device is source of truth
          //
          // WHY THIS WORKS:
          // - Homey SDK: setCapabilityValue() does NOT trigger listeners when called programmatically
          // - Only USER-initiated changes (via UI/Flow cards) trigger capability listeners
          // - Therefore: updateCapabilitiesFromDps() calling setCapabilityValue() is SAFE
          // - No feedback loop, no circular dependencies
          //
          // BIDIRECTIONAL SYNC:
          // - User changes Homey UI → Listener fires → Optimistic update → Send to device → Device confirms
          // - Tuya app changes device → DPS update → updateCapabilitiesFromDps() → setCapabilityValue() → Homey UI updates
          // - Both flows work correctly without interference

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

    // Reset external power timestamp on device initialization
    this.lastExternalPowerTimestamp = null;

    // Get Tuya device settings from Homey
    const id = (this.getStoreValue('device_id') || '').toString().trim();
    const key = (this.getStoreValue('local_key') || '').toString().trim();
    const ip = (this.getStoreValue('ip_address') || '').toString().trim();
    const version = (this.getStoreValue('protocol_version') || '3.3').toString().trim();

    if (!id || !key) {
      this.error('Tuya credentials missing: device_id or local_key not set.');
      await this.setUnavailable('Missing Tuya credentials');
      return;
    }

    // Initialize Service Coordinator with Tuya configuration
    this.serviceCoordinator = new ServiceCoordinator({
      device: this,
      logger: this.debugLog.bind(this),
    });

    // Initialize services via coordinator
    const initResult = await this.serviceCoordinator.initialize({
      id,
      key,
      ip,
      version,
    });

    if (!initResult.success || initResult.failedServices.length > 0) {
      this.error('Service initialization issues:', {
        failedServices: initResult.failedServices,
        errors: initResult.errors.map((e) => e.message),
      });
      // Continue with fallback to direct methods for failed services
    }

    // Note: Reconnection interval is managed by ServiceCoordinator's TuyaConnectionService (v0.99.23+)
    // No need for duplicate legacy reconnection interval

    // Initialize flow cards based on current settings
    await this.initializeFlowCards();

    // Initialize connection status tracking (v0.99.47)
    await this.initializeConnectionStatusTracking();

    // Note: Health checks now managed by ServiceCoordinator's CapabilityHealthService

    // Note: Energy tracking intervals managed by ServiceCoordinator's EnergyTrackingService

    // Initialize COP calculation system
    await this.initializeCOP();

    // Initialize rolling COP calculator
    await this.initializeRollingCOP();

    // Force refresh trend capability to ensure proper translation
    await this.forceRefreshTrendCapability();

    // Initialize intelligent energy tracking if enabled
    if (this.getSetting('enable_intelligent_energy_tracking')) {
      await this.initializeEnergyTracking();
      this.log('🔋 Intelligent energy tracking initialized');
    }

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

    // Delegate settings changes to ServiceCoordinator first
    if (this.serviceCoordinator) {
      try {
        await this.serviceCoordinator.onSettings(oldSettings, newSettings, changedKeys);
      } catch (error) {
        this.error('ServiceCoordinator settings handling failed:', error);
        // Continue with fallback to direct method handling
      }
    }

    // Handle energy tracking settings changes first
    await this.handleEnergyTrackingSettings(changedKeys, newSettings);

    // Handle reset external energy total
    if (changedKeys.includes('reset_external_energy_total') && newSettings.reset_external_energy_total === true) {
      await this.resetExternalEnergyTotal();
    }

    // Handle reset external energy daily
    if (changedKeys.includes('reset_external_energy_daily') && newSettings.reset_external_energy_daily === true) {
      await this.resetExternalEnergyDaily();
    }

    // Handle device credential changes (for repair scenarios)
    const credentialKeysChanged = changedKeys.filter(
      (key) => ['device_id', 'local_key', 'ip_address', 'protocol_version'].includes(key),
    );

    if (credentialKeysChanged.length > 0) {
      this.log('🔧 Device credentials changed (repair mode):', credentialKeysChanged);

      // Update store values to match settings
      for (const key of credentialKeysChanged) {
        const newValue = newSettings[key];
        if (newValue && typeof newValue === 'string') {
          await this.setStoreValue(key, newValue);
          this.log(`Updated store value: ${key} = ${newValue}`);
        }
      }

      // Reinitialize TuyaConnectionService with new credentials
      if (this.serviceCoordinator) {
        try {
          const newConfig = {
            id: (newSettings.device_id || '').toString().trim(),
            key: (newSettings.local_key || '').toString().trim(),
            ip: (newSettings.ip_address || '').toString().trim(),
            version: (newSettings.protocol_version || '3.3').toString().trim(),
          };

          this.log('Reinitializing Tuya connection with new credentials...');
          this.log(`New device: ${newConfig.id} @ ${newConfig.ip} (Protocol: ${newConfig.version})`);

          await this.serviceCoordinator.getTuyaConnection()?.reinitialize(newConfig);

          this.log('✅ Device repaired successfully - reconnected with new credentials');
          await this.setAvailable();

          return `Device repaired successfully!\n\nNew credentials active:\n- Device ID: ${newConfig.id}\n- IP Address: ${newConfig.ip}\n- Protocol: ${newConfig.version}\n\nConnection established.`;

        } catch (error) {
          this.error('Failed to reinitialize Tuya connection:', error);

          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.setUnavailable(`Repair failed: ${errorMessage}`);

          return (
            `Repair failed: ${errorMessage}\n\n`
            + 'Please verify:\n'
            + '- Device ID and Local Key are correct\n'
            + '- IP address is reachable\n'
            + '- Protocol version matches your device\n\n'
            + 'Connection will retry automatically.'
          );
        }
      } else {
        this.log('ServiceCoordinator not available - credentials updated but connection not reinitialized');
        return 'Credentials updated in settings. Please restart the device to apply changes.';
      }
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

    // Handle force reconnect request (v0.99.66)
    if (changedKeys.includes('force_reconnect') && newSettings.force_reconnect === true) {
      this.log('🔄 Manual reconnect triggered by user');

      try {
        // Get TuyaConnectionService from ServiceCoordinator
        const tuyaService = this.serviceCoordinator?.getTuyaConnection();
        if (!tuyaService) {
          throw new Error('TuyaConnectionService not available');
        }

        // Trigger force reconnect
        await tuyaService.forceReconnect();
        this.log('✅ Force reconnect completed');

        // Reset the checkbox after operation completes
        this.homey.setTimeout(async () => {
          try {
            await this.setSettings({ force_reconnect: false });
            this.log('🔄 Force reconnect checkbox reset');
          } catch (error) {
            this.error('Failed to reset force reconnect checkbox:', error);
          }
        }, DeviceConstants.SETTINGS_DEFER_DELAY_MS);

        return 'Force reconnect initiated. Check connection status capability for result.';
      } catch (error) {
        this.error('Failed to force reconnect:', error);

        // Still reset the checkbox even on failure
        this.homey.setTimeout(async () => {
          try {
            await this.setSettings({ force_reconnect: false });
          } catch (err) {
            this.error('Failed to reset force reconnect checkbox after error:', err);
          }
        }, DeviceConstants.SETTINGS_DEFER_DELAY_MS);

        throw new Error(`Failed to reconnect: ${error}`);
      }
    }

    // Handle capability diagnostics request
    if (changedKeys.includes('capability_diagnostics') && newSettings.capability_diagnostics === true) {
      const diagnostics = this.serviceCoordinator?.getCapabilityHealth()?.generateDiagnosticsReport() ?? {};
      const diagnosticReport = JSON.stringify(diagnostics, null, 2);

      this.log('Capability diagnostic report generated:', diagnostics);

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

    // Handle curve controls settings (v0.99.54+)
    if (changedKeys.includes('enable_curve_controls')) {
      await this.handleOptionalCapabilities();
      this.log('Curve control picker settings updated');
      return 'Curve control picker settings updated. Picker capabilities visibility will be updated shortly. Sensor capabilities remain always visible.';
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
        this.stopIdleMonitoring();
        this.startCOPCalculationInterval();
        this.startIdleMonitoring();
        this.log('COP calculation and idle monitoring restarted with new settings');

        // Also restart SCOP updates if available
        if (this.hasCapability('adlar_scop') && this.scopCalculator) {
          this.stopSCOPUpdateInterval();
          this.startSCOPUpdateInterval();
          this.log('SCOP updates restarted with COP settings');
        }
      } else {
        this.stopCOPCalculationInterval();
        this.stopIdleMonitoring();
        this.stopSCOPUpdateInterval();
        this.log('COP calculation, idle monitoring, and SCOP updates stopped');
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
    const enableCurveControls = this.getSetting('enable_curve_controls') ?? false; // default false (v0.99.54+)

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
      'adlar_external_energy_total',
      'adlar_external_energy_daily',
      'adlar_external_flow',
      'adlar_external_ambient',
      'adlar_scop',
      'adlar_scop_quality',
      'adlar_cop_daily',
      'adlar_cop_weekly',
      'adlar_cop_monthly',
      'adlar_cop_trend',
    ];

    // Curve control picker capabilities (v0.99.54+)
    // Sensor capabilities (adlar_enum_countdown_set, adlar_sensor_capacity_set) always remain visible
    const curvePickerCapabilities = [
      'adlar_enum_capacity_set', // Hot water curve picker
      'adlar_picker_countdown_set', // Heating curve picker
    ];

    // Process power capabilities
    await this.processCapabilityGroup(powerCapabilities, enablePowerMeasurements, 'power measurement');

    // Process slider capabilities
    await this.processCapabilityGroup(sliderCapabilities, enableSliderControls, 'slider control');

    // Process COP capabilities
    await this.processCapabilityGroup(copCapabilities, enableCOPCalculation, 'COP calculation');

    // Process curve control picker capabilities (v0.99.54+)
    await this.processCapabilityGroup(curvePickerCapabilities, enableCurveControls, 'curve control picker');
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
        this.error(`Failed to process ${featureName} capability ${capability}:`, error);

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
        this.log(`📊 Received external power data: ${args.power_value}W`);

        // Store the external power value in the capability
        if (this.hasCapability('adlar_external_power')) {
          await this.setCapabilityValue('adlar_external_power', args.power_value);
          this.debugLog(`📊 External power capability updated to: ${args.power_value}W`);

          // IMMEDIATELY update external energy total when external power is received
          if (this.hasCapability('adlar_external_energy_total')) {
            const now = Date.now();
            const currentExternalTotal = this.getCapabilityValue('adlar_external_energy_total') || 0;

            // Calculate time difference from last external power update
            let energyIncrement = 0;
            if (this.lastExternalPowerTimestamp) {
              const timeDifferenceMs = now - this.lastExternalPowerTimestamp;
              const timeDifferenceHours = timeDifferenceMs / (1000 * 60 * 60); // Convert to hours
              energyIncrement = (args.power_value / 1000) * timeDifferenceHours; // kWh

              this.log(`⏱️ Time since last power update: ${(timeDifferenceMs / 1000).toFixed(1)}s`);
            } else {
              // First measurement - use a default 10-second interval
              energyIncrement = (args.power_value / 1000) * 0.002778; // kWh (10 seconds)
              this.log('🆕 First external power measurement - using default 10s interval');
            }

            this.lastExternalPowerTimestamp = now;
            const newExternalTotal = currentExternalTotal + energyIncrement;

            // Use higher precision for small energy increments
            const roundedTotal = Math.round(newExternalTotal * 1000000) / 1000000; // 6 decimal places
            await this.setCapabilityValue('adlar_external_energy_total', roundedTotal);
            await this.setStoreValue('external_cumulative_energy_kwh', roundedTotal);

            // Also update external daily energy consumption
            if (this.hasCapability('adlar_external_energy_daily')) {
              const currentExternalDaily = this.getCapabilityValue('adlar_external_energy_daily') || 0;
              const newExternalDaily = currentExternalDaily + energyIncrement;
              const roundedDaily = Math.round(newExternalDaily * 1000000) / 1000000; // 6 decimal places for daily (matches total)
              await this.setCapabilityValue('adlar_external_energy_daily', roundedDaily);

              // Store external daily energy for persistence and reset functionality
              await this.setStoreValue('external_daily_consumption_kwh', newExternalDaily);
            }

            // Better display formatting for small values
            const incrementWh = energyIncrement * 1000;
            const incrementDisplay = incrementWh < 0.1
              ? `+${(incrementWh * 1000).toFixed(1)}mWh`
              : `+${incrementWh.toFixed(1)}Wh`;

            this.log(`🔌 External energy updated: ${incrementDisplay} `
              + `(power: ${args.power_value}W, total: ${roundedTotal.toFixed(6)}kWh)`);
          }
        } else {
          this.error('📊 External power capability not available!');
        }

        // Trigger intelligent power update to potentially use this new external data
        const energyTrackingEnabled = this.getSetting('enable_intelligent_energy_tracking');
        this.debugLog(`📊 Energy tracking enabled: ${energyTrackingEnabled}`);

        if (energyTrackingEnabled) {
          this.log('📊 Triggering intelligent power measurement update...');
          await this.updateIntelligentPowerMeasurement();
        } else {
          this.debugLog('📊 Skipping intelligent power update - energy tracking disabled');
        }

        this.log(`✅ External power data updated: ${args.power_value}W (energy tracking: ${energyTrackingEnabled})`);
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
   * Intelligent power source selection for measure_power capability
   * Prioritizes external power measurements when available, falls back to internal sensors
   */
  private async updateIntelligentPowerMeasurement(): Promise<void> {
    // Delegate to EnergyTrackingService via ServiceCoordinator
    await this.serviceCoordinator?.getEnergyTracking()?.updateIntelligentPowerMeasurement();
  }

  // Note: Internal power measurement now handled by EnergyTrackingService via ServiceCoordinator

  // Note: Power estimation calculation now handled by EnergyTrackingService via ServiceCoordinator

  /**
   * Handle settings changes for intelligent energy tracking
   */
  private async handleEnergyTrackingSettings(changedKeys: string[], newSettings: Record<string, unknown>): Promise<void> {
    if (changedKeys.includes('enable_intelligent_energy_tracking')) {
      const enabled = newSettings.enable_intelligent_energy_tracking;
      this.log(`🔋 Intelligent energy tracking ${enabled ? 'enabled' : 'disabled'}`);

      if (enabled) {
        // Initialize energy tracking when enabled
        await this.initializeEnergyTracking();
        // Note: Energy tracking interval managed by ServiceCoordinator's EnergyTrackingService
        // Immediately update power measurement when enabled
        await this.updateIntelligentPowerMeasurement();
      } else {
        // Note: Energy tracking interval stop managed by ServiceCoordinator's EnergyTrackingService
      }
    }
  }

  /**
   * Initialize software energy tracking system
   */
  private async initializeEnergyTracking(): Promise<void> {
    try {
      // Initialize energy tracking timestamp if not exists
      const lastUpdate = await this.getStoreValue('last_energy_update');
      if (!lastUpdate) {
        await this.setStoreValue('last_energy_update', Date.now());
        this.log('🔋 Energy tracking initialized');
      }

      // Initialize external energy tracking timestamp if not exists
      const lastExternalUpdate = await this.getStoreValue('last_external_energy_update');
      if (!lastExternalUpdate) {
        await this.setStoreValue('last_external_energy_update', Date.now());
        this.log('🔌 External energy tracking initialized');
      }

      // Initialize cumulative energy if meter capabilities are zero/null
      if (this.hasCapability('meter_power.electric_total')) {
        const currentTotal = this.getCapabilityValue('meter_power.electric_total');
        if (!currentTotal || currentTotal === 0) {
          // Check if we have stored cumulative energy from previous sessions
          const storedTotal = await this.getStoreValue('cumulative_energy_kwh') || 0;
          if (storedTotal > 0) {
            await this.setCapabilityValue('meter_power.electric_total', storedTotal);
            this.log(`🔋 Restored cumulative energy: ${storedTotal} kWh`);
          }
        }
      }

      // Initialize external energy tracking capability
      if (this.hasCapability('adlar_external_energy_total')) {
        const currentExternalTotal = this.getCapabilityValue('adlar_external_energy_total');
        if (!currentExternalTotal || currentExternalTotal === 0) {
          // Check if we have stored external energy from previous sessions
          const storedExternalTotal = await this.getStoreValue('external_cumulative_energy_kwh') || 0;
          if (storedExternalTotal > 0) {
            await this.setCapabilityValue('adlar_external_energy_total', storedExternalTotal);
            this.log(`🔌 Restored external energy: ${storedExternalTotal} kWh`);
          }
        }
      }

      // Initialize external daily energy tracking capability
      if (this.hasCapability('adlar_external_energy_daily')) {
        const currentExternalDaily = this.getCapabilityValue('adlar_external_energy_daily');
        if (!currentExternalDaily || currentExternalDaily === 0) {
          // Check if we have stored external daily energy from previous sessions
          const storedExternalDaily = await this.getStoreValue('external_daily_consumption_kwh') || 0;
          if (storedExternalDaily > 0) {
            await this.setCapabilityValue('adlar_external_energy_daily', storedExternalDaily);
            this.log(`🔌 Restored external daily energy: ${storedExternalDaily} kWh`);
          }
        }
      }

      // Reset daily energy at midnight
      this.scheduleDailyEnergyReset();

    } catch (error) {
      this.error('Error initializing energy tracking:', error);
    }
  }

  // Note: Cumulative energy tracking now handled by EnergyTrackingService via ServiceCoordinator

  /**
   * Schedule daily energy reset at midnight
   */
  private scheduleDailyEnergyReset(): void {
    // Calculate milliseconds until next midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // Schedule reset
    this.homey.setTimeout(() => {
      this.resetDailyEnergy()
        .catch((error) => this.error('Failed to reset daily energy at midnight:', error));
      // Schedule recurring daily resets
      this.homey.setInterval(() => {
        this.resetDailyEnergy()
          .catch((error) => this.error('Failed to reset daily energy on schedule:', error));
      }, 24 * 60 * 60 * 1000); // 24 hours
    }, msUntilMidnight);

    this.log(`🕛 Daily energy reset scheduled for ${tomorrow.toLocaleString()}`);
  }

  /**
   * Reset daily energy consumption at midnight
   */
  private async resetDailyEnergy(): Promise<void> {
    try {
      // Reset internal daily energy consumption
      if (this.hasCapability('meter_power.power_consumption')) {
        await this.setCapabilityValue('meter_power.power_consumption', 0);
        await this.setStoreValue('daily_consumption_kwh', 0);
        this.log('🔄 Internal daily energy consumption reset to 0 kWh');
      }

      // Reset external daily energy consumption
      if (this.hasCapability('adlar_external_energy_daily')) {
        await this.setCapabilityValue('adlar_external_energy_daily', 0);
        await this.setStoreValue('external_daily_consumption_kwh', 0);
        this.log('🔄 External daily energy consumption reset to 0 kWh');
      }
    } catch (error) {
      this.error('Error resetting daily energy:', error);
    }
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('MyDevice has been deleted');

    // Cleanup ServiceCoordinator and all managed services
    if (this.serviceCoordinator) {
      try {
        this.serviceCoordinator.destroy();
        this.serviceCoordinator = null;
        this.log('ServiceCoordinator destroyed successfully');
      } catch (error) {
        this.error('Error destroying ServiceCoordinator:', error);
      }
    }

    // Stop reconnection interval
    this.stopReconnectInterval();

    // Stop health check interval
    // Note: Health check intervals managed by ServiceCoordinator

    // Note: Energy tracking interval stop managed by ServiceCoordinator

    // Stop COP calculation interval
    this.stopCOPCalculationInterval();

    // Stop idle monitoring
    this.stopIdleMonitoring();

    // Save rolling COP data before shutdown
    await this.saveRollingCOPData();

    // Stop SCOP update interval
    this.stopSCOPUpdateInterval();

    // Destroy calculator services to release memory (prevent memory leaks)
    if (this.scopCalculator) {
      try {
        this.scopCalculator.destroy();
        this.scopCalculator = null;
        this.log('SCOP calculator destroyed - memory released');
      } catch (error) {
        this.error('Error destroying SCOP calculator:', error);
      }
    }

    if (this.rollingCOPCalculator) {
      try {
        this.rollingCOPCalculator.destroy();
        this.rollingCOPCalculator = null;
        this.log('Rolling COP calculator destroyed - memory released');
      } catch (error) {
        this.error('Error destroying Rolling COP calculator:', error);
      }
    }

    if (this.tuya) {
      try {
        // Remove all event listeners to prevent memory leaks
        this.tuya.removeAllListeners();

        // Disconnect if instance exists (ServiceCoordinator handles its own cleanup)
        if (this.tuya) {
          this.tuya.disconnect();
          this.log('Disconnected from Tuya device');
        }
      } catch (err) {
        this.error('Error cleaning up Tuya device:', err);
      }
    }

    // Clean up flow card listeners
    this.unregisterAllFlowCards();

    // Reset connection state (ServiceCoordinator handles its own cleanup)
    this.tuya = undefined;
  }

  /**
   * ServiceCoordinator integration methods - expose service functionality
   */

  /**
   * Get service health status from ServiceCoordinator
   */
  public getServiceHealth(): Record<string, boolean> | null {
    return this.serviceCoordinator?.getServiceHealth() || null;
  }

  /**
   * Get comprehensive service diagnostics
   */
  public getServiceDiagnostics(): Record<string, unknown> | null {
    return this.serviceCoordinator?.getServiceDiagnostics() || null;
  }

  /**
   * Force Tuya reconnection via ServiceCoordinator
   */
  public async forceServiceReconnection(): Promise<void> {
    if (this.serviceCoordinator) {
      await this.serviceCoordinator.forceReconnection();
    } else {
      throw new Error('ServiceCoordinator not initialized');
    }
  }

  /**
   * Receive external power data via ServiceCoordinator
   */
  public async receiveExternalPowerDataViaService(powerValue: number): Promise<void> {
    if (this.serviceCoordinator) {
      await this.serviceCoordinator.receiveExternalPowerData(powerValue);
    } else if (this.hasCapability('adlar_external_power')) {
      // Fallback to direct capability update
      await this.setCapabilityValue('adlar_external_power', powerValue);
    }
  }
}

module.exports = MyDevice;
