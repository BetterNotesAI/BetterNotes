'use client';

import { useState, useEffect, useCallback } from 'react';

interface ProblemPublishModalProps {
  sessionId: string;
  sessionTitle: string;
  isOpen: boolean;
  /** Current publish state — pre-fills the form if already published */
  initialData?: {
    is_published: boolean;
    university?: string | null;
    degree?: string | null;
    subject?: string | null;
    visibility?: string;
    keywords?: string[];
  };
  onClose: () => void;
  /** Called after a successful publish/unpublish so parent can update state */
  onSuccess: (published: boolean) => void;
}

export function ProblemPublishModal({
  sessionId,
  sessionTitle,
  isOpen,
  initialData,
  onClose,
  onSuccess,
}: ProblemPublishModalProps) {
  const [university, setUniversity] = useState(initialData?.university ?? '');
  const [degree, setDegree] = useState(initialData?.degree ?? '');
  const [subject, setSubject] = useState(initialData?.subject ?? '');
  const [visibility, setVisibility] = useState<'private' | 'public'>(
    (initialData?.visibility as 'private' | 'public') ?? 'private'
  );
  const [keywords, setKeywords] = useState<string[]>(initialData?.keywords ?? []);
  const [keywordInput, setKeywordInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggestingKeywords, setIsSuggestingKeywords] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync form when initialData changes (modal re-opens with fresh data)
  useEffect(() => {
    if (isOpen) {
      setUniversity(initialData?.university ?? '');
      setDegree(initialData?.degree ?? '');
      setSubject(initialData?.subject ?? '');
      setVisibility((initialData?.visibility as 'private' | 'public') ?? 'private');
      setKeywords(initialData?.keywords ?? []);
      setKeywordInput('');
      setError(null);
    }
  }, [isOpen, initialData]);

  const addKeyword = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setKeywords((prev) => {
      if (prev.includes(trimmed)) return prev;
      return [...prev, trimmed];
    });
    setKeywordInput('');
  }, []);

  const removeKeyword = useCallback((kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  }, []);

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword(keywordInput);
    } else if (e.key === 'Backspace' && !keywordInput && keywords.length > 0) {
      setKeywords((prev) => prev.slice(0, -1));
    }
  };

  const handleSuggestKeywords = async () => {
    setIsSuggestingKeywords(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/problem-solver/sessions/${sessionId}/suggest-keywords`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Keyword suggestion failed');
      }
      const data = await res.json() as { keywords?: unknown };
      if (Array.isArray(data.keywords)) {
        setKeywords((prev) => {
          const combined = [...prev];
          for (const kw of data.keywords as string[]) {
            if (!combined.includes(kw)) combined.push(kw);
          }
          return combined;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suggest keywords');
    } finally {
      setIsSuggestingKeywords(false);
    }
  };

  const handlePublish = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/problem-solver/sessions/${sessionId}/publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'publish',
            university,
            degree,
            subject,
            visibility,
            keywords,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Publish failed');
      }
      onSuccess(true);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnpublish = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/problem-solver/sessions/${sessionId}/publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unpublish' }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Unpublish failed');
      }
      onSuccess(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unpublish');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const isAlreadyPublished = initialData?.is_published ?? false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Publish problem session"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative w-full max-w-md bg-neutral-900 border border-white/15 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {isAlreadyPublished ? 'Update Publication' : 'Publish to My Studies'}
            </h2>
            <p className="text-xs text-white/45 mt-0.5 truncate max-w-[280px]">{sessionTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/70 transition-colors p-1 rounded-lg hover:bg-white/8"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form body */}
        <div className="px-5 py-4 space-y-4 flex-1">
          {/* University */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              University <span className="text-white/30">(optional)</span>
            </label>
            <input
              type="text"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="e.g. MIT, UCL, Universidad de Sevilla"
              className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white
                placeholder:text-white/25 outline-none focus:border-orange-400/60 focus:ring-1
                focus:ring-orange-400/30 transition-colors"
              maxLength={120}
            />
          </div>

          {/* Degree */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              Degree / Programme <span className="text-white/30">(optional)</span>
            </label>
            <input
              type="text"
              value={degree}
              onChange={(e) => setDegree(e.target.value)}
              placeholder="e.g. BSc Computer Science, MSc Mathematics"
              className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white
                placeholder:text-white/25 outline-none focus:border-orange-400/60 focus:ring-1
                focus:ring-orange-400/30 transition-colors"
              maxLength={120}
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              Subject / Module <span className="text-white/30">(optional)</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Linear Algebra, Thermodynamics"
              className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white
                placeholder:text-white/25 outline-none focus:border-orange-400/60 focus:ring-1
                focus:ring-orange-400/30 transition-colors"
              maxLength={120}
            />
          </div>

          {/* Keywords */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-white/60">
                Keywords <span className="text-white/30">(optional)</span>
              </label>
              <button
                onClick={handleSuggestKeywords}
                disabled={isSuggestingKeywords}
                className="flex items-center gap-1 text-[10px] text-orange-400 hover:text-orange-300 disabled:opacity-50 transition-colors"
              >
                {isSuggestingKeywords ? (
                  <>
                    <span className="animate-spin inline-block">⟳</span>
                    Suggesting…
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Suggest with AI
                  </>
                )}
              </button>
            </div>

            {/* Keyword chips + input */}
            <div className="min-h-[44px] bg-white/6 border border-white/12 rounded-lg px-3 py-2 flex flex-wrap gap-1.5 items-center
              focus-within:border-orange-400/60 focus-within:ring-1 focus-within:ring-orange-400/30 transition-colors cursor-text">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 bg-orange-500/20 border border-orange-400/30 text-orange-300 rounded-full px-2 py-0.5 text-xs"
                >
                  {kw}
                  <button
                    onClick={() => removeKeyword(kw)}
                    className="text-orange-400/60 hover:text-orange-300 transition-colors ml-0.5"
                    aria-label={`Remove keyword ${kw}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
                onBlur={() => addKeyword(keywordInput)}
                placeholder={keywords.length === 0 ? 'Type a keyword and press Enter' : ''}
                className="flex-1 min-w-[100px] bg-transparent text-sm text-white placeholder:text-white/25 outline-none"
              />
            </div>
            <p className="text-[10px] text-white/30 mt-1">
              Press Enter or comma to add a keyword
            </p>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">Visibility</label>
            <div className="flex gap-2">
              {(['private', 'public'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVisibility(v)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    visibility === v
                      ? v === 'public'
                        ? 'bg-orange-500/20 border-orange-400/40 text-orange-300'
                        : 'bg-white/10 border-white/25 text-white'
                      : 'bg-white/4 border-white/10 text-white/40 hover:text-white/60 hover:border-white/20'
                  }`}
                >
                  {v === 'private' ? 'Private (only me)' : 'Public (discoverable)'}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
              {error}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-white/10 flex items-center gap-2 shrink-0">
          {isAlreadyPublished && (
            <button
              onClick={handleUnpublish}
              disabled={isSaving}
              className="flex-1 py-2 rounded-lg text-xs font-medium border border-red-500/30 text-red-400
                hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              Unpublish
            </button>
          )}
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 py-2 rounded-lg text-xs font-medium border border-white/15 text-white/60
              hover:text-white hover:border-white/30 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={isSaving}
            className="flex-1 py-2 rounded-lg text-xs font-medium bg-orange-500 hover:bg-orange-400
              text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isSaving ? (
              <>
                <span className="animate-spin inline-block">⟳</span>
                Saving…
              </>
            ) : isAlreadyPublished ? (
              'Update'
            ) : (
              'Publish'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
