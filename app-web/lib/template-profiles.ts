/**
 * template-profiles.ts
 * Geometry and styling profiles for each BetterNotes LaTeX template.
 * Used by LatexViewer to render a realistic A4/landscape "page" with
 * correct margins, fonts, and accent colours.
 */

export type PageOrientation = 'portrait' | 'landscape';
export type Density = 'compact' | 'normal' | 'spacious';

export interface PageGeometry {
  orientation: PageOrientation;
  widthPx: number;
  aspectRatio: string;
  margins: { top: number; right: number; bottom: number; left: number };
}

export interface TemplateTypography {
  baseFontSize: string;
  fontFamily: string;
  lineSpread: number;
}

export interface TemplateColors {
  accentColor: string;
  thmColor: string;
  defColor: string;
  propColor: string;
}

export interface TemplateLayout {
  columnCount: number;
  showColumnRule: boolean;
  columnRuleWidth: string;
  columnGap: string;
}

export interface TemplateChrome {
  showPageNumbers: boolean;
  showHeaderFooter: boolean;
}

export interface TemplateProfile {
  id: string;
  geometry: PageGeometry;
  typography: TemplateTypography;
  colors: TemplateColors;
  layout: TemplateLayout;
  chrome: TemplateChrome;
  density: Density;
}

// ─── profiles ─────────────────────────────────────────────────────────────────

export const PROFILE_lecture_notes: TemplateProfile = {
  id: 'lecture_notes',
  geometry: {
    orientation: 'portrait', widthPx: 794, aspectRatio: '210 / 297',
    margins: { top: 1.0, right: 1.1, bottom: 1.0, left: 1.1 },
  },
  typography: { baseFontSize: '11px', fontFamily: 'serif', lineSpread: 1.2 },
  colors: { accentColor: '#005AAA', thmColor: '#cc0000', defColor: '#3db000', propColor: '#0000cc' },
  layout: { columnCount: 1, showColumnRule: false, columnRuleWidth: '0', columnGap: '0' },
  chrome: { showPageNumbers: true, showHeaderFooter: true },
  density: 'normal',
};

export const PROFILE_2cols_portrait: TemplateProfile = {
  id: '2cols_portrait',
  geometry: {
    orientation: 'portrait', widthPx: 794, aspectRatio: '210 / 297',
    margins: { top: 0.35, right: 0.4, bottom: 0.35, left: 0.4 },
  },
  typography: { baseFontSize: '10px', fontFamily: 'sans-serif', lineSpread: 1.0 },
  colors: { accentColor: '#333333', thmColor: '#333333', defColor: '#333333', propColor: '#333333' },
  layout: { columnCount: 2, showColumnRule: false, columnRuleWidth: '0', columnGap: '0.5rem' },
  chrome: { showPageNumbers: false, showHeaderFooter: false },
  density: 'compact',
};

export const PROFILE_landscape_3col_maths: TemplateProfile = {
  id: 'landscape_3col_maths',
  geometry: {
    orientation: 'landscape', widthPx: 1123, aspectRatio: '297 / 210',
    margins: { top: 0.2, right: 0.2, bottom: 0.2, left: 0.2 },
  },
  typography: { baseFontSize: '10px', fontFamily: 'serif', lineSpread: 0.925 },
  colors: { accentColor: '#222222', thmColor: '#cc0000', defColor: '#3db000', propColor: '#0000cc' },
  layout: { columnCount: 3, showColumnRule: true, columnRuleWidth: '0.5pt', columnGap: '0.5rem' },
  chrome: { showPageNumbers: false, showHeaderFooter: false },
  density: 'compact',
};

export const PROFILE_study_form: TemplateProfile = {
  id: 'study_form',
  geometry: {
    orientation: 'portrait', widthPx: 794, aspectRatio: '210 / 297',
    margins: { top: 0.15, right: 0.15, bottom: 0.15, left: 0.15 },
  },
  typography: { baseFontSize: '9px', fontFamily: 'sans-serif', lineSpread: 0.88 },
  colors: { accentColor: '#003C78', thmColor: '#003C78', defColor: '#003C78', propColor: '#003C78' },
  layout: { columnCount: 3, showColumnRule: true, columnRuleWidth: '0.4pt', columnGap: '0.3rem' },
  chrome: { showPageNumbers: false, showHeaderFooter: false },
  density: 'compact',
};

export const PROFILE_default: TemplateProfile = {
  id: 'default',
  geometry: {
    orientation: 'portrait', widthPx: 794, aspectRatio: '210 / 297',
    margins: { top: 1.0, right: 1.1, bottom: 1.0, left: 1.1 },
  },
  typography: { baseFontSize: '11px', fontFamily: 'serif', lineSpread: 1.2 },
  colors: { accentColor: '#333333', thmColor: '#cc0000', defColor: '#3db000', propColor: '#0000cc' },
  layout: { columnCount: 1, showColumnRule: false, columnRuleWidth: '0', columnGap: '0' },
  chrome: { showPageNumbers: false, showHeaderFooter: false },
  density: 'normal',
};

// ─── lookup ───────────────────────────────────────────────────────────────────

export function getTemplateProfile(templateId: string | undefined): TemplateProfile {
  switch (templateId) {
    case 'lecture_notes': return PROFILE_lecture_notes;
    case '2cols_portrait': return PROFILE_2cols_portrait;
    case 'landscape_3col_maths': return PROFILE_landscape_3col_maths;
    case 'study_form': return PROFILE_study_form;
    default: return PROFILE_default;
  }
}
