# Key Development Patterns

**Parent Documentation**: [CLAUDE.md](../../CLAUDE.md)
**Related**: [SERVICE_ARCHITECTURE.md](SERVICE_ARCHITECTURE.md), [DPS_MAPPING.md](DPS_MAPPING.md), [ERROR_HANDLING.md](ERROR_HANDLING.md)

## Overview

Critical development patterns and best practices for working with this Homey app. These patterns ensure reliability, prevent common pitfalls, and maintain code quality.

## Constants Management System (v0.90.3+)

**Location**: `lib/constants.ts`

Centralized configuration system in `DeviceConstants` class:

### Configuration Categories

**Timing Intervals**:
- `RECONNECTION_INTERVAL_MS` (20 seconds): Base reconnection interval
- `CONNECTION_HEARTBEAT_INTERVAL_MS` (5 minutes): Proactive connection health check interval
- `HEARTBEAT_TIMEOUT_MS` (10 seconds): Consider connection dead if no heartbeat response
- `STALE_CONNECTION_THRESHOLD_MS` (10 minutes): Force reconnect after this idle period

**Power Thresholds**:
- High consumption alerts
- Efficiency monitoring baselines
- COP calculation thresholds

**Health Monitoring**:
- Capability timeouts (5 min for sensors, 15 min for status)
- Null value thresholds (max 10 consecutive nulls)
- Data freshness windows

**Performance Limits**:
- Connection failure limits (circuit breaker thresholds)
- Efficiency thresholds (min acceptable COP)
- Backoff multipliers (exponential reconnection)

### Benefits

- ✅ **Single Source of Truth**: All timing/threshold values centralized
- ✅ **Easy Tuning**: Adjust behavior without searching through code
- ✅ **Consistency**: Same values used across all services
- ✅ **Testability**: Easy to override for unit tests

**Best Practice**: Always use `DeviceConstants.CONSTANT_NAME` instead of hardcoded values.

## Settings Management & Race Condition Prevention (v0.90.3+)

**Problem**: Homey throws "Cannot set Settings while this.onSettings is still pending" error when settings updates overlap.

### Deferred Settings Pattern

**Never call `setSettings()` inside `onSettings()`**:

```typescript
// ❌ BAD: Causes race condition
async onSettings(oldSettings, newSettings, changedKeys) {
  if (changedKeys.includes('enable_power')) {
    await this.setSettings({
      flow_power_alerts: 'auto'  // ERROR: Overlaps with pending onSettings
    });
  }
}

// ✅ GOOD: Defer secondary updates
async onSettings(oldSettings, newSettings, changedKeys) {
  if (changedKeys.includes('enable_power')) {
    setTimeout(() => {
      this.setSettings({
        flow_power_alerts: 'auto'
      }).catch(err => this.error('Deferred setting failed:', err));
    }, 100); // Defer until after onSettings completes
  }
}
```

### Single Settings Call Pattern

**Consolidate multiple changes into one `setSettings()` call**:

```typescript
// ❌ BAD: Multiple concurrent calls
await this.setSettings({ setting1: 'value1' });
await this.setSettings({ setting2: 'value2' });
await this.setSettings({ setting3: 'value3' });

// ✅ GOOD: Single consolidated call
await this.setSettings({
  setting1: 'value1',
  setting2: 'value2',
  setting3: 'value3'
});
```

### Power Settings Auto-Management

When `enable_power_measurements` changes:

- **Disabled** → Auto-disable related flow settings
  - `flow_power_alerts = 'disabled'`
  - `flow_voltage_alerts = 'disabled'`
  - `flow_current_alerts = 'disabled'`

- **Enabled** → Reset to auto mode
  - `flow_power_alerts = 'auto'`
  - `flow_voltage_alerts = 'auto'`
  - `flow_current_alerts = 'auto'`

**Implementation**: Deferred setTimeout pattern, consolidated into single `setSettings()` call.

## Pairing Flow

Three-step pairing process for adding new devices:

### Step 1: `enter_device_info`

Collect device credentials from user:
- **Device ID**: Tuya device identifier (20-character alphanumeric)
- **Local Key**: Encryption key for local communication (16-character)
- **IP Address**: Device's local network IP
- **Protocol Version**: Usually 3.3 (dropdown)

**Validation**:
- Device ID format check (length, characters)
- Local Key format check
- IP address format check (IPv4)

### Step 2: `list_devices`

Display discovered device:
- Show device name (from Tuya cloud or user-provided)
- Display connection status preview
- Confirm credentials are correct

### Step 3: `add_devices`

Finalize device registration:
- Create device instance in Homey
- Initialize TuyaConnectionService
- Establish initial connection
- Register capabilities

**Enhanced Error Categorization**: Uses `TuyaErrorCategorizer` for improved troubleshooting during pairing failures.

**Common Pairing Errors**:
- "Connection timeout" → Check IP address, firewall
- "Authentication failed" → Verify Device ID and Local Key
- "Device not found" → Ensure device on same network

## Credential Management (v0.99.62+)

Users can update device credentials directly via device settings (no repair flow needed).

### Editable Credential Fields

**Location**: Device Settings → Scroll to credential fields at top

| Field | Type | Editable |
|-------|------|----------|
| Device ID | `text` | ✓ Yes |
| Local Key | `text` | ✓ Yes |
| IP Address | `text` | ✓ Yes |
| Protocol Version | `dropdown` | ✓ Yes (3.1 / 3.3) |

### Auto-Reconnection on Credential Change

**Implementation**: `device.ts` lines 2527-2569

```typescript
async onSettings({ oldSettings, newSettings, changedKeys }) {
  // Detect credential changes
  const credentialFields = ['device_id', 'local_key', 'ip', 'protocol_version'];
  const credentialsChanged = changedKeys.some(key => credentialFields.includes(key));

  if (credentialsChanged) {
    this.log('Credentials changed - reinitializing connection');

    // Automatic reconnection with new credentials
    await this.serviceCoordinator
      .getTuyaConnection()
      .reinitialize({
        id: newSettings.device_id,
        key: newSettings.local_key,
        ip: newSettings.ip,
        version: newSettings.protocol_version
      });
  }
}
```

### Benefits

- ✅ **No Repair Flow**: Simpler UX (removed in v0.99.62)
- ✅ **Automatic Reconnection**: No manual restart needed
- ✅ **Immediate Feedback**: Connection status updates in real-time
- ✅ **Error Recovery**: Categorized error messages if reconnection fails

## Manual Reconnection (v0.99.66+)

**Force Reconnect Feature** bypasses automatic reconnection delays for immediate recovery.

### Access Path

Device Settings → Diagnostics → "Force reconnect to device" checkbox

### Use Cases

- Device shows "Disconnected" for extended period
- Automatic reconnection stuck in backoff/circuit breaker state
- After resolving network issues (WiFi, router, IP changes)
- Testing connection after device power cycle

### Behavior

1. **Stop Pending Attempts**: Clears any scheduled automatic reconnection attempts
2. **Clean Disconnect**: Cleanly disconnects current connection (if any)
3. **Reset Recovery State**: Resets all error recovery state
   - Backoff multiplier → 1.0
   - Circuit breaker → open
   - Failure counters → 0
   - Outage tracking → reset
4. **Immediate Connection**: Attempts fresh connection immediately (no delay)
5. **Resume Monitoring**: Resumes normal reconnection monitoring
6. **Auto-Reset**: Checkbox automatically resets after operation completes

### Implementation

**Location**: `TuyaConnectionService.forceReconnect()` and `device.ts` lines 2600-2640

```typescript
public async forceReconnect(): Promise<void> {
  this.logger('Force reconnect requested by user');

  // Clear pending timers
  if (this.reconnectionTimer) {
    clearTimeout(this.reconnectionTimer);
    this.reconnectionTimer = null;
  }

  // Reset recovery state
  this.backoffMultiplier = 1.0;
  this.consecutiveFailures = 0;
  this.circuitBreakerCycleCount = 0;
  this.outageStartTime = null;

  // Clean disconnect
  await this.disconnect();

  // Fresh connection attempt
  await this.connect();
}
```

### Status Feedback

Check `adlar_connection_status` capability for result:
- "Connected" → Success
- "Reconnecting" → In progress
- "Disconnected [error]" → Failed (check error message)

## Connection Status Persistence (v0.99.63+, Fixed v0.99.67)

Connection timestamps survive app updates and Homey restarts through three-layer mechanism.

### Layer 1: Store Restoration (Initialization)

On app startup, restore last connection timestamp from device store:

```typescript
async initialize() {
  const storedTimestamp = await this.device.getStoreValue('last_connection_timestamp');

  if (storedTimestamp && Date.now() - storedTimestamp < 7 * 24 * 60 * 60 * 1000) {
    // Only restore if less than 7 days old
    this.lastStatusChangeTime = storedTimestamp;
  }
}
```

**Benefit**: Preserves "when device was last connected" through app updates.

### Layer 2: State-Aware Updates (v0.99.65)

Prevent overwriting restored timestamps when status unchanged:

```typescript
private async updateStatusTimestamp(newStatus: string): Promise<void> {
  // Early return if status unchanged (preserve timestamp)
  if (this.currentStatus === newStatus) return;

  this.currentStatus = newStatus;
  this.lastStatusChangeTime = Date.now();
  await this.device.setStoreValue('last_connection_timestamp', this.lastStatusChangeTime);
}
```

**Example**: Device "Connected 2 hours ago" → App update → Still shows "Connected 2 hours ago"

### Layer 3: Non-Blocking Event Handlers (v0.99.67)

**Critical Fix**: Async event handlers were blocking TuyAPI's state machine.

**Problem** (v0.99.63-v0.99.66):
- TuyAPI expects synchronous event handlers
- Async handlers return Promises that can reject during `setStoreValue()`
- Promise rejections disrupted TuyAPI's internal connection state machine
- Non-deterministic failures (worked initially, failed after hours)

**Solution** (v0.99.67):

```typescript
// Event handler (synchronous, completes in nanoseconds)
this.tuya.on('connected', (): void => {
  this.isConnected = true;
  // Fire-and-forget pattern
  this.updateStatusTimestamp('connected').catch((err) => {
    this.logger('Failed to update timestamp:', err);
  });
  // Handler returns immediately - TuyAPI can process next event safely
});
```

### Benefits

- ✅ Timestamps persist across app updates and restarts
- ✅ No Promise blocking TuyAPI event queue
- ✅ Failures in store operations don't affect connection state
- ✅ Works reliably under all load conditions

## DPS Processing Optimization (v0.99.96)

**Batched Async Operations** pattern prevents event loop blocking.

### Problem (v0.99.63-v0.99.68)

- Nested `forEach` loops spawned 30-60+ async `setCapabilityValue()` operations per `data` event
- Each operation executed independently without coordination
- Async operations continued running **after** event handler returned to TuyAPI
- TuyAPI's state machine became blocked when new events arrived during pending async operations
- Result: Socket timeouts, ECONNRESET errors, frequent disconnections

### Solution (v0.99.96)

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

### Benefits

- ✅ **Event Loop Friendly**: Handler returns immediately, TuyAPI state machine unblocked
- ✅ **Coordinated Execution**: `Promise.allSettled()` manages all operations as single unit
- ✅ **Error Isolation**: Individual failures don't affect other capability updates
- ✅ **Performance Monitoring**: Single log entry shows batch success/failure rate
- ✅ **Connection Stability**: Eliminates disconnections caused by async operation pile-up
- ✅ **Scalability**: Handles 49+ capabilities efficiently without blocking

## Best Practices Summary

### DO

- ✅ Use `DeviceConstants` for all timing/threshold values
- ✅ Defer secondary `setSettings()` calls with setTimeout
- ✅ Consolidate multiple settings into single `setSettings()` call
- ✅ Use synchronous event handlers with fire-and-forget async callbacks
- ✅ Batch async operations with `Promise.allSettled()`
- ✅ Provide user-friendly error messages via `TuyaErrorCategorizer`
- ✅ Use `this.device.homey.setTimeout()` instead of global `setTimeout()`
- ✅ Implement `destroy()` methods in all services with timers/data

### DON'T

- ❌ Call `setSettings()` inside `onSettings()` (race condition)
- ❌ Use async event handlers that block TuyAPI state machine
- ❌ Spawn unbatched async operations in tight loops
- ❌ Hardcode timing/threshold values
- ❌ Use global `setTimeout()` / `setInterval()` (memory leaks)
- ❌ Forget `.catch()` handlers on Promises
- ❌ Leave timers running in `destroy()` methods

---

**Related Documentation**:
- [Service Architecture](SERVICE_ARCHITECTURE.md)
- [Error Handling](ERROR_HANDLING.md)
- [DPS Mapping](DPS_MAPPING.md)
- [Heartbeat Mechanism](HEARTBEAT_MECHANISM.md)
