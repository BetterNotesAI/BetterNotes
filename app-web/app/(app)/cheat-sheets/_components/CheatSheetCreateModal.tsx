'use client';

import { useEffect, useRef, useState } from 'react';

const MAX_DOCS = 5;
const MAX_CHARS = 18000;
const ACCEPTED_TYPES = '.pdf,.txt,.md';

const LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'spanish', label: 'Español' },
  { value: 'catalan', label: 'Català' },
  { value: 'french', label: 'Français' },
  { value: 'german', label: 'Deutsch' },
  { value: 'portuguese', label: 'Português' },
  { value: 'italian', label: 'Italiano' },
];

interface DocumentItem {
  id: string;
  title: string;
}

async function extractFileText(file: File): Promise<string> {
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
    GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
    const buffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: buffer }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ('str' in item ? (item as { str: string }).str : ''))
          .join(' ')
      );
    }
    return pages.join('\n\n').slice(0, MAX_CHARS);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(((e.target?.result as string) ?? '').slice(0, MAX_CHARS));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}

export function CheatSheetCreateModal({ isOpen, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [language, setLanguage] = useState('english');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [externalText, setExternalText] = useState('');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isExtractingFile, setIsExtractingFile] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Load documents
  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingDocs(true);
    fetch('/api/documents')
      .then((r) => r.ok ? r.json() : { documents: [] })
      .then((data) => setDocuments(data.documents ?? []))
      .catch(() => {})
      .finally(() => setIsLoadingDocs(false));
  }, [isOpen]);

  // Focus title on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setSubject('');
      setLanguage('english');
      setSelectedDocIds([]);
      setExternalText('');
      setUploadedFileName(null);
      setError(null);
      setIsCreating(false);
    }
  }, [isOpen]);

  function toggleDoc(id: string) {
    setSelectedDocIds((prev) => {
      if (prev.includes(id)) return prev.filter((d) => d !== id);
      if (prev.length >= MAX_DOCS) return prev;
      return [...prev, id];
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExtractingFile(true);
    setError(null);
    try {
      const text = await extractFileText(file);
      setExternalText((prev) => (prev ? `${prev}\n\n${text}` : text));
      setUploadedFileName(file.name);
    } catch {
      setError('Failed to extract text from file.');
    } finally {
      setIsExtractingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleCreate() {
    if (isCreating) return;
    const hasContent = selectedDocIds.length > 0 || externalText.trim().length > 0;
    if (!hasContent) {
      setError('Add at least one document or paste some content.');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/cheat-sheets/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Untitled Cheat Sheet',
          subject: subject.trim() || null,
          language,
          source_doc_ids: selectedDocIds,
          external_content: externalText.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Failed to create session');
      }

      const data = await res.json() as { session: { id: string } };
      onCreated(data.session.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsCreating(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-[#1a1a1a] border border-white/15 rounded-2xl shadow-2xl shadow-black/50 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-500/15 border border-indigo-500/20">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-white">New Cheat Sheet</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/60">Title</label>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Linear Algebra Formulas"
              className="w-full bg-white/6 border border-white/12 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-indigo-400/50 focus:bg-white/8 transition-colors"
            />
          </div>

          {/* Subject + Language row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/60">Subject (optional)</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Calculus"
                className="w-full bg-white/6 border border-white/12 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-indigo-400/50 focus:bg-white/8 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/60">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-white/6 border border-white/12 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-400/50 focus:bg-white/8 transition-colors appearance-none"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value} className="bg-[#1a1a1a]">{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Documents */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-white/60">
                Source Documents
              </label>
              <span className="text-[10px] text-white/30">
                {selectedDocIds.length}/{MAX_DOCS} selected
              </span>
            </div>

            {isLoadingDocs ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <p className="text-xs text-white/30 italic py-2">No documents yet. Paste content below.</p>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-white/8 p-2">
                {documents.map((doc) => {
                  const isSelected = selectedDocIds.includes(doc.id);
                  const isDisabled = !isSelected && selectedDocIds.length >= MAX_DOCS;
                  return (
                    <label
                      key={doc.id}
                      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-500/15 text-indigo-200'
                          : isDisabled
                          ? 'opacity-40 cursor-not-allowed text-white/50'
                          : 'hover:bg-white/6 text-white/60 hover:text-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => !isDisabled && toggleDoc(doc.id)}
                        className="w-3.5 h-3.5 rounded accent-indigo-500 shrink-0"
                      />
                      <span className="text-xs truncate">{doc.title}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* External content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-white/60">
                Additional Content (optional)
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isExtractingFile}
                className="flex items-center gap-1.5 text-[10px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
              >
                {isExtractingFile ? (
                  <>
                    <div className="w-3 h-3 border border-indigo-400/50 border-t-indigo-400 rounded-full animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload PDF/TXT
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {uploadedFileName && (
              <div className="flex items-center gap-1.5 text-[10px] text-indigo-300">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {uploadedFileName} extracted
              </div>
            )}

            <textarea
              value={externalText}
              onChange={(e) => setExternalText(e.target.value.slice(0, MAX_CHARS))}
              placeholder="Paste notes, text, or upload a PDF above..."
              rows={4}
              className="w-full bg-white/6 border border-white/12 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-indigo-400/50 focus:bg-white/8 transition-colors resize-none"
            />
            <div className="text-right text-[10px] text-white/25">
              {externalText.length.toLocaleString()}/{MAX_CHARS.toLocaleString()} chars
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 shrink-0 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/8 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 hover:border-indigo-400/50 text-indigo-300 hover:text-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? (
              <>
                <div className="w-3.5 h-3.5 border border-indigo-400/50 border-t-indigo-300 rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
