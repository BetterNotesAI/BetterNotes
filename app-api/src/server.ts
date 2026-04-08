// app-api/src/server.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createLatexRouter } from './routes/latex';
import { createEditBlockRouter } from './routes/edit-block';
import { createEditDocumentRouter } from './routes/edit-document';
import { createExamsRouter } from './routes/exams';
import { createProblemSolverRouter } from './routes/problem-solver';
import { createCheatSheetRouter } from './routes/cheat-sheet';
import { createAIProvider } from './lib/ai';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
  credentials: true,
}));

app.use(express.json({ limit: process.env.MAX_JSON_SIZE ?? '20mb' }));

app.get('/health', (_, res) => res.json({ ok: true }));

// ─── AI provider ──────────────────────────────────────────────────────────────
// Set AI_PROVIDER to: openai | groq | openrouter | google
// Then set the corresponding API key (and optionally model ID) in .env.

const providerName = process.env.AI_PROVIDER ?? 'openai';

const aiProvider = createAIProvider(providerName, {
  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel:  process.env.OPENAI_MODEL ?? 'gpt-4o',
  // Groq
  groqApiKey:   process.env.GROQ_API_KEY,
  groqModel:    process.env.GROQ_MODEL,
  // OpenRouter
  openrouterApiKey: process.env.OPENROUTER_API_KEY,
  openrouterModel:  process.env.OPENROUTER_MODEL,
  // Google AI Studio
  googleApiKey:  process.env.GOOGLE_AI_API_KEY,
  googleModel:   process.env.GOOGLE_AI_MODEL,
});

// ─── Resolve active credentials for problem-solver (uses streaming directly) ──

const PROVIDER_BASE_URLS: Record<string, string> = {
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta/openai/',
};

function resolveProblemSolverConfig(): { apiKey: string; model: string; baseURL?: string } {
  switch (providerName) {
    case 'groq':
      return { apiKey: process.env.GROQ_API_KEY ?? '', model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile', baseURL: PROVIDER_BASE_URLS.groq };
    case 'openrouter':
      return { apiKey: process.env.OPENROUTER_API_KEY ?? '', model: process.env.OPENROUTER_MODEL ?? 'qwen/qwen3.6-plus:free', baseURL: PROVIDER_BASE_URLS.openrouter };
    case 'google':
      return { apiKey: process.env.GOOGLE_AI_API_KEY ?? '', model: process.env.GOOGLE_AI_MODEL ?? 'gemini-3.1-flash-lite-preview', baseURL: PROVIDER_BASE_URLS.google };
    default:
      return { apiKey: process.env.OPENAI_API_KEY ?? '', model: process.env.OPENAI_MODEL ?? 'gpt-4o' };
  }
}

const psConfig = resolveProblemSolverConfig();

// ─── Routers ─────────────────────────────────────────────────────────────────

app.use('/latex', createLatexRouter({
  aiProvider,
  latexTimeoutMs: Number(process.env.LATEX_TIMEOUT_MS ?? 180000),
}));

// F3-M4.3: block editing endpoint
app.use('/latex', createEditBlockRouter({ aiProvider }));

// Document-level AI edit endpoint
app.use('/latex', createEditDocumentRouter({ aiProvider }));

// Math solver — configurable via MATH_PROVIDER (google | openrouter | groq)
// Defaults to google if GOOGLE_AI_API_KEY is set, then openrouter, then groq.
const mathProviderName = (process.env.MATH_PROVIDER as string | undefined)?.trim()
  || (process.env.GOOGLE_AI_API_KEY ? 'google' : null)
  || (process.env.OPENROUTER_API_KEY ? 'openrouter' : null)
  || (process.env.GROQ_API_KEY ? 'groq' : null);

const mathSolverProvider = mathProviderName
  ? createAIProvider(mathProviderName as any, {
      groqApiKey:       process.env.GROQ_API_KEY,
      groqModel:        process.env.GROQ_MODEL,
      openrouterApiKey: process.env.OPENROUTER_API_KEY,
      openrouterModel:  process.env.MATH_MODEL ?? process.env.OPENROUTER_MODEL,
      googleApiKey:     process.env.GOOGLE_AI_API_KEY,
      googleModel:      process.env.MATH_MODEL ?? process.env.GOOGLE_AI_MODEL,
    })
  : undefined;

// Fallback math solver — Gemini when MATH_MODEL is set (primary is a different model)
const mathFallbackProvider = (mathProviderName === 'google' && process.env.MATH_MODEL && process.env.GOOGLE_AI_MODEL)
  ? createAIProvider('google', {
      googleApiKey:  process.env.GOOGLE_AI_API_KEY,
      googleModel:   process.env.GOOGLE_AI_MODEL,
    })
  : undefined;

console.log(`[app-api] math solver: ${mathProviderName ?? 'disabled'}${mathFallbackProvider ? ` (fallback: ${process.env.GOOGLE_AI_MODEL})` : ''}`);

// Exams
app.use('/exams', createExamsRouter({ aiProvider, mathProvider: mathSolverProvider, mathFallbackProvider }));

// Problem Solver
app.use('/problem-solver', createProblemSolverRouter({
  openaiApiKey:  psConfig.apiKey,
  openaiModel:   psConfig.model,
  openaiBaseURL: psConfig.baseURL,
}));

// Cheat Sheet — reuses the same provider config as Problem Solver
app.use('/cheat-sheet', createCheatSheetRouter({
  openaiApiKey:  psConfig.apiKey,
  openaiModel:   psConfig.model,
  openaiBaseURL: psConfig.baseURL,
}));

app.listen(PORT, () => console.log(`[app-api] listening on :${PORT} — provider: ${providerName}`));
