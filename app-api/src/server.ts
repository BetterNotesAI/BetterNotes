// app-api/src/server.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createLatexRouter } from './routes/latex';
import { createEditBlockRouter } from './routes/edit-block';
import { createEditDocumentRouter } from './routes/edit-document';
import { createExamsRouter } from './routes/exams';
import { createProblemSolverRouter, ProblemSolverProviderConfig } from './routes/problem-solver';
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

// ─── Resolve Problem Solver provider fallback chain ───────────────────────────

const PROVIDER_BASE_URLS: Record<string, string> = {
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta/openai/',
};

function resolveProblemSolverProviders(): ProblemSolverProviderConfig[] {
  const ordered: Array<ProblemSolverProviderConfig | null> = [
    // Primary: OpenRouter (Qwen)
    process.env.OPENROUTER_API_KEY?.trim() && process.env.OPENROUTER_MODEL?.trim()
      ? {
          name: 'openrouter',
          apiKey: process.env.OPENROUTER_API_KEY,
          model: process.env.OPENROUTER_MODEL,
          openaiBaseURL: PROVIDER_BASE_URLS.openrouter,
        }
      : null,
    // Fallback 1: Groq (fast inference)
    process.env.GROQ_API_KEY?.trim() && process.env.GROQ_MODEL?.trim()
      ? {
          name: 'groq',
          apiKey: process.env.GROQ_API_KEY,
          model: process.env.GROQ_MODEL,
          openaiBaseURL: PROVIDER_BASE_URLS.groq,
        }
      : null,
    // Fallback 2: Google
    process.env.GOOGLE_AI_API_KEY?.trim() && process.env.GOOGLE_AI_MODEL?.trim()
      ? {
          name: 'google',
          apiKey: process.env.GOOGLE_AI_API_KEY,
          model: process.env.GOOGLE_AI_MODEL,
          openaiBaseURL: PROVIDER_BASE_URLS.google,
        }
      : null,
    // Fallback 3: OpenAI
    process.env.OPENAI_API_KEY?.trim() && process.env.OPENAI_MODEL?.trim()
      ? {
          name: 'openai',
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL,
        }
      : null,
  ];

  return ordered.filter((p): p is ProblemSolverProviderConfig => Boolean(p));
}

const psProviders = resolveProblemSolverProviders();
if (psProviders.length === 0) {
  console.warn('[app-api] No Problem Solver providers configured; /problem-solver will fail requests');
}

// ─── Routers ─────────────────────────────────────────────────────────────────

app.use('/latex', createLatexRouter({
  aiProvider,
  latexTimeoutMs: Number(process.env.LATEX_TIMEOUT_MS ?? 180000),
}));

// F3-M4.3: block editing endpoint
app.use('/latex', createEditBlockRouter({ aiProvider }));

// Document-level AI edit endpoint
app.use('/latex', createEditDocumentRouter({ aiProvider }));

// Exams — Prefer Gemini for question generation, but do not crash startup if key is missing.
const examsProvider = process.env.GOOGLE_AI_API_KEY
  ? createAIProvider('google', {
      googleApiKey: process.env.GOOGLE_AI_API_KEY,
      googleModel:  process.env.GOOGLE_AI_MODEL,
    })
  : aiProvider;

if (!process.env.GOOGLE_AI_API_KEY) {
  console.warn('[app-api] GOOGLE_AI_API_KEY is missing, /exams will use the active AI_PROVIDER');
}

// Math solver — uses Groq (Llama 3.3 70b, best math benchmark) when key is available
const mathSolverProvider = process.env.GROQ_API_KEY
  ? createAIProvider('groq', {
      groqApiKey: process.env.GROQ_API_KEY,
      groqModel:  process.env.GROQ_MODEL,
    })
  : undefined;

app.use('/exams', createExamsRouter({
  aiProvider: examsProvider,
  mathProvider: mathSolverProvider,
}));

// Problem Solver
app.use('/problem-solver', createProblemSolverRouter({
  providers: psProviders,
}));

app.listen(PORT, () => console.log(`[app-api] listening on :${PORT} — provider: ${providerName}`));
