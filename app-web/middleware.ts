import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)

  const path = request.nextUrl.pathname
  const isPublic =
    path.startsWith('/share/')

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

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isExamShare && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('returnUrl', path)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/documents', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth/callback|api/stripe|api/share).*)',
  ],
}
