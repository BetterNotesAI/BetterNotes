'use client';

import { useCallback, useEffect, useState } from 'react';

export interface DocumentData {
  id: string;
  title: string;
  template_id: string;
  status: 'draft' | 'generating' | 'ready' | 'error';
  is_starred: boolean;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface VersionMeta {
  id: string;
  version_number: number;
  created_at: string;
  prompt_used: string | null;
  compile_status: string;
}

interface WorkspaceState {
  document: DocumentData | null;
  pdfSignedUrl: string | null;
  latexContent: string | null;
  versions: VersionMeta[];
  activeVersionId: string | null;
  versionNumber: number | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
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
    error: null,
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
    setState((s) => ({ ...s, isGenerating: true, error: null }));
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

      if (data.message) {
        // AI replied with a chat message, not a document
        setState((s) => ({ ...s, isGenerating: false }));
        return { message: data.message as string };
      }

      // Reload the document to get updated state
      await load();
      setState((s) => ({
        ...s,
        pdfSignedUrl: data.pdfSignedUrl ?? s.pdfSignedUrl,
        latexContent: data.latex ?? s.latexContent,
        isGenerating: false,
      }));

      return { versionId: data.versionId as string, pdfSignedUrl: data.pdfSignedUrl as string | null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      setState((s) => ({ ...s, isGenerating: false, error: message }));
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
