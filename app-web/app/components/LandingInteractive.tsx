'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { DocumentCreationBar, CreateDocumentInput } from '@/app/_components/DocumentCreationBar';
import { createClient } from '@/lib/supabase/client';
import { getTemplateThumbnailSrc } from '@/lib/template-thumbnails';

const FEATURED = [
  {
    id: 'landscape_3col_maths',
    name: '3-Column Landscape',
    desc: 'A4 landscape with 3 dense columns — ideal for math reference sheets and formula summaries.',
    accent: '#8b5cf6',
    category: 'Notes',
    linkColor: 'text-violet-400 group-hover:text-violet-300',
    schematic: <ThreeColSchematic />,
  },
  {
    id: '2cols_portrait',
    name: '2-Column Cheat Sheet',
    desc: 'Compact A4 portrait layout with 2 columns for formulas, definitions and key results. Perfect for exam prep.',
    accent: '#6366f1',
    category: 'Notes',
    linkColor: 'text-indigo-400 group-hover:text-indigo-300',
    schematic: <TwoColSchematic />,
  },
  {
    id: 'lecture_notes',
    name: 'Lecture Notes',
    desc: 'Multi-page structured notes with learning objectives, sections, examples and a summary box.',
    accent: '#3b82f6',
    category: 'Notes',
    linkColor: 'text-blue-400 group-hover:text-blue-300',
    schematic: <LectureSchematic />,
  },
] as const;

export function LandingInteractive() {
  const router = useRouter();
  const barRef = useRef<HTMLDivElement>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('landscape_3col_maths');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function handleCardClick(templateId: string) {
    setSelectedTemplateId(templateId);
    barRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function handleSubmit(data: CreateDocumentInput) {
    setIsCreating(true);
    setCreateError(null);
    try {
      const supabase = createClient();

      // Ensure there is a session — create an anonymous one if needed
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const { error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) {
          setCreateError('Could not start a session. Please try again.');
          setIsCreating(false);
          return;
        }
      }

      const resp = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: data.templateId, attachments: [] }),
      });
      const docData = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setCreateError(docData?.error ?? 'Failed to create document');
        setIsCreating(false);
        return;
      }
      router.push(`/documents/${docData.document.id}?prompt=${encodeURIComponent(data.prompt)}`);
    } catch {
      setCreateError('Something went wrong. Please try again.');
      setIsCreating(false);
    }
  }

  return (
    <>
      {/* Creation bar (hero area) */}
      <div ref={barRef} className="mt-8 max-w-3xl mx-auto">
        <DocumentCreationBar
          mode="landing"
          onSubmit={handleSubmit}
          isLoading={isCreating}
          error={createError}
          placeholder="Describe the document you want to create..."
          submitLabel={isCreating ? 'Building...' : 'Get started'}
          autoFocus={false}
          selectedTemplateId={selectedTemplateId}
          onTemplateChange={setSelectedTemplateId}
        />
      </div>

      {/* Secondary CTA */}
      <p className="mt-4 text-xs text-white/40">
        Already have an account?{' '}
        <a href="/login" className="text-white/60 hover:text-white underline underline-offset-2 transition-colors">
          Log in
        </a>
      </p>

      {/* Popular templates */}
      <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-12">
        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-white">Popular templates</h2>
          <p className="text-sm text-white/65 mt-1">Click a template to select it, then describe your content above</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURED.map((t) => {
            const isActive = selectedTemplateId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleCardClick(t.id)}
                className={`group rounded-2xl border backdrop-blur p-4 text-left transition-all
                  hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)] ${
                  isActive
                    ? 'bg-white/[0.10] border-white/30 shadow-[0_4px_24px_rgba(0,0,0,0.25)]'
                    : 'bg-white/[0.05] border-white/15 hover:bg-white/[0.09] hover:border-white/25'
                }`}
              >
                {/* Schematic */}
                <div
                  className={`relative aspect-[4/3] rounded-xl mb-3 overflow-hidden border transition-colors ${
                    isActive ? 'border-white/20' : 'border-white/8 group-hover:border-white/15'
                  }`}
                  style={{ background: `linear-gradient(135deg, ${t.accent}12, transparent)` }}
                >
                  <div className="w-full h-full p-3 group-hover:scale-[1.02] transition-transform duration-300">
                    {t.schematic}
                  </div>
                  <Image
                    src={getTemplateThumbnailSrc(t.id)}
                    alt={t.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).classList.add('hidden'); }}
                  />
                </div>

                {/* Info */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-white/90">{t.name}</span>
                  {isActive && (
                    <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md
                      bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/45 leading-relaxed">{t.desc}</p>
                <p className={`mt-2.5 text-xs transition-colors ${t.linkColor}`}>
                  {isActive ? '✓ Selected — describe your content above' : 'Select template →'}
                </p>
              </button>
            );
          })}
        </div>

        <p className="text-center mt-6 text-xs text-white/40">
          Also available:{' '}
          <a href="/signup" className="text-white/60 hover:text-white underline underline-offset-2 transition-colors">
            3-Column Portrait
          </a>
          {' '}— ultra-compact A4 with formula boxes and constant tables.
        </p>
      </section>
    </>
  );
}

/* ── Schematic previews ── */

function SLn({ w, bold }: { w: number; bold?: boolean }) {
  return (
    <div
      className={`h-[2px] rounded-full mb-[3px] ${bold ? 'bg-white/35' : 'bg-white/15'}`}
      style={{ width: `${w}%` }}
    />
  );
}

function SBox({ children }: { children: React.ReactNode }) {
  return <div className="border border-white/20 rounded p-1 mb-1">{children}</div>;
}

function SImg() {
  return (
    <div className="rounded bg-white/10 border border-white/15 mb-[3px] flex items-center justify-center"
      style={{ width: '85%', height: '18px' }}>
      <svg className="w-3 h-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
      </svg>
    </div>
  );
}

function TwoColSchematic() {
  return (
    <div className="w-full h-full flex flex-col gap-1">
      <SLn w={55} bold />
      <div className="flex-1 flex gap-2">
        {[0, 1].map((col) => (
          <div key={col} className="flex-1 flex flex-col">
            <SLn w={70} bold />
            <SLn w={90} /><SLn w={75} /><SLn w={85} />
            <SBox><SLn w={80} bold /><SLn w={60} /></SBox>
            <SLn w={95} /><SLn w={70} />
            <SLn w={65} bold />
            <SLn w={88} /><SLn w={72} />
            <SBox><SLn w={75} bold /><SLn w={55} /><SLn w={65} /></SBox>
            <SLn w={90} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ThreeColSchematic() {
  return (
    <div className="w-full h-full flex flex-col gap-1">
      <SLn w={40} bold />
      <div className="flex-1 flex gap-1.5">
        {[0, 1, 2].map((col) => (
          <div key={col} className="flex-1 flex flex-col">
            <SLn w={80} bold />
            <SLn w={90} /><SLn w={70} /><SLn w={85} />
            <SBox><SLn w={75} bold /><SLn w={60} /></SBox>
            <SLn w={95} /><SLn w={65} /><SLn w={88} />
            <SLn w={72} bold />
            <SLn w={90} />
            <SBox><SLn w={85} /><SLn w={55} /></SBox>
            <SLn w={75} />
          </div>
        ))}
      </div>
    </div>
  );
}

function LectureSchematic() {
  return (
    <div className="w-full h-full flex flex-col gap-1">
      <SLn w={55} bold /><SLn w={35} />
      <SBox><SLn w={40} bold /><SLn w={82} /><SLn w={75} /></SBox>
      <SLn w={48} bold />
      <SLn w={90} /><SLn w={78} /><SLn w={85} />
      <SImg />
      <SLn w={65} />
      <SLn w={52} bold />
      <SLn w={92} /><SLn w={72} /><SLn w={80} />
      <div className="border-t border-white/20 pt-1 mt-0.5">
        <SLn w={30} bold /><SLn w={88} /><SLn w={70} />
      </div>
    </div>
  );
}
