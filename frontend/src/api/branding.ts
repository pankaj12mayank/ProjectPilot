import { apiFetch, apiUrl, parseJson } from "./client";

export type SidebarLogoFilter = "auto" | "invert" | "original";

export type BrandingPublic = {
  product_name: string;
  product_tagline: string;
  footer_text: string;
  support_email: string;
  company_address: string;
  social: Record<string, string | null | undefined>;
  meta_title: string;
  meta_description: string;
  default_domain_url: string;
  company_website_url: string;
  public_api_url: string;
  public_app_url: string;
  asset_version: number;
  asset_urls: Record<string, string | null | undefined>;
  files_base: string;
  sidebar_logo_filter?: SidebarLogoFilter;
  accent_color_light?: string;
  accent_color_dark?: string;
};

export type BrandingAdmin = BrandingPublic & {
  assets: Record<string, string | null | undefined>;
  updated_at: string | null;
  updated_by_user_id: string | null;
  max_upload_mb?: number;
};

export async function fetchBrandingPublic(signal?: AbortSignal): Promise<BrandingPublic> {
  const res = await fetch(apiUrl("/branding/public"), { signal });
  if (!res.ok) throw new Error("Failed to load branding");
  return parseJson<BrandingPublic>(res);
}

export async function fetchBrandingAdmin(): Promise<BrandingAdmin> {
  const res = await apiFetch("/admin/branding");
  if (!res.ok) throw new Error(await res.text());
  return parseJson<BrandingAdmin>(res);
}

export async function patchBrandingAdmin(body: Record<string, unknown>): Promise<BrandingAdmin> {
  const res = await apiFetch("/admin/branding", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Save failed");
  }
  return parseJson<BrandingAdmin>(res);
}

export async function deleteBrandingAsset(slot: string): Promise<BrandingAdmin> {
  const res = await apiFetch(`/admin/branding/assets/${encodeURIComponent(slot)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return parseJson<BrandingAdmin>(res);
}

export type UploadBrandingResult = {
  slot: string;
  filename: string;
  url: string;
  asset_version: number;
};

export function uploadBrandingFile(
  slot: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<UploadBrandingResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.set("slot", slot);
    fd.set("file", file, file.name);
    xhr.open("POST", apiUrl("/admin/branding/upload"));
    const token = localStorage.getItem("projectpilot_token");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (ev) => {
      if (!onProgress || !ev.lengthComputable) return;
      onProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadBrandingResult);
        } catch {
          reject(new Error("Invalid response"));
        }
      } else {
        reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(fd);
  });
}
