import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  apiFetch,
  apiUrl,
  clearTokens,
  getRefreshToken,
  getToken,
  parseJson,
  setTokens,
} from "../api/client";
import type { User } from "./types";

type AuthState = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const refreshMe = useCallback(async () => {
    const access = getToken();
    const refresh = getRefreshToken();
    if (!access && !refresh) {
      setUser(null);
      setReady(true);
      return;
    }
    if (!access && refresh) {
      const ok = await fetch(apiUrl("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      }).then(async (r) => {
        if (!r.ok) return false;
        const d = (await r.json()) as { access_token?: string; refresh_token?: string };
        if (!d.access_token || !d.refresh_token) return false;
        setTokens(d.access_token, d.refresh_token);
        return true;
      });
      if (!ok) {
        clearTokens();
        setUser(null);
        setReady(true);
        return;
      }
    }
    const res = await apiFetch("/users/me");
    if (!res.ok) {
      clearTokens();
      setUser(null);
      setReady(true);
      return;
    }
    const data = await parseJson<User>(res);
    setUser(data);
    setReady(true);
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const data = await parseJson<{
      access_token?: string;
      refresh_token?: string;
      detail?: string;
    }>(res);
    if (!res.ok) {
      throw new Error(typeof data.detail === "string" ? data.detail : "Login failed");
    }
    if (!data.access_token || !data.refresh_token) throw new Error("No tokens returned");
    setTokens(data.access_token, data.refresh_token);
    await refreshMe();
  }, [refreshMe]);

  const register = useCallback(
    async (email: string, password: string, fullName: string) => {
      const res = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
      const data = await parseJson<{ detail?: string }>(res);
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Registration failed");
      }
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, logout, refreshMe }),
    [user, ready, login, register, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
