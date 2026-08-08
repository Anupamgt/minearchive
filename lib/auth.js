import { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'minearchive_session';
export const OAUTH_STATE_COOKIE = 'minearchive_oauth_state';

// --- base64url helpers (work identically in Node.js and Edge runtime) ---

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// --- HMAC signing (Web Crypto API — available in both Node.js and Edge) ---

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is not set. Add a long random value to your environment variables.');
  }
  return secret;
}

async function importHmacKey() {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function sign(payloadBase64Url) {
  const key = await importHmacKey();
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadBase64Url));
  return bytesToBase64Url(new Uint8Array(signatureBuffer));
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// --- Session token: `${base64url(payload)}.${base64url(hmac signature)}` ---

export async function createSessionToken(user) {
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  const payloadBase64Url = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(payloadBase64Url);
  return `${payloadBase64Url}.${signature}`;
}

export async function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [payloadBase64Url, signature] = token.split('.');
  if (!payloadBase64Url || !signature) return null;

  try {
    const expectedSignature = await sign(payloadBase64Url);
    if (!constantTimeEqual(expectedSignature, signature)) return null;

    const json = new TextDecoder().decode(base64UrlToBytes(payloadBase64Url));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function getSessionUser(request) {
  const cookie = request.cookies.get(SESSION_COOKIE);
  if (!cookie) return null;
  return verifySessionToken(cookie.value);
}

export function unauthorizedResponse(message = 'Authentication required.') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = 'Admin access required.') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function setSessionCookie(response, user) {
  const token = await createSessionToken(user);
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: false, // demo: client components read role for UI; the signature above prevents forging it
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}

export function clearOAuthStateCookie(response) {
  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: '',
    path: '/',
    maxAge: 0,
  });
  return response;
}

export function redirectWithError(request, message) {
  const url = new URL('/login', request.url);
  url.searchParams.set('error', message);
  const response = NextResponse.redirect(url);
  clearOAuthStateCookie(response);
  return response;
}

export function isAdminEmail(email) {
  const configured = process.env.GOOGLE_ADMIN_EMAILS || '';
  const allowlist = configured
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(String(email || '').toLowerCase());
}

/**
 * Resolve the Google OAuth redirect URI for the current request.
 * On deployed hosts (e.g. *.vercel.app), always use the request origin so a
 * stale GOOGLE_REDIRECT_URI=http://localhost:3000/... cannot break production.
 */
export function resolveGoogleRedirectUri(request) {
  const origin = new URL(request.url).origin;
  const isLocal =
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.startsWith('http://0.0.0.0');

  if (!isLocal) {
    return `${origin}/api/auth/callback/google`;
  }

  return (
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/google`
  );
}
