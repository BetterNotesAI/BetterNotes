'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { DocumentCreationBar, type CreateDocumentInput } from '@/app/_components/DocumentCreationBar';
import { getTemplateThumbnailSrc } from '@/lib/template-thumbnails';
import { useProjectName } from '@/lib/use-project-name';

const TEMPLATE_ID = 'lecture_notes';

function buildLectureNotesTitle(prompt: string): string {
  const compact = prompt.replace(/\s+/g, ' ').trim();
  if (!compact) return 'Untitled Extended Lecture Notes';
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
  const barRef = useRef<HTMLDivElement>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(data: CreateDocumentInput) {
    if (!projectId) {
      setCreateError('Project not found.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const title = buildLectureNotesTitle(data.prompt);
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
          template_id: TEMPLATE_ID,
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
        setCreateError(respData.error ?? 'Failed to create extended lecture notes.');
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
            title="Back to project"
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
                  title={`Go to project "${projectName}"`}
                >
                  {projectName}
                </button>
                <span className="text-white/25 shrink-0">/</span>
              </>
            )}
            <span className="truncate">New Extended Lecture Notes</span>
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
            Build project{' '}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              extended lecture notes
            </span>
          </h2>
          <p className="text-white/50 text-sm mb-8">
            This flow uses the Extended Lecture Notes template and saves everything inside this project.
          </p>

          <div ref={barRef}>
            <DocumentCreationBar
              onSubmit={handleCreate}
              isLoading={isCreating}
              error={createError}
              placeholder="Describe the lecture notes you want to create..."
              autoFocus
              initialPrompt={initialPrompt}
              selectedTemplateId={TEMPLATE_ID}
              lockTemplateSelection
            />
          </div>

          <div className="mt-12">
            <h3 className="text-sm font-medium text-white/60 mb-4">Template</h3>
            <button
              type="button"
              onClick={() => barRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="group w-full sm:w-[320px] text-left rounded-2xl border bg-white/[0.10] border-white/30 backdrop-blur p-3 transition-all
                hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
            >
              <div className="relative aspect-[4/3] rounded-lg mb-2.5 overflow-hidden border border-white/20 bg-white/5">
                <Image
                  src={getTemplateThumbnailSrc(TEMPLATE_ID)}
                  alt="Extended Lecture Notes"
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).classList.add('hidden');
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <p className="text-xs font-semibold text-white/85 leading-snug">Extended Lecture Notes</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/30 text-indigo-200">
                  Locked
                </span>
              </div>
              <p className="text-[10px] text-indigo-300">Selected</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
