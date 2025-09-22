# Adlar Castra Heatpump

Local access to the Aurora series heatpump device for Homey Pro.

## Overview

This Homey app provides comprehensive local control and monitoring of Adlar Castra Aurora series heat pumps via Tuya's local API. The app enables direct communication with your heat pump without requiring internet connectivity.

## Features

- **Local API Integration**: Direct communication via Tuya local protocol
- **Complete Device Control**: Access to all 47+ device capabilities including enhanced diagnostics
- **Real-time Monitoring**: Live sensor data and system status updates
- **Automated Reconnection**: Robust connection handling with automatic recovery
- **Multi-language Support**: English and Dutch interface
- **COP Efficiency Monitoring**: Real-time coefficient of performance calculation with 8 different methods and diagnostic feedback
- **SCOP Seasonal Analysis**: Seasonal coefficient of performance according to EN 14825 standards
- **Cross-App Integration**: External data exchange via flow cards for enhanced accuracy
- **Flow Card Control**: Individual control over 8 flow card categories (64 total cards)
- **Enhanced Error Handling**: Smart retry logic with user-friendly recovery guidance
- **Settings Management**: Race condition prevention with deferred updates
- **Health Monitoring**: Real-time capability monitoring with intelligent flow card registration
- **Safety Monitoring**: Critical temperature, connection, and system fault alerts

## Capabilities

The app provides access to **48+ capabilities** across seven categories:

- **Temperature Sensors (9)**: Inlet/outlet water, coiler, discharge, ambient, and saturation temperatures
- **Power & Electrical (9)**: 3-phase voltage/current monitoring, power consumption, energy usage, external power input, calculated external energy total
- **System Control (8)**: Heating modes, temperature setpoints, capacity settings, timer control
- **System States (6)**: Compressor status, defrost state, backwater state, fault detection
- **Valve Control (2)**: EEV and EVI pulse steps monitoring
- **Efficiency Monitoring (6)**: Real-time COP with diagnostics, calculation method, seasonal SCOP with data quality, rolling averages (daily/weekly/monthly), trend analysis
- **Additional Monitoring (9+)**: Water flow, diagnostic parameters, system optimization, external power integration

## Installation & Setup

### Prerequisites

- Homey Pro (firmware ≥12.2.0)
- Adlar Castra Aurora series heat pump
- Local network access to the heat pump
- Device credentials (ID, Local Key, IP Address)

### Getting Device Credentials

To obtain the required local key, refer to the documentation:
`docs/Get Local Keys - instruction.pdf`

### Installation Steps

1. Install the app from the Homey App Store
2. Add a new device and select "Intelligent Heat Pump"
3. Enter your device credentials:
   - **Device ID**: Unique identifier for your heat pump
   - **Local Key**: Security key for encrypted communication
   - **IP Address**: Local network IP of your heat pump
4. Complete the pairing process

## Configuration

### Device Settings

#### Flow Card Controls

Control visibility for 8 flow card categories with **64 total cards**:

- **Temperature Alerts** (11 cards), **Voltage Alerts** (3 cards), **Current Alerts** (3 cards)
- **Power Alerts** (3 cards), **Pulse-steps Alerts** (2 cards), **State Alerts** (5 cards)
- **Efficiency Alerts** (3 cards): COP thresholds, outlier detection, method-based automation
- **Expert Mode** (3 cards)

Three modes per category:

- **Disabled**: No flow cards (clean interface)
- **Auto**: Only healthy sensors with data (default)
- **Enabled**: All cards regardless of sensor status

#### COP (Coefficient of Performance) Settings

- **COP Calculation**: Enable/disable efficiency monitoring with 7 calculation methods
- **Calculation Method**: Auto-selection or manual override (8 methods: Direct Thermal ±5% to Temperature Difference ±30%)
- **Diagnostic Information**: Specific feedback about missing data ("No Power", "No Flow", "No Temp Δ", etc.)
- **Outlier Detection**: Identify unrealistic COP values indicating sensor issues
- **External Data Integration**: Request power, flow, and ambient data from other Homey devices
- **Cross-App Timeout**: Configure response timeout for external data requests (1-30 seconds)

#### Feature Settings

- **Enable Power Measurements**: Toggle 9 power-related capabilities
- **Enable Slider Controls**: Toggle 3 manual control sliders (water/power management)
- **Capability Diagnostics**: Generate sensor health reports

## Flow Cards

**66 Total Cards**: 35 triggers, 19 conditions, 12 actions

### Triggers (35)

- **Temperature, voltage, current, and power alerts**
- **System state changes and fault detection**
- **COP Efficiency Monitoring**: COP thresholds, outlier detection, method-based automation
- **External Data Requests**: Automatic requests for power, flow, and ambient data from other devices
- **Safety monitoring with rate limiting**

### Conditions (19)

- **Temperature thresholds and system status verification**
- **COP efficiency checks** with threshold-based logic
- **Calculation method verification** for automation based on data quality
- **Action-based conditions** for all controllable settings
- **Inverse operator support** for "is" and "is not" logic

### Actions (12)

- **Temperature setpoint and mode control**
- **System on/off and heating curve adjustments**
- **External Data Integration**: Send power, flow, and ambient data to heat pump for enhanced COP calculations

### Cross-App Integration

**External Data Flow Pattern**:
1. Heat pump triggers `request_external_power_data` when COP calculation needs external power data
2. Your power meter flow responds with `receive_external_power_data` action
3. Enhanced COP calculation uses both internal sensors and external measurements
4. Similar patterns for `request_external_flow_data` and `request_external_ambient_data`

## Internationalization

**Fully Localized Experience** in English and Dutch:

- **COP Method Names**: All 8 calculation methods with localized descriptions
- **COP Method Descriptions**: Detailed accuracy information (±5% to ±30%) in both languages
- **COP Diagnostic Messages**: Specific error indicators ("No Power", "No Flow", "No Temp Δ", "Multi Fail") optimized for 22-character display
- **Trend Analysis**: 7 efficiency trend descriptions ("Strong improvement", "Moderate decline", etc.)
- **SCOP Status Messages**: Seasonal calculation progress with mobile-optimized text (≤22 chars)
- **Flow Card Labels**: All triggers, conditions, and actions with proper translations
- **Settings Interface**: Complete settings UI in both languages with context-appropriate hints

**Mobile Optimization**: All sensor values and status messages optimized for iPhone display constraints.

## Safety & Monitoring

- **Connection Monitoring**: Alerts after 5 consecutive failures
- **System Faults**: Specific fault codes and descriptions
- **Temperature Safety**: Extreme temperature detection (>80°C or <-20°C)
- **COP Outlier Detection**: Identify unrealistic efficiency values (< 0.5 or > 8.0 COP)
- **Valve Monitoring**: Critical pulse-steps safety alerts
- **Rate Limiting**: Maximum 1 notification per 30 minutes per device

## Documentation & Support

### Technical Documentation

Detailed documentation available in `/docs` directory:

- **capabilities-overview.md**: Complete capability reference
- **flow-cards-overview.md**: Flow card system analysis
- **capability-flowcard-mapping.md**: Registration logic and examples
- **flow-patterns.md**: Pattern-based management system

### Support

- **Issues**: Report bugs and feature requests on GitHub
- **Community**: Homey Community Forum (Topic ID: 140621)
- **Installation Guide**: `docs/Get Local Keys - instruction.pdf`

## License

Developed for the Homey platform following official app development guidelines.
