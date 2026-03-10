import { supabase } from "@/lib/supabase";

export interface University {
  id: string;
  name: string;
  short_name: string | null;
  city: string | null;
  country: string;
  logo_url: string | null;
}

export interface DegreeProgram {
  id: string;
  university_id: string;
  name: string;
  degree_type: 'grado' | 'master' | 'doctorado' | null;
  years: number;
}

export interface Subject {
  id: string;
  program_id: string;
  name: string;
  year: number | null;
  semester: number | null;
}

export interface PublishedDocument {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  pdf_url: string | null;
  thumbnail_url: string | null;
  avg_rating: number;
  rating_count: number;
  view_count: number;
  created_at: string;
  user_display_name: string | null;
  user_avatar_url: string | null;
  university_name: string | null;
  subject_name: string | null;
}

export async function listUniversities(): Promise<University[]> {
  try {
    const { data, error } = await supabase.from('universities').select('*').order('name');
    if (error) return [];
    return (data || []) as University[];
  } catch (e) {
    console.warn("listUniversities error:", e);
    return [];
  }
}

export async function listPrograms(universityId: string): Promise<DegreeProgram[]> {
  try {
    const { data, error } = await supabase.from('degree_programs').select('*').eq('university_id', universityId).order('name');
    if (error) return [];
    return (data || []) as DegreeProgram[];
  } catch (e) {
    console.warn("listPrograms error:", e);
    return [];
  }
}

export async function listSubjects(programId: string): Promise<Subject[]> {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('program_id', programId)
      .order('year')
      .order('semester')
      .order('name');
    if (error) return [];
    return (data || []) as Subject[];
  } catch (e) {
    console.warn("listSubjects error:", e);
    return [];
  }
}

export async function searchDocuments(query: string, limit = 20, offset = 0): Promise<PublishedDocument[]> {
  try {
    const { data, error } = await supabase.rpc('search_published_documents', {
      p_query: query, p_limit: limit, p_offset: offset,
    });
    if (error) { console.warn("searchDocuments error:", error.message); return []; }
    return (data || []) as PublishedDocument[];
  } catch (e) {
    console.warn("searchDocuments error:", e);
    return [];
  }
}

export async function publishDocument(data: {
  project_id: string;
  subject_id?: string;
  category?: string;
  title: string;
  description?: string;
  tags?: string[];
  pdf_url?: string;
  thumbnail_url?: string;
}): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: doc, error } = await supabase
      .from('published_documents')
      .insert({ ...data, user_id: user.id, subject_id: data.subject_id || null })
      .select('id')
      .single();
    if (error) { console.warn("Failed to publish document:", error.message); return null; }
    return doc.id;
  } catch (e) {
    console.warn("publishDocument error:", e);
    return null;
  }
}

export async function rateDocument(documentId: string, rating: number): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase
      .from('document_ratings')
      .upsert(
        { document_id: documentId, user_id: user.id, rating: Math.min(5, Math.max(1, Math.round(rating))) },
        { onConflict: 'document_id,user_id' }
      );
    if (error) { console.warn("Failed to rate document:", error.message); return false; }
    return true;
  } catch (e) {
    console.warn("rateDocument error:", e);
    return false;
  }
}
