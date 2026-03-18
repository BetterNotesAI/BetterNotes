import { TemplateDefinition } from './types';
import { landscape3colMaths } from './landscape_3col_maths';
import { twocolsPortrait } from './2cols_portrait';
import { cornell } from './cornell';
import { problemSolving } from './problem_solving';
import { zettelkasten } from './zettelkasten';
import { academicPaper } from './academic_paper';
import { labReport } from './lab_report';
import { dataAnalysis } from './data_analysis';
import { longTemplate } from './long_template';
import { studyForm } from './study_form';
import { lectureNotes } from './lecture_notes';

export const TEMPLATE_DEFINITIONS: Record<string, TemplateDefinition> = {
  landscape_3col_maths: landscape3colMaths,
  '2cols_portrait': twocolsPortrait,
  cornell: cornell,
  problem_solving: problemSolving,
  zettelkasten: zettelkasten,
  academic_paper: academicPaper,
  lab_report: labReport,
  data_analysis: dataAnalysis,
  long_template: longTemplate,
  study_form: studyForm,
  lecture_notes: lectureNotes,
};

export function getTemplateOrThrow(id: string): TemplateDefinition {
  const tmpl = TEMPLATE_DEFINITIONS[id];
  if (!tmpl) {
    throw Object.assign(
      new Error(
        `[TEMPLATE_NOT_FOUND] templateId="${id}" not found. Available: ${Object.keys(TEMPLATE_DEFINITIONS).sort().join(', ')}`
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
