'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface CreateDocumentInput {
  prompt: string;
  templateId: string;
  specs: { pages: number; density: 'compact' | 'balanced' | 'spacious'; language: string } | null;
  files: File[];
}

interface Props {
  mode?: 'landing' | 'app';
  onSubmit: (data: CreateDocumentInput) => void | Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  placeholder?: string;
  autoFocus?: boolean;
  submitLabel?: string;
  initialTemplateId?: string;
  /** Controlled: when this changes, the internal templateId updates */
  selectedTemplateId?: string;
  /** Called whenever the user picks a different template */
  onTemplateChange?: (templateId: string) => void;
}

// F2-M7.1: Only 4 active templates shown in the creation bar.
// Inactive templates (cornell, problem_solving, zettelkasten,
// academic_paper, lab_report, data_analysis) are hidden in the UI
// and marked is_active = false in the DB — not deleted.
const TEMPLATES = [
  { id: '2cols_portrait',       displayName: '2-Col Portrait',    isPro: false },
  { id: 'landscape_3col_maths', displayName: '3-Col Landscape',   isPro: false },
  { id: 'study_form',           displayName: '3-Col Portrait',    isPro: false },
  { id: 'lecture_notes',        displayName: 'Long Notes',        isPro: false },
];

export function DocumentCreationBar({
  mode = 'app',
  onSubmit,
  isLoading = false,
  error = null,
  placeholder = 'Describe the document you want to create...',
  autoFocus = false,
  submitLabel,
  initialTemplateId,
  selectedTemplateId,
  onTemplateChange,
}: Props) {
  const [prompt, setPrompt]   = useState('');
  const [templateId, setTemplateId] = useState(initialTemplateId ?? '2cols_portrait');
  const [pages, setPages]     = useState(2);
  const [density, setDensity] = useState<'compact' | 'balanced' | 'spacious'>('balanced');
  const [language, setLanguage] = useState('auto');
  const [files, setFiles]     = useState<File[]>([]);
  const [openPanel, setOpenPanel] = useState<'template' | 'specs' | null>(null);
  // Specs are only "active" after the user explicitly clicks Apply
  const [specsApplied, setSpecsApplied] = useState(false);

  const barRef         = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const templateBtnRef = useRef<HTMLButtonElement>(null);
  const specsBtnRef    = useRef<HTMLButtonElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left?: number; right?: number } | null>(null);

  const selectedTemplate = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];
  const label = submitLabel ?? 'Build now';

  useEffect(() => {
    if (autoFocus && textareaRef.current) textareaRef.current.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (selectedTemplateId) setTemplateId(selectedTemplateId);
  }, [selectedTemplateId]);

  // Close panels on outside click (ignore clicks inside the portal popovers)
  useEffect(() => {
    if (!openPanel) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      const inBar = barRef.current?.contains(target);
      const inPortal = (target as Element)?.closest?.('[data-creation-popover]');
      if (!inBar && !inPortal) {
        setOpenPanel(null);
        setPopoverPos(null);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [openPanel]);

  // Auto-resize textarea
  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setPrompt(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleSubmit() {
    if (!prompt.trim() || isLoading) return;
    onSubmit({
      prompt: prompt.trim(),
      templateId,
      specs: specsApplied ? { pages, density, language } : null,
      files,
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...selected]);
    e.target.value = '';
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function calcPos(btnRef: React.RefObject<HTMLButtonElement | null>, align: 'left' | 'right') {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const gap = 8;
    const base = { top: rect.top - gap };
    return align === 'left'
      ? { ...base, left: rect.left }
      : { ...base, right: window.innerWidth - rect.right };
  }

  // Template panel: simple toggle
  function toggleTemplate() {
    if (openPanel === 'template') {
      setOpenPanel(null);
      setPopoverPos(null);
    } else {
      setPopoverPos(calcPos(templateBtnRef, 'left'));
      setOpenPanel('template');
    }
  }

  // Specs button:
  //   - if already applied → deselect (clear applied, close panel)
  //   - if not applied → open/close popover
  function toggleSpecs() {
    if (specsApplied) {
      setSpecsApplied(false);
      setOpenPanel(null);
      setPopoverPos(null);
    } else if (openPanel === 'specs') {
      setOpenPanel(null);
      setPopoverPos(null);
    } else {
      setPopoverPos(calcPos(specsBtnRef, 'right'));
      setOpenPanel('specs');
    }
  }

  function applySpecs() {
    setSpecsApplied(true);
    setOpenPanel(null);
    setPopoverPos(null);
  }

  const canSubmit     = prompt.trim().length > 0 && !isLoading;
  const specsActive   = specsApplied || openPanel === 'specs';

  // Portal popovers
  const templatePopover = openPanel === 'template' && popoverPos && typeof window !== 'undefined'
    ? createPortal(
        <div
          data-creation-popover
          style={{ position: 'fixed', top: popoverPos.top, left: popoverPos.left, zIndex: 9999, transform: 'translateY(-100%)' }}
          className="w-72 rounded-2xl border border-white/15 bg-neutral-900/95 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] p-3"
        >
          <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto">
            {TEMPLATES.map((t) => {
              const isSelected = t.id === templateId;
              return (
                <button
                  key={t.id}
                  onClick={() => { setTemplateId(t.id); onTemplateChange?.(t.id); setOpenPanel(null); setPopoverPos(null); }}
                  className={`relative text-left rounded-xl border px-2.5 py-2 text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-white'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />}
                    <span className="leading-snug">{t.displayName}</span>
                  </div>
                  {t.isPro && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-1 py-px">
                      Pro
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )
    : null;

  const specsPopover = openPanel === 'specs' && popoverPos && typeof window !== 'undefined'
    ? createPortal(
        <div
          data-creation-popover
          style={{ position: 'fixed', top: popoverPos.top, right: popoverPos.right, zIndex: 9999, transform: 'translateY(-100%)' }}
          className="w-64 rounded-2xl border border-white/15 bg-neutral-900/95 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] p-4"
        >
          {/* Pages */}
          <div className="mb-4">
            <p className="text-xs font-medium text-white/60 mb-2">Pages</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPages((p) => Math.max(1, p - 1))}
                disabled={pages <= 1}
                className="w-7 h-7 rounded-lg border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-base font-bold text-white w-4 text-center tabular-nums">{pages}</span>
              <button
                onClick={() => setPages((p) => Math.min(10, p + 1))}
                disabled={pages >= 10}
                className="w-7 h-7 rounded-lg border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <span className="text-xs text-white/30">1 – 10</span>
            </div>
          </div>

          {/* Density */}
          <div className="mb-4">
            <p className="text-xs font-medium text-white/60 mb-2">Density</p>
            <div className="flex gap-1">
              {(['compact', 'balanced', 'spacious'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDensity(d)}
                  className={`flex-1 text-xs py-1.5 rounded-lg border capitalize transition-all ${
                    density === d
                      ? 'bg-indigo-500/25 text-indigo-300 border-indigo-500/40'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="mb-4">
            <p className="text-xs font-medium text-white/60 mb-2">Language</p>
            <div className="flex flex-wrap gap-1">
              {[
                { value: 'auto', label: 'Auto'     },
                { value: 'en',   label: 'English'  },
                { value: 'es',   label: 'Español'  },
                { value: 'fr',   label: 'Français' },
                { value: 'de',   label: 'Deutsch'  },
              ].map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => setLanguage(lang.value)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                    language === lang.value
                      ? 'bg-indigo-500/25 text-indigo-300 border-indigo-500/40'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Apply button */}
          <button
            onClick={applySpecs}
            className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400
              text-white text-xs font-semibold py-2 rounded-xl shadow-[0_2px_8px_rgba(99,102,241,0.35)] transition-all"
          >
            Apply
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {templatePopover}
      {specsPopover}

      <div ref={barRef}>
      {/* Main bar — two rows */}
      <div
        className={`rounded-2xl border backdrop-blur-xl shadow-[0_4px_32px_rgba(0,0,0,0.3)] transition-colors ${
          openPanel
            ? 'border-indigo-500/40 bg-white/[0.09]'
            : 'border-white/15 bg-white/[0.07]'
        }`}
      >
        {/* Row 1: textarea */}
        <div className="px-4 pt-3 pb-2">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="w-full bg-transparent text-white/90 text-sm placeholder-white/30 resize-none focus:outline-none min-h-[36px] max-h-[160px] leading-snug"
          />
        </div>

        {/* Separator */}
        <div className="h-px bg-white/10 mx-3" />

        {/* Row 2: actions */}
        <div className="flex items-center gap-0.5 px-2 py-2">
          {/* Attach button — app mode only */}
          {mode === 'app' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Attach files"
                className="relative w-8 h-8 rounded-xl flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                {files.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {files.length}
                  </span>
                )}
              </button>
            </>
          )}

          {/* Template button */}
          <button
            ref={templateBtnRef}
            onClick={toggleTemplate}
            title="Choose template"
            className={`h-8 px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-all max-w-[160px] ${
              openPanel === 'template'
                ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300'
                : 'text-white/60 hover:bg-white/10 hover:text-white/80'
            }`}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="truncate">{selectedTemplate.displayName}</span>
          </button>

          {/* Specs button */}
          <button
            ref={specsBtnRef}
            onClick={toggleSpecs}
            title={specsApplied ? 'Specs applied — click to clear' : 'Document specs'}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
              specsActive
                ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300'
                : 'text-white/50 hover:bg-white/10 hover:text-white/80'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white text-xs font-semibold h-8 px-4 rounded-xl shadow-[0_2px_8px_rgba(99,102,241,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 whitespace-nowrap"
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Building...</span>
              </>
            ) : (
              <>
                <span>{label}</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Files preview */}
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 bg-white/[0.06] border border-white/10 rounded-xl px-2.5 py-1 text-xs text-white/70"
            >
              <svg className="w-3 h-3 shrink-0 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="max-w-[140px] truncate">{file.name}</span>
              <button
                onClick={() => removeFile(i)}
                className="text-white/40 hover:text-white/80 transition-colors ml-0.5"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-2 text-xs text-red-400 bg-red-950/30 border border-red-900/30 rounded-xl px-3 py-2">
          {error}
        </div>
      )}
      </div>
    </>
  );
}
