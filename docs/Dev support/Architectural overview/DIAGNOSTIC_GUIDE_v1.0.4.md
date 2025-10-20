# Diagnostic Guide: 06:35 Disconnect Investigation (v1.0.4)

## Executive Summary

After analyzing 24-hour memory data and code behavior, we've discovered that the **06:35 disconnect is NOT caused by the memory leak** (which was fixed in v1.0.3). Instead, it's a separate issue that manifests at a specific time each day.

**Version v1.0.4 adds comprehensive diagnostic logging** to identify which of three possible causes is triggering the 06:35 disconnect:

1. **External Device Disconnect** - Warmtepomp sending 'disconnected' signal
2. **Socket-Level Error** - Network connection failure (ECONNRESET, timeout, etc.)
3. **Heartbeat Timeout** - Our periodic probe detecting zombie connection

---

## Background: What We Know

### ✅ Fixed Issues (v1.0.2-v1.0.3)
- Memory leak resolved: Baseline stabilized at 64-65 MB (was drifting to 70 MB)
- TuyAPI state desync fixed: Force disconnect before reconnect
- Periodic DPS refresh added: Should prevent heartbeat timeouts during idle

### ⚠️ Remaining Mystery: 06:35 Disconnect
- Occurs DAILY at almost exactly 06:35
- Occurs despite Fix 2 (Periodic DPS Refresh)
- Memory is STABLE at ~69.5 MB when disconnect happens (rules out memory pressure)
- Recovery occurs automatically in ~1-2 minutes
- NOT acceptable for production reliability

---

## How to Use Enhanced Diagnostics (v1.0.4)

### Step 1: Deploy v1.0.4

The v1.0.4 release includes enhanced logging that tracks:

#### 🔴 Disconnect Events
```
🔴 TuyaConnectionService: Device disconnected at 06:35:42 (no data for 127s)
```

#### ⏭️ Skipped Heartbeats (Working as Expected)
```
TuyaConnectionService: ⏭️ Heartbeat skipped at 06:30:15 - device active (data received 45s ago)
```

#### 🔍 Heartbeat Probes (Device Appears Idle)
```
🔍 TuyaConnectionService: Heartbeat probe at 06:35:10 - no data for 245s, checking connection health...
```

#### 🧪 Periodic DPS Refresh (Should Update Activity)
```
TuyaConnectionService: ✅ Periodic DPS refresh at 06:32:00 - activity timestamp updated
```

#### ⚠️ Socket Errors (Network Layer)
```
⚠️ TuyaConnectionService: Socket error at 06:35:42: ECONNRESET
```

---

## Diagnostic Scenario Analysis

### Scenario A: Problem is External Device Disconnect
**You'll see logs like:**
```
06:34:50  ✅ Periodic DPS refresh at 06:34:50 - activity timestamp updated
06:35:10  ⏭️ Heartbeat skipped at 06:35:10 - device active (data received 20s ago)
06:35:42  🔴 Device disconnected at 06:35:42 (no data for 0s)
```

**Interpretation:** Periodic DPS refresh is working perfectly, heartbeat is being skipped, but the device itself sends a disconnect signal at 06:35:42.

**Likely Cause:** Warmtepomp firmware has a scheduled maintenance event, DLC reset, or other internal operation that gracefully disconnects at 06:35.

**Action:** This might be ACCEPTABLE behavior if reconnection is automatic and immediate (currently takes 1-2 min with backoff).

---

### Scenario B: Problem is Socket-Level Failure
**You'll see logs like:**
```
06:34:50  ✅ Periodic DPS refresh at 06:34:50 - activity timestamp updated
06:35:10  ⏭️ Heartbeat skipped at 06:35:10 - device active (data received 20s ago)
06:35:42  ⚠️ Socket error at 06:35:42: ECONNRESET (no data for 0s)
```

**Interpretation:** Network layer fails catastrophically with connection reset error.

**Likely Cause:** Router WiFi drops, device WiFi module crash, ISP intermittent loss.

**Action:** This is a network reliability issue outside app control. Would need network diagnostics.

---

### Scenario C: Problem is Fix 2 Not Working (Heartbeat Timeout)
**You'll see logs like:**
```
06:34:50  ⚠️ Periodic DPS refresh at 06:34:50 failed: ECONNREFUSED
06:35:10  🔍 Heartbeat probe at 06:35:10 - no data for 340s, checking connection health...
06:35:42  ❌ Heartbeat failed at 06:35:42 - zombie connection detected
```

**Interpretation:** Periodic DPS refresh is failing, so `lastDataEventTime` doesn't get updated, heartbeat probe executes and detects zombie connection.

**Likely Cause:** Network glitch at 06:34 prevents DPS refresh, then heartbeat at 06:35 finds dead connection.

**Action:** This would indicate Fix 2 needs enhancement (more aggressive retry, fallback mechanism).

---

## What to Do Next

### For Users Who Want to Help Debug

1. **Deploy v1.0.4** (available now)
2. **Collect logs for 3-5 days** around the 06:35 time window
3. **Look for the pattern** in your logs - which scenario matches?
4. **Report findings** with sample logs showing:
   - Time of disconnect
   - What logs appear 5 minutes before
   - Any errors captured (socket errors, refresh failures, etc.)

### For Users Who Need Immediate Workaround

If the 06:35 disconnect is unacceptable, we have options:

**Option A: Disable Heartbeat** (Trade-off: Slower zombie detection)
```typescript
// In TuyaConnectionService.initialize()
// Comment out: this.startHeartbeat();
```

**Option B: Add Auto-Recovery for 06:35**
```typescript
// Automatically force reconnect 30 seconds after disconnect
if (timeSinceDisconnect > 30000) {
  this.forceReconnect();
}
```

**Option C: Investigate Device Firmware**
- Check if warmtepomp has scheduled maintenance at 06:35
- Check device logs for any scheduled operations
- Contact manufacturer support

---

## Technical Deep Dive: Why Periodic DPS Refresh Might Not Be Enough

### The Timeline Problem

The periodic DPS refresh runs every **3 minutes**, but the heartbeat checks every **5 minutes** with intelligent skip logic:

```
06:30:00  DPS Refresh → lastDataEventTime = 06:30:00
06:33:00  DPS Refresh → lastDataEventTime = 06:33:00
06:35:00  Heartbeat Check:
          timeSinceLastData = 2 minutes (< 4 minute threshold)
          Result: Skipped ✅
06:36:00  DPS Refresh → lastDataEventTime = 06:36:00
```

**This should work perfectly!** So if heartbeat is being skipped but device still disconnects, it means:

1. **The disconnect is not from heartbeat probe failure** (something else triggered it)
2. **The device itself initiated disconnect** (external trigger)
3. **Or the periodic DPS refresh itself failed** (preventing activity timestamp update)

---

## Expected Outcomes

### Best Case: External Device Disconnect
- **Finding**: Logs show device disconnecting but refresh/heartbeat working fine
- **Verdict**: Not a critical app issue - device firmware behavior
- **Fix**: Contact manufacturer or implement app-level auto-reconnect with minimal backoff
- **Timeline**: User gets automatic reconnection within 1-2 minutes

### Worst Case: Chronic Network Issues
- **Finding**: Socket errors and refresh failures at 06:35
- **Verdict**: Network reliability problem
- **Fix**: Investigate WiFi/router/ISP; improve wireless signal
- **Timeline**: Requires environmental changes, not app changes

### Best for App: Fix 2 Working Perfectly
- **Finding**: All logs show DPS refresh succeeding, heartbeat skipped, device disconnects anyway
- **Verdict**: Confirms periodic DPS refresh is working correctly
- **Next Step**: Accept external device behavior, implement graceful reconnect
- **Impact**: Proves our fixes are effective - remaining issue is device firmware behavior

---

## Changelog Entry (When Fixed)

Once we identify the root cause and implement v1.0.5:

```
"Device now automatically recovers from 06:35 disconnect events within 30 seconds using aggressive reconnection strategy."
```

---

## Questions for Investigation

1. **Is the 06:35 time in your local timezone or UTC?**
   - This helps determine if it's a scheduled event or coincidence

2. **Does the disconnect happen if you manually restart the app during 06:30-06:40?**
   - If no → suggests scheduled device event
   - If yes → suggests network timing coincidence

3. **Does it happen if device is in different mode (heating vs cooling)?**
   - If no → suggests mode-specific firmware event
   - If yes → suggests general device behavior

4. **Has the warmtepomp manufacturer mentioned any scheduled operations?**
   - Check device manual for maintenance cycles
   - Check app settings for any scheduled tasks

---

## v1.0.4 Changes Summary

### New Diagnostic Tracking
- `lastDisconnectSource`: Tracks which event caused disconnect
- `lastDisconnectTime`: Records exact timestamp of disconnect
- Enhanced timestamps: HH:MM:SS format on all events

### Enhanced Event Handlers
- Error events: Capture socket error type + message
- Disconnected events: Log time since last data received
- Heartbeat execution: Show whether skipped or executed
- DPS refresh: Log success/failure with timestamps

### Logging Improvements
- 🔴 Red circle for disconnect events
- ⏭️ Rewind symbol for skipped heartbeats
- 🔍 Magnifying glass for active heartbeat probes
- ⚠️ Warning sign for socket errors
- ✅ Check mark for successful operations

---

## Next Steps

**For the user:**
1. Update to v1.0.4
2. Monitor logs around 06:35 for 3-5 days
3. Share sample logs showing the pattern
4. Answer the investigation questions above

**For the developer:**
Once we have diagnostic logs, we'll know which of three paths to take:
- **Path A**: Accept external device behavior, add app-level auto-recovery
- **Path B**: Fix network resilience issues in WiFi/router configuration
- **Path C**: Further enhance Fix 2 with retry logic and fallbacks

---

*Generated with v1.0.4 - Diagnostic Release*
*Focus: Identify the exact cause of daily 06:35 disconnect*
