# TuyaConnectionService Reconnection Analysis - Complete Documentation Index

## Overview
This folder contains a comprehensive analysis of all reconnection decision points in the TuyaConnectionService. The analysis identifies how, when, and where reconnection is triggered, including event-based triggers, time-based mechanisms, error recovery strategies, and multi-layer zombie connection detection.

**Analysis Date:** November 2024
**Service Version:** v1.0.25 (with v0.99.98+ features)
**Total Lines Analyzed:** 1,683 lines
**Decision Points Identified:** 10 major triggers + 5 supporting mechanisms

---

## Document Guide

### 1. RECONNECTION_DECISION_MAP.md (27 KB)
**Complete technical reference for all reconnection logic**

- **9-Section Deep Dive** covering every decision point
- **Decision Trees** showing conditional logic flows
- **Line-by-line** documentation with code references
- **Status Enum States** and transitions
- **Notification Timeline** with milestones
- **Multi-Layer Protection Summary** table
- **Error Recovery State Machine** diagram

**Best for:** Understanding the complete architecture, detailed debugging, implementation changes

**Key Sections:**
- Section 1: Summary table of all 9 triggers
- Section 2: Detailed breakdown of each decision point
- Section 3: Priority and flow analysis
- Section 4: Error recovery state machine
- Section 5: Status enum transitions
- Section 6-9: Timelines, flow diagrams, and reference tables

---

### 2. RECONNECTION_TRIGGERS_QUICK_REF.txt (17 KB)
**Quick lookup reference with organized categorization**

- **Structured by Type:** Event-based, time-based, hybrid triggers
- **Trigger Dependency Tree** showing how triggers call each other
- **Response Time Hierarchy** from fastest to slowest
- **Backoff Strategies** for each error type
- **Zombie Detection** multi-layer overview
- **Status Transitions** quick reference
- **Key Constants** with values

**Best for:** Quick lookups, finding specific triggers, understanding trigger relationships

**Key Sections:**
- Section 1: 6 event-based immediate triggers
- Section 2: 3 time-based scheduled triggers
- Section 3: Hybrid detection mechanisms
- Section 4: Dependency tree showing trigger flow
- Section 5: Response time priorities
- Section 6-9: Backoff, zombie detection, status, and constants

---

### 3. RECONNECTION_ARCHITECTURE_DIAGRAM.txt (20 KB)
**Visual flowcharts and diagrams**

- **ASCII Art Flowcharts** showing decision trees
- **Real-World Timeline** example (device loses internet)
- **Immediate Triggers** visualization (< 1 second)
- **Core Reconnection Loop** detailed flow
- **Proactive Monitoring** background tasks
- **System State Timeline** with recovery stages
- **Critical Recovery Paths** summary

**Best for:** Visual learners, understanding flow relationships, planning outage recovery

**Key Sections:**
- Immediate triggers flowchart
- Core reconnection loop layer breakdown
- Proactive monitoring overview
- Real-world outage scenario timeline
- Decision flowchart
- Critical paths summary (fastest to slowest)

---

## Quick Navigation Guide

### Finding Specific Information

**"Where is reconnection triggered?"**
→ Start with **QUICK_REF.txt Section 1** (Event-based triggers)

**"How does exponential backoff work?"**
→ See **DECISION_MAP.md Section 2.4** (Scheduled Reconnection Loop)

**"What is zombie connection detection?"**
→ Check **QUICK_REF.txt Section 7** or **ARCHITECTURE.txt Proactive Monitoring**

**"How long until reconnection succeeds?"**
→ Look at **ARCHITECTURE.txt Critical Paths Summary**

**"What triggers circuit breaker?"**
→ Review **DECISION_MAP.md Section 4** (Error Recovery State Machine)

**"How are notifications sent?"**
→ See **DECISION_MAP.md Section 6** (Notification Timeline)

**"What are the 4 status states?"**
→ Find **DECISION_MAP.md Section 5** or **QUICK_REF.txt Section 8**

**"How does DPS refresh keep connection alive?"**
→ Check **DECISION_MAP.md Section 2.9** or **QUICK_REF.txt Section 7**

---

## Summary of All Reconnection Triggers

### Event-Based Triggers (Reactive)
| ID | Trigger | Line(s) | Type | Response |
|---|---|---|---|---|
| A | TuyAPI Error Event | 770-797 | Event | Waits for interval |
| B | Disconnected Event | 854-876 | Event | Waits for interval |
| C | Deep Socket Error | 719-742 | Event | IMMEDIATE schedule |
| D | Heartbeat Failure | 1227-1245 | Event+Time | IMMEDIATE schedule |
| E | Force Reconnect | 443-480 | User Action | IMMEDIATE attempt |
| F | DPS Refresh Zombie | 975-982 | Time+Event | IMMEDIATE reconnect |

### Time-Based Triggers (Scheduled)
| ID | Trigger | Line(s) | Interval | Response |
|---|---|---|---|---|
| G | Reconnection Loop | 1287-1437 | Exponential 20s-5min | Core engine |
| H | Heartbeat Monitor | 1047-1250 | 5 minutes | Probe or reconnect |
| I | Health Check | 1008-1026 | 1 hour | Force reconnect |

### Detection Mechanisms
| ID | Mechanism | Line(s) | Purpose | Action |
|---|---|---|---|---|
| J | Stale Detection | 1295-1320 | Find stuck connections | Apply backoff |

---

## Architecture Highlights

### Multi-Layer Protection System

1. **Reactive Events** (< 1 sec response)
   - Deep socket errors
   - Disconnect signals
   - User force reconnect

2. **Heartbeat Probing** (5-minute interval)
   - Layer 1: Passive get() query
   - Layer 2: Active set() wake-up
   - Detection: Zombie if no data event

3. **DPS Refresh** (3-minute interval)
   - Queries device state
   - Verifies data events fire
   - Immediate action if zombie detected

4. **Stale Detection** (10-minute threshold)
   - Checks if claimed connected with no data
   - Applies moderate backoff
   - Forces reconnection

5. **Circuit Breaker** (5-minute cooldowns)
   - Triggers after 5 consecutive failures
   - Max 3 cycles (15 minutes)
   - DNS probes every 30 seconds
   - Switch to 2.5-minute continuous retry

6. **Periodic Safety Net** (1-hour interval)
   - Ultimate guarantee against zombies
   - Forces full reconnect cycle
   - Absolute fallback

### Key Constants

```
RECONNECTION_INTERVAL_MS ............. 20 seconds (base)
CONNECTION_HEARTBEAT_INTERVAL_MS .... 5 minutes
DPS_REFRESH_INTERVAL_MS ............. 3 minutes
STALE_CONNECTION_THRESHOLD_MS ....... 10 minutes
CIRCUIT_BREAKER_RESET_TIME .......... 5 minutes
MAX_CIRCUIT_BREAKER_CYCLES .......... 3
HEARTBEAT_TIMEOUT_MS ............... 10 seconds
MAX_RECONNECTION_INTERVAL_MS ....... 30 minutes
MAX_CONSECUTIVE_FAILURES ........... 5
```

---

## Decision Flow Summary

```
EVENT → Categorize Error → scheduleNextReconnectionAttempt()
                                    ↓
                    [5 LAYERS OF ORCHESTRATION]
                    ├─ Layer 1: Outage tracking
                    ├─ Layer 2: Stale detection
                    ├─ Layer 3: Time-based notifications (2m, 10m, 30m)
                    ├─ Layer 4: Circuit breaker (5m cooldowns, max 3 cycles)
                    └─ Layer 5: Exponential backoff calculation
                                    ↓
                        Schedule attemptReconnectionWithRecovery()
                                    ↓
                    [CONNECTION ATTEMPT WITH RECOVERY]
                    ├─ Force disconnect (state sync)
                    ├─ 2-second stabilization delay
                    ├─ Try connectTuya()
                    ├─ IF SUCCESS: Reset state, mark available
                    └─ IF FAILURE: Increment counter, recurse to scheduleNextReconnectionAttempt()
                                    ↓
                        [BACKGROUND MONITORING CONTINUES]
                        ├─ Heartbeat every 5 minutes
                        ├─ DPS refresh every 3 minutes
                        └─ Health check every 1 hour
```

---

## Example Recovery Scenarios

### Scenario 1: Brief Network Hiccup (30 seconds)
```
T+0:00   Socket error detected
T+0:20   First reconnection attempt (20s base interval)
T+0:30   Connection succeeds, error state reset
```

### Scenario 2: Extended Outage (5 minutes)
```
T+0:00   Disconnect event
T+0:20   Attempt 1 fails → 1.5x backoff (30s)
T+0:50   Attempt 2 fails → 1.5x backoff (45s)
T+1:35   Attempt 3 fails → 1.5x backoff (67s)
T+2:42   Attempt 4 fails → 1.5x backoff (100s)
T+4:22   Attempt 5 fails → CIRCUIT BREAKER (5min cooldown)
T+4:30   Heartbeat detects recovery → immediate DNS probe
T+4:31   Connection succeeds, error state reset
```

### Scenario 3: Sustained Outage (> 15 minutes)
```
T+0:00   ... [first 5 attempts same as Scenario 2] ...
T+4:22   Attempt 5 fails → CIRCUIT BREAKER CYCLE 1 (5-min cooldown)
T+9:22   Cycle 1 expires → CIRCUIT BREAKER CYCLE 2 (5-min cooldown)
T+14:22  Cycle 2 expires → CIRCUIT BREAKER CYCLE 3 (5-min cooldown)
T+19:22  Cycle 3 expires → SWITCH TO SLOW RETRY (2.5-min intervals)
T+21:52  Slow retry attempt succeeds after internet restoration
         → Error state reset, full recovery
```

### Scenario 4: With Zombie Detection (Highest Recovery Assurance)
```
T+0:00   Connection claimed active but no data for 10 minutes
T+0:01   DPS refresh queries device, no data event within 10s
T+0:05   Zombie detected! forceReconnect() IMMEDIATE
T+0:10   Full reconnect succeeds (connection reset)
```

---

## Testing & Debugging

### To Test a Specific Trigger
1. Locate the trigger in **QUICK_REF.txt Section 1** for method name
2. Find detailed logic in **DECISION_MAP.md Section 2**
3. Check line references for exact code location
4. Review related tests in decision tree

### To Debug Recovery Issues
1. Check **ARCHITECTURE.txt Critical Paths** for expected timeline
2. Look for DNS issues (circuit breaker internet detection)
3. Verify backoff multiplier progression in logs
4. Check if zombie detection is catching the issue

### To Optimize Reconnection Speed
1. Review constants in **QUICK_REF.txt Section 9**
2. Consider which triggers apply to your scenario
3. Check if circuit breaker is needed (5+ failures)
4. Evaluate if zombie detection is preventing recovery

---

## File References

### From Source Code
```
TuyaConnectionService Location:
/lib/services/tuya-connection-service.ts (1,683 lines)

Key Methods:
- connectTuya() ..................... Line 281-384
- disconnect() ...................... Line 389-400
- forceReconnect() .................. Line 443-480
- performHeartbeat() ................ Line 1047-1250
- startPeriodicDpsRefresh() ......... Line 935-990
- startPeriodicHealthCheck() ........ Line 1008-1026
- scheduleNextReconnectionAttempt() . Line 1287-1437
- attemptReconnectionWithRecovery() . Line 1443-1510
- installDeepSocketErrorHandler() ... Line 702-753
- setupTuyaEventHandlers() .......... Line 759-877
```

### Related Files
- `lib/constants.ts` - Device constants (intervals, thresholds)
- `lib/error-types.ts` - Error categorization system
- `drivers/intelligent-heat-pump/device.ts` - Device integration

---

## Conclusion

The TuyaConnectionService implements a sophisticated multi-layered reconnection system with:

1. **Immediate response** to critical failures (< 1 second)
2. **Intelligent backoff** with exponential growth and circuit breaker
3. **Proactive zombie detection** with 5 parallel detection mechanisms
4. **Time-based notifications** at 2min, 10min, 30min milestones
5. **Internet recovery detection** during circuit breaker cooldowns
6. **Guaranteed recovery** within 2.5 minutes after internet restoration
7. **Ultimate safety net** with hourly health check reconnect

This ensures optimal recovery times across all failure scenarios while preventing reconnection storms during extended outages.

---

## Document Statistics

- **Total Pages:** ~60 pages (all 3 documents combined)
- **Total Size:** 64 KB
- **Line Numbers Documented:** 1,683 lines (100% coverage)
- **Decision Points:** 10 major triggers
- **Decision Layers:** 5 primary layers in core loop
- **Zombie Detection Methods:** 5 parallel detection systems
- **Status States:** 4 distinct states
- **Key Constants:** 13 configurable thresholds

---

**Last Updated:** November 2024
**For Questions:** Refer to relevant document sections and line numbers
