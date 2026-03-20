# Copilot Instructions for org.hhi.adlar-heatpump

## Commands

```bash
npm run build          # Compile TypeScript → .homeybuild/
npm run lint           # ESLint (Athom ruleset) on .js and .ts files
homey app validate     # Validate app structure and manifest
homey app validate -l debug  # Deep validation with debug logging
homey app run          # Deploy to paired Homey Pro with live reload
```

There is no automated test suite. Validation is done via linting and Homey runtime.

## Architecture

This is a single-driver Homey app for an Adlar heat pump via Tuya's local API. Everything centers on one device type: `drivers/intelligent-heat-pump/`.

**Request flow**: `app.ts` registers flow cards → `driver.ts` handles pairing → `device.ts` manages the device lifecycle → `ServiceCoordinator` orchestrates 14 services.

**Source of truth for capabilities**: `lib/definitions/adlar-mapping.ts` maps Tuya DPS (data points) to Homey capability IDs. Every capability used in flow cards, device.ts, or driver.ts must have an entry here.

**Config generation**: `app.json` is **auto-generated** from `.homeycompose/app.json`. Never edit `app.json` directly — changes will be overwritten on the next build.

### Service Architecture

`ServiceCoordinator` in `lib/services/service-coordinator.ts` initializes and manages 14 services:

| Service | Purpose |
|---|---|
| `TuyaConnectionService` | Device connection, reconnect, multi-layer heartbeat |
| `CapabilityHealthService` | Real-time DPS health tracking |
| `FlowCardManagerService` | Dynamic flow card registration (64 cards) |
| `EnergyTrackingService` | External power measurement integration |
| `SettingsManagerService` | Race-condition-safe settings persistence |
| `COPCalculator` | Real-time COP (8 calculation methods) |
| `RollingCOPCalculator` | Daily/weekly/monthly rolling averages |
| `SCOPCalculator` | Seasonal COP per EN 14825 |
| `AdaptiveControlService` | PI-based temperature control + building model learning |

Services receive `{ device, logger? }` in their constructor. They are stateful singletons per device instance.

### Flow Card Registration

`app.ts` uses pattern-based helpers (`registerTemperatureAlerts`, `registerStateChanges`, etc.) from `lib/flow-helpers.ts` to reduce boilerplate across 30+ auto-generated flow cards. Individual card definitions live in `.homeycompose/flow/` split into `triggers/`, `conditions/`, and `actions/`.

## Key Conventions

### Homey SDK3 Rules (strictly enforced)

**Timers** — always use Homey's managed timers, never globals:
```typescript
// ✅ Correct
const handle = this.homey.setTimeout(() => { ... }, 5000);
// In onDeleted():
this.homey.clearTimeout(handle);

// ❌ Wrong — persists after app restart
setTimeout(() => { ... }, 5000);
```

**Logging** — `console.log()` does not appear in Homey's app log:
```typescript
// ✅ In device/driver classes
this.log('message');
this.error('message');

// ✅ In services — use injected logger
constructor(config: { logger?: (msg: string, ...args: unknown[]) => void }) {
  this.logger = config.logger ?? (() => {});
}

// ❌ Never
console.log('message');
```

**Type safety** — `as any` disables type checking; use `@ts-expect-error` with an explanation:
```typescript
// ✅ Documents the reason, TypeScript still validates the rest
// @ts-expect-error — accessing TuyAPI internal socket for crash prevention
const socket = this.tuya.client;

// ❌
const socket = (this.tuya as any).client;
```

**TuyAPI event handlers** must be synchronous. For async work, fire-and-forget with `.catch()`:
```typescript
this.tuya.on('data', (data) => {
  this.handleData(data).catch((err) => this.error('handleData failed', err));
});
```

### Adding a New Capability

1. Create `.homeycompose/capabilities/<capability_id>.json` — must include `"id"` and `"icon"` properties.
2. Add to `capabilities` array in `drivers/intelligent-heat-pump/driver.compose.json`.
3. Add DPS mapping entry in `lib/definitions/adlar-mapping.ts`.
4. Add migration in `device.ts` `onInit()` (new capabilities are NOT automatically added to existing devices):

```typescript
const newCaps = ['my_new_capability'];
for (const cap of newCaps) {
  if (!this.hasCapability(cap)) {
    await this.addCapability(cap).catch((err) => this.error(`Migration failed for ${cap}`, err));
  }
}
```

### SVG Icons (iOS/Safari compatibility)

WebKit does not inherit `stroke`/`fill` from the root `<svg>`. Apply attributes on each element:

```xml
<!-- ✅ Correct -->
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="80" height="80"
        fill="none" stroke="currentColor" stroke-width="3"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>

<!-- ❌ Wrong — iOS will not render stroke/fill -->
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
     fill="none" stroke="currentColor" stroke-width="3">
  <rect x="10" y="10" width="80" height="80"/>
</svg>
```

Reference: `assets/compressor-state.svg` is a known-working example.

### Localization

All user-facing strings must include at least `en` and `nl`. Capability titles, flow card hints, and fault code descriptions all use the `{ "en": "...", "nl": "...", "de": "...", "fr": "..." }` format.

### Naming

- Classes and enums: `PascalCase`
- Functions, services, capability IDs: `camelCase`
- Constants in `lib/constants.ts`: `UPPER_SNAKE_CASE`
- Import order: Homey SDK → third-party → local

### Commits

Use imperative mood. Release commits are prefixed with the version tag:
```
v1.2.3: Fix external energy total persistence
```

### Changelog (`homeychangelog.json`)

Target end users — state **what** changed in 1–2 sentences. Do not explain why or how, and avoid technical details.

## Code Change Policy

- Analyze and present a proposed solution before making changes.
- Wait for explicit user approval before implementing.
- Git write operations (`add`, `commit`, `push`, `tag`, etc.) require explicit user instruction — never commit automatically.
