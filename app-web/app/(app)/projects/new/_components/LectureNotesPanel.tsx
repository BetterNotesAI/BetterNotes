'use client';

import Image from 'next/image';
import { getTemplateThumbnailSrc } from '@/lib/template-thumbnails';

export type LectureNotesDensity = 'compact' | 'balanced' | 'spacious';
export type ReportTemplateId =
  | 'cornell'
  | 'classic_lecture_notes'
  | 'lecture_notes'
  | 'academic_paper'
  | 'lab_report'
  | 'data_analysis';

export interface LectureNotesSpecs {
  templateId: ReportTemplateId;
  pages: number;
  density: LectureNotesDensity;
  language: string;
}

export const REPORT_TEMPLATE_OPTIONS: {
  id: ReportTemplateId;
  title: string;
  description: string;
}[] = [
  {
    id: 'cornell',
    title: 'Cornell Review Notes',
    description: 'Cue column, notes area and final summary.',
  },
  {
    id: 'classic_lecture_notes',
    title: 'Classic Lecture Notes',
    description: 'Traditional notes with examples and summaries.',
  },
  {
    id: 'lecture_notes',
    title: 'Extended Lecture Notes',
    description: 'Long-form structured notes with richer sections.',
  },
  {
    id: 'academic_paper',
    title: 'Academic Paper',
    description: 'Paper-style document with abstract and sections.',
  },
  {
    id: 'lab_report',
    title: 'Lab Report',
    description: 'Experiment, method, results and discussion.',
  },
  {
    id: 'data_analysis',
    title: 'Data Analysis',
    description: 'Dataset-focused analysis with findings and plots.',
  },
];

const PAGE_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];

const DENSITIES: { value: LectureNotesDensity; label: string; description: string }[] = [
  { value: 'compact', label: 'Compact', description: 'Dense content' },
  { value: 'balanced', label: 'Balanced', description: 'Comfortable spacing' },
  { value: 'spacious', label: 'Spacious', description: 'Airy layout' },
];

const LANGUAGES = [
  { value: 'auto', label: 'Match input' },
  { value: 'english', label: 'English' },
  { value: 'spanish', label: 'Español' },
  { value: 'catalan', label: 'Català' },
  { value: 'french', label: 'Français' },
  { value: 'german', label: 'Deutsch' },
  { value: 'portuguese', label: 'Português' },
  { value: 'italian', label: 'Italiano' },
];

interface Props {
  templateId: ReportTemplateId | null;
  pages: number | null;
  density: LectureNotesDensity | null;
  language: string | null;
  onChange: (next: Partial<{
    templateId: ReportTemplateId;
    pages: number;
    density: LectureNotesDensity;
    language: string;
  }>) => void;
  disabled?: boolean;
}

export function LectureNotesPanel({ templateId, pages, density, language, onChange, disabled }: Props) {
  return (
    <div className="mt-6 space-y-5">
      <div>
        <label className="block text-xs font-medium text-white/70 mb-2 uppercase tracking-wide">
          Report template <span className="text-white/35 normal-case font-normal tracking-normal">— required</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {REPORT_TEMPLATE_OPTIONS.map((template) => {
            const isActive = templateId === template.id;
            return (
              <button
                key={template.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ templateId: template.id })}
                aria-pressed={isActive}
                className={`group text-left rounded-xl border p-2.5 transition-colors
                  disabled:opacity-60 disabled:cursor-not-allowed ${
                    isActive
                      ? 'border-indigo-400/70 bg-indigo-500/15 text-white shadow-[0_0_0_1px_rgba(129,140,248,0.45)]'
                      : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-white/10 bg-white/5">
                  <Image
                    src={getTemplateThumbnailSrc(template.id)}
                    alt={template.title}
                    fill
                    sizes="(min-width: 1024px) 210px, (min-width: 640px) 280px, 100vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    onError={(e) => {
                      e.currentTarget.classList.add('hidden');
                    }}
                  />
                </div>
                <p className="mt-2 text-sm font-semibold leading-snug">{template.title}</p>
                <p className="mt-1 min-h-[30px] text-[11px] leading-snug text-white/42">{template.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-white/70 mb-2 uppercase tracking-wide">
          Length <span className="text-white/35 normal-case font-normal tracking-normal">— pages (required)</span>
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          {PAGE_OPTIONS.map((n) => {
            const isActive = pages === n;
            return (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ pages: n })}
                aria-pressed={isActive}
                className={`w-11 h-11 rounded-xl border text-sm font-semibold transition-colors
                  disabled:opacity-60 disabled:cursor-not-allowed ${
                    isActive
                      ? 'border-indigo-400/70 bg-indigo-500/15 text-white shadow-[0_0_0_1px_rgba(129,140,248,0.45)]'
                      : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-white/70 mb-2 uppercase tracking-wide">
          Density <span className="text-white/35 normal-case font-normal tracking-normal">— required</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {DENSITIES.map((d) => {
            const isActive = density === d.value;
            return (
              <button
                key={d.value}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ density: d.value })}
                aria-pressed={isActive}
                className={`rounded-xl border px-3 py-2.5 text-left transition-colors
                  disabled:opacity-60 disabled:cursor-not-allowed ${
                    isActive
                      ? 'border-indigo-400/70 bg-indigo-500/15 text-white shadow-[0_0_0_1px_rgba(129,140,248,0.45)]'
                      : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
              >
                <p className="text-sm font-semibold">{d.label}</p>
                <p className="text-[11px] text-white/40 mt-0.5">{d.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-white/70 mb-2 uppercase tracking-wide">
          Language <span className="text-white/35 normal-case font-normal tracking-normal">— required</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => {
            const isActive = language === lang.value;
            return (
              <button
                key={lang.value}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ language: lang.value })}
                aria-pressed={isActive}
                className={`px-3 py-2 rounded-xl border text-xs font-medium transition-colors
                  disabled:opacity-60 disabled:cursor-not-allowed ${
                    isActive
                      ? 'border-indigo-400/70 bg-indigo-500/15 text-white shadow-[0_0_0_1px_rgba(129,140,248,0.45)]'
                      : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
              >
                {lang.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
