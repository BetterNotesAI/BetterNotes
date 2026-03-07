import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";

type JobPageProps = {
  params: {
    id: string;
  };
};

export default async function JobPage({ params }: JobPageProps) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, prompt, output_pdf_path, output_tex_path, error_message, created_at")
    .eq("id", params.id)
    .single();

  if (!job) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-white/70">Job not found.</p>
        <Link href="/workspace" className="text-sm text-mint">
          Return to workspace
        </Link>
      </section>
    );
  }

  const [pdfUrl, texUrl] = await Promise.all([
    job.output_pdf_path
      ? supabase.storage.from("outputs").createSignedUrl(job.output_pdf_path, 60 * 10).then((result) => result.data?.signedUrl ?? null)
      : Promise.resolve(null),
    job.output_tex_path
      ? supabase.storage.from("outputs").createSignedUrl(job.output_tex_path, 60 * 10).then((result) => result.data?.signedUrl ?? null)
      : Promise.resolve(null)
  ]);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Job detail</p>
        <h1 className="text-2xl font-semibold">{job.prompt || "Untitled job"}</h1>
        <p className="text-sm text-white/65">Status: {job.status}</p>
      </header>

      {job.status === "error" && job.error_message ? (
        <p className="rounded-xl border border-rose/50 bg-rose/20 p-4 text-sm text-rose-100">{job.error_message}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {pdfUrl ? (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            Open PDF
          </a>
        ) : null}
        {texUrl ? (
          <a
            href={texUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white"
          >
            Download TEX
          </a>
        ) : null}
        <Link href="/workspace" className="text-sm text-white/70 transition hover:text-white">
          Back to workspace
        </Link>
      </div>

      {pdfUrl ? (
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-white">
          <iframe src={pdfUrl} title="PDF preview" className="h-[70vh] w-full" />
        </div>
      ) : (
        <p className="text-sm text-white/60">PDF not available yet. Refresh in a few seconds.</p>
      )}
    </section>
  );
}
