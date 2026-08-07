import { NextRequest, NextResponse } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function trustedOrigins(request: NextRequest) {
  const origins = new Set([request.nextUrl.origin]);
  for (const value of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.ALLOWED_ORIGINS,
  ]) {
    for (const origin of value?.split(',') ?? []) {
      const trimmed = origin.trim();
      if (trimmed) origins.add(trimmed.replace(/\/$/, ''));
    }
  }
  return origins;
}

/** Reject browser cross-site mutations before they reach cookie-authenticated APIs. */
export function proxy(request: NextRequest) {
  if (
    SAFE_METHODS.has(request.method) ||
    request.nextUrl.pathname.startsWith('/api/webhooks/')
  ) {
    return NextResponse.next();
  }

  const fetchSite = request.headers.get('sec-fetch-site');
  const origin = request.headers.get('origin')?.replace(/\/$/, '');
  if (
    fetchSite === 'cross-site' ||
    (origin !== undefined && !trustedOrigins(request).has(origin))
  ) {
    return NextResponse.json(
      { error: 'Cross-site request rejected', code: 'CSRF_REJECTED' },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = { matcher: '/api/:path*' };
