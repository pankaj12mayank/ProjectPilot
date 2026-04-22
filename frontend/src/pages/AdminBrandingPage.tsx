import { useCallback, useEffect, useMemo, useState } from "react";
import { useSidebarLogoInvertClass } from "@/hooks/useSidebarLogoInvertClass";
import type { BrandingAdmin, SidebarLogoFilter } from "../api/branding";
import { deleteBrandingAsset, fetchBrandingAdmin, patchBrandingAdmin, uploadBrandingFile } from "../api/branding";
import { useBranding } from "../branding/BrandingProvider";
import { useToast } from "../components/ToastProvider";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FormField } from "../components/ui/FormField";

const ASSET_SLOTS: { slot: string; label: string; hint?: string }[] = [
  { slot: "logo", label: "Main logo (light)", hint: "PNG recommended for transparency." },
  { slot: "logo_dark", label: "Main logo (dark mode)" },
  { slot: "favicon", label: "Favicon (light theme)", hint: "ICO or PNG." },
  { slot: "favicon_dark", label: "Favicon (dark theme)", hint: "Shown when the app is in dark mode. Falls back to light favicon if empty." },
  { slot: "sidebar_logo", label: "Sidebar logo (light theme)" },
  { slot: "sidebar_logo_dark", label: "Sidebar logo (dark theme)" },
  { slot: "login_illustration", label: "Login illustration (light)" },
  { slot: "login_illustration_dark", label: "Login illustration (dark mode)" },
  { slot: "login_bg", label: "Login background (light)" },
  { slot: "login_bg_dark", label: "Login background (dark mode)" },
  { slot: "dashboard_banner", label: "Dashboard banner (light)" },
  { slot: "dashboard_banner_dark", label: "Dashboard banner (dark mode)" },
  { slot: "report_cover", label: "Report cover (light)" },
  { slot: "report_cover_dark", label: "Report cover (dark mode)" },
];

function allowedExts(slot: string): string[] {
  if (slot === "favicon" || slot === "favicon_dark") return ["ico", "png", "webp", "jpg", "jpeg"];
  return ["png", "jpg", "jpeg", "svg", "webp"];
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function validateHttpUrl(label: string, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return `${label} must use http or https`;
    if (!u.hostname) return `${label} must include a host`;
  } catch {
    return `${label} is not a valid URL`;
  }
  return null;
}

function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Support email looks invalid";
  return null;
}

function validateAccentHex(label: string, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!/^#[0-9A-Fa-f]{6}$/.test(v)) return `${label} must be empty or #RRGGBB (e.g. #14B8A6)`;
  return null;
}

type Draft = {
  product_name: string;
  product_tagline: string;
  footer_text: string;
  support_email: string;
  company_address: string;
  meta_title: string;
  meta_description: string;
  default_domain_url: string;
  company_website_url: string;
  public_api_url: string;
  public_app_url: string;
  social: Record<string, string>;
  sidebar_logo_filter: SidebarLogoFilter;
  accent_color_light: string;
  accent_color_dark: string;
};

function normalizeFilter(v: string | undefined): SidebarLogoFilter {
  const x = (v || "auto").toLowerCase();
  return x === "invert" || x === "original" ? x : "auto";
}

function toDraft(b: BrandingAdmin): Draft {
  const s = b.social || {};
  return {
    product_name: b.product_name,
    product_tagline: b.product_tagline,
    footer_text: b.footer_text,
    support_email: b.support_email,
    company_address: b.company_address,
    meta_title: b.meta_title,
    meta_description: b.meta_description,
    default_domain_url: b.default_domain_url,
    company_website_url: b.company_website_url,
    public_api_url: b.public_api_url,
    public_app_url: b.public_app_url,
    social: {
      twitter: String(s.twitter ?? ""),
      linkedin: String(s.linkedin ?? ""),
      facebook: String(s.facebook ?? ""),
      github: String(s.github ?? ""),
      youtube: String(s.youtube ?? ""),
    },
    sidebar_logo_filter: normalizeFilter(b.sidebar_logo_filter),
    accent_color_light: (b.accent_color_light || "").trim(),
    accent_color_dark: (b.accent_color_dark || "").trim(),
  };
}

export default function AdminBrandingPage() {
  const toast = useToast();
  const { refresh: refreshPublic } = useBranding();
  const [remote, setRemote] = useState<BrandingAdmin | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});

  const maxMb = remote?.max_upload_mb ?? 5;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const b = await fetchBrandingAdmin();
      setRemote(b);
      setDraft(toDraft(b));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load branding");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const previewUrls = useMemo(() => {
    const out: Record<string, string | undefined> = {};
    if (!remote) return out;
    for (const { slot } of ASSET_SLOTS) {
      out[slot] = pendingFiles[slot] ?? (remote.asset_urls?.[slot] as string | undefined) ?? undefined;
    }
    return out;
  }, [remote, pendingFiles]);

  const sidebarPreviewLightInvert = useSidebarLogoInvertClass(
    previewUrls.sidebar_logo,
    draft?.sidebar_logo_filter ?? "auto",
  );
  const sidebarPreviewDarkInvert = useSidebarLogoInvertClass(
    previewUrls.sidebar_logo_dark ?? previewUrls.sidebar_logo,
    draft?.sidebar_logo_filter ?? "auto",
  );

  function onPickFile(slot: string, file: File | null) {
    if (!file) return;
    const ex = extOf(file.name);
    if (!allowedExts(slot).includes(ex)) {
      toast.push("error", `Use one of: ${allowedExts(slot).join(", ")}`);
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      toast.push("error", `File exceeds ${maxMb} MB`);
      return;
    }
    const url = URL.createObjectURL(file);
    setPendingFiles((p) => ({ ...p, [slot]: url }));
    void uploadForSlot(slot, file, url);
  }

  async function uploadForSlot(slot: string, file: File, blobUrl: string) {
    setProgress((p) => ({ ...p, [slot]: 0 }));
    try {
      const res = await uploadBrandingFile(slot, file, (pct) => setProgress((p) => ({ ...p, [slot]: pct })));
      setRemote((r) =>
        r
          ? {
              ...r,
              asset_version: res.asset_version,
              asset_urls: { ...r.asset_urls, [slot]: res.url },
              assets: { ...r.assets, [slot]: res.filename },
            }
          : r,
      );
      URL.revokeObjectURL(blobUrl);
      setPendingFiles((p) => {
        const next = { ...p };
        delete next[slot];
        return next;
      });
      toast.push("success", `${slot} uploaded`);
      await refreshPublic();
    } catch (e) {
      URL.revokeObjectURL(blobUrl);
      setPendingFiles((p) => {
        const next = { ...p };
        delete next[slot];
        return next;
      });
      toast.push("error", e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProgress((p) => {
        const next = { ...p };
        delete next[slot];
        return next;
      });
    }
  }

  async function onRemove(slot: string) {
    try {
      const b = await deleteBrandingAsset(slot);
      setRemote(b);
      setDraft(toDraft(b));
      toast.push("success", "Asset removed");
      await refreshPublic();
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Remove failed");
    }
  }

  function cancelEdits() {
    if (remote) setDraft(toDraft(remote));
    toast.push("info", "Text fields reverted");
  }

  async function saveText() {
    if (!draft) return;
    const errs = [
      validateEmail(draft.support_email),
      validateHttpUrl("Default domain URL", draft.default_domain_url),
      validateHttpUrl("Company website", draft.company_website_url),
      validateHttpUrl("Public API URL", draft.public_api_url),
      validateHttpUrl("Public app URL", draft.public_app_url),
      validateAccentHex("Light accent", draft.accent_color_light),
      validateAccentHex("Dark accent", draft.accent_color_dark),
    ].filter(Boolean) as string[];
    if (errs.length) {
      toast.push("error", errs[0]!);
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        product_name: draft.product_name,
        product_tagline: draft.product_tagline,
        footer_text: draft.footer_text,
        support_email: draft.support_email,
        company_address: draft.company_address,
        meta_title: draft.meta_title,
        meta_description: draft.meta_description,
        default_domain_url: draft.default_domain_url || null,
        company_website_url: draft.company_website_url || null,
        public_api_url: draft.public_api_url || null,
        public_app_url: draft.public_app_url || null,
        social: draft.social,
        sidebar_logo_filter: draft.sidebar_logo_filter,
        accent_color_light: draft.accent_color_light.trim(),
        accent_color_dark: draft.accent_color_dark.trim(),
      };
      const b = await patchBrandingAdmin(body);
      setRemote(b);
      setDraft(toDraft(b));
      toast.push("success", "Branding text saved");
      await refreshPublic();
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !draft || !remote) {
    return (
      <Card title="Branding">
        <p className="pp-muted">{loading ? "Loading…" : "Unavailable"}</p>
        {error ? (
          <p className="pp-field__error" role="alert">
            {error}
          </p>
        ) : null}
      </Card>
    );
  }

  return (
    <div className="pp-admin-branding">
      <div className="pp-branding-preview pp-card-surface">
        <h2 className="pp-h2">Theme preview</h2>
        <p className="pp-muted">
          Text reflects your draft. Images use saved uploads (new files appear after upload completes). Light vs dark
          columns show how logos, favicons, and banners pair with each theme.
        </p>
        <div className="pp-branding-theme-split">
          <div className="pp-branding-theme-panel">
            <span className="pp-branding-theme-label">Light theme</span>
            <div className="pp-branding-preview__mock pp-branding-preview__mock--split">
              <div className="pp-branding-preview__sidebar">
                {previewUrls.sidebar_logo ? (
                  <img
                    src={previewUrls.sidebar_logo}
                    alt=""
                    className={`pp-branding-preview__logo ${sidebarPreviewLightInvert}`.trim()}
                  />
                ) : (
                  <strong>{draft.product_name}</strong>
                )}
              </div>
              <div className="pp-branding-preview__main pp-branding-preview__main--light">
                <h3>{draft.product_name}</h3>
                <p className="pp-muted">{draft.product_tagline}</p>
                {previewUrls.dashboard_banner ? (
                  <img src={previewUrls.dashboard_banner} alt="" className="pp-branding-preview__banner" />
                ) : null}
                <footer className="pp-branding-preview__footer">{draft.footer_text}</footer>
                <div className="pp-branding-preview__favicon-row">
                  <span className="pp-muted">Favicon</span>
                  {previewUrls.favicon ? (
                    <img src={previewUrls.favicon} alt="" className="pp-branding-preview__favicon" />
                  ) : (
                    <span className="pp-muted">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="pp-branding-theme-panel">
            <span className="pp-branding-theme-label">Dark theme</span>
            <div className="pp-branding-preview__mock pp-branding-preview__mock--split">
              <div className="pp-branding-preview__sidebar">
                {previewUrls.sidebar_logo_dark || previewUrls.sidebar_logo ? (
                  <img
                    src={previewUrls.sidebar_logo_dark ?? previewUrls.sidebar_logo}
                    alt=""
                    className={`pp-branding-preview__logo ${sidebarPreviewDarkInvert}`.trim()}
                  />
                ) : (
                  <strong>{draft.product_name}</strong>
                )}
              </div>
              <div className="pp-branding-preview__main pp-branding-preview__main--dark">
                <h3>{draft.product_name}</h3>
                <p className="pp-branding-preview__tagline-dark">{draft.product_tagline}</p>
                {previewUrls.dashboard_banner_dark || previewUrls.dashboard_banner ? (
                  <img
                    src={previewUrls.dashboard_banner_dark ?? previewUrls.dashboard_banner}
                    alt=""
                    className="pp-branding-preview__banner"
                  />
                ) : null}
                <footer className="pp-branding-preview__footer pp-branding-preview__footer--dark">{draft.footer_text}</footer>
                <div className="pp-branding-preview__favicon-row">
                  <span className="pp-branding-preview__muted-dark">Favicon</span>
                  {previewUrls.favicon_dark || previewUrls.favicon ? (
                    <img
                      src={previewUrls.favicon_dark ?? previewUrls.favicon}
                      alt=""
                      className="pp-branding-preview__favicon"
                    />
                  ) : (
                    <span className="pp-branding-preview__muted-dark">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card title="General branding">
        {error ? (
          <p className="pp-field__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="pp-form pp-form--grid">
          <FormField label="Product name" htmlFor="b-name">
            <input
              id="b-name"
              className="pp-input"
              value={draft.product_name}
              onChange={(e) => setDraft((d) => (d ? { ...d, product_name: e.target.value } : d))}
            />
          </FormField>
          <FormField label="Product tagline" htmlFor="b-tag">
            <input
              id="b-tag"
              className="pp-input"
              value={draft.product_tagline}
              onChange={(e) => setDraft((d) => (d ? { ...d, product_tagline: e.target.value } : d))}
            />
          </FormField>
          <FormField label="Footer text" htmlFor="b-foot">
            <input
              id="b-foot"
              className="pp-input"
              value={draft.footer_text}
              onChange={(e) => setDraft((d) => (d ? { ...d, footer_text: e.target.value } : d))}
            />
          </FormField>
          <FormField label="Support email" htmlFor="b-mail">
            <input
              id="b-mail"
              className="pp-input"
              type="email"
              value={draft.support_email}
              onChange={(e) => setDraft((d) => (d ? { ...d, support_email: e.target.value } : d))}
            />
          </FormField>
          <FormField label="Company address" htmlFor="b-addr">
            <textarea
              id="b-addr"
              className="pp-input"
              rows={3}
              value={draft.company_address}
              onChange={(e) => setDraft((d) => (d ? { ...d, company_address: e.target.value } : d))}
            />
          </FormField>
        </div>
      </Card>

      <Card title="Theme accents">
        <p className="pp-muted">
          Optional hex colors for highlights and one chart series. Leave blank to use the default teal / cyan accents.
        </p>
        <div className="pp-form pp-form--grid">
          <FormField label="Accent (light theme)" htmlFor="b-ac-l">
            <input
              id="b-ac-l"
              className="pp-input"
              placeholder="#14B8A6"
              value={draft.accent_color_light}
              onChange={(e) => setDraft((d) => (d ? { ...d, accent_color_light: e.target.value } : d))}
            />
          </FormField>
          <FormField label="Accent (dark theme)" htmlFor="b-ac-d">
            <input
              id="b-ac-d"
              className="pp-input"
              placeholder="#22D3EE"
              value={draft.accent_color_dark}
              onChange={(e) => setDraft((d) => (d ? { ...d, accent_color_dark: e.target.value } : d))}
            />
          </FormField>
        </div>
      </Card>

      <Card title="Logo & favicon">
        <p className="pp-muted">Allowed: PNG, JPG, JPEG, SVG, WEBP. Favicon also allows ICO. Max {maxMb} MB.</p>
        <div className="pp-form" style={{ marginBottom: "1rem" }}>
          <FormField label="Sidebar logo on dark rail" htmlFor="sidebar-logo-filter">
            <p className="pp-muted" style={{ fontSize: "0.85rem", marginTop: 0 }}>
              Auto detects transparency (PNG/WebP). Opaque images (e.g. JPEG) are inverted for contrast unless you choose
              Original.
            </p>
            <select
              id="sidebar-logo-filter"
              className="pp-input"
              value={draft.sidebar_logo_filter}
              onChange={(e) =>
                setDraft((d) =>
                  d ? { ...d, sidebar_logo_filter: normalizeFilter(e.target.value) } : d,
                )
              }
            >
              <option value="auto">Auto — invert only if no transparency</option>
              <option value="invert">Always invert</option>
              <option value="original">Original colors (no invert)</option>
            </select>
          </FormField>
        </div>
        <div className="pp-branding-slots">
          {ASSET_SLOTS.filter((s) =>
            ["logo", "logo_dark", "favicon", "favicon_dark", "sidebar_logo", "sidebar_logo_dark"].includes(s.slot),
          ).map((s) => (
            <div key={s.slot} className="pp-branding-slot">
              <div>
                <strong>{s.label}</strong>
                {s.hint ? <p className="pp-muted pp-branding-slot__hint">{s.hint}</p> : null}
                <input
                  type="file"
                  accept={allowedExts(s.slot).map((x) => `.${x}`).join(",")}
                  onChange={(e) => onPickFile(s.slot, e.target.files?.[0] ?? null)}
                />
                {progress[s.slot] != null ? (
                  <progress value={progress[s.slot]} max={100}>
                    {progress[s.slot]}%
                  </progress>
                ) : null}
              </div>
              <div className="pp-branding-slot__preview">
                {previewUrls[s.slot] ? <img src={previewUrls[s.slot]} alt="" /> : <span className="pp-muted">No file</span>}
                {remote.assets?.[s.slot] ? (
                  <Button type="button" variant="secondary" onClick={() => void onRemove(s.slot)}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Login page branding">
        <div className="pp-branding-slots">
          {ASSET_SLOTS.filter((s) => s.slot.startsWith("login_")).map((s) => (
            <div key={s.slot} className="pp-branding-slot">
              <div>
                <strong>{s.label}</strong>
                <input
                  type="file"
                  accept={allowedExts(s.slot).map((x) => `.${x}`).join(",")}
                  onChange={(e) => onPickFile(s.slot, e.target.files?.[0] ?? null)}
                />
                {progress[s.slot] != null ? (
                  <progress value={progress[s.slot]} max={100}>
                    {progress[s.slot]}%
                  </progress>
                ) : null}
              </div>
              <div className="pp-branding-slot__preview">
                {previewUrls[s.slot] ? <img src={previewUrls[s.slot]} alt="" /> : <span className="pp-muted">No file</span>}
                {remote.assets?.[s.slot] ? (
                  <Button type="button" variant="secondary" onClick={() => void onRemove(s.slot)}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Dashboard & report branding">
        <div className="pp-branding-slots">
          {ASSET_SLOTS.filter((s) => s.slot.startsWith("dashboard_") || s.slot.startsWith("report_")).map((s) => (
            <div key={s.slot} className="pp-branding-slot">
              <div>
                <strong>{s.label}</strong>
                <input
                  type="file"
                  accept={allowedExts(s.slot).map((x) => `.${x}`).join(",")}
                  onChange={(e) => onPickFile(s.slot, e.target.files?.[0] ?? null)}
                />
                {progress[s.slot] != null ? (
                  <progress value={progress[s.slot]} max={100}>
                    {progress[s.slot]}%
                  </progress>
                ) : null}
              </div>
              <div className="pp-branding-slot__preview">
                {previewUrls[s.slot] ? <img src={previewUrls[s.slot]} alt="" /> : <span className="pp-muted">No file</span>}
                {remote.assets?.[s.slot] ? (
                  <Button type="button" variant="secondary" onClick={() => void onRemove(s.slot)}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="SEO & meta">
        <div className="pp-form pp-form--grid">
          <FormField label="Meta title" htmlFor="b-mt">
            <input
              id="b-mt"
              className="pp-input"
              value={draft.meta_title}
              onChange={(e) => setDraft((d) => (d ? { ...d, meta_title: e.target.value } : d))}
            />
          </FormField>
          <FormField label="Meta description" htmlFor="b-md">
            <textarea
              id="b-md"
              className="pp-input"
              rows={3}
              value={draft.meta_description}
              onChange={(e) => setDraft((d) => (d ? { ...d, meta_description: e.target.value } : d))}
            />
          </FormField>
        </div>
      </Card>

      <Card title="Domain & URLs">
        <p className="pp-muted">
          Production-style split hosts (for example <code>app.example.com</code> and <code>api.example.com</code>) are
          supported by setting the public URLs below and matching <code>VITE_API_URL</code> on the frontend build.
        </p>
        <div className="pp-form pp-form--grid">
          <FormField label="Default domain URL" htmlFor="b-dom">
            <input
              id="b-dom"
              className="pp-input"
              value={draft.default_domain_url}
              onChange={(e) => setDraft((d) => (d ? { ...d, default_domain_url: e.target.value } : d))}
            />
          </FormField>
          <FormField label="Company website URL" htmlFor="b-cw">
            <input
              id="b-cw"
              className="pp-input"
              value={draft.company_website_url}
              onChange={(e) => setDraft((d) => (d ? { ...d, company_website_url: e.target.value } : d))}
            />
          </FormField>
          <FormField label="Public API base URL" htmlFor="b-api">
            <input
              id="b-api"
              className="pp-input"
              placeholder="https://api.example.com"
              value={draft.public_api_url}
              onChange={(e) => setDraft((d) => (d ? { ...d, public_api_url: e.target.value } : d))}
            />
          </FormField>
          <FormField label="Public app base URL" htmlFor="b-app">
            <input
              id="b-app"
              className="pp-input"
              placeholder="https://app.example.com"
              value={draft.public_app_url}
              onChange={(e) => setDraft((d) => (d ? { ...d, public_app_url: e.target.value } : d))}
            />
          </FormField>
        </div>
      </Card>

      <Card title="Social links">
        <div className="pp-form pp-form--grid">
          {(["twitter", "linkedin", "facebook", "github", "youtube"] as const).map((k) => (
            <FormField key={k} label={k[0]!.toUpperCase() + k.slice(1)} htmlFor={`soc-${k}`}>
              <input
                id={`soc-${k}`}
                className="pp-input"
                value={draft.social[k] ?? ""}
                onChange={(e) =>
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          social: { ...d.social, [k]: e.target.value },
                        }
                      : d,
                  )
                }
              />
            </FormField>
          ))}
        </div>
      </Card>

      <div className="pp-form-actions">
        <Button type="button" variant="secondary" onClick={cancelEdits} disabled={saving}>
          Cancel text changes
        </Button>
        <Button type="button" onClick={() => void saveText()} disabled={saving}>
          {saving ? "Saving…" : "Save text & URLs"}
        </Button>
      </div>
    </div>
  );
}
