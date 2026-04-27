'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ContributionsHeatmap from './ContributionsHeatmap';
import { useTranslation } from '@/lib/i18n';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProfileData {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  short_bio: string | null;
  university: string | null;
  degree: string | null;
  profile_visibility: 'public' | 'private' | null;
}

interface ProfileDoc {
  id: string;
  title: string;
  template_id: string;
  published_at: string;
  subject: string | null;
  degree: string | null;
  university: string | null;
  keywords: string[];
  view_count: number;
  like_count: number;
  user_liked: boolean;
  is_own: boolean;
}

interface Stats {
  published_count: number;
  total_views: number;
  total_likes: number;
  forks_received: number;
}

const TEMPLATE_LABELS: Record<string, string> = {
  '2cols_portrait': '2-Col Cheat Sheet',
  landscape_3col_maths: 'Compact 3 Columns Landscape',
  cornell: 'Cornell Review Notes',
  problem_solving: 'Problem Set',
  zettelkasten: 'Zettelkasten',
  academic_paper: 'Academic Paper',
  lab_report: 'Lab Report',
  data_analysis: 'Data Analysis',
  study_form: 'Study Form',
  lecture_notes: 'Extended Lecture Notes',
  long_template: 'Long Document',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function HeartIcon({ filled, className }: { filled: boolean; className?: string }) {
  return filled ? (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
  ) : (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

// ── Document card ─────────────────────────────────────────────────────────────

function ProfileDocCard({
  doc,
  onLike,
  onOpen,
  onFork,
}: {
  doc: ProfileDoc;
  onLike: (id: string) => void;
  onOpen: (id: string) => void;
  onFork: (id: string) => Promise<void>;
}) {
  const [isLiking, setIsLiking] = useState(false);
  const [isForking, setIsForking] = useState(false);
  const templateLabel = TEMPLATE_LABELS[doc.template_id] ?? doc.template_id;

  return (
    <div
      role="button" tabIndex={0}
      onClick={() => onOpen(doc.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(doc.id); }}
      className="group cursor-pointer bg-white/4 hover:bg-white/7 border border-white/10 hover:border-white/20
        rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-2 flex-1">
          {doc.title}
        </h3>
        {doc.is_own && (
          <span className="shrink-0 text-[10px] font-medium text-indigo-300 bg-indigo-500/15 border border-indigo-400/25 rounded-full px-2 py-0.5">
            Yours
          </span>
        )}
      </div>

      {doc.subject && (
        <p className="text-xs text-white/50 flex items-center gap-1.5">
          <svg className="w-3 h-3 text-white/25 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="truncate">{doc.subject}</span>
        </p>
      )}

      {doc.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {doc.keywords.slice(0, 3).map((kw) => (
            <span key={kw} className="text-[10px] text-indigo-300/70 bg-indigo-500/10 border border-indigo-400/20 rounded-full px-2 py-0.5">{kw}</span>
          ))}
          {doc.keywords.length > 3 && <span className="text-[10px] text-white/30">+{doc.keywords.length - 3}</span>}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/6">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/30">{templateLabel}</span>
          <span className="text-[10px] text-white/30">{formatDate(doc.published_at)}</span>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={async () => { if (isLiking) return; setIsLiking(true); try { await onLike(doc.id); } finally { setIsLiking(false); } }}
            className={`flex items-center gap-1 text-[10px] transition-colors rounded px-1 py-0.5 disabled:opacity-50
              ${doc.user_liked ? 'text-pink-400 hover:text-pink-300' : 'text-white/30 hover:text-pink-400'}`}
          >
            <HeartIcon className="w-3.5 h-3.5" filled={doc.user_liked} />
            {doc.like_count}
          </button>
          {!doc.is_own && (
            <button
              onClick={async () => { if (isForking) return; setIsForking(true); try { await onFork(doc.id); } finally { setIsForking(false); } }}
              disabled={isForking}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg
                bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-400/20 transition-colors disabled:opacity-50"
            >
              {isForking
                ? <span className="w-3 h-3 border border-indigo-400/30 border-t-indigo-300 rounded-full animate-spin" />
                : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 3M21 7.5H7.5" />
                  </svg>
              }
              Fork
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PublicProfilePage() {
  const { t } = useTranslation();
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const userId = params?.userId ?? '';

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [documents, setDocuments] = useState<ProfileDoc[]>([]);
  const [isOwn, setIsOwn] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setIsLoading(true);
    fetch(`/api/profile/${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        if (data.private) { setIsPrivate(true); setProfile({ display_name: data.display_name } as ProfileData); return; }
        setProfile(data.profile);
        setStats(data.stats);
        setDocuments(data.documents ?? []);
        setIsOwn(data.is_own ?? false);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [userId]);

  const handleLike = useCallback(async (docId: string) => {
    setDocuments((prev) =>
      prev.map((d) => d.id === docId
        ? { ...d, user_liked: !d.user_liked, like_count: d.user_liked ? d.like_count - 1 : d.like_count + 1 }
        : d)
    );
    try {
      const res = await fetch(`/api/documents/${docId}/like`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setDocuments((prev) =>
        prev.map((d) => d.id === docId ? { ...d, user_liked: data.liked, like_count: data.like_count } : d)
      );
    } catch (err) {
      console.error('[Like failed]', err);
      setDocuments((prev) =>
        prev.map((d) => d.id === docId
          ? { ...d, user_liked: !d.user_liked, like_count: d.user_liked ? d.like_count - 1 : d.like_count + 1 }
          : d)
      );
    }
  }, []);

  const handleFork = useCallback(async (docId: string) => {
    const res = await fetch(`/api/documents/${docId}/fork`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? 'Fork failed');
    router.push(`/documents/${data.document_id}`);
  }, [router]);

  const handleOpen = useCallback((docId: string) => {
    router.push(`/documents/${docId}`);
  }, [router]);

  const displayName = profile?.display_name || profile?.username || 'Anonymous';
  const initial = displayName[0]?.toUpperCase() ?? '?';

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/15 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-center">
        <div className="space-y-2">
          <p className="text-white/50 text-sm">{error}</p>
          <button onClick={() => router.back()} className="text-xs text-indigo-400 hover:text-indigo-300 underline">Go back</button>
        </div>
      </div>
    );
  }

  // Private profile
  if (isPrivate) {
    return (
      <div className="h-full flex items-center justify-center text-center">
        <div className="space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-white/70">{t('profile.privateProfile')}</p>
          <button onClick={() => router.back()} className="text-xs text-indigo-400 hover:text-indigo-300 underline">{t('common.back')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-transparent text-white overflow-y-auto">

      {/* Banner */}
      {profile?.banner_url ? (
        <div
          className="h-32 md:h-44 shrink-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${profile.banner_url})` }}
        />
      ) : (
        <div className="h-24 md:h-32 shrink-0 bg-gradient-to-br from-indigo-900/40 via-fuchsia-900/20 to-transparent" />
      )}

      {/* Profile header */}
      <div className="px-6 pb-6 shrink-0">
        <div className="flex items-end justify-between gap-4 -mt-10 md:-mt-12">

          {/* Avatar */}
          <div
            className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40
              border-4 border-neutral-950 flex items-center justify-center shrink-0 bg-cover bg-center shadow-xl"
            style={profile?.avatar_url ? { backgroundImage: `url(${profile.avatar_url})` } : undefined}
          >
            {!profile?.avatar_url && (
              <span className="text-2xl font-bold text-white/80">{initial}</span>
            )}
          </div>

          {/* Edit button — only for own profile */}
          {isOwn && (
            <button
              onClick={() => router.push('/profile')}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/20
                text-white/60 hover:text-white hover:border-white/40 transition-colors mb-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
              {t('profile.editProfile')}
            </button>
          )}
        </div>

        {/* Name + meta */}
        <div className="mt-4 space-y-1.5">
          <h1 className="text-xl font-bold text-white">{displayName}</h1>
          {profile?.username && (
            <p className="text-sm text-white/40">@{profile.username}</p>
          )}
          {profile?.short_bio && (
            <p className="text-sm text-white/60 max-w-xl leading-relaxed">{profile.short_bio}</p>
          )}
          {(profile?.university || profile?.degree) && (
            <p className="text-xs text-white/40 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-indigo-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
              </svg>
              {[profile.university, profile.degree].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Stats row */}
        {stats && (
          <div className="flex items-center gap-6 mt-5 pt-5 border-t border-white/8">
            {[
              { label: t('profile.stats.published'), value: stats.published_count },
              { label: t('profile.stats.views'), value: formatNumber(stats.total_views) },
              { label: t('profile.stats.likes'), value: formatNumber(stats.total_likes) },
              { label: t('profile.stats.forks'), value: stats.forks_received },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-lg font-bold text-white">{value}</p>
                <p className="text-[10px] text-white/35 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contributions heatmap */}
      <ContributionsHeatmap userId={userId} />

      {/* Documents section */}
      <div className="flex-1 border-t border-white/8">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <h2 className="text-sm font-semibold text-white/70 mb-4">
            {t('profile.publicNotes')}
            {documents.length > 0 && <span className="text-white/30 font-normal ml-2">{documents.length}</span>}
          </h2>

          {documents.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-sm text-white/30">{t('profile.noPublicNotes')}</p>
              {isOwn && (
                <button
                  onClick={() => router.push('/documents')}
                  className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline"
                >
                  {t('profile.goPublish')}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <ProfileDocCard
                  key={doc.id}
                  doc={doc}
                  onLike={handleLike}
                  onOpen={handleOpen}
                  onFork={handleFork}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
