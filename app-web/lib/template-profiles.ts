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
    // geometry: left/right/top/bottom = 22mm
    margins: { top: 5.2, right: 5.2, bottom: 5.2, left: 5.2 },
  },
  typography: {
    baseFontSize: '11.6px',
    fontFamily: '"KaTeX_Main", "Times New Roman", serif',
    lineSpread: 1.2,
  },
  colors: { accentColor: '#005AAA', thmColor: '#cc0000', defColor: '#3db000', propColor: '#0000cc' },
  layout: { columnCount: 1, showColumnRule: false, columnRuleWidth: '0', columnGap: '0' },
  chrome: { showPageNumbers: true, showHeaderFooter: true },
  density: 'normal',
};

export const PROFILE_2cols_portrait: TemplateProfile = {
  id: '2cols_portrait',
  geometry: {
    orientation: 'portrait', widthPx: 794, aspectRatio: '210 / 297',
    // geometry package: margin=0.45in
    margins: { top: 2.7, right: 2.7, bottom: 2.7, left: 2.7 },
  },
  typography: {
    // Body is wrapped in \footnotesize
    baseFontSize: '9.6px',
    fontFamily: '"KaTeX_Main", "Times New Roman", serif',
    lineSpread: 1.08,
  },
  colors: { accentColor: '#333333', thmColor: '#333333', defColor: '#333333', propColor: '#333333' },
  // \columnsep = 0.35cm
  layout: { columnCount: 2, showColumnRule: false, columnRuleWidth: '0', columnGap: '0.82rem' },
  chrome: { showPageNumbers: false, showHeaderFooter: false },
  density: 'compact',
};

export const PROFILE_landscape_3col_maths: TemplateProfile = {
  id: 'landscape_3col_maths',
  geometry: {
    orientation: 'landscape', widthPx: 1123, aspectRatio: '297 / 210',
    // geometry package: left/right/top/bottom = 5mm
    margins: { top: 1.18, right: 1.18, bottom: 1.18, left: 1.18 },
  },
  typography: {
    baseFontSize: '9.6px',
    fontFamily: '"KaTeX_Main", "Times New Roman", serif',
    lineSpread: 0.925,
  },
  colors: { accentColor: '#222222', thmColor: '#cc0000', defColor: '#3db000', propColor: '#0000cc' },
  layout: { columnCount: 3, showColumnRule: true, columnRuleWidth: '0.5pt', columnGap: '1.18rem' },
  chrome: { showPageNumbers: false, showHeaderFooter: false },
  density: 'compact',
};

export const PROFILE_study_form: TemplateProfile = {
  id: 'study_form',
  geometry: {
    orientation: 'portrait', widthPx: 794, aspectRatio: '210 / 297',
    // geometry package: left/right/top/bottom = 4mm
    margins: { top: 0.95, right: 0.95, bottom: 0.95, left: 0.95 },
  },
  typography: {
    // Body is wrapped in \scriptsize
    baseFontSize: '8.2px',
    fontFamily: '"KaTeX_Main", "Times New Roman", serif',
    lineSpread: 0.88,
  },
  colors: { accentColor: '#003C78', thmColor: '#003C78', defColor: '#003C78', propColor: '#003C78' },
  layout: { columnCount: 3, showColumnRule: true, columnRuleWidth: '0.4pt', columnGap: '0.7rem' },
  chrome: { showPageNumbers: false, showHeaderFooter: false },
  density: 'compact',
};

export const PROFILE_problem_solving: TemplateProfile = {
  id: 'problem_solving',
  geometry: {
    orientation: 'portrait', widthPx: 794, aspectRatio: '210 / 297',
    // geometry package: left/right/top/bottom = 8mm
    margins: { top: 1.9, right: 1.9, bottom: 1.9, left: 1.9 },
  },
  typography: {
    baseFontSize: '9.6px',
    fontFamily: '"KaTeX_Main", "Times New Roman", serif',
    lineSpread: 1.08,
  },
  colors: { accentColor: '#00509E', thmColor: '#B40000', defColor: '#008040', propColor: '#643296' },
  layout: { columnCount: 2, showColumnRule: true, columnRuleWidth: '0.5pt', columnGap: '1.18rem' },
  chrome: { showPageNumbers: false, showHeaderFooter: false },
  density: 'compact',
};

export const PROFILE_cornell: TemplateProfile = {
  id: 'cornell',
  geometry: {
    orientation: 'portrait', widthPx: 794, aspectRatio: '210 / 297',
    // geometry package: left=5.5cm,right=1cm,top=2.5cm,bottom=2cm
    margins: { top: 5.9, right: 2.4, bottom: 4.7, left: 13.0 },
  },
  typography: {
    baseFontSize: '10.4px',
    fontFamily: '"KaTeX_Main", "Times New Roman", serif',
    lineSpread: 1.15,
  },
  colors: { accentColor: '#B31B1B', thmColor: '#B40000', defColor: '#3DB000', propColor: '#0064B4' },
  layout: { columnCount: 1, showColumnRule: false, columnRuleWidth: '0', columnGap: '0' },
  chrome: { showPageNumbers: false, showHeaderFooter: true },
  density: 'normal',
};

export const PROFILE_zettelkasten: TemplateProfile = {
  id: 'zettelkasten',
  geometry: {
    orientation: 'portrait', widthPx: 794, aspectRatio: '210 / 297',
    // geometry package: margin=8mm
    margins: { top: 1.9, right: 1.9, bottom: 1.9, left: 1.9 },
  },
  typography: {
    baseFontSize: '9.8px',
    fontFamily: '"KaTeX_Main", "Times New Roman", serif',
    lineSpread: 1.08,
  },
  colors: { accentColor: '#00509E', thmColor: '#B40000', defColor: '#00783C', propColor: '#783296' },
  layout: { columnCount: 1, showColumnRule: false, columnRuleWidth: '0', columnGap: '0' },
  chrome: { showPageNumbers: false, showHeaderFooter: false },
  density: 'compact',
};

export const PROFILE_academic_paper: TemplateProfile = {
  id: 'academic_paper',
  geometry: {
    orientation: 'portrait', widthPx: 794, aspectRatio: '210 / 297',
    // geometry package: left=18mm,right=18mm,top=20mm,bottom=25mm
    margins: { top: 4.7, right: 4.3, bottom: 5.9, left: 4.3 },
  },
  typography: {
    baseFontSize: '11.3px',
    fontFamily: '"KaTeX_Main", "Times New Roman", serif',
    lineSpread: 1.16,
  },
  colors: { accentColor: '#222222', thmColor: '#B40000', defColor: '#00783C', propColor: '#00509E' },
  layout: { columnCount: 2, showColumnRule: false, columnRuleWidth: '0', columnGap: '1.9rem' },
  chrome: { showPageNumbers: true, showHeaderFooter: false },
  density: 'normal',
};

export const PROFILE_lab_report: TemplateProfile = {
  id: 'lab_report',
  geometry: {
    orientation: 'portrait', widthPx: 794, aspectRatio: '210 / 297',
    // geometry package: 25mm on all sides
    margins: { top: 5.9, right: 5.9, bottom: 5.9, left: 5.9 },
  },
  typography: {
    baseFontSize: '11.3px',
    fontFamily: '"KaTeX_Main", "Times New Roman", serif',
    lineSpread: 1.18,
  },
  colors: { accentColor: '#222222', thmColor: '#B40000', defColor: '#00783C', propColor: '#00509E' },
  layout: { columnCount: 1, showColumnRule: false, columnRuleWidth: '0', columnGap: '0' },
  chrome: { showPageNumbers: true, showHeaderFooter: false },
  density: 'normal',
};

export const PROFILE_data_analysis: TemplateProfile = {
  id: 'data_analysis',
  geometry: {
    orientation: 'portrait', widthPx: 794, aspectRatio: '210 / 297',
    // geometry package: 25mm on all sides
    margins: { top: 5.9, right: 5.9, bottom: 5.9, left: 5.9 },
  },
  typography: {
    baseFontSize: '11.2px',
    fontFamily: '"KaTeX_Main", "Times New Roman", serif',
    lineSpread: 1.18,
  },
  colors: { accentColor: '#222222', thmColor: '#B40000', defColor: '#00783C', propColor: '#00509E' },
  layout: { columnCount: 1, showColumnRule: false, columnRuleWidth: '0', columnGap: '0' },
  chrome: { showPageNumbers: true, showHeaderFooter: false },
  density: 'normal',
};

export const PROFILE_long_template: TemplateProfile = {
  id: 'long_template',
  geometry: {
    orientation: 'portrait', widthPx: 794, aspectRatio: '210 / 297',
    margins: { top: 5.2, right: 5.2, bottom: 5.2, left: 5.2 },
  },
  typography: {
    baseFontSize: '11.4px',
    fontFamily: '"KaTeX_Main", "Times New Roman", serif',
    lineSpread: 1.22,
  },
  colors: { accentColor: '#333333', thmColor: '#cc0000', defColor: '#3db000', propColor: '#0000cc' },
  layout: { columnCount: 1, showColumnRule: false, columnRuleWidth: '0', columnGap: '0' },
  chrome: { showPageNumbers: true, showHeaderFooter: true },
  density: 'normal',
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
    case 'problem_solving': return PROFILE_problem_solving;
    case 'cornell': return PROFILE_cornell;
    case 'zettelkasten': return PROFILE_zettelkasten;
    case 'academic_paper': return PROFILE_academic_paper;
    case 'lab_report': return PROFILE_lab_report;
    case 'data_analysis': return PROFILE_data_analysis;
    case 'long_template': return PROFILE_long_template;
    default: return PROFILE_default;
  }
}
