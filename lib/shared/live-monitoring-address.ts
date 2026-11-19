/* eslint-disable import/prefer-default-export */

/** Read-only device setting that shows where the local live monitoring page can be opened. */
export const LIVE_MONITORING_ADDRESS_SETTING = 'live_monitoring_address';

/**
 * Builds the live monitoring address from Homey's local address and the dashboard port.
 *
 * `homey.cloud.getLocalAddress()` returns the address of Homey's own web interface, such as
 * `192.168.1.10:80`; the dashboard listens on the same host with its own port.
 */
export function formatLiveMonitoringAddress(localAddress: unknown, port: number): string | null {
  if (typeof localAddress !== 'string' || !Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }
  const address = localAddress.trim();
  let host: string;
  if (address.startsWith('[')) {
    // IPv6 with brackets, optionally followed by a port
    const match = address.match(/^(\[[^\]]+\])(?::\d+)?$/);
    if (!match) return null;
    [, host] = match;
  } else if ((address.match(/:/g) ?? []).length > 1) {
    // IPv6 without brackets and without port
    host = `[${address}]`;
  } else {
    [host] = address.split(':');
  }
  return host ? `http://${host}:${port}/` : null;
}

/** What a device offers to show the address; matches Homey.Device structurally. */
export interface LiveMonitoringTarget {
  homey: {
    cloud: { getLocalAddress(): Promise<string> };
    __(key: string, tags?: Record<string, unknown>): string;
  };
  getSetting(key: string): unknown;
  setSettings(settings: Record<string, unknown>): Promise<void>;
}

/**
 * Writes the live monitoring address into the read-only setting.
 *
 * `listeningPort` is the port the dashboard actually listens on, or null when it did not start
 * (for example because the configured port is already in use). Returns the shown text.
 */
export async function updateLiveMonitoringAddress(
  target: LiveMonitoringTarget,
  listeningPort: number | null,
  configuredPort: number,
): Promise<string> {
  let value: string;
  if (listeningPort === null) {
    value = target.homey.__('live_monitoring.not_available', { port: configuredPort });
  } else {
    const localAddress = await target.homey.cloud.getLocalAddress().catch(() => null);
    value = formatLiveMonitoringAddress(localAddress, listeningPort)
      ?? target.homey.__('live_monitoring.address_unknown', { port: listeningPort });
  }
  if (target.getSetting(LIVE_MONITORING_ADDRESS_SETTING) !== value) {
    await target.setSettings({ [LIVE_MONITORING_ADDRESS_SETTING]: value });
  }
  return value;
}
