// Shared helpers for Next.js API proxy routes → app-api

export function getApiBaseUrl() {
  return (process.env.API_BASE_URL ?? "").replace(/\/$/, "");
}

export function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
