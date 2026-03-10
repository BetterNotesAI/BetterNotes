import { supabase, getCurrentUser } from "@/lib/supabase";

export interface UserProfile {
  id: string;
  email: string | null;
  plan: string;
  display_name: string | null;
  avatar_url: string | null;
  university_id: string | null;
  degree_program_id: string | null;
  theme: 'light' | 'dark';
}

export async function getProfile(): Promise<UserProfile | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, plan, display_name, avatar_url, university_id, degree_program_id, theme')
      .eq('id', user.id)
      .single();
    if (error) return null;
    return data as UserProfile;
  } catch (e) {
    console.warn("getProfile error:", e);
    return null;
  }
}

export async function updateProfile(data: {
  display_name?: string;
  avatar_url?: string;
  university_id?: string | null;
  degree_program_id?: string | null;
  theme?: 'light' | 'dark';
}): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from('profiles').update(data).eq('id', user.id);
    if (error) { console.warn("Failed to update profile:", error.message); return false; }
    return true;
  } catch (e) {
    console.warn("updateProfile error:", e);
    return false;
  }
}
