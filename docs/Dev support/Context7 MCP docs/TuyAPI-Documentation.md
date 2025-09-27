# TuyAPI Library Documentation for Homey Integration

## Overview

TuyAPI is a comprehensive library for local communication with Tuya-compatible smart devices. This documentation focuses on its integration within Homey applications, specifically for heat pump device communication patterns as implemented in the Adlar heat pump project.

**Repository:** [codetheweb/tuyapi](https://github.com/codetheweb/tuyapi)  
**Version:** 7.2.0 (project uses latest from GitHub)  
**Protocol Support:** Version 3.3 (as configured in the Adlar implementation)  
**Documentation:** https://codetheweb.github.io/tuyapi/

## Core Architecture

### Library Import and Initialization

```typescript
import TuyaDevice from 'tuyapi';

// Initialize with device credentials
const tuya = new TuyaDevice({
  id: 'device_id_string',
  key: 'local_key_string', 
  ip: 'device_ip_address',
  version: '3.3'
});
```

### Device Configuration Parameters

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `id` | string | Unique device identifier (devId) | Yes |
| `key` | string | Local encryption key for secure communication | Yes |
| `ip` | string | Device IP address on local network | Yes |
| `version` | string | Protocol version (3.1, 3.3, 3.4) | Yes |
| `port` | number | Device port (default: 6668) | No |

## Data Points System (DPS)

### DPS Overview

Data Points (DPS) are the core of Tuya device communication. Each device function is mapped to a numeric DPS ID that represents specific capabilities or sensors.

```typescript
// Example DPS structure from device
{
  dps: {
    1: true,        // Switch state (on/off)
    4: 22,          // Target temperature
    21: 18.5,       // Inlet temperature
    104: 2500       // Current power consumption
  }
}
```

### DPS Mapping Implementation

The Adlar implementation uses a centralized mapping system:

```typescript
// From adlar-mapping.ts
export class AdlarMapping {
  static capabilities: Record<string, number[]> = {
    onoff: [1],
    target_temperature: [4],
    measure_power: [104],
    measure_water: [39],
  };

  static customCapabilities: Record<string, number[]> = {
    'measure_temperature.temp_top': [21],
    'measure_temperature.temp_bottom': [22],
    'measure_current.cur_current': [102],
    'measure_voltage.voltage_current': [103],
  };

  static adlarCapabilities: Record<string, number[]> = {
    adlar_enum_mode: [2],
    adlar_enum_work_mode: [5],
    adlar_hotwater: [101],
    adlar_fault: [15],
  };
}
```

### Reverse DPS Mapping

For efficient data processing, the implementation creates a reverse mapping:

```typescript
static allArraysSwapped: Record<number, string> = Object.fromEntries(
  Object.entries(AdlarMapping.allCapabilities).map(([key, value]) => [value[0], key])
);

// Results in: { 1: 'onoff', 4: 'target_temperature', 21: 'measure_temperature.temp_top' }
```

## Connection Management

### Connection Establishment

```typescript
async connectTuya() {
  if (!this.tuyaConnected) {
    try {
      // Discover device on network first
      if (this.tuya) {
        await this.tuya.find();
        // Then connect to device
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
  
  // Automatic reconnection every 20 seconds
  this.homey.setTimeout(async () => {
    await this.connectTuya();
  }, 20000);
}
```

### Connection Lifecycle

1. **Device Discovery**: `tuya.find()` - Discovers device IP on local network
2. **Connection**: `tuya.connect()` - Establishes TCP connection on port 6668
3. **Persistent Connection**: Maintains connection with automatic reconnection
4. **Cleanup**: `tuya.disconnect()` - Properly closes connection on device removal

## API Methods

### Core Methods

#### `find()`
Discovers device on the local network using UDP broadcast on port 6666.

```typescript
await this.tuya.find();
```

#### `connect()`
Establishes TCP connection to the device.

```typescript
await this.tuya.connect();
```

#### `set(options)`
Sends commands to change device state.

```typescript
// Set single data point
await this.tuya.set({ dps: 1, set: true });

// Set multiple data points
await this.tuya.set({ 
  multiple: true,
  data: { 1: true, 4: 25 }
});
```

#### `get()`
Retrieves current device state (rarely used due to event-driven updates).

```typescript
const status = await this.tuya.get();
```

#### `disconnect()`
Closes connection to device.

```typescript
await this.tuya.disconnect();
```

## Event System

### Event-Driven Architecture

TuyAPI uses an event-driven model for real-time device updates:

```typescript
// Primary data event - triggered by device state changes
this.tuya.on('data', (data: { dps: Record<number, unknown> }): void => {
  const dpsFetched = data.dps || {};
  this.log('Data received from Tuya:', dpsFetched);
  this.updateCapabilitiesFromDps(dpsFetched, this.allArraysSwapped);
  this.setAvailable();
});

// Proactive device status updates
this.tuya.on('dp-refresh', (data: { dps: Record<number, unknown> }): void => {
  const dpsFetched = data.dps || {};
  this.log('DP-Refresh received from Tuya:', dpsFetched);
  this.updateCapabilitiesFromDps(dpsFetched, this.allArraysSwapped);
});
```

### Event Types

| Event | Description | Usage |
|-------|-------------|-------|
| `connected` | Socket connection established | Set device as available in Homey |
| `disconnected` | Socket connection lost | Set device as unavailable in Homey |
| `data` | Device data received | Update Homey capabilities |
| `dp-refresh` | Proactive status update | Update Homey capabilities |
| `error` | Communication error | Log error and handle reconnection |
| `heartbeat` | Device ping response | Verify connection health |

### Connection State Management

```typescript
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

## Bidirectional Communication

### Device to Homey (Incoming Data)

Data flows from Tuya device to Homey capabilities through event handlers:

```typescript
private updateCapabilitiesFromDps(dpsFetched: Record<string, unknown>, allArraysSwapped: Record<number, string>): void {
  Object.entries(dpsFetched).forEach(([dpsId, value]) => {
    const capability = allArraysSwapped[Number(dpsId)];
    if (capability) {
      this.setCapabilityValue(capability, (value as boolean | number | string))
        .then(() => this.log(`Updated ${capability} to`, String(value)))
        .catch((err) => this.error(`Failed to update ${capability}:`, err));
    }
  });
}
```

### Homey to Device (Outgoing Commands)

Homey capability changes are sent to device through registered listeners:

```typescript
this.settableCapabilities.forEach((capability: string) => {
  this.registerCapabilityListener(capability, async (value, opts) => {
    this.log(`${capability} set to`, value);

    // Map capability to Tuya DP
    const dpArray = this.allCapabilities[capability];
    const dp = Array.isArray(dpArray) ? dpArray[0] : undefined;
    
    if (dp !== undefined) {
      try {
        await this.connectTuya();
        if (this.tuya) {
          await this.tuya.set({ dps: dp, set: value });
          this.log(`Sent to Tuya: dp ${dp} = ${value}`);
        }
      } catch (err) {
        this.error(`Failed to send to Tuya: ${err}`);
        throw new Error('Failed to update device');
      }
    }
  });
});
```

## Device Pairing Flow

### Three-Step Pairing Process

```typescript
async onPair(session: PairSession) {
  let deviceCredentials: { deviceId: string; localKey: string; ipAddress: string } | null = null;

  // Step 1: Enter device information
  session.setHandler('enter_device_info', async (data) => {
    deviceCredentials = data;
    return true;
  });

  // Step 2: List discovered device
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
      },
      settings: {
        device_id: deviceCredentials.deviceId,
        local_key: deviceCredentials.localKey,
        ip_address: deviceCredentials.ipAddress,
      },
    }];
  });

  // Step 3: Finalize device registration
  session.setHandler('add_devices', async (devices) => {
    this.log(`Device registered: ${devices[0].data.id}`);
    return true;
  });
}
```

## Communication Protocol Details

### Packet Structure

Tuya devices use a structured packet format:

- **Prefix**: `0x000055aa`
- **Sequence Number**: Incremental counter
- **Command Byte**: Operation type
- **Payload Length**: Data size
- **Payload**: JSON data (encrypted for set operations)
- **CRC**: Checksum
- **Suffix**: `0x0000aa55`

### Command Types

| Command | Purpose | Encryption |
|---------|---------|------------|
| GET | Retrieve device state | No |
| SET | Change device state | Yes |
| HEARTBEAT | Keep connection alive | No |
| STATUS | Device status update | No |

## Best Practices for Homey Integration

### 1. Connection Management

```typescript
// Always ensure connection before sending commands
async sendCommand(dp: number, value: any) {
  try {
    await this.connectTuya();
    if (this.tuya && this.tuyaConnected) {
      await this.tuya.set({ dps: dp, set: value });
    } else {
      throw new Error('Device not connected');
    }
  } catch (err) {
    this.error('Command failed:', err);
    throw err;
  }
}
```

### 2. Error Handling

```typescript
// Robust error handling with reconnection
try {
  await this.tuya.connect();
} catch (err) {
  this.error('Connection failed:', err);
  // Trigger reconnection after delay
  this.homey.setTimeout(() => this.connectTuya(), 5000);
}
```

### 3. Data Validation

```typescript
// Validate DPS data before processing
private validateDpsData(dps: any): Record<number, unknown> {
  if (!dps || typeof dps !== 'object') {
    this.error('Invalid DPS data received');
    return {};
  }
  return dps;
}
```

### 4. Capability Synchronization

```typescript
// Ensure capability values match device state
private syncCapabilities() {
  // Only update if values have actually changed
  Object.entries(currentDps).forEach(([dpsId, value]) => {
    const capability = this.allArraysSwapped[Number(dpsId)];
    if (capability && this.getCapabilityValue(capability) !== value) {
      this.setCapabilityValue(capability, value);
    }
  });
}
```

## Performance Considerations

### 1. Connection Efficiency

- Maintain persistent connections rather than connecting per request
- Implement connection pooling for multiple devices
- Use automatic reconnection with exponential backoff

### 2. Data Processing

- Process DPS updates asynchronously to avoid blocking
- Batch capability updates where possible
- Implement debouncing for rapid state changes

### 3. Network Resilience

- Handle network disconnections gracefully
- Implement retry logic with appropriate delays
- Monitor connection health through heartbeat events

## Limitations and Constraints

### 1. Single Connection Limit

Only one TCP connection can be active with a device at once. Ensure the Tuya Smart app is closed when using TuyAPI.

### 2. Sensor Device Support

TuyAPI does not support battery-powered sensors that only connect when state changes.

### 3. Protocol Version Compatibility

Different devices may require different protocol versions (3.1, 3.3, 3.4). Version 3.3 is most commonly used.

### 4. Local Network Requirement

Devices must be on the same local network as the Homey hub for communication.

## Troubleshooting Common Issues

### 1. Connection Failures

```typescript
// Debug connection issues
this.tuya.on('error', (err) => {
  this.error('TuyAPI Error:', err);
  if (err.code === 'ECONNREFUSED') {
    this.log('Device refused connection - check IP and port');
  } else if (err.code === 'ETIMEDOUT') {
    this.log('Connection timeout - device may be offline');
  }
});
```

### 2. Authentication Problems

- Verify local key is correct and not expired
- Ensure device ID matches exactly
- Check that device is in pairing mode if required

### 3. Data Parsing Issues

- Validate DPS structure before processing
- Handle missing or malformed data gracefully
- Log raw data for debugging purposes

## Integration Example Summary

The Adlar heat pump implementation demonstrates best practices:

1. **Centralized DPS mapping** for maintainable code
2. **Automatic reconnection** every 20 seconds
3. **Event-driven updates** for real-time synchronization
4. **Robust error handling** with proper logging
5. **Clean separation** of concerns between driver and device classes
6. **Type safety** with TypeScript definitions

This architecture provides a solid foundation for integrating any Tuya-compatible device with Homey using the TuyAPI library.