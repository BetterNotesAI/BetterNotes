'use client';

import { useState } from 'react';

export interface TemplateMeta {
  id: string;
  displayName: string;
  description: string;
  isPro: boolean;
  isMultiFile?: boolean;
}

interface TemplateSelectorProps {
  templates: TemplateMeta[];
  onChoose: (templateId: string) => void;
  isLoading?: boolean;
}

// Color accent per template (visual variety)
const TEMPLATE_COLORS: Record<string, string> = {
  '2cols_portrait': 'from-blue-900 to-blue-800',
  landscape_3col_maths: 'from-emerald-900 to-emerald-800',
  cornell: 'from-red-900 to-red-800',
  problem_solving: 'from-violet-900 to-violet-800',
  zettelkasten: 'from-indigo-900 to-indigo-800',
  academic_paper: 'from-orange-900 to-orange-800',
  lab_report: 'from-teal-900 to-teal-800',
  data_analysis: 'from-pink-900 to-pink-800',
  study_form: 'from-amber-900 to-amber-800',
  lecture_notes: 'from-sky-900 to-sky-800',
  long_template: 'from-gray-800 to-gray-700',
};

export function TemplateSelector({ templates, onChoose, isLoading }: TemplateSelectorProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const free = templates.filter((t) => !t.isPro);
  const pro = templates.filter((t) => t.isPro);

  function handleConfirm() {
    if (selected) onChoose(selected);
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto w-full">
        <h2 className="text-xl font-bold text-white mb-1">Choose a template</h2>
        <p className="text-sm text-gray-500 mb-6">Select the layout that best fits your needs</p>

        {/* Free templates */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Free</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {free.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                isSelected={selected === t.id}
                onSelect={() => setSelected(t.id)}
                gradient={TEMPLATE_COLORS[t.id] ?? 'from-gray-800 to-gray-700'}
              />
            ))}
          </div>
        </div>

        {/* Pro templates */}
        {pro.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Pro</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pro.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  isSelected={selected === t.id}
                  onSelect={() => setSelected(t.id)}
                  gradient={TEMPLATE_COLORS[t.id] ?? 'from-gray-800 to-gray-700'}
                />
              ))}
            </div>
          </div>
        )}

        {/* Confirm button */}
        <div className="sticky bottom-0 pt-4 bg-[#0a0a0a]">
          <button
            onClick={handleConfirm}
            disabled={!selected || isLoading}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm
              hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Creating...' : selected ? 'Continue with this template' : 'Select a template to continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  isSelected,
  onSelect,
  gradient,
}: {
  template: TemplateMeta;
  isSelected: boolean;
  onSelect: () => void;
  gradient: string;
}) {
  return (
    <button
      onClick={onSelect}
      className={`text-left rounded-xl border transition-all p-4 cursor-pointer
        ${isSelected
          ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-950/30'
          : 'border-gray-800 hover:border-gray-600 bg-gray-900/50'
        }`}
    >
      {/* Color strip */}
      <div className={`w-full h-1.5 rounded-full bg-gradient-to-r ${gradient} mb-3`} />

      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-white leading-snug">{template.displayName}</span>
        {template.isPro && (
          <span className="shrink-0 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">
            Pro
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{template.description}</p>
    </button>
  );
}
