# Flow Helpers System - Pattern-Based Flow Card Management (v0.99.40)

The pattern-based flow card management system simplifies and standardizes flow card registration in the Homey heat pump app. This system was refined in v0.75.0 to eliminate invalid flow card references, enhanced in v0.90.3 with robust error handling, expanded in v0.92.4+ with user-controlled dynamic registration, integrated with insights management in v0.92.6+, and transitioned to **service-oriented architecture in v0.99.23+**.

**Service Architecture (v0.99.23+)**: Flow card management is now handled by the **FlowCardManagerService** (`lib/services/flow-card-manager-service.ts`), which uses the flow helpers pattern system while integrating with **CapabilityHealthService** for health-based registration and **SettingsManagerService** for user preference management.

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
9. **Health Awareness**: Integrates with capability health monitoring via CapabilityHealthService
10. **Enhanced Error Categorization**: v0.90.3 adds comprehensive error handling with DeviceConstants and TuyaErrorCategorizer
11. **Service Integration (v0.99.23+)**: FlowCardManagerService centralizes pattern-based registration
12. **Dynamic Registration**: Health-based auto-registration via service coordination
13. **Settings Integration**: User preferences managed via SettingsManagerService

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

## User-Controlled Dynamic Registration & Insights Integration (v0.92.7)

### Enhanced Settings Management Architecture

The pattern-based system now integrates with race condition prevention and insights management:

**Settings Management Integration:**
```javascript
// Deferred pattern registration to prevent race conditions
if (Object.keys(settingsToUpdate).length > 0) {
  this.homey.setTimeout(async () => {
    try {
      await this.setSettings(settingsToUpdate);
      await this.updateFlowCardsBasedOnHealth(); // Triggers pattern re-registration
    } catch (error) {
      this.error('Pattern registration settings update failed:', error);
    }
  }, DeviceConstants.SETTINGS_DEFER_DELAY_MS);
}
```

**Power Settings Auto-Management with Patterns:**
```javascript
// When power measurements disabled → auto-disable related patterns
if (!enablePowerMeasurements) {
  settingsToUpdate.flow_power_alerts = 'disabled';    // No power patterns
  settingsToUpdate.flow_voltage_alerts = 'disabled';  // No voltage patterns  
  settingsToUpdate.flow_current_alerts = 'disabled';  // No current patterns
}

// When power measurements enabled → reset patterns to auto mode
if (enablePowerMeasurements && wasDisabled) {
  settingsToUpdate.flow_power_alerts = 'auto';        // Smart power patterns
  settingsToUpdate.flow_voltage_alerts = 'auto';      // Smart voltage patterns
  settingsToUpdate.flow_current_alerts = 'auto';      // Smart current patterns
}
```

### Insights-Pattern Synchronization (v0.92.6+)

**Unified Management System:**
```javascript
// Enhanced capability management with pattern awareness
for (const capability of powerCapabilities) {
  if (enablePowerMeasurements) {
    // Add capability, enable insights, register patterns
    if (!this.hasCapability(capability)) {
      await this.addCapability(capability);
    }
    await this.setCapabilityOptions(capability, { insights: true });
    
    // Trigger pattern re-registration for power categories
    await this.updateFlowCardsBasedOnHealth();
  } else {
    // Disable insights, unregister patterns, remove capability
    await this.setCapabilityOptions(capability, { insights: false });
    await this.unregisterFlowCardsForCategory('power');
    await this.removeCapability(capability);
  }
}
```

**Pattern-Insights Alignment Matrix:**

| Pattern Category | Flow Cards | Insights | Toggle Behavior |
|-----------------|------------|----------|-----------------|
| **Temperature Patterns** | ✅ Static | ✅ Static | Always available |
| **Power Patterns** | 🔄 Dynamic | 🔄 Dynamic | Follow power toggle |
| **Voltage Patterns** | 🔄 Dynamic | 🔄 Dynamic | Follow power toggle |
| **Current Patterns** | 🔄 Dynamic | 🔄 Dynamic | Follow power toggle |
| **State Patterns** | ✅ Static | ✅ Static | Always available |

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

### Settings-Based Pattern Registration (v0.92.7)

**Enhanced User Settings Control (7 Categories):**
- `flow_temperature_alerts = "disabled"` → No temperature patterns register
- `flow_temperature_alerts = "auto"` → Only patterns for healthy capabilities register  
- `flow_temperature_alerts = "enabled"` → All available patterns register
- `flow_voltage_alerts = "disabled"` → No voltage patterns register
- `flow_current_alerts = "disabled"` → No current patterns register
- `flow_power_alerts = "disabled"` → No power patterns register
- `flow_pulse_steps_alerts = "disabled"` → No valve position patterns register
- `flow_state_alerts = "disabled"` → No system state patterns register
- `flow_expert_mode = false` → No expert diagnostic patterns register

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

## Advanced Pattern Features (v0.92.7)

### Race Condition Prevention in Pattern Registration

**Deferred Registration Pattern:**
```javascript
// Prevent "Cannot set Settings while this.onSettings is still pending" errors
async onSettings({ oldSettings, newSettings, changedKeys }) {
  // Primary settings update
  await this.handleOptionalCapabilities();
  
  // Deferred pattern re-registration
  if (flowSettingsChanged) {
    this.homey.setTimeout(async () => {
      try {
        await this.updateFlowCardsBasedOnHealth();
        this.debugLog('Pattern registration updated successfully');
      } catch (error) {
        this.error('Deferred pattern registration failed:', error);
      }
    }, DeviceConstants.SETTINGS_DEFER_DELAY_MS);
  }
}
```

### Insights-Aware Pattern Registration

**Dynamic Pattern-Insights Coordination:**
```javascript
// When patterns register, ensure insights alignment
async registerTemperatureAlerts(app, patterns, healthyCapabilities) {
  patterns.forEach(async pattern => {
    const isHealthy = healthyCapabilities.includes(pattern.capabilityName);
    
    if (shouldRegister && (forceEnabled || isHealthy)) {
      // Register pattern
      app.homey.flow.getTriggerCard(pattern.cardId);
      
      // Ensure insights are enabled for core temperature sensors
      if (pattern.sensorType === 'temperature') {
        await this.setCapabilityOptions(pattern.capabilityName, {
          insights: true,
          chartType: 'spline',
          color: '#FF6B35'
        });
      }
    }
  });
}
```

### Enhanced Category Management

**Complete Flow Card Category System:**

| Category | Pattern Count | Default Mode | Insights Integration |
|----------|---------------|--------------|---------------------|
| **temperature** | 11 cards | `enabled` | ✅ Always enabled |
| **voltage** | 3 cards | `auto` | 🔄 Dynamic with power toggle |
| **current** | 3 cards | `auto` | 🔄 Dynamic with power toggle |
| **power** | 3 cards | `auto` | 🔄 Dynamic with power toggle |
| **pulse_steps** | 2 cards | `enabled` | ✅ Always enabled |
| **state** | 5 cards | `enabled` | ✅ Always enabled |
| **expert** | 3 cards | `disabled` | ✅ Always enabled |

## Current Architecture Benefits (v0.92.7)

1. **Code Reduction**: ~58 flow cards managed with ~250 lines vs ~1000+ lines manually
2. **Consistency**: All similar cards behave identically across registration modes
3. **User Control**: Complete control over flow card complexity per device with 7 categories
4. **Health Awareness**: Automatic registration based on sensor health status and data availability
5. **Insights Integration**: Seamless coordination between pattern registration and insights visibility
6. **Race Condition Prevention**: Deferred pattern registration prevents settings conflicts
7. **Power Management Integration**: Automatic pattern cascade when power measurements toggled
8. **Maintainability**: Change behavior in one place, affects all similar cards
9. **Type Safety**: TypeScript ensures proper patterns and capabilities
10. **Device Compatibility**: Automatic capability checking prevents errors
11. **Settings Integration**: Seamless integration with user preference system
12. **Performance**: Only registers needed patterns, reducing memory usage and interface clutter
13. **Enhanced Error Categorization**: Comprehensive error handling with DeviceConstants and TuyaErrorCategorizer
14. **Clean Default Experience**: Power patterns disabled by default, aligned with insights management

## Future Extensibility (v0.92.7)

### Adding New Pattern Categories

**New Category Integration:**
```javascript
// 1. Add to FLOW_PATTERNS object
export const FLOW_PATTERNS = {
  // existing categories...
  newCategoryAlerts: [
    {
      cardId: 'new_category_alert',
      capabilityName: 'new_capability',
      pattern: 'new_category_alert',
      sensorType: 'new_sensor'
    }
  ]
};

// 2. Add user setting in driver.settings.compose.json
{
  "id": "flow_new_category_alerts",
  "type": "dropdown", 
  "value": "auto",
  "values": [
    {"id": "disabled", "label": {"en": "Disabled"}},
    {"id": "auto", "label": {"en": "Auto"}}, 
    {"id": "enabled", "label": {"en": "Enabled"}}
  ]
}

// 3. Add to category processing in device.ts
const categories = ['temperature', 'voltage', 'current', 'power', 
                   'pulse_steps', 'state', 'new_category'];
```

This enhanced architecture transforms what would be hundreds of lines of repetitive flow card registration code into a clean, maintainable, pattern-based system that automatically handles device compatibility, user preferences, capability health, insights management, race condition prevention, power management cascading, and debug logging while providing complete user control over automation complexity and data visualization.
