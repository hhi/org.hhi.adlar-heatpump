# Reconnection Log Patterns - Distinguishing Trigger Types

> ⚠️ **DEPRECATION NOTICE - v1.0.31 Architectural Changes**
>
> This document describes log patterns from v1.0.25-v1.0.30.
> **v1.0.31 changes** have modified when and how certain log messages appear.
> Log patterns for DPS refresh and stale connection detection may differ.
>
> **For current diagnostics**: See `CLAUDE.md` "Heartbeat Mechanism (v1.0.31)" for current log patterns.

## Overview

The TuyaConnectionService generates logs with **distinct signatures** that reveal which reconnection trigger was activated. This guide helps you quickly identify whether a reconnection was triggered by:
- **Event-Based (Reactive)** - Something just happened (error, disconnect, user action)
- **Time-Based (Proactive)** - Scheduled monitoring detected an issue

---

## Quick Reference by Emoji

```
🛡️  = Deep socket error intercepted       (EVENT-BASED - IMMEDIATE)
⚠️  = Socket/error event                   (EVENT-BASED - IMMEDIATE)
🔴 = Device disconnected                   (EVENT-BASED - IMMEDIATE)
✅ = Success/verification                  (TIME-BASED - checking)
🔍 = Heartbeat probe running               (TIME-BASED - 10 min interval)
⏭️  = Heartbeat skipped                    (TIME-BASED - 10 min interval)
🧟 = Zombie connection detected            (TIME-BASED - zombie detection)
🚨 = Stale connection detected             (TIME-BASED - 30 min threshold)
🔄 = Periodic health check                 (TIME-BASED - 1 hour interval)
(no emoji) = Generic message               (Could be either, check text)
```

---

## EVENT-BASED TRIGGERS (Immediate/Reactive)

These logs appear **instantly** when an event happens - they're not scheduled. Reconnection happens immediately or within seconds.

### 1. Deep Socket Error (Line ~720)

**Pattern:**
```
🛡️ Deep socket error intercepted (crash prevented): [ERROR_MESSAGE]
```

**Example:**
```
[14:23:45] 🛡️ Deep socket error intercepted (crash prevented): ECONNRESET
[14:23:45] TuyaConnectionService: Deep socket error handled gracefully - reconnection scheduled
```

**Key Indicators:**
- Shield emoji 🛡️
- "Deep socket error" text
- Specific error type (ECONNRESET, EPIPE, etc.)
- Happens at any time (unpredictable)

**Significance:** This is the **highest priority** - indicates TuyAPI's internal socket crashed and app would crash without this handler.

---

### 2. TuyAPI Error Event (Line ~776)

**Pattern:**
```
⚠️ Socket error at HH:MM:SS: [ERROR_MESSAGE]
```

**Example:**
```
[14:23:45] ⚠️ Socket error at 14:23:45: Connection timeout
[14:23:45] TuyaConnectionService: Non-recoverable socket error detected, applying immediate backoff
```

**Key Indicators:**
- Warning emoji ⚠️
- "Socket error at" with timestamp
- Error category (timeout, connection refused, etc.)
- Unpredictable timing

**Significance:** TuyAPI emitted an error event. This is reactive error handling.

---

### 3. Device Disconnected Event (Line ~860)

**Pattern:**
```
🔴 Device disconnected at HH:MM:SS (no data for Xs)
```

**Example:**
```
[14:23:45] 🔴 Device disconnected at 14:23:45 (no data for 125s)
[14:23:45] TuyaConnectionService: Status changed to disconnected, updating timestamp
```

**Key Indicators:**
- Red circle emoji 🔴
- "Device disconnected at" with timestamp
- Duration since last data: "(no data for Xs)"
- Unpredictable timing

**Significance:** TuyAPI's 'disconnected' event fired. Device already lost connection.

---

### 4. Force Reconnect (User Action) (Line ~444)

**Pattern:**
```
TuyaConnectionService: Force reconnect triggered by user
```

**Example:**
```
[14:45:30] TuyaConnectionService: Force reconnect triggered by user
[14:45:30] TuyaConnectionService: Socket stabilization delay complete - proceeding with reconnection
[14:45:31] TuyaConnectionService: Error recovery state reset - ready for fresh connection
[14:45:31] TuyaConnectionService: Attempting connection...
```

**Key Indicators:**
- "Force reconnect triggered by user" message
- No emoji
- Followed by cleanup and immediate connection attempt
- Tied to user action (settings or button click)

**Significance:** User clicked "Force reconnect" button. This overrides all normal backoff logic.

---

### 5. Data Event Received (Line ~802, 822)

**Pattern:**
```
Data received from Tuya: {...}
DP-Refresh received from Tuya: {...}
```

**Example:**
```
[14:23:45] TuyaConnectionService: Data received from Tuya: {"dps":{"1":true,"2":25.0}}
[14:23:46] TuyaConnectionService: DP-Refresh received from Tuya: {"dps":{"104":2500}}
```

**Key Indicators:**
- "Data received from Tuya" or "DP-Refresh received from Tuya"
- JSON payload with DPS values included
- Shows actual sensor data
- Not a reconnection trigger itself, but **prevents** reconnection (data proves connection alive)

**Significance:** This is **evidence of health**, not a trigger. Presence of these logs means no reconnection should happen.

---

## TIME-BASED TRIGGERS (Scheduled/Proactive)

These logs appear on **fixed intervals** - they're predictable. Reconnection is scheduled with backoff unless immediate action needed.

### 1. Heartbeat Probe (Line ~1126)

**Pattern:**
```
🔍 Heartbeat probe at HH:MM:SS - no data for Xs, checking connection health...
```

**Example:**
```
[14:33:45] 🔍 Heartbeat probe at 14:33:45 - no data for 623s, checking connection health...
[14:33:45] TuyaConnectionService: ✅ Heartbeat (get) successful - verifying data event reception...
[14:33:46] TuyaConnectionService: ✓ Data event confirmed - connection truly healthy
```

**Interval:** Every 10 minutes (`CONNECTION_HEARTBEAT_INTERVAL_MS`)

**Key Indicators:**
- Loupe emoji 🔍
- "Heartbeat probe at" with timestamp
- "no data for Xs" (idle time)
- Follows 10-minute schedule

**Significance:** Proactive check. Device appears connected but hasn't sent data. Testing if it's a zombie.

---

### 2. Heartbeat Skipped (Active Device) (Line ~1121)

**Pattern:**
```
⏭️ Heartbeat skipped at HH:MM:SS - device active (data received Xs ago)
```

**Example:**
```
[14:33:45] ⏭️ Heartbeat skipped at 14:33:45 - device active (data received 45s ago)
```

**Interval:** Every 10 minutes (scheduled, but skipped)

**Key Indicators:**
- Skip emoji ⏭️
- "Heartbeat skipped at" with timestamp
- "device active" message
- Recent data timestamp

**Significance:** Heartbeat ran on schedule but was skipped because device has recent data. **No reconnection occurs.**

---

### 3. Heartbeat Get() Success (Line ~1150)

**Pattern:**
```
✅ Heartbeat (get) successful - verifying data event reception...
```

**Example:**
```
[14:33:45] ✅ Heartbeat (get) successful - verifying data event reception...
[14:33:46] TuyaConnectionService: ✓ Data event confirmed - connection truly healthy
```

**Interval:** Every 10 minutes (when heartbeat runs)

**Key Indicators:**
- Checkmark emoji ✅
- "(get) successful" text
- Followed by verification of data event

**Significance:** Layer 1 of heartbeat probe succeeded. Still checking for zombie connection.

---

### 4. Heartbeat Wake-Up Set() (Line ~1196)

**Pattern:**
```
TuyaConnectionService: ⚠️ Heartbeat get() failed at HH:MM:SS, attempting wake-up set()...
TuyaConnectionService: ✅ Heartbeat (wake-up set) successful - verifying data event...
```

**Example:**
```
[14:33:46] ⚠️ Heartbeat get() failed at 14:33:46, attempting wake-up set()...
[14:33:47] ✅ Heartbeat (wake-up set) successful - verifying data event reception...
[14:33:48] TuyaConnectionService: ✓ Data event confirmed - device successfully woken
```

**Interval:** Every 10 minutes (when heartbeat runs)

**Key Indicators:**
- "Heartbeat get() failed" followed by "wake-up set()"
- Layer 2 fallback mechanism
- Set() operation with idempotent DPS value

**Significance:** Layer 1 (passive) failed, trying Layer 2 (active wake-up). Device may be sleeping but not disconnected.

---

### 5. Zombie Connection Detected (Line ~1158, 1204)

**Pattern:**
```
🧟 ZOMBIE CONNECTION DETECTED - get() succeeded but NO data event received!
🧟 ZOMBIE CONNECTION DETECTED - set() succeeded but NO data event received!
```

**Example:**
```
[14:33:46] 🧟 ZOMBIE CONNECTION DETECTED - get() succeeded but NO data event received!
[14:33:46] TuyaConnectionService: Forcing full reconnect to recover from zombie state...
[14:33:47] TuyaConnectionService: Disconnecting from device to reset connection
```

**Interval:** Every 10 minutes (when heartbeat detects this condition)

**Key Indicators:**
- Zombie emoji 🧟
- "ZOMBIE CONNECTION DETECTED" in all caps
- "(get/set) succeeded but NO data event"
- Followed by immediate reconnection

**Significance:** **Critical detection.** Connection appears active (get/set succeeded) but device not sending data (no data event). Requires immediate full reconnect.

---

### 6. DPS Refresh Probe (Line ~965, 977)

**Pattern:**
```
TuyaConnectionService: ✅ Periodic DPS refresh at HH:MM:SS - data event confirmed
```

**OR**

```
🧟 TuyaConnectionService: ZOMBIE CONNECTION DETECTED at HH:MM:SS - DPS refresh get() succeeded but NO data event
```

**Example (Success):**
```
[14:38:24] TuyaConnectionService: ✅ Periodic DPS refresh at 14:38:24 - data event confirmed, timestamp updated
```

**Example (Zombie):**
```
[14:53:42] 🧟 TuyaConnectionService: ZOMBIE CONNECTION DETECTED at 14:53:42 - DPS refresh get() succeeded but NO data event!
[14:53:42] TuyaConnectionService: Forcing full reconnect to recover...
```

**Interval:** Every 15 minutes (`DPS_REFRESH_INTERVAL_MS`)

**Key Indicators:**
- "Periodic DPS refresh at" with timestamp
- Either checkmark ✅ (success) or zombie 🧟 (failure)
- Data event confirmation or "NO data event" detection

**Significance:** Secondary check during idle periods. Prevents heartbeat timeouts by keeping connection active. Also detects zombies.

---

### 7. Stale Connection Detection (Line ~1303)

**Pattern:**
```
🚨 Stale connection detected - no data for Xs (threshold: Xs)
TuyaConnectionService: Forcing reconnection for stale connection
```

**Example:**
```
[14:58:24] 🚨 Stale connection detected - no data for 1856s (threshold: 1800s)
[14:58:24] TuyaConnectionService: Forcing reconnection for stale connection
[14:58:25] TuyaConnectionService: Scheduling reconnection attempt in 0ms
```

**Interval:** Continuous check in `scheduleNextReconnectionAttempt()` loop

**Key Indicators:**
- Alarm emoji 🚨
- "Stale connection detected" message
- Duration comparison: "no data for Xs (threshold: Xs)"
- Threshold: 30 minutes (1800 seconds)

**Significance:** Secondary protection. If heartbeat and DPS refresh missed a zombie, stale detection catches it by checking if connection has been idle too long.

---

### 8. Periodic Health Check (Line ~1020)

**Pattern:**
```
🔄 TuyaConnectionService: Periodic health check at HH:MM:SS - forcing full reconnect
```

**Example:**
```
[20:23:45] 🔄 TuyaConnectionService: Periodic health check at 20:23:45 - forcing full reconnect to prevent zombie state
[20:23:45] TuyaConnectionService: Disconnecting from device to reset connection
```

**Interval:** Every 1 hour (`healthCheckIntervalMs` = 1 hour by default)

**Key Indicators:**
- Refresh emoji 🔄
- "Periodic health check at" with timestamp
- "forcing full reconnect"
- Very long interval (1 hour)

**Significance:** Nuclear option. After 1 hour, force a full reconnect to ensure connection is truly fresh and not stuck in some bad state.

---

### 9. Circuit Breaker Cooldown (Line ~1361)

**Pattern:**
```
TuyaConnectionService: Circuit breaker open, cooling down for Xs more
```

**Example:**
```
[14:23:50] TuyaConnectionService: Circuit breaker open, cooling down for 245s more
[14:23:51] TuyaConnectionService: ✅ Internet recovered during cooldown - attempting immediate reconnection
```

**Key Indicators:**
- "Circuit breaker open, cooling down"
- Countdown in seconds
- OR "Internet recovered" message (DNS probe succeeded)

**Significance:** After 3 failed reconnection attempts, circuit breaker activates. Prevents connection storm. Continues checking internet connectivity every 30 seconds.

---

### 10. Scheduled Reconnection Attempt (Line ~1400+)

**Pattern:**
```
TuyaConnectionService: Scheduling reconnection attempt in [backoffMs]ms
```

**Example:**
```
[14:23:47] TuyaConnectionService: Scheduling reconnection attempt in 20000ms
[14:24:07] TuyaConnectionService: Attempting connection...
```

**Key Indicators:**
- "Scheduling reconnection attempt in" message
- Milliseconds countdown (20s → 40s → 80s... up to 5min or 2.5min)
- Exponential backoff values

**Significance:** Time-based scheduling. Not immediate - deferred until backoff time expires. Shows the exponential backoff multiplier in action.

---

## Log Pattern Decision Table

Use this to quickly identify any log:

```
START: Read a TuyaConnectionService log

├─ Does it have emoji?
│  ├─ 🛡️ ⚠️ 🔴 → EVENT-BASED (reactive error)
│  ├─ 🔍 ⏭️ ✅ 🧟 🚨 🔄 → TIME-BASED (scheduled check)
│  └─ No emoji → Check message text
│
├─ Does it have "HH:MM:SS" timestamp in message?
│  ├─ YES → Usually TIME-BASED (heartbeat, probe, health check)
│  └─ NO → Could be either (check emoji or keywords)
│
├─ Does it mention "Scheduling reconnection"?
│  ├─ YES → TIME-BASED (deferred retry with backoff)
│  └─ NO → Check if immediate action (event-based)
│
├─ Does it say "triggered by user"?
│  ├─ YES → EVENT-BASED (user action, synchronous)
│  └─ NO → Not user-initiated
│
├─ Does it contain "Zombie", "Stale", "Periodic", "Heartbeat"?
│  ├─ Zombie/Stale → TIME-BASED detection
│  ├─ Periodic/Heartbeat → TIME-BASED scheduled check
│  └─ (none) → Likely EVENT-BASED
│
└─ Does it say "Error", "failed", or error code?
   ├─ With emoji/time → Likely TIME-BASED check failure
   └─ Without scheduling → Likely EVENT-BASED error event
```

---

## Real-World Log Sequence Examples

### Example 1: Event-Based Disconnect (Network Failure)

```
[14:23:45] ⚠️ Socket error at 14:23:45: ECONNRESET
[14:23:45] 🛡️ Deep socket error intercepted (crash prevented): ECONNRESET
[14:23:45] TuyaConnectionService: Socket error handled gracefully - reconnection scheduled
[14:23:46] TuyaConnectionService: Scheduling reconnection attempt in 20000ms
[14:23:46] TuyaConnectionService: Outage tracking started
[14:24:07] TuyaConnectionService: Attempting connection...
[14:24:08] TuyaConnectionService: Connected to Tuya device successfully
[14:24:09] TuyaConnectionService: Data received from Tuya: {"dps":{"1":true}}
```

**Analysis:**
1. **Event-based trigger** (⚠️ socket error) happens at 14:23:45
2. **Immediately scheduled** with 20-second backoff
3. **Time-based retry** executes 20 seconds later
4. **Reconnection succeeds**, data received
5. **Outage duration**: 22 seconds (from error to data)

---

### Example 2: Time-Based Heartbeat Detection (Zombie)

```
[14:33:45] ⏭️ Heartbeat skipped at 14:33:35 - device active (data received 45s ago)
[14:43:45] 🔍 Heartbeat probe at 14:43:45 - no data for 623s, checking connection health...
[14:43:46] TuyaConnectionService: ✅ Heartbeat (get) successful - verifying data event reception...
[14:43:47] ⚠️ Heartbeat get() failed, attempting wake-up set()...
[14:43:48] 🧟 ZOMBIE CONNECTION DETECTED - set() succeeded but NO data event received!
[14:43:48] TuyaConnectionService: Forcing full reconnect to recover from zombie state...
[14:43:49] TuyaConnectionService: Scheduling reconnection attempt in 0ms
[14:43:49] TuyaConnectionService: Attempting connection...
[14:43:50] TuyaConnectionService: Connected to Tuya device successfully
```

**Analysis:**
1. **Time-based trigger** (🔍 heartbeat probe at 10-minute mark)
2. Heartbeat detected zombie (device didn't respond with data)
3. **Immediate reconnection** scheduled (0ms backoff for zombie)
4. **Recovery time**: 5 seconds
5. Device was completely offline, heartbeat caught it

---

### Example 3: Time-Based Stale Connection

```
[14:38:24] ✅ Periodic DPS refresh at 14:38:24 - data event confirmed, timestamp updated
[14:53:42] 🚨 Stale connection detected - no data for 1856s (threshold: 1800s)
[14:53:42] TuyaConnectionService: Forcing reconnection for stale connection
[14:53:43] TuyaConnectionService: Scheduling reconnection attempt in 0ms
[14:53:44] TuyaConnectionService: Attempting connection...
[14:53:45] TuyaConnectionService: Connected to Tuya device successfully
```

**Analysis:**
1. Last data at 14:38:24 (DPS refresh)
2. 15 minutes later (14:53:42), stale detection fires
3. **Time-based trigger** (🚨 stale connection)
4. **Immediate reconnection** (0ms backoff)
5. Device was stuck idle, forced refresh recovered it

---

### Example 4: User-Initiated Force Reconnect

```
[14:45:30] TuyaConnectionService: Force reconnect triggered by user
[14:45:30] TuyaConnectionService: Socket stabilization delay complete
[14:45:30] TuyaConnectionService: Error recovery state reset - ready for fresh connection
[14:45:31] TuyaConnectionService: Attempting connection...
[14:45:32] TuyaConnectionService: Connected to Tuya device successfully
[14:45:33] TuyaConnectionService: Data received from Tuya: {"dps":{"1":true}}
```

**Analysis:**
1. **Event-based trigger** (user action - synchronous, not scheduled)
2. **No backoff** - immediate reconnection attempt
3. State reset bypasses error recovery logic
4. **Quick recovery**: 2 seconds

---

## Summary Table

| Trigger Type | Pattern | Interval | Log Emoji | Priority | Action |
|---|---|---|---|---|---|
| Deep Socket Error | Crash prevented | Any time | 🛡️ | CRITICAL | Immediate reconnect |
| TuyAPI Error | Socket error | Any time | ⚠️ | HIGH | Scheduled with backoff |
| Disconnected Event | Unexpected disconnect | Any time | 🔴 | HIGH | Scheduled with backoff |
| Force Reconnect | User button | Any time | (none) | CRITICAL | Immediate, bypass backoff |
| Heartbeat Probe | Periodic check | 10 min | 🔍 | MEDIUM | Check zombie, then act |
| Zombie Detection | No data after probe | 10 min | 🧟 | CRITICAL | Immediate reconnect |
| DPS Refresh | Periodic keepalive | 15 min | (none) | MEDIUM | Keep connection fresh |
| Stale Connection | Idle too long | Continuous | 🚨 | HIGH | Immediate reconnect |
| Periodic Health | Time-based safety | 1 hour | 🔄 | MEDIUM | Full reconnect |
| Scheduled Retry | Backoff delay | 20s-5min | (none) | LOW | Retry connection |

---

## Tips for Troubleshooting with Logs

1. **Find the first problematic log**
   - Look for ⚠️, 🔴, 🛡️ (event-based) or 🧟, 🚨 (detected issue)

2. **Check if it's event or time-based**
   - Event: Happens at unpredictable time
   - Time-based: Happens at regular intervals (every 10min, 15min, 30min, 1hr)

3. **Calculate recovery time**
   - Find first error timestamp
   - Find first "Data received" timestamp after
   - Difference = actual recovery time

4. **Look for cascading triggers**
   - One trigger might cause another
   - Example: Event error → scheduled retry → timeout → new event

5. **Check for patterns**
   - Same time every day? → Time-based issue (periodic check)
   - Random times? → Event-based issue (network, device)
   - Around specific intervals? → Stale/zombie detection

---

## See Also

- [RECONNECTION_ANALYSIS_INDEX.md](RECONNECTION_ANALYSIS_INDEX.md) - Master navigation guide
- [RECONNECTION_DECISION_MAP.md](RECONNECTION_DECISION_MAP.md) - Technical decision points and code locations
- [RECONNECTION_TRIGGERS_QUICK_REF.txt](RECONNECTION_TRIGGERS_QUICK_REF.txt) - Quick lookup tables
