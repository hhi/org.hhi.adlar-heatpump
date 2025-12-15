# Repository Guidelines

## Project Structure & Module Organization
The Homey app entrypoint lives in `app.ts`, which wires drivers and flow cards. Device-specific logic and adapters sit in `drivers/`, while reusable domain helpers, services, and constants are grouped under `lib/`. UI assets, icons, and capability images remain in `assets/`. All localisation strings reside in `locales/` (English and Dutch). Supporting documentation and validation utilities, including capability specs and AJV scripts, live in `docs/`. Keep environment defaults in `env.json`; never commit real device credentials.

## Build, Test, and Development Commands
Run `npm install` once per clone to sync dependencies.

- Build TypeScript: `npm run build` (emits to `.homeybuild/` via `tsconfig.json`).
- Lint sources: `npm run lint` (Athom ESLint ruleset).
- Validate app packaging: `homey app validate` (use `homey app validate -l debug` for deeper logging).
- Runtime testing: `homey app run` for live reloading on a paired Homey Pro.
- When debugging flow registrations locally, enable the optional inspector in `app-debug.ts`.

## Coding Style & Naming Conventions
Code is TypeScript-first with ES2020 modules.

- Follow two-space indentation, trailing commas, and semicolons as enforced by ESLint.
- Classes and flow card enumerations use PascalCase; functions, services, and capability IDs prefer camelCase.
- Constants exported from `lib/constants.ts` stay UPPER_SNAKE_CASE.
- Group imports by Homey SDK, third-party modules, then local files.
- For Markdown files, adhere to markdownlint rules.

## Homey SDK3 & App Runtime Rules
These are “must follow” rules to keep the app stable and Homey-SDK3 compliant.

### Timers & Cleanup
- ALWAYS use `this.homey.setTimeout()` / `this.homey.setInterval()` or `this.device.homey.setTimeout()` / `this.device.homey.setInterval()` (never global `setTimeout/setInterval`).
- ALWAYS clear timers in `destroy()` / `onDeleted()` paths to prevent leaks and “ghost” intervals after app restarts/updates.
- When using `Promise.race()` with a timeout, ensure the timeout handle is cleared in a `finally` block.

### Logging
- NEVER use `console.log()`; it won’t reliably show up in Homey app logs.
- Use `this.log()` / `this.error()` in Homey classes, or pass an injected `logger?: (message: string, ...args: unknown[]) => void` into service classes.

### Type Safety
- NEVER use `as any`.
- If you must access library internals, prefer `@ts-expect-error` with a short explanation so TypeScript still checks the rest of the line.

### Event Handlers (TuyAPI)
- Keep TuyAPI event handlers synchronous (do not make them `async`).
- If async work is needed, start it “fire-and-forget” and ensure you `.catch()` to avoid unhandled rejections.

## Testing & Validation
There is no automated test suite yet; rely on linting plus Homey runtime validation.

- Add targeted validation scripts under `docs/` (mirroring `docs/Heatpump specs/caps validation/ajv-test.js`) when introducing new capabilities.
- Name future Jest or AVA specs as `*.test.ts` alongside the code they verify.
- Prefer gating work on `npm run lint` and `homey app validate`.
- Document manual test flow scenarios in `docs/` for regression tracking.

## Changelog Management
When updating `.homeychangelog.json`:

- Target audience is end users.
- State WHAT changed (factual) and keep it concise (1–2 sentences).
- Do NOT explain WHY, do NOT explain HOW, and avoid marketing language.

## Commit & Pull Request Guidelines
Recent commits use pragmatic subject lines, often prefixed with the release tag (e.g., `v0.99.35: Fix external energy total persistence`). Follow that pattern for release work; otherwise use imperative mood (`Add`, `Fix`, `Update`). Each pull request should reference the impacted driver or service, describe verification steps (Homey CLI, lint, manual flows), and attach screenshots or logs for new capabilities. Link Homey app store issues when applicable and request review before publishing.
