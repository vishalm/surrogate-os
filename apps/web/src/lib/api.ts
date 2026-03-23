import type { ApiResponse } from '@surrogate-os/shared';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('sos_access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

function clearTokensAndRedirect(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('sos_access_token');
    localStorage.removeItem('sos_refresh_token');
    window.location.href = '/login';
  }
}

async function attemptTokenRefresh(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const refreshToken = localStorage.getItem('sos_refresh_token');
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const json = await response.json();
    if (json.success && json.data) {
      localStorage.setItem('sos_access_token', json.data.accessToken);
      if (json.data.refreshToken) {
        localStorage.setItem('sos_refresh_token', json.data.refreshToken);
      }
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

async function refreshTokenIfNeeded(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = attemptTokenRefresh().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });

  return refreshPromise;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: getAuthHeaders(),
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (response.status === 401) {
    const refreshed = await refreshTokenIfNeeded();

    if (refreshed) {
      // Retry original request with new token
      const retryOptions: RequestInit = {
        method,
        headers: getAuthHeaders(),
      };
      if (body !== undefined) {
        retryOptions.body = JSON.stringify(body);
      }

      const retryResponse = await fetch(url, retryOptions);

      if (retryResponse.status === 401) {
        clearTokensAndRedirect();
        return {
          success: false,
          data: null,
          error: { code: 'UNAUTHORIZED', message: 'Session expired', details: null },
        };
      }

      const retryJson: ApiResponse<T> = await retryResponse.json();
      return retryJson;
    }

    clearTokensAndRedirect();
    return {
      success: false,
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'Session expired', details: null },
    };
  }

  const json: ApiResponse<T> = await response.json();
  return json;
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
