# Adlar Heat Pump - Capabilities Overview (v0.99.56+, verified through v1.0.30)

This document provides a comprehensive overview of all device capabilities supported by the Adlar Heat Pump app, including advanced insights management, dynamic capability control, and dual picker/sensor architecture for curve controls.

## Summary Statistics (v0.99.56)

- **Total Custom Adlar Capabilities**: 20 (added dual curve controls in v0.99.54)
- **Total Standard/Custom Capabilities**: 33
- **Total All Capabilities**: 49+
- **DPS Range**: 1-112
- **Capability Types**: number (24), enum (4), boolean (3), string (1)
- **Setable Capabilities**: 3 (adlar_enum_work_mode, adlar_hotwater, plus standard capabilities)
- **Languages Supported**: English (EN) and Dutch (NL) with full internationalization including diagnostic messages and trend descriptions
- **Insights Management**: Dynamic control with power measurement toggle integration (v0.92.6+)
- **Default Insights State**: Power capabilities disabled, core operations enabled
- **Advanced Chart Features**: Custom colors, chart types, and styling options
- **Enhanced Capability Validation**: Improved error handling for missing capabilities (v0.94.0-0.94.1)
- **Temperature Label Clarity**: Updated labels for improved flow card readability (v0.94.2)
- **Rolling COP System**: Time-series analysis with daily/weekly/monthly averages and trend detection (v0.98.5, extended v0.99.8)
- **COP Diagnostic System**: Specific feedback for missing data with 22-character display optimization (v0.98.7)
- **External Data Integration**: Cross-app power measurement for enhanced COP accuracy (v0.98.2)
- **Full Internationalization**: Complete translation support for all COP features and diagnostics (v0.98.7)

## Custom Adlar Capabilities

### Control & Settings Capabilities

#### adlar_enum_mode
- **DPS**: 2 (mode)
- **Type**: enum
- **Purpose**: Sets the primary operation mode of the heat pump
- **Values**: 
  - `cold` (Cold/Koud)
  - `heating` (Heating/Verwarmen) 
  - `floor_heating` (Floor heating/Vloerverwarming)
  - `hot_water` (Hot water/Warm water)
  - `cold_and_hotwater` (Cold and hot water/Koud en warm water)
  - `heating_and_hot_water` (Heating and hot water/Verwarmen en warm water)
  - `floor_heatign_and_hot_water` (Floor heating and hot water/Vloerverwarming en warm water)
- **Properties**: Read-only, picker UI

#### adlar_enum_work_mode
- **DPS**: 5 (work_mode)
- **Type**: enum
- **Purpose**: Sets the operational efficiency mode
- **Values**: 
  - `ECO` (ECO/ECO)
  - `Normal` (Normal/Normaal)
  - `Boost` (Boost/Boost)
- **Properties**: Read/Write, picker UI
- **Note**: One of the few setable capabilities

#### adlar_enum_water_mode
- **DPS**: 10 (water_mode)
- **Type**: number
- **Purpose**: Controls water temperature regulation mode
- **Range**: 0-1 (step 1)
- **Units**: L (Liters)
- **Properties**: Read-only, slider UI

#### adlar_enum_capacity_set
- **DPS**: 11 (capacity_set)
- **Type**: enum
- **Purpose**: Hot water curve picker control (user can set values)
- **Values**: OFF, H1, H2, H3, H4
- **Properties**: Setable, picker UI, insights enabled
- **Visibility**: Controlled by `enable_curve_controls` setting (v0.99.54+)
- **Dual Architecture**: Pairs with `adlar_sensor_capacity_set` for read-only display

#### adlar_sensor_capacity_set
- **DPS**: 11 (capacity_set)
- **Type**: enum
- **Purpose**: Hot water curve sensor (displays actual device setting, read-only)
- **Values**: OFF, H1, H2, H3, H4
- **Properties**: Read-only, sensor UI, insights enabled
- **Added**: v0.99.54 for dual picker/sensor architecture
- **Visibility**: Always visible regardless of settings
- **Dual Architecture**: Pairs with `adlar_enum_capacity_set` for user control

#### adlar_enum_countdown_set
- **DPS**: 13 (countdown_set)
- **Type**: enum
- **Purpose**: Heating curve sensor (displays actual device setting, read-only)
- **Values**: OFF, H1-H8, L1-L8 (16 total values)
- **Properties**: Read-only, sensor UI, insights enabled
- **Visibility**: Always visible regardless of settings
- **Dual Architecture**: Pairs with `adlar_picker_countdown_set` for user control

#### adlar_picker_countdown_set
- **DPS**: 13 (countdown_set)
- **Type**: enum
- **Purpose**: Heating curve picker control (user can set values)
- **Values**: OFF, H1-H8, L1-L8 (16 total values)
- **Properties**: Setable, picker UI, insights enabled
- **Added**: v0.99.54 for dual picker/sensor architecture
- **Visibility**: Controlled by `enable_curve_controls` setting (v0.99.54+)
- **Dual Architecture**: Pairs with `adlar_enum_countdown_set` for read-only display

#### adlar_enum_volume_set
- **DPS**: 106 (volume_set)
- **Type**: number
- **Purpose**: Controls electricity consumption monitoring level
- **Range**: 0-2 (step 1)
- **Properties**: Read-only, slider UI

#### adlar_hotwater
- **DPS**: 101 (minitemp_set)
- **Type**: number
- **Purpose**: Sets target temperature for hot water production
- **Range**: 10-75°C (step 1)
- **Units**: ℃
- **Properties**: Read/Write, slider UI, insights enabled
- **Note**: One of the few setable capabilities

### Status & Monitoring Capabilities

#### adlar_countdowntimer
- **DPS**: 14 (countdown_left)
- **Type**: number
- **Purpose**: Displays remaining countdown time for automatic shutoff
- **Range**: 0-2000 (step 1)
- **Properties**: Read-only, sensor UI, insights enabled

#### adlar_fault
- **DPS**: 15 (fault)
- **Type**: number
- **Purpose**: Displays system fault codes for diagnostics
- **Range**: 0-30
- **Properties**: Read-only, sensor UI, insights enabled

#### adlar_state_compressor_state
- **DPS**: 27 (compressor_state)
- **Type**: boolean
- **Purpose**: Indicates whether the heat pump compressor is running
- **Insights**: 
  - True: "Compressor is ON"/"Compressor is AAN"
  - False: "Compressor is OFF"/"Compressor is UIT"
- **Properties**: Read-only, sensor UI, insights enabled

#### adlar_state_backwater
- **DPS**: 31 (backwater)
- **Type**: boolean
- **Purpose**: Indicates status of backwater/return water system
- **Insights**: 
  - True: "Backwater is ON"/"Retourwater is AAN"
  - False: "Backwater is OFF"/"Retourwater is UIT"
- **Properties**: Read-only, sensor UI, insights enabled

#### adlar_state_defrost_state
- **DPS**: 33 (defrost_state)
- **Type**: boolean
- **Purpose**: Indicates whether the heat pump is in defrost mode
- **Insights**: 
  - True: "Defrosting active"/"Ontdooien actief"
  - False: "Defrosting inactive"/"Ontdooien niet actief"
- **Properties**: Read-only, sensor UI, insights enabled

### Valve Position Measurement Capabilities

#### adlar_measure_pulse_steps_temp_current
- **DPS**: 16 (temp_current)
- **Type**: number
- **Purpose**: Measures EEV (Electronic Expansion Valve) opening pulse-steps
- **Range**: 0 to 480 Pulse-steps (step 1)
- **Units**: Pulse-steps
- **Icon**: `/assets/pulse-steps.svg`
- **Properties**: Read-only, sensor UI, insights enabled

#### adlar_measure_pulse_steps_effluent_temp
- **DPS**: 25 (effluent_temp)
- **Type**: number
- **Purpose**: Measures EVI (Economizer Vapor Injection) valve opening pulse-steps
- **Range**: 0 to 480 Pulse-steps (step 1) 
- **Units**: Pulse-steps
- **Icon**: `/assets/pulse-steps.svg`
- **Properties**: Read-only, sensor UI, insights enabled

### Efficiency & Performance Monitoring

#### adlar_cop
- **Type**: number
- **Purpose**: Displays the calculated Coefficient of Performance (COP) - efficiency ratio of useful heat output to electrical energy input
- **Range**: 0.0 to 8.0 (step 0.01, 2 decimals)
- **Units**: COP
- **Icon**: `/assets/cop-efficiency.svg`
- **Properties**: Read-only, sensor UI, insights enabled
- **Service**: Calculated by **COPCalculator** service (`lib/services/cop-calculator.ts`)
- **Note**: Higher values indicate better efficiency. Uses 8 calculation methods with automatic quality selection and diagnostic feedback.

#### adlar_cop_daily
- **Type**: number
- **Purpose**: 24-hour rolling average COP for trend analysis and daily performance monitoring
- **Range**: 0.0 to 8.0 (step 0.01, 2 decimals)
- **Units**: COP
- **Icon**: `/assets/cop-efficiency.svg`
- **Properties**: Read-only, sensor UI, insights enabled
- **Service**: Calculated by **RollingCOPCalculator** service (`lib/services/rolling-cop-calculator.ts`)
- **Added**: v0.98.5 for rolling time-series analysis
- **Note**: Weighted by compressor runtime for accurate efficiency representation.

#### adlar_cop_weekly
- **Type**: number
- **Purpose**: 7-day rolling average COP for seasonal pattern identification and long-term monitoring
- **Range**: 0.0 to 8.0 (step 0.01, 2 decimals)
- **Units**: COP
- **Icon**: `/assets/cop-efficiency.svg`
- **Properties**: Read-only, sensor UI, insights enabled
- **Service**: Calculated by **RollingCOPCalculator** service (`lib/services/rolling-cop-calculator.ts`)
- **Added**: v0.98.5 for long-term efficiency analysis
- **Note**: Helps identify optimal operating conditions and seasonal patterns.

#### adlar_cop_monthly
- **Type**: number
- **Purpose**: 30-day rolling average COP for seasonal trend analysis and long-term efficiency monitoring
- **Range**: 0.0 to 8.0 (step 0.01, 2 decimals)
- **Units**: COP
- **Icon**: `/assets/cop-efficiency.svg`
- **Properties**: Read-only, sensor UI, insights enabled
- **Service**: Calculated by **RollingCOPCalculator** service (`lib/services/rolling-cop-calculator.ts`)
- **Added**: v0.99.8 for extended seasonal analysis
- **Note**: Ideal for detecting gradual performance changes, seasonal baseline establishment, and maintenance scheduling based on long-term efficiency trends.

#### adlar_cop_trend
- **Type**: string
- **Purpose**: COP performance trend analysis showing efficiency direction and strength
- **Values**: "Strong improvement", "Moderate improvement", "Slight improvement", "Stable", "Slight decline", "Moderate decline", "Significant decline"
- **Icon**: `/assets/cop-efficiency.svg`
- **Properties**: Read-only, sensor UI, insights disabled
- **Service**: Calculated by **RollingCOPCalculator** service (`lib/services/rolling-cop-calculator.ts`)
- **Added**: v0.98.5 for predictive maintenance
- **Enhanced**: v0.98.7 with full internationalization support
- **Note**: Analyzes 24-hour COP trends for optimization guidance and maintenance alerts.

#### adlar_external_power
- **Type**: number
- **Purpose**: External power measurement received via flow cards from other Homey devices for enhanced COP calculations
- **Range**: 0 to 50000 W (step 0.1, 1 decimal)
- **Units**: W
- **Icon**: `/assets/cop-efficiency.svg`
- **Properties**: Read-only, sensor UI, insights enabled
- **Added**: v0.98.2 for cross-app integration
- **Note**: Enables enhanced COP accuracy using external power meter data from other Homey devices.

#### adlar_scop
- **Type**: number
- **Purpose**: Seasonal Coefficient of Performance according to EN 14825 - average efficiency over heating season
- **Range**: 2.0 to 6.0 (step 0.1, 1 decimal)
- **Units**: SCOP
- **Icon**: `/assets/cop-efficiency.svg`
- **Properties**: Read-only, sensor UI, insights enabled
- **Service**: Calculated by **SCOPCalculator** service (`lib/services/scop-calculator.ts`)
- **Added**: v0.98.1 for seasonal efficiency monitoring
- **Note**: Calculated using European standard EN 14825 with temperature bin method over 6+ month heating season.

#### adlar_scop_quality
- **Type**: string
- **Purpose**: SCOP calculation data quality indicator showing confidence level and method mix
- **Values**: Quality percentages and confidence levels ("High confidence", "Medium confidence", "Low confidence")
- **Icon**: `/assets/data-quality.svg`
- **Properties**: Read-only, sensor UI, insights disabled
- **Service**: Calculated by **SCOPCalculator** service (`lib/services/scop-calculator.ts`)
- **Added**: v0.98.1 for SCOP reliability assessment
- **Note**: Shows data quality based on measurement method mix, seasonal coverage, and total data hours available.

#### adlar_cop_method
- **Type**: string
- **Purpose**: Shows which COP calculation method is currently being used for transparency in efficiency calculations
- **Values**:
  - `"Direct Thermal"` (±5% accuracy, uses temperature and flow data)
  - `"Power Module"` (±8% accuracy, internal power calculation)
  - `"Power Estimation"` (±10% accuracy, physics-based modeling)
  - `"Refrigerant Circuit"` (±12% accuracy, thermodynamic analysis)
  - `"Carnot Estimation"` (±15% accuracy, theoretical calculation)
  - `"Valve Correlation"` (±20% accuracy, valve position analysis)
  - `"Temperature Difference"` (±30% accuracy, basic fallback)
  - `"No Data"` (insufficient data with diagnostic info)
- **Icon**: `/assets/cop-efficiency.svg`
- **Properties**: Read-only, sensor UI, insights disabled
- **Service**: Published by **COPCalculator** service (`lib/services/cop-calculator.ts`)
- **Added**: v0.96.3 for calculation method transparency
- **Enhanced**: v0.98.7 with diagnostic information and 8 calculation methods
- **Note**: Enhanced with diagnostic feedback showing specific missing data ("No Power", "No Flow", "No Temp Δ", "Multi Fail") within 22-character display limit.

## Standard Homey Capabilities

### Core Control Capabilities

#### onoff
- **DPS**: 1 (switch)
- **Purpose**: Main power switch
- **Type**: boolean
- **Properties**: Read/Write

#### target_temperature
- **DPS**: 4 (temp_set)
- **Purpose**: Target temperature setting
- **Type**: number
- **Units**: ℃
- **Properties**: Read/Write

#### measure_water
- **DPS**: 39 (venting_temp_f)
- **Purpose**: Water flow measurement
- **Type**: number
- **Units**: L/min
- **Properties**: Read-only

### Power & Electrical Measurements

#### measure_power
- **DPS**: 104 (cur_power)
- **Purpose**: Current power consumption
- **Type**: number
- **Units**: W
- **Properties**: Read-only

#### meter_power.power_consumption
- **DPS**: 18 (power_consumption)
- **Purpose**: Daily electricity consumption
- **Type**: number
- **Units**: kWh
- **Properties**: Read-only

#### meter_power.electric_total
- **DPS**: 105 (electric_total)
- **Purpose**: Total electricity consumption
- **Type**: number
- **Units**: kWh
- **Properties**: Read-only

#### Current Measurements (3-Phase)
- **measure_current.cur_current** (DPS 102): Phase A current
- **measure_current.b_cur** (DPS 109): Phase B current
- **measure_current.c_cur** (DPS 110): Phase C current
- **Type**: number, **Units**: A, **Properties**: Read-only

#### Voltage Measurements (3-Phase)
- **measure_voltage.voltage_current** (DPS 103): Phase A voltage
- **measure_voltage.bv** (DPS 111): Phase B voltage
- **measure_voltage.cv** (DPS 112): Phase C voltage
- **Type**: number, **Units**: V, **Properties**: Read-only

### Frequency Measurements

#### measure_frequency.compressor_strength
- **DPS**: 20 (compressor_strength)
- **Purpose**: Compressor frequency
- **Type**: number
- **Units**: Hz
- **Properties**: Read-only

#### measure_frequency.fan_motor_frequency
- **DPS**: 40 (effluent_temp_f)
- **Purpose**: Fan motor frequency
- **Type**: number
- **Units**: Hz
- **Properties**: Read-only

### Temperature Sensors

The heat pump includes 12 temperature sensors for comprehensive system monitoring:

#### Water Circuit Temperatures
- **measure_temperature.temp_top** (DPS 21): Inlet water temperature
- **measure_temperature.temp_bottom** (DPS 22): Outlet water temperature
- **measure_temperature.around_temp_f** (DPS 38): Tank temperature

#### Heat Pump Circuit Temperatures
- **measure_temperature.coiler_temp** (DPS 23): Evaporator temperature
- **measure_temperature.venting_temp** (DPS 24): Discharge temperature
- **measure_temperature.coiler_temp_f** (DPS 41): Suction temperature

#### Refrigerant System Temperatures
- **measure_temperature.temp_current_f** (DPS 35): High pressure saturation temperature
- **measure_temperature.top_temp_f** (DPS 36): Low pressure saturation temperature
- **measure_temperature.bottom_temp_f** (DPS 37): Condenser temperature

#### EVI System Temperatures
- **measure_temperature.evlin** (DPS 107): EVI heat exchanger suction temperature
- **measure_temperature.eviout** (DPS 108): EVI heat exchanger discharge temperature

#### Environmental Temperature
- **measure_temperature.around_temp** (DPS 26): Ambient temperature

All temperature capabilities:
- **Type**: number
- **Units**: ℃
- **Properties**: Read-only, sensor UI, insights enabled

## Device Compatibility Notes

### Power Management Capabilities
Some device firmware units do not support power management capabilities. The following capabilities may not be available on all devices:

- `measure_power` (DPS 104)
- `measure_current.*` (DPS 102, 109, 110)
- `measure_voltage.*` (DPS 103, 111, 112)
- `meter_power.*` (DPS 18, 105)

The app includes capability detection logic to handle devices without power monitoring support gracefully.

### Firmware Variations
Different firmware versions may support different subsets of capabilities. The app dynamically detects available capabilities during device initialization.

## Technical Implementation

### DPS Mapping
All capabilities are mapped to specific Tuya DPS (Data Point) numbers through the `AdlarMapping` class in `lib/definitions/adlar-mapping.ts`. The mapping includes:

- **Standard capabilities**: Core Homey capabilities (onoff, target_temperature, etc.)
- **Custom capabilities**: Extended capabilities with dot notation (measure_temperature.temp_top)
- **Adlar capabilities**: Device-specific capabilities (adlar_hotwater, adlar_fault, etc.)

### Capability Categories
Capabilities are organized into logical categories:
1. **Control & Settings**: User-adjustable parameters
2. **Status & Monitoring**: System status indicators
3. **Measurements**: Sensor readings and metrics
4. **Power & Electrical**: Energy consumption and electrical parameters

### Insights & Analytics
Most sensor capabilities support Homey's insights system for historical data tracking and trend analysis. Boolean state capabilities include custom insight titles for better user experience.

### Capability Health Monitoring (v0.70.0+ / Service Architecture v0.99.23+)

The app uses the **CapabilityHealthService** (`lib/services/capability-health-service.ts`) to track the availability and reliability of sensor data. This service is managed by the ServiceCoordinator and provides intelligent health monitoring with user-controlled power management.

#### Service Architecture Integration

**CapabilityHealthService** is one of 8 core services managed by ServiceCoordinator:

```typescript
class ServiceCoordinator {
  private capabilityHealth: CapabilityHealthService | null = null;

  async initialize(config: ServiceConfig): Promise<void> {
    this.capabilityHealth = new CapabilityHealthService(device, logger);
    await this.capabilityHealth.startMonitoring();
  }

  destroy(): void {
    this.capabilityHealth?.stopMonitoring();
  }
}
```

**Cross-Service Integration**:

- **TuyaConnectionService**: Provides capability update events for health tracking
- **FlowCardManagerService**: Consumes health status for dynamic flow card registration
- **SettingsManagerService**: Manages user preferences for power capability visibility
- **COPCalculator**: Validates sensor data quality before using in efficiency calculations

#### Health Tracking Features

- **Null Value Detection**: Automatically identifies when capabilities return null values
- **Data Availability Monitoring**: Tracks time since last valid data reception (via service timestamps)
- **Health Status Classification**: Service classifies capabilities as healthy or unhealthy based on data consistency
- **Automatic Recovery**: Health status updates automatically when data becomes available
- **Service-Level Persistence**: Health state tracked across app restarts via SettingsManagerService

#### Health Metrics (DeviceConstants Integration)

The CapabilityHealthService uses centralized constants for consistent thresholds:

- **Null Count Threshold**: Capabilities with >10 consecutive null readings are marked unhealthy (`DeviceConstants.NULL_THRESHOLD`)
- **Timeout Detection**: Capabilities without data for >5 minutes are considered unhealthy (`DeviceConstants.CAPABILITY_TIMEOUT_MS`)
- **Health Check Frequency**: Service updates status every 2 minutes (`DeviceConstants.HEALTH_CHECK_INTERVAL_MS`)
- **Service Lifecycle**: Monitoring starts/stops with ServiceCoordinator lifecycle

#### User-Controlled Capability Management (v0.92.4+)

**Power Measurements Toggle** (via SettingsManagerService):

- Users can disable 9 power-related capabilities via device settings
- SettingsManagerService handles race condition prevention during capability changes
- CapabilityHealthService automatically adjusts monitoring for dynamic capability lists
- FlowCardManagerService receives capability change events for flow card updates

**Service Event Flow**:

1. User changes `enable_power_measurements` setting in UI
2. **SettingsManagerService** validates and applies setting (deferred update pattern)
3. **Device** adds/removes power capabilities
4. **CapabilityHealthService** updates monitoring list
5. **FlowCardManagerService** adjusts flow card registration
6. **ServiceCoordinator** logs service health diagnostics

#### Error Handling Integration (v0.92.4+)

**TuyaErrorCategorizer** integration:

- **Structured error categorization** for capability communication failures
- **Smart Recovery**: CapabilityHealthService marks capabilities unhealthy after recoverable errors
- **User-Friendly Messages**: Clear error explanations when capabilities fail to update
- **Context-Aware Handling**: Different recovery strategies based on error type and capability importance

#### User-Facing Diagnostics

**Service-Based Diagnostic Reports**:

- **Diagnostic Reports**: CapabilityHealthService generates detailed health reports via device settings
- **Health-Based Reporting**: Unhealthy capabilities prioritized at top of diagnostic reports
- **Real-time Monitoring**: Service updates status every 2 minutes during operation
- **Troubleshooting Support**: Clear identification of sensor connectivity issues
- **Flow Card Integration**: FlowCardManagerService consumes health status for "auto" mode registration

#### Service Architecture Benefits

1. **Separation of Concerns**: Health monitoring isolated in dedicated service
2. **Centralized Logic**: Single source of truth for capability health status
3. **Event-Driven Updates**: Automatic propagation of health changes to dependent services
4. **Independent Testing**: Service can be unit tested independently of device class
5. **Service Diagnostics**: ServiceCoordinator tracks CapabilityHealthService status

#### Optional Power Capabilities
These capabilities can be disabled via device settings for devices without power monitoring:

**Power & Energy (9 capabilities):**
- `measure_power` - Current power consumption
- `meter_power.power_consumption` - Daily consumption
- `meter_power.electric_total` - Total consumption
- `measure_current.*` (3 capabilities) - 3-phase current measurements
- `measure_voltage.*` (3 capabilities) - 3-phase voltage measurements

**Benefits:**
- **Cleaner Interface**: Hide non-functional capabilities
- **Reduced Clutter**: Focus on relevant device features
- **Flow Card Management**: Automatically disables related power flow cards
- **Backward Compatibility**: Existing automations remain functional

## Insights Management System (v0.92.6+)

### Dynamic Insights Control

The app provides intelligent insights management aligned with capability visibility and user preferences:

#### Default Insights Configuration

**Power Capabilities** (insights disabled by default):
- `measure_current.*` (3 capabilities) - 3-phase current measurements  
- `measure_voltage.*` (3 capabilities) - 3-phase voltage measurements
- `meter_power.*` (2 capabilities) - Power consumption tracking

**Core Operational Capabilities** (insights enabled by default):
- Temperature sensors (9 capabilities) - All temperature measurements
- System states (4 capabilities) - Compressor, defrost, backwater states
- Valve positions (2 capabilities) - EEV/EVI pulse-steps

#### Advanced Insights Features

**Chart Type Customization:**
```json
{
  "insights": true,
  "chartType": "spline",     // Smooth curves for temperature data
  "color": "#6236FF",        // Custom brand colors
  "decimals": 2,             // Precision control
  "fillOpacity": 0.3         // Area chart transparency
}
```

**Available Chart Types:**
- `spline` - Smooth curved lines (ideal for temperature data)
- `area` - Filled area charts (perfect for power consumption)
- `column` - Bar charts (suitable for valve positions)
- `line` - Straight line connections (system states)
- `scatter` - Point plots (diagnostic data)

#### Insights-Capability Integration

**Power Measurement Toggle Integration:**
- When `enable_power_measurements = false` → Power insights automatically disabled
- When `enable_power_measurements = true` → Power insights re-enabled
- Prevents stale insights data visibility when capabilities are removed
- Maintains user flexibility for manual insights control

#### Benefits of Insights Management

| Feature | Implementation | User Benefit |
|---------|----------------|--------------|
| **Clean Default Interface** | Power insights disabled by default | Reduced data collection overhead |
| **Dynamic Control** | Programmatic insights toggle | Aligned with capability availability |
| **Stale Data Prevention** | Disable insights before capability removal | No confusing historical data |
| **Professional Visualization** | Custom chart styling | Enhanced data presentation |
| **User Flexibility** | Manual insights control available | Preserve detailed monitoring option |

This comprehensive system ensures robust operation even when some capabilities are unavailable due to firmware variations, hardware limitations, or connectivity issues, while providing complete user control over capability visibility, automation complexity, and data visualization preferences.