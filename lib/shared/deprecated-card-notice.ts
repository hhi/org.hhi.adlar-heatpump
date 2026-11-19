/** Store flag: the notice about the deprecated 'savings above' condition has been shown (v3.13.1). */
export const SAVINGS_ABOVE_NOTICE_STORE_KEY = 'savings_above_notice_shown';

/** Locale key of that notice. */
export const SAVINGS_ABOVE_NOTICE_MESSAGE_KEY = 'flow_notices.savings_above_deprecated';

/** What a device offers for a one-time timeline notice; matches Homey.Device structurally. */
export interface NoticeTarget {
  homey: {
    notifications: { createNotification(options: { excerpt: string }): Promise<unknown> };
    __(key: string, tags?: Record<string, unknown>): string;
  };
  getName(): string;
  getStoreValue(key: string): unknown;
  setStoreValue(key: string, value: unknown): Promise<unknown>;
}

/**
 * Shows a timeline notice once per device. The flag is stored only after the notice succeeded,
 * so a failed notice is tried again on the next call. Returns true when a notice was shown.
 */
export async function notifyOnce(target: NoticeTarget, storeKey: string, messageKey: string): Promise<boolean> {
  if (target.getStoreValue(storeKey) === true) return false;
  await target.homey.notifications.createNotification({
    excerpt: `${target.getName()}: ${target.homey.__(messageKey)}`,
  });
  await target.setStoreValue(storeKey, true);
  return true;
}
