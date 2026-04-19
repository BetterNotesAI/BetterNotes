import { NextRequest } from 'next/server';

function normalizeFolderId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  if (lowered === 'null' || lowered === 'undefined') return null;
  return trimmed;
}

export function inferFolderIdFromRequest(req: NextRequest): string | null {
  const referer = req.headers.get('referer');
  if (!referer) return null;

  try {
    const parsed = new URL(referer);

    const fromQuery =
      normalizeFolderId(parsed.searchParams.get('projectId'))
      ?? normalizeFolderId(parsed.searchParams.get('folder_id'));
    if (fromQuery) return fromQuery;

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length >= 2 && segments[0] === 'projects') {
      return normalizeFolderId(decodeURIComponent(segments[1]));
    }
  } catch {
    return null;
  }

  return null;
}

