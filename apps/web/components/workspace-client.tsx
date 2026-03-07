"use client";

import type { CreateJobOutput } from "@betternotes/shared";
import type { JobRecord, TemplateRecord } from "../lib/types";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "../lib/supabase/client";

type WorkspaceClientProps = {
  userId: string;
  templates: TemplateRecord[];
  initialJobs: JobRecord[];
};

export function WorkspaceClient({ userId, templates, initialJobs }: WorkspaceClientProps) {
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [inputText, setInputText] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [jobs, setJobs] = useState<JobRecord[]>(initialJobs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId),
    [templateId, templates]
  );

  useEffect(() => {
    const supabase = createClient();

    const timer = setInterval(async () => {
      const { data, error: pollError } = await supabase
        .from("jobs")
        .select("id, template_id, prompt, status, output_pdf_path, output_tex_path, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!pollError && data) {
        setJobs(data as JobRecord[]);
      }
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  async function uploadFiles() {
    const supabase = createClient();
    const uploadIds: string[] = [];

    if (!files || files.length === 0) {
      return uploadIds;
    }

    const list = Array.from(files);
    for (const file of list) {
      const path = `${userId}/${Date.now()}-${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("uploads").upload(path, file, {
        cacheControl: "3600",
        upsert: false
      });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: row, error: insertError } = await supabase
        .from("uploads")
        .insert({
          user_id: userId,
          storage_path: path,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size
        })
        .select("id")
        .single();

      if (insertError || !row) {
        throw new Error(insertError?.message ?? "Upload metadata insert failed");
      }

      uploadIds.push(row.id);
    }

    return uploadIds;
  }

  async function handleCreateJob() {
    setLoading(true);
    setError(null);

    if (!templateId) {
      setError("Please select a template.");
      setLoading(false);
      return;
    }

    try {
      const uploadIds = await uploadFiles();
      const supabase = createClient();

      const { data, error: invokeError } = await supabase.functions.invoke("create-job", {
        body: {
          template_id: templateId,
          prompt,
          input_text: inputText,
          upload_ids: uploadIds
        }
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      const output = data as CreateJobOutput;
      setJobs((prev) => [
        {
          id: output.job_id,
          template_id: templateId,
          prompt,
          status: output.status,
          output_pdf_path: null,
          output_tex_path: null,
          error_message: null,
          created_at: new Date().toISOString()
        },
        ...prev
      ]);

      setPrompt("");
      setInputText("");
      setFiles(null);
    } catch (jobError) {
      setError(jobError instanceof Error ? jobError.message : "Could not create job");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-white/15 bg-gradient-to-br from-white/10 to-white/0 p-6 shadow-glow">
        <p className="mb-2 text-xs uppercase tracking-[0.22em] text-white/50">Build Notebook</p>
        <h2 className="mb-6 text-3xl font-semibold text-white">Turn notes into professional LaTeX layouts</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-white/70">Template</span>
            <select
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm"
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-white/70">Source files (PDF or txt)</span>
            <input
              type="file"
              accept="application/pdf,text/plain"
              multiple
              onChange={(event) => setFiles(event.target.files)}
              className="w-full rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <label className="mt-4 block space-y-2">
          <span className="text-sm text-white/70">Prompt</span>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
            placeholder="Make a formula sheet from chapter 3 with key derivations."
            className="w-full rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm"
          />
        </label>
        <label className="mt-4 block space-y-2">
          <span className="text-sm text-white/70">Raw text (optional)</span>
          <textarea
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            rows={6}
            placeholder="Paste raw notes here if you do not upload a file."
            className="w-full rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm"
          />
        </label>
        {selectedTemplate ? <p className="mt-3 text-xs text-white/50">{selectedTemplate.description}</p> : null}
        {error ? <p className="mt-4 rounded-xl border border-rose/50 bg-rose/20 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-white/50">Free users: 1 build/day. Pro users: unlimited.</p>
          <button
            type="button"
            onClick={handleCreateJob}
            disabled={loading}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
          >
            {loading ? "Queueing..." : "Build now"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recent jobs</h3>
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Polling every 3s</p>
        </div>
        <div className="space-y-3">
          {jobs.length === 0 ? (
            <p className="rounded-2xl border border-white/15 bg-white/5 px-4 py-6 text-sm text-white/70">
              No jobs yet. Launch your first build above.
            </p>
          ) : (
            jobs.map((job) => (
              <article
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-white/90">{job.prompt || "Untitled job"}</p>
                  <p className="text-xs text-white/50">{new Date(job.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full border border-white/20 px-2 py-1 text-xs uppercase tracking-[0.15em] text-white/70">
                    {job.status}
                  </span>
                  <Link
                    href={`/workspace/job/${job.id}`}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-white/40"
                  >
                    Open
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
