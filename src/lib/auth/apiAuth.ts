import crypto from 'crypto';
import { verifySessionTokenSync, SESSION_COOKIE_NAME } from './session';

export type AuthRole = 'admin' | 'operator' | 'demo' | 'readonly';

export interface AuthValidationResult {
  authenticated: boolean;
  role: AuthRole;
  statusCode: number;
  message: string;
}

export interface AuthOptions {
  requiredRole?: AuthRole;
  allowDemo?: boolean;
  allowCronSecret?: boolean;
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks on secret keys.
 */
function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validates incoming API request credentials against configured server secrets.
 * Infrastructure helper designed to protect synchronization, data, analytics, and AI endpoints.
 */
export function validateApiRequest(
  req: Request,
  options: AuthOptions = { requiredRole: 'operator', allowDemo: false }
): AuthValidationResult {
  const requiredRole: AuthRole = options.requiredRole || (options.allowDemo ? 'readonly' : 'operator');
  const allowDemo = options.allowDemo ?? false;

  const authHeader = req.headers.get('authorization') || '';
  const apiKeyHeader = req.headers.get('x-api-key') || '';

  // Extract Bearer token
  let token = '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  }

  const configuredAdminSecret = process.env.ADMIN_API_SECRET || process.env.INTERNAL_SYNC_SECRET || '';
  const configuredOperatorSecret =
    process.env.API_BEARER_TOKEN ||
    process.env.SYNC_API_TOKEN ||
    process.env.NEXT_PUBLIC_API_BEARER_TOKEN ||
    '';
  const configuredCronSecret = process.env.CRON_SECRET || '';

  // 1. Check Cron Secret match if allowed
  if (options.allowCronSecret && configuredCronSecret && token && safeCompare(token, configuredCronSecret)) {
    return {
      authenticated: true,
      role: 'admin',
      statusCode: 200,
      message: 'Authenticated via Vercel Cron secret.',
    };
  }

  // 2. Check admin token match
  if (configuredAdminSecret && token && safeCompare(token, configuredAdminSecret)) {
    return {
      authenticated: true,
      role: 'admin',
      statusCode: 200,
      message: 'Authenticated as admin.',
    };
  }

  // 3. Check operator token match
  if (configuredOperatorSecret && token && safeCompare(token, configuredOperatorSecret)) {
    if (requiredRole === 'admin') {
      return {
        authenticated: false,
        role: 'operator',
        statusCode: 403,
        message: 'Forbidden: Admin role required for this action.',
      };
    }
    return {
      authenticated: true,
      role: 'operator',
      statusCode: 200,
      message: 'Authenticated as operator.',
    };
  }

    // 4. Check for deen_session cookie if no valid Bearer token provided
  const cookieHeader = req.headers.get('cookie') || '';
  if (cookieHeader.includes(`${SESSION_COOKIE_NAME}=`)) {
    const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    if (match && match[1]) {
      const sessionUser = verifySessionTokenSync(match[1].trim());
      if (sessionUser) {
        if (requiredRole === 'admin' && sessionUser.role !== 'admin') {
          return {
            authenticated: false,
            role: sessionUser.role,
            statusCode: 403,
            message: 'Forbidden: Admin role required for this action.',
          };
        }
        return {
          authenticated: true,
          role: sessionUser.role,
          statusCode: 200,
          message: `Authenticated as ${sessionUser.role} via session cookie.`,
        };
      }
    }
  }

  // 5. Handle Demo mode if explicitly requested
  if (allowDemo) {
    // If the endpoint requires operator or admin privileges, demo role is strictly forbidden!
    if (requiredRole === 'operator' || requiredRole === 'admin') {
      return {
        authenticated: false,
        role: 'demo',
        statusCode: 403,
        message: 'Forbidden: Operator or Admin credentials required. Demo access is restricted from executing live sync or mutation operations.',
      };
    }

    // Read-only or demo-scoped endpoints allow demo role with PII masking
    return {
      authenticated: true,
      role: 'demo',
      statusCode: 200,
      message: 'Demo mode access granted (read-only / restricted PII).',
    };
  }

  // 5. Default: Unauthorized
  return {
    authenticated: false,
    role: 'readonly',
    statusCode: 401,
    message: 'Unauthorized: Invalid or missing API authentication token.',
  };
}
