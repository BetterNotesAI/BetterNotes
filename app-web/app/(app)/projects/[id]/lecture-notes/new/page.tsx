'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { DocumentCreationBar, type CreateDocumentInput } from '@/app/_components/DocumentCreationBar';
import {
  REPORT_TEMPLATE_OPTIONS,
  type ReportTemplateId,
} from '@/app/(app)/projects/new/_components/LectureNotesPanel';
import { getTemplateThumbnailSrc } from '@/lib/template-thumbnails';
import { useProjectName } from '@/lib/use-project-name';

const DEFAULT_REPORT_TEMPLATE_ID: ReportTemplateId = 'lecture_notes';

function buildReportTitle(prompt: string): string {
  const compact = prompt.replace(/\s+/g, ' ').trim();
  if (!compact) return 'Untitled Report';
  const clipped = compact.length > 80 ? `${compact.slice(0, 80).trimEnd()}...` : compact;
  return clipped;
}

export default function NewProjectLectureNotesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params?.id ?? '';
  const initialPrompt = searchParams?.get('prompt')?.trim() || '';
  const projectName = useProjectName(projectId || null);

  const [reportTemplateId, setReportTemplateId] = useState<ReportTemplateId>(DEFAULT_REPORT_TEMPLATE_ID);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(data: CreateDocumentInput) {
    if (!projectId) {
      setCreateError('Notebook not found.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const title = buildReportTitle(data.prompt);
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
          template_id: reportTemplateId,
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
        setCreateError(respData.error ?? 'Failed to create report.');
        return;
      }

      const documentId = respData.document?.id;
      if (!documentId) {
        setCreateError('Document was created without a valid id.');
        return;
      }

      const query = new URLSearchParams({
        prompt: data.prompt,
        projectId,
      });
      router.push(`/documents/${documentId}?${query.toString()}`);
    } catch {
      setCreateError('Something went wrong. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="h-full flex flex-col bg-transparent text-white">
      <div className="border-b border-white/10 px-6 h-14 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => router.push(`/projects/${encodeURIComponent(projectId)}`)}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white/8 text-white/45 hover:text-white transition-colors"
            title="Back to notebook"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold truncate flex items-center gap-2 min-w-0">
            {projectName && (
              <>
                <button
                  onClick={() => router.push(`/projects/${encodeURIComponent(projectId)}`)}
                  className="text-white/55 hover:text-white transition-colors truncate max-w-[40ch]"
                  title={`Go to notebook "${projectName}"`}
                >
                  {projectName}
                </button>
                <span className="text-white/25 shrink-0">/</span>
              </>
            )}
            <span className="truncate">New Report</span>
          </h1>
        </div>
        <button
          onClick={() => router.push(`/projects/${encodeURIComponent(projectId)}`)}
          className="text-xs text-white/45 hover:text-white/75 transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-14">
          <h2 className="text-3xl font-semibold tracking-tight mb-2">
            Build notebook{' '}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              report
            </span>
          </h2>
          <p className="text-white/50 text-sm mb-8">
            Choose a report template and save the generated document inside this notebook.
          </p>

          <div className="mb-8">
            <h3 className="text-sm font-medium text-white/60 mb-4">Report template</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {REPORT_TEMPLATE_OPTIONS.map((template) => {
                const isSelected = reportTemplateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    disabled={isCreating}
                    onClick={() => {
                      setReportTemplateId(template.id);
                      setCreateError(null);
                    }}
                    aria-pressed={isSelected}
                    className={`group text-left rounded-2xl border p-3 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                      isSelected
                        ? 'border-indigo-400/75 bg-indigo-500/15 shadow-[0_0_0_1px_rgba(129,140,248,0.5),0_12px_28px_rgba(0,0,0,0.28)]'
                        : 'border-white/15 bg-white/[0.07] hover:border-white/30 hover:bg-white/[0.10]'
                    }`}
                  >
                    <div className="relative aspect-[4/3] rounded-xl mb-2.5 overflow-hidden border border-white/15 bg-white/5">
                      <Image
                        src={getTemplateThumbnailSrc(template.id)}
                        alt={template.title}
                        fill
                        sizes="(min-width: 1024px) 230px, (min-width: 640px) 320px, 100vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        onError={(e) => {
                          e.currentTarget.classList.add('hidden');
                        }}
                      />
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white/88 leading-snug">{template.title}</p>
                        <p className="mt-1 min-h-[30px] text-[10px] leading-snug text-white/45">
                          {template.description}
                        </p>
                      </div>
                      <span
                        className={`mt-0.5 h-4 w-4 rounded-full border transition-colors ${
                          isSelected
                            ? 'border-indigo-300 bg-indigo-400'
                            : 'border-white/25 bg-white/5 group-hover:border-white/45'
                        }`}
                        aria-hidden
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <DocumentCreationBar
              onSubmit={handleCreate}
              isLoading={isCreating}
              error={createError}
              placeholder="Describe the report you want to create..."
              autoFocus
              initialPrompt={initialPrompt}
              selectedTemplateId={reportTemplateId}
              lockTemplateSelection
            />
          </div>
        </div>
      </div>
    </div>
  );
}
