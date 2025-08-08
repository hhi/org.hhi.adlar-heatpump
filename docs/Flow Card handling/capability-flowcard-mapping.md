# Adlar Heat Pump - Capability to Flow Card Mapping

This document provides a comprehensive mapping between device capabilities and their corresponding flow cards, showing how each capability can be used in Homey flows.

## Mapping Overview

- **Total Capabilities**: 41 (14 custom Adlar + 27 standard Homey)
- **Total Flow Cards**: 58 (31 triggers, 9 actions, 18 conditions) - **Updated v0.90.0**
- **Capabilities with Flow Cards**: 37 (+9 action-based condition cards)
- **Capabilities without Flow Cards**: 4 (reduced from 13)
- **Flow Cards without Direct Capability Mapping**: 10 (complex triggers)
- **Dynamic Registration**: Flow cards adapt to capability health status (v0.70.0+)
- **Pattern-Based System**: Consistent behavior across similar flow cards
- **Bidirectional Control**: Complete read/write access via action-based conditions (v0.80.0+)
- **Reliable Control**: All capability listener and flow action issues resolved (v0.90.0+)

---

## Core Control Capabilities

### onoff → Flow Cards
**Capability**: `onoff` (DPS 1)
- **Action**: `set_device_onoff` 🔥
  - **Purpose**: Power control (On/Off)
  - **Type**: Essential control
  - **Usage**: Basic system power management, emergency shutdown
- **Condition**: `device_power_is` ⭐ **NEW v0.80.0**
  - **Purpose**: Check current device power state
  - **Arguments**: Power state (on/off)
  - **Usage**: Conditional logic based on device power state, prevent conflicting commands

### target_temperature → Flow Cards  
**Capability**: `target_temperature` (DPS 4)  
- **Action**: `set_target_temperature` 🔥
  - **Purpose**: Temperature setpoint control (5-60°C)
  - **Type**: Essential control
  - **Usage**: Comfort control, weather compensation
- **Condition**: `target_temperature_is` ⭐ **NEW v0.80.0**
  - **Purpose**: Compare current target temperature setting
  - **Arguments**: Comparison (equal/greater/less), Temperature (5-60°C, 0.5°C steps)
  - **Usage**: Temperature-based flow control, dynamic temperature management

### adlar_hotwater → Flow Cards
**Capability**: `adlar_hotwater` (DPS 101)
- **Action**: `set_hotwater_temperature` 🔥
  - **Purpose**: Hot water temperature control (30-75°C)
  - **Type**: Essential control  
  - **Usage**: Domestic hot water management, legionella prevention
- **Condition**: `hotwater_temperature_is` ⭐ **NEW v0.80.0**
  - **Purpose**: Compare current hot water temperature setting
  - **Arguments**: Comparison (equal/greater/less), Temperature (30-75°C, 1°C steps)
  - **Usage**: Hot water optimization flows, energy-efficient management

---

## Mode & Configuration Capabilities

### adlar_enum_mode → Flow Cards
**Capability**: `adlar_enum_mode` (DPS 2)
- **Action**: `set_heating_mode` 🔥
  - **Purpose**: Operational mode selection
  - **Values**: cold, heating, floor_heating, hot_water, combined modes
  - **Type**: Essential control
  - **Usage**: Seasonal mode switching, demand-based operation
- **Condition**: `heating_mode_is` ⭐ **NEW v0.80.0**
  - **Purpose**: Check current heating mode setting
  - **Arguments**: Mode (cold/heating/floor_heating/hot_water/combined modes)
  - **Usage**: Mode-dependent automation, seasonal mode transitions

### adlar_enum_work_mode → Flow Cards
**Capability**: `adlar_enum_work_mode` (DPS 5)
- **Action**: `set_work_mode` 🔥
  - **Purpose**: Performance mode control
  - **Values**: ECO/Normal/Boost
  - **Type**: Advanced control
  - **Usage**: Efficiency optimization, demand response
- **Condition**: `work_mode_is` ⭐ **NEW v0.80.0**
  - **Purpose**: Check current work mode setting
  - **Arguments**: Mode (ECO/Normal/Boost)
  - **Usage**: Performance optimization flows, dynamic efficiency management

### adlar_enum_countdown_set → Flow Cards
**Capability**: `adlar_enum_countdown_set` (DPS 13)
- **Action**: `set_heating_curve`
  - **Purpose**: Weather compensation curves
  - **Values**: OFF, H1-H8 (high), L1-L8 (low)
  - **Type**: Advanced control
  - **Usage**: Seasonal adaptation, building-specific tuning
- **Condition**: `heating_curve_is` ⭐ **NEW v0.80.0**
  - **Purpose**: Check current heating curve setting
  - **Arguments**: Curve (OFF/H1-H8/L1-L8)
  - **Usage**: Curve-based heating optimization, weather-dependent curve adjustments

### adlar_enum_capacity_set → Flow Cards
**Capability**: `adlar_enum_capacity_set` (DPS 11)
- **Action**: `set_capacity`
  - **Purpose**: Hot water curve setting
  - **Values**: OFF, H1-H4
  - **Type**: Advanced control
  - **Usage**: Hot water demand optimization
- **Condition**: `capacity_setting_is` ⭐ **NEW v0.80.0**
  - **Purpose**: Check current hot water curve setting
  - **Arguments**: Capacity (OFF/H1/H2/H3/H4)
  - **Usage**: Capacity-dependent automation, load-based capacity adjustments

### adlar_enum_water_mode → Flow Cards
**Capability**: `adlar_enum_water_mode` (DPS 10)
- **Action**: `set_water_mode`
  - **Purpose**: Water control mode (0-1)
  - **Type**: Expert configuration
  - **Usage**: Installation configuration, control system tuning
- **Condition**: `water_mode_is` ⭐ **NEW v0.80.0**
  - **Purpose**: Compare current water control mode setting
  - **Arguments**: Comparison (equal/greater/less), Mode (0-1)
  - **Usage**: Water control optimization, flow rate management

### adlar_enum_volume_set → Flow Cards
**Capability**: `adlar_enum_volume_set` (DPS 106)
- **Action**: `set_volume`
  - **Purpose**: Electricity consumption monitoring level (0-2)
  - **Type**: Expert configuration
  - **Usage**: Power monitoring configuration
- **Condition**: `volume_setting_is` ⭐ **NEW v0.80.0**
  - **Purpose**: Compare current electricity consumption checking level
  - **Arguments**: Comparison (equal/greater/less), Level (0-2)
  - **Usage**: Power monitoring management, dynamic monitoring level adjustment

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

## Dynamic Flow Card Management (v0.70.0+ / Enhanced v0.92.4+)

The app features intelligent flow card management that adapts to device capabilities and sensor health with comprehensive user control:

### Three-Mode Control System (v0.92.4+)

Each flow card category can be individually controlled via device settings:

**Control Categories:**
- `flow_temperature_alerts` - Temperature-related flow cards (11 alerts + conditions)
- `flow_voltage_alerts` - Voltage monitoring flow cards (3 phase alerts)
- `flow_current_alerts` - Current monitoring flow cards (3 phase alerts)
- `flow_power_alerts` - Power consumption flow cards (3 energy triggers)
- `flow_pulse_steps_alerts` - Valve position flow cards (2 valve alerts)
- `flow_state_alerts` - System state change flow cards (5 state triggers)
- `flow_expert_mode` - Advanced diagnostic flow cards (3 expert conditions)

**Mode Behaviors:**
- **`disabled`**: No flow cards for this category - Clean interface, unused sensors
- **`auto`**: Show only for healthy capabilities with data - **Default** reliable alerts
- **`enabled`**: Force all capability flow cards active - Safety critical, troubleshooting

### Health-Aware Registration Logic

```typescript
// Auto mode registration decision
shouldRegisterCategory(category, userSetting, availableCaps, healthyData) {
  switch (userSetting) {
    case 'disabled': return false;
    case 'enabled':  return availableCaps.length > 0;
    case 'auto':     return availableCaps.length > 0 
                     && availableCaps.some(cap => healthyData.includes(cap));
  }
}
```

### Practical Examples

**Temperature Alerts - `flow_temperature_alerts = "enabled"`:**
- ✅ All 8 temperature alert triggers become available
- ✅ Critical safety monitoring active (> 80°C, < -20°C)
- ✅ Configurable threshold alerts for all sensors
- ✅ `temperature_above` condition card available

**Power Management - Cascade Logic:**
- When `enable_power_measurements = false`:
  - Auto-disables `flow_power_alerts`, `flow_voltage_alerts`, `flow_current_alerts`
- When `enable_power_measurements = true`:
  - Resets related flow settings to `auto` mode

### Capability Health Detection

- **Health Criteria**: Recent data (< 5 minutes), < 10 consecutive null values
- **Real-time Monitoring**: Health checks every 2 minutes via background task
- **Diagnostic Integration**: Health status visible in capability diagnostics report

### User Interface Access

**Device Settings → Flow Card Controls (restart advised):**
- **Dropdown Controls**: disabled/auto/enabled for each category
- **Expert Mode Toggle**: Single checkbox for diagnostic cards
- **Live Updates**: Changes apply immediately with deferred settings management
- **Clear Labels**: Restart guidance where needed

This intelligent system provides complete control over flow card complexity while maintaining safety monitoring and automation reliability.

---

This mapping provides the foundation for creating sophisticated heat pump automation flows, from basic comfort control to advanced system optimization and professional diagnostics.
