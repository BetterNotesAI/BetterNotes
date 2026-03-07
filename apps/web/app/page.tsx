import Link from "next/link";
import { createClient } from "../lib/supabase/server";
import { TemplateGrid } from "../components/template-grid";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: templates } = await supabase
    .from("templates")
    .select("id, slug, name, description, preview_image_path")
    .eq("is_active", true)
    .order("name", { ascending: true });

  return (
    <div className="space-y-14">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-white/15 bg-gradient-to-b from-white/10 via-white/5 to-transparent px-6 py-12 text-center shadow-glow">
        <p className="mx-auto mb-4 inline-flex rounded-full border border-mint/40 bg-mint/20 px-4 py-1 text-xs uppercase tracking-[0.2em] text-mint">
          Introducing BetterNotes MVP
        </p>
        <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
          Turn messy notes into <span className="text-neon">clean LaTeX + PDF</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-white/70">
          Upload lecture files, choose a premium template, and ship high quality notes in seconds.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={user ? "/workspace" : "/signup"}
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            {user ? "Go to workspace" : "Create account"}
          </Link>
          <Link
            href="/pricing"
            className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold transition hover:border-white/50"
          >
            See pricing
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Templates</h2>
            <p className="text-sm text-white/60">Start from curated layouts made for study speed.</p>
          </div>
          <Link href="/templates" className="text-sm text-white/70 transition hover:text-white">
            View all
          </Link>
        </div>
        <TemplateGrid templates={templates ?? []} />
      </section>
    </div>
  );
}
