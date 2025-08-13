# Adlar Castra Heatpump

Local access to the Aurora series heatpump device for Homey Pro.

## Overview

This Homey app provides comprehensive local control and monitoring of Adlar Castra Aurora series heat pumps via Tuya's local API. The app enables direct communication with your heat pump without requiring internet connectivity.

## Features

- **Local API Integration**: Direct communication via Tuya local protocol
- **Complete Device Control**: Access to all 41 device capabilities
- **Real-time Monitoring**: Live sensor data and system status updates
- **Automated Reconnection**: Robust connection handling with automatic recovery
- **Multi-language Support**: English and Dutch interface
- **Flow Card Control**: Individual control over 7 flow card categories (58 total cards)
- **Enhanced Error Handling**: Smart retry logic with user-friendly recovery guidance
- **Settings Management**: Race condition prevention with deferred updates
- **Health Monitoring**: Real-time capability monitoring with intelligent flow card registration
- **Safety Monitoring**: Critical temperature, connection, and system fault alerts

## Capabilities

The app provides access to **41 capabilities** across six categories:

- **Temperature Sensors (9)**: Inlet/outlet water, coiler, discharge, ambient, and saturation temperatures
- **Power & Electrical (7)**: 3-phase voltage/current monitoring, power consumption, energy usage
- **System Control (8)**: Heating modes, temperature setpoints, capacity settings, timer control
- **System States (6)**: Compressor status, defrost state, backwater state, fault detection
- **Valve Control (2)**: EEV and EVI pulse steps monitoring
- **Additional Monitoring (9)**: Water flow, efficiency metrics, diagnostic parameters

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

Control visibility for 7 flow card categories with **58 total cards**:

- **Temperature Alerts** (11 cards), **Voltage Alerts** (3 cards), **Current Alerts** (3 cards)
- **Power Alerts** (3 cards), **Pulse-steps Alerts** (2 cards), **State Alerts** (5 cards)
- **Expert Mode** (3 cards)

Three modes per category:

- **Disabled**: No flow cards (clean interface)
- **Auto**: Only healthy sensors with data (default)
- **Enabled**: All cards regardless of sensor status

#### Feature Settings

- **Enable Power Measurements**: Toggle 9 power-related capabilities
- **Capability Diagnostics**: Generate sensor health reports

## Flow Cards

**58 Total Cards**: 31 triggers, 18 conditions, 9 actions

### Triggers (31)

- Temperature, voltage, current, and power alerts
- System state changes and fault detection
- Safety monitoring with rate limiting

### Conditions (18)

- Temperature thresholds and system status verification
- Action-based conditions for all controllable settings
- Inverse operator support for "is" and "is not" logic

### Actions (9)

- Temperature setpoint and mode control
- System on/off and heating curve adjustments

## Safety & Monitoring

- **Connection Monitoring**: Alerts after 5 consecutive failures
- **System Faults**: Specific fault codes and descriptions
- **Temperature Safety**: Extreme temperature detection (>80°C or <-20°C)
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
