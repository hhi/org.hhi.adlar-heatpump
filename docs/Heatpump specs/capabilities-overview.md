# Adlar Heat Pump - Capabilities Overview

This document provides a comprehensive overview of all device capabilities supported by the Adlar Heat Pump app.

## Summary Statistics

- **Total Custom Adlar Capabilities**: 14
- **Total Standard/Custom Capabilities**: 27  
- **Total All Capabilities**: 41
- **DPS Range**: 1-112
- **Capability Types**: number (24), enum (4), boolean (3)
- **Setable Capabilities**: 3 (adlar_enum_work_mode, adlar_hotwater, plus standard capabilities)
- **Languages Supported**: English (EN) and Dutch (NL)

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
- **Purpose**: Controls hot water heating curve settings
- **Values**: OFF, H1, H2, H3, H4
- **Properties**: Read-only, picker UI, insights enabled

#### adlar_enum_countdown_set
- **DPS**: 13 (countdown_set)
- **Type**: enum
- **Purpose**: Controls heating curve settings with high (H) and low (L) options
- **Values**: OFF, H1-H8, L1-L8 (16 total values)
- **Properties**: Read-only, picker UI

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

### Capability Health Monitoring (v0.70.0+ / Enhanced v0.92.4+)
The app includes an intelligent capability health monitoring system that tracks the availability and reliability of sensor data with user-controlled power management:

#### Health Tracking Features
- **Null Value Detection**: Automatically identifies when capabilities return null values
- **Data Availability Monitoring**: Tracks time since last valid data reception
- **Health Status Classification**: Capabilities are classified as healthy or unhealthy based on data consistency
- **Automatic Recovery**: Health status updates automatically when data becomes available
- **User-Controlled Power Capabilities**: Optional power measurements can be disabled for cleaner interfaces

#### Health Metrics (DeviceConstants Integration)
- **Null Count Threshold**: Capabilities with >10 consecutive null readings are marked unhealthy (`DeviceConstants.NULL_THRESHOLD`)
- **Timeout Detection**: Capabilities without data for >5 minutes are considered unhealthy (`DeviceConstants.CAPABILITY_TIMEOUT_MS`)
- **Health Check Frequency**: Status updates every 2 minutes (`DeviceConstants.HEALTH_CHECK_INTERVAL_MS`)
- **Health Persistence**: Health status is tracked across app restarts

#### User-Controlled Capability Management (v0.92.4+)
- **Power Measurements Toggle**: Users can disable 9 power-related capabilities via device settings
- **Cleaner Interface**: Disable irrelevant capabilities for devices without power monitoring
- **Dynamic Management**: Capabilities added/removed based on user preferences
- **Flow Card Integration**: Power capability visibility automatically manages related flow card settings

#### Error Handling Integration (v0.92.4+)
- **TuyaErrorCategorizer**: Structured error categorization for capability communication failures
- **Smart Recovery**: Automatic retry for recoverable capability errors with appropriate delays
- **User-Friendly Messages**: Clear error explanations when capabilities fail to update
- **Context-Aware Handling**: Different recovery strategies based on error type and capability importance

#### User-Facing Diagnostics
- **Diagnostic Reports**: Generate detailed capability health reports via device settings
- **Health-Based Reporting**: Unhealthy capabilities prioritized at top of diagnostic reports
- **Real-time Monitoring**: Health status updates every 2 minutes during operation
- **Troubleshooting Support**: Clear identification of sensor connectivity issues
- **Flow Card Integration**: Health status controls flow card availability in "auto" mode

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

This comprehensive system ensures robust operation even when some capabilities are unavailable due to firmware variations, hardware limitations, or connectivity issues, while providing complete user control over capability visibility and automation complexity.