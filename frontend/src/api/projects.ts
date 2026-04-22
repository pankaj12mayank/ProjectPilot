import { apiFetch, apiUrl, getRefreshToken, getToken, parseJson, setTokens } from "./client";

export type ProjectOut = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
};

export type FileSlotError = {
  code: string;
  message: string;
  row: number | null;
  column: string | null;
};

export type FileAnalyzeSlot = {
  role: string;
  filename: string | null;
  valid: boolean;
  errors: FileSlotError[];
  warnings: string[];
  column_mapping: Record<string, string>;
  preview_columns: string[];
  preview_rows: Array<Array<string | number | boolean | null>>;
  sheet_used?: string | null;
  data_row_count?: number | null;
  persisted_row_count?: number | null;
};

export type AnalyzeUploadResponse = {
  project_id: string;
  files: FileAnalyzeSlot[];
};

export async function fetchProjects(): Promise<ProjectOut[]> {
  const res = await apiFetch("/projects");
  if (!res.ok) throw new Error(await res.text());
  return parseJson<ProjectOut[]>(res);
}

export async function fetchProject(id: string): Promise<ProjectOut> {
  const res = await apiFetch(`/projects/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return parseJson<ProjectOut>(res);
}

export async function createProject(body: { name: string; description?: string | null }): Promise<ProjectOut> {
  const res = await apiFetch("/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return parseJson<ProjectOut>(res);
}

export async function updateProject(
  id: string,
  body: { name?: string; description?: string | null; is_archived?: boolean },
): Promise<ProjectOut> {
  const res = await apiFetch(`/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return parseJson<ProjectOut>(res);
}

async function refreshAccessToken(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;
  const res = await fetch(apiUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: rt }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!data.access_token || !data.refresh_token) return false;
  setTokens(data.access_token, data.refresh_token);
  return true;
}

/**
 * Multipart upload with progress. Retries once after refresh on 401 (FormData cannot reuse body).
 */
export function uploadProjectAnalyze(
  projectId: string,
  formData: FormData,
  onProgress: (pct: number) => void,
): Promise<AnalyzeUploadResponse> {
  return new Promise((resolve, reject) => {
    const path = `/projects/${projectId}/uploads/analyze`;

    function run(isRetry: boolean) {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", apiUrl(path));
      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) onProgress(Math.round((evt.loaded / evt.total) * 100));
        else onProgress(0);
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));

      xhr.onload = async () => {
        if (xhr.status === 401 && !isRetry && getRefreshToken()) {
          const ok = await refreshAccessToken();
          if (ok) {
            run(true);
            return;
          }
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText || "{}") as AnalyzeUploadResponse);
          } catch (e) {
            reject(e);
          }
          return;
        }
        reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
      };

      xhr.send(formData);
    }

    run(false);
  });
}

export async function recordProjectMetricsSnapshot(
  projectId: string,
): Promise<{ snapshot_id: string; created_at: string }> {
  const res = await apiFetch(`/projects/${projectId}/metrics/snapshot`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return parseJson<{ snapshot_id: string; created_at: string }>(res);
}
