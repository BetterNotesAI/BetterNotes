'use client';

import { useCallback, useEffect, useState } from 'react';

export interface DocumentData {
  id: string;
  user_id: string;
  title: string;
  template_id: string;
  status: 'draft' | 'generating' | 'ready' | 'error';
  is_starred: boolean;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  forked_from_id: string | null;
}

export interface VersionMeta {
  id: string;
  version_number: number;
  created_at: string;
  prompt_used: string | null;
  compile_status: string;
}

export type GenerationPhase = 'calling_ai' | 'compiling' | 'uploading' | null;

interface WorkspaceState {
  document: DocumentData | null;
  pdfSignedUrl: string | null;
  latexContent: string | null;
  versions: VersionMeta[];
  activeVersionId: string | null;
  versionNumber: number | null;
  isLoading: boolean;
  isGenerating: boolean;
  generationPhase: GenerationPhase;
  error: string | null;
  isOwner: boolean;
}

function humanizeError(msg: string): string {
  if (msg.includes('guest_doc_limit') || msg.includes('guest_message_limit')) return '';
  if (msg.includes('limit_reached')) return 'Monthly credit limit reached. Upgrade your plan to continue using AI.';
  if (msg.includes('compile') || msg.includes('LaTeX')) return 'PDF compilation failed. The AI will try to fix it automatically next time.';
  if (msg.includes('timeout') || msg.includes('ECONNREFUSED')) return 'The generation service is taking too long. Please try again.';
  if (msg.includes('template')) return 'Template not found. Please refresh and try again.';
  return 'Something went wrong. Please try again.';
}

export function useDocumentWorkspace(documentId: string) {
  const [state, setState] = useState<WorkspaceState>({
    document: null,
    pdfSignedUrl: null,
    latexContent: null,
    versions: [],
    activeVersionId: null,
    versionNumber: null,
    isLoading: true,
    isGenerating: false,
    generationPhase: null,
    error: null,
    isOwner: true,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const resp = await fetch(`/api/documents/${documentId}`);
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Failed to load document');
      }
      const data = await resp.json();
      setState((s) => ({
        ...s,
        document: data.document,
        pdfSignedUrl: data.pdfSignedUrl ?? null,
        latexContent: data.latexContent ?? null,
        versions: data.versions ?? [],
        activeVersionId: data.activeVersionId ?? null,
        versionNumber: data.versionNumber ?? null,
        isLoading: false,
        isOwner: data.isOwner ?? true,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setState((s) => ({ ...s, isLoading: false, error: message }));
    }
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = useCallback(async (prompt: string, files?: unknown[]) => {
    setState((s) => ({ ...s, isGenerating: true, generationPhase: 'calling_ai', error: null }));
    try {
      const resp = await fetch(`/api/documents/${documentId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, files: files ?? [] }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data?.error ?? 'Generation failed');
      }

      setState((s) => ({ ...s, generationPhase: 'compiling' }));

      if (data.message) {
        // AI replied with a chat message, not a document
        setState((s) => ({ ...s, isGenerating: false, generationPhase: null }));
        return { message: data.message as string };
      }

      setState((s) => ({ ...s, generationPhase: 'uploading' }));

      // Reload the document to get updated state
      await load();
      setState((s) => ({
        ...s,
        pdfSignedUrl: data.pdfSignedUrl ?? s.pdfSignedUrl,
        latexContent: data.latex ?? s.latexContent,
        isGenerating: false,
        generationPhase: null,
      }));

      return { versionId: data.versionId as string, pdfSignedUrl: data.pdfSignedUrl as string | null };
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Generation failed';
      const message = humanizeError(raw);
      setState((s) => ({ ...s, isGenerating: false, generationPhase: null, error: message || null }));
      throw err;
    }
  }, [documentId, load]);

  const switchVersion = useCallback(async (versionId: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const resp = await fetch(`/api/documents/${documentId}?versionId=${versionId}`);
      if (!resp.ok) {
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }
      const data = await resp.json();
      setState((s) => ({
        ...s,
        pdfSignedUrl: data.pdfSignedUrl ?? null,
        latexContent: data.latexContent ?? null,
        activeVersionId: data.activeVersionId ?? null,
        versionNumber: data.versionNumber ?? null,
        isLoading: false,
      }));
    } catch {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, [documentId]);

  const refreshPdfUrl = useCallback(async () => {
    // Reload document to get fresh signed URL
    await load();
  }, [load]);

  return {
    ...state,
    generate,
    refreshPdfUrl,
    reload: load,
    switchVersion,
  };
}
