/**
 * src/lib/api/client.ts
 * Core API client for DEYNOLD DANNY storefront -> Backend (via same-origin `/api/*` proxy by default).
 * Security: Access tokens stay strictly in memory (never in localStorage). Refresh tokens live
 * exclusively in backend-managed HttpOnly cookies (`dd_refresh`).
 */

export const BACKEND_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_BACKEND_URL) || '';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    status?: number;
    details?: unknown;
  };
}

const SESSION_HINT_KEY = 'dd_has_session';
const CLIENT_EMAIL_KEY = 'dd_client_email';
const SESSION_ID_KEY = 'dd_cart_session_id';

// Legacy localStorage token keys cleaned proactively on load/logout
const LEGACY_TOKEN_KEY = 'dd_access_token';
const LEGACY_REFRESH_TOKEN_KEY = 'dd_refresh_token';

let memoryAccessToken: string | null = null;
let memorySessionId: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

function generateSecureUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `dd-${Date.now().toString(36)}`;
}

function purgeLegacyWebStorageTokens(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  } catch {
    // Ignore storage access errors in restricted browser contexts
  }
}

if (typeof window !== 'undefined') {
  purgeLegacyWebStorageTokens();
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  if (memorySessionId) return memorySessionId;
  try {
    let sid = localStorage.getItem(SESSION_ID_KEY);
    if (!sid) {
      sid = `sess_${generateSecureUuid()}`;
      localStorage.setItem(SESSION_ID_KEY, sid);
    }
    memorySessionId = sid;
    return sid;
  } catch {
    memorySessionId = `sess_${generateSecureUuid()}`;
    return memorySessionId;
  }
}

export function hasSessionHint(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSessionHint(active: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (active) {
      localStorage.setItem(SESSION_HINT_KEY, '1');
    } else {
      localStorage.removeItem(SESSION_HINT_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function setAccessToken(token: string | null): void {
  memoryAccessToken = token;
  purgeLegacyWebStorageTokens();
  if (token) {
    setSessionHint(true);
  }
}

export function getAccessToken(): string | null {
  purgeLegacyWebStorageTokens();
  return memoryAccessToken;
}

/**
 * Legacy compatibility shim: refresh tokens are strictly HttpOnly cookies never exposed to JS.
 */
export function getStoredRefreshToken(): string | null {
  purgeLegacyWebStorageTokens();
  return null;
}

export function setStoredRefreshToken(_token: string | null): void {
  purgeLegacyWebStorageTokens();
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
  } catch {
    // Ignore storage errors
  }
}

export function clearClientSession(): void {
  memoryAccessToken = null;
  setSessionHint(false);
  setStoredClientEmail(null);
  purgeLegacyWebStorageTokens();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dd:session-cleared'));
  }
}

async function performCookieRefresh(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        clearClientSession();
      }
      return null;
    }
    const json = (await res.json()) as ApiResponse<{
      accessToken?: string;
      user?: { email?: string };
    }>;
    if (json.success && json.data?.accessToken) {
      setAccessToken(json.data.accessToken);
      if (json.data.user?.email) {
        setStoredClientEmail(json.data.user.email);
      }
      return json.data.accessToken;
    }
    clearClientSession();
    return null;
  } catch {
    return null;
  }
}

/**
 * Refreshes the in-memory access token using the HttpOnly `dd_refresh` cookie.
 * Uses Web Locks API + in-tab promise deduplication so parallel calls never race token rotation.
 */
export async function refreshAccessToken(force = false): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!force && !hasSessionHint()) {
    return null;
  }
  if (refreshPromise) return refreshPromise;

  const execRefresh = async (): Promise<string | null> => {
    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
      return navigator.locks.request('dd_auth_refresh', async () => {
        if (memoryAccessToken && !force) return memoryAccessToken;
        return performCookieRefresh();
      });
    }
    return performCookieRefresh();
  };

  refreshPromise = execRefresh().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

/**
 * Ensures an in-memory access token is hydrated for protected MPA routes without storing JWTs in Web Storage.
 */
export async function ensureAuthenticatedSession(): Promise<string | null> {
  if (memoryAccessToken) return memoryAccessToken;
  if (!hasSessionHint()) return null;
  return refreshAccessToken(true);
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit & { skipAuthRefresh?: boolean } = {},
): Promise<ApiResponse<T>> {
  const { skipAuthRefresh, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers || {});
  if (!headers.has('Content-Type') && !(fetchOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let token = getAccessToken();
  const isAuthEndpoint = endpoint.startsWith('/api/auth/');

  // Across Astro MPA page transitions, JS memory resets while HttpOnly dd_refresh persists.
  // Hydrate the short-lived in-memory JWT cleanly only if a session hint exists.
  if (!token && !isAuthEndpoint && !skipAuthRefresh && hasSessionHint()) {
    token = await refreshAccessToken(true);
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const sessionId = getSessionId();
  if (sessionId) {
    headers.set('x-session-id', sessionId);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${BACKEND_URL}${endpoint}`;

  try {
    let res = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    });

    if (res.status === 401 && !isAuthEndpoint && !skipAuthRefresh && (token || hasSessionHint())) {
      const nextToken = await refreshAccessToken(true);
      if (nextToken) {
        headers.set('Authorization', `Bearer ${nextToken}`);
        res = await fetch(url, {
          ...fetchOptions,
          headers,
          credentials: 'include',
        });
      }
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        success: res.ok,
        error: res.ok
          ? undefined
          : {
              code: 'HTTP_ERROR',
              message: `Request failed with status ${res.status}`,
              status: res.status,
            },
      };
    }

    const data = (await res.json()) as ApiResponse<T>;
    return data;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network connection failed';
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
