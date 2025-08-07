# Adlar Heat Pump - Flow Cards Overview

This document provides a comprehensive overview of all flow cards available in the Adlar Heat Pump app, categorized by type, tier, and use case.

## Summary Statistics

- **Total Flow Cards**: 58 (Updated v0.90.3)
- **Triggers**: 31
- **Actions**: 9  
- **Conditions**: 18 (+9 action-based conditions in v0.80.0)
- **Highlighted Cards**: 8 (essential for basic operation)
- **Power Management Dependent**: 6 cards (now optional via settings)
- **Languages Supported**: English (EN) and Dutch (NL)
- **Pattern-Based Registration**: Intelligent pattern-based system + always-available action-based conditions
- **Health-Aware**: Dynamic registration based on capability health (v0.70.0+)
- **Bidirectional Control**: Complete read/write access to all controllable settings (v0.80.0+)
- **Fixed Control Issues**: All capability listener and flow card control issues resolved (v0.90.0+)
- **Enhanced Communication**: Flow ACTION cards now use triggerCapabilityListener() for reliable device control (v0.90.3+)

## Flow Card Categories

### Essential Tier
Basic system monitoring and control for everyday use. These cards provide fundamental heat pump operation awareness and control capabilities.

### Advanced Tier  
Performance optimization, energy management, and efficiency monitoring. These cards enable predictive maintenance and advanced automation strategies.

### Expert Tier
Technical diagnostics and professional-grade monitoring. These cards provide deep system insights for installers and advanced users.

---

## TRIGGERS (20 cards)

### Essential Tier - Basic System Monitoring (7 cards)

#### 🔥 **compressor_state_changed** (Highlighted)
- **Purpose**: Monitor compressor on/off state changes
- **Use Case**: Basic system status monitoring, efficiency tracking
- **Tokens**: `compressor_state` (boolean)
- **Advanced Flow**: Use with delay to detect short cycling issues
- **Tier Rationale**: Core system component monitoring

#### 🔥 **defrost_state_changed** (Highlighted) 
- **Purpose**: Track defrost cycle activation/deactivation
- **Use Case**: Winter operation monitoring, performance optimization
- **Tokens**: `defrost_state` (boolean)
- **Advanced Flow**: Combine with ambient temperature for defrost efficiency analysis
- **Tier Rationale**: Critical for winter operation awareness

#### 🔥 **fault_detected** (Highlighted)
- **Purpose**: System fault detection with fault codes
- **Use Case**: System diagnostics, maintenance alerts
- **Tokens**: `fault_code` (number 0-30), `fault_description` (text)
- **Advanced Flow**: Create fault code lookup table for specific actions
- **Tier Rationale**: Essential for system health monitoring

#### **ambient_temperature_changed**
- **Purpose**: Weather compensation trigger
- **Range**: -30°C to 50°C (0.5°C steps)
- **Use Case**: Weather-based heating adjustments
- **Tokens**: `temperature` (number)
- **Advanced Flow**: Use for automatic heating curve adjustments
```
WHEN ambient_temperature_changed below 0°C
THEN set_heating_curve to H6
```

#### **inlet_temperature_changed**
- **Purpose**: Water inlet temperature monitoring
- **Range**: -20°C to 80°C (0.5°C steps)
- **Use Case**: System performance monitoring
- **Tokens**: `temperature` (number)
- **Advanced Flow**: Compare with outlet for efficiency calculation

#### **outlet_temperature_changed** 
- **Purpose**: Water outlet temperature monitoring
- **Range**: -20°C to 80°C (0.5°C steps)
- **Use Case**: Performance monitoring, zone control
- **Tokens**: `temperature` (number)
- **Advanced Flow**: Use for multi-zone temperature control

#### **backwater_state_changed**
- **Purpose**: Backwater flow monitoring
- **Use Case**: System circulation monitoring
- **Tokens**: `backwater_state` (boolean)
- **Advanced Flow**: Combine with other system states for diagnostic flows

### Advanced Tier - Performance & Efficiency (12 cards)

#### **Temperature Alert Triggers (6 cards)**
All temperature alerts follow similar patterns with customizable thresholds:

- **coiler_temperature_alert** - Evaporator temperature monitoring
- **discharge_temperature_alert** - Compressor discharge monitoring  
- **suction_temperature_alert** - Compressor suction monitoring
- **high_pressure_temperature_alert** - High-side temperature monitoring
- **low_pressure_temperature_alert** - Low-side temperature monitoring
- **tank_temperature_alert** - Hot water tank monitoring

**Common Properties**:
- **Range**: -20°C to 80°C (0.5°C steps)
- **Args**: `threshold` (temperature), `above_or_below` (boolean)
- **Tokens**: `current_temperature`, `threshold_temperature`
- **Advanced Flow**: Create temperature deviation alerts
```
WHEN coiler_temperature_alert above 60°C
AND compressor_running is true  
THEN send notification "High evaporator temperature detected"
```

#### **System Efficiency Triggers (2 cards)**

##### **compressor_efficiency_alert**
- **Purpose**: Compressor frequency monitoring
- **Range**: 10-200 Hz (5 Hz steps)
- **Use Case**: Performance optimization, wear monitoring
- **Tokens**: `current_frequency`, `threshold_frequency`
- **Advanced Flow**: Detect compressor strain conditions
```
WHEN compressor_efficiency_alert above 150 Hz
AND ambient_temperature_changed above -5°C
THEN set_work_mode to ECO
```

##### **fan_motor_efficiency_alert**
- **Purpose**: Fan performance monitoring  
- **Range**: 10-200 Hz (5 Hz steps)
- **Use Case**: Airflow optimization, maintenance scheduling
- **Tokens**: `current_frequency`, `threshold_frequency`

#### **Energy Management Triggers (3 cards)**

##### **power_threshold_exceeded** ⚡ *Requires Power Monitoring*
- **Purpose**: Real-time power monitoring
- **Range**: 100-10,000W (100W steps)
- **Use Case**: Load management, cost control
- **Tokens**: `current_power`, `threshold_power`
- **Advanced Flow**: Dynamic load shedding
```
WHEN power_threshold_exceeded 3000W
AND time is between 17:00-19:00
THEN set_work_mode to ECO
```

##### **daily_consumption_threshold** ⚡ *Requires Power Monitoring*
- **Purpose**: Daily usage tracking
- **Range**: 1-100 kWh (0.5 kWh steps)
- **Use Case**: Energy budget management
- **Tokens**: `daily_consumption`, `threshold_consumption`

##### **total_consumption_milestone** ⚡ *Requires Power Monitoring*
- **Purpose**: Lifetime consumption milestones
- **Range**: 100-50,000 kWh (100 kWh steps)
- **Use Case**: Maintenance scheduling, ROI tracking
- **Tokens**: `total_consumption`, `milestone_consumption`

#### **Operational Triggers (1 card)**

##### **countdown_timer_finished**
- **Purpose**: System timer completion
- **Use Case**: Scheduled operations, maintenance reminders
- **Tokens**: `timer_duration`, `completion_time`

### Expert Tier - Technical Diagnostics (11 cards)

#### **Electrical System Monitoring (6 cards)**

##### **electrical_load_alert**
- **Purpose**: Overall electrical system monitoring
- **Use Case**: Professional diagnostics, electrical balance
- **Advanced Flow**: Three-phase imbalance detection

##### **Voltage Alert Triggers (3 cards)**
- **phase_a_voltage_alert** - Phase A voltage monitoring
- **phase_b_voltage_alert** - Phase B voltage monitoring  
- **phase_c_voltage_alert** - Phase C voltage monitoring

**Common Properties**:
- **Range**: 180-260V (1V steps)
- **Use Case**: Electrical system diagnostics, grid monitoring
- **Advanced Flow**: Create electrical imbalance alerts

##### **Current Alert Triggers (2 cards)**
- **phase_b_current_alert** - Phase B current monitoring
- **phase_c_current_alert** - Phase C current monitoring

**Common Properties**:
- **Range**: 1-50A (0.1A steps)
- **Use Case**: Load balancing, overcurrent protection

#### **Refrigeration System Monitoring (5 cards)**

##### **Pulse-Steps Alerts (2 cards)**
- **eev_pulse_steps_alert** - Electronic expansion valve pulse-steps
- **evi_pulse_steps_alert** - Economizer injection valve pulse-steps

**Common Properties**:
- **Range**: 0 to 480 Pulse-steps (10 pulse steps)
- **Use Case**: Valve position monitoring and refrigeration system diagnostics
- **Advanced Flow**: Refrigerant system health monitoring

##### **Economizer Temperature Alerts (2 cards)**
- **economizer_inlet_temperature_alert** - Economizer inlet monitoring
- **economizer_outlet_temperature_alert** - Economizer outlet monitoring

**Common Properties**:
- **Range**: -20°C to 80°C (0.5°C steps)
- **Use Case**: EVI system performance monitoring

##### **incoiler_temperature_alert**
- **Purpose**: Internal coil temperature monitoring
- **Range**: -20°C to 80°C (0.5°C steps)
- **Use Case**: Advanced thermal diagnostics

---

## ACTIONS (9 cards)

### Essential Tier - Basic Control (3 cards)

#### 🔥 **set_device_onoff** (Highlighted)
- **Purpose**: Power control
- **Values**: On/Off (boolean)
- **Use Case**: Basic system control, emergency shutdown
- **Advanced Flow**: Combine with multiple conditions for safety shutdowns
```
WHEN fault_active is true
OR power_above_threshold 8000W
THEN set_device_onoff to off
```

#### 🔥 **set_target_temperature** (Highlighted)
- **Purpose**: Temperature setpoint control
- **Range**: 5-60°C (0.5°C steps)
- **Use Case**: Comfort control, weather compensation
- **Advanced Flow**: Dynamic temperature adjustment based on conditions
```
WHEN ambient_temperature_changed below -10°C
THEN set_target_temperature to [[current_temperature + 2]]°C
```

#### 🔥 **set_hotwater_temperature** (Highlighted)
- **Purpose**: Hot water temperature control
- **Range**: 30-75°C (1°C steps)
- **Use Case**: Domestic hot water management, legionella prevention
- **Advanced Flow**: Schedule-based temperature control
```
WHEN time is 23:00
THEN set_hotwater_temperature to 65°C (legionella prevention)
```

### Advanced Tier - Mode & Efficiency Control (4 cards)

#### 🔥 **set_heating_mode** (Highlighted)
- **Purpose**: Operational mode selection
- **Values**: 
  - `cold` (Cold/Koud)
  - `heating` (Heating/Verwarmen)
  - `floor_heating` (Floor heating/Vloerverwarming)
  - `hot_water` (Hot water/Warm water)
  - `cold_and_hotwater` (Cold and hot water/Koud en warm water)
  - `heating_and_hot_water` (Heating and hot water/Verwarmen en warm water)
  - `floor_heatign_and_hot_water` (Floor heating and hot water/Vloerverwarming en warm water)
- **Use Case**: Seasonal mode switching, demand-based operation
- **Advanced Flow**: Automatic seasonal switching
```
WHEN ambient_temperature_changed above 20°C for 3 days
THEN set_heating_mode to cold_and_hotwater
```

#### 🔥 **set_work_mode** (Highlighted)
- **Purpose**: Performance mode control
- **Values**: ECO/Normal/Boost
- **Use Case**: Efficiency optimization, demand response
- **Advanced Flow**: Dynamic efficiency adjustment
```
WHEN power_above_threshold 4000W
AND time is between 17:00-20:00
THEN set_work_mode to ECO
```

#### **set_heating_curve**
- **Purpose**: Weather compensation curves
- **Values**: OFF, H1-H8 (high), L1-L8 (low)
- **Use Case**: Seasonal adaptation, building-specific tuning
- **Advanced Flow**: Automatic curve adjustment based on weather
```
WHEN ambient_temperature_changed below -5°C
THEN set_heating_curve to H6
```

#### **set_capacity**
- **Purpose**: Hot water curve setting
- **Values**: OFF, H1-H4
- **Use Case**: Hot water demand optimization
- **Advanced Flow**: Usage pattern-based adjustment

### Expert Tier - System Configuration (2 cards)

#### **set_water_mode** ⚡ 
- **Purpose**: Water control mode
- **Range**: 0-1 (integer steps)
- **Use Case**: Installation configuration, control system tuning
- **Advanced Flow**: System commissioning automation

#### **set_volume** ⚡ *Controls Power Monitoring*
- **Purpose**: Electricity consumption monitoring level
- **Range**: 0-2 (integer steps)
- **Use Case**: Power monitoring configuration
- **Advanced Flow**: Dynamic monitoring level adjustment

---

## CONDITIONS (18 cards - Updated v0.80.0)

### Essential Tier - Basic Status Checks (3 cards)

#### 🔥 **compressor_running** (Highlighted)
- **Purpose**: Real-time compressor status check
- **Return**: Boolean (true/false)
- **Use Case**: Flow control based on compressor state
- **Advanced Flow**: Prevent conflicts during compressor operation
```
IF compressor_running is false
AND ambient_temperature_changed below 5°C
THEN set_work_mode to Normal
```

#### 🔥 **temperature_above** (Highlighted)
- **Purpose**: Ambient temperature comparison
- **Range**: -30°C to 50°C (0.5°C steps)
- **Invert**: Support for above/below logic
- **Use Case**: Weather-based flow control
- **Advanced Flow**: Multi-condition weather logic
```
IF temperature_above 15°C
AND time is between 06:00-22:00
THEN set_heating_mode to hot_water
```

#### 🔥 **fault_active** (Highlighted)
- **Purpose**: System fault status check
- **Return**: Boolean based on fault code (0 = no fault)
- **Use Case**: Safety interlocks, maintenance alerts
- **Advanced Flow**: Fault-dependent automation disabling

### Advanced Tier - Performance Monitoring (4 cards)

#### **power_above_threshold** ⚡ *Requires Power Monitoring*
- **Purpose**: Power consumption comparison
- **Range**: 100-10,000W (100W steps)
- **Invert**: Support for above/below logic
- **Use Case**: Load management conditions
- **Advanced Flow**: Dynamic load balancing

#### **temperature_differential**
- **Purpose**: Inlet/outlet temperature difference
- **Range**: 1-50°C (0.5°C steps)
- **Use Case**: System efficiency monitoring
- **Advanced Flow**: Performance-based control adjustments
```
IF temperature_differential above 15°C
AND compressor_running is true
THEN send notification "Poor heat transfer detected"
```

#### **water_flow_rate_check**
- **Purpose**: Flow rate monitoring
- **Range**: 1-100 L/min (1 L/min steps)
- **Use Case**: Circulation system monitoring
- **Advanced Flow**: Flow-dependent safety controls

#### **total_consumption_above** ⚡ *Requires Power Monitoring*
- **Purpose**: Total energy usage comparison
- **Range**: 100-50,000 kWh (100 kWh steps)
- **Use Case**: Long-term energy management
- **Advanced Flow**: Maintenance scheduling based on usage

### Advanced Tier - Action-Based Conditions **NEW v0.80.0** (9 cards)

These condition cards enable reading current values of all controllable device settings, providing complete bidirectional control for sophisticated automation flows. Always available regardless of user preferences.

#### **device_power_is**
- **Purpose**: Check current device power state (on/off)
- **Arguments**: Power state (on/off)
- **Return**: Boolean (true if state matches)
- **Use Case**: Conditional actions based on device power state
- **Advanced Flow**: Prevent conflicting power commands
```
IF device_power_is off
AND ambient_temperature_changed below 0°C
THEN set_device_onoff to on
```

#### **target_temperature_is**
- **Purpose**: Compare current target temperature setting
- **Arguments**: Comparison (equal/greater/less), Temperature (5-60°C, 0.5°C steps)
- **Return**: Boolean based on comparison result
- **Use Case**: Temperature-based flow control
- **Advanced Flow**: Dynamic temperature management
```
IF target_temperature_is greater than 25°C
AND power_above_threshold 2000W
THEN set_target_temperature to 22°C
```

#### **hotwater_temperature_is**
- **Purpose**: Compare current hot water temperature setting
- **Arguments**: Comparison (equal/greater/less), Temperature (30-75°C, 1°C steps)
- **Return**: Boolean based on comparison result
- **Use Case**: Hot water optimization flows
- **Advanced Flow**: Energy-efficient hot water management

#### **heating_mode_is**
- **Purpose**: Check current heating mode setting
- **Arguments**: Mode (cold/heating/floor_heating/hot_water/cold_and_hotwater/heating_and_hot_water/floor_heating_and_hot_water)
- **Return**: Boolean (true if mode matches)
- **Use Case**: Mode-dependent automation
- **Advanced Flow**: Seasonal mode transitions
```
IF heating_mode_is floor_heating
AND temperature_above 20°C
THEN set_heating_mode to hot_water
```

#### **work_mode_is**
- **Purpose**: Check current work mode setting
- **Arguments**: Mode (ECO/Normal/Boost)
- **Return**: Boolean (true if mode matches)
- **Use Case**: Performance optimization flows
- **Advanced Flow**: Dynamic efficiency management

#### **water_mode_is**
- **Purpose**: Compare current water control mode setting
- **Arguments**: Comparison (equal/greater/less), Mode (0-1)
- **Return**: Boolean based on comparison result
- **Use Case**: Water control optimization
- **Advanced Flow**: Flow rate management

#### **capacity_setting_is**
- **Purpose**: Check current hot water curve setting
- **Arguments**: Capacity (OFF/H1/H2/H3/H4)
- **Return**: Boolean (true if setting matches)
- **Use Case**: Capacity-dependent automation
- **Advanced Flow**: Load-based capacity adjustments

#### **heating_curve_is**
- **Purpose**: Check current heating curve setting
- **Arguments**: Curve (OFF/H1-H8/L1-L8)
- **Return**: Boolean (true if curve matches)
- **Use Case**: Curve-based heating optimization
- **Advanced Flow**: Weather-dependent curve adjustments

#### **volume_setting_is**
- **Purpose**: Compare current electricity consumption checking level
- **Arguments**: Comparison (equal/greater/less), Level (0-2)
- **Return**: Boolean based on comparison result
- **Use Case**: Power monitoring management
- **Advanced Flow**: Dynamic monitoring level adjustment

### Expert Tier - Technical Analysis (2 cards)

#### **electrical_balance_check**
- **Purpose**: 3-phase electrical balance monitoring
- **Range**: 1-20% tolerance (0.1% steps)
- **Use Case**: Professional electrical diagnostics
- **Advanced Flow**: Electrical system protection
```
IF electrical_balance_check outside 10%
THEN send notification "Electrical imbalance detected"
AND set_device_onoff to off
```

#### **system_pulse_steps_differential**
- **Purpose**: EEV/EVI pulse-steps difference monitoring
- **Range**: 0-1000 Pulse-steps (10 pulse steps)
- **Use Case**: Refrigeration system diagnostics
- **Advanced Flow**: Advanced refrigeration system monitoring

---

## Power Management Considerations

### Cards Requiring Power Monitoring Support (6 cards)
These cards will not function on devices without power monitoring capabilities:

**Triggers**:
- `power_threshold_exceeded`
- `daily_consumption_threshold` 
- `total_consumption_milestone`

**Actions**:
- `set_volume` (controls power monitoring level)

**Conditions**:
- `power_above_threshold`
- `total_consumption_above`

**Implementation**: All power-dependent cards include capability detection logic and clear hints about requirements.

---

## Advanced Flow Processing Guidelines

### Hysteresis Implementation
Use temperature and power thresholds with hysteresis to prevent oscillation:
```
WHEN temperature_above 22°C
THEN set_target_temperature to 20°C

WHEN temperature_above 18°C is false  
THEN set_target_temperature to 22°C
```

### Multi-Condition Safety Logic
```
WHEN fault_detected any fault
OR electrical_balance_check outside 15%
OR temperature_differential above 25°C
THEN set_device_onoff to off
AND send emergency notification
```

### Seasonal Automation
```
WHEN ambient_temperature_changed above 20°C for 7 days
AND calendar month is March-October  
THEN set_heating_mode to cold_and_hotwater
AND set_work_mode to ECO
```

### Predictive Maintenance
```
WHEN compressor_efficiency_alert above 180 Hz
AND total_consumption_above 10000 kWh  
THEN send notification "Compressor maintenance recommended"
```

### Energy Optimization
```
WHEN daily_consumption_threshold reached 25 kWh
AND time is before 20:00
THEN set_work_mode to ECO
AND set_target_temperature to [[current_temperature - 1]]°C
```

## Value Processing Recommendations

1. **Temperature Control**: Use 0.5°C steps for precise control, implement hysteresis
2. **Power Management**: Monitor trends rather than absolute values
3. **Frequency Monitoring**: Use 5 Hz steps for compressor efficiency tracking
4. **Time-Based Logic**: Combine with calendar and time conditions for seasonal automation
5. **Safety Interlocks**: Always include fault conditions in critical automation flows
6. **Progressive Efficiency**: Start with ECO mode, escalate to Normal/Boost as needed

## Dynamic Flow Card Management (v0.70.0+)

The app features an intelligent flow card management system that adapts to device capabilities and sensor health:

### Capability-Based Registration
- **Automatic Detection**: Flow cards are automatically registered only for available capabilities
- **Health Monitoring**: Flow cards are dynamically enabled/disabled based on sensor health status
- **User Settings**: Three modes for each category: Disabled, Auto (health-based), Force Enabled

### Pattern-Based Architecture
- **Consistent Behavior**: All similar flow cards follow standardized patterns
- **Reduced Complexity**: Pattern-based system eliminates duplicate code
- **Error Handling**: Automatic capability validation and graceful error handling
- **Debug Support**: Enhanced logging with fallback values for troubleshooting

### User Control
Access flow card control via device settings:
- **Temperature Alerts**: Control temperature-related flow card visibility
- **Voltage/Current Alerts**: Manage electrical monitoring flow cards  
- **Power/Pulse-steps Alerts**: Configure advanced monitoring cards
- **Expert Mode**: Enable diagnostic cards for professional use

This intelligent system ensures users only see flow cards for working sensors while providing comprehensive diagnostic information for troubleshooting connectivity issues.

## Control Issues Fixed (v0.90.0)

### Resolved Capability Listener Problems
- **Fixed "missing capability listener" errors** for temperature and on/off controls that prevented device control
- **Resolved "Not_setable" errors** for heating mode and heating curve capabilities
- **Enhanced capability detection logic** to properly identify built-in and custom setable capabilities
- **Improved bidirectional synchronization** ensuring UI changes update the physical device

### Flow Card Action Reliability  
- **Implemented comprehensive flow card action listeners** that ensure flow cards control the actual device
- **Fixed flow actions only updating Homey values** without affecting physical device state
- **Added proper error handling and validation** for all capability changes from flows
- **Enhanced user feedback** with meaningful error messages for connection and validation issues

### Optional Power Measurements
- **Added device settings control** for power measurement capabilities
- **Users can disable irrelevant power capabilities** for cleaner device interfaces
- **Dynamic capability management** adds/removes capabilities based on user preferences
- **Maintains backward compatibility** with existing automations

### Technical Improvements
- **Input validation** for all capability values (temperature ranges, enum validation)
- **Robust error handling** with user-friendly messages for connection timeouts and device errors
- **Type safety improvements** with proper TypeScript compliance
- **ESLint compliance** with clean code formatting

All device controls now work reliably from both Homey UI and flow cards with proper physical device communication.

## Enhanced Communication (v0.90.3)

### Flow ACTION Card Communication Fix
- **Fixed critical communication issue** where Flow ACTION cards (like `set_heating_curve`) weren't propagating to physical devices
- **Root cause resolved**: Pattern-based action system was using `setCapabilityValue()` which only updates Homey's internal state
- **Implemented proper device communication** using `triggerCapabilityListener()` to ensure commands reach the physical device via DPS

### Technical Implementation
- **Updated `registerSimpleActions` function** in `/lib/flow-helpers.ts` to use proper device communication methods
- **Added fallback compatibility** for devices that may not support the new method signature
- **Enhanced TypeScript typing** for improved code reliability and maintainability

### Command Flow (Fixed)
1. **Flow ACTION Card** execution (e.g., `set_heating_curve` with value "L8")
2. **Pattern-Based Action Handler** triggers `triggerCapabilityListener()`
3. **Device Capability Listener** processes the command and validates input
4. **DPS Mapping** translates capability to appropriate device data point (e.g., DPS 13)
5. **Tuya Communication** sends command to physical device via `tuya.set()`
6. **Physical Device Update** ✅ Command successfully applied

### Capabilities Benefiting from Fix
All simple action Flow cards now properly communicate with the physical device:
- `set_target_temperature` - Temperature control
- `set_hotwater_temperature` - Hot water temperature  
- `set_heating_mode` - Heating operation mode
- `set_work_mode` - Work mode selection
- `set_capacity` - System capacity settings
- `set_volume` - Volume control
- `set_device_onoff` - Power on/off
- `set_water_mode` - Water control mode
- **`set_heating_curve`** - Heating curve adjustment (original reported issue)

This fix ensures complete bidirectional communication between Homey Flow cards and the physical heat pump device, resolving the issue where reading device values worked but controlling the device through Flow cards failed.

## Conclusion

This comprehensive flow card system enables sophisticated heat pump automation from basic comfort control to professional-grade system optimization and diagnostics.