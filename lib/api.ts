import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
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

// ─── Axios Instance ───────────────────────────────────────────────────────────

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 60_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// Request interceptor — tự động gắn Bearer token vào mỗi request
axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

// ─── Token refresh (singleton) ───────────────────────────────────────────────

let _refreshing: Promise<void> | null = null;

async function doRefresh() {
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    try {
      const r = await axiosInstance.post<Envelope<{ accessToken: string; refreshToken?: string }>>(
        '/auth/refresh-token',
        { refreshToken: _refreshToken },
      );
      await saveTokens(r.data.data.accessToken, r.data.data.refreshToken || _refreshToken);
    } catch (e) {
      const err = e as AxiosError<Envelope<unknown>>;
      const status = err.response?.status ?? 0;
      if ([400, 401, 403].includes(status)) {
        await clearTokens();
      }
      throw new ApiError(
        err.response?.data?.message || 'Phiên đăng nhập đã hết hạn.',
        status,
      );
    } finally {
      _refreshing = null;
    }
  })();
  return _refreshing;
}

// Response interceptor — chuyển lỗi Axios thành ApiError
axiosInstance.interceptors.response.use(
  (response) => {
    // Body rỗng (vd. 204) → envelope rỗng; body không phải JSON → báo lỗi (giữ hành vi bản fetch cũ)
    if (typeof response.data === 'string') {
      if (response.data === '') {
        response.data = { success: true, data: null, message: '' };
      } else {
        throw new ApiError('Máy chủ trả về dữ liệu không hợp lệ.', response.status);
      }
    }
    // Nếu BE trả về success: false trong body (HTTP 200 nhưng lỗi nghiệp vụ)
    const payload = response.data as Envelope<unknown>;
    if (payload && payload.success === false) {
      throw new ApiError(payload.message || 'Yêu cầu thất bại.', response.status, payload.errors);
    }
    return response;
  },
  (error: AxiosError<Envelope<unknown>>) => {
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED') {
      // Timeout hoặc bị huỷ (AbortSignal)
      throw error;
    }
    if (!error.response) {
      throw new ApiError('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng.', 0);
    }
    const { status, data } = error.response;
    throw new ApiError(
      data?.message || `Yêu cầu thất bại (${status})`,
      status,
      data?.errors,
    );
  },
);

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
  // Lọc bỏ các query param undefined/rỗng
  const params: Record<string, string> = {};
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== '') params[k] = v;
    }
  }

  const config: AxiosRequestConfig = {
    method,
    url: path,
    params: Object.keys(params).length ? params : undefined,
    data: options.body,
    signal: options.signal,
  };

  // requiresAuth chỉ quyết định có tự refresh token + retry khi gặp 401 hay không
  // (token vẫn được gắn nếu có, giống bản fetch cũ).
  try {
    const res = await axiosInstance.request<Envelope<T>>(config);
    return res.data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && _refreshToken && options.requiresAuth !== false) {
      await doRefresh();
      // Retry sau khi refresh token
      const retryRes = await axiosInstance.request<Envelope<T>>(config);
      return retryRes.data;
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
