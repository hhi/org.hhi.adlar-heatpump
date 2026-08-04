/* eslint-disable import/prefer-default-export */
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Flow Handler Wrapper Utility
 *
 * Provides AUTOMATIC centralized logging for ALL flow card handlers via runtime interception.
 * No manual wrapping needed - just call enableFlowCardLogging() in onInit().
 *
 * Benefits:
 * - Zero code changes to existing handlers
 * - Automatic logging of ALL flow cards (actions, conditions, triggers)
 * - Easy debugging: grep for "🎬 Flow" to see all flow activity
 * - Respects the log level of the device selected by the Flow card
 *
 * @version 2.1.0
 */

/**
 * Global flag to track if flow card logging is enabled.
 *
 * SHARED MODULE STATE — deliberate. This module lives in lib/shared/ and is loaded
 * once per app, so the interception itself is enabled only once. The decision to
 * emit a diagnostic log is made per Flow invocation from args.device, avoiding
 * one device's DEBUG setting enabling logs for every other device.
 *
 * Anything added to lib/shared/ must be checked for this pattern. Byte-identical
 * files are not automatically safe to share — mutable module state crosses driver
 * boundaries. See docs/architecture/IMPLEMENTATIEPLAN-v3.md, fase 1.
 */
let flowLoggingEnabled = false;

type DeviceLike = {
  getName?: () => string;
  getData?: () => Record<string, unknown>;
  getSetting?: (key: string) => unknown;
  log?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isDeviceLike = (value: unknown): value is DeviceLike => (
  isRecord(value) && ('getName' in value || 'getData' in value)
);

const summarizeFlowValue = (value: unknown, depth: number): unknown => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (value instanceof Error) {
    return { message: value.message };
  }
  if (Array.isArray(value)) {
    return `[Array(${value.length})]`;
  }
  if (depth < 0 || !isRecord(value)) {
    return '[Object]';
  }

  const summarized: Record<string, unknown> = {};
  Object.entries(value).forEach(([key, nested]) => {
    summarized[key] = summarizeFlowValue(nested, depth - 1);
  });

  return summarized;
};

const summarizeFlowPayload = (payload: unknown): unknown => {
  if (payload === null || payload === undefined) {
    return payload;
  }
  if (typeof payload !== 'object') {
    return payload;
  }
  if (Array.isArray(payload)) {
    return `[Array(${payload.length})]`;
  }
  if (!isRecord(payload)) {
    return '[Object]';
  }

  const summarized: Record<string, unknown> = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (key === 'device' && isDeviceLike(value)) {
      summarized.device = {
        name: typeof value.getName === 'function' ? value.getName() : undefined,
        data: typeof value.getData === 'function' ? value.getData() : undefined,
      };
      return;
    }

    summarized[key] = summarizeFlowValue(value, 1);
  });

  return summarized;
};

const getFlowDevice = (args: unknown): DeviceLike | null => {
  if (!isRecord(args) || !isDeviceLike(args.device)) return null;
  return args.device;
};

const isDebugEnabledForDevice = (device: DeviceLike | null): boolean => {
  try {
    return device?.getSetting?.('log_level') === 'debug';
  } catch {
    return false;
  }
};

/**
 * Enable automatic flow card logging by intercepting Homey's flow card methods
 *
 * Call this ONCE in app.ts onInit() BEFORE any flow cards are registered.
 * Execution logs are emitted only for a selected device with log_level=debug.
 *
 * @param homey - Homey instance (this.homey from App or Device)
 * @param appErrorLogger - Logger used for failures of app-wide cards without a device argument
 *
 * @example
 * ```typescript
 * // In app.ts or device.ts onInit():
 * async onInit() {
 *   // Device-bound Flow logs only show when that device is set to DEBUG.
 *   enableFlowCardLogging(this.homey, this.error.bind(this));
 *   // ... rest of initialization
 * }
 * ```
 */
export function enableFlowCardLogging(
  homey: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  appErrorLogger: (message: string, ...args: unknown[]) => void,
): void {
  if (flowLoggingEnabled) {
    return; // Already enabled, skip silently
  }

  flowLoggingEnabled = true;

  // Intercept getActionCard, getConditionCard, getTriggerCard
  const flowMethods = ['getActionCard', 'getConditionCard', 'getTriggerCard'] as const;

  flowMethods.forEach((methodName) => {
    const originalMethod = homey.flow[methodName].bind(homey.flow);

    // Replace method with intercepting version
    (homey.flow as any)[methodName] = (cardId: string) => {
      const card = originalMethod(cardId);
      const cardType = methodName.replace('get', '').replace('Card', '');

      // Wrap registerRunListener
      const originalRegisterRunListener = card.registerRunListener.bind(card);

      card.registerRunListener = (handler: any) => {
        const wrappedHandler = async (args: any, state: any) => {
          const summarizedArgs = summarizeFlowPayload(args);
          const summarizedState = summarizeFlowPayload(state);
          const device = getFlowDevice(args);
          const logDebug = isDebugEnabledForDevice(device);
          try {
            if (logDebug && device?.log) {
              device.log(`🎬 Flow ${cardType} fired: ${cardId}`, {
                args: summarizedArgs,
                state: summarizedState,
              });
            }

            const result = await handler(args, state);

            if (logDebug && device?.log) {
              device.log(`✅ Flow ${cardType} completed: ${cardId}`, { result });
            }

            return result;
          } catch (error) {
            const message = `❌ Flow ${cardType} failed: ${cardId}`;
            const details = {
              args: summarizedArgs,
              state: summarizedState,
              error: (error as Error).message,
              stack: (error as Error).stack,
            };
            if (device?.error) {
              device.error(message, details);
            } else {
              appErrorLogger(message, details);
            }

            throw error;
          }
        };

        return originalRegisterRunListener(wrappedHandler);
      };

      return card;
    };
  });
}
