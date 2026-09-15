import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { api, clearTokens, getRefreshToken, hasSession, initTokens, saveTokens } from '../lib/api';
import type { LoginTokens, User } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: load tokens from SecureStore and fetch profile
  useEffect(() => {
    (async () => {
      try {
        await initTokens();
        if (hasSession()) {
          const me = await api.get<User>('/auth/me');
          setUser(me.data);
        }
      } catch {
        await clearTokens();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.publicPost<LoginTokens>('/auth/login', { email, password });
    await saveTokens(r.data.accessToken, r.data.refreshToken);
    const me = await api.get<User>('/auth/me');
    setUser(me.data);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    await api.publicPost<User>('/auth/register', data);
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
      await clearTokens();
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await api.get<User>('/auth/me');
    setUser(me.data);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        login,
        register,
        logout,
        refreshUser,
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
