/**
 * WooCommerce / WordPress Staff Authentication Engine
 * Authenticates store managers and outlet cashiers against production WordPress/WooCommerce.
 */

import { SessionUser, DEFAULT_SESSION_DURATION } from './session';

export interface WcAuthResult {
  success: boolean;
  user?: SessionUser;
  error?: string;
  statusCode?: number;
}

/**
 * Maps WordPress cashier user IDs or usernames to their respective physical retail outlets.
 * - Mirpur: Outlet 2, Cashier ID 3
 * - Cumilla: Outlet 7, Cashier ID 35
 * - Wari: Outlet 8, Cashier ID 69
 * - Sylhet: Outlet 9, Cashier ID 572
 */
export function mapWcUserToOutletAndRole(
  wpUserId: string | number,
  rawUsername: string,
  roles: string[] = []
): {
  role: 'admin' | 'operator' | 'readonly';
  assignedOutlet: 'ALL' | 'MIRPUR' | 'CUMILLA' | 'WARI' | 'SYLHET';
  displayName: string;
} {
  const u = rawUsername.toLowerCase().trim();
  const idStr = String(wpUserId).trim();

  // 1. Mirpur Outlet POS (Outlet ID 2, Cashier ID 3)
  if (idStr === '3' || u.includes('mirpur')) {
    return {
      role: 'operator',
      assignedOutlet: 'MIRPUR',
      displayName: 'Mirpur Cashier',
    };
  }

  // 2. Cumilla Branch (Outlet ID 7, Cashier ID 35)
  if (idStr === '35' || u.includes('cumilla') || u.includes('comilla')) {
    return {
      role: 'operator',
      assignedOutlet: 'CUMILLA',
      displayName: 'Cumilla Cashier',
    };
  }

  // 3. Wari Branch (Outlet ID 8, Cashier ID 69)
  if (idStr === '69' || u.includes('wari')) {
    return {
      role: 'operator',
      assignedOutlet: 'WARI',
      displayName: 'Wari Cashier',
    };
  }

  // 4. Sylhet Branch (Outlet ID 9, Cashier ID 572)
  if (idStr === '572' || u.includes('sylhet')) {
    return {
      role: 'operator',
      assignedOutlet: 'SYLHET',
      displayName: 'Sylhet Cashier',
    };
  }

  // 5. Store Founder & Administrator (Sajid Islam: sazid / sajid / sazid@deencommerce.com)
  const isSajid =
    u === 'sazid' ||
    u === 'sajid' ||
    u === 'sazid islam' ||
    u === 'sajid islam' ||
    u.startsWith('sazid@') ||
    u.startsWith('sajid@') ||
    u.includes('sazid@deencommerce.com') ||
    u.includes('sajid@deencommerce.com') ||
    u.startsWith('sazid_') ||
    u.startsWith('sajid_') ||
    u === 'sazid.islam' ||
    u === 'sajid.islam';

  if (isSajid) {
    return {
      role: 'admin',
      assignedOutlet: 'ALL',
      displayName: 'Sajid Islam',
    };
  }

  // 6. Central Leadership & Store Administrator
  const isAdmin =
    roles.includes('administrator') ||
    roles.includes('shop_manager') ||
    u.includes('admin') ||
    u.includes('tajastore');

  if (isAdmin) {
    return {
      role: 'admin',
      assignedOutlet: 'ALL',
      displayName: 'Operations Admin',
    };
  }

  // 7. Generic Staff
  return {
    role: 'operator',
    assignedOutlet: 'ALL',
    displayName: rawUsername || 'DEEN Staff',
  };
}

/**
 * Authenticates staff credentials against WordPress / WooCommerce.
 */
export async function authenticateWooCommerceUser(
  usernameOrEmail: string,
  password: string,
  options?: { storeUrl?: string; timeoutMs?: number }
): Promise<WcAuthResult> {
  const cleanUser = usernameOrEmail?.trim();
  if (!cleanUser || !password) {
    return {
      success: false,
      error: 'Username and password are required.',
      statusCode: 400,
    };
  }

  const storeUrl =
    options?.storeUrl ||
    process.env.WOOCOMMERCE_STORE_URL ||
    'https://deencommerce.com';
  const timeoutMs = options?.timeoutMs || 10000;

  try {
    // Strategy A: Standard WordPress wp-login.php authentication
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const loginRes = await fetch(`${storeUrl}/wp-login.php`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'DEEN-Commerce-Auth-Agent/2.0',
      },
      body: new URLSearchParams({
        log: cleanUser,
        pwd: password,
        rememberme: 'forever',
        'wp-submit': 'Log In',
      }).toString(),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    // WordPress returns 302 Found redirect to /wp-admin/ on success
    if (loginRes.status === 302) {
      // Extract logged-in cookie or username
      const setCookie =
        loginRes.headers.get('set-cookie') ||
        loginRes.headers.get('Set-Cookie') ||
        '';

      let extractedUsername = cleanUser;
      const wpUserId = 'wp_user';

      const match = setCookie.match(/wordpress_logged_in_[a-f0-9]+=([^%|;]+)/i);
      if (match && match[1]) {
        try {
          extractedUsername = decodeURIComponent(match[1]);
        } catch {}
      }

      let mapping = mapWcUserToOutletAndRole(wpUserId, extractedUsername);
      // If extracted username mapped to operator but input username/email was admin/sajid, prefer the higher role
      if (mapping.role === 'operator' && cleanUser.toLowerCase() !== extractedUsername.toLowerCase()) {
        const altMapping = mapWcUserToOutletAndRole(wpUserId, cleanUser);
        if (altMapping.role === 'admin') {
          mapping = altMapping;
        }
      }
      const now = Math.floor(Date.now() / 1000);

      const resolvedEmail = cleanUser.includes('@')
        ? cleanUser.toLowerCase()
        : mapping.displayName === 'Sajid Islam'
        ? 'sazid@deencommerce.com'
        : undefined;

      const sessionUser: SessionUser = {
        id: `wp_${extractedUsername.toLowerCase()}`,
        username: extractedUsername,
        displayName: mapping.displayName,
        email: resolvedEmail,
        role: mapping.role,
        assignedOutlet: mapping.assignedOutlet,
        authMethod: 'WOOCOMMERCE',
        createdAt: now,
        expiresAt: now + DEFAULT_SESSION_DURATION,
      };

      return {
        success: true,
        user: sessionUser,
        statusCode: 200,
      };
    }

    // Strategy B: If wp-login didn't redirect, check Application Password via /wp/v2/users/me
    const basicAuth = Buffer.from(`${cleanUser}:${password}`).toString('base64');
    const apiRes = await fetch(`${storeUrl}/wp-json/wp/v2/users/me`, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'User-Agent': 'DEEN-Commerce-Auth-Agent/2.0',
      },
    });

    if (apiRes.ok) {
      const wpUser = await apiRes.json();
      const roles: string[] = Array.isArray(wpUser.roles) ? wpUser.roles : [];
      const mapping = mapWcUserToOutletAndRole(
        wpUser.id || 'wp_user',
        wpUser.slug || wpUser.name || cleanUser,
        roles
      );
      const now = Math.floor(Date.now() / 1000);

      const resolvedName =
        wpUser.name && wpUser.name.toLowerCase() !== String(wpUser.slug || '').toLowerCase()
          ? wpUser.name
          : mapping.displayName;

      const sessionUser: SessionUser = {
        id: `wp_${wpUser.id || cleanUser}`,
        username: wpUser.slug || cleanUser,
        displayName: resolvedName,
        email: wpUser.email || (mapping.displayName === 'Sajid Islam' ? 'sazid@deencommerce.com' : undefined),
        role: mapping.role,
        assignedOutlet: mapping.assignedOutlet,
        authMethod: 'WOOCOMMERCE',
        createdAt: now,
        expiresAt: now + DEFAULT_SESSION_DURATION,
      };

      return {
        success: true,
        user: sessionUser,
        statusCode: 200,
      };
    }

    return {
      success: false,
      error: 'Invalid WordPress / WooCommerce username or password.',
      statusCode: 401,
    };
  } catch (err) {
    const isAbort =
      err instanceof Error &&
      (err.name === 'AbortError' || err.message.includes('aborted'));
    return {
      success: false,
      error: isAbort
        ? 'Authentication timed out contacting deencommerce.com.'
        : 'Network error connecting to WordPress authentication server.',
      statusCode: 504,
    };
  }
}
