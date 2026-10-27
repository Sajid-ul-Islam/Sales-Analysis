import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createSessionToken,
  verifySessionToken,
  verifySessionTokenSync,
  verifyPasscode,
  SessionUser
} from '@/lib/auth/session';
import { mapWcUserToOutletAndRole } from '@/lib/auth/woocommerceAuth';
import { POST as postLogin } from '@/app/api/auth/login/route';
import { GET as getSession } from '@/app/api/auth/session/route';
import { POST as postLogout } from '@/app/api/auth/logout/route';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import { resetRateLimits } from '@/lib/auth/rateLimiter';

describe('Dual-Mode Authentication & Session Engine', () => {
  beforeEach(() => {
    resetRateLimits();
    process.env.SESSION_SECRET = 'test-secret-key-32-chars-long-minimum-length!';
    process.env.AUTH_ADMIN_PIN = '2026';
    process.env.AUTH_OPS_PIN = '1234';
    process.env.AUTH_ADMIN_PASSCODE = 'admin-secret';
    process.env.AUTH_OPS_PASSCODE = 'ops-secret';
  });

  describe('1. Passcode & PIN Verification', () => {
    it('authenticates master admin PIN (2026 and Admin@2026)', () => {
      const user = verifyPasscode('2026');
      expect(user).not.toBeNull();
      expect(user?.role).toBe('admin');
      expect(user?.authMethod).toBe('PASSCODE');
      expect(user?.username).toBe('admin');
      expect(user?.displayName).toBe('Operations Admin');
      expect(user?.assignedOutlet).toBe('ALL');

      const userLabeled = verifyPasscode('Admin@2026');
      expect(userLabeled).not.toBeNull();
      expect(userLabeled?.role).toBe('admin');
    });

    it('authenticates ops PIN (1234 and Ops@1234)', () => {
      const user = verifyPasscode('1234');
      expect(user).not.toBeNull();
      expect(user?.role).toBe('operator');
      expect(user?.authMethod).toBe('PASSCODE');
      expect(user?.username).toBe('operator');
      expect(user?.displayName).toBe('Warehouse Operator');
      expect(user?.assignedOutlet).toBe('ALL');

      const userLabeled = verifyPasscode('Ops@1234');
      expect(userLabeled).not.toBeNull();
      expect(userLabeled?.role).toBe('operator');
    });

    it('authenticates director PIN (7742 and Director@7742)', () => {
      const user = verifyPasscode('7742');
      expect(user).not.toBeNull();
      expect(user?.role).toBe('admin');
      expect(user?.username).toBe('director');
      expect(user?.sampleRate).toBe(0.15);

      const userLabeled = verifyPasscode('Director@7742');
      expect(userLabeled).not.toBeNull();
      expect(userLabeled?.username).toBe('director');
      expect(userLabeled?.sampleRate).toBe(0.15);
    });

    it('authenticates admin passcode', () => {
      const user = verifyPasscode('admin-secret');
      expect(user).not.toBeNull();
      expect(user?.role).toBe('admin');
      expect(user?.username).toBe('admin');
    });

    it('authenticates ops passcode', () => {
      const user = verifyPasscode('ops-secret');
      expect(user).not.toBeNull();
      expect(user?.role).toBe('operator');
      expect(user?.username).toBe('operator');
    });

    it('rejects invalid pin or passcode with null', () => {
      expect(verifyPasscode('wrong-passcode')).toBeNull();
      expect(verifyPasscode('9999')).toBeNull();
      expect(verifyPasscode('')).toBeNull();
      expect(verifyPasscode('   ')).toBeNull();
    });
  });

  describe('2. WooCommerce Staff & Outlet Mapping', () => {
    it('maps Mirpur cashier (User ID 3) to Mirpur Outlet', () => {
      const mapped = mapWcUserToOutletAndRole(3, 'mirpur_pos', ['shop_manager']);
      expect(mapped.assignedOutlet).toBe('MIRPUR');
      expect(mapped.displayName).toBe('Mirpur Cashier');
      expect(mapped.role).toBe('operator');
    });

    it('maps Cumilla cashier (User ID 35) to Cumilla Branch', () => {
      const mapped = mapWcUserToOutletAndRole(35, 'cumilla_pos', ['shop_manager']);
      expect(mapped.assignedOutlet).toBe('CUMILLA');
      expect(mapped.displayName).toBe('Cumilla Cashier');
      expect(mapped.role).toBe('operator');
    });

    it('maps Wari cashier (User ID 69) to Wari Branch', () => {
      const mapped = mapWcUserToOutletAndRole(69, 'wari_pos', ['shop_manager']);
      expect(mapped.assignedOutlet).toBe('WARI');
      expect(mapped.displayName).toBe('Wari Cashier');
      expect(mapped.role).toBe('operator');
    });

    it('maps Sylhet cashier (User ID 572) to Sylhet Branch', () => {
      const mapped = mapWcUserToOutletAndRole(572, 'sylhet_pos', ['shop_manager']);
      expect(mapped.assignedOutlet).toBe('SYLHET');
      expect(mapped.displayName).toBe('Sylhet Cashier');
      expect(mapped.role).toBe('operator');
    });

    it('maps administrator account to admin role', () => {
      const mapped = mapWcUserToOutletAndRole(1, 'sajid_admin', ['administrator']);
      expect(mapped.role).toBe('admin');
      expect(mapped.assignedOutlet).toBe('ALL');
    });

    it('identifies outlet from username slug if cashier ID is unmapped', () => {
      const mapped = mapWcUserToOutletAndRole(9999, 'cumilla_branch_staff', ['shop_manager']);
      expect(mapped.assignedOutlet).toBe('CUMILLA');
      expect(mapped.displayName).toBe('Cumilla Cashier');
    });
  });

  describe('3. Session Token Sign, Verify, & Tamper Proofing', () => {
    const mockUser: SessionUser = {
      id: 'usr_admin',
      username: 'admin',
      displayName: 'System Admin',
      role: 'admin',
      assignedOutlet: 'ALL',
      authMethod: 'PASSCODE',
      createdAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 3600
    };

    it('creates a 3-part HMAC token and verifies it asynchronously', async () => {
      const token = await createSessionToken(mockUser);
      expect(token).toBeDefined();
      expect(token.split('.').length).toBe(3);

      const verified = await verifySessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.id).toBe('usr_admin');
      expect(verified?.role).toBe('admin');
      expect(verified?.displayName).toBe('System Admin');
    });

    it('verifies synchronously in Node runtime via verifySessionTokenSync', async () => {
      const token = await createSessionToken(mockUser);
      const verified = verifySessionTokenSync(token);
      expect(verified).not.toBeNull();
      expect(verified?.id).toBe('usr_admin');
    });

    it('rejects tampered token payload', async () => {
      const token = await createSessionToken(mockUser);
      const parts = token.split('.');
      // Tamper payload
      const tamperedPayload = Buffer.from(JSON.stringify({ ...mockUser, role: 'super_hacker' })).toString('base64url');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      const verified = await verifySessionToken(tamperedToken);
      expect(verified).toBeNull();
      expect(verifySessionTokenSync(tamperedToken)).toBeNull();
    });

    it('rejects tampered signature', async () => {
      const token = await createSessionToken(mockUser);
      const parts = token.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.badsignature123`;

      const verified = await verifySessionToken(tamperedToken);
      expect(verified).toBeNull();
      expect(verifySessionTokenSync(tamperedToken)).toBeNull();
    });

    it('rejects expired token', async () => {
      const token = await createSessionToken(mockUser, -100);
      const verified = await verifySessionToken(token);
      expect(verified).toBeNull();
      expect(verifySessionTokenSync(token)).toBeNull();
    });
  });

  describe('4. Auth API Route Handlers', () => {
    it('POST /api/auth/login succeeds with valid PIN and returns Set-Cookie', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'PASSCODE', passcode: '2026' })
      });

      const res = await postLogin(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.role).toBe('admin');

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).not.toBeNull();
      expect(setCookie).toContain('deen_session=');
      expect(setCookie?.toLowerCase()).toContain('httponly');
      expect(setCookie?.toLowerCase()).toContain('path=/');
    });

    it('POST /api/auth/login rejects wrong passcode with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'PASSCODE', passcode: 'wrong-pin' })
      });

      const res = await postLogin(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.message).toBeDefined();
    });

    it('GET /api/auth/session returns user when session cookie is present', async () => {
      const token = await createSessionToken({
        id: 'usr_ops',
        username: 'operator',
        displayName: 'Operations Dispatcher',
        role: 'operator',
        assignedOutlet: 'ALL',
        authMethod: 'PASSCODE',
                expiresAt: Math.floor(Date.now() / 1000) + 3600
      });

      const req = new NextRequest('http://localhost:3000/api/auth/session', {
        headers: { Cookie: `deen_session=${token}` }
      });

      const res = await getSession(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.authenticated).toBe(true);
      expect(json.user.displayName).toBe('Operations Dispatcher');
    });

    it('GET /api/auth/session returns authenticated: false when no session cookie exists', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/session');
      const res = await getSession(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.authenticated).toBe(false);
      expect(json.user).toBeNull();
    });

    it('POST /api/auth/logout clears deen_session cookie with Max-Age=0', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/logout', { method: 'POST' });
      const res = await postLogout();
      expect(res.status).toBe(200);

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).not.toBeNull();
      expect(setCookie).toContain('deen_session=');
      expect(setCookie).toContain('Max-Age=0');
    });
  });

  describe('5. Backwards-Compatible API Auth (validateApiRequest)', () => {
    it('allows request with valid deen_session cookie without Bearer token', async () => {
      const token = await createSessionToken({
        id: 'usr_admin',
        username: 'admin',
        displayName: 'Admin User',
        role: 'admin',
        assignedOutlet: 'ALL',
        authMethod: 'PASSCODE',
                expiresAt: Math.floor(Date.now() / 1000) + 3600
      });

      const req = new NextRequest('http://localhost:3000/api/blob/status', {
        headers: { Cookie: `deen_session=${token}` }
      });

      const auth = validateApiRequest(req, { requiredRole: 'admin' });
      expect(auth.authenticated).toBe(true);
      expect(auth.role).toBe('admin');
      expect(auth.statusCode).toBe(200);
    });

    it('denies request when no cookie and no Bearer token are provided', () => {
      const req = new NextRequest('http://localhost:3000/api/blob/status');
      const auth = validateApiRequest(req, { requiredRole: 'admin' });
      expect(auth.authenticated).toBe(false);
      expect(auth.statusCode).toBe(401);
      expect(auth.message).toBeDefined();
    });
  });
});
