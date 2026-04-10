'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheatSheetPanel } from '../_components/CheatSheetPanel';
import { CheatSheetInlineChat } from '../_components/CheatSheetInlineChat';
import type { CheatSheetSession, CheatSheetStatus } from '../_components/CheatSheetCard';

// ---------------------------------------------------------------------------
// Resizable split pane hook
// ---------------------------------------------------------------------------

function useSplitPane(initialPercent: number, minPercent: number) {
  const [leftPercent, setLeftPercent] = useState(initialPercent);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMouseMove(ev: MouseEvent) {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const rawPercent = ((ev.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(Math.max(rawPercent, minPercent), 100 - minPercent);
      setLeftPercent(clamped);
    }

    function onMouseUp() {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [minPercent]);

  return { containerRef, leftPercent, onMouseDown };
}

interface SelectedContextItem {
  id: string;
  text: string;
  rawMd: string;
  startLine: number;
  endLine: number;
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

function escapeHtmlExport(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInlineExport(text: string): string {
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtmlExport(c)}</code>`);
  return text;
}

// Same blocking logic as CheatSheetPanel — keeps $ math for KaTeX CDN auto-render
function markdownToBlocksExport(md: string): string[] {
  const lines = md.split('\n');
  const blocks: string[] = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = raw.slice(3).trim();
        codeLines = [];
      } else {
        inCodeBlock = false;
        const langAttr = codeLang ? ` class="language-${escapeHtmlExport(codeLang)}"` : '';
        blocks.push(`<pre><code${langAttr}>${escapeHtmlExport(codeLines.join('\n'))}</code></pre>`);
        codeLines = []; codeLang = '';
      }
      continue;
    }
    if (inCodeBlock) { codeLines.push(raw); continue; }

    if (raw.trim() === '$$' || (raw.trim().startsWith('$$') && raw.trim().endsWith('$$') && raw.trim().length > 4)) {
      if (raw.trim().startsWith('$$') && raw.trim().endsWith('$$') && raw.trim() !== '$$') {
        blocks.push(`<div class="math-display">$$${raw.trim().slice(2, -2)}$$</div>`);
        continue;
      }
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') { mathLines.push(lines[i]); i++; }
      blocks.push(`<div class="math-display">$$${mathLines.join('\n')}$$</div>`);
      continue;
    }

    if (raw.trim() === '') continue;

    const h3 = raw.match(/^### (.+)/);
    const h2 = raw.match(/^## (.+)/);
    const h1 = raw.match(/^# (.+)/);
    if (h1 || h2 || h3) {
      const level = h1 ? 1 : h2 ? 2 : 3;
      const text = (h1 ?? h2 ?? h3)![1];
      blocks.push(`<h${level}>${renderInlineExport(text)}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(raw.trim())) { blocks.push('<hr>'); continue; }

    const ulMatch = raw.match(/^[\s]*[-*+•] (.+)/);
    if (ulMatch) { blocks.push(`<li>${renderInlineExport(ulMatch[1])}</li>`); continue; }

    const olMatch = raw.match(/^[\s]*\d+\. (.+)/);
    if (olMatch) { blocks.push(`<li class="oli">${renderInlineExport(olMatch[1])}</li>`); continue; }

    if (raw.trim().startsWith('|')) {
      blocks.push(`<div class="trow">${renderInlineExport(raw)}</div>`);
      continue;
    }

    blocks.push(`<p>${renderInlineExport(raw)}</p>`);
  }

  return blocks;
}

interface SubchatExport {
  block_index: number;
  messages: Array<{ role: string; content: string }>;
}

function buildExportHtml(title: string, blocks: string[], subchats: SubchatExport[], forPrint = false): string {
  const subchatMap: Record<number, SubchatExport> = {};
  for (const sc of subchats) subchatMap[sc.block_index] = sc;

  let bodyHtml = `<h1 class="doc-title">${escapeHtmlExport(title)}</h1>\n`;
  for (let i = 0; i < blocks.length; i++) {
    bodyHtml += `<div class="cs-block">${blocks[i]}</div>\n`;
    if (!forPrint) {
      const sc = subchatMap[i];
      const aiMsgs = sc ? sc.messages.filter((m) => m.role === 'assistant') : [];
      if (aiMsgs.length > 0) {
        bodyHtml += `<details class="subchat-section">\n  <summary>Explanation${aiMsgs.length > 1 ? 's' : ''} (${aiMsgs.length})</summary>\n  <div class="subchat-msgs">\n`;
        for (const msg of aiMsgs) {
          bodyHtml += `    <div class="msg msg-ai"><span class="msg-content">${escapeHtmlExport(msg.content)}</span></div>\n`;
        }
        bodyHtml += `  </div>\n</details>\n`;
      }
    }
  }

  const printScript = forPrint ? `<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),700));<\/script>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapeHtmlExport(title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"><\/script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"
    onload="renderMathInElement(document.body,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],throwOnError:false})"><\/script>
  ${printScript}
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.55;background:#0f0f14;color:#e2e2e8;padding:2rem;max-width:900px;margin:0 auto}
    .doc-title{font-size:1.4rem;font-weight:700;color:#fff;margin-bottom:1.5rem;padding-bottom:.75rem;border-bottom:1px solid rgba(255,255,255,.1)}
    .cs-block{margin-bottom:.3rem}
    h1,h2,h3{color:#fff;font-weight:600;margin-top:1.2rem;margin-bottom:.35rem}
    h1{font-size:1.15rem}
    h2{font-size:1rem;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:.2rem}
    h3{font-size:.9rem;color:rgba(255,255,255,.8)}
    p{color:rgba(255,255,255,.75)}
    li{color:rgba(255,255,255,.75);margin-left:1.2rem}
    li.oli{list-style:decimal}
    code{font-family:'JetBrains Mono','Fira Code',monospace;font-size:.82em;background:rgba(255,255,255,.08);padding:.1em .3em;border-radius:3px;color:#a5b4fc}
    pre{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:.75rem 1rem;overflow-x:auto;margin:.5rem 0}
    pre code{background:none;padding:0;color:#e2e2e8}
    hr{border:none;border-top:1px solid rgba(255,255,255,.1);margin:.75rem 0}
    .math-display{text-align:center;margin:.5rem 0;overflow-x:auto}
    .trow{color:rgba(255,255,255,.7);font-size:.82em;font-family:monospace;white-space:pre-wrap}
    strong{color:#fff;font-weight:600}
    em{color:rgba(255,255,255,.85)}
    .subchat-section{margin:.2rem 0 .7rem;border-left:2px solid rgba(99,102,241,.4);border-radius:0 6px 6px 0;background:rgba(99,102,241,.05)}
    .subchat-section summary{cursor:pointer;padding:.35rem .75rem;font-size:.72rem;color:rgba(99,102,241,.8);font-weight:500;user-select:none}
    .subchat-section summary:hover{color:#818cf8}
    .subchat-msgs{padding:.5rem .75rem;display:flex;flex-direction:column;gap:.5rem}
    .msg-content{font-size:.78rem;color:rgba(255,255,255,.65);white-space:pre-wrap}
    @media print{body{background:#fff;color:#111;padding:1rem}.doc-title{color:#000;border-color:#ccc}h1,h2,h3{color:#000}h2{border-color:#ddd}p,li{color:#222}code{background:#f5f5f5;color:#333}pre{background:#f5f5f5;border-color:#ddd}.subchat-section{display:none}}
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function StatusBadge({ status }: { status: CheatSheetStatus }) {
  const map: Record<CheatSheetStatus, { label: string; classes: string; dot: string }> = {
    pending: {
      label: 'Pending',
      classes: 'text-white/50 bg-white/8 border-white/15',
      dot: 'bg-white/40',
    },
    generating: {
      label: 'Generating',
      classes: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/25',
      dot: 'bg-indigo-400 animate-pulse',
    },
    done: {
      label: 'Done',
      classes: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25',
      dot: 'bg-emerald-400',
    },
    error: {
      label: 'Error',
      classes: 'text-red-400 bg-red-500/15 border-red-500/25',
      dot: 'bg-red-400',
    },
  };
  const { label, classes, dot } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${classes}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export default function CheatSheetSessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params?.id ?? '';
  const router = useRouter();

  const [session, setSession] = useState<CheatSheetSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Content streaming
  const [streamedMd, setStreamedMd] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Inline chat contexts
  const [selectedContexts, setSelectedContexts] = useState<SelectedContextItem[]>([]);

  // Revert support
  const [prevMd, setPrevMd] = useState<string | null>(null);

  // Split pane (60% cheatsheet / 40% chat, min 30% each side)
  const { containerRef, leftPercent, onMouseDown } = useSplitPane(60, 30);

  // Download dropdown
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showPdfTemplates, setShowPdfTemplates] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDownloadMenu) return;
    function handler(e: MouseEvent) {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setShowDownloadMenu(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDownloadMenu]);

  function triggerDownload(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadHTML() {
    if (!displayMd || !session) return;
    setIsExporting(true);
    setShowDownloadMenu(false);
    try {
      let subchats: SubchatExport[] = [];
      const res = await fetch(`/api/cheat-sheets/sessions/${sessionId}/subchats`);
      if (res.ok) {
        const data = await res.json() as { subchats?: SubchatExport[] };
        subchats = data.subchats ?? [];
      }
      const blocks = markdownToBlocksExport(displayMd);
      const html = buildExportHtml(session.title, blocks, subchats, false);
      triggerDownload(html, `${session.title}.html`, 'text/html');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDownloadPDF(templateId = '2cols_portrait') {
    if (!session) return;
    setIsExporting(true);
    setShowDownloadMenu(false);
    try {
      const res = await fetch(`/api/cheat-sheets/sessions/${sessionId}/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, contentMd: displayMd ?? undefined }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errBody.error ?? `PDF generation failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${session.title}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`PDF error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Load session
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function loadSession() {
      try {
        setIsLoadingSession(true);
        setLoadError(null);
        const res = await fetch(`/api/cheat-sheets/sessions/${sessionId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(data.error ?? 'Failed to load session');
        }
        const data = await res.json() as { session: CheatSheetSession & { content_md?: string } };
        const s = data.session;
        setSession(s);
        setTitleDraft(s.title);
        if (s.content_md) setStreamedMd(s.content_md);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoadingSession(false);
      }
    }
    loadSession();
  }, [sessionId]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // ---------------------------------------------------------------------------
  // Generate with AI (SSE streaming)
  // ---------------------------------------------------------------------------

  const handleGenerate = useCallback(async () => {
    if (!session) return;
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setIsStreaming(true);
    setStreamedMd('');
    setSession((prev) => prev ? { ...prev, status: 'generating' } : prev);

    try {
      const res = await fetch(`/api/cheat-sheets/sessions/${sessionId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Generate request failed');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6).trim();
            try {
              const parsed = JSON.parse(payload) as Record<string, unknown>;
              if (parsed.done === true) {
                setIsStreaming(false);
                setSession((prev) => prev ? { ...prev, status: 'done' } : prev);
                return;
              } else if (typeof parsed.chunk === 'string') {
                setStreamedMd((prev) => (prev ?? '') + parsed.chunk);
              } else if (typeof parsed.error === 'string') {
                setIsStreaming(false);
                setSession((prev) => prev ? { ...prev, status: 'error' } : prev);
                return;
              }
            } catch {
              // Non-JSON event, ignore
            }
          }
        }
      }

      setIsStreaming(false);
      setSession((prev) => prev ? { ...prev, status: 'done' } : prev);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setIsStreaming(false);
      setSession((prev) => prev ? { ...prev, status: 'error' } : prev);
    }
  }, [session, sessionId]);

  // ---------------------------------------------------------------------------
  // Title editing
  // ---------------------------------------------------------------------------

  function startEditTitle() {
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }

  async function commitTitle() {
    setEditingTitle(false);
    const trimmed = titleDraft.trim() || (session?.title ?? '');
    setTitleDraft(trimmed);
    setSession((prev) => prev ? { ...prev, title: trimmed } : prev);
    try {
      await fetch(`/api/cheat-sheets/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
    } catch {
      // Optimistic update stays
    }
  }

  // ---------------------------------------------------------------------------
  // Auto-apply and Revert
  // ---------------------------------------------------------------------------

  function handleAutoApply(newMd: string, prev: string) {
    setPrevMd(prev);
    setStreamedMd(newMd);
    fetch(`/api/cheat-sheets/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_md: newMd }),
    }).catch(() => {});
  }

  function handleRevert() {
    if (!prevMd) return;
    const md = prevMd;
    setPrevMd(null);
    setStreamedMd(md);
    fetch(`/api/cheat-sheets/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_md: md }),
    }).catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoadingSession) {
    return (
      <div className="h-full flex flex-col bg-transparent text-white">
        <div className="border-b border-white/10 px-6 py-4 shrink-0 animate-pulse">
          <div className="h-5 w-48 bg-white/8 rounded-lg" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (loadError || !session) {
    return (
      <div className="h-full flex flex-col bg-transparent text-white items-center justify-center gap-4">
        <p className="text-red-400 text-sm">{loadError ?? 'Session not found'}</p>
        <button
          onClick={() => router.push('/cheat-sheets')}
          className="text-xs text-white/50 hover:text-white underline"
        >
          Back to Cheat Sheets
        </button>
      </div>
    );
  }

  const activeStatus = session.status;
  const displayMd = streamedMd ?? null;

  return (
    <div className="h-full flex flex-col bg-transparent text-white overflow-hidden">
      {/* ── Header ── */}
      <div className="border-b border-white/10 px-6 py-3 shrink-0 flex items-center justify-between gap-4">
        {/* Left: back + title + status */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/cheat-sheets')}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white/8 text-white/50 hover:text-white transition-colors"
            title="Back"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle();
                if (e.key === 'Escape') {
                  setTitleDraft(session.title);
                  setEditingTitle(false);
                }
              }}
              className="bg-white/10 border border-white/25 rounded-lg px-2.5 py-1 text-sm font-semibold
                text-white outline-none focus:border-indigo-400/50 min-w-0 w-64"
            />
          ) : (
            <button
              onClick={startEditTitle}
              className="text-sm font-semibold text-white hover:text-indigo-300 transition-colors truncate max-w-xs"
              title="Click to rename"
            >
              {titleDraft}
            </button>
          )}

          <StatusBadge status={activeStatus} />

          {session.subject && (
            <span className="hidden sm:block text-[11px] text-white/30 truncate max-w-[120px]">
              {session.subject}
            </span>
          )}
        </div>

        {/* Right: Generate + Download buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleGenerate}
            disabled={isStreaming}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15
              hover:border-indigo-500/40 bg-white/4 hover:bg-indigo-500/10 text-white/60
              hover:text-indigo-300 text-xs font-medium transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <>
                <div className="w-3 h-3 border border-indigo-400/50 border-t-indigo-300 rounded-full animate-spin" />
                Generating...
              </>
            ) : activeStatus === 'done' || displayMd ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regenerate
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate
              </>
            )}
          </button>

          {/* Download dropdown */}
          {displayMd && (
            <div className="relative" ref={downloadMenuRef}>
              <button
                onClick={() => setShowDownloadMenu((v) => !v)}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15
                  hover:border-white/25 bg-white/4 hover:bg-white/8 text-white/60
                  hover:text-white/90 text-xs font-medium transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <div className="w-3 h-3 border border-white/30 border-t-white/80 rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                Download
                <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showDownloadMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a1a2e] border border-white/15 rounded-xl shadow-2xl overflow-hidden min-w-[240px]">
                  {/* HTML option */}
                  <button
                    onClick={handleDownloadHTML}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/6 transition-colors text-left"
                  >
                    <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    Download interactive HTML
                  </button>

                  {/* PDF option — expands to show templates */}
                  <button
                    onClick={() => setShowPdfTemplates((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/6 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2.5">
                      <svg className="w-3.5 h-3.5 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Download PDF
                    </span>
                    <svg className={`w-3 h-3 opacity-50 transition-transform ${showPdfTemplates ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Template picker */}
                  {showPdfTemplates && (
                    <div className="border-t border-white/8 bg-white/2">
                      {[
                        { id: '2cols_portrait',       label: '2-Col Portrait',  desc: 'Formulas & quick reference',        recommended: true },
                        { id: 'landscape_3col_maths', label: '3-Col Landscape', desc: 'Dense math & large formulas',        recommended: false },
                        { id: 'study_form',           label: '3-Col Portrait',  desc: 'Vocabulary lists & Q&A',             recommended: false },
                        { id: 'lecture_notes',        label: 'Long Notes',      desc: 'Structured notes with prose',        recommended: false },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleDownloadPDF(t.id)}
                          disabled={isExporting}
                          className="w-full flex items-center justify-between gap-2 px-4 py-2 text-left hover:bg-white/6 transition-colors disabled:opacity-40"
                        >
                          <div>
                            <span className="text-xs text-white/80">{t.label}</span>
                            {t.recommended && (
                              <span className="ml-1.5 text-[9px] font-medium text-indigo-400 uppercase tracking-wide">recommended</span>
                            )}
                            <p className="text-[10px] text-white/35 mt-0.5">{t.desc}</p>
                          </div>
                          {isExporting ? (
                            <div className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin shrink-0" />
                          ) : (
                            <svg className="w-3 h-3 text-white/30 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Main layout: cheatsheet | divider | chat ── */}
      <div ref={containerRef} className="flex-1 flex flex-row min-h-0 overflow-hidden">
        {/* Left panel: cheat sheet */}
        <div
          className="min-h-0 overflow-hidden"
          style={{ width: `${leftPercent}%` }}
        >
          <CheatSheetPanel
            sessionId={sessionId}
            contentMd={displayMd}
            status={activeStatus}
            isStreaming={isStreaming}
            onGenerate={handleGenerate}
            selectedContexts={selectedContexts}
            onTextSelect={(context) => {
              setSelectedContexts((prev) =>
                prev.some((item) => item.text === context.text)
                  ? prev
                  : [...prev, context]
              );
            }}
            onClearContext={(id) => setSelectedContexts((prev) => prev.filter((item) => item.id !== id))}
            onClearAllContexts={() => setSelectedContexts([])}
            prevMd={prevMd}
            onRevert={handleRevert}
            onSaveEdit={() => setPrevMd(null)}
            onBlockEdit={(newContent, startLine, endLine) => {
              if (!displayMd) return;
              const lines = displayMd.split('\n');
              const newLines = newContent.split('\n');
              const newMd = [...lines.slice(0, startLine), ...newLines, ...lines.slice(endLine + 1)].join('\n');
              handleAutoApply(newMd, displayMd);
            }}
          />
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={onMouseDown}
          className="w-1 shrink-0 cursor-col-resize bg-white/8 hover:bg-indigo-500/40 active:bg-indigo-500/60 transition-colors duration-150 relative group"
          title="Drag to resize"
        >
          {/* Visual grip dots */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="w-0.5 h-0.5 rounded-full bg-white/50" />
            <span className="w-0.5 h-0.5 rounded-full bg-white/50" />
            <span className="w-0.5 h-0.5 rounded-full bg-white/50" />
          </div>
        </div>

        {/* Right panel: inline chat */}
        <div
          className="min-h-0 overflow-hidden flex flex-col border-l border-white/8"
          style={{ width: `${100 - leftPercent}%` }}
        >
          <CheatSheetInlineChat
            sessionId={sessionId}
            selectedContexts={selectedContexts}
            onClearContext={(id) => setSelectedContexts((prev) => prev.filter((item) => item.id !== id))}
            onClearAllContexts={() => setSelectedContexts([])}
            contentMd={displayMd}
            onAutoApply={handleAutoApply}
          />
        </div>
      </div>
    </div>
  );
}
