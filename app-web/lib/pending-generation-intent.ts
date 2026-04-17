'use client';

const STORAGE_KEY = 'bn_pending_generation_intent_v1';
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export type PendingGenerationIntentType =
  | 'document_creation'
  | 'document_workspace_send'
  | 'exam_generate'
  | 'problem_solve';

interface BasePendingGenerationIntent<TPayload> {
  type: PendingGenerationIntentType;
  path: string;
  payload: TPayload;
  createdAt: number;
}

interface StoredPendingGenerationIntent<TPayload> extends BasePendingGenerationIntent<TPayload> {
  v: 1;
}

export type PendingGenerationIntent<TPayload = unknown> = BasePendingGenerationIntent<TPayload>;

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function sanitizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function pathnameOf(path: string): string {
  return sanitizePath(path).split('?')[0]?.split('#')[0] ?? '/';
}

function matchesPath(currentPath: string, storedPath: string): boolean {
  const normalizedCurrent = sanitizePath(currentPath);
  const normalizedStored = sanitizePath(storedPath);
  return (
    normalizedCurrent === normalizedStored ||
    pathnameOf(normalizedCurrent) === pathnameOf(normalizedStored)
  );
}

export function savePendingGenerationIntent<TPayload>(
  intent: Omit<PendingGenerationIntent<TPayload>, 'createdAt'>
): void {
  const storage = getSessionStorage();
  if (!storage) return;

  const payload: StoredPendingGenerationIntent<TPayload> = {
    v: 1,
    type: intent.type,
    path: sanitizePath(intent.path),
    payload: intent.payload,
    createdAt: Date.now(),
  };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Best-effort only
  }
}

export function readPendingGenerationIntent<TPayload = unknown>(): PendingGenerationIntent<TPayload> | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredPendingGenerationIntent<TPayload>>;

    if (
      parsed?.v !== 1 ||
      typeof parsed.type !== 'string' ||
      typeof parsed.path !== 'string' ||
      typeof parsed.createdAt !== 'number'
    ) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }

    if (Date.now() - parsed.createdAt > MAX_AGE_MS) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      type: parsed.type as PendingGenerationIntentType,
      path: sanitizePath(parsed.path),
      payload: parsed.payload as TPayload,
      createdAt: parsed.createdAt,
    };
  } catch {
    storage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearPendingGenerationIntent(): void {
  const storage = getSessionStorage();
  storage?.removeItem(STORAGE_KEY);
}

export function consumePendingGenerationIntent<TPayload = unknown>(args?: {
  type?: PendingGenerationIntentType;
  path?: string;
}): PendingGenerationIntent<TPayload> | null {
  const intent = readPendingGenerationIntent<TPayload>();
  if (!intent) return null;

  if (args?.type && intent.type !== args.type) {
    return null;
  }

  if (args?.path && !matchesPath(args.path, intent.path)) {
    return null;
  }

  clearPendingGenerationIntent();
  return intent;
}

