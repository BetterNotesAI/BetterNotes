export type CheatSheetTemplateId =
  | 'landscape_3col_maths'
  | '2cols_portrait'
  | 'lecture_notes'
  | 'study_form';

export interface CheatSheetTemplateOption {
  id: CheatSheetTemplateId;
  cardName: string;
  label: string;
  accent: string;
  linkColor: string;
  description: string;
}

export const CHEAT_SHEET_TEMPLATE_OPTIONS: CheatSheetTemplateOption[] = [
  {
    id: 'landscape_3col_maths',
    cardName: '3-Column Landscape',
    label: '3-Col Landscape',
    accent: '#8b5cf6',
    linkColor: 'text-violet-400 group-hover:text-violet-300',
    description: 'Dense math and larger formulas',
  },
  {
    id: '2cols_portrait',
    cardName: '2-Column Cheat Sheet',
    label: '2-Col Portrait',
    accent: '#6366f1',
    linkColor: 'text-indigo-400 group-hover:text-indigo-300',
    description: 'Balanced formulas and definitions',
  },
  {
    id: 'lecture_notes',
    cardName: 'Lecture Notes',
    label: 'Long Notes',
    accent: '#3b82f6',
    linkColor: 'text-blue-400 group-hover:text-blue-300',
    description: 'Structured concepts with more context',
  },
  {
    id: 'study_form',
    cardName: '3-Column Portrait',
    label: '3-Col Portrait',
    accent: '#10b981',
    linkColor: 'text-emerald-400 group-hover:text-emerald-300',
    description: 'High-density compact summaries',
  },
];

export const CHEAT_SHEET_TEMPLATE_BY_ID: Record<CheatSheetTemplateId, CheatSheetTemplateOption> =
  CHEAT_SHEET_TEMPLATE_OPTIONS.reduce((acc, option) => {
    acc[option.id] = option;
    return acc;
  }, {} as Record<CheatSheetTemplateId, CheatSheetTemplateOption>);

export const CHEAT_SHEET_FEATURED_TEMPLATE_IDS: CheatSheetTemplateId[] = [
  'landscape_3col_maths',
  '2cols_portrait',
  'lecture_notes',
];

export const CHEAT_SHEET_DEFAULT_TEMPLATE_ID: CheatSheetTemplateId = '2cols_portrait';

export function isCheatSheetTemplateId(value: string): value is CheatSheetTemplateId {
  return CHEAT_SHEET_TEMPLATE_OPTIONS.some((option) => option.id === value);
}
