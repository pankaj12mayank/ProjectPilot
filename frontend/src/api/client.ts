const API_BASE = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
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

export async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}
