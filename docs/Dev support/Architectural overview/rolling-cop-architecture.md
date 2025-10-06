# Rolling COP Calculation Documentation

## Overview

The Rolling COP (Coefficient of Performance) system provides time-series analysis of heat pump efficiency, enabling trend monitoring, performance optimization, and predictive maintenance. This system is implemented as the **RollingCOPCalculator service** (`lib/services/rolling-cop-calculator.ts`), which complements the real-time COPCalculator service by providing historical context and pattern analysis.

## RollingCOPCalculator Service Architecture (v0.99.23+)

The Rolling COP calculation system is implemented as a dedicated service managed by the ServiceCoordinator, providing time-series analysis with daily, weekly, and monthly rolling averages.

### Service Integration

**RollingCOPCalculator** is one of 8 core services managed by ServiceCoordinator:

```typescript
class ServiceCoordinator {
  private rollingCOPCalculator: RollingCOPCalculator | null = null;

  async initialize(config: ServiceConfig): Promise<void> {
    this.rollingCOPCalculator = new RollingCOPCalculator(device, logger);
    await this.rollingCOPCalculator.initialize();

    // Wire cross-service events
    this.copCalculator.on('cop-calculated', (data) => {
      this.rollingCOPCalculator.addDataPoint(data);
    });
  }
}
```

**Cross-Service Integration**:

- **COPCalculator**: RollingCOPCalculator subscribes to `cop-calculated` events for real-time data collection
- **CapabilityHealthService**: Validates data point quality before storage in circular buffer
- **SettingsManagerService**: Persists circular buffer (1440 data points ≈ 288KB) across app restarts
- **ServiceCoordinator**: Manages initialization, lifecycle, and cross-service event wiring

### Event-Driven Data Flow

```typescript
// Real-time data collection via service events
class COPCalculator {
  calculateCOP() {
    const cop = this.performCalculation();

    // Emit event for other services
    this.emit('cop-calculated', {
      timestamp: Date.now(),
      cop: cop.value,
      method: cop.method,
      confidence: cop.confidence,
      compressorRuntime: this.getCompressorRuntime()
    });
  }
}

// RollingCOPCalculator listens for events
class RollingCOPCalculator {
  initialize() {
    // Subscribe to COPCalculator events via ServiceCoordinator
    this.serviceCoordinator.getCOPCalculator().on('cop-calculated', (data) => {
      this.addDataPoint(data);
      this.updateRollingAverages();
    });
  }
}
```

### Service Memory Management

**Circular Buffer Architecture**:

- Service maintains 1440 data points in memory (24h × 60min intervals)
- Automatic cleanup of stale data older than 2× time window
- Persistence via SettingsManagerService for app restart survival
- Memory-efficient incremental updates (O(n) complexity)

**Service Constants Integration**:

```typescript
// Rolling COP calculation constants from DeviceConstants
static readonly ROLLING_COP_DATA_POINTS = 1440;        // 24h × 60min
static readonly ROLLING_COP_MIN_DATA_POINTS = 12;     // 6 hours minimum
static readonly ROLLING_COP_UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
static readonly ROLLING_COP_OUTLIER_THRESHOLD = 2.5;  // Standard deviations
static readonly ROLLING_COP_IDLE_MONITOR_INTERVAL_MS = 30 * 60 * 1000; // 30 min
```

### Service Benefits

1. **Separation of Concerns**: Time-series analysis isolated from real-time COP calculations
2. **Event-Driven Updates**: Automatic data collection via COPCalculator event subscription
3. **Data Persistence**: SettingsManagerService handles circular buffer storage across restarts
4. **Independent Testing**: Service can be unit tested independently of device class
5. **Service Health Monitoring**: ServiceCoordinator tracks data collection and calculation status

## Key Features

### Time-Based Averages
- **Daily COP**: 24-hour rolling average for day-to-day optimization
- **Weekly COP**: 7-day rolling average for seasonal pattern identification
- **Monthly COP**: 30-day rolling average for seasonal trend analysis and long-term monitoring
- **Hourly COP**: 60-minute rolling average for immediate trend analysis

### Trend Analysis
- **Performance trends**: Automatically detects improving, stable, or degrading efficiency patterns
- **Trend strength**: Quantifies the significance of performance changes (0-1 scale)
- **Predictive insights**: Early warning system for potential maintenance needs

### Data Quality Management
- **Outlier detection**: Statistical filtering removes unrealistic COP values
- **Confidence levels**: High/medium/low confidence based on data quality and quantity
- **Weighting methods**: Multiple algorithms for data aggregation

## New Capabilities

### `adlar_cop_daily`
- **Purpose**: 24-hour rolling average COP with intelligent idle period handling
- **Update frequency**: Every 5 minutes (when new data is available)
- **Minimum data**: 12 data points (6 hours worth at 30-minute intervals)
- **Weighting**: Runtime-weighted by compressor operation time
- **Idle Awareness**: Returns `null` for predominantly idle periods instead of misleading averages

### Idle-Aware Daily COP Behavior
- **Null Return Conditions**:
  - >70% of 24-hour window contains idle periods
  - Newest data point is >4 hours old (stale data)
  - <6 data points available (insufficient operation)
- **Partial Idle Handling**: For 30-70% idle periods, applies adjustment factor (reduces COP by up to 50%)
- **Confidence Adjustment**: Lowers confidence level to 'medium' for mixed idle/active periods

### `adlar_cop_weekly`
- **Purpose**: 7-day rolling average COP
- **Update frequency**: Every 5 minutes (when new data is available)
- **Minimum data**: 48 data points (24 hours worth)
- **Use case**: Seasonal pattern identification and long-term monitoring

### `adlar_cop_monthly`
- **Purpose**: 30-day rolling average COP for seasonal trend analysis
- **Update frequency**: Every 5 minutes (when new data is available)
- **Minimum data**: 48 data points (24 hours worth)
- **Use case**: Long-term efficiency monitoring, seasonal pattern identification, and performance baseline establishment
- **Benefits**:
  - Identifies gradual performance degradation over time
  - Establishes seasonal efficiency baselines
  - Helps optimize maintenance schedules
  - Provides data for warranty and performance claims

### `adlar_cop_trend`
- **Purpose**: Text description of current efficiency trend
- **Values**: "Strong improvement", "Moderate decline", "Stable performance", etc.
- **Analysis period**: Last 24 hours
- **Trigger threshold**: 15% change required for trend detection

## Flow Cards

### Trigger Cards

#### `daily_cop_efficiency_changed`
Triggers when 24-hour average COP crosses user-defined thresholds.

**Arguments:**
- Condition: above/below
- Threshold: COP value (1.0-8.0)

**Tokens:**
- `current_daily_cop`: Current 24-hour average
- `threshold_cop`: User-defined threshold
- `data_points`: Number of measurements used
- `confidence_level`: Data quality indicator

**Important Behavior Changes:**
- **Null Handling**: Flow cards will NOT trigger when daily COP is null due to:
  - Excessive idle periods (>70%)
  - Stale data (>4 hours old)
  - Insufficient operation data (<6 points)
- **Mixed Idle Periods**: Flow cards trigger with adjusted COP values for 30-70% idle periods
- **Confidence Impact**: Idle-adjusted COPs always have 'medium' or lower confidence

#### `monthly_cop_efficiency_changed`
Triggers when 30-day average COP crosses user-defined thresholds.

**Arguments:**
- Condition: above/below
- Threshold: COP value (1.0-8.0)

**Tokens:**
- `current_monthly_cop`: Current 30-day average
- `threshold_cop`: User-defined threshold
- `data_points`: Number of measurements used
- `confidence_level`: Data quality indicator

**Use Cases:**
- Long-term performance monitoring
- Seasonal efficiency tracking
- Maintenance scheduling based on gradual degradation
- Performance warranty validation

#### `cop_trend_detected`
Triggers when significant efficiency trends are detected.

**Arguments:**
- Trend type: improving/degrading/any

**Tokens:**
- `trend_direction`: "improving", "stable", or "degrading"
- `trend_strength`: Numerical strength (0-1)
- `trend_description`: Human-readable description
- `current_daily_cop`: Current daily average

### Condition Cards

#### `daily_cop_above_threshold`
Checks if 24-hour average COP is above/below a threshold.

**Arguments:**
- Threshold: COP value to compare against

#### `monthly_cop_above_threshold`
Checks if 30-day average COP is above/below a threshold.

**Arguments:**
- Threshold: COP value to compare against

**Use Cases:**
- Long-term performance validation
- Seasonal efficiency comparisons
- Maintenance decision automation
- Performance contract verification

#### `cop_trend_analysis`
Analyzes COP trend over a specified time period.

**Arguments:**
- Hours: Time period to analyze (1-168 hours)

## Technical Implementation (Service Architecture)

### Data Storage (RollingCOPCalculator Service)

**Service-Managed Circular Buffer**:

- **Storage**: RollingCOPCalculator maintains circular buffer of 1440 data points in memory
- **Persistence**: SettingsManagerService handles storage for app restart survival
- **Memory management**: Service performs automatic cleanup of old data points
- **Event-Driven Collection**: Adds data points on `cop-calculated` events from COPCalculator

**Service Storage Pattern**:

```typescript
class RollingCOPCalculator {
  private dataPoints: COPDataPoint[] = [];

  async addDataPoint(data: COPDataPoint): Promise<void> {
    // Validate via CapabilityHealthService
    const isHealthy = this.serviceCoordinator
      .getCapabilityHealth()
      .isDataHealthy(data);

    if (isHealthy) {
      this.dataPoints.push(data);
      this.trimOldData();

      // Persist via SettingsManagerService
      await this.serviceCoordinator
        .getSettingsManager()
        .saveRollingCOPData(this.dataPoints);
    }
  }
}
```

### Enhanced COPDataPoint Interface
```typescript
interface COPDataPoint {
  timestamp: number;        // Unix timestamp
  cop: number;             // Calculated COP value
  method: string;          // Calculation method used ('idle_period' for idle tracking)
  confidence: string;      // Data confidence level
  electricalPower?: number; // Power consumption (Watts)
  thermalOutput?: number;   // Heat output (Watts)
  ambientTemperature?: number; // Ambient temperature (°C)
  compressorRuntime?: number; // Minutes compressor was running
  isIdlePeriod?: boolean;   // NEW: Flag indicating idle period data point
}
```

### Automatic Idle Period Monitoring
- **Monitoring Frequency**: Checks every 30 minutes for extended idle periods
- **Idle Detection**: Compressor off + no COP data points for >1 hour
- **Auto Data Points**: Automatically adds COP=0 data points during extended idle
- **Data Point Properties**:
  - `cop: 0` (zero efficiency during idle)
  - `method: 'idle_period'`
  - `confidence: 'high'` (high confidence that idle = 0 COP)
  - `isIdlePeriod: true`
- **Purpose**: Prevents gaps in time-series data and enables accurate idle ratio calculations

### Calculation Methods

#### 1. Simple Average
Equal weight to all data points in time window.
```
COP_avg = Σ(COP_i) / n
```

#### 2. Time-Weighted Average
Recent data has higher weight with exponential decay.
```
weight_i = exp(-age_hours / 12)  // 12-hour half-life
COP_weighted = Σ(COP_i × weight_i) / Σ(weight_i)
```

#### 3. Enhanced Runtime-Weighted Average (Default)
Weight by compressor runtime for accurate efficiency representation.
```
COP_runtime = Σ(COP_i × runtime_i) / Σ(runtime_i)
```

**Enhanced Implementation:**
- **State History**: Maintains 48-hour compressor on/off state history
- **Precision Tracking**: Calculates exact runtime minutes in 30-minute windows
- **State Changes**: Automatically detects and records compressor state transitions
- **Runtime Bounds**: Clamps runtime between 0-30 minutes per calculation period

#### 4. Thermal-Weighted Average
Weight by actual heat output for most accurate representation.
```
COP_thermal = Σ(COP_i × thermal_output_i) / Σ(thermal_output_i)
```

### Outlier Detection
Statistical filtering using configurable standard deviation thresholds:
- Default: 2.5 standard deviations
- Minimum 3 data points required for outlier detection
- Outliers excluded from rolling calculations

### Trend Detection Algorithm
1. **Data preparation**: Sort by timestamp, split into first/last thirds
2. **Average calculation**: Calculate average COP for each third
3. **Change detection**: Compare averages to determine trend direction
4. **Strength quantification**: Percentage change indicates trend strength
5. **Threshold application**: 15% change required for trend classification

## Configuration Options

### RollingCOPConfig Interface
```typescript
{
  timeWindow: number;        // Minutes to include (default: 1440 = 24h)
  minDataPoints: number;     // Minimum points for valid calculation (default: 12)
  outlierThreshold: number;  // Standard deviations for outlier detection (default: 2.5)
  weightingMethod: string;   // 'simple' | 'time_weighted' | 'runtime_weighted' | 'thermal_weighted'
  trendSensitivity: number;  // 0-1, change threshold for trends (default: 0.15)
  confidenceThresholds: {
    high: number;    // Min % of high-confidence data (default: 0.6)
    medium: number;  // Min % of medium+ confidence data (default: 0.8)
  }
}
```

## Integration with Existing Systems (Service Architecture)

### Real-Time COP Integration (Service Events)

**Event-Driven Data Collection**:

- **Event Subscription**: RollingCOPCalculator subscribes to COPCalculator's `cop-calculated` events
- **Unified confidence**: Uses same confidence levels from COPCalculator service
- **Method tracking**: Records which calculation method was used (direct thermal, power module, etc.)
- **External data**: Integrates with external device measurements via EnergyTrackingService
- **Service Coordination**: ServiceCoordinator manages event wiring between services

**Cross-Service Event Flow**:

1. COPCalculator calculates COP value
2. COPCalculator emits `cop-calculated` event
3. ServiceCoordinator routes event to subscribers
4. RollingCOPCalculator receives event
5. CapabilityHealthService validates data quality
6. RollingCOPCalculator adds data point to buffer
7. SettingsManagerService persists updated buffer

### SCOP Integration (Service Collaboration)

**Complementary Service Architecture**:

- **Rolling COP**: Short-term efficiency trends (RollingCOPCalculator service)
- **SCOP**: Seasonal efficiency averages (SCOPCalculator service)
- **Shared data sources**: Both services consume COPCalculator `cop-calculated` events
- **Consistency**: Aligned calculation confidence and quality indicators via CapabilityHealthService
- **Service Coordination**: ServiceCoordinator manages lifecycle and data sharing

## Automation Examples

### Energy Management
```
WHEN: Daily COP efficiency changed above 3.5
AND:  Time is between 22:00 and 06:00
THEN: Increase target temperature by 1°C
```

### Maintenance Alerts
```
WHEN: COP trend detected: degrading
AND:  Trend strength > 0.3
THEN: Send notification "Heat pump efficiency declining - schedule maintenance"
```

### Performance Optimization
```
WHEN: Daily COP above threshold 4.0
AND:  Weekly COP above threshold 3.8
THEN: Log "Optimal performance period - record settings"
```

### Long-Term Monitoring
```
WHEN: Monthly COP efficiency changed below 2.8
AND:  Monthly COP confidence level is high
THEN: Send notification "Monthly efficiency below baseline - investigate"
```

### Seasonal Performance Tracking
```
WHEN: Monthly COP above threshold 3.5
AND:  Current month is between October and March
THEN: Log "Excellent winter season performance"
```

### Maintenance Scheduling
```
WHEN: Monthly COP efficiency changed below 3.0
AND:  Monthly COP data points > 1000
THEN: Create task "Schedule heat pump maintenance - efficiency declining"
```

## Performance Considerations

### Update Frequency
- **Real-time data**: New COP measurements every 30 seconds
- **Rolling updates**: Capability updates every 5 minutes
- **Flow triggers**: Only for significant changes (>15% trend strength)

### Memory Usage
- **Data points**: ~1440 points × 200 bytes ≈ 288KB per device
- **Automatic cleanup**: Removes data older than 2× time window
- **Persistence**: Compressed storage in device settings

### CPU Impact
- **Calculation complexity**: O(n) for averages, O(n log n) for outlier detection
- **Update timing**: Spread across 5-minute intervals to avoid load spikes
- **Optimization**: Cached calculations with incremental updates

## Troubleshooting

### Common Issues

#### No Rolling COP Data
- **Cause**: Insufficient real-time COP measurements
- **Solution**: Verify COP calculation is enabled and functioning
- **Minimum**: 12 data points required (6 hours of operation)

#### Unrealistic Rolling Values
- **Cause**: Outlier detection disabled or poor data quality
- **Solution**: Enable outlier detection, check sensor accuracy
- **Verification**: Review confidence levels and data point counts

#### Missing Trend Detection
- **Cause**: Insufficient trend strength or data points
- **Solution**: Lower trend sensitivity or increase operation time
- **Threshold**: Default 15% change required for trend classification

### Enhanced Diagnostic Information
The `getDiagnosticInfo()` method now provides:
- **idleRatio**: Percentage of data points representing idle periods (0-1)
- **dataFreshness**: Hours since newest data point (indicates stale data)
- **averageInterval**: Time between data point collection (minutes)
- **confidenceDistribution**: Breakdown of high/medium/low confidence data points

Example diagnostic output:
```
Rolling COP Diagnostics:
- Data points in window: 48
- Idle ratio: 45.2%
- Data freshness: 1.2 hours
- Average interval: 30.5 minutes
- Confidence: 60% high, 30% medium, 10% low
```

### Debug Information
Enable debug mode (`DEBUG=1`) to see detailed logging:
- Data point additions with COP values
- Rolling calculation results with confidence levels
- Trend analysis with strength calculations
- Flow card trigger conditions and tokens
- Idle period detection and data point additions
- Data freshness and idle ratio calculations

## Future Enhancements

### Planned Features
- **Custom time windows**: User-configurable rolling periods
- **Comparative analysis**: COP vs. ambient temperature correlation
- **Performance benchmarking**: Compare against typical efficiency ranges
- **Historical reporting**: Weekly/monthly efficiency summaries

### Integration Opportunities
- **Smart thermostats**: Automatic temperature optimization based on efficiency trends
- **Energy management systems**: Peak efficiency period identification
- **Maintenance scheduling**: Predictive maintenance based on trend analysis
- **Cost optimization**: Efficiency-based operation scheduling

The Rolling COP system provides comprehensive time-series analysis of heat pump performance, enabling proactive optimization and maintenance while maintaining the accuracy and reliability of the existing real-time COP calculations.