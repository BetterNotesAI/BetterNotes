// app-api/src/server.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
  credentials: true,
}));

app.use(express.json({ limit: process.env.MAX_JSON_SIZE ?? '20mb' }));

app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`[app-api] listening on :${PORT}`));
