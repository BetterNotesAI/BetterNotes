// app-api/src/lib/ai/index.ts

import { AIProvider } from './types';
import { OpenAIProvider } from './openai.provider';

export interface AIConfig {
  openaiApiKey?: string;
  openaiModel?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
}

export function createAIProvider(providerName: string, config: AIConfig): AIProvider {
  switch (providerName) {
    case 'anthropic':
      throw new Error('AnthropicProvider not yet implemented');
    case 'openai':
    default:
      if (!config.openaiApiKey) throw new Error('OPENAI_API_KEY is required');
      return new OpenAIProvider(config.openaiApiKey, config.openaiModel ?? 'gpt-4o');
  }
}

export type { AIProvider } from './types';
export type { GenerateLatexArgs, GenerateLatexResult, FixLatexArgs, AttachmentInput } from './types';
