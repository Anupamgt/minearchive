import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from './lib/auth';

const PROTECTED_PREFIXES = ['/dashboard', '/map', '/upload', '/nodes', '/users', '/audit'];
const ADMIN_ONLY_PREFIXES = ['/nodes', '/users', '/audit'];

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE);
  const session = sessionCookie ? await verifySessionToken(sessionCookie.value) : null;

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('error', 'Please sign in to continue.');
    return NextResponse.redirect(url);
  }

  const isAdminOnly = ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isAdminOnly && (!session.role || session.role.toLowerCase() !== 'admin')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
