"use client";

import { useState } from "react";
import { moveProjectToFolder, type Folder } from "@/lib/api";

interface MoveToFolderModalProps {
  projectId: string;
  currentFolderId: string | null;
  folders: Folder[];
  onClose: () => void;
  onMoved: () => void;
}

export default function MoveToFolderModal({
  projectId,
  currentFolderId,
  folders,
  onClose,
  onMoved,
}: MoveToFolderModalProps) {
  const [selected, setSelected] = useState<string | null>(currentFolderId);
  const [saving, setSaving] = useState(false);

  async function handleMove() {
    if (selected === currentFolderId) { onClose(); return; }
    setSaving(true);
    await moveProjectToFolder(projectId, selected);
    setSaving(false);
    onMoved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[99] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl border border-white/15 bg-neutral-900 p-6 shadow-2xl max-w-sm w-full mx-4">
        <h2 className="text-sm font-semibold text-white mb-4">Move to folder</h2>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {/* No folder option */}
          <button
            onClick={() => setSelected(null)}
            className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm text-left transition-colors ${
              selected === null
                ? "border-purple-500/50 bg-purple-500/10 text-white"
                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/8"
            }`}
          >
            <svg className="h-4 w-4 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            No folder
          </button>

          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelected(f.id)}
              className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm text-left transition-colors ${
                selected === f.id
                  ? "border-purple-500/50 bg-purple-500/10 text-white"
                  : "border-white/10 bg-white/5 text-white/60 hover:bg-white/8"
              }`}
            >
              <svg className="h-4 w-4 shrink-0 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
              {f.name}
            </button>
          ))}

          {folders.length === 0 && (
            <p className="text-xs text-white/30 px-1 py-2">No folders yet. Create one from the Projects page.</p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:from-purple-500 hover:to-blue-500 disabled:opacity-50"
          >
            {saving ? "Moving…" : "Move"}
          </button>
        </div>
      </div>
    </div>
  );
}
