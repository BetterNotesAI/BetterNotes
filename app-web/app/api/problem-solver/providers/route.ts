// GET /api/problem-solver/providers
// Returns the list of configured AI providers for the model selector.

export const runtime = 'nodejs';

import { NextRequest } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN ?? '';

export async function GET(_req: NextRequest) {
  try {
    const resp = await fetch(`${API_URL}/problem-solver/providers`, {
      headers: {
        ...(API_INTERNAL_TOKEN
          ? { Authorization: `Bearer ${API_INTERNAL_TOKEN}` }
          : {}),
      },
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ providers: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ providers: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
