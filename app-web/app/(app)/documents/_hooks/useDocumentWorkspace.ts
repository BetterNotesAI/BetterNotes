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

interface WorkspaceState {
  document: DocumentData | null;
  pdfSignedUrl: string | null;
  latexContent: string | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
}

export function useDocumentWorkspace(documentId: string) {
  const [state, setState] = useState<WorkspaceState>({
    document: null,
    pdfSignedUrl: null,
    latexContent: null,
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
        isLoading: false,
      }));
    } catch (err: any) {
      setState((s) => ({ ...s, isLoading: false, error: err.message }));
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
    } catch (err: any) {
      setState((s) => ({ ...s, isGenerating: false, error: err.message }));
      throw err;
    }
  }, [documentId, load]);

  const refreshPdfUrl = useCallback(async () => {
    // Reload document to get fresh signed URL
    await load();
  }, [load]);

  return {
    ...state,
    generate,
    refreshPdfUrl,
    reload: load,
  };
}
