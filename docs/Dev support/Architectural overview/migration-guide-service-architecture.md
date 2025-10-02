# Migration Guide: v0.99.22 → v0.99.40 Service Architecture

This guide helps developers understand the architectural changes introduced in v0.99.23 when the Adlar Heat Pump app transitioned from a monolithic device class to a service-oriented architecture.

## Table of Contents

- [Overview](#overview)
- [Why the Migration](#why-the-migration)
- [Breaking Changes](#breaking-changes)
- [Migration Patterns](#migration-patterns)
- [Code Examples](#code-examples)
- [Testing After Migration](#testing-after-migration)
- [Troubleshooting](#troubleshooting)

---

## Overview

### What Changed

**v0.99.22 and Earlier** (Monolithic Architecture):
- Single `device.ts` class handled all functionality (~3000+ lines)
- Repeated code across device instances
- Direct method calls for all operations
- Hard to test individual features
- Adding features required modifying existing code

**v0.99.23 and Later** (Service-Oriented Architecture):
- Device class delegates to 8 specialized services
- Shared functionality centralized in services
- Event-driven cross-service communication
- Services independently testable
- New services added without modifying existing code

### Version Timeline

- **v0.99.22**: Last monolithic version
- **v0.99.23**: Service architecture introduced, ServiceCoordinator added
- **v0.99.24-v0.99.39**: Service refinement and bug fixes
- **v0.99.40**: Current stable service architecture version

---

## Why the Migration

### Problems Solved

1. **Code Duplication**
   - **Before**: Connection logic repeated in multiple methods
   - **After**: TuyaConnectionService centralizes connection handling

2. **Testing Difficulty**
   - **Before**: Must instantiate entire device to test single feature
   - **After**: Test individual services in isolation

3. **Maintenance Burden**
   - **Before**: Change to health monitoring required touching 5+ locations
   - **After**: Change CapabilityHealthService in one place

4. **Unclear Responsibilities**
   - **Before**: `device.ts` handled connection, calculations, flow cards, settings, health, etc.
   - **After**: Each service has clear single responsibility

5. **Extension Challenges**
   - **Before**: Adding rolling COP required modifying device class
   - **After**: Add RollingCOPCalculator service without touching existing code

---

## Breaking Changes

### ⚠️ API Changes for Custom Code

If you have custom modifications to the device class, the following patterns have changed:

#### 1. Direct Method Calls → Service Delegation

**❌ Old Pattern (v0.99.22)**:
```typescript
class Device extends Homey.Device {
  async onInit() {
    // Direct connection management
    this.tuya = new TuyAPI({...});
    await this.tuya.connect();

    // Direct health monitoring
    this.capabilityHealth = {};
    this.startHealthMonitoring();

    // Direct COP calculation
    setInterval(() => this.calculateCOP(), 30000);
  }

  async calculateCOP() {
    // 200+ lines of COP calculation logic
    const result = /* complex calculation */;
    await this.setCapabilityValue('adlar_cop', result);
  }
}
```

**✅ New Pattern (v0.99.23+)**:
```typescript
import { ServiceCoordinator } from './lib/services/service-coordinator';

class Device extends Homey.Device {
  private serviceCoordinator: ServiceCoordinator | null = null;

  async onInit() {
    // Delegate to ServiceCoordinator
    this.serviceCoordinator = new ServiceCoordinator(this, this.homey.log);

    await this.serviceCoordinator.initialize({
      deviceConfig: { id, key, ip },
      settings: this.getSettings(),
    });
  }

  // COP calculation now handled by COPCalculator service
  // Access via service coordinator when needed
  getCurrentCOP(): number | null {
    return this.serviceCoordinator
      ?.getCOPCalculator()
      ?.calculateCOP().value ?? null;
  }
}
```

#### 2. Direct Device Settings → SettingsManagerService

**❌ Old Pattern (v0.99.22)**:
```typescript
async onSettings(oldSettings, newSettings, changedKeys) {
  if (changedKeys.includes('enable_power_measurements')) {
    const enablePower = newSettings.enable_power_measurements;

    // Multiple setSettings calls cause race conditions!
    await this.setSettings({ flow_power_alerts: enablePower ? 'auto' : 'disabled' });
    await this.setSettings({ flow_voltage_alerts: enablePower ? 'auto' : 'disabled' });
    await this.setSettings({ flow_current_alerts: enablePower ? 'auto' : 'disabled' });
  }
}
```

**✅ New Pattern (v0.99.23+)**:
```typescript
async onSettings(oldSettings, newSettings, changedKeys) {
  // Delegate to ServiceCoordinator (prevents race conditions)
  await this.serviceCoordinator?.onSettings(oldSettings, newSettings, changedKeys);

  // SettingsManagerService handles deferred updates internally
  // Single consolidated setSettings call, no race conditions
}
```

#### 3. Flow Card Registration → FlowCardManagerService

**❌ Old Pattern (v0.99.22)**:
```typescript
async onInit() {
  // Manual registration of 64 flow cards
  this.homey.flow.getTriggerCard('temperature_alert_coiler').registerRunListener(async (args) => {
    const temp = await this.getCapabilityValue('measure_temperature.temp_coiler');
    return temp > args.threshold;
  });

  this.homey.flow.getTriggerCard('temperature_alert_tank').registerRunListener(async (args) => {
    const temp = await this.getCapabilityValue('measure_temperature.temp_tank');
    return temp > args.threshold;
  });

  // ... 62 more flow cards
}
```

**✅ New Pattern (v0.99.23+)**:
```typescript
async onInit() {
  // ServiceCoordinator initializes FlowCardManagerService
  await this.serviceCoordinator.initialize(config);

  // FlowCardManagerService handles all 64 cards with pattern-based registration
  // No manual registration code needed in device class
}

// Dynamic re-registration on settings changes
async onSettings(oldSettings, newSettings, changedKeys) {
  await this.serviceCoordinator?.onSettings(oldSettings, newSettings, changedKeys);

  // FlowCardManagerService automatically re-registers cards based on:
  // - User preferences (disabled/auto/enabled)
  // - Capability health (via CapabilityHealthService)
}
```

#### 4. COP Calculation → COPCalculator Service

**❌ Old Pattern (v0.99.22)**:
```typescript
async calculateCOP() {
  // 200+ lines of method selection, calculation, validation
  let cop = null;

  // Method 1: Direct Thermal
  if (this.hasExternalPower()) {
    cop = this.calculateDirectThermal();
  }
  // Method 2-7: Other methods
  else if (/* conditions */) {
    cop = this.calculatePowerModule();
  }
  // ...

  // Outlier detection
  if (cop > 8.0 || cop < 0.5) {
    this.log('Outlier detected');
  }

  await this.setCapabilityValue('adlar_cop', cop);
}
```

**✅ New Pattern (v0.99.23+)**:
```typescript
// Device class no longer contains COP calculation logic
// COPCalculator service handles all 8 methods, outlier detection, etc.

// Device receives COP updates via service event
async onInit() {
  await this.serviceCoordinator.initialize(config);

  // COPCalculator emits events, device listens
  this.serviceCoordinator
    ?.getCOPCalculator()
    ?.on('cop-calculated', async (data) => {
      await this.setCapabilityValue('adlar_cop', data.cop);
      await this.setCapabilityValue('adlar_cop_method', data.method);
    });
}
```

---

## Migration Patterns

### Pattern 1: Accessing Services

**Migration Steps**:

1. Identify feature in old monolithic code
2. Determine which service handles that feature
3. Access service via ServiceCoordinator

**Service Mapping**:

| Old Device Method | New Service | Service Method |
|-------------------|-------------|----------------|
| `this.tuya.connect()` | TuyaConnectionService | `getTuyaConnection().connect()` |
| `this.checkCapabilityHealth()` | CapabilityHealthService | `getCapabilityHealth().isHealthy()` |
| `this.registerFlowCard(...)` | FlowCardManagerService | `getFlowCardManager().register()` |
| `this.receiveExternalPower()` | EnergyTrackingService | `getEnergyTracking().receiveExternalPower()` |
| `this.calculateCOP()` | COPCalculator | `getCOPCalculator().calculateCOP()` |
| `this.updateRollingCOP()` | RollingCOPCalculator | `getRollingCOPCalculator().addDataPoint()` |
| `this.calculateSCOP()` | SCOPCalculator | `getSCOPCalculator().getSCOP()` |

**Example Migration**:

```typescript
// ❌ Old: Direct method
async checkConnection() {
  return this.tuya?.isConnected() ?? false;
}

// ✅ New: Service delegation
async checkConnection() {
  return this.serviceCoordinator
    ?.getTuyaConnection()
    ?.isConnected() ?? false;
}
```

### Pattern 2: Event Handling

**Old Pattern**: Direct method calls between features

```typescript
// ❌ Old: Tight coupling
async calculateCOP() {
  const cop = this.performCalculation();

  // Direct call to rolling COP
  this.addRollingCOPDataPoint(cop);

  // Direct call to SCOP
  this.updateSCOPData(cop);

  return cop;
}
```

**New Pattern**: Event-driven communication

```typescript
// ✅ New: Event-driven, loose coupling
class COPCalculator {
  calculateCOP() {
    const cop = this.performCalculation();

    // Emit event - subscribers handle their own logic
    this.emit('cop-calculated', {
      cop: cop.value,
      method: cop.method,
      confidence: cop.confidence,
    });

    return cop;
  }
}

// Subscribers (in ServiceCoordinator.wireServiceEvents())
this.copCalculator.on('cop-calculated', (data) => {
  this.rollingCOPCalculator.addDataPoint(data);
  this.scopCalculator.processCOPData(data);
});
```

### Pattern 3: Settings Management

**Old Pattern**: Direct `setSettings()` calls (race conditions!)

```typescript
// ❌ Old: Race condition prone
async onSettings(oldSettings, newSettings, changedKeys) {
  if (changedKeys.includes('enable_power_measurements')) {
    // Multiple setSettings calls = race condition
    await this.setSettings({ flow_power_alerts: 'disabled' });
    await this.setSettings({ flow_voltage_alerts: 'disabled' });
    await this.setSettings({ flow_current_alerts: 'disabled' });
  }
}
```

**New Pattern**: Deferred updates via SettingsManagerService

```typescript
// ✅ New: Race condition prevention
async onSettings(oldSettings, newSettings, changedKeys) {
  await this.serviceCoordinator?.onSettings(oldSettings, newSettings, changedKeys);

  // SettingsManagerService handles deferred updates:
  // 1. Prepare settings object during onSettings
  // 2. Apply via setTimeout AFTER onSettings completes
  // 3. Single consolidated setSettings call
}
```

---

## Code Examples

### Example 1: Migrating Custom COP Calculation Logic

**Scenario**: You added custom COP calculation method

**❌ Before (v0.99.22) - Modify device.ts**:
```typescript
class Device extends Homey.Device {
  async calculateCOP() {
    // ... existing methods 1-7 ...

    // Your custom method 8
    if (this.hasCustomSensor()) {
      return this.calculateCustomMethod();
    }

    return null;
  }

  calculateCustomMethod() {
    const sensorValue = this.getCapabilityValue('my_custom_sensor');
    // ... custom logic ...
    return cop;
  }
}
```

**✅ After (v0.99.23+) - Extend COPCalculator service**:
```typescript
// lib/services/cop-calculator.ts
class COPCalculator extends Homey.SimpleClass {
  calculateCOP() {
    // ... existing methods 1-7 ...

    // Method 8: Custom calculation
    if (this.hasCustomSensor()) {
      return this.calculateCustomMethod();
    }

    return null;
  }

  private calculateCustomMethod() {
    const sensorValue = this.device.getCapabilityValue('my_custom_sensor');
    // ... custom logic ...
    return {
      value: cop,
      method: 'custom_method',
      confidence: 'medium',
    };
  }
}
```

**Benefits**:
- Custom logic isolated in service
- Testable independently
- Doesn't modify device class
- Follows existing service patterns

### Example 2: Migrating Custom Health Monitoring

**Scenario**: You added custom capability health checks

**❌ Before (v0.99.22) - Inline in device.ts**:
```typescript
class Device extends Homey.Device {
  async onInit() {
    setInterval(() => {
      // Custom health check for external sensor
      const externalSensor = this.getCapabilityValue('external_sensor');
      if (externalSensor === null) {
        this.externalSensorNullCount++;
      } else {
        this.externalSensorNullCount = 0;
      }

      if (this.externalSensorNullCount > 10) {
        this.log('External sensor unhealthy');
      }
    }, 120000);
  }
}
```

**✅ After (v0.99.23+) - Extend CapabilityHealthService**:
```typescript
// lib/services/capability-health-service.ts
class CapabilityHealthService extends Homey.SimpleClass {
  private monitoredCapabilities = [
    // ... existing capabilities ...
    'external_sensor', // Add custom capability
  ];

  isCapabilityHealthy(capability: string): boolean {
    const health = this.capabilityHealth[capability];
    if (!health) return false;

    const nullCount = health.nullCount ?? 0;
    const timeSinceUpdate = Date.now() - (health.lastUpdate ?? 0);

    // Custom threshold for external sensor
    if (capability === 'external_sensor') {
      return nullCount < 15 && timeSinceUpdate < 300000; // 5 min timeout
    }

    // Default thresholds
    return nullCount < 10 && timeSinceUpdate < 300000;
  }
}
```

**Benefits**:
- Health logic centralized with other health checks
- Reuses existing health monitoring infrastructure
- Automatically integrates with flow card auto-registration
- Service provides consistent health API

---

## Testing After Migration

### 1. Verify Service Initialization

```typescript
// test/device.test.ts
describe('Device with ServiceCoordinator', () => {
  it('should initialize all services', async () => {
    const device = new Device();
    await device.onInit();

    const health = device.serviceCoordinator?.getServiceHealth();
    expect(health).toEqual({
      tuyaConnection: true,
      capabilityHealth: true,
      flowCardManager: true,
      energyTracking: true,
      settingsManager: true,
      copCalculator: true,
      rollingCOPCalculator: true,
      scopCalculator: true,
    });
  });
});
```

### 2. Verify Cross-Service Communication

```typescript
describe('COP Calculation Event Flow', () => {
  it('should propagate COP events to subscribers', async () => {
    const device = new Device();
    await device.onInit();

    const copCalculator = device.serviceCoordinator?.getCOPCalculator();
    const rollingCalculator = device.serviceCoordinator?.getRollingCOPCalculator();

    // Trigger COP calculation
    copCalculator?.calculateCOP();

    // Verify RollingCOPCalculator received event
    expect(rollingCalculator?.getDataPoints().length).toBeGreaterThan(0);
  });
});
```

### 3. Verify Settings Race Condition Prevention

```typescript
describe('Settings Race Condition Prevention', () => {
  it('should not throw race condition error', async () => {
    const device = new Device();
    await device.onInit();

    // This would cause race condition in v0.99.22
    await expect(
      device.onSettings(
        { enable_power_measurements: true },
        { enable_power_measurements: false },
        ['enable_power_measurements'],
      ),
    ).resolves.not.toThrow();
  });
});
```

---

## Troubleshooting

### Issue 1: `Cannot read property 'getService' of null`

**Symptom**: Accessing service before ServiceCoordinator initialized

**Solution**:
```typescript
// Always check service availability
const service = this.serviceCoordinator?.getMyService();
if (!service) {
  this.log('Service not available - using fallback');
  return this.fallbackBehavior();
}
return service.method();
```

### Issue 2: Custom Code Not Running

**Symptom**: Custom modifications from v0.99.22 no longer execute

**Cause**: Code was in monolithic device class, services bypass it

**Solution**: Move custom code to appropriate service:

1. **Connection logic** → Extend TuyaConnectionService
2. **Health monitoring** → Extend CapabilityHealthService
3. **COP calculations** → Extend COPCalculator
4. **Flow cards** → Extend FlowCardManagerService
5. **Settings handling** → Extend SettingsManagerService

### Issue 3: Events Not Firing

**Symptom**: Cross-service events don't trigger

**Solution**: Verify event wiring in `ServiceCoordinator.wireServiceEvents()`:

```typescript
// ServiceCoordinator.ts
private wireServiceEvents(): void {
  // Ensure events are wired
  this.copCalculator?.on('cop-calculated', (data) => {
    this.logger.log('[ServiceCoordinator] COP event:', data);
    this.rollingCOPCalculator?.addDataPoint(data);
  });
}
```

### Issue 4: Race Condition Errors Still Occurring

**Symptom**: "Cannot set Settings while this.onSettings is still pending"

**Cause**: Not using SettingsManagerService deferred updates

**Solution**:
```typescript
// Delegate ALL settings changes to ServiceCoordinator
async onSettings(oldSettings, newSettings, changedKeys) {
  await this.serviceCoordinator?.onSettings(oldSettings, newSettings, changedKeys);
  // Don't call this.setSettings() directly!
}
```

---

## Migration Checklist

### Before Upgrading to v0.99.23+

- [ ] **Backup your custom code** - Save any modifications to `device.ts`
- [ ] **Document custom features** - List what custom code does
- [ ] **Identify service targets** - Determine which services handle your custom features
- [ ] **Review breaking changes** - Understand what patterns changed

### During Migration

- [ ] **Update device.ts** - Replace monolithic patterns with service delegation
- [ ] **Move custom code** - Migrate to appropriate services
- [ ] **Test service initialization** - Verify all 8 services initialize
- [ ] **Test event flow** - Verify cross-service communication works
- [ ] **Test settings changes** - Verify no race conditions

### After Migration

- [ ] **Run integration tests** - Verify end-to-end functionality
- [ ] **Monitor logs** - Check for service initialization/communication issues
- [ ] **Verify flow cards** - Test all flow card categories
- [ ] **Check COP calculations** - Verify efficiency monitoring works
- [ ] **Test settings changes** - Power toggle, flow card preferences, etc.

---

## Further Reading

- [Service Architecture Guide](service-architecture-guide.md) - Comprehensive service documentation
- [Architecture Overview](architecture-overview.md) - High-level architecture summary
- [CLAUDE.md](../../CLAUDE.md) - Development guidelines with service patterns

---

## Support

If you encounter issues during migration:

1. **Check Service Health**: Device Settings → Diagnostics → Service Status
2. **Review Logs**: Look for service initialization and event flow messages
3. **Consult Documentation**: Reference service architecture guide for patterns
4. **Community Support**: Post in Homey Community Forum (Topic ID: 140621)

The service-oriented architecture provides a more maintainable, testable, and extensible foundation for the Adlar Heat Pump app. While migration requires code changes, the benefits far outweigh the effort for long-term development.
