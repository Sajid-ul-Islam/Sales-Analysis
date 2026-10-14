import crypto from 'crypto';

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
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks on secret keys.
 */
function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validates incoming API request credentials against configured server secrets.
 * Infrastructure helper designed to protect synchronization and data endpoints.
 */
export function validateApiRequest(
  req: Request,
  options: AuthOptions = { requiredRole: 'operator', allowDemo: true }
): AuthValidationResult {
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
  const configuredOperatorSecret = process.env.API_BEARER_TOKEN || process.env.SYNC_API_TOKEN || '';

  // Check admin token match
  if (configuredAdminSecret && token && safeCompare(token, configuredAdminSecret)) {
    return {
      authenticated: true,
      role: 'admin',
      statusCode: 200,
      message: 'Authenticated as admin.',
    };
  }

  // Check operator token match
  if (configuredOperatorSecret && token && safeCompare(token, configuredOperatorSecret)) {
    if (options.requiredRole === 'admin') {
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

  // Allow unauthenticated demo access in development if explicitly permitted
  const isDev = process.env.NODE_ENV !== 'production';
  if (options.allowDemo || isDev) {
    return {
      authenticated: true,
      role: 'demo',
      statusCode: 200,
      message: 'Demo mode access granted (read-only / restricted).',
    };
  }

  return {
    authenticated: false,
    role: 'readonly',
    statusCode: 401,
    message: 'Unauthorized: Invalid or missing API authentication token.',
  };
}
