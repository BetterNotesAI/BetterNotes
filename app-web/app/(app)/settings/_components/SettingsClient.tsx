'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  isLanguagePreference,
  isThemePreference,
  LanguagePreference,
  ThemePreference,
  USER_ACADEMIC_UPDATED_EVENT,
  USER_PREFERENCES_EVENT,
} from '../../_lib/preferences';

type SettingsSection = 'account' | 'profile' | 'preferences' | 'academic';

type ProfileVisibility = 'public' | 'private';

interface SettingsClientProps {
  defaultSection?: SettingsSection;
  title?: string;
  subtitle?: string;
}

interface SettingsProfile {
  email: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  short_bio: string | null;
  university: string | null;
  degree: string | null;
  profile_visibility: ProfileVisibility;
  theme: ThemePreference;
  language: LanguagePreference;
  plan: 'free' | 'pro';
  is_anonymous: boolean;
  profile_university_id: string | null;
  profile_program_id: string | null;
  profile_year: number | null;
}

interface SettingsResponse {
  profile: SettingsProfile;
  auth?: {
    providers?: string[];
    primary_provider?: string | null;
  };
}

interface NoticeState {
  type: 'success' | 'error';
  text: string;
}

interface AccountFormState {
  displayName: string;
  username: string;
}

interface ProfileFormState {
  avatarUrl: string;
  bannerUrl: string;
  shortBio: string;
  university: string;
  degree: string;
  profileVisibility: ProfileVisibility;
}

interface PreferencesFormState {
  theme: ThemePreference;
  language: LanguagePreference;
}

interface AcademicFormState {
  universityId: string;
  programId: string;
  year: number;
}

interface CatalogueUniversity {
  id: string;
  name: string;
  slug: string;
  country: string | null;
}

interface CatalogueProgram {
  id: string;
  tipo: string;
  title: string;
  slug: string;
}

const DEFAULT_PROFILE: SettingsProfile = {
  email: null,
  display_name: null,
  username: null,
  avatar_url: null,
  banner_url: null,
  short_bio: null,
  university: null,
  degree: null,
  profile_visibility: 'public',
  theme: 'dark',
  language: 'en',
  plan: 'free',
  is_anonymous: false,
  profile_university_id: null,
  profile_program_id: null,
  profile_year: null,
};

const SECTION_LABELS: Record<SettingsSection, string> = {
  account: 'Account',
  profile: 'Profile Details',
  academic: 'Academic',
  preferences: 'App Preferences',
};

const LANGUAGE_OPTIONS: Array<{ value: LanguagePreference; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
];

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; description: string }> = [
  { value: 'light', label: 'Light', description: 'Use a bright interface.' },
  { value: 'dark', label: 'Dark', description: 'Use a dark interface.' },
  { value: 'system', label: 'System', description: 'Match your device settings.' },
];

const PROFILE_MEDIA_BUCKET = 'user-avatars';
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

function parseErrorMessage(respBody: unknown, fallback: string): string {
  if (typeof respBody === 'object' && respBody && 'error' in respBody) {
    const error = (respBody as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) return error;
  }
  return fallback;
}

function normalizeProfile(payload: Partial<SettingsProfile & { profile_university_id?: string | null; profile_program_id?: string | null; profile_year?: number | null }> | null | undefined): SettingsProfile {
  if (!payload) return DEFAULT_PROFILE;
  return {
    ...DEFAULT_PROFILE,
    ...payload,
    profile_visibility: payload.profile_visibility === 'private' ? 'private' : 'public',
    theme: isThemePreference(payload.theme) ? payload.theme : 'dark',
    language: isLanguagePreference(payload.language) ? payload.language : 'en',
    plan: payload.plan === 'pro' ? 'pro' : 'free',
    is_anonymous: Boolean(payload.is_anonymous),
    profile_university_id: payload.profile_university_id ?? null,
    profile_program_id: payload.profile_program_id ?? null,
    profile_year: payload.profile_year ?? null,
  };
}

function toAccountForm(profile: SettingsProfile): AccountFormState {
  return {
    displayName: profile.display_name ?? '',
    username: profile.username ?? '',
  };
}

function toProfileForm(profile: SettingsProfile): ProfileFormState {
  return {
    avatarUrl: profile.avatar_url ?? '',
    bannerUrl: profile.banner_url ?? '',
    shortBio: profile.short_bio ?? '',
    university: profile.university ?? '',
    degree: profile.degree ?? '',
    profileVisibility: profile.profile_visibility,
  };
}

function toPreferencesForm(profile: SettingsProfile): PreferencesFormState {
  return {
    theme: profile.theme,
    language: profile.language,
  };
}

function toAcademicForm(profile: SettingsProfile): AcademicFormState {
  return {
    universityId: profile.profile_university_id ?? '',
    programId: profile.profile_program_id ?? '',
    year: profile.profile_year ?? 1,
  };
}

function providerLabel(provider: string): string {
  const normalized = provider.trim().toLowerCase();
  if (normalized === 'email') return 'Email/Password';
  if (normalized === 'google') return 'Google';
  if (normalized === 'apple') return 'Apple';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function authenticationMethodText(providers: string[], isAnonymous: boolean): string {
  if (isAnonymous) {
    return 'Anonymous guest session';
  }

  if (providers.length === 0) {
    return 'No authentication providers detected';
  }

  if (providers.length === 1 && providers[0] === 'email') {
    return 'Password';
  }

  return providers.map(providerLabel).join(' + ');
}

export default function SettingsClient({
  defaultSection = 'account',
  title = 'Settings',
  subtitle = 'Manage your account, profile and application preferences.',
}: SettingsClientProps) {
  const router = useRouter();

  const [activeSection, setActiveSection] = useState<SettingsSection>(defaultSection);
  const [profile, setProfile] = useState<SettingsProfile>(DEFAULT_PROFILE);
  const [providers, setProviders] = useState<string[]>([]);

  const [accountForm, setAccountForm] = useState<AccountFormState>(toAccountForm(DEFAULT_PROFILE));
  const [profileForm, setProfileForm] = useState<ProfileFormState>(toProfileForm(DEFAULT_PROFILE));
  const [preferencesForm, setPreferencesForm] = useState<PreferencesFormState>(
    toPreferencesForm(DEFAULT_PROFILE)
  );

  const [academicForm, setAcademicForm] = useState<AcademicFormState>(
    toAcademicForm(DEFAULT_PROFILE)
  );
  const [universities, setUniversities] = useState<CatalogueUniversity[]>([]);
  const [programs, setPrograms] = useState<CatalogueProgram[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [universitySearch, setUniversitySearch] = useState('');

  const [emailDraft, setEmailDraft] = useState('');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [confirmPasswordDraft, setConfirmPasswordDraft] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const bannerFileInputRef = useRef<HTMLInputElement | null>(null);

  const hasGoogleLinked = providers.includes('google');
  const hasAppleLinked = providers.includes('apple');
  const authMethod = useMemo(
    () => authenticationMethodText(providers, profile.is_anonymous),
    [providers, profile.is_anonymous]
  );

  useEffect(() => {
    let ignore = false;

    async function run() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/settings');
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(parseErrorMessage(body, 'Could not load settings.'));
        }

        const data = await response.json() as SettingsResponse;
        const nextProfile = normalizeProfile(data.profile);

        const authProviders = Array.isArray(data.auth?.providers)
          ? data.auth.providers
              .map((provider) => provider.trim().toLowerCase())
              .filter(Boolean)
          : [];

        if (!ignore) {
          const uniqueProviders = Array.from(new Set(authProviders));
          setProfile(nextProfile);
          setProviders(uniqueProviders);
          setAccountForm(toAccountForm(nextProfile));
          setProfileForm(toProfileForm(nextProfile));
          setPreferencesForm(toPreferencesForm(nextProfile));
          setAcademicForm(toAcademicForm(nextProfile));
          setEmailDraft(nextProfile.email ?? '');
        }
      } catch (error) {
        if (!ignore) {
          setNotice({
            type: 'error',
            text: error instanceof Error ? error.message : 'Could not load settings.',
          });
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void run();
    return () => {
      ignore = true;
    };
  }, []);

  async function patchSettings(payload: Record<string, unknown>): Promise<SettingsProfile> {
    const response = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(parseErrorMessage(body, 'Could not save settings.'));
    }

    const updated = normalizeProfile((body as { profile?: Partial<SettingsProfile> }).profile);
    setProfile(updated);
    return updated;
  }

  function dispatchPreferences(theme: ThemePreference, language: LanguagePreference) {
    window.dispatchEvent(
      new CustomEvent(USER_PREFERENCES_EVENT, {
        detail: { theme, language },
      })
    );
  }

  function dispatchAcademicUpdated(universityText: string | null, year: number | null) {
    window.dispatchEvent(
      new CustomEvent(USER_ACADEMIC_UPDATED_EVENT, {
        detail: { university: universityText, profile_year: year },
      })
    );
  }

  // Load universities once when academic section becomes active
  useEffect(() => {
    if (activeSection !== 'academic' || universities.length > 0) return;
    let ignore = false;
    fetch('/api/catalogue?resource=universities')
      .then((r) => r.ok ? r.json() : { universities: [] })
      .then((data: { universities?: CatalogueUniversity[] }) => {
        if (!ignore) setUniversities(data.universities ?? []);
      })
      .catch(() => {});
    return () => { ignore = true; };
  }, [activeSection, universities.length]);

  // Load programmes when university selection changes inside the academic form
  useEffect(() => {
    if (!academicForm.universityId) {
      setPrograms([]);
      return;
    }
    let ignore = false;
    setProgramsLoading(true);
    fetch(`/api/catalogue?resource=programs&university_id=${academicForm.universityId}`)
      .then((r) => r.ok ? r.json() : { programs: [] })
      .then((data: { programs?: CatalogueProgram[] }) => {
        if (!ignore) setPrograms(data.programs ?? []);
      })
      .catch(() => {})
      .finally(() => { if (!ignore) setProgramsLoading(false); });
    return () => { ignore = true; };
  }, [academicForm.universityId]);

  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusyAction('save-account');
    setNotice(null);

    try {
      const updated = await patchSettings({
        displayName: accountForm.displayName,
        username: accountForm.username,
      });

      setAccountForm(toAccountForm(updated));
      setNotice({ type: 'success', text: 'Account details updated.' });
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not save account details.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusyAction('save-profile');
    setNotice(null);

    try {
      const updated = await patchSettings({
        avatarUrl: profileForm.avatarUrl,
        bannerUrl: profileForm.bannerUrl,
        shortBio: profileForm.shortBio,
        university: profileForm.university,
        degree: profileForm.degree,
        profileVisibility: profileForm.profileVisibility,
      });

      setProfileForm(toProfileForm(updated));
      setNotice({ type: 'success', text: 'Profile details updated.' });
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not save profile details.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveAcademic(e: React.FormEvent) {
    e.preventDefault();
    setBusyAction('save-academic');
    setNotice(null);

    try {
      // Derive the denormalised university text from catalogue data
      const selectedUni = universities.find((u) => u.id === academicForm.universityId);
      const selectedProg = programs.find((p) => p.id === academicForm.programId);

      const updated = await patchSettings({
        profile_university_id: academicForm.universityId || null,
        profile_program_id: academicForm.programId || null,
        profile_year: academicForm.year,
        // Keep the denormalised `university` text field in sync for sidebar + public profile
        university: selectedUni?.name ?? null,
        degree: selectedProg?.title ?? null,
      });

      setAcademicForm(toAcademicForm(updated));
      dispatchAcademicUpdated(updated.university, updated.profile_year);
      setNotice({ type: 'success', text: 'Academic details updated. My Studies will reflect the new curriculum.' });
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not save academic details.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  function createProfileImagePath(userId: string, kind: 'avatar' | 'banner', fileName: string): string {
    const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : null;
    const safeExtension = extension && /^[a-z0-9]+$/.test(extension) ? extension : 'jpg';
    const nonce = Math.random().toString(36).slice(2, 8);
    return `${userId}/${kind}/${kind}-${Date.now()}-${nonce}.${safeExtension}`;
  }

  async function handleUploadProfileImage(kind: 'avatar' | 'banner', file: File) {
    if (!file.type.startsWith('image/')) {
      setNotice({ type: 'error', text: 'Please upload an image file.' });
      return;
    }

    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      setNotice({ type: 'error', text: 'Image must be 5 MB or smaller.' });
      return;
    }

    setBusyAction(`upload-${kind}`);
    setNotice(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error('You must be signed in to upload images.');
      }

      const path = createProfileImagePath(user.id, kind, file.name);
      const { error: uploadError } = await supabase.storage
        .from(PROFILE_MEDIA_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage.from(PROFILE_MEDIA_BUCKET).getPublicUrl(path);
      const publicUrl = publicUrlData.publicUrl;

      setProfileForm((prev) => ({
        ...prev,
        avatarUrl: kind === 'avatar' ? publicUrl : prev.avatarUrl,
        bannerUrl: kind === 'banner' ? publicUrl : prev.bannerUrl,
      }));

      setNotice({
        type: 'success',
        text: `${kind === 'avatar' ? 'Profile photo' : 'Banner'} uploaded. Click "Save profile details" to apply.`,
      });
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not upload image.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    await handleUploadProfileImage('avatar', file);
  }

  async function handleBannerFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    await handleUploadProfileImage('banner', file);
  }

  async function handleSavePreferences(e: React.FormEvent) {
    e.preventDefault();
    setBusyAction('save-preferences');
    setNotice(null);

    try {
      const updated = await patchSettings({
        theme: preferencesForm.theme,
        language: preferencesForm.language,
      });

      const nextPreferences = toPreferencesForm(updated);
      setPreferencesForm(nextPreferences);
      dispatchPreferences(nextPreferences.theme, nextPreferences.language);
      setNotice({ type: 'success', text: 'App preferences updated.' });
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not save preferences.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleEmailUpdate(e: React.FormEvent) {
    e.preventDefault();
    setBusyAction('update-email');
    setNotice(null);

    const nextEmail = emailDraft.trim();
    if (!nextEmail) {
      setNotice({ type: 'error', text: 'Please provide a valid email address.' });
      setBusyAction(null);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ email: nextEmail });

      if (error) {
        throw new Error(error.message);
      }

      setProfile((current) => ({ ...current, email: nextEmail }));
      setNotice({
        type: 'success',
        text: 'Email update requested. Check your inbox to confirm the new address.',
      });
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not update email.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setBusyAction('update-password');
    setNotice(null);

    if (passwordDraft.length < 8) {
      setNotice({ type: 'error', text: 'Password must be at least 8 characters.' });
      setBusyAction(null);
      return;
    }

    if (passwordDraft !== confirmPasswordDraft) {
      setNotice({ type: 'error', text: 'Passwords do not match.' });
      setBusyAction(null);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: passwordDraft });
      if (error) {
        throw new Error(error.message);
      }

      setPasswordDraft('');
      setConfirmPasswordDraft('');
      setNotice({ type: 'success', text: 'Password updated successfully.' });
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not update password.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleConnectProvider(provider: 'google' | 'apple') {
    setBusyAction(`connect-${provider}`);
    setNotice(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.linkIdentity({
        provider,
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.href : undefined,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      // On success, Supabase redirects to provider auth.
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : `Could not connect ${providerLabel(provider)}.`,
      });
      setBusyAction(null);
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();

    if (deleteConfirmation.trim() !== 'DELETE') {
      setNotice({ type: 'error', text: 'Type DELETE to confirm account deletion.' });
      return;
    }

    setBusyAction('delete-account');
    setNotice(null);

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE' }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseErrorMessage(body, 'Could not delete account.'));
      }

      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/');
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not delete account.',
      });
      setBusyAction(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
            >
              <span aria-hidden>←</span>
              Back
            </button>
            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">{title}</h1>
            <p className="mt-1 text-sm text-white/60 max-w-2xl">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/settings/billing"
              className="px-3 py-2 text-xs rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
            >
              Billing / Plan
            </Link>
            <Link
              href="/support"
              className="px-3 py-2 text-xs rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
            >
              Support
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(SECTION_LABELS) as SettingsSection[]).map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => setActiveSection(section)}
              className={`px-3.5 py-2 rounded-lg text-sm transition-colors border ${
                activeSection === section
                  ? 'bg-white text-neutral-950 border-white'
                  : 'border-white/20 text-white/70 hover:text-white hover:border-white/35'
              }`}
            >
              {SECTION_LABELS[section]}
            </button>
          ))}
        </div>

        {notice && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              notice.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200'
                : 'bg-red-500/10 border-red-400/30 text-red-200'
            }`}
          >
            {notice.text}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl border border-white/15 bg-black/25 p-6 flex items-center gap-3">
            <span className="w-5 h-5 border-2 border-white/25 border-t-white rounded-full animate-spin" />
            <span className="text-sm text-white/70">Loading settings...</span>
          </div>
        ) : null}

        {!isLoading && activeSection === 'account' && (
          <div className="space-y-5">
            <form
              onSubmit={handleSaveAccount}
              className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-4"
            >
              <div>
                <h2 className="text-lg font-medium text-white">Account</h2>
                <p className="text-sm text-white/55 mt-1">Update your personal account data.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs text-white/60">Name</span>
                  <input
                    type="text"
                    value={accountForm.displayName}
                    onChange={(e) => setAccountForm((prev) => ({ ...prev, displayName: e.target.value }))}
                    maxLength={80}
                    className="mt-1 w-full px-3 py-2 rounded-xl bg-black/25 border border-white/20 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 transition-colors"
                    placeholder="Your full name"
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-white/60">Username</span>
                  <input
                    type="text"
                    value={accountForm.username}
                    onChange={(e) => setAccountForm((prev) => ({ ...prev, username: e.target.value }))}
                    maxLength={32}
                    className="mt-1 w-full px-3 py-2 rounded-xl bg-black/25 border border-white/20 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 transition-colors"
                    placeholder="username"
                  />
                  <span className="mt-1 block text-[11px] text-white/45">3-32 chars, letters, numbers, underscore.</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={busyAction === 'save-account'}
                className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium disabled:opacity-60 transition-colors"
              >
                {busyAction === 'save-account' ? 'Saving...' : 'Save account'}
              </button>
            </form>

            <form
              onSubmit={handleEmailUpdate}
              className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-4"
            >
              <div>
                <h3 className="text-base font-medium text-white">Email</h3>
                <p className="text-sm text-white/55 mt-1">Current email: {profile.email ?? 'No email set'}</p>
              </div>

              <label className="block">
                <span className="text-xs text-white/60">Change email</span>
                <input
                  type="email"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  className="mt-1 w-full md:max-w-md px-3 py-2 rounded-xl bg-black/25 border border-white/20 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 transition-colors"
                  placeholder="you@example.com"
                />
              </label>

              <button
                type="submit"
                disabled={busyAction === 'update-email'}
                className="px-4 py-2 rounded-xl border border-white/20 text-white/85 hover:text-white hover:border-white/35 text-sm transition-colors disabled:opacity-60"
              >
                {busyAction === 'update-email' ? 'Updating...' : 'Update email'}
              </button>
            </form>

            <form
              onSubmit={handlePasswordUpdate}
              className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-4"
            >
              <div>
                <h3 className="text-base font-medium text-white">Authentication & Password</h3>
                <p className="text-sm text-white/55 mt-1">Current authentication method: {authMethod}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs text-white/60">New password</span>
                  <input
                    type="password"
                    value={passwordDraft}
                    onChange={(e) => setPasswordDraft(e.target.value)}
                    minLength={8}
                    className="mt-1 w-full px-3 py-2 rounded-xl bg-black/25 border border-white/20 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 transition-colors"
                    placeholder="At least 8 characters"
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-white/60">Confirm new password</span>
                  <input
                    type="password"
                    value={confirmPasswordDraft}
                    onChange={(e) => setConfirmPasswordDraft(e.target.value)}
                    minLength={8}
                    className="mt-1 w-full px-3 py-2 rounded-xl bg-black/25 border border-white/20 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 transition-colors"
                    placeholder="Repeat new password"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={busyAction === 'update-password'}
                className="px-4 py-2 rounded-xl border border-white/20 text-white/85 hover:text-white hover:border-white/35 text-sm transition-colors disabled:opacity-60"
              >
                {busyAction === 'update-password' ? 'Updating...' : 'Change password'}
              </button>
            </form>

            <div className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-4">
              <div>
                <h3 className="text-base font-medium text-white">Connected Accounts</h3>
                <p className="text-sm text-white/55 mt-1">Link external providers to sign in faster.</p>
              </div>

              {providers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {providers.map((provider) => (
                    <span
                      key={provider}
                      className="px-2.5 py-1 rounded-full text-xs border border-white/20 text-white/75 bg-white/5"
                    >
                      {providerLabel(provider)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/55">No connected providers yet.</p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleConnectProvider('google')}
                  disabled={busyAction === 'connect-google' || hasGoogleLinked}
                  className="px-3 py-2 rounded-xl text-sm border border-white/20 text-white/85 hover:text-white hover:border-white/35 transition-colors disabled:opacity-50"
                >
                  {hasGoogleLinked
                    ? 'Google connected'
                    : busyAction === 'connect-google'
                      ? 'Redirecting...'
                      : 'Connect Google'}
                </button>
                <button
                  type="button"
                  onClick={() => handleConnectProvider('apple')}
                  disabled={busyAction === 'connect-apple' || hasAppleLinked}
                  className="px-3 py-2 rounded-xl text-sm border border-white/20 text-white/85 hover:text-white hover:border-white/35 transition-colors disabled:opacity-50"
                >
                  {hasAppleLinked
                    ? 'Apple connected'
                    : busyAction === 'connect-apple'
                      ? 'Redirecting...'
                      : 'Connect Apple'}
                </button>
              </div>
            </div>

            <form
              onSubmit={handleDeleteAccount}
              className="rounded-2xl border border-red-400/25 bg-red-500/5 p-5 space-y-4"
            >
              <div>
                <h3 className="text-base font-medium text-red-200">Delete your account</h3>
                <p className="text-sm text-red-100/75 mt-1">
                  This permanently removes your account and all related data.
                </p>
              </div>

              <label className="block">
                <span className="text-xs text-red-100/80">Type DELETE to confirm</span>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="mt-1 w-full md:max-w-xs px-3 py-2 rounded-xl bg-black/20 border border-red-300/35 text-sm text-white placeholder-red-100/40 focus:outline-none focus:border-red-300/70 transition-colors"
                  placeholder="DELETE"
                />
              </label>

              <button
                type="submit"
                disabled={busyAction === 'delete-account'}
                className="px-4 py-2 rounded-xl bg-red-500/80 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-60 transition-colors"
              >
                {busyAction === 'delete-account' ? 'Deleting...' : 'Delete account'}
              </button>
            </form>
          </div>
        )}

        {!isLoading && activeSection === 'profile' && (
          <form
            onSubmit={handleSaveProfile}
            className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-5"
          >
            <div>
              <h2 className="text-lg font-medium text-white">Profile Details</h2>
              <p className="text-sm text-white/55 mt-1">
                Customize what people can see in your profile.
              </p>
            </div>

            <div className="rounded-xl border border-white/15 overflow-hidden">
              <div
                className="h-28 bg-gradient-to-r from-indigo-500/35 via-fuchsia-500/25 to-emerald-400/20 bg-cover bg-center"
                style={
                  profileForm.bannerUrl.trim()
                    ? { backgroundImage: `url(${profileForm.bannerUrl.trim()})` }
                    : undefined
                }
              />
              <div className="px-4 py-3 flex items-center gap-3 bg-black/35">
                <div
                  className="w-14 h-14 rounded-full border border-white/25 bg-white/10 bg-cover bg-center"
                  style={
                    profileForm.avatarUrl.trim()
                      ? { backgroundImage: `url(${profileForm.avatarUrl.trim()})` }
                      : undefined
                  }
                />
                <div>
                  <p className="text-sm text-white font-medium">{accountForm.displayName || 'Your name'}</p>
                  <p className="text-xs text-white/55">{accountForm.username ? `@${accountForm.username}` : '@username'}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/15 bg-black/20 p-3 space-y-2">
                <p className="text-xs text-white/60">Profile photo</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    disabled={busyAction === 'upload-avatar'}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/20 text-white/85 hover:text-white hover:border-white/35 text-sm transition-colors disabled:opacity-60"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M8 12l4-4m0 0l4 4m-4-4v9" />
                    </svg>
                    {busyAction === 'upload-avatar' ? 'Uploading...' : 'Upload photo'}
                  </button>
                  {profileForm.avatarUrl ? (
                    <button
                      type="button"
                      onClick={() => setProfileForm((prev) => ({ ...prev, avatarUrl: '' }))}
                      className="px-2.5 py-2 rounded-lg border border-white/15 text-xs text-white/70 hover:text-white hover:border-white/30 transition-colors"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <p className="text-[11px] text-white/45">PNG, JPG, WEBP, GIF up to 5 MB.</p>
                <input
                  ref={avatarFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  className="hidden"
                />
              </div>

              <div className="rounded-xl border border-white/15 bg-black/20 p-3 space-y-2">
                <p className="text-xs text-white/60">Header / banner</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => bannerFileInputRef.current?.click()}
                    disabled={busyAction === 'upload-banner'}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/20 text-white/85 hover:text-white hover:border-white/35 text-sm transition-colors disabled:opacity-60"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M8 12l4-4m0 0l4 4m-4-4v9" />
                    </svg>
                    {busyAction === 'upload-banner' ? 'Uploading...' : 'Upload banner'}
                  </button>
                  {profileForm.bannerUrl ? (
                    <button
                      type="button"
                      onClick={() => setProfileForm((prev) => ({ ...prev, bannerUrl: '' }))}
                      className="px-2.5 py-2 rounded-lg border border-white/15 text-xs text-white/70 hover:text-white hover:border-white/30 transition-colors"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <p className="text-[11px] text-white/45">PNG, JPG, WEBP, GIF up to 5 MB.</p>
                <input
                  ref={bannerFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerFileChange}
                  className="hidden"
                />
              </div>
            </div>

            <label className="block">
              <span className="text-xs text-white/60">Short bio</span>
              <textarea
                value={profileForm.shortBio}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, shortBio: e.target.value }))}
                rows={4}
                maxLength={280}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-black/25 border border-white/20 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 transition-colors resize-none"
                placeholder="Tell others a bit about you..."
              />
              <span className="mt-1 block text-[11px] text-white/45">{profileForm.shortBio.length}/280</span>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs text-white/60">University</span>
                <input
                  type="text"
                  value={profileForm.university}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, university: e.target.value }))}
                  maxLength={120}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-black/25 border border-white/20 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 transition-colors"
                  placeholder="University name"
                />
              </label>

              <label className="block">
                <span className="text-xs text-white/60">Degree</span>
                <input
                  type="text"
                  value={profileForm.degree}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, degree: e.target.value }))}
                  maxLength={120}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-black/25 border border-white/20 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 transition-colors"
                  placeholder="Degree or program"
                />
              </label>
            </div>

            <div>
              <p className="text-xs text-white/60 mb-2">Public profile visibility</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setProfileForm((prev) => ({ ...prev, profileVisibility: 'public' }))}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                    profileForm.profileVisibility === 'public'
                      ? 'bg-white text-neutral-950 border-white'
                      : 'border-white/20 text-white/75 hover:text-white hover:border-white/35'
                  }`}
                >
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setProfileForm((prev) => ({ ...prev, profileVisibility: 'private' }))}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                    profileForm.profileVisibility === 'private'
                      ? 'bg-white text-neutral-950 border-white'
                      : 'border-white/20 text-white/75 hover:text-white hover:border-white/35'
                  }`}
                >
                  Private
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busyAction === 'save-profile'}
              className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium disabled:opacity-60 transition-colors"
            >
              {busyAction === 'save-profile' ? 'Saving...' : 'Save profile details'}
            </button>
          </form>
        )}

        {!isLoading && activeSection === 'academic' && (
          <form
            onSubmit={handleSaveAcademic}
            className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-5"
          >
            <div>
              <h2 className="text-lg font-medium text-white">Academic Details</h2>
              <p className="text-sm text-white/55 mt-1">
                Set your university and degree programme. My Studies will use this to show your curriculum.
              </p>
            </div>

            {/* University searchable select */}
            <div className="space-y-1.5">
              <label className="block">
                <span className="text-xs text-white/60">University</span>
                {universities.length === 0 ? (
                  <div className="mt-1 w-full px-3 py-2 rounded-xl bg-black/25 border border-white/20 text-sm text-white/40">
                    Loading universities...
                  </div>
                ) : (
                  <div className="mt-1 relative">
                    <input
                      type="text"
                      value={universitySearch || (universities.find((u) => u.id === academicForm.universityId)?.name ?? '')}
                      onChange={(e) => {
                        setUniversitySearch(e.target.value);
                        // If user clears the input, reset selection
                        if (!e.target.value) {
                          setAcademicForm((prev) => ({ ...prev, universityId: '', programId: '' }));
                        }
                      }}
                      onFocus={() => {
                        // Show search by clearing the display value so the placeholder shows
                        setUniversitySearch('');
                      }}
                      onBlur={() => {
                        // On blur, restore the selected university name (or keep search if nothing selected)
                        setTimeout(() => setUniversitySearch(''), 200);
                      }}
                      placeholder="Search university..."
                      className="w-full px-3 py-2 rounded-xl bg-black/25 border border-white/20 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 transition-colors"
                    />
                    {/* Dropdown list */}
                    {universitySearch.trim().length > 0 && (
                      <div className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-xl bg-neutral-900 border border-white/20 shadow-xl">
                        {universities
                          .filter((u) =>
                            u.name.toLowerCase().includes(universitySearch.toLowerCase())
                          )
                          .slice(0, 20)
                          .map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onMouseDown={() => {
                                setAcademicForm((prev) => ({ ...prev, universityId: u.id, programId: '' }));
                                setUniversitySearch('');
                              }}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/8
                                ${academicForm.universityId === u.id ? 'text-indigo-300 bg-indigo-500/10' : 'text-white/80'}`}
                            >
                              {u.name}
                              {u.country && (
                                <span className="ml-2 text-[11px] text-white/35">{u.country}</span>
                              )}
                            </button>
                          ))}
                        {universities.filter((u) =>
                          u.name.toLowerCase().includes(universitySearch.toLowerCase())
                        ).length === 0 && (
                          <p className="px-3 py-2 text-sm text-white/40">No universities found.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </label>
            </div>

            {/* Degree programme */}
            <label className="block">
              <span className="text-xs text-white/60">Degree programme</span>
              <select
                value={academicForm.programId}
                onChange={(e) => setAcademicForm((prev) => ({ ...prev, programId: e.target.value }))}
                disabled={!academicForm.universityId || programsLoading}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-black/25 border border-white/20 text-sm text-white focus:outline-none focus:border-indigo-400/60 transition-colors disabled:opacity-50"
              >
                <option value="" className="text-black">
                  {programsLoading ? 'Loading...' : academicForm.universityId ? 'Select a programme' : 'Select a university first'}
                </option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id} className="text-black">
                    {p.tipo ? `[${p.tipo}] ` : ''}{p.title}
                  </option>
                ))}
              </select>
            </label>

            {/* Year selector */}
            <div>
              <p className="text-xs text-white/60 mb-2">Current year</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4].map((yr) => {
                  // For Master programmes (tipo contains 'Máster' or 'Master'), only show 1–2
                  const selectedProg = programs.find((p) => p.id === academicForm.programId);
                  const isMaster = selectedProg?.tipo?.toLowerCase().includes('máster') ||
                    selectedProg?.tipo?.toLowerCase().includes('master');
                  if (isMaster && yr > 2) return null;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setAcademicForm((prev) => ({ ...prev, year: yr }))}
                      className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                        academicForm.year === yr
                          ? 'bg-white text-neutral-950 border-white'
                          : 'border-white/20 text-white/75 hover:text-white hover:border-white/35'
                      }`}
                    >
                      Year {yr}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={busyAction === 'save-academic'}
              className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium disabled:opacity-60 transition-colors"
            >
              {busyAction === 'save-academic' ? 'Saving...' : 'Save academic details'}
            </button>
          </form>
        )}

        {!isLoading && activeSection === 'preferences' && (
          <form
            onSubmit={handleSavePreferences}
            className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-5"
          >
            <div>
              <h2 className="text-lg font-medium text-white">App Preferences</h2>
              <p className="text-sm text-white/55 mt-1">Set your appearance and language defaults.</p>
            </div>

            <div>
              <p className="text-xs text-white/60 mb-2">Appearance</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPreferencesForm((prev) => ({ ...prev, theme: option.value }))}
                    className={`text-left rounded-xl border p-3 transition-colors ${
                      preferencesForm.theme === option.value
                        ? 'bg-white text-neutral-950 border-white'
                        : 'border-white/20 text-white/75 hover:text-white hover:border-white/35'
                    }`}
                  >
                    <p className="text-sm font-medium">{option.label}</p>
                    <p
                      className={`text-xs mt-1 ${
                        preferencesForm.theme === option.value ? 'text-neutral-700' : 'text-white/50'
                      }`}
                    >
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <label className="block md:max-w-sm">
              <span className="text-xs text-white/60">Language</span>
              <select
                value={preferencesForm.language}
                onChange={(e) =>
                  setPreferencesForm((prev) => ({
                    ...prev,
                    language: e.target.value as LanguagePreference,
                  }))
                }
                className="mt-1 w-full px-3 py-2 rounded-xl bg-black/25 border border-white/20 text-sm text-white focus:outline-none focus:border-indigo-400/60 transition-colors"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="text-black">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={busyAction === 'save-preferences'}
              className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium disabled:opacity-60 transition-colors"
            >
              {busyAction === 'save-preferences' ? 'Saving...' : 'Save preferences'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
