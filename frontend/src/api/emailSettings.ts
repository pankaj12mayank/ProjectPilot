import { apiFetch, readJsonOk } from "./client";

export type EmailProvider = "smtp" | "sendgrid";

export type EmailSettingsAdmin = {
  provider: EmailProvider;
  enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  use_tls: boolean;
  use_ssl: boolean;
  smtp_user: string;
  from_email: string;
  from_name: string;
  password_configured: boolean;
  api_key_configured: boolean;
  updated_at: string | null;
  updated_by_user_id: string | null;
};

/** Full save: omit `smtp_password` / `api_key` keys to leave stored secrets unchanged. */
export type EmailSettingsPostBody = {
  provider: EmailProvider;
  enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  use_tls: boolean;
  use_ssl: boolean;
  smtp_user: string;
  from_email: string;
  from_name: string;
  smtp_password?: string | null;
  api_key?: string | null;
};

export type EmailSettingsPatch = Partial<{
  provider: EmailProvider;
  enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  use_tls: boolean;
  use_ssl: boolean;
  smtp_user: string;
  smtp_password: string | null;
  api_key: string | null;
  from_email: string;
  from_name: string;
}>;

export async function fetchEmailSettingsAdmin(): Promise<EmailSettingsAdmin> {
  const res = await apiFetch("/admin/email-settings");
  return readJsonOk<EmailSettingsAdmin>(res);
}

export async function postEmailSettingsAdmin(body: EmailSettingsPostBody): Promise<EmailSettingsAdmin> {
  const res = await apiFetch("/admin/email-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJsonOk<EmailSettingsAdmin>(res);
}

export async function patchEmailSettingsAdmin(body: EmailSettingsPatch): Promise<EmailSettingsAdmin> {
  const res = await apiFetch("/admin/email-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJsonOk<EmailSettingsAdmin>(res);
}

export async function postEmailSettingsTest(to: string): Promise<{ ok: boolean; message: string }> {
  const res = await apiFetch("/admin/email-settings/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to }),
  });
  return readJsonOk<{ ok: boolean; message: string }>(res);
}
