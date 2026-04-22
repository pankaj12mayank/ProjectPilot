import { createContext, type ReactNode } from "react";

export type ThemeMode = "light" | "dark";

export type ThemeContextValue = {
  resolved: ThemeMode;
  preference: ThemeMode | "system";
  setPreference: (p: ThemeMode | "system") => void;
  toggle: () => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export type ThemeProviderProps = { children: ReactNode };
