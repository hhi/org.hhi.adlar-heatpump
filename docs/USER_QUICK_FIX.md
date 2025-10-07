# Quick Fix for ECONNRESET Connection Issues

## 🚨 For Users Experiencing Connection Resets

If your heat pump keeps disconnecting with ECONNRESET errors, the issue is likely a **protocol version mismatch**.

## ✅ Solution: Change Protocol Version to 3.4

### Steps (Takes 2 minutes):

1. Open **Homey app** → Go to your heat pump device
2. Tap **⚙️ Settings** (top right) → Scroll down
3. Tap **"Repair device"**
4. Enter your existing credentials:
   - Device ID: *(same as before)*
   - Local Key: *(same as before)*
   - IP Address: *(same as before)*
   - **Protocol Version: SELECT 3.4** ← **CHANGE THIS**
5. Tap **Continue**
6. Wait 1-2 minutes for reconnection

### Expected Result:
- ✓ Connection status shows "connected"
- ✓ No more ECONNRESET errors
- ✓ Sensor data updates smoothly
- ✓ Device stays connected

### Still Not Working?
Try protocol version **3.5** using the same repair steps.

### Why Does This Happen?
Different heat pump models use different Tuya protocol versions. The app previously defaulted to 3.3, but many newer models need 3.4 or 3.5.

---

**Version 0.99.59** added protocol version selection to fix this issue permanently.

**Need detailed help?** See [PROTOCOL_VERSION_GUIDE.md](PROTOCOL_VERSION_GUIDE.md)
