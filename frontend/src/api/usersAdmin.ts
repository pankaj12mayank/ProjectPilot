import { apiFetch } from "./client";
import { friendlyHttpError } from "@/lib/friendlyMessages";

/** Permanently delete a user (admin). Tries POST /users/{id}/delete first, then legacy path. */
export async function deleteUserPermanent(userId: string): Promise<void> {
  const enc = encodeURIComponent(userId.trim());
  let res = await apiFetch(`/users/${enc}/delete`, { method: "POST" });
  if (res.status === 404) {
    res = await apiFetch(`/users/delete/${enc}`, { method: "POST" });
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(friendlyHttpError(res.status, text, "We could not remove that user."));
  }
}
