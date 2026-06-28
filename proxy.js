import { NextResponse } from 'next/server';

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('minearchive_session');

  if (!sessionCookie && (pathname.startsWith('/dashboard') || pathname.startsWith('/map') || pathname.startsWith('/upload') || pathname.startsWith('/nodes') || pathname.startsWith('/users') || pathname.startsWith('/audit'))) {
    return NextResponse.next();
  }

  if (sessionCookie && (pathname.startsWith('/nodes') || pathname.startsWith('/users'))) {
    try {
      const decoded = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString('utf8'));
      if (decoded.role && decoded.role.toLowerCase() !== 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }
    } catch {
      // Decode error pass
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
