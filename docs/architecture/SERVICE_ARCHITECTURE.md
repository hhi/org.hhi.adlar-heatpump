# Service Architecture

**Parent Documentation**: [CLAUDE.md](../../CLAUDE.md)
**Related**: [HEARTBEAT_MECHANISM.md](HEARTBEAT_MECHANISM.md), [ERROR_HANDLING.md](ERROR_HANDLING.md)

## Overview

The app uses **9 specialized services** managed by ServiceCoordinator, eliminating code duplication and providing clear separation of concerns.

## Infrastructure Services (5)

### 1. TuyaConnectionService

**Location**: `lib/services/tuya-connection-service.ts`

**Core Responsibilities**:
- Device communication via TuyAPI
- Automatic reconnection handling with crash-proof error recovery (v0.99.46)
- Deep socket error interception (v0.99.49) - intercepts TuyAPI internal socket ECONNRESET errors after connection
- Connection health monitoring
- Real-time connection status tracking (v0.99.47) - 4 states: connected, disconnected, reconnecting, error
- Connection timestamp persistence (v0.99.63+) - survives app updates and restarts
- Event-driven sensor data updates
- Auto device availability status sync (unavailable during outages, available on reconnect)
- Synchronous event handlers (v0.99.67) - prevents async Promise blocking TuyAPI state machine
- Unhandled promise rejection protection in async setTimeout callbacks
- Idempotent error handler installation with listener cleanup (v0.99.49)

**Heartbeat Monitoring**:
- **Layer 0: Native heartbeat monitoring** (v1.1.2) - fastest zombie detection via TuyaAPI events (35s timeout)
- Layer 1-2: Hybrid heartbeat monitoring (v0.99.98, v1.0.9) - proactive connection health checks every 5 minutes
- Intelligent skip logic (v0.99.98) - avoids heartbeat when device active (recent data)
- Zombie connection detection (v0.99.98) - automatic reconnect after 10 minutes without data
- Stale connection force-reconnect (v0.99.98) - detects idle connections claiming to be active
- Single-source connection truth (v0.99.99) - eliminates extended disconnection periods

**For detailed heartbeat architecture**: See [HEARTBEAT_MECHANISM.md](HEARTBEAT_MECHANISM.md)

### 2. CapabilityHealthService

**Location**: `lib/services/capability-health-service.ts`

**Responsibilities**:
- Real-time capability health tracking (DPS-only, v1.2.3)
- Excludes calculated values (COP/SCOP) and external integrations from health metrics
- Tracks device communication health, not application logic health
- Null value detection and monitoring
- Data availability validation
- Health-based flow card registration

### 3. FlowCardManagerService

**Location**: `lib/services/flow-card-manager-service.ts`

**Responsibilities**:
- Dynamic flow card registration (64 cards across 8 categories)
- Health-based auto-registration
- User preference management (disabled/auto/enabled modes)
- Cross-service event handling

### 4. EnergyTrackingService

**Location**: `lib/services/energy-tracking-service.ts`

**Responsibilities**:
- External power measurement integration
- Energy consumption calculations
- Power capability management
- External device data validation

### 5. SettingsManagerService

**Location**: `lib/services/settings-manager-service.ts`

**Responsibilities**:
- Race condition prevention (deferred updates pattern)
- Settings validation and persistence
- Power settings auto-management
- Seasonal data storage

## Calculation Services (3)

### 6. COPCalculator

**Location**: `lib/services/cop-calculator.ts`

**Responsibilities**:
- Real-time COP calculations with 8 methods (±5% to ±30% accuracy)
- Automatic method selection based on data availability
- Compressor operation validation (COP = 0 when idle)
- Diagnostic feedback ("No Power", "No Flow", etc.)
- Outlier detection and confidence levels

### 7. RollingCOPCalculator

**Location**: `lib/services/rolling-cop-calculator.ts`

**Responsibilities**:
- Time-series analysis (daily/weekly/monthly rolling averages)
- Trend detection (7 levels: strong improvement → significant decline)
- Runtime-weighted averaging
- Idle period awareness
- Circular buffer management (1440 data points)

### 8. SCOPCalculator

**Location**: `lib/services/scop-calculator.ts`

**Responsibilities**:
- Seasonal COP per EN 14825 European standard
- Temperature bin method (6 bins: -10°C to +20°C)
- Quality-weighted averaging
- Seasonal coverage tracking (Oct 1 - May 15)
- Method contribution analysis

## Advanced Control Services (1)

### 9. AdaptiveControlService

**Location**: `lib/services/adaptive-control-service.ts` (v1.3.0+)

**Full Documentation**: [Adaptive Control Architecture Guide](../Dev%20support/Architectural%20overview/adaptive-control-architecture.md)

**Core Features**:
- **PI-based temperature control** using external room temperature sensor
- Maintains stable indoor temperature (±0.3°C deadband)
- 5-minute control loop with intelligent adjustment accumulation
- Persistent PI controller history (survives app restarts)
- Integration with **HeatingController** (`lib/adaptive/heating-controller.ts`)
- Integration with **ExternalTemperatureService** (`lib/services/external-temperature-service.ts`)
- Flow card triggers for transparency (`adaptive_status_change`, `target_temperature_adjusted`)
- Zero modifications to device class (external pattern)

**Key Components**:

#### HeatingController
**Location**: `lib/adaptive/heating-controller.ts`

- PI algorithm with Kp=3.0, Ki=1.5
- 24-point error history (2 hours at 5-minute intervals)
- Safety clamp: ±3°C maximum adjustment per cycle
- Deadband tolerance prevents oscillation

#### ExternalTemperatureService
**Location**: `lib/services/external-temperature-service.ts`

- Receives room temperature from Homey thermostats/sensors
- Data validation and freshness tracking (5-minute timeout)
- Capability: `adlar_external_indoor_temperature`
- Registration: `device.ts:3856-3870` (v2.0.1+)

**Indoor Temperature Flow Card Architecture** (v2.0.1+):

```text
┌──────────────────────────────────────────────────────────────┐
│                Indoor Temperature Flow Card                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  User Flow: "WHEN thermostat changes THEN send temp"        │
│                          │                                   │
│                          ▼                                   │
│         ┌────────────────────────────────┐                  │
│         │ Flow Card Handler (device.ts)  │                  │
│         │ ────────────────────────────── │                  │
│         │ Log: 🏠 Received temp: X°C     │                  │
│         └──────────────┬─────────────────┘                  │
│                        │                                     │
│                        ▼                                     │
│         ┌────────────────────────────────┐                  │
│         │   AdaptiveControlService       │                  │
│         │ ────────────────────────────── │                  │
│         │ receiveExternalTemperature()   │                  │
│         └──────────────┬─────────────────┘                  │
│                        │                                     │
│                        ▼                                     │
│         ┌────────────────────────────────┐                  │
│         │ ExternalTemperatureService     │                  │
│         │ ────────────────────────────── │                  │
│         │ • Validate: -10°C to +50°C     │                  │
│         │ • Store timestamp              │                  │
│         │ • Log with ISO timestamp       │                  │
│         └──────────────┬─────────────────┘                  │
│                        │                                     │
│                        ▼                                     │
│         ┌────────────────────────────────┐                  │
│         │ Device Capability Update       │                  │
│         │ ────────────────────────────── │                  │
│         │ adlar_external_indoor_temp     │                  │
│         │           = X°C                │                  │
│         └──────────────┬─────────────────┘                  │
│                        │                                     │
│                        ▼                                     │
│            Log: ✅ Temperature updated                       │
│                                                              │
│  Next 5-min cycle: AdaptiveControlService reads capability  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Control Flow** (Every 5 Minutes):

1. Read external indoor temperature via ExternalTemperatureService
2. Read current `target_temperature` from device
3. Calculate error: `targetTemp - indoorTemp`
4. Skip if within deadband (±0.3°C)
5. PI calculation: `adjustment = Kp×error + Ki×avgError`
6. Accumulate fractional adjustments (step:1 rounding)
7. Apply to `target_temperature` capability when ≥0.5°C
8. Trigger flow cards with adjustment details
9. Persist state to device store

**Persistence Strategy**:
- PI error history stored in device store (`adaptive_pi_history`)
- Last action tracking (`adaptive_last_action`)
- Accumulated adjustment counter (`adaptive_accumulated_adjustment`)
- Enable/disable state (`adaptive_control_enabled`)
- All state survives app updates and Homey restarts

**Flow Card Integration**:
- **Action**: `receive_external_indoor_temperature` - Updates external sensor data
  - Registered handler: `device.ts:3856-3870` (v2.0.1+)
  - Logs: `🏠 Received external indoor temperature: X°C` → `✅ External indoor temperature updated`
  - Calls: `AdaptiveControlService.receiveExternalTemperature()` → `ExternalTemperatureService.receiveExternalTemperature()`
- **Trigger**: `adaptive_status_change` - Status updates (enabled/disabled/error states)
- **Trigger**: `target_temperature_adjusted` - Transparency (shows adjustment reason and magnitude)

### Adaptive Control Components

#### Component 1: Heating Controller (v1.3.0+)

**Status**: ✅ Complete
**Purpose**: PI-based temperature control
**Details**: See main AdaptiveControlService section above

#### Component 2: Building Model Learner (v1.4.0+)

**Location**: `lib/adaptive/building-model-learner.ts`
**Status**: ✅ Complete

Learns thermal properties of the building using **Recursive Least Squares (RLS)** machine learning algorithm.

**Learned Parameters**:
- **C** (Thermal Mass): Building's heat storage capacity in kWh/°C
- **UA** (Heat Loss): Heat transfer coefficient in kW/°C
- **g** (Solar Gain): Solar radiation utilization factor (dimensionless)
- **P_int** (Internal Gains): Internal heat sources in kW
- **τ** (Time Constant): C/UA in hours - how fast building responds to changes

**RLS Algorithm**:
```typescript
// Physical model: dT/dt = (1/C) × [P_heating - UA×(T_in - T_out) + g×Solar + P_int]
// Rewritten as: y = X^T × θ
// where θ = [1/C, UA/C, g/C, P_int/C] are learned parameters

// RLS update equations (every 5 minutes):
K = P × X / (λ + X^T × P × X)              // Kalman gain
θ_new = θ_old + K × (y - X^T × θ_old)      // Parameter update
P_new = (1/λ) × (P - K × X^T × P)          // Covariance update
```

**Configuration**:
- Forgetting factor λ = 0.998 (adapts to seasonal changes)
- Initial covariance = 100 (high uncertainty)
- Confidence threshold = 70% (288 samples = 24 hours @ 5min intervals)

**Data Collection**:
- Thermal power calculation: `P_thermal = (P_electric / 1000) × COP`
- Solar radiation: Time-based estimation or external sensor integration
- Update frequency: Every 5 minutes
- Capability updates: Every 50 minutes (10 samples)

**State Persistence**:
- `building_model_state` in device store
- Contains: theta parameters, covariance matrix P, sample count, last measurement
- Survives app restarts and updates

**Flow Card Integration**:
- **Trigger**: `learning_milestone_reached` at 70% confidence
- **Tokens**: confidence, thermal_mass, time_constant, milestone
- **Action**: `diagnose_building_model` - Troubleshooting diagnostic tool (v2.0.1+)

**Service Wrapper**: `BuildingModelService` (`lib/services/building-model-service.ts`)
- Manages learner lifecycle and device integration
- Automatic capability updates (`adlar_building_c`, `adlar_building_ua`, `adlar_building_tau`)
- 5-minute data collection cycle
- Diagnostic methods: `getDiagnosticStatus()`, `logDiagnosticStatus()` (v2.0.1+)

**Diagnostic Capabilities** (v2.0.1+):

The `diagnose_building_model` flow action provides comprehensive troubleshooting when tau/C/UA values don't update:

```text
┌─────────────────────────────────────────────────────────┐
│          Building Model Diagnostic Flow                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  User Triggers Flow                                     │
│         │                                               │
│         ▼                                               │
│  ┌─────────────────────────────┐                       │
│  │  getDiagnosticStatus()      │                       │
│  │  ─────────────────────────  │                       │
│  │  ✓ Check enabled setting    │                       │
│  │  ✓ Check indoor temp sensor │                       │
│  │  ✓ Check outdoor temp sensor│                       │
│  │  ✓ Get sample count         │                       │
│  │  ✓ Calculate confidence     │                       │
│  │  ✓ Determine blocking reason│                       │
│  └─────────────┬───────────────┘                       │
│                │                                        │
│                ▼                                        │
│  ┌─────────────────────────────┐                       │
│  │  logDiagnosticStatus()      │                       │
│  │  ─────────────────────────  │                       │
│  │  Enabled: ✅/❌             │                       │
│  │  Indoor temp: ✅ 21.5°C     │                       │
│  │  Outdoor temp: ✅ 5.2°C     │                       │
│  │  Samples: 47                │                       │
│  │  Confidence: 16%            │                       │
│  │  Tau: 48.3h (LEARNED)       │                       │
│  │  Next update: 3 samples     │                       │
│  │  Status: ✅ Learning active │                       │
│  └─────────────┬───────────────┘                       │
│                │                                        │
│                ▼                                        │
│         App Logs Output                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Diagnostic Status Fields**:
- `enabled`: Building model learning setting state
- `hasIndoorTemp`: External indoor sensor flow working
- `hasOutdoorTemp`: Ambient temperature sensor available
- `sampleCount`: Number of measurements collected
- `confidence`: 0-100% learning confidence
- `tau`: Current time constant (50h = default, other = learned)
- `blockingReason`: Specific issue preventing learning (null if active)

**Common Blocking Reasons**:
- "Learning disabled in settings" → Enable `building_model_enabled`
- "No indoor temperature (external sensor flow not running)" → Setup `receive_external_indoor_temperature` flow
- "No outdoor temperature (ambient sensor not available)" → Check DPS 25 sensor
- "Collecting initial samples (X/10)" → Wait for 50 minutes

**Timeline**:
- T+0: Default tau = 50.0h
- T+50min: First update after 10 samples
- T+24h: 70% confidence milestone (288 samples)

#### Component 3: Energy Price Optimizer (v1.4.0+)

**Location**: `lib/adaptive/energy-price-optimizer.ts`
**Status**: ✅ Complete
**⚠️ OPTIONAL** - Only useful for users with **dynamic energy pricing contracts** (e.g., day-ahead market pricing). Disabled by default.

Optimizes heating based on **dynamic day-ahead energy prices** from EnergyZero API.

**Prerequisites**:
- ✅ Dynamic energy contract with hourly pricing (e.g., ANWB Energie, Tibber, EasyEnergy)
- ❌ NOT useful for fixed-rate contracts (standard energy tariffs)
- 🔒 Default: **Disabled** - users must explicitly enable in settings

**Price Categories** (5 tiers):
- **VERY_LOW**: < €0.10/kWh → Pre-heat MAX (+1.5°C, high priority)
- **LOW**: €0.10-0.15/kWh → Pre-heat moderate (+0.75°C, medium priority)
- **NORMAL**: €0.15-0.25/kWh → Maintain (0°C, low priority)
- **HIGH**: €0.25-0.35/kWh → Reduce moderate (-0.5°C, medium priority)
- **VERY_HIGH**: > €0.35/kWh → Reduce MAX (-1.0°C, high priority)

**API Integration**:
- Endpoint: `https://api.energyzero.nl/v1/energyprices`
- Update frequency: 1x per hour (day-ahead data updates at 13:00)
- Data retention: 48 hours of price forecasts
- Rate limiting: 1 request/hour (respects API fair use)

**Optimization Strategy**:
- Look-ahead window: 4 hours (future price averaging)
- Pre-heat only if indoor temp below target + max offset
- Reduce only if indoor temp above target + max offset
- Respects comfort boundaries (never sacrifices user comfort)

**Cost Tracking**:
- **Hourly Cost**: `(measure_power / 1000) × current_price` in €/h
- **Daily Cost**: `daily_consumption × average_price` in €
- Integration with Homey system flow cards (power/energy triggers)
- Custom flow card: `daily_cost_threshold` with configurable limit

**State Persistence**:
- `energy_optimizer_state` in device store
- Contains: price data array, last fetch timestamp
- Survives app restarts with 7-day expiration

**Flow Card Integration**:
- **Trigger**: `price_threshold_crossed` when category changes
- **Trigger**: `daily_cost_threshold` when daily cost exceeds limit
- **Tokens**: category, price, next_hour_price, daily_cost, daily_consumption

**Capabilities**:
- `adlar_energy_price_current` (€/kWh, 3 decimals)
- `adlar_energy_price_next` (€/kWh, 3 decimals)
- `adlar_energy_price_category` (string: very_low/low/normal/high/very_high)
- `adlar_energy_cost_hourly` (€/h, 2 decimals)
- `adlar_energy_cost_daily` (€, 2 decimals)

#### Component 4: COP Optimizer (v1.4.0+)

**Location**: `lib/adaptive/cop-optimizer.ts`
**Status**: ✅ Complete

Optimizes **Coefficient of Performance (COP)** by learning historical relationships between outdoor temperature, supply temperature, and achieved COP.

**Learning Strategy**:
- Historical database: 1000 data points (FIFO circular buffer)
- Outdoor temperature bucketing: ±2°C groups (e.g., -2°C, 0°C, 2°C, ...)
- Supply temperature bucketing: ±2°C groups
- Finds optimal supply temp for each outdoor temp bucket
- Minimum 5 samples per bucket before optimization

**Optimization Thresholds**:
- Minimum acceptable COP: 2.5 (triggers high-priority action)
- Target COP: 3.5 (triggers medium-priority optimization)
- Supply temp range: 25-55°C (safety boundaries)

**Three Strategies**:
| Strategy | Max Adjustment | Speed | Use Case |
|----------|---------------|-------|----------|
| Conservative | ±1°C | Slow, safe | First-time users, stability |
| Balanced | ±2°C | Medium | Default, most users |
| Aggressive | ±3°C | Fast | Advanced users, testing |

**COP Data Collection**:
- Reuses existing capabilities: `adlar_cop`, `adlar_cop_daily`, `adlar_cop_weekly`
- No duplicate COP calculations (leverages existing COPCalculator service)
- Collection frequency: Every 5 minutes (during control cycle)
- Compressor validation: Only logs when compressor > 0 Hz

**Action Logic**:
```typescript
if (currentCOP < minAcceptableCOP) {
  // HIGH PRIORITY: COP too low
  if (hasHistoricalOptimal) {
    adjust toward historical optimum
  } else {
    heuristic: reduce supply temp (lower supply = higher COP)
  }
} else if (currentCOP < targetCOP && dailyCOP < targetCOP) {
  // MEDIUM PRIORITY: COP acceptable but improvable
  if (hasHistoricalOptimal && difference > 3°C) {
    adjust toward historical optimum
  }
} else {
  // LOW PRIORITY: COP is good, maintain
}
```

**State Persistence**:
- `cop_optimizer_state` in device store
- Contains: history array, optimal settings map
- Survives app restarts and updates

**Integration**: Called during adaptive control cycle when COP optimizer enabled in settings

#### Weighted Decision Maker (v1.4.0+)

**Location**: `lib/adaptive/weighted-decision-maker.ts`

Combines recommendations from all 4 controllers into a single **weighted decision** using configurable priorities.

**Default Priorities** (Normalized to sum = 1.0):
- **60% Comfort** (HeatingController) - Always highest priority
- **25% Efficiency** (COPOptimizer) - Within comfort boundaries
- **15% Cost** (EnergyPriceOptimizer) - Within comfort + efficiency boundaries

**Combination Algorithm**:
```typescript
finalAdjustment =
  (comfortAdjust × 0.60) +
  (efficiencyAdjust × 0.25) +
  (costAdjust × 0.15)

priority = max(heatingPriority, copPriority, pricePriority)
```

**Example Calculation**:
```
HeatingController: +2.0°C (error 0.8°C, high priority)
COPOptimizer: -1.0°C (COP 2.3 low, high priority)
EnergyPriceOptimizer: +1.5°C (very low price, high priority)

Weighted Result:
Comfort:    +2.0 × 0.60 = +1.20°C
Efficiency: -1.0 × 0.25 = -0.25°C
Cost:       +1.5 × 0.15 = +0.23°C
────────────────────────────────
Final:                   +1.18°C (rounded to +1°C for step:1)
Priority: high (any controller high = overall high)
```

**Transparency Features**:
- Breakdown tokens show contribution of each component
- Reasoning array explains each controller's recommendation
- `adaptive_simulation_update` flow card fires every cycle with full monitoring data
- `temperature_adjustment_recommended` flow card fires only when significant action needed
- `adaptive_control_diagnostics` capability provides real-time JSON diagnostics

**Control Cycle** (v2.5.0+, Every 5 Minutes):

1. **Validation**: Check if adaptive control enabled, get indoor temperature
2. **Data Collection**: Read target temp, outdoor temp, COP values
3. **Component 1 (Comfort)**: HeatingController calculates PI adjustment
4. **Component 3 (Cost)**: EnergyPriceOptimizer calculates price-based adjustment (if enabled)
5. **Component 4 (Efficiency)**: COPOptimizer calculates COP-based adjustment (if enabled)
6. **Component 2 (Learning)**: BuildingModelService collects data point (if enabled)
7. **Integration**: WeightedDecisionMaker combines all actions with confidence-aware weighting
8. **Diagnostics Update**: Update `adaptive_control_diagnostics` capability with full breakdown
9. **Monitoring Trigger**: Fire `adaptive_simulation_update` flow card (every cycle)
10. **Recommendation Check**: If significant action needed, fire `temperature_adjustment_recommended`
11. **Simulated Target Update**: Update `adlar_simulated_target` capability (for Insights tracking)
12. **Flow-Assisted Execution**: User flows decide whether to apply recommendation
13. **Persistence**: Save all optimizer states to device store

**Operating Mode** (v2.5.0+):

- **Flow-Assisted Simulate Mode** (implicit, always active): System calculates and recommends, user flows execute
- Removed automatic execution mode for safety and user control
- All adjustments require explicit user flow action

**Settings Configuration** (v1.4.0+):

Users can configure all components via device settings:

**Building Model Learning**:
- `building_model_enabled` (default: true) - Enable/disable learning
- `building_model_forgetting_factor` (default: 0.998, expert mode) - Adaptation speed

**Energy Price Optimization**:
- `energy_optimizer_enabled` (default: false) - Enable/disable price optimization
- `price_threshold_very_low` (default: €0.10/kWh)
- `price_threshold_low` (default: €0.15/kWh)
- `price_threshold_normal` (default: €0.25/kWh)
- `price_threshold_high` (default: €0.35/kWh)
- `price_max_preheat_offset` (default: 1.5°C)

**COP Optimization**:
- `cop_optimizer_enabled` (default: false) - Enable/disable COP optimization
- `cop_min_acceptable` (default: 2.5)
- `cop_target` (default: 3.5)
- `cop_strategy` (default: balanced) - conservative/balanced/aggressive

**System Integration**:

- `priority_comfort` (default: 60%) - Comfort weight
- `priority_efficiency` (default: 25%) - Efficiency weight
- `priority_cost` (default: 15%) - Cost weight

**Expected Savings** (Annual Estimates):
- **Component 3 (Energy Optimizer)**: €400-600/year ⚠️ **ONLY with dynamic pricing contract**
- **Component 4 (COP Optimizer)**: €200-300/year (all users)
- **Total**: €200-900/year depending on contract type
- Component 2 (Building Model): Enables predictive features (future versions)

**Savings by Contract Type**:
- **Fixed-rate contract**: €200-300/year (Components 1, 2, 4 only)
- **Dynamic pricing contract**: €600-900/year (all components)

**Safety Features**:

- Flow-assisted execution (system recommends, user flows execute via `temperature_adjustment_recommended` trigger)
- Individual component enable/disable toggles
- Confidence-aware weighting (low-confidence components get reduced weight)
- Comfort always prioritized (60% weight minimum recommended)
- All adjustments respect 20-minute throttling and fractional accumulation logic
- Automatic state persistence and recovery across app restarts

## Service Coordinator

**Location**: `lib/services/service-coordinator.ts`

ServiceCoordinator manages initialization, lifecycle, and cross-service communication:

```typescript
class ServiceCoordinator {
  // Service getters
  getTuyaConnection(): TuyaConnectionService;
  getCapabilityHealth(): CapabilityHealthService;
  getFlowCardManager(): FlowCardManagerService;
  getEnergyTracking(): EnergyTrackingService;
  getSettingsManager(): SettingsManagerService;
  getCOPCalculator(): COPCalculator;
  getSCOPCalculator(): SCOPCalculator;
  getRollingCOPCalculator(): RollingCOPCalculator;
  getAdaptiveControl(): AdaptiveControlService;

  // Unified lifecycle
  async initialize(config: ServiceConfig): Promise<void>;
  async onSettings(oldSettings, newSettings, changedKeys): Promise<void>;
  destroy(): void;
}
```

### Cross-Service Event Flow Example 1 (COP Calculation)

1. **TuyaConnectionService** receives sensor update (DPS change)
2. **COPCalculator** triggered with new sensor values
3. **CapabilityHealthService** validates sensor data quality
4. **COPCalculator** calculates COP and emits `cop-calculated` event
5. **RollingCOPCalculator** adds data point to circular buffer
6. **SCOPCalculator** processes for temperature bin classification
7. **SettingsManagerService** persists updated data
8. **Device** publishes to capabilities (`adlar_cop`, `adlar_cop_daily`, etc.)

### Cross-Service Event Flow Example 2 (Adaptive Temperature Control)

1. **User Flow Card** triggers `receive_external_indoor_temperature` action (e.g., Homey thermostat reports 19.5°C)
2. **ExternalTemperatureService** receives and validates temperature data
3. **Device** updates `adlar_external_indoor_temperature` capability (visible in UI)
4. **AdaptiveControlService** control loop triggers (5-minute interval)
5. **AdaptiveControlService** reads external temperature + current `target_temperature` (e.g., 20.0°C)
6. **HeatingController** calculates PI adjustment (error = 0.5°C → adjustment = +1.8°C)
7. **AdaptiveControlService** accumulates adjustment and applies when ≥0.5°C threshold
8. **Device** updates `target_temperature` capability (20.0°C → 22.0°C, rounded to step:1)
9. **TuyaConnectionService** sends DPS 4 update to heat pump hardware
10. **FlowCardManagerService** triggers `target_temperature_adjusted` flow card with tokens
11. **SettingsManagerService** persists PI history and accumulated adjustment to device store

## Service Architecture Benefits

- **Code Duplication Eliminated**: Shared functionality centralized in services
- **Single Responsibility**: Each service handles one specific domain
- **Testability**: Services can be unit tested independently
- **Maintainability**: Changes isolated to relevant service
- **Extensibility**: New services easily added without modifying existing code
- **Fallback Safety**: Graceful degradation when services unavailable

## Memory Management & Leak Prevention (v1.0.1+)

**Critical**: All services with data accumulation MUST implement `destroy()` methods to prevent memory leaks.

### Memory Leak Fixes (v1.0.1)

1. **SCOPCalculator** (`lib/services/scop-calculator.ts`)
   - **Issue**: `dailyData` Map grew unbounded (kept 2 years of seasonal data)
   - **Impact**: ~20-30 MB memory leak over 8 hours
   - **Fix**: Added `destroy()` method to clear Map and reset season tracking

2. **RollingCOPCalculator** (`lib/services/rolling-cop-calculator.ts`)
   - **Issue**: `dataPoints` array kept 1440+ data points without cleanup
   - **Impact**: ~10-20 MB memory leak over 8 hours
   - **Fix**: Added `destroy()` method to clear circular buffer

3. **EnergyTrackingService** (`lib/services/energy-tracking-service.ts`)
   - **Issue**: Incomplete `destroy()` - timers not cleared
   - **Impact**: ~5-10 MB memory leak + continued timer execution
   - **Fix**: Enhanced `destroy()` to clear all intervals/timeouts

### Destroy() Method Pattern

```typescript
public destroy(): void {
  // Clear data structures
  this.dataPoints = [];
  this.dailyData.clear();

  // Clear timers
  if (this.interval) {
    clearInterval(this.interval);
    this.interval = null;
  }

  // Log for debugging
  this.log('Service destroyed - memory released');
}
```

### Device Cleanup

**Location**: `device.ts:onDeleted()`

- ServiceCoordinator destroy() → cleans infrastructure services
- Calculator destroy() calls → cleans calculation services
- Prevents 45-65 MB memory leak over 8-hour runtime

### Memory-Connection Correlation

- Memory growth → Node.js garbage collection pauses
- GC pauses → socket timeouts (ECONNRESET errors)
- Proper cleanup prevents both memory leaks AND connection issues

## Reconnection Resilience (v1.0.5+)

**Critical**: Extended internet outages must auto-recover without manual intervention.

### Problem (Pre-v1.0.5)

Circuit breaker entered infinite loop during sustained outages:
- Failed 10x → 5min cooldown → reset counter → failed 10x → repeat forever
- Notification #15 unreachable (counter reset before reaching 15)
- Required manual `force_reconnect` after hours-long disconnection

### Solution (v1.0.5)

5 integrated improvements eliminate infinite loops and guarantee auto-recovery:

1. **Persistent Outage Tracking** (`lib/services/tuya-connection-service.ts:57-58`)
   - Tracks cumulative outage duration independent of circuit breaker resets
   - Enables time-based notifications and user-visible outage timer

2. **Circuit Breaker Cycle Limit** (`tuya-connection-service.ts:973-989`)
   - Maximum 3 cooldown cycles (15 minutes total)
   - After 3 cycles: switches to slow continuous retry (2.5 min interval)
   - Eliminates infinite loop, guarantees ongoing recovery attempts

3. **Internet Recovery Detection** (`tuya-connection-service.ts:947-960`)
   - DNS probe every 30s during cooldown
   - Immediate reconnection when internet restored (within 30s)
   - Avoids waiting full 5-minute cooldown period

4. **User-Visible Outage Timer** (`tuya-connection-service.ts:399-409`)
   - Connection status shows outage duration: `"Disconnected [12 min]"`
   - Circuit breaker countdown: `"Reconnecting [retry in 245s]"`
   - Provides transparency into reconnection process

5. **Time-Based Notifications** (`tuya-connection-service.ts:906-936`)
   - Notifications at fixed intervals: 2min, 10min, 30min
   - Independent of failure counter (not affected by circuit breaker resets)
   - Progressive escalation: info → warning → critical

### Recovery Timeline Example

5-hour internet outage:

```
T+0:00   - Disconnect detected
T+2:00   - Notification "Connection Lost"
T+10:00  - Notification "Extended Outage"
T+15:00  - Max cycles → slow continuous retry (2.5 min)
T+30:00  - Notification "Critical Outage"
...continues retrying every 2.5 min...
T+5:00:15 - DNS probe detects internet recovery
T+5:00:20 - Auto-reconnected (no manual intervention)
```

**For detailed reconnection architecture**: See [Service Architecture Guide - v1.0.5 Reconnection Improvements](../Dev%20support/Architectural%20overview/service-architecture-guide.md#tuyaconnectionservice-v105-reconnection-improvements)

---

**Related Documentation**:
- [Heartbeat Mechanism Details](HEARTBEAT_MECHANISM.md)
- [Error Handling Architecture](ERROR_HANDLING.md)
- [Adaptive Control Architecture](../Dev%20support/Architectural%20overview/adaptive-control-architecture.md)
