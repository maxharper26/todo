import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth', '/_next', '/favicon.ico'];
const COOKIE_NAME = 'auth';
const COOKIE_VALUE = 'ok';

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Allow public paths and static assets
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME);
  if (cookie?.value === COOKIE_VALUE) {
    return NextResponse.next();
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
