import { z } from "https://esm.sh/zod@3.24.2";
import { corsHeaders } from "../_shared/cors.ts";
import { error, json } from "../_shared/http.ts";
import { createServiceClient, createUserClient } from "../_shared/supabase.ts";
import { dispatchJob } from "../_shared/worker.ts";

const activeStatuses = new Set(["active", "trialing"]);

const bodySchema = z.object({
  template_id: z.string().uuid(),
  prompt: z.string().max(4000).default(""),
  input_text: z.string().max(100000).optional(),
  upload_ids: z.array(z.string().uuid()).max(10).default([])
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return error("Method not allowed", 405);
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return error("Missing authorization header", 401);
  }

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return error("Invalid payload", 422);
  }

  const userClient = createUserClient(authHeader);
  const admin = createServiceClient();

  const {
    data: { user },
    error: userError
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return error("Invalid auth token", 401);
  }

  const payload = parsedBody.data;

  const { data: template, error: templateError } = await admin
    .from("templates")
    .select("id")
    .eq("id", payload.template_id)
    .eq("is_active", true)
    .maybeSingle();

  if (templateError || !template) {
    return error("Template not found", 404);
  }

  if (payload.upload_ids.length > 0) {
    const { data: ownedUploads, error: uploadsError } = await admin
      .from("uploads")
      .select("id")
      .eq("user_id", user.id)
      .in("id", payload.upload_ids);

    if (uploadsError) {
      return error(uploadsError.message, 400);
    }

    const ownedIds = new Set((ownedUploads ?? []).map((item) => item.id));
    const invalid = payload.upload_ids.some((id) => !ownedIds.has(id));
    if (invalid) {
      return error("One or more uploads do not belong to the current user", 400);
    }
  }

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  const hasActiveSubscription = activeStatuses.has(subscription?.status ?? "");

  const { data: insertedJob, error: insertJobError } = await admin
    .from("jobs")
    .insert({
      user_id: user.id,
      template_id: payload.template_id,
      prompt: payload.prompt,
      input_text: payload.input_text ?? "",
      status: "queued"
    })
    .select("id, status")
    .single();

  if (insertJobError || !insertedJob) {
    return error(insertJobError?.message ?? "Could not create job", 500);
  }

  if (!hasActiveSubscription) {
    const { data: consumed, error: consumeError } = await admin.rpc("consume_free_build", {
      p_user_id: user.id,
      p_limit: 1
    });

    if (consumeError) {
      await admin.from("jobs").delete().eq("id", insertedJob.id);
      return error(consumeError.message, 500);
    }

    if (!consumed) {
      await admin.from("jobs").delete().eq("id", insertedJob.id);
      return error("Free plan limit reached. Upgrade to Pro to continue building.", 402);
    }
  }

  if (payload.upload_ids.length > 0) {
    const links = payload.upload_ids.map((uploadId) => ({
      job_id: insertedJob.id,
      upload_id: uploadId
    }));

    const { error: linkError } = await admin.from("job_uploads").insert(links);
    if (linkError) {
      await admin
        .from("jobs")
        .update({ status: "error", error_code: "UPLOAD_LINK_ERROR", error_message: linkError.message })
        .eq("id", insertedJob.id);
      return error(linkError.message, 500);
    }
  }

  const dispatched = await dispatchJob(insertedJob.id);

  if (dispatched) {
    await admin.from("jobs").update({ dispatched_at: new Date().toISOString() }).eq("id", insertedJob.id);
  }

  return json({
    job_id: insertedJob.id,
    status: insertedJob.status
  });
});
