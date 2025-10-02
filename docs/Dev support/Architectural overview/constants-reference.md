# DeviceConstants Reference Guide

This document provides a comprehensive reference for all constants defined in the `DeviceConstants` class (`lib/constants.ts`), explaining their purpose, usage, and rationale for specific values.

## Table of Contents

- [Overview](#overview)
- [Connection & Timing Constants](#connection--timing-constants)
- [Health Monitoring Constants](#health-monitoring-constants)
- [COP Calculation Constants](#cop-calculation-constants)
- [SCOP Calculation Constants](#scop-calculation-constants)
- [Rolling COP Constants](#rolling-cop-constants)
- [Power & Energy Constants](#power--energy-constants)
- [Safety & Limits Constants](#safety--limits-constants)
- [Notification Constants](#notification-constants)
- [Customization Guidelines](#customization-guidelines)

---

## Overview

### Purpose

The `DeviceConstants` class centralizes all configuration constants used throughout the Adlar Heat Pump app, providing:

1. **Single Source of Truth**: All timing intervals, thresholds, and limits defined in one place
2. **Maintainability**: Change constants once, affects entire codebase
3. **Documentation**: Clear naming and comments explain purpose of each value
4. **Type Safety**: TypeScript ensures correct constant types
5. **Service Integration**: All services use DeviceConstants for consistency

### Usage Pattern

```typescript
import { DeviceConstants } from './lib/constants';

// ✅ Good: Use DeviceConstants
setTimeout(() => {
  this.reconnect();
}, DeviceConstants.RECONNECTION_INTERVAL_MS);

// ❌ Bad: Magic numbers
setTimeout(() => {
  this.reconnect();
}, 20000); // What does 20000 mean?
```

---

## Connection & Timing Constants

### RECONNECTION_INTERVAL_MS

**Value**: `20 * 1000` (20 seconds)

**Purpose**: Interval between automatic reconnection attempts when Tuya device connection lost

**Used By**:
- TuyaConnectionService - Automatic reconnection timer

**Rationale**:
- Too short (<10s): Overwhelms device with connection attempts
- Too long (>30s): Unacceptable downtime for critical heating control
- 20 seconds: Balance between quick recovery and device stability

**Customization**:
- Increase for unstable networks (up to 60 seconds)
- Decrease for mission-critical applications (down to 15 seconds minimum)

```typescript
// Default
static readonly RECONNECTION_INTERVAL_MS = 20 * 1000; // 20 seconds

// Custom for unstable network
static readonly RECONNECTION_INTERVAL_MS = 45 * 1000; // 45 seconds
```

### CONNECTION_FAILURE_THRESHOLD

**Value**: `5`

**Purpose**: Number of consecutive connection failures before sending user notification

**Used By**:
- TuyaConnectionService - Connection health monitoring
- Device class - Alert triggering

**Rationale**:
- Single failure: Likely temporary network glitch
- 5 failures: Indicates persistent problem (5 × 20s = 100 seconds)
- Prevents notification spam from brief network interruptions

**Customization**:
- Increase for noisy networks (up to 10)
- Decrease for critical monitoring (down to 3)

---

## Health Monitoring Constants

### HEALTH_CHECK_INTERVAL_MS

**Value**: `2 * 60 * 1000` (2 minutes)

**Purpose**: Frequency of capability health checks (null value counting, data freshness)

**Used By**:
- CapabilityHealthService - Health monitoring timer
- FlowCardManagerService - Dynamic flow card registration

**Rationale**:
- Too frequent (<1min): Unnecessary CPU usage
- Too infrequent (>5min): Slow detection of sensor issues
- 2 minutes: Quick detection without performance impact

**Customization**:
- Increase for low-priority monitoring (up to 5 minutes)
- Decrease for critical systems (down to 1 minute)

### NULL_THRESHOLD

**Value**: `10`

**Purpose**: Maximum consecutive null values before marking capability as unhealthy

**Used By**:
- CapabilityHealthService - Health classification
- FlowCardManagerService - Auto mode registration decision

**Rationale**:
- Single null: Temporary communication hiccup
- 10 consecutive nulls: Real sensor problem (10 × 30s sensor updates = 5 minutes)
- Balances sensitivity vs. false positives

**Customization**:
- Increase for unreliable sensors (up to 20)
- Decrease for critical sensors (down to 5)

### CAPABILITY_TIMEOUT_MS

**Value**: `5 * 60 * 1000` (5 minutes)

**Purpose**: Maximum time without capability update before marking as unhealthy

**Used By**:
- CapabilityHealthService - Data freshness check
- FlowCardManagerService - Auto mode flow card visibility

**Rationale**:
- Sensor updates typically every 30 seconds
- 5 minutes = 10 missed updates
- Indicates sensor communication failure or device offline

**Customization**:
- Increase for slow-updating sensors (up to 10 minutes)
- Decrease for fast-updating critical sensors (down to 2 minutes)

---

## COP Calculation Constants

### COP_CALCULATION_INTERVAL_MS

**Value**: `30 * 1000` (30 seconds)

**Purpose**: Frequency of COP calculations during heat pump operation

**Used By**:
- COPCalculator - Calculation timer

**Rationale**:
- Too frequent (<15s): Noisy COP readings, CPU overhead
- Too infrequent (>60s): Miss transient efficiency changes
- 30 seconds: Smooth readings while capturing variations

**Customization**:
- Increase for stable systems (up to 60 seconds)
- Decrease for research/diagnostics (down to 15 seconds)

### MIN_VALID_COP

**Value**: `0.5`

**Purpose**: Minimum realistic COP value (outlier detection lower bound)

**Used By**:
- COPCalculator - Outlier detection
- Flow cards - COP validation

**Rationale**:
- COP < 0.5: Physically implausible or severe sensor malfunction
- Heat pumps should always exceed 50% efficiency (COP = 0.5)
- Typical minimum during defrost: COP = 1.0-1.5

**Customization**:
- **Not recommended to change** - physics-based limit

### MAX_VALID_COP

**Value**: `8.0`

**Purpose**: Maximum realistic COP value (outlier detection upper bound)

**Used By**:
- COPCalculator - Outlier detection
- Flow cards - COP validation

**Rationale**:
- COP > 8.0: Sensor malfunction or measurement error
- Theoretical maximum (Carnot): ~10-12 for typical conditions
- Practical maximum: 6.0-7.0 under ideal conditions

**Customization**:
- Increase for ground-source systems (up to 9.0)
- Decrease for conservative outlier detection (down to 7.0)

### EXTERNAL_DEVICE_QUERY_TIMEOUT_MS

**Value**: `5 * 1000` (5 seconds)

**Purpose**: Timeout for external device data queries via flow cards

**Used By**:
- EnergyTrackingService - External data caching
- COPCalculator - Method 1 (Direct Thermal) external power queries

**Rationale**:
- Too short (<3s): External flows may not complete in time
- Too long (>10s): Blocks COP calculation for too long
- 5 seconds: Allows flow execution while preventing hangs

**Customization**:
- Increase for complex flows (up to 10 seconds)
- Decrease for simple setups (down to 3 seconds)

---

## SCOP Calculation Constants

### SCOP_MIN_HOURS

**Value**: `100`

**Purpose**: Minimum hours of operation data required for SCOP calculation

**Used By**:
- SCOPCalculator - Data sufficiency check

**Rationale**:
- Less than 100 hours: Insufficient seasonal coverage
- 100 hours ≈ 4 days of operation: Minimum meaningful sample
- Full season: 1000+ hours (Oct 1 - May 15)

**Customization**:
- Increase for high-confidence SCOP (up to 200 hours)
- Decrease for quick estimates (down to 50 hours, low confidence)

### SCOP_RECOMMENDED_HOURS

**Value**: `400`

**Purpose**: Recommended hours for high-confidence SCOP calculation

**Used By**:
- SCOPCalculator - Confidence level determination
- Documentation - User guidance

**Rationale**:
- 400 hours ≈ 17 days of operation
- Covers multiple weather conditions and load scenarios
- Represents ~40% of heating season (good seasonal coverage)

**Customization**:
- Increase for research applications (up to 600 hours)
- **Not recommended to decrease** - affects data quality

### SCOP_HIGH_CONFIDENCE_THRESHOLD

**Value**: `0.8` (80%)

**Purpose**: Minimum percentage of high-quality calculation methods for high confidence SCOP

**Used By**:
- SCOPCalculator - Confidence classification

**Rationale**:
- 80%+ direct thermal/power module methods: Highly accurate SCOP
- Below 80%: Too many temperature-difference calculations (±30% error)

**Customization**:
- Increase for stringent requirements (up to 0.9)
- Decrease for lenient confidence (down to 0.7)

### SCOP_MEDIUM_CONFIDENCE_THRESHOLD

**Value**: `0.5` (50%)

**Purpose**: Minimum percentage of reliable methods for medium confidence SCOP

**Used By**:
- SCOPCalculator - Confidence classification

**Rationale**:
- 50-80% reliable methods: Acceptable accuracy with some limitations
- Below 50%: Dominated by low-accuracy methods

**Customization**:
- **Generally not recommended** - affects quality categorization

### SCOP_SEASONAL_COVERAGE_HIGH

**Value**: `0.7` (70%)

**Purpose**: Minimum percentage of heating season represented for high confidence

**Used By**:
- SCOPCalculator - Seasonal coverage assessment

**Rationale**:
- 70%+ of season: Covers full weather variation
- Heating season: Oct 1 - May 15 (228 days)
- 70% coverage = 160 days of data

**Customization**:
- Increase for research (up to 0.8)
- Decrease for preliminary estimates (down to 0.6)

### SCOP_SEASONAL_COVERAGE_MEDIUM

**Value**: `0.4` (40%)

**Purpose**: Minimum seasonal coverage for medium confidence SCOP

**Used By**:
- SCOPCalculator - Confidence classification

**Rationale**:
- 40-70% coverage: Partial seasonal representation
- Below 40%: Insufficient seasonal variation captured

---

## Rolling COP Constants

### ROLLING_COP_DATA_POINTS

**Value**: `1440` (24 hours × 60 minutes)

**Purpose**: Maximum data points stored in circular buffer

**Used By**:
- RollingCOPCalculator - Circular buffer size

**Rationale**:
- 1440 points = 24 hours at 1-minute resolution
- Enables daily/weekly/monthly rolling averages
- Memory footprint: ~288KB per device (1440 × 200 bytes)

**Customization**:
- Increase for longer history (up to 2880 = 48 hours)
- Decrease for memory optimization (down to 720 = 12 hours minimum for daily average)

### ROLLING_COP_MIN_DATA_POINTS

**Value**: `12`

**Purpose**: Minimum data points required for valid rolling average

**Used By**:
- RollingCOPCalculator - Data sufficiency check

**Rationale**:
- 12 points = 6 hours of data (assuming 30-minute COP interval)
- Prevents unreliable averages from sparse data
- Balances quick availability vs. statistical validity

**Customization**:
- Increase for smoother averages (up to 24 = 12 hours)
- Decrease for quick estimates (down to 6 minimum)

### ROLLING_COP_UPDATE_INTERVAL_MS

**Value**: `5 * 60 * 1000` (5 minutes)

**Purpose**: Frequency of rolling average updates (capability value publishing)

**Used By**:
- RollingCOPCalculator - Update timer

**Rationale**:
- COP data points added every 30 seconds
- Updating capabilities every 30s: Excessive UI refreshes
- 5 minutes: Smooth UI updates, reduced processing

**Customization**:
- Increase for low-priority monitoring (up to 10 minutes)
- Decrease for real-time monitoring (down to 2 minutes)

### ROLLING_COP_OUTLIER_THRESHOLD

**Value**: `2.5` (standard deviations)

**Purpose**: Standard deviation threshold for outlier detection in rolling averages

**Used By**:
- RollingCOPCalculator - Statistical outlier filtering

**Rationale**:
- 2.5 σ: Excludes ~1% of data (99% within range)
- Balances outlier removal vs. retaining valid extremes
- Standard statistical practice

**Customization**:
- Increase for lenient filtering (up to 3.0)
- Decrease for strict filtering (down to 2.0)

### ROLLING_COP_IDLE_MONITOR_INTERVAL_MS

**Value**: `30 * 60 * 1000` (30 minutes)

**Purpose**: Frequency of idle period detection and COP=0 data point insertion

**Used By**:
- RollingCOPCalculator - Idle monitoring timer

**Rationale**:
- Checks every 30 minutes for extended idle periods (compressor off)
- Prevents gaps in time-series data during off periods
- Enables accurate idle ratio calculations

**Customization**:
- **Not recommended to change** - affects time-series continuity

---

## Power & Energy Constants

### HIGH_POWER_THRESHOLD_W

**Value**: `10000` (10 kW)

**Purpose**: Power consumption threshold for high usage alerts

**Used By**:
- EnergyTrackingService - Power monitoring
- Flow cards - Power alert triggers

**Rationale**:
- Typical heat pump: 2-5 kW
- 10 kW: Indicates backup heaters active or unusual load
- Alert-worthy threshold

**Customization**:
- Increase for large systems (up to 15000)
- Decrease for small systems (down to 7000)

### MIN_POWER_MEASUREMENT_W

**Value**: `100`

**Purpose**: Minimum valid power measurement (outlier detection)

**Used By**:
- EnergyTrackingService - Validation
- COPCalculator - Method 1 (Direct Thermal)

**Rationale**:
- < 100W: Heat pump not operating or sensor error
- Typical standby: 50-100W
- Typical operation: 500-5000W

**Customization**:
- Increase for large systems (up to 200)
- **Not recommended to decrease** - affects COP accuracy

---

## Safety & Limits Constants

### CRITICAL_TEMPERATURE_HIGH_C

**Value**: `80`

**Purpose**: Critical high temperature threshold for safety alerts

**Used By**:
- Flow cards - Temperature safety monitoring
- CapabilityHealthService - Critical alerts

**Rationale**:
- 80°C+: Risk of scalding, component damage
- Normal operation: 30-60°C
- Triggers immediate user notification

**Customization**:
- **Not recommended** - safety-critical threshold

### CRITICAL_TEMPERATURE_LOW_C

**Value**: `-20`

**Purpose**: Critical low temperature threshold for safety alerts

**Used By**:
- Flow cards - Temperature safety monitoring

**Rationale**:
- -20°C: Indicates freezing risk or sensor malfunction
- Normal operation: 0-60°C
- Arctic environments may see -10°C to -15°C

**Customization**:
- Decrease for arctic climates (down to -30)
- Increase for moderate climates (up to -10)

---

## Notification Constants

### NOTIFICATION_THROTTLE_MS

**Value**: `30 * 60 * 1000` (30 minutes)

**Purpose**: Minimum interval between repeated notifications for same issue

**Used By**:
- TuyaConnectionService - Connection failure alerts
- Flow cards - Safety alert rate limiting

**Rationale**:
- Prevents notification spam
- 30 minutes: Long enough to avoid annoyance, short enough for timely alerts
- User can take action between notifications

**Customization**:
- Increase for less critical alerts (up to 60 minutes)
- Decrease for urgent issues (down to 15 minutes)

---

## Customization Guidelines

### Safe to Customize

**Low Risk** (affects user experience, not safety):
- `HEALTH_CHECK_INTERVAL_MS` (1-5 minutes)
- `COP_CALCULATION_INTERVAL_MS` (15-60 seconds)
- `ROLLING_COP_UPDATE_INTERVAL_MS` (2-10 minutes)
- `NOTIFICATION_THROTTLE_MS` (15-60 minutes)

**Medium Risk** (affects data quality):
- `NULL_THRESHOLD` (5-20)
- `CAPABILITY_TIMEOUT_MS` (2-10 minutes)
- `SCOP_MIN_HOURS` (50-200)
- `ROLLING_COP_OUTLIER_THRESHOLD` (2.0-3.0)

### Not Recommended to Customize

**Safety-Critical**:
- `CRITICAL_TEMPERATURE_HIGH_C` (80°C)
- `CRITICAL_TEMPERATURE_LOW_C` (-20°C)

**Physics-Based**:
- `MIN_VALID_COP` (0.5)
- `MAX_VALID_COP` (8.0)

**System-Critical**:
- `ROLLING_COP_IDLE_MONITOR_INTERVAL_MS` (30 minutes)
- Time-series data point intervals (affects data continuity)

### Customization Example

```typescript
// lib/constants.ts
export class DeviceConstants {
  // Customize for slow network environment
  static readonly RECONNECTION_INTERVAL_MS = 45 * 1000; // 45s instead of 20s

  // Customize for research application
  static readonly COP_CALCULATION_INTERVAL_MS = 15 * 1000; // 15s instead of 30s

  // Customize for large heat pump
  static readonly HIGH_POWER_THRESHOLD_W = 15000; // 15kW instead of 10kW

  // Keep safety-critical values unchanged
  static readonly CRITICAL_TEMPERATURE_HIGH_C = 80; // DO NOT CHANGE
}
```

### Testing After Customization

1. **Run Integration Tests**: Verify system still functions correctly
2. **Monitor Performance**: Check CPU usage, memory consumption
3. **Validate Data Quality**: Verify COP calculations, health monitoring
4. **Test Edge Cases**: Simulate connection failures, sensor errors
5. **User Acceptance**: Confirm notification frequency acceptable

---

## Constant Groups by Service

### TuyaConnectionService

- `RECONNECTION_INTERVAL_MS`
- `CONNECTION_FAILURE_THRESHOLD`
- `NOTIFICATION_THROTTLE_MS`

### CapabilityHealthService

- `HEALTH_CHECK_INTERVAL_MS`
- `NULL_THRESHOLD`
- `CAPABILITY_TIMEOUT_MS`

### COPCalculator

- `COP_CALCULATION_INTERVAL_MS`
- `MIN_VALID_COP`
- `MAX_VALID_COP`
- `EXTERNAL_DEVICE_QUERY_TIMEOUT_MS`

### SCOPCalculator

- `SCOP_MIN_HOURS`
- `SCOP_RECOMMENDED_HOURS`
- `SCOP_HIGH_CONFIDENCE_THRESHOLD`
- `SCOP_MEDIUM_CONFIDENCE_THRESHOLD`
- `SCOP_SEASONAL_COVERAGE_HIGH`
- `SCOP_SEASONAL_COVERAGE_MEDIUM`

### RollingCOPCalculator

- `ROLLING_COP_DATA_POINTS`
- `ROLLING_COP_MIN_DATA_POINTS`
- `ROLLING_COP_UPDATE_INTERVAL_MS`
- `ROLLING_COP_OUTLIER_THRESHOLD`
- `ROLLING_COP_IDLE_MONITOR_INTERVAL_MS`

### EnergyTrackingService

- `HIGH_POWER_THRESHOLD_W`
- `MIN_POWER_MEASUREMENT_W`

---

## Further Reading

- [Service Architecture Guide](service-architecture-guide.md) - How services use constants
- [Architecture Overview](architecture-overview.md) - DeviceConstants in system architecture
- [CLAUDE.md](../../CLAUDE.md) - Development patterns using constants

---

The DeviceConstants class provides a maintainable, well-documented single source of truth for all configuration values in the Adlar Heat Pump app. By centralizing constants, the codebase remains clean, consistent, and easy to customize for specific environments or requirements.
