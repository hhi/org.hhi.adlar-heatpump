# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build

```bash
npm run build
```

Compiles TypeScript to JavaScript in `.homeybuild/` directory.

### Validate

```bash
homey app validate
```

Validates the Homey app structure, manifest, and configuration. Use `-l debug` for detailed logging.

**Development Workflow:**

- Use `homey app validate -l debug` to check if you can test the app via `homey app run`
- Use `homey app validate` to verify the app is ready for publishing via `homey app publish`

### Lint

```bash
npm run lint
```

Runs ESLint on `.js` and `.ts` files using the Athom configuration.

### coding and formatting

All coding should be Typescript compliant
The code should adhere eslint rules (for example whitespacing)
For Markdown files adhere to markdownlint rules

### Debug Mode

Set `DEBUG=1` environment variable to enable debug features in the Homey app.

## Project Architecture

This is a Homey app for integrating Adlar heat pump devices via Tuya's local API. The architecture follows Homey's app development patterns with TypeScript.

### Core Components

- **App Entry**: `app.ts` - Main Homey app class with debug mode support
- **Driver**: `drivers/intelligent-heat-pump/driver.ts` - Handles device discovery and pairing
- **Device**: `drivers/intelligent-heat-pump/device.ts` - Manages individual heat pump device instances
- **Mappings**: `lib/definitions/adlar-mapping.ts` - Maps Tuya DPS (data points) to Homey capabilities

### Key Architecture Patterns

#### DPS to Capability Mapping

The app uses a centralized mapping system in `AdlarMapping` class:

- `capabilities` - Standard Homey capabilities (onoff, target_temperature, etc.)
- `customCapabilities` - Extended capabilities with dot notation (measure_temperature.temp_top)
- `adlarCapabilities` - Device-specific capabilities (adlar_hotwater, adlar_fault, etc.)
- `allArraysSwapped` - Reverse mapping from DPS ID to capability name

#### Device Communication

- Uses TuyAPI library for local device communication
- Automatic reconnection every 20 seconds via `connectTuya()`
- Bidirectional data flow: Homey capabilities ↔ Tuya DPS
- Event-driven updates via 'data' and 'dp-refresh' events

#### Pairing Flow

Three-step pairing process:

1. `enter_device_info` - Collect device credentials (ID, local key, IP)
2. `list_devices` - Display discovered device
3. `add_devices` - Finalize device registration

### Configuration Files

- **app.json**: Generated from composer, defines capabilities and driver configuration
- **driver.compose.json**: Driver-specific settings and pairing flows
- **tsconfig.json**: TypeScript compilation settings targeting Node 16

### Capability System

The app defines 41 capabilities across multiple categories:

- Temperature sensors (inlet, outlet, ambient, etc.)
- Power/electrical measurements (voltage, current, consumption)
- Pressure sensors and valve positions
- System states (compressor, defrost, backwater)
- Control settings (modes, curves, timers)

Each capability maps to specific Tuya DPS numbers and includes multilingual support (EN/NL).

### Important Project Constraints

**Ignored Files and Directories** (per .homeyignore):

- `docs/*` - All documentation files are excluded from builds
- `comments.txt` - Development notes file
- `claude.md` - This instruction file
- `*.code-workspace` - VS Code workspace files

**Flow Card Development Guidelines:**

- Use capability definitions from `.homeycompose/capabilities/` directory for custom capabilities
- Extract enum values and parameter ranges from `drivers/intelligent-heat-pump/driver.compose.json`
- Do NOT reference any files in the `docs/` directory for flow card implementation
- All capability metadata should come from the official compose configuration files

## Official Homey Documentation

### Core References

- [Homey Apps SDK v3](https://apps-sdk-v3.developer.homey.app/index.html) main entry for documentation of all managers & classes in the Homey Apps SDK
- [Homey Apps SDK](https://apps.developer.homey.app) SDK assisted manual overview

- [Homey Apps SDK Documentation](https://apps-sdk-v3.developer.homey.app/)
- [App Development Guide](https://apps.developer.homey.app/the-basics/getting-started)
- [Device Driver Development](https://apps.developer.homey.app/the-basics/devices)

### Key SDK Components

- [App Class](https://apps-sdk-v3.developer.homey.app/App.html) - Main application entry point
- [Driver Class](https://apps-sdk-v3.developer.homey.app/Driver.html) - Device discovery and pairing
- [Device Class](https://apps-sdk-v3.developer.homey.app/Device.html) - Individual device management
- [Capabilities System](https://apps.developer.homey.app/the-basics/devices/capabilities) - Device capability definitions
- [Homey built-in device capabilities](https://apps-sdk-v3.developer.homey.app/tutorial-device-capabilities.html) - List of all system capabilities Homey provides
- [New guidelines for device capabilities](https://apps.developer.homey.app/upgrade-guides/device-capabilities) - Transition to custom capabilities in favor of system capabilities
- [Device Classes](https://apps-sdk-v3.developer.homey.app/tutorial-device-classes.html) - List of IDs to refer to a device in the Driver Manifest

### Configuration & Composition

- [App Manifest (app.json)](https://apps.developer.homey.app/the-basics/app) - App configuration
- [Homey Compose](https://apps.developer.homey.app/advanced/homey-compose) - Build system for generating app.json
- [Driver Development](https://apps.developer.homey.app/the-basics/devices) - Driver-specific settings
- [Custom Capabilities](https://apps.developer.homey.app/the-basics/devices/capabilities) - Creating device-specific capabilities

### Flow Cards & Automation

- [Flow Cards Overview](https://apps.developer.homey.app/the-basics/flow) - Automation triggers, conditions, actions
- [Flow Card Implementation](https://apps.developer.homey.app/the-basics/flow) - Registering flow card listeners

### Pairing & Device Management

- [Device Pairing](https://apps.developer.homey.app/the-basics/devices/pairing) - Custom pairing flows
- [Device Settings](https://apps.developer.homey.app/the-basics/devices/settings) - Device configuration management
