# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**📖 Detailed Documentation**: For in-depth architectural information, see [`docs/architecture/`](docs/architecture/) directory.

## 🚨 CRITICAL: Code Change Authorization Policy

**MANDATORY WORKFLOW FOR ALL CODE CHANGES:**

1. **ANALYZE FIRST** - When encountering bugs or feature requests:
   - Investigate and analyze the issue thoroughly
   - Document findings, root causes, and proposed solutions
   - Present analysis to user for review

2. **WAIT FOR APPROVAL** - Before making ANY code changes:
   - Present proposed solution with clear explanation
   - Wait for explicit user approval to proceed
   - Do NOT use agents that automatically modify code without prior user consent

3. **IMPLEMENT ONLY AFTER APPROVAL** - Once approved:
   - Make the agreed-upon changes
   - Test and validate
   - Report results

4. **GIT OPERATIONS - STRICTLY RESTRICTED:**
   - ❌ **FORBIDDEN for ALL agents except github-release-manager**: `git add`, `git commit`, `git push`, `git tag`, `git merge`, `git rebase`, `git cherry-pick`, `git reset --hard`, or ANY git operation that modifies the repository
   - ✅ **ALLOWED**: Read-only git operations (`git status`, `git diff`, `git log`, `git show`)
   - ✅ **EXCEPTION**: Only the `github-release-manager` agent is authorized to perform git commits/tags/pushes for release management
   - ✅ **MAIN ASSISTANT**: ONLY commit when user explicitly requests "commit this" or similar explicit instruction
   - ❌ **NEVER** automatically commit code changes without explicit user command
   - ✅ **ALWAYS** show what will be committed before executing any git commit

**Agent-Specific Restrictions:**

- `homey-bug-fixer`: ❌ NO git operations - analysis and code fixes only
- `homey-implementation-guide`: ❌ NO git operations - guidance only
- `documentation-revision-analyst`: ❌ NO git operations - analysis only
- `svg-icon-designer`: ❌ NO git operations - design only; ⚠️ MUST follow SVG Icon Guidelines below
- `Explore`: ❌ NO git operations - read-only exploration
- `Plan`: ❌ NO git operations - planning only
- `code-reviewer`: ❌ NO git operations - review only
- `github-release-manager`: ✅ AUTHORIZED for git tag, git commit, git push, gh release (release management only); ⚠️ MUST follow Release Workflow below

**Release Workflow (MANDATORY for github-release-manager):**

1. **ALWAYS run `git status`** first to see ALL modified/deleted/untracked files
2. **ASK user confirmation** before staging: "I found X modified files, Y deleted files, Z untracked files. Should I include all of these?"
3. **Stage ALL relevant files** - do not cherry-pick only files mentioned in the prompt
4. **Include `app.json`** - this auto-generated file MUST be committed with every release
5. **Include documentation changes** - if docs were modified, they belong in the release commit
6. **Include untracked files (`??`)** - new files in the working directory belong in the commit UNLESS user explicitly says "do NOT commit this file"
7. **Default assumption**: If a file exists in the working directory and is relevant to the project, it should be committed
8. **Verify with `git status`** after staging to confirm NOTHING is left behind (status should be empty)
9. **Only proceed with commit/tag/push** after user confirms all files are staged

**Rationale**: Unauthorized code changes and commits have repeatedly caused unnecessary rollbacks and recovery actions. The user must maintain full control over all code modifications.

**Violation Consequences**: Failure to follow this policy damages trust and creates additional work for the user.

## 🎨 SVG Icons

iOS/Safari (WebKit) does not inherit `fill`/`stroke` from the root `<svg>`: put these attributes on
every shape, never on the root. Full checklist and example: skill `svg-icons` (mandatory for the
svg-icon-designer agent).

## Development Commands

### Validate

```bash
homey app validate
```

Validates the Homey app structure, manifest, and configuration. Use `-l debug` for detailed logging.

**Development Workflow:**

- Use `homey app validate -l debug` to check if you can test the app via `homey app run`
- Use `homey app validate` to verify the app is ready for publishing via `homey app publish`

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

**Settings Changes (`onSettings()`)**:

- **ALWAYS** read new values from the `newSettings` parameter, **NEVER** from `this.device.getSetting()` inside `onSettings()`
- **WHY**: Homey calls the handler *before* persisting the new values — `getSetting()` may still return the old value at that point
- **Pattern**:
  ```typescript
  if (changedKeys.includes('my_setting')) {
    // ✅ CORRECT — reads from parameter (guaranteed new value)
    const newValue = (newSettings.my_setting as number | null) ?? defaultValue;

    // ❌ WRONG — getSetting() may still return the old value
    // const newValue = this.device.getSetting('my_setting');
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

When updating `.homeychangelog.json`, follow skill `changelog` (end users: state what changed,
no why or how, 1–2 sentences; clean up only at certification, owner decides).

## Project Architecture

This is a Homey app for integrating Adlar heat pump devices via Tuya's local API and via Modbus TCP. The architecture follows Homey's app development patterns with TypeScript and implements a **Service-Oriented Architecture** for code organization, testability, and maintainability.

### Drivers (v3.2.0)

| Driver | ID | Code | Flow-card / capability suffix |
|---|---|---|---|
| Tuya | `intelligent-heat-pump` | `lib/tuya/` | — |
| Aurora II (Modbus) | `intelligent-heatpump-modbus` | `lib/modbus/` | `_modbus` |
| Aurora III (Modbus) | `intelligent-heatpump-aurora3` | `lib/aurora3/` | `_aurora3` |

Shared code lives in `lib/shared/`. Most services exist once per driver; see [SERVICE_ARCHITECTURE.md](docs/architecture/SERVICE_ARCHITECTURE.md) for which ones and [ADR-004](docs/architecture/ADR-004-AURORA3-DRIVER-MERGE.md) for the reasons.

**Rules for driver-specific code:**

- **Flow-card IDs are unique per driver** unless a card is deliberately shared via a pipe filter (`driver_id=a|b|c`) and only fired from device code without a per-device run listener. A card with a per-device run listener on an app-wide singleton must not be shared: the last driver to initialize would win the handler.
- **A capability ID that has a different meaning per model gets a suffix** (e.g. `adlar_mode` for Aurora II vs `adlar_mode_aurora3`); new capabilities without a conflict get no suffix.
- **Check ownership after changing capabilities or drivers**: `npm run check:caps` and `python3 scripts/migration/verify.py`.
- **Aurora III register notation** is Modicon: `3-NNNN` is an input register (FC04, read-only), `4-NNNN` a holding register (FC03/FC06, read/write).
- **Aurora III Modbus transport**: `lib/aurora3/protocol/modbus-tcp-service.ts` takes a `TimerProvider` and falls back to global timers without one; `modbus-connection-service.ts` builds it from `homey.setTimeout`/`setInterval`. Keep passing it, so Homey manages timer cleanup on restarts.
- **Keep the Aurora III capability mapping in sync** when adding or remapping Aurora III capabilities: `docs/Dev support/modbus/adlar3-capability-modbus-register-mapping.md`.
- **Dashboards**: Aurora II uses `app.dashboard` (port 8090, `public/`), Aurora III uses `app.aurora3Dashboard` (port 8091, `public/aurora3/`) through the typed `Aurora3AppHost` interface. Tuya uses `app.tuyaDashboard` (default port 8092, `public/tuya/`) through `TuyaDashboardHost`, with per-device registrations and the existing Tuya connection (ADR-068). Aurora II and Tuya share the page stylesheets in `public/styles/`; keep Tuya-specific layout adaptations in `public/tuya/dashboard.css`.

**📖 Detailed Documentation**: See [docs/architecture/SERVICE_ARCHITECTURE.md](docs/architecture/SERVICE_ARCHITECTURE.md)

### Configuration Files

**Homey Compose Architecture (CRITICAL)** — edit `.homeycompose/`; **❌ NEVER manually edit `app.json`:**

- File contains: `"_comment": "This file is generated. Please edit .homeycompose/app.json instead."`
- Gets overwritten on every build
- Manual changes will be lost

**Settings Architecture**:

- ✅ **`driver.settings.compose.json`** - User-configurable settings for each device instance
- ❌ **`driver.compose.json`** - Driver structure and metadata only (DO NOT put settings here)

**Rule**: If a user can change it in device settings UI, it belongs in `driver.settings.compose.json`

**📖 Calculator utilities** (curve, time schedule, seasonal mode): see [docs/Dev support/CALCULATORS.md](docs/Dev%20support/CALCULATORS.md)

### Important Project Constraints

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
8. **ALWAYS add migration code** - New capabilities are NOT automatically added to existing devices after app updates. Add migration code in `device.ts` `onInit()`:

   ```typescript
   // Migration vX.Y.Z: Add [description] capabilities
   const newCapabilities = ['capability_name_1', 'capability_name_2'];
   for (const capability of newCapabilities) {
     if (!this.hasCapability(capability)) {
       try {
         await this.addCapability(capability);
         this.log(`Migration vX.Y.Z: Added ${capability} capability`);
       } catch (error) {
         this.error(`Failed to add ${capability} capability:`, error);
       }
     }
   }
   ```

9. **Ask for version number BEFORE implementation** - When implementing a plan that adds new features/capabilities, first ask the user what version number to use for the release

## Official Homey Documentation

SDK and manual links: skill `homey-sdk-docs`.

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
- [Flow Cards Guide](docs/setup/guide/FLOW_CARDS_GUIDE.en.md) - User-facing flow card usage (also available as `.nl.md`, `.de.md`, `.fr.md`)
- [Adaptive Control Architecture](docs/Dev%20support/Architectural%20overview/adaptive-control-architecture.md) - PI control, building model, COP/cost optimization

**Development Support**:
- [Service Architecture Guide](docs/Dev%20support/Architectural%20overview/service-architecture-guide.md) - Detailed service implementation
- [Setup Documentation](docs/setup/) - Installation and configuration guides
