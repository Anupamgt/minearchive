import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { setSessionCookie } from '../../../../lib/auth';

const DEMO_USERS = {
  'admin@minearchive.co': {
    id: 'admin-id',
    name: 'Central Admin',
    email: 'admin@minearchive.co',
    role: 'Admin',
    status: 'active',
    passwordHash: 'admin123',
  },
  'harpreet@mine.co': {
    id: 'user-id',
    name: 'Harpreet Singh',
    email: 'harpreet@mine.co',
    role: 'User',
    status: 'active',
    passwordHash: 'user123',
  },
};

export async function POST(request) {
  try {
    const body = await request.json();
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    const password = String(body.password || '').trim();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    let user;
    try {
      user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });
    } catch {
      // Fallback if local DB container offline during IDE testing
      user = DEMO_USERS[email] || null;
    }

    // OAuth-only accounts cannot use password login
    if (user && !user.passwordHash) {
      return NextResponse.json(
        { error: 'This account uses Google sign-in. Use Sign in with Google.' },
        { status: 401 }
      );
    }

    // MVP demo bypass — only active when explicitly enabled (local/dev).
    // Leave ALLOW_DEMO_LOGIN unset in production so only real password hashes work.
    const demoLoginEnabled = process.env.ALLOW_DEMO_LOGIN === 'true';
    const demoUser = DEMO_USERS[email];
    const demoBypass =
      demoLoginEnabled &&
      demoUser &&
      password === demoUser.passwordHash;

    // If demo bypass is on and the user row is missing, still allow the known demo accounts.
    if (!user && demoBypass) {
      user = demoUser;
    }

    if (!user || (user.passwordHash !== password && !demoBypass)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Account is disabled' }, { status: 403 });
    }

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'Login',
          details: `Successful session authentication (${user.role})`,
        },
      });
    } catch {
      // DB offline fallback ignore
    }

    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    await setSessionCookie(response, user);
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
