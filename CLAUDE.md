# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build

```bash
npm run build
```

Compiles TypeScript to JavaScript in `.homeybuild/` directory.

### Validate

```bash
homey app validate
```

Validates the Homey app structure, manifest, and configuration. Use `-l debug` for detailed logging.

**Development Workflow:**

- Use `homey app validate -l debug` to check if you can test the app via `homey app run`
- Use `homey app validate` to verify the app is ready for publishing via `homey app publish`

### Lint

```bash
npm run lint
```

Runs ESLint on `.js` and `.ts` files using the Athom configuration.

### Coding and Formatting

All coding should be Typescript compliant
The code should adhere eslint rules (for example whitespacing)
For Markdown files adhere to markdownlint rules

#### Homey-Specific Best Practices

**Timer Management**:
- **ALWAYS** use `this.device.homey.setTimeout()` instead of global `setTimeout()`
- **ALWAYS** use `this.device.homey.setInterval()` instead of global `setInterval()`
- **WHY**: Homey's timer management provides automatic cleanup during app updates/restarts and prevents memory leaks
- **Pattern for Promise.race() with timeout**:
  ```typescript
  let timeoutHandle: NodeJS.Timeout | null = null;
  try {
    await Promise.race([
      asyncOperation(),
      new Promise((_, reject) => {
        timeoutHandle = this.device.homey.setTimeout(
          () => reject(new Error('Timeout')),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
  ```

**Type Safety**:
- **NEVER** use `as any` - it disables TypeScript's type checking entirely
- **PREFER** `@ts-expect-error` with explanatory comment when accessing library internals
- **Example**:
  ```typescript
  // ❌ BAD: No explanation, disables all type checking
  const socket = (this.tuya as any).client;

  // ✅ GOOD: Documented reason, TypeScript still validates rest of line
  // @ts-expect-error - Accessing TuyAPI internal socket for crash prevention
  const socket = this.tuya.client;
  ```

**Logging**:
- **NEVER** use `console.log()` - logs don't appear in Homey's app logs
- **ALWAYS** use Homey's logging system via logger callbacks or `this.log()`
- **Pattern for service classes without Homey.Device access**:
  ```typescript
  export interface ServiceConfig {
    // ... other config
    logger?: (message: string, ...args: unknown[]) => void;
  }

  export class MyService {
    private logger: (message: string, ...args: unknown[]) => void;

    constructor(config: ServiceConfig) {
      // Fallback to no-op if logger not provided
      this.logger = config.logger || (() => {});
    }

    someMethod(): void {
      this.logger('MyService: Something happened', { detail: 'value' });
    }
  }

  // In device.ts or other code with Homey access:
  new MyService({
    logger: (msg, ...args) => this.log(msg, ...args),
  });
  ```

### Debug Mode

Set `DEBUG=1` environment variable to enable debug features in the Homey app.

### Changelog Management

When updating `.homeychangelog.json`:

**Target Audience**: Regular end users (not developers)

**Writing Guidelines**:

- ✅ **State WHAT changed** - Be factual and direct
- ✅ **Include concrete examples** - Show before/after when relevant
  (e.g., "3-Oct 14:25" instead of "03-10 14:25")
- ❌ **Do NOT explain WHY** - Avoid phrases like "makes it more
  readable", "for cleaner interface", "for better user experience"
- ❌ **Do NOT explain HOW** - Skip technical details like
  "supports both languages", implementation details
- ❌ **Do NOT add marketing language** - No justifications or
  selling points

**Structure**: Keep entries concise (1-2 sentences maximum)

**Good Examples**:

```text
"Connection status now shows month abbreviations
(e.g., '3-Oct 14:25' instead of '03-10 14:25')."

"Device credentials can now be updated directly in settings."
```

**Bad Examples**:

```text
"Improved connection status display with month abbreviations.
Supports both English and Dutch.
Makes timestamps more readable at a glance."

"Simplified credential management for cleaner interface
and better user experience."
```

## Project Architecture

This is a Homey app for integrating Adlar heat pump devices via Tuya's local API. The architecture follows Homey's app development patterns with TypeScript and implements a **Service-Oriented Architecture (v0.99.23+)** for code organization, testability, and maintainability.

### Core Components

- **App Entry**: `app.ts` - Main Homey app class with debug mode support and global error handlers (v0.99.46)
- **Driver**: `drivers/intelligent-heat-pump/driver.ts` - Handles device discovery and pairing
- **Device**: `drivers/intelligent-heat-pump/device.ts` - Manages individual device instances, delegates to services
- **Service Coordinator**: `lib/services/service-coordinator.ts` - Manages lifecycle of all 8 services
- **Mappings**: `lib/definitions/adlar-mapping.ts` - Maps Tuya DPS (data points) to Homey capabilities
- **Constants**: `lib/constants.ts` - Centralized configuration constants and thresholds
- **Error Handling**: `lib/error-types.ts` - Comprehensive error categorization and recovery system

### Service-Oriented Architecture (v0.99.23+)

The app uses **8 specialized services** managed by ServiceCoordinator, eliminating code duplication and providing clear separation of concerns:

#### Infrastructure Services (5)

1. **TuyaConnectionService** (`lib/services/tuya-connection-service.ts`)
   - Device communication via TuyAPI
   - Automatic reconnection handling with crash-proof error recovery (v0.99.46)
   - Deep socket error interception (v0.99.49) - intercepts TuyAPI internal socket ECONNRESET errors after connection
   - Connection health monitoring
   - Real-time connection status tracking (v0.99.47) - 4 states: connected, disconnected, reconnecting, error
   - Connection timestamp persistence (v0.99.63+) - survives app updates and restarts
   - Event-driven sensor data updates
   - Auto device availability status sync (unavailable during outages, available on reconnect)
   - Synchronous event handlers (v0.99.67) - prevents async Promise blocking TuyAPI state machine
   - Unhandled promise rejection protection in async setTimeout callbacks
   - Idempotent error handler installation with listener cleanup (v0.99.49)
   - Heartbeat monitoring (v0.99.98) - proactive connection health checks every 5 minutes
   - Intelligent skip logic (v0.99.98) - avoids heartbeat when device active (recent data)
   - Zombie connection detection (v0.99.98) - automatic reconnect after 10 minutes without data
   - Stale connection force-reconnect (v0.99.98) - detects idle connections claiming to be active
   - Single-source connection truth (v0.99.99) - eliminates extended disconnection periods

2. **CapabilityHealthService** (`lib/services/capability-health-service.ts`)
   - Real-time capability health tracking
   - Null value detection and monitoring
   - Data availability validation
   - Health-based flow card registration

3. **FlowCardManagerService** (`lib/services/flow-card-manager-service.ts`)
   - Dynamic flow card registration (64 cards across 8 categories)
   - Health-based auto-registration
   - User preference management (disabled/auto/enabled modes)
   - Cross-service event handling

4. **EnergyTrackingService** (`lib/services/energy-tracking-service.ts`)
   - External power measurement integration
   - Energy consumption calculations
   - Power capability management
   - External device data validation

5. **SettingsManagerService** (`lib/services/settings-manager-service.ts`)
   - Race condition prevention (deferred updates pattern)
   - Settings validation and persistence
   - Power settings auto-management
   - Seasonal data storage

#### Calculation Services (3)

6. **COPCalculator** (`lib/services/cop-calculator.ts`)
   - Real-time COP calculations with 8 methods (±5% to ±30% accuracy)
   - Automatic method selection based on data availability
   - Compressor operation validation (COP = 0 when idle)
   - Diagnostic feedback ("No Power", "No Flow", etc.)
   - Outlier detection and confidence levels

7. **RollingCOPCalculator** (`lib/services/rolling-cop-calculator.ts`)
   - Time-series analysis (daily/weekly/monthly rolling averages)
   - Trend detection (7 levels: strong improvement → significant decline)
   - Runtime-weighted averaging
   - Idle period awareness
   - Circular buffer management (1440 data points)

8. **SCOPCalculator** (`lib/services/scop-calculator.ts`)
   - Seasonal COP per EN 14825 European standard
   - Temperature bin method (6 bins: -10°C to +20°C)
   - Quality-weighted averaging
   - Seasonal coverage tracking (Oct 1 - May 15)
   - Method contribution analysis

#### Service Coordinator

**ServiceCoordinator** (`lib/services/service-coordinator.ts`) manages initialization, lifecycle, and cross-service communication:

```typescript
class ServiceCoordinator {
  // Service getters
  getTuyaConnection(): TuyaConnectionService;
  getCapabilityHealth(): CapabilityHealthService;
  getFlowCardManager(): FlowCardManagerService;
  getEnergyTracking(): EnergyTrackingService;
  getSettingsManager(): SettingsManagerService;
  getCOPCalculator(): COPCalculator;
  getSCOPCalculator(): SCOPCalculator;
  getRollingCOPCalculator(): RollingCOPCalculator;

  // Unified lifecycle
  async initialize(config: ServiceConfig): Promise<void>;
  async onSettings(oldSettings, newSettings, changedKeys): Promise<void>;
  destroy(): void;
}
```

**Cross-Service Event Flow Example** (COP Calculation):

1. **TuyaConnectionService** receives sensor update (DPS change)
2. **COPCalculator** triggered with new sensor values
3. **CapabilityHealthService** validates sensor data quality
4. **COPCalculator** calculates COP and emits `cop-calculated` event
5. **RollingCOPCalculator** adds data point to circular buffer
6. **SCOPCalculator** processes for temperature bin classification
7. **SettingsManagerService** persists updated data
8. **Device** publishes to capabilities (`adlar_cop`, `adlar_cop_daily`, etc.)

**Service Architecture Benefits:**

- **Code Duplication Eliminated**: Shared functionality centralized in services
- **Single Responsibility**: Each service handles one specific domain
- **Testability**: Services can be unit tested independently
- **Maintainability**: Changes isolated to relevant service
- **Extensibility**: New services easily added without modifying existing code
- **Fallback Safety**: Graceful degradation when services unavailable

#### Memory Management & Leak Prevention (v1.0.1+)

**Critical**: All services with data accumulation MUST implement `destroy()` methods to prevent memory leaks.

**Memory Leak Fixes (v1.0.1)**:

1. **SCOPCalculator** (`lib/services/scop-calculator.ts`)
   - **Issue**: `dailyData` Map grew unbounded (kept 2 years of seasonal data)
   - **Impact**: ~20-30 MB memory leak over 8 hours
   - **Fix**: Added `destroy()` method to clear Map and reset season tracking

2. **RollingCOPCalculator** (`lib/services/rolling-cop-calculator.ts`)
   - **Issue**: `dataPoints` array kept 1440+ data points without cleanup
   - **Impact**: ~10-20 MB memory leak over 8 hours
   - **Fix**: Added `destroy()` method to clear circular buffer

3. **EnergyTrackingService** (`lib/services/energy-tracking-service.ts`)
   - **Issue**: Incomplete `destroy()` - timers not cleared
   - **Impact**: ~5-10 MB memory leak + continued timer execution
   - **Fix**: Enhanced `destroy()` to clear all intervals/timeouts

**Destroy() Method Pattern**:

```typescript
public destroy(): void {
  // Clear data structures
  this.dataPoints = [];
  this.dailyData.clear();

  // Clear timers
  if (this.interval) {
    clearInterval(this.interval);
    this.interval = null;
  }

  // Log for debugging
  this.log('Service destroyed - memory released');
}
```

**Device Cleanup** (`device.ts:onDeleted()`):
- ServiceCoordinator destroy() → cleans infrastructure services
- Calculator destroy() calls → cleans calculation services
- Prevents 45-65 MB memory leak over 8-hour runtime

**Memory-Connection Correlation**:
- Memory growth → Node.js garbage collection pauses
- GC pauses → socket timeouts (ECONNRESET errors)
- Proper cleanup prevents both memory leaks AND connection issues

#### Reconnection Resilience (v1.0.5+)

**Critical**: Extended internet outages must auto-recover without manual intervention.

**Problem (Pre-v1.0.5)**: Circuit breaker entered infinite loop during sustained outages:
- Failed 10x → 5min cooldown → reset counter → failed 10x → repeat forever
- Notification #15 unreachable (counter reset before reaching 15)
- Required manual `force_reconnect` after hours-long disconnection

**Solution (v1.0.5)**: 5 integrated improvements eliminate infinite loops and guarantee auto-recovery:

1. **Persistent Outage Tracking** (`lib/services/tuya-connection-service.ts:57-58`)
   - Tracks cumulative outage duration independent of circuit breaker resets
   - Enables time-based notifications and user-visible outage timer

2. **Circuit Breaker Cycle Limit** (`tuya-connection-service.ts:973-989`)
   - Maximum 3 cooldown cycles (15 minutes total)
   - After 3 cycles: switches to slow continuous retry (2.5 min interval)
   - Eliminates infinite loop, guarantees ongoing recovery attempts

3. **Internet Recovery Detection** (`tuya-connection-service.ts:947-960`)
   - DNS probe every 30s during cooldown
   - Immediate reconnection when internet restored (within 30s)
   - Avoids waiting full 5-minute cooldown period

4. **User-Visible Outage Timer** (`tuya-connection-service.ts:399-409`)
   - Connection status shows outage duration: `"Disconnected [12 min]"`
   - Circuit breaker countdown: `"Reconnecting [retry in 245s]"`
   - Provides transparency into reconnection process

5. **Time-Based Notifications** (`tuya-connection-service.ts:906-936`)
   - Notifications at fixed intervals: 2min, 10min, 30min
   - Independent of failure counter (not affected by circuit breaker resets)
   - Progressive escalation: info → warning → critical

**Recovery Timeline Example** (5-hour internet outage):
```
T+0:00   - Disconnect detected
T+2:00   - Notification "Connection Lost"
T+10:00  - Notification "Extended Outage"
T+15:00  - Max cycles → slow continuous retry (2.5 min)
T+30:00  - Notification "Critical Outage"
...continues retrying every 2.5 min...
T+5:00:15 - DNS probe detects internet recovery
T+5:00:20 - Auto-reconnected (no manual intervention)
```

**For detailed architecture**: See [Service Architecture Guide - v1.0.5 Reconnection Improvements](docs/Dev%20support/Architectural%20overview/service-architecture-guide.md#tuyaconnectionservice-v105-reconnection-improvements)

### Key Architecture Patterns

#### DPS to Capability Mapping (Enhanced v0.99.54+)

The app uses a centralized mapping system in `AdlarMapping` class:

- `capabilities` - Standard Homey capabilities (onoff, target_temperature, etc.)
- `customCapabilities` - Extended capabilities with dot notation (measure_temperature.temp_top)
- `adlarCapabilities` - Device-specific capabilities (adlar_hotwater, adlar_fault, etc.)
- `allArraysSwapped` - Reverse mapping from DPS ID to capability name (legacy single-capability)
- `dpsToCapabilities` - **NEW (v0.99.54+)** Multi-capability mapping for dual picker/sensor architecture

**Dual Picker/Sensor Architecture (v0.99.54+)**:

Some DPS now update multiple capabilities simultaneously for enhanced UX:
- **DPS 11** → `adlar_enum_capacity_set` (picker) + `adlar_sensor_capacity_set` (sensor)
- **DPS 13** → `adlar_enum_countdown_set` (sensor) + `adlar_picker_countdown_set` (picker)

This enables:
- Always-visible read-only status display via sensor capabilities
- Optional user-controllable pickers (toggled via `enable_curve_controls` setting)
- Single DPS update maintains data consistency across both capabilities
- Flow cards work regardless of picker visibility setting

#### Device Communication

- Uses TuyAPI library for local device communication
- Automatic reconnection using DeviceConstants.RECONNECTION_INTERVAL_MS (20 seconds)
- Bidirectional data flow: Homey capabilities ↔ Tuya DPS
- Event-driven updates via 'data' and 'dp-refresh' events
- Enhanced error handling with categorization and automatic retry for recoverable errors

#### Constants Management System (v0.90.3+)

Centralized configuration system in `DeviceConstants` class:

- **Timing intervals**: Reconnection, health checks, notification throttling
- **Power thresholds**: High consumption alerts, efficiency monitoring
- **Health monitoring**: Capability timeouts, null value thresholds
- **Performance limits**: Connection failure limits, efficiency thresholds
- **Connection health monitoring** (v0.99.98+):
  - `CONNECTION_HEARTBEAT_INTERVAL_MS` (5 minutes): Proactive connection health check interval
  - `HEARTBEAT_TIMEOUT_MS` (10 seconds): Consider connection dead if no heartbeat response
  - `STALE_CONNECTION_THRESHOLD_MS` (10 minutes): Force reconnect after this idle period

#### Error Handling Architecture (v0.90.3+, Enhanced v0.99.46)

Comprehensive error categorization via `TuyaErrorCategorizer`:

- **9 Error Categories**: Connection, timeout, authentication, DPS, network, validation, device offline, device not found, unknown
- **Recovery Guidance**: User-friendly messages with specific recovery actions
- **Smart Retry Logic**: Automatic retry for recoverable errors with appropriate delays
- **Structured Logging**: Consistent error formatting for debugging and monitoring

**Production-Ready Enhancements (v0.99.46)**:

- **Crash Prevention**: Unhandled promise rejection protection in async setTimeout/setInterval callbacks
- **Global Error Handlers**: Process-level `unhandledRejection` and `uncaughtException` handlers in app.ts
- **Device Status Sync**: Automatic `setUnavailable()` after 5 consecutive failures, `setAvailable()` on reconnection
- **Triple-Layer Protection**:
  1. Specific `.catch()` handlers on setTimeout async callbacks (TuyaConnectionService, Device)
  2. Try-catch blocks for synchronous operations (circuit breaker cooldown)
  3. Global process handlers as last resort safety net
- **Enhanced User Notifications**: Push notifications + device availability status + service health monitoring
- **ECONNRESET Resilience**: Specific handling for connection reset errors without app crashes

#### Settings Management & Race Condition Prevention (v0.90.3+)

Enhanced settings handling to prevent Homey's "Cannot set Settings while this.onSettings is still pending" error:

- **Deferred Settings Updates**: Uses `setTimeout` to defer secondary settings updates until after `onSettings` completes
- **Single Settings Call**: Consolidates multiple settings changes into a single `setSettings()` call
- **Power Settings Auto-Management**: Automatically manages related flow card settings when power measurements are toggled
- **Async Error Handling**: Proper error handling for deferred settings operations
- **Race Condition Prevention**: Eliminates concurrent `setSettings()` calls that could corrupt device configuration

#### Pairing Flow

Three-step pairing process:

1. `enter_device_info` - Collect device credentials (ID, local key, IP)
2. `list_devices` - Display discovered device
3. `add_devices` - Finalize device registration

Enhanced with error categorization for improved troubleshooting during pairing failures.

#### Credential Management (v0.99.62+)

**Updating Device Credentials**: Users can update device credentials (Device ID, Local Key, IP Address, Protocol Version) directly via the device settings form:

- **Path**: Device Settings → Scroll to credential fields at top
- **Fields**: All credential fields are `type: "text"` or `type: "dropdown"` (editable)
- **Auto-Reconnection**: When any credential field changes, `device.onSettings()` detects the change and automatically calls `TuyaConnectionService.reinitialize()` to reconnect with new credentials
- **No Repair Flow**: The traditional "Repair Device" flow has been removed (v0.99.62) - settings form provides the same functionality with simpler UX
- **Implementation**: See `device.ts` lines 2527-2569 for credential change detection and reconnection logic

#### Manual Reconnection (v0.99.66+)

**Force Reconnect Feature**: Users can manually trigger immediate reconnection when device shows 'Disconnected' status:

- **Path**: Device Settings → Diagnostics → "Force reconnect to device" checkbox
- **Purpose**: Bypasses automatic reconnection delays (exponential backoff, circuit breaker cooldown)
- **Use Cases**:
  - Device shows "Disconnected" for extended period
  - Automatic reconnection stuck in backoff/circuit breaker state
  - After resolving network issues (WiFi, router, IP changes)
  - Testing connection after device power cycle
- **Behavior**:
  1. Stops pending automatic reconnection attempts
  2. Cleanly disconnects current connection (if any)
  3. Resets all error recovery state (backoff multiplier, circuit breaker, failure counters)
  4. Attempts fresh connection immediately
  5. Resumes normal reconnection monitoring
  6. Checkbox auto-resets after operation completes
- **Status Feedback**: Check `adlar_connection_status` capability for result ("Connected" or "Reconnecting")
- **Implementation**: See `TuyaConnectionService.forceReconnect()` and `device.ts` lines 2600-2640

#### Connection Status Persistence (v0.99.63+, Fixed v0.99.67)

**Timestamp Persistence Across App Updates**: Connection status timestamps survive app updates and Homey restarts through a three-layer mechanism:

**Layer 1: Store Restoration (Initialization)**
- On app startup, `TuyaConnectionService.initialize()` restores last connection timestamp from device store
- Only restores timestamps less than 7 days old (prevents showing stale data)
- Preserves user's view of "when device was last connected" through updates

**Layer 2: State-Aware Updates (v0.99.65)**
- `updateStatusTimestamp()` compares current status vs new status before updating
- Early return if status unchanged (prevents overwriting restored timestamps)
- Critical for preserving historical timestamps when device reconnects with same status
- Example: Device "Connected 2 hours ago" → App update → Still shows "Connected 2 hours ago"

**Layer 3: Non-Blocking Event Handlers (v0.99.67)**
- TuyAPI event handlers (`'connected'`, `'disconnected'`) are synchronous for immediate completion
- Call `updateStatusTimestamp()` without `await` (fire-and-forget pattern)
- Background persistence via `.catch()` handlers prevents floating promises
- Critical fix: Async event handlers were blocking TuyAPI's state machine, causing disconnections

**Why Async Event Handlers Failed (v0.99.63-v0.99.66)**:
- TuyAPI expects synchronous event handlers that complete immediately
- Async handlers return Promises that can reject during `setStoreValue()` operations
- Promise rejections disrupted TuyAPI's internal connection state machine
- Failure was non-deterministic (worked initially, failed after hours due to I/O slowdown)
- Race conditions occurred during rapid connect/disconnect cycles

**Current Implementation (v0.99.67)**:
```typescript
// Event handler (synchronous, completes in nanoseconds)
this.tuya.on('connected', (): void => {
  this.isConnected = true;
  this.updateStatusTimestamp('connected').catch((err) => {
    this.logger('Failed to update timestamp:', err);
  });
  // Handler returns immediately - TuyAPI can process next event safely
});

// Persistence function (async, runs in background)
private async updateStatusTimestamp(newStatus: string): Promise<void> {
  if (this.currentStatus === newStatus) return; // Preserve timestamp
  this.currentStatus = newStatus;
  this.lastStatusChangeTime = Date.now();
  await this.device.setStoreValue('last_connection_timestamp', this.lastStatusChangeTime);
}
```

**Benefits**:
- ✅ Timestamps persist across app updates and restarts
- ✅ No Promise blocking TuyAPI event queue
- ✅ Failures in store operations don't affect connection state
- ✅ Works reliably under all load conditions and timing scenarios

#### DPS Processing Optimization (v0.99.96)

**Batched Async Operations**: The `updateCapabilitiesFromDps()` method batches all async operations to prevent event loop blocking:

**Problem (v0.99.63-v0.99.68)**:
- Nested `forEach` loops spawned 30-60+ async `setCapabilityValue()` operations per `data` event
- Each operation executed independently without coordination
- Async operations continued running **after** event handler returned to TuyAPI
- TuyAPI's state machine became blocked when new events arrived during pending async operations
- Result: Socket timeouts, ECONNRESET errors, frequent disconnections

**Solution (v0.99.96)**:
```typescript
updateCapabilitiesFromDps(dps: Record<string, unknown>): void {
  const updatePromises: Promise<void>[] = [];

  // Collect all async operations
  Object.entries(dps).forEach(([dpsKey, value]) => {
    const capabilities = AdlarMapping.dpsToCapabilities[dpsId];
    capabilities.forEach((capability) => {
      const updatePromise = this.setCapabilityValue(capability, value)
        .then(() => this.debugLog(`✅ Updated ${capability}`))
        .catch((error) => this.error(`Failed ${capability}:`, error));
      updatePromises.push(updatePromise);
    });
  });

  // Batch execute with proper error isolation
  Promise.allSettled(updatePromises)
    .then((results) => {
      const failures = results.filter((r) => r.status === 'rejected').length;
      if (failures > 0) {
        this.error(`DPS update completed with ${failures} failures`);
      }
    })
    .catch((error) => this.error('Batching error:', error));
}
```

**Benefits**:
- ✅ **Event Loop Friendly**: Handler returns immediately, TuyAPI state machine unblocked
- ✅ **Coordinated Execution**: `Promise.allSettled()` manages all operations as single unit
- ✅ **Error Isolation**: Individual failures don't affect other capability updates
- ✅ **Performance Monitoring**: Single log entry shows batch success/failure rate
- ✅ **Connection Stability**: Eliminates disconnections caused by async operation pile-up
- ✅ **Scalability**: Handles 49+ capabilities efficiently without blocking

#### Heartbeat Mechanism (v0.99.98-v0.99.99)

**Purpose**: Proactively detect zombie connections during idle periods when device appears connected but data flow has stopped.

**Problem Solved**: Prior to v0.99.98, devices could remain in "Connected" state for hours while the underlying TuyAPI connection was dead, requiring manual user intervention via "Force Reconnect" button. The heartbeat mechanism detects and recovers from these zombie connections automatically within 5-15 minutes.

**Architecture**:

1. **Heartbeat Interval**: Every 5 minutes (`CONNECTION_HEARTBEAT_INTERVAL_MS`)
2. **Intelligent Skip Logic**:
   - Skips heartbeat if device sent data within last 4 minutes (80% of interval)
   - Prevents unnecessary network traffic for active connections
   - Only probes when device appears idle
3. **Zombie Detection**:
   - Uses lightweight `tuya.get({ schema: true })` query
   - 10-second timeout (`HEARTBEAT_TIMEOUT_MS`)
   - Failure triggers reconnection via standard system
4. **Stale Connection Detection**:
   - Secondary protection layer in `scheduleNextReconnectionAttempt()`
   - Forces reconnection if no data for 10+ minutes (`STALE_CONNECTION_THRESHOLD_MS`)
   - Applies moderate backoff (1.5x multiplier) instead of aggressive exponential backoff
   - Single-source connection truth (v0.99.99) - eliminates race conditions

**Implementation**:

```typescript
private async performHeartbeat(): Promise<void> {
  // Skip if already disconnected
  if (!this.isConnected) return;

  // Skip if heartbeat already running (prevent concurrent probes)
  if (this.heartbeatInProgress) return;

  // Intelligent skip: Check if device active (data within 80% of interval)
  const timeSinceLastData = Date.now() - this.lastDataEventTime;
  if (timeSinceLastData < CONNECTION_HEARTBEAT_INTERVAL_MS * 0.8) {
    this.logger('Heartbeat skipped - device active');
    return;
  }

  // Device idle - probe connection health
  this.heartbeatInProgress = true;
  try {
    await Promise.race([
      this.tuya.get({ schema: true }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Heartbeat timeout')),
        HEARTBEAT_TIMEOUT_MS)
      )
    ]);

    this.logger('✅ Heartbeat successful - connection healthy');
    this.lastDataEventTime = Date.now(); // Update activity timestamp

  } catch (error) {
    this.logger('❌ Heartbeat failed - zombie connection detected');
    this.isConnected = false;
    this.consecutiveFailures++;
    this.scheduleNextReconnectionAttempt();
  } finally {
    this.heartbeatInProgress = false;
  }
}
```

**Connection Health Tracking**:

Three timestamps track connection activity:
- `lastDataEventTime` - Last time device sent sensor data (any DPS update)
- `lastHeartbeatTime` - Last successful heartbeat probe
- `lastStatusChangeTime` - Last connection status change (connected/disconnected)

**Stale Connection Force-Reconnect (v0.99.98)**:

The `scheduleNextReconnectionAttempt()` method includes Layer 2 protection:

```typescript
// Layer 2: Stale connection detection
if (this.isConnected) {
  const timeSinceLastData = Date.now() - this.lastDataEventTime;
  if (timeSinceLastData > STALE_CONNECTION_THRESHOLD_MS) {
    this.logger('⚠️ Stale connection detected - forcing reconnect');
    this.backoffMultiplier = Math.min(this.backoffMultiplier * 1.5, 3);
    await this.disconnect();
    await this.connect();
    return;
  }
}
```

**Single-Source Connection Truth (v0.99.99)**:

Prior to v0.99.99, the heartbeat timer and reconnection timer could conflict, causing extended disconnection periods. The fix ensures only one reconnection source:

```typescript
scheduleNextReconnectionAttempt(): void {
  // Clear existing timers to ensure single source of truth
  if (this.reconnectionTimer) {
    clearTimeout(this.reconnectionTimer);
    this.reconnectionTimer = null;
  }

  // Only schedule new timer if disconnected
  if (this.isConnected) return;

  // ... rest of reconnection logic
}
```

**Benefits**:
- ✅ Detects zombie connections within 5-15 minutes (vs hours without heartbeat)
- ✅ Minimal network overhead (skips when device active)
- ✅ Works alongside reactive error handling (double protection)
- ✅ Automatic recovery without user intervention
- ✅ Eliminates extended disconnection periods reported in v0.99.97 and earlier
- ✅ Reduces need for manual "Force Reconnect" button usage
- ✅ Single-source connection management prevents race conditions (v0.99.99)

**User Impact**:
- Device automatically recovers from idle connection failures
- "Connected" status remains accurate during idle periods
- Sensor data resumes automatically after network disruptions
- Reduced support burden (fewer manual interventions needed)

### Configuration Files

- **app.json**: **AUTO-GENERATED** - Never edit manually! Generated by Homey Compose from `.homeycompose/` structure
- **`.homeycompose/app.json`**: App-level configuration source file
- **`.homeycompose/capabilities/`**: Individual capability definition files (modular approach)
- **driver.compose.json**: Driver metadata, capability assignments, capability options, pairing flows
- **driver.settings.compose.json**: Device settings that users can configure per device instance
- **tsconfig.json**: TypeScript compilation settings targeting Node 16

#### Homey Compose Architecture (CRITICAL)

**✅ CORRECT approach - Use Homey Compose structure:**

```
.homeycompose/
├── app.json                     # App configuration
├── capabilities/                # Modular capability definitions
│   ├── adlar_enum_countdown_set.json
│   ├── adlar_enum_mode.json
│   └── [other capabilities].json
├── flow/
│   ├── actions/                # Flow action definitions
│   ├── conditions/             # Flow condition definitions
│   └── triggers/               # Flow trigger definitions
└── drivers/
    └── intelligent-heat-pump/
        ├── driver.compose.json         # Driver structure
        └── driver.settings.compose.json # Device settings
```

**❌ NEVER manually edit `app.json`:**

- File contains: `"_comment": "This file is generated. Please edit .homeycompose/app.json instead."`
- Gets overwritten on every build
- Manual changes will be lost

**✅ Benefits of Homey Compose approach:**

- **Consistency**: Ensures proper structure and validation
- **Maintainability**: Modular files easier to manage
- **Version Control**: Clear separation of concerns
- **Compliance**: Follows official Homey development guidelines

#### Settings Architecture (IMPORTANT)

**Device settings belong in `driver.settings.compose.json`, NOT in `driver.compose.json`:**

- ✅ **`driver.settings.compose.json`** - User-configurable settings for each device instance:
  - Device credentials (Device ID, Local Key, IP Address)
  - Feature toggles (enable/disable power measurements)
  - Flow card control settings
  - Diagnostic settings
  
- ❌ **`driver.compose.json`** - Driver structure and metadata only:
  - Capabilities definitions
  - Capability options (min/max values, titles, etc.)
  - Pairing flows
  - Driver class and platform settings
  
**Rule**: If a user can change it in device settings UI, it belongs in `driver.settings.compose.json`

#### Flow Card Control System (v0.92.4+)

**Dynamic Flow Card Management**: Users can control flow card visibility per device through settings UI:

**Settings Categories:**

- `flow_temperature_alerts` - Temperature-related flow cards
- `flow_voltage_alerts` - Voltage monitoring flow cards
- `flow_current_alerts` - Current monitoring flow cards
- `flow_power_alerts` - Power consumption flow cards
- `flow_pulse_steps_alerts` - Valve position flow cards
- `flow_state_alerts` - System state change flow cards
- `flow_expert_mode` - Advanced diagnostic flow cards

**Settings Values & Behavior:**

| Setting | Behavior | Use Case |
|---------|----------|----------|
| **`disabled`** | No flow cards for this category | Clean interface, unused sensors |
| **`auto`** | Show only for healthy capabilities with data | **Default** - Reliable alerts only |
| **`enabled`** | Force all capability flow cards active | Safety critical, troubleshooting |

**Flow Card Logic (`shouldRegisterCategory`):**

```typescript
switch (userSetting) {
  case 'disabled':
    return false; // No cards at all
  
  case 'enabled': 
    return availableCaps.length > 0; // Show if ANY capabilities exist
  
  case 'auto':
  default:
    // Show only if capabilities exist AND have healthy data
    return availableCaps.length > 0 
           && availableCaps.some((cap) => capabilitiesWithData.includes(cap));
}
```

**Capability Health Detection:**

- **Healthy**: Recent data (< 5 minutes), < 10 consecutive null values
- **Unhealthy**: Stale data, too many null values, no recent updates
- **Auto mode**: Excludes unhealthy capabilities from flow card registration
- **Enabled mode**: Includes all capabilities regardless of health status

**Temperature Alerts Example** (`flow_temperature_alerts = "enabled"`):

- **Flow Triggers Available**: `coiler_temperature_alert`, `tank_temperature_alert`, `ambient_temperature_changed`, etc.
- **Safety Monitoring**: Critical temperature thresholds (> 80°C, < -20°C) always active
- **Alert Conditions**: Configurable thresholds per sensor type
- **Notification System**: Critical alerts sent via Homey notifications

**Power Settings Auto-Management:**

- When `enable_power_measurements = false` → Auto-disables `flow_power_alerts`, `flow_voltage_alerts`, `flow_current_alerts`
- When `enable_power_measurements = true` → Resets related flow settings to `auto`
- Prevents inconsistent configuration states

### Capability System (Updated v0.99.56)

The app defines 49+ capabilities across multiple categories:

- Temperature sensors (inlet, outlet, ambient, etc.)
- Power/electrical measurements (voltage, current, consumption)
- Pressure sensors and valve positions
- System states (compressor, defrost, backwater)
- Control settings (modes, curves, timers)
- **Dual picker/sensor controls** (v0.99.54+) - heating/hot water curves

**Dual Picker/Sensor Capabilities (v0.99.54+)**:

| DPS | Sensor (Always Visible) | Picker (Optional) | User Setting |
|-----|------------------------|-------------------|--------------|
| 11 | `adlar_sensor_capacity_set` | `adlar_enum_capacity_set` | `enable_curve_controls` |
| 13 | `adlar_enum_countdown_set` | `adlar_picker_countdown_set` | `enable_curve_controls` |

**Benefits**:
- Users always see current curve settings (sensor capabilities)
- Advanced users can enable picker controls for direct adjustment
- Cleaner default UI (pickers hidden by default)
- Flow cards always functional regardless of UI visibility

Each capability maps to specific Tuya DPS numbers and includes multilingual support (EN/NL).

### Important Project Constraints

**Ignored Files and Directories** (per .homeyignore):

- `docs/*` - All documentation files are excluded from builds
- `comments.txt` - Development notes file
- `claude.md` - This instruction file
- `*.code-workspace` - VS Code workspace files

**Flow Card Development Guidelines:**

- ✅ Use capability definitions from `.homeycompose/capabilities/` directory for custom capabilities
- ✅ Extract enum values and parameter ranges from `drivers/intelligent-heat-pump/driver.compose.json`
- ✅ Define Flow cards in `.homeycompose/flow/` directory structure
- ❌ Do NOT reference any files in the `docs/` directory for flow card implementation
- ❌ Do NOT manually edit generated `app.json` file
- ✅ All capability metadata should come from the official compose configuration files

**Capability Development Best Practices:**

1. **Create individual capability files** in `.homeycompose/capabilities/[capability_name].json`
2. **Reference capabilities** in `driver.compose.json` under `capabilities` array
3. **Let Homey Compose generate** the final `app.json` automatically
4. **Use modular approach** for maintainability and version control
5. **Follow naming conventions** for capability IDs and file names

### Flow Card Implementation Status (v1.0.7+)

**Comprehensive Flow Card Audit Results:**

The app defines **71 flow cards** across three categories:
- **36 Triggers**: 3 explicit, 23 pattern-based, 10 not implemented
- **12 Actions**: 12 fully implemented (100%)
- **23 Conditions**: 14 fully implemented, 9 not implemented

**v1.0.7 Implementations (Fase 1 - Critical Features):**

#### Implemented Triggers (2 new + 1 enhanced)

1. **`fault_detected`** - Device Safety (CRITICAL)
   - **Location**: `drivers/intelligent-heat-pump/device.ts:2232-2255`
   - **DPS**: 15 (`adlar_fault`)
   - **Features**:
     - Change detection (only triggers on new faults)
     - 15 fault codes with bilingual descriptions (EN/NL)
     - Fault clearance logging (code returns to 0)
     - Fire-and-forget pattern (non-blocking)
   - **State Tracking**: `lastFaultCode` property (session-scoped)
   - **Performance**: Zero overhead when no fault active
   - **Example**: Fault code 3 → "Compressor overheating" / "Compressor oververhitting"

2. **`power_threshold_exceeded`** - Energy Management (CRITICAL)
   - **Location**: `lib/services/energy-tracking-service.ts:423-464`
   - **Monitoring**: `measure_power` capability (DPS 104)
   - **Features**:
     - **Hysteresis**: 5% gap prevents oscillation (3000W trigger, 2850W reset)
     - **Rate Limiting**: Max 1 trigger per 5 minutes (300,000ms)
     - **State Machine**: `powerAboveThreshold` boolean tracking
   - **Configuration**: User-defined threshold via settings (`power_threshold_watts`, default 3000W)
   - **Performance**: ~2ms processing per power update
   - **Example**: 2990W → 3020W → TRIGGER → 2995W (no retrigger) → 2840W → RESET

3. **`total_consumption_milestone`** - Goal Tracking (CRITICAL)
   - **Location**: `lib/services/energy-tracking-service.ts:472-513`
   - **Capability**: `meter_power.electric_total` (DPS 105)
   - **Features**:
     - Fixed 100 kWh increment (100, 200, 300, ...)
     - **Persistent Deduplication**: Store-based tracking survives app restarts
     - **Catch-Up Logic**: Triggers all missed milestones on first run
   - **Storage**: `triggered_energy_milestones` array in device store
   - **Performance**: O(n) where n = milestones reached (~100 for 10,000 kWh)
   - **Example**: New install at 523 kWh → Triggers 100, 200, 300, 400, 500 (once each)

#### Implemented Conditions (4 new)

1. **`cop_efficiency_check`** - Real-Time Performance (CRITICAL)
   - **Location**: `lib/services/flow-card-manager-service.ts:402-421`
   - **Capability**: `adlar_cop` (real-time COP)
   - **Smart Behavior**:
     - **Compressor State Check**: Returns `false` when idle (prevents false positives)
     - Checks `measure_frequency.compressor_strength > 0` before evaluation
   - **Typical Usage**: `IF COP below 2.5 THEN investigate`
   - **Why Idle Check**: COP=0 during idle is technically correct but misleading in flows

2. **`daily_cop_above_threshold`** - 24-Hour Average (CRITICAL)
   - **Location**: `lib/services/flow-card-manager-service.ts:423-438`
   - **Capability**: `adlar_cop_daily` (rolling 24-hour average)
   - **Data Source**: RollingCOPCalculator.getDailyCOP()
   - **Smart Behavior**:
     - Returns `false` if insufficient data (dailyCOP = 0)
     - Requires ≥10 data points for reliable average
   - **Update Frequency**: Every 5 minutes
   - **Typical Usage**: Daily reports, trend monitoring

3. **`monthly_cop_above_threshold`** - Long-Term Trend (CRITICAL)
   - **Location**: `lib/services/flow-card-manager-service.ts:440-455`
   - **Capability**: `adlar_cop_monthly` (rolling 30-day average)
   - **Data Source**: RollingCOPCalculator.getMonthlyCOP()
   - **Purpose**: Smooths weather variations, best long-term efficiency indicator
   - **Typical Usage**: Seasonal performance tracking, maintenance scheduling

4. **`temperature_differential`** - System Health (VERIFIED)
   - **Location**: `app.ts:178-232`
   - **Status**: ✅ Production-ready since v0.99, verified in v1.0.7
   - **Capabilities**: `measure_temperature.temp_top`, `measure_temperature.temp_bottom`
   - **Calculation**: `Math.abs(inlet - outlet)`
   - **Null-Safe**: Fallback to 0°C with debug logging
   - **Typical Usage**: Heat transfer efficiency checks (target: 5-10°C)

#### Architectural Patterns

**1. Trigger Implementation Patterns**:

**Device-Level (Fault Detection)**:
```typescript
// In updateCapabilitiesFromDps() - real-time DPS processing
if (dpsId === 15 && capability === 'adlar_fault') {
  const faultCode = typeof value === 'number' ? value : 0;
  if (faultCode > 0 && faultCode !== this.lastFaultCode) {
    this.triggerFlowCard('fault_detected', {
      fault_code: faultCode,
      fault_description: getFaultDescription(faultCode, language)
    }).catch(err => this.error('Failed to trigger:', err));
    this.lastFaultCode = faultCode;
  }
}
```

**Service-Level (Power/Energy Triggers)**:
```typescript
// In EnergyTrackingService - after capability update
await this.device.setCapabilityValue('measure_power', powerValue);
await this.checkPowerThreshold(powerValue); // Trigger check
await this.updateCumulativeEnergy(); // Which calls checkEnergyMilestones()
```

**2. Condition Implementation Pattern**:

```typescript
// In FlowCardManagerService.registerActionBasedConditionCards()
const copEfficiencyCard = this.device.homey.flow.getConditionCard('cop_efficiency_check');
copEfficiencyCard.registerRunListener(async (args) => {
  const currentCOP = this.device.getCapabilityValue('adlar_cop') as number || 0;
  const threshold = args.threshold || 2.0;

  // Smart behavior: check preconditions
  const compressorRunning = this.device.getCapabilityValue('measure_frequency.compressor_strength') > 0;
  if (!compressorRunning) return false; // COP not meaningful when idle

  return currentCOP > threshold;
});
```

**3. Anti-Spam Mechanisms**:

**Hysteresis (Power Threshold)**:
- Trigger threshold: 3000W
- Reset threshold: 2850W (95%)
- Gap prevents oscillation: 2980W → 3020W → TRIGGER → 2990W (no retrigger)

**Rate Limiting (Power Threshold)**:
- Minimum interval: 5 minutes (300,000ms)
- Tracked via `lastPowerThresholdTrigger` timestamp
- Logs rate-limited events for diagnostics

**Change Detection (Fault)**:
- State: `lastFaultCode` property
- Only triggers when code changes (0→3 or 3→5)
- Logs fault clearance (3→0) without triggering

**Deduplication (Milestones)**:
- Persistent storage: `triggered_energy_milestones` array
- Check: `if (!triggeredMilestones.includes(milestone))`
- Survives app restarts (store-based, not memory)

**4. Fault Code Mapping Architecture**:

```typescript
// Global constant - outside class for reusability
const FAULT_CODE_DESCRIPTIONS: Record<number, { en: string; nl: string }> = {
  0: { en: 'No fault', nl: 'Geen storing' },
  1: { en: 'High pressure protection', nl: 'Hogedrukbeveiliging' },
  // ... 15 fault codes total
};

function getFaultDescription(faultCode: number, language: 'en' | 'nl' = 'en'): string {
  const description = FAULT_CODE_DESCRIPTIONS[faultCode];
  if (description) return description[language];
  return language === 'nl'
    ? `Onbekende storing (code: ${faultCode})`
    : `Unknown fault (code: ${faultCode})`;
}
```

**Design Rationale**:
- **Global constant**: Allows reuse in multiple contexts (triggers, logging, UI)
- **Bilingual by default**: EN/NL descriptions in same structure
- **Fallback for unknowns**: Graceful degradation for unmapped codes
- **Type-safe**: TypeScript Record ensures consistency

**5. Service Integration Points**:

**EnergyTrackingService Enhancements**:
```typescript
// New properties (v1.0.7)
private powerAboveThreshold = false;
private lastPowerThresholdTrigger = 0;
private readonly POWER_THRESHOLD_HYSTERESIS = 0.05; // 5%
private readonly POWER_THRESHOLD_RATE_LIMIT_MS = 5 * 60 * 1000; // 5 min

// Integration point in updateIntelligentPowerMeasurement()
await this.device.setCapabilityValue('measure_power', powerValue);
await this.checkPowerThreshold(powerValue); // NEW v1.0.7
await this.updateCumulativeEnergy(); // Existing, enhanced with milestone check
```

**FlowCardManagerService Enhancements**:
```typescript
// registerActionBasedConditionCards() - enhanced with COP conditions
// Lines 402-455 in flow-card-manager-service.ts
// 3 new COP condition handlers added
// Pattern: Get capability value → Validate preconditions → Return boolean
```

#### Not Implemented (Documented for Future Reference)

**10 Triggers Not Implemented**:
- `inlet_temperature_changed`, `outlet_temperature_changed`, `ambient_temperature_changed` (⚠️ Consider pattern-based)
- `countdown_timer_finished` (❌ SKIP - misleading name, DPS 13 is heating curve not timer)
- `water_flow_alert`, `electrical_load_alert` (🟢 Low priority - test DPS reliability first)
- `daily_consumption_threshold` (🟡 Medium priority - Fase 2)

**9 Conditions Not Implemented**:
- `cop_trend_analysis` (🟡 Medium priority - RollingCOPCalculator.getTrendAnalysis() available)
- `cop_calculation_method_is` (🟢 Low priority - power user feature)
- `water_flow_rate_check`, `system_pulse_steps_differential`, `electrical_balance_check` (🟢 Low priority)

**Recommendation**: Focus on pattern-based triggers for Fase 2 (temperature changes) and COP trend analysis.

#### Performance Impact

**Measured Overhead (v1.0.7)**:
- **Fault Detection**: <1ms per DPS update (only when DPS 15 updates)
- **Power Threshold**: ~2ms per power update (~every 30 seconds)
- **Milestone Check**: ~5ms per energy update (includes store read/write)
- **COP Conditions**: <1ms per flow evaluation (simple capability reads)

**Total Impact**: Negligible (<10ms per update cycle, ~0.01% CPU)

**Memory Impact**:
- Fault state: 8 bytes (`lastFaultCode` number)
- Power state: 24 bytes (2 numbers + boolean)
- Milestone array: ~4KB for 1000 milestones (10,000 kWh cumulative)
- **Total**: <5KB additional memory

#### Testing Checklist (Before Release)

**Critical Tests**:
- [ ] `fault_detected` triggers on DPS 15 > 0
- [ ] `fault_detected` does NOT retrigger on same fault code
- [ ] `power_threshold_exceeded` triggers at threshold crossing (e.g., 2900→3100W)
- [ ] Power threshold does NOT retrigger during oscillation (hysteresis works)
- [ ] `total_consumption_milestone` triggers at 100 kWh intervals
- [ ] Milestones do NOT retrigger after app restart (deduplication works)
- [ ] `cop_efficiency_check` returns false when compressor idle
- [ ] `daily_cop_above_threshold` returns false when insufficient data
- [ ] `temperature_differential` handles null temperatures gracefully

**Integration Tests**:
- [ ] All triggers work in actual Homey flows (not just unit tests)
- [ ] Conditions evaluate correctly in IF statements
- [ ] Tokens populate correctly in notification messages
- [ ] Settings integration works (power_threshold_watts setting)

#### Documentation

**User-Facing Documentation**: `docs/FLOW_CARDS_GUIDE.md`
- Comprehensive usage examples
- Configuration tips
- Troubleshooting guide
- Best practices

**Developer Documentation**: This section (CLAUDE.md)
- Implementation details
- Architectural patterns
- Performance characteristics
- Maintenance guidelines

## Official Homey Documentation

### Core References

- [Homey Apps SDK v3](https://apps-sdk-v3.developer.homey.app/index.html) main entry for documentation of all managers & classes in the Homey Apps SDK
- [Homey Apps SDK](https://apps.developer.homey.app) SDK assisted manual overview

- [Homey Apps SDK Documentation](https://apps-sdk-v3.developer.homey.app/)
- [App Development Guide](https://apps.developer.homey.app/the-basics/getting-started)
- [Device Driver Development](https://apps.developer.homey.app/the-basics/devices)

### Key SDK Components

- [App Class](https://apps-sdk-v3.developer.homey.app/App.html) - Main application entry point
- [Driver Class](https://apps-sdk-v3.developer.homey.app/Driver.html) - Device discovery and pairing
- [Device Class](https://apps-sdk-v3.developer.homey.app/Device.html) - Individual device management
- [Capabilities System](https://apps.developer.homey.app/the-basics/devices/capabilities) - Device capability definitions
- [Homey built-in device capabilities](https://apps-sdk-v3.developer.homey.app/tutorial-device-capabilities.html) - List of all system capabilities Homey provides
- [New guidelines for device capabilities](https://apps.developer.homey.app/upgrade-guides/device-capabilities) - Transition to custom capabilities in favor of system capabilities
- [Device Classes](https://apps-sdk-v3.developer.homey.app/tutorial-device-classes.html) - List of IDs to refer to a device in the Driver Manifest

### Configuration & Composition

- [App Manifest (app.json)](https://apps.developer.homey.app/the-basics/app) - App configuration
- [Homey Compose](https://apps.developer.homey.app/advanced/homey-compose) - Build system for generating app.json
- [Driver Development](https://apps.developer.homey.app/the-basics/devices) - Driver-specific settings
- [Custom Capabilities](https://apps.developer.homey.app/the-basics/devices/capabilities) - Creating device-specific capabilities

### Flow Cards & Automation

- [Flow Cards Overview](https://apps.developer.homey.app/the-basics/flow) - Automation triggers, conditions, actions
- [Flow Card Implementation](https://apps.developer.homey.app/the-basics/flow) - Registering flow card listeners

### Pairing & Device Management

- [Device Pairing](https://apps.developer.homey.app/the-basics/devices/pairing) - Custom pairing flows
- [Device Settings](https://apps.developer.homey.app/the-basics/devices/settings) - Device configuration management

### handling of global app.json

**Context Token Optimization**: The auto-generated `app.json` file (199KB) should be handled by specialized agents to reduce context overhead:

- **For app.json analysis**: Use the `homey-automation-tutor` agent which has full tool access and Homey expertise
- **For changelog updates**: Always refer to `.homeycompose/app.json` instead of `app.json`
- **For general development**: Focus on editable source files in `.homeycompose/` directory
- **When app.json access needed**: Delegate to `homey-automation-tutor` agent rather than including in main context

**Rationale**: `app.json` is auto-generated from `.homeycompose/` files, creating 200KB+ of redundant context. Agent delegation provides access when needed while keeping general context lean.
- strings exposed to the user should be localized. Use localization as required.