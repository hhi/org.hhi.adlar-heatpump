# Error Handling Architecture

**Parent Documentation**: [CLAUDE.md](../../CLAUDE.md)
**Related**: [SERVICE_ARCHITECTURE.md](SERVICE_ARCHITECTURE.md), [HEARTBEAT_MECHANISM.md](HEARTBEAT_MECHANISM.md)

## Overview

Comprehensive error categorization and recovery system via `TuyaErrorCategorizer` (v0.90.3+), enhanced with production-ready crash prevention (v0.99.46).

## Error Categorization System

**Location**: `lib/error-types.ts`

### 9 Error Categories

1. **Connection errors**: Network connectivity issues
2. **Timeout errors**: Operation timeouts (device not responding)
3. **Authentication errors**: Invalid credentials, unauthorized access
4. **DPS errors**: Invalid data point operations
5. **Network errors**: DNS, routing, firewall issues
6. **Validation errors**: Invalid input parameters
7. **Device offline**: Device powered off or disconnected
8. **Device not found**: IP address changed, device removed
9. **Unknown errors**: Uncategorized errors (fallback)

### Key Features

- **Recovery Guidance**: User-friendly messages with specific recovery actions
  - Example: "Connection failed → Check IP address and network settings"
  - Example: "Authentication failed → Verify Device ID and Local Key in settings"
- **Smart Retry Logic**: Automatic retry for recoverable errors with appropriate delays
  - Exponential backoff for transient errors
  - Circuit breaker for persistent failures
- **Structured Logging**: Consistent error formatting for debugging and monitoring
  - Error category included in all log messages
  - Stack traces preserved for debugging
  - User-facing messages separated from technical details

## Production-Ready Enhancements (v0.99.46)

### Crash Prevention

Three-layer protection strategy prevents unhandled promise rejections that could crash the app:

#### Layer 1: Specific `.catch()` Handlers

**Location**: `TuyaConnectionService`, `Device` class

All async setTimeout/setInterval callbacks include explicit error handling:

```typescript
this.device.homey.setTimeout(async () => {
  try {
    await this.reconnect();
  } catch (error) {
    this.logger('Reconnection failed:', error);
    // Handle error gracefully - don't let it propagate
  }
}, delay);
```

#### Layer 2: Try-Catch Blocks

**Location**: Synchronous operations (circuit breaker cooldown)

```typescript
try {
  const result = performSynchronousOperation();
} catch (error) {
  this.logger('Operation failed:', error);
  // Graceful degradation
}
```

#### Layer 3: Global Process Handlers

**Location**: `app.ts`

Last resort safety net for any unhandled errors that escaped Layers 1-2:

```typescript
process.on('unhandledRejection', (reason, promise) => {
  this.error('Unhandled Promise Rejection:', reason);
  // Log but don't crash - app continues running
});

process.on('uncaughtException', (error) => {
  this.error('Uncaught Exception:', error);
  // Log critical error - may require app restart
});
```

### Device Status Synchronization

**Automatic Availability Management**:

- **After 5 consecutive failures**: `device.setUnavailable('Connection lost')`
  - Device marked unavailable in Homey UI
  - User notified via push notification (if configured)
  - Prevents automations from triggering on stale data

- **On successful reconnection**: `device.setAvailable()`
  - Device marked available again
  - Resume normal operation
  - User notified of recovery (if configured)

### Enhanced User Notifications

**Multi-Channel Notification System**:

1. **Push Notifications** (Homey mobile app)
   - Connection lost/restored
   - Critical errors requiring user action
   - Extended outage warnings (2min, 10min, 30min)

2. **Device Availability Status** (Homey UI)
   - Visual indicator (red = unavailable, green = available)
   - Status message with specific error
   - Last updated timestamp

3. **Service Health Monitoring** (App logs)
   - Detailed error categorization
   - Recovery attempt tracking
   - Performance metrics (connection uptime, failure rate)

### ECONNRESET Resilience

**Special Handling for Connection Reset Errors**:

**Problem**: Node.js socket ECONNRESET errors can crash the app if unhandled.

**Solution** (v0.99.49):

- Deep socket error interception in TuyaConnectionService
- Catches ECONNRESET errors from TuyAPI internal socket
- Graceful degradation: mark disconnected, schedule reconnection
- No app crash, automatic recovery

```typescript
// @ts-expect-error - Accessing TuyAPI internal socket for crash prevention
const socket = this.tuya.client;

if (socket) {
  socket.on('error', (err: Error) => {
    if (err.message.includes('ECONNRESET')) {
      this.logger('Socket ECONNRESET detected - marking disconnected');
      this.isConnected = false;
      this.scheduleNextReconnectionAttempt();
      return; // Handled gracefully
    }
    // Other errors bubble up to TuyAPI
  });
}
```

## Error Recovery Workflow

```text
┌─────────────────────────────────────────────────┐
│             Error Occurs                        │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Error Categorization (TuyaErrorCategorizer) │
│     │                                           │
│     ▼                                           │
│  2. Recovery Strategy Selection                 │
│     ├─ Recoverable? → Automatic retry           │
│     ├─ Transient?   → Exponential backoff       │
│     ├─ Persistent?  → Circuit breaker           │
│     └─ Fatal?       → User notification         │
│                                                 │
│  3. Device Status Update                        │
│     ├─ 5+ failures? → setUnavailable()          │
│     └─ Recovered?   → setAvailable()            │
│                                                 │
│  4. User Notification                           │
│     ├─ Push notification (critical errors)      │
│     ├─ Device status message (all errors)       │
│     └─ App logs (detailed diagnostics)          │
│                                                 │
│  5. Recovery Attempt                            │
│     └─ scheduleNextReconnectionAttempt()        │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Best Practices

### For Service Developers

1. **Always use error categorization**: `TuyaErrorCategorizer.categorize(error)`
2. **Include recovery guidance**: User-friendly error messages
3. **Log structured errors**: Category, message, stack trace
4. **Implement graceful degradation**: Don't crash on single error
5. **Use triple-layer protection**: `.catch()` + `try-catch` + global handlers

### For Feature Development

1. **Async operations in timers**: Always wrap in try-catch
   ```typescript
   this.homey.setTimeout(async () => {
     try {
       await asyncOperation();
     } catch (error) {
       this.logger('Operation failed:', error);
     }
   }, delay);
   ```

2. **Promise chains**: Always include `.catch()`
   ```typescript
   fetchData()
     .then(processData)
     .then(saveData)
     .catch(error => this.logger('Pipeline failed:', error));
   ```

3. **Event handlers**: Synchronous, with async callbacks wrapped
   ```typescript
   this.tuya.on('data', (data): void => {
     this.processData(data).catch(err => this.logger('Process failed:', err));
   });
   ```

## Testing Error Scenarios

**Common test cases**:

1. **Network failure**: Disconnect WiFi during operation
2. **Timeout**: Block device communication (firewall)
3. **Invalid credentials**: Change Device ID/Local Key
4. **Device offline**: Power off device
5. **Extended outage**: 30+ minute internet outage
6. **Rapid reconnects**: Router reboots, WiFi switching

**Expected behavior**:
- No app crashes ✓
- Graceful degradation ✓
- Automatic recovery within 5-15 minutes ✓
- User notified of issues ✓
- Device marked unavailable during outage ✓

---

**Related Documentation**:
- [Service Architecture](SERVICE_ARCHITECTURE.md)
- [Heartbeat Mechanism](HEARTBEAT_MECHANISM.md)
- [Reconnection Resilience](SERVICE_ARCHITECTURE.md#reconnection-resilience-v105)
