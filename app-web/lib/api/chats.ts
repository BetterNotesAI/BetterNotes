import { supabase, getCurrentUser } from "@/lib/supabase";

export async function saveChat(chatData: {
  title?: string;
  template_id?: string;
  latex_content?: string;
  messages: Array<{ role: string; content: string }>;
}): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('chats')
      .insert({
        user_id: user.id,
        title: chatData.title || 'Untitled',
        template_id: chatData.template_id,
        latex_content: chatData.latex_content,
        messages: chatData.messages,
      })
      .select('id')
      .single();
    if (error) { console.warn("Failed to save chat:", error.message); return null; }
    return data.id;
  } catch (e) {
    console.warn("saveChat error:", e);
    return null;
  }
}

export async function updateChat(chatId: string, chatData: {
  title?: string;
  latex_content?: string;
  messages?: Array<{ role: string; content: string }>;
}): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chats')
      .update({ ...chatData, updated_at: new Date().toISOString() })
      .eq('id', chatId);
    if (error) { console.warn("Failed to update chat:", error.message); return false; }
    return true;
  } catch (e) {
    console.warn("updateChat error:", e);
    return false;
  }
}

export async function loadChats(): Promise<Array<{
  id: string; title: string; created_at: string; updated_at: string;
}>> {
  try {
    const { data, error } = await supabase
      .from('chats')
      .select('id, title, created_at, updated_at')
      .order('updated_at', { ascending: false });
    if (error) { console.warn("Failed to load chats:", error.message); return []; }
    return data || [];
  } catch (e) {
    console.warn("loadChats error:", e);
    return [];
  }
}

export async function loadChat(chatId: string): Promise<{
  id: string;
  title: string;
  template_id: string | null;
  latex_content: string | null;
  messages: Array<{ role: string; content: string }>;
} | null> {
  try {
    const { data, error } = await supabase.from('chats').select('*').eq('id', chatId).single();
    if (error) { console.warn("Failed to load chat:", error.message); return null; }
    return data;
  } catch (e) {
    console.warn("loadChat error:", e);
    return null;
  }
}

export async function deleteChat(chatId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('chats').delete().eq('id', chatId);
    if (error) { console.warn("Failed to delete chat:", error.message); return false; }
    return true;
  } catch (e) {
    console.warn("deleteChat error:", e);
    return false;
  }
}

export async function renameChat(chatId: string, newTitle: string): Promise<boolean> {
  return updateChat(chatId, { title: newTitle });
}
