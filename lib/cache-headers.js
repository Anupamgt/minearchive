import { NextResponse } from 'next/server';

/** Auth-gated JSON: never put on the public CDN. */
export function privateJson(data, init = {}) {
  const response = NextResponse.json(data, init);
  response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  response.headers.set('Vary', 'Cookie');
  return response;
}

/** Health / probes: always fresh. */
export function noStoreJson(data, init = {}) {
  const response = NextResponse.json(data, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

/**
 * No-op kept for API compatibility with the route handlers.
 *
 * The list queries in lib/cached-queries.js now read from the database directly
 * (see the explanation there), so there is no tagged Data Cache to invalidate
 * after a mutation. Route handlers can keep calling bustTags(...) harmlessly.
 * Using Next.js 16's `revalidateTag(tag, 'max')` here was stale-while-revalidate
 * and broke read-after-write consistency (newly created rows only appeared on a
 * later refresh).
 */
export function bustTags() {}
