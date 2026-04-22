import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import type { ThemePreference } from "@/auth/types";
import { apiFetch } from "@/api/client";
import {
  ThemeContext,
  type ThemeContextValue,
  type ThemeMode,
  type ThemeProviderProps,
} from "./theme-context";

const STORAGE_KEY = "pp-theme";

function getStoredTheme(): ThemeMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return null;
}

function persistLocalPreference(p: ThemeMode | "system") {
  try {
    if (p === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, p);
  } catch {
    /* ignore */
  }
}

function readSystemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

function isServerTheme(v: unknown): v is ThemePreference {
  return v === "light" || v === "dark" || v === "system";
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { user, ready, refreshMe } = useAuth();
  const [preference, setPreferenceState] = useState<ThemeMode | "system">(() => getStoredTheme() ?? "system");
  const [systemDark, setSystemDark] = useState(readSystemDark);
  const themeFlipSkip = useRef(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => setSystemDark(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const resolved: ThemeMode = useMemo(() => {
    if (preference === "light" || preference === "dark") return preference;
    return systemDark ? "dark" : "light";
  }, [preference, systemDark]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  useEffect(() => {
    if (themeFlipSkip.current) {
      themeFlipSkip.current = false;
      return;
    }
    const root = document.documentElement;
    root.classList.add("pp-theme-flip");
    const t = window.setTimeout(() => root.classList.remove("pp-theme-flip"), 420);
    return () => window.clearTimeout(t);
  }, [resolved]);

  /**
   * When auth is ready: if the user has a stored server theme, it wins over localStorage alone.
   * If the server value is null/omitted, fall back to local preference for this device.
   */
  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setPreferenceState(getStoredTheme() ?? "system");
      return;
    }
    const srv = user.theme_preference;
    if (isServerTheme(srv)) {
      setPreferenceState(srv);
      persistLocalPreference(srv);
    } else {
      setPreferenceState(getStoredTheme() ?? "system");
    }
  }, [ready, user?.id, user?.theme_preference]);

  const syncThemeToServer = useCallback(
    async (p: ThemeMode | "system") => {
      try {
        const res = await apiFetch("/users/me", {
          method: "PATCH",
          body: JSON.stringify({ theme_preference: p }),
        });
        if (res.ok) await refreshMe();
      } catch {
        /* ignore */
      }
    },
    [refreshMe],
  );

  const setPreference = useCallback(
    (p: ThemeMode | "system") => {
      setPreferenceState(p);
      persistLocalPreference(p);
      if (user) void syncThemeToServer(p);
    },
    [user, syncThemeToServer],
  );

  const toggle = useCallback(() => {
    setPreference(resolved === "dark" ? "light" : "dark");
  }, [resolved, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ resolved, preference, setPreference, toggle }),
    [resolved, preference, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
