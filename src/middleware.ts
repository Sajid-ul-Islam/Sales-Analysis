import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from '@/lib/auth/session';

// Routes that do NOT require authentication
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/session',
  '/api/auth/logout',
  '/api/sync/pathao/webhook', // Inbound courier webhook handshake
  '/api/sync/woocommerce/webhook', // Inbound WooCommerce webhook handshake
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Skip static assets, Next internal files, and favicon
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // Static files: .png, .ico, .css, .js
  ) {
    return NextResponse.next();
  }

  // 1.1 Edge Circuit Breaker: Block oversized request bodies
  // Automated sync/AI routes capped at 500 KB to eliminate Fast Origin Transfer spikes.
  // Manual admin cloud dataset uploads (/api/blob/dataset) capped at Vercel function ceiling (4.5 MB).
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentLength = req.headers.get('content-length');
    if (contentLength) {
      const bytes = parseInt(contentLength, 10);
      const isManualBlobUpload = pathname === '/api/blob/dataset';
      const maxAllowedBytes = isManualBlobUpload ? 4.5 * 1024 * 1024 : 500 * 1024;

      if (bytes > maxAllowedBytes) {
        return NextResponse.json(
          {
            success: false,
            error: `Payload Too Large: Fast Origin Transfer circuit breaker engaged (Max ${isManualBlobUpload ? '4.5 MB' : '500 KB'}).`,
          },
          { status: 413 }
        );
      }
    }
  }

  // 2. Check if the path is explicitly public
  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  let isValidSession = false;

  if (sessionCookie) {
    const user = await verifySessionToken(sessionCookie);
    if (user) {
      isValidSession = true;
    }
  }

  // 3. User is authenticated and trying to access /login -> Redirect to dashboard
  if (isValidSession && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // 4. Public paths are allowed without authentication
  if (isPublicPath) {
    return NextResponse.next();
  }

  // 5. Protected API routes (/api/*)
  if (pathname.startsWith('/api/')) {
    // If bearer token or x-api-key is present, let it pass to validateApiRequest
    const authHeader = req.headers.get('authorization') || '';
    const apiKeyHeader = req.headers.get('x-api-key') || '';
    if (authHeader.startsWith('Bearer ') || apiKeyHeader) {
      return NextResponse.next();
    }

    // Otherwise, check session cookie
    if (!isValidSession) {
      return NextResponse.json(
        {
          success: false,
          statusCode: 401,
          message: 'Unauthorized: Valid session cookie or Bearer token required.',
        },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  // 6. Protected Page routes (e.g. /) -> Redirect to /login
  if (!isValidSession) {
    const loginUrl = new URL('/login', req.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
