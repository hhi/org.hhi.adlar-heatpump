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

  🎯 Key Features

  - Complete Coverage: All 41 capabilities and 38 flow cards documented
  - Tiered Approach: Essential (8 highlighted) → Advanced → Expert progression
  - Practical Guidance: Real-world examples, advanced flow patterns, and processing tips
  - Compatibility Aware: Clear identification of power management requirements
  - Multi-Language: English/Dutch support throughout
  - Professional Grade: From basic comfort control to expert-level diagnostics

  The documentation provides everything needed for users to understand and effectively use the heat pump's capabilities, from
  simple temperature control to sophisticated energy management and predictive maintenance automation.

   
   
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

  4. Pressure Safety

  - Critical pressure readings (>50 or <0)
  - Notifies: "Pressure Alert - Critical pressure reading. System requires attention"

  Smart Features:

  - Rate limiting: Max 1 notification per 30 minutes per device (prevents spam)
  - Device-specific: Includes device name in notification
  - Automatic monitoring: Checks all incoming sensor data
  - Non-blocking: Won't crash app if notification fails

  Additional Suggestions:

  You could also add notifications for:
  - Electrical imbalance from flow cards (3-phase current monitoring)
  - Extended maintenance mode (compressor/defrost stuck states)
  - Communication errors (invalid DPS data patterns)

  The system now provides proactive user alerts for all critical heat pump conditions while
  preventing notification spam!