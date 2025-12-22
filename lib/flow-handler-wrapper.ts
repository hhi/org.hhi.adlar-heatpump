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
 * - Conditional on DEVMODE for production safety
 *
 * @version 2.0.0
 */

/**
 * Global flag to track if flow card logging is enabled
 */
let flowLoggingEnabled = false;

type DeviceLike = {
  getName?: () => string;
  getData?: () => Record<string, unknown>;
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

/**
 * Enable automatic flow card logging by intercepting Homey's flow card methods
 *
 * Call this ONCE in app.ts onInit() or device.ts onInit() BEFORE any flow cards are registered.
 * Only enables logging if DEVMODE environment variable is set.
 *
 * @param homey - Homey instance (this.homey from App or Device)
 * @param logger - Logger function (this.log.bind(this))
 *
 * @example
 * ```typescript
 * // In app.ts or device.ts onInit():
 * async onInit() {
 *   enableFlowCardLogging(this.homey, this.log.bind(this));
 *   // ... rest of initialization
 * }
 * ```
 */
export function enableFlowCardLogging(
  homey: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  logger: (message: string, ...args: unknown[]) => void,
): void {
  // Only enable in DEVMODE
  const devMode = process.env.DEVMODE === '1' || process.env.DEBUG === '1';
  if (!devMode) {
    logger('Flow card logging disabled (DEVMODE not set)');
    return;
  }

  if (flowLoggingEnabled) {
    logger('⚠️ Flow card logging already enabled - skipping duplicate initialization');
    return;
  }

  flowLoggingEnabled = true;
  logger('✅ Flow card logging enabled (DEVMODE active) - intercepting all flow cards');

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
          try {
            logger(`🎬 Flow ${cardType} fired: ${cardId}`, {
              args: summarizedArgs,
              state: summarizedState,
            });

            const result = await handler(args, state);

            logger(`✅ Flow ${cardType} completed: ${cardId}`, { result });

            return result;
          } catch (error) {
            logger(`❌ Flow ${cardType} failed: ${cardId}`, {
              args: summarizedArgs,
              state: summarizedState,
              error: (error as Error).message,
              stack: (error as Error).stack,
            });

            throw error;
          }
        };

        return originalRegisterRunListener(wrappedHandler);
      };

      return card;
    };
  });

  logger('🎯 Flow card interception active for: actions, conditions, triggers');
}
