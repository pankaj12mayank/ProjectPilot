/** Roles that may be assigned when creating or editing users (not system_owner). */
export const ASSIGNABLE_USER_ROLES = [
  "admin",
  "pmo",
  "project_manager",
  "client",
  "member",
  "viewer",
] as const;

export type AssignableUserRole = (typeof ASSIGNABLE_USER_ROLES)[number];

/** Any account role returned by the API (includes bootstrap system owner). */
export type UserRole = AssignableUserRole | "system_owner";

export function roleOptionsForActor(_actorRole: UserRole | string | undefined): AssignableUserRole[] {
  return [...ASSIGNABLE_USER_ROLES];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  system_owner: "System owner",
  admin: "Admin",
  pmo: "PMO",
  project_manager: "Project manager",
  client: "Client",
  member: "Member",
  viewer: "Viewer",
};

export type ThemePreference = "light" | "dark" | "system";

export type User = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  theme_preference?: ThemePreference | null;
  created_at?: string;
  has_avatar?: boolean;
  updated_at?: string;
};
