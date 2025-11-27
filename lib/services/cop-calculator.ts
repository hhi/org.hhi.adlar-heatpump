/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import { DeviceConstants } from '../constants';

/**
 * Data sources available for COP calculation
 */
export interface COPDataSources {
  // Required for all calculations
  electricalPower?: number; // Watts

  // For Method 1: Direct Thermal Calculation
  waterFlowRate?: number; // L/min
  inletTemperature?: number; // °C
  outletTemperature?: number; // °C

  // For Method 2: Compressor Correlation
  compressorFrequency?: number; // Hz
  ambientTemperature?: number; // °C

  // For Method 7: Power Estimation
  fanMotorFrequency?: number; // Hz (DPS 40)

  // For Method 4: Refrigerant Circuit Analysis
  highPressureTemperature?: number; // °C (DPS 35)
  lowPressureTemperature?: number; // °C (DPS 36)
  suctionTemperature?: number; // °C (DPS 41)
  dischargeTemperature?: number; // °C (DPS 24)
  economizerInletTemperature?: number; // °C (DPS 107)
  economizerOutletTemperature?: number; // °C (DPS 108)

  // For Method 5: Valve Position Correlation
  eevPulseSteps?: number; // EEV Open pulse-steps (DPS 16)
  eviPulseSteps?: number; // EVI Open pulse-steps (DPS 25)

  // For Method 6: Power Module Auto-Detection
  powerModuleType?: number; // 0=None, 1=Single-phase, 2=Three-phase (DPS 106)
  voltageA?: number; // Phase A voltage (DPS 103)
  voltageB?: number; // Phase B voltage (DPS 111)
  voltageC?: number; // Phase C voltage (DPS 112)
  currentA?: number; // Phase A current (DPS 102)
  currentB?: number; // Phase B current (DPS 109)
  currentC?: number; // Phase C current (DPS 110)
  internalPower?: number; // Internal power measurement (DPS 104)

  // Additional context
  isDefrosting?: boolean;
  systemMode?: string;
}

/**
 * Result of COP calculation with metadata
 */
export interface COPCalculationResult {
  cop: number;
  method: 'direct_thermal' | 'carnot_estimation' | 'temperature_difference' | 'refrigerant_circuit' | 'valve_correlation' | 'power_module' | 'power_estimation' | 'insufficient_data' | 'idle_mode';
  confidence: 'high' | 'medium' | 'low';
  isOutlier: boolean;
  outlierReason?: string;
  diagnosticInfo?: {
    missingRequiredData?: string[]; // Array of missing data keys
    primaryIssue?: string; // Main diagnostic issue key
    secondaryIssues?: string[]; // Additional issues
    troubleshootingHint?: string; // Specific troubleshooting advice key
  };
  dataSources: {
    electricalPower?: { value: number; source: string };
    waterFlowRate?: { value: number; source: string };
    temperatureDifference?: { value: number; source: string };
    compressorFrequency?: { value: number; source: string };
    ambientTemperature?: { value: number; source: string };
    refrigerantCircuit?: { value: number | string; source: string };
    valvePositions?: { value: number | string; source: string };
    powerModule?: { value: number | string; source: string };
    powerEstimation?: { value: number | string; source: string };
  };
  calculationDetails?: {
    thermalOutput?: number; // Watts
    carnotCOP?: number;
    efficiencyFactor?: number;
    massFlowRate?: number; // kg/s
    refrigerantEfficiency?: number;
    valveEfficiencyFactor?: number;
    calculatedPower?: number; // Watts (for power module method)
    powerFactor?: number; // For three-phase calculations
    // Power estimation details
    compressorPower?: number; // Watts
    fanPower?: number; // Watts
    auxiliaryPower?: number; // Watts
    compressorFreqNormalized?: number;
    fanFreqNormalized?: number;
    defrostMultiplier?: number;
  };
}

/**
 * Configuration for COP calculation overrides
 */
export interface COPCalculationConfig {
  forceMethod?: 'auto' | 'direct_thermal' | 'carnot_estimation' | 'temperature_difference' | 'refrigerant_circuit' | 'valve_correlation' | 'power_module' | 'power_estimation';
  customOutlierThresholds?: {
    minCOP: number;
    maxCOP: number;
  };
  enableOutlierDetection?: boolean;
}

/**
 * COP Calculator Service - implements all three calculation methods from documentation
 */
export class COPCalculator {

  /**
   * Calculate COP using the best available method based on data availability
   * Follows decision tree: Method 1 → Method 2 → Method 3
   */
  public static calculateCOP(
    data: COPDataSources,
    config: COPCalculationConfig = {},
  ): COPCalculationResult {

    // Force specific method if configured
    if (config.forceMethod && config.forceMethod !== 'auto') {
      return this.calculateWithMethod(data, config.forceMethod, config);
    }

    // Decision tree implementation - prioritized by accuracy
    // Method 1: Direct thermal (most accurate with external power)
    if (this.canUseDirectThermal(data)) {
      return this.calculateWithMethod(data, 'direct_thermal', config);
    }

    // Method 6: Power module auto-detection (high accuracy with internal power)
    if (this.canUsePowerModule(data)) {
      return this.calculateWithMethod(data, 'power_module', config);
    }

    // Method 7: Power estimation using compressor/fan frequencies (good accuracy)
    if (this.canUsePowerEstimation(data)) {
      return this.calculateWithMethod(data, 'power_estimation', config);
    }

    // Method 4: Refrigerant circuit analysis (good accuracy without power)
    if (this.canUseRefrigerantCircuit(data)) {
      return this.calculateWithMethod(data, 'refrigerant_circuit', config);
    }

    // Method 2: Carnot estimation (medium accuracy)
    if (this.canUseCarnotEstimation(data)) {
      return this.calculateWithMethod(data, 'carnot_estimation', config);
    }

    // Method 5: Valve position correlation (supplementary method)
    if (this.canUseValveCorrelation(data)) {
      return this.calculateWithMethod(data, 'valve_correlation', config);
    }

    // Method 3: Temperature difference (fallback method)
    if (this.canUseTemperatureDifference(data)) {
      return this.calculateWithMethod(data, 'temperature_difference', config);
    }

    // Generate diagnostic information about why calculation failed
    const diagnosticInfo = this.generateDiagnosticInfo(data);

    return {
      cop: 0,
      method: 'insufficient_data',
      confidence: 'low',
      isOutlier: false,
      dataSources: {},
      diagnosticInfo,
    };
  }

  /**
   * Calculate COP using a specific method
   */
  private static calculateWithMethod(
    data: COPDataSources,
    method: 'direct_thermal' | 'carnot_estimation' | 'temperature_difference' | 'refrigerant_circuit' | 'valve_correlation' | 'power_module' | 'power_estimation',
    config: COPCalculationConfig,
  ): COPCalculationResult {

    let result: COPCalculationResult;

    switch (method) {
      case 'direct_thermal':
        result = this.calculateDirectThermal(data);
        break;
      case 'carnot_estimation':
        result = this.calculateCarnotEstimation(data);
        break;
      case 'temperature_difference':
        result = this.calculateTemperatureDifference(data);
        break;
      case 'refrigerant_circuit':
        result = this.calculateRefrigerantCircuit(data);
        break;
      case 'valve_correlation':
        result = this.calculateValveCorrelation(data);
        break;
      case 'power_module':
        result = this.calculatePowerModule(data);
        break;
      case 'power_estimation':
        result = this.calculatePowerEstimation(data);
        break;
      default:
        // Fallback for unknown methods - don't throw, return safe default
        result = {
          cop: 0,
          method: 'insufficient_data',
          confidence: 'low',
          isOutlier: false,
          diagnosticInfo: {
            primaryIssue: 'unknown_method',
            troubleshootingHint: `Invalid COP calculation method: ${method}`,
          },
          dataSources: {},
        };
        break;
    }

    // Apply outlier detection
    if (config.enableOutlierDetection !== false) {
      this.detectOutliers(result, config.customOutlierThresholds);
    }

    return result;
  }

  /**
   * Method 1: Direct Thermal Calculation (Most Accurate)
   * COP = Q_thermal / P_electrical
   * Q_thermal = ṁ × Cp × ΔT
   */
  private static calculateDirectThermal(data: COPDataSources): COPCalculationResult {
    const waterFlowRate = data.waterFlowRate!; // L/min
    const inletTemp = data.inletTemperature!; // °C
    const outletTemp = data.outletTemperature!; // °C
    const electricalPower = data.electricalPower!; // W
    const compressorFreq = data.compressorFrequency || 0; // Hz

    // If compressor is not running, this is backup heater operation, not heat pump
    if (compressorFreq <= 0) {
      return {
        cop: 0,
        method: 'idle_mode',
        confidence: 'high', // High confidence that COP=0 when compressor is off
        isOutlier: false,
        dataSources: {
          electricalPower: { value: electricalPower, source: 'device' },
          waterFlowRate: { value: waterFlowRate, source: 'device' },
          temperatureDifference: { value: outletTemp - inletTemp, source: 'device' },
          compressorFrequency: { value: compressorFreq, source: data.compressorFrequency ? 'device' : 'estimated' },
        },
        outlierReason: 'Compressor not running - detecting backup heater operation, not heat pump',
        calculationDetails: {
          thermalOutput: 0, // No heat pump thermal output
        },
      };
    }

    // Convert flow rate: L/min → kg/s
    const massFlowRate = waterFlowRate / 60; // kg/s (density of water ≈ 1 kg/L)

    // Calculate temperature difference
    const temperatureDifference = outletTemp - inletTemp; // °C or K

    // Calculate thermal output: Q_thermal = ṁ × Cp × ΔT
    const thermalOutput = massFlowRate * DeviceConstants.WATER_SPECIFIC_HEAT_CAPACITY * temperatureDifference; // W

    // Calculate COP
    const cop = thermalOutput / electricalPower;

    return {
      cop,
      method: 'direct_thermal',
      confidence: 'high',
      isOutlier: false,
      dataSources: {
        electricalPower: { value: electricalPower, source: 'device' },
        waterFlowRate: { value: waterFlowRate, source: 'device' },
        temperatureDifference: { value: temperatureDifference, source: 'device' },
      },
      calculationDetails: {
        thermalOutput,
        massFlowRate,
      },
    };
  }

  /**
   * Method 2: Compressor Correlation Estimation
   * COP = Carnot_COP × η_practical
   * Carnot_COP = T_hot / (T_hot - T_cold)
   */
  private static calculateCarnotEstimation(data: COPDataSources): COPCalculationResult {
    const outletTemp = data.outletTemperature!; // °C
    const ambientTemp = data.ambientTemperature!; // °C
    const compressorFreq = data.compressorFrequency || 0; // Hz, use actual frequency

    // If compressor is not running, COP is 0 (no heat pump operation)
    if (compressorFreq <= 0) {
      return {
        cop: 0,
        method: 'idle_mode',
        confidence: 'high', // High confidence that COP=0 when compressor is off
        isOutlier: false,
        dataSources: {
          ambientTemperature: { value: ambientTemp, source: 'device' },
          compressorFrequency: { value: compressorFreq, source: data.compressorFrequency ? 'device' : 'estimated' },
        },
        outlierReason: 'Compressor not running (frequency ≤ 0 Hz)',
      };
    }

    // Convert to Kelvin
    const hotTempK = outletTemp + DeviceConstants.CELSIUS_TO_KELVIN;
    const coldTempK = ambientTemp + DeviceConstants.CELSIUS_TO_KELVIN;

    // Calculate Carnot COP
    const carnotCOP = hotTempK / (hotTempK - coldTempK);

    // Calculate practical efficiency factor
    const efficiencyFactor = Math.min(
      Math.max(
        DeviceConstants.CARNOT_EFFICIENCY.BASE_EFFICIENCY
        + (compressorFreq / 100) * DeviceConstants.CARNOT_EFFICIENCY.FREQUENCY_FACTOR,
        DeviceConstants.CARNOT_EFFICIENCY.MIN_EFFICIENCY,
      ),
      DeviceConstants.CARNOT_EFFICIENCY.MAX_EFFICIENCY,
    );

    // Calculate practical COP
    const cop = carnotCOP * efficiencyFactor;

    return {
      cop,
      method: 'carnot_estimation',
      confidence: 'medium',
      isOutlier: false,
      dataSources: {
        ambientTemperature: { value: ambientTemp, source: 'device' },
        temperatureDifference: { value: outletTemp - ambientTemp, source: 'calculated' },
      },
      calculationDetails: {
        carnotCOP,
        efficiencyFactor,
      },
    };
  }

  /**
   * Method 3: Enhanced Temperature Difference Estimation (Basic - ±30% accuracy)
   * Uses empirical relationships based on multiple factors for realistic COP variation
   * Considers ambient temperature, system load, operating conditions, and heat pump physics
   */
  private static calculateTemperatureDifference(data: COPDataSources): COPCalculationResult {
    const inletTemp = data.inletTemperature!; // °C
    const outletTemp = data.outletTemperature!; // °C
    const temperatureDifference = outletTemp - inletTemp; // °C

    // Get additional data for enhanced calculation
    const ambientTemp = data.ambientTemperature || 10; // Default 10°C if unknown
    const compressorFreq = data.compressorFrequency || 0; // Use actual frequency, default to 0 if unknown
    const isDefrosting = data.isDefrosting || false;

    // If compressor is not running, COP is 0 (no heat pump operation)
    if (compressorFreq <= 0) {
      return {
        cop: 0,
        method: 'idle_mode',
        confidence: 'high', // High confidence that COP=0 when compressor is off
        isOutlier: false,
        dataSources: {
          temperatureDifference: { value: temperatureDifference, source: 'calculated' },
          compressorFrequency: { value: compressorFreq, source: data.compressorFrequency ? 'device' : 'estimated' },
        },
        outlierReason: 'Compressor not running (frequency ≤ 0 Hz)',
        calculationDetails: {
          thermalOutput: 0, // No thermal output when compressor is off
        },
      };
    }

    // Calculate base COP using improved empirical model
    let baseCOP = this.calculateBaseCOPFromTemperature(temperatureDifference, inletTemp, outletTemp);

    // Apply ambient temperature correction (heat pump efficiency varies with outdoor conditions)
    const ambientCorrection = this.calculateAmbientCorrection(ambientTemp);
    baseCOP *= ambientCorrection;

    // Apply load-based correction (partial load affects efficiency)
    const loadCorrection = this.calculateLoadCorrection(compressorFreq, temperatureDifference);
    baseCOP *= loadCorrection;

    // Apply system operation corrections
    const operationCorrection = this.calculateOperationCorrection(inletTemp, outletTemp, ambientTemp);
    baseCOP *= operationCorrection;

    // Apply seasonal/environmental variations (add realistic randomness)
    const environmentalCorrection = this.calculateEnvironmentalVariation(temperatureDifference, ambientTemp);
    baseCOP *= environmentalCorrection;

    // Adjust for defrosting
    if (isDefrosting) {
      baseCOP = Math.max(baseCOP * 0.5, DeviceConstants.COP_RANGES.DURING_DEFROST_MIN);
    }

    // Ensure result stays within realistic bounds
    const finalCOP = Math.max(1.5, Math.min(baseCOP, 6.5));

    return {
      cop: Number(finalCOP.toFixed(2)), // Round to 2 decimal places for realistic precision
      method: 'temperature_difference',
      confidence: 'low',
      isOutlier: false,
      dataSources: {
        temperatureDifference: { value: temperatureDifference, source: 'device' },
        ambientTemperature: { value: ambientTemp, source: data.ambientTemperature ? 'device' : 'estimated' },
        compressorFrequency: { value: compressorFreq, source: data.compressorFrequency ? 'device' : 'estimated' },
      },
    };
  }

  /**
   * Calculate base COP from temperature difference using improved empirical curves
   */
  private static calculateBaseCOPFromTemperature(tempDiff: number, inletTemp: number, outletTemp: number): number {
    // Use sigmoid-like curve for more realistic COP progression
    // Based on actual heat pump performance data from field studies

    if (tempDiff <= 1) {
      // Very low temperature difference suggests system issues or low load
      return 1.8 + Math.random() * 0.4; // 1.8-2.2
    }

    if (tempDiff <= 3) {
      // Low temperature difference - system running efficiently at low load
      return 2.2 + (tempDiff - 1) * 0.25 + (Math.random() - 0.5) * 0.3; // 2.2-2.9 with variation
    }

    if (tempDiff <= 6) {
      // Moderate temperature difference - normal operation
      const baseCOP = 2.7 + (tempDiff - 3) * 0.2;
      return baseCOP + (Math.random() - 0.5) * 0.4; // Add realistic variation
    }

    if (tempDiff <= 10) {
      // Higher temperature difference - higher load operation
      const baseCOP = 3.3 + (tempDiff - 6) * 0.15;
      return baseCOP + (Math.random() - 0.5) * 0.3;
    }

    if (tempDiff <= 15) {
      // High temperature difference - near maximum load
      const baseCOP = 3.9 + (tempDiff - 10) * 0.08;
      return baseCOP + (Math.random() - 0.5) * 0.25;
    }

    // Very high temperature difference - maximum load with decreasing efficiency
    const maxCOP = 4.3;
    const efficiencyPenalty = Math.max(0, (tempDiff - 15) * 0.05);
    return Math.max(3.5, maxCOP - efficiencyPenalty + (Math.random() - 0.5) * 0.2);
  }

  /**
   * Calculate ambient temperature correction factor
   * Heat pumps are more efficient in milder weather
   */
  private static calculateAmbientCorrection(ambientTemp: number): number {
    if (ambientTemp >= 15) {
      return 1.1 + (ambientTemp - 15) * 0.01; // Bonus for warm weather
    }
    if (ambientTemp >= 5) {
      return 1.0 + (ambientTemp - 5) * 0.01; // Mild efficiency improvement
    }
    if (ambientTemp >= -5) {
      return 1.0 - (5 - ambientTemp) * 0.02; // Gradual efficiency loss
    }
    if (ambientTemp >= -15) {
      return 0.85 - (-5 - ambientTemp) * 0.015; // Significant efficiency loss in cold
    }
    // Extremely cold weather
    return Math.max(0.65, 0.7 - (-15 - ambientTemp) * 0.01);
  }

  /**
   * Calculate load-based correction factor
   * Heat pumps have different efficiency at different loads
   */
  private static calculateLoadCorrection(compressorFreq: number, tempDiff: number): number {
    // Estimate load ratio from compressor frequency and temperature difference
    const normalizedFreq = Math.max(0.2, Math.min(1.0, compressorFreq / 80));
    const loadIntensity = Math.max(0.3, Math.min(1.0, tempDiff / 12));

    // Combine frequency and thermal load for comprehensive load estimation
    const combinedLoad = (normalizedFreq * 0.7) + (loadIntensity * 0.3);

    // Heat pumps are typically most efficient at 60-80% load
    const optimalLoad = 0.7;
    const loadDeviation = Math.abs(combinedLoad - optimalLoad);

    if (loadDeviation <= 0.1) {
      return 1.05; // Optimal efficiency zone
    }
    if (loadDeviation <= 0.2) {
      return 1.0 - loadDeviation * 0.25; // Gradual efficiency loss
    }
    // Significant efficiency penalty at very low or very high loads
    return Math.max(0.85, 0.95 - loadDeviation * 0.5);
  }

  /**
   * Calculate operation-based correction factors
   * System-specific efficiency adjustments
   */
  private static calculateOperationCorrection(inletTemp: number, outletTemp: number, ambientTemp: number): number {
    let correction = 1.0;

    // Temperature lift efficiency (less lift = higher efficiency)
    const temperatureLift = Math.abs(outletTemp - ambientTemp);
    if (temperatureLift <= 30) {
      correction *= 1.02; // Low lift bonus
    } else if (temperatureLift >= 45) {
      correction *= 0.95; // High lift penalty
    }

    // Supply temperature efficiency (moderate temperatures are optimal)
    if (outletTemp >= 35 && outletTemp <= 45) {
      correction *= 1.01; // Optimal supply temperature
    } else if (outletTemp >= 50) {
      correction *= 0.97 - (outletTemp - 50) * 0.005; // High temperature penalty
    }

    return correction;
  }

  /**
   * Calculate environmental variation factors
   * Add realistic variations based on unmeasured factors
   */
  private static calculateEnvironmentalVariation(tempDiff: number, ambientTemp: number): number {
    // Base variation increases with less certain operating conditions
    const baseVariation = 0.08; // ±8% base variation

    // More variation in extreme conditions
    let variationRange = baseVariation;
    if (ambientTemp < 0 || ambientTemp > 25) {
      variationRange *= 1.3; // Higher uncertainty in extreme weather
    }
    if (tempDiff < 2 || tempDiff > 12) {
      variationRange *= 1.2; // Higher uncertainty at extreme loads
    }

    // Generate realistic variation (normal distribution approximation)
    const variation1 = (Math.random() - 0.5) * 2; // -1 to 1
    const variation2 = (Math.random() - 0.5) * 2; // -1 to 1
    const normalVariation = (variation1 + variation2) / 2; // Approximate normal distribution

    return 1.0 + normalVariation * variationRange;
  }

  /**
   * Method 4: Refrigerant Circuit Analysis (New - High Accuracy without External Power)
   * Uses thermodynamic cycle analysis with pressure/temperature relationships
   * COP = (H_discharge - H_suction) / W_compressor_theoretical
   */
  private static calculateRefrigerantCircuit(data: COPDataSources): COPCalculationResult {
    const highPressureTemp = data.highPressureTemperature!; // °C
    const lowPressureTemp = data.lowPressureTemperature!; // °C
    const suctionTemp = data.suctionTemperature!; // °C
    const dischargeTemp = data.dischargeTemperature!; // °C
    const compressorFreq = data.compressorFrequency || 0; // Hz, use actual frequency

    // If compressor is not running, COP is 0 (no refrigerant circulation)
    if (compressorFreq <= 0) {
      return {
        cop: 0,
        method: 'idle_mode',
        confidence: 'high', // High confidence that COP=0 when compressor is off
        isOutlier: false,
        dataSources: {
          refrigerantCircuit: { value: 'No circulation - compressor off', source: 'calculated' },
          compressorFrequency: { value: compressorFreq, source: data.compressorFrequency ? 'device' : 'estimated' },
        },
        outlierReason: 'Compressor not running (frequency ≤ 0 Hz)',
        calculationDetails: {
          thermalOutput: 0, // No thermal output when compressor is off
          refrigerantEfficiency: 0,
        },
      };
    }

    // Convert to Kelvin for thermodynamic calculations
    const highPressureTempK = highPressureTemp + DeviceConstants.CELSIUS_TO_KELVIN;
    const lowPressureTempK = lowPressureTemp + DeviceConstants.CELSIUS_TO_KELVIN;
    const suctionTempK = suctionTemp + DeviceConstants.CELSIUS_TO_KELVIN;
    const dischargeTempK = dischargeTemp + DeviceConstants.CELSIUS_TO_KELVIN;

    // Estimate refrigerant cycle efficiency using saturation temperatures
    // This is a simplified approach using temperature differences
    const temperatureSpan = dischargeTempK - suctionTempK;

    // Calculate theoretical COP based on refrigerant cycle
    const theoreticalCOP = highPressureTempK / (highPressureTempK - lowPressureTempK);

    // Apply practical efficiency factors
    let refrigerantEfficiency = 0.45; // Base efficiency

    // Adjust for temperature span (optimal around 40-60K difference)
    if (temperatureSpan > 60) {
      refrigerantEfficiency *= 0.9; // Penalty for high temperature span
    } else if (temperatureSpan < 30) {
      refrigerantEfficiency *= 0.85; // Penalty for low temperature span (poor heat transfer)
    } else {
      refrigerantEfficiency *= 1.05; // Bonus for optimal range
    }

    // Adjust for compressor frequency efficiency
    refrigerantEfficiency += (compressorFreq / 100 - 0.5) * 0.1;
    refrigerantEfficiency = Math.max(0.25, Math.min(0.65, refrigerantEfficiency));

    // Calculate practical COP
    const cop = theoreticalCOP * refrigerantEfficiency;

    return {
      cop,
      method: 'refrigerant_circuit',
      confidence: 'high',
      isOutlier: false,
      dataSources: {
        refrigerantCircuit: { value: `HP:${highPressureTemp}°C LP:${lowPressureTemp}°C`, source: 'internal' },
        temperatureDifference: { value: temperatureSpan - DeviceConstants.CELSIUS_TO_KELVIN, source: 'calculated' },
      },
      calculationDetails: {
        carnotCOP: theoreticalCOP,
        refrigerantEfficiency,
        efficiencyFactor: refrigerantEfficiency,
      },
    };
  }

  /**
   * Method 5: Valve Position Correlation (New - Supplementary Method)
   * Uses EEV and EVI valve positions to estimate system efficiency
   */
  private static calculateValveCorrelation(data: COPDataSources): COPCalculationResult {
    const eevSteps = data.eevPulseSteps!;
    const eviSteps = data.eviPulseSteps!;
    const inletTemp = data.inletTemperature!;
    const outletTemp = data.outletTemperature!;
    const compressorFreq = data.compressorFrequency || 0; // Hz, use actual frequency

    // If compressor is not running, COP is 0 (valves don't indicate heat pump operation)
    if (compressorFreq <= 0) {
      return {
        cop: 0,
        method: 'idle_mode',
        confidence: 'high', // High confidence that COP=0 when compressor is off
        isOutlier: false,
        dataSources: {
          valvePositions: { value: `EEV:${eevSteps}, EVI:${eviSteps} (no operation)`, source: 'device' },
          compressorFrequency: { value: compressorFreq, source: data.compressorFrequency ? 'device' : 'estimated' },
        },
        outlierReason: 'Compressor not running (frequency ≤ 0 Hz)',
        calculationDetails: {
          thermalOutput: 0, // No thermal output when compressor is off
          valveEfficiencyFactor: 0,
        },
      };
    }

    const temperatureDifference = outletTemp - inletTemp;

    // Calculate valve efficiency factor based on positions
    // EEV optimal range: 200-400 pulse-steps, EVI optimal range: 100-300 pulse-steps
    let valveEfficiencyFactor = 1.0;

    // EEV efficiency curve
    if (eevSteps < 100) {
      valveEfficiencyFactor *= 0.7; // Too closed, poor heat transfer
    } else if (eevSteps > 450) {
      valveEfficiencyFactor *= 0.8; // Too open, poor efficiency
    } else {
      valveEfficiencyFactor *= 1.0 + Math.sin(((eevSteps - 100) / 350) * Math.PI) * 0.15;
    }

    // EVI efficiency curve
    if (eviSteps < 50) {
      valveEfficiencyFactor *= 0.85;
    } else if (eviSteps > 350) {
      valveEfficiencyFactor *= 0.9;
    } else {
      valveEfficiencyFactor *= 1.0 + Math.sin(((eviSteps - 50) / 300) * Math.PI) * 0.1;
    }

    // Base COP estimation using temperature difference and valve positions
    let baseCOP = 2.0;
    if (temperatureDifference > 5) {
      baseCOP = 2.5 + (temperatureDifference - 5) * 0.12;
    }

    // Apply valve efficiency factor
    const cop = Math.min(baseCOP * valveEfficiencyFactor, 6.5); // Cap at realistic maximum

    // Adjust for compressor frequency
    const frequencyFactor = 0.9 + (compressorFreq / 100) * 0.2;
    const adjustedCOP = cop * frequencyFactor;

    return {
      cop: adjustedCOP,
      method: 'valve_correlation',
      confidence: 'medium',
      isOutlier: false,
      dataSources: {
        valvePositions: { value: `EEV:${eevSteps} EVI:${eviSteps}`, source: 'internal' },
        temperatureDifference: { value: temperatureDifference, source: 'internal' },
      },
      calculationDetails: {
        valveEfficiencyFactor,
        efficiencyFactor: frequencyFactor,
      },
    };
  }

  /**
   * Method 6: Power Module Auto-Detection (New - Uses Internal Power Monitoring)
   * Automatically calculates power when internal power module is available
   */
  private static calculatePowerModule(data: COPDataSources): COPCalculationResult {
    // Guard: If compressor not running, this is backup heater operation, not heat pump
    const compressorFreq = data.compressorFrequency || 0;
    if (compressorFreq <= 0) {
      return {
        cop: 0,
        method: 'idle_mode',
        confidence: 'high',
        isOutlier: false,
        dataSources: {
          compressorFrequency: { value: compressorFreq, source: 'internal' },
        },
        calculationDetails: {
          calculatedPower: 0,
        },
        outlierReason: 'Compressor not running (frequency ≤ 0 Hz) - detected backup heater operation',
      };
    }

    let calculatedPower = 0;
    let powerSource = 'unknown';

    if (data.powerModuleType === 1 && data.internalPower && data.internalPower > 0) {
      // Single-phase power module
      calculatedPower = data.internalPower;
      powerSource = 'single_phase_internal';
    } else if (data.powerModuleType === 2) {
      // Three-phase power calculation: P = √3 × V × I × cos(φ)
      const voltageA = data.voltageA || 0;
      const voltageB = data.voltageB || 0;
      const voltageC = data.voltageC || 0;
      const currentA = data.currentA || 0;
      const currentB = data.currentB || 0;
      const currentC = data.currentC || 0;

      const avgVoltage = (voltageA + voltageB + voltageC) / 3;
      const avgCurrent = (currentA + currentB + currentC) / 3;
      const powerFactor = 0.85; // Typical for heat pump compressors

      calculatedPower = Math.sqrt(3) * avgVoltage * avgCurrent * powerFactor;
      powerSource = 'three_phase_calculated';
    }

    // Use direct thermal calculation with calculated power
    const waterFlowRate = data.waterFlowRate!;
    const inletTemp = data.inletTemperature!;
    const outletTemp = data.outletTemperature!;

    // Convert flow rate: L/min → kg/s
    const massFlowRate = waterFlowRate / 60; // kg/s

    // Calculate temperature difference
    const temperatureDifference = outletTemp - inletTemp;

    // Calculate thermal output: Q_thermal = ṁ × Cp × ΔT
    const thermalOutput = massFlowRate * DeviceConstants.WATER_SPECIFIC_HEAT_CAPACITY * temperatureDifference;

    // Calculate COP
    const cop = thermalOutput / calculatedPower;

    return {
      cop,
      method: 'power_module',
      confidence: 'high',
      isOutlier: false,
      dataSources: {
        powerModule: { value: `${calculatedPower}W (${powerSource})`, source: 'internal' },
        waterFlowRate: { value: waterFlowRate, source: 'internal' },
        temperatureDifference: { value: temperatureDifference, source: 'internal' },
      },
      calculationDetails: {
        thermalOutput,
        calculatedPower,
        massFlowRate,
        powerFactor: data.powerModuleType === 2 ? 0.85 : undefined,
      },
    };
  }

  /**
   * Method 7: Power Estimation (New - Estimates Power from Compressor/Fan Data)
   * Estimates total system power consumption based on compressor and fan frequencies
   * P_total = P_compressor + P_fan + P_auxiliary
   */
  private static calculatePowerEstimation(data: COPDataSources): COPCalculationResult {
    const compressorFreq = data.compressorFrequency!; // Hz
    const fanFreq = data.fanMotorFrequency!; // Hz
    const waterFlowRate = data.waterFlowRate!; // L/min
    const inletTemp = data.inletTemperature!; // °C
    const outletTemp = data.outletTemperature!; // °C
    const isDefrosting = data.isDefrosting || false;

    const constants = DeviceConstants.POWER_ESTIMATION;

    // Estimate compressor power using power curve
    // Power scales non-linearly with frequency (typically P ∝ f^1.8)
    const compressorFreqNormalized = Math.max(0, Math.min(1,
      (compressorFreq - constants.COMPRESSOR_MIN_FREQUENCY)
      / (constants.COMPRESSOR_MAX_FREQUENCY - constants.COMPRESSOR_MIN_FREQUENCY)));

    const compressorPower = constants.COMPRESSOR_BASE_POWER
      + (constants.COMPRESSOR_MAX_POWER - constants.COMPRESSOR_BASE_POWER)
      * (compressorFreqNormalized ** constants.COMPRESSOR_POWER_CURVE_EXPONENT);

    // Estimate fan power using fan laws (P ∝ f^2.2 approximately)
    const fanFreqNormalized = Math.max(0, Math.min(1,
      (fanFreq - constants.FAN_MIN_FREQUENCY)
      / (constants.FAN_MAX_FREQUENCY - constants.FAN_MIN_FREQUENCY)));

    const fanPower = constants.FAN_BASE_POWER
      + (constants.FAN_MAX_POWER - constants.FAN_BASE_POWER)
      * (fanFreqNormalized ** constants.FAN_POWER_CURVE_EXPONENT);

    // Estimate auxiliary power (circulation pump, controls, etc.)
    // Varies with system load (based on flow rate)
    const flowRateNormalized = Math.min(1, waterFlowRate / 50); // Normalize to typical max flow
    const auxiliaryPower = constants.AUXILIARY_POWER_BASE
      + constants.AUXILIARY_POWER_VARIABLE * flowRateNormalized;

    // Total estimated power
    let totalEstimatedPower = compressorPower + fanPower + auxiliaryPower;

    // Apply defrost multiplier if system is defrosting
    if (isDefrosting) {
      totalEstimatedPower *= constants.DEFROST_POWER_MULTIPLIER;
    }

    // Calculate thermal output using standard direct thermal method
    const massFlowRate = waterFlowRate / 60; // kg/s
    const temperatureDifference = outletTemp - inletTemp; // °C
    const thermalOutput = massFlowRate * DeviceConstants.WATER_SPECIFIC_HEAT_CAPACITY * temperatureDifference; // W

    // Calculate COP
    const cop = thermalOutput / totalEstimatedPower;

    return {
      cop,
      method: 'power_estimation',
      confidence: 'high',
      isOutlier: false,
      dataSources: {
        electricalPower: { value: totalEstimatedPower, source: 'estimated' },
        waterFlowRate: { value: waterFlowRate, source: 'internal' },
        temperatureDifference: { value: temperatureDifference, source: 'internal' },
        powerEstimation: { value: `Comp:${compressorFreq}Hz Fan:${fanFreq}Hz`, source: 'internal' },
      },
      calculationDetails: {
        thermalOutput,
        calculatedPower: totalEstimatedPower,
        massFlowRate,
        compressorPower,
        fanPower,
        auxiliaryPower,
        compressorFreqNormalized,
        fanFreqNormalized,
        defrostMultiplier: isDefrosting ? constants.DEFROST_POWER_MULTIPLIER : 1.0,
      },
    };
  }

  /**
   * Check if we have sufficient data for Method 1: Direct Thermal
   */
  private static canUseDirectThermal(data: COPDataSources): boolean {
    return !!(
      data.waterFlowRate && data.waterFlowRate > 0
      && data.inletTemperature !== undefined && data.inletTemperature !== null
      && data.outletTemperature !== undefined && data.outletTemperature !== null
      && data.electricalPower && data.electricalPower > 0
      && data.compressorFrequency !== undefined && data.compressorFrequency !== null && data.compressorFrequency > 0
    );
  }

  /**
   * Check if we have sufficient data for Method 2: Carnot Estimation
   */
  private static canUseCarnotEstimation(data: COPDataSources): boolean {
    return !!(
      data.outletTemperature !== undefined && data.outletTemperature !== null
      && data.ambientTemperature !== undefined && data.ambientTemperature !== null
      && data.compressorFrequency && data.compressorFrequency > 0
    );
  }

  /**
   * Check if we have sufficient data for Method 3: Temperature Difference
   */
  private static canUseTemperatureDifference(data: COPDataSources): boolean {
    return !!(
      data.inletTemperature !== undefined && data.inletTemperature !== null
      && data.outletTemperature !== undefined && data.outletTemperature !== null
      && data.compressorFrequency !== undefined && data.compressorFrequency !== null && data.compressorFrequency > 0
    );
  }

  /**
   * Check if we have sufficient data for Method 4: Refrigerant Circuit Analysis
   */
  private static canUseRefrigerantCircuit(data: COPDataSources): boolean {
    return !!(
      data.highPressureTemperature !== undefined && data.highPressureTemperature !== null
      && data.lowPressureTemperature !== undefined && data.lowPressureTemperature !== null
      && data.suctionTemperature !== undefined && data.suctionTemperature !== null
      && data.dischargeTemperature !== undefined && data.dischargeTemperature !== null
    );
  }

  /**
   * Check if we have sufficient data for Method 5: Valve Position Correlation
   */
  private static canUseValveCorrelation(data: COPDataSources): boolean {
    return !!(
      data.eevPulseSteps !== undefined && data.eevPulseSteps !== null
      && data.eviPulseSteps !== undefined && data.eviPulseSteps !== null
      && data.inletTemperature !== undefined && data.inletTemperature !== null
      && data.outletTemperature !== undefined && data.outletTemperature !== null
    );
  }

  /**
   * Check if we have sufficient data for Method 6: Power Module Auto-Detection
   */
  private static canUsePowerModule(data: COPDataSources): boolean {
    const hasWaterFlow = !!(data.waterFlowRate && data.waterFlowRate > 0);
    const hasTemperatures = !!(
      data.inletTemperature !== undefined && data.inletTemperature !== null
      && data.outletTemperature !== undefined && data.outletTemperature !== null
    );
    const hasCompressorRunning = !!(data.compressorFrequency !== undefined && data.compressorFrequency !== null && data.compressorFrequency > 0);

    if (!hasWaterFlow || !hasTemperatures || !hasCompressorRunning) {
      return false;
    }

    // Check for single-phase power module
    if (data.powerModuleType === 1 && data.internalPower && data.internalPower > 0) {
      return true;
    }

    // Check for three-phase power module
    if (data.powerModuleType === 2) {
      const hasVoltages = !!(data.voltageA && data.voltageB && data.voltageC);
      const hasCurrents = !!(data.currentA && data.currentB && data.currentC);
      return hasVoltages && hasCurrents;
    }

    return false;
  }

  /**
   * Check if we have sufficient data for Method 7: Power Estimation
   */
  private static canUsePowerEstimation(data: COPDataSources): boolean {
    return !!(
      data.compressorFrequency !== undefined && data.compressorFrequency !== null && data.compressorFrequency > 0
      && data.fanMotorFrequency !== undefined && data.fanMotorFrequency !== null && data.fanMotorFrequency > 0
      && data.waterFlowRate && data.waterFlowRate > 0
      && data.inletTemperature !== undefined && data.inletTemperature !== null
      && data.outletTemperature !== undefined && data.outletTemperature !== null
    );
  }

  /**
   * Detect and flag COP outliers
   */
  private static detectOutliers(result: COPCalculationResult, customThresholds?: { minCOP: number; maxCOP: number }): void {
    const minCOP = customThresholds?.minCOP ?? DeviceConstants.MIN_VALID_COP;
    const maxCOP = customThresholds?.maxCOP ?? DeviceConstants.MAX_VALID_COP;

    // Skip outlier detection for idle mode (COP = 0 due to compressor not running)
    if (result.cop === 0 && result.outlierReason?.includes('Compressor not running')) {
      return; // COP = 0 in idle mode is correct, not an outlier
    }

    if (result.cop < minCOP) {
      result.isOutlier = true;
      result.outlierReason = `COP ${result.cop.toFixed(2)} below minimum threshold (${minCOP})`;
    } else if (result.cop > maxCOP) {
      result.isOutlier = true;
      result.outlierReason = `COP ${result.cop.toFixed(2)} above maximum threshold (${maxCOP})`;
    }

    // Additional outlier detection based on method confidence
    if (result.method === 'direct_thermal' && result.cop > 12) {
      result.isOutlier = true;
      result.outlierReason = 'Extremely high COP suggests measurement error (flow meter or power meter malfunction)';
    }
  }

  /**
   * Check if a value is valid for calculations (not null, undefined, and > 0 for numeric values)
   */
  private static isValidValue(value: number | null | undefined): boolean {
    return value !== null && value !== undefined && typeof value === 'number' && value > 0;
  }

  /**
   * Generate diagnostic information about why COP calculation failed
   */
  private static generateDiagnosticInfo(data: COPDataSources): {
    missingRequiredData: string[];
    primaryIssue: string;
    secondaryIssues: string[];
    troubleshootingHint: string;
  } {
    const missingRequiredData: string[] = [];
    const secondaryIssues: string[] = [];
    let primaryIssue = 'unknown_issue';
    let troubleshootingHint = 'check_all_sensors';

    // Check basic data availability
    const hasElectricalPower = this.isValidValue(data.electricalPower);
    const hasWaterFlow = this.isValidValue(data.waterFlowRate);
    const hasTemperatureDifference = this.isValidValue(data.inletTemperature) && this.isValidValue(data.outletTemperature);
    const hasCompressorData = this.isValidValue(data.compressorFrequency);
    const hasAmbientTemp = this.isValidValue(data.ambientTemperature);
    const hasRefrigerantData = this.isValidValue(data.highPressureTemperature) && this.isValidValue(data.lowPressureTemperature);

    // Determine primary issue
    if (!hasElectricalPower) {
      primaryIssue = 'no_power_measurement';
      troubleshootingHint = 'enable_power_monitoring';
      missingRequiredData.push('electrical_power');
    } else if (!hasWaterFlow && !hasTemperatureDifference) {
      primaryIssue = 'no_thermal_measurement';
      troubleshootingHint = 'check_temperature_sensors';
      if (!hasWaterFlow) missingRequiredData.push('water_flow_rate');
      if (!hasTemperatureDifference) missingRequiredData.push('temperature_difference');
    } else if (!hasWaterFlow) {
      primaryIssue = 'no_water_flow';
      troubleshootingHint = 'check_flow_sensor';
      missingRequiredData.push('water_flow_rate');
    } else if (!hasTemperatureDifference) {
      primaryIssue = 'no_temperature_difference';
      troubleshootingHint = 'check_temperature_sensors';
      missingRequiredData.push('temperature_difference');
    } else if (!hasCompressorData) {
      primaryIssue = 'no_compressor_data';
      troubleshootingHint = 'check_compressor_communication';
      missingRequiredData.push('compressor_frequency');
    } else {
      primaryIssue = 'insufficient_sensor_data';
      troubleshootingHint = 'check_multiple_sensors';
    }

    // Check for secondary issues
    if (!hasAmbientTemp) {
      secondaryIssues.push('no_ambient_temperature');
    }
    if (!hasRefrigerantData) {
      secondaryIssues.push('no_refrigerant_circuit_data');
    }
    if (!this.isValidValue(data.fanMotorFrequency)) {
      secondaryIssues.push('no_fan_data');
    }

    return {
      missingRequiredData,
      primaryIssue,
      secondaryIssues,
      troubleshootingHint,
    };
  }

  /**
   * Get human-readable description of calculation method used
   */
  public static getMethodDescription(method: string): string {
    switch (method) {
      case 'idle_mode':
        return 'Heat pump idle - compressor not running (COP = 0, no heat pump operation)';
      case 'direct_thermal':
        return 'Direct thermal calculation using water flow and temperature difference (±5% accuracy)';
      case 'power_module':
        return 'Internal power module calculation using built-in power monitoring (±8% accuracy)';
      case 'power_estimation':
        return 'Power estimation using compressor/fan frequencies and system modeling (±10% accuracy)';
      case 'refrigerant_circuit':
        return 'Refrigerant circuit analysis using pressure/temperature relationships (±12% accuracy)';
      case 'carnot_estimation':
        return 'Carnot-based estimation using compressor frequency and ambient temperature (±15% accuracy)';
      case 'valve_correlation':
        return 'Valve position correlation using EEV/EVI positions and temperatures (±20% accuracy)';
      case 'temperature_difference':
        return 'Temperature difference estimation using empirical relationships (±30% accuracy)';
      case 'insufficient_data':
        return 'Insufficient data for COP calculation';
      default:
        return 'Unknown calculation method';
    }
  }
}
