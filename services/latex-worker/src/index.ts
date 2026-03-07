import Fastify from "fastify";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { env } from "./env.js";
import { compileLatex } from "./lib/latex.js";
import { generateStructuredDocument } from "./lib/openai.js";
import { collectTextFromUploads, type UploadRow } from "./lib/uploads.js";
import { renderTemplate } from "./lib/template.js";

const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    persistSession: false
  }
});

const renderBodySchema = z.object({
  job_id: z.string().uuid()
});

type ClaimedJob = {
  id: string;
  user_id: string;
  template_id: string;
  prompt: string;
  input_text: string;
};

const app = Fastify({
  logger: true
});

function isAuthorizedWorkerRequest(authHeader?: string): boolean {
  if (!authHeader) {
    return false;
  }

  return authHeader === `Bearer ${env.workerSharedSecret}`;
}

async function claimJob(jobId: string): Promise<{ kind: "claimed"; job: ClaimedJob } | { kind: "not-found" } | { kind: "already-claimed" }> {
  const { data: claimedJob, error: claimError } = await supabase
    .from("jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      error_code: null,
      error_message: null
    })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("id, user_id, template_id, prompt, input_text")
    .maybeSingle();

  if (claimError) {
    throw claimError;
  }

  if (claimedJob) {
    return { kind: "claimed", job: claimedJob as ClaimedJob };
  }

  const { data: existingJob, error: existingError } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("id", jobId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existingJob) {
    return { kind: "not-found" };
  }

  return { kind: "already-claimed" };
}

async function fetchUploads(jobId: string): Promise<UploadRow[]> {
  const { data: linkRows, error: linkError } = await supabase
    .from("job_uploads")
    .select("upload_id")
    .eq("job_id", jobId);

  if (linkError || !linkRows || linkRows.length === 0) {
    return [];
  }

  const uploadIds = linkRows.map((row) => row.upload_id);
  const { data: uploads, error: uploadsError } = await supabase
    .from("uploads")
    .select("id, storage_path, mime_type")
    .in("id", uploadIds);

  if (uploadsError || !uploads) {
    return [];
  }

  return uploads as UploadRow[];
}

async function markJobError(jobId: string, code: string, message: string) {
  await supabase
    .from("jobs")
    .update({
      status: "error",
      error_code: code,
      error_message: message.slice(0, 2000),
      completed_at: new Date().toISOString()
    })
    .eq("id", jobId);
}

async function processJob(job: ClaimedJob) {
  try {
    const { data: template, error: templateError } = await supabase
      .from("templates")
      .select("name, latex_template")
      .eq("id", job.template_id)
      .eq("is_active", true)
      .single();

    if (templateError || !template) {
      throw new Error("Template not found for job");
    }

    const uploads = await fetchUploads(job.id);
    const uploadText = await collectTextFromUploads(supabase, uploads);

    const combinedInput = [job.input_text, uploadText]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, env.maxInputChars);

    const structured = await generateStructuredDocument({
      prompt: job.prompt,
      notes: combinedInput,
      templateName: template.name
    });

    const texSource = renderTemplate(template.latex_template, structured, job.prompt);
    const pdfBuffer = await compileLatex(job.id, texSource, env.latexTimeoutMs);

    const outputPrefix = `${job.user_id}/${job.id}`;
    const texPath = `${outputPrefix}/output.tex`;
    const pdfPath = `${outputPrefix}/output.pdf`;

    const [texUpload, pdfUpload] = await Promise.all([
      supabase.storage.from("outputs").upload(texPath, Buffer.from(texSource, "utf8"), {
        contentType: "application/x-tex",
        upsert: true
      }),
      supabase.storage.from("outputs").upload(pdfPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true
      })
    ]);

    if (texUpload.error || pdfUpload.error) {
      throw new Error(texUpload.error?.message ?? pdfUpload.error?.message ?? "Failed to upload outputs");
    }

    const { error: finishError } = await supabase
      .from("jobs")
      .update({
        status: "done",
        output_tex_path: texPath,
        output_pdf_path: pdfPath,
        completed_at: new Date().toISOString()
      })
      .eq("id", job.id);

    if (finishError) {
      throw new Error(finishError.message);
    }
  } catch (pipelineError) {
    await markJobError(
      job.id,
      "PIPELINE_ERROR",
      pipelineError instanceof Error ? pipelineError.message : "Unhandled worker error"
    );
  }
}

app.get("/health", async () => ({ ok: true, uptime: process.uptime() }));

app.post("/render", async (request, reply) => {
  if (!isAuthorizedWorkerRequest(request.headers.authorization)) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  const parsed = renderBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(422).send({ error: "Invalid payload" });
  }

  const claim = await claimJob(parsed.data.job_id);

  if (claim.kind === "not-found") {
    return reply.code(404).send({ error: "Job not found" });
  }

  if (claim.kind === "already-claimed") {
    return reply.code(409).send({ error: "Job already claimed" });
  }

  void processJob(claim.job);
  return reply.code(202).send({ accepted: true, job_id: claim.job.id });
});

app.listen({
  host: "0.0.0.0",
  port: env.port
});
