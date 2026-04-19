'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { DocumentCreationBar, type CreateDocumentInput } from '@/app/_components/DocumentCreationBar';
import { getTemplateThumbnailSrc } from '@/lib/template-thumbnails';
import { useProjectName } from '@/lib/use-project-name';
import {
  CHEAT_SHEET_DEFAULT_TEMPLATE_ID,
  CHEAT_SHEET_FEATURED_TEMPLATE_IDS,
  CHEAT_SHEET_TEMPLATE_BY_ID,
  type CheatSheetTemplateId,
  isCheatSheetTemplateId,
} from '../_components/cheatSheetTemplates';

const TEMPLATE_STORAGE_KEY = 'lastCheatSheetTemplateId';

function buildCheatSheetTitle(prompt: string): string {
  const compact = prompt.replace(/\s+/g, ' ').trim();
  if (!compact) return 'Untitled Cheat Sheet';
  const clipped = compact.length > 72 ? `${compact.slice(0, 72).trimEnd()}...` : compact;
  return clipped;
}

export default function NewCheatSheetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams?.get('projectId')?.trim() || null;
  const projectName = useProjectName(projectId);
  const barRef = useRef<HTMLDivElement>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(CHEAT_SHEET_DEFAULT_TEMPLATE_ID);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pdfPreviewId, setPdfPreviewId] = useState<CheatSheetTemplateId | null>(null);
  const backHref = projectId ? `/projects/${encodeURIComponent(projectId)}` : '/cheat-sheets';
  const templatesBackHref = projectId
    ? `/cheat-sheets/new?projectId=${encodeURIComponent(projectId)}`
    : '/cheat-sheets/new';
  const templatesHref = projectId
    ? `/templates?from=cheatsheets&projectId=${encodeURIComponent(projectId)}&back=${encodeURIComponent(templatesBackHref)}`
    : `/templates?from=cheatsheets&back=${encodeURIComponent(templatesBackHref)}`;

  useEffect(() => {
    const saved = localStorage.getItem(TEMPLATE_STORAGE_KEY) ?? localStorage.getItem('lastTemplateId');
    if (saved && isCheatSheetTemplateId(saved)) {
      setSelectedTemplateId(saved);
      return;
    }
    setSelectedTemplateId(CHEAT_SHEET_DEFAULT_TEMPLATE_ID);
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
          folder_id: projectId,
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

      const query = new URLSearchParams({ prompt: data.prompt });
      if (projectId) query.set('projectId', projectId);
      router.push(`/cheat-sheets/${documentId}?${query.toString()}`);
    } catch {
      setCreateError('Something went wrong. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <div className="h-full flex flex-col bg-transparent text-white">
        {/* Header */}
        <div className="border-b border-white/10 px-6 h-14 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => router.push(backHref)}
              className="shrink-0 p-1.5 rounded-lg hover:bg-white/8 text-white/45 hover:text-white transition-colors"
              title={projectId ? 'Back to project' : 'Back to Cheat Sheets'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold truncate flex items-center gap-2 min-w-0">
              {projectName && (
                <>
                  <button
                    onClick={() => router.push(`/projects/${encodeURIComponent(projectId!)}`)}
                    className="text-white/55 hover:text-white transition-colors truncate max-w-[40ch]"
                    title={`Go to project "${projectName}"`}
                  >
                    {projectName}
                  </button>
                  <span className="text-white/25 shrink-0">/</span>
                </>
              )}
              <span className="truncate">New Cheat Sheet</span>
            </h1>
          </div>
          <button
            onClick={() => router.push(backHref)}
            className="text-xs text-white/45 hover:text-white/75 transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-14">
            <h2 className="text-3xl font-semibold tracking-tight mb-2">
              Build a new{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent">
                cheat sheet
              </span>
            </h2>
            <p className="text-white/50 text-sm mb-8">
              Describe what you need, pick a template, and generate the first draft instantly.
            </p>

            <div ref={barRef}>
              <DocumentCreationBar
                onSubmit={handleCreate}
                isLoading={isCreating}
                error={createError}
                placeholder="Describe the cheat sheet you want to create..."
                autoFocus
                selectedTemplateId={selectedTemplateId}
                onTemplateChange={setTemplateFromUI}
              />
            </div>

            <div className="mt-12">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white/60">Popular templates</h3>
                <button
                  onClick={() => router.push(templatesHref)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  View all
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {CHEAT_SHEET_FEATURED_TEMPLATE_IDS.map((templateId) => {
                  const template = CHEAT_SHEET_TEMPLATE_BY_ID[templateId];
                  const isActive = selectedTemplateId === template.id;
                  return (
                    <div
                      key={template.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleTemplateCardClick(template.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') handleTemplateCardClick(template.id);
                      }}
                      className={`group rounded-2xl border backdrop-blur p-3 text-left transition-all cursor-pointer
                        hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)] ${
                        isActive
                          ? 'bg-white/[0.10] border-white/30'
                          : 'bg-white/[0.04] border-white/12 hover:bg-white/[0.08] hover:border-white/20'
                      }`}
                    >
                      <div
                        className={`relative aspect-[4/3] rounded-lg mb-2.5 overflow-hidden border transition-colors ${
                          isActive ? 'border-white/20' : 'border-white/8 group-hover:border-white/15'
                        }`}
                        style={{ background: `linear-gradient(135deg, ${template.accent}12, transparent)` }}
                      >
                        <div className="w-full h-full p-2 group-hover:scale-[1.02] transition-transform duration-300">
                          {renderSchematic(template.id)}
                        </div>
                        <Image
                          src={getTemplateThumbnailSrc(template.id)}
                          alt={template.cardName}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).classList.add('hidden');
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="text-xs font-semibold text-white/85 leading-snug">{template.cardName}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPdfPreviewId(template.id);
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
                      <p className={`text-[10px] transition-colors ${template.linkColor}`}>
                        {isActive ? 'Selected' : 'Select ->'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
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
                {CHEAT_SHEET_TEMPLATE_BY_ID[pdfPreviewId].cardName} - Sample PDF
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

function Line({ w, bold }: { w: number; bold?: boolean }) {
  return (
    <div className={`h-[2px] rounded-full mb-[3px] ${bold ? 'bg-white/35' : 'bg-white/15'}`} style={{ width: `${w}%` }} />
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return <div className="border border-white/20 rounded p-1 mb-1">{children}</div>;
}

function ImagePlaceholder() {
  return (
    <div
      className="rounded bg-white/10 border border-white/15 mb-[3px] flex items-center justify-center"
      style={{ width: '85%', height: '14px' }}
    >
      <svg className="w-2.5 h-2.5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
      </svg>
    </div>
  );
}

function TwoColumnSchematic() {
  return (
    <div className="w-full h-full flex flex-col gap-0.5">
      <Line w={55} bold />
      <div className="flex-1 flex gap-1.5">
        {[0, 1].map((col) => (
          <div key={col} className="flex-1 flex flex-col">
            <Line w={70} bold /><Line w={90} /><Line w={75} /><Line w={85} />
            <Box><Line w={80} bold /><Line w={60} /></Box>
            <Line w={95} /><Line w={70} />
            <Line w={65} bold /><Line w={88} /><Line w={72} />
            <Box><Line w={75} bold /><Line w={55} /></Box>
            <Line w={90} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ThreeColumnSchematic() {
  return (
    <div className="w-full h-full flex flex-col gap-0.5">
      <Line w={40} bold />
      <div className="flex-1 flex gap-1">
        {[0, 1, 2].map((col) => (
          <div key={col} className="flex-1 flex flex-col">
            <Line w={80} bold /><Line w={90} /><Line w={70} /><Line w={85} />
            <Box><Line w={75} bold /><Line w={60} /></Box>
            <Line w={95} /><Line w={65} /><Line w={88} />
            <Line w={72} bold /><Line w={90} />
            <Box><Line w={85} /><Line w={55} /></Box>
          </div>
        ))}
      </div>
    </div>
  );
}

function LectureSchematic() {
  return (
    <div className="w-full h-full flex flex-col gap-0.5">
      <Line w={55} bold /><Line w={35} />
      <Box><Line w={40} bold /><Line w={82} /><Line w={75} /></Box>
      <Line w={48} bold /><Line w={90} /><Line w={78} /><Line w={85} />
      <ImagePlaceholder />
      <Line w={65} />
      <Line w={52} bold /><Line w={92} /><Line w={72} /><Line w={80} />
      <div className="border-t border-white/20 pt-0.5 mt-0.5">
        <Line w={30} bold /><Line w={88} /><Line w={70} />
      </div>
    </div>
  );
}

function renderSchematic(templateId: CheatSheetTemplateId) {
  if (templateId === '2cols_portrait') return <TwoColumnSchematic />;
  if (templateId === 'lecture_notes') return <LectureSchematic />;
  return <ThreeColumnSchematic />;
}
