import { AsyncLocalStorage } from 'node:async_hooks';

/** Accumulated token counts across all AI calls made during a single request. */
export interface AccumulatedUsage {
  provider: string;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  inputPricePer1m: number;
  cachedInputPricePer1m: number;
  outputPricePer1m: number;
}

export interface UsageRequestContext {
  userId: string | null;
  feature: string | null;
  projectType: string | null;
  projectId: string | null;
  path: string | null;
  /** Mutable — accumulates usage across all AI calls in this request so the
   *  route handler can forward it to app-web for authoritative recording. */
  accumulatedUsage: AccumulatedUsage | null;
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
    projectType: null,
    projectId: null,
    path: null,
    accumulatedUsage: null,
  };
}

/**
 * Mutate the current request's context to add token counts from one AI call.
 * Safe to call multiple times per request — values are summed.
 */
export function accumulateRequestUsage(
  provider: string,
  model: string,
  inputTokens: number,
  cachedInputTokens: number,
  outputTokens: number,
  inputPricePer1m: number,
  cachedInputPricePer1m: number,
  outputPricePer1m: number,
): void {
  const ctx = usageContextStorage.getStore();
  if (!ctx) return;

  if (!ctx.accumulatedUsage) {
    ctx.accumulatedUsage = {
      provider,
      model,
      inputTokens,
      cachedInputTokens,
      outputTokens,
      inputPricePer1m,
      cachedInputPricePer1m,
      outputPricePer1m,
    };
  } else {
    // Sum tokens (use the last provider/model — the main generation dominates anyway)
    ctx.accumulatedUsage.provider = provider;
    ctx.accumulatedUsage.model = model;
    ctx.accumulatedUsage.inputTokens += inputTokens;
    ctx.accumulatedUsage.cachedInputTokens += cachedInputTokens;
    ctx.accumulatedUsage.outputTokens += outputTokens;
    ctx.accumulatedUsage.inputPricePer1m = inputPricePer1m;
    ctx.accumulatedUsage.cachedInputPricePer1m = cachedInputPricePer1m;
    ctx.accumulatedUsage.outputPricePer1m = outputPricePer1m;
  }
}
