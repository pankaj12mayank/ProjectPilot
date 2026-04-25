import { apiFetch, apiUrl, parseJson, readJsonOk } from "@/api/client";
import type { User } from "@/auth/types";

export async function changeMyPassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await apiFetch("/users/me/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!res.ok) {
    const data = await parseJson<{ detail?: string }>(res);
    throw new Error(typeof data.detail === "string" ? data.detail : "Could not update password");
  }
}

export async function uploadMyAvatar(file: File): Promise<User> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await apiFetch("/users/me/avatar", {
    method: "POST",
    body: fd,
  });
  return readJsonOk<User>(res);
}

export function publicAvatarUrl(userId: string): string {
  return apiUrl(`/users/public/avatar/${encodeURIComponent(userId)}`);
}

/** Optional cache-bust when avatar updated. */
export function publicAvatarSrc(userId: string, revision: number): string {
  const u = publicAvatarUrl(userId);
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}v=${revision}`;
}
