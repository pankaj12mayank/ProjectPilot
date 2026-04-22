export const USER_ROLE_OPTIONS = [
  "super_admin",
  "admin",
  "pmo",
  "project_manager",
  "delivery_manager",
  "client",
  "viewer",
  "manager",
  "member",
] as const;

export type UserRole = (typeof USER_ROLE_OPTIONS)[number];

export type ThemePreference = "light" | "dark" | "system";

export type User = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  theme_preference?: ThemePreference | null;
};
