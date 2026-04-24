/** API origin only (protocol + host + optional port). Never put `/api/v1` here — paths use API_PREFIX below. */
const API_BASE = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
/** Must match backend `API_PREFIX` (see repo `.env.example`). */
const API_PREFIX = "/api/v1";

const ACCESS_KEY = "projectpilot_token";
const REFRESH_KEY = "projectpilot_refresh";

const AUTH_PATH_SKIP_REFRESH = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/forgot-password",
  "/auth/reset-password",
];

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${API_PREFIX}${p}`;
}

export function getToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string | null, refresh: string | null): void {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  else localStorage.removeItem(ACCESS_KEY);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  else localStorage.removeItem(REFRESH_KEY);
}

/** @deprecated use setTokens */
export function setToken(token: string | null): void {
  if (token) setTokens(token, getRefreshToken());
  else clearTokens();
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

let refreshInFlight: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;
  const res = await fetch(apiUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: rt }),
  });
  if (!res.ok) {
    clearTokens();
    return false;
  }
  const data = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!data.access_token || !data.refresh_token) {
    clearTokens();
    return false;
  }
  setTokens(data.access_token, data.refresh_token);
  return true;
}

function tryRefreshTokens(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function shouldAttemptRefresh(path: string): boolean {
  return !AUTH_PATH_SKIP_REFRESH.some((p) => path.startsWith(p));
}

export async function apiFetch(path: string, init: RequestInit = {}, isRetry = false): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (
    init.body !== undefined &&
    !(init.body instanceof FormData) &&
    !(init.body instanceof URLSearchParams) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(apiUrl(path), { ...init, headers });

  const method = (init.method ?? "GET").toUpperCase();
  const body = init.body;
  const canRetryBody =
    body === undefined ||
    typeof body === "string" ||
    body instanceof URLSearchParams ||
    (typeof Blob !== "undefined" && body instanceof Blob);

  if (
    res.status === 401 &&
    !isRetry &&
    shouldAttemptRefresh(path) &&
    getRefreshToken() &&
    (method === "GET" || method === "HEAD" || canRetryBody)
  ) {
    const refreshed = await tryRefreshTokens();
    if (refreshed) return apiFetch(path, init, true);
  }

  return res;
}

export function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError && String((e as Error).message).toLowerCase().includes("fetch");
}

/** Safe JSON parse; returns null on empty or invalid JSON (no throw). */
export function tryParseJson<T>(text: string): T | null {
  const t = text.trim();
  if (!t) return null;
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

/** Build a user-facing message from an API error body (FastAPI `detail` or raw text). */
export function formatApiErrorFromBody(status: number, text: string): string {
  const parsed = tryParseJson<{ detail?: unknown }>(text);
  if (parsed && parsed.detail !== undefined && parsed.detail !== null) {
    const d = parsed.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      const first = d[0];
      if (first && typeof first === "object" && first !== null && "msg" in first) {
        return String((first as { msg: string }).msg);
      }
      try {
        return JSON.stringify(d);
      } catch {
        return `Request failed (${status})`;
      }
    }
  }
  const snippet = text.trim().slice(0, 280);
  return snippet || `Request failed (${status})`;
}

/**
 * Read response body once: throw Error with API message if !ok; otherwise parse JSON.
 * Prefer this over `parseJson` when failure bodies may be non-JSON (proxies, HTML).
 */
export async function readJsonOk<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(formatApiErrorFromBody(res.status, text));
  const data = tryParseJson<T>(text);
  if (data === null) throw new Error(text.trim() ? "Invalid JSON response" : "Empty response");
  return data;
}

export async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  const data = tryParseJson<T>(text);
  if (data === null) throw new SyntaxError("Invalid JSON");
  return data;
}
