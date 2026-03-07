import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { WorkspaceClient } from "../../components/workspace-client";

export default async function WorkspacePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: templates }, { data: jobs }] = await Promise.all([
    supabase
      .from("templates")
      .select("id, slug, name, description, preview_image_path")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("jobs")
      .select("id, template_id, prompt, status, output_pdf_path, output_tex_path, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  return <WorkspaceClient userId={user.id} templates={templates ?? []} initialJobs={jobs ?? []} />;
}
