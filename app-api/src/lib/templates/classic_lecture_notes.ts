import { TemplateDefinition } from './types';
import { lectureNotes } from './lecture_notes';

export const classicLectureNotes: TemplateDefinition = {
  ...lectureNotes,
  id: 'classic_lecture_notes',
  displayName: 'Classic Lecture Notes',
  description: 'Classic multi-page lecture notes with learning objectives, worked examples, theorem blocks, and a final summary.',
};
