import { getFacilityId, facilitySignal, selectFacility, trackMutation } from "./facility";
import { migrateIdentityStorage } from "./identityStorage";
import operations from "./operations.json";
import { toast } from "./toast";
import { localizeApiError } from "./apiErrors";
import { terminalSessionError } from "./businessRules";
import type { LoginOk, ProfileOk, PostAuthLoginRequest } from "./generated";
export type RecordData = { [key: string]: unknown };
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
export interface Schema {
  type: string;
  format?: string;
  enum?: string[];
  minLength?: number;
  default?: unknown;
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
}
export interface Operation {
  path: string;
  method: string;
  summary: string;
  security: unknown[];
  parameters: {
    name: string;
    in: string;
    required?: boolean;
    schema: Schema;
  }[];
  body: Schema | null;
  statusCodes: string[];
}
export const contract = operations as unknown as Record<string, Operation>;
export const BASE_URL = (
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_BASE_URL ||
  "https://sports-center-management-system.onrender.com/api/v1"
).replace(/\/$/, "");
migrateIdentityStorage();
let accessToken = sessionStorage.getItem("pulse.access") || "";
let refreshToken = sessionStorage.getItem("pulse.refresh") || "";
export const getAccessToken = () => accessToken;
export const hasSession = () => Boolean(accessToken || refreshToken);
export function clearSession() {
  selectFacility("");
  accessToken = "";
  refreshToken = "";
  sessionStorage.removeItem("pulse.access");
  sessionStorage.removeItem("pulse.refresh");
}
export function endSession(message: string) {
  clearSession();
  window.dispatchEvent(new CustomEvent("session-expired", { detail: message }));
}
export function saveTokens(tokens: LoginOk["data"]) {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  sessionStorage.setItem("pulse.access", accessToken);
  sessionStorage.setItem("pulse.refresh", refreshToken);
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors: Envelope<unknown>["errors"] = [],
    public terminalSession = false,
    public details?: unknown,
  ) {
    super(message);
  }
}
async function transport(
  path: string,
  method: string,
  body?: unknown,
  signal?: AbortSignal,
  authenticated = true,
) {
  let res: Response;
  const contextSignal = path.startsWith("/auth/") || path.startsWith("/facilities") ? new AbortController().signal : facilitySignal();
  try {
    res = await fetch(BASE_URL + path, {
      method,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(authenticated && getFacilityId() && !path.startsWith("/facilities/") ? { "X-Facility-Id": getFacilityId() } : {}),
        ...(body !== undefined && !(body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(authenticated && accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {}),
      },
      ...(body !== undefined
        ? { body: body instanceof FormData ? body : JSON.stringify(body) }
        : {}),
      signal: signal
        ? AbortSignal.any([signal, contextSignal, AbortSignal.timeout(60000)])
        : AbortSignal.any([contextSignal, AbortSignal.timeout(60000)]),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(
      "Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.",
      0,
    );
  }
  const text = await res.text();
  let payload: Envelope<unknown>;
  try {
    payload = text
      ? JSON.parse(text)
      : { success: res.ok, data: null, message: "" };
  } catch {
    throw new ApiError(
      "Máy chủ trả về dữ liệu không hợp lệ. Vui lòng thử lại.",
      res.status,
    );
  }
  if (!res.ok || payload.success === false) {
    const rawErrors = (payload as unknown as { errors?: unknown }).errors;
    const localized = localizeApiError(payload.message, rawErrors, res.status);
    const error = new ApiError(
      localized.message,
      res.status,
      localized.errors,
      terminalSessionError(String(payload.message || "")),
      rawErrors,
    );
    // MF-10: cơ sở đang chọn đã bị tắt / cache stale → báo FacilityBoundary refetch danh sách
    // cơ sở để tự chọn cơ sở active, thay vì để người dùng kẹt ở lỗi 403 FORBIDDEN_SCOPE.
    if (
      res.status === 403 &&
      String(payload.message || "").includes("FORBIDDEN_SCOPE") &&
      typeof window !== "undefined"
    ) {
      window.dispatchEvent(new CustomEvent("facility-scope-invalid"));
    }
    throw error;
  }
  return payload;
}
let refreshing: Promise<void> | null = null;
async function refresh() {
  if (!refreshing)
    refreshing = (async () => {
      try {
        const r = await transport("/auth/refresh-token", "POST", {
          refreshToken,
        });
        const tokens = r.data as { accessToken: string; refreshToken?: string };
        saveTokens({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || refreshToken,
        });
      } catch (e) {
        if (e instanceof ApiError && [400, 401, 403].includes(e.status)) {
          clearSession();
          window.dispatchEvent(new Event("session-expired"));
        }
        throw e;
      } finally {
        refreshing = null;
      }
    })();
  return refreshing;
}
// Never send Bearer credentials to an external URL or legacy public upload.
export function attachmentLocation(value: string): URL | null {
  try {
    const base = new URL(BASE_URL);
    const url = new URL(value, base.origin);
    if (url.hostname === base.hostname && base.protocol === "https:")
      url.protocol = "https:";
    if (
      url.origin !== base.origin ||
      url.username ||
      url.password ||
      !url.pathname.startsWith(base.pathname + "/chat/attachments/") ||
      !/^[^/]+$/.test(
        url.pathname.slice((base.pathname + "/chat/attachments/").length),
      )
    )
      return null;
    return url;
  } catch {
    return null;
  }
}
export async function fetchAttachment(
  value: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const url = attachmentLocation(value);
  if (!url) throw new Error("Tệp cũ không còn khả dụng.");
  const request = () =>
    fetch(url.href, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      signal,
      redirect: "error",
      cache: "no-store",
    });
  let response = await request();
  if (response.status === 401 && refreshToken) {
    await refresh();
    response = await request();
  }
  if (response.status === 401)
    endSession("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  if (!response.ok)
    throw new ApiError("Không thể tải tệp đính kèm.", response.status);
  return response.blob();
}

async function apiRequest<T = RecordData>(
  key: string,
  options: {
    params?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<Envelope<T>> {
  const op = contract[key];
  if (!op) throw new Error("Undocumented operation: " + key);
  let path = op.path.replace(/\{(\w+)\}/g, (_, p) => {
    if (!options.params?.[p]) throw new Error("Missing path parameter " + p);
    return encodeURIComponent(options.params[p]);
  });
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(options.query || {})) {
    if (!v) continue;
    if (!op.parameters.some((p) => p.in === "query" && p.name === k))
      throw new Error("Undocumented query parameter " + k);
    const schema = op.parameters.find(
      (p) => p.in === "query" && p.name === k,
    )!.schema;
    search.set(
      k,
      schema.format === "date-time" ? new Date(v).toISOString() : v,
    );
  }
  if (search.size) path += "?" + search.toString();
  try {
    return (await transport(
      path,
      op.method,
      options.body,
      options.signal,
      op.security.length > 0,
    )) as Envelope<T>;
  } catch (e) {
    if (
      e instanceof ApiError &&
      e.status === 401 &&
      e.terminalSession &&
      op.security.length
    ) {
      clearSession();
      window.dispatchEvent(
        new CustomEvent("session-expired", { detail: e.message }),
      );
      throw e;
    }
    if (
      e instanceof ApiError &&
      e.status === 401 &&
      op.security.length &&
      refreshToken
    ) {
      await refresh();
      try {
        return (await transport(
          path,
          op.method,
          options.body,
          options.signal,
        )) as Envelope<T>;
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401) {
          clearSession();
          window.dispatchEvent(new Event("session-expired"));
        }
        throw retryError;
      }
    }
    if (e instanceof ApiError && e.status === 401 && op.security.length) {
      clearSession();
      window.dispatchEvent(new Event("session-expired"));
    }
    throw e;
  }
}
export async function api<T = RecordData>(
  key: string,
  options: Parameters<typeof apiRequest>[1] = {},
): Promise<Envelope<T>> {
  // Queries and AI chat show contextual feedback; avoid repeated background toasts.
  const inlineFeedback = key.startsWith("GET ") || key === "POST /ai/chat";
  const mutation = !key.startsWith("GET ");
  if (mutation) trackMutation(1);
  try {
    const result = await apiRequest<T>(key, options);
    if (key === "PATCH /auth/me/change-password") {
      endSession(
        "Đã đổi mật khẩu. Vui lòng đăng nhập lại trên tất cả thiết bị.",
      );
      return result;
    }
    if (
      !inlineFeedback &&
      !/\/auth\/refresh-token|\/notifications\/.*read|\/chat\//.test(key)
    ) {
      const message =
        key === "POST /payments/sepay/checkout"
          ? "Đã tạo mã thanh toán. Vui lòng chuyển khoản để kích hoạt gói."
          : key === "POST /payments/sepay/mock-confirm"
            ? "Đã gửi xác nhận giả lập. Đang kiểm tra trạng thái thanh toán."
            : /[À-ỹ]/.test(result.message || "")
              ? result.message
              : "Thao tác đã thực hiện thành công.";
      toast("success", message);
    }
    return result;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    const code =
      error instanceof ApiError
        ? (error.details as { code?: string } | undefined)?.code
        : undefined;
    if (
      code === "SCHEDULE_STATE_CHANGED" ||
      code === "SCHEDULE_NOT_AVAILABLE"
    ) {
      window.dispatchEvent(new Event("schedule-state-changed"));
    }
    if (inlineFeedback) throw error;
    if (
      error instanceof ApiError &&
      error.status === 409 &&
      code === "SEPAY_PAYMENT_PENDING"
    ) {
      toast(
        "info",
        "Bạn có đơn đang chờ thanh toán. Đã mở lại mã QR của đơn cũ.",
      );
    } else {
      toast(
        "error",
        code === "SEPAY_NOT_CONFIGURED"
          ? "Thanh toán online chưa được cấu hình. Vui lòng thanh toán tại quầy hoặc thử lại sau."
          : error instanceof Error
            ? error.message
            : "Thao tác không thành công. Vui lòng thử lại.",
      );
    }
    throw error;
  } finally {
    if (mutation) trackMutation(-1);
  }
}
export const authService = {
  forgotPassword: (email: string) =>
    api<null>("POST /auth/forgot-password", { body: { email } }),
  resetPassword: (body: { email: string; otp: string; newPassword: string }) =>
    api<null>("POST /auth/reset-password", { body }),
  async login(body: PostAuthLoginRequest) {
    const r = await api<LoginOk["data"]>("POST /auth/login", { body });
    saveTokens(r.data);
    return authService.me();
  },
  me: () => api<ProfileOk["data"]>("GET /auth/me"),
  async logout() {
    try {
      await api("POST /auth/logout", { body: { refreshToken } });
    } finally {
      clearSession();
    }
  },
};
