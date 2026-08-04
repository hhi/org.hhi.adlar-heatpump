/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';
import { SettingsManagerService } from '../../shared/services/settings-manager-service';
import { CapabilityHealthService } from './capability-health-service';
import { EnergyTrackingService } from './energy-tracking-service';
import { ModbusConnectionService, ModbusConnectionConfig } from './modbus-connection-service';
import { FlowCardManagerService } from './flow-card-manager-service';
import { AdaptiveControlService } from './adaptive-control-service';
import { BuildingInsightsService } from './building-insights-service';
import { SnapshotTriggerService } from './snapshot-trigger-service';
import { Adlar2ModbusService, DataSnapshot } from '../protocol/adlar2-modbus-service';
import { TemperatureRegisterScale } from '../protocol/adlar-modbus-registers';
import { ModbusBlockError, RegisterChangeEntry, RegisterChangeLogMode } from '../protocol/modbus-tcp-service';
import { RollingCOPCalculator } from '../../shared/services/rolling-cop-calculator';

// ADR-042: Verbindingskwaliteit als expliciete runtime-state
export type ConnectionQuality = 'online' | 'degraded' | 'offline';

export interface ServiceCoordinatorOptions {
  device: Homey.Device;
  logger?: (message: string, ...args: unknown[]) => void;
  onSnapshot?: (snapshot: DataSnapshot) => void;
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
  private modbusConnection!: ModbusConnectionService;
  private flowCardManager!: FlowCardManagerService;
  private adaptiveControl!: AdaptiveControlService;
  private buildingInsights!: BuildingInsightsService;
  private snapshotTrigger!: SnapshotTriggerService;

  // Service state
  private serviceHealth = new Map<string, boolean>();
  private _lastDisconnectCountMs = 0;
  private _visibleConnectionConnected = true;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private _disconnectStatusTimer: NodeJS.Timeout | null = null;
  private _disconnectDailyResetTimer: NodeJS.Timeout | null = null;
  private _prevDefrosting = false;
  private _defrostStartedAt: number | null = null;

  // ADR-042: Connection quality state machine
  private _connectionQuality: ConnectionQuality = 'offline';
  private _lastSuccessfulFastPollAt: number | null = null;
  private _consecutiveFastPollFailures = 0;
  private _consecutiveSuperfastPollFailures = 0;
  private _consecutiveNonFastRequiredFailures = 0; // ADR-043
  private _structurallyUnsupportedFast = false; // ADR-043
  private _degradedSinceTimer: ReturnType<typeof setTimeout> | null = null; // ADR-043
  private static readonly DEGRADED_TO_OFFLINE_MS = 10 * 60 * 1000; // 10 minuten
  private _lastErrorContext: string | null = null;
  private _errorCountByContext = new Map<string, number>();
  private _latestSnapshot: DataSnapshot | null = null;

  // Dashboard snapshot callback (ADR-041a)
  private readonly onSnapshot?: (snapshot: DataSnapshot) => void;

  // Event handler references (prevent memory leaks)
  private onHealthDegradedHandler?: (data: { capability: string; healthData: unknown }) => void;
  private onHealthRecoveredHandler?: (data: { capability: string; healthData: unknown }) => void;
  private onHealthReportHandler?: (report: unknown) => void;
  private onEnergyTotalResetHandler?: () => void;
  private onEnergyDailyResetHandler?: () => void;
  private onExternalFlowHandler?: (lpm: number) => void;

  constructor(options: ServiceCoordinatorOptions) {
    this.device = options.device;
    this.logger = options.logger || (() => {});
    this.onSnapshot = options.onSnapshot;

    this._initializeServices();
    this._setupEventHandlers();
  }

  public getRollingCOPCalculator(): RollingCOPCalculator | null {
    const device = this.device as unknown as {
      getRollingCOPCalculator?: () => RollingCOPCalculator | null;
    };
    return device.getRollingCOPCalculator?.() ?? null;
  }

  private _initializeServices(): void {
    this.logger('ServiceCoordinator: Initializing services');

    const opts = { device: this.device, logger: this.logger };

    this.settingsManager = new SettingsManagerService(opts);
    this.capabilityHealth = new CapabilityHealthService(opts);
    this.energyTracking = new EnergyTrackingService(opts);

    this.adaptiveControl = new AdaptiveControlService({
      ...opts,
    });

    this.buildingInsights = new BuildingInsightsService({
      device: this.device,
      buildingModelService: this.adaptiveControl.getBuildingModelService(),
      adaptiveControlService: this.adaptiveControl,
      logger: this.logger,
    });

    this.flowCardManager = new FlowCardManagerService({
      ...opts,
      onExternalPowerData: this.energyTracking.receiveExternalPowerData.bind(this.energyTracking),
      onExternalPricesData: this.adaptiveControl.receiveExternalPricesData.bind(this.adaptiveControl),
      buildingInsightsService: this.buildingInsights,
      onModbusRead: (addr) => this.readRegister(addr),
      onModbusWrite: (addr, raw) => this.writeRaw(addr, raw, false),
      onSetDiyHeatingCurve: (k, b) => this.setDiyHeatingCurve(k, b),
    });

    this.snapshotTrigger = new SnapshotTriggerService();

    this.modbusConnection = new ModbusConnectionService({
      ...opts,
      createService: ({ config, timerProvider }) => new Adlar2ModbusService({
        transport: {
          host: config.host,
          port: config.port ?? 502,
          unitId: config.unitId ?? 1,
          timeoutMs: 10_000,
          batchDelayMs: 90,
          maxReconnects: 0,
        },
        timerProvider,
      }),
      onData: this._handleModbusData.bind(this),
      onConnected: this._handleConnected.bind(this),
      onDisconnected: this._handleDisconnected.bind(this),
      onError: this._handleError.bind(this),
      onPollGroupSucceeded: this._onPollGroupSucceeded.bind(this),
    });

    this.serviceHealth.set('settings', true);
    this.serviceHealth.set('capability', true);
    this.serviceHealth.set('energy', true);
    this.serviceHealth.set('modbus', false);
    this.serviceHealth.set('flowcard', true);
    this.serviceHealth.set('adaptive', false);

    this.energyTracking.setEnergyPriceOptimizer(this.adaptiveControl.getEnergyOptimizer());
    this.logger('ServiceCoordinator: Services created');
  }

  private _setupEventHandlers(): void {
    // Remove any previously registered handlers first
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

    this.onHealthDegradedHandler = () => {
      this.flowCardManager.updateFlowCards().catch((e) => {
        this.logger('ServiceCoordinator: updateFlowCards after health-degraded failed', e);
      });
    };
    this.device.on('capability:health-degraded', this.onHealthDegradedHandler);

    this.onHealthRecoveredHandler = () => {
      this.flowCardManager.updateFlowCards().catch((e) => {
        this.logger('ServiceCoordinator: updateFlowCards after health-recovered failed', e);
      });
    };
    this.device.on('capability:health-recovered', this.onHealthRecoveredHandler);

    this.onHealthReportHandler = (report) => {
      this.logger('ServiceCoordinator: Health report', (report as { overall?: unknown }).overall);
    };
    this.device.on('capability:health-report', this.onHealthReportHandler);

    this.onEnergyTotalResetHandler = () => {
      this.logger('ServiceCoordinator: Energy total reset');
    };
    this.device.on('energy:total-reset', this.onEnergyTotalResetHandler);

    this.onEnergyDailyResetHandler = () => {
      this.logger('ServiceCoordinator: Energy daily reset');
      this.energyTracking.resetDailyCost();
    };
    this.device.on('energy:daily-reset', this.onEnergyDailyResetHandler);

    if (this.onExternalFlowHandler) {
      this.device.removeListener('external-data:flow', this.onExternalFlowHandler);
    }
    this.onExternalFlowHandler = (lpm: number) => {
      this.modbusConnection.setExternalFlow(lpm);
    };
    this.device.on('external-data:flow', this.onExternalFlowHandler);
  }

  /**
   * Initialize runtime services and connect to the Modbus device.
   */
  async initialize(config: ModbusConnectionConfig): Promise<ServiceInitializationResult> {
    this.logger('ServiceCoordinator: Starting initialization');

    const result: ServiceInitializationResult = {
      success: true,
      failedServices: [],
      errors: [],
    };

    try {
      this.capabilityHealth.start();
      this.logger('ServiceCoordinator: CapabilityHealth started');

      await this.energyTracking.initialize();
      this.logger('ServiceCoordinator: EnergyTracking initialized');

      await this.flowCardManager.initialize();
      this.logger('ServiceCoordinator: FlowCardManager initialized');

      // Initialize AdaptiveControlService (non-critical — failure does not block device)
      try {
        await this.adaptiveControl.initialize();
        this.serviceHealth.set('adaptive', true);
        this.logger('ServiceCoordinator: AdaptiveControl initialized');
      } catch (err) {
        this.logger('ServiceCoordinator: AdaptiveControl init failed (non-critical)', err);
        result.failedServices.push('adaptive');
        result.errors.push(err as Error);
      }

      // Initialize BuildingInsightsService (non-critical — requires building model data)
      try {
        await this.buildingInsights.initialize();
        this.logger('ServiceCoordinator: BuildingInsights initialized');
      } catch (err) {
        this.logger('ServiceCoordinator: BuildingInsights init failed (non-critical)', err);
        result.failedServices.push('buildingInsights');
        result.errors.push(err as Error);
      }

      // Restore external input capabilities from store
      await this._restoreExternalInputs();
      this.logger('ServiceCoordinator: External inputs restored');

      // Connect Modbus last (most likely to fail transiently)
      try {
        await this.modbusConnection.connect(config);
        this.serviceHealth.set('modbus', true);
        this.logger('ServiceCoordinator: ModbusConnection initialized');
      } catch (err) {
        this.logger('ServiceCoordinator: Modbus connect failed (will retry)', err);
        result.failedServices.push('modbus');
        result.errors.push(err as Error);
        this.serviceHealth.set('modbus', false);
      }

      this._startHealthMonitoring();
      this.isInitialized = true;

      this.logger('ServiceCoordinator: Initialization complete', {
        failedServices: result.failedServices,
      });
    } catch (err) {
      this.logger('ServiceCoordinator: Critical initialization error', err);
      result.success = false;
      result.errors.push(err as Error);
    }

    return result;
  }

  private async _restoreExternalInputs(): Promise<void> {
    const TEMP_TTL_MS = 4 * 60 * 60 * 1000;

    // Outdoor temperature (TTL 4h)
    const outdoorTemp = await this.device.getStoreValue('external_outdoor_temp') as number | null;
    const outdoorTs = await this.device.getStoreValue('external_outdoor_temp_timestamp') as number | null;
    if (typeof outdoorTemp === 'number') {
      const age = outdoorTs ? Date.now() - outdoorTs : null;
      if (age === null || age <= TEMP_TTL_MS) {
        if (this.device.hasCapability('adlar_external_ambient')) {
          await this.device.setCapabilityValue('adlar_external_ambient', outdoorTemp);
        }
        this.logger(`ServiceCoordinator: Restored external outdoor temp: ${outdoorTemp}°C`);
      } else {
        this.logger(`ServiceCoordinator: External outdoor temp too old (${Math.round(age / 60000)}min) — skipped`);
      }
    }

    // Wind speed (no TTL — building model compensates for stale wind data)
    const windSpeed = await this.device.getStoreValue('external_wind_speed') as number | null;
    if (typeof windSpeed === 'number') {
      if (this.device.hasCapability('adlar_external_wind_speed')) {
        await this.device.setCapabilityValue('adlar_external_wind_speed', windSpeed);
      }
      this.logger(`ServiceCoordinator: Restored external wind speed: ${windSpeed} m/s`);
    }

    // Solar power (no TTL)
    const solarPower = await this.device.getStoreValue('external_solar_power') as number | null;
    if (typeof solarPower === 'number') {
      if (this.device.hasCapability('adlar_external_solar_power')) {
        await this.device.setCapabilityValue('adlar_external_solar_power', solarPower);
      }
      this.logger(`ServiceCoordinator: Restored external solar power: ${solarPower}W`);
    }

    // Solar radiation (no TTL)
    const solarRadiation = await this.device.getStoreValue('external_solar_radiation') as number | null;
    if (typeof solarRadiation === 'number') {
      if (this.device.hasCapability('adlar_external_solar_radiation')) {
        await this.device.setCapabilityValue('adlar_external_solar_radiation', solarRadiation);
      }
      this.logger(`ServiceCoordinator: Restored external solar radiation: ${solarRadiation} W/m²`);
    }
  }

  private _startHealthMonitoring(): void {
    this._scheduleDailyDisconnectReset();

    this.healthCheckInterval = this.device.homey.setInterval(() => {
      const modbusHealthy = this.modbusConnection.isDeviceConnected();
      const prev = this.serviceHealth.get('modbus');
      if (prev !== modbusHealthy) {
        this.serviceHealth.set('modbus', modbusHealthy);
        this.logger(`ServiceCoordinator: modbus health → ${modbusHealthy}`);
        this.device.emit('service:health-changed', {
          health: Object.fromEntries(this.serviceHealth),
          timestamp: Date.now(),
        });
      }
    }, 60_000);
  }

  private _scheduleDailyDisconnectReset(): void {
    if (this._disconnectDailyResetTimer) {
      this.device.homey.clearTimeout(this._disconnectDailyResetTimer);
    }
    const now = new Date();
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    this._disconnectDailyResetTimer = this.device.homey.setTimeout(() => {
      this._disconnectDailyResetTimer = null;
      if (this.device.hasCapability('adlar_daily_disconnect_count')) {
        this.device.setCapabilityValue('adlar_daily_disconnect_count', 0).catch(() => {});
        this.logger('ServiceCoordinator: Daily disconnect count reset at midnight');
      }
      this._scheduleDailyDisconnectReset();
    }, msUntilMidnight);
  }

  // ── Data handlers ──────────────────────────────────────────────────────────

  private _handleModbusData(snapshot: DataSnapshot): void {
    const sourcePollGroup = snapshot.sourcePollGroup ?? 'fast';

    // ADR-042/043: fast/superfast poll succes registreren
    if (sourcePollGroup === 'fast' || sourcePollGroup === 'superfast') {
      this._lastSuccessfulFastPollAt = Date.now();
      this._consecutiveFastPollFailures = 0;
      if (sourcePollGroup === 'superfast') {
        this._consecutiveSuperfastPollFailures = 0;
      }

      // ADR-043 Fase 3c: annuleer degraded-naar-offline timer bij succesvolle FAST poll
      if (this._degradedSinceTimer) {
        this.device.homey.clearTimeout(this._degradedSinceTimer);
        this._degradedSinceTimer = null;
      }

      // ADR-043 Fase 2c: reset structurele vlag als FAST nu wél slaagt
      if (this._structurallyUnsupportedFast) {
        this._structurallyUnsupportedFast = false;
        if (this._connectionQuality === 'online') {
          this.device.setAvailable().catch(() => {});
        }
      }

      // Een geldige fast/superfast snapshot bewijst dat Modbus weer antwoordt.
      // Herstel Homey beschikbaarheid vóór capability-writes, ook na poll-timeout offline.
      if (this._connectionQuality !== 'online' || !this._visibleConnectionConnected) {
        this._markPollRecoveredOnline();
      }
    }

    // Forward snapshot to device for capability updates
    const device = this.device as unknown as {
      applyModbusSnapshot?: (s: DataSnapshot) => void;
    };
    if (typeof device.applyModbusSnapshot === 'function') {
      device.applyModbusSnapshot(snapshot);
    }

    // Detect snapshot changes and fire flow card triggers
    const triggerDevice = this.device as unknown as {
      triggerFlowCard?: (cardId: string, tokens: Record<string, unknown>, state: Record<string, unknown>) => void;
    };
    if (typeof triggerDevice.triggerFlowCard === 'function') {
      this.snapshotTrigger.detect(snapshot, (cardId, tokens, state) => {
        triggerDevice.triggerFlowCard!(cardId, tokens, state);
      });
    }

    // Update capability health for key sensors
    this.capabilityHealth.updateCapabilityHealth('measure_temperature.outlet', snapshot.sensors.outletT7?.value);
    this.capabilityHealth.updateCapabilityHealth('measure_power', snapshot.power.inputPowerKw * 1000);
    this.capabilityHealth.updateCapabilityHealth('onoff', snapshot.control.on);

    // Update energy tracking
    this.energyTracking.updateIntelligentPowerMeasurement().catch((e) => {
      this.logger('ServiceCoordinator: EnergyTracking update failed', e);
    });

    // Detect defrost cycle end (true → false transition)
    const { defrosting } = snapshot.status;
    if (defrosting && !this._prevDefrosting) {
      this._defrostStartedAt = Date.now();
    } else if (!defrosting && this._prevDefrosting && this._defrostStartedAt !== null) {
      const durationSec = (Date.now() - this._defrostStartedAt) / 1000;
      const outdoorTemp = snapshot.sensors.ambientT1?.value ?? 0;
      this._defrostStartedAt = null;
      this.adaptiveControl.onDefrostComplete(outdoorTemp, durationSec).catch((e) => {
        this.logger('ServiceCoordinator: onDefrostComplete failed', e);
      });
    }
    this._prevDefrosting = defrosting;

    // ADR-042: diagnostics toevoegen aan snapshot voordat deze doorgegeven wordt
    snapshot.diagnostics = {
      connectionQuality: this._connectionQuality,
      consecutiveFastPollFailures: this._consecutiveFastPollFailures,
      consecutiveSuperfastPollFailures: this._consecutiveSuperfastPollFailures,
      lastSuccessfulFastPollAt: this._lastSuccessfulFastPollAt,
      lastErrorContext: this._lastErrorContext,
    };
    this._latestSnapshot = snapshot;

    // Forward naar dashboard (ADR-041a)
    this.onSnapshot?.(snapshot);
  }

  private _handleConnected(): void {
    this.logger('ServiceCoordinator: Modbus connected');
    this.serviceHealth.set('modbus', true);

    // Cancel pending disconnect status update if reconnected within the grace period
    if (this._disconnectStatusTimer) {
      this.device.homey.clearTimeout(this._disconnectStatusTimer);
      this._disconnectStatusTimer = null;
      this.logger('ServiceCoordinator: Disconnect status timer cancelled (reconnected in time)');
    }

    // TCP connect alleen is onvoldoende bewijs dat Modbus weer gezond is:
    // bridges/servers kunnen de socket accepteren terwijl register reads blijven hangen.
    // Homey-visible herstel gebeurt daarom pas bij een geldige Modbus snapshot.
    this._consecutiveFastPollFailures = 0;
    this._consecutiveSuperfastPollFailures = 0;
    this._consecutiveNonFastRequiredFailures = 0;
    this._errorCountByContext.clear();
  }

  private _handleDisconnected(reason: string): void {
    this.logger('ServiceCoordinator: Modbus disconnected:', reason);
    this.serviceHealth.set('modbus', false);
    // ADR-043: reset non-fast teller bij disconnect; _structurallyUnsupportedFast NIET resetten
    // (structureel unsupported blokken verdwijnen niet door een reconnect)
    this._consecutiveNonFastRequiredFailures = 0;
    // ADR-042: direct offline markeren (grace period bepaalt Homey-zichtbaarheid)
    this._setConnectionQuality('offline');
    this.energyTracking.setConnectionState(false).catch((e) => {
      this.logger('ServiceCoordinator: setConnectionState(false) failed', e);
    });

    // Only update visible status after 1 minute — short reconnects stay invisible
    if (this._disconnectStatusTimer) {
      this.device.homey.clearTimeout(this._disconnectStatusTimer);
    }
    this._disconnectStatusTimer = this.device.homey.setTimeout(() => {
      this._disconnectStatusTimer = null;
      this.logger('ServiceCoordinator: Disconnect grace period elapsed, updating status');
      const wasVisibleConnected = this._visibleConnectionConnected;
      this._setConnectionCapabilities(false, reason);
      if (wasVisibleConnected) {
        this._incrementDailyDisconnectCount();
      }
      // ADR-042: pas na grace period setUnavailable()
      this.device.setUnavailable('Modbus-verbinding verbroken').catch(() => {});
    }, 60_000);
  }

  private _setConnectionCapabilities(connected: boolean, reason: string | null): void {
    this._visibleConnectionConnected = connected;

    const now = new Date();
    const day = now.getDate();
    const month = now.toLocaleString('en-US', { month: 'short' });
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const timestamp = `${day}-${month} ${time}`;
    const status = connected ? `Connected: ${timestamp}` : `Disconnected: ${timestamp}${reason ? ` (${reason})` : ''}`;

    if (this.device.hasCapability('adlar_connection_active')) {
      this.device.setCapabilityValue('adlar_connection_active', connected).catch(() => {});
    }
    if (this.device.hasCapability('adlar_connection_status')) {
      this.device.setCapabilityValue('adlar_connection_status', status).catch(() => {});
    }
  }

  private _incrementDailyDisconnectCount(): void {
    if (!this.device.hasCapability('adlar_daily_disconnect_count')) return;

    const now = Date.now();
    if (now - this._lastDisconnectCountMs < 60_000) return;
    this._lastDisconnectCountMs = now;

    const current = (this.device.getCapabilityValue('adlar_daily_disconnect_count') as number | null) ?? 0;
    this.device.setCapabilityValue('adlar_daily_disconnect_count', current + 1).catch(() => {});
  }

  private _handleError(err: Error, context: string): void {
    this.logger(`ServiceCoordinator: Modbus error [${context}]:`, err.message);

    // ADR-042/043: fout-classificatie en failure counters
    this._lastErrorContext = context;
    const count = (this._errorCountByContext.get(context) ?? 0) + 1;
    this._errorCountByContext.set(context, count);

    // Niet-blok-fouten (socket, FC06, FC05) — legacy pad
    if (!(err instanceof ModbusBlockError)) {
      if (context.startsWith('poll:superfast')) {
        // Superfast is een bonusfunctie — fouten worden gelogd maar tellen niet mee voor verbindingskwaliteit
        this._consecutiveSuperfastPollFailures++;
        this.logger(`ServiceCoordinator: Superfast poll failure (no quality impact): ${this._consecutiveSuperfastPollFailures}`);
      } else if (context.startsWith('poll:fast') || context.startsWith('fc03')) {
        this._consecutiveFastPollFailures++;
        this.logger(`ServiceCoordinator: Fast poll failures: ${this._consecutiveFastPollFailures}`);
        this._evaluateConnectionQuality();
      }
      return;
    }

    const { code, groupName, optional } = err;

    // Optional failures raken quality niet
    if (optional) return;

    if (code === 'unsupported' && (groupName === 'fast' || groupName === 'superfast')) {
      // Structureel stil: FAST required blok bestaat niet op deze variant
      if (!this._structurallyUnsupportedFast) {
        this._structurallyUnsupportedFast = true;
        this.logger(`ServiceCoordinator: ${groupName.toUpperCase()} required block unsupported — device structurally silent`);
        this.device.setWarning(`${groupName.toUpperCase()} required block unsupported — no data`).catch(() => {});
      }
      return; // Geen quality-teller — geen verbindingsprobleem
    }

    if (code === 'unsupported') return; // Non-fast unsupported: geen quality-effect

    if (groupName === 'superfast') {
      // Superfast is een bonusfunctie — fouten worden gelogd maar tellen niet mee voor verbindingskwaliteit
      this._consecutiveSuperfastPollFailures++;
      this.logger(`ServiceCoordinator: Superfast poll failure (no quality impact): ${this._consecutiveSuperfastPollFailures}`);
    } else if (groupName === 'fast') {
      this._consecutiveFastPollFailures++;
      this.logger(`ServiceCoordinator: Fast poll failures: ${this._consecutiveFastPollFailures}`);
      this._evaluateConnectionQuality();
    } else {
      this._consecutiveNonFastRequiredFailures++;
      this.logger(`ServiceCoordinator: Non-fast required failures: ${this._consecutiveNonFastRequiredFailures}`);
      this._evaluateNonFastConnectionQuality();
    }
  }

  // ADR-042: evalueer of verbindingskwaliteit naar degraded moet
  private _evaluateConnectionQuality(): void {
    const FAST_DEGRADED_THRESHOLD = 5;
    const SUPERFAST_DEGRADED_THRESHOLD = 10;
    if (
      this._connectionQuality === 'online'
      && (this._consecutiveFastPollFailures >= FAST_DEGRADED_THRESHOLD
        || this._consecutiveSuperfastPollFailures >= SUPERFAST_DEGRADED_THRESHOLD)
    ) {
      this._setConnectionQuality('degraded');
    }
  }

  // ADR-043 Fase 1i: reset non-fast teller bij succesvolle non-fast poll
  private _onPollGroupSucceeded(groupName: string): void {
    if (groupName === 'fast' || groupName === 'superfast') return; // gebruiken data-event

    this._consecutiveNonFastRequiredFailures = 0;
    this.logger(`ServiceCoordinator: Poll group succeeded: ${groupName} — non-fast teller gereset`);

    if (this._connectionQuality === 'degraded'
        && this._consecutiveFastPollFailures === 0
        && this._consecutiveSuperfastPollFailures === 0) {
      this._setConnectionQuality('online');
    }
  }

  // ADR-043 Fase 2b: evalueer of non-fast failures kwaliteit degraderen
  private _evaluateNonFastConnectionQuality(): void {
    const NON_FAST_DEGRADED_THRESHOLD = 6;
    if (
      this._connectionQuality === 'online'
      && this._consecutiveNonFastRequiredFailures >= NON_FAST_DEGRADED_THRESHOLD
    ) {
      this._setConnectionQuality('degraded');
    }
  }

  // ADR-042/043: stel verbindingskwaliteit in en koppel aan Homey-status
  private _setConnectionQuality(quality: ConnectionQuality): void {
    if (this._connectionQuality === quality) return;
    this.logger(`ServiceCoordinator: Connection quality: ${this._connectionQuality} → ${quality}`);
    this._connectionQuality = quality;

    // ADR-043 Fase 3b: start/annuleer degraded-naar-offline timer
    if (quality === 'degraded') {
      if (!this._degradedSinceTimer) {
        this._degradedSinceTimer = this.device.homey.setTimeout(() => {
          this._degradedSinceTimer = null;
          this.logger('ServiceCoordinator: Degraded timeout — setting offline');
          this._setConnectionQuality('offline');
          this._markPollTimeoutOffline();
        }, ServiceCoordinator.DEGRADED_TO_OFFLINE_MS);
      }
    } else if (this._degradedSinceTimer) {
      this.device.homey.clearTimeout(this._degradedSinceTimer);
      this._degradedSinceTimer = null;
    }

    if (quality === 'online') {
      // ADR-043 Fase 2d: structurele warning heeft hogere prioriteit dan schone online-status
      if (this._structurallyUnsupportedFast) {
        this.device
          .setWarning('FAST required block unsupported — no data')
          .catch(() => {});
      } else {
        this.device.setAvailable().catch(() => {});
        this.device.setWarning(null).catch(() => {});
      }
    } else if (quality === 'degraded') {
      this.device
        .setWarning('Gedeeltelijke Modbus-communicatiefout — data kan verouderd zijn')
        .catch(() => {});
    }
    // 'offline' wordt via de bestaande _disconnectStatusTimer afgehandeld,
    // behalve bij poll-timeout zonder socket-disconnect.
  }

  private _markPollTimeoutOffline(): void {
    const wasVisiblyConnected = this._visibleConnectionConnected;
    this._setConnectionCapabilities(false, 'poll timeout');
    if (wasVisiblyConnected) {
      this._incrementDailyDisconnectCount();
    }
    this.device
      .setUnavailable('Modbus reageert niet op polling')
      .catch(() => {});
    this.modbusConnection.forceReconnect('poll timeout').catch((err) => {
      this.logger('ServiceCoordinator: Force reconnect after poll timeout failed', err);
    });
  }

  private _markPollRecoveredOnline(): void {
    this._consecutiveFastPollFailures = 0;
    this._consecutiveSuperfastPollFailures = 0;
    this._consecutiveNonFastRequiredFailures = 0;
    this._errorCountByContext.clear();

    this._setConnectionQuality('online');

    if (!this._visibleConnectionConnected) {
      this._setConnectionCapabilities(true, null);
    }

    if (!this._structurallyUnsupportedFast) {
      this.device.setAvailable().catch(() => {});
      this.device.setWarning(null).catch(() => {});
    }

    this.energyTracking.setConnectionState(true).catch((e) => {
      this.logger('ServiceCoordinator: setConnectionState(true) after poll recovery failed', e);
    });
    this.adaptiveControl.onConnectionRestored();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async onSettings(
    oldSettings: Record<string, unknown>,
    newSettings: Record<string, unknown>,
    changedKeys: string[],
  ): Promise<void> {
    await this.settingsManager.onSettings(oldSettings, newSettings, changedKeys);
    if (this.energyTracking) {
      await this.energyTracking.onSettings(oldSettings, newSettings, changedKeys);
    }
    if (this.adaptiveControl) {
      await this.adaptiveControl.onSettings(oldSettings, newSettings, changedKeys);
    }
    if (this.buildingInsights) {
      await this.buildingInsights.onSettingsChanged(newSettings).catch((error) => {
        this.logger('ServiceCoordinator: BuildingInsights settings update failed (non-critical)', error);
      });
    }
  }

  getAdaptiveControl(): AdaptiveControlService {
    return this.adaptiveControl;
  }

  getEnergyTracking(): EnergyTrackingService {
    return this.energyTracking;
  }

  async updateFlowCards(): Promise<void> {
    const capabilitiesWithData = await this.capabilityHealth.detectCapabilitiesWithData();
    return this.flowCardManager.updateFlowCards(capabilitiesWithData);
  }

  async setTemperature(type: 'heating' | 'cooling' | 'dhw' | 'floor' | 'indoor', value: number): Promise<void> {
    return this.modbusConnection.setTemperature(type, value);
  }

  async setMainSwitch(value: boolean): Promise<void> {
    return this.modbusConnection.setMainSwitch(value);
  }

  async setMode(mode: number): Promise<void> {
    return this.modbusConnection.setMode(mode);
  }

  async setHeatingCurve(curve: number): Promise<void> {
    return this.modbusConnection.setHeatingCurve(curve);
  }

  async setHotWaterCurve(curve: number): Promise<void> {
    return this.modbusConnection.setHotWaterCurve(curve);
  }

  async setCoolingCurve(curve: number): Promise<void> {
    return this.modbusConnection.setCoolingCurve(curve);
  }

  async setFloorHeatingCurve(curve: number): Promise<void> {
    return this.modbusConnection.setFloorHeatingCurve(curve);
  }

  async setDiyHeatingCurve(k: number, b: number): Promise<void> {
    return this.modbusConnection.setDiyHeatingCurve(k, b);
  }

  async setUserMode(mode: 0 | 1 | 2): Promise<void> {
    return this.modbusConnection.setUserMode(mode);
  }

  isConnected(): boolean {
    return this.modbusConnection.isDeviceConnected();
  }

  getTemperatureScale(): TemperatureRegisterScale {
    return this.modbusConnection.getTemperatureScale();
  }

  getCurrentSnapshot(): DataSnapshot | null {
    return this._latestSnapshot;
  }

  getChangeLog(mode?: RegisterChangeLogMode): Map<number, RegisterChangeEntry> {
    return this.modbusConnection.getChangeLog(mode);
  }

  getRegisterCache(): Map<number, number> {
    return this.modbusConnection.getRegisterCache();
  }

  /** FC03 — lees één holding register; retourneert de ruwe unsigned waarde. */
  async readRegister(addr: number): Promise<number> {
    return this.modbusConnection.readRegister(addr);
  }

  /** FC01 — lees één coil; retourneert 1 (aan) of 0 (uit). */
  async readCoil(addr: number): Promise<number> {
    return this.modbusConnection.readCoil(addr);
  }

  /** FC06 of FC05 — schrijf één register of coil met de ruwe waarde. */
  async writeRaw(addr: number, rawValue: number, isCoil: boolean): Promise<void> {
    return this.modbusConnection.writeRaw(addr, rawValue, isCoil);
  }

  getServiceHealth(): Record<string, boolean> {
    return Object.fromEntries(this.serviceHealth);
  }

  getServiceDiagnostics(): Record<string, unknown> {
    return {
      coordinator: {
        initialized: this.isInitialized,
        serviceHealth: Object.fromEntries(this.serviceHealth),
      },
      modbus: this.modbusConnection.getDiagnostics(),
      capabilityHealth: this.capabilityHealth.generateDiagnosticsReport(),
    };
  }

  // ── Destroy ────────────────────────────────────────────────────────────────

  async destroy(): Promise<void> {
    this.logger('ServiceCoordinator: Destroying');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this._disconnectStatusTimer) {
      this.device.homey.clearTimeout(this._disconnectStatusTimer);
      this._disconnectStatusTimer = null;
    }

    if (this._disconnectDailyResetTimer) {
      this.device.homey.clearTimeout(this._disconnectDailyResetTimer);
      this._disconnectDailyResetTimer = null;
    }

    if (this._degradedSinceTimer) {
      this.device.homey.clearTimeout(this._degradedSinceTimer);
      this._degradedSinceTimer = null;
    }

    try {
      this.settingsManager.destroy();
      this.capabilityHealth.destroy();
      this.energyTracking.destroy();
      this.flowCardManager.destroy();
      await this.buildingInsights.destroy();
      await this.adaptiveControl.saveEnergyOptimizerState().catch((e) => {
        this.logger('ServiceCoordinator: saveEnergyOptimizerState failed', e);
      });
      await this.adaptiveControl.destroy();
      await this.modbusConnection.destroy();
    } catch (err) {
      this.logger('ServiceCoordinator: Error during cleanup', err);
    }

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
    if (this.onExternalFlowHandler) {
      this.device.removeListener('external-data:flow', this.onExternalFlowHandler);
      this.onExternalFlowHandler = undefined;
    }

    this.serviceHealth.clear();
    this.isInitialized = false;
    this.logger('ServiceCoordinator: Destroyed');
  }
}
