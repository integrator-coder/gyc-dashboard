import { NextResponse } from 'next/server'

const SESSION_COOKIE = 'gyc_session'

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/favicon.ico',
]

export function middleware(request) {
  const { pathname } = request.nextUrl

  // Allow Next.js internals and static files
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/static/') ||
    PUBLIC_PATHS.includes(pathname)
  ) {
    return NextResponse.next()
  }

  // Check for session cookie
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value

  if (!sessionToken) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('message', 'Please log in to continue.')
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - api/auth/* (auth endpoints must remain public)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth/).*)',
  ],
}
