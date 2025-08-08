# Architecture Overview

This document provides a comprehensive overview of the Adlar Heat Pump Homey app architecture, focusing on the utility libraries and core systems that provide reliability and maintainability.

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

This architecture provides a solid foundation for reliable, maintainable, and extensible heat pump device integration while ensuring excellent error handling, race condition prevention, and seamless user experience.