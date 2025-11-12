# TuyaConnectionService - Complete Reconnection Decision Map

> ⚠️ **DEPRECATION NOTICE - v1.0.31 Architectural Changes**
>
> This document describes v1.0.25-v1.0.30 architecture.
> **v1.0.31 critical fixes removed**: DPS refresh `forceReconnect()` calls, early exit breaks, missing recovery paths.
> **Line number references may be inaccurate** after v1.0.31 changes.
>
> **Current reference**: See `CLAUDE.md` "Comprehensive Timer Management QA Audit" section.

## Overview

The TuyaConnectionService implements a multi-layered reconnection system with 7 distinct triggers across event-based and time-based mechanisms. This analysis maps every decision point that initiates reconnection logic.

---

## 1. RECONNECTION TRIGGERS - SUMMARY TABLE

| Trigger Type | Source | Method | Line(s) | Mechanism | Time-Based | Event-Based |
|--------------|--------|--------|---------|-----------|-----------|-------------|
| **Error Handler** | Socket Error | `tuya.on('error')` | 770-797 | Mark disconnected, apply backoff | No | Yes |
| **Disconnected Event** | TuyAPI Event | `tuya.on('disconnected')` | 854-876 | Mark disconnected, apply backoff | No | Yes |
| **Deep Socket Error** | Internal Socket | `installDeepSocketErrorHandler()` | 719-742 | Intercept ECONNRESET, schedule retry | No | Yes |
| **Scheduled Reconnection** | Timer Interval | `scheduleNextReconnectionAttempt()` | 1287-1437 | Exponential backoff loop | Yes | No |
| **Force Reconnect** | User Action | `forceReconnect()` | 443-480 | Manual override, reset backoff | No | Yes |
| **Heartbeat Failure** | Proactive Monitor | `performHeartbeat()` | 1227-1245 | Detect zombie connections | Yes | Yes |
| **Periodic Health Check** | Time-based Safety | `startPeriodicHealthCheck()` | 1015-1026 | Full reconnect every 1 hour | Yes | No |
| **DPS Refresh Zombie Detection** | Data Flow Monitor | `startPeriodicDpsRefresh()` | 975-982 | Detect get() success but no data event | Yes | Yes |
| **Stale Connection Detection** | Health Monitor | `scheduleNextReconnectionAttempt()` | 1295-1320 | No data for 10+ minutes | Yes | No |

---

## 2. DETAILED RECONNECTION DECISION POINTS

### 2.1 TuyAPI Error Event Handler

**Location:** `tuya-connection-service.ts:770-797`

```
Method: tuya.on('error')
Type: EVENT-BASED (reactive)
Trigger: TuyAPI socket error
Status: Activated during connection or data exchange
```

| Parameter | Value |
|-----------|-------|
| **Entry Point** | Line 770: `this.tuya.on('error', (error: Error): void => {` |
| **Trigger Condition** | Socket error (ECONNRESET, timeout, etc.) |
| **Decision Logic** | `if (!categorizedError.recoverable)` → aggressive backoff (line 787) |
| **Action** | Mark disconnected (line 783), notify error handler (line 792) |
| **Follow-up** | No direct reconnection call; relies on reconnection interval |
| **Impact** | Applies 1.5x backoff multiplier (capped at 8x) |

**Decision Tree:**

```
Socket Error
├─ Categorize error (recoverable vs non-recoverable)
├─ If non-recoverable:
│  └─ Apply aggressive backoff (1.5x multiplier)
├─ Mark isConnected = false
└─ Scheduled retry depends on reconnection interval
```

---

### 2.2 TuyAPI Disconnected Event

**Location:** `tuya-connection-service.ts:854-876`

```
Method: tuya.on('disconnected')
Type: EVENT-BASED (reactive)
Trigger: TuyAPI disconnected event (clean disconnect)
Status: Activated when device cleanly closes connection
```

| Parameter | Value |
|-----------|-------|
| **Entry Point** | Line 854: `this.tuya.on('disconnected', (): void => {` |
| **Trigger Condition** | Device sends close signal (expected behavior) |
| **Decision Logic** | Always mark disconnected; apply minimal backoff (line 870) |
| **Action** | `this.isConnected = false`, backoff *= 1.2 (line 870) |
| **Follow-up** | Status timestamp updated, no direct reconnection |
| **Backoff Applied** | 1.2x multiplier (capped at 4x) |

**Decision Tree:**

```
Disconnected Event
├─ Check time since last data
├─ Apply minimal backoff (1.2x, max 4x)
├─ Mark isConnected = false
└─ Notify disconnected handler
```

---

### 2.3 Deep Socket Error Handler (Crash Prevention)

**Location:** `tuya-connection-service.ts:719-742`

```
Method: installDeepSocketErrorHandler()
Type: EVENT-BASED (reactive, crash prevention layer)
Trigger: Raw socket error (ECONNRESET, etc.)
Status: Installed after every successful connection
```

| Parameter | Value |
|-----------|-------|
| **Entry Point** | Line 719: `tuyaSocket.on('error', (error: Error) => {` |
| **Trigger Condition** | Internal TuyAPI socket error (bypasses TuyAPI's error handler) |
| **Decision Logic** | Categorize error, decide recovery strategy (lines 723-736) |
| **Action** | `isConnected = false`, call `scheduleNextReconnectionAttempt()` (line 739) |
| **Follow-up** | **Direct reconnection scheduling** |
| **Recovery Strategy** | If non-recoverable → status='error'; if recoverable → status='disconnected' |

**Decision Tree:**

```
Deep Socket Error (ECONNRESET, etc.)
├─ Categorize as recoverable/non-recoverable
├─ If non-recoverable:
│  └─ Update status to 'error'
├─ If recoverable:
│  └─ Update status to 'disconnected'
└─ scheduleNextReconnectionAttempt() → IMMEDIATE RECONNECTION SCHEDULE
```

---

### 2.4 Scheduled Reconnection Loop (Core Engine)

**Location:** `tuya-connection-service.ts:1287-1437`

```
Method: scheduleNextReconnectionAttempt()
Type: TIME-BASED + EVENT-BASED
Trigger: Called by event handlers, heartbeat, stale connection detection
Status: The primary orchestration point for all reconnection logic
```

This is the **core reconnection decision engine** with 4 layers:

#### LAYER 1: Outage Tracking

**Lines:** 1288-1293

```
if (hasEverConnected && !isConnected && outageStartTime === 0)
  → outageStartTime = Date.now()
```

Tracks when disconnection began for notification timing.

#### LAYER 2: Stale Connection Detection

**Lines:** 1295-1320

```
if (isConnected) {
  timeSinceLastData = Date.now() - lastDataEventTime
  
  if (timeSinceLastData > STALE_CONNECTION_THRESHOLD_MS) {
    → isConnected = false
    → status = 'error'
    → backoffMultiplier *= 1.5 (capped at 8x)
    → CONTINUE TO RECONNECTION
  }
}
```

**Threshold:** 10 minutes (600,000ms)
**Purpose:** Detect "zombie" connections claiming to be active but with no data flow

#### LAYER 3: Time-Based Notifications

**Lines:** 1322-1352

```
if (outageStartTime > 0) {
  outageDuration = Date.now() - outageStartTime
  
  if (outageDuration >= 2 * 60 * 1000 && !notificationSent2Min)
    → Send "Connection Lost" notification
  
  if (outageDuration >= 10 * 60 * 1000 && !notificationSent10Min)
    → Send "Extended Outage" notification
  
  if (outageDuration >= 30 * 60 * 1000 && !notificationSent30Min)
    → Send "Critical Outage" notification
}
```

**Milestones:** 2 min, 10 min, 30 min
**Purpose:** Keep user informed of outage duration
**Notification Type:** Time-based (independent of failure count)

#### LAYER 4: Circuit Breaker with Cycle Limit

**Lines:** 1354-1404

```
if (circuitBreakerOpen) {
  timeSinceOpen = Date.now() - circuitBreakerOpenTime
  
  if (timeSinceOpen < CIRCUIT_BREAKER_RESET_TIME) {
    → Log cooldown countdown
    → Every 30 seconds: probe internet (DNS resolve google.com)
      → If resolved: closeCircuitBreaker() + retry immediately
      → If still offline: wait another 10s, check again
  }
  
  if (timeSinceOpen >= CIRCUIT_BREAKER_RESET_TIME) {
    circuitBreakerCycles++
    
    if (circuitBreakerCycles >= MAX_CIRCUIT_BREAKER_CYCLES) {
      → Switch to slow continuous retry (2.5 min intervals)
      → Set backoffMultiplier = 8
      → Log: "Max cycles reached, switching to slow continuous retry"
    } else {
      → Reset circuit breaker for another 5-minute cooldown
      → backoffMultiplier = 1 (fresh cycle)
      → consecutiveFailures = 0
    }
  }
}
```

**Circuit Breaker Parameters:**

- Reset time: 5 minutes (300,000ms)
- Max cycles: 3 (15 minutes total)
- After max cycles: Switch to continuous retry at 2.5-minute intervals
- Internet recovery detection: Every 30 seconds during cooldown

**Purpose:** Prevent infinite reconnection loop during sustained outage

#### LAYER 5: Exponential Backoff Calculation

**Lines:** 1406-1436

```
adaptiveInterval = min(
  baseInterval * backoffMultiplier,
  maxBackoffSeconds * 1000
)

// Enforce 30-minute maximum guarantee (v1.0.6)
if (timeSinceLastAttempt > MAX_RECONNECTION_INTERVAL_MS) {
  adaptiveInterval = 1000 // Force immediate retry
}

nextReconnectionTime = Date.now() + adaptiveInterval

this.reconnectInterval = setTimeout(() => {
  attemptReconnectionWithRecovery()
}, adaptiveInterval)
```

**Parameters:**

- Base interval: 20 seconds (RECONNECTION_INTERVAL_MS)
- Max backoff: 5 minutes (300 seconds)
- Multiplier range: 1x to 32x (depends on error type)
- Maximum guaranteed: 30 minutes (if stuck for 30+ min, force retry)

**Decision Flow:**

```
Schedule Next Reconnection
├─ LAYER 1: Track outage start time
├─ LAYER 2: Detect stale connections
│  ├─ If stale (>10 min no data) + claimed connected
│  └─ → Mark disconnected + apply 1.5x backoff
├─ LAYER 3: Send time-based notifications (2m, 10m, 30m)
├─ LAYER 4: Circuit breaker with cycle limit
│  ├─ If open + in cooldown
│  │  ├─ Probe internet every 30s
│  │  └─ If recovered → close breaker + retry immediately
│  ├─ If cooldown expired
│  │  ├─ Increment cycle counter
│  │  ├─ If max cycles reached
│  │  │  └─ Switch to slow retry (2.5 min intervals)
│  │  └─ Else reset for another 5-min cooldown
├─ LAYER 5: Calculate exponential backoff
│  ├─ adaptiveInterval = baseInterval * multiplier
│  ├─ Cap at maxBackoff (5 min)
│  ├─ Enforce 30-min maximum guarantee
│  └─ Schedule setTimeout for next attempt
└─ setTimeout() → attemptReconnectionWithRecovery()
```

---

### 2.5 Attempt Reconnection with Recovery

**Location:** `tuya-connection-service.ts:1443-1510`

```
Method: attemptReconnectionWithRecovery()
Type: ASYNC ATTEMPT (scheduled by reconnection loop)
Trigger: Called by reconnection interval timeout
Status: Executes actual connection attempt with error handling
```

| Parameter | Value |
|-----------|-------|
| **Entry Point** | Line 1443 |
| **Pre-check** | Line 1445: If already connected, exit early |
| **Force Disconnect** | Line 1455: Disconnect before reconnect (state sync) |
| **Status Update** | Line 1471: Set status to 'reconnecting' |
| **Connection Attempt** | Line 1474: `await this.connectTuya()` |
| **Success Path** | Line 1476-1495: Reset recovery state, mark available, notify recovery |
| **Failure Path** | Line 1497-1508: Increment failures, update strategy, schedule next attempt |

**Decision Logic (Simplified):**

```
Attempt Reconnection
├─ CHECK: If already connected → exit (line 1445)
├─ FORCE DISCONNECT (line 1455): Clean TuyAPI state
├─ WAIT: 2-second stabilization delay (line 1463-1467)
├─ TRY: connectTuya() with error handling (line 1474)
│
├─ IF SUCCESS:
│  ├─ Reset all error recovery state
│  ├─ Mark device as available
│  ├─ Send recovery notification (if extended outage)
│  └─ scheduleNextReconnectionAttempt() exits gracefully
│
└─ IF FAILURE:
   ├─ Increment consecutiveFailures (line 1499)
   ├─ updateRecoveryStrategy(error) (line 1502)
   │  ├─ If non-recoverable: set status to 'error'
   │  ├─ Apply exponential backoff:
   │  │  ├─ Recoverable: 1.5x (cap 16x)
   │  │  └─ Non-recoverable: 2.0x (cap 32x)
   │  └─ If failures > threshold: activate circuit breaker
   ├─ handleReconnectionFailureNotification(error) (line 1505)
   │  ├─ Non-recoverable + first 3 failures: mark unavailable
   │  └─ After 5 failures: mark unavailable with message
   └─ scheduleNextReconnectionAttempt() → retry with backoff
```

---

### 2.6 Heartbeat Monitoring (Proactive Zombie Detection)

**Location:** `tuya-connection-service.ts:1047-1250`

```
Method: performHeartbeat()
Type: TIME-BASED + EVENT-BASED (5-minute interval, but reactive to failures)
Trigger: `setInterval(performHeartbeat, 5 minutes)` from startHeartbeat()
Status: Runs every 5 minutes when connected
```

**Heartbeat Execution Flow:**

#### PRE-CHECKS

```
if (!isConnected) {
  Check if outage > 15 minutes
    → Attempt wake-up probe (optional)
    → Return early
}

if (heartbeatInProgress) {
  → Skip (prevent concurrent probes)
}

timeSinceLastData = Date.now() - lastDataEventTime
if (timeSinceLastData < 4 minutes) {
  → Skip heartbeat (device recently active)
}
```

#### LAYER 1: Passive Query (get())

**Lines:** 1137-1167

```
try {
  await Promise.race([
    tuya.get({ schema: true }),
    10-second timeout
  ])
  
  → Check if data event actually fired
  → If yes: ✅ Connection healthy
  → If no: Proceed to Layer 2
}
```

#### LAYER 2: Active Wake-up (set())

**Lines:** 1169-1213

```
catch (getError) {
  try {
    await Promise.race([
      tuya.set({ dps: 1, set: currentOnOff }),  // Idempotent write
      10-second timeout
    ])
    
    → Check if data event actually fired
    → If yes: ✅ Device was sleeping, now awake
    → If no: Proceed to failure
  } catch (setError) {
    → Both layers failed → true disconnect
    → Proceed to failure handling
  }
}
```

#### FAILURE HANDLING

**Lines:** 1227-1245

```
catch (error) {
  → Mark isConnected = false
  → Update status to 'disconnected'
  → Increment consecutiveFailures
  → scheduleNextReconnectionAttempt() → TRIGGER RECONNECTION
}
```

**Zombie Detection Logic:**

```
Heartbeat Probe
├─ SKIP if: not connected, probe already in progress, or device active
├─ LAYER 1: Passive get() query (network-friendly)
│  ├─ If succeeds + data event received
│  │  └─ ✅ Connection healthy → Exit
│  └─ If fails or no data event
│     └─ Proceed to Layer 2
├─ LAYER 2: Active set() wake-up (idempotent)
│  ├─ If succeeds + data event received
│  │  └─ ✅ Device was sleeping → Exit
│  └─ If fails or no data event
│     └─ Both layers failed → true disconnect
└─ FAILURE: Mark disconnected + schedule reconnection
```

**Zombie Detection Scenarios:**

| Scenario | Layer 1 | Layer 2 | Result |
|----------|--------|--------|--------|
| Active device | Succeeds + data | - | Connection OK, skip Layer 2 |
| Sleeping device | Timeout/fails | Succeeds + data | Device woke up, OK |
| True disconnect | Timeout/fails | Timeout/fails | Both failed → reconnect |
| Zombie | Succeeds, no data | Succeeds, no data | Socket alive but no data → reconnect |

---

### 2.7 Force Reconnect (User-Triggered)

**Location:** `tuya-connection-service.ts:443-480`

```
Method: forceReconnect()
Type: EXPLICIT USER ACTION (from device settings)
Trigger: User clicks "Force reconnect" button
Status: Immediate override of all reconnection delays
```

| Parameter | Value |
|-----------|-------|
| **Entry Point** | Line 443 |
| **Step 1** | Stop all timers (reconnect, heartbeat, DPS, health check) |
| **Step 2** | Disconnect cleanly (line 453) |
| **Step 3** | Wait 2 seconds for socket cleanup (line 457-459) |
| **Step 4** | Reset all error recovery state (line 463) |
| **Step 5** | Attempt immediate connection (line 468) |
| **Step 6** | Resume normal monitoring (line 476-479) |
| **Result** | Bypass all exponential backoff and circuit breaker |

**Decision Logic:**

```
Force Reconnect (User Action)
├─ Stop all background monitoring
├─ Cleanly disconnect from current connection
├─ Wait 2 seconds (socket stabilization)
├─ Reset error recovery state:
│  ├─ consecutiveFailures = 0
│  ├─ backoffMultiplier = 1
│  ├─ circuitBreakerOpen = false
│  ├─ outageStartTime = 0
│  └─ passiveReconnectionAttempts = 0
├─ Attempt immediate connection
└─ Resume normal reconnection monitoring
```

---

### 2.8 Periodic Health Check (Safety Net)

**Location:** `tuya-connection-service.ts:1008-1026`

```
Method: startPeriodicHealthCheck()
Type: TIME-BASED SAFETY NET
Trigger: Every 1 hour (3,600,000ms)
Status: Guaranteed reconnection even if zombie detection fails
```

| Parameter | Value |
|-----------|-------|
| **Entry Point** | Line 1015 |
| **Interval** | 1 hour (3,600,000ms) |
| **Purpose** | Force full reconnect cycle every hour as ultimate safety net |
| **Action** | Call `forceReconnect()` (line 1022) |
| **Result** | Complete disconnect + reconnect cycle |

**Decision Logic:**

```
Periodic Health Check (Every 1 Hour)
├─ Log: "Periodic health check - forcing full reconnect"
├─ Call forceReconnect() which:
│  ├─ Stops all monitoring
│  ├─ Disconnects cleanly
│  ├─ Resets error recovery state
│  ├─ Attempts immediate reconnection
│  └─ Resumes monitoring
└─ Guarantees recovery from zombie state
```

---

### 2.9 DPS Refresh Zombie Detection

**Location:** `tuya-connection-service.ts:935-990`

```
Method: startPeriodicDpsRefresh()
Type: TIME-BASED MONITORING (every 3 minutes)
Trigger: Timer interval, detects zombie connections
Status: Queries device state to keep connection fresh
```

**Enhanced Zombie Detection (v1.0.17):**

```
Every 3 minutes:
├─ Check: if (!isConnected || !tuya) → return (skip if disconnected)
├─ Save: preQueryDataTime = lastDataEventReceived
├─ Query: tuya.get({ schema: true })
├─ Wait: up to 10 seconds for data event
│
├─ IF data event received:
│  └─ ✅ Normal operation, update timestamp
│
└─ IF NO data event within 10 seconds:
   ├─ Log: "ZOMBIE CONNECTION DETECTED"
   ├─ Reason: get() succeeded but NO data event received
   ├─ Action: forceReconnect() (line 980)
   └─ Result: Full disconnect + reconnect cycle
```

**Decision Tree:**

```
Periodic DPS Refresh
├─ Every 3 minutes (if connected):
│  ├─ Query device state with tuya.get()
│  ├─ Wait for data event reception
│  │
│  ├─ IF data event received within 10s
│  │  └─ ✅ Normal: update timestamp
│  │
│  └─ IF NO data event within 10s
│     ├─ ❌ ZOMBIE DETECTED: socket active but no data
│     ├─ Log with visual indicator: "🧟"
│     └─ forceReconnect() → IMMEDIATE ACTION
```

---

### 2.10 Stale Connection Detection (Within Reconnection Loop)

**Location:** `tuya-connection-service.ts:1295-1320`

```
Method: scheduleNextReconnectionAttempt() LAYER 2
Type: TIME-BASED DETECTION
Trigger: Called periodically by reconnection loop
Status: Detects "zombie" connections claiming to be active
```

**Detection Logic:**

```
if (isConnected) {
  timeSinceLastData = Date.now() - lastDataEventTime
  
  if (timeSinceLastData > STALE_CONNECTION_THRESHOLD_MS) {
    // Threshold: 10 minutes (600,000ms)
    
    → Log: "Stale connection detected - no data for Xs (threshold: Ys)"
    → isConnected = false
    → status = 'error'
    → backoffMultiplier *= 1.5 (capped at 8x)
    → CONTINUE to reconnection attempt
  } else {
    → Connection healthy
    → return (skip reconnection)
  }
}
```

**Decision Logic:**

```
Stale Connection Detection
├─ Check: Is device claiming to be connected?
├─ Measure: Time since last data event
│
├─ IF time > 10 minutes:
│  ├─ ❌ STALE CONNECTION: socket open but no data
│  ├─ Mark disconnected
│  ├─ Apply moderate backoff (1.5x)
│  └─ Force reconnection attempt
│
└─ ELSE:
   └─ Connection healthy, skip reconnection
```

---

## 3. RECONNECTION TRIGGER PRIORITY & FLOW

### Priority Order (Immediate to Delayed)

```
1. IMMEDIATE (Synchronous)
   ├─ Deep Socket Error Handler (line 719)
   │  └─ scheduleNextReconnectionAttempt() [IMMEDIATE SCHEDULE]
   └─ Force Reconnect (line 443)
      └─ Attempts connection [IMMEDIATE]

2. FAST (Event-based, <1 second)
   ├─ TuyAPI Error Event (line 770)
   │  └─ Notifies handler, relies on interval
   ├─ Disconnected Event (line 854)
   │  └─ Notifies handler, relies on interval
   └─ Heartbeat Failure (line 1227)
      └─ scheduleNextReconnectionAttempt() [IMMEDIATE SCHEDULE]

3. MEDIUM (Regular interval, 5 minutes)
   ├─ DPS Refresh Zombie Detection (line 975)
   │  └─ forceReconnect() [IMMEDIATE TRIGGER]
   └─ Heartbeat Proactive Check (line 1047)
      └─ Executes every 5 minutes

4. SLOW (Scheduled, exponential backoff)
   ├─ Reconnection Loop (line 1426)
   │  └─ Scheduled by scheduleNextReconnectionAttempt()
   │  └─ Range: 20 seconds to 5 minutes (exponential)
   │  └─ Max guaranteed: 30 minutes
   └─ Periodic Health Check (line 1015)
      └─ Every 1 hour as ultimate safety net
```

---

## 4. ERROR RECOVERY STATE MACHINE

```
DISCONNECTED
├─ Event: Socket Error / Disconnect / Heartbeat Fail
├─ Action: consecutiveFailures++
│
├─ First Attempt (multiplier=1x)
│  └─ 20 second delay
│
├─ Subsequent Attempts (exponential backoff)
│  ├─ Recoverable error: 1.5x multiplier (cap 16x)
│  ├─ Non-recoverable error: 2.0x multiplier (cap 32x)
│  └─ Range: 20s → 300s (5 min)
│
├─ After 5 consecutive failures:
│  ├─ consecutiveFailures == 5
│  ├─ Activate circuit breaker
│  ├─ Status: 'error'
│  ├─ 5-minute cooldown begins
│  └─ Internet detection every 30s
│
├─ After 3 circuit breaker cycles (15 minutes):
│  ├─ MAX_CIRCUIT_BREAKER_CYCLES reached
│  ├─ Switch to continuous slow retry
│  ├─ Interval: 2.5 minutes (constant)
│  └─ Log: "Max cycles reached, switching to slow retry"
│
├─ Maximum 30-minute guarantee:
│  └─ If stuck longer than 30 minutes → force immediate retry
│
└─ On Successful Connection:
   └─ All state reset, backoffMultiplier=1x
```

---

## 5. STATUS ENUM STATES & TRANSITIONS

```
'disconnected' ← Initial state after startup/disconnect
├─ Triggered by: Socket error, disconnect event, stale connection
├─ Backoff applied: Yes (exponential)
└─ Can recover to: 'connected'

'reconnecting' ← Set during reconnection attempt
├─ Triggered by: User sees "Reconnecting [retry in Xs]"
├─ Backoff applied: Yes (continuing exponential)
└─ Can recover to: 'connected' or 'error'

'error' ← Non-recoverable error detected
├─ Triggered by: Non-recoverable categorized error
├─ Backoff applied: Yes (more aggressive 2.0x)
├─ User notification: "Device Connection Failed"
└─ Can recover to: 'connected' (after backoff)

'connected' ← Healthy connection
├─ Triggered by: tuya.on('connected') event
├─ Heartbeat: Proactive monitoring every 5 min
├─ DPS refresh: Every 3 min to keep alive
└─ Health check: Full reconnect every 1 hour
```

---

## 6. NOTIFICATION TIMELINE

```
Outage Duration Timeline:

T+0:00     → Disconnect event triggered
T+2:00     → "Device Connection Lost" notification
            → "Automatic recovery in progress"
            
T+10:00    → "Extended Device Outage" notification
            → "Please check network connectivity"
            
T+30:00    → "Critical Outage" notification
            → "Manual intervention may be required"

Throughout:
└─ Every 30 seconds during circuit breaker:
   → DNS probe (google.com)
   → If internet recovered: immediate retry
```

---

## 7. CONNECTIVITY FLOW DIAGRAM

```
START CONNECTED
│
├─ Every 5 minutes:
│  └─ performHeartbeat()
│     ├─ Check: data received in last 4 min?
│     │  └─ Yes → skip (device active)
│     │  └─ No → probe connection
│     │
│     ├─ Layer 1: tuya.get() + data event?
│     │  └─ Yes → ✅ exit
│     │  └─ No → try Layer 2
│     │
│     ├─ Layer 2: tuya.set() + data event?
│     │  └─ Yes → ✅ device woken, exit
│     │  └─ No → both failed
│     │
│     └─ Both failed → zombieDetected → forceReconnect()
│
├─ Every 3 minutes:
│  └─ periodicDpsRefresh()
│     ├─ tuya.get() call
│     └─ If no data event within 10s → forceReconnect()
│
├─ Every 1 hour:
│  └─ periodicHealthCheck()
│     └─ forceReconnect() as safety net
│
├─ EVENT: Socket error → scheduleNextReconnectionAttempt()
├─ EVENT: Disconnect event → scheduleNextReconnectionAttempt()
│
└─ scheduleNextReconnectionAttempt() runs continuously:
   ├─ Check stale connection (>10 min no data)
   ├─ Send notifications (2m, 10m, 30m marks)
   ├─ Manage circuit breaker (5 min cooldowns, max 3 cycles)
   ├─ Internet recovery detection (every 30s during cooldown)
   ├─ Calculate exponential backoff
   └─ Schedule next attemptReconnectionWithRecovery()
```

---

## 8. MULTI-LAYER PROTECTION SUMMARY

| Layer | Detection Method | Trigger | Response Time | Purpose |
|-------|-----------------|---------|----------------|---------|
| **1: Reactive Events** | Socket/Disconnect events | Immediate | <1 sec | Fast failure detection |
| **2: Passive Heartbeat** | get() query + data verification | Every 5 min | ~5 sec | Detect zombie sockets |
| **3: Active Heartbeat** | set() wake-up call | Every 5 min | ~10 sec | Wake sleeping devices |
| **4: DPS Refresh Monitoring** | Query + data event check | Every 3 min | ~10 sec | Continuous data flow check |
| **5: Stale Detection** | Time since last data | Every reconnection loop | <1 sec | Detect stuck connections |
| **6: Circuit Breaker** | Failure count + time | Every 5 minutes | ~5 min | Prevent reconnection storms |
| **7: Internet Recovery** | DNS probe (google.com) | Every 30s (during cooldown) | ~2 sec | Detect when internet restored |
| **8: Health Check** | Full reconnect cycle | Every 1 hour | ~2 sec | Ultimate safety net |
| **9: 30-Min Guarantee** | Timeout since last attempt | Every attempt | Immediate | Enforce maximum delay |

---

## 9. RECONNECTION DECISION SUMMARY TABLE

| Decision Point | Line(s) | Condition | Action | Outcome |
|---|---|---|---|---|
| TuyAPI Error | 770-797 | Socket error received | Mark disconnected, apply backoff | Scheduled retry |
| Disconnected Event | 854-876 | Clean disconnect signal | Mark disconnected, minimal backoff | Scheduled retry |
| Deep Socket Error | 719-742 | Raw socket ECONNRESET | Mark disconnected, immediate schedule | Schedule next attempt |
| Heartbeat Timeout (get+set) | 1227-1245 | Both get() and set() failed | Mark disconnected, increment failures | Schedule next attempt |
| Heartbeat Zombie (no data) | 1151-1162, 1197-1208 | Query succeeded but no data event | Force full reconnect | Immediate reconnect |
| Stale Connection | 1295-1320 | >10 min since last data | Mark disconnected, apply backoff | Scheduled retry |
| DPS Refresh Zombie | 975-982 | Query succeeded but no data event | Force full reconnect | Immediate reconnect |
| Reconnection Loop | 1426-1436 | Scheduled timeout expires | Execute attemptReconnectionWithRecovery | Try connection |
| Force Reconnect | 443-480 | User triggers button | Reset state + attempt immediately | Immediate connection |
| Periodic Health Check | 1015-1026 | 1-hour timer expires | Force full reconnect | Immediate reconnect |
| Internet Recovery | 1363-1375 | DNS resolve succeeds during cooldown | Close circuit breaker + retry | Immediate retry |
| Max Reconnection Time | 1415-1419 | >30 min since last attempt | Force immediate retry | Immediate reconnect |
