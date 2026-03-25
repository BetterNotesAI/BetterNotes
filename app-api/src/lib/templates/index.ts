import { TemplateDefinition } from './types';
import { landscape3colMaths } from './landscape_3col_maths';
import { twocolsPortrait } from './2cols_portrait';
import { studyForm } from './study_form';
import { lectureNotes } from './lecture_notes';
// F2-M7.1: Inactive templates kept as imports so existing documents
// that reference them can still be compiled on demand. They are
// excluded from TEMPLATE_DEFINITIONS to prevent new selection.
import { cornell } from './cornell';
import { problemSolving } from './problem_solving';
import { zettelkasten } from './zettelkasten';
import { academicPaper } from './academic_paper';
import { labReport } from './lab_report';
import { dataAnalysis } from './data_analysis';
import { longTemplate } from './long_template';

// Active templates (4) — shown in the UI and selectable
export const TEMPLATE_DEFINITIONS: Record<string, TemplateDefinition> = {
  '2cols_portrait':       twocolsPortrait,
  landscape_3col_maths:   landscape3colMaths,
  study_form:             studyForm,
  lecture_notes:          lectureNotes,
};

// All templates including inactive ones — used only by the
// generation/compile routes to support existing documents
export const ALL_TEMPLATE_DEFINITIONS: Record<string, TemplateDefinition> = {
  ...TEMPLATE_DEFINITIONS,
  cornell:          cornell,
  problem_solving:  problemSolving,
  zettelkasten:     zettelkasten,
  academic_paper:   academicPaper,
  lab_report:       labReport,
  data_analysis:    dataAnalysis,
  long_template:    longTemplate,
};

// Looks up in ALL_TEMPLATE_DEFINITIONS so that existing documents
// that use an inactive template can still be compiled/re-generated.
export function getTemplateOrThrow(id: string): TemplateDefinition {
  const tmpl = ALL_TEMPLATE_DEFINITIONS[id];
  if (!tmpl) {
    throw Object.assign(
      new Error(
        `[TEMPLATE_NOT_FOUND] templateId="${id}" not found. Available: ${Object.keys(ALL_TEMPLATE_DEFINITIONS).sort().join(', ')}`
      ),
      { statusCode: 400 }
    );
  }
  return tmpl;
}

export function listTemplateIds(): string[] {
  return Object.keys(TEMPLATE_DEFINITIONS).sort();
}

export type { TemplateDefinition } from './types';
