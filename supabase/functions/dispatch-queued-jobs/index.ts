import { corsHeaders } from "../_shared/cors.ts";
import { optionalEnv } from "../_shared/env.ts";
import { error, json } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { dispatchJob } from "../_shared/worker.ts";

function isAuthorized(request: Request): boolean {
  const expectedSecret = optionalEnv("CRON_SECRET", "");
  if (!expectedSecret) {
    return true;
  }

  const headerSecret = request.headers.get("x-cron-secret");
  const bearer = request.headers.get("Authorization")?.replace("Bearer ", "");
  return headerSecret === expectedSecret || bearer === expectedSecret;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return error("Method not allowed", 405);
  }

  if (!isAuthorized(request)) {
    return error("Unauthorized", 401);
  }

  const admin = createServiceClient();

  const { data: jobs, error: jobsError } = await admin
    .from("jobs")
    .select("id")
    .eq("status", "queued")
    .is("dispatched_at", null)
    .order("created_at", { ascending: true })
    .limit(25);

  if (jobsError) {
    return error(jobsError.message, 500);
  }

  let dispatchedCount = 0;

  for (const job of jobs ?? []) {
    const dispatched = await dispatchJob(job.id);
    if (dispatched) {
      dispatchedCount += 1;
      await admin.from("jobs").update({ dispatched_at: new Date().toISOString() }).eq("id", job.id);
    }
  }

  return json({ dispatched_count: dispatchedCount });
});
