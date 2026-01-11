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
- 60+ capabilities in 9 categories

COMPLETE OPERATION
- Temperature setting and heating modes
- Heating curve adjustments
- Hot water temperature control
- Timer and automatic functions

INTELLIGENT AUTOMATION
- 78 flow cards for advanced automation
- Smart error detection and recovery
- Weather-dependent optimization
- Energy efficiency trends and warnings
- Time-based scheduling and seasonal mode detection
- Adaptive temperature control with PI controller (v2.0+)
- Building model learning with machine learning (v2.0+)
- Building Insights & Recommendations with ROI estimates (v2.4+)
- Energy price optimization with day-ahead pricing (v2.0+)
- COP optimization for maximum efficiency (v2.0+)
- Comprehensive diagnostic tools for troubleshooting (v2.0.1+)

USER-FRIENDLY
- Fully localized interface
- Mobile-friendly display
- Clear status indicators
- Understandable error messages

INSTALLATION

WHAT DO YOU NEED?
- Homey Pro (firmware version 12.2.0 or higher)
- Adlar Castra Aurora heat pump
- Local network connection to the heat pump
- Device credentials (ID, Local Key, local IP address)

HOW TO OBTAIN DEVICE CREDENTIALS?
You can obtain the required local key and other data by following the instructions in:
/docs/setup/Tuya_LocalKey_Homey_Guide_EN.pdf

INSTALLATION STEPS
1. Install the app via the Homey App Store
2. Add a new device and select "Intelligent Heat Pump"
3. Enter your device credentials:
   - Device ID
   - Local Key
   - local IP address
   - Protocol Version (choose 3.3, 3.4, or 3.5)
4. Complete the pairing process

PROTOCOL VERSION SELECTION
The protocol version determines how the app communicates with your heat pump:
- 3.3 (Default): Works for most Adlar/Aurora heat pumps
- 3.4: Required for some newer models
- 3.5: Required for latest firmware versions

If you experience connection problems (frequent disconnects, ECONNRESET errors),
try a different protocol version via device settings.
- ECONNRESET at 00:00 usually occurs due to daily reset of your router
- HMAC mismatch: default is protocol version 3.3, switch to 3.4 (or 3.5)
- ECONNREFUSED <ip-address>: most likely indicates an incorrect IP address,
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
- Hourly and daily cost calculation

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
- Dynamic curve calculator for advanced optimization

CURVE CALCULATOR (Advanced Feature)
Calculate output values based on configurable curves for intelligent automation:
- Weather-compensated heating: Automatic setpoint adjustment based on outdoor temperature
- Time-based optimization: Adjust settings by hour/day/season
- COP-based fine-tuning: Dynamic temperature adjustments based on efficiency
- Supports 6 operators: >, >=, <, <=, ==, != with default fallback
- Maximum 50 curve entries for complex scenarios
- Real-time calculation with user-friendly error messages

Example: Weather-Compensated Heating
"When outdoor temperature changes, calculate heating setpoint using curve:
< -5°C : 60°C, < 0°C : 55°C, < 5°C : 50°C, < 10°C : 45°C, default : 35°C"
Result: Automatically adjusts heating based on weather conditions.
The input field accepts numbers, variables, or Homey-supported {{ expression }} syntax.

ADLAR CUSTOM HEATING CURVE CALCULATOR (L28/L29)
Calculates supply temperature directly from Adlar Custom heating curve parameters:

What are L28 and L29?
- L29: Desired supply temperature at -15°C outdoor temp (reference point, e.g., 55°C)
- L28: Slope grade per 10°C temperature change (e.g., -5 = -0.5°C per degree)

How does it work?
The formula y = ax + b is automatically calculated:
- Slope (a) = L28 ÷ 10
- Intercept (b) = L29 - (slope × -15°C)
Example: L29=55°C, L28=-5 → formula: y = -0.5x + 47.5

Example Flow:
"When outdoor temperature changes, calculate Custom heating curve
with L29=55°C at -15°C, L28=-5 per 10°C, outdoor temp {{outdoor_temperature}}"
Result at 5°C outdoor → supply temp 45°C

Returns:
- supply_temperature: Calculated supply temperature (°C)
- formula: Mathematical formula (e.g., "y = -0.5x + 47.5")

Advantages over general Curve Calculator:
- Uses the same L28/L29 values as your heat pump display
- No manual curve definition needed
- Mathematically exact according to Adlar specification

TIME-BASED SCHEDULER & SEASONAL MODE (Advanced Features)
Two calculators for intelligent time and season-based automation:

Time-Based Scheduler:
Calculate values based on time-of-day schedules for daily temperature programming.
Example: "06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, 23:00-06:00: 18"
- Supports overnight ranges (e.g., 23:00-06:00)
- Maximum 30 time ranges with default fallback
- Perfect for comfort scheduling and time-of-use optimization

Seasonal Mode Detection:
Automatically detect heating/cooling season based on date.
- Heating season: Oct 1 - May 15 (aligned with EN 14825 SCOP standard)
- Returns mode, season flags, and days until season change
- Perfect for automatic winter/summer schedule switching

COP (COEFFICIENT OF PERFORMANCE) MONITORING

The app automatically calculates how efficiently your heat pump works:
- COP value: Ratio between generated heat and consumed electricity
- Daily averages: 24-hour trends
- Weekly analysis: Long-term performance
- Seasonal monitoring: SCOP according to European standards
- Diagnostic feedback: What affects efficiency
- Outlier detection: Flagging unrealistic values (< 0.5 or > 8.0)

WHAT DO COP VALUES MEAN?
- COP 2.0-3.0: Average performance
- COP 3.0-4.0: Good performance
- COP 4.0+: Excellent performance

ADVANCED SETTINGS

ADAPTIVE TEMPERATURE CONTROL
Automatic target temperature regulation based on external indoor temperature sensor:
- PI (Proportional-Integral) controller for stable indoor temperature
- Performance: ±0.3°C stability
- Requires: External temperature sensor via flow card

BUILDING MODEL LEARNING
Machine learning algorithm that learns the thermal properties of your home:
- Learns 4 thermal parameters (C, UA, g, P_int)
- Learning time: 24-72 hours for basic model, 2-4 weeks for accurate model
- Building type selection: Light/Average/Heavy/Passive
- Dynamic internal heat gains by time of day
- Seasonal solar gain adjustment

BUILDING INSIGHTS & RECOMMENDATIONS (NEW v2.4)
Automated analysis of the thermal building model:
- Energy-saving recommendations with ROI estimates
- Insights appear after 24-48 hours of learning (70% confidence)
- Configurable "wake time" for pre-heat calculations
- Night setback setting for savings estimates
- Maximum number of active insights configurable (1-5)

ENERGY PRICE OPTIMIZATION
Automatic optimization based on day-ahead energy prices:
- Data source: EnergyZero API (free, no account needed)
- Estimated savings: €400-600 per year
- Price thresholds: Very Low/Low/Normal/High based on 2024 percentiles
- Price calculation mode: Market/Market+/All-in pricing
- Configurable supplier fee and energy tax
- Price block detection for cheapest/most expensive periods

COP OPTIMIZATION
Automatic supply temperature optimization for maximum efficiency:
- Learns optimal supply temperature per outdoor temperature
- Estimated savings: €200-300/year
- Strategies: Conservative/Balanced/Aggressive

ADAPTIVE CONTROL WEIGHTING FACTORS
Three priorities that together determine how the system makes decisions:
- Comfort Priority (default 60%): Weight for PI temperature control
- Efficiency Priority (default 25%): Weight for COP optimization
- Cost Priority (default 15%): Weight for price optimization
- Values are automatically normalized to total 100%

TROUBLESHOOTING AND SUPPORT

COMMON PROBLEMS

Connection Issues (ECONNRESET Errors)
If your device keeps disconnecting or shows connection reset errors:

QUICK FIX (takes less than 2 minutes):
1. Open device Settings in Homey app
2. Scroll to the top to the connection settings
3. Change Protocol Version to 3.4 (or try 3.5 if 3.4 doesn't work)
4. Optional: update other credentials (Local IP Address, Local Key, Device ID)
5. Click "Save" and wait 1-2 minutes for reconnection

Success indicators:
- Connection status shows "connected"
- No more ECONNRESET errors
- Sensor data updates normally
- Device stays available

Other Common Problems:
- No connection: Check local IP address, local key, and network connectivity
- Fluctuating values: Normal during system startup
- Error codes: See the app for specific explanation per error code
- Pairing fails: Try different protocol versions (3.3, 3.4, 3.5)

UPDATE DEVICE CREDENTIALS
You can update device credentials without re-pairing:
1. Go to device Settings in Homey app
2. Scroll to the top to the connection settings
3. Update credentials (Local IP Address, Local Key, Device ID, Protocol Version)
4. Click "Save" - device reconnects automatically

NEED HELP?
- Documentation: Check the /docs folder at GitHub for detailed information
- Configuration Guide: /docs/setup/advanced-settings/CONFIGURATIEGIDS.md (complete settings reference)
- Community: Homey Community Forum (Topic ID: 143690)
- Issues: Report problems on GitHub

CROSS-APP INTEGRATION
Connect with other Homey apps for enhanced COP calculation:
- External power measurements (from your smart meter)
- External water flow data
- External ambient temperature data
- External indoor temperature for adaptive control

BUILDING MODEL DIAGNOSTICS (v2.0.1+)
Troubleshooting for thermal learning issues when your building model doesn't update:
- Comprehensive diagnostic flow card
- Check indoor/outdoor temperature sensor status
- Monitor learning process (samples, confidence, time constant)
- Identify specific blocking reasons with solutions
- Follow learning timeline (T+0 → T+50min → T+24h)

Usage: Create flow "Diagnose building model learning" to see detailed status in app logs

SAFETY AND RELIABILITY

AUTOMATIC MONITORING
- Critical temperature warnings
- Connection status control
- System error detection
- System timer notifications
- COP outlier detection

INTELLIGENT RECOVERY
- Automatic reconnection
- Error correction
- Status recovery
- User-friendly error messages
