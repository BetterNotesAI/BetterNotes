import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getUsageContext } from './context';
import { resolveModelPricing } from './pricing';

interface UsageDetails {
  cached_tokens?: number | null;
}

export interface ModelUsagePayload {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  prompt_tokens_details?: UsageDetails | null;
}

interface RecordModelUsageArgs {
  provider: string;
  model: string;
  usage: ModelUsagePayload | null | undefined;
  feature?: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}

let supabaseAdmin: SupabaseClient | null | undefined;

function getSupabaseAdminClient(): SupabaseClient | null {
  if (supabaseAdmin !== undefined) {
    return supabaseAdmin;
  }

  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    supabaseAdmin = null;
    return supabaseAdmin;
  }

  supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseAdmin;
}

function mergeFeature(explicitFeature: string | undefined, contextFeature: string | null): string | undefined {
  const routeFeature = contextFeature?.trim() || '';
  const opFeature = explicitFeature?.trim() || '';

  if (routeFeature && opFeature && routeFeature !== opFeature) {
    return `${routeFeature}:${opFeature}`;
  }
  if (routeFeature) return routeFeature;
  if (opFeature) return opFeature;
  return undefined;
}

export async function recordModelUsage(args: RecordModelUsageArgs): Promise<void> {
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

  const context = getUsageContext();
  const userId = (args.userId ?? context.userId)?.trim() || '';
  if (!userId) return;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  const pricing = resolveModelPricing(args.provider, args.model);
  const feature = mergeFeature(args.feature, context.feature);

  const metadata: Record<string, unknown> = {
    source: 'app-api',
    ...(context.path ? { path: context.path } : {}),
    ...(args.metadata ?? {}),
  };

  const { error } = await supabase.rpc('record_ai_usage', {
    p_user_id: userId,
    p_provider: args.provider,
    p_model: args.model,
    p_feature: feature ?? null,
    p_input_tokens: inputTokens,
    p_cached_input_tokens: cachedTokens,
    p_output_tokens: outputTokens,
    p_input_price_per_1m: pricing.inputUsdPer1m,
    p_cached_input_price_per_1m: pricing.cachedInputUsdPer1m,
    p_output_price_per_1m: pricing.outputUsdPer1m,
    p_metadata: metadata,
  });

  if (error) {
    console.warn('[usage] record_ai_usage failed:', error.message);
  }
}
