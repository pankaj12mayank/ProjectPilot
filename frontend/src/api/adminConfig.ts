import { apiFetch, readJsonOk } from "./client";

export type AdminSystemConfigOut = {
  api_prefix: string;
  cors_origins: string;
  log_level: string;
  chart_dpi: number;
  jwt_algorithm: string;
  jwt_access_expire_minutes: number;
  jwt_refresh_expire_days: number;
  jwt_secret_configured: boolean;
  rag_thresholds: Record<string, number>;
  branding_max_upload_mb: number;
  project_upload_max_mb: number;
  public_api_url: string | null;
  public_app_url: string | null;
  database_kind: string;
  paths: {
    repo_root: string;
    data_dir: string;
    logs_dir: string;
    outputs_dir: string;
    uploads_dir: string;
  };
  dev_return_reset_token: boolean;
  email_send_ready: boolean;
  email_send_status: string;
};

export async function fetchAdminSystemConfig(): Promise<AdminSystemConfigOut> {
  const res = await apiFetch("/admin/system-config");
  return readJsonOk<AdminSystemConfigOut>(res);
}

export async function postAdminReloadSettingsCache(): Promise<{ status: string; message: string }> {
  const res = await apiFetch("/admin/runtime/reload-settings", { method: "POST" });
  return readJsonOk<{ status: string; message: string }>(res);
}
