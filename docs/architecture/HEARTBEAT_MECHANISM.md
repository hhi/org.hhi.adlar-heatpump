# Heartbeat Mechanism

**Parent Documentation**: [CLAUDE.md](../../CLAUDE.md)
**Related**: [SERVICE_ARCHITECTURE.md](SERVICE_ARCHITECTURE.md), [ERROR_HANDLING.md](ERROR_HANDLING.md)

## Overview

Multi-layer heartbeat system prevents zombie connections through complementary detection strategies. Each layer operates independently with increasing detection times, providing defense-in-depth against connection failures.

**Detection Speed Summary**:

| Layer | Detection Time | Method | Overhead | Added Version |
|-------|---------------|--------|----------|---------------|
| **Layer 0** | **35 seconds** | TuyaAPI heartbeat events | None (passive) | v1.1.2 |
| Layer 1-2 | 5 minutes | Hybrid heartbeat (get/set) | Low (conditional) | v0.99.98 |
| Layer 3 | 5 minutes | DPS refresh (NAT keep-alive) | Low (periodic) | - |
| Layer 4 | 10 minutes | Stale connection force-reconnect | None (check only) | v0.99.98 |

## Layer 0: Native Heartbeat Monitoring (v1.1.2)

**Purpose**: Fastest zombie connection detection via TuyaAPI's built-in heartbeat events.

**Implementation**: `lib/services/tuya-connection-service.ts:966-972, 1063-1115`

### Architecture

TuyaAPI emits `'heartbeat'` events approximately every 10 seconds when connected. Layer 0 passively monitors these events and triggers reconnection if heartbeats stop for more than 35 seconds.

```typescript
// Event listener - updates timestamp on each TuyaAPI heartbeat
this.tuya.on('heartbeat', (): void => {
  this.lastNativeHeartbeatTime = Date.now();
  this.logger('💓 Native heartbeat received');
});

// Monitoring interval - checks every 10 seconds if heartbeats have stopped
private startNativeHeartbeatMonitoring(): void {
  this.lastNativeHeartbeatTime = Date.now();

  this.nativeHeartbeatMonitorInterval = this.device.homey.setInterval(() => {
    if (!this.isConnected) return;

    const timeSinceLastHeartbeat = Date.now() - this.lastNativeHeartbeatTime;

    if (timeSinceLastHeartbeat > this.NATIVE_HEARTBEAT_TIMEOUT_MS) { // 35 seconds
      this.logger('❌ Layer 0: Native heartbeat timeout - zombie detected');
      this.isConnected = false;
      this.scheduleNextReconnectionAttempt();
    }
  }, 10000); // Check every 10 seconds
}
```

### Key Features

1. **Zero Network Overhead**: Event-driven, no active queries
2. **Fastest Detection**: 35-second timeout (5-8x faster than Layer 1-3)
3. **Zero False Positives**: If TuyaAPI heartbeats stop, connection is definitively dead
4. **Automatic Lifecycle**: Started on `'connected'` event, stopped on `disconnect()`
5. **Complements Other Layers**: Works alongside hybrid heartbeat and DPS refresh

### Benefits

- ✅ **Speed**: 35-second detection vs 5-10 minutes without Layer 0
- ✅ **Reliability**: Protocol-level signal (no guessing)
- ✅ **Efficiency**: Zero bandwidth consumption
- ✅ **Simplicity**: Single event listener + timer
- ✅ **Synergy**: Aligns with TCP keep-alive strategy (5-minute interval)

### User Impact

- **Pre-v1.1.2**: 5-10 minute "stuck connected" status during outages
- **Post-v1.1.2**: 35-second detection, near-immediate recovery

---

## Layer 1-2: Hybrid Heartbeat (v0.99.98-v1.0.31)

**Purpose**: Proactively detect zombie connections during idle periods when device appears connected but data flow has stopped.

**Problem Solved**: Prior to v0.99.98, devices could remain in "Connected" state for hours while the underlying TuyAPI connection was dead, requiring manual user intervention via "Force Reconnect" button. The heartbeat mechanism detects and recovers from these zombie connections automatically within 5-15 minutes.

**Enhanced v1.0.9 - Hybrid Approach**: Distinguishes between **sleeping devices** (responsive to commands but not queries) and **true disconnects** (unresponsive to all operations).

### Architecture

1. **Heartbeat Interval**: Every 5 minutes (`CONNECTION_HEARTBEAT_INTERVAL_MS`)
2. **Intelligent Skip Logic**:
   - Skips heartbeat if device sent data within last 4 minutes (80% of interval)
   - Prevents unnecessary network traffic for active connections
   - Only probes when device appears idle
3. **Hybrid Zombie Detection (v1.0.9)**:
   - **Layer 1**: Passive `tuya.get({ schema: true })` query (network-friendly)
   - **Layer 2**: Active `tuya.set({ dps: 1 })` wake-up (idempotent write)
   - 10-second timeout per layer (`HEARTBEAT_TIMEOUT_MS`)
   - Only marks disconnected if both layers fail
4. **Stale Connection Detection**:
   - Secondary protection layer in `scheduleNextReconnectionAttempt()`
   - Forces reconnection if no data for 10+ minutes (`STALE_CONNECTION_THRESHOLD_MS`)
   - Applies moderate backoff (1.5x multiplier) instead of aggressive exponential backoff
   - Single-source connection truth (v0.99.99) - eliminates race conditions

### Implementation (v1.0.9)

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
    // LAYER 1: Try passive get() first (network-friendly)
    try {
      await Promise.race([
        this.tuya.get({ schema: true }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Heartbeat get() timeout')),
          HEARTBEAT_TIMEOUT_MS)
        )
      ]);

      this.logger('✅ Heartbeat (get) successful - connection healthy');
      this.lastDataEventTime = Date.now();
      return; // Exit early - connection is healthy

    } catch (getError) {
      // LAYER 2: get() failed - try active set() wake-up
      this.logger('⚠️ Heartbeat get() failed, attempting wake-up set()...');

      const currentOnOff = this.device.getCapabilityValue('onoff') || false;

      try {
        await Promise.race([
          this.tuya.set({ dps: 1, set: currentOnOff }), // Idempotent write
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Heartbeat set() timeout')),
            HEARTBEAT_TIMEOUT_MS)
          )
        ]);

        this.logger('✅ Heartbeat (wake-up set) successful - device was sleeping');
        this.lastDataEventTime = Date.now();
        return; // Recovery successful!

      } catch (setError) {
        // Both layers failed - true disconnect
        throw new Error(`Both get() and set() failed - true disconnect`);
      }
    }

  } catch (error) {
    this.logger('❌ Heartbeat completely failed - true disconnect detected');
    this.isConnected = false;
    this.consecutiveFailures++;
    this.scheduleNextReconnectionAttempt();
  } finally {
    this.heartbeatInProgress = false;
  }
}
```

### Hybrid Approach Benefits (v1.0.9)

**Problem**: Devices can enter "sleep mode" where:
- Socket remains technically connected (TuyAPI state = connected)
- Device ignores passive queries (`get()` operations timeout)
- Device responds to active commands (`set()` operations succeed)
- Result: False positive disconnects → unnecessary reconnection cascades

**Solution**: Two-layer heartbeat strategy:

| Layer | Operation | Purpose | Latency | Network Impact |
|-------|-----------|---------|---------|----------------|
| **1** | `get({ schema: true })` | Test passive query response | 10s timeout | Minimal (read-only) |
| **2** | `set({ dps: 1, set: currentValue })` | Wake-up sleeping device | 10s timeout | Idempotent (no side effects) |

### Scenarios

1. **Active Device**: Layer 1 succeeds → Exit (0s latency, optimal)
2. **Sleeping Device**: Layer 1 fails → Layer 2 succeeds → Device wakes up (10s latency, avoids reconnect)
3. **True Disconnect**: Both layers fail → Mark disconnected → Reconnect cascade (20s latency, correct behavior)

### Why DPS 1 (onoff) is Safe

- Idempotent operation: Writing current value doesn't change device state
- Device ON + write `true` = no effect
- Device OFF + write `false` = no effect
- Zero user impact, pure wake-up signal

### Connection Health Tracking

Three timestamps track connection activity:
- `lastDataEventTime` - Last time device sent sensor data (any DPS update)
- `lastHeartbeatTime` - Last successful heartbeat probe
- `lastStatusChangeTime` - Last connection status change (connected/disconnected)

## Layer 4: Stale Connection Force-Reconnect (v0.99.98)

**Purpose**: Secondary protection layer that detects connections claiming to be active but haven't sent data in 10+ minutes.

The `scheduleNextReconnectionAttempt()` method includes Layer 4 protection:

```typescript
// Layer 4: Stale connection detection
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

## Single-Source Connection Truth (v0.99.99)

**Problem**: Prior to v0.99.99, the heartbeat timer and reconnection timer could conflict, causing extended disconnection periods.

**Solution**: Ensures only one reconnection source:

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

## Overall Benefits

- ✅ Detects zombie connections within 35 seconds (Layer 0) to 15 minutes (Layer 1-4)
- ✅ Minimal network overhead (intelligent skip logic)
- ✅ Works alongside reactive error handling (defense-in-depth)
- ✅ Automatic recovery without user intervention
- ✅ Eliminates extended disconnection periods
- ✅ Reduces need for manual "Force Reconnect" button usage
- ✅ Single-source connection management prevents race conditions (v0.99.99)
- ✅ **Distinguishes sleeping devices from true disconnects (v1.0.9)** - avoids unnecessary reconnection cascades
- ✅ **Transparent wake-up mechanism (v1.0.9)** - sleeping devices resume without user awareness
- ✅ **Zero user impact (v1.0.9)** - idempotent operations don't affect device state

## User Impact

- Device automatically recovers from idle connection failures
- "Connected" status remains accurate during idle periods
- Sensor data resumes automatically after network disruptions
- Reduced support burden (fewer manual interventions needed)
- **Sleeping devices wake up transparently (v1.0.9)** - no false disconnect notifications

---

**Related Documentation**:
- [Service Architecture](SERVICE_ARCHITECTURE.md#1-tuyaconnectionservice)
- [Reconnection Resilience](SERVICE_ARCHITECTURE.md#reconnection-resilience-v105)
- [Error Handling](ERROR_HANDLING.md)
