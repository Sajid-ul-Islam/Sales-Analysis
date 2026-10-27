'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SessionUser } from '@/lib/auth/session';

interface AuthContextType {
  user: SessionUser | null;
  role: 'admin' | 'operator' | 'readonly';
  assignedOutlet: 'ALL' | 'MIRPUR' | 'CUMILLA' | 'WARI' | 'SYLHET';
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithPasscode: (passcode: string) => Promise<{ success: boolean; message?: string }>;
  loginWithWooCommerce: (
    username: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          return;
        }
      }
      setUser(null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const loginWithPasscode = useCallback(
    async (passcode: string): Promise<{ success: boolean; message?: string }> => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'PASSCODE', passcode }),
        });
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          return { success: true, message: data.message };
        }
        return { success: false, message: data.message || 'Login failed' };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Network error during login',
        };
      }
    },
    []
  );

  const loginWithWooCommerce = useCallback(
    async (
      username: string,
      password: string,
      rememberMe: boolean = false
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'WOOCOMMERCE', username, password, rememberMe }),
        });
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          return { success: true, message: data.message };
        }
        return { success: false, message: data.message || 'Authentication failed' };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Network error connecting to store',
        };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      setUser(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }, []);

  const value: AuthContextType = {
    user,
    role: user?.role || 'admin',
    assignedOutlet: user?.assignedOutlet || 'ALL',
    isAuthenticated: Boolean(user),
    isLoading,
    loginWithPasscode,
    loginWithWooCommerce,
    logout,
    refreshSession: fetchSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
