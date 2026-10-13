import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { storage } from './storage';
import { emitSessionExpired } from './sessionEvents';
import type { User } from './types';

if (!process.env.EXPO_PUBLIC_API_BASE_URL) {
  throw new Error('[api] EXPO_PUBLIC_API_BASE_URL is not set. Please create a .env file (see .env.example).');
}
export const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL.trim().replace(/\/+$/, '');

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
let _sessionVersion = 0;

export async function initTokens() {
  _accessToken = (await storage.getAccessToken()) || '';
  _refreshToken = (await storage.getRefreshToken()) || '';
}

export async function saveTokens(access: string, refresh: string) {
  _sessionVersion += 1;
  _accessToken = access;
  _refreshToken = refresh;
  await storage.setTokens(access, refresh);
}

export async function clearTokens() {
  _sessionVersion += 1;
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

// ─── Facility context ────────────────────────────────────────────────────────
// BE bắt buộc header X-Facility-Id trên hầu hết route nghiệp vụ (lớp, lịch, đăng ký,
// điểm danh, gói tập...) — thiếu sẽ trả 400 FACILITY_CONTEXT_REQUIRED.

let _facilityId = '';

export async function initFacility() {
  _facilityId = (await storage.getFacilityId()) || '';
}

export async function setFacilityId(id: string | null) {
  _facilityId = id ?? '';
  await storage.setFacilityId(id);
}

export function getFacilityId() {
  return _facilityId;
}

// Mã lỗi thô của BE → câu tiếng Việt cho người dùng.
const SERVER_MESSAGE_VI: Record<string, string> = {
  'Invalid email or password': 'Email hoặc mật khẩu không đúng.',
  'Your account has been deactivated': 'Tài khoản đã ngừng hoạt động. Vui lòng liên hệ trung tâm.',
  'Email is already in use': 'Email đã được sử dụng.',
  'Current password is incorrect': 'Mật khẩu hiện tại không đúng.',
  'Refresh token not found': 'Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.',
  'Invalid or expired refresh token': 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
  'Refresh token has been revoked': 'Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.',
  'Refresh token has expired': 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  'This class is full': 'Lớp đã đủ số lượng học viên.',
  'Cannot book a past class': 'Không thể đăng ký buổi học đã bắt đầu.',
  'You are already enrolled in this class': 'Bạn đã đăng ký buổi học này.',
  'Premium membership required to book this class': 'Lớp này yêu cầu gói Premium còn hiệu lực.',
  // Tài khoản thiếu hồ sơ hội viên (thường do dữ liệu BE chưa đồng bộ) — câu theo web + hướng xử lý
  'Member not found': 'Không tìm thấy hồ sơ hội viên. Vui lòng liên hệ trung tâm.',
  'Member profile not found': 'Không tìm thấy hồ sơ hội viên. Vui lòng liên hệ trung tâm.',
  // BE chặn khi hồ sơ hội viên chưa sẵn sàng / tài khoản không còn là MEMBER hoạt động (câu theo web khi có)
  'Cannot checkout: user is not an active MEMBER': 'Tài khoản chưa sẵn sàng để mua gói (hồ sơ hội viên chưa được kích hoạt). Vui lòng liên hệ trung tâm.',
  'Cannot create subscription: user is not an active MEMBER': 'Không thể đăng ký gói cho tài khoản không còn là hội viên hoạt động.',
  'Cannot renew subscription: user is no longer an active MEMBER': 'Không thể gia hạn cho tài khoản không còn là hội viên hoạt động.',
  'Cannot book class: user is not an active MEMBER': 'Chỉ hội viên đang hoạt động mới được đăng ký lớp.',
  'Cannot enroll: user is not an active MEMBER': 'Chỉ hội viên đang hoạt động mới được đăng ký khóa học.',
  'Cannot join waitlist: user is not an active MEMBER': 'Chỉ hội viên đang hoạt động mới được vào danh sách chờ.',
  FACILITY_CONTEXT_REQUIRED: 'Vui lòng chọn cơ sở để tiếp tục.',
  CONFLICTING_FACILITY_CONTEXT: 'Thông tin cơ sở không khớp. Vui lòng thử lại.',
  FORBIDDEN_SCOPE: 'Bạn không có quyền truy cập cơ sở này.',
};

function viMessage(message?: string) {
  return message ? (SERVER_MESSAGE_VI[message] ?? message) : message;
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
  if (_accessToken && config.headers.Authorization !== null) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  // /auth không cần cơ sở; /facilities tự nhận facilityId ở path — gửi thêm header
  // sẽ bị BE coi là CONFLICTING_FACILITY_CONTEXT.
  const url = config.url ?? '';
  if (_facilityId && !config.headers.has('X-Facility-Id') && !url.startsWith('/auth') && !url.startsWith('/facilities')) {
    config.headers['X-Facility-Id'] = _facilityId;
  }
  return config;
});

// ─── Token refresh (singleton) ───────────────────────────────────────────────

let _refreshing: Promise<void> | null = null;

async function doRefresh() {
  if (_refreshing) return _refreshing;
  const version = _sessionVersion;
  const refresh = _refreshToken;
  _refreshing = (async () => {
    try {
      const r = await axiosInstance.post<Envelope<{ accessToken: string; refreshToken?: string }>>(
        '/auth/refresh-token',
        { refreshToken: refresh },
      );
      if (version !== _sessionVersion) throw new ApiError('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.', 409);
      await saveTokens(r.data.data.accessToken, r.data.data.refreshToken || refresh);
    } catch (e) {
      const err = e as AxiosError<Envelope<unknown>>;
      const status = e instanceof ApiError ? e.status : err.response?.status ?? 0;
      if (version === _sessionVersion && [400, 401, 403].includes(status)) {
        await clearTokens();
        // Refresh token bị BE từ chối dứt khoát (thu hồi do đổi mật khẩu/khóa
        // tài khoản/đổi role) — báo cho AuthContext tự đăng xuất, tránh "nửa phiên".
        emitSessionExpired();
      }
      throw new ApiError(
        e instanceof Error ? e.message : 'Phiên đăng nhập đã hết hạn.',
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
      throw new ApiError(viMessage(payload.message) || 'Yêu cầu thất bại.', response.status, payload.errors);
    }
    return response;
  },
  (error: AxiosError<Envelope<unknown>>) => {
    if (error.code === 'ERR_CANCELED') {
      throw error;
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new ApiError('Máy chủ phản hồi quá lâu. Vui lòng thử lại sau ít phút.', 0);
    }
    if (!error.response) {
      throw new ApiError('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng.', 0);
    }
    const { status, data } = error.response;
    throw new ApiError(
      viMessage(data?.message) || `Yêu cầu thất bại (${status})`,
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
    headers?: Record<string, string>;
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
    headers: {
      ...(_facilityId && !path.startsWith('/auth') && !path.startsWith('/facilities') ? { 'X-Facility-Id': _facilityId } : {}),
      ...options.headers,
      ...(options.requiresAuth === false ? { Authorization: null } : {}),
    },
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
      try {
        const retryRes = await axiosInstance.request<Envelope<T>>(config);
        return retryRes.data;
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401) {
          await clearTokens();
          emitSessionExpired();
        }
        throw retryError;
      }
    }
    if (e instanceof ApiError && options.requiresAuth !== false && hasSession() &&
      (e.status === 401 || /^Unauthorized: (account is locked|role has changed, please login again|user not found)$/i.test(e.message.trim()))) {
      await clearTokens();
      emitSessionExpired();
    }
    throw e;
  }
}

/** Only send bearer credentials to our authenticated attachment endpoint. */
export function attachmentLocation(value: string): URL | null {
  try {
    const base = new URL(BASE_URL);
    const url = new URL(value, base.origin);
    if (url.hostname === base.hostname && base.protocol === 'https:') url.protocol = 'https:';
    const prefix = `${base.pathname}/chat/attachments/`;
    if (url.origin !== base.origin || url.username || url.password || !url.pathname.startsWith(prefix) || !/^[^/]+$/.test(url.pathname.slice(prefix.length))) return null;
    return url;
  } catch { return null; }
}

export async function fetchAttachment(value: string, signal?: AbortSignal): Promise<Blob> {
  const url = attachmentLocation(value);
  if (!url) throw new ApiError('Tệp cũ không còn khả dụng.', 400);
  const request = () => fetch(url.href, { headers: _accessToken ? { Authorization: `Bearer ${_accessToken}` } : {}, signal, redirect: 'error', cache: 'no-store' });
  let response = await request();
  if (response.status === 401 && _refreshToken) { await doRefresh(); response = await request(); }
  if (response.status === 401) { await clearTokens(); emitSessionExpired(); }
  if (!response.ok) throw new ApiError('Không thể tải tệp đính kèm hoặc bạn không có quyền tải.', response.status);
  return response.blob();
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

  // Content-Type ép về multipart để transformRequest của axios không JSON-hoá
  // FormData (mặc định instance là application/json) — thiếu dòng này ảnh sẽ
  // không được gửi dưới dạng file nhị phân. Không cần set boundary thủ công:
  // resolveConfig của axios tự xoá header này trước khi gửi thật (browser/RN tự
  // sinh boundary đúng).
  uploadAvatar: (formData: FormData) =>
    apiRequest<User>('/auth/me/avatar', 'POST', {
      body: formData,
      requiresAuth: true,
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};
