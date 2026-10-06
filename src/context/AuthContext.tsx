import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch, setToken } from "@/lib/api";

export type AuthUser = {
  id: number;
  username: string;
  role: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
};

type Ctx = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginSms: (phone: string, code: string) => Promise<void>;
  logout: () => void;
  reloadMe: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const me = await apiFetch<AuthUser>("/api/auth/me");
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiFetch<{ access_token: string }>("/api/auth/login", {
      method: "POST",
      json: { username, password },
    });
    setToken(res.access_token);
    const me = await apiFetch<AuthUser>("/api/auth/me");
    setUser(me);
  }, []);

  const loginSms = useCallback(async (phone: string, code: string) => {
    const res = await apiFetch<{ access_token: string }>("/api/auth/login-sms", {
      method: "POST",
      json: { phone, code },
    });
    setToken(res.access_token);
    const me = await apiFetch<AuthUser>("/api/auth/me");
    setUser(me);
  }, []);

  const reloadMe = useCallback(async () => {
    const me = await apiFetch<AuthUser>("/api/auth/me");
    setUser(me);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, loginSms, logout, reloadMe }),
    [user, loading, login, loginSms, logout, reloadMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return v;
}
