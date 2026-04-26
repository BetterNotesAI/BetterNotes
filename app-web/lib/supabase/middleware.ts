import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import type { CookieOptions } from '@supabase/ssr'

type CookieToSet = { name: string; value: string; options: CookieOptions }

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set({ name, value, ...options })
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isAnonymous = false
  let termsAcceptedAt: string | null = null
  let onboardingCompletedAt: string | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_anonymous, terms_accepted_at, onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle()

    isAnonymous = Boolean(profile?.is_anonymous)
    termsAcceptedAt = (profile as { terms_accepted_at?: string | null } | null)?.terms_accepted_at ?? null
    onboardingCompletedAt = (profile as { onboarding_completed_at?: string | null } | null)?.onboarding_completed_at ?? null
  }

  return { response: supabaseResponse, user, isAnonymous, termsAcceptedAt, onboardingCompletedAt }
}
