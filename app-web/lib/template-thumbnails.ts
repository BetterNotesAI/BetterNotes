const REAL_THUMBNAIL_BY_TEMPLATE: Record<string, string> = {
  '2cols_portrait': '/templates/thumbnails/real_2cols_portrait.png',
  'landscape_3col_maths': '/templates/thumbnails/real_landscape_3col_maths.png',
  'lecture_notes': '/templates/thumbnails/real_lecture_notes.png',
  'study_form': '/templates/thumbnails/real_3cols_portrait.png',
};

export function getTemplateThumbnailSrc(templateId: string): string {
  return REAL_THUMBNAIL_BY_TEMPLATE[templateId] ?? `/templates/thumbnails/${templateId}.png`;
}
