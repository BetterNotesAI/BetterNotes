'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CourseDoc {
  id: string;
  title: string;
  template_id: string;
  published_at: string;
  university: string | null;
  degree: string | null;
  subject: string | null;
  keywords: string[];
  view_count: number;
  like_count: number;
  user_liked: boolean;
  is_own: boolean;
  author_id: string;
  author_name: string | null;
  author_avatar: string | null;
}

interface CourseInfo {
  id: string;
  name: string;
  year: number;
  semester: number | null;
  semester_label: string | null;
  ects: number | null;
  tipo: string | null;
  degree_programs: {
    id: string;
    title: string;
    tipo: string;
    slug: string;
    universities: {
      id: string;
      name: string;
      slug: string;
    };
  };
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

// ── Community document card ───────────────────────────────────────────────────

function AuthorChip({ doc, onClick }: { doc: CourseDoc; onClick: () => void }) {
  const initial = (doc.author_name ?? '?')[0].toUpperCase();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex items-center gap-1.5 group/author w-fit"
      title={`View profile of ${doc.author_name ?? 'author'}`}
    >
      <div
        className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40
          border border-white/15 flex items-center justify-center shrink-0 bg-cover bg-center"
        style={doc.author_avatar ? { backgroundImage: `url(${doc.author_avatar})` } : undefined}
      >
        {!doc.author_avatar && <span className="text-[9px] font-semibold text-white/70">{initial}</span>}
      </div>
      <span className="text-[11px] text-white/40 group-hover/author:text-white/70 transition-colors truncate max-w-[120px]">
        {doc.is_own ? 'You' : (doc.author_name ?? 'Anonymous')}
      </span>
    </button>
  );
}

function CommunityCard({
  doc,
  onLike,
  onForkAndOpen,
  onOpen,
  onAuthorClick,
}: {
  doc: CourseDoc;
  onLike: (id: string) => void;
  onForkAndOpen: (id: string) => Promise<void>;
  onOpen: (id: string) => void;
  onAuthorClick: (userId: string) => void;
}) {
  const [isForking, setIsForking] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const templateLabel = TEMPLATE_LABELS[doc.template_id] ?? doc.template_id;

  async function handleFork(e: React.MouseEvent) {
    e.stopPropagation();
    if (isForking) return;
    setIsForking(true);
    try { await onForkAndOpen(doc.id); } finally { setIsForking(false); }
  }

  async function handleLike(e: React.MouseEvent) {
    e.stopPropagation();
    if (isLiking) return;
    setIsLiking(true);
    try { await onLike(doc.id); } finally { setIsLiking(false); }
  }

  return (
    <div className="bg-white/4 border border-white/10 hover:border-white/20 rounded-2xl p-5
      flex flex-col gap-3 transition-all duration-200 group">

      {/* Title */}
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

      {/* Author */}
      <AuthorChip doc={doc} onClick={() => onAuthorClick(doc.author_id)} />

      {/* Keywords */}
      {doc.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {doc.keywords.slice(0, 4).map((kw) => (
            <span key={kw} className="text-[10px] text-indigo-300/70 bg-indigo-500/10 border border-indigo-400/20 rounded-full px-2 py-0.5">
              {kw}
            </span>
          ))}
          {doc.keywords.length > 4 && <span className="text-[10px] text-white/30">+{doc.keywords.length - 4}</span>}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/6">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/30">{templateLabel}</span>
          <span className="text-[10px] text-white/30">{formatDate(doc.published_at)}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Like */}
          <button
            onClick={handleLike}
            disabled={isLiking}
            className={`flex items-center gap-1 text-[10px] transition-colors rounded px-1 py-0.5 disabled:opacity-50
              ${doc.user_liked ? 'text-pink-400 hover:text-pink-300' : 'text-white/30 hover:text-pink-400'}`}
          >
            <HeartIcon className="w-3.5 h-3.5" filled={doc.user_liked} />
            {doc.like_count}
          </button>

          {/* Open / Fork & Open */}
          {doc.is_own ? (
            <button
              onClick={() => onOpen(doc.id)}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-white/70
                hover:text-white border border-white/10 hover:border-white/25 transition-colors"
            >
              Open
            </button>
          ) : (
            <button
              onClick={handleFork}
              disabled={isForking}
              className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg
                bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-400/25
                hover:border-indigo-400/40 transition-colors disabled:opacity-50"
            >
              {isForking ? (
                <span className="w-3 h-3 border border-indigo-400/40 border-t-indigo-300 rounded-full animate-spin" />
              ) : (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 3M21 7.5H7.5" />
                </svg>
              )}
              Fork & Open
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CourseExplorePage() {
  const params = useParams<{ uniSlug: string; programSlug: string; courseId: string }>();
  const router = useRouter();
  const courseId = params?.courseId ?? '';

  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [documents, setDocuments] = useState<CourseDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    setIsLoading(true);
    fetch(`/api/explore/courses/${courseId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCourse(data.course);
        setDocuments(data.documents ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [courseId]);

  const handleLike = useCallback(async (docId: string) => {
    setDocuments((prev) =>
      prev.map((d) => d.id === docId
        ? { ...d, user_liked: !d.user_liked, like_count: d.user_liked ? d.like_count - 1 : d.like_count + 1 }
        : d
      )
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
          : d
        )
      );
    }
  }, []);

  const handleForkAndOpen = useCallback(async (docId: string) => {
    const res = await fetch(`/api/documents/${docId}/fork`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? 'Fork failed');
    router.push(`/documents/${data.document_id}`);
  }, [router]);

  const handleOpen = useCallback((docId: string) => {
    router.push(`/documents/${docId}`);
  }, [router]);

  const handleAuthorClick = useCallback((authorId: string) => {
    router.push(`/profile/${authorId}`);
  }, [router]);

  // ── Breadcrumb labels ─────────────────────────────────────
  const uniName   = course?.degree_programs?.universities?.name ?? '';
  const progTitle = course?.degree_programs?.title ?? '';
  const semLabel  = course?.semester_label ?? (course?.semester ? `Semester ${course.semester}` : '');
  const yearLabel = course?.year ? `Year ${course.year}` : '';

  return (
    <div className="h-full flex flex-col bg-transparent text-white overflow-hidden">

      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 shrink-0">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-white/35 mb-3 flex-wrap">
          <button onClick={() => router.push('/my-studies')} className="hover:text-white/60 transition-colors">
            My Studies
          </button>
          {uniName && (
            <>
              <span>/</span>
              <span className="text-white/35">{uniName}</span>
            </>
          )}
          {progTitle && (
            <>
              <span>/</span>
              <span className="text-white/35 truncate max-w-[200px]">{progTitle}</span>
            </>
          )}
          {course?.name && (
            <>
              <span>/</span>
              <span className="text-white/60">{course.name}</span>
            </>
          )}
        </nav>

        {isLoading ? (
          <div className="h-7 w-64 bg-white/8 rounded animate-pulse" />
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-white">{course?.name ?? 'Course'}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {yearLabel && (
                  <span className="text-xs text-white/40">{yearLabel}</span>
                )}
                {semLabel && (
                  <>
                    <span className="text-white/20">·</span>
                    <span className="text-xs text-white/40">{semLabel}</span>
                  </>
                )}
                {course?.ects && (
                  <>
                    <span className="text-white/20">·</span>
                    <span className="text-xs text-white/40">{course.ects} ECTS</span>
                  </>
                )}
                {course?.tipo && (
                  <>
                    <span className="text-white/20">·</span>
                    <span className="text-xs text-indigo-400/70 bg-indigo-500/10 border border-indigo-400/20 rounded-full px-2 py-0.5">
                      {course.tipo}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-white">{documents.length}</p>
              <p className="text-xs text-white/35">note{documents.length !== 1 ? 's' : ''} published</p>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">

          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white/4 border border-white/8 rounded-2xl p-5 h-40" />
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="text-center py-20">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {!isLoading && !error && documents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center mb-5">
                <svg className="w-7 h-7 text-indigo-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-white/80 mb-1">No notes yet for this course</h2>
              <p className="text-sm text-white/35 mb-5 max-w-xs">
                Be the first to publish your notes for {course?.name ?? 'this course'}.
              </p>
              <button
                onClick={() => router.push('/documents')}
                className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
              >
                Go to my documents
              </button>
            </div>
          )}

          {!isLoading && !error && documents.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs text-white/35">
                  Sorted by most liked · only public notes shown
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map((doc) => (
                  <CommunityCard
                    key={doc.id}
                    doc={doc}
                    onLike={handleLike}
                    onForkAndOpen={handleForkAndOpen}
                    onOpen={handleOpen}
                    onAuthorClick={handleAuthorClick}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
