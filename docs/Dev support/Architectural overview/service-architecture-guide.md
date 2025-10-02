# Service Architecture Guide (v0.99.40)

This comprehensive guide documents the service-oriented architecture implemented in the Adlar Heat Pump Homey app, providing patterns, best practices, and implementation details for working with the 8 specialized services managed by ServiceCoordinator.

## Table of Contents

- [Overview](#overview)
- [Service Catalog](#service-catalog)
- [ServiceCoordinator Pattern](#servicecoordinator-pattern)
- [Cross-Service Communication](#cross-service-communication)
- [Service Lifecycle Management](#service-lifecycle-management)
- [Adding New Services](#adding-new-services)
- [Service Testing](#service-testing)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

### Why Service-Oriented Architecture?

The Adlar Heat Pump app transitioned from a monolithic device class (v0.99.22 and earlier) to a service-oriented architecture (v0.99.23+) to address:

**Problems Solved**:

1. **Code Duplication**: Repeated patterns across device instances
2. **Testing Difficulty**: Monolithic class hard to unit test
3. **Maintenance Burden**: Changes required touching multiple locations
4. **Unclear Responsibilities**: Single class handling too many concerns
5. **Extension Challenges**: Adding features required modifying existing code

**Benefits Achieved**:

1. **Code Reusability**: Services centralize shared functionality
2. **Single Responsibility**: Each service handles one specific domain
3. **Testability**: Services can be unit tested independently
4. **Maintainability**: Changes isolated to relevant service
5. **Extensibility**: New services added without modifying existing ones
6. **Fallback Safety**: Graceful degradation when services unavailable

### Architecture Principles

1. **Separation of Concerns**: Each service handles one specific domain (connection, health, calculations, etc.)
2. **Event-Driven Communication**: Services communicate via events, avoiding tight coupling
3. **Centralized Coordination**: ServiceCoordinator manages initialization, lifecycle, and events
4. **Service Independence**: Services can function with degraded dependencies
5. **Consistent Patterns**: All services follow same initialization, lifecycle, and error handling patterns

---

## Service Catalog

### Infrastructure Services (5)

#### 1. TuyaConnectionService

**File**: `lib/services/tuya-connection-service.ts`

**Responsibility**: Device communication via TuyAPI library

**Key Features**:

- Manages TuyAPI connection lifecycle (connect, disconnect, reconnect)
- Automatic reconnection with configurable interval (20 seconds)
- Connection health monitoring and diagnostics
- Event-driven sensor data updates (DPS changes)
- Error categorization and recovery (via TuyaErrorCategorizer)

**Public Interface**:

```typescript
class TuyaConnectionService {
  async connect(deviceConfig): Promise<void>;
  async disconnect(): Promise<void>;
  async set(dps: number, value: any): Promise<void>;
  isConnected(): boolean;
  getConnectionHealth(): ConnectionHealth;
  on(event: 'data' | 'connected' | 'disconnected' | 'error', handler): void;
}
```

**Dependencies**: None (leaf service)

**Events Emitted**:

- `data` - DPS value changed (sensor update)
- `connected` - Connection established
- `disconnected` - Connection lost
- `error` - Connection or communication error

#### 2. CapabilityHealthService

**File**: `lib/services/capability-health-service.ts`

**Responsibility**: Real-time capability health tracking

**Key Features**:

- Tracks null value counts per capability (threshold: 10 consecutive nulls)
- Monitors data availability (timeout: 5 minutes without update)
- Classifies capabilities as healthy or unhealthy
- Provides diagnostic reports for troubleshooting
- Enables health-based flow card registration

**Public Interface**:

```typescript
class CapabilityHealthService {
  startMonitoring(): void;
  stopMonitoring(): void;
  getHealthyCapabilities(): string[];
  getCapabilitiesWithRecentData(): string[];
  isCapabilityHealthy(capability: string): boolean;
  generateDiagnosticReport(): string;
}
```

**Dependencies**: None (monitors device capabilities)

**Used By**: FlowCardManagerService (auto mode registration)

#### 3. FlowCardManagerService

**File**: `lib/services/flow-card-manager-service.ts`

**Responsibility**: Dynamic flow card registration and management

**Key Features**:

- Manages 64 flow cards across 8 categories
- Three-mode control per category (disabled/auto/enabled)
- Health-based auto-registration (queries CapabilityHealthService)
- User preference management via SettingsManagerService
- Dynamic registration on settings changes

**Public Interface**:

```typescript
class FlowCardManagerService {
  async registerFlowCards(settings): Promise<void>;
  async updateFlowCardRegistration(newSettings): Promise<void>;
  async shouldRegisterCategory(category, userSetting): Promise<boolean>;
  getRegisteredCategories(): string[];
}
```

**Dependencies**:

- CapabilityHealthService (health status for auto mode)
- SettingsManagerService (user preferences)

**Flow Card Categories**:

1. `flow_temperature_alerts` (11 cards)
2. `flow_voltage_alerts` (3 cards)
3. `flow_current_alerts` (3 cards)
4. `flow_power_alerts` (3 cards)
5. `flow_pulse_steps_alerts` (2 cards)
6. `flow_state_alerts` (5 cards)
7. `flow_efficiency_alerts` (3 cards)
8. `flow_expert_mode` (3 cards)

#### 4. EnergyTrackingService

**File**: `lib/services/energy-tracking-service.ts`

**Responsibility**: External power measurement integration and validation

**Key Features**:

- Receives external data via flow cards (power, flow, ambient temperature)
- Validates data ranges and null checks
- Caches external data with timestamps (5-minute TTL)
- Provides fresh data to COPCalculator on request
- Manages power capability visibility

**Public Interface**:

```typescript
class EnergyTrackingService {
  receiveExternalPower(power: number): void;
  receiveExternalFlow(flow: number): void;
  receiveExternalAmbient(temperature: number): void;
  getExternalPower(): { value: number; timestamp: number } | null;
  hasRecentExternalData(dataType: string): boolean;
}
```

**Dependencies**: None (receives flow card data)

**Used By**: COPCalculator (external data for Method 1: Direct Thermal)

#### 5. SettingsManagerService

**File**: `lib/services/settings-manager-service.ts`

**Responsibility**: Settings validation, persistence, and race condition prevention

**Key Features**:

- Deferred settings updates pattern (prevents Homey race conditions)
- Validates settings before application
- Power settings auto-management cascade
- Seasonal data persistence (SCOP, rolling COP buffers)
- Single settings call consolidation

**Public Interface**:

```typescript
class SettingsManagerService {
  validateSettings(settings): { valid: boolean; errors: string[] };
  preparePowerSettingsUpdate(enablePower: boolean): object;
  applyDeferredSettings(settings): void;
  persistSeasonalData(data): Promise<void>;
  getStoredData(key: string): any;
}
```

**Dependencies**: None (manages device.setSettings)

**Used By**: All services (settings persistence), ServiceCoordinator (race prevention)

### Calculation Services (3)

#### 6. COPCalculator

**File**: `lib/services/cop-calculator.ts`

**Responsibility**: Real-time COP calculations with 8 methods

**Key Features**:

- Automatic method selection (±5% to ±30% accuracy range)
- 8 calculation methods with quality hierarchy
- Compressor operation validation (COP = 0 when idle)
- Diagnostic feedback ("No Power", "No Flow", "No Temp Δ", etc.)
- Outlier detection (< 0.5 or > 8.0 COP flagged)
- Confidence levels (high/medium/low)

**Public Interface**:

```typescript
class COPCalculator {
  startCalculations(): void;
  stopCalculations(): void;
  calculateCOP(): { value: number; method: string; confidence: string };
  on(event: 'cop-calculated', handler: (data: COPData) => void): void;
}
```

**Dependencies**:

- TuyaConnectionService (sensor data: temperatures, flow, frequencies)
- CapabilityHealthService (sensor validation)
- EnergyTrackingService (external power data for Method 1)

**Events Emitted**:

- `cop-calculated` - New COP value available (consumed by RollingCOPCalculator, SCOPCalculator)

**Calculation Methods** (Priority Order):

1. **Direct Thermal** (±5%) - External power meter + water flow
2. **Power Module Auto-Detection** (±8%) - Internal power calculation
3. **Power Estimation** (±10%) - Physics-based power modeling
4. **Refrigerant Circuit Analysis** (±12%) - Thermodynamic analysis
5. **Carnot Estimation** (±15%) - Theoretical efficiency
6. **Valve Position Correlation** (±20%) - Valve efficiency curves
7. **Temperature Difference** (±30%) - Basic fallback method

#### 7. RollingCOPCalculator

**File**: `lib/services/rolling-cop-calculator.ts`

**Responsibility**: Time-series COP analysis (daily/weekly/monthly)

**Key Features**:

- Circular buffer (1440 data points = 24h × 60min)
- Runtime-weighted averaging for accurate representation
- Trend detection (7 levels: strong improvement → significant decline)
- Idle period awareness (auto COP = 0 data points)
- Statistical outlier filtering (2.5 standard deviation threshold)
- Memory-efficient incremental updates (O(n) complexity)

**Public Interface**:

```typescript
class RollingCOPCalculator {
  async initialize(): Promise<void>;
  addDataPoint(data: COPDataPoint): void;
  getDailyCOP(): number | null;
  getWeeklyCOP(): number | null;
  getMonthlyCOP(): number | null;
  getTrend(): string;
  getDiagnosticInfo(): object;
}
```

**Dependencies**:

- COPCalculator (subscribes to `cop-calculated` events)
- CapabilityHealthService (validates data point quality)
- SettingsManagerService (persists circular buffer)

**Published Capabilities**:

- `adlar_cop_daily` - 24-hour rolling average
- `adlar_cop_weekly` - 7-day rolling average
- `adlar_cop_monthly` - 30-day rolling average
- `adlar_cop_trend` - Text description (7 levels)

#### 8. SCOPCalculator

**File**: `lib/services/scop-calculator.ts`

**Responsibility**: Seasonal efficiency per EN 14825 European standard

**Key Features**:

- Temperature bin method (6 bins: -10°C to +20°C)
- Quality-weighted averaging (direct thermal = 100%, temp difference = 60%)
- Seasonal coverage tracking (Oct 1 - May 15, 228 days)
- Method contribution analysis (% per calculation method)
- Confidence levels (high/medium/low based on coverage and quality)

**Public Interface**:

```typescript
class SCOPCalculator {
  async initialize(): Promise<void>;
  processCOPData(data: COPData): void;
  getSCOP(): number | null;
  getQualityScore(): string;
  getSeasonalCoverage(): number;
  getMethodContribution(): object;
}
```

**Dependencies**:

- COPCalculator (subscribes to `cop-calculated` events)
- SettingsManagerService (persists seasonal data)

**Published Capabilities**:

- `adlar_scop` - Seasonal COP average (2.0-6.0)
- `adlar_scop_quality` - Data quality indicator

---

## ServiceCoordinator Pattern

### Responsibilities

**ServiceCoordinator** (`lib/services/service-coordinator.ts`) is the single point of control for all services:

1. **Initialization**: Creates and initializes all 8 services in dependency order
2. **Lifecycle Management**: Coordinates startup, settings changes, and shutdown
3. **Event Wiring**: Connects service events (e.g., `cop-calculated` → RollingCOPCalculator)
4. **Service Access**: Provides getters for device class to access services
5. **Health Monitoring**: Tracks service health and diagnostics

### Implementation

```typescript
export class ServiceCoordinator {
  private device: Device;
  private logger: any;

  // Infrastructure services
  private tuyaConnection: TuyaConnectionService | null = null;
  private capabilityHealth: CapabilityHealthService | null = null;
  private flowCardManager: FlowCardManagerService | null = null;
  private energyTracking: EnergyTrackingService | null = null;
  private settingsManager: SettingsManagerService | null = null;

  // Calculation services
  private copCalculator: COPCalculator | null = null;
  private rollingCOPCalculator: RollingCOPCalculator | null = null;
  private scopCalculator: SCOPCalculator | null = null;

  constructor(device: Device, logger: any) {
    this.device = device;
    this.logger = logger;
  }

  /**
   * Initialize all services in dependency order
   */
  async initialize(config: ServiceConfig): Promise<void> {
    try {
      // Initialize infrastructure services (no dependencies)
      this.tuyaConnection = new TuyaConnectionService(this.device, this.logger, config);
      this.capabilityHealth = new CapabilityHealthService(this.device, this.logger);
      this.settingsManager = new SettingsManagerService(this.device, this.logger);
      this.energyTracking = new EnergyTrackingService(this.device, this.logger);

      // Initialize calculation services (depend on infrastructure)
      this.copCalculator = new COPCalculator(this.device, this.logger, this);
      this.rollingCOPCalculator = new RollingCOPCalculator(this.device, this.logger, this);
      this.scopCalculator = new SCOPCalculator(this.device, this.logger, this);

      // Initialize flow card manager (depends on health service)
      this.flowCardManager = new FlowCardManagerService(this.device, this.logger, this);

      // Connect services
      await this.tuyaConnection.connect(config.deviceConfig);
      this.capabilityHealth.startMonitoring();
      await this.copCalculator.startCalculations();
      await this.flowCardManager.registerFlowCards(config.settings);

      // Wire cross-service events
      this.wireServiceEvents();

      this.logger.log('[ServiceCoordinator] All services initialized successfully');
    } catch (error) {
      this.logger.error('[ServiceCoordinator] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Wire cross-service event communication
   */
  private wireServiceEvents(): void {
    // COPCalculator → RollingCOPCalculator (data collection)
    this.copCalculator?.on('cop-calculated', (data) => {
      this.rollingCOPCalculator?.addDataPoint(data);
      this.scopCalculator?.processCOPData(data);
    });

    // TuyaConnectionService → Device (capability updates)
    this.tuyaConnection?.on('data', async (dps) => {
      await this.device.handleDPSUpdate(dps);
    });

    // TuyaConnectionService → Connection state
    this.tuyaConnection?.on('connected', () => {
      this.logger.log('[ServiceCoordinator] Device connected');
    });

    this.tuyaConnection?.on('disconnected', () => {
      this.logger.log('[ServiceCoordinator] Device disconnected - attempting reconnect');
    });
  }

  /**
   * Handle device settings changes
   */
  async onSettings(oldSettings: any, newSettings: any, changedKeys: string[]): Promise<void> {
    try {
      // Power measurements toggle - coordinate across services
      if (changedKeys.includes('enable_power_measurements')) {
        const enablePower = newSettings.enable_power_measurements;

        // Prepare settings update via SettingsManagerService (race prevention)
        const settingsToUpdate = this.settingsManager?.preparePowerSettingsUpdate(enablePower);

        // Update flow card registration
        if (settingsToUpdate) {
          await this.flowCardManager?.updateFlowCardRegistration({
            ...newSettings,
            ...settingsToUpdate,
          });

          // Apply deferred settings
          this.settingsManager?.applyDeferredSettings(settingsToUpdate);
        }
      }

      // Flow card settings changed
      if (changedKeys.some((key) => key.startsWith('flow_'))) {
        await this.flowCardManager?.updateFlowCardRegistration(newSettings);
      }

      this.logger.log('[ServiceCoordinator] Settings updated successfully');
    } catch (error) {
      this.logger.error('[ServiceCoordinator] Settings update failed:', error);
      throw error;
    }
  }

  /**
   * Graceful shutdown of all services
   */
  destroy(): void {
    this.logger.log('[ServiceCoordinator] Shutting down services...');

    this.copCalculator?.stopCalculations();
    this.capabilityHealth?.stopMonitoring();
    this.tuyaConnection?.disconnect();

    // Clear service references
    this.copCalculator = null;
    this.rollingCOPCalculator = null;
    this.scopCalculator = null;
    this.flowCardManager = null;
    this.capabilityHealth = null;
    this.energyTracking = null;
    this.settingsManager = null;
    this.tuyaConnection = null;

    this.logger.log('[ServiceCoordinator] All services destroyed');
  }

  /**
   * Service getters (dependency injection for device class)
   */
  getTuyaConnection(): TuyaConnectionService | null {
    return this.tuyaConnection;
  }

  getCapabilityHealth(): CapabilityHealthService | null {
    return this.capabilityHealth;
  }

  getFlowCardManager(): FlowCardManagerService | null {
    return this.flowCardManager;
  }

  getEnergyTracking(): EnergyTrackingService | null {
    return this.energyTracking;
  }

  getSettingsManager(): SettingsManagerService | null {
    return this.settingsManager;
  }

  getCOPCalculator(): COPCalculator | null {
    return this.copCalculator;
  }

  getRollingCOPCalculator(): RollingCOPCalculator | null {
    return this.rollingCOPCalculator;
  }

  getSCOPCalculator(): SCOPCalculator | null {
    return this.scopCalculator;
  }

  /**
   * Get service health diagnostics
   */
  getServiceHealth(): ServiceHealthStatus {
    return {
      tuyaConnection: this.tuyaConnection?.isConnected() ?? false,
      capabilityHealth: this.capabilityHealth !== null,
      flowCardManager: this.flowCardManager !== null,
      energyTracking: this.energyTracking !== null,
      settingsManager: this.settingsManager !== null,
      copCalculator: this.copCalculator !== null,
      rollingCOPCalculator: this.rollingCOPCalculator !== null,
      scopCalculator: this.scopCalculator !== null,
    };
  }
}
```

---

## Cross-Service Communication

### Event-Driven Pattern

Services communicate via events to avoid tight coupling:

**Example**: COP Calculation Event Chain

```typescript
// 1. TuyaConnectionService receives sensor update
class TuyaConnectionService {
  private handleDPSUpdate(dps: object): void {
    this.emit('data', dps); // Emit to device
  }
}

// 2. Device updates capabilities, triggering COPCalculator
class Device {
  async handleDPSUpdate(dps: object): Promise<void> {
    await this.updateCapabilities(dps);

    // Trigger COP calculation on relevant sensor changes
    if (this.isCOPRelevantUpdate(dps)) {
      this.serviceCoordinator?.getCOPCalculator()?.calculateCOP();
    }
  }
}

// 3. COPCalculator calculates and emits event
class COPCalculator {
  calculateCOP(): void {
    const result = this.performCalculation();

    this.emit('cop-calculated', {
      timestamp: Date.now(),
      cop: result.value,
      method: result.method,
      confidence: result.confidence,
      compressorRuntime: this.getRuntime(),
    });
  }
}

// 4. RollingCOPCalculator subscribes to event
class RollingCOPCalculator {
  initialize(): void {
    this.serviceCoordinator
      .getCOPCalculator()
      .on('cop-calculated', (data) => {
        this.addDataPoint(data);
        this.updateRollingAverages();
      });
  }
}

// 5. SCOPCalculator also subscribes
class SCOPCalculator {
  initialize(): void {
    this.serviceCoordinator
      .getCOPCalculator()
      .on('cop-calculated', (data) => {
        this.processCOPData(data);
      });
  }
}
```

### Service Dependency Graph

```
┌───────────────────────────────────────────────────────────────┐
│                     ServiceCoordinator                        │
│                  (Manages 8 Services)                         │
└───────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
        ┌───────▼──────┐            ┌──────▼──────┐
        │ Infrastructure│            │ Calculation │
        │  Services (5) │            │ Services (3)│
        └───────┬──────┘            └──────┬──────┘
                │                           │
    ┌───────────┼───────────┬───────────────┼───────────┐
    │           │           │               │           │
┌───▼───┐   ┌──▼──┐    ┌──▼──┐        ┌───▼───┐   ┌──▼──┐
│ Tuya  │   │Cap. │    │Flow │        │  COP  │   │Roll │
│Connect│   │Health│   │Card │        │ Calc  │   │ COP │
└───┬───┘   └──┬──┘    │Mgr  │        └───┬───┘   └──┬──┘
    │          │        └──┬──┘            │          │
    │          │           │               │          │
    └──────────┼───────────┼───────────────┼──────────┘
               │           │               │
           ┌───▼───┐   ┌──▼──┐        ┌───▼───┐
           │Energy │   │Sett │        │ SCOP  │
           │Track  │   │Mgr  │        │ Calc  │
           └───────┘   └─────┘        └───────┘

Events Flow:
  TuyaConnect --data--> Device --> COPCalculator --cop-calculated--> RollingCOP
                                                                  └--> SCOP
  CapHealth --health--> FlowCardMgr
  EnergyTrack --power--> COPCalculator
```

---

## Service Lifecycle Management

### Initialization Sequence

1. **ServiceCoordinator** created in `device.onInit()`
2. **Infrastructure Services** initialized first (no dependencies)
3. **Calculation Services** initialized second (depend on infrastructure)
4. **FlowCardManager** initialized last (depends on CapabilityHealth)
5. **Cross-Service Events** wired after all services initialized
6. **TuyaConnection** connect called to establish device communication

### Settings Changes

1. User changes setting in Homey app
2. Homey calls `device.onSettings(oldSettings, newSettings, changedKeys)`
3. Device delegates to `serviceCoordinator.onSettings()`
4. ServiceCoordinator identifies affected services
5. **SettingsManagerService** prepares deferred updates (race prevention)
6. Affected services updated (e.g., FlowCardManager re-registers cards)
7. **SettingsManagerService** applies deferred settings after completion

### Device Shutdown

1. Device removed or app restarted
2. Device calls `this.serviceCoordinator.destroy()`
3. Services shut down in reverse order:
   - COPCalculator stops calculations
   - CapabilityHealth stops monitoring
   - TuyaConnection disconnects
4. Service references cleared (garbage collection)

---

## Adding New Services

### Step 1: Create Service File

**File**: `lib/services/my-new-service.ts`

```typescript
import Homey from 'homey';
import { Device } from '../device';
import { ServiceCoordinator } from './service-coordinator';

export class MyNewService extends Homey.SimpleClass {
  private device: Device;
  private logger: any;
  private serviceCoordinator: ServiceCoordinator | null;

  constructor(device: Device, logger: any, serviceCoordinator?: ServiceCoordinator) {
    super();
    this.device = device;
    this.logger = logger;
    this.serviceCoordinator = serviceCoordinator || null;
  }

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    this.logger.log('[MyNewService] Initializing...');

    // Service initialization logic here

    this.logger.log('[MyNewService] Initialized successfully');
  }

  /**
   * Graceful shutdown
   */
  destroy(): void {
    this.logger.log('[MyNewService] Shutting down...');

    // Cleanup logic here
  }

  /**
   * Public service methods
   */
  public doSomething(): void {
    // Implementation
  }
}
```

### Step 2: Add to ServiceCoordinator

```typescript
// Add private property
private myNewService: MyNewService | null = null;

// Initialize in initialize() method
this.myNewService = new MyNewService(this.device, this.logger, this);
await this.myNewService.initialize();

// Add getter
getMyNewService(): MyNewService | null {
  return this.myNewService;
}

// Clear in destroy() method
this.myNewService = null;
```

### Step 3: Wire Events (If Needed)

```typescript
// In wireServiceEvents() method
this.someService?.on('some-event', (data) => {
  this.myNewService?.handleEvent(data);
});
```

### Step 4: Update Device Class

```typescript
// Use service via ServiceCoordinator
class Device extends Homey.Device {
  someMethod(): void {
    this.serviceCoordinator?.getMyNewService()?.doSomething();
  }
}
```

---

## Service Testing

### Unit Testing Pattern

**File**: `test/services/my-new-service.test.ts`

```typescript
import { MyNewService } from '../../lib/services/my-new-service';

describe('MyNewService', () => {
  let service: MyNewService;
  let mockDevice: any;
  let mockLogger: any;
  let mockServiceCoordinator: any;

  beforeEach(() => {
    mockDevice = {
      // Mock device methods
    };

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
    };

    mockServiceCoordinator = {
      // Mock service coordinator methods
      getCapabilityHealth: jest.fn(),
    };

    service = new MyNewService(mockDevice, mockLogger, mockServiceCoordinator);
  });

  afterEach(() => {
    service.destroy();
  });

  describe('initialize', () => {
    it('should initialize service successfully', async () => {
      await service.initialize();

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Initialized successfully'),
      );
    });
  });

  describe('doSomething', () => {
    it('should perform action correctly', () => {
      // Test implementation
    });
  });
});
```

### Integration Testing

Test cross-service communication via ServiceCoordinator:

```typescript
describe('ServiceCoordinator Integration', () => {
  it('should wire COPCalculator to RollingCOPCalculator', async () => {
    const coordinator = new ServiceCoordinator(mockDevice, mockLogger);
    await coordinator.initialize(config);

    const copCalculator = coordinator.getCOPCalculator();
    const rollingCalculator = coordinator.getRollingCOPCalculator();

    // Trigger COP calculation
    copCalculator.calculateCOP();

    // Verify RollingCOPCalculator received event
    expect(rollingCalculator.getDataPoints().length).toBeGreaterThan(0);
  });
});
```

---

## Best Practices

### Service Design

1. **Single Responsibility**: Each service handles ONE domain (connection, health, calculations, etc.)
2. **Minimal Dependencies**: Services depend only on what they absolutely need
3. **Event-Driven**: Use events for cross-service communication, not direct method calls
4. **Null-Safe**: Always check service availability (`this.serviceCoordinator?.getService()`)
5. **Graceful Degradation**: Service unavailability shouldn't crash the app

### Error Handling

```typescript
// ✅ Good: Graceful degradation
const healthService = this.serviceCoordinator?.getCapabilityHealth();
if (healthService) {
  const healthyCapabilities = healthService.getHealthyCapabilities();
  // Use healthy capabilities
} else {
  // Fallback: assume all capabilities available
  this.logger.warn('[Service] CapabilityHealth unavailable - using fallback');
}

// ❌ Bad: Assumes service availability
const healthyCapabilities = this.serviceCoordinator
  .getCapabilityHealth() // Could be null!
  .getHealthyCapabilities();
```

### Constants Integration

Always use `DeviceConstants` instead of magic numbers:

```typescript
// ✅ Good: Use centralized constants
import { DeviceConstants } from '../constants';

setTimeout(() => {
  this.reconnect();
}, DeviceConstants.RECONNECTION_INTERVAL_MS);

// ❌ Bad: Magic numbers
setTimeout(() => {
  this.reconnect();
}, 20000); // What does 20000 mean?
```

### Service Communication

```typescript
// ✅ Good: Event-driven communication
this.copCalculator.on('cop-calculated', (data) => {
  this.rollingCOPCalculator.addDataPoint(data);
});

// ❌ Bad: Direct service calls (tight coupling)
class COPCalculator {
  calculateCOP(): void {
    const result = this.performCalculation();
    this.serviceCoordinator.getRollingCOPCalculator().addDataPoint(result); // Too coupled!
  }
}
```

---

## Troubleshooting

### Service Not Initialized

**Symptom**: `Cannot read property 'method' of null`

**Cause**: Accessing service before ServiceCoordinator initialization

**Solution**:

```typescript
// Always check service availability
const service = this.serviceCoordinator?.getMyService();
if (!service) {
  this.logger.warn('[Device] MyService not available');
  return;
}
service.method();
```

### Events Not Firing

**Symptom**: Cross-service events don't trigger subscribed handlers

**Causes**:

1. Event wiring not called in `wireServiceEvents()`
2. Service not initialized before wiring events
3. Event name mismatch

**Solution**:

```typescript
// Verify event wiring in ServiceCoordinator.wireServiceEvents()
private wireServiceEvents(): void {
  this.copCalculator?.on('cop-calculated', (data) => {
    this.logger.log('[ServiceCoordinator] COP event received:', data);
    this.rollingCOPCalculator?.addDataPoint(data);
  });
}
```

### Race Conditions in Settings

**Symptom**: "Cannot set Settings while this.onSettings is still pending"

**Cause**: Multiple `setSettings()` calls during `onSettings()` lifecycle

**Solution**: Use SettingsManagerService deferred update pattern:

```typescript
async onSettings(oldSettings, newSettings, changedKeys): Promise<void> {
  // Prepare deferred updates
  const settingsToUpdate = this.settingsManager?.preparePowerSettingsUpdate(
    newSettings.enable_power_measurements,
  );

  // Update services synchronously
  await this.updateServices(newSettings);

  // Apply deferred settings AFTER onSettings completes
  this.settingsManager?.applyDeferredSettings(settingsToUpdate);
}
```

### Service Memory Leaks

**Symptom**: Memory usage grows over time

**Causes**:

1. Event listeners not removed on destroy
2. Timers not cleared
3. Circular buffer not cleaned

**Solution**:

```typescript
class MyService {
  private timerId: NodeJS.Timeout | null = null;

  initialize(): void {
    this.timerId = setInterval(() => {
      this.doWork();
    }, 60000);

    this.someService.on('event', this.handleEvent);
  }

  destroy(): void {
    // Clear timers
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    // Remove event listeners
    this.someService.off('event', this.handleEvent);
  }
}
```

---

## Conclusion

The service-oriented architecture provides a robust, maintainable, and extensible foundation for the Adlar Heat Pump Homey app. By following the patterns and best practices outlined in this guide, you can:

- Add new services without modifying existing code
- Test services independently with clear contracts
- Maintain clear separation of concerns
- Achieve graceful degradation when services are unavailable
- Coordinate complex cross-service interactions via ServiceCoordinator

For more information on specific services, see:

- [Architecture Overview](architecture-overview.md) - High-level architecture summary
- [COP Calculation](../../COP-calculation.md) - COPCalculator service details
- [SCOP Calculation](../../SCOP-calculation.md) - SCOPCalculator service details
- [Rolling COP](../../rolling-cop-calculation.md) - RollingCOPCalculator service details
