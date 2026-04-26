import type { ModelUsagePayload } from './ai-usage';

interface KeywordProvider {
  name: string;
  apiKey: string;
  model: string;
  baseURL: string;
}

interface ChatCompletionChoice {
  message?: {
    content?: string;
  };
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
  usage?: ModelUsagePayload;
}

export interface KeywordSuggestionResult {
  raw: string;
  provider: string;
  model: string;
  usage?: ModelUsagePayload;
}

const PROVIDER_BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta/openai',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
} as const;

type ProviderName = keyof typeof PROVIDER_BASE_URLS;

function readProvider(name: ProviderName): KeywordProvider | null {
  switch (name) {
    case 'google':
      return process.env.GOOGLE_AI_API_KEY
        ? {
          name,
          apiKey: process.env.GOOGLE_AI_API_KEY,
          model: process.env.GOOGLE_AI_MODEL ?? 'gemini-3.1-flash-lite-preview',
          baseURL: PROVIDER_BASE_URLS.google,
        }
        : null;
    case 'groq':
      return process.env.GROQ_API_KEY
        ? {
          name,
          apiKey: process.env.GROQ_API_KEY,
          model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
          baseURL: PROVIDER_BASE_URLS.groq,
        }
        : null;
    case 'openrouter':
      return process.env.OPENROUTER_API_KEY
        ? {
          name,
          apiKey: process.env.OPENROUTER_API_KEY,
          model: process.env.OPENROUTER_MODEL ?? 'qwen/qwen3.6-plus:free',
          baseURL: PROVIDER_BASE_URLS.openrouter,
        }
        : null;
    case 'openai':
    default:
      return process.env.OPENAI_API_KEY
        ? {
          name: 'openai',
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
          baseURL: PROVIDER_BASE_URLS.openai,
        }
        : null;
  }
}

function resolveProviders(): KeywordProvider[] {
  const preferred = process.env.AI_PROVIDER?.trim().toLowerCase() as ProviderName | undefined;
  const orderedNames: ProviderName[] = ['openai', 'google', 'openrouter', 'groq'];
  const names = preferred && preferred in PROVIDER_BASE_URLS
    ? [preferred, ...orderedNames.filter((name) => name !== preferred)]
    : orderedNames;
  const providers = names
    .map((name) => readProvider(name))
    .filter((provider): provider is KeywordProvider => provider !== null);
  const seen = new Set<string>();
  return providers.filter((provider) => {
    const key = `${provider.name}:${provider.model}:${provider.baseURL}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function endpointFor(provider: KeywordProvider) {
  return `${provider.baseURL.replace(/\/$/, '')}/chat/completions`;
}

function stringifyErrorPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;
  const error = record.error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  if ('message' in record) return String(record.message ?? '');
  return JSON.stringify(payload).slice(0, 500);
}

async function readErrorText(response: Response) {
  const text = await response.text();
  if (!text) return `${response.status} ${response.statusText}`.trim();
  try {
    return stringifyErrorPayload(JSON.parse(text)) || text;
  } catch {
    return text;
  }
}

async function requestCompletion(provider: KeywordProvider, prompt: string): Promise<ChatCompletionResponse> {
  const variants: Array<Record<string, unknown>> = [
    { max_tokens: 150, temperature: 0.3 },
    { max_completion_tokens: 150, temperature: 0.3 },
    { max_tokens: 150 },
    { max_completion_tokens: 150 },
  ];
  let lastError = '';

  for (const variant of variants) {
    const response = await fetch(endpointFor(provider), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: 'user', content: prompt }],
        ...variant,
      }),
      cache: 'no-store',
    });

    if (response.ok) {
      return await response.json() as ChatCompletionResponse;
    }

    lastError = await readErrorText(response);
    const normalized = lastError.toLowerCase();
    const canRetryParam =
      normalized.includes('max_tokens')
      || normalized.includes('max_completion_tokens')
      || normalized.includes('temperature')
      || normalized.includes('unsupported parameter')
      || normalized.includes('not supported');

    if (!canRetryParam) break;
  }

  throw new Error(lastError || `${provider.name} request failed`);
}

export async function suggestKeywordsWithAi(prompt: string): Promise<KeywordSuggestionResult> {
  const providers = resolveProviders();
  if (providers.length === 0) {
    throw new Error('No AI provider configured');
  }

  const failures: string[] = [];
  for (const provider of providers) {
    try {
      const data = await requestCompletion(provider, prompt);
      return {
        raw: data.choices?.[0]?.message?.content ?? '[]',
        provider: provider.name,
        model: provider.model,
        usage: data.usage,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      failures.push(`${provider.name}: ${message}`);
    }
  }

  throw new Error(failures.join(' | ') || 'AI request failed');
}

export function parseKeywordSuggestions(raw: string): string[] {
  const cleaned = raw.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();

  try {
    const parsed: unknown = JSON.parse(cleaned);
    const values = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { keywords?: unknown }).keywords)
      ? (parsed as { keywords: unknown[] }).keywords
      : [];

    if (values.length > 0) {
      return values
        .map((keyword) => (typeof keyword === 'string' ? keyword.trim() : ''))
        .filter(Boolean)
        .slice(0, 10);
    }
  } catch {
    // Fall through to relaxed parsing.
  }

  const quoted = cleaned.match(/"([^"]+)"/g);
  if (quoted) {
    return quoted
      .map((match) => match.replace(/"/g, '').trim())
      .filter(Boolean)
      .slice(0, 10);
  }

  return cleaned
    .split(/[\n,;]+/)
    .map((keyword) => keyword.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 10);
}
