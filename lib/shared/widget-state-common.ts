/**
 * Gedeelde bouwstenen voor de live-operation-widget (v3.3.0).
 *
 * Elke driver levert zijn eigen state-contract; de widget kiest labels en
 * teksten op basis van `source`. Services leveren codes en getallen, nooit
 * gebruikersteksten: de widget vertaalt via `Homey.__()`.
 */

/** Herkomst van de state; bepaalt sensorlabels en het regelblok in de widget */
export type WidgetSource = 'tuya' | 'aurora2' | 'aurora3';

/** Verbindingstoestand als code; de widget maakt er tekst van */
export type WidgetConnectionState = 'online' | 'offline' | 'degraded' | 'unknown';

/** Respons als er geen Adlar-warmtepomp aan de app gekoppeld is */
export interface LiveOperationWidgetEmptyState {
  ok: false;
  messageCode: 'no_device';
}

/**
 * Leidt de verbindingstoestand af uit de waarde van `adlar_connection_status`
 * ("Connected: 3-Oct 14:25") of de Modbus-verbindingskwaliteit ("online").
 */
export function connectionStateFromStatus(status: string | null | undefined): WidgetConnectionState {
  const normalized = (status ?? '').trim().toLowerCase();
  if (normalized.startsWith('connected') || normalized === 'online') return 'online';
  if (normalized.startsWith('disconnected') || normalized === 'offline') return 'offline';
  if (normalized === 'degraded') return 'degraded';
  return 'unknown';
}
