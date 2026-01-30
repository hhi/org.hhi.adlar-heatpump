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
- Real-time temperature measurements (heat pump internal sensors)
- Power consumption and efficiency monitoring
- Automatic COP (coefficient of performance) calculation with 8 different methods
- Seasonal SCOP analysis according to European standards
- Extensive capabilities for complete control

FULL OPERATION
- Temperature settings and heating modes
- Heating curve adjustments
- Hot water temperature control
- Timer and automatic functions

INTELLIGENT AUTOMATION
- Extensive flow cards for advanced automation
- Smart error detection and recovery
- Weather-dependent optimization
- Energy efficiency trends and alerts
- Time-based scheduling and seasonal mode detection
- Adaptive temperature control with PI controller
- Building model learning with machine learning
- Building Insights & Recommendations with ROI estimates
- Energy price optimization with day-ahead pricing
- COP optimization for maximum efficiency
- Extensive diagnostic tools for troubleshooting
- Wind and solar integration for building model
  * External wind speed for windchill correction of heat loss
  * Solar radiation and PV power for accurate solar gain calculation
  * Improves building model learning accuracy with real-time weather data

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
You can obtain the required local key and other information by following the instructions in:
/docs/setup/Tuya_LocalKey_Homey_Guide_EN.pdf on the Source Code page of this App.

INSTALLATION STEPS
1. Install the app via the Homey App Store
2. Add a new device and select "Intelligent Heat Pump"
3. Enter your device credentials:
   - Device ID
   - Local Key
   - Local IP address
   - Protocol version (choose 3.3, 3.4 or 3.5)
4. Complete the pairing process

PROTOCOL VERSION SELECTION
The protocol version determines how the app communicates with your heat pump:
- 3.3 (Default): Works for most Adlar/Aurora heat pumps
- 3.4: Required for some newer models
- 3.5: Required for latest firmware versions

If you experience connection problems (frequent disconnections, ECONNRESET errors),
try a different protocol version via device settings.
- ECONNRESET at 00:00 usually occurs due to daily router reset
- HMAC mismatch: default is protocol version 3.3, switch to 3.4 (or 3.5)
- ECONNREFUSED <ip-address>: most likely an incorrect IP address,
  assign a static (DHCP) address to your heat pump

IMPORTANT FEATURES

TEMPERATURE MONITORING
- Water inlet and outlet temperatures
- Outdoor temperature
- Domestic hot water temperature
- Compressor temperatures
- Heat exchanger temperatures

ENERGY AND EFFICIENCY
- Real-time power consumption
- Daily and total energy consumption
- COP calculation (how efficiently your heat pump operates)
- Trend analysis for optimization
- Seasonal performance monitoring
- Hourly and daily cost calculation

SYSTEM CONTROL
- On/off switching
- Heating mode selection
- Temperature target settings
- Heating curve adjustments
- Hot water settings

AUTOMATION WITH FLOW CARDS
- Temperature alerts
- Energy consumption monitoring
- Efficiency optimization
- Weather-dependent adjustments
- System timer notifications
- Dynamic curve calculator for advanced optimization

CURVE CALCULATOR (Advanced Feature)
Calculate output values based on configurable curves for intelligent automation:
- Weather-dependent heating: Automatic setpoint adjustment based on outdoor temperature
- Time-based optimization: Adjust settings per hour/day/season
- COP-based fine-tuning: Dynamic temperature adjustments based on efficiency
- Supports 6 operators: >, >=, <, <=, ==, != with default fallback
- Maximum 50 curve entries for complex scenarios
- Real-time calculation with user-friendly error messages

Example: Weather-dependent Heating
"When outdoor temperature changes, calculate heating setpoint with curve:
< -5°C : 60°C, < 0°C : 55°C, < 5°C : 50°C, < 10°C : 45°C, default : 35°C"
Result: Automatically adjusts heating based on weather conditions.
The input field accepts numbers, variables or Homey-supported {{ expression }} syntax.

ADLAR CUSTOM HEATING CURVE CALCULATOR (L28/L29)
Calculates supply temperature directly from Adlar Custom heating curve parameters:

What are L28 and L29?
- L29: Desired supply temperature at -15°C outdoor temp (reference point, e.g. 55°C)
- L28: Slope degree per 10°C temperature change (e.g. -5 = -0.5°C per degree)

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
- formula: Mathematical formula (e.g. "y = -0.5x + 47.5")

Advantages over general Curve Calculator:
- Uses same L28/L29 values as your heat pump display
- No manual curve definition needed
- Mathematically exact according to Adlar specification

TIME-BASED SCHEDULING & SEASONAL MODE (Advanced Features)
Two calculators for intelligent time- and season-based automation:

Time-based Scheduling:
Calculate values based on daily schedules for daily temperature programming.
Example: "06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, 23:00-06:00: 18"
- Supports overnight ranges (e.g. 23:00-06:00)
- Maximum 30 time ranges with default fallback
- Perfect for comfort scheduling and time-of-use optimization

Seasonal Mode Detection:
Automatic detection of heating/cooling season based on date.
- Heating season: Oct 1 - May 15 (according to EN 14825 SCOP standard)
- Returns mode, season flags and days until season change
- Perfect for automatic switching between winter/summer schedules

COP (COEFFICIENT OF PERFORMANCE) MONITORING

The app automatically calculates how efficiently your heat pump operates:
- COP value: Ratio between generated heat and consumed power
- Daily averages: 24-hour trends
- Weekly analysis: Long-term performance
- Seasonal monitoring: SCOP according to European standards
- Diagnostic feedback: What affects efficiency
- Outlier detection: Signaling unrealistic values (< 0.5 or > 8.0)

WHAT DO COP VALUES MEAN?
- COP 2.0-3.0: Average performance
- COP 3.0-4.0: Good performance
- COP 4.0+: Excellent performance


ADVANCED FEATURES
See the introduction at /docs/setup/advanced-control/Advanced_Features_Intro.en.md
To enable the components below, the experience is to first connect the external data sources.
Subsequently activate the Adaptive Temperature Control in combination with the components below as applicable.

ADAPTIVE TEMPERATURE CONTROL
Automatic control of target temperature based on external indoor temperature sensor:
- PI (Proportional-Integral) controller for stable indoor temperature
- Performance: ±0.3°C stability
- Requires: External temperature sensor via flow card

BUILDING MODEL LEARNING
Machine learning algorithm that learns the thermal properties of your home:
- Learns 4 thermal parameters (C, UA, g, P_int)
- Learning time: 24-72 hours for basic model, 2-4 weeks for accurate model
- Building type selection: Light/Average/Heavy/Passive
- Dynamic internal heat gains per time of day
- Seasonal solar gain adjustment

BUILDING INSIGHTS & RECOMMENDATIONS
Automated analysis of the thermal building model:
- Energy-saving recommendations with ROI estimates
- Insights appear after 24-48 hours of learning (70% confidence)
- Configurable "wake-up time" for pre-heat calculations
- Night setback setting for savings estimates
- Maximum number of active insights configurable (1-5)

ENERGY PRICE OPTIMIZATION
Automatic optimization based on day-ahead energy prices:
- Data source: EnergyZero API (free, no account needed)
- Estimated savings: €400-600 per year
- Price thresholds: Very Low/Low/Normal/High based on 2024 percentiles
- Price calculation mode: Market price/Market+/All-in price
- Configurable supplier markup and energy tax
- Price block detection for cheapest/most expensive periods

COP OPTIMIZATION
Automatic optimization of supply temperature for maximum efficiency:
- Learns optimal supply temperature per outdoor temperature
- Estimated savings: €200-300/year
- Strategies: Conservative/Balanced/Aggressive

ADAPTIVE CONTROL WEIGHTING FACTORS
Four priorities that together determine how the system makes decisions:
- Comfort Priority (default 50%): Weight for PI temperature control
- Efficiency Priority (default 15%): Weight for COP optimization
- Cost Priority (default 15%): Weight for price optimization
- Thermal Prediction Priority (default 20%): Weight for thermal property consideration
- Values are automatically normalized to total 100%

BUILDING MODEL DIAGNOSTICS
Troubleshooting for thermal learning problems when your building model doesn't update:
- Extensive diagnostic flow card
- Check indoor/outdoor temperature sensor status
- Monitor learning process (samples, confidence, time constant)
- Identify specific blocking reasons with solutions
- Track learning timeline (T+0 → T+50min → T+24h)

WIND & SOLAR INTEGRATION
Improve the accuracy of the thermal building model with external weather data:

Wind Speed Correction:
- Automatic adjustment of heat loss based on windchill effect
- Flow card: "Set external wind speed" (km/h)
- Reduces building model learning time by 30-50%
- Compatible with KNMI Weather app and other wind sensors

Solar Radiation Integration:
- Accurate calculation of solar gains via building surface
- Flow card: "Set external solar radiation" (W/m²)
- Seasonal adjustment (winter 60%, summer 130%)
- Supports KNMI solar radiation data

PV Power Tracking:
- Real-time monitoring of solar panel yield
- Flow card: "Set external PV power" (W)
- Used for internal heat gain correction
- Improves building model confidence to 85%+


CROSS-APP INTEGRATION

Data sources: KNMI Weather app, Homey Energy app, or own sensors

Connect with compatible Homey apps for improved COP calculation and adaptive control and building model:
- External power measurements (from your smart meter)
- External water flow data
- External outdoor temperature data (e.g. KNMI weather app)
- External indoor temperature for adaptive control
- Wind speed data for windchill compensation
- Solar radiation intensity for solar gain calculation
- PV power for real-time solar energy gains


SAFETY AND RELIABILITY

AUTOMATIC MONITORING
- Critical temperature warnings
- Connection status check
- System error detection
- System timer notifications
- COP outlier detection

INTELLIGENT RECOVERY
- Automatic reconnection
- Error correction
- Status recovery
- User-friendly error messages

TROUBLESHOOTING AND SUPPORT

ADVANCED INTEGRATION SETUP AND DOCUMENTATION

For detailed instructions and external data integration:
- Adaptive Temperature Control Guide: /docs/setup/guide/ADAPTIVE_CONTROL_GUIDE.en.md
- Adaptive Control Components: /docs/setup/advanced-control/ADAPTIVE_CONTROL_COMPONENTS.en.md
- Advanced Features Flow Cards: /docs/setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.en.md
- Wind & Solar Setup: /docs/setup/guide/BUILDING_INSIGHTS_GUIDE.en.md
- Flow Cards Guide: /docs/setup/guide/FLOW_CARDS_GUIDE.en.md
- Complete Configuration: /docs/setup/advanced-settings/CONFIGURATION_GUIDE.en.md
- Heat Pump Info & Specs: /docs/Heatpump specs/ directory
- COP Calculation Methods: /docs/COP calculation/COP-calculation.md
- SCOP Calculation: /docs/COP calculation/SCOP-calculation.md

COMMON PROBLEMS

Connection Problems (ECONNRESET Errors)
If your device keeps disconnecting or shows reset errors:

QUICK SOLUTION (takes less than 2 minutes):
1. Open device Settings in Homey app
2. Scroll up to the connection settings
3. Change Protocol version to 3.4 (or try 3.5 if 3.4 doesn't work)
4. Optional: update other credentials (local IP address, Local Key, Device ID)
5. Click "Save" and wait 1-2 minutes for reconnection

Success indicators:
- Connection status shows "connected"
- No more ECONNRESET errors
- Sensor data updates normally
- Device remains available

Other Common Problems:
- No connection: Check local IP address, local key and network connection
- Fluctuating values: Normal during system startup
- Error codes: See the app for specific explanation per error code
- Pairing failed: Try different protocol versions (3.3, 3.4, 3.5)

UPDATING DEVICE CREDENTIALS
You can update device credentials without re-pairing:
1. Go to device Settings in Homey app
2. Scroll up to the connection settings
3. Update credentials (local IP address, Local Key, Device ID, Protocol version)
4. Click "Save" - device reconnects automatically

NEED HELP?
- Documentation: View the /docs folder in the source code on GitHub for detailed information
- Configuration Guide: /docs/setup/advanced-settings/CONFIGURATION_GUIDE.md (complete settings reference)
- Community: Homey Community Forum (Topic ID: 143690)
- Issues: Report problems on GitHub
