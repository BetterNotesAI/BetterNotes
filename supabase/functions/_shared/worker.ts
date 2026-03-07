import { optionalEnv, requireEnv } from "./env.ts";

const workerUrl = requireEnv("WORKER_RENDER_URL");
const workerSecret = requireEnv("WORKER_SHARED_SECRET");
const timeoutMs = Number(optionalEnv("WORKER_DISPATCH_TIMEOUT_MS", "10000"));

export async function dispatchJob(jobId: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerSecret}`
      },
      body: JSON.stringify({ job_id: jobId }),
      signal: controller.signal
    });

    return response.status === 202 || response.status === 409;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
