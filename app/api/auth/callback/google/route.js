import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import {
  OAUTH_STATE_COOKIE,
  clearOAuthStateCookie,
  isAdminEmail,
  redirectWithError,
  setSessionCookie,
} from '../../../../../lib/auth';

async function exchangeCodeForTokens(code, redirectUri) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!tokenRes.ok) {
    const detail = await tokenRes.text();
    throw new Error(`Token exchange failed: ${detail}`);
  }

  return tokenRes.json();
}

async function fetchGoogleProfile(accessToken) {
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!profileRes.ok) {
    const detail = await profileRes.text();
    throw new Error(`Profile fetch failed: ${detail}`);
  }

  return profileRes.json();
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return redirectWithError(request, `Google sign-in cancelled (${oauthError}).`);
  }

  if (!code || !state) {
    return redirectWithError(request, 'Missing Google OAuth code or state.');
  }

  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!expectedState || expectedState !== state) {
    return redirectWithError(request, 'Invalid OAuth state. Please try again.');
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return redirectWithError(request, 'Google OAuth is not configured on the server.');
  }

  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/google`;

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const profile = await fetchGoogleProfile(tokens.access_token);

    if (!profile.email) {
      return redirectWithError(request, 'Google account did not return an email address.');
    }

    if (profile.email_verified === false) {
      return redirectWithError(request, 'Google email is not verified.');
    }

    const email = profile.email.toLowerCase();
    const name = profile.name || email.split('@')[0];

    let user;
    try {
      user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        user = await prisma.user.create({
          data: {
            name,
            email,
            passwordHash: null,
            role: isAdminEmail(email) ? 'Admin' : 'User',
            status: 'active',
            lastLogin: new Date(),
          },
        });
      } else {
        if (user.status !== 'active') {
          return redirectWithError(request, 'Account is disabled.');
        }

        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: user.name || name,
            lastLogin: new Date(),
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'Login',
          details: `Successful Google OAuth session (${user.role})`,
        },
      });
    } catch {
      // Local DB offline fallback — still allow demo Google session
      user = {
        id: `google-${Buffer.from(email).toString('hex').slice(0, 12)}`,
        name,
        email,
        role: isAdminEmail(email) ? 'Admin' : 'User',
        status: 'active',
      };
    }

    const response = NextResponse.redirect(new URL('/dashboard', request.url));
    await setSessionCookie(response, user);
    clearOAuthStateCookie(response);
    return response;
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return redirectWithError(request, 'Google sign-in failed. Please try again.');
  }
}
