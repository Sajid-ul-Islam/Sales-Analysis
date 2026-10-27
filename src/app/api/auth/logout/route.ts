import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';

export async function POST(_req?: Request) {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieOptions = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0',
    ...(isProd ? ['Secure'] : []),
  ].join('; ');

  const res = NextResponse.json({
    success: true,
    message: 'Logged out successfully.',
  });

  res.headers.set('Set-Cookie', cookieOptions);
  return res;
}
