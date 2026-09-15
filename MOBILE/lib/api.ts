import { storage } from './storage';

if (!process.env.EXPO_PUBLIC_API_BASE_URL) {
  throw new Error('[api] EXPO_PUBLIC_API_BASE_URL is not set. Please create a .env file (see .env.example).');
}
export const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  errors?: { field: string; message: string }[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors: Envelope<unknown>['errors'] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── In-memory token cache ───────────────────────────────────────────────────

let _accessToken = '';
let _refreshToken = '';

export async function initTokens() {
  _accessToken = (await storage.getAccessToken()) || '';
  _refreshToken = (await storage.getRefreshToken()) || '';
}

export async function saveTokens(access: string, refresh: string) {
  _accessToken = access;
  _refreshToken = refresh;
  await storage.setTokens(access, refresh);
}

export async function clearTokens() {
  _accessToken = '';
  _refreshToken = '';
  await storage.clearTokens();
}

export function hasSession() {
  return Boolean(_accessToken || _refreshToken);
}

export function getAccessToken() {
  return _accessToken;
}

export function getRefreshToken() {
  return _refreshToken;
}

// ─── Transport ───────────────────────────────────────────────────────────────

async function transport<T>(
  path: string,
  method: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<Envelope<T>> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  const combinedSignal = signal
    ? (AbortSignal as unknown as { any: (signals: AbortSignal[]) => AbortSignal }).any([signal, controller.signal])
    : controller.signal;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: combinedSignal,
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof Error && e.name === 'AbortError') throw e;
    throw new ApiError('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng.', 0);
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  let payload: Envelope<T>;
  try {
    payload = text
      ? JSON.parse(text)
      : ({ success: res.ok, data: null, message: '' } as Envelope<T>);
  } catch {
    throw new ApiError('Máy chủ trả về dữ liệu không hợp lệ.', res.status);
  }

  if (!res.ok || payload.success === false) {
    throw new ApiError(
      payload.message || `Yêu cầu thất bại (${res.status})`,
      res.status,
      payload.errors,
    );
  }
  return payload;
}

// ─── Token refresh (singleton) ───────────────────────────────────────────────

let _refreshing: Promise<void> | null = null;

async function doRefresh() {
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    try {
      const r = await transport<{ accessToken: string; refreshToken?: string }>(
        '/auth/refresh-token',
        'POST',
        { refreshToken: _refreshToken },
      );
      await saveTokens(r.data.accessToken, r.data.refreshToken || _refreshToken);
    } catch (e) {
      if (e instanceof ApiError && [400, 401, 403].includes(e.status)) {
        await clearTokens();
      }
      throw e;
    } finally {
      _refreshing = null;
    }
  })();
  return _refreshing;
}

// ─── Public API function ─────────────────────────────────────────────────────

export async function apiRequest<T>(
  path: string,
  method: string,
  options: {
    body?: unknown;
    query?: Record<string, string | undefined>;
    signal?: AbortSignal;
    requiresAuth?: boolean;
  } = {},
): Promise<Envelope<T>> {
  let url = path;
  if (options.query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== '') params.set(k, v);
    }
    const qs = params.toString();
    if (qs) url += '?' + qs;
  }

  try {
    return await transport<T>(url, method, options.body, options.signal);
  } catch (e) {
    if (
      e instanceof ApiError &&
      e.status === 401 &&
      _refreshToken &&
      options.requiresAuth !== false
    ) {
      await doRefresh();
      return transport<T>(url, method, options.body, options.signal);
    }
    throw e;
  }
}

// ─── Convenience wrappers ────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, query?: Record<string, string | undefined>) =>
    apiRequest<T>(path, 'GET', { query, requiresAuth: true }),

  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, 'POST', { body, requiresAuth: true }),

  patch: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, 'PATCH', { body, requiresAuth: true }),

  delete: <T>(path: string) =>
    apiRequest<T>(path, 'DELETE', { requiresAuth: true }),

  // Public endpoints (no auth required)
  publicGet: <T>(path: string, query?: Record<string, string | undefined>) =>
    apiRequest<T>(path, 'GET', { query, requiresAuth: false }),

  publicPost: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, 'POST', { body, requiresAuth: false }),
};
