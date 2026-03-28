// app-api/src/server.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createLatexRouter } from './routes/latex';
import { createEditBlockRouter } from './routes/edit-block';
import { createAIProvider } from './lib/ai';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
  credentials: true,
}));

app.use(express.json({ limit: process.env.MAX_JSON_SIZE ?? '20mb' }));

app.get('/health', (_, res) => res.json({ ok: true }));

// AI provider
const aiProvider = createAIProvider(
  process.env.AI_PROVIDER ?? 'openai',
  {
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o',
  }
);

// Routers
app.use('/latex', createLatexRouter({
  aiProvider,
  latexTimeoutMs: Number(process.env.LATEX_TIMEOUT_MS ?? 180000),
}));

// F3-M4.3: block editing endpoint
app.use('/latex', createEditBlockRouter({ aiProvider }));

app.listen(PORT, () => console.log(`[app-api] listening on :${PORT}`));
