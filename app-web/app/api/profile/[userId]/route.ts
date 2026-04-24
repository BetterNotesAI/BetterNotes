/**
 * GET /api/profile/[userId]
 *
 * Returns a user's public profile + their published documents + aggregate stats.
 * Respects profile_visibility:
 *   - 'private' profiles are only visible to the owner
 *   - 'public'  profiles are visible to any authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createClient();
  const { userId } = await params;

  // Current viewer (optional)
  const { data: { user: viewer } } = await supabase.auth.getUser();
  const isOwn = viewer?.id === userId;

  // ── Profile ───────────────────────────────────────────────────────────────
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, banner_url, short_bio, university, degree, profile_visibility')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Respect visibility
  if (profile.profile_visibility === 'private' && !isOwn) {
    return NextResponse.json({ private: true, display_name: profile.display_name }, { status: 200 });
  }

  // ── Published documents ───────────────────────────────────────────────────
  const { data: docs } = await supabase
    .from('documents')
    .select('id, title, template_id, published_at, subject, degree, university, keywords, view_count, like_count, visibility')
    .eq('user_id', userId)
    .eq('is_published', true)
    .eq('visibility', 'public')
    .is('archived_at', null)
    .order('published_at', { ascending: false });

  const documents = docs ?? [];

  // ── Stats ─────────────────────────────────────────────────────────────────
  // published count (including private visibility)
  const { count: publishedCount } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_published', true)
    .is('archived_at', null);

  const totalViews = documents.reduce((s, d) => s + (d.view_count ?? 0), 0);
  const totalLikes = documents.reduce((s, d) => s + (d.like_count ?? 0), 0);

  // Forks received: count docs whose forked_from_id points to this user's docs
  const { count: forksReceived } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .not('forked_from_id', 'is', null)
    .in(
      'forked_from_id',
      documents.map((d) => d.id)
    );

  // ── User-specific enrichment (liked) ─────────────────────────────────────
  let likedSet = new Set<string>();
  if (viewer && documents.length > 0) {
    const { data: likedRows } = await supabase
      .from('document_likes')
      .select('document_id')
      .eq('user_id', viewer.id)
      .in('document_id', documents.map((d) => d.id));
    likedSet = new Set((likedRows ?? []).map((r) => r.document_id));
  }

  const enrichedDocs = documents.map((doc) => ({
    ...doc,
    user_liked: likedSet.has(doc.id),
    is_own: isOwn,
  }));

  return NextResponse.json({
    profile: {
      id:                 profile.id,
      display_name:       profile.display_name,
      username:           profile.username,
      avatar_url:         profile.avatar_url,
      banner_url:         profile.banner_url,
      short_bio:          profile.short_bio,
      university:         profile.university,
      degree:             profile.degree,
      profile_visibility: profile.profile_visibility,
    },
    stats: {
      published_count:  publishedCount ?? 0,
      total_views:      totalViews,
      total_likes:      totalLikes,
      forks_received:   forksReceived ?? 0,
    },
    documents: enrichedDocs,
    is_own: isOwn,
  });
}
