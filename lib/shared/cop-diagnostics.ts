/* eslint-disable import/prefer-default-export */

interface CalculationResult {
  cop: number;
  method: string;
  isOutlier: boolean;
  outlierReason?: string;
}

interface CalculationInputs {
  electricalPower?: number;
  waterFlowRate?: number;
  inletTemperature?: number;
  outletTemperature?: number;
}

export interface COPDiagnostic {
  timestamp: number;
  quality: 'valid' | 'idle' | 'outlier' | 'insufficient_data';
  acceptedCOP: number | null;
  rawCOP: number | null;
  reason: string | null;
  method: string;
  electricalPowerW: number | null;
  flowLpm: number | null;
  deltaTC: number | null;
}

/** Keep rejected calculations available for diagnosis, separate from accepted COP measurements. */
export function describeCOP(result: CalculationResult, inputs: CalculationInputs = {}): COPDiagnostic {
  const finite = Number.isFinite(result.cop);
  const idle = result.method === 'idle_mode' && result.cop === 0 && !result.isOutlier;
  let quality: COPDiagnostic['quality'] = 'insufficient_data';
  if (idle) quality = 'idle';
  else if (result.isOutlier) quality = 'outlier';
  else if (finite && result.cop > 0) quality = 'valid';
  const rawCOP = finite && quality !== 'insufficient_data' ? Math.round(result.cop * 100) / 100 : null;
  return {
    timestamp: Date.now(),
    quality,
    acceptedCOP: quality === 'valid' || idle ? rawCOP : null,
    rawCOP,
    reason: result.outlierReason ?? null,
    method: result.method,
    electricalPowerW: inputs.electricalPower ?? null,
    flowLpm: inputs.waterFlowRate ?? null,
    deltaTC: inputs.outletTemperature !== undefined && inputs.inletTemperature !== undefined
      ? inputs.outletTemperature - inputs.inletTemperature : null,
  };
}
