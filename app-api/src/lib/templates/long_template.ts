import { TemplateDefinition } from './types';

export const longTemplate: TemplateDefinition = {
  id: 'long_template',
  displayName: 'Long Document (Multi-file)',
  description: 'Multi-file scaffold for long-form documents: books, theses, or extended reports with chapter structure.',
  isPro: true,
  isMultiFile: true,
  scaffoldDir: 'longTemplate',

  preamble: '',
  styleGuide: 'Long-form chapter-based structure. AI will update existing scaffold files.',
  structureTemplate: '',
  structureExample: '',
};
