/* eslint-disable import/prefer-default-export */

/**
 * Converteert een numerieke heatingCurve registerwaarde (0x0314) naar de
 * adlar_enum_countdown_set enum-id.
 * 0 = OFF, 1-8 = H1-H8, 11-18 = L1-L8
 */
export function heatingCurveToEnumId(raw: number): string {
  if (raw === 0) return 'OFF';
  if (raw >= 1 && raw <= 8) return `H${raw}`;
  if (raw >= 11 && raw <= 18) return `L${raw - 10}`;
  return 'OFF';
}

/**
 * Converteert een adlar_enum_countdown_set enum-id terug naar de
 * registerwaarde voor Modbus schrijven (0x0314).
 */
export function enumIdToHeatingCurve(id: string): number {
  if (id === 'OFF') return 0;
  if (id.startsWith('H')) return parseInt(id.slice(1), 10);
  if (id.startsWith('L')) return parseInt(id.slice(1), 10) + 10;
  return 0;
}

/**
 * Converteert register 0x0307 (0=Standard, 1=High Power, 2=Silent)
 * naar de adlar_enum_work_mode enum-id (ECO/Normal/Boost).
 */
export function userModeToWorkModeId(raw: number): string {
  if (raw === 2) return 'ECO';
  if (raw === 1) return 'Boost';
  return 'Normal'; // 0 = Standard
}

/**
 * Converteert een adlar_enum_work_mode enum-id terug naar de
 * registerwaarde voor Modbus schrijven (0x0307).
 */
export function workModeIdToUserMode(id: string): 0 | 1 | 2 {
  if (id === 'ECO') return 2;
  if (id === 'Boost') return 1;
  return 0; // Normal = Standard
}

/**
 * Converteert register 0x0315 (0=OFF, 1–4=H1–H4) naar
 * adlar_enum_capacity_set enum-id.
 */
export function hotWaterCurveToEnumId(raw: number): string {
  if (raw >= 1 && raw <= 4) return `H${raw}`;
  return 'OFF';
}

/**
 * Converteert adlar_enum_capacity_set enum-id naar registerwaarde
 * voor Modbus schrijven (0x0315).
 */
export function enumIdToHotWaterCurve(id: string): number {
  if (id.startsWith('H')) return parseInt(id.slice(1), 10);
  return 0; // OFF
}

/**
 * Converteert register L22 (0x080B) naar adlar_state_backwater enum-id.
 * 0=disable, 1=continuous return, 2=cycle return, 3=temperature diff return
 */
export function backwaterModeToEnumId(raw: number): string {
  if (raw === 1) return 'continuous';
  if (raw === 2) return 'cycle';
  if (raw === 3) return 'temp_diff';
  return 'disable';
}
