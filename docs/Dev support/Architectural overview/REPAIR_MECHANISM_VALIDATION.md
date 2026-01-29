# Credential Management & Repair Mechanism Evolution

## Current State (v0.99.62+): Settings-Based Credential Updates

**Status**: ✅ **REPAIR FLOW REMOVED** - Replaced by direct settings form editing

### Architecture Change

The traditional Homey "Repair Device" flow has been **removed** in favor of direct credential editing via the device settings form. This simplification provides:

- **Single Source of Truth**: One way to update credentials (settings form)
- **Simpler UX**: No intermediary repair dialog
- **Transparent Updates**: Users see current values and edit directly
- **Same Functionality**: Auto-reconnection still works via `onSettings()` handler

### How Credential Updates Work (v0.99.62+)

**User Path**:
```
Device Settings → Scroll to top → Edit credential fields → Save
```

**Available Fields**:
- `device_id` (type: "text") - Tuya Device ID
- `local_key` (type: "text") - Tuya Local Key for encryption
- `ip_address` (type: "text") - Device IP address on local network
- `protocol_version` (type: "dropdown") - Tuya protocol version (3.3, 3.4, 3.5)

**Technical Flow**:
```typescript
1. User edits credential field(s) in settings form
   ↓
2. Homey calls device.onSettings(oldSettings, newSettings, changedKeys)
   ↓
3. Handler detects credential changes (device.ts:2527-2530)
   const credentialKeysChanged = changedKeys.filter(
     (key) => ['device_id', 'local_key', 'ip_address', 'protocol_version'].includes(key)
   );
   ↓
4. If credentials changed, reinitialize Tuya connection (device.ts:2544-2562)
   await this.serviceCoordinator.getTuyaConnection()?.reinitialize(newConfig);
   ↓
5. Device disconnects from old connection
   ↓
6. Device creates new TuyAPI instance with updated credentials
   ↓
7. Device reconnects automatically
   ↓
8. Status updates to "Connected (timestamp)"
```

**Implementation Reference**:
- **Settings Schema**: [driver.settings.compose.json:2-76](../../../drivers/intelligent-heat-pump/driver.settings.compose.json)
- **Credential Detection**: [device.ts:2527-2530](../../../drivers/intelligent-heat-pump/device.ts)
- **Auto-Reconnection**: [device.ts:2544-2569](../../../drivers/intelligent-heat-pump/device.ts)
- **Reinitialize Method**: [tuya-connection-service.ts:125-193](../../../lib/services/tuya-connection-service.ts)

---

## Historical Context: Repair Flow Evolution

### Version 0.99.59 and Earlier ❌
**Problem**: Settings fields were `type: "label"` (read-only)
**Solution**: Repair flow was the **only way** to update credentials
**Issue**: Repair flow had `"unknown_error_getting_file"` errors

### Version 0.99.61 ✅
**Change**: Fixed settings fields to `type: "text"` and `type: "dropdown"` (editable)
**Change**: Added `session.showView('enter_device_info')` to `onRepair()` method
**Result**: Both repair flow and settings form worked

### Version 0.99.62 ✅ (Current)
**Change**: Removed repair flow entirely
**Rationale**:
- Settings form now provides same functionality
- Simpler UX with one clear path
- Less code to maintain
- No platform convention requirements for credential updates

**Removed Components**:
- `"repair": [...]` section from [driver.compose.json](../../../drivers/intelligent-heat-pump/driver.compose.json)
- `onRepair()` method from [driver.ts](../../../drivers/intelligent-heat-pump/driver.ts) (commented out with explanation)
- Custom repair HTML view still exists at [enter_device_info.html](../../../drivers/intelligent-heat-pump/pair/enter_device_info.html) but only used for pairing

---

## For Developers: Restoring Repair Flow (If Needed)

If you need to restore the repair flow in the future:

### Step 1: Restore Repair Configuration
Add to `driver.compose.json`:
```json
"repair": [
  {
    "id": "enter_device_info"
  }
]
```

### Step 2: Uncomment onRepair Method
In `driver.ts`, uncomment the `onRepair()` method (currently at lines ~53-97)

### Step 3: Ensure showView Call Exists
Make sure the method ends with:
```typescript
await session.showView('enter_device_info');
```

### Step 4: Rebuild
```bash
npm run build
homey app validate
```

---

## Testing Credential Updates

### Test Case 1: Change Device ID
1. Go to Device Settings
2. Edit "Device ID" field at top
3. Click Save
4. ✅ Verify: Device status changes to "Reconnecting"
5. ✅ Verify: Device reconnects with new ID (or shows appropriate error)

### Test Case 2: Change IP Address
1. Change device's actual IP on network (router/DHCP)
2. Go to Device Settings → Edit "IP Address" field
3. Click Save
4. ✅ Verify: Device reconnects with new IP

### Test Case 3: Change Protocol Version
1. Go to Device Settings → "Protocol Version" dropdown
2. Select different version (e.g., 3.3 → 3.4)
3. Click Save
4. ✅ Verify: Device attempts reconnection with new protocol

### Test Case 4: Invalid Credentials
1. Enter invalid Device ID or Local Key
2. Click Save
3. ✅ Verify: Device shows "Unavailable" with error message
4. ✅ Verify: Can correct credentials via settings form
5. ✅ Verify: Device reconnects after correction

---

## Benefits of Settings-Based Approach

**For Users**:
- ✅ One clear way to update credentials (no confusion)
- ✅ See current values directly
- ✅ Edit in-place without separate dialog
- ✅ Standard settings UI (familiar pattern)

**For Developers**:
- ✅ ~40 lines less code to maintain
- ✅ Single code path for credential updates
- ✅ Easier to test and debug
- ✅ No dual UI maintenance

**For Support**:
- ✅ Simpler user instructions: "Edit credentials in settings"
- ✅ No repair flow troubleshooting needed
- ✅ Clear error messages in settings form

---

## Related Documentation

- [CLAUDE.md - Credential Management](../../../CLAUDE.md) - Developer guide
- [Settings Configuration](../../../drivers/intelligent-heat-pump/driver.settings.compose.json) - Settings schema
- [Device onSettings Handler](../../../drivers/intelligent-heat-pump/device.ts#L2527) - Implementation
- [TuyaConnectionService.reinitialize()](../../../lib/services/tuya-connection-service.ts#L125) - Reconnection logic
