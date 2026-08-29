import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get('auth');
  
  if (request.nextUrl.pathname.startsWith('/dashboard') && !authCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  if (request.nextUrl.pathname === '/login' && authCookie) {
    return NextResponse.redirect(new URL('/dashboard/live-feed', request.url));
  }
  
  // Also protect the root route, sending them to login or dashboard
  if (request.nextUrl.pathname === '/') {
    if (authCookie) {
      return NextResponse.redirect(new URL('/dashboard/live-feed', request.url));
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/'],
};
