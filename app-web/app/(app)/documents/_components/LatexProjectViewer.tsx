'use client';

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { LatexHighlighter } from './LatexHighlighter';
import type { ProjectLikeFile } from '@/lib/extended-lecture-notes-project';

interface Props {
  files: ProjectLikeFile[];
}

interface TreeDir {
  kind: 'dir';
  name: string;
  path: string;
  dirs: Map<string, TreeDir>;
  files: ProjectLikeFile[];
}

function createDir(name: string, path: string): TreeDir {
  return { kind: 'dir', name, path, dirs: new Map(), files: [] };
}

function basename(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx < 0 ? path : path.slice(idx + 1);
}

function buildTree(files: ProjectLikeFile[]): TreeDir {
  const root = createDir('', '');
  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean);
    let cursor = root;
    for (let i = 0; i < Math.max(parts.length - 1, 0); i += 1) {
      const seg = parts[i];
      const segPath = cursor.path ? `${cursor.path}/${seg}` : seg;
      const existing = cursor.dirs.get(seg);
      if (existing) {
        cursor = existing;
        continue;
      }
      const next = createDir(seg, segPath);
      cursor.dirs.set(seg, next);
      cursor = next;
    }
    cursor.files.push(file);
  }
  return root;
}

function collectDirPaths(dir: TreeDir): string[] {
  const paths: string[] = [];
  for (const child of [...dir.dirs.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    paths.push(child.path);
    paths.push(...collectDirPaths(child));
  }
  return paths;
}

function parentDirs(path: string): string[] {
  const parts = path.split('/').filter(Boolean);
  const dirs: string[] = [];
  let current = '';
  for (let i = 0; i < Math.max(parts.length - 1, 0); i += 1) {
    current = current ? `${current}/${parts[i]}` : parts[i];
    dirs.push(current);
  }
  return dirs;
}

export function LatexProjectViewer({ files }: Props) {
  const textFiles = useMemo(
    () => files.filter((f) => !/\.(png|jpe?g|pdf|svg)$/i.test(f.path)).sort((a, b) => a.path.localeCompare(b.path)),
    [files]
  );

  const tree = useMemo(() => buildTree(textFiles), [textFiles]);
  const allDirPaths = useMemo(() => collectDirPaths(tree), [tree]);

  const [selectedPath, setSelectedPath] = useState<string>(textFiles[0]?.path ?? '');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const selected = textFiles.find((f) => f.path === selectedPath) ?? textFiles[0] ?? null;
  const didInitExpandedRef = useRef(false);
  const knownDirsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!textFiles.length) {
      setSelectedPath('');
      return;
    }
    if (!textFiles.some((f) => f.path === selectedPath)) {
      setSelectedPath(textFiles[0].path);
    }
  }, [textFiles, selectedPath]);

  useEffect(() => {
    if (!didInitExpandedRef.current) {
      didInitExpandedRef.current = true;
      knownDirsRef.current = new Set(allDirPaths);
      setExpandedDirs(new Set(allDirPaths));
      return;
    }
    const newDirs = allDirPaths.filter((path) => !knownDirsRef.current.has(path));
    if (newDirs.length === 0) return;
    for (const dirPath of newDirs) knownDirsRef.current.add(dirPath);
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      for (const dirPath of newDirs) next.add(dirPath);
      return next;
    });
  }, [allDirPaths]);

  useEffect(() => {
    if (!selectedPath) return;
    const parents = parentDirs(selectedPath);
    if (!parents.length) return;
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const p of parents) {
        if (!next.has(p)) {
          next.add(p);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedPath]);

  function toggleDir(path: string) {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function renderDir(dir: TreeDir, depth: number): ReactElement[] {
    const nodes: ReactElement[] = [];
    const sortedDirs = [...dir.dirs.values()].sort((a, b) => a.name.localeCompare(b.name));
    const sortedFiles = [...dir.files].sort((a, b) => basename(a.path).localeCompare(basename(b.path)));

    for (const childDir of sortedDirs) {
      const isOpen = expandedDirs.has(childDir.path);
      nodes.push(
        <div key={`dir-${childDir.path}`}>
          <button
            onClick={() => toggleDir(childDir.path)}
            className="w-full text-left text-xs text-white/80 hover:text-white hover:bg-white/8 transition-colors"
            style={{ padding: '6px 8px 6px 10px', paddingLeft: `${10 + depth * 14}px` }}
            title={childDir.path}
          >
            <span className="inline-flex items-center gap-1.5">
              <svg
                className={`w-3.5 h-3.5 text-white/55 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden
              >
                <path d="M7 4l7 6-7 6V4z" />
              </svg>
              <span className="text-white/85">{childDir.name}</span>
            </span>
          </button>
          {isOpen && renderDir(childDir, depth + 1)}
        </div>
      );
    }

    for (const file of sortedFiles) {
      const isSelected = selected?.path === file.path;
      nodes.push(
        <button
          key={`file-${file.path}`}
          onClick={() => setSelectedPath(file.path)}
          className={`w-full text-left text-xs transition-colors ${
            isSelected
              ? 'bg-indigo-500/25 text-indigo-200'
              : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
          style={{ padding: '7px 8px 7px 10px', paddingLeft: `${29 + depth * 14}px` }}
          title={file.path}
        >
          {basename(file.path)}
        </button>
      );
    }

    return nodes;
  }

  return (
    <div className="flex-1 min-h-0 min-w-0 flex overflow-hidden" style={{ background: 'rgba(0,0,0,0.20)' }}>
      <aside className="w-56 shrink-0 border-r border-white/10 overflow-y-auto">
        <div className="px-3 py-2 text-[11px] text-white/60 border-b border-white/10">
          Source Files
        </div>
        <div className="py-1">
          {renderDir(tree, 0)}
        </div>
      </aside>

      <div className="flex-1 min-h-0 min-w-0 flex flex-col">
        <div className="px-3 py-2 border-b border-white/10 text-[11px] text-white/60">
          {selected?.path ?? 'No file selected'}
        </div>
        <LatexHighlighter
          value={selected?.content ?? ''}
          onChange={() => {}}
          readOnly
        />
      </div>
    </div>
  );
}
