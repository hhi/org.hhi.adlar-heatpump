# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**📖 Detailed Documentation**: For in-depth architectural information, see [`docs/architecture/`](docs/architecture/) directory.

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

### Coding and Formatting

All coding should be Typescript compliant
The code should adhere eslint rules (for example whitespacing)
For Markdown files adhere to markdownlint rules

#### Homey-Specific Best Practices

**Timer Management**:
- **ALWAYS** use `this.device.homey.setTimeout()` instead of global `setTimeout()`
- **ALWAYS** use `this.device.homey.setInterval()` instead of global `setInterval()`
- **WHY**: Homey's timer management provides automatic cleanup during app updates/restarts and prevents memory leaks
- **Pattern for Promise.race() with timeout**:
  ```typescript
  let timeoutHandle: NodeJS.Timeout | null = null;
  try {
    await Promise.race([
      asyncOperation(),
      new Promise((_, reject) => {
        timeoutHandle = this.device.homey.setTimeout(
          () => reject(new Error('Timeout')),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
  ```

**Type Safety**:
- **NEVER** use `as any` - it disables TypeScript's type checking entirely
- **PREFER** `@ts-expect-error` with explanatory comment when accessing library internals
- **Example**:
  ```typescript
  // ❌ BAD: No explanation, disables all type checking
  const socket = (this.tuya as any).client;

  // ✅ GOOD: Documented reason, TypeScript still validates rest of line
  // @ts-expect-error - Accessing TuyAPI internal socket for crash prevention
  const socket = this.tuya.client;
  ```

**Logging** (v2.1.0 - Structured Logger):
- **NEVER** use `console.log()` - logs don't appear in Homey's app logs
- **ALWAYS** use the structured Logger with log levels (ERROR/WARN/INFO/DEBUG)
- **Log levels** (hierarchical - each level includes all above):
  - `ERROR`: Critical failures, exceptions, unrecoverable errors (always logged)
  - `WARN`: Potential issues, degraded performance, recoverable errors
  - `INFO`: Important state changes, connections, user actions
  - `DEBUG`: Detailed diagnostics, internal state, trace information
- **In device.ts**: Logger automatically initialized with user-configurable log level from device settings

  ```typescript
  // Use the logger instance (already initialized in onInit)
  this.logger.error('Critical failure:', error);
  this.logger.warn('Potential issue detected');
  this.logger.info('Connection established');
  this.logger.debug('Detailed state:', { state });
  ```

- **In app.ts**: Logger automatically initialized based on DEBUG environment variable

  ```typescript
  // DEBUG=1 → DEBUG level, otherwise ERROR level
  this.logger.error('Critical app failure:', error);
  this.logger.info('App initialized');
  this.logger.debug('Internal state:', details);
  ```

- **In services**: Use logger callback pattern with level-aware logging

  ```typescript
  export interface ServiceConfig {
    // ... other config
    logger?: (message: string, ...args: unknown[]) => void;
  }

  export class MyService {
    private logger: (message: string, ...args: unknown[]) => void;

    constructor(config: ServiceConfig) {
      // Fallback to no-op if logger not provided
      this.logger = config.logger || (() => {});
    }

    someMethod(): void {
      // Service logs at appropriate level via callback
      this.logger('MyService: Something happened', { detail: 'value' });
    }
  }

  // In device.ts - pass logger with appropriate level method:
  new MyService({
    logger: (msg, ...args) => this.logger.debug(msg, ...args), // For debug-level service logs
  });
  ```

- **User configuration**: Users can change log level in device settings under "Diagnostics" → "Log Level"
  - ERROR (recommended): Only critical failures - minimal log noise
  - WARN: Errors + warnings
  - INFO: Errors + warnings + important events
  - DEBUG: All logs - for troubleshooting
- **Migration note**: Legacy `debugLog()` and `categoryLog()` methods are deprecated but still functional for backward compatibility

### Debug Mode

Set `DEBUG=1` environment variable to enable debug features in the Homey app.

### Changelog Management

When updating `.homeychangelog.json`:

**Target Audience**: Regular end users (not developers)

**Writing Guidelines**:

- ✅ **State WHAT changed** - Be factual and direct
- ✅ **Include concrete examples** - Show before/after when relevant
  (e.g., "3-Oct 14:25" instead of "03-10 14:25")
- ❌ **Do NOT explain WHY** - Avoid phrases like "makes it more
  readable", "for cleaner interface", "for better user experience"
- ❌ **Do NOT explain HOW** - Skip technical details like
  "supports both languages", implementation details
- ❌ **Do NOT add marketing language** - No justifications or
  selling points

**Structure**: Keep entries concise (1-2 sentences maximum)

**Good Examples**:

```text
"Connection status now shows month abbreviations
(e.g., '3-Oct 14:25' instead of '03-10 14:25')."

"Device credentials can now be updated directly in settings."
```

**Bad Examples**:

```text
"Improved connection status display with month abbreviations.
Supports both English and Dutch.
Makes timestamps more readable at a glance."

"Simplified credential management for cleaner interface
and better user experience."
```

## Project Architecture

This is a Homey app for integrating Adlar heat pump devices via Tuya's local API. The architecture follows Homey's app development patterns with TypeScript and implements a **Service-Oriented Architecture** for code organization, testability, and maintainability.

### Core Components

- **App Entry**: `app.ts` - Main Homey app class with debug mode support and global error handlers
- **Driver**: `drivers/intelligent-heat-pump/driver.ts` - Handles device discovery and pairing
- **Device**: `drivers/intelligent-heat-pump/device.ts` - Manages individual device instances, delegates to services
- **Service Coordinator**: `lib/services/service-coordinator.ts` - Manages lifecycle of 9 services
- **Mappings**: `lib/definitions/adlar-mapping.ts` - Maps Tuya DPS (data points) to Homey capabilities
- **Constants**: `lib/constants.ts` - Centralized configuration constants and thresholds
- **Error Handling**: `lib/error-types.ts` - Comprehensive error categorization and recovery system
- **Calculator Utilities**: `lib/curve-calculator.ts`, `lib/time-schedule-calculator.ts`, `lib/seasonal-mode-calculator.ts`

### Service-Oriented Architecture

The app uses **9 specialized services** managed by ServiceCoordinator:

**Infrastructure Services (5)**:
1. **TuyaConnectionService** - Device communication, auto-reconnection, heartbeat monitoring
2. **CapabilityHealthService** - Real-time DPS-only health tracking
3. **FlowCardManagerService** - Dynamic flow card registration (64 cards across 8 categories)
4. **EnergyTrackingService** - External power measurement integration
5. **SettingsManagerService** - Race condition prevention, settings persistence

**Calculation Services (3)**:
6. **COPCalculator** - Real-time COP with 8 methods (±5% to ±30% accuracy)
7. **RollingCOPCalculator** - Time-series analysis (daily/weekly/monthly rolling averages)
8. **SCOPCalculator** - Seasonal COP per EN 14825 European standard

**Advanced Control Services (1)**:
9. **AdaptiveControlService** - PI-based temperature control, building model learning, COP/cost optimization

**📖 Detailed Documentation**: See [docs/architecture/SERVICE_ARCHITECTURE.md](docs/architecture/SERVICE_ARCHITECTURE.md)

### Key Architecture Patterns

**Critical Patterns** (must understand before development):

- **Multi-Layer Heartbeat System**: Layer 0 (35s) → Layer 4 (10 min) zombie connection detection
  - [docs/architecture/HEARTBEAT_MECHANISM.md](docs/architecture/HEARTBEAT_MECHANISM.md)

- **DPS Mapping & Scale Transformation**: Tuya DPS → Homey capabilities with decimal value transforms
  - [docs/architecture/DPS_MAPPING.md](docs/architecture/DPS_MAPPING.md)

- **Error Handling & Recovery**: 9 error categories with automatic retry and crash prevention
  - [docs/architecture/ERROR_HANDLING.md](docs/architecture/ERROR_HANDLING.md)

- **Development Patterns**: Settings management, credential updates, connection persistence
  - [docs/architecture/KEY_PATTERNS.md](docs/architecture/KEY_PATTERNS.md)

### Configuration Files

**Homey Compose Architecture (CRITICAL)**:

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

**Settings Architecture**:

- ✅ **`driver.settings.compose.json`** - User-configurable settings for each device instance
- ❌ **`driver.compose.json`** - Driver structure and metadata only (DO NOT put settings here)

**Rule**: If a user can change it in device settings UI, it belongs in `driver.settings.compose.json`

### Calculator Utilities

**Production-ready calculator utilities for dynamic value calculations in flow cards**:

1. **Curve Calculator** - Weather compensation, COP adjustments (6 comparison operators, max 50 entries)
2. **Time Schedule Calculator** - Daily schedules with overnight ranges (max 30 entries)
3. **Seasonal Mode Calculator** - Automatic seasonal mode per EN 14825 standard (Oct 1 - May 15)

**📖 Comprehensive Documentation**: See [docs/Dev support/CALCULATORS.md](docs/Dev%20support/CALCULATORS.md)

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
2. **ALWAYS include `"id"` property** - Every capability file MUST have an explicit `"id"` property matching the filename (e.g., `adlar_simulated_target.json` must contain `"id": "adlar_simulated_target"`)
3. **ALWAYS include `"icon"` property** - Every capability should have an icon path (e.g., `"icon": "/assets/capability-name.svg"`) for proper UI presentation
4. **Reference capabilities** in `driver.compose.json` under `capabilities` array
5. **Let Homey Compose generate** the final `app.json` automatically
6. **Use modular approach** for maintainability and version control
7. **Follow naming conventions** for capability IDs and file names

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

### Handling of global app.json

**Context Token Optimization**: The auto-generated `app.json` file (199KB) should be handled by specialized agents to reduce context overhead:

- **For app.json analysis**: Use the `homey-automation-tutor` agent which has full tool access and Homey expertise
- **For changelog updates**: Always refer to `.homeycompose/app.json` instead of `app.json`
- **For general development**: Focus on editable source files in `.homeycompose/` directory
- **When app.json access needed**: Delegate to `homey-automation-tutor` agent rather than including in main context

**Rationale**: `app.json` is auto-generated from `.homeycompose/` files, creating 200KB+ of redundant context. Agent delegation provides access when needed while keeping general context lean.

- strings exposed to the user should be localized. Use localization as required.

---

## Architecture Documentation Index

**Core Architecture**:
- [Service Architecture](docs/architecture/SERVICE_ARCHITECTURE.md) - 9 services, memory management, adaptive control
- [Heartbeat Mechanism](docs/architecture/HEARTBEAT_MECHANISM.md) - Multi-layer zombie connection detection
- [Error Handling](docs/architecture/ERROR_HANDLING.md) - TuyaErrorCategorizer, crash prevention
- [DPS Mapping](docs/architecture/DPS_MAPPING.md) - DPS to capability mapping, scale transforms
- [Key Patterns](docs/architecture/KEY_PATTERNS.md) - Settings management, credential updates, connection persistence

**Feature Guides**:
- [Calculator Utilities](docs/Dev%20support/CALCULATORS.md) - Curve, time schedule, seasonal mode calculators
- [Flow Cards Guide](docs/setup/FLOW_CARDS_GUIDE.md) - User-facing flow card usage
- [Adaptive Control Architecture](docs/Dev%20support/Architectural%20overview/adaptive-control-architecture.md) - PI control, building model, COP/cost optimization

**Development Support**:
- [Service Architecture Guide](docs/Dev%20support/Architectural%20overview/service-architecture-guide.md) - Detailed service implementation
- [Setup Documentation](docs/setup/) - Installation and configuration guides
