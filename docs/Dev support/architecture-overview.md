# Architecture Overview (v0.96.3)

This document provides a comprehensive overview of the Adlar Heat Pump Homey app architecture, focusing on the utility libraries and core systems that provide reliability, maintainability, and enhanced user experience through intelligent insights management.

## Constants Management System

### DeviceConstants Class (`lib/constants.ts`)

The `DeviceConstants` class centralizes all configuration values, magic numbers, and thresholds to improve code maintainability and prevent inconsistencies.

#### Timing Intervals (milliseconds)

| Constant | Value | Purpose |
|----------|--------|---------|
| `NOTIFICATION_THROTTLE_MS` | 30 minutes | Prevents spam notifications |
| `RECONNECTION_INTERVAL_MS` | 20 seconds | Tuya device reconnection attempts |
| `HEALTH_CHECK_INTERVAL_MS` | 2 minutes | Capability health monitoring |
| `NOTIFICATION_KEY_CHANGE_THRESHOLD_MS` | 5 seconds | Notification key change tolerance |
| `CAPABILITY_TIMEOUT_MS` | 5 minutes | Capability considered unhealthy threshold |

#### Power Thresholds (watts)

| Constant | Value | Purpose |
|----------|--------|---------|
| `HIGH_POWER_ALERT_THRESHOLD_W` | 5000W | High consumption alerts |
| `DEFAULT_POWER_THRESHOLD_W` | 1000W | Default threshold for flow cards |

#### Performance & Health Monitoring

| Constant | Value | Purpose |
|----------|--------|---------|
| `LOW_EFFICIENCY_THRESHOLD_PERCENT` | 50% | Low efficiency alerts |
| `NULL_THRESHOLD` | 10 | Consecutive nulls before unhealthy |
| `MAX_CONSECUTIVE_FAILURES` | 5 | Connection failures before backoff |

#### Time Formatting Constants

| Constant | Value | Purpose |
|----------|--------|---------|
| `MS_PER_SECOND` | 1000 | Time calculations |
| `SECONDS_PER_MINUTE` | 60 | Time calculations |
| `MINUTES_PER_HOUR` | 60 | Time calculations |

### Benefits of Centralized Constants

1. **Single Source of Truth**: All configuration values in one location
2. **Type Safety**: TypeScript ensures correct usage
3. **Easy Maintenance**: Change values in one place affects entire codebase
4. **Documentation**: Self-documenting code with descriptive constant names
5. **Consistency**: Prevents duplicate or conflicting values across files

### Usage Pattern

```typescript
import { DeviceConstants } from '../../lib/constants';

// Instead of magic numbers:
setTimeout(() => this.reconnect(), 20000); // ❌ Magic number

// Use centralized constants:
setTimeout(() => this.reconnect(), DeviceConstants.RECONNECTION_INTERVAL_MS); // ✅
```

## COP (Coefficient of Performance) System Architecture (v0.96.3+)

### COP Calculation Engine (`lib/services/cop-calculator.ts`)

The COP calculation system provides intelligent heat pump efficiency monitoring with multiple calculation methods and automatic data source selection.

#### Calculation Methods Hierarchy

| Method | Accuracy | Requirements | Description |
|--------|----------|--------------|-------------|
| **Direct Thermal** | ±5% | Power, flow, inlet/outlet temps | Most accurate using direct heat transfer |
| **Power Module** | ±8% | Auto-detected power module | Hardware-based power measurement |
| **Refrigerant Circuit** | ±12% | Pressure/temperature sensors | Refrigerant state analysis |
| **Carnot Estimation** | ±15% | Compressor freq, temperatures | Theoretical efficiency estimation |
| **Valve Correlation** | ±20% | Valve positions, temperatures | Valve state correlation |
| **Temperature Difference** | ±30% | Inlet/outlet temperatures only | Basic temperature rise calculation |

#### COP Constants in DeviceConstants Class

```typescript
// COP calculation constants
static readonly COP_CALCULATION_INTERVAL_MS = 30 * 1000; // 30 seconds
static readonly EXTERNAL_DEVICE_QUERY_TIMEOUT_MS = 5 * 1000; // 5 seconds
static readonly WATER_SPECIFIC_HEAT_CAPACITY = 4186; // J/(kg·K)
static readonly CELSIUS_TO_KELVIN = 273.15;
static readonly MIN_VALID_COP = 0.5;
static readonly MAX_VALID_COP = 8.0;

// COP ranges for validation
static readonly COP_RANGES = {
  AIR_TO_WATER_MIN: 2.5,
  AIR_TO_WATER_MAX: 4.5,
  GROUND_SOURCE_MIN: 3.5,
  GROUND_SOURCE_MAX: 5.5,
  DURING_DEFROST_MIN: 1.0,
  DURING_DEFROST_MAX: 2.0,
  IDEAL_CONDITIONS_MIN: 4.0,
  IDEAL_CONDITIONS_MAX: 6.0,
};

// Carnot efficiency factors
static readonly CARNOT_EFFICIENCY = {
  BASE_EFFICIENCY: 0.4, // Base practical efficiency (40% of Carnot)
  FREQUENCY_FACTOR: 0.1, // Additional efficiency per 100Hz
  MIN_EFFICIENCY: 0.3, // Minimum practical efficiency
  MAX_EFFICIENCY: 0.5, // Maximum practical efficiency
};
```

#### COP Method Transparency System

**Method Visibility Capability (`adlar_cop_method`):**

```typescript
// COP method display with confidence indicators
private formatCOPMethodDisplay(method: string, confidence: string): string {
  const methodNames: Record<string, string> = {
    direct_thermal: 'Direct Thermal',
    power_module: 'Power Module',
    refrigerant_circuit: 'Refrigerant Circuit',
    carnot_estimation: 'Carnot Estimation',
    valve_correlation: 'Valve Correlation',
    temperature_difference: 'Temperature Difference',
    insufficient_data: 'Insufficient Data'
  };

  const confidenceIndicators: Record<string, string> = {
    high: '🟢',
    medium: '🟡',
    low: '🔴'
  };

  const methodName = methodNames[method] || method;
  const confidenceIndicator = confidenceIndicators[confidence] || '';

  return `${methodName} ${confidenceIndicator}`;
}
```

#### Cross-App Data Integration

**External Data Request System:**

The COP system can request data from other Homey apps/devices via flow card triggers:

```typescript
// External data request flow triggers
request_external_power_data     // Request power consumption data
request_external_ambient_data   // Request ambient temperature data
request_external_flow_data     // Request water flow rate data

// Corresponding response flow actions
receive_external_power_data    // Receive power data from external device
receive_external_ambient_data  // Receive ambient data from external device
receive_external_flow_data     // Receive flow data from external device
```

#### COP Outlier Detection System

**Outlier Detection Constants:**

```typescript
static readonly COP_TEMP_DIFF_THRESHOLDS = {
  LOW_EFFICIENCY_TEMP_DIFF: 5, // °C - below this use low efficiency COP
  MODERATE_EFFICIENCY_TEMP_DIFF: 15, // °C - between low and high efficiency
  LOW_EFFICIENCY_COP: 2.0,
  MODERATE_EFFICIENCY_COP_BASE: 2.5,
  MODERATE_EFFICIENCY_SLOPE: 0.15, // COP increase per °C
  HIGH_EFFICIENCY_COP: 4.0,
};

static readonly POWER_ESTIMATION = {
  COMPRESSOR_BASE_POWER: 500, // Watts at minimum frequency
  COMPRESSOR_MAX_POWER: 4000, // Watts at maximum frequency
  COMPRESSOR_MIN_FREQUENCY: 20, // Hz minimum operating frequency
  COMPRESSOR_MAX_FREQUENCY: 120, // Hz maximum operating frequency
  COMPRESSOR_POWER_CURVE_EXPONENT: 1.8, // Power scales non-linearly

  FAN_BASE_POWER: 50, // Watts at minimum speed
  FAN_MAX_POWER: 300, // Watts at maximum speed
  AUXILIARY_POWER_BASE: 150, // System electronics and pumps
  DEFROST_POWER_MULTIPLIER: 1.3, // 30% increase during defrost
};
```

#### COP User Settings Integration

**Device Settings for COP Control (`driver.settings.compose.json`):**

```json
{
  "id": "cop_calculation_enabled",
  "type": "checkbox",
  "value": true
},
{
  "id": "cop_calculation_method",
  "type": "dropdown",
  "value": "auto",
  "values": ["auto", "direct_thermal", "carnot_estimation", "temperature_difference"]
},
{
  "id": "cop_outlier_detection_enabled",
  "type": "checkbox",
  "value": true
},
{
  "id": "external_data_timeout",
  "type": "number",
  "value": 5,
  "min": 1,
  "max": 30
}
```

#### COP Debug and Testing Framework

**Comprehensive Debug Tool (`debug-cop.js`):**

- **Real-time Simulation**: Test all 6 calculation methods with sample data
- **Outlier Detection**: Test extreme values and sensor failure scenarios
- **Method Comparison**: Side-by-side accuracy comparison of different methods
- **Data Source Analysis**: Identify which data sources are available/missing
- **Performance Profiling**: Measure calculation timing and accuracy

### Benefits of COP System Architecture

1. **Method Transparency**: Users can see which calculation method was used
2. **Data Quality Awareness**: Confidence indicators show reliability level
3. **Cross-App Integration**: Can utilize external sensors for better accuracy
4. **Outlier Detection**: Prevents unrealistic values from sensor malfunctions
5. **Comprehensive Testing**: Full debug framework for development and troubleshooting

## Error Handling Architecture

### TuyaErrorCategorizer (`lib/error-types.ts`)

The error handling system provides structured error categorization, recovery guidance, and improved debugging capabilities.

#### Error Categories (TuyaErrorType)

| Category | Description | Recoverable | Retryable | Common Causes |
|----------|-------------|-------------|-----------|---------------|
| `CONNECTION_FAILED` | Cannot connect to device | ✅ | ✅ | Network issues, wrong IP |
| `TIMEOUT` | Device response timeout | ✅ | ✅ | Device busy, slow network |
| `DEVICE_NOT_FOUND` | Device not on network | ✅ | ✅ | Device offline, IP changed |
| `AUTHENTICATION_ERROR` | Invalid credentials | ❌ | ❌ | Wrong local key/device ID |
| `DPS_ERROR` | Data point communication error | ✅ | ❌ | Unsupported feature, firmware |
| `NETWORK_ERROR` | Network connectivity issue | ✅ | ✅ | Router, DNS, firewall |
| `DEVICE_OFFLINE` | Device unreachable | ✅ | ✅ | Power off, network disconnect |
| `VALIDATION_ERROR` | Invalid input data | ❌ | ❌ | Out of range, wrong format |
| `UNKNOWN_ERROR` | Unhandled error type | ✅ | ✅ | Unexpected conditions |

#### CategorizedError Interface

```typescript
interface CategorizedError {
  type: TuyaErrorType;              // Error category
  originalError: Error;             // Original error object
  context: string;                  // Where error occurred
  recoverable: boolean;             // Can be recovered
  retryable: boolean;               // Should retry operation
  userMessage: string;              // User-friendly message
  recoveryActions: string[];        // Suggested recovery steps
}
```

#### TuyaErrorCategorizer Methods

##### `categorize(error: Error, context: string): CategorizedError`

Analyzes error and returns categorized information with recovery guidance.

##### `formatForLogging(categorizedError: CategorizedError): string`

Creates structured log messages for debugging and monitoring.

##### `shouldReconnect(categorizedError: CategorizedError): boolean`

Determines if error should trigger device reconnection attempt.

### Error Handling Pattern

```typescript
import { TuyaErrorCategorizer } from '../../lib/error-types';

try {
  await this.setCapabilityValue(capability, value);
} catch (error) {
  const categorizedError = TuyaErrorCategorizer.categorize(
    error as Error, 
    `Setting capability ${capability}`
  );
  
  // Structured logging
  this.error(TuyaErrorCategorizer.formatForLogging(categorizedError));
  
  // Smart retry for recoverable errors
  if (categorizedError.retryable) {
    setTimeout(() => {
      this.setCapabilityValue(capability, value)
        .catch((retryErr) => this.error(`Retry failed: ${retryErr}`));
    }, 1000);
  }
  
  // Reconnection logic
  if (TuyaErrorCategorizer.shouldReconnect(categorizedError)) {
    this.scheduleReconnection();
  }
}
```

## Integration Points

### Device Communication Integration

The enhanced error handling integrates with device communication at multiple levels:

1. **Capability Updates**: Automatic retry for failed capability sets
2. **Flow Card Registration**: Graceful handling of missing flow cards
3. **Tuya Connection**: Smart reconnection based on error type
4. **Health Monitoring**: Error-aware capability health tracking

### Constants Usage Throughout Codebase

Constants are used consistently across:

1. **Timing Operations**: All setTimeout/setInterval calls
2. **Threshold Checks**: Power, temperature, efficiency limits  
3. **Health Monitoring**: Timeout and null count thresholds
4. **Flow Card Logic**: Alert thresholds and conditions
5. **Notification System**: Throttling and timing controls

## Benefits of This Architecture

### Enhanced Reliability

- **Smart Error Recovery**: Automatic retry for recoverable failures
- **Categorized Debugging**: Structured error information for troubleshooting
- **Consistent Timeouts**: Centralized timeout management prevents conflicts

### Improved Maintainability  

- **Single Configuration Point**: All constants in one location
- **Type Safety**: TypeScript prevents configuration errors
- **Self-Documenting**: Clear constant names and error categories

### Better User Experience

- **User-Friendly Error Messages**: Clear explanations instead of technical errors
- **Recovery Guidance**: Specific actions users can take to resolve issues
- **Reduced Error Spam**: Intelligent throttling and retry logic

### Developer Productivity

- **Structured Debugging**: Categorized errors make troubleshooting faster
- **Consistent Patterns**: Standardized error handling across codebase
- **Easy Extension**: Simple to add new error categories or constants

## Future Extensibility

### Adding New Constants

```typescript
export class DeviceConstants {
  // Add new constant with descriptive comment
  /** New feature timeout threshold */
  static readonly NEW_FEATURE_TIMEOUT_MS = 10 * 1000; // 10 seconds
}
```

### Adding New Error Categories

```typescript
export enum TuyaErrorType {
  // Add new error type
  NEW_ERROR_TYPE = 'new_error_type'
}

// Update categorizer with new pattern matching
if (errorMessage.includes('new_pattern')) {
  return {
    type: TuyaErrorType.NEW_ERROR_TYPE,
    // ... error details
  };
}
```

## Settings Management & Race Condition Prevention

### Device Settings Architecture (`device.ts` onSettings method)

The settings management system prevents Homey's "Cannot set Settings while this.onSettings is still pending" error through careful async operation orchestration.

#### Race Condition Problem

Homey prevents concurrent settings modifications to avoid configuration corruption:

- Multiple `setSettings()` calls within `onSettings()` create race conditions
- Secondary settings updates must wait for primary operation to complete
- Concurrent access results in "Cannot set Settings while this.onSettings is still pending" error

#### Solution Architecture

**Deferred Settings Pattern:**

```typescript
// ❌ Race condition - concurrent setSettings calls
await this.setSettings(primarySettings);
await this.setSettings(secondarySettings); // FAILS

// ✅ Deferred pattern - eliminate race condition
if (Object.keys(settingsToUpdate).length > 0) {
  this.homey.setTimeout(async () => {
    try {
      await this.setSettings(settingsToUpdate);
      await this.updateFlowCards(); // Chain dependent operations
    } catch (error) {
      this.error('Settings update failed:', error);
    }
  }, 100); // 100ms delay ensures onSettings completion
}
```

#### Key Implementation Features

| Feature | Implementation | Benefit |
|---------|----------------|---------|
| **Deferred Updates** | `setTimeout` wrapper | Prevents concurrent `setSettings()` calls |
| **Single Consolidation** | Merge all updates into one call | Reduces async complexity |
| **Error Handling** | Try/catch in deferred operation | Prevents silent failures |
| **Dependency Chaining** | Sequential operations in setTimeout | Ensures proper order |
| **Auto-Management** | Power settings trigger related changes | Consistent configuration |

#### Settings Auto-Management Logic

**Power Measurements Toggle:**

```typescript
// When power measurements disabled → auto-disable related flow alerts
if (!enablePower) {
  settingsToUpdate.flow_power_alerts = 'disabled';
  settingsToUpdate.flow_voltage_alerts = 'disabled';  
  settingsToUpdate.flow_current_alerts = 'disabled';
}

// When power measurements enabled → reset to auto mode
if (enablePower && wasDisabled) {
  settingsToUpdate.flow_power_alerts = 'auto';
  settingsToUpdate.flow_voltage_alerts = 'auto';
  settingsToUpdate.flow_current_alerts = 'auto';
}
```

#### Benefits of Settings Architecture

1. **Race Condition Prevention**: Eliminates concurrent settings access errors
2. **Atomic Updates**: Consolidated settings changes prevent partial states
3. **Error Recovery**: Proper error handling for deferred operations
4. **Auto-Consistency**: Related settings automatically stay synchronized
5. **User Experience**: Settings changes apply smoothly without errors

## Flow Card Control System Architecture

### Dynamic Flow Card Management (`v0.92.4+`)

The flow card control system provides users with granular control over which automation triggers and conditions are available in the Homey Flow editor on a per-device basis.

#### Settings-Based Flow Card Registration

**User Settings Categories:**

```typescript
interface UserFlowPreferences {
  flow_temperature_alerts: 'disabled' | 'auto' | 'enabled';
  flow_voltage_alerts: 'disabled' | 'auto' | 'enabled';
  flow_current_alerts: 'disabled' | 'auto' | 'enabled';
  flow_power_alerts: 'disabled' | 'auto' | 'enabled';
  flow_pulse_steps_alerts: 'disabled' | 'auto' | 'enabled';
  flow_state_alerts: 'disabled' | 'auto' | 'enabled';
  flow_expert_mode: boolean;
}
```

#### Registration Logic Decision Tree

**`shouldRegisterCategory()` Method:**

```typescript
switch (userSetting) {
  case 'disabled':
    return false; // Completely disable category
  
  case 'enabled': 
    return availableCaps.length > 0; // Show if capabilities exist
  
  case 'auto':
  default:
    // Intelligence: Only show for healthy capabilities
    return availableCaps.length > 0 
           && availableCaps.some((cap) => capabilitiesWithData.includes(cap));
}
```

#### Capability Health System Integration

**Health Criteria for Flow Card Registration:**

- **Recent Data**: Capability updated within `CAPABILITY_TIMEOUT_MS` (5 minutes)
- **Data Quality**: Fewer than `NULL_THRESHOLD` (10) consecutive null values  
- **Active Monitoring**: Regular health checks via `HEALTH_CHECK_INTERVAL_MS` (2 minutes)

**Health-Based Flow Card Updates:**

```typescript
private async updateFlowCardsBasedOnHealth(): Promise<void> {
  const healthyCapabilities = this.getHealthyCapabilitiesByCategory();
  
  // Re-register flow cards only for categories with health changes
  for (const category of categoriesToUpdate) {
    await this.unregisterFlowCardsForCategory(category);
    await this.registerFlowCardsByCategory(
      category,
      healthyCapabilities[category],
      userPrefs[`flow_${category}_alerts`],
      capabilitiesWithData,
    );
  }
}
```

#### Temperature Flow Cards Example

**When `flow_temperature_alerts = "enabled"`:**

**Available Flow Triggers:**

- `coiler_temperature_alert` - Coiler sensor threshold alerts
- `tank_temperature_alert` - Tank temperature monitoring
- `ambient_temperature_changed` - Environmental changes
- `inlet_temperature_changed` - System inlet monitoring
- `discharge_temperature_alert` - High-pressure discharge alerts

**Safety Integration:**

```typescript
// Critical temperature monitoring (always active)
if (value > 80 || value < -20) {
  await this.sendCriticalNotification(
    'Temperature Alert',
    `Extreme temperature detected (${value}°C). System safety may be compromised.`,
  );
}

// Configurable threshold alerts
if (value > 60 || value < 0) {
  await this.triggerFlowCard(temperatureCapabilityMap[capability], {
    temperature: value,
    sensor_type: capability.split('.')[1] || 'unknown',
  });
}
```

#### Power Settings Auto-Management Logic

**Cascading Settings Updates:**

```typescript
// When power measurements are disabled
if (!enablePowerMeasurements) {
  settingsToUpdate.flow_power_alerts = 'disabled';
  settingsToUpdate.flow_voltage_alerts = 'disabled';  
  settingsToUpdate.flow_current_alerts = 'disabled';
}

// When power measurements are re-enabled
if (enablePowerMeasurements && wasDisabled) {
  settingsToUpdate.flow_power_alerts = 'auto';
  settingsToUpdate.flow_voltage_alerts = 'auto';
  settingsToUpdate.flow_current_alerts = 'auto';
}
```

#### Benefits of Flow Card Control Architecture

1. **User Experience**: Reduces Flow editor clutter by hiding irrelevant cards
2. **Safety**: Critical monitoring always active regardless of settings
3. **Flexibility**: Per-device customization for different installation types
4. **Intelligence**: Auto mode prevents false alerts from faulty sensors
5. **Performance**: Only registers necessary flow card listeners
6. **Troubleshooting**: Expert mode provides comprehensive diagnostic cards

#### Flow Card Categories and Triggers

| Category | Flow Cards | Typical Use Cases |
|----------|------------|-------------------|
| **Temperature** | 8 alert triggers, 3 change triggers | Safety monitoring, efficiency tracking |
| **Voltage** | 3 phase alerts | Electrical system monitoring |
| **Current** | 2 phase alerts, 1 load alert | Power consumption analysis |
| **Power** | 3 threshold triggers | Energy management, cost optimization |
| **Pulse-Steps** | 2 valve position alerts | HVAC system diagnostics |
| **States** | 5 system state changes | System behavior automation |
| **Expert** | 3 efficiency/diagnostic cards | Professional HVAC analysis |

## Insights Management Architecture (v0.92.6+)

### Dynamic Insights Control System

The insights management system provides intelligent control over Homey's data visualization features, aligning insights visibility with device capabilities and user preferences.

#### Insights Control Integration

**Power Measurement Toggle Integration:**

```typescript
// Enhanced capability management with insights control
for (const capability of powerCapabilities) {
  if (enablePowerMeasurements) {
    // Add capability and enable insights
    if (!this.hasCapability(capability)) {
      await this.addCapability(capability);
    }
    await this.setCapabilityOptions(capability, { insights: true });
  } else {
    // Disable insights before removing capability
    await this.setCapabilityOptions(capability, { insights: false });
    await this.removeCapability(capability);
  }
}
```

#### Default Insights Configuration

**Driver-Level Insights Settings (`driver.compose.json`):**

```json
{
  "capabilitiesOptions": {
    // Power-related capabilities - disabled by default for cleaner UX
    "measure_current.cur_current": { "insights": false },
    "measure_voltage.voltage_current": { "insights": false },
    "meter_power.power_consumption": { "insights": false },
    
    // Core operational capabilities - enabled by default
    "measure_temperature.temp_top": { "insights": true },
    "measure_frequency.compressor_strength": { "insights": true }
  }
}
```

#### Advanced Insights Features (Undocumented)

**Enhanced Chart Customization:**

```json
{
  "insights": true,
  "chartType": "spline",        // Smooth curves for temperature data
  "color": "#6236FF",           // Custom brand colors
  "decimals": 2,                // Precision control
  "fillOpacity": 0.3,           // Area chart transparency
  "dashed": true                // Line style options
}
```

#### Insights Architecture Benefits

| Feature | Implementation | User Benefit |
|---------|----------------|--------------|
| **Default Clean Interface** | Power insights disabled by default | Reduced data collection overhead |
| **Dynamic Control** | Programmatic insights toggle | Aligned with power measurement settings |
| **Stale Data Prevention** | Disable before capability removal | No confusing historical data |
| **User Flexibility** | Manual insights enable/disable | Preserve monitoring for power users |
| **Chart Customization** | Advanced styling options | Professional data visualization |

### Capability-Insights Alignment Matrix

| Capability Category | Default State | Toggle Behavior | Chart Type |
|-------------------|---------------|-----------------|------------|
| **Temperature Sensors** | ✅ Enabled | Static | `spline` |
| **Power Measurements** | ❌ Disabled | Dynamic | `area` |
| **System States** | ✅ Enabled | Static | `line` |
| **Valve Positions** | ✅ Enabled | Static | `column` |

## System Architecture Summary (v0.96.3)

This architecture provides a comprehensive foundation for reliable, maintainable, and extensible heat pump device integration featuring:

### Core Systems

- **Enhanced Error Handling**: 9 categorized error types with smart retry logic
- **Race Condition Prevention**: Deferred settings updates with atomic operations
- **Intelligent Flow Card Management**: Health-aware dynamic registration system
- **Advanced Insights Control**: Dynamic visibility aligned with user preferences
- **COP Calculation System**: Multi-method efficiency monitoring with transparency and outlier detection

### User Experience Features

- **Clean Default Interface**: Power insights disabled by default
- **Flexible Monitoring**: User-controlled insights visibility
- **Professional Visualizations**: Advanced chart customization options
- **Safety-First Design**: Critical monitoring always active regardless of settings
- **Method Transparency**: COP calculation method visibility with confidence indicators
- **Cross-App Integration**: External data integration via flow cards for enhanced accuracy

### Developer Benefits

- **Centralized Configuration**: Single source of truth for all constants
- **Structured Error Handling**: Categorized debugging and recovery guidance
- **Type Safety**: Full TypeScript integration with proper interfaces
- **Extensible Design**: Easy addition of new capabilities, error types, and insights features
- **Comprehensive COP Testing**: Debug framework with real-time simulation and method validation
- **Docker Debug Support**: Full debugging environment for development and troubleshooting
