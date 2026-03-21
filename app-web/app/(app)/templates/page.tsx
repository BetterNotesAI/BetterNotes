'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DocumentCreationBar, CreateDocumentInput } from '@/app/_components/DocumentCreationBar';

interface Template {
  id: string;
  displayName: string;
  description: string;
  isPro: boolean;
  category: string;
  accent: string;
  schematic: React.ReactNode;
}

const TEMPLATES: Template[] = [
  {
    id: '2cols_portrait',
    displayName: '2-Column Cheat Sheet',
    description: 'Compact portrait sheet with 2 columns for formulas, definitions, and key results.',
    isPro: false,
    category: 'Notes',
    accent: '#6366f1',
    schematic: <TwoColSchematic />,
  },
  {
    id: 'landscape_3col_maths',
    displayName: '3-Column Landscape',
    description: 'A4 landscape with 3 columns — dense math reference sheets and formula summaries.',
    isPro: false,
    category: 'Notes',
    accent: '#8b5cf6',
    schematic: <ThreeColSchematic />,
  },
  {
    id: 'cornell',
    displayName: 'Cornell Notes',
    description: 'Classic Cornell format with cue keywords in the left margin and a summary box.',
    isPro: false,
    category: 'Notes',
    accent: '#14b8a6',
    schematic: <CornellSchematic />,
  },
  {
    id: 'problem_solving',
    displayName: 'Problem Solving',
    description: 'Structured problem/given/solution blocks with boxed answers for STEM practice.',
    isPro: false,
    category: 'Practice',
    accent: '#f97316',
    schematic: <ProblemSchematic />,
  },
  {
    id: 'zettelkasten',
    displayName: 'Zettelkasten Cards',
    description: 'Knowledge cards with cross-references and tags in Zettelkasten style.',
    isPro: false,
    category: 'Notes',
    accent: '#ec4899',
    schematic: <ZettelSchematic />,
  },
  {
    id: 'study_form',
    displayName: 'Study Form',
    description: '3-column ultra-compact A4 with formula boxes, constant tables, and property lists.',
    isPro: false,
    category: 'Notes',
    accent: '#22c55e',
    schematic: <ThreeColSchematic dense />,
  },
  {
    id: 'lecture_notes',
    displayName: 'Lecture Notes',
    description: 'Multi-page structured notes with objectives, examples, and a summary box.',
    isPro: false,
    category: 'Notes',
    accent: '#3b82f6',
    schematic: <LectureSchematic />,
  },
  {
    id: 'academic_paper',
    displayName: 'Academic Paper',
    description: 'Two-column AMS/Physical Review style paper with abstract, theorems, and bibliography.',
    isPro: true,
    category: 'Academic',
    accent: '#eab308',
    schematic: <TwoColSchematic header />,
  },
  {
    id: 'lab_report',
    displayName: 'Lab Report',
    description: 'Technical report with experimental setup, data tables with uncertainties, and error analysis.',
    isPro: true,
    category: 'Academic',
    accent: '#f43f5e',
    schematic: <LabSchematic />,
  },
  {
    id: 'data_analysis',
    displayName: 'Data Analysis',
    description: 'Statistics or ML report with Python code listings, results tables, and math.',
    isPro: true,
    category: 'Academic',
    accent: '#06b6d4',
    schematic: <DataSchematic />,
  },
];

export default function TemplatesPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Template | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(data: CreateDocumentInput) {
    setIsCreating(true);
    setCreateError(null);
    try {
      const uploadedAttachments: { name: string; mimeType: string; sizeBytes: number; storagePath: string }[] = [];
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
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold">Templates</h1>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <p className="text-sm text-white/50 mb-6">
            Choose a starting point for your document. All templates are AI-filled based on your description.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => { setSelected(template); setCreateError(null); }}
                className="group relative rounded-2xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08]
                  backdrop-blur p-4 text-left transition-all duration-200
                  hover:border-white/25 hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
              >
                {/* Schematic preview */}
                <div
                  className="aspect-[4/3] rounded-xl mb-3 overflow-hidden flex items-center justify-center
                    border border-white/8 bg-black/20 group-hover:border-white/15 transition-colors"
                  style={{ background: `linear-gradient(135deg, ${template.accent}12, transparent)` }}
                >
                  <div className="w-full h-full p-3 scale-100 group-hover:scale-[1.03] transition-transform duration-300">
                    {template.schematic}
                  </div>
                </div>

                {/* Info */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-white/90 leading-snug">{template.displayName}</span>
                  {template.isPro && (
                    <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md
                      bg-yellow-400/15 border border-yellow-400/30 text-yellow-300/90">
                      Pro
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/45 leading-relaxed line-clamp-2">{template.description}</p>

                {/* Category pill */}
                <div className="mt-2.5">
                  <span
                    className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: `${template.accent}22`, color: template.accent }}
                  >
                    {template.category}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preview modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-neutral-950/95 backdrop-blur-xl
            shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center border"
                  style={{ background: `${selected.accent}20`, borderColor: `${selected.accent}40` }}
                >
                  <svg className="w-4 h-4" style={{ color: selected.accent }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-white">{selected.displayName}</h2>
                    {selected.isPro && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md
                        bg-yellow-400/15 border border-yellow-400/30 text-yellow-300/90">Pro</span>
                    )}
                  </div>
                  <p className="text-xs text-white/50">{selected.category}</p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40
                  hover:text-white/80 hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Preview thumbnail */}
            <div className="px-5 pt-4 pb-0">
              <div
                className="aspect-[16/5] rounded-xl overflow-hidden border border-white/10 flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${selected.accent}18, ${selected.accent}06)` }}
              >
                <div className="w-full h-full p-4 flex items-center justify-center">
                  <div className="w-full h-full scale-100">
                    {selected.schematic}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-white/55 leading-relaxed">{selected.description}</p>
            </div>

            {/* Creation bar */}
            <div className="px-5 py-4">
              <p className="text-xs text-white/40 mb-2 font-medium">Describe your content and hit Build now</p>
              <DocumentCreationBar
                onSubmit={handleCreate}
                isLoading={isCreating}
                error={createError}
                initialTemplateId={selected.id}
                placeholder={`Describe your ${selected.displayName.toLowerCase()}...`}
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Schematic previews ─────────────────────────────────── */

function Line({ w = 'full', opacity = 40 }: { w?: string; opacity?: number }) {
  return <div className={`h-1 rounded-full bg-white/[${opacity / 100}] w-${w} mb-1`} />;
}

function TwoColSchematic({ header = false }: { header?: boolean }) {
  return (
    <div className="w-full h-full flex flex-col gap-1">
      {header && <div className="h-1.5 rounded bg-white/20 w-3/4 mb-1 mx-auto" />}
      <div className="flex-1 flex gap-1.5">
        {[0, 1].map(col => (
          <div key={col} className="flex-1 flex flex-col gap-0.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`h-0.5 rounded-full bg-white/${i % 3 === 0 ? '25' : '12'}`}
                style={{ width: `${60 + Math.sin(i + col) * 30}%` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ThreeColSchematic({ dense = false }: { dense?: boolean }) {
  return (
    <div className="w-full h-full flex gap-1">
      {[0, 1, 2].map(col => (
        <div key={col} className="flex-1 flex flex-col gap-0.5">
          {Array.from({ length: dense ? 12 : 8 }).map((_, i) => (
            <div key={i} className={`h-0.5 rounded-full bg-white/${i % 3 === 0 ? '25' : '10'}`}
              style={{ width: `${55 + Math.sin(i + col * 2) * 35}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function CornellSchematic() {
  return (
    <div className="w-full h-full flex flex-col gap-1">
      <div className="flex-1 flex gap-1.5">
        <div className="w-1/3 flex flex-col gap-0.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-0.5 rounded-full bg-white/20"
              style={{ width: `${50 + Math.sin(i) * 40}%` }} />
          ))}
        </div>
        <div className="w-px bg-white/15" />
        <div className="flex-1 flex flex-col gap-0.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-0.5 rounded-full bg-white/12"
              style={{ width: `${65 + Math.sin(i + 1) * 25}%` }} />
          ))}
        </div>
      </div>
      <div className="h-px bg-white/15" />
      <div className="h-3 flex flex-col gap-0.5 justify-center">
        {[0, 1].map(i => (
          <div key={i} className="h-0.5 rounded-full bg-white/15"
            style={{ width: `${40 + i * 20}%` }} />
        ))}
      </div>
    </div>
  );
}

function ProblemSchematic() {
  return (
    <div className="w-full h-full flex flex-col gap-1.5">
      {[0, 1, 2].map(block => (
        <div key={block} className="flex-1 border border-white/15 rounded p-1 flex flex-col gap-0.5">
          <div className="h-0.5 rounded-full bg-white/30 w-1/3" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-0.5 rounded-full bg-white/12"
              style={{ width: `${55 + i * 20}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ZettelSchematic() {
  return (
    <div className="w-full h-full grid grid-cols-2 gap-1">
      {[0, 1, 2, 3].map(card => (
        <div key={card} className="border border-white/15 rounded p-1 flex flex-col gap-0.5">
          <div className="h-0.5 rounded-full bg-white/30 w-2/3" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-0.5 rounded-full bg-white/12"
              style={{ width: `${50 + Math.sin(i + card) * 35}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function LectureSchematic() {
  return (
    <div className="w-full h-full flex flex-col gap-1">
      <div className="h-1.5 rounded bg-white/25 w-1/2" />
      <div className="flex-1 flex flex-col gap-0.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className={`h-0.5 rounded-full ${i === 2 || i === 5 ? 'bg-white/25 w-2/5' : 'bg-white/12'}`}
            style={{ width: i === 2 || i === 5 ? '40%' : `${60 + Math.sin(i) * 30}%` }} />
        ))}
      </div>
      <div className="border-t border-white/15 pt-1">
        <div className="h-0.5 rounded-full bg-white/15 w-4/5" />
      </div>
    </div>
  );
}

function LabSchematic() {
  return (
    <div className="w-full h-full flex flex-col gap-1">
      <div className="h-0.5 rounded-full bg-white/25 w-1/2 mx-auto" />
      <div className="flex-1 flex flex-col gap-0.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-0.5 rounded-full bg-white/12"
            style={{ width: `${70 + Math.sin(i) * 20}%` }} />
        ))}
      </div>
      <div className="border border-white/15 rounded p-0.5 flex gap-0.5">
        {[0, 1, 2].map(col => (
          <div key={col} className="flex-1 flex flex-col gap-0.5">
            {[0, 1, 2].map(row => (
              <div key={row} className="h-0.5 rounded-full bg-white/15" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DataSchematic() {
  return (
    <div className="w-full h-full flex flex-col gap-1">
      <div className="flex-1 border border-white/10 rounded bg-white/5 p-1 font-mono">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-0.5 rounded-full bg-white/20 mb-0.5"
            style={{ width: `${40 + i * 12}%` }} />
        ))}
      </div>
      <div className="flex gap-1 h-4">
        {[3, 5, 4, 6, 3, 5, 4].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-white/20 self-end" style={{ height: `${h * 14}%` }} />
        ))}
      </div>
    </div>
  );
}
