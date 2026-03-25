'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DocumentCreationBar, CreateDocumentInput } from '@/app/_components/DocumentCreationBar';
import { createClient } from '@/lib/supabase/client';

interface RecentDocument {
  id: string;
  title: string;
  template_id: string;
  created_at: string;
  status: string;
}

const FEATURED_TEMPLATES = [
  {
    id: '2cols_portrait',
    name: '2-Column Cheat Sheet',
    desc: 'Compact portrait layout with 2 columns for formulas, definitions and key results.',
    accent: '#6366f1',
    linkColor: 'text-indigo-400 group-hover:text-indigo-300',
  },
  {
    id: 'landscape_3col_maths',
    name: '3-Column Landscape',
    desc: 'A4 landscape with 3 dense columns — ideal for math reference sheets.',
    accent: '#8b5cf6',
    linkColor: 'text-violet-400 group-hover:text-violet-300',
  },
  {
    id: 'lecture_notes',
    name: 'Lecture Notes',
    desc: 'Multi-page structured notes with objectives, sections and a summary box.',
    accent: '#3b82f6',
    linkColor: 'text-blue-400 group-hover:text-blue-300',
  },
] as const;

export default function HomePage() {
  const router = useRouter();
  const barRef = useRef<HTMLDivElement>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    () => (typeof window !== 'undefined' ? localStorage.getItem('lastTemplateId') ?? '2cols_portrait' : '2cols_portrait')
  );
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [recentDocs, setRecentDocs] = useState<RecentDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  useEffect(() => {
    fetch('/api/documents?sort=date_desc')
      .then((r) => (r.ok ? r.json() : { documents: [] }))
      .then((data) => setRecentDocs((data.documents ?? []).slice(0, 5)))
      .catch(() => {})
      .finally(() => setIsLoadingDocs(false));
  }, []);

  function handleTemplateCardClick(templateId: string) {
    setSelectedTemplateId(templateId);
    localStorage.setItem('lastTemplateId', templateId);
    barRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function handleCreate(data: CreateDocumentInput) {
    setIsCreating(true);
    setCreateError(null);
    try {
      // Ensure there is a session — create an anonymous one if the user
      // landed on /home without being authenticated (guest entry point).
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const { error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) {
          setCreateError('Could not start a session. Please try again.');
          setIsCreating(false);
          return;
        }
      }

      const uploadedAttachments: {
        name: string; mimeType: string; sizeBytes: number; storagePath: string;
      }[] = [];

      for (const file of data.files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/attachments/upload', { method: 'POST', body: formData });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) { setCreateError(d?.error ?? 'Upload failed'); setIsCreating(false); return; }
        uploadedAttachments.push({ name: d.name, mimeType: d.mimeType, sizeBytes: d.sizeBytes, storagePath: d.storagePath });
      }

      const resp = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: data.templateId, attachments: uploadedAttachments }),
      });
      const docData = await resp.json().catch(() => ({}));
      if (!resp.ok) { setCreateError(docData?.error ?? 'Failed to create document'); return; }
      router.push(`/documents/${docData.document.id}?prompt=${encodeURIComponent(data.prompt)}`);
    } catch {
      setCreateError('Something went wrong. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="h-full flex flex-col bg-transparent text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold">Home</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-16">
          {/* Welcome heading */}
          <h2 className="text-3xl font-semibold tracking-tight mb-2">
            What would you like to{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent">
              create?
            </span>
          </h2>
          <p className="text-white/50 text-sm mb-8">
            Choose a template, describe your content, and get a print-ready PDF in seconds.
          </p>

          {/* Creation bar */}
          <div ref={barRef}>
            <DocumentCreationBar
              onSubmit={handleCreate}
              isLoading={isCreating}
              error={createError}
              placeholder="Describe the document you want to create..."
              autoFocus
              selectedTemplateId={selectedTemplateId}
              onTemplateChange={setSelectedTemplateId}
            />
          </div>

          {/* Popular templates */}
          <div className="mt-12">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-white/60">Popular templates</h3>
              <button
                onClick={() => router.push('/templates')}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                View all
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {FEATURED_TEMPLATES.map((t) => {
                const isActive = selectedTemplateId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleTemplateCardClick(t.id)}
                    className={`group rounded-2xl border backdrop-blur p-3 text-left transition-all
                      hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)] ${
                      isActive
                        ? 'bg-white/[0.10] border-white/30'
                        : 'bg-white/[0.04] border-white/12 hover:bg-white/[0.08] hover:border-white/20'
                    }`}
                  >
                    {/* Schematic */}
                    <div
                      className={`aspect-[4/3] rounded-lg mb-2.5 overflow-hidden border transition-colors ${
                        isActive ? 'border-white/20' : 'border-white/8 group-hover:border-white/15'
                      }`}
                      style={{ background: `linear-gradient(135deg, ${t.accent}12, transparent)` }}
                    >
                      <div className="w-full h-full p-2 group-hover:scale-[1.02] transition-transform duration-300">
                        {t.id === '2cols_portrait' && <TwoColSchematic />}
                        {t.id === 'landscape_3col_maths' && <ThreeColSchematic />}
                        {t.id === 'lecture_notes' && <LectureSchematic />}
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-white/85 leading-snug mb-1">{t.name}</p>
                    <p className={`text-[10px] transition-colors ${t.linkColor}`}>
                      {isActive ? '✓ Selected' : 'Select →'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent documents */}
          {!isLoadingDocs && recentDocs.length > 0 && (
            <div className="mt-12">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white/60">Recent documents</h3>
                <button
                  onClick={() => router.push('/documents')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  View all
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {recentDocs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => router.push(`/documents/${doc.id}`)}
                    className="flex items-center gap-3 w-full text-left rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] px-4 py-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/90 truncate group-hover:text-white transition-colors">
                        {doc.title}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {new Date(doc.created_at).toLocaleDateString(undefined, {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Schematic previews ── */

function SLn({ w, bold }: { w: number; bold?: boolean }) {
  return (
    <div className={`h-[2px] rounded-full mb-[3px] ${bold ? 'bg-white/35' : 'bg-white/15'}`}
      style={{ width: `${w}%` }} />
  );
}
function SBox({ children }: { children: React.ReactNode }) {
  return <div className="border border-white/20 rounded p-1 mb-1">{children}</div>;
}
function SImg() {
  return (
    <div className="rounded bg-white/10 border border-white/15 mb-[3px] flex items-center justify-center"
      style={{ width: '85%', height: '14px' }}>
      <svg className="w-2.5 h-2.5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
      </svg>
    </div>
  );
}

function TwoColSchematic() {
  return (
    <div className="w-full h-full flex flex-col gap-0.5">
      <SLn w={55} bold />
      <div className="flex-1 flex gap-1.5">
        {[0, 1].map((col) => (
          <div key={col} className="flex-1 flex flex-col">
            <SLn w={70} bold /><SLn w={90} /><SLn w={75} /><SLn w={85} />
            <SBox><SLn w={80} bold /><SLn w={60} /></SBox>
            <SLn w={95} /><SLn w={70} />
            <SLn w={65} bold /><SLn w={88} /><SLn w={72} />
            <SBox><SLn w={75} bold /><SLn w={55} /></SBox>
            <SLn w={90} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ThreeColSchematic() {
  return (
    <div className="w-full h-full flex flex-col gap-0.5">
      <SLn w={40} bold />
      <div className="flex-1 flex gap-1">
        {[0, 1, 2].map((col) => (
          <div key={col} className="flex-1 flex flex-col">
            <SLn w={80} bold /><SLn w={90} /><SLn w={70} /><SLn w={85} />
            <SBox><SLn w={75} bold /><SLn w={60} /></SBox>
            <SLn w={95} /><SLn w={65} /><SLn w={88} />
            <SLn w={72} bold /><SLn w={90} />
            <SBox><SLn w={85} /><SLn w={55} /></SBox>
          </div>
        ))}
      </div>
    </div>
  );
}

function LectureSchematic() {
  return (
    <div className="w-full h-full flex flex-col gap-0.5">
      <SLn w={55} bold /><SLn w={35} />
      <SBox><SLn w={40} bold /><SLn w={82} /><SLn w={75} /></SBox>
      <SLn w={48} bold /><SLn w={90} /><SLn w={78} /><SLn w={85} />
      <SImg />
      <SLn w={65} />
      <SLn w={52} bold /><SLn w={92} /><SLn w={72} /><SLn w={80} />
      <div className="border-t border-white/20 pt-0.5 mt-0.5">
        <SLn w={30} bold /><SLn w={88} /><SLn w={70} />
      </div>
    </div>
  );
}
