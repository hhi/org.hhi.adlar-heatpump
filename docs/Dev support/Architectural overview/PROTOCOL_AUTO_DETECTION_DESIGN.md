# Protocol Version Auto-Detection Design

## Problem Statement

Users experiencing ECONNRESET errors due to protocol version mismatch must manually:
1. Identify the problem is protocol-related
2. Use device repair to test different versions
3. Repeat until finding the correct version

**User Impact:** Poor UX, support burden, device unavailability during troubleshooting.

## Proposed Solution: Automatic Protocol Detection

When persistent ECONNRESET errors are detected, automatically attempt alternative protocol versions.

## Design Options

### Option A: Aggressive Auto-Switching (Recommended for MVP)

**Trigger Condition:**
- 5+ consecutive ECONNRESET errors within 2 minutes
- Connection never achieves stable state (< 10 seconds connected)

**Detection Flow:**
```
1. Device connects with stored version (e.g., 3.3)
2. ECONNRESET occurs → increment counter
3. At 5th ECONNRESET within 2min window:
   → Log: "Protocol mismatch suspected, attempting auto-detection"
   → Try next version in sequence [3.3 → 3.4 → 3.5 → 3.3]
4. If connection stable for 60 seconds:
   → Save new version to store/settings
   → Notify user: "Protocol version auto-updated to 3.X"
   → Log success for diagnostics
5. If all versions fail:
   → Revert to original version
   → Send notification: "Connection issues detected. Manual protocol selection needed."
```

**Implementation Location:**
- `TuyaConnectionService.installDeepSocketErrorHandler()` - Track ECONNRESET frequency
- New method: `attemptProtocolAutoDetection()` - Cycle through versions
- `ServiceCoordinator` - Coordinate version change and device reconnection

**Pros:**
- ✓ Automatic user problem resolution
- ✓ No user intervention needed
- ✓ Reduces support burden
- ✓ Improves perceived reliability

**Cons:**
- ✗ May cause temporary device unavailability during cycling
- ✗ Could mask underlying network issues
- ✗ Requires careful implementation to avoid infinite loops

### Option B: Conservative Suggestion-Based

**Trigger Condition:**
- Same as Option A (5+ ECONNRESET errors)

**Detection Flow:**
```
1. Detect pattern suggesting protocol mismatch
2. Send Homey notification:
   "Your heat pump may need a different protocol version.
    Current: 3.3
    Recommended: Try 3.4
    Use device repair to update."
3. Log diagnostic message
4. Keep using current protocol version
```

**Implementation Location:**
- `TuyaConnectionService` error handler
- Notification via Homey's notification system

**Pros:**
- ✓ Simple to implement
- ✓ No risk of incorrect auto-changes
- ✓ User maintains control

**Cons:**
- ✗ Still requires manual intervention
- ✗ Minimal improvement over current state

### Option C: Hybrid Approach (Best Long-Term)

**Phase 1: Detection & Notification**
```
ECONNRESET pattern detected → Send notification suggesting protocol change
```

**Phase 2: Smart Auto-Detection (Future)**
```
After 3 failed connection cycles (15 minutes):
→ Ask user permission via notification:
  "Would you like the app to automatically try different protocol versions? [Yes] [No]"
→ If Yes: Run Option A flow
→ If No: Keep suggesting manual repair
```

**Pros:**
- ✓ Best of both worlds
- ✓ User consent required
- ✓ Progressive enhancement

**Cons:**
- ✗ More complex implementation
- ✗ Requires notification interaction handling

## Recommended Implementation: **Option A** (MVP)

### Implementation Plan

#### 1. Add Protocol Cycling Logic to TuyaConnectionService

```typescript
// New properties
private econnresetErrors: Array<number> = []; // Timestamps
private protocolVersions: string[] = ['3.3', '3.4', '3.5'];
private currentProtocolIndex: number = 0;
private isAutoDetecting: boolean = false;
private originalProtocolVersion: string = '3.3';

// New method
private async attemptProtocolAutoDetection(): Promise<void> {
  if (this.isAutoDetecting) return; // Already running

  this.isAutoDetecting = true;
  this.originalProtocolVersion = this.config.version;

  this.logger('🔍 Protocol auto-detection starting...');

  // Try each version in sequence
  for (let i = 0; i < this.protocolVersions.length; i++) {
    this.currentProtocolIndex = (this.currentProtocolIndex + 1) % this.protocolVersions.length;
    const newVersion = this.protocolVersions[this.currentProtocolIndex];

    if (newVersion === this.originalProtocolVersion) continue; // Skip current version

    this.logger(`🔧 Trying protocol version: ${newVersion}`);

    // Disconnect current connection
    await this.destroy();

    // Update version and reconnect
    this.config.version = newVersion;
    await this.initialize(this.config);

    // Wait 60 seconds to test stability
    await this.testConnectionStability(60000);

    if (this.isStable) {
      // Success! Save new version
      await this.saveProtocolVersion(newVersion);
      await this.sendSuccessNotification(newVersion);
      this.isAutoDetecting = false;
      return;
    }
  }

  // All versions failed, revert to original
  this.logger('⚠️ Protocol auto-detection failed. Reverting to original version.');
  this.config.version = this.originalProtocolVersion;
  await this.initialize(this.config);
  await this.sendFailureNotification();
  this.isAutoDetecting = false;
}

// Enhanced error tracking
private trackEconnresetError(): void {
  const now = Date.now();
  this.econnresetErrors.push(now);

  // Keep only errors from last 2 minutes
  this.econnresetErrors = this.econnresetErrors.filter(
    timestamp => now - timestamp < 120000
  );

  // Trigger auto-detection if threshold met
  if (this.econnresetErrors.length >= 5 && !this.isAutoDetecting) {
    this.logger('🚨 ECONNRESET threshold reached. Starting auto-detection...');
    this.attemptProtocolAutoDetection().catch(err => {
      this.logger('Auto-detection error:', err);
    });
  }
}
```

#### 2. Integration Points

**In `installDeepSocketErrorHandler()`:**
```typescript
tuyaSocket.on('error', (error: Error) => {
  // Existing logging...

  // NEW: Track ECONNRESET for auto-detection
  if (error.message.includes('ECONNRESET')) {
    this.trackEconnresetError();
  }

  // Existing error handling...
});
```

**New method in Device class:**
```typescript
async saveProtocolVersion(version: string): Promise<void> {
  await this.setStoreValue('protocol_version', version);
  await this.setSettings({ protocol_version: version });
  this.log(`Protocol version updated to: ${version}`);
}
```

#### 3. User Notifications

**Success Notification:**
```
🎉 Connection Issue Resolved!

Your heat pump's protocol version was automatically updated from 3.3 to 3.4.
The device should now maintain a stable connection.

No action needed - everything is working correctly.
```

**Failure Notification:**
```
⚠️ Connection Issue Detected

Your heat pump is experiencing persistent connection resets.
Automatic protocol detection was unsuccessful.

Action needed:
1. Open device settings
2. Tap "Repair device"
3. Try protocol versions: 3.4 or 3.5

Need help? See: PROTOCOL_VERSION_GUIDE.md
```

## Testing Strategy

1. **Unit Tests:**
   - ECONNRESET counter logic
   - Protocol cycling sequence
   - Threshold detection

2. **Integration Tests:**
   - Simulate ECONNRESET errors
   - Verify protocol switching
   - Test notification delivery

3. **User Acceptance Testing:**
   - Test with devices requiring 3.4 configured as 3.3
   - Verify stable connection after auto-detection
   - Confirm settings persist after app restart

## Rollout Plan

### Phase 1: Current Release (v0.99.59)
- ✓ Manual protocol selection during pairing
- ✓ Device repair to change protocol version
- ✓ User documentation (PROTOCOL_VERSION_GUIDE.md)

### Phase 2: Auto-Detection Beta (v0.100.x)
- Implement Option A (aggressive auto-switching)
- Add feature flag to enable/disable auto-detection
- Beta test with known 3.4/3.5 users
- Collect metrics on success rate

### Phase 3: General Release (v0.101.x)
- Enable auto-detection by default
- Refine based on beta feedback
- Add dashboard/settings UI to show auto-detection history

## Risk Mitigation

**Risk: Auto-detection creates more problems than it solves**
- Mitigation: Feature flag to disable, extensive logging, revert on failure

**Risk: Infinite reconnection loops**
- Mitigation: Cooldown period (5 minutes) between detection attempts

**Risk: User confusion about version changes**
- Mitigation: Clear notifications, log entries, version visible in settings

**Risk: Network issues misidentified as protocol issues**
- Mitigation: Require 5+ errors in 2 minutes (not just isolated errors)

## Success Metrics

- % of devices that auto-detect successfully
- Reduction in ECONNRESET-related support tickets
- User satisfaction scores
- Device uptime improvement

## Alternative Considered: Device Fingerprinting

Could we detect protocol version based on device responses?
- **Challenge:** Tuya doesn't provide version discovery API
- **Risk:** Device-specific fingerprinting unreliable
- **Verdict:** Protocol cycling more reliable

## Open Questions

1. Should we limit auto-detection attempts per device lifetime?
2. Should we track which devices needed version changes for future analytics?
3. Should auto-detection be opt-in or opt-out?

## Conclusion

**Recommendation:** Implement Option A in v0.100.x as beta feature.

The protocol mismatch issue significantly impacts user experience. Auto-detection provides immediate value with manageable risk. The current manual solution (v0.99.59) provides stopgap while we develop and test the automatic solution.

**Next Steps:**
1. Review this design with maintainers
2. Create implementation ticket
3. Develop feature branch with feature flag
4. Beta test with affected users
5. Iterate based on feedback
