# Flow Helpers System - Pattern-Based Flow Card Management

The `lib/flow-helpers.ts` file implements a sophisticated pattern-based flow card management system that simplifies and standardizes flow card registration in the Homey heat pump app. This system was refined in v0.75.0 to eliminate invalid flow card references, enhanced in v0.90.3 with robust error handling, and expanded in v0.92.4+ with user-controlled dynamic registration.

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

1. **Code Reduction**: ~40 flow cards managed with ~200 lines vs ~800+ lines manually
2. **Consistency**: All similar cards behave identically
3. **Maintainability**: Change behavior in one place, affects all similar cards
4. **Type Safety**: TypeScript ensures proper patterns and capabilities
5. **Device Compatibility**: Automatic capability checking prevents errors
6. **Error Handling**: Standardized error messages and logging (enhanced in v0.90.3)
7. **Extensibility**: Easy to add new patterns or cards
8. **Reliability**: v0.75.0 eliminated invalid flow card references
9. **Health Awareness**: Integrates with capability health monitoring system
10. **Enhanced Error Categorization**: v0.90.3 adds comprehensive error handling with DeviceConstants and TuyaErrorCategorizer

## v0.75.0 Improvements

### Removed Invalid Flow Cards
The system was refined to eliminate non-existent flow card references:
- ~~`current_above_threshold`~~ - Removed (didn't exist)
- ~~`voltage_in_range`~~ - Removed (didn't exist)  
- ~~`pulse_steps_in_range`~~ - Removed (didn't exist)
- ~~`system_in_state`~~ - Removed (didn't exist)

### Enhanced Reliability
- **Streamlined Registration**: Device-level flow card registration simplified
- **Pattern-Only System**: All flow cards now use proven pattern-based registration
- **Eliminated Startup Errors**: No more "Invalid Flow Card ID" errors
- **Cleaner Architecture**: Removed duplicate and conflicting registration code

## v0.90.3 Error Handling Improvements

### Centralized Constants Integration
Pattern-based flow cards now use `DeviceConstants` for consistent timing and thresholds:
- **Timeout Management**: All flow operations use centralized timeout values
- **Threshold Consistency**: Power, temperature, and efficiency thresholds from DeviceConstants
- **Notification Throttling**: Centralized control of alert frequency

### Enhanced Error Categorization
Flow card operations benefit from comprehensive error handling:
- **Smart Recovery**: Automatic retry for recoverable flow card registration failures
- **Categorized Logging**: Structured error information for troubleshooting flow issues
- **User-Friendly Messages**: Clear error explanations when flow cards fail to register
- **Context-Aware Handling**: Different recovery strategies based on error type

### Error Handling Pattern Integration
```javascript
try {
  await device.setCapabilityValue(capabilityName, value);
} catch (error) {
  const categorizedError = TuyaErrorCategorizer.categorize(
    error as Error, 
    `Flow action: ${cardId}`
  );
  
  // Structured logging for flow card errors
  this.error(TuyaErrorCategorizer.formatForLogging(categorizedError));
  
  // Smart retry for retryable flow card errors
  if (categorizedError.retryable) {
    setTimeout(() => {
      device.setCapabilityValue(capabilityName, value)
        .catch(retryErr => this.error(`Flow retry failed: ${retryErr}`));
    }, DeviceConstants.RETRY_DELAY_MS);
  }
}
```

## User-Controlled Dynamic Registration (v0.92.4+)

### Three-Mode Control System Integration

The pattern-based system now integrates with user-controlled flow card registration:

```javascript
// Device-level registration with user settings
async registerFlowCardsByCategory(category, availableCaps, userSetting, capabilitiesWithData) {
  const shouldRegister = this.shouldRegisterCategory(
    category, userSetting, availableCaps, capabilitiesWithData
  );
  
  if (shouldRegister) {
    // Use patterns from flow-helpers.ts
    const patterns = FLOW_PATTERNS[`${category}Alerts`];
    if (patterns) {
      registerTemperatureAlerts(this.homey, patterns);
    }
  }
}
```

### Settings-Based Pattern Registration

**User Settings Control Which Patterns Register:**
- `flow_temperature_alerts = "disabled"` → No temperature patterns register
- `flow_temperature_alerts = "auto"` → Only patterns for healthy capabilities register
- `flow_temperature_alerts = "enabled"` → All available patterns register

**Pattern Health Checking:**
```javascript
// Enhanced pattern registration with health awareness
export function registerTemperatureAlerts(app, patterns, healthyCapabilities) {
  patterns.forEach(pattern => {
    // Only register if capability is healthy (in auto mode)
    const isHealthy = healthyCapabilities.includes(pattern.capabilityName);
    if (shouldRegister && (forceEnabled || isHealthy)) {
      // Register using existing pattern logic
    }
  });
}
```

### Multi-Level Architecture

**App Level (`app.ts`):**
- Registers always-available patterns (simple actions/conditions)
- Uses `FLOW_PATTERNS` object with pattern definitions

**Device Level (`device.ts`):**  
- Dynamic registration based on user settings
- Health-aware pattern filtering
- Category-based pattern management

### Usage in Main App

```javascript
// In app.ts - registers always-available patterns
registerSimpleActions(this, FLOW_PATTERNS.simpleActions);
registerSimpleConditions(this, FLOW_PATTERNS.simpleConditions);
// Temperature, voltage, current patterns registered dynamically per device

// In device.ts - user-controlled pattern registration  
await this.registerFlowCardsByCategory(
  'temperature',
  availableCapabilities, 
  userSetting,
  healthyCapabilities
);
```

## Current Architecture Benefits (v0.92.4+)

1. **Code Reduction**: ~40 flow cards managed with ~200 lines vs ~800+ lines manually
2. **Consistency**: All similar cards behave identically across registration modes
3. **User Control**: Complete control over flow card complexity per device
4. **Health Awareness**: Automatic registration based on sensor health status  
5. **Maintainability**: Change behavior in one place, affects all similar cards
6. **Type Safety**: TypeScript ensures proper patterns and capabilities
7. **Device Compatibility**: Automatic capability checking prevents errors
8. **Settings Integration**: Seamless integration with user preference system
9. **Performance**: Only registers needed patterns, reducing memory usage
10. **Enhanced Error Categorization**: v0.90.3 comprehensive error handling

This architecture transforms what would be hundreds of lines of repetitive flow card registration code into a clean, maintainable, pattern-based system that automatically handles device compatibility, user preferences, capability health, error cases, and debug logging while providing complete user control over automation complexity.
