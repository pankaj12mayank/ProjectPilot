import type { UserRole } from "./types";

export function isPlatformAdmin(role: UserRole | string | undefined): boolean {
  return role === "admin" || role === "system_owner";
}

export function isSystemOwner(role: UserRole | string | undefined): boolean {
  return role === "system_owner";
}

/** Where to send the user immediately after a successful sign-in or registration. */
export function postLoginPath(
  role: UserRole | string | undefined,
  fallbackFromState: string | undefined,
): string {
  const dest = fallbackFromState?.trim() || "/dashboard";
  if (isPlatformAdmin(role)) {
    if (dest.startsWith("/dashboard/admin")) return dest;
    if (dest.startsWith("/admin")) return dest.replace(/^\/admin/, "/dashboard/admin") || "/dashboard/admin";
    return "/dashboard/admin";
  }
  if (dest.startsWith("/admin") || dest.startsWith("/dashboard/admin")) {
    return "/dashboard";
  }
  return dest;
}
