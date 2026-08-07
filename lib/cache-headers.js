import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

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

/** Mark tagged Data Cache entries stale (SWR). */
export function bustTags(...tags) {
  for (const tag of tags) {
    revalidateTag(tag, 'max');
  }
}
