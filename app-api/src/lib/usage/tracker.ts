import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getUsageContext, accumulateRequestUsage } from './context';
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
  projectType?: string | null;
  projectId?: string | null;
  metadata?: Record<string, unknown>;
}

let supabaseAdmin: SupabaseClient | null | undefined;
let hasLoggedSupabaseConfigError = false;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logSupabaseConfigWarning(message: string): void {
  if (hasLoggedSupabaseConfigError) return;
  hasLoggedSupabaseConfigError = true;
  console.warn(message);
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getSupabaseAdminClient(): SupabaseClient | null {
  if (supabaseAdmin !== undefined) {
    return supabaseAdmin;
  }

  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    logSupabaseConfigWarning(
      '[usage] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. Usage tracking disabled.',
    );
    supabaseAdmin = null;
    return supabaseAdmin;
  }

  if (!isValidHttpUrl(url)) {
    logSupabaseConfigWarning(
      `[usage] Invalid SUPABASE_URL ("${url}"). Usage tracking disabled.`,
    );
    supabaseAdmin = null;
    return supabaseAdmin;
  }

  try {
    supabaseAdmin = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch (error: unknown) {
    logSupabaseConfigWarning(
      `[usage] Failed to initialize Supabase client. Usage tracking disabled. ${toErrorMessage(error)}`,
    );
    supabaseAdmin = null;
  }

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

function normalizeProjectType(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'document'
    || normalized === 'cheat_sheet'
    || normalized === 'problem_solver'
    || normalized === 'exam'
  ) {
    return normalized;
  }
  return null;
}

function normalizeProjectId(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
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

  const pricing = resolveModelPricing(args.provider, args.model);

  // Always accumulate in the request context so the route handler can return
  // usage to app-web for authoritative recording (works even without Supabase).
  accumulateRequestUsage(
    args.provider,
    args.model,
    inputTokens,
    cachedTokens,
    outputTokens,
    pricing.inputUsdPer1m,
    pricing.cachedInputUsdPer1m,
    pricing.outputUsdPer1m,
  );

  const supabase = getSupabaseAdminClient();
  if (!supabase) return;
  const feature = mergeFeature(args.feature, context.feature);
  const projectType = normalizeProjectType(args.projectType ?? context.projectType);
  const projectId = normalizeProjectId(args.projectId ?? context.projectId);

  const metadata: Record<string, unknown> = {
    source: 'app-api',
    ...(context.path ? { path: context.path } : {}),
    ...(projectType ? { project_type: projectType } : {}),
    ...(projectId ? { project_id: projectId } : {}),
    ...(args.metadata ?? {}),
  };

  try {
    const rpcArgs = {
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
      p_project_type: projectType,
      p_project_id: projectId,
    };

    let { error } = await supabase.rpc('record_ai_usage', rpcArgs);
    const errorMessage = error?.message?.toLowerCase() ?? '';
    const shouldRetryLegacy =
      error
      && (
        errorMessage.includes('p_project_type')
        || errorMessage.includes('p_project_id')
        || errorMessage.includes('could not find')
        || errorMessage.includes('function public.record_ai_usage')
      );

    if (shouldRetryLegacy) {
      const legacyResult = await supabase.rpc('record_ai_usage', {
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
      error = legacyResult.error;
    }

    if (error) {
      console.warn('[usage] record_ai_usage failed:', error.message);
    }
  } catch (error: unknown) {
    console.warn('[usage] record_ai_usage request failed:', toErrorMessage(error));
  }
}
