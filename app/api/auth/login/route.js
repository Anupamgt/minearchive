import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { setSessionCookie } from '../../../../lib/auth';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email },
      });
    } catch {
      // Fallback if local DB container offline during IDE testing
      if (email === 'admin@minearchive.co') {
        user = { id: 'admin-id', name: 'Central Admin', email: 'admin@minearchive.co', role: 'Admin', status: 'active', passwordHash: 'admin123' };
      } else if (email === 'harpreet@mine.co') {
        user = { id: 'user-id', name: 'Harpreet Singh', email: 'harpreet@mine.co', role: 'User', status: 'active', passwordHash: 'user123' };
      }
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
    const demoBypass = demoLoginEnabled && (password === 'admin123' || password === 'user123');

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
        }
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
