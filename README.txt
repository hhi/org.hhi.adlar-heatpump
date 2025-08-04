Local access to the Aurora series heatpump device.

To figure out the local key to be used, read from Github source: docs/Get Local Keys - instruction.pdf

Documentation Created (See /docs subdirectories)

  1. capabilities-overview.md

  - Complete overview of all 41 device capabilities
  - Detailed properties, DPS mappings, and purposes
  - Organized by capability type and function
  - Device compatibility notes for power management features

  2. flow-cards-overview.md

  - Comprehensive analysis of all 38 flow cards
  - Categorized by type (triggers/actions/conditions) and tier (Essential/Advanced/Expert)
  - Detailed use cases, value ranges, and advanced flow examples
  - Power management compatibility requirements
  - Processing guidelines and best practices

  3. capability-flowcard-mapping.md

  - Direct mapping between capabilities and their flow cards
  - Shows how each capability integrates with Homey's automation system
  - Identifies capabilities without flow cards and complex flow cards
  - Progressive implementation recommendations
  - Usage best practices for different skill levels

  🎯 Key Features (v0.80.0)

  - Complete Coverage: All 41 capabilities and 47+ flow cards documented
  - Action-Based Conditions: Read current values of all controllable device settings
  - Enhanced Automation: 9 new condition cards for complete bidirectional control
  - Tiered Approach: Essential (8 highlighted) → Advanced → Expert progression
  - Practical Guidance: Real-world examples, advanced flow patterns, and processing tips
  - Compatibility Aware: Clear identification of power management requirements
  - Multi-Language: English/Dutch support throughout
  - Professional Grade: From basic comfort control to expert-level diagnostics

  🚀 NEW in v0.80.0 - Action-Based Condition Flow Cards:

  - Complete Bidirectional Control: Read current values of all controllable device settings
  - 9 New Condition Cards: Check device power, temperatures, modes, and settings
  - Advanced Comparisons: Equal to, greater than, less than operators for numeric values
  - Real-time Value Reading: Live capability value checking for complex flow logic
  - Enhanced Automation: Create conditions based on current device states
  - Always Available: Independent of user preferences, always accessible

  🔥 v0.70.0 - Intelligent Capability Health Monitoring:

  - Smart Null Detection: Automatically detects missing sensor data (null values) in all flow handlers
  - Dynamic Flow Cards: Flow cards automatically register/unregister based on sensor health status
  - Health Tracking: Monitors data availability over time with null count and timeout detection
  - Diagnostic Tools: User-facing capability health reports showing which sensors work/fail
  - Debug Logging: Enhanced logging with fallback values for missing data
  - Auto-Management: Intelligent flow card visibility reduces interface clutter
  - Troubleshooting: Comprehensive sensor connectivity issue identification

  The documentation provides everything needed for users to understand and effectively use the heat pump's capabilities, from
  simple temperature control to sophisticated energy management and predictive maintenance automation with intelligent health monitoring.

   
   
    ✅ Implemented Critical Notifications:

  1. Connection Failures

  - Triggers after 5 consecutive reconnection failures (100 seconds)
  - Notifies: "Device Connection Lost - Heat pump disconnected for over 1 minute"

  2. System Faults

  - Monitors adlar_fault capability
  - Notifies: "System Fault Detected - Fault code: X. Check system immediately"

  3. Temperature Safety

  - Extreme temperatures (>80°C or <-20°C)
  - Notifies: "Temperature Alert - Extreme temperature detected. System safety compromised"

  4. Pulse-Steps Safety

  - Critical pulse-steps readings (>480 or <0)
  - Notifies: "Pulse-Steps Alert - Critical pulse-steps reading. System requires attention"

  Smart Features:

  - Rate limiting: Max 1 notification per 30 minutes per device (prevents spam)
  - Device-specific: Includes device name in notification
  - Automatic monitoring: Checks all incoming sensor data
  - Non-blocking: Won't crash app if notification fails

  The system now provides proactive user alerts for all critical heat pump conditions while
  preventing notification spam!