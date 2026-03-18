import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)

  const path = request.nextUrl.pathname
  const isProtected =
    path.startsWith('/documents') ||
    path.startsWith('/settings') ||
    path.startsWith('/templates') ||
    path.startsWith('/pricing')
  const isAuthRoute = path === '/login' || path === '/signup'

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/documents', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth/callback|api/stripe).*)',
  ],
}
