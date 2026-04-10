import { AsyncLocalStorage } from 'node:async_hooks';

export interface UsageRequestContext {
  userId: string | null;
  feature: string | null;
  path: string | null;
}

const usageContextStorage = new AsyncLocalStorage<UsageRequestContext>();

export function runWithUsageContext<T>(
  context: UsageRequestContext,
  callback: () => T,
): T {
  return usageContextStorage.run(context, callback);
}

export function getUsageContext(): UsageRequestContext {
  return usageContextStorage.getStore() ?? {
    userId: null,
    feature: null,
    path: null,
  };
}
