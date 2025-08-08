Local access to the Aurora series heatpump device.

To figure out the local key to be used, read from Github source: docs/Get Local Keys - instruction.pdf

🎯 Key Features (v0.92.4+)

✅ Flow Card Control System: Individual control over 7 flow card categories with 3-mode system
✅ Settings Management: Race condition prevention with deferred updates and auto-management
✅ Enhanced Error Handling: TuyaErrorCategorizer with smart retry and user-friendly messages
✅ Performance Optimizations: Centralized constants, cleaned unused code, improved efficiency
✅ User Control: Complete automation complexity control with disabled/auto/enabled modes
✅ Health Awareness: Dynamic flow card registration based on sensor health status

📊 Current Statistics (v0.92.4+)

- Total Flow Cards: 58 (31 triggers, 18 conditions, 9 actions)
- Total Capabilities: 41 (14 custom Adlar + 27 standard/custom Homey)
- User-Controllable Categories: 7 flow card categories + expert mode
- Languages Supported: English/Dutch throughout
- Health Monitoring: Real-time with 2-minute intervals
- Error Categories: 9 comprehensive error types with recovery guidance

🚀 Latest Features (v0.92.4+)

Settings Management & Race Condition Prevention:
- Fixed "Cannot set Settings while this.onSettings is still pending" errors
- Deferred settings updates using setTimeout to prevent concurrent access
- Power settings auto-management with cascading flow card controls
- Enhanced settings UI labels with clear restart guidance

Flow Card Control System:
- flow_temperature_alerts: Temperature-related flow cards (11 cards)
- flow_voltage_alerts: Voltage monitoring flow cards (3 cards) 
- flow_current_alerts: Current monitoring flow cards (3 cards)
- flow_power_alerts: Power consumption flow cards (3 cards)
- flow_pulse_steps_alerts: Valve position flow cards (2 cards)
- flow_state_alerts: System state change flow cards (5 cards)
- flow_expert_mode: Advanced diagnostic flow cards (3 cards)

Three-Mode System:
- DISABLED: No flow cards for category (clean interface, unused sensors)
- AUTO: Show only for healthy capabilities with data (DEFAULT - reliable alerts)
- ENABLED: Force all capability flow cards active (safety critical, troubleshooting)

Enhanced Error Handling:
- TuyaErrorCategorizer with 9 error categories (connection, timeout, auth, DPS, network, etc.)
- Smart retry logic for recoverable errors with appropriate delays
- User-friendly messages with specific recovery actions
- Centralized constants in DeviceConstants class for consistent configuration

Performance & Code Quality:
- Removed ~300 lines of unused flow card registration methods
- Fixed double flow card updates and race conditions
- Consolidated hardcoded values into centralized constants
- Cleaned up unused imports, variables, and parameters

🔥 Previous Major Features

v0.90.3 - Flow Communication & Documentation Updates:
- Fixed critical Flow ACTION card communication issue
- Enhanced triggerCapabilityListener() for reliable device control
- Comprehensive architecture documentation
- Inverse operator support for condition cards

v0.90.0 - Capability & Flow Control Fixes:
- Resolved all "missing capability listener" and "Not_setable" errors
- Fixed flow cards to control actual physical device vs just Homey values
- Optional power measurements via device settings
- Enhanced error handling and input validation

v0.80.0 - Action-Based Condition Flow Cards:
- 9 new condition cards for reading current device settings
- Complete bidirectional control with inverse operator support
- Advanced comparison operators (equal/greater/less than)
- Real-time capability value checking

v0.70.0 - Intelligent Capability Health Monitoring:
- Smart null detection and health-based flow card registration
- Diagnostic tools and capability health reports
- Dynamic flow card management based on sensor status
- Troubleshooting support for sensor connectivity issues

📋 Documentation (Enhanced v0.92.4+)

1. capabilities-overview.md
   - Complete overview of all 41 device capabilities
   - User-controlled capability management with power measurements toggle
   - Enhanced health monitoring with DeviceConstants integration
   - Error handling integration and optional power capabilities

2. flow-cards-overview.md  
   - Analysis of all 58 flow cards with three-mode control system
   - User-controlled dynamic registration with health awareness
   - Settings integration and power management auto-cascading
   - Enhanced examples and troubleshooting guidance

3. capability-flowcard-mapping.md
   - Health-aware registration logic with practical examples
   - Power management cascade logic and user interface integration
   - Updated with three-mode control system documentation

4. flow-patterns.md (Updated v0.92.4+)
   - Pattern-based flow card management system
   - User-controlled dynamic registration integration
   - Multi-level architecture (App vs Device level)
   - Settings-based pattern registration with health awareness

🛡️ Critical Safety Monitoring

Smart Notifications with Rate Limiting:
- Connection failures (after 5 consecutive failures - 100 seconds)
- System faults with specific fault codes and descriptions
- Extreme temperature safety (>80°C or <-20°C)
- Pulse-steps safety monitoring (critical valve positions)
- Rate limited: Max 1 notification per 30 minutes per device

The system provides comprehensive heat pump automation from basic comfort control to
professional-grade diagnostics with complete user control over complexity and automation scope.