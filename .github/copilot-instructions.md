# Copilot Instructions for org.hhi.adlar-heatpump

## Overview
This repository contains the codebase for the Adlar Heat Pump integration with Homey. The project is written in TypeScript and follows Homey app development conventions. It includes custom capabilities, device pairing flows, and DPS mappings for Tuya devices.

## Key Files and Directories

### Root Files
- `app.ts`: Entry point for the Homey app.
- `app-debug.ts`: Debugging entry point.
- `app.json`: Configuration file for the Homey app.
- `tsconfig.json`: TypeScript configuration.
- `package.json`: Node.js dependencies and scripts.

### Directories
- `assets/`: Contains images and icons used in the app.
- `docs/`: Documentation files, including capability schemas and examples.
- `drivers/`: Contains driver implementations for devices.
- `lib/`: Shared libraries and definitions.
- `locales/`: Localization files for different languages.

## Development Guidelines

### Homey App Compliance
- Ensure all capabilities and drivers are defined in `app.json` and `driver.compose.json`.
- Follow Homey conventions for pairing flows and capability definitions.

### TypeScript Best Practices
- Use strict typing wherever possible.
- Follow the `tsconfig.json` settings for consistent code style.

### DPS Mappings
- DPS mappings are defined in `adlar-mapping.ts`.
- Ensure mappings align with the Tuya device specifications.

### Pairing Flows
- Pairing flows are defined in `driver.compose.json`.
- Use the `navigation` construct for multi-step pairing processes.

## AI Agent Usage

### Code Refactoring
- Refactor code to align with Homey conventions and TypeScript best practices.
- Ensure DPS mappings and capabilities are consistent across files.

### Documentation
- Update this file (`copilot-instructions.md`) with any new patterns or workflows.
- Ensure all changes are documented in `README.txt` or `README.nl.txt`.

### Debugging
- Use `app-debug.ts` for debugging the Homey app.
- Log errors and warnings to the Homey app console.

## Contribution Guidelines
- Follow the `CONTRIBUTING.md` file for contribution rules.
- Ensure all code changes pass linting and tests.

## Additional Notes
- Refer to the `CODE_OF_CONDUCT.md` for community guidelines.
- Use the `LICENSE` file for licensing information.

---

This file is intended to guide AI agents and developers in understanding the structure and conventions of this repository. Update it as the project evolves.
