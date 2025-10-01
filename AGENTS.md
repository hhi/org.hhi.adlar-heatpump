# Repository Guidelines

## Project Structure & Module Organization
The Homey app entrypoint lives in `app.ts`, which wires drivers and flow cards. Device-specific logic and adapters sit in `drivers/`, while reusable domain helpers, services, and constants are grouped under `lib/`. UI assets, icons, and capability images remain in `assets/`. All localisation strings reside in `locales/` (English and Dutch). Supporting documentation and validation utilities, including capability specs and AJV scripts, live in `docs/`. Keep environment defaults in `env.json`; never commit real device credentials.

## Build, Test, and Development Commands
Run `npm install` once per clone to sync dependencies. Compile TypeScript with `npm run build` (emits to `build/` via `tsconfig.json`). Lint sources with `npm run lint`, which applies the Athom ESLint ruleset. Use the Homey CLI for device-level testing: `homey app run` for live reloading on a paired Homey Pro, and `homey app validate` before packaging. When debugging flow registrations locally, enable the optional inspector in `app-debug.ts`.

## Coding Style & Naming Conventions
Code is TypeScript-first with ES2020 modules. Follow two-space indentation, trailing commas, and semicolons as enforced by ESLint. Classes and flow card enumerations use PascalCase; functions, services, and capability IDs prefer camelCase; constants exported from `lib/constants.ts` stay UPPER_SNAKE_CASE. Group imports by Homey SDK, third-party modules, then local files. Reference IDs in `drivers/*/driver.compose.json` must match `locales/` keys.

## Testing Guidelines
There is no automated test suite yet; rely on linting plus Homey runtime validation. Add targeted validation scripts under `docs/` (mirroring `docs/Heatpump specs/caps validation/ajv-test.js`) when introducing new capabilities. Name future Jest or AVA specs as `*.test.ts` alongside the code they verify, and gate merges on `npm run lint` and `homey app validate`. Document manual test flow scenarios in `docs/` for regression tracking.

## Commit & Pull Request Guidelines
Recent commits use pragmatic subject lines, often prefixed with the release tag (e.g., `v0.99.35: Fix external energy total persistence`). Follow that pattern for release work; otherwise use imperative mood (`Add`, `Fix`, `Update`). Each pull request should reference the impacted driver or service, describe verification steps (Homey CLI, lint, manual flows), and attach screenshots or logs for new capabilities. Link Homey app store issues when applicable and request review before publishing.
