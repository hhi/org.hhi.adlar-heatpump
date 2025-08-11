# Adlar Castra Heatpump

Local access to the Aurora series heatpump device for Homey Pro.

## Overview

This Homey app provides comprehensive local control and monitoring of Adlar Castra
Aurora series heat pumps via Tuya's local API. The app enables direct
communication with your heat pump without requiring internet connectivity,
ensuring reliable and secure operation with sophisticated user control over
automation complexity.

## Features

### Core Functionality

- **Local API Integration**: Direct communication with heat pump via Tuya local
  protocol
- **Complete Device Control**: Access to all 41 device capabilities
- **Real-time Monitoring**: Live sensor data and system status updates
- **Automated Reconnection**: Robust connection handling with automatic
  recovery
- **Multi-language Support**: English and Dutch interface

### 🎯 Key Features (v0.92.7)

✅ **Flow Card Control System**: Individual control over 7 flow card categories with 3-mode system (disabled/auto/enabled)  
✅ **Settings Management**: Race condition prevention with deferred updates and auto-management  
✅ **Enhanced Error Handling**: TuyaErrorCategorizer with 9 comprehensive error types, smart retry, and user-friendly messages  
✅ **Performance Optimizations**: Centralized constants, cleaned unused code, improved efficiency (~300 lines removed)  
✅ **User Control**: Complete automation complexity control with health-aware flow card registration  
✅ **Insights Management**: Dynamic insights control with power measurement toggle integration  
✅ **Documentation Standardization**: Complete technical documentation revision to v0.92.7 standards with hyphenated naming conventions  

### 📊 Current Statistics (v0.92.7)

- **Total Flow Cards**: 58 (31 triggers, 18 conditions, 9 actions)
- **Total Capabilities**: 41 (14 custom Adlar + 27 standard/custom Homey)  
- **User-Controllable Categories**: 7 flow card categories + expert mode
- **Languages Supported**: English/Dutch throughout
- **Health Monitoring**: Real-time with 2-minute intervals
- **Error Categories**: 9 comprehensive error types with recovery guidance

### 🚀 Latest Features (v0.92.7)

**Settings Management & Race Condition Prevention:**
- Fixed "Cannot set Settings while this.onSettings is still pending" errors
- Deferred settings updates using setTimeout to prevent concurrent access  
- Power settings auto-management with cascading flow card controls
- Enhanced settings UI labels with clear restart guidance

**Flow Card Control System:**
- `flow_temperature_alerts`: Temperature-related flow cards (11 cards)
- `flow_voltage_alerts`: Voltage monitoring flow cards (3 cards)
- `flow_current_alerts`: Current monitoring flow cards (3 cards)  
- `flow_power_alerts`: Power consumption flow cards (3 cards)
- `flow_pulse_steps_alerts`: Valve position flow cards (2 cards)
- `flow_state_alerts`: System state change flow cards (5 cards)
- `flow_expert_mode`: Advanced diagnostic flow cards (3 cards)

**Three-Mode System:**
- **DISABLED**: No flow cards for category (clean interface, unused sensors)
- **AUTO**: Show only for healthy capabilities with data (**DEFAULT** - reliable alerts)  
- **ENABLED**: Force all capability flow cards active (safety critical, troubleshooting)

**Enhanced Error Handling:**
- TuyaErrorCategorizer with 9 error categories (connection, timeout, auth, DPS, network, etc.)
- Smart retry logic for recoverable errors with appropriate delays
- User-friendly messages with specific recovery actions  
- Centralized constants in DeviceConstants class for consistent configuration

**Insights Management (v0.92.7):**
- Dynamic insights control aligned with power measurement toggle
- Default power insights disabled for cleaner user experience
- Programmatic insights enable/disable when capabilities are added/removed
- Prevents stale insights data visibility when power monitoring is disabled

### v0.80.0 - Action-Based Condition Flow Cards

- **Complete Bidirectional Control**: Read current values of all controllable device settings
- **9 New Condition Cards**: Check device power, temperatures, modes, and settings
- **Advanced Comparisons**: Equal to, greater than, less than operators for numeric values
- **Real-time Value Reading**: Live capability value checking for complex flow logic
- **Enhanced Automation**: Create conditions based on current device states
- **Always Available**: Independent of user preferences, always accessible

### v0.70.0+ - Intelligent Capability Health Monitoring

- **Smart Null Detection**: Automatically detects missing sensor data (null
  values) in all flow handlers
- **Dynamic Flow Cards**: Flow cards automatically register/unregister based on
  sensor health status
- **Health Tracking**: Monitors data availability over time with null count and
  timeout detection
- **Diagnostic Tools**: User-facing capability health reports showing which
  sensors work/fail
- **Debug Logging**: Enhanced logging with fallback values for missing data
- **Auto-Management**: Intelligent flow card visibility reduces interface
  clutter
- **Troubleshooting**: Comprehensive sensor connectivity issue identification

### Flow Card System

- **58 Flow Cards**: Comprehensive automation triggers (31), conditions (18), and actions (9)
- **User-Controlled Visibility**: Individual control over 7 flow card categories
- **Three-Mode System**: Disabled, Auto (health-based), or Enabled for each category
- **Action-Based Conditions**: Read capability values for all controllable settings with inverse operator support
- **Pattern-based Registration**: Intelligent flow card management with health awareness
- **Expert Mode**: Advanced diagnostic and analysis cards for HVAC professionals

### Safety & Monitoring

- **Critical Notifications**: Proactive alerts for system faults and safety issues
- **Temperature Safety**: Extreme temperature detection and alerts
- **Connection Monitoring**: Automatic detection of device disconnections
- **Rate Limited Alerts**: Prevents notification spam with smart throttling

## Capabilities

The app provides access to 41 different capabilities organized into categories:

### Temperature Sensors (9 capabilities)

- Inlet/Outlet water temperatures
- Coiler and discharge temperatures
- Ambient temperature monitoring
- High/low pressure saturation temperatures
- EVI heat exchanger temperatures

### Power & Electrical (7 capabilities)

- 3-phase voltage and current monitoring
- Power consumption (current and total)
- Electrical frequency measurements
- Energy usage tracking

### System Control (8 capabilities)

- Heating modes and work modes
- Temperature setpoints (heating and hot water)
- Capacity and volume settings
- Countdown timer control

### System States (6 capabilities)

- Compressor status
- Defrost state monitoring
- Backwater state
- System fault detection

### Valve Control (2 capabilities)

- EEV (Electronic Expansion Valve) pulse steps
- EVI (Economizer Valve) pulse steps

### Additional Monitoring (9 capabilities)

- Water flow measurement
- System efficiency metrics
- Advanced diagnostic parameters

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

Access device settings to configure:

#### Flow Card Controls (v0.92.4+)

- **Temperature Alerts** (11 cards): Control temperature-related flow card visibility
- **Voltage Alerts** (3 cards): Manage voltage monitoring flow cards
- **Current Alerts** (3 cards): Configure electrical current flow cards
- **Power Alerts** (3 cards): Control power monitoring flow cards
- **Pulse-steps Alerts** (2 cards): Manage valve position flow cards
- **State Alerts** (5 cards): Configure system state change flow cards
- **Expert Mode** (3 cards): Enable advanced diagnostic flow cards

Each category offers three modes:

- **Disabled**: Flow cards are not available - Clean interface, unused sensors
- **Auto**: Flow cards appear only for healthy sensors with data - **Default** reliable alerts
- **Enabled**: All flow cards are available regardless of sensor status - Safety critical, troubleshooting

**Smart Integration**: Power measurements toggle automatically manages related flow card settings to prevent inconsistent configurations.

#### Feature Settings (App restart required)

- **Enable Power Measurements**: Show/hide 9 power-related capabilities (power consumption, voltage, current) for cleaner interfaces on devices without power monitoring
- **Automatic Flow Card Management**: When disabled, automatically sets related flow card categories to disabled mode
- **Backward Compatibility**: Existing automations remain functional

#### Diagnostics

- **Capability Diagnostics**: Generate detailed health reports showing which
  sensors are working and which have connectivity issues

### Debug Mode

Enable debug features by setting the environment variable:

```bash
DEBUG=1
```

## Flow Cards

### Triggers (31 cards)

- Temperature alerts for all sensors
- Voltage and current alerts for 3-phase monitoring
- Power threshold and consumption milestones
- System state changes (compressor, defrost, backwater)
- Fault detection and safety alerts

### Conditions (18 cards)

**Enhanced v0.90.3**: All action-based condition cards now support inverse operators for "is" and "is not" logic

**System Status Conditions:**

- Temperature thresholds and differentials
- Electrical balance checking
- Power consumption limits
- System state verification
- Water flow rate validation

**Action-Based Conditions (NEW v0.80.0):**

- Device power state checking
- Target temperature comparisons
- Hot water temperature validation
- Heating mode verification
- Work mode status checking
- Water control mode validation
- Capacity setting verification
- Heating curve status checking
- Volume setting validation

### Actions (9 cards)

- Temperature setpoint control
- Operating mode selection
- System on/off control
- Heating curve adjustments
- Hot water temperature settings

## 🛡️ Critical Safety Monitoring

**Smart Notifications with Rate Limiting:**
- Connection failures (after 5 consecutive failures - 100 seconds)
- System faults with specific fault codes and descriptions
- Extreme temperature safety (>80°C or <-20°C)
- Pulse-steps safety monitoring (critical valve positions)
- Rate limited: Max 1 notification per 30 minutes per device

The system provides comprehensive heat pump automation from basic comfort control to professional-grade diagnostics with complete user control over complexity and automation scope.

## 📋 Documentation

Comprehensive documentation is available in the `/docs` directory:

### Enhanced Documentation (v0.92.7)

**1. capabilities-overview.md**
   - Complete overview of all 41 device capabilities
   - User-controlled capability management with power measurements toggle
   - Enhanced health monitoring with DeviceConstants integration
   - Error handling integration and optional power capabilities

**2. flow-cards-overview.md**  
   - Analysis of all 58 flow cards with three-mode control system
   - User-controlled dynamic registration with health awareness
   - Settings integration and power management auto-cascading
   - Enhanced examples and troubleshooting guidance

**3. capability-flowcard-mapping.md**
   - Health-aware registration logic with practical examples
   - Power management cascade logic and user interface integration
   - Updated with three-mode control system documentation

**4. flow-patterns.md (Updated v0.92.7)**
   - Pattern-based flow card management system
   - User-controlled dynamic registration integration
   - Multi-level architecture (App vs Device level)
   - Settings-based pattern registration with health awareness

## Support

- **Issues**: Report bugs and feature requests on GitHub
- **Documentation**: Comprehensive guides in `/docs` directory
- **Community**: Homey Community Forum (Topic ID: 140621)

## License

This project is developed for the Homey platform and follows Homey app
development guidelines.

---

*For detailed technical information and advanced usage, please refer to the
documentation in the `/docs` directory.*
