// app-api/src/lib/ai/index.ts

import { AIProvider } from './types';
import { OpenAIProvider } from './openai.provider';

// ─── Provider base URLs ──────────────────────────────────────────────────────

const PROVIDER_BASE_URLS: Record<string, string> = {
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta/openai/',
};

// ─── Default model IDs per provider ──────────────────────────────────────────

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-5.4-nano',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'qwen/qwen3.6-plus',
  google: 'gemini-3.1-flash-lite-preview',
};

// ─── Config ──────────────────────────────────────────────────────────────────

export interface AIConfig {
  // OpenAI
  openaiApiKey?: string;
  openaiModel?: string;
  // Groq
  groqApiKey?: string;
  groqModel?: string;
  // OpenRouter
  openrouterApiKey?: string;
  openrouterModel?: string;
  // Google AI Studio
  googleApiKey?: string;
  googleModel?: string;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create an AIProvider instance for the given provider name.
 *
 * Supported providers:
 *   openai      — OpenAI (default)
 *   groq        — Groq (OpenAI-compatible, fast inference)
 *   openrouter  — OpenRouter (OpenAI-compatible, many models)
 *   google      — Google AI Studio (OpenAI-compatible endpoint)
 */
export function createAIProvider(providerName: string, config: AIConfig): AIProvider {
  const name = providerName.toLowerCase().trim();

  switch (name) {
    case 'groq': {
      const apiKey = config.groqApiKey;
      if (!apiKey) throw new Error('GROQ_API_KEY is required when AI_PROVIDER=groq');
      const model = config.groqModel ?? PROVIDER_DEFAULT_MODELS.groq;
      return new OpenAIProvider(apiKey, model, PROVIDER_BASE_URLS.groq, 'groq');
    }

    case 'openrouter': {
      const apiKey = config.openrouterApiKey;
      if (!apiKey) throw new Error('OPENROUTER_API_KEY is required when AI_PROVIDER=openrouter');
      const model = config.openrouterModel ?? PROVIDER_DEFAULT_MODELS.openrouter;
      return new OpenAIProvider(apiKey, model, PROVIDER_BASE_URLS.openrouter, 'openrouter');
    }

    case 'google': {
      const apiKey = config.googleApiKey;
      if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is required when AI_PROVIDER=google');
      const model = config.googleModel ?? PROVIDER_DEFAULT_MODELS.google;
      return new OpenAIProvider(apiKey, model, PROVIDER_BASE_URLS.google, 'google');
    }

    case 'openai':
    default: {
      const apiKey = config.openaiApiKey;
      if (!apiKey) throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai');
      const model = config.openaiModel ?? PROVIDER_DEFAULT_MODELS.openai;
      return new OpenAIProvider(apiKey, model, undefined, 'openai');
    }
  }
}

export type { AIProvider } from './types';
export type { GenerateLatexArgs, GenerateLatexResult, FixLatexArgs, AttachmentInput } from './types';
