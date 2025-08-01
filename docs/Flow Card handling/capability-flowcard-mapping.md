# Adlar Heat Pump - Capability to Flow Card Mapping

This document provides a comprehensive mapping between device capabilities and their corresponding flow cards, showing how each capability can be used in Homey flows.

## Mapping Overview

- **Total Capabilities**: 41 (14 custom Adlar + 27 standard Homey)
- **Total Flow Cards**: 38 (30 triggers, 9 actions, 9 conditions)
- **Capabilities with Flow Cards**: 28
- **Capabilities without Flow Cards**: 13 (mostly measurement sensors)
- **Flow Cards without Direct Capability Mapping**: 10 (complex triggers)
- **Dynamic Registration**: Flow cards adapt to capability health status (v0.70.0+)
- **Pattern-Based System**: Consistent behavior across similar flow cards

---

## Core Control Capabilities

### onoff → Flow Cards
**Capability**: `onoff` (DPS 1)
- **Action**: `set_device_onoff` 🔥
  - **Purpose**: Power control (On/Off)
  - **Type**: Essential control
  - **Usage**: Basic system power management, emergency shutdown

### target_temperature → Flow Cards  
**Capability**: `target_temperature` (DPS 4)  
- **Action**: `set_target_temperature` 🔥
  - **Purpose**: Temperature setpoint control (5-60°C)
  - **Type**: Essential control
  - **Usage**: Comfort control, weather compensation

### adlar_hotwater → Flow Cards
**Capability**: `adlar_hotwater` (DPS 101)
- **Action**: `set_hotwater_temperature` 🔥
  - **Purpose**: Hot water temperature control (30-75°C)
  - **Type**: Essential control  
  - **Usage**: Domestic hot water management, legionella prevention

---

## Mode & Configuration Capabilities

### adlar_enum_mode → Flow Cards
**Capability**: `adlar_enum_mode` (DPS 2)
- **Action**: `set_heating_mode` 🔥
  - **Purpose**: Operational mode selection
  - **Values**: cold, heating, floor_heating, hot_water, combined modes
  - **Type**: Essential control
  - **Usage**: Seasonal mode switching, demand-based operation

### adlar_enum_work_mode → Flow Cards
**Capability**: `adlar_enum_work_mode` (DPS 5)
- **Action**: `set_work_mode` 🔥
  - **Purpose**: Performance mode control
  - **Values**: ECO/Normal/Boost
  - **Type**: Advanced control
  - **Usage**: Efficiency optimization, demand response

### adlar_enum_countdown_set → Flow Cards
**Capability**: `adlar_enum_countdown_set` (DPS 13)
- **Action**: `set_heating_curve`
  - **Purpose**: Weather compensation curves
  - **Values**: OFF, H1-H8 (high), L1-L8 (low)
  - **Type**: Advanced control
  - **Usage**: Seasonal adaptation, building-specific tuning

### adlar_enum_capacity_set → Flow Cards
**Capability**: `adlar_enum_capacity_set` (DPS 11)
- **Action**: `set_capacity`
  - **Purpose**: Hot water curve setting
  - **Values**: OFF, H1-H4
  - **Type**: Advanced control
  - **Usage**: Hot water demand optimization

### adlar_enum_water_mode → Flow Cards
**Capability**: `adlar_enum_water_mode` (DPS 10)
- **Action**: `set_water_mode`
  - **Purpose**: Water control mode (0-1)
  - **Type**: Expert configuration
  - **Usage**: Installation configuration, control system tuning

### adlar_enum_volume_set → Flow Cards
**Capability**: `adlar_enum_volume_set` (DPS 106)
- **Action**: `set_volume`
  - **Purpose**: Electricity consumption monitoring level (0-2)
  - **Type**: Expert configuration
  - **Usage**: Power monitoring configuration

---

## Status & Monitoring Capabilities

### adlar_fault → Flow Cards
**Capability**: `adlar_fault` (DPS 15)
- **Trigger**: `fault_detected` 🔥
  - **Purpose**: System fault detection with fault codes
  - **Tokens**: fault_code (0-30), fault_description
  - **Type**: Essential monitoring
- **Condition**: `fault_active` 🔥
  - **Purpose**: System fault status check
  - **Type**: Essential monitoring
  - **Usage**: Safety interlocks, maintenance alerts

### adlar_state_compressor_state → Flow Cards
**Capability**: `adlar_state_compressor_state` (DPS 27)
- **Trigger**: `compressor_state_changed` 🔥
  - **Purpose**: Monitor compressor on/off state changes
  - **Tokens**: compressor_state (boolean)
  - **Type**: Essential monitoring
- **Condition**: `compressor_running` 🔥
  - **Purpose**: Real-time compressor status check
  - **Type**: Essential monitoring
  - **Usage**: Flow control based on compressor state

### adlar_state_defrost_state → Flow Cards
**Capability**: `adlar_state_defrost_state` (DPS 33)
- **Trigger**: `defrost_state_changed` 🔥
  - **Purpose**: Track defrost cycle activation/deactivation
  - **Tokens**: defrost_state (boolean)
  - **Type**: Essential monitoring
  - **Usage**: Winter operation monitoring, performance optimization

### adlar_state_backwater → Flow Cards
**Capability**: `adlar_state_backwater` (DPS 31)
- **Trigger**: `backwater_state_changed`
  - **Purpose**: Backwater flow monitoring
  - **Tokens**: backwater_state (boolean)
  - **Type**: Essential monitoring
  - **Usage**: System circulation monitoring

### adlar_countdowntimer → Flow Cards
**Capability**: `adlar_countdowntimer` (DPS 14)
- **Trigger**: `countdown_timer_finished`
  - **Purpose**: System timer completion
  - **Tokens**: timer_duration, completion_time
  - **Type**: Advanced monitoring
  - **Usage**: Scheduled operations, maintenance reminders

---

## Temperature Measurement Capabilities

### measure_temperature.around_temp → Flow Cards
**Capability**: `measure_temperature.around_temp` (DPS 26)
- **Trigger**: `ambient_temperature_changed`
  - **Purpose**: Weather compensation trigger (-30°C to 50°C)
  - **Tokens**: temperature
  - **Type**: Essential monitoring
- **Condition**: `temperature_above` 🔥
  - **Purpose**: Ambient temperature comparison
  - **Type**: Essential monitoring
  - **Usage**: Weather-based flow control

### measure_temperature.temp_top → Flow Cards
**Capability**: `measure_temperature.temp_top` (DPS 21)
- **Trigger**: `inlet_temperature_changed`
  - **Purpose**: Water inlet temperature monitoring (-20°C to 80°C)
  - **Tokens**: temperature
  - **Type**: Essential monitoring
  - **Usage**: System performance monitoring

### measure_temperature.temp_bottom → Flow Cards
**Capability**: `measure_temperature.temp_bottom` (DPS 22)
- **Trigger**: `outlet_temperature_changed`
  - **Purpose**: Water outlet temperature monitoring (-20°C to 80°C)
  - **Tokens**: temperature
  - **Type**: Essential monitoring
  - **Usage**: Performance monitoring, zone control

### Individual Temperature Sensor Alerts
Multiple temperature sensors have dedicated alert triggers:

- **measure_temperature.coiler_temp** (DPS 23) → `coiler_temperature_alert`
- **measure_temperature.venting_temp** (DPS 24) → `discharge_temperature_alert`
- **measure_temperature.coiler_temp_f** (DPS 41) → `suction_temperature_alert`
- **measure_temperature.temp_current_f** (DPS 35) → `high_pressure_temperature_alert`
- **measure_temperature.top_temp_f** (DPS 36) → `low_pressure_temperature_alert`
- **measure_temperature.around_temp_f** (DPS 38) → `tank_temperature_alert`
- **measure_temperature.bottom_temp_f** (DPS 37) → `incoiler_temperature_alert`
- **measure_temperature.evlin** (DPS 107) → `economizer_inlet_temperature_alert`
- **measure_temperature.eviout** (DPS 108) → `economizer_outlet_temperature_alert`

**Common Properties**:
- **Range**: -20°C to 80°C (0.5°C steps)
- **Args**: threshold (temperature), above_or_below (boolean)
- **Tokens**: current_temperature, threshold_temperature
- **Type**: Advanced monitoring
- **Usage**: Performance optimization, predictive maintenance

---

## Power & Electrical Capabilities

### measure_power → Flow Cards ⚡
**Capability**: `measure_power` (DPS 104)
- **Trigger**: `power_threshold_exceeded`
  - **Purpose**: Real-time power monitoring (100-10,000W)
  - **Tokens**: current_power, threshold_power
  - **Type**: Advanced monitoring
- **Condition**: `power_above_threshold`
  - **Purpose**: Power consumption comparison
  - **Type**: Advanced monitoring
  - **Usage**: Load management, cost control
- **Note**: Requires power monitoring support

### meter_power.power_consumption → Flow Cards ⚡
**Capability**: `meter_power.power_consumption` (DPS 18)
- **Trigger**: `daily_consumption_threshold`
  - **Purpose**: Daily usage tracking (1-100 kWh)
  - **Tokens**: daily_consumption, threshold_consumption
  - **Type**: Advanced monitoring
  - **Usage**: Energy budget management

### meter_power.electric_total → Flow Cards ⚡
**Capability**: `meter_power.electric_total` (DPS 105)
- **Trigger**: `total_consumption_milestone`
  - **Purpose**: Lifetime consumption milestones (100-50,000 kWh)
  - **Tokens**: total_consumption, milestone_consumption
  - **Type**: Advanced monitoring
- **Condition**: `total_consumption_above`
  - **Purpose**: Total energy usage comparison
  - **Type**: Advanced monitoring
  - **Usage**: Maintenance scheduling, ROI tracking

### Voltage Measurement Capabilities ⚡
- **measure_voltage.voltage_current** (DPS 103) → `phase_a_voltage_alert`
- **measure_voltage.bv** (DPS 111) → `phase_b_voltage_alert`
- **measure_voltage.cv** (DPS 112) → `phase_c_voltage_alert`

**Common Properties**:
- **Range**: 180-260V (1V steps)
- **Type**: Expert monitoring
- **Usage**: Electrical system diagnostics, grid monitoring

### Current Measurement Capabilities ⚡
- **measure_current.b_cur** (DPS 109) → `phase_b_current_alert`
- **measure_current.c_cur** (DPS 110) → `phase_c_current_alert`

**Common Properties**:
- **Range**: 1-50A (0.1A steps)
- **Type**: Expert monitoring
- **Usage**: Load balancing, overcurrent protection

---

## Frequency & Efficiency Capabilities

### measure_frequency.compressor_strength → Flow Cards
**Capability**: `measure_frequency.compressor_strength` (DPS 20)
- **Trigger**: `compressor_efficiency_alert`
  - **Purpose**: Compressor frequency monitoring (10-200 Hz)
  - **Tokens**: current_frequency, threshold_frequency
  - **Type**: Advanced monitoring
  - **Usage**: Performance optimization, wear monitoring

### measure_frequency.fan_motor_frequency → Flow Cards
**Capability**: `measure_frequency.fan_motor_frequency` (DPS 40)
- **Trigger**: `fan_motor_efficiency_alert`
  - **Purpose**: Fan performance monitoring (10-200 Hz)
  - **Tokens**: current_frequency, threshold_frequency
  - **Type**: Advanced monitoring
  - **Usage**: Airflow optimization, maintenance scheduling

---

## Valve Position Measurement Capabilities

### adlar_measure_pulse_steps_temp_current → Flow Cards
**Capability**: `adlar_measure_pulse_steps_temp_current` (DPS 16)
- **Trigger**: `eev_pulse_steps_alert`
  - **Purpose**: Electronic expansion valve position monitoring
  - **Range**: 0 to 480 Pulse-steps (10 pulse steps)
  - **Type**: Expert monitoring
  - **Usage**: Valve position and refrigeration system diagnostics

### adlar_measure_pulse_steps_effluent_temp → Flow Cards
**Capability**: `adlar_measure_pulse_steps_effluent_temp` (DPS 25)
- **Trigger**: `evi_pulse_steps_alert`
  - **Purpose**: Economizer injection valve position monitoring
  - **Range**: 0 to 480 Pulse-steps (10 pulse steps)
  - **Type**: Expert monitoring
  - **Usage**: EVI valve position and system performance monitoring

---

## Water Flow Capability

### measure_water → Flow Cards
**Capability**: `measure_water` (DPS 39)
- **Trigger**: `water_flow_alert`
  - **Purpose**: Water circulation monitoring
  - **Type**: Advanced monitoring
  - **Usage**: Flow rate monitoring, circulation system diagnostics

---

## Complex Flow Cards (No Direct Capability Mapping)

These flow cards combine multiple capabilities or provide advanced system analysis:

### Advanced Conditions
- **temperature_differential**
  - **Purpose**: Inlet/outlet temperature difference (1-50°C)
  - **Combines**: `measure_temperature.temp_top` + `measure_temperature.temp_bottom`
  - **Usage**: System efficiency monitoring

- **water_flow_rate_check**
  - **Purpose**: Flow rate monitoring (1-100 L/min)
  - **Uses**: `measure_water` capability
  - **Usage**: Circulation system monitoring

- **electrical_balance_check** ⚡
  - **Purpose**: 3-phase electrical balance (1-20% tolerance)
  - **Combines**: All voltage and current measurements
  - **Usage**: Professional electrical diagnostics

- **system_pulse_steps_differential**
  - **Purpose**: EEV/EVI pulse-steps difference (0-480 Pulse-steps)
  - **Combines**: Both valve position measurement capabilities
  - **Usage**: Valve synchronization and refrigeration system diagnostics

### Advanced Triggers
- **electrical_load_alert** ⚡
  - **Purpose**: Overall electrical system monitoring
  - **Combines**: Multiple electrical measurements
  - **Usage**: Professional diagnostics, electrical balance

---

## Capabilities Without Flow Cards

The following capabilities provide sensor data but don't have dedicated flow cards:

### Temperature Sensors (No Individual Flow Cards)
These sensors provide data for combined alerts and system monitoring:
- **measure_temperature.temp_current_f** (DPS 35) - Used in high_pressure_temperature_alert
- **measure_temperature.top_temp_f** (DPS 36) - Used in low_pressure_temperature_alert  
- **measure_temperature.bottom_temp_f** (DPS 37) - Used in incoiler_temperature_alert
- **measure_temperature.around_temp_f** (DPS 38) - Used in tank_temperature_alert
- **measure_temperature.coiler_temp_f** (DPS 41) - Used in suction_temperature_alert
- **measure_temperature.evlin** (DPS 107) - Used in economizer_inlet_temperature_alert
- **measure_temperature.eviout** (DPS 108) - Used in economizer_outlet_temperature_alert

### Electrical Measurements (Limited Flow Cards)
- **measure_current.cur_current** (DPS 102) - Phase A current (no individual flow card)
- **measure_voltage.voltage_current** (DPS 103) - Phase A voltage (has phase_a_voltage_alert)

**Note**: These are accessible through the electrical_load_alert and electrical_balance_check flow cards.

---

## Usage Recommendations

### Essential Flow Cards (Highlighted 🔥)
Start with these 8 highlighted flow cards for basic heat pump automation:
1. **set_device_onoff** - Power control
2. **set_target_temperature** - Temperature control
3. **set_hotwater_temperature** - Hot water control
4. **set_heating_mode** - Mode selection
5. **set_work_mode** - Efficiency control
6. **compressor_state_changed** - System monitoring
7. **defrost_state_changed** - Winter operation
8. **fault_detected** - Safety monitoring

### Progressive Implementation
1. **Basic Control**: Use highlighted actions for fundamental control
2. **Status Monitoring**: Add highlighted triggers for system awareness
3. **Temperature Management**: Implement temperature-based triggers and conditions
4. **Energy Management**: Add power monitoring flow cards (if supported)
5. **Advanced Diagnostics**: Implement expert-level monitoring for professional installations

### Power Management Compatibility
Always check device compatibility before using power management flow cards (marked with ⚡). These require hardware support for electrical measurements.

### Best Practices
1. **Combine multiple conditions** for robust automation
2. **Use hysteresis** in temperature-based flows to prevent oscillation
3. **Implement progressive efficiency** (ECO → Normal → Boost)
4. **Include fault conditions** in all critical automation flows
5. **Monitor trends** rather than absolute values for efficiency analysis

## Dynamic Flow Card Management (v0.70.0+)

The app features intelligent flow card management that adapts to device capabilities and sensor health:

### Health-Aware Flow Cards

- **Automatic Detection**: Flow cards only appear for capabilities with healthy sensor data
- **Real-time Updates**: Flow card availability updates based on sensor health status
- **Fallback Handling**: Flow handlers provide fallback values when sensor data is temporarily unavailable

### User Control Settings

- **Auto Mode**: Flow cards automatically appear/disappear based on sensor health
- **Force Enabled**: All flow cards available regardless of sensor status
- **Disabled**: Flow cards completely disabled for the category

### Capability Health Monitoring

- **Health Tracking**: Monitors null values and data availability for all capabilities
- **Diagnostic Reports**: Generate comprehensive capability health reports
- **Troubleshooting**: Clear identification of sensor connectivity issues

This intelligent system ensures robust automation even when some sensors are unavailable while providing transparency about system health.

---

This mapping provides the foundation for creating sophisticated heat pump automation flows, from basic comfort control to advanced system optimization and professional diagnostics.
