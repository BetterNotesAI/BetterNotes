'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { DocumentCreationBar, type CreateDocumentInput } from '@/app/_components/DocumentCreationBar';
import { getTemplateThumbnailSrc } from '@/lib/template-thumbnails';
import {
  CHEAT_SHEET_DEFAULT_TEMPLATE_ID,
  CHEAT_SHEET_FEATURED_TEMPLATE_IDS,
  CHEAT_SHEET_TEMPLATE_BY_ID,
  CHEAT_SHEET_TEMPLATE_OPTIONS,
  type CheatSheetTemplateId,
  isCheatSheetTemplateId,
} from './_components/cheatSheetTemplates';

type DocumentStatus = 'draft' | 'generating' | 'ready' | 'error';

interface DocumentListItem {
  id: string;
  title: string;
  template_id: string;
  status: DocumentStatus;
  created_at: string;
  updated_at: string;
}

const CHEAT_SHEET_TEMPLATE_ID_SET = new Set<string>(CHEAT_SHEET_TEMPLATE_OPTIONS.map((t) => t.id));
const TEMPLATE_STORAGE_KEY = 'lastCheatSheetTemplateId';

function buildCheatSheetTitle(prompt: string): string {
  const compact = prompt.replace(/\s+/g, ' ').trim();
  if (!compact) return 'Untitled Cheat Sheet';
  const clipped = compact.length > 72 ? `${compact.slice(0, 72).trimEnd()}...` : compact;
  return clipped;
}

export default function CheatSheetsPage() {
  const router = useRouter();
  const barRef = useRef<HTMLDivElement>(null);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(CHEAT_SHEET_DEFAULT_TEMPLATE_ID);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pdfPreviewId, setPdfPreviewId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(TEMPLATE_STORAGE_KEY) ?? localStorage.getItem('lastTemplateId');
    if (saved && isCheatSheetTemplateId(saved)) {
      setSelectedTemplateId(saved);
      return;
    }
    setSelectedTemplateId(CHEAT_SHEET_DEFAULT_TEMPLATE_ID);
  }, []);

  useEffect(() => {
    fetch('/api/documents?sort=date_desc')
      .then((res) => (res.ok ? res.json() : { documents: [] }))
      .then((data: { documents?: DocumentListItem[] }) => {
        const docs = (data.documents ?? []).filter((doc) => CHEAT_SHEET_TEMPLATE_ID_SET.has(doc.template_id));
        setDocuments(docs);
      })
      .catch(() => {})
      .finally(() => setIsLoadingDocs(false));
  }, []);

  function rememberTemplate(templateId: CheatSheetTemplateId) {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, templateId);
    localStorage.setItem('lastTemplateId', templateId);
  }

  function setTemplateFromUI(nextTemplateId: string) {
    setSelectedTemplateId(nextTemplateId);
    if (isCheatSheetTemplateId(nextTemplateId)) {
      rememberTemplate(nextTemplateId);
      return;
    }
    localStorage.removeItem(TEMPLATE_STORAGE_KEY);
  }

  function handleTemplateCardClick(templateId: CheatSheetTemplateId) {
    setSelectedTemplateId(templateId);
    rememberTemplate(templateId);
    barRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function handleCreate(data: CreateDocumentInput) {
    const resolvedTemplateId = isCheatSheetTemplateId(data.templateId)
      ? data.templateId
      : isCheatSheetTemplateId(selectedTemplateId)
      ? selectedTemplateId
      : null;

    if (!resolvedTemplateId) {
      setCreateError('Select a template to continue.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const title = buildCheatSheetTitle(data.prompt);
      const uploadedAttachments: {
        name: string;
        mimeType: string;
        sizeBytes: number;
        storagePath: string;
      }[] = [];

      for (const file of data.files) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch('/api/attachments/upload', { method: 'POST', body: formData });
        const uploadData = (await uploadRes.json().catch(() => ({}))) as {
          error?: string;
          name?: string;
          mimeType?: string;
          sizeBytes?: number;
          storagePath?: string;
        };
        if (!uploadRes.ok) {
          setCreateError(uploadData.error ?? 'Upload failed');
          return;
        }
        if (!uploadData.name || !uploadData.mimeType || !uploadData.storagePath || typeof uploadData.sizeBytes !== 'number') {
          setCreateError('Upload response is missing required metadata.');
          return;
        }
        uploadedAttachments.push({
          name: uploadData.name,
          mimeType: uploadData.mimeType,
          sizeBytes: uploadData.sizeBytes,
          storagePath: uploadData.storagePath,
        });
      }

      const resp = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: resolvedTemplateId,
          title,
          prompt: data.prompt,
          attachments: uploadedAttachments,
        }),
      });

      const respData = (await resp.json().catch(() => ({}))) as {
        error?: string;
        document?: { id?: string };
      };

      if (!resp.ok) {
        setCreateError(respData.error ?? 'Failed to create cheat sheet.');
        return;
      }

      const documentId = respData.document?.id;
      if (!documentId) {
        setCreateError('Document was created without a valid id.');
        return;
      }

      router.push(`/cheat-sheets/${documentId}?prompt=${encodeURIComponent(data.prompt)}`);
    } catch {
      setCreateError('Something went wrong. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }

  const recentDocs = documents.slice(0, 5);

  return (
    <>
      <div className="h-full flex flex-col bg-transparent text-white">
        {/* Header */}
        <div className="border-b border-white/10 px-6 h-14 flex items-center shrink-0">
          <h1 className="text-xl font-semibold">Cheat Sheets</h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-16">
            <h2 className="text-3xl font-semibold tracking-tight mb-2">
              What would you like to{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent">
                create?
              </span>
            </h2>
            <p className="text-white/50 text-sm mb-8">
              Choose a template, describe your content, and get a print-ready PDF in seconds.
            </p>

            <div ref={barRef}>
              <DocumentCreationBar
                onSubmit={handleCreate}
                isLoading={isCreating}
                error={createError}
                placeholder="Describe the document you want to create..."
                autoFocus
                selectedTemplateId={selectedTemplateId}
                onTemplateChange={setTemplateFromUI}
              />
            </div>

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
                {CHEAT_SHEET_FEATURED_TEMPLATE_IDS.map((id) => {
                  const t = CHEAT_SHEET_TEMPLATE_BY_ID[id];
                  const isActive = selectedTemplateId === id;
                  return (
                    <div
                      key={id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleTemplateCardClick(id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') handleTemplateCardClick(id);
                      }}
                      className={`group relative rounded-2xl border backdrop-blur p-3 text-left transition-all cursor-pointer
                        hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)] ${
                        isActive
                          ? 'bg-white/[0.14]'
                          : 'bg-white/[0.04] border-white/12 hover:bg-white/[0.08] hover:border-white/20'
                      }`}
                      style={isActive
                        ? {
                            borderColor: `${t.accent}d0`,
                            boxShadow: `0 0 0 1px ${t.accent}66, 0 0 26px ${t.accent}4d, 0 12px 30px rgba(0,0,0,0.35)`,
                          }
                        : undefined}
                    >
                      {isActive && (
                        <div
                          className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white border"
                          style={{ backgroundColor: `${t.accent}2e`, borderColor: `${t.accent}90` }}
                        >
                          <span
                            className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[9px] leading-none"
                            style={{ backgroundColor: `${t.accent}40`, borderColor: `${t.accent}90` }}
                          >
                            ✓
                          </span>
                          Selected
                        </div>
                      )}
                      <div
                        className={`relative aspect-[4/3] rounded-lg mb-2.5 overflow-hidden border transition-colors ${
                          isActive ? 'border-white/45' : 'border-white/8 group-hover:border-white/15'
                        }`}
                        style={{ background: `linear-gradient(135deg, ${t.accent}12, transparent)` }}
                      >
                        <div className="w-full h-full p-2 group-hover:scale-[1.02] transition-transform duration-300">
                          {renderSchematic(id)}
                        </div>
                        <Image
                          src={getTemplateThumbnailSrc(id)}
                          alt={t.cardName}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).classList.add('hidden');
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="text-xs font-semibold text-white/85 leading-snug">{t.cardName}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPdfPreviewId(id);
                          }}
                          title="Preview sample PDF"
                          className="shrink-0 text-white/30 hover:text-white/70 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      </div>
                      <p className={`text-[10px] transition-colors ${t.linkColor}`}>
                        {isActive ? '✓ Selected' : 'Select →'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

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
                      onClick={() => router.push(`/cheat-sheets/${doc.id}`)}
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
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
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

      {pdfPreviewId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setPdfPreviewId(null)}
        >
          <div
            className="relative w-full max-w-3xl h-[85vh] rounded-2xl overflow-hidden border border-white/15 bg-neutral-900 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
              <span className="text-sm font-medium text-white/80">
                {CHEAT_SHEET_TEMPLATE_BY_ID[pdfPreviewId as CheatSheetTemplateId]?.cardName ?? pdfPreviewId} — Sample PDF
              </span>
              <div className="flex items-center gap-3">
                <a
                  href={`/templates/samples/${pdfPreviewId}.pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  Open in new tab
                </a>
                <button
                  onClick={() => setPdfPreviewId(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <iframe
              src={`/templates/samples/${pdfPreviewId}.pdf`}
              className="flex-1 w-full"
              title="PDF preview"
            />
          </div>
        </div>
      )}
    </>
  );
}

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

function renderSchematic(id: string) {
  if (id === '2cols_portrait') return <TwoColSchematic />;
  if (id === 'landscape_3col_maths') return <ThreeColSchematic />;
  if (id === 'lecture_notes') return <LectureSchematic />;
  return <ThreeColSchematic />;
}
