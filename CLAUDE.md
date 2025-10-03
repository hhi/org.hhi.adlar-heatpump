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

This is a Homey app for integrating Adlar heat pump devices via Tuya's local API. The architecture follows Homey's app development patterns with TypeScript and implements a **Service-Oriented Architecture (v0.99.23+)** for code organization, testability, and maintainability.

### Core Components

- **App Entry**: `app.ts` - Main Homey app class with debug mode support and global error handlers (v0.99.46)
- **Driver**: `drivers/intelligent-heat-pump/driver.ts` - Handles device discovery and pairing
- **Device**: `drivers/intelligent-heat-pump/device.ts` - Manages individual device instances, delegates to services
- **Service Coordinator**: `lib/services/service-coordinator.ts` - Manages lifecycle of all 8 services
- **Mappings**: `lib/definitions/adlar-mapping.ts` - Maps Tuya DPS (data points) to Homey capabilities
- **Constants**: `lib/constants.ts` - Centralized configuration constants and thresholds
- **Error Handling**: `lib/error-types.ts` - Comprehensive error categorization and recovery system

### Service-Oriented Architecture (v0.99.23+)

The app uses **8 specialized services** managed by ServiceCoordinator, eliminating code duplication and providing clear separation of concerns:

#### Infrastructure Services (5)

1. **TuyaConnectionService** (`lib/services/tuya-connection-service.ts`)
   - Device communication via TuyAPI
   - Automatic reconnection handling with crash-proof error recovery (v0.99.46)
   - Deep socket error interception (v0.99.49) - intercepts TuyAPI internal socket ECONNRESET errors after connection
   - Connection health monitoring
   - Real-time connection status tracking (v0.99.47) - 4 states: connected, disconnected, reconnecting, error
   - Event-driven sensor data updates
   - Auto device availability status sync (unavailable during outages, available on reconnect)
   - Unhandled promise rejection protection in async setTimeout callbacks
   - Idempotent error handler installation with listener cleanup (v0.99.49)

2. **CapabilityHealthService** (`lib/services/capability-health-service.ts`)
   - Real-time capability health tracking
   - Null value detection and monitoring
   - Data availability validation
   - Health-based flow card registration

3. **FlowCardManagerService** (`lib/services/flow-card-manager-service.ts`)
   - Dynamic flow card registration (64 cards across 8 categories)
   - Health-based auto-registration
   - User preference management (disabled/auto/enabled modes)
   - Cross-service event handling

4. **EnergyTrackingService** (`lib/services/energy-tracking-service.ts`)
   - External power measurement integration
   - Energy consumption calculations
   - Power capability management
   - External device data validation

5. **SettingsManagerService** (`lib/services/settings-manager-service.ts`)
   - Race condition prevention (deferred updates pattern)
   - Settings validation and persistence
   - Power settings auto-management
   - Seasonal data storage

#### Calculation Services (3)

6. **COPCalculator** (`lib/services/cop-calculator.ts`)
   - Real-time COP calculations with 8 methods (±5% to ±30% accuracy)
   - Automatic method selection based on data availability
   - Compressor operation validation (COP = 0 when idle)
   - Diagnostic feedback ("No Power", "No Flow", etc.)
   - Outlier detection and confidence levels

7. **RollingCOPCalculator** (`lib/services/rolling-cop-calculator.ts`)
   - Time-series analysis (daily/weekly/monthly rolling averages)
   - Trend detection (7 levels: strong improvement → significant decline)
   - Runtime-weighted averaging
   - Idle period awareness
   - Circular buffer management (1440 data points)

8. **SCOPCalculator** (`lib/services/scop-calculator.ts`)
   - Seasonal COP per EN 14825 European standard
   - Temperature bin method (6 bins: -10°C to +20°C)
   - Quality-weighted averaging
   - Seasonal coverage tracking (Oct 1 - May 15)
   - Method contribution analysis

#### Service Coordinator

**ServiceCoordinator** (`lib/services/service-coordinator.ts`) manages initialization, lifecycle, and cross-service communication:

```typescript
class ServiceCoordinator {
  // Service getters
  getTuyaConnection(): TuyaConnectionService;
  getCapabilityHealth(): CapabilityHealthService;
  getFlowCardManager(): FlowCardManagerService;
  getEnergyTracking(): EnergyTrackingService;
  getSettingsManager(): SettingsManagerService;
  getCOPCalculator(): COPCalculator;
  getSCOPCalculator(): SCOPCalculator;
  getRollingCOPCalculator(): RollingCOPCalculator;

  // Unified lifecycle
  async initialize(config: ServiceConfig): Promise<void>;
  async onSettings(oldSettings, newSettings, changedKeys): Promise<void>;
  destroy(): void;
}
```

**Cross-Service Event Flow Example** (COP Calculation):

1. **TuyaConnectionService** receives sensor update (DPS change)
2. **COPCalculator** triggered with new sensor values
3. **CapabilityHealthService** validates sensor data quality
4. **COPCalculator** calculates COP and emits `cop-calculated` event
5. **RollingCOPCalculator** adds data point to circular buffer
6. **SCOPCalculator** processes for temperature bin classification
7. **SettingsManagerService** persists updated data
8. **Device** publishes to capabilities (`adlar_cop`, `adlar_cop_daily`, etc.)

**Service Architecture Benefits:**

- **Code Duplication Eliminated**: Shared functionality centralized in services
- **Single Responsibility**: Each service handles one specific domain
- **Testability**: Services can be unit tested independently
- **Maintainability**: Changes isolated to relevant service
- **Extensibility**: New services easily added without modifying existing code
- **Fallback Safety**: Graceful degradation when services unavailable

### Key Architecture Patterns

#### DPS to Capability Mapping

The app uses a centralized mapping system in `AdlarMapping` class:

- `capabilities` - Standard Homey capabilities (onoff, target_temperature, etc.)
- `customCapabilities` - Extended capabilities with dot notation (measure_temperature.temp_top)
- `adlarCapabilities` - Device-specific capabilities (adlar_hotwater, adlar_fault, etc.)
- `allArraysSwapped` - Reverse mapping from DPS ID to capability name

#### Device Communication

- Uses TuyAPI library for local device communication
- Automatic reconnection using DeviceConstants.RECONNECTION_INTERVAL_MS (20 seconds)
- Bidirectional data flow: Homey capabilities ↔ Tuya DPS
- Event-driven updates via 'data' and 'dp-refresh' events
- Enhanced error handling with categorization and automatic retry for recoverable errors

#### Constants Management System (v0.90.3+)

Centralized configuration system in `DeviceConstants` class:

- **Timing intervals**: Reconnection, health checks, notification throttling
- **Power thresholds**: High consumption alerts, efficiency monitoring
- **Health monitoring**: Capability timeouts, null value thresholds
- **Performance limits**: Connection failure limits, efficiency thresholds

#### Error Handling Architecture (v0.90.3+, Enhanced v0.99.46)

Comprehensive error categorization via `TuyaErrorCategorizer`:

- **9 Error Categories**: Connection, timeout, authentication, DPS, network, validation, device offline, device not found, unknown
- **Recovery Guidance**: User-friendly messages with specific recovery actions
- **Smart Retry Logic**: Automatic retry for recoverable errors with appropriate delays
- **Structured Logging**: Consistent error formatting for debugging and monitoring

**Production-Ready Enhancements (v0.99.46)**:

- **Crash Prevention**: Unhandled promise rejection protection in async setTimeout/setInterval callbacks
- **Global Error Handlers**: Process-level `unhandledRejection` and `uncaughtException` handlers in app.ts
- **Device Status Sync**: Automatic `setUnavailable()` after 5 consecutive failures, `setAvailable()` on reconnection
- **Triple-Layer Protection**:
  1. Specific `.catch()` handlers on setTimeout async callbacks (TuyaConnectionService, Device)
  2. Try-catch blocks for synchronous operations (circuit breaker cooldown)
  3. Global process handlers as last resort safety net
- **Enhanced User Notifications**: Push notifications + device availability status + service health monitoring
- **ECONNRESET Resilience**: Specific handling for connection reset errors without app crashes

#### Settings Management & Race Condition Prevention (v0.90.3+)

Enhanced settings handling to prevent Homey's "Cannot set Settings while this.onSettings is still pending" error:

- **Deferred Settings Updates**: Uses `setTimeout` to defer secondary settings updates until after `onSettings` completes
- **Single Settings Call**: Consolidates multiple settings changes into a single `setSettings()` call
- **Power Settings Auto-Management**: Automatically manages related flow card settings when power measurements are toggled
- **Async Error Handling**: Proper error handling for deferred settings operations
- **Race Condition Prevention**: Eliminates concurrent `setSettings()` calls that could corrupt device configuration

#### Pairing Flow

Three-step pairing process:

1. `enter_device_info` - Collect device credentials (ID, local key, IP)
2. `list_devices` - Display discovered device
3. `add_devices` - Finalize device registration

Enhanced with error categorization for improved troubleshooting during pairing failures.

### Configuration Files

- **app.json**: **AUTO-GENERATED** - Never edit manually! Generated by Homey Compose from `.homeycompose/` structure
- **`.homeycompose/app.json`**: App-level configuration source file
- **`.homeycompose/capabilities/`**: Individual capability definition files (modular approach)
- **driver.compose.json**: Driver metadata, capability assignments, capability options, pairing flows
- **driver.settings.compose.json**: Device settings that users can configure per device instance
- **tsconfig.json**: TypeScript compilation settings targeting Node 16

#### Homey Compose Architecture (CRITICAL)

**✅ CORRECT approach - Use Homey Compose structure:**

```
.homeycompose/
├── app.json                     # App configuration
├── capabilities/                # Modular capability definitions
│   ├── adlar_enum_countdown_set.json
│   ├── adlar_enum_mode.json
│   └── [other capabilities].json
├── flow/
│   ├── actions/                # Flow action definitions
│   ├── conditions/             # Flow condition definitions
│   └── triggers/               # Flow trigger definitions
└── drivers/
    └── intelligent-heat-pump/
        ├── driver.compose.json         # Driver structure
        └── driver.settings.compose.json # Device settings
```

**❌ NEVER manually edit `app.json`:**

- File contains: `"_comment": "This file is generated. Please edit .homeycompose/app.json instead."`
- Gets overwritten on every build
- Manual changes will be lost

**✅ Benefits of Homey Compose approach:**

- **Consistency**: Ensures proper structure and validation
- **Maintainability**: Modular files easier to manage
- **Version Control**: Clear separation of concerns
- **Compliance**: Follows official Homey development guidelines

#### Settings Architecture (IMPORTANT)

**Device settings belong in `driver.settings.compose.json`, NOT in `driver.compose.json`:**

- ✅ **`driver.settings.compose.json`** - User-configurable settings for each device instance:
  - Device credentials (Device ID, Local Key, IP Address)
  - Feature toggles (enable/disable power measurements)
  - Flow card control settings
  - Diagnostic settings
  
- ❌ **`driver.compose.json`** - Driver structure and metadata only:
  - Capabilities definitions
  - Capability options (min/max values, titles, etc.)
  - Pairing flows
  - Driver class and platform settings
  
**Rule**: If a user can change it in device settings UI, it belongs in `driver.settings.compose.json`

#### Flow Card Control System (v0.92.4+)

**Dynamic Flow Card Management**: Users can control flow card visibility per device through settings UI:

**Settings Categories:**

- `flow_temperature_alerts` - Temperature-related flow cards
- `flow_voltage_alerts` - Voltage monitoring flow cards
- `flow_current_alerts` - Current monitoring flow cards
- `flow_power_alerts` - Power consumption flow cards
- `flow_pulse_steps_alerts` - Valve position flow cards
- `flow_state_alerts` - System state change flow cards
- `flow_expert_mode` - Advanced diagnostic flow cards

**Settings Values & Behavior:**

| Setting | Behavior | Use Case |
|---------|----------|----------|
| **`disabled`** | No flow cards for this category | Clean interface, unused sensors |
| **`auto`** | Show only for healthy capabilities with data | **Default** - Reliable alerts only |
| **`enabled`** | Force all capability flow cards active | Safety critical, troubleshooting |

**Flow Card Logic (`shouldRegisterCategory`):**

```typescript
switch (userSetting) {
  case 'disabled':
    return false; // No cards at all
  
  case 'enabled': 
    return availableCaps.length > 0; // Show if ANY capabilities exist
  
  case 'auto':
  default:
    // Show only if capabilities exist AND have healthy data
    return availableCaps.length > 0 
           && availableCaps.some((cap) => capabilitiesWithData.includes(cap));
}
```

**Capability Health Detection:**

- **Healthy**: Recent data (< 5 minutes), < 10 consecutive null values
- **Unhealthy**: Stale data, too many null values, no recent updates
- **Auto mode**: Excludes unhealthy capabilities from flow card registration
- **Enabled mode**: Includes all capabilities regardless of health status

**Temperature Alerts Example** (`flow_temperature_alerts = "enabled"`):

- **Flow Triggers Available**: `coiler_temperature_alert`, `tank_temperature_alert`, `ambient_temperature_changed`, etc.
- **Safety Monitoring**: Critical temperature thresholds (> 80°C, < -20°C) always active
- **Alert Conditions**: Configurable thresholds per sensor type
- **Notification System**: Critical alerts sent via Homey notifications

**Power Settings Auto-Management:**

- When `enable_power_measurements = false` → Auto-disables `flow_power_alerts`, `flow_voltage_alerts`, `flow_current_alerts`
- When `enable_power_measurements = true` → Resets related flow settings to `auto`
- Prevents inconsistent configuration states

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

- ✅ Use capability definitions from `.homeycompose/capabilities/` directory for custom capabilities
- ✅ Extract enum values and parameter ranges from `drivers/intelligent-heat-pump/driver.compose.json`
- ✅ Define Flow cards in `.homeycompose/flow/` directory structure
- ❌ Do NOT reference any files in the `docs/` directory for flow card implementation
- ❌ Do NOT manually edit generated `app.json` file
- ✅ All capability metadata should come from the official compose configuration files

**Capability Development Best Practices:**

1. **Create individual capability files** in `.homeycompose/capabilities/[capability_name].json`
2. **Reference capabilities** in `driver.compose.json` under `capabilities` array
3. **Let Homey Compose generate** the final `app.json` automatically
4. **Use modular approach** for maintainability and version control
5. **Follow naming conventions** for capability IDs and file names

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

### handling of global app.json

**Context Token Optimization**: The auto-generated `app.json` file (199KB) should be handled by specialized agents to reduce context overhead:

- **For app.json analysis**: Use the `homey-automation-tutor` agent which has full tool access and Homey expertise
- **For changelog updates**: Always refer to `.homeycompose/app.json` instead of `app.json`
- **For general development**: Focus on editable source files in `.homeycompose/` directory
- **When app.json access needed**: Delegate to `homey-automation-tutor` agent rather than including in main context

**Rationale**: `app.json` is auto-generated from `.homeycompose/` files, creating 200KB+ of redundant context. Agent delegation provides access when needed while keeping general context lean.
