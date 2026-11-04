/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
/**
 * Display text for the adlar_cop_method capability, shared by the Tuya, Aurora I/II and Aurora III drivers
 *
 * @module lib/shared/utils/cop-method-display
 */

import type { COPCalculationResult } from '../services/cop-calculator';

/** Homey's `__()`: returns the key itself when a translation is missing */
export type Translate = (key: string) => string | undefined;

type CopMethodResult = Pick<COPCalculationResult, 'cop' | 'method' | 'confidence' | 'isOutlier' | 'diagnosticInfo'>;

const CONFIDENCE_INDICATOR: Record<COPCalculationResult['confidence'], string> = {
  high: '🟢',
  medium: '🟡',
  low: '🔴',
};

function tr(translate: Translate, key: string, fallback: string): string {
  const translated = translate(key);
  return translated && translated !== key ? translated : fallback;
}

/**
 * Format a COP calculation result for display, e.g. "Direct Thermisch 🟢"
 *
 * - outlier: method + "⚠ Uitschieter"
 * - compressor off: "Compressor uit"
 * - missing data: method + diagnostic + 🔴
 * - valid COP: method + confidence indicator (🟢/🟡/🔴)
 * - no valid COP: method + 🔴
 */
export function formatCopMethodDisplay(result: CopMethodResult, translate: Translate): string {
  if (result.method === 'idle_mode') {
    return tr(translate, 'cop_method.idle_mode', 'Compressor off');
  }

  const method = tr(translate, `cop_method.${result.method}`, result.method);

  if (result.isOutlier) {
    return `${method} ⚠ ${tr(translate, 'cop_method.outlier', 'Outlier')}`;
  }

  const issueKey = result.diagnosticInfo?.primaryIssue;
  if (issueKey) {
    return `${method} ${tr(translate, `cop_diagnostics.${issueKey}`, issueKey)} ${CONFIDENCE_INDICATOR.low}`;
  }

  const confidence = result.cop > 0 ? result.confidence : 'low';
  return `${method} ${CONFIDENCE_INDICATOR[confidence] ?? CONFIDENCE_INDICATOR.low}`;
}

/** Display text when COP calculation is switched off in the device settings */
export function formatCopMethodDisabled(translate: Translate): string {
  return tr(translate, 'cop_method.disabled', 'Disabled');
}
