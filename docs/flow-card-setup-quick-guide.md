# Flow Card Setup Quick Guide

## Overview

The Adlar Heat Pump can receive external measurement data from other Homey devices using flow cards to improve COP calculation accuracy. This creates a direct data sharing system where external sensors automatically send their measurements to the heat pump.

![External Power Measurement Setup](Flow%20Card%20handling/COP%20-%20external%20power%20measure.png)

## Required vs Optional Components

### ✅ **Required Components**

- **WHEN Card**: External device trigger (e.g., "The power has changed")
- **THEN Card**: Send data action (e.g., "Send power data to heat pump")
- **Data Connection**: Measurement value must be passed from trigger to action

### ⚠️ **Optional Components**

- **AND Conditions**: Add reliability checks (device online, data valid, etc.)
- **ELSE Actions**: Error handling and notifications

## ⚠️ Important: Data Freshness

**External devices send data whenever their measurements change.** The heat pump uses the most recent data received within the last 5 minutes for COP calculations. More frequent updates result in more accurate COP calculations.

## Basic Setup (Direct Data Sharing)

### Step 1: Create External Data Flow

#### WHEN (Trigger)

- [Your Power Meter] The power has changed
- Device: Your external power measuring device (e.g., "Heat Pump kWh - Meter box")

#### THEN (Action)

- Send power data to heat pump for COP calculation
- Device: [Your Heat Pump] (e.g., "Intelligent Heat Pump - House")
- power_value: `{{power}}` *(from trigger token - current measurement)*

This flow enables external power meters to automatically share their measurements with the heat pump device, allowing for more accurate COP calculations using actual measured power consumption.

## Enhanced Setup (With AND Conditions)

### WHEN (Enhanced Trigger)

- [Your Power Meter] The power has changed

### AND *(Optional but Recommended)*

- Smart meter is available
- Power reading > 0W AND < 50000W
- Power reading is different from previous value

### THEN (Enhanced Action)

- Send power data to heat pump for COP calculation

### ELSE *(Optional Error Handling)*

- Send notification: "Invalid power data detected"

## Data Types Supported

| Type | External Device Trigger | Heat Pump Action Card | Data Field |
|------|------------------------|----------------------|------------|
| Power | Device power measurement changed | `receive_external_power_data` | `power_value` (W) |
| Flow | Device flow measurement changed | `receive_external_flow_data` | `flow_value` (L/min) |
| Temperature | Device temperature changed | `receive_external_ambient_data` | `temperature_value` (°C) |

## Common Issues & Solutions

### ❌ "External data not being used"

**Cause**: Flow not triggering or data not reaching heat pump
**Solutions**:

- Check flow is enabled and working
- Verify external device is online and reporting data
- Test flow manually to ensure action card executes

### ❌ "Data values seem incorrect"

**Cause**: Wrong token or measurement unit mismatch
**Solutions**:

- Verify correct trigger token is used (e.g., `{{power}}` for power measurements)
- Check measurement units match expected values (W for power, L/min for flow, °C for temperature)

### ❌ Data not used in COP calculation

**Cause**: Invalid data values or late responses
**Solutions**:

- Ensure realistic data ranges (power: 100-50000W)
- Check device logs for validation errors
- Test manual flow execution

## Benefits by Data Type

### Power Data Integration

- **Accuracy**: ±5% vs ±30% with internal estimates
- **Method**: Upgrades to "Direct Thermal" calculation
- **Requirements**: Smart meter with real-time power readings
- **Setup**: External power meter → "power changed" trigger → "Send power data to heat pump" action

### Flow Data Integration

- **Accuracy**: ±8% thermal calculations
- **Method**: Enables precise heat transfer calculations
- **Requirements**: Water flow sensor in heating circuit

### Temperature Data Integration

- **Accuracy**: ±12% ambient compensation
- **Method**: Better weather-adjusted efficiency
- **Requirements**: Outdoor temperature sensor

## Testing Your Setup

1. **Manual Test**: Trigger your external device to generate new measurements
2. **Check Flow**: Verify flow executes when external device data changes
3. **Check Logs**: Heat pump logs show incoming external data
4. **Verify Data**: External data appears in heat pump diagnostics ("External Power Measurement" capability)
5. **Monitor COP**: Watch for calculation method improvements and "direct_thermal" method usage

The system automatically chooses the best calculation method based on available data sources, with external data enabling the most accurate COP calculations possible.
