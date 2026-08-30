import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Completely disable authentication requirements
  // Redirect root and login page directly to the dashboard
  if (request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard/live-feed', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/'],
};
