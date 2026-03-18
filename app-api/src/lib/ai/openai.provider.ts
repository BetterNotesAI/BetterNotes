// app-api/src/lib/ai/openai.provider.ts
// Stub — implementación completa en M3

import { AIProvider, GenerateLatexArgs, GenerateLatexResult, FixLatexArgs } from './types';

export class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4o') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateLatex(_args: GenerateLatexArgs): Promise<GenerateLatexResult> {
    // TODO M3: implementar generación de LaTeX con OpenAI
    throw new Error('OpenAIProvider.generateLatex not yet implemented (M3)');
  }

  async fixLatex(_args: FixLatexArgs): Promise<string> {
    // TODO M3: implementar corrección de LaTeX con OpenAI
    throw new Error('OpenAIProvider.fixLatex not yet implemented (M3)');
  }
}
