'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuthRefresh } from '@/hooks/useAuthRefresh';

export type UserRole = 'manager' | 'tenant' | 'landlord' | 'vendor' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: string;
  phoneNumber?: string | null;
  bio?: string | null;
  lastLoginAt?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }) => Promise<{ success: boolean; error?: string; user?: User }>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    role?: string;
    landlordCode?: string;
  }) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeUser(rawUser: any): User | null {
  if (!rawUser) return null;
  return {
    ...rawUser,
    role: (rawUser.role || 'tenant').toLowerCase() as UserRole,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Mount proactive silent refresh interval — only when authenticated
  useAuthRefresh(!!user);

  const fetchUser = async () => {
    try {
      let res = await fetch('/api/v1/auth/me');

      if (res.status === 401) {
        // Attempt silent token refresh before discarding session
        const refreshRes = await fetch('/api/v1/auth/refresh', { method: 'POST' });
        if (refreshRes.ok) {
          res = await fetch('/api/v1/auth/me');
        }
      }

      if (res.ok) {
        const data = await res.json();
        setUser(normalizeUser(data.user));
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }

      const normalized = normalizeUser(data.user);
      setUser(normalized);
      return { success: true, user: normalized || undefined };
    } catch (err) {
      return { success: false, error: 'Network error during login' };
    }
  };

  const register = async (data: {
    email: string;
    password: string;
    name: string;
    role?: string;
    landlordCode?: string;
  }) => {
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const resData = await res.json();

      if (!res.ok) {
        return { success: false, error: resData.error || 'Registration failed' };
      }

      // No session is established at registration time anymore -- the
      // account is PENDING_VERIFICATION until the emailed link is used, so
      // there's no `user` to log in as yet (setUser would just be wrong).
      return { success: true, requiresVerification: true };
    } catch (err) {
      return { success: false, error: 'Network error during registration' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout fetch errors
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
