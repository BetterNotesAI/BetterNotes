'use client';

import Image from 'next/image';
import { getTemplateThumbnailSrc } from '@/lib/template-thumbnails';
import {
  CHEAT_SHEET_TEMPLATE_OPTIONS,
  type CheatSheetTemplateId,
} from '@/app/(app)/cheat-sheets/_components/cheatSheetTemplates';

interface Props {
  selectedTemplateId: CheatSheetTemplateId | null;
  onSelect: (id: CheatSheetTemplateId) => void;
  disabled?: boolean;
}

export function CheatsheetPanel({ selectedTemplateId, onSelect, disabled }: Props) {
  return (
    <div className="mt-6">
      <label className="block text-xs font-medium text-white/70 mb-3 uppercase tracking-wide">
        Pick a template <span className="text-white/35 normal-case font-normal tracking-normal">— required</span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CHEAT_SHEET_TEMPLATE_OPTIONS.map((template) => {
          const isActive = selectedTemplateId === template.id;
          return (
            <button
              key={template.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(template.id)}
              aria-pressed={isActive}
              className={`group rounded-2xl border backdrop-blur p-3 text-left transition-all
                disabled:opacity-60 disabled:cursor-not-allowed
                hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)] ${
                  isActive
                    ? 'bg-white/[0.10] border-indigo-400/70 shadow-[0_0_0_1px_rgba(129,140,248,0.45)]'
                    : 'bg-white/[0.04] border-white/12 hover:bg-white/[0.08] hover:border-white/20'
                }`}
            >
              <div
                className={`relative aspect-[4/3] rounded-lg mb-2.5 overflow-hidden border transition-colors ${
                  isActive ? 'border-white/20' : 'border-white/8 group-hover:border-white/15'
                }`}
                style={{ background: `linear-gradient(135deg, ${template.accent}12, transparent)` }}
              >
                <Image
                  src={getTemplateThumbnailSrc(template.id)}
                  alt={template.cardName}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).classList.add('hidden');
                  }}
                />
              </div>
              <p className="text-xs font-semibold text-white/85 leading-snug mb-0.5">{template.cardName}</p>
              <p className={`text-[10px] transition-colors ${template.linkColor}`}>
                {isActive ? 'Selected' : 'Select →'}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
