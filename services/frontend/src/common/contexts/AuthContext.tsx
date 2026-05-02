import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { User } from "@aegis/shared";
import { fetchCurrentUser, login as apiLogin, logout as apiLogout, clearAuthToken, getAuthToken } from "@/common/api/auth";
import { logError } from "@/common/api/core";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetchCurrentUser()
      .then(setUser)
      .catch((e) => {
        logError("AuthContext.init", e);
        clearAuthToken();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string, rememberMe = false) => {
    const result = await apiLogin(username, password, rememberMe);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
