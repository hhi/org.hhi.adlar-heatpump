# Adlar Castra Heatpump

Local access to the Aurora series heatpump device for Homey Pro.

## Overview

This Homey app provides comprehensive local control and monitoring of Adlar Castra
Aurora series heat pumps via Tuya's local API. The app enables direct
communication with your heat pump without requiring internet connectivity,
ensuring reliable and secure operation.

## Features

### Core Functionality

- **Local API Integration**: Direct communication with heat pump via Tuya local
  protocol
- **Complete Device Control**: Access to all 41 device capabilities
- **Real-time Monitoring**: Live sensor data and system status updates
- **Automated Reconnection**: Robust connection handling with automatic
  recovery
- **Multi-language Support**: English and Dutch interface

### New in v0.70.0+ - Intelligent Capability Health Monitoring

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

- **38 Flow Cards**: Comprehensive automation triggers, conditions, and actions
- **Tiered Approach**: Essential → Advanced → Expert progression
- **Pattern-based Registration**: Intelligent flow card management
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

#### Flow Card Controls

- **Temperature Alerts**: Control temperature-related flow card visibility
- **Voltage Alerts**: Manage voltage monitoring flow cards
- **Current Alerts**: Configure electrical current flow cards
- **Power Alerts**: Control power monitoring flow cards
- **Pulse-steps Alerts**: Manage valve position flow cards
- **State Alerts**: Configure system state change flow cards
- **Expert Mode**: Enable advanced diagnostic flow cards

Each category offers three modes:

- **Disabled**: Flow cards are not available
- **Auto**: Flow cards appear only for healthy sensors with data
- **Force Enabled**: All flow cards are available regardless of sensor
  status

#### Diagnostics

- **Capability Diagnostics**: Generate detailed health reports showing which
  sensors are working and which have connectivity issues

### Debug Mode

Enable debug features by setting the environment variable:

```bash
DEBUG=1
```

## Flow Cards

### Triggers (30 cards)

- Temperature alerts for all sensors
- Voltage and current alerts for 3-phase monitoring
- Power threshold and consumption milestones
- System state changes (compressor, defrost, backwater)
- Fault detection and safety alerts

### Conditions (9 cards)

- Temperature thresholds and differentials
- Electrical balance checking
- Power consumption limits
- System state verification
- Water flow rate validation

### Actions (9 cards)

- Temperature setpoint control
- Operating mode selection
- System on/off control
- Heating curve adjustments
- Hot water temperature settings

## Documentation

Comprehensive documentation is available in the `/docs` directory:

### 1. capabilities-overview.md

- Complete overview of all 41 device capabilities
- Detailed properties, DPS mappings, and purposes
- Organized by capability type and function
- Device compatibility notes

### 2. flow-cards-overview.md

- Analysis of all 38 flow cards
- Categorized by type and complexity tier
- Detailed use cases and value ranges
- Advanced flow examples and best practices

### 3. capability-flowcard-mapping.md

- Direct mapping between capabilities and flow cards
- Integration guidelines for Homey's automation system
- Progressive implementation recommendations
- Usage best practices for different skill levels

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
