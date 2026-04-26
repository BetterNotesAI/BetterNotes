'use client';

import { useEffect, useState } from 'react';

/**
 * Fetch the folder (notebook) display name for a given projectId.
 * Returns null while loading or when no projectId is provided.
 * Caches results in-memory so repeated navigation within the same notebook
 * does not re-fetch the folder metadata.
 */
const projectNameCache = new Map<string, string>();

export function useProjectName(projectId: string | null | undefined): string | null {
  const [name, setName] = useState<string | null>(() =>
    projectId ? projectNameCache.get(projectId) ?? null : null
  );

  useEffect(() => {
    if (!projectId) {
      setName(null);
      return;
    }
    const cached = projectNameCache.get(projectId);
    if (cached) {
      setName(cached);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/folders/${encodeURIComponent(projectId)}`);
        const data = (await res.json().catch(() => ({}))) as {
          folder?: { name?: string };
        };
        const folderName = data.folder?.name ?? null;
        if (!cancelled && folderName) {
          projectNameCache.set(projectId, folderName);
          setName(folderName);
        }
      } catch {
        // Silent — header just falls back to the page title.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return name;
}
