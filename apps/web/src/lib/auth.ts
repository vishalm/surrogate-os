'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import React from 'react';

const ACCESS_TOKEN_KEY = 'sos_access_token';
const REFRESH_TOKEN_KEY = 'sos_refresh_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;

  const payload = getUserFromToken();
  if (!payload) return false;

  // Check if token is expired
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    clearTokens();
    return false;
  }

  return true;
}

interface JWTPayload {
  sub: string;
  email: string;
  name: string;
  orgId: string;
  role: string;
  exp: number;
  iat: number;
}

export function getUserFromToken(): JWTPayload | null {
  const token = getToken();
  if (!token) return null;

  try {
    const base64Payload = token.split('.')[1];
    if (!base64Payload) return null;

    const payload = JSON.parse(atob(base64Payload));
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

interface AuthContextValue {
  user: JWTPayload | null;
  isLoggedIn: boolean;
  login: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoggedIn: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<JWTPayload | null>(null);

  useEffect(() => {
    const payload = getUserFromToken();
    if (payload && payload.exp * 1000 > Date.now()) {
      setUser(payload);
    } else {
      clearTokens();
    }
  }, []);

  const login = useCallback((accessToken: string, refreshToken: string) => {
    setTokens(accessToken, refreshToken);
    const payload = getUserFromToken();
    setUser(payload);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    window.location.href = '/login';
  }, []);

  const value: AuthContextValue = {
    user,
    isLoggedIn: !!user,
    login,
    logout,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
