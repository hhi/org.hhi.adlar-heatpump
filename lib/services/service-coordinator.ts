/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';
import { SettingsManagerService } from './settings-manager-service';
import { CapabilityHealthService } from './capability-health-service';
import { EnergyTrackingService } from './energy-tracking-service';
import { TuyaConnectionService, TuyaDeviceConfig } from './tuya-connection-service';
import { FlowCardManagerService } from './flow-card-manager-service';
import { AdaptiveControlService } from './adaptive-control-service';
import { HeatingCurveVisualizationService } from './heating-curve-visualization-service';
import { BuildingInsightsService } from './building-insights-service';
import { CategorizedError } from '../error-types';
import { AdlarMapping } from '../definitions/adlar-mapping';

export interface ServiceCoordinatorOptions {
  device: Homey.Device;
  logger?: (message: string, ...args: unknown[]) => void;
}

export interface ServiceInitializationResult {
  success: boolean;
  failedServices: string[];
  errors: Error[];
}

export class ServiceCoordinator {
  private device: Homey.Device;
  private logger: (message: string, ...args: unknown[]) => void;
  private isInitialized = false;

  // Service instances
  private settingsManager!: SettingsManagerService;
  private capabilityHealth!: CapabilityHealthService;
  private energyTracking!: EnergyTrackingService;
  private tuyaConnection!: TuyaConnectionService;
  private flowCardManager!: FlowCardManagerService;
  private adaptiveControl!: AdaptiveControlService;
  private heatingCurveVisualization!: HeatingCurveVisualizationService;
  private buildingInsights!: BuildingInsightsService;

  // Service state tracking
  private serviceHealth = new Map<string, boolean>();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // Event handler references (v1.0.2 - prevent memory leaks from inline arrow functions)
  private onHealthDegradedHandler?: (data: { capability: string; healthData: unknown }) => void;
  private onHealthRecoveredHandler?: (data: { capability: string; healthData: unknown }) => void;
  private onHealthReportHandler?: (report: unknown) => void;
  private onEnergyTotalResetHandler?: () => void;
  private onEnergyDailyResetHandler?: () => void;
  private onDiagnosticsReportHandler?: (diagnostics: unknown) => void;

  /**
   * Orchestrates initialization and interaction between internal services
   * (SettingsManager, CapabilityHealth, EnergyTracking, TuyaConnection, FlowCardManager).
   * It centralizes lifecycle management and cross-service events.
   * @param options.device - owning Homey device
   * @param options.logger - optional logger
   */
  constructor(options: ServiceCoordinatorOptions) {
    this.device = options.device;
    this.logger = options.logger || (() => { });

    this.initializeServices();
    this.setupServiceEventHandlers();
  }

  /**
   * Create instances of each service and wire basic event handlers.
   * This method is called during construction to set up service singletons for the device.
   */
  private initializeServices(): void {
    this.logger('ServiceCoordinator: Initializing all services');

    // Initialize services with shared device and logger
    const serviceOptions = {
      device: this.device,
      logger: this.logger,
    };

    this.settingsManager = new SettingsManagerService(serviceOptions);
    this.capabilityHealth = new CapabilityHealthService(serviceOptions);
    this.energyTracking = new EnergyTrackingService(serviceOptions);
    this.adaptiveControl = new AdaptiveControlService(serviceOptions);
    this.flowCardManager = new FlowCardManagerService({
      ...serviceOptions,
      onExternalPowerData: this.energyTracking.receiveExternalPowerData.bind(this.energyTracking),
      onExternalPricesData: this.adaptiveControl.receiveExternalPricesData.bind(this.adaptiveControl),
    });
    this.heatingCurveVisualization = new HeatingCurveVisualizationService(serviceOptions);

    // BuildingInsightsService requires BuildingModelService and AdaptiveControlService
    // Note: Will be fully initialized after adaptiveControl.initialize() is called
    this.buildingInsights = new BuildingInsightsService({
      device: this.device,
      logger: this.logger,
      buildingModelService: this.adaptiveControl.getBuildingModelService(),
      adaptiveControlService: this.adaptiveControl,
    });

    // TuyaConnectionService requires special initialization
    this.tuyaConnection = new TuyaConnectionService({
      device: this.device,
      logger: this.logger,
      onData: this.handleTuyaData.bind(this),
      onDpRefresh: this.handleTuyaData.bind(this),
      onConnected: this.handleTuyaConnected.bind(this),
      onDisconnected: this.handleTuyaDisconnected.bind(this),
      onError: this.handleTuyaError.bind(this),
    });

    // Track initial service health
    this.serviceHealth.set('settings', true);
    this.serviceHealth.set('capability', true);
    this.serviceHealth.set('energy', true);
    this.serviceHealth.set('tuya', false); // Not connected initially
    this.serviceHealth.set('flowcard', true);
    this.serviceHealth.set('adaptive', true);
    this.serviceHealth.set('heatingcurve', true);
    this.serviceHealth.set('insights', true);

    this.logger('ServiceCoordinator: All services initialized');
  }

  /**
   * Configure inter-service event handlers so health/energy/flows are kept in sync.
   */
  private setupServiceEventHandlers(): void {
    this.logger('ServiceCoordinator: Setting up inter-service event handlers');

    // CRITICAL: Remove existing listeners BEFORE creating new ones (v2.0.2 re-init protection)
    // This prevents accumulation when setupServiceEventHandlers() is called multiple times
    if (this.onHealthDegradedHandler) {
      this.device.removeListener('capability:health-degraded', this.onHealthDegradedHandler);
    }
    if (this.onHealthRecoveredHandler) {
      this.device.removeListener('capability:health-recovered', this.onHealthRecoveredHandler);
    }
    if (this.onHealthReportHandler) {
      this.device.removeListener('capability:health-report', this.onHealthReportHandler);
    }
    if (this.onEnergyTotalResetHandler) {
      this.device.removeListener('energy:total-reset', this.onEnergyTotalResetHandler);
    }
    if (this.onEnergyDailyResetHandler) {
      this.device.removeListener('energy:daily-reset', this.onEnergyDailyResetHandler);
    }
    if (this.onDiagnosticsReportHandler) {
      this.device.removeListener('diagnostics:capability-report', this.onDiagnosticsReportHandler);
    }

    // Store handler references BEFORE registering to enable proper cleanup (v2.0.1 memory leak fix)
    // Capability health events -> Flow card updates
    this.onHealthDegradedHandler = ({ capability, healthData }) => {
      this.logger('ServiceCoordinator: Capability health degraded', capability);
      this.flowCardManager.updateFlowCards().catch((error) => {
        this.logger('ServiceCoordinator: Error updating flow cards after health degraded', error);
      });
    };
    this.device.on('capability:health-degraded', this.onHealthDegradedHandler);

    this.onHealthRecoveredHandler = ({ capability, healthData }) => {
      this.logger('ServiceCoordinator: Capability health recovered', capability);
      this.flowCardManager.updateFlowCards().catch((error) => {
        this.logger('ServiceCoordinator: Error updating flow cards after health recovered', error);
      });
    };
    this.device.on('capability:health-recovered', this.onHealthRecoveredHandler);

    this.onHealthReportHandler = (report) => {
      this.logger('ServiceCoordinator: Health report generated', (report as { overall?: unknown }).overall);
    };
    this.device.on('capability:health-report', this.onHealthReportHandler);

    // Energy tracking events
    this.onEnergyTotalResetHandler = () => {
      this.logger('ServiceCoordinator: External energy total reset');
    };
    this.device.on('energy:total-reset', this.onEnergyTotalResetHandler);

    this.onEnergyDailyResetHandler = () => {
      this.logger('ServiceCoordinator: External energy daily reset');
    };
    this.device.on('energy:daily-reset', this.onEnergyDailyResetHandler);

    // Diagnostics events
    this.onDiagnosticsReportHandler = (diagnostics) => {
      this.logger('ServiceCoordinator: Capability diagnostics report generated', diagnostics);
    };
    this.device.on('diagnostics:capability-report', this.onDiagnosticsReportHandler);

    this.logger('ServiceCoordinator: Inter-service event handlers configured (with cleanup refs)');
  }

  /**
   * Initialize services that require runtime configuration (e.g., Tuya connection).
   * Returns an object describing which services failed to initialize.
   * @param tuyaConfig - Tuya device connection parameters
   */
  async initialize(tuyaConfig: TuyaDeviceConfig): Promise<ServiceInitializationResult> {
    this.logger('ServiceCoordinator: Starting service initialization sequence');

    const result: ServiceInitializationResult = {
      success: true,
      failedServices: [],
      errors: [],
    };

    try {
      // Start capability health monitoring first
      this.capabilityHealth.start();
      this.logger('ServiceCoordinator: Capability health service started');

      // Initialize energy tracking
      await this.energyTracking.initialize();
      this.logger('ServiceCoordinator: Energy tracking service initialized');

      // Initialize flow card manager
      await this.flowCardManager.initialize();
      this.logger('ServiceCoordinator: Flow card manager initialized');

      // Initialize adaptive control service
      await this.adaptiveControl.initialize();
      this.logger('ServiceCoordinator: Adaptive control service initialized');

      // Wire EnergyPriceOptimizer to EnergyTrackingService for cost accumulation
      const energyOptimizer = this.adaptiveControl.getEnergyOptimizer();
      this.energyTracking.setEnergyPriceOptimizer(energyOptimizer);
      this.logger('ServiceCoordinator: EnergyPriceOptimizer injected into EnergyTrackingService');

      // Initialize heating curve visualization service (v2.3.7)
      await this.heatingCurveVisualization.initialize();
      this.logger('ServiceCoordinator: Heating curve visualization service initialized');

      // Initialize building insights service (v2.5.0 - requires building model to be ready)
      await this.buildingInsights.initialize();
      this.logger('ServiceCoordinator: Building insights service initialized');

      // Initialize Tuya connection last (most likely to fail)
      try {
        await this.tuyaConnection.initialize(tuyaConfig);
        this.serviceHealth.set('tuya', true);
        this.logger('ServiceCoordinator: Tuya connection service initialized successfully');
      } catch (error) {
        this.logger('ServiceCoordinator: Tuya connection failed during initialization', error);
        result.failedServices.push('tuya');
        result.errors.push(error as Error);
        this.serviceHealth.set('tuya', false);
        // Don't fail the entire initialization for Tuya connection issues
      }

      // Start periodic health monitoring
      this.startServiceHealthMonitoring();

      this.isInitialized = true;
      this.logger('ServiceCoordinator: Service initialization sequence completed', {
        success: result.success,
        failedServices: result.failedServices.length,
      });

    } catch (error) {
      this.logger('ServiceCoordinator: Critical error during service initialization', error);
      result.success = false;
      result.errors.push(error as Error);
    }

    return result;
  }

  /**
   * Start periodic service health monitoring loop (runs every minute).
   */
  private startServiceHealthMonitoring(): void {
    this.healthCheckInterval = this.device.homey.setInterval(() => {
      this.performServiceHealthCheck();
    }, 60000); // Check every minute

    this.logger('ServiceCoordinator: Service health monitoring started');
  }

  /**
   * Run a single service health pass and emit events if overall health changes.
   */
  private performServiceHealthCheck(): void {
    const previousHealth = new Map(this.serviceHealth);

    // Update Tuya connection health
    const tuyaHealthy = this.tuyaConnection.isDeviceConnected();
    this.serviceHealth.set('tuya', tuyaHealthy);

    // Check if any service health changed
    let healthChanged = false;
    for (const [service, healthy] of this.serviceHealth) {
      if (previousHealth.get(service) !== healthy) {
        healthChanged = true;
        this.logger(`ServiceCoordinator: Service ${service} health changed to ${healthy ? 'healthy' : 'unhealthy'}`);
      }
    }

    if (healthChanged) {
      this.device.emit('service:health-changed', {
        health: Object.fromEntries(this.serviceHealth),
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Tuya data handler invoked by TuyaConnectionService.
   * Forwards DPS data to device for capability updates, updates capability health,
   * and triggers energy tracking updates.
   * @param data - object containing `dps: Record<number, unknown>`
   */
  private handleTuyaData(data: { dps: Record<number, unknown> }): void {
    // Validate dps parameter exists (v0.99.63 - crash fix, defense layer 2.5)
    if (!data.dps || typeof data.dps !== 'object') {
      this.logger('ServiceCoordinator: handleTuyaData received invalid dps, skipping processing', { dps: data.dps });
      return;
    }

    // Diagnostic logging (v1.3.13 - trigger debugging)
    this.logger('ServiceCoordinator: handleTuyaData called with DPS keys:', Object.keys(data.dps));

    // Forward DPS data to device for capability updates
    const updateFn = (this.device as unknown as { updateCapabilitiesFromDps?: (dps: Record<string, unknown>) => void }).updateCapabilitiesFromDps;
    if (typeof updateFn === 'function') {
      this.logger('ServiceCoordinator: Calling device.updateCapabilitiesFromDps()');
      updateFn.call(this.device, data.dps);
    } else {
      this.logger('ServiceCoordinator: WARNING - device.updateCapabilitiesFromDps not found or not a function', {
        deviceExists: !!this.device,
        updateFnType: typeof updateFn,
      });
    }

    // Update capability health for each DPS value
    Object.entries(data.dps).forEach(([dpsId, value]) => {
      const id = Number(dpsId);
      if (Number.isNaN(id)) return;
      const capability = this.mapDpsToCapability(id);
      if (capability) {
        this.capabilityHealth.updateCapabilityHealth(capability, value);
      }
    });

    // Update energy tracking with new power data
    this.energyTracking.updateIntelligentPowerMeasurement().catch((error) => {
      this.logger('ServiceCoordinator: Error updating intelligent power measurement', error);
    });
  }

  /**
   * Tuya connection lifecycle handlers (connected).
   */
  private handleTuyaConnected(): void {
    this.logger('ServiceCoordinator: Tuya device connected');
    this.serviceHealth.set('tuya', true);
  }

  /**
   * Tuya connection lifecycle handlers (disconnected).
   */
  private handleTuyaDisconnected(): void {
    this.logger('ServiceCoordinator: Tuya device disconnected');
    this.serviceHealth.set('tuya', false);
  }

  /**
   * Tuya error handler that may mark tuya service unhealthy and log details.
   */
  private handleTuyaError(error: CategorizedError): void {
    this.logger('ServiceCoordinator: Tuya error received', error.userMessage);

    // Mark Tuya service as unhealthy for non-recoverable errors
    if (!error.recoverable) {
      this.serviceHealth.set('tuya', false);
    }
  }

  /**
   * Getters for individual services so callers can interact with them.
   */
  getSettingsManager(): SettingsManagerService {
    return this.settingsManager;
  }

  getCapabilityHealth(): CapabilityHealthService {
    return this.capabilityHealth;
  }

  getEnergyTracking(): EnergyTrackingService {
    return this.energyTracking;
  }

  getTuyaConnection(): TuyaConnectionService {
    return this.tuyaConnection;
  }

  getFlowCardManager(): FlowCardManagerService {
    return this.flowCardManager;
  }

  getAdaptiveControl(): AdaptiveControlService {
    return this.adaptiveControl;
  }

  getBuildingInsights(): BuildingInsightsService {
    return this.buildingInsights;
  }

  /**
   * Called when device settings change; delegates to SettingsManagerService and AdaptiveControlService.
   */
  async onSettings(oldSettings: Record<string, unknown>, newSettings: Record<string, unknown>, changedKeys: string[]): Promise<void> {
    // SettingsManager first (critical - handles power settings, flow card auto-management, etc.)
    await this.settingsManager.onSettings(oldSettings, newSettings, changedKeys);

    // EnergyTracking settings handler (v1.0.9 - handles energy tracking enable/disable)
    if (this.energyTracking) {
      await this.energyTracking.onSettings(oldSettings, newSettings, changedKeys);
    }

    // AdaptiveControl second (optional feature - graceful degradation if it fails)
    try {
      await this.adaptiveControl.onSettings(oldSettings, newSettings, changedKeys);
    } catch (error) {
      this.logger('ServiceCoordinator: AdaptiveControl settings update failed (non-critical)', error);
      // Don't throw - allow settings save to succeed even if adaptive control fails
      // User's other settings changes are preserved, adaptive control degrades gracefully
    }

    // BuildingInsights third (optional feature - graceful degradation if it fails)
    try {
      await this.buildingInsights.onSettingsChanged(newSettings);
    } catch (error) {
      this.logger('ServiceCoordinator: BuildingInsights settings update failed (non-critical)', error);
      // Don't throw - allow settings save to succeed even if insights fail
    }
  }

  /**
   * Rebuild/refresh flow cards (delegates to FlowCardManagerService).
   */
  async updateFlowCards(): Promise<void> {
    const capabilitiesWithData = await this.capabilityHealth.detectCapabilitiesWithData();
    return this.flowCardManager.updateFlowCards(capabilitiesWithData);
  }

  /**
   * Force reconnection for the Tuya service (useful for manual troubleshooting).
   */
  async forceReconnection(): Promise<void> {
    this.logger('ServiceCoordinator: Forcing Tuya reconnection');
    try {
      await this.tuyaConnection.forceReconnect();
      this.serviceHealth.set('tuya', true);
    } catch (error) {
      this.logger('ServiceCoordinator: Force reconnection failed', error);
      this.serviceHealth.set('tuya', false);
      throw error;
    }
  }

  /**
   * Receive external data integration methods - delegate to energy tracking.
   */
  async receiveExternalPowerData(powerValue: number): Promise<void> {
    return this.energyTracking.receiveExternalPowerData(powerValue);
  }

  /**
   * Return the last-known health map for services.
   */
  getServiceHealth(): Record<string, boolean> {
    return Object.fromEntries(this.serviceHealth);
  }

  /**
   * Return a combined diagnostics snapshot including all services.
   */
  getServiceDiagnostics(): Record<string, unknown> {
    return {
      coordinator: {
        initialized: this.isInitialized,
        serviceHealth: Object.fromEntries(this.serviceHealth),
        healthMonitoringActive: !!this.healthCheckInterval,
      },
      tuya: this.tuyaConnection.getDiagnostics(),
      capabilityHealth: this.capabilityHealth.generateDiagnosticsReport(),
    };
  }

  /**
   * Utility to map DPS id to capability id using AdlarMapping.
   */
  private mapDpsToCapability(dpsId: number): string | null {
    const { allArraysSwapped } = AdlarMapping;
    return allArraysSwapped[dpsId] || null;
  }

  /**
   * Destroy coordinator and all owned services; clear intervals.
   */
  async destroy(): Promise<void> {
    this.logger('ServiceCoordinator: Destroying service coordinator');

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Destroy all services
    try {
      this.settingsManager.destroy();
      this.capabilityHealth.destroy();
      this.energyTracking.destroy();
      this.tuyaConnection.destroy();
      this.flowCardManager.destroy();
      await this.adaptiveControl.destroy(); // Await to persist building model state
      await this.heatingCurveVisualization.destroy(); // Cleanup image resources (v2.3.7)
      await this.buildingInsights.destroy(); // Await to persist insights state (v2.5.0)
    } catch (error) {
      this.logger('ServiceCoordinator: Error during service cleanup', error);
    }

    // Remove event listeners to prevent memory leaks (v1.0.2)
    if (this.onHealthDegradedHandler) {
      this.device.removeListener('capability:health-degraded', this.onHealthDegradedHandler);
      this.onHealthDegradedHandler = undefined;
    }
    if (this.onHealthRecoveredHandler) {
      this.device.removeListener('capability:health-recovered', this.onHealthRecoveredHandler);
      this.onHealthRecoveredHandler = undefined;
    }
    if (this.onHealthReportHandler) {
      this.device.removeListener('capability:health-report', this.onHealthReportHandler);
      this.onHealthReportHandler = undefined;
    }
    if (this.onEnergyTotalResetHandler) {
      this.device.removeListener('energy:total-reset', this.onEnergyTotalResetHandler);
      this.onEnergyTotalResetHandler = undefined;
    }
    if (this.onEnergyDailyResetHandler) {
      this.device.removeListener('energy:daily-reset', this.onEnergyDailyResetHandler);
      this.onEnergyDailyResetHandler = undefined;
    }
    if (this.onDiagnosticsReportHandler) {
      this.device.removeListener('diagnostics:capability-report', this.onDiagnosticsReportHandler);
      this.onDiagnosticsReportHandler = undefined;
    }

    // Clear service health tracking
    this.serviceHealth.clear();
    this.isInitialized = false;

    this.logger('ServiceCoordinator: Service coordinator destroyed');
  }

  /**
   * Update heating curve visualization (v2.3.7)
   * Call this when heating curve parameters change
   */
  async updateHeatingCurveVisualization(): Promise<void> {
    if (this.heatingCurveVisualization) {
      await this.heatingCurveVisualization.updateVisualization();
    }
  }

  /**
   * Get heating curve image for capability assignment (v2.3.7)
   */
  getHeatingCurveImage(): Homey.Image | null {
    return this.heatingCurveVisualization?.getImage() || null;
  }
}
