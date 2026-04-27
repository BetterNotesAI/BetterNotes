/**
 * GET /api/profile/[userId]/contributions
 *
 * Returns an array of 30 objects — one per calendar day (UTC), oldest first —
 * each containing the count of "active" events for that day.
 *
 * Activity sources:
 *   1. documents.created_at  — document created by the user
 *   2. chat_messages.created_at WHERE role = 'user' — message sent by the user
 *
 * Visibility gate: if the profile is private and the requester is not the owner,
 * returns an empty array (all counts = 0) rather than a 403 so the UI renders
 * gracefully without exposing metadata.
 *
 * No auth required — only public-safe aggregate counts are returned.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface DayEntry {
  date: string; // "YYYY-MM-DD"
  count: number;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createClient();
  const { userId } = await params;

  // ── Visibility gate ──────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('profile_visibility')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { data: { user: viewer } } = await supabase.auth.getUser();
  const isOwn = viewer?.id === userId;

  // Build the 30-day skeleton (UTC dates), oldest → today
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const days: DayEntry[] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (29 - i));
    return {
      date: d.toISOString().slice(0, 10),
      count: 0,
    };
  });

  // If profile is private and requester is not the owner, return the empty skeleton
  if (profile.profile_visibility === 'private' && !isOwn) {
    return NextResponse.json(days);
  }

  // Build a map for fast lookup: "YYYY-MM-DD" → index in `days`
  const dateIndex = new Map<string, number>(days.map((d, i) => [d.date, i]));

  const cutoff = days[0].date; // 30 days ago (inclusive)

  // ── Source 1: documents created ──────────────────────────────────────────
  const { data: docRows } = await supabase.rpc('contributions_documents', {
    p_user_id: userId,
    p_cutoff:  cutoff,
  });

  if (docRows) {
    for (const row of docRows as { day: string; cnt: number }[]) {
      const idx = dateIndex.get(row.day);
      if (idx !== undefined) days[idx].count += row.cnt;
    }
  }

  // ── Source 2: chat messages sent ─────────────────────────────────────────
  const { data: chatRows } = await supabase.rpc('contributions_chat', {
    p_user_id: userId,
    p_cutoff:  cutoff,
  });

  if (chatRows) {
    for (const row of chatRows as { day: string; cnt: number }[]) {
      const idx = dateIndex.get(row.day);
      if (idx !== undefined) days[idx].count += row.cnt;
    }
  }

  return NextResponse.json(days);
}
