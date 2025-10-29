This app gives you complete control over your Adlar Castra Aurora heat pump directly via your Homey smart home system. You can monitor, operate and optimize your heat pump without depending on internet connections.

Supported Languages
🇬🇧 English
🇩🇪 Deutsch
🇫🇷 Français
🇳🇱 Nederlands

KEY BENEFITS

LOCAL CONTROL
- Direct connection to your heat pump via the local network
- No internet connection needed for daily use
- Fast response times and reliable connection

ADVANCED MONITORING
- Real-time temperature measurements (12 different sensors)
- Power consumption and efficiency monitoring
- Automatic COP (coefficient of performance) calculation with 8 different methods
- Seasonal SCOP analysis according to European standards

COMPLETE OPERATION
- Temperature setting and heating modes
- Heating curve adjustments
- Hot water temperature control
- Timer and automatic functions

INTELLIGENT AUTOMATION
- 67 flow cards for advanced automation
- Smart error detection and recovery
- Weather-dependent optimization
- Energy efficiency trends and warnings

USER-FRIENDLY
- Fully localized interface (English/Dutch)
- Mobile-friendly display
- Clear status indicators
- Understandable error messages

INSTALLATION

WHAT DO YOU NEED?
- Homey Pro (firmware version 12.2.0 or higher)
- Adlar Castra Aurora heat pump
- Local network connection to the heat pump
- Device credentials (ID, Local Key, IP address)

HOW TO OBTAIN DEVICE CREDENTIALS?
You can obtain the required local key and other data by following the instructions in:
/docs/Tuya_LocalKey_Homey_Guide_EN.pdf

INSTALLATION STEPS
1. Install the app via the Homey App Store
2. Add a new device and select "Intelligent Heat Pump"
3. Enter your device credentials:
   - Device ID
   - Local Key
   - IP address
   - Protocol Version (choose 3.3, 3.4, or 3.5)
4. Complete the pairing process

PROTOCOL VERSION SELECTION
The protocol version determines how the app communicates with your heat pump:
- 3.3 (Default): Works for most Adlar/Aurora heat pumps
- 3.4: Required for some newer models
- 3.5: Required for latest firmware versions

If you experience connection problems (frequent disconnects, ECONNRESET errors),
try a different protocol version via device repair (see Troubleshooting section).
- ECONNRESET at 00:00 usually occurs due to daily reset of your router;
- HMAC mismatch, default is protocol version 3.3, switch to 3.4 (or 3.5)
- ECONNREFUSED <ip-address> most likely indicates an incorrect IP address,
   assign a static (DHCP) address to your heat pump

IMPORTANT CAPABILITIES

TEMPERATURE MONITORING
- Water inlet and outlet temperatures
- Ambient temperature
- Hot water temperature
- Compressor temperatures
- Heat exchanger temperatures

ENERGY AND EFFICIENCY
- Real-time power consumption
- Daily and total energy consumption
- COP calculation (how efficiently your heat pump works)
- Trend analysis for optimization
- Seasonal performance monitoring

SYSTEM CONTROL
- On/off switching
- Heating mode selection
- Temperature target setting
- Heating curve adjustments
- Hot water settings

AUTOMATION WITH FLOW CARDS
- Temperature warnings
- Energy consumption monitoring
- Efficiency optimization
- Weather-dependent adjustments
- System timer notifications

COP (COEFFICIENT OF PERFORMANCE) MONITORING

The app automatically calculates how efficiently your heat pump works (see directory /docs/COP calculation at sourcecode):
- COP value: Ratio between generated heat and consumed electricity
- Daily averages: 24-hour trends
- Weekly analysis: Long-term performance
- Seasonal monitoring: SCOP according to European standards
- Diagnostic feedback: What affects efficiency

WHAT DO COP VALUES MEAN?
- COP 2.0-3.0: Average performance
- COP 3.0-4.0: Good performance
- COP 4.0+: Excellent performance

TROUBLESHOOTING AND SUPPORT

COMMON PROBLEMS

Connection Issues (ECONNRESET Errors)
If your device keeps disconnecting or shows connection reset errors:

QUICK FIX (takes less than 2 minutes):
1. Open device Settings in Homey app
2. Scroll to the top to the connection settings
3. Change Protocol Version to 3.4 (or try 3.5 if 3.4 doesn't work)
4. Optional: update other credentials (IP Address, Local Key, Device ID)
5. Click "Save" and wait 1-2 minutes for reconnection

Success indicators:
- Connection status shows "connected"
- No more ECONNRESET errors
- Sensor data updates normally
- Device stays available

Other Common Problems:
- No connection: Check IP address, local key, and network connectivity
- Fluctuating values: Normal during system startup
- Error codes: See the app for specific explanation per error code
- Pairing fails: Try different protocol versions (3.3, 3.4, 3.5)

UPDATE DEVICE CREDENTIALS
You can update device credentials without re-pairing:
1. Go to device Settings in Homey app
2. Scroll to the top to the connection settings
3. Update credentials (IP Address, Local Key, Device ID, Protocol Version)
4. Click "Save" - device reconnects automatically

NEED HELP?
- Documentation: Check the /docs folder within the sourcecode at Github for detailed information
- Community: Homey Community Forum (Topic ID: 143690)
- Issues: Report problems on GitHub

ADVANCED FEATURES

DEVICE SETTINGS (Configure per device)
Access via device Settings in Homey app:

Connection Settings:
- Protocol Version: Tuya protocol version (3.3, 3.4, 3.5)
- Device ID, Local Key, IP Address: Connection credentials

COP Calculation Settings:
- Enable/disable COP calculation
- External power measurement integration
- External flow data integration
- External ambient temperature integration

Flow Card Control:
You can control which flow cards are visible (disabled/auto/enabled):
- Temperature warnings: Temperature threshold alerts
- Voltage/current monitoring: Electrical system monitoring
- Power warnings: Power consumption alerts
- System status changes: Compressor, defrost, system states
- Efficiency monitoring: COP trends and outliers
- Expert functions: Advanced diagnostic flow cards

Auto Mode (recommended):
Shows only flow cards for sensors with adequate data (updated recently, no errors).


Curve Controls (optional):
- Enable picker controls for heating and hot water curves
- Default: Disabled (sensors always visible, pickers hidden)
- Enable for advanced users who want direct curve adjustment

Power Measurement Settings:
- Enable/disable power measurements from heat pump
- Auto-manages related flow card visibility
- Useful if you have external power monitoring

CROSS-APP INTEGRATION
Connect with other Homey apps for enhanced COP calculation (see /docs/COP flow-card-setup.md):
- External power measurements (from your smart meter)
- External water flow data
- External ambient temperature data

SAFETY AND RELIABILITY

AUTOMATIC MONITORING
- Critical temperature warnings
- Connection status control
- System error detection
- System timer notifications

INTELLIGENT RECOVERY
- Automatic reconnection
- Error correction
- Status recovery
- User-friendly error messages

