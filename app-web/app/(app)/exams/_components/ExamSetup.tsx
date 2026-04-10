'use client';

import { useState, useEffect, useRef } from 'react';
import type { ExamLevel, ExamQuestionType } from '../_types';

export interface CognitiveDistribution {
  memory: number;
  logic: number;
  application: number;
}

export interface ExamSetupValues {
  subject: string;
  level: ExamLevel;
  questionCount: number;
  formats: ExamQuestionType[];
  formatCounts: Partial<Record<ExamQuestionType, number>>;
  language: string;
  documentIds: string[];
  externalContent: string;
  timerEnabled: boolean;
  timerMinutes: number;
  gradingMode: 'strict' | 'partial';
  cognitiveDistribution?: CognitiveDistribution;
}

interface ExamSetupProps {
  onSubmit: (values: ExamSetupValues) => void;
  isLoading: boolean;
  error: string | null;
  onClose?: () => void;
}

interface DocumentItem {
  id: string;
  title: string;
}

const TIERS: { value: string; label: string; description: string }[] = [
  { value: 'secondary', label: 'Secondary', description: 'Middle school level' },
  { value: 'highschool', label: 'High School', description: 'Pre-university level' },
  { value: 'university', label: 'University', description: 'Higher education level' },
];

const DIFFICULTIES: { value: string; label: string; description: string }[] = [
  { value: 'basic', label: 'Basic', description: 'Core concepts' },
  { value: 'intermediate', label: 'Intermediate', description: 'Applied knowledge' },
  { value: 'advanced', label: 'Advanced', description: 'Deep mastery' },
];

const LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'spanish', label: 'Español' },
  { value: 'catalan', label: 'Català' },
  { value: 'french', label: 'Français' },
  { value: 'german', label: 'Deutsch' },
  { value: 'portuguese', label: 'Português' },
  { value: 'italian', label: 'Italiano' },
];

const FORMAT_OPTIONS: { value: ExamQuestionType; label: string; description: string }[] = [
  { value: 'multiple_choice', label: 'Multiple Choice', description: 'Pick one of 4 options' },
  { value: 'true_false', label: 'True / False', description: 'Evaluate statements' },
  { value: 'fill_in', label: 'Fill in the Blank', description: 'Write the answer' },
  { value: 'flashcard', label: 'Flashcards', description: 'Flip card — question & answer' },
];

const ACCEPTED_TYPES = '.pdf,.txt,.md';
const MAX_CHARS = 18000; // ~4500 tokens

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
  // TXT / MD
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(((e.target?.result as string) ?? '').slice(0, MAX_CHARS));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function autoDistribute(total: number, fmts: ExamQuestionType[]): Partial<Record<ExamQuestionType, number>> {
  if (fmts.length === 0) return {};
  const base = Math.floor(total / fmts.length);
  const remainder = total % fmts.length;
  return Object.fromEntries(fmts.map((t, i) => [t, base + (i < remainder ? 1 : 0)]));
}

export default function ExamSetup({ onSubmit, isLoading, error, onClose }: ExamSetupProps) {
  const [subject, setSubject] = useState('');
  const [tier, setTier] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('');
  const level = (tier && difficulty ? `${tier}_${difficulty}` : '') as ExamLevel;
  const [questionCount, setQuestionCount] = useState(10);
  const [questionCountInput, setQuestionCountInput] = useState('10');
  const [formats, setFormats] = useState<ExamQuestionType[]>(['multiple_choice']);
  const [formatCounts, setFormatCounts] = useState<Partial<Record<ExamQuestionType, number>>>({ multiple_choice: 10 });
  const [language, setLanguage] = useState('english');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Document picker state
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);

  // Timer state
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(30);
  const [timerMinutesInput, setTimerMinutesInput] = useState('30');

  // Advanced state
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [cogEnabled, setCogEnabled] = useState(false);
  const [cogDist, setCogDist] = useState<CognitiveDistribution>({ memory: 0, logic: 0, application: 0 });

  const cogTotal = cogDist.memory + cogDist.logic + cogDist.application;
  const isCogBalanced = !cogEnabled || cogTotal === questionCount;

  function enableCog() {
    const base = Math.floor(questionCount / 3);
    const rem = questionCount % 3;
    setCogDist({ memory: base + (rem > 0 ? 1 : 0), logic: base + (rem > 1 ? 1 : 0), application: base });
    setCogEnabled(true);
  }

  // Grading mode state
  const [gradingMode, setGradingMode] = useState<'strict' | 'partial'>('strict');

  // External content state
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [externalContent, setExternalContent] = useState('');
  const [fileExtracting, setFileExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // When total changes, redistribute
  useEffect(() => {
    setFormatCounts(autoDistribute(questionCount, formats));
  }, [questionCount]);

  // Load documents on mount
  useEffect(() => {
    setDocsLoading(true);
    fetch('/api/documents')
      .then((r) => r.ok ? r.json() : { documents: [] })
      .then((data) => setDocuments((data as { documents: DocumentItem[] }).documents ?? []))
      .catch(() => setDocsError('Could not load documents.'))
      .finally(() => setDocsLoading(false));
  }, []);

  function toggleDoc(id: string) {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileExtracting(true);
    try {
      const text = await extractFileText(file);
      setExternalContent((prev) => (prev ? `${prev}\n\n${text}` : text));
      setUploadedFileName(file.name);
    } catch {
      // silently ignore
    } finally {
      setFileExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const hasDocuments = selectedDocIds.length > 0 || !!externalContent;

  const assignedTotal = formats.reduce((sum, f) => sum + (formatCounts[f] ?? 0), 0);
  const isBalanced = assignedTotal === questionCount;

  function handleTotalChange(raw: string) {
    setQuestionCountInput(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1 && n <= 50) {
      setQuestionCount(n);
    }
  }

  function handleTotalBlur() {
    const n = parseInt(questionCountInput, 10);
    if (isNaN(n) || n < 1) {
      setQuestionCountInput('1');
      setQuestionCount(1);
    } else if (n > 50) {
      setQuestionCountInput('50');
      setQuestionCount(50);
    } else {
      setQuestionCountInput(String(n));
    }
  }

  function toggleFormat(fmt: ExamQuestionType) {
    // Flashcards is mutually exclusive with all other types
    if (fmt === 'flashcard') {
      if (formats.includes('flashcard')) return; // already only flashcard, keep it
      const next: ExamQuestionType[] = ['flashcard'];
      setFormats(next);
      setFormatCounts(autoDistribute(questionCount, next));
      return;
    }
    // Selecting a non-flashcard format while flashcard is active → switch to this format
    if (formats.includes('flashcard')) {
      const next: ExamQuestionType[] = [fmt];
      setFormats(next);
      setFormatCounts(autoDistribute(questionCount, next));
      return;
    }
    // Normal toggle for non-flashcard formats
    const next = formats.includes(fmt)
      ? formats.filter((f) => f !== fmt)
      : [...formats, fmt];
    if (next.length === 0) return;
    setFormats(next);
    setFormatCounts(autoDistribute(questionCount, next));
  }

  function changeFormatCount(fmt: ExamQuestionType, delta: number) {
    setFormatCounts((prev) => {
      const current = prev[fmt] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [fmt]: next };
    });
  }

  function handleFormatCountInput(fmt: ExamQuestionType, raw: string) {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 0) {
      setFormatCounts((prev) => ({ ...prev, [fmt]: n }));
    } else if (raw === '') {
      setFormatCounts((prev) => ({ ...prev, [fmt]: 0 }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    const subjectTrimmed = subject.trim();

    // Subject is required only when no documents are selected
    if (!hasDocuments && !subjectTrimmed) {
      setValidationError('Please enter a subject or topic, or select at least one document.');
      return;
    }
    if (!tier || !difficulty) {
      setValidationError('Please select a difficulty level.');
      return;
    }
    if (formats.length === 0) {
      setValidationError('Please select at least one question format.');
      return;
    }
    if (!isBalanced) {
      setValidationError(`Assigned questions (${assignedTotal}) must equal total (${questionCount}).`);
      return;
    }
    onSubmit({
      subject: subjectTrimmed,
      level,
      questionCount,
      formats,
      formatCounts,
      language,
      documentIds: selectedDocIds,
      externalContent,
      timerEnabled,
      timerMinutes,
      gradingMode,
      cognitiveDistribution: cogEnabled ? cogDist : undefined,
    });
  }

  const displayError = validationError ?? error;

  const formContent = (
    <div className={onClose ? 'px-6 py-5' : 'max-w-xl mx-auto px-4 py-10'}>
      {/* Page heading — only shown outside modal */}
      {!onClose && (
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-500/15 border border-indigo-500/25 shrink-0">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-4.5A3.375 3.375 0 0012.75 9h-1.5A3.375 3.375 0 007.875 12.375v1.5m4.125 4.875v-1.5m0 0h-4.5m4.5 0V15M3 9.375C3 8.339 3.84 7.5 4.875 7.5h14.25C20.16 7.5 21 8.34 21 9.375v7.5C21 17.909 20.16 18.75 19.125 18.75H4.875C3.839 18.75 3 17.91 3 16.875v-7.5z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Generate Exam</h2>
            <p className="text-xs text-white/45 mt-0.5">Configure your practice exam below</p>
          </div>
        </div>
      )}

      <form id="exam-setup-form" onSubmit={handleSubmit} className="space-y-6">

        {/* Subject + Language row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Subject / Topic
              {hasDocuments && <span className="ml-2 text-xs font-normal text-white/35">optional</span>}
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={hasDocuments ? 'Optional focus area' : 'e.g. Linear Algebra...'}
              disabled={isLoading}
              className="w-full bg-neutral-800 border border-white/12 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isLoading}
              className="w-full bg-neutral-800 border border-white/12 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value} className="bg-neutral-800">{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Source Documents */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-white/80">
              Source Documents
              <span className="ml-2 text-xs font-normal text-white/35">optional</span>
            </label>
            <span className="text-xs text-white/35">{selectedDocIds.length} selected</span>
          </div>
          {docsLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-4 h-4 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin" />
            </div>
          ) : docsError ? (
            <p className="text-xs text-red-400/80 italic py-2">{docsError}</p>
          ) : documents.length === 0 ? (
            <p className="text-xs text-white/30 italic py-2">No documents yet. Paste content below.</p>
          ) : (
            <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-white/8 p-2">
              {documents.map((doc) => {
                const isSelected = selectedDocIds.includes(doc.id);
                return (
                  <label
                    key={doc.id}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-500/15 text-indigo-200'
                        : 'hover:bg-white/6 text-white/60 hover:text-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDoc(doc.id)}
                      className="w-3.5 h-3.5 rounded accent-indigo-500 shrink-0"
                    />
                    <span className="text-xs truncate">{doc.title}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Additional Content */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-white/80">
              Additional Content
              <span className="ml-2 text-xs font-normal text-white/35">optional</span>
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || fileExtracting}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
            >
              {fileExtracting ? (
                <>
                  <div className="w-3 h-3 border border-indigo-400/50 border-t-indigo-400 rounded-full animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
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
              onChange={handleFileChange}
            />
          </div>
          {uploadedFileName && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-300 mb-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {uploadedFileName} extracted
            </div>
          )}
          <textarea
            value={externalContent}
            onChange={(e) => setExternalContent(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Paste notes, text, or upload a PDF above..."
            rows={3}
            disabled={isLoading}
            className="w-full bg-neutral-800 border border-white/12 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-500/50 transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="text-right text-xs text-white/30 mt-1">
            {externalContent.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} chars
          </div>
        </div>

        {/* Difficulty level — two-step: tier then difficulty */}
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Difficulty Level
          </label>

          {/* Step 1: Tier cards */}
          <div className="grid grid-cols-3 gap-2">
            {TIERS.map((t) => {
              const isSelected = tier === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setTier(t.value);
                    if (!difficulty) setDifficulty('intermediate');
                  }}
                  disabled={isLoading}
                  className={`rounded-xl border px-3 py-3 text-left transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                    ${isSelected
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                      : 'bg-white/4 border-white/10 text-white/60 hover:bg-white/7 hover:border-white/20 hover:text-white/80'
                    }`}
                >
                  <p className={`text-xs font-semibold ${isSelected ? 'text-indigo-300' : ''}`}>
                    {t.label}
                  </p>
                  <p className="text-[10px] text-white/40 mt-0.5">{t.description}</p>
                </button>
              );
            })}
          </div>

          {/* Step 2: Difficulty buttons — appear once a tier is selected */}
          {tier && (
            <div className="flex gap-2 mt-2">
              {DIFFICULTIES.map((d) => {
                const isSelected = difficulty === d.value;
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDifficulty(d.value)}
                    disabled={isLoading}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-left transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                      ${isSelected
                        ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                        : 'bg-white/4 border-white/10 text-white/60 hover:bg-white/7 hover:border-white/20 hover:text-white/80'
                      }`}
                  >
                    <p className={`text-xs font-semibold ${isSelected ? 'text-indigo-300' : ''}`}>
                      {d.label}
                    </p>
                    <p className="text-[10px] text-white/40 mt-0.5">{d.description}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Total questions */}
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Number of Questions
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { const n = Math.max(1, questionCount - 1); setQuestionCount(n); setQuestionCountInput(String(n)); }}
              disabled={isLoading || questionCount <= 1}
              className="w-9 h-9 rounded-xl border border-white/12 bg-white/10 text-white/60 hover:bg-white/15 hover:text-white
                disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-lg leading-none"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={50}
              value={questionCountInput}
              onChange={(e) => handleTotalChange(e.target.value)}
              onBlur={handleTotalBlur}
              disabled={isLoading}
              className="w-20 text-center bg-white/10 border border-white/12 rounded-xl px-3 py-2 text-sm font-semibold text-white
                focus:outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-50
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => { const n = Math.min(50, questionCount + 1); setQuestionCount(n); setQuestionCountInput(String(n)); }}
              disabled={isLoading || questionCount >= 50}
              className="w-9 h-9 rounded-xl border border-white/12 bg-white/10 text-white/60 hover:bg-white/15 hover:text-white
                disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-lg leading-none"
            >
              +
            </button>
            <span className="text-xs text-white/35">max 50</span>
          </div>
        </div>

        {/* Question formats + per-type counts */}
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Question Formats
          </label>
          <div className="space-y-2">
            {FORMAT_OPTIONS.map((fmt) => {
              const isChecked = formats.includes(fmt.value);
              const count = formatCounts[fmt.value] ?? 0;
              return (
                <div
                  key={fmt.value}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-150
                    ${isChecked
                      ? 'bg-indigo-500/10 border-indigo-500/35 text-white'
                      : 'bg-white/4 border-white/10 text-white/40'
                    }`}
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleFormat(fmt.value)}
                    disabled={isLoading || (isChecked && formats.length === 1)}
                    className="shrink-0 disabled:cursor-not-allowed"
                  >
                    <span className={`w-4 h-4 rounded flex items-center justify-center border transition-colors
                      ${isChecked ? 'bg-indigo-500 border-indigo-500' : 'border-white/25 bg-transparent'}`}>
                      {isChecked && (
                        <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                  </button>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{fmt.label}</p>
                    <p className="text-[11px] text-white/40">{fmt.description}</p>
                  </div>

                  {/* Count stepper — only when format is active */}
                  {isChecked && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => changeFormatCount(fmt.value, -1)}
                        disabled={isLoading || count <= 0}
                        className="w-6 h-6 rounded-lg border border-white/15 bg-white/10 text-white/60 hover:bg-white/15 hover:text-white
                          disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-sm leading-none"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={questionCount}
                        value={count}
                        onChange={(e) => handleFormatCountInput(fmt.value, e.target.value)}
                        disabled={isLoading}
                        className="w-10 text-center bg-white/10 border border-white/15 rounded-lg py-1 text-sm font-semibold text-white
                          focus:outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-50
                          [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => changeFormatCount(fmt.value, 1)}
                        disabled={isLoading || assignedTotal >= questionCount}
                        className="w-6 h-6 rounded-lg border border-white/15 bg-white/10 text-white/60 hover:bg-white/15 hover:text-white
                          disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-sm leading-none"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sum indicator — only show when multiple formats */}
          {formats.length > 1 && (
            <div className={`mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm
              ${isBalanced
                ? 'bg-green-500/8 border-green-500/25 text-green-400'
                : 'bg-indigo-500/8 border-indigo-500/25 text-indigo-400'
              }`}
            >
              {isBalanced ? (
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              )}
              <span>
                {assignedTotal} / {questionCount} questions assigned
                {!isBalanced && (
                  <span className="ml-1 text-indigo-500/70">
                    ({assignedTotal < questionCount ? `${questionCount - assignedTotal} remaining` : `${assignedTotal - questionCount} over`})
                  </span>
                )}
              </span>
              {!isBalanced && (
                <button
                  type="button"
                  onClick={() => setFormatCounts(autoDistribute(questionCount, formats))}
                  className="ml-auto text-xs underline underline-offset-2 text-indigo-400/70 hover:text-indigo-300 transition-colors"
                >
                  Auto-distribute
                </button>
              )}
            </div>
          )}
        </div>

        {/* Fill-in grading mode — only when fill_in is selected */}
        {formats.includes('fill_in') && (
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Fill-in Grading
            </label>
            <div className="flex gap-2">
              {([
                { value: 'strict', label: 'Strict', desc: 'Partial credit counts as 0' },
                { value: 'partial', label: 'Partial Credit', desc: 'AI scores each answer 0–100%' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGradingMode(opt.value)}
                  disabled={isLoading}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-left transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                    ${gradingMode === opt.value
                      ? 'bg-indigo-500/15 border-indigo-500/40'
                      : 'bg-white/4 border-white/10 hover:bg-white/7 hover:border-white/20'
                    }`}
                >
                  <p className={`text-sm font-medium ${gradingMode === opt.value ? 'text-indigo-300' : 'text-white/60'}`}>{opt.label}</p>
                  <p className="text-xs text-white/35 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Timer */}
        <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <svg className="w-4 h-4 text-white/40 self-center" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
              <span className="text-sm font-medium text-white/70">Exam Timer</span>
              <span className="text-xs text-white/35">optional</span>
            </div>
            {/* Toggle */}
            <button
              type="button"
              onClick={() => setTimerEnabled((t) => !t)}
              disabled={isLoading}
              className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 disabled:opacity-50 focus:outline-none ${
                timerEnabled ? 'bg-indigo-500' : 'bg-white/15'
              }`}
              style={{ height: '22px' }}
              aria-checked={timerEnabled}
              role="switch"
            >
              <span
                className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  timerEnabled ? 'translate-x-[18px]' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {timerEnabled && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs text-white/45 shrink-0">Duration</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const n = Math.max(1, timerMinutes - 5);
                    setTimerMinutes(n);
                    setTimerMinutesInput(String(n));
                  }}
                  disabled={isLoading || timerMinutes <= 1}
                  className="w-7 h-7 rounded-lg border border-white/12 bg-white/10 text-white/60 hover:bg-white/15 hover:text-white
                    disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-sm leading-none"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={timerMinutesInput}
                  onChange={(e) => {
                    setTimerMinutesInput(e.target.value);
                    const n = parseInt(e.target.value, 10);
                    if (!isNaN(n) && n >= 1 && n <= 180) setTimerMinutes(n);
                  }}
                  onBlur={() => {
                    const n = parseInt(timerMinutesInput, 10);
                    const clamped = isNaN(n) ? 30 : Math.min(180, Math.max(1, n));
                    setTimerMinutes(clamped);
                    setTimerMinutesInput(String(clamped));
                  }}
                  disabled={isLoading}
                  className="w-16 text-center bg-white/10 border border-white/12 rounded-lg px-2 py-1.5 text-sm font-semibold text-white
                    focus:outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-50
                    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const n = Math.min(180, timerMinutes + 5);
                    setTimerMinutes(n);
                    setTimerMinutesInput(String(n));
                  }}
                  disabled={isLoading || timerMinutes >= 180}
                  className="w-7 h-7 rounded-lg border border-white/12 bg-white/10 text-white/60 hover:bg-white/15 hover:text-white
                    disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-sm leading-none"
                >
                  +
                </button>
                <span className="text-xs text-white/40">min</span>
              </div>
            </div>
          )}
        </div>

        {/* Advanced */}
        <div className="rounded-xl border border-white/10 bg-white/3 overflow-hidden">
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            disabled={isLoading}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/3 transition-colors disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              <span className="text-sm font-medium text-white/70">Advanced</span>
              {cogEnabled && cogTotal === questionCount && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 font-medium">Cognitive mix on</span>
              )}
            </div>
            <svg
              className={`w-4 h-4 text-white/30 transition-transform duration-200 ${advancedOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {advancedOpen && (
            <div className="border-t border-white/8 px-4 pb-4 pt-4 space-y-4">
              {/* Toggle row */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80">Cognitive Distribution</p>
                  <p className="text-xs text-white/35 mt-0.5">Control the mental effort mix required</p>
                </div>
                <button
                  type="button"
                  onClick={() => { if (cogEnabled) { setCogEnabled(false); } else { enableCog(); } }}
                  disabled={isLoading}
                  className={`relative w-10 rounded-full transition-colors duration-200 shrink-0 disabled:opacity-50 focus:outline-none ${
                    cogEnabled ? 'bg-indigo-500' : 'bg-white/15'
                  }`}
                  style={{ height: '22px' }}
                  aria-checked={cogEnabled}
                  role="switch"
                >
                  <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    cogEnabled ? 'translate-x-[18px]' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {cogEnabled && (
                <div className="space-y-3">
                  {/* Stacked bar */}
                  <div className="h-1.5 rounded-full overflow-hidden flex gap-px">
                    <div style={{ width: `${questionCount > 0 ? cogDist.memory / questionCount * 100 : 0}%` }} className="bg-indigo-400 transition-all duration-300 rounded-l-full" />
                    <div style={{ width: `${questionCount > 0 ? cogDist.logic / questionCount * 100 : 0}%` }} className="bg-violet-400 transition-all duration-300" />
                    <div style={{ width: `${questionCount > 0 ? cogDist.application / questionCount * 100 : 0}%` }} className="bg-sky-400 transition-all duration-300 rounded-r-full" />
                  </div>

                  {/* Rows */}
                  {([
                    { key: 'memory' as const, label: 'Memory', desc: 'Recall facts, definitions, concepts', dot: 'bg-indigo-400' },
                    { key: 'logic' as const, label: 'Logic', desc: 'Deduction, reasoning, cause-effect', dot: 'bg-violet-400' },
                    { key: 'application' as const, label: 'Application', desc: 'Real cases, problem-solving', dot: 'bg-sky-400' },
                  ]).map(({ key, label, desc, dot }) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/75">{label}</p>
                        <p className="text-[11px] text-white/35">{desc}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCogDist((p) => ({ ...p, [key]: Math.max(0, p[key] - 1) }))}
                          disabled={isLoading || cogDist[key] <= 0}
                          className="w-6 h-6 rounded-lg border border-white/12 bg-white/8 text-white/50 hover:bg-white/14 hover:text-white
                            disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-sm leading-none"
                        >−</button>
                        <span className="w-8 text-center text-sm font-semibold text-white tabular-nums">
                          {cogDist[key]}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCogDist((p) => ({ ...p, [key]: Math.min(questionCount, p[key] + 1) }))}
                          disabled={isLoading || cogDist[key] >= questionCount}
                          className="w-6 h-6 rounded-lg border border-white/12 bg-white/8 text-white/50 hover:bg-white/14 hover:text-white
                            disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-sm leading-none"
                        >+</button>
                      </div>
                    </div>
                  ))}

                  {/* Sum indicator */}
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm
                    ${isCogBalanced
                      ? 'bg-green-500/8 border-green-500/25 text-green-400'
                      : 'bg-indigo-500/8 border-indigo-500/25 text-indigo-400'
                    }`}
                  >
                    {isCogBalanced ? (
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                    )}
                    <span>
                      {cogTotal} / {questionCount} questions assigned
                      {!isCogBalanced && (
                        <span className="ml-1 text-indigo-500/70">
                          ({cogTotal < questionCount ? `${questionCount - cogTotal} remaining` : `${cogTotal - questionCount} over`})
                        </span>
                      )}
                    </span>
                    {!isCogBalanced && (
                      <button
                        type="button"
                        onClick={enableCog}
                        className="ml-auto text-xs underline underline-offset-2 text-indigo-400/70 hover:text-indigo-300 transition-colors"
                      >
                        Auto-distribute
                      </button>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Error */}
        {displayError && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-400">{displayError}</p>
          </div>
        )}

        {/* Submit — only shown outside modal */}
        {!onClose && (
          <button
            type="submit"
            disabled={isLoading || !isBalanced || !isCogBalanced || !tier || !difficulty}
            className="w-full rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:bg-indigo-500/40
              text-black font-semibold text-sm py-3 transition-colors duration-150 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
                Generating your exam...
              </span>
            ) : (
              'Generate Exam'
            )}
          </button>
        )}
      </form>
    </div>
  );

  if (!onClose) return formContent;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* Modal */}
      <div className="relative z-10 w-full max-w-xl bg-[#1a1a1a] border border-white/15 rounded-2xl shadow-2xl shadow-black/50 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-500/15 border border-indigo-500/20">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-4.5A3.375 3.375 0 0012.75 9h-1.5A3.375 3.375 0 007.875 12.375v1.5m4.125 4.875v-1.5m0 0h-4.5m4.5 0V15M3 9.375C3 8.339 3.84 7.5 4.875 7.5h14.25C20.16 7.5 21 8.34 21 9.375v7.5C21 17.909 20.16 18.75 19.125 18.75H4.875C3.839 18.75 3 17.91 3 16.875v-7.5z"
                />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-white">New Exam</h2>
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
        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {formContent}
        </div>
        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 shrink-0 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/8 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="exam-setup-form"
            disabled={isLoading || !isBalanced || !isCogBalanced || !tier || !difficulty}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 hover:border-indigo-400/50 text-indigo-300 hover:text-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border border-indigo-400/50 border-t-indigo-300 rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
