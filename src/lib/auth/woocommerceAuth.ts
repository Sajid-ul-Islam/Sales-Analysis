/**
 * WooCommerce / WordPress Staff Authentication Engine
 * Authenticates store managers and outlet cashiers against production WordPress/WooCommerce.
 */

import { SessionUser, DEFAULT_SESSION_DURATION } from './session';
import { getSecretsWithOverrides } from '@/lib/secrets';

export interface WcAuthResult {
  success: boolean;
  user?: SessionUser;
  error?: string;
  statusCode?: number;
}

export interface WcUserProfile {
  id: number | string;
  username: string;
  displayName: string;
  email?: string;
  role: 'admin' | 'operator' | 'readonly';
  assignedOutlet: 'ALL' | 'MIRPUR' | 'CUMILLA' | 'WARI' | 'SYLHET';
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

  // 5. Store Founder & Administrator (Sajid Islam: sazid / sajid / sazid@deencommerce.com / ID 1507)
  const isSajid =
    idStr === '1507' ||
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
 * Fetches actual staff profile directly from WooCommerce REST API (/wp-json/wc/v3/customers).
 * Resolves real full names (first_name + last_name) and official store roles from WordPress.
 */
export async function fetchWcUserProfile(
  identifier: string | number,
  options?: { storeUrl?: string; timeoutMs?: number }
): Promise<WcUserProfile | null> {
  try {
    const { woocommerce: wc } = getSecretsWithOverrides();
    const storeUrl =
      options?.storeUrl ||
      wc.store_url ||
      process.env.WOOCOMMERCE_STORE_URL ||
      'https://deencommerce.com';

    if (!wc.consumer_key || !wc.consumer_secret) {
      return null;
    }

    const auth = Buffer.from(`${wc.consumer_key}:${wc.consumer_secret}`).toString('base64');
    const headers = {
      Authorization: `Basic ${auth}`,
      'User-Agent': 'DEEN-Commerce-Auth-Agent/2.0',
    };
    const timeoutMs = options?.timeoutMs || 4000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const idStr = String(identifier).trim();
    const isNumericId = /^\d+$/.test(idStr);

    let customer: any = null;

    if (isNumericId) {
      try {
        const res = await fetch(`${storeUrl.replace(/\/+$/, '')}/wp-json/wc/v3/customers/${idStr}`, {
          headers,
          signal: controller.signal,
        });
        if (res.ok) {
          customer = await res.json();
        }
      } catch {}
    }

    if (!customer && idStr.includes('@')) {
      try {
        const res = await fetch(
          `${storeUrl.replace(/\/+$/, '')}/wp-json/wc/v3/customers?email=${encodeURIComponent(idStr)}&role=all`,
          { headers, signal: controller.signal }
        );
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            customer = list[0];
          }
        }
      } catch {}
    }

    if (!customer) {
      try {
        const res = await fetch(
          `${storeUrl.replace(/\/+$/, '')}/wp-json/wc/v3/customers?search=${encodeURIComponent(idStr)}&role=all`,
          { headers, signal: controller.signal }
        );
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            const q = idStr.toLowerCase();
            const exact = list.find((c: any) => c.email?.toLowerCase() === q || c.username?.toLowerCase() === q);
            if (exact) {
              customer = exact;
            } else {
              const staff = list.find(
                (c: any) =>
                  c.role !== 'customer' &&
                  (c.email?.toLowerCase().includes(q) ||
                    c.username?.toLowerCase().includes(q) ||
                    `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(q))
              );
              customer = staff || list[0];
            }
          }
        }
      } catch {}
    }

    clearTimeout(timeout);

    if (!customer || typeof customer !== 'object') return null;

    const firstName = String(customer.first_name || '').trim();
    const lastName = String(customer.last_name || '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const rawRole = String(customer.role || '').toLowerCase();
    const rawUser = String(customer.username || idStr).trim();
    const custId = customer.id;

    // Resolve display name: prefer full name from WordPress
    let displayName = fullName;
    const isSajidEntity =
      custId === 1507 ||
      rawUser.toLowerCase() === 'sazid' ||
      rawUser.toLowerCase() === 'sajid' ||
      rawUser.toLowerCase().includes('sazid@') ||
      rawUser.toLowerCase().includes('sajid@') ||
      idStr.toLowerCase() === 'sazid' ||
      idStr.toLowerCase() === 'sajid' ||
      idStr.toLowerCase().includes('sazid@');

    if (!displayName || displayName.toLowerCase() === rawUser.toLowerCase()) {
      if (isSajidEntity) {
        displayName = 'Sajid Islam';
      } else {
        displayName = rawUser || 'DEEN Staff';
      }
    }

    // Role & Outlet Mapping
    const mapped = mapWcUserToOutletAndRole(custId, rawUser, [rawRole]);

    // If WordPress role is administrator or shop_manager, ensure admin role
    const finalRole: 'admin' | 'operator' | 'readonly' =
      rawRole === 'administrator' || rawRole === 'shop_manager' || isSajidEntity || displayName === 'Sajid Islam'
        ? 'admin'
        : mapped.role;

    const resolvedEmail =
      customer.email || (isSajidEntity || displayName === 'Sajid Islam' ? 'sazid@deencommerce.com' : undefined);

    return {
      id: custId,
      username: rawUser,
      displayName,
      email: resolvedEmail,
      role: finalRole,
      assignedOutlet: isSajidEntity ? 'ALL' : mapped.assignedOutlet,
    };
  } catch {
    return null;
  }
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
      const setCookies =
        typeof loginRes.headers.getSetCookie === 'function'
          ? loginRes.headers.getSetCookie()
          : [loginRes.headers.get('set-cookie') || loginRes.headers.get('Set-Cookie') || ''];
      const setCookie = setCookies.join('; ');

      let extractedUsername = cleanUser;
      const wpUserId = 'wp_user';

      const match = setCookie.match(/wordpress_logged_in_[a-f0-9]+=([^%|;]+)/i);
      if (match && match[1]) {
        try {
          extractedUsername = decodeURIComponent(match[1]);
        } catch {}
      }

      // Fetch live WordPress/WooCommerce profile to get real display name and official role
      const liveProfile =
        (await fetchWcUserProfile(cleanUser, options)) ||
        (await fetchWcUserProfile(extractedUsername, options));

      let mapping = mapWcUserToOutletAndRole(wpUserId, extractedUsername);
      // If extracted username mapped to operator but input username/email was admin/sajid, prefer the higher role
      if (mapping.role === 'operator' && cleanUser.toLowerCase() !== extractedUsername.toLowerCase()) {
        const altMapping = mapWcUserToOutletAndRole(wpUserId, cleanUser);
        if (altMapping.role === 'admin') {
          mapping = altMapping;
        }
      }

      const finalDisplayName = liveProfile?.displayName || mapping.displayName;
      const finalRole = liveProfile?.role || mapping.role;
      const finalOutlet = liveProfile?.assignedOutlet || mapping.assignedOutlet;
      const finalEmail =
        liveProfile?.email ||
        (cleanUser.includes('@')
          ? cleanUser.toLowerCase()
          : finalDisplayName === 'Sajid Islam'
          ? 'sazid@deencommerce.com'
          : undefined);
      const finalId = liveProfile?.id ? `wp_${liveProfile.id}` : `wp_${extractedUsername.toLowerCase()}`;
      const finalUsername = liveProfile?.username || extractedUsername;

      const now = Math.floor(Date.now() / 1000);

      const sessionUser: SessionUser = {
        id: finalId,
        username: finalUsername,
        displayName: finalDisplayName,
        email: finalEmail,
        role: finalRole,
        assignedOutlet: finalOutlet,
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

      // Query WooCommerce customer profile for full name and meta
      const liveProfile = await fetchWcUserProfile(wpUser.id || cleanUser, options);

      const mapping = mapWcUserToOutletAndRole(
        wpUser.id || 'wp_user',
        wpUser.slug || wpUser.name || cleanUser,
        roles
      );
      const now = Math.floor(Date.now() / 1000);

      const resolvedName =
        liveProfile?.displayName ||
        (wpUser.name && wpUser.name.toLowerCase() !== String(wpUser.slug || '').toLowerCase()
          ? wpUser.name
          : mapping.displayName);

      const finalRole = liveProfile?.role || mapping.role;
      const finalOutlet = liveProfile?.assignedOutlet || mapping.assignedOutlet;
      const finalEmail =
        liveProfile?.email ||
        wpUser.email ||
        (resolvedName === 'Sajid Islam' ? 'sazid@deencommerce.com' : undefined);

      const sessionUser: SessionUser = {
        id: `wp_${wpUser.id || cleanUser}`,
        username: wpUser.slug || cleanUser,
        displayName: resolvedName,
        email: finalEmail,
        role: finalRole,
        assignedOutlet: finalOutlet,
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
