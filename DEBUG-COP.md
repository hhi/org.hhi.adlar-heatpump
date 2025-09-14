# COP Calculation Debugging Guide

## Overview

The Coefficient of Performance (COP) calculation system in the Adlar Heat Pump app implements three calculation methods with automatic method selection and comprehensive outlier detection. This guide provides detailed debugging information for troubleshooting COP calculation issues.

## COP Calculation Methods

### Method 1: Direct Thermal Calculation (Most Accurate ±5%)

**Formula**: `COP = Q_thermal / P_electrical`
where `Q_thermal = ṁ × Cp × ΔT`

**Required Data Sources**:
- `electricalPower` (Watts) - From device capability `measure_power` or external power device
- `waterFlowRate` (L/min) - From device capability `measure_water` or external flow device  
- `inletTemperature` (°C) - From device capability `measure_temperature.temp_top`
- `outletTemperature` (°C) - From device capability `measure_temperature.temp_bottom`

**Calculation Steps**:
1. Convert flow rate: L/min → kg/s (assumes water density ≈ 1 kg/L)
2. Calculate temperature difference: `ΔT = outlet - inlet`
3. Calculate thermal output: `Q = (flow/60) × 4186 × ΔT` (Watts)
4. Calculate COP: `COP = Q / electrical_power`

### Method 2: Carnot Estimation (Medium Accuracy ±15%)

**Formula**: `COP = Carnot_COP × η_practical`
where `Carnot_COP = T_hot / (T_hot - T_cold)`

**Required Data Sources**:
- `outletTemperature` (°C) - Hot side temperature
- `ambientTemperature` (°C) - Cold side temperature
- `compressorFrequency` (Hz) - Used for efficiency factor

**Calculation Steps**:
1. Convert temperatures to Kelvin: `T_K = T_C + 273.15`
2. Calculate Carnot COP: `COP_carnot = T_hot_K / (T_hot_K - T_cold_K)`
3. Calculate efficiency factor based on compressor frequency
4. Calculate practical COP: `COP = COP_carnot × efficiency_factor`

### Method 3: Temperature Difference Estimation (Basic ±30%)

**Required Data Sources**:
- `inletTemperature` (°C)
- `outletTemperature` (°C)

**Empirical Relationships**:
- ΔT < 5°C: COP = 2.0
- 5°C ≤ ΔT < 15°C: COP = 2.5 + (ΔT - 5) × 0.15 
- ΔT ≥ 15°C: COP = 4.0 (capped)
- During defrost: COP × 0.5 (minimum 1.0)

## Debug Tools and Commands

### 1. Debug Script Usage

```bash
# Run all test scenarios
node debug-cop.js

# Run with verbose logging
node debug-cop.js --verbose

# Run real-time simulation
node debug-cop.js --simulate

# Test specific method only
node debug-cop.js --method=direct_thermal
```

### 2. Enable Debug Logging in Homey

Set environment variable: `DEBUG=1`

This will enable detailed COP debugging logs including:
- Data source availability for each method
- Calculation method selection logic
- Detailed calculation results with confidence levels
- Outlier detection analysis
- External device data retrieval status

### 3. Device Settings Debugging

Navigate to device settings and enable:
- **COP calculation enabled**: Main toggle for COP functionality
- **COP calculation method**: Force specific method or use auto-selection
- **COP outlier detection enabled**: Enable/disable outlier filtering
- **Generate capability diagnostics report**: One-time detailed capability health report

## Common COP Debugging Issues

### Issue 1: COP Shows 0 or No Value

**Symptoms**: COP capability shows 0 or no data updates

**Debugging Steps**:
1. Check if COP capability is enabled: `this.hasCapability('adlar_cop')`
2. Verify COP calculation is enabled in settings: `cop_calculation_enabled = true`
3. Check data availability with debug logging:
   ```javascript
   DEBUG=1 // Enable in environment
   // Look for: "🔍 COP Method Data Availability"
   ```

**Common Causes**:
- Missing required data sources (power, flow, temperatures)
- All calculation methods return insufficient data
- COP calculation disabled in device settings
- External devices not configured correctly

### Issue 2: COP Values Seem Incorrect/Unrealistic

**Symptoms**: COP values too high (>8) or too low (<1)

**Debugging Steps**:
1. Check outlier detection logs: Look for "⚠️ COP outlier detected"
2. Verify sensor readings are realistic:
   - Power consumption: 1-5kW typical
   - Water flow: 15-40 L/min typical
   - Temperature difference: 5-15°C typical
3. Review calculation method used and confidence level

**Common Causes**:
- Faulty power meter reading (very low power = high COP)
- Incorrect flow meter reading (very high flow = high COP)
- Temperature sensor malfunction
- Calculation during startup/shutdown transients

### Issue 3: COP Method Selection Issues

**Symptoms**: Expected method not used, always falls back to basic method

**Debugging Steps**:
1. Check data availability logs for each method
2. Verify external device configurations
3. Review method forcing settings: `cop_calculation_method`

**Data Requirements Checklist**:
- **Direct Thermal**: Power ✓, Flow ✓, Inlet Temp ✓, Outlet Temp ✓
- **Carnot Estimation**: Outlet Temp ✓, Ambient Temp ✓, Compressor Freq ✓  
- **Temperature Difference**: Inlet Temp ✓, Outlet Temp ✓

### Issue 4: External Device Integration Problems

**Symptoms**: External power/flow/temperature devices not providing data

**Debugging Steps**:
1. Check external device configuration in settings
2. Verify device IDs and capability names
3. Review external device error logs
4. Test device connectivity independently

**Configuration Example**:
```json
{
  "external_power_enabled": true,
  "external_power_device_id": "abc123-power-meter",  
  "external_power_capability": "measure_power",
  "external_flow_enabled": true,
  "external_flow_device_id": "def456-flow-sensor",
  "external_flow_capability": "measure_water"
}
```

## COP Calculation Constants

### Physical Constants
- Water specific heat capacity: 4,186 J/(kg·K)
- Celsius to Kelvin conversion: +273.15

### COP Validity Ranges
- Minimum valid COP: 0.5
- Maximum valid COP: 8.0
- Typical air-to-water range: 2.5-4.5
- During defrost range: 1.0-2.0

### Carnot Efficiency Factors
- Base practical efficiency: 40% of theoretical Carnot
- Frequency factor: +10% per 100Hz
- Efficiency range: 30%-50%

### Temperature Difference Thresholds
- Low efficiency (<5°C): COP = 2.0
- Moderate efficiency (5-15°C): Linear interpolation 2.5-4.0
- High efficiency (>15°C): COP = 4.0 (capped)

## Troubleshooting Flowchart

```
COP = 0 or No Updates?
├─ YES → Check capability enabled → Check data sources → Check settings
└─ NO ↓

COP Values Unrealistic?
├─ YES → Check outlier logs → Verify sensors → Check calculation method
└─ NO ↓

Wrong Method Selected?
├─ YES → Check data availability → Verify external devices → Check method forcing
└─ NO ↓

External Devices Not Working?
├─ YES → Check device IDs → Verify capabilities → Test connectivity
└─ NO → COP system working correctly
```

## Flow Card Integration

### COP Efficiency Changed Trigger
- **Trigger**: `cop_efficiency_changed`
- **Tokens**: `current_cop`, `threshold_cop`, `calculation_method`, `confidence_level`
- **Condition**: COP change > 0.5 from previous value

### COP Efficiency Check Condition  
- **Condition**: `cop_efficiency_check`
- **Args**: COP threshold value
- **Returns**: true if current COP above/below threshold

### COP Outlier Detected Trigger
- **Trigger**: `cop_outlier_detected` 
- **Tokens**: `outlier_cop`, `outlier_reason`, `calculation_method`
- **Condition**: COP outside valid range or method-specific limits

## Performance Considerations

### Calculation Frequency
- Default interval: 30 seconds (`COP_CALCULATION_INTERVAL_MS`)
- Adjust based on system stability and data update frequency
- Avoid too frequent calculations to prevent system load

### Data Caching
- External device data is cached during calculation cycle
- Failed external device queries don't block internal calculations
- Timeout for external queries: 5 seconds

### Memory Usage
- COP calculation is stateless - no data accumulation
- Previous COP value stored only for change detection
- Minimal memory footprint

## Advanced Debugging Techniques

### 1. Manual COP Calculation Test

```javascript
// Test COP calculation with known values
const { COPCalculator } = require('./lib/services/cop-calculator');

const testData = {
  electricalPower: 2500,    // 2.5kW
  waterFlowRate: 30,        // 30 L/min  
  inletTemperature: 35,     // 35°C
  outletTemperature: 45,    // 45°C (10°C rise)
};

const result = COPCalculator.calculateCOP(testData);
console.log(`Expected COP ~4.0, Got: ${result.cop.toFixed(2)}`);
```

### 2. Capability Value Monitoring

```javascript
// Monitor capability values in real-time
setInterval(() => {
  console.log({
    power: this.getCapabilityValue('measure_power'),
    flow: this.getCapabilityValue('measure_water'), 
    inlet: this.getCapabilityValue('measure_temperature.temp_top'),
    outlet: this.getCapabilityValue('measure_temperature.temp_bottom'),
    cop: this.getCapabilityValue('adlar_cop')
  });
}, 10000); // Every 10 seconds
```

### 3. External Device Query Test

```javascript
// Test external device connectivity
if (this.externalDeviceManager) {
  const result = await this.externalDeviceManager.getExternalDeviceData(
    this.copSettings.externalDevices
  );
  console.log('External device data:', result);
  console.log('Errors:', result.errors);
}
```

## Enhanced Debug Output

With the enhanced debugging system (device.ts lines 716-945), you'll see detailed logs like:

```
🔍 COP Method Data Availability:
  ✅ Direct Thermal: 4/4 fields available
  ❌ Carnot Estimation: 2/3 fields available
      Missing: compressorFrequency
  ✅ Temperature Difference: 2/2 fields available

📊 COP Calculation Result:
  🎯 Method: direct_thermal
  🎯 COP Value: 3.854
  🟢 Confidence: high
  📊 Data Sources Used:
    • electricalPower: 2500 (device)
    • waterFlowRate: 30 (device)
    • temperatureDifference: 10 (device)
  🔬 Calculation Details:
    • thermalOutput: 20930.000
    • massFlowRate: 0.500
```

## Best Practices

1. **Always enable debug logging** when troubleshooting COP issues
2. **Verify sensor accuracy** before investigating calculation algorithms  
3. **Use direct thermal method when possible** for highest accuracy
4. **Monitor outlier detection** to catch sensor malfunctions early
5. **Configure external devices properly** for redundant data sources
6. **Test with known scenarios** using the debug script
7. **Check capability health** regularly using diagnostic reports

## Support and Maintenance

For ongoing COP calculation issues:

1. **Enable comprehensive logging** with `DEBUG=1`
2. **Run the debug script** with various test scenarios
3. **Generate capability diagnostics** from device settings  
4. **Monitor flow card triggers** for automated issue detection
5. **Review external device logs** for connectivity issues

The enhanced debugging system provides visibility into every aspect of the COP calculation process, making it much easier to identify and resolve issues quickly.