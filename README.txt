ADLAR CASTRA HEAT PUMP - HOMEY APP

This app gives you complete control over your Adlar Castra Aurora heat pump directly via your Homey smart home system. You can monitor, operate and optimize your heat pump without depending on internet connections.

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
docs/Get Local Keys - instruction.pdf

INSTALLATION STEPS
1. Install the app via the Homey App Store
2. Add a new device and select "Intelligent Heat Pump"
3. Enter your device credentials:
   - Device ID
   - Local Key
   - IP address
4. Complete the pairing process

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

The app automatically calculates how efficiently your heat pump works (see /docs/COP-calculation.md at sourcecode):
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
- No connection: Check IP address and local key
- Fluctuating values: Normal during system startup
- Error codes: See the app for specific explanation per error code

NEED HELP?
- Documentation: Check the /docs folder within the sourcecode at Github for detailed information
- Community: Homey Community Forum (Topic ID: 140621)
- Issues: Report problems on GitHub

ADVANCED FEATURES

FLOW CARD CATEGORIES
You can adjust the visibility of flow cards:
- Temperature warnings
- Voltage and current monitoring
- Power warnings
- System status changes
- Efficiency monitoring
- Expert functions

CROSS-APP INTEGRATION
Connect with other Homey apps for enhanced COP calculation (see docs/flow-card-setup-quick-guide.md):
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

