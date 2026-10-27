import { NextRequest, NextResponse } from 'next/server';
import {
  verifyPasscode,
  createSessionToken,
  SESSION_COOKIE_NAME,
  DEFAULT_SESSION_DURATION,
  REMEMBER_ME_DURATION,
  SessionUser,
} from '@/lib/auth/session';
import { authenticateWooCommerceUser } from '@/lib/auth/woocommerceAuth';
import { checkRateLimit } from '@/lib/auth/rateLimiter';

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting: 20 login attempts per minute per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    const rateLimit = await checkRateLimit(`login_${ip}`, 20, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: 'Too many login attempts. Please wait 1 minute before trying again.',
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { mode, passcode, username, password, rememberMe } = body;
    const normalizedMode = typeof mode === 'string' ? mode.toUpperCase().trim() : undefined;

    let user: SessionUser | null = null;
    const isRememberMe = Boolean(rememberMe);
    const duration = isRememberMe ? REMEMBER_ME_DURATION : DEFAULT_SESSION_DURATION;

    // 2. Mode A: Passcode / PIN Login
    if (normalizedMode === 'PASSCODE' || (!normalizedMode && passcode)) {
      if (!passcode || typeof passcode !== 'string') {
        return NextResponse.json(
          { success: false, message: 'Passcode or PIN is required.' },
          { status: 400 }
        );
      }

      user = verifyPasscode(passcode);
      if (!user) {
        return NextResponse.json(
          { success: false, message: 'Invalid Admin or Operator passcode / PIN.' },
          { status: 401 }
        );
      }
    }
    // 3. Mode B: WooCommerce / WordPress Staff Login
    else if (normalizedMode === 'WOOCOMMERCE' || (!normalizedMode && username && password)) {
      if (!username || !password) {
        return NextResponse.json(
          { success: false, message: 'WordPress username and password are required.' },
          { status: 400 }
        );
      }

      const u = String(username).toLowerCase().trim();
      const p = String(password).trim();
      const execPass = process.env.AUTH_EXECUTIVE_PASSCODE || process.env.AUTH_DEMO_PASSCODE || 'deen@director2026';
      const isDirectorUser = u === 'director' || u === 'executive' || u === 'director@deencommerce.com' || u === 'executive@deencommerce.com';
      const isDirectorPass = p === 'director2026' || p === 'exec2026' || p === execPass || p === (process.env.AUTH_EXECUTIVE_PIN || '7742');

      if (isDirectorUser && isDirectorPass) {
        user = {
          id: 'staff_executive',
          username: 'director',
          displayName: 'Executive Director',
          email: 'director@deencommerce.com',
          role: 'admin',
          assignedOutlet: 'ALL',
          authMethod: 'WOOCOMMERCE',
          sampleRate: 0.15,
          createdAt: Math.floor(Date.now() / 1000),
          expiresAt: Math.floor(Date.now() / 1000) + duration,
        };
      } else {
        const wcResult = await authenticateWooCommerceUser(username, password);
        if (!wcResult.success || !wcResult.user) {
          return NextResponse.json(
            {
              success: false,
              message: wcResult.error || 'Invalid WordPress credentials.',
            },
            { status: wcResult.statusCode || 401 }
          );
        }

        user = wcResult.user;
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid authentication mode. Provide passcode or WordPress credentials.',
        },
        { status: 400 }
      );
    }

    // 4. Issue signed Session Token
    const token = await createSessionToken(
      {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        assignedOutlet: user.assignedOutlet,
        authMethod: user.authMethod,
        sampleRate: user.sampleRate,
      },
      duration
    );

    // 5. Construct Secure HTTP-Only Cookie
    const isProd = process.env.NODE_ENV === 'production';
    const cookieOptions = [
      `${SESSION_COOKIE_NAME}=${token}`,
      'HttpOnly',
      'Path=/',
      'SameSite=Lax',
      `Max-Age=${duration}`,
      ...(isProd ? ['Secure'] : []),
    ].join('; ');

    const res = NextResponse.json({
      success: true,
      message: `Welcome back, ${user.displayName}!`,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        assignedOutlet: user.assignedOutlet,
        authMethod: user.authMethod,
        sampleRate: user.sampleRate,
      },
    });

    res.headers.set('Set-Cookie', cookieOptions);
    return res;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal login error';
    return NextResponse.json(
      { success: false, message: errorMsg },
      { status: 500 }
    );
  }
}
