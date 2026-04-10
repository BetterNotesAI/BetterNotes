import type { SupabaseClient } from '@supabase/supabase-js';

export interface CreditQuotaStatus {
  allowed: boolean;
  plan: string;
  remaining: number;
  credits_remaining?: number;
  credits_limit?: number;
}

interface UsageDetails {
  cached_tokens?: number | null;
}

export interface ModelUsagePayload {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  prompt_tokens_details?: UsageDetails | null;
}

interface ModelPricing {
  inputUsdPer1m: number;
  cachedInputUsdPer1m: number;
  outputUsdPer1m: number;
}

interface RecordAiUsageArgs {
  supabase: SupabaseClient;
  userId: string;
  provider: string;
  model: string;
  usage: ModelUsagePayload | null | undefined;
  feature: string;
  metadata?: Record<string, unknown>;
}

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

const DEFAULT_OPENAI_NANO_PRICING: ModelPricing = {
  inputUsdPer1m: readNumberEnv('AI_PRICE_OPENAI_GPT_5_4_NANO_INPUT_USD_PER_1M', 0.2),
  cachedInputUsdPer1m: readNumberEnv('AI_PRICE_OPENAI_GPT_5_4_NANO_CACHED_INPUT_USD_PER_1M', 0.02),
  outputUsdPer1m: readNumberEnv('AI_PRICE_OPENAI_GPT_5_4_NANO_OUTPUT_USD_PER_1M', 1.25),
};

function normalizeModel(model: string): string {
  return model.trim().toLowerCase().split(':')[0].trim();
}

function resolveModelPricing(providerRaw: string, modelRaw: string): ModelPricing {
  const provider = providerRaw.trim().toLowerCase();
  const model = normalizeModel(modelRaw);

  if (provider === 'openai' && model === 'gpt-5.4-nano') {
    return {
      inputUsdPer1m: readNumberEnv('AI_PRICE_OPENAI_GPT_5_4_NANO_INPUT_USD_PER_1M', DEFAULT_OPENAI_NANO_PRICING.inputUsdPer1m),
      cachedInputUsdPer1m: readNumberEnv('AI_PRICE_OPENAI_GPT_5_4_NANO_CACHED_INPUT_USD_PER_1M', DEFAULT_OPENAI_NANO_PRICING.cachedInputUsdPer1m),
      outputUsdPer1m: readNumberEnv('AI_PRICE_OPENAI_GPT_5_4_NANO_OUTPUT_USD_PER_1M', DEFAULT_OPENAI_NANO_PRICING.outputUsdPer1m),
    };
  }

  if (provider === 'groq' && model === 'llama-3.3-70b-versatile') {
    return {
      inputUsdPer1m: readNumberEnv('AI_PRICE_GROQ_LLAMA_3_3_70B_VERSATILE_INPUT_USD_PER_1M', DEFAULT_OPENAI_NANO_PRICING.inputUsdPer1m),
      cachedInputUsdPer1m: readNumberEnv('AI_PRICE_GROQ_LLAMA_3_3_70B_VERSATILE_CACHED_INPUT_USD_PER_1M', DEFAULT_OPENAI_NANO_PRICING.cachedInputUsdPer1m),
      outputUsdPer1m: readNumberEnv('AI_PRICE_GROQ_LLAMA_3_3_70B_VERSATILE_OUTPUT_USD_PER_1M', DEFAULT_OPENAI_NANO_PRICING.outputUsdPer1m),
    };
  }

  if (provider === 'openrouter' && model === 'qwen/qwen3.6-plus') {
    return {
      inputUsdPer1m: readNumberEnv('AI_PRICE_OPENROUTER_QWEN_QWEN3_6_PLUS_INPUT_USD_PER_1M', DEFAULT_OPENAI_NANO_PRICING.inputUsdPer1m),
      cachedInputUsdPer1m: readNumberEnv('AI_PRICE_OPENROUTER_QWEN_QWEN3_6_PLUS_CACHED_INPUT_USD_PER_1M', DEFAULT_OPENAI_NANO_PRICING.cachedInputUsdPer1m),
      outputUsdPer1m: readNumberEnv('AI_PRICE_OPENROUTER_QWEN_QWEN3_6_PLUS_OUTPUT_USD_PER_1M', DEFAULT_OPENAI_NANO_PRICING.outputUsdPer1m),
    };
  }

  if (provider === 'google' && model === 'gemini-3.1-flash-lite-preview') {
    return {
      inputUsdPer1m: readNumberEnv('AI_PRICE_GOOGLE_GEMINI_3_1_FLASH_LITE_PREVIEW_INPUT_USD_PER_1M', DEFAULT_OPENAI_NANO_PRICING.inputUsdPer1m),
      cachedInputUsdPer1m: readNumberEnv('AI_PRICE_GOOGLE_GEMINI_3_1_FLASH_LITE_PREVIEW_CACHED_INPUT_USD_PER_1M', DEFAULT_OPENAI_NANO_PRICING.cachedInputUsdPer1m),
      outputUsdPer1m: readNumberEnv('AI_PRICE_GOOGLE_GEMINI_3_1_FLASH_LITE_PREVIEW_OUTPUT_USD_PER_1M', DEFAULT_OPENAI_NANO_PRICING.outputUsdPer1m),
    };
  }

  return DEFAULT_OPENAI_NANO_PRICING;
}

export function buildInternalApiHeaders(
  userId: string,
  feature: string,
  apiInternalToken: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-bn-user-id': userId,
    'x-bn-feature': feature,
  };

  if (apiInternalToken) {
    headers.Authorization = `Bearer ${apiInternalToken}`;
  }

  return headers;
}

export async function checkCreditQuota(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreditQuotaStatus> {
  const { data, error } = await supabase.rpc('check_credit_quota', {
    p_user_id: userId,
  });

  if (error) {
    // Backward compatibility while DB migration is pending.
    if (error.message.toLowerCase().includes('check_credit_quota')) {
      const legacy = await supabase.rpc('check_and_increment_usage', {
        p_user_id: userId,
      });
      if (legacy.error) {
        throw new Error(legacy.error.message);
      }
      return {
        allowed: Boolean((legacy.data as { allowed?: boolean } | null)?.allowed),
        plan: (legacy.data as { plan?: string } | null)?.plan ?? 'free',
        remaining: (legacy.data as { remaining?: number } | null)?.remaining ?? 0,
      };
    }

    throw new Error(error.message);
  }

  return (data ?? {
    allowed: false,
    plan: 'free',
    remaining: 0,
    credits_remaining: 0,
    credits_limit: 10,
  }) as CreditQuotaStatus;
}

export async function recordAiUsage(
  args: RecordAiUsageArgs,
): Promise<void> {
  const usage = args.usage;
  if (!usage) return;

  const promptTokens = Math.max(0, Math.floor(usage.prompt_tokens ?? 0));
  const cachedTokensRaw = Math.max(0, Math.floor(usage.prompt_tokens_details?.cached_tokens ?? 0));
  const cachedTokens = Math.min(cachedTokensRaw, promptTokens);
  const inputTokens = Math.max(promptTokens - cachedTokens, 0);
  const outputTokens = Math.max(0, Math.floor(usage.completion_tokens ?? 0));

  if (inputTokens === 0 && cachedTokens === 0 && outputTokens === 0) {
    return;
  }

  const pricing = resolveModelPricing(args.provider, args.model);

  const { error } = await args.supabase.rpc('record_ai_usage', {
    p_user_id: args.userId,
    p_provider: args.provider,
    p_model: args.model,
    p_feature: args.feature,
    p_input_tokens: inputTokens,
    p_cached_input_tokens: cachedTokens,
    p_output_tokens: outputTokens,
    p_input_price_per_1m: pricing.inputUsdPer1m,
    p_cached_input_price_per_1m: pricing.cachedInputUsdPer1m,
    p_output_price_per_1m: pricing.outputUsdPer1m,
    p_metadata: args.metadata ?? {},
  });

  if (error) {
    console.warn('[usage] record_ai_usage failed:', error.message);
  }
}
