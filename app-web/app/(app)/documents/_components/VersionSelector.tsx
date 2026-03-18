'use client';

import { useState, useRef, useEffect } from 'react';
import type { VersionMeta } from '../_hooks/useDocumentWorkspace';

interface VersionSelectorProps {
  versions: VersionMeta[];
  activeVersionId: string | null;
  onSwitch: (versionId: string) => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VersionSelector({ versions, activeVersionId, onSwitch }: VersionSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const activeVersion = versions.find((v) => v.id === activeVersionId);
  const currentVersionNum = activeVersion?.version_number ?? versions[0]?.version_number;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 text-xs rounded px-2 py-0.5 border transition-colors ${
          open
            ? 'bg-gray-700 border-gray-600 text-white'
            : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
        }`}
      >
        <span>v{currentVersionNum}</span>
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-gray-900 border border-gray-700
          rounded-xl shadow-xl min-w-[220px] overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-800">
            <p className="text-xs text-gray-500 font-medium">Version history</p>
          </div>
          <div className="max-h-[280px] overflow-y-auto py-1">
            {versions.map((v) => {
              const isActive = v.id === activeVersionId;
              return (
                <button
                  key={v.id}
                  onClick={() => { onSwitch(v.id); setOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 text-xs transition-colors hover:bg-gray-800 ${
                    isActive ? 'bg-gray-800/50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-medium ${isActive ? 'text-blue-400' : 'text-gray-300'}`}>
                      v{v.version_number}
                      {isActive && <span className="ml-1.5 text-gray-500">(current)</span>}
                    </span>
                    <span
                      className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                        v.compile_status === 'success' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                  </div>
                  <p className="text-gray-500 mt-0.5">{formatDate(v.created_at)}</p>
                  {v.prompt_used && (
                    <p className="text-gray-600 mt-0.5 truncate">{v.prompt_used}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
