// lib/draft.ts — Generic localStorage draft persistence
// Replaces playgroundDraft.ts and workspaceDraft.ts

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function createDraftStore<T extends { savedAt: number }>(
  key: string,
  hasContent: (draft: Omit<T, "savedAt">) => boolean
) {
  function save(draft: Omit<T, "savedAt">): void {
    if (typeof window === "undefined" || !hasContent(draft)) return;
    try {
      localStorage.setItem(key, JSON.stringify({ ...draft, savedAt: Date.now() }));
    } catch (e) {
      console.warn(`[draft] Failed to save "${key}":`, e);
    }
  }

  function load(): T | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw) as T;
      if (Date.now() - data.savedAt > SEVEN_DAYS_MS) {
        clear();
        return null;
      }
      return data;
    } catch (e) {
      console.warn(`[draft] Failed to load "${key}":`, e);
      return null;
    }
  }

  function clear(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[draft] Failed to clear "${key}":`, e);
    }
  }

  function has(): boolean {
    return load() !== null;
  }

  return { save, load, clear, has };
}

// --- Workspace draft ---

export interface WorkspaceDraft {
  draftLatex: string;
  savedLatex: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  selectedTemplateId: string | null;
  savedAt: number;
}

const workspaceStore = createDraftStore<WorkspaceDraft>(
  "betternotes_workspace_draft",
  (d) => !!(d.draftLatex || d.savedLatex || d.messages.length > 0)
);

export const saveWorkspaceDraft = workspaceStore.save;
export const loadWorkspaceDraft = workspaceStore.load;
export const clearWorkspaceDraft = workspaceStore.clear;
export const hasWorkspaceDraft = workspaceStore.has;

// --- Playground draft ---

export interface PlaygroundSession {
  sessionName: string;
  files: { path: string; content: string }[];
  activeFilePath: string;
  splitRatio: number;
  savedAt: number;
}

const playgroundStore = createDraftStore<PlaygroundSession>(
  "betternotes_playground",
  (d) => d.files.length > 0 && d.files.some((f) => f.content.trim() !== "")
);

export const savePlaygroundDraft = playgroundStore.save;
export const loadPlaygroundDraft = playgroundStore.load;
export const clearPlaygroundDraft = playgroundStore.clear;
export const hasPlaygroundDraft = playgroundStore.has;
