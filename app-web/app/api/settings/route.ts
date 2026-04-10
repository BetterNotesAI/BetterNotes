import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PROFILE_SELECT = [
  'id',
  'email',
  'display_name',
  'username',
  'avatar_url',
  'banner_url',
  'short_bio',
  'university',
  'degree',
  'profile_visibility',
  'theme',
  'language',
  'plan',
  'is_anonymous',
].join(',');

const ALLOWED_THEMES = new Set(['light', 'dark', 'system']);
const ALLOWED_LANGUAGES = new Set(['en', 'es', 'fr', 'de', 'it', 'pt']);
const ALLOWED_VISIBILITY = new Set(['public', 'private']);

interface SettingsPatchBody {
  displayName?: unknown;
  username?: unknown;
  avatarUrl?: unknown;
  bannerUrl?: unknown;
  shortBio?: unknown;
  university?: unknown;
  degree?: unknown;
  profileVisibility?: unknown;
  theme?: unknown;
  language?: unknown;
}

interface ProfileRow {
  email: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  short_bio: string | null;
  university: string | null;
  degree: string | null;
  profile_visibility: 'public' | 'private' | null;
  theme: 'light' | 'dark' | 'system' | null;
  language: 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | null;
  plan: 'free' | 'pro' | null;
  is_anonymous: boolean | null;
}

function sanitizeOptionalString(input: unknown, maxLen: number): string | null {
  if (typeof input !== 'string') {
    throw new Error('invalid_type');
  }
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function parseProviders(rawProviders: unknown): string[] {
  if (!Array.isArray(rawProviders)) return [];
  const normalized = rawProviders
    .map((provider) => (typeof provider === 'string' ? provider.trim().toLowerCase() : ''))
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profileRaw, error: profileError } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', user.id)
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profileRaw) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }
  const profile = profileRaw as ProfileRow;

  const providersFromIdentities = Array.isArray(user.identities)
    ? parseProviders(user.identities.map((identity) => identity?.provider))
    : [];

  const providersFromMetadata = parseProviders(
    Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : []
  );

  const providers = Array.from(new Set([...providersFromIdentities, ...providersFromMetadata]));

  return NextResponse.json({
    profile: {
      email: user.email ?? profile.email ?? null,
      display_name: profile.display_name,
      username: profile.username,
      avatar_url: profile.avatar_url,
      banner_url: profile.banner_url,
      short_bio: profile.short_bio,
      university: profile.university,
      degree: profile.degree,
      profile_visibility: profile.profile_visibility ?? 'public',
      theme: profile.theme ?? 'dark',
      language: profile.language ?? 'en',
      plan: profile.plan ?? 'free',
      is_anonymous: profile.is_anonymous ?? false,
    },
    auth: {
      providers,
      primary_provider:
        typeof user.app_metadata?.provider === 'string' ? user.app_metadata.provider : null,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as SettingsPatchBody;
  const updates: Record<string, string | null> = {};

  try {
    if ('displayName' in body) {
      updates.display_name = sanitizeOptionalString(body.displayName, 80);
    }

    if ('username' in body) {
      const usernameValue = sanitizeOptionalString(body.username, 32);
      if (usernameValue && !/^[A-Za-z0-9_]{3,32}$/.test(usernameValue)) {
        return NextResponse.json(
          { error: 'Username must have 3-32 characters (letters, numbers, underscore).' },
          { status: 400 }
        );
      }
      updates.username = usernameValue;
    }

    if ('avatarUrl' in body) {
      updates.avatar_url = sanitizeOptionalString(body.avatarUrl, 2048);
    }

    if ('bannerUrl' in body) {
      updates.banner_url = sanitizeOptionalString(body.bannerUrl, 2048);
    }

    if ('shortBio' in body) {
      const bio = sanitizeOptionalString(body.shortBio, 280);
      updates.short_bio = bio;
    }

    if ('university' in body) {
      updates.university = sanitizeOptionalString(body.university, 120);
    }

    if ('degree' in body) {
      updates.degree = sanitizeOptionalString(body.degree, 120);
    }

    if ('profileVisibility' in body) {
      if (typeof body.profileVisibility !== 'string' || !ALLOWED_VISIBILITY.has(body.profileVisibility)) {
        return NextResponse.json({ error: 'Invalid profile visibility.' }, { status: 400 });
      }
      updates.profile_visibility = body.profileVisibility;
    }

    if ('theme' in body) {
      if (typeof body.theme !== 'string' || !ALLOWED_THEMES.has(body.theme)) {
        return NextResponse.json({ error: 'Invalid theme.' }, { status: 400 });
      }
      updates.theme = body.theme;
    }

    if ('language' in body) {
      if (typeof body.language !== 'string' || !ALLOWED_LANGUAGES.has(body.language)) {
        return NextResponse.json({ error: 'Invalid language.' }, { status: 400 });
      }
      updates.language = body.language;
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data: updatedProfileRaw, error: updateError } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select(PROFILE_SELECT)
    .single();

  if (updateError) {
    if (updateError.code === '23505' || updateError.message.toLowerCase().includes('username')) {
      return NextResponse.json({ error: 'This username is already taken.' }, { status: 409 });
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updatedProfileRaw) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }

  const updatedProfile = updatedProfileRaw as ProfileRow;

  return NextResponse.json({
    profile: {
      email: user.email ?? updatedProfile.email ?? null,
      display_name: updatedProfile.display_name,
      username: updatedProfile.username,
      avatar_url: updatedProfile.avatar_url,
      banner_url: updatedProfile.banner_url,
      short_bio: updatedProfile.short_bio,
      university: updatedProfile.university,
      degree: updatedProfile.degree,
      profile_visibility: updatedProfile.profile_visibility ?? 'public',
      theme: updatedProfile.theme ?? 'dark',
      language: updatedProfile.language ?? 'en',
      plan: updatedProfile.plan ?? 'free',
      is_anonymous: updatedProfile.is_anonymous ?? false,
    },
  });
}
