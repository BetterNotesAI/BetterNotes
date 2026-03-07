import { corsHeaders } from "./cors.ts";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}
