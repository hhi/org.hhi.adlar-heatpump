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
  method: 'direct_thermal' | 'carnot_estimation' | 'temperature_difference' | 'refrigerant_circuit' | 'valve_correlation' | 'power_module' | 'power_estimation' | 'insufficient_data';
  confidence: 'high' | 'medium' | 'low';
  isOutlier: boolean;
  outlierReason?: string;
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

    return {
      cop: 0,
      method: 'insufficient_data',
      confidence: 'low',
      isOutlier: false,
      dataSources: {},
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
        throw new Error(`Unknown COP calculation method: ${method}`);
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
    const compressorFreq = data.compressorFrequency || 50; // Hz, default 50Hz

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
   * Method 3: Temperature Difference Estimation (Basic)
   * COP = f(ΔT) using empirical relationships
   */
  private static calculateTemperatureDifference(data: COPDataSources): COPCalculationResult {
    const inletTemp = data.inletTemperature!; // °C
    const outletTemp = data.outletTemperature!; // °C
    const temperatureDifference = outletTemp - inletTemp; // °C

    let cop: number;
    const thresholds = DeviceConstants.COP_TEMP_DIFF_THRESHOLDS;

    // Apply empirical COP relationships
    if (temperatureDifference < thresholds.LOW_EFFICIENCY_TEMP_DIFF) {
      cop = thresholds.LOW_EFFICIENCY_COP; // 2.0
    } else if (temperatureDifference < thresholds.MODERATE_EFFICIENCY_TEMP_DIFF) {
      // Linear interpolation: COP = 2.5 + (ΔT - 5) × 0.15
      cop = thresholds.MODERATE_EFFICIENCY_COP_BASE
            + (temperatureDifference - thresholds.LOW_EFFICIENCY_TEMP_DIFF)
            * thresholds.MODERATE_EFFICIENCY_SLOPE;
    } else {
      cop = thresholds.HIGH_EFFICIENCY_COP; // 4.0 (capped)
    }

    // Adjust for defrosting if known
    if (data.isDefrosting) {
      cop = Math.max(cop * 0.5, DeviceConstants.COP_RANGES.DURING_DEFROST_MIN);
    }

    return {
      cop,
      method: 'temperature_difference',
      confidence: 'low',
      isOutlier: false,
      dataSources: {
        temperatureDifference: { value: temperatureDifference, source: 'device' },
      },
    };
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
    const compressorFreq = data.compressorFrequency || 50; // Hz

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
    const compressorFreq = data.compressorFrequency || 50;

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

    if (!hasWaterFlow || !hasTemperatures) {
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
   * Get human-readable description of calculation method used
   */
  public static getMethodDescription(method: string): string {
    switch (method) {
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
