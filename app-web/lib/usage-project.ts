export const CHEAT_SHEET_TEMPLATE_IDS = [
  'landscape_3col_maths',
  '2cols_portrait',
  'lecture_notes',
  'study_form',
] as const;

const CHEAT_SHEET_TEMPLATE_ID_SET = new Set<string>(CHEAT_SHEET_TEMPLATE_IDS);

export type UsageProjectType = 'document' | 'cheat_sheet' | 'problem_solver' | 'exam';

export interface UsageProjectContext {
  projectType?: UsageProjectType | null;
  projectId?: string | null;
}

export function inferDocumentProjectType(templateId: string | null | undefined): UsageProjectType {
  if (templateId && CHEAT_SHEET_TEMPLATE_ID_SET.has(templateId)) {
    return 'cheat_sheet';
  }
  return 'document';
}

export function buildDocumentProjectContext(
  documentId: string,
  templateId: string | null | undefined,
): UsageProjectContext {
  return {
    projectType: inferDocumentProjectType(templateId),
    projectId: documentId,
  };
}
