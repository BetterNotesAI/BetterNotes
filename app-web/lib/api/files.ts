import { supabase } from "@/lib/supabase";

// --- Output files (compiled results) ---

export interface OutputFile {
  id: string;
  project_id: string;
  file_path: string;
  content: string | null;
  is_binary: boolean;
  storage_path: string | null;
  created_at: string;
  updated_at: string;
}

export async function listOutputFiles(projectId: string): Promise<OutputFile[]> {
  try {
    const { data, error } = await supabase
      .from('project_output_files')
      .select('*')
      .eq('project_id', projectId)
      .order('file_path');
    if (error) { console.warn("Failed to list output files:", error.message); return []; }
    return (data || []) as OutputFile[];
  } catch (e) {
    console.warn("listOutputFiles error:", e);
    return [];
  }
}

export async function saveOutputFile(projectId: string, filePath: string, content: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('project_output_files')
      .upsert(
        { project_id: projectId, file_path: filePath, content, is_binary: false },
        { onConflict: 'project_id,file_path' }
      );
    if (error) { console.warn("Failed to save output file:", error.message); return false; }
    return true;
  } catch (e) {
    console.warn("saveOutputFile error:", e);
    return false;
  }
}

export async function getOutputFile(projectId: string, filePath: string): Promise<OutputFile | null> {
  try {
    const { data, error } = await supabase
      .from('project_output_files')
      .select('*')
      .eq('project_id', projectId)
      .eq('file_path', filePath)
      .single();
    if (error) return null;
    return data as OutputFile;
  } catch (e) {
    console.warn("getOutputFile error:", e);
    return null;
  }
}

export async function deleteOutputFile(projectId: string, filePath: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('project_output_files')
      .delete()
      .eq('project_id', projectId)
      .eq('file_path', filePath);
    if (error) { console.warn("Failed to delete output file:", error.message); return false; }
    return true;
  } catch (e) {
    console.warn("deleteOutputFile error:", e);
    return false;
  }
}

// --- Multi-file template initialization ---

/**
 * Seed a multi-file project from a template's scaffold files.
 * Fetches each file from public/templates/ and saves it to project_output_files.
 * Returns array of { filePath, content, dirty } entries for use in the workspace.
 */
export async function initializeMultiFileProject(
  projectId: string,
  scaffoldBasePath: string,
  scaffoldFiles: string[],
): Promise<{ filePath: string; content: string; dirty: boolean }[]> {
  const results: { filePath: string; content: string; dirty: boolean }[] = [];
  for (const relPath of scaffoldFiles) {
    const url = scaffoldBasePath + relPath;
    let content = "";
    try {
      const resp = await fetch(url);
      if (resp.ok) content = await resp.text();
    } catch {
      /* scaffold file not found — seed with empty content */
    }
    await saveOutputFile(projectId, relPath, content);
    results.push({ filePath: relPath, content, dirty: false });
  }
  return results;
}

// --- Project files (user uploads) ---

export interface ProjectFileRecord {
  id: string;
  project_id: string;
  user_id: string;
  parent_folder_id: string | null;
  is_folder: boolean;
  name: string;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
}

export async function listProjectFiles(
  projectId: string,
  parentFolderId?: string | null
): Promise<ProjectFileRecord[]> {
  try {
    let query = supabase
      .from('project_files')
      .select('*')
      .eq('project_id', projectId)
      .order('is_folder', { ascending: false })
      .order('name');
    if (parentFolderId === null) {
      query = query.is('parent_folder_id', null);
    } else if (parentFolderId) {
      query = query.eq('parent_folder_id', parentFolderId);
    }
    const { data, error } = await query;
    if (error) { console.warn("Failed to list project files:", error.message); return []; }
    return (data || []) as ProjectFileRecord[];
  } catch (e) {
    console.warn("listProjectFiles error:", e);
    return [];
  }
}

export async function createProjectFolder(
  projectId: string,
  name: string,
  parentFolderId?: string | null
): Promise<ProjectFileRecord | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('project_files')
      .insert({ project_id: projectId, user_id: user.id, parent_folder_id: parentFolderId || null, is_folder: true, name })
      .select('*')
      .single();
    if (error) { console.warn("Failed to create folder:", error.message); return null; }
    return data as ProjectFileRecord;
  } catch (e) {
    console.warn("createProjectFolder error:", e);
    return null;
  }
}

export async function deleteProjectFile(fileId: string): Promise<boolean> {
  try {
    const { data: file } = await supabase
      .from('project_files')
      .select('storage_path')
      .eq('id', fileId)
      .single();
    if (file?.storage_path) {
      await supabase.storage.from('project-files').remove([file.storage_path]);
    }
    const { error } = await supabase.from('project_files').delete().eq('id', fileId);
    if (error) { console.warn("Failed to delete project file:", error.message); return false; }
    return true;
  } catch (e) {
    console.warn("deleteProjectFile error:", e);
    return false;
  }
}
