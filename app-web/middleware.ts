import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { computeBillingEligibility, inferEmailVerified } from '@/lib/billing-eligibility'

export async function middleware(request: NextRequest) {
  const { response, user, isAnonymous } = await updateSession(request)

  const path = request.nextUrl.pathname
  const isPublic =
    path.startsWith('/share/') ||
    path.startsWith('/templates/thumbnails/') ||
    path.startsWith('/templates/samples/')

  const isProtected =
    !isPublic && (
      path.startsWith('/documents') ||
      path.startsWith('/settings') ||
      path.startsWith('/profile') ||
      path.startsWith('/support') ||
      path.startsWith('/templates') ||
      path.startsWith('/pricing')
    )

  // /exam/[token] requires auth — redirect with returnUrl so the user comes back after login
  const isExamShare = path.startsWith('/exam/')

  const isAuthRoute =
    path === '/login' ||
    path === '/signup' ||
    path === '/forgot-password' ||
    path === '/reset-password'

  const isBillingGuardedRoute =
    path.startsWith('/pricing') ||
    path.startsWith('/settings/billing')

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isBillingGuardedRoute && user) {
    const hasEmail = typeof user.email === 'string' && user.email.trim().length > 0
    const emailVerified = inferEmailVerified(user)
    const eligibility = computeBillingEligibility({
      hasUser: true,
      isAnonymous,
      hasEmail,
      emailVerified,
    })

    if (!eligibility.eligible) {
      const redirectTarget =
        eligibility.reason === 'unverified_email'
          ? '/login'
          : '/signup'

      const redirectUrl = new URL(redirectTarget, request.url)
      redirectUrl.searchParams.set('returnUrl', path)
      redirectUrl.searchParams.set('reason', eligibility.reason ?? 'billing_account_required')
      return NextResponse.redirect(redirectUrl)
    }
  }

  if (isExamShare && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('returnUrl', path)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthRoute && user && !isAnonymous) {
    return NextResponse.redirect(new URL('/documents', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth/callback|api/stripe|api/share).*)',
  ],
}
