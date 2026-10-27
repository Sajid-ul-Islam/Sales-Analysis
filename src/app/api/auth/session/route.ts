import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
  SessionUser,
} from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!cookieToken) {
    return NextResponse.json({
      authenticated: false,
      user: null,
    });
  }

  const user: SessionUser | null = await verifySessionToken(cookieToken);

  if (!user) {
    return NextResponse.json({
      authenticated: false,
      user: null,
    });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      assignedOutlet: user.assignedOutlet,
      authMethod: user.authMethod,
      expiresAt: user.expiresAt,
    },
  });
}
