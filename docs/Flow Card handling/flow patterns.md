# Flow Helpers Explanation

  The lib/flow-helpers.ts file is a pattern-based flow card management system that simplifies and standardizes flow card
  registration in the Homey heat pump app. Here's a comprehensive breakdown:

## Core Purpose

  Instead of manually registering each flow card individually, this system uses patterns to automatically handle similar flow cards
   with consistent behavior, reducing code duplication and making maintenance easier.

## Key Components

  1. FlowCardPattern Interface

 ```javascript
  export interface FlowCardPattern {
    cardId: string;                    // Flow card ID (e.g., 'set_target_temperature')
    capabilityName?: string;           // Homey capability it controls
    pattern: 'temperature_alert' | ...; // Behavior pattern type
    sensorType?: string;               // Sensor classification
    requiresCapability?: string;       // Capability requirement check
  }
 ```

  2. Registration Functions

### Trigger Registration Functions

- registerTemperatureAlerts() - Temperature sensor alerts
- registerVoltageAlerts() - Electrical voltage monitoring
- registerCurrentAlerts() - Electrical current monitoring
- registerPressureAlerts() - Pressure sensor alerts
- registerStateChanges() - System state changes

### Action & Condition Registration

- registerSimpleActions() - Device control actions
- registerSimpleConditions() - Logic conditions

  3. Pattern-Based Logic

  Simple Actions Pattern:

```javascript
  // Automatically handles: get user input → set device capability
  await device.setCapabilityValue(capabilityName, value);
```

  Simple Conditions Pattern:

```javascript
  // Automatically handles: get device value → compare with threshold
  return Number(currentValue) > Number(threshold);
```

## Advanced Features

### Capability Validation

 ```javascript
  // Prevents flow cards from running on unsupported devices
  if (requiresCapability && !device.hasCapability(requiresCapability)) {
    throw new Error(`This action requires ${requiresCapability} capability`);
  }
 ```

### Debug-Conditional Logging

  Only logs detailed information when DEBUG=1 is set, keeping production logs clean.

  Configuration Data Structure

### FLOW_PATTERNS Object

- temperatureAlerts: 9 temperature sensor triggers
- voltageAlerts: 3-phase electrical monitoring triggers
- currentAlerts: Electrical current monitoring triggers
- pressureAlerts: Pressure sensor triggers
- stateChanges: System state change triggers
- simpleActions: 9 device control actions
- simpleConditions: 5 logic conditions

  Example Pattern:

  ```javascript
  {
    cardId: 'set_target_temperature',
    pattern: 'simple_action',
    capabilityName: 'target_temperature'
  }
  ```

## Benefits of This Architecture

  1. Code Reduction: ~40 flow cards managed with ~200 lines vs ~800+ lines manually
  2. Consistency: All similar cards behave identically
  3. Maintainability: Change behavior in one place, affects all similar cards
  4. Type Safety: TypeScript ensures proper patterns and capabilities
  5. Device Compatibility: Automatic capability checking prevents errors
  6. Error Handling: Standardized error messages and logging
  7. Extensibility: Easy to add new patterns or cards

### Usage in Main App

  ```javascript
  // In app.ts - registers all patterns automatically
  registerSimpleActions(this, FLOW_PATTERNS.simpleActions);
  registerSimpleConditions(this, FLOW_PATTERNS.simpleConditions);
  // ... other patterns

  ```

  This architecture transforms what would be hundreds of lines of repetitive flow card registration code into a clean,
  maintainable, pattern-based system that automatically handles device compatibility, error cases, and debug logging.
