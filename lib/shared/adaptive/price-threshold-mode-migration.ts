/**
 * Migration v3.11.0: automatic price thresholds.
 *
 * The setting `price_threshold_mode` defaults to 'auto', and Homey gives a new setting its
 * default value on existing devices too. Existing devices keep the fixed thresholds, so their
 * price categories and flows do not change without the user choosing it; newly paired devices
 * get the automatic thresholds.
 *
 * Order in Homey: onInit (migration sets 'fixed' and the store flag) runs before onAdded
 * (a new device is switched back to 'auto'). The flag makes the migration run once per device.
 */

export const PRICE_THRESHOLD_MIGRATION_FLAG = 'price_threshold_mode_migrated_v3_11_0';

export interface PriceThresholdMigrationDevice {
  getStoreValue(key: string): unknown;
  setStoreValue(key: string, value: unknown): Promise<void>;
  setSettings(settings: Record<string, unknown>): Promise<void>;
}

/**
 * Called in onInit before the services start. Returns true when the device was set to 'fixed'.
 */
export async function migratePriceThresholdMode(device: PriceThresholdMigrationDevice): Promise<boolean> {
  if (device.getStoreValue(PRICE_THRESHOLD_MIGRATION_FLAG)) return false;
  await device.setSettings({ price_threshold_mode: 'fixed' });
  await device.setStoreValue(PRICE_THRESHOLD_MIGRATION_FLAG, true);
  return true;
}

/**
 * Called in onAdded: a newly paired device uses the automatic thresholds.
 */
export async function useAutoThresholdsForNewDevice(device: PriceThresholdMigrationDevice): Promise<void> {
  await device.setSettings({ price_threshold_mode: 'auto' });
  await device.setStoreValue(PRICE_THRESHOLD_MIGRATION_FLAG, true);
}
