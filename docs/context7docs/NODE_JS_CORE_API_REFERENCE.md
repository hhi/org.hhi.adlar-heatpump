# Node.js Core APIs Reference for Homey IoT Applications

This document provides a comprehensive guide to Node.js Core APIs used in the Adlar heat pump Homey application, focusing on IoT device integration patterns and best practices.

## Table of Contents

1. [Runtime Environment](#runtime-environment)
2. [Core Modules](#core-modules)
3. [Network Communication](#network-communication)
4. [Asynchronous Programming](#asynchronous-programming)
5. [Error Handling](#error-handling)
6. [Performance and Memory Management](#performance-and-memory-management)
7. [Debugging and Development](#debugging-and-development)
8. [Security Considerations](#security-considerations)
9. [Code Examples from Codebase](#code-examples-from-codebase)

## Runtime Environment

### Node.js Version Requirements

The application targets specific Node.js versions for compatibility:

```json
// package.json
{
  "engines": {
    "node": ">=12.16.1"
  }
}
```

```json
// tsconfig.json - targets Node 16 features
{
  "extends": "@tsconfig/node16/tsconfig.json"
}
```

**Key Considerations:**
- Minimum Node.js 12.16.1 for LTS support
- TypeScript compilation targets Node 16 features
- ES modules and CommonJS interoperability

## Core Modules

### 1. Process Module

Critical for environment configuration and debugging:

```typescript
// app.ts - Environment variable detection
if (process.env.DEBUG === '1') {
  this.log('Development mode detected, enabling debug features');
  this.log('HOMEY_APP_RUNNER_DEVMODE=', process.env.HOMEY_APP_RUNNER_DEVMODE);
  await enableDebugInspector();
}
```

```typescript
// app-debug.ts - Process version checking
if (
  typeof process !== 'undefined'
  && process.env.DEBUG === '1'  
  && process.versions
  && process.versions.node
) {
  // Enable debugging features
}
```

**Use Cases:**
- Environment variable access (`process.env`)
- Runtime version detection (`process.versions.node`)
- Development mode switching
- Platform-specific behavior

### 2. Inspector Module

Used for debugging Node.js applications:

```typescript
// app-debug.ts - Dynamic inspector import
export default async function enableDebugInspector() {
  try {
    const inspector: typeof import('inspector') = await import('inspector');
    console.log('WaitForDebugger inspector for debugging');
    inspector.waitForDebugger();
  } catch (error) {
    const inspector: typeof import('inspector') = await import('inspector');
    console.log('Open inspector for debugging');
    inspector.open(9225, '0.0.0.0', true);
  }
}
```

**Key Features:**
- `inspector.waitForDebugger()` - Pause execution until debugger attaches
- `inspector.open(port, host, wait)` - Start debugging session
- Dynamic import for conditional loading

### 3. Timers Module

Essential for IoT device reconnection and periodic tasks:

```typescript
// device.ts - Automatic reconnection
async connectTuya() {
  // Connection logic...
  
  // Schedule reconnection after 20 seconds
  this.homey.setTimeout(async () => {
    await this.connectTuya();
  }, 20000);
}
```

**Homey-specific Timer Usage:**
- `this.homey.setTimeout()` - Homey-managed timeout
- Automatic cleanup when device is removed
- Prevents memory leaks in long-running IoT applications

## Network Communication

### UDP and TCP for Device Discovery

While not directly visible in the current codebase, the TuyAPI library underneath uses Node.js core networking:

```typescript
// Typical Tuya device communication pattern
const tuya = new TuyaDevice({
  id: deviceId,        // Device identifier
  key: localKey,       // Encryption key
  ip: ipAddress,       // Device IP address
  version: '3.3'       // Protocol version
});

// Network operations
await tuya.find();     // UDP broadcast for device discovery
await tuya.connect();  // TCP connection establishment
```

**Network Considerations:**
- Local network device discovery via UDP broadcasts
- Persistent TCP connections for device communication  
- Automatic reconnection on network failures
- IP address management for static device connections

### DNS Resolution

For hostname-based device connections:

```typescript
// When using hostnames instead of IP addresses
const tuya = new TuyaDevice({
  id: deviceId,
  key: localKey,
  ip: 'heat-pump.local', // mDNS hostname
  version: '3.3'
});
```

## Asynchronous Programming

### Async/Await Patterns

The codebase extensively uses modern async/await patterns:

```typescript
// device.ts - Comprehensive async patterns
class MyDevice extends Homey.Device {
  async onInit() {
    await this.setUnavailable(); // Set initial state
    
    // Initialize device connection
    await this.connectTuya();
    
    // Register capability listeners
    this.registerCapabilityListener(capability, async (value, opts) => {
      await this.connectTuya();
      if (this.tuya) {
        await this.tuya.set({ dps: dp, set: value });
      }
    });
  }

  async connectTuya() {
    try {
      if (this.tuya) {
        await this.tuya.find();
        await this.tuya.connect();
        this.tuyaConnected = true;
      }
    } catch (err) {
      this.error('Failed to connect:', err);
      throw new Error('Could not connect to device');
    }
  }
}
```

### Promise Handling

Proper promise chains for device state management:

```typescript
// device.ts - Promise chaining for state updates
this.setCapabilityValue(capability, value)
  .then(() => this.log(`Updated ${capability} to ${value}`))
  .catch((err) => this.error(`Failed to update ${capability}:`, err));

this.setAvailable()
  .then(() => this.log('Device set as available'))
  .catch((err) => this.error('Error setting device as available:', err));
```

### Event-Driven Architecture

Using EventEmitter patterns for device communication:

```typescript
// device.ts - Event handling for Tuya device
this.tuya.on('data', (data: { dps: Record<number, unknown> }): void => {
  const dpsFetched = data.dps || {};
  this.log('Data received from Tuya:', dpsFetched);
  this.updateCapabilitiesFromDps(dpsFetched, this.allArraysSwapped);
});

this.tuya.on('connected', (): void => {
  this.log('Connected to device!');
  this.setAvailable()
    .then(() => this.log('Device set as available'))
    .catch((err) => this.error('Error setting device as available:', err));
});

this.tuya.on('disconnected', (): void => {
  this.log('Disconnected from device!');
  this.tuyaConnected = false;
  this.setUnavailable('Device disconnected')
    .then(() => this.log('Device set as unavailable'))
    .catch((err) => this.error('Error setting device as unavailable:', err));
});
```

## Error Handling

### Try-Catch Patterns

Comprehensive error handling for device operations:

```typescript
// device.ts - Error handling in device connection
async connectTuya() {
  if (!this.tuyaConnected) {
    try {
      if (this.tuya) {
        await this.tuya.find();
        await this.tuya.connect();
        this.tuyaConnected = true;
        this.log('Connected to Tuya device');
      } else {
        throw new Error('Tuya device is not initialized');
      }
    } catch (err) {
      this.error('Failed to find or connect to Tuya device:', err);
      throw new Error('Could not find or connect to device');
    }
  }
}
```

### Custom Error Types

Structured error handling for different failure scenarios:

```typescript
// driver.ts - Validation errors in pairing
session.setHandler('list_devices', async () => {
  if (!deviceCredentials) {
    throw new Error('Device credentials not provided');
  }
  // Continue with device listing...
});

session.setHandler('add_devices', async (devices) => {
  if (!devices || devices.length === 0) {
    throw new Error('No devices selected for registration');
  }
  // Continue with device registration...
});
```

## Performance and Memory Management

### Memory Leak Prevention

Proper cleanup in IoT applications:

```typescript
// device.ts - Resource cleanup on device deletion
async onDeleted() {
  this.log('MyDevice has been deleted');
  if (this.tuya && this.tuyaConnected) {
    try {
      await this.tuya.disconnect();
      this.log('Disconnected from Tuya device');
    } catch (err) {
      this.error('Error disconnecting from Tuya device:', err);
    }
  }
}
```

### Timer Management

Using Homey's timer system for automatic cleanup:

```typescript
// Using Homey's setTimeout instead of global setTimeout
this.homey.setTimeout(async () => {
  await this.connectTuya();
}, 20000);

// Homey automatically cleans up timers when device is removed
```

### Efficient Data Processing

Optimized capability updates:

```typescript
// device.ts - Efficient capability mapping
private updateCapabilitiesFromDps(
  dpsFetched: Record<string, unknown>, 
  allArraysSwapped: Record<number, string>
): void {
  Object.entries(dpsFetched).forEach(([dpsId, value]) => {
    const capability = allArraysSwapped[Number(dpsId)];
    if (capability) {
      this.setCapabilityValue(capability, value as boolean | number | string)
        .then(() => this.log(`Updated ${capability} to ${value}`))
        .catch((err) => this.error(`Failed to update ${capability}:`, err));
    }
  });
}
```

## Debugging and Development

### Console and Logging APIs

Structured logging for development and production:

```typescript
// app-debug.ts - Console logging for debugging
console.log('WaitForDebugger inspector for debugging');
console.log('Open inspector for debugging');

// Throughout the codebase - Homey logging system
this.log('MyApp has been initialized');
this.log('Connected to Tuya device');
this.error('Failed to connect:', err);
```

### Development Mode Detection

Environment-based feature toggling:

```typescript
// app.ts - Development features
if (process.env.DEBUG === '1') {
  this.log('Development mode detected, enabling debug features');
  this.log('HOMEY_APP_RUNNER_DEVMODE=', process.env.HOMEY_APP_RUNNER_DEVMODE);
  await enableDebugInspector();
}
```

### Debugging Integration

VS Code and Chrome DevTools integration:

```typescript
// app-debug.ts - Debugger integration
inspector.waitForDebugger(); // Wait for debugger attachment
inspector.open(9225, '0.0.0.0', true); // Open debug port
```

## Security Considerations

### Credential Management

Secure handling of device credentials:

```typescript
// device.ts - Secure credential storage
const id = this.getStoreValue('device_id');     // Encrypted storage
const key = this.getStoreValue('local_key');    // Encryption key
const ip = this.getStoreValue('ip_address');    // Network address
```

### Network Security

Local network communication security:

```typescript
// Local-only device access
const tuya = new TuyaDevice({
  id,       // Device-specific identifier
  key,      // AES encryption key
  ip,       // Local network IP only
  version: '3.3'  // Protocol version
});
```

### Input Validation

Proper validation of device data:

```typescript
// driver.ts - Input validation during pairing
session.setHandler('enter_device_info', async (data: { 
  deviceId: string; 
  localKey: string; 
  ipAddress: string 
}) => {
  // Validate input structure
  deviceCredentials = data;
  return true;
});
```

## Code Examples from Codebase

### Complete Device Initialization Pattern

```typescript
// device.ts - Full initialization example
async onInit() {
  this.log('MyDevice has been initialized');
  await this.setUnavailable();

  // Get device credentials from secure storage
  const id = this.getStoreValue('device_id');
  const key = this.getStoreValue('local_key');
  const ip = this.getStoreValue('ip_address');
  const version = '3.3';

  // Initialize TuyaDevice with credentials
  this.tuya = new TuyaDevice({ id, key, ip, version });

  // Establish connection
  await this.connectTuya();

  // Set up event listeners for device communication
  this.tuya.on('data', (data) => {
    this.updateCapabilitiesFromDps(data.dps, this.allArraysSwapped);
    this.setAvailable();
  });

  this.tuya.on('connected', () => {
    this.log('Connected to device!');
    this.setAvailable();
  });

  this.tuya.on('disconnected', () => {
    this.log('Disconnected from device!');
    this.tuyaConnected = false;
    this.setUnavailable('Device disconnected');
  });
}
```

### Pairing Session Management

```typescript
// driver.ts - Complete pairing flow
async onPair(session: PairSession) {
  let deviceCredentials = null;

  // Step 1: Collect device information
  session.setHandler('enter_device_info', async (data) => {
    deviceCredentials = data;
    return true;
  });

  // Step 2: List discovered devices
  session.setHandler('list_devices', async () => {
    if (!deviceCredentials) {
      throw new Error('Device credentials not provided');
    }

    return [{
      name: 'Intelligent Heat Pump',
      data: { id: deviceCredentials.deviceId },
      store: {
        device_id: deviceCredentials.deviceId,
        local_key: deviceCredentials.localKey,
        ip_address: deviceCredentials.ipAddress,
      }
    }];
  });

  // Step 3: Finalize device registration
  session.setHandler('add_devices', async (devices) => {
    if (!devices || devices.length === 0) {
      throw new Error('No devices selected for registration');
    }
    
    this.log(`Device registered: ${devices[0].data.id}`);
    return true;
  });
}
```

## Best Practices Summary

1. **Environment Management**: Use `process.env` for configuration and feature flags
2. **Async Operations**: Prefer async/await over Promise chains for readability
3. **Error Handling**: Always wrap device operations in try-catch blocks
4. **Resource Cleanup**: Implement proper cleanup in `onDeleted()` methods
5. **Timer Management**: Use Homey's timer system for automatic cleanup
6. **Logging**: Use structured logging with appropriate log levels
7. **Security**: Store credentials securely and validate all inputs
8. **Event Handling**: Implement comprehensive event listeners for device states
9. **Reconnection Logic**: Implement automatic reconnection with exponential backoff
10. **Memory Management**: Clean up event listeners and close connections properly

This reference provides the foundation for developing robust IoT device integrations using Node.js Core APIs in the Homey platform environment.