import { formatApiErrorFromBody } from "../api/client";

/** Turn API / thrown errors into short, human-friendly copy for toasts. */
export function friendlyErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof Error) {
    const m = err.message.trim();
    if (!m) return fallback;
    return humanizeDetail(m) || m;
  }
  return fallback;
}

/** Map common API `detail` strings to clearer language. */
export function humanizeDetail(raw: string): string {
  const t = raw.trim();
  const lower = t.toLowerCase();
  if (lower.includes("not authenticated")) return "Your session expired. Please sign in again.";
  if (lower.includes("could not validate credentials")) return "Your session expired. Please sign in again.";
  if (lower === "forbidden" || lower.includes("not enough permissions")) return "You are not allowed to do that.";
  if (lower.includes("user not found")) return "That user is no longer in the system.";
  if (lower.includes("project not found")) return "That project no longer exists. Refresh the list.";
  if (lower === "not found" || (lower.includes("not found") && lower.length < 40))
    return "We could not find that. It may have been removed already.";
  if (lower.includes("cannot delete the last active platform administrator"))
    return "You cannot remove the last active administrator. Promote someone else first.";
  if (lower.includes("system owner account cannot be deleted")) return "The system owner account cannot be deleted.";
  if (lower.includes("cannot delete your own account")) return "You cannot delete your own account.";
  if (lower.includes("linked records")) return "This account cannot be removed yet because other data still references it. Try deactivating instead.";
  if (lower.includes("network error")) return t;
  if (lower.includes("please choose at least one file")) return "Pick at least one file for status tracker, RAID log, or weekly history, then try again.";
  if (lower.includes("attach at least one file")) return "Pick at least one file to upload, then try again.";
  if (lower.includes("unsupported file type") || lower.includes(".csv, .xlsx, or .xls"))
    return "Only CSV or Excel files (.csv, .xlsx, .xls) are accepted for project uploads.";
  if (lower.includes("file too large") || lower.includes("maximum size"))
    return t.length > 220 ? `${t.slice(0, 217)}…` : t;
  return t.length > 220 ? `${t.slice(0, 217)}…` : t;
}

export function friendlyHttpError(status: number, bodyText: string, fallback: string): string {
  if (status === 401) return "Please sign in again.";
  if (status === 403) return "You are not allowed to do that.";
  if (status === 404) return humanizeDetail(formatApiErrorFromBody(status, bodyText)) || "We could not find what you asked for.";
  if (status === 405) return "This action is not available on the server. Try refreshing the page.";
  if (status >= 500) return "The server had a problem. Please try again in a moment.";
  return humanizeDetail(formatApiErrorFromBody(status, bodyText)) || fallback;
}
