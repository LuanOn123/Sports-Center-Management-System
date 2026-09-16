import type { ApiResponse } from "../types/member";

export const BASE_URL = (
  (import.meta as unknown as { env: Record<string, string> }).env
    ?.VITE_API_BASE_URL ||
  "https://sports-center-management-system.onrender.com/api/v1"
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors: { field: string; message: string }[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getAccessToken(): string {
  return sessionStorage.getItem("pulse.access") || "";
}

export function getRefreshToken(): string {
  return sessionStorage.getItem("pulse.refresh") || "";
}

export function setTokens(accessToken: string, refreshToken?: string) {
  if (accessToken) sessionStorage.setItem("pulse.access", accessToken);
  if (refreshToken) sessionStorage.setItem("pulse.refresh", refreshToken);
}

export function clearTokens() {
  sessionStorage.removeItem("pulse.access");
  sessionStorage.removeItem("pulse.refresh");
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function tryRefreshToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) {
      clearTokens();
      return null;
    }
    const data = await res.json();
    const newAccess = data.data?.accessToken;
    if (newAccess) {
      setTokens(newAccess);
      return newAccess;
    }
  } catch {
    clearTokens();
  }
  return null;
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let token = getAccessToken();

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = path.startsWith("http") ? path : `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new ApiError("Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng.", 0);
  }

  // Handle 401 & Token Refresh
  if (res.status === 401 && !path.includes("/auth/login") && !path.includes("/auth/refresh-token")) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await tryRefreshToken();
      isRefreshing = false;

      if (newToken) {
        onRefreshed(newToken);
        headers["Authorization"] = `Bearer ${newToken}`;
        res = await fetch(url, { ...options, headers });
      } else {
        window.dispatchEvent(new CustomEvent("session-expired"));
        throw new ApiError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
      }
    } else {
      // Wait for refresh to complete
      const retryToken = await new Promise<string>((resolve) => {
        refreshSubscribers.push(resolve);
      });
      headers["Authorization"] = `Bearer ${retryToken}`;
      res = await fetch(url, { ...options, headers });
    }
  }

  const text = await res.text();
  let payload: ApiResponse<T>;
  try {
    payload = text ? JSON.parse(text) : { success: res.ok, message: "", data: {} as T };
  } catch {
    throw new ApiError(
      `Máy chủ trả về phản hồi không hợp lệ (${res.status})`,
      res.status,
    );
  }

  if (!res.ok || !payload.success) {
    throw new ApiError(
      payload.message || `Yêu cầu thất bại (${res.status})`,
      res.status,
      payload.errors || [],
    );
  }

  return payload.data;
}

export const apiClient = {
  get: <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: "GET", headers }),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, {
      method: "POST",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, {
      method: "PATCH",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: "DELETE", headers }),
};
