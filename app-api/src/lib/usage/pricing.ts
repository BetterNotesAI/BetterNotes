export interface ModelPricing {
  inputUsdPer1m: number;
  cachedInputUsdPer1m: number;
  outputUsdPer1m: number;
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

function normalizeModelId(model: string): string {
  const trimmed = model.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.split(':')[0].trim();
}

export function resolveModelPricing(providerRaw: string, modelRaw: string): ModelPricing {
  const provider = providerRaw.trim().toLowerCase();
  const model = normalizeModelId(modelRaw);

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
