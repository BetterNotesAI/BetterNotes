import { supabase, getCurrentUser } from "@/lib/supabase";
import { saveOutputFile } from "@/lib/api/files";

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  template_id: string | null;
  visibility: 'private' | 'public' | 'unlisted';
  is_starred: boolean;
  is_playground: boolean;
  cover_image_url: string | null;
  tags: string[];
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function createProject(data: {
  title?: string;
  description?: string;
  template_id?: string;
  visibility?: 'private' | 'public' | 'unlisted';
  is_playground?: boolean;
}): Promise<{ project: Project | null; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { project: null, error: "Not logged in. Please sign in first." };

    const insertData: Record<string, unknown> = {
      user_id: user.id,
      title: data.title || 'Untitled Project',
      description: data.description,
      template_id: data.template_id,
      visibility: data.visibility || 'private',
    };
    if (data.is_playground !== undefined) insertData.is_playground = data.is_playground;

    let { data: project, error } = await supabase.from('projects').insert(insertData).select('*').single();

    // Fallback: retry without is_playground if column doesn't exist yet
    if (error && data.is_playground !== undefined) {
      delete insertData.is_playground;
      const retry = await supabase.from('projects').insert(insertData).select('*').single();
      project = retry.data;
      error = retry.error;
    }

    if (error) { console.warn("Failed to create project:", error.message); return { project: null, error: error.message }; }
    return { project: project as Project };
  } catch (e: any) {
    console.warn("createProject error:", e);
    return { project: null, error: e?.message ?? "Unknown error creating project" };
  }
}

export async function updateProject(projectId: string, data: {
  title?: string;
  description?: string;
  visibility?: 'private' | 'public' | 'unlisted';
  is_starred?: boolean;
  cover_image_url?: string;
  tags?: string[];
}): Promise<boolean> {
  try {
    const { error } = await supabase.from('projects').update(data).eq('id', projectId);
    if (error) { console.warn("Failed to update project:", error.message); return false; }
    return true;
  } catch (e) {
    console.warn("updateProject error:", e);
    return false;
  }
}

export async function deleteProject(projectId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) { console.warn("Failed to delete project:", error.message); return false; }
    return true;
  } catch (e) {
    console.warn("deleteProject error:", e);
    return false;
  }
}

export async function moveProjectToFolder(projectId: string, folderId: string | null): Promise<boolean> {
  try {
    const { error } = await supabase.from('projects').update({ folder_id: folderId }).eq('id', projectId);
    if (error) { console.warn("Failed to move project:", error.message); return false; }
    return true;
  } catch (e) {
    console.warn("moveProjectToFolder error:", e);
    return false;
  }
}

export async function listProjects(filter?: {
  starred?: boolean;
  is_playground?: boolean;
  search?: string;
  limit?: number;
  folderId?: string | null;
}): Promise<Project[]> {
  try {
    let query = supabase.from('projects').select('*').order('updated_at', { ascending: false });
    query = query.eq('is_playground', filter?.is_playground ?? false);
    if (filter?.starred) query = query.eq('is_starred', true);
    if (filter?.search) query = query.ilike('title', `%${filter.search}%`);
    if (filter?.limit) query = query.limit(filter.limit);
    if (filter?.folderId !== undefined) {
      if (filter.folderId === null) {
        query = (query as any).is('folder_id', null);
      } else {
        query = query.eq('folder_id', filter.folderId);
      }
    }

    let { data, error } = await query;

    // Fallback: retry without is_playground if column doesn't exist
    if (error && error.message?.includes('is_playground')) {
      let retryQuery = supabase.from('projects').select('*').order('updated_at', { ascending: false });
      if (filter?.starred) retryQuery = retryQuery.eq('is_starred', true);
      if (filter?.search) retryQuery = retryQuery.ilike('title', `%${filter.search}%`);
      if (filter?.limit) retryQuery = retryQuery.limit(filter.limit);
      const retry = await retryQuery;
      data = retry.data;
      error = retry.error;
    }

    if (error) { console.warn("Failed to list projects:", error.message); return []; }
    return (data || []) as Project[];
  } catch (e) {
    console.warn("listProjects error:", e);
    return [];
  }
}

export async function starProject(projectId: string, starred: boolean): Promise<boolean> {
  return updateProject(projectId, { is_starred: starred });
}

export async function promotePlayground(
  sessionName: string,
  files: { path: string; content: string }[]
): Promise<Project | null> {
  const { project } = await createProject({ title: sessionName || 'Playground Session', is_playground: true });
  if (!project) return null;
  for (const f of files) await saveOutputFile(project.id, f.path, f.content);
  return project;
}

export async function duplicateProject(projectId: string): Promise<Project | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: original, error: fetchErr } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (fetchErr || !original) return null;

    const { data: copy, error: insertErr } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        title: `${original.title} (Copy)`,
        description: original.description,
        template_id: original.template_id,
        visibility: 'private',
        tags: original.tags,
      })
      .select('*')
      .single();

    if (insertErr) { console.warn("Failed to duplicate project:", insertErr.message); return null; }

    const { data: outputFiles } = await supabase
      .from('project_output_files')
      .select('file_path, content, is_binary, storage_path')
      .eq('project_id', projectId);

    if (outputFiles?.length && copy) {
      const copies = outputFiles.map((f: { file_path: string; content: string | null; is_binary: boolean; storage_path: string | null }) => ({
        project_id: copy.id,
        file_path: f.file_path,
        content: f.content,
        is_binary: f.is_binary,
        storage_path: f.storage_path,
      }));
      await supabase.from('project_output_files').insert(copies);
    }

    return copy as Project;
  } catch (e) {
    console.warn("duplicateProject error:", e);
    return null;
  }
}
