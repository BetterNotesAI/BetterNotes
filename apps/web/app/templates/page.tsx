import { createClient } from "../../lib/supabase/server";
import { TemplateGrid } from "../../components/template-grid";

export default async function TemplatesPage() {
  const supabase = createClient();
  const { data: templates } = await supabase
    .from("templates")
    .select("id, slug, name, description, preview_image_path")
    .eq("is_active", true)
    .order("name", { ascending: true });

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Template library</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/65">
          Every template includes predefined LaTeX scaffolding so the worker only fills structured content.
        </p>
      </div>
      <TemplateGrid templates={templates ?? []} />
    </section>
  );
}
