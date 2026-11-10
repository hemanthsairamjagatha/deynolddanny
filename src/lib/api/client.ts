/**
 * src/lib/api/client.ts
 *
 * Core HTTP Client for DEYNOLD DANNY Frontend
 * Connects to the Cloudflare Worker API with session management, credentials, and error normalization.
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
 * Persists in localStorage for continuous shopping across tabs/reloads.
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
 * Access token memory / localStorage storage
 */
let inMemoryToken: string | null = null;

export function setAccessToken(token: string | null) {
  inMemoryToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('dd_access_token', token);
    } else {
      localStorage.removeItem('dd_access_token');
    }
  }
}

export function getAccessToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window !== 'undefined') {
    inMemoryToken = localStorage.getItem('dd_access_token');
  }
  return inMemoryToken;
}

/**
 * Universal fetch wrapper
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
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
  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Needed for HttpOnly refresh-token cookies
    });

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

