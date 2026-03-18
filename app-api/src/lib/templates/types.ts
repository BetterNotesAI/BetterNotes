export interface TemplateDefinition {
  id: string;
  displayName: string;
  description: string;
  isPro: boolean;
  preamble: string;
  styleGuide: string;
  structureTemplate: string;
  structureExample: string;
  isMultiFile?: boolean;
  scaffoldDir?: string;
}
