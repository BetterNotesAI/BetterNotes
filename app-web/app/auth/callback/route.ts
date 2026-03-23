import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/home'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }

    // If the user was heading to reset-password but the code is invalid/expired,
    // redirect them back to forgot-password with a contextual error.
    if (next === '/reset-password') {
      return NextResponse.redirect(`${origin}/forgot-password?error=link_expired`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
