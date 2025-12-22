# Claude Code Configuration

This directory contains configuration for [Claude Code](https://claude.ai/code).

## Setup Instructions

1. **Copy the example file**:
   ```bash
   cp settings.local.json.example settings.local.json
   ```

2. **Update placeholders**:
   - Replace `<YOUR_USERNAME>` with your actual macOS username
   - Adjust paths if your project is in a different location

3. **Keep it private**:
   - `settings.local.json` is automatically excluded from git (see `.gitignore`)
   - Never commit personal paths or credentials

## What's Included

- **Pre-approved commands**: Git operations, npm scripts, Homey CLI commands
- **Explanatory output style**: Provides educational insights during development
- **Additional directories**: Access to global Claude configuration

## Privacy Note

The `settings.local.json` file contains **absolute paths with your username** and is therefore:
- ✅ Excluded from git via `.gitignore`
- ✅ Only stored on your local machine
- ❌ Should never be shared or committed to GitHub

The `settings.local.json.example` template uses placeholders (`<YOUR_USERNAME>`) for safe sharing.
