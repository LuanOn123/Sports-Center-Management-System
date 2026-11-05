import React, { createContext, useContext, useEffect, useState } from "react";
import { authApi, type LoginPayload, type GoogleRegisterPayload } from "../api/auth.api";
import { getAccessToken, clearTokens } from "../api/client";
import type { User } from "../types/member";
import { useQueryClient } from "@tanstack/react-query";

// The active Session owns authentication. Member pages consume that same profile.
export function MemberSessionProvider({
  user,
  onLogout,
  children,
}: {
  user: User;
  onLogout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const cache = useQueryClient();
  const updateUser = (updated: User) => {
    cache.setQueryData(["me"], { success: true, message: "", data: updated });
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        loading: false,
        logout: onLogout,
        updateUser,
        refreshUser: async () => updateUser(await authApi.getMe()),
        login: async () => {
          throw new Error("Vui lòng đăng nhập tại trang đăng nhập chung.");
        },
        loginWithGoogle: async () => {
          throw new Error("Vui lòng đăng nhập tại trang đăng nhập chung.");
        },
        registerWithGoogle: async () => {
          throw new Error("Vui lòng đăng ký tại trang đăng ký chung.");
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginPayload) => Promise<User>;
  loginWithGoogle: (credential: string) => Promise<User>;
  registerWithGoogle: (data: GoogleRegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const u = await authApi.getMe();
      setUser(u);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();

    const handleExpired = () => {
      clearTokens();
      setUser(null);
    };

    window.addEventListener("session-expired", handleExpired);
    return () => window.removeEventListener("session-expired", handleExpired);
  }, []);

  const login = async (credentials: LoginPayload) => {
    setLoading(true);
    try {
      const result = await authApi.login(credentials);
      setUser(result.user);
      return result.user;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (credential: string) => {
    setLoading(true);
    try {
      const result = await authApi.loginWithGoogle(credential);
      setUser(result.user);
      return result.user;
    } finally {
      setLoading(false);
    }
  };

  const registerWithGoogle = async (data: GoogleRegisterPayload) => {
    setLoading(true);
    try {
      const result = await authApi.registerWithGoogle(data);
      setUser(result.user);
      return result.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      clearTokens();
    } finally {
      setUser(null);
    }
  };

  const updateUser = (updated: User) => {
    setUser(updated);
  };

  const refreshUser = async () => {
    try {
      const u = await authApi.getMe();
      setUser(u);
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithGoogle,
        registerWithGoogle,
        logout,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
