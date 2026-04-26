const REALTIME_GENERATION_TEMPLATE_IDS = new Set<string>([
  'clean_3cols_landscape',
  'lecture_notes',
  'classic_lecture_notes',
  'cornell',
  'academic_paper',
  'lab_report',
  'data_analysis',
]);

export function supportsRealtimeGeneration(templateId: string | null | undefined): boolean {
  return typeof templateId === 'string' && REALTIME_GENERATION_TEMPLATE_IDS.has(templateId);
}
