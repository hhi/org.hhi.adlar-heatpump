# Adlar Castra Heatpump

Local access to the Aurora series heatpump device for Homey Pro.

## Overview

This Homey app provides comprehensive local control and monitoring of Adlar Castra Aurora series heat pumps via Tuya's local API. The app enables direct communication with your heat pump without requiring internet connectivity.

## Features

- **Local API Integration**: Direct communication via Tuya local protocol (no cloud dependency)
- **Connection Monitoring & Auto-Reconnect**: Live connection status with automatic recovery and availability sync
- **Protocol Version Selection**: Choose Tuya protocol version during pairing (3.3, 3.4, 3.5)
- **Settings-Based Credential Updates**: Update device credentials and protocol version directly in settings without re-pairing
- **Service-Oriented Architecture**: 9 specialized services managed by ServiceCoordinator for modularity and maintainability
- **Complete Device Control**: Access to 88 capabilities including diagnostics, energy, and advanced controls
- **Flow Card Ecosystem**: 93 total flow cards with per-category control and health-based registration
- **Efficiency Monitoring**: COP (real-time), Rolling COP (daily/weekly/monthly), and SCOP per EN 14825
- **Adaptive Control & Building Model**: PI regulation, thermal predictions, COP/energy optimization, and building model learning
- **Building Insights & Diagnostics**: Automated recommendations and detailed learning diagnostics
- **Energy Price Optimization**: Day-ahead price scheduling and cost-aware control
- **Multi-language Support**: English, Dutch, German, and French

## Capabilities

The app provides access to **88 capabilities** across key categories:

- **Connection Status**: Real-time Tuya connection state (connected/disconnected/reconnecting/error)
- **Temperature Sensors**: Inlet/outlet water, coil, discharge, ambient, and saturation temperatures
- **Power & Electrical**: 3-phase voltage/current, power consumption, energy usage, external power input, calculated totals
- **System Control**: Heating modes, temperature setpoints, capacity settings, timer control
- **System States & Safety**: Compressor, defrost, backwater, fault detection, protections
- **Valve & Pump Monitoring**: EEV/EVI pulse steps, water flow
- **Efficiency Monitoring**: COP diagnostics, rolling averages, SCOP quality and trend analysis
- **Adaptive & Price Control**: Simulated targets, price categories, costs, and adaptive diagnostics
- **Diagnostics & Insights**: Building model diagnostics, insights, and optimization signals

## Installation & Setup

### Prerequisites

- Homey Pro (firmware ≥12.2.0)
- Adlar Castra Aurora series heat pump
- Local network access to the heat pump
- Device credentials (ID, Local Key, IP Address)

### Getting Device Credentials

To obtain the required local key, refer to:
`docs/setup/Tuya_LocalKey_Homey_Guide_EN.pdf`

### Installation Steps

1. Install the app from the Homey App Store
2. Add a new device and select "Intelligent Heat Pump"
3. Enter your device credentials:
   - **Device ID**: Unique identifier for your heat pump
   - **Local Key**: Security key for encrypted communication
   - **IP Address**: Local network IP of your heat pump
   - **Protocol Version**: Tuya protocol version (3.3, 3.4, or 3.5) - Default: 3.3
4. Complete the pairing process

**Note:** If you experience connection issues (ECONNRESET errors), try changing the protocol version in device settings (Settings → Connection Settings → Protocol Version). Most devices use 3.3, but some newer models require 3.4 or 3.5. See [USER_QUICK_FIX.en.md](docs/setup/USER_QUICK_FIX.en.md) for troubleshooting guidance.

## Configuration

### Device Settings

#### Flow Card Controls

**FlowCardManagerService** dynamically manages flow cards with per-category controls and health-based registration.

Three modes per category (managed via SettingsManagerService + CapabilityHealthService):

- **Disabled**: No flow cards (clean interface)
- **Auto**: Only healthy sensors with data (health-based registration, default)
- **Enabled**: All cards regardless of sensor status

#### COP (Coefficient of Performance) Settings

**COPCalculator Service** provides 8-method efficiency monitoring with automatic quality selection:

- **COP Calculation**: Enable/disable efficiency monitoring with 8 calculation methods (±5% to ±30% accuracy)
- **Calculation Method**: Auto-selection or manual override (Direct Thermal → Temperature Difference)
- **Diagnostic Information**: Specific feedback about missing data ("No Power", "No Flow", "No Temp Δ", etc.)
- **Outlier Detection**: Identify unrealistic COP values indicating sensor issues
- **External Data Integration**: Request power, flow, and ambient data from other Homey devices
- **Cross-App Timeout**: Configure response timeout for external data requests (1-30 seconds)

**RollingCOPCalculator Service** provides time-series analysis:

- **Daily COP**: 24-hour rolling average with idle period awareness
- **Weekly COP**: 7-day rolling average for seasonal pattern identification
- **Monthly COP**: 30-day rolling average for long-term trend analysis
- **Trend Detection**: 7-level classification (strong improvement → significant decline)

**SCOPCalculator Service** provides seasonal efficiency per EN 14825:

- **SCOP Calculation**: Heating season average (Oct 1 - May 15, 227 days)
- **Temperature Bin Method**: 6 temperature bins with load ratio weighting
- **Quality Assessment**: High/medium/low confidence based on data coverage

#### Feature Settings (App Restart Required)

- **Show Curve Picker Controls**: Toggle heating/hot water curve controls in device UI (default: off)
- **Enable Power Measurements**: Toggle 9 DPS power-related capabilities (voltage, current, consumption)
- **Enable Slider Controls**: Toggle 3 manual control sliders (water/power management)
- **Enable Intelligent Energy Tracking**: Prioritize external power measurements, appear in Homey Energy dashboard

#### Building Model Learning

- **Building Model Learning**: Enable/disable thermal property learning (C, UA, τ, g, P_int)
- **Building Type**: Light/Average/Heavy/Passive - sets initial learning parameters
- **Dynamic Internal Gains**: Time-of-day heat contribution patterns (night 40%, day 100%, evening 180%)
- **Seasonal Solar Adjustment**: Seasonal sun angle compensation (winter 60%, summer 130%)
- **Reset Building Model**: Clear learned parameters and restart from selected profile

#### Building Insights & Recommendations (v2.4.0+)

- **Enable Building Insights**: Analyze thermal model and provide energy-saving recommendations with ROI
- **Minimum Confidence**: Threshold for showing insights (70% = ~24-48 hours learning)
- **Max Active Insights**: Limit simultaneous recommendations (1-5, default: 3)

#### Energy Price Optimization

- **Price Optimization**: Day-ahead price-based heating (EnergyZero API, €400-600/year savings)
- **Price Calculation Mode**: Market/Market+/All-in pricing with configurable supplier fees and taxes
- **Price Thresholds**: Very Low/Low/Normal/High categories with P10-P90 percentile defaults
- **Price Block Detection**: Cheapest/expensive block identification for day-ahead planning

#### COP Optimization

- **COP Optimizer**: Learn optimal supply temperature per outdoor temperature (€200-300/year)
- **Strategy**: Conservative/Balanced/Aggressive optimization approaches

#### Adaptive Control Weighting

- **Comfort Priority**: Weight for PI temperature control (default: 60%)
- **Efficiency Priority**: Weight for COP optimization (default: 25%)
- **Cost Priority**: Weight for price optimization (default: 15%)
- Values auto-normalize to 100%

## Flow Cards

**93 Total Cards**: 41 triggers, 29 conditions, 23 actions

### Triggers (41)

- **Temperature, voltage, current, and power alerts**
- **System state changes and fault detection**
- **COP Efficiency Monitoring**: COP thresholds, outlier detection, method-based automation
- **External Data Requests**: Automatic requests for power, flow, and ambient data from other devices
- **Safety monitoring with rate limiting**

### Conditions (29)

- **Temperature thresholds and system status verification**
- **COP efficiency checks** with threshold-based logic
- **Calculation method verification** for automation based on data quality
- **Action-based conditions** for all controllable settings
- **Inverse operator support** for "is" and "is not" logic

### Actions (23)

- **Temperature setpoint and mode control**
- **System on/off and heating curve adjustments**
- **External Data Integration**: Send power, flow, and ambient data to heat pump for enhanced COP calculations
- **Adaptive Control Integration (v2.0.1+)**: Send indoor temperature from external sensors for adaptive temperature control
- **Building Model Diagnostics (v2.0.1+)**: Troubleshoot building thermal model learning with comprehensive status report
- **Dynamic Curve Calculator**: Calculate values based on configurable curves (e.g., weather-compensated heating)
- **Time-Based Scheduler**: Calculate values based on time-of-day schedules (e.g., daily temperature programming)
- **Seasonal Mode Detection**: Automatic heating/cooling season determination (Oct 1 - May 15)

#### Advanced: Calculate Value from Curve

Dynamically calculate output values based on input conditions using configurable curves.

##### Primary Use Case: Weather-Compensated Heating

Automatically adjust heating setpoint based on outdoor temperature for optimal efficiency:

![Curve Calculator in Action](docs/setup/images/Curve%20calculator.png)
*Screenshot: Weather-compensated heating flow with real-time results*

```text
WHEN   Outdoor temperature changed
THEN   Calculate value from curve
       Input: {{outdoor_temperature}}
       Curve: < 0 : 55, < 5 : 50, < 10 : 45, < 15 : 40, default : 35
AND    Set target temperature to {{result_value}}
```

##### Curve Format

Each line: `[operator] threshold : output_value`

##### Supported Operators

- `>` - Greater than
- `>=` - Greater than or equal
- `<` - Less than
- `<=` - Less than or equal
- `==` - Equal to
- `!=` - Not equal to
- `default` or `*` - Fallback value (always use as last line)

##### Evaluation Rules

1. Evaluates from **top to bottom**
2. Returns **first matching** condition
3. Falls back to `default` if no match

##### Input Flexibility

The **Input Value** field accepts multiple formats for maximum flexibility:

- **Direct numbers**: `5.2`, `-10`, `20.5`
- **Token expressions**: `{{ outdoor_temperature }}`, `{{ logic|temperature }}`
- **Calculated expressions**: `{{ outdoor_temperature + 2 }}`, `{{ ambient_temp - 5 }}`

All expressions are evaluated by Homey before the curve calculation, giving you powerful automation possibilities.

##### Example Curves

Basic Heating Curve (outdoor temp → heating setpoint):

```text
< -5 : 60    (Extreme cold → maximum heating)
< 0  : 55    (Freezing → high heating)
< 5  : 50    (Cold → medium heating)
< 10 : 45    (Cool → moderate heating)
< 15 : 40    (Mild → low heating)
default : 35 (Warm → minimal heating)
```

Time-Based Hot Water (hour of day → hot water temp):

```text
>= 22 : 45   (Night → energy saving mode)
>= 18 : 55   (Evening → normal)
>= 6  : 60   (Morning/day → comfort mode)
default : 45 (Default → energy saving)
```

COP-Based Optimization (current COP → temp adjustment):

```text
< 2.0 : -5   (Low efficiency → reduce 5°C)
< 2.5 : -3   (Moderate → reduce 3°C)
>= 3.5 : +2  (High efficiency → increase 2°C)
default : 0  (Normal → no change)
```

##### Best Practices

- ✅ Always add `default : <value>` as last line (prevents errors)
- ✅ Use newlines or commas to separate rules
- ✅ Test your curve with different inputs before deploying
- ✅ Keep curves simple (max 50 entries)
- ⚠️ Curves evaluate top to bottom - order matters!

##### Error Messages

The calculator provides clear error messages:

- `"Input value must be a valid number"` - Check your input tag
- `"No matching curve condition found for input value: X"` - Add a `default` line
- `"Invalid curve syntax at line N"` - Check operator and format
- `"Curve exceeds maximum allowed entries (50)"` - Simplify your curve

#### Advanced: Time-Based Scheduling & Seasonal Modes

Two new powerful calculators for time-based automation and seasonal switching.

##### Calculate Value from Time Schedule

Dynamically calculate output values based on time-of-day for daily temperature programming and time-of-use optimization.

**Basic Example: Daily Temperature Schedule**

```text
WHEN   Time is 06:00, 09:00, 17:00, 23:00
THEN   Calculate time-based value
       Schedule: 06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, 23:00-06:00: 18
AND    Set target temperature to {{result_value}}
```

**Schedule Format**: `HH:MM-HH:MM: output_value`

**Features**:
- ✅ Overnight ranges supported (e.g., `23:00-06:00: 18`)
- ✅ Default fallback (e.g., `default: 20`)
- ✅ Maximum 30 time ranges
- ✅ Comma or newline separated
- ✅ Comprehensive validation with line-specific error messages

**Example Schedules**:

Comfort-Based Heating:
```text
06:00-09:00: 22  (Morning comfort)
09:00-17:00: 19  (Energy saving while away)
17:00-23:00: 21  (Evening comfort)
23:00-06:00: 18  (Night setback)
```

Time-of-Use Pricing:
```text
00:00-06:00: 45  (Night tariff - lower temp)
06:00-23:00: 55  (Day tariff - normal temp)
23:00-00:00: 45  (Pre-night tariff)
```

##### Get Seasonal Mode

Automatically detect heating/cooling season based on date (Oct 1 - May 15 = heating season, aligned with EN 14825 SCOP standard).

**Example: Seasonal Schedule Switching**

```text
WHEN   Time is 06:00
AND    Get seasonal mode → is_heating_season = true
THEN   Calculate time-based value: "06:00-09:00: 22, 09:00-17:00: 19, default: 18"
       Set target temperature to {{result_value}}

WHEN   Time is 06:00
AND    Get seasonal mode → is_heating_season = false
THEN   Calculate time-based value: "06:00-22:00: 18, default: 16"
       Set target temperature to {{result_value}}
```

**Tokens Returned**:
- `mode`: "heating" or "cooling"
- `is_heating_season`: true during Oct 1 - May 15
- `is_cooling_season`: true during May 16 - Sep 30
- `days_until_season_change`: Days remaining until next season

**Use Cases**:
- Automatic winter/summer schedule switching
- Season change notifications (e.g., "Heating season ends in 7 days")
- Mode-based flow logic without manual date checking

##### Combined Example: Weather + Time + Season

Complete automation combining all three calculators:

```text
// Flow 1: Weather-compensated base setpoint (only during heating season)
WHEN   Outdoor temperature changes
AND    Get seasonal mode → is_heating_season = true
THEN   Calculate curve value:
       Input: {{outdoor_temperature}}
       Curve: "< -5: 60, < 0: 55, < 5: 50, < 10: 45, default: 40"
       Store result in variable: base_setpoint

// Flow 2: Time-based adjustment
WHEN   Time is 06:00, 09:00, 17:00, 23:00
THEN   Calculate time-based value:
       Schedule: "06:00-09:00: 2, 09:00-17:00: -3, 17:00-23:00: 1, default: -2"
       Store result in variable: time_adjustment

// Flow 3: Apply combined setpoint
WHEN   Variables changed
THEN   Set target temperature: {{base_setpoint}} + {{time_adjustment}}
```

**Result**: Dynamic heating that adjusts for outdoor temperature (weather compensation), time of day (comfort scheduling), and only operates during heating season.

##### Best Practices

**Time Schedules**:
- ✅ Always include `default: <value>` for 24-hour coverage
- ✅ Test overnight ranges (23:00-06:00) before deployment
- ✅ Keep schedules under 15 entries for readability
- ❌ Don't exceed 30 entries (hard limit)

**Seasonal Mode**:
- ✅ Combine with time schedules for automatic winter/summer switching
- ✅ Use for season change notifications
- ⚠️ Fixed dates (Oct 1 - May 15) optimized for European climate

### Cross-App Integration

**External Data Flow Pattern**:
1. Heat pump triggers `request_external_power_data` when COP calculation needs external power data
2. Your power meter flow responds with `receive_external_power_data` action
3. Enhanced COP calculation uses both internal sensors and external measurements
4. Similar patterns for `request_external_flow_data` and `request_external_ambient_data`

## Building Model Diagnostics (v2.0.1+)

### Troubleshooting Thermal Learning

The **Building Model Learner** (adaptive control component 2) learns your home's thermal properties using machine learning. The thermal time constant (tau) and thermal mass (C) are learned automatically from temperature data.

### Integration with Adaptive Control

The diagnostic tool helps ensure the Building Model Learner works correctly:

- **Component 1** (HeatingController): Needs indoor temp → use same diagnostic approach
- **Component 2** (BuildingModelLearner): Direct diagnostic via this flow card
- **Component 3** (EnergyPriceOptimizer): Check energy price API connectivity
- **Component 4** (COPOptimizer): Check COP capability data quality

**All components** log to the same diagnostic framework for unified troubleshooting.

## Internationalization

**Fully Localized Experience** in English, Dutch, German, and French:

- **COP Method Names**: All 8 calculation methods with localized descriptions
- **COP Method Descriptions**: Detailed accuracy information (±5% to ±30%) in all supported languages
- **COP Diagnostic Messages**: Specific error indicators ("No Power", "No Flow", "No Temp Δ", "Multi Fail") optimized for 22-character display
- **Trend Analysis**: 7 efficiency trend descriptions ("Strong improvement", "Moderate decline", etc.)
- **SCOP Status Messages**: Seasonal calculation progress with mobile-optimized text (≤22 chars)
- **Flow Card Labels**: All triggers, conditions, and actions with proper translations
- **Settings Interface**: Complete settings UI in all supported languages with context-appropriate hints

**Mobile Optimization**: All sensor values and status messages optimized for iPhone display constraints.

## Safety & Monitoring

- **Connection Monitoring**: Alerts after 5 consecutive failures with automatic device unavailable status
- **Crash Prevention (v0.99.46)**: Triple-layer error handling prevents app crashes from network issues
- **Device Status Sync**: Automatic unavailable/available status updates based on connection state
- **System Faults**: Specific fault codes and descriptions
- **Temperature Safety**: Extreme temperature detection (>80°C or <-20°C)
- **COP Outlier Detection**: Identify unrealistic efficiency values (< 0.5 or > 8.0 COP)
- **Valve Monitoring**: Critical pulse-steps safety alerts
- **Rate Limiting**: Maximum 1 notification per 30 minutes per device

## Troubleshooting

### Connection Issues (ECONNRESET Errors)

If your device repeatedly disconnects or shows ECONNRESET errors:

**Quick Fix (< 2 minutes):**

1. Open device Settings in Homey app
2. Scroll to the top to the connection settings
3. **Change Protocol Version to 3.4** (or try 3.5 if 3.4 doesn't work)
4. Optional: update other credentials (IP Address, Local Key, Device ID)
5. Click "Save" and wait 1-2 minutes

**Success Indicators:**

- ✅ Connection status shows "connected"
- ✅ No ECONNRESET errors in logs
- ✅ Sensor data updates normally
- ✅ Device stays available

**Detailed Guides:**

- [USER_QUICK_FIX.en.md](docs/setup/USER_QUICK_FIX.en.md) - Step-by-step instructions
- [PROTOCOL_VERSION_GUIDE.en.md](docs/setup/PROTOCOL_VERSION_GUIDE.en.md) - Comprehensive troubleshooting

### Device Pairing Issues

If pairing fails:

1. Verify device credentials (ID, Local Key, IP)
2. Ensure heat pump is on local network
3. Try different protocol versions (3.3 → 3.4 → 3.5)
4. Check firewall/network restrictions
5. See `docs/setup/Tuya_LocalKey_Homey_Guide_EN.pdf` for credential retrieval

## Documentation & Support

### 📚 Documentation Portal

Complete documentation is available in **4 languages** (🇳🇱 NL, 🇬🇧 EN, 🇩🇪 DE, 🇫🇷 FR):

| Language | Documentation Index |
|----------|---------------------|
| 🇳🇱 Nederlands | [docs/README.nl.md](docs/README.nl.md) |
| 🇬🇧 English | [docs/README.en.md](docs/README.en.md) |
| 🇩🇪 Deutsch | [docs/README.de.md](docs/README.de.md) |
| 🇫🇷 Français | [docs/README.fr.md](docs/README.fr.md) |

### 👤 User Guides

| Guide | Description |
|-------|-------------|
| [Advanced Features Introduction](docs/setup/advanced-control/Advanced_Features_Intro.en.md) | Unlock full functionality with external data |
| [Configuration Guide](docs/setup/advanced-settings/CONFIGURATION_GUIDE.en.md) | All settings explained |
| [COP Flow Card Setup](docs/setup/COP%20flow-card-setup.en.md) | Step-by-step COP measurement configuration |
| [Protocol Version Guide](docs/setup/PROTOCOL_VERSION_GUIDE.en.md) | Tuya protocol troubleshooting (3.3/3.4/3.5) |
| [Tuya LocalKey Guide](docs/setup/Tuya_LocalKey_Homey_Guide_EN.pdf) | Credential retrieval (PDF) |
| [Quick Fix Guide](docs/setup/USER_QUICK_FIX.en.md) | Common problems and solutions |

### 🔧 Developer Documentation

Located in `/docs` directory:

| Directory | Contents | Audience |
|-----------|----------|----------|
| `setup/` | Installation, configuration, user tutorials | Users, Installers |
| `COP calculation/` | COP/SCOP algorithms and methodology | Advanced Users, HVAC Pros |
| `Heatpump specs/` | DPS mappings, capabilities, device specs | Developers |
| `architecture/` | Service architecture, code patterns | Developers |
| `Dev support/` | Testing guides, internal documentation | Developers only |

### Support

- **Issues**: Report bugs and feature requests on GitHub
- **Community**: Homey Community Forum (Topic ID: 143690)

## Release Notes

### v2.7.3 - Documentation Updates (Current)

**Documentation:**

- ✅ Expanded advanced-control guides (intro, flow cards, adaptive control, building insights)
- ✅ Updated configuration guide and added new setup screenshots
- ✅ Added German/French adaptive-control guides

---

### v2.4.0 - Building Insights & Recommendations

**New Feature:**

- ✅ **Building Insights & Recommendations**: Automated energy-saving recommendations with ROI estimates
- ✅ **Configurable Confidence Threshold**: Show insights after 24-48 hours learning (default: 70%)
- ✅ **Max Active Insights**: Limit info overload (1-5 insights, default: 3)

**Documentation:**

- ✅ Updated `CONFIGURATION_GUIDE.nl.md` with new section 7
- ✅ Full Dutch localization for all new settings

---

### v2.0.1 - Critical Fixes & Building Model Diagnostics

**Critical Flow Card Fix:**

- ✅ **Indoor Temperature Flow Card Now Works**: Fixed missing registration handler for `receive_external_indoor_temperature` action card
- ✅ **Full Logging Implementation**: Three-layer logging (device → service → confirmation) for complete traceability
- ✅ **Adaptive Control Unblocked**: Building Model Learner can now receive indoor temperature data from external sensors

**New Diagnostic Tool:**

- ✅ **Building Model Diagnostic Flow Card**: Comprehensive troubleshooting for tau/C/UA learning issues
- ✅ **Detailed Status Reporting**: 11 diagnostic fields including enabled state, sensor health, sample count, confidence level
- ✅ **Specific Blocking Reasons**: Clear error messages with actionable solutions
- ✅ **Timeline Guidance**: Expected progression (T+0 → T+50min → T+24h)

**Technical Implementation:**

```text
┌──────────────────────────────────────────────────┐
│  Indoor Temperature Flow Card Architecture      │
├──────────────────────────────────────────────────┤
│  User Flow → device.ts handler (3856-3870)      │
│  ↓                                               │
│  AdaptiveControlService.receiveExternalTemp()   │
│  ↓                                               │
│  ExternalTemperatureService validation          │
│  ↓                                               │
│  Capability update + logging                    │
└──────────────────────────────────────────────────┘
```

**User Impact:**

- Adaptive control Component 1 (HeatingController) can now function
- Component 2 (BuildingModelLearner) diagnostic tool available
- Clear troubleshooting path when tau remains at 50h default

**Files Changed:**

- `device.ts:3856-3870` - Indoor temperature flow card handler
- `device.ts:3872-3884` - Diagnostic flow card handler
- `lib/services/building-model-service.ts:212-302` - Diagnostic methods
- `.homeycompose/flow/actions/diagnose_building_model.json` - Flow card definition

---

### v1.0.31 - Comprehensive Connection Recovery System Overhaul

**Critical Stability Fix:**

- ✅ **Fixed 4-Hour Disconnection Bug**: Devices no longer stay offline for extended periods without automatic recovery
- ✅ **Reconnection Loop Always Active**: Timer management overhauled - monitoring continues even when connection appears "healthy"
- ✅ **Synergistic Architecture**: TCP keep-alive (OS-level) + Heartbeat (app-level verification) + DPS refresh (NAT maintenance)
- ✅ **Eliminated Race Conditions**: Removed self-terminating callbacks and concurrent operation conflicts
- ✅ **Proper Error Recovery**: Failed reconnection attempts now properly trigger exponential backoff instead of silent failure

**Technical Changes:**

- 🔧 Fixed early exit break in `scheduleNextReconnectionAttempt()` (always reschedule, never break recursion)
- 🔧 Removed DPS refresh zombie detection (heartbeat handles this, prevents temporal paradoxes)
- 🔧 Added recovery path on `forceReconnect()` failure (proper backoff on reconnection failure)
- 🔧 Simplified DPS refresh (NAT keep-alive only, no wait loops)
- 🔧 Added concurrent `forceReconnect()` safeguard (prevents race conditions)

**Impact:**

- Devices now auto-recover from extended outages (previously required manual "Force Reconnect")
- Zero race conditions between monitoring mechanisms
- Clear timer loop that never breaks or gets stuck
- Heartbeat and DPS refresh work together without interference

**Reference:** See `docs/Dev support/Architectural overview/v1.0.31-connection-recovery-overhaul.md` for complete technical documentation.

---

### v0.99.62 - Settings-Based Credential Management

**Simplified User Experience:**

- ✅ **Direct Settings Editing**: Update credentials directly in device settings form (no separate repair flow)
- ✅ **Single Source of Truth**: One clear way to update Device ID, Local Key, IP Address, Protocol Version
- ✅ **Auto-Reconnection**: Device reconnects automatically when credentials are saved
- ✅ **Backward Compatible**: All existing functionality preserved with simpler UX

**Technical Changes:**

- ✅ Removed repair flow - credentials now editable via `type: "text"` and `type: "dropdown"` settings fields
- ✅ Credential change detection in `device.onSettings()` triggers automatic reconnection
- ✅ ~40 lines less code to maintain
- ✅ Updated documentation ([REPAIR_MECHANISM_VALIDATION.md](docs/Dev%20support/Architectural%20overview/REPAIR_MECHANISM_VALIDATION.md))

**User Path:**

Device Settings → Scroll to top → Edit credentials → Save → Auto-reconnect (1-2 minutes)

This release simplifies credential management by eliminating the intermediary repair dialog.

### v0.99.59 - Protocol Version Selection

**Critical Feature:**

- ✅ **Protocol Version Selection**: Choose Tuya protocol version (3.3, 3.4, 3.5) during pairing
- ✅ **ECONNRESET Resolution**: Solves persistent connection issues caused by protocol mismatch
- ✅ **Backward Compatible**: Existing devices continue using protocol 3.3 automatically

**Technical Implementation:**

- ✅ Protocol version stored in both device store and settings for reliability
- ✅ Automatic reconnection when protocol version changes
- ✅ Comprehensive user documentation ([USER_QUICK_FIX.en.md](docs/setup/USER_QUICK_FIX.en.md), [PROTOCOL_VERSION_GUIDE.en.md](docs/setup/PROTOCOL_VERSION_GUIDE.en.md))

This release resolved connection stability issues for users with devices requiring non-default protocol versions.

### v0.99.58 - ECONNRESET Stability Improvements

**Critical Fix:**

- ✅ App no longer crashes on network interruptions
- ✅ Fixed connection reset errors causing app unresponsiveness
- ✅ Automatic reconnection now works correctly after ECONNRESET

This version improved stability but required manual app reinstall if protocol version was incorrect. v0.99.59 adds user-controllable protocol selection.

### v0.99.57 - Documentation Update

**Improvements:**

- ✅ Enhanced installation guides
- ✅ Updated technical documentation
- ✅ Improved architecture overview

### v0.99.56 - Dual Picker/Sensor Architecture

**Enhanced UX:**

- ✅ Added dual picker/sensor architecture for heating and hot water curve controls
- ✅ New `enable_curve_controls` setting toggles picker visibility (default: disabled)
- ✅ Sensor capabilities always visible for status monitoring
- ✅ Picker capabilities optional for advanced users
- ✅ Flow cards functional regardless of picker visibility

**Technical Implementation:**

- ✅ DPS 11: `adlar_enum_capacity_set` (picker) + `adlar_sensor_capacity_set` (sensor)
- ✅ DPS 13: `adlar_enum_countdown_set` (sensor) + `adlar_picker_countdown_set` (picker)
- ✅ Single DPS update maintains consistency across both capabilities
- ✅ Cleaner default UI while preserving full control for power users

This release resolves the iPhone picker bug by providing always-visible read-only status displays with optional control pickers.

### v0.99.49 - Deep Socket Handler Timing Fix

**Critical Timing Fix:**
- ✅ Fixed v0.99.48 handler installation timing - now installs AFTER `.connect()` when socket exists
- ✅ TuyAPI only creates `.device` object during connection, not during constructor
- ✅ Handler now reinstalls after EVERY successful reconnection (not just initial connection)
- ✅ Added idempotent listener cleanup with `removeAllListeners('error')` to prevent duplicates
- ✅ Enhanced logging with emoji indicators (🛡️ ✅ ⚠️) for easier troubleshooting

**Why v0.99.48 Didn't Work:**
v0.99.48 installed the deep socket handler BEFORE calling `this.tuya.connect()`, but TuyAPI only creates the internal `.device` object DURING the connect call. Result: handler tried to attach to a non-existent object, leaving socket errors unhandled.

**v0.99.49 Solution:**
```typescript
await this.tuya.connect();              // Socket created HERE
this.installDeepSocketErrorHandler();   // Handler installed AFTER socket exists
```

Handler now installed at two critical points:
1. After initial connection in `initialize()`
2. After every successful reconnection in `connectTuya()`

This ensures the deep socket error handler is ALWAYS active on the actual socket.

### v0.99.48 - Deep Socket Error Interception (Timing Issue)

**Note:** This version had a timing bug - handler installed before socket existed. See v0.99.49 for fix.

**Attempted Fix:**
- Added deep socket error handler concept
- Accessed TuyAPI's internal `.device` object
- Integration with error recovery system

**Issue Identified:**
Handler installed too early (before `.connect()`), so `.device` object didn't exist yet.

### v0.99.47 - Real-time Connection Status

**New Features:**
- ✅ Added `adlar_connection_status` capability for live connection monitoring
- ✅ Real-time status updates every 5 seconds (connected/disconnected/reconnecting/error)
- ✅ Visual connection status icon with matching app design style
- ✅ Enhanced user visibility into Tuya device connection health

**Technical Implementation:**
- ✅ TuyaConnectionService tracks connection state changes at all transition points
- ✅ Device.ts polls status via ServiceCoordinator every 5 seconds
- ✅ Status enum properly differentiates recoverable reconnections from critical errors

This release provides users with immediate visibility into device connectivity status.

### v0.99.46 - Production-Ready Release

**Critical Fixes:**
- ✅ Fixed ECONNRESET crash bug during connection failures
- ✅ Implemented unhandled promise rejection protection in async callbacks
- ✅ Added global error handlers (`unhandledRejection`, `uncaughtException`)

**Enhanced User Experience:**
- ✅ Automatic device status updates (unavailable during outages, available after reconnection)
- ✅ Triple-layer crash prevention architecture
- ✅ Enhanced connection resilience with improved recovery notifications

**Technical Improvements:**
- ✅ `.catch()` handlers on all setTimeout/setInterval async callbacks
- ✅ Device availability sync with TuyaConnectionService connection state
- ✅ Comprehensive error logging for production diagnostics

**Icon Updates:**
- ✅ Added custom countdown timer icon (`adlar_countdowntimer`) matching app visual style

This release marks the transition from beta to production-ready stability.

### Previous Releases

See [.homeychangelog.json](.homeychangelog.json) for complete release history.

## License

Developed for the Homey platform following official app development guidelines.
