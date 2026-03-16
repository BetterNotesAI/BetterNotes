import { supabase } from "@/lib/supabase";

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export async function listFolders(): Promise<Folder[]> {
  try {
    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .order("name", { ascending: true });
    if (error) { console.warn("Failed to list folders:", error.message); return []; }
    return (data || []) as Folder[];
  } catch (e) {
    console.warn("listFolders error:", e);
    return [];
  }
}

export async function createFolder(name: string): Promise<Folder | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("folders")
      .insert({ user_id: user.id, name: name.trim() })
      .select("*")
      .single();
    if (error) { console.warn("Failed to create folder:", error.message); return null; }
    return data as Folder;
  } catch (e) {
    console.warn("createFolder error:", e);
    return null;
  }
}

export async function renameFolder(folderId: string, name: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("folders")
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq("id", folderId);
    if (error) { console.warn("Failed to rename folder:", error.message); return false; }
    return true;
  } catch (e) {
    console.warn("renameFolder error:", e);
    return false;
  }
}

export async function deleteFolder(folderId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("folders").delete().eq("id", folderId);
    if (error) { console.warn("Failed to delete folder:", error.message); return false; }
    return true;
  } catch (e) {
    console.warn("deleteFolder error:", e);
    return false;
  }
}
