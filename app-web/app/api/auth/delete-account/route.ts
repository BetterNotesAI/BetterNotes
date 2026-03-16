import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getApiBaseUrl, jsonError } from "../../_proxy";

export async function POST() {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return jsonError(500, "API_BASE_URL is not set.");

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Next.js middleware or server action context might throw if we try to set cookies in some cases
          }
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return jsonError(401, "Not authenticated");
  }

  try {
    const upstream = await fetch(`${baseUrl}/auth/delete-account`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err: any) {
    return jsonError(502, `Backend unreachable: ${err.message}`);
  }
}
