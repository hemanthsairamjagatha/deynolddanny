/**
 * src/lib/api/client.ts
 *
 * Core HTTP Client for DEYNOLD DANNY Frontend
 * Connects to the Cloudflare Worker API with session management, HttpOnly credentials,
 * automatic token refresh interceptor, and unified error normalization.
 */

export const BACKEND_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_BACKEND_URL) ||
  'https://deynold-danny-backend.deynolddanny.workers.dev';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    status?: number;
    details?: unknown;
  };
}

/**
 * Get or create an anonymous session ID for guest carts.
 * Persists in sessionStorage / localStorage for continuous shopping across reloads.
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  const KEY = 'dd_cart_session_id';
  let sessionId = localStorage.getItem(KEY);
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem(KEY, sessionId);
  }
  return sessionId;
}

/**
 * Access token storage with localStorage persistence across reloads
 */
const TOKEN_KEY = 'dd_access_token';
const REFRESH_TOKEN_KEY = 'dd_refresh_token';
const CLIENT_EMAIL_KEY = 'dd_client_email';

let inMemoryAccessToken: string | null = null;
let isRefreshingPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      try {
        localStorage.setItem(TOKEN_KEY, token);
      } catch {}
    } else {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {}
    }
  }
}

export function getAccessToken(): string | null {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored) {
        inMemoryAccessToken = stored;
        return stored;
      }
    } catch {}
  }
  return null;
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredRefreshToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {}
}

export function getStoredClientEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(CLIENT_EMAIL_KEY);
  } catch {
    return null;
  }
}

export function setStoredClientEmail(email: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (email) {
      localStorage.setItem(CLIENT_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(CLIENT_EMAIL_KEY);
    }
  } catch {}
}

/**
 * Silently refreshes access token using the HttpOnly refresh token cookie or stored fallback
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshingPromise) return isRefreshingPromise;

  isRefreshingPromise = (async () => {
    try {
      const storedRefreshToken = getStoredRefreshToken();
      const res = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // sends HttpOnly refresh-token cookie if supported
        body: JSON.stringify({ refreshToken: storedRefreshToken || undefined }),
      });

      if (!res.ok) {
        setAccessToken(null);
        setStoredRefreshToken(null);
        return null;
      }

      const json = (await res.json()) as ApiResponse<{ accessToken: string; refreshToken?: string }>;
      if (json.success && json.data?.accessToken) {
        setAccessToken(json.data.accessToken);
        if (json.data.refreshToken) {
          setStoredRefreshToken(json.data.refreshToken);
        }
        return json.data.accessToken;
      }

      setAccessToken(null);
      setStoredRefreshToken(null);
      return null;
    } catch {
      setAccessToken(null);
      setStoredRefreshToken(null);
      return null;
    } finally {
      isRefreshingPromise = null;
    }
  })();

  return isRefreshingPromise;
}

/**
 * Universal fetch wrapper with automatic session routing and 401 silent token refresh
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<ApiResponse<T>> {
  const url = endpoint.startsWith('http') ? endpoint : `${BACKEND_URL}${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Session ID for anonymous carts
  const sessionId = getSessionId();
  if (sessionId && !headers.has('x-session-id')) {
    headers.set('x-session-id', sessionId);
  }

  // Auth Bearer token if logged in
  let token = getAccessToken();

  // If no token in memory on fresh browser load, try silent refresh once for protected endpoints
  if (!token && typeof window !== 'undefined' && !endpoint.includes('/api/auth/')) {
    token = await refreshAccessToken();
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Needed for HttpOnly refresh-token cookies
    });

    // Handle 401 Unauthorized by attempting a single silent refresh
    if (res.status === 401 && !isRetry && !endpoint.includes('/api/auth/')) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        return apiFetch<T>(endpoint, options, true);
      }
    }

    const json = (await res.json().catch(() => ({}))) as ApiResponse<T>;

    if (!res.ok) {
      return {
        success: false,
        error: json.error || {
          code: `HTTP_${res.status}`,
          message: res.statusText || 'An error occurred while communicating with the server.',
          status: res.status,
        },
      };
    }

    return json;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network request failed';
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message,
        status: 0,
      },
    };
  }
}
