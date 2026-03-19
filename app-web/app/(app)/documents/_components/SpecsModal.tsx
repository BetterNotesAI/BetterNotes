'use client';

import { useState } from 'react';
import { DocumentSpecs, LocalAttachment } from '../_types';
import { AttachmentDropzone } from './AttachmentDropzone';

interface SpecsModalProps {
  template: { id: string; displayName: string; description: string };
  onConfirm: (specs: DocumentSpecs) => void;
  onBack: () => void;
  isLoading: boolean;
  attachments: LocalAttachment[];
  onAddAttachment: (file: File) => Promise<void>;
  onRemoveAttachment: (index: number) => void;
  isUploadingAttachment: boolean;
  uploadError: string | null;
}

const DENSITY_OPTIONS: { value: DocumentSpecs['density']; label: string; desc: string }[] = [
  { value: 'compact', label: 'Compact', desc: 'More content, tighter spacing' },
  { value: 'balanced', label: 'Balanced', desc: 'Comfortable reading density' },
  { value: 'spacious', label: 'Spacious', desc: 'Open layout, easier to annotate' },
];

const LANGUAGE_OPTIONS: { value: DocumentSpecs['language']; label: string }[] = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
];

const MAX_TOPIC_HINT = 200;

export function SpecsModal({
  template,
  onConfirm,
  onBack,
  isLoading,
  attachments,
  onAddAttachment,
  onRemoveAttachment,
  isUploadingAttachment,
  uploadError,
}: SpecsModalProps) {
  const [pages, setPages] = useState<number>(2);
  const [density, setDensity] = useState<DocumentSpecs['density']>('balanced');
  const [language, setLanguage] = useState<DocumentSpecs['language']>('auto');
  const [topicHint, setTopicHint] = useState<string>('');

  function decrement() {
    setPages((p) => Math.max(1, p - 1));
  }

  function increment() {
    setPages((p) => Math.min(10, p + 1));
  }

  function handleConfirm() {
    const specs: DocumentSpecs = {
      pages,
      density,
      language,
      ...(topicHint.trim() ? { topicHint: topicHint.trim() } : {}),
      attachments,
    };
    onConfirm(specs);
  }

  return (
    <div className="flex flex-col p-6 gap-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white">Configure your document</h2>
        <p className="text-xs text-gray-500 mt-0.5">{template.displayName}</p>
      </div>

      {/* Pages */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Pages</label>
        <div className="flex items-center gap-4">
          <button
            onClick={decrement}
            disabled={pages <= 1}
            className="w-9 h-9 rounded-lg border border-gray-700 bg-gray-900 text-gray-300
              hover:border-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed
              transition-colors flex items-center justify-center text-lg font-medium select-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-2xl font-bold text-white w-6 text-center tabular-nums">{pages}</span>
          <button
            onClick={increment}
            disabled={pages >= 10}
            className="w-9 h-9 rounded-lg border border-gray-700 bg-gray-900 text-gray-300
              hover:border-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed
              transition-colors flex items-center justify-center text-lg font-medium select-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <span className="text-xs text-gray-600 ml-1">1 – 10</span>
        </div>
      </div>

      {/* Density */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Density</label>
        <div className="grid grid-cols-3 gap-2">
          {DENSITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDensity(opt.value)}
              className={`bg-gray-900 border rounded-xl p-3 cursor-pointer text-left transition-all
                ${density === opt.value
                  ? 'border-blue-500 ring-1 ring-blue-500'
                  : 'border-gray-700 hover:border-gray-500'
                }`}
            >
              <p className={`text-sm font-semibold ${density === opt.value ? 'text-blue-400' : 'text-white'}`}>
                {opt.label}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 leading-snug">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="specs-language">
          Language
        </label>
        <select
          id="specs-language"
          value={language}
          onChange={(e) => setLanguage(e.target.value as DocumentSpecs['language'])}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white
            focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors
            appearance-none cursor-pointer"
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Topic hint */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300" htmlFor="specs-topic">
            Topic hint
            <span className="text-gray-600 font-normal ml-1">(optional)</span>
          </label>
          <span className={`text-xs tabular-nums ${topicHint.length > MAX_TOPIC_HINT ? 'text-red-400' : 'text-gray-600'}`}>
            {topicHint.length}/{MAX_TOPIC_HINT}
          </span>
        </div>
        <textarea
          id="specs-topic"
          value={topicHint}
          onChange={(e) => setTopicHint(e.target.value.slice(0, MAX_TOPIC_HINT))}
          placeholder="e.g. Thermodynamics, chapter 3 — Maxwell equations"
          rows={3}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white
            placeholder:text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
            transition-colors resize-none"
        />
      </div>

      {/* Attachments */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Context files
          <span className="text-gray-600 font-normal ml-1">(optional)</span>
        </label>
        <p className="text-xs text-gray-600 mb-3">
          Upload PDFs, Word docs, or images to use as context for AI generation.
        </p>
        <AttachmentDropzone
          attachments={attachments}
          onAdd={onAddAttachment}
          onRemove={onRemoveAttachment}
          isUploading={isUploadingAttachment}
          error={uploadError}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-800">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="px-4 py-2.5 rounded-xl border border-gray-700 text-sm font-medium text-gray-300
            hover:border-gray-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500
            text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            'Generate'
          )}
        </button>
      </div>
    </div>
  );
}
