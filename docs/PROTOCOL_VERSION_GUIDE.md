# Protocol Version Troubleshooting Guide

## For Users Experiencing ECONNRESET or Connection Issues

If you're experiencing frequent connection resets, disconnections, or the device becoming unavailable, the issue may be caused by a **protocol version mismatch** between the app and your heat pump device.

### Symptoms of Protocol Version Mismatch

- ✗ Frequent "ECONNRESET" errors in logs
- ✗ Device constantly reconnecting (status shows "reconnecting")
- ✗ Device becomes unavailable repeatedly
- ✗ Connection works briefly then fails
- ✗ App appears to crash or become unresponsive

### How to Fix: Update Your Protocol Version

#### Step 1: Determine Your Device's Protocol Version

Most Adlar/Castra heat pumps use protocol version **3.3** (default), but some newer models require **3.4** or **3.5**.

**If you're unsure which version your device uses:**
- Check your device manual or specifications
- Contact Adlar support with your device model number
- Try the versions in order: 3.4 first (most common alternative), then 3.5

#### Step 2: Use Device Repair to Update Protocol Version

1. **Open the Homey app** on your phone/tablet
2. **Navigate to your heat pump device**
3. **Tap the settings (gear) icon** in the top right
4. **Scroll down and tap "Repair device"**
5. **Enter your device credentials:**
   - Device ID (same as before)
   - Local Key (same as before)
   - IP Address (same as before)
   - **Protocol Version** ← **SELECT THE CORRECT VERSION HERE**
     - Try **3.4** if you're having connection issues
     - Try **3.5** if 3.4 doesn't work
6. **Tap "Continue"** and complete the repair process

#### Step 3: Verify the Connection

After repair:
- Check the device status - it should show "connected" within 1-2 minutes
- Check the connection status capability: `adlar_connection_status`
- Monitor for 10-15 minutes to ensure stable connection
- If still having issues, try a different protocol version

### Protocol Version Reference

| Version | Common Use Case |
|---------|----------------|
| **3.3** | Older Adlar/Aurora models (DEFAULT) |
| **3.4** | Newer Adlar models, most common alternative |
| **3.5** | Latest models, less common |

### Success Indicators

✓ Connection status shows "connected" and stays connected
✓ No ECONNRESET errors in logs
✓ Sensor data updates regularly (every 20-30 seconds)
✓ Device commands work immediately
✓ No "unavailable" messages

### Still Having Issues?

If you've tried all three protocol versions and still have connection problems:

1. **Verify network connectivity:**
   - Heat pump has stable WiFi/LAN connection
   - Homey can reach the heat pump's IP address
   - No firewall blocking communication

2. **Check device credentials:**
   - Device ID is correct
   - Local Key hasn't changed
   - IP address is current (hasn't changed via DHCP)

3. **Contact support:**
   - Share which protocol versions you tried
   - Share error logs from Homey
   - Provide your device model number

## For New Device Pairing

When pairing a new device, you'll now see the protocol version dropdown:

1. Enter Device ID, Local Key, and IP Address
2. **Select Protocol Version:**
   - **3.3 (Default)** - Start here for most devices
   - **3.4** - Try if 3.3 has connection issues
   - **3.5** - Try if 3.4 has connection issues
3. Continue with pairing

**Tip:** If unsure, start with 3.3. You can always change it later using device repair.

## Technical Background

The Tuya protocol version determines how the app communicates with your device at the network level. Using the wrong version causes:
- Malformed network packets
- Socket connection errors (ECONNRESET)
- Authentication failures
- Data corruption

Different heat pump models/firmware versions require different protocol versions. There's no harm in trying different versions - just use device repair to switch.

## Version History

- **v0.99.59** - Added protocol version selection during pairing and repair
- **v0.99.58 and earlier** - Hardcoded to version 3.3 (caused issues for some users)

---

**Need Help?** Report issues at: https://github.com/your-repo/issues
