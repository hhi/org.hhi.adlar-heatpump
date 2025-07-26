# Homey Apps SDK v3 API Reference

A comprehensive reference for developing Homey apps using SDK v3, based on the Adlar heat pump codebase implementation and official documentation.

## Table of Contents

1. [Core Classes](#core-classes)
   - [App Class](#app-class)
   - [Driver Class](#driver-class)
   - [Device Class](#device-class)
   - [PairSession Class](#pairsession-class)
2. [Capabilities System](#capabilities-system)
3. [Device Management](#device-management)
4. [Pairing System](#pairing-system)
5. [Configuration System](#configuration-system)
6. [Code Examples](#code-examples)

## Core Classes

### App Class

The App class serves as the main entry point for your Homey app. It must be extended in `app.ts` or `app.js`.

#### Basic Structure

```typescript
import { App } from 'homey';

class MyApp extends App {
  async onInit() {
    this.log('MyApp has been initialized');
  }
}

module.exports = MyApp;
```

#### Properties

- **`homey`**: Reference to the Homey instance
- **`id`**: Unique identifier for the app
- **`manifest`**: App configuration from app.json
- **`sdk`**: SDK version number

#### Lifecycle Methods

- **`onInit()`**: Called when app is initialized
  - Used for setup and initial configuration
  - Must be async
  - Example from Adlar codebase:
  ```typescript
  async onInit() {
    if (process.env.DEBUG === '1') {
      this.log('Development mode detected, enabling debug features');
      await enableDebugInspector();
    }
    this.log('MyApp has been initialized');
  }
  ```

- **`onUninit()`**: Called when app is being destroyed
  - Used for cleanup operations

#### Utility Methods

- **`log(...args)`**: Emits log events with arguments
- **`error(...args)`**: Emits error events with arguments

---

### Driver Class

The Driver class manages all Device instances for a specific type of device. It must be extended in `driver.ts` or `driver.js`.

#### Basic Structure

```typescript
import Homey from 'homey';
import PairSession from 'homey/lib/PairSession';

class MyDriver extends Homey.Driver {
  async onInit() {
    this.log('MyDriver has been initialized');
  }
}

module.exports = MyDriver;
```

#### Properties

- **`homey`**: Reference to the Homey instance
- **`manifest`**: Driver's configuration from app.json

#### Lifecycle Methods

- **`onInit()`**: Called when driver is initialized
  - Used for initial setup and capability registration
  - Example from Adlar codebase:
  ```typescript
  async onInit() {
    this.log('MyDriver is initializing...');
    this.capabilities = Object.keys(capabilities);
    this.customCapabilities = customCapabilities;
    this.dps = dps;
    this.adlarCapabilities = adlarCapabilities;
    this.allArraysSwapped = allArraysSwapped;
    this.log('MyDriver has been initialized');
  }
  ```

#### Device Discovery and Pairing

- **`onPairListDevices()`**: Discovers and lists devices ready for pairing
  - Returns Promise with array of discoverable devices
  - Simple alternative to custom pairing flows

- **`onPair(session: PairSession)`**: Handles complex device pairing process
  - Provides bi-directional communication with pairing interface
  - Example from Adlar codebase:
  ```typescript
  async onPair(session: PairSession) {
    let deviceCredentials: { deviceId: string; localKey: string; ipAddress: string } | null = null;

    // Step 1: Collect device credentials
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
      if (!devices || devices.length === 0) {
        throw new Error('No devices selected for registration');
      }
      this.log(`Device registered: ${devices[0].data.id}`);
      return true;
    });
  }
  ```

#### Device Management

- **`getDevices()`**: Retrieves all paired Device instances
- **`getDevice(deviceData)`**: Retrieves specific Device by its data
- **`onMapDeviceClass(device)`**: Dynamically assigns Device subclass

---

### Device Class

The Device class represents a paired device instance and handles all device-specific functionality.

#### Basic Structure

```typescript
import Homey from 'homey';

class MyDevice extends Homey.Device {
  async onInit() {
    this.log('MyDevice has been initialized');
  }
}

module.exports = MyDevice;
```

#### Properties

- **`homey`**: Reference to the Homey instance
- **`manifest`**: Device configuration from app.json

#### Lifecycle Methods

- **`onInit()`**: Called when device is loaded
  - Primary initialization method
  - Register capability listeners
  - Set up device communication
  - Example from Adlar codebase:
  ```typescript
  async onInit() {
    this.log('MyDevice has been initialized');
    await this.setUnavailable(); // Set initially unavailable

    // Register capability listeners for settable capabilities
    this.settableCapabilities.forEach((capability: string) => {
      this.registerCapabilityListener(capability, async (value, opts) => {
        this.log(`${capability} set to`, value);
        
        const dpArray = this.allCapabilities[capability];
        const dp = Array.isArray(dpArray) ? dpArray[0] : undefined;
        if (dp !== undefined) {
          await this.tuya.set({ dps: dp, set: value });
        }
      });
    });

    // Initialize device communication
    await this.connectTuya();
  }
  ```

- **`onAdded()`**: Triggered after device pairing
  ```typescript
  async onAdded() {
    this.log('MyDevice has been added');
  }
  ```

- **`onDeleted()`**: Executed when device is removed
  ```typescript
  async onDeleted() {
    this.log('MyDevice has been deleted');
    if (this.tuya && this.tuyaConnected) {
      await this.tuya.disconnect();
    }
  }
  ```

- **`onRenamed(name: string)`**: Called when device is renamed
  ```typescript
  async onRenamed(name: string) {
    this.log('MyDevice was renamed to:', name);
  }
  ```

- **`onSettings(event)`**: Handles device settings updates
  ```typescript
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    this.log('MyDevice settings were changed');
  }
  ```

#### Capability Management

- **`setCapabilityValue(capabilityId: string, value: any)`**: Update device capability
  ```typescript
  await this.setCapabilityValue('target_temperature', 22);
  ```

- **`getCapabilityValue(capabilityId: string)`**: Get current capability value
  ```typescript
  const currentTemp = this.getCapabilityValue('target_temperature');
  ```

- **`registerCapabilityListener(capabilityId: string, fn: Function)`**: Handle capability changes
  ```typescript
  this.registerCapabilityListener('onoff', async (value, opts) => {
    // Handle on/off state change
  });
  ```

- **`hasCapability(capabilityId: string)`**: Check if device has capability
- **`addCapability(capabilityId: string)`**: Add capability to device
- **`removeCapability(capabilityId: string)`**: Remove capability from device

#### Device State Management

- **`setAvailable()`**: Mark device as available
  ```typescript
  await this.setAvailable();
  ```

- **`setUnavailable(message?: string)`**: Mark device as unavailable
  ```typescript
  await this.setUnavailable('Device disconnected');
  ```

#### Settings and Store Management

- **`getSettings()`**: Get device settings
- **`setSettings(settings: object)`**: Update device settings
- **`getSetting(key: string)`**: Get specific setting value
- **`setSetting(key: string, value: any)`**: Set specific setting value

- **`getStoreValue(key: string)`**: Get stored value
  ```typescript
  const deviceId = this.getStoreValue('device_id');
  ```

- **`setStoreValue(key: string, value: any)`**: Set stored value
  ```typescript
  await this.setStoreValue('last_update', new Date());
  ```

---

### PairSession Class

The PairSession class handles the pairing flow communication between the driver and the pairing interface.

#### Key Methods

- **`setHandler(event: string, handler: Function)`**: Register event handler
  ```typescript
  session.setHandler('list_devices', async () => {
    return discoveredDevices;
  });
  ```

- **`nextView()`**: Navigate to next pairing step
- **`prevView()`**: Navigate to previous pairing step
- **`close()`**: Close the pairing session

#### Common Event Handlers

- **`enter_device_info`**: Custom credential collection
- **`list_devices`**: Device discovery and listing
- **`add_devices`**: Device registration finalization
- **`showView`**: View change notifications

---

## Capabilities System

The capabilities system is the foundation of device functionality in Homey, defining what a device can do and how users interact with it.

### Capability Types

#### Standard Capabilities
Built-in Homey capabilities with predefined behavior:
- `onoff`: Boolean on/off state
- `target_temperature`: Temperature setpoint
- `measure_temperature`: Temperature sensor reading
- `measure_power`: Power consumption measurement

#### Custom Capabilities with Dot Notation
Extended capabilities using namespace notation:
- `measure_temperature.temp_top`: Inlet temperature
- `measure_temperature.temp_bottom`: Outlet temperature
- `measure_current.cur_current`: Current measurement A-phase
- `meter_power.power_consumption`: Daily power consumption

#### Device-Specific Capabilities
Custom capabilities for specific device features:
- `adlar_hotwater`: Hot water temperature setpoint
- `adlar_enum_mode`: Heating mode selection
- `adlar_fault`: Fault status indicator

### Capability Definition

Capabilities are defined in `.homeycompose/capabilities/` directory:

```json
{
  "id": "adlar_hotwater",
  "title": {
    "en": "Hot Water Set Temp",
    "nl": "Warmwater stel temperatuur"
  },
  "type": "number",
  "getable": true,
  "setable": true,
  "uiComponent": "slider",
  "units": {
    "en": "℃",
    "nl": "℃"
  },
  "min": 10,
  "max": 75,
  "step": 1,
  "insights": true,
  "insightsTitle": {
    "en": "Hot Water Set Temp",
    "nl": "Warmwater stel temperatuur"
  }
}
```

### Capability Properties

- **`id`**: Unique capability identifier
- **`title`**: Display name (multilingual)
- **`type`**: Data type (number, boolean, string, enum)
- **`getable`**: Can read value from device
- **`setable`**: Can write value to device
- **`uiComponent`**: UI element type (slider, picker, sensor, toggle)
- **`units`**: Measurement units
- **`min/max/step`**: Numeric constraints
- **`insights`**: Enable data logging
- **`values`**: Enum options (for enum type)

### UI Components

- **Toggle**: Boolean capabilities (on/off switches)
- **Slider**: Numeric capabilities with range
- **Sensor**: Read-only measurements
- **Picker**: Enum capabilities (dropdown selection)
- **Thermostat**: Temperature control

### Capability Mapping Example

From the Adlar codebase mapping system:

```typescript
export class AdlarMapping {
  static capabilities: Record<string, number[]> = {
    onoff: [1],                    // DPS 1
    target_temperature: [4],       // DPS 4
    measure_power: [104],          // DPS 104
    measure_water: [39],           // DPS 39
  };

  static customCapabilities: Record<string, number[]> = {
    'measure_temperature.temp_top': [21],     // DPS 21
    'measure_temperature.temp_bottom': [22],  // DPS 22
    'measure_current.cur_current': [102],     // DPS 102
  };

  static adlarCapabilities: Record<string, number[]> = {
    adlar_hotwater: [101],                    // DPS 101
    adlar_enum_mode: [2],                     // DPS 2
    adlar_fault: [15],                        // DPS 15
  };
}
```

---

## Device Management

### Device Initialization Lifecycle

1. **Driver.onInit()**: Initialize driver-level resources
2. **Device.onInit()**: Initialize device-specific functionality
3. **Device.onAdded()**: Post-pairing setup
4. **Capability Registration**: Set up capability listeners
5. **Communication Setup**: Establish device connection

### Device Communication Pattern

From the Adlar codebase, showing bidirectional communication:

```typescript
// Outgoing: Homey → Device
this.registerCapabilityListener('target_temperature', async (value, opts) => {
  const dp = this.allCapabilities['target_temperature'][0];
  await this.tuya.set({ dps: dp, set: value });
});

// Incoming: Device → Homey
this.tuya.on('data', (data: { dps: Record<number, unknown> }) => {
  const dpsFetched = data.dps || {};
  Object.entries(dpsFetched).forEach(([dpsId, value]) => {
    const capability = this.allArraysSwapped[Number(dpsId)];
    if (capability) {
      this.setCapabilityValue(capability, value);
    }
  });
});
```

### Device Availability Management

```typescript
// Set device as available when connected
this.tuya.on('connected', () => {
  this.setAvailable()
    .then(() => this.log('Device set as available'))
    .catch((err) => this.error('Error setting device as available:', err));
});

// Set device as unavailable when disconnected
this.tuya.on('disconnected', () => {
  this.setUnavailable('Device disconnected')
    .then(() => this.log('Device set as unavailable'))
    .catch((err) => this.error('Error setting device as unavailable:', err));
});
```

### Settings Management

Device settings are configured in the driver compose file:

```json
{
  "capabilitiesOptions": {
    "target_temperature": {
      "title": {
        "nl": "Stel temperatuur",
        "en": "Target temperature"
      },
      "min": 5,
      "max": 75,
      "step": 1,
      "unit": "°C",
      "setable": true
    }
  }
}
```

Access in device code:

```typescript
const deviceId = this.getStoreValue('device_id');
const localKey = this.getStoreValue('local_key');
const ipAddress = this.getStoreValue('ip_address');

// Settings vs Store:
// - Settings: User-configurable parameters
// - Store: Internal app data not exposed to user
```

---

## Pairing System

### Three-Step Pairing Process

The Adlar implementation demonstrates a comprehensive pairing flow:

#### Step 1: Credential Collection
Custom HTML form for device information:

```html
<!-- enter_device_info.html -->
<form class="homey-form" onsubmit="handleSubmit(event)">
  <input type="text" id="device_id" placeholder="Enter device ID" required>
  <input type="text" id="local_key" placeholder="Enter local key" required>
  <input type="text" id="ip_address" placeholder="Enter IP address" required>
  <button type="submit">Continue</button>
</form>

<script>
async function handleSubmit(event) {
  event.preventDefault();
  const deviceId = document.getElementById('device_id').value.trim();
  const localKey = document.getElementById('local_key').value.trim();
  const ipAddress = document.getElementById('ip_address').value.trim();
  
  await Homey.emit('enter_device_info', { deviceId, localKey, ipAddress });
  Homey.nextView();
}
</script>
```

#### Step 2: Device Discovery
List discovered devices for user selection:

```typescript
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
```

#### Step 3: Device Registration
Finalize the device addition:

```typescript
session.setHandler('add_devices', async (devices) => {
  if (!devices || devices.length === 0) {
    throw new Error('No devices selected for registration');
  }
  
  this.log(`Device registered: ${devices[0].data.id}`);
  return true;
});
```

### Pairing Flow Configuration

Defined in `driver.compose.json`:

```json
{
  "pair": [
    {
      "id": "enter_device_info"
    },
    {
      "id": "list_devices",
      "template": "list_devices",
      "navigation": {
        "next": "add_devices"
      }
    },
    {
      "id": "add_devices",
      "template": "add_devices",
      "navigation": {
        "next": "done"
      }
    },
    {
      "id": "done",
      "template": "done"
    }
  ]
}
```

### PairSession Handlers

Common handlers and their purposes:

- **`enter_device_info`**: Custom credential collection
- **`list_devices`**: Return array of discoverable devices
- **`add_devices`**: Process selected devices for addition
- **`showView`**: Handle view navigation events

---

## Configuration System

### App Manifest Structure

The `app.json` file defines the complete app configuration:

```json
{
  "id": "org.hhi.adlar-heatpump",
  "version": "0.10.0",
  "compatibility": ">=12.2.0",
  "sdk": 3,
  "platforms": ["local"],
  "name": {
    "en": "Adlar Castra Heatpump",
    "nl": "Adlar Castra Warmtepomp"
  },
  "description": {
    "en": "Local access to the Aurora series heatpump device.",
    "nl": "Lokale toegang tot het Aurora-serie warmtepompapparaat."
  },
  "category": ["climate"],
  "brandColor": "#f5a623",
  "drivers": [
    {
      "name": {
        "en": "intelligent-heat-pump",
        "nl": "intelligent-heat-pump"
      },
      "class": "heatpump",
      "capabilities": [
        "target_temperature",
        "onoff",
        "adlar_hotwater",
        "measure_temperature.temp_top"
      ]
    }
  ]
}
```

### Homey Compose System

The compose system generates `app.json` from separate configuration files:

#### Directory Structure
```
.homeycompose/
├── app.json                 # Base app configuration
└── capabilities/            # Custom capability definitions
    ├── adlar_hotwater.json
    ├── adlar_enum_mode.json
    └── ...

drivers/
└── intelligent-heat-pump/
    ├── driver.compose.json      # Driver configuration
    └── driver.settings.compose.json  # Driver settings
```

#### Build Process
```bash
npm run build  # Compiles TypeScript and generates app.json
```

### Driver Configuration

Driver-specific settings in `driver.compose.json`:

```json
{
  "name": {
    "en": "intelligent-heat-pump",
    "nl": "intelligent-heat-pump"
  },
  "class": "heatpump",
  "capabilities": [
    "target_temperature",
    "onoff",
    "adlar_hotwater"
  ],
  "capabilitiesOptions": {
    "target_temperature": {
      "title": {
        "nl": "Stel temperatuur",
        "en": "Target temperature"
      },
      "min": 5,
      "max": 75,
      "step": 1,
      "unit": "°C"
    }
  },
  "platforms": ["local"],
  "connectivity": ["lan"],
  "energy": {
    "approximation": {
      "usageConstant": 30
    }
  }
}
```

### Capability Schema Validation

Custom capabilities must follow the schema structure:

```json
{
  "id": "capability_id",
  "title": { "en": "Title", "nl": "Titel" },
  "type": "number|boolean|string|enum",
  "getable": true,
  "setable": false,
  "uiComponent": "slider|picker|sensor|toggle",
  "min": 0,
  "max": 100,
  "step": 1,
  "units": { "en": "°C", "nl": "°C" },
  "insights": true,
  "values": [
    {
      "id": "value_id",
      "title": { "en": "Value", "nl": "Waarde" }
    }
  ]
}
```

---

## Code Examples

### Complete Device Implementation

```typescript
import Homey, { manifest } from 'homey';
import TuyaDevice from 'tuyapi';
import { AdlarMapping } from '../../lib/definitions/adlar-mapping';

const { allCapabilities, allArraysSwapped } = AdlarMapping;

class MyDevice extends Homey.Device {
  tuya: TuyaDevice | undefined;
  tuyaConnected: boolean = false;
  allCapabilities: Record<string, number[]> = allCapabilities;
  allArraysSwapped: Record<number, string> = allArraysSwapped;
  settableCapabilities: string[] = [];

  async onInit() {
    this.log('MyDevice has been initialized');
    await this.setUnavailable();

    // Determine settable capabilities
    const builtinCapOptList = manifest.drivers[0].capabilitiesOptions || {};
    const setableBuiltInCapsKeys = Object.keys(builtinCapOptList).filter(
      (key) => builtinCapOptList[key].setable === true,
    );

    const setableCustomCapsKeys = Object.keys(manifest.capabilities).filter(
      (key) => manifest.capabilities[key].setable === true,
    );

    this.settableCapabilities = [...setableBuiltInCapsKeys, ...setableCustomCapsKeys];

    // Register capability listeners
    this.settableCapabilities.forEach((capability: string) => {
      this.registerCapabilityListener(capability, async (value, opts) => {
        this.log(`${capability} set to`, value);

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

    // Initialize device communication
    const id = this.getStoreValue('device_id');
    const key = this.getStoreValue('local_key');
    const ip = this.getStoreValue('ip_address');

    this.tuya = new TuyaDevice({
      id,
      key,
      ip,
      version: '3.3',
    });

    await this.connectTuya();
    this.setupTuyaEventHandlers();
  }

  async connectTuya() {
    if (!this.tuyaConnected && this.tuya) {
      try {
        await this.tuya.find();
        await this.tuya.connect();
        this.tuyaConnected = true;
        this.log('Connected to Tuya device');
      } catch (err) {
        this.error('Failed to connect to Tuya device:', err);
        throw new Error('Could not connect to device');
      }
    }

    // Auto-reconnect every 20 seconds
    this.homey.setTimeout(async () => {
      await this.connectTuya();
    }, 20000);
  }

  private setupTuyaEventHandlers() {
    if (!this.tuya) return;

    // Handle incoming data from device
    this.tuya.on('data', (data: { dps: Record<number, unknown> }) => {
      const dpsFetched = data.dps || {};
      this.log('Data received from Tuya:', dpsFetched);
      this.updateCapabilitiesFromDps(dpsFetched);
      this.setAvailable();
    });

    // Handle device connection status
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

  private updateCapabilitiesFromDps(dpsFetched: Record<string, unknown>): void {
    Object.entries(dpsFetched).forEach(([dpsId, value]) => {
      const capability = this.allArraysSwapped[Number(dpsId)];
      if (capability) {
        this.setCapabilityValue(capability, value as boolean | number | string)
          .then(() => this.log(`Updated ${capability} to`, String(value)))
          .catch((err) => this.error(`Failed to update ${capability}:`, err));
      }
    });
  }

  async onAdded() {
    this.log('MyDevice has been added');
  }

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

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('MyDevice settings were changed');
  }

  async onRenamed(name: string) {
    this.log('MyDevice was renamed to:', name);
  }
}

module.exports = MyDevice;
```

### Complete Driver Implementation

```typescript
import Homey from 'homey';
import PairSession from 'homey/lib/PairSession';
import { AdlarMapping } from '../../lib/definitions/adlar-mapping';

class MyDriver extends Homey.Driver {
  capabilities!: string[];
  customCapabilities!: Record<string, unknown>;
  dps!: Record<string, unknown>;
  adlarCapabilities!: Record<string, unknown>;
  allArraysSwapped!: unknown;

  async onInit() {
    this.log('MyDriver is initializing...');
    
    const { customCapabilities, capabilities, adlarCapabilities, allArraysSwapped, dps } = AdlarMapping;
    
    this.capabilities = Object.keys(capabilities);
    this.customCapabilities = customCapabilities;
    this.dps = dps;
    this.adlarCapabilities = adlarCapabilities;
    this.allArraysSwapped = allArraysSwapped;

    this.log('MyDriver has been initialized');
  }

  async onPair(session: PairSession) {
    let deviceCredentials: { deviceId: string; localKey: string; ipAddress: string } | null = null;

    this.log('Pairing session started');

    // Step 1: Collect device credentials
    session.setHandler('enter_device_info', async (data: { deviceId: string; localKey: string; ipAddress: string }) => {
      deviceCredentials = data;
      return true;
    });

    // Handle view changes
    session.setHandler('showView', async (viewId: unknown) => {
      this.log(`View: ${viewId}`);
    });

    // Step 2: List discovered device
    session.setHandler('list_devices', async () => {
      if (!deviceCredentials) {
        throw new Error('Device credentials not provided');
      }

      return [{
        name: 'Intelligent Heat Pump',
        data: {
          id: deviceCredentials.deviceId,
        },
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
    session.setHandler('add_devices', async (devices: Array<{ data: { id: string } }>) => {
      if (!devices || devices.length === 0) {
        throw new Error('No devices selected for registration');
      }

      this.log(`Device registered: ${devices[0].data.id}`);
      return true;
    });
  }
}

module.exports = MyDriver;
```

### Capability Mapping System

```typescript
export interface DpsEntry {
  code: string;
  name: string;
  adlar: string;
}

export class AdlarMapping {
  // Standard Homey capabilities
  static capabilities: Record<string, number[]> = {
    onoff: [1],
    target_temperature: [4],
    measure_power: [104],
    measure_water: [39],
  };

  // Custom capabilities with dot notation
  static customCapabilities: Record<string, number[]> = {
    'meter_power.power_consumption': [18],
    'meter_power.electric_total': [105],
    'measure_current.cur_current': [102],
    'measure_voltage.voltage_current': [103],
    'measure_temperature.temp_top': [21],
    'measure_temperature.temp_bottom': [22],
    'measure_temperature.coiler_temp': [23],
    'measure_temperature.around_temp': [26],
  };

  // Device-specific capabilities
  static adlarCapabilities: Record<string, number[]> = {
    adlar_measure_pressure_temp_current: [16],
    adlar_measure_pressure_effluent_temp: [25],
    adlar_enum_mode: [2],
    adlar_enum_work_mode: [5],
    adlar_hotwater: [101],
    adlar_state_compressor_state: [27],
    adlar_fault: [15],
  };

  // Combined capabilities mapping
  static allCapabilities: Record<string, number[]> = {
    ...AdlarMapping.capabilities,
    ...AdlarMapping.customCapabilities,
    ...AdlarMapping.adlarCapabilities,
  };

  // Reverse mapping: DPS ID to capability name
  static allArraysSwapped: Record<number, string> = Object.fromEntries(
    Object.entries(AdlarMapping.allCapabilities).map(([key, value]) => [value[0], key]),
  );

  // DPS descriptions for documentation
  static dps: Record<string, DpsEntry> = {
    dps_1: { code: 'switch', name: 'Switch', adlar: 'Schakelaar' },
    dps_2: { code: 'mode', name: 'Mode', adlar: '(Verwarmings)modus' },
    dps_4: { code: 'temp_set', name: 'Target temp', adlar: 'Stel temperatuur' },
    // ... additional DPS definitions
  };
}
```

## Development Workflow

### Build and Validation Commands

```bash
# Build TypeScript and generate app.json
npm run build

# Validate app structure and configuration
homey app validate

# Validate with debug logging
homey app validate -l debug

# Run linting
npm run lint

# Test the app locally
homey app run

# Publish the app
homey app publish
```

### Debug Mode

Enable debug features by setting environment variable:

```typescript
if (process.env.DEBUG === '1') {
  this.log('Development mode detected, enabling debug features');
  await enableDebugInspector();
}
```

### Best Practices

1. **Error Handling**: Always use try-catch blocks for async operations
2. **Logging**: Use `this.log()` for development and `this.error()` for errors
3. **Capability Listeners**: Register all capability listeners in `onInit()`
4. **Device Availability**: Update availability status based on connection state
5. **Resource Cleanup**: Properly disconnect and cleanup in `onDeleted()`
6. **Type Safety**: Use TypeScript for better development experience
7. **Configuration**: Use compose system for maintainable configuration
8. **Pairing UX**: Provide clear error messages and validation in pairing flows

## Official Documentation Links

- [Homey Apps SDK v3 Documentation](https://apps-sdk-v3.developer.homey.app/)
- [Homey Apps Guide](https://apps.developer.homey.app/)
- [Device Capabilities Reference](https://apps.developer.homey.app/the-basics/devices/capabilities)
- [Pairing Documentation](https://apps.developer.homey.app/the-basics/devices/pairing)
- [SDK v3 API Reference](https://apps-sdk-v3.developer.homey.app/)

This reference document provides a comprehensive guide to developing Homey apps using SDK v3, with practical examples from a real-world heat pump device implementation.