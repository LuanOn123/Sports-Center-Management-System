import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  api, ApiError, clearTokens, getFacilityId, getRefreshToken, hasSession,
  initFacility, initTokens, saveTokens, setFacilityId,
} from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { onSessionExpired } from '../lib/sessionEvents';
import { showAlert } from '../lib/alert';
import { getFacilities } from '../services/facilityService';
import { MOBILE_ROLES, type Facility, type LoginTokens, type User } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  facilities: Facility[];
  currentFacility: Facility | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  selectFacility: (id: string) => Promise<void>;
  reloadFacilities: () => Promise<void>;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Mobile chỉ phục vụ Hội viên & Huấn luyện viên — role khác (Admin/Quản lý/Lễ tân)
// vào app sẽ chỉ nhận toàn 403 ở các API dành riêng cho hội viên/HLV.
function assertMobileRole(me: User) {
  if (!MOBILE_ROLES.includes(me.role)) {
    throw new ApiError(
      'Ứng dụng di động chỉ dành cho Hội viên và Huấn luyện viên. Vui lòng đăng nhập bằng bản web.',
      403,
    );
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilityId, setFacilityIdState] = useState('');

  const applyFacility = useCallback(async (id: string | null) => {
    await setFacilityId(id);
    setFacilityIdState(id ?? '');
  }, []);

  // Lấy danh sách cơ sở rồi chọn: giữ lựa chọn đã lưu nếu còn hợp lệ, không thì lấy cơ sở đầu tiên.
  const loadFacilities = useCallback(async () => {
    const res = await getFacilities();
    const list = (res.data ?? []).filter((f) => f.isActive);
    setFacilities(list);
    const next = list.find((f) => f.id === getFacilityId()) ?? list[0] ?? null;
    await applyFacility(next?.id ?? null);
  }, [applyFacility]);

  const resetSessionState = useCallback(async () => {
    setUser(null);
    setFacilities([]);
    await applyFacility(null);
    // Cache react-query gắn với user/cơ sở cũ — bỏ đi kẻo người đăng nhập sau thấy dữ liệu người trước.
    queryClient.clear();
  }, [applyFacility, queryClient]);

  // On mount: load tokens from SecureStore and fetch profile
  useEffect(() => {
    (async () => {
      try {
        await initTokens();
        await initFacility();
        if (hasSession()) {
          const me = await api.get<User>('/auth/me');
          assertMobileRole(me.data);
          await loadFacilities();
          setUser(me.data);
          // Connect socket with the restored user session
          connectSocket(me.data.id);
        }
      } catch {
        await clearTokens();
        await applyFacility(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadFacilities, applyFacility]);

  // Phiên bị BE thu hồi ở nơi khác (đổi mật khẩu / khóa tài khoản / đổi role) —
  // refresh token hết hạn dứt khoát hoặc socket bị server ngắt chủ động đều báo
  // qua đây. Không làm vậy thì UI vẫn hiện như đã đăng nhập trong khi mọi API
  // đều 401 âm thầm ("nửa phiên").
  useEffect(() => {
    return onSessionExpired(() => {
      disconnectSocket();
      clearTokens();
      resetSessionState();
      showAlert(
        'Phiên đăng nhập đã kết thúc',
        'Bạn đã được đăng xuất do đổi mật khẩu, tài khoản bị khóa, hoặc đăng nhập ở thiết bị khác.'
      );
    });
  }, [resetSessionState]);

  const login = useCallback(async (email: string, password: string) => {
    // BE so khớp email chính xác (lưu chữ thường) — chuẩn hoá để gõ hoa/thừa khoảng trắng vẫn vào được.
    const r = await api.publicPost<LoginTokens>('/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    });
    await saveTokens(r.data.accessToken, r.data.refreshToken);
    try {
      const me = await api.get<User>('/auth/me');
      assertMobileRole(me.data);
      await loadFacilities();
      setUser(me.data);
      // Connect socket after login
      connectSocket(me.data.id);
    } catch (e) {
      // Đừng để lại token của phiên chưa hoàn tất (sai role / không tải được cơ sở).
      await clearTokens();
      await applyFacility(null);
      throw e;
    }
  }, [loadFacilities, applyFacility]);

  const register = useCallback(async (data: RegisterData) => {
    await api.publicPost<User>('/auth/register', { ...data, email: data.email.trim().toLowerCase() });
    // After register, login automatically
    await login(data.email, data.password);
  }, [login]);

  const logout = useCallback(async () => {
    try {
      const refresh = getRefreshToken();
      if (refresh) {
        await api.post('/auth/logout', { refreshToken: refresh });
      }
    } catch {
      // Ignore API errors during logout (e.g. expired token, network issues)
    } finally {
      // Disconnect socket before clearing session
      disconnectSocket();
      await clearTokens();
      await resetSessionState();
    }
  }, [resetSessionState]);

  const refreshUser = useCallback(async () => {
    const me = await api.get<User>('/auth/me');
    setUser(me.data);
  }, []);

  const selectFacility = useCallback(async (id: string) => {
    if (id === getFacilityId()) return;
    await applyFacility(id);
    // Mọi dữ liệu đã tải thuộc cơ sở cũ — làm mới toàn bộ các query đang hiển thị.
    await queryClient.resetQueries();
  }, [applyFacility, queryClient]);

  const reloadFacilities = useCallback(async () => {
    await loadFacilities();
    await queryClient.resetQueries();
  }, [loadFacilities, queryClient]);

  const currentFacility = facilities.find((f) => f.id === facilityId) ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        facilities,
        currentFacility,
        login,
        register,
        logout,
        refreshUser,
        selectFacility,
        reloadFacilities,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
