import { apiFetch, readJsonOk } from "./client";

export type AuditLogRow = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  detail: Record<string, unknown>;
  ip_address: string | null;
};

export type ActivityLogRow = {
  id: string;
  created_at: string;
  actor_user_id: string;
  project_id: string | null;
  project_name?: string | null;
  kind: string;
  summary: string;
  detail: Record<string, unknown>;
};

export type NotificationLogRow = {
  id: string;
  created_at: string;
  user_id: string;
  channel: string;
  title: string;
  detail: Record<string, unknown>;
  read_at: string | null;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export type AuditLogQuery = {
  q?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
};

export async function fetchAuditLogsPaged(q: AuditLogQuery = {}): Promise<Paginated<AuditLogRow>> {
  const res = await apiFetch(`/logs/audit${buildQuery(q)}`);
  return readJsonOk<Paginated<AuditLogRow>>(res);
}

export type ActivityLogQuery = {
  q?: string;
  project_id?: string;
  kind?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
};

export async function fetchActivityLogsPaged(q: ActivityLogQuery = {}): Promise<Paginated<ActivityLogRow>> {
  const res = await apiFetch(`/logs/activity${buildQuery(q)}`);
  return readJsonOk<Paginated<ActivityLogRow>>(res);
}

export type NotificationLogQuery = {
  q?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
};

export async function fetchNotificationLogsPaged(q: NotificationLogQuery = {}): Promise<Paginated<NotificationLogRow>> {
  const res = await apiFetch(`/logs/notifications${buildQuery(q)}`);
  return readJsonOk<Paginated<NotificationLogRow>>(res);
}
