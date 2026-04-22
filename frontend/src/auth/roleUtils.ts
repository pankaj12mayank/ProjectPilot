import type { UserRole } from "./types";

const PLATFORM_ADMIN_ROLES: UserRole[] = ["admin", "super_admin"];

export function isPlatformAdmin(role: UserRole | string | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

/** Where to send the user immediately after a successful sign-in or registration. */
export function postLoginPath(
  role: UserRole | string | undefined,
  fallbackFromState: string | undefined,
): string {
  const dest = fallbackFromState?.trim() || "/dashboard";
  if (isPlatformAdmin(role)) {
    return dest.startsWith("/admin") ? dest : "/admin";
  }
  if (dest.startsWith("/admin")) {
    return "/dashboard";
  }
  return dest;
}
