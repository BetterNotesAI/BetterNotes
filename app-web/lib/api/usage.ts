import { supabase, getCurrentUser } from "@/lib/supabase";

export interface UsageStatus {
  message_count: number;
  free_limit: number;
  remaining: number;
  is_paid: boolean;
  can_send: boolean;
  resets_at: string;
}

export interface IncrementResult {
  new_count: number;
  remaining: number;
  limit_reached: boolean;
  is_paid: boolean;
}

function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function normalizeUsageStatus(raw: unknown): UsageStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const isPaid = toBoolean(obj.is_paid ?? obj.isPro ?? obj.paid) ?? false;
  const messageCount = toNumber(obj.message_count ?? obj.current_count ?? obj.count, 0);
  const freeLimit = toNumber(obj.free_limit ?? obj.limit ?? obj.daily_limit ?? obj.free_messages_limit ?? 50, 50);
  const remaining = toNumber(obj.remaining, Math.max(0, freeLimit - messageCount));
  const canSend =
    toBoolean(obj.can_send ?? obj.canSend) ??
    (toBoolean(obj.limit_reached) !== null ? !Boolean(obj.limit_reached) : (isPaid || remaining > 0));
  return {
    message_count: messageCount,
    free_limit: freeLimit,
    remaining,
    is_paid: isPaid,
    can_send: canSend,
    resets_at: String(obj.resets_at ?? obj.reset_at ?? obj.resetsAt ?? ""),
  };
}

function normalizeIncrementResult(raw: unknown): IncrementResult | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const isPaid = toBoolean(obj.is_paid ?? obj.isPro ?? obj.paid) ?? false;
  const newCount = toNumber(obj.new_count ?? obj.message_count ?? obj.count, 0);
  const remaining = toNumber(obj.remaining, 0);
  const limitReached =
    toBoolean(obj.limit_reached) ??
    (toBoolean(obj.can_send) !== null ? !Boolean(obj.can_send) : (!isPaid && remaining <= 0));
  return { new_count: newCount, remaining, limit_reached: limitReached, is_paid: isPaid };
}

export async function getUsageStatus(): Promise<UsageStatus | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const { data, error } = await supabase.rpc('get_usage_status', { p_user_id: user.id }).single();
    if (error) { console.warn("Failed to get usage status:", error.message); return null; }
    return normalizeUsageStatus(data);
  } catch (e) {
    console.warn("getUsageStatus error:", e);
    return null;
  }
}

export async function incrementMessageCount(): Promise<IncrementResult | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const { data, error } = await supabase.rpc('increment_message_count', { p_user_id: user.id }).single();
    if (error) { console.warn("Failed to increment message count:", error.message); return null; }
    return normalizeIncrementResult(data);
  } catch (e) {
    console.warn("incrementMessageCount error:", e);
    return null;
  }
}
