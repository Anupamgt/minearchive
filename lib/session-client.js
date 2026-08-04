'use client';

// Client-safe helper to read the display payload out of the signed session
// cookie. This does NOT verify the HMAC signature — that verification only
// happens server-side (see lib/auth.js + proxy.js). This is fine because it
// is only used to decide what to *render* (name/role badges); every actual
// authorization decision is enforced server-side.
export function readSessionFromCookie() {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.match(/(?:^|; )minearchive_session=([^;]*)/);
  if (!match) return null;

  const value = decodeURIComponent(match[1]);
  const [payloadBase64Url] = value.split('.');
  if (!payloadBase64Url) return null;

  try {
    const base64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
}
