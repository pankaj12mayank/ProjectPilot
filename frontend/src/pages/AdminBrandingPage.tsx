import { useCallback, useEffect, useMemo, useState } from "react";
import type { BrandingAdmin } from "../api/branding";
import { deleteBrandingAsset, fetchBrandingAdmin, patchBrandingAdmin, uploadBrandingFile } from "../api/branding";
import { useBranding } from "../branding/BrandingProvider";
import { useToast } from "../components/ToastProvider";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FormField } from "../components/ui/FormField";

const ASSET_SLOTS: { slot: string; label: string; hint?: string }[] = [
  { slot: "logo", label: "Logo (light theme)", hint: "PNG or SVG recommended." },
  { slot: "logo_dark", label: "Logo (dark theme)", hint: "Falls back to light logo if empty." },
  { slot: "favicon", label: "Favicon", hint: "ICO or PNG." },
];

function allowedExts(slot: string): string[] {
  if (slot === "favicon") return ["ico", "png", "webp", "jpg", "jpeg"];
  return ["png", "jpg", "jpeg", "svg", "webp"];
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

type Draft = {
  meta_title: string;
  meta_description: string;
  social: Record<string, string>;
};

function toDraft(b: BrandingAdmin): Draft {
  const s = b.social || {};
  return {
    meta_title: b.meta_title,
    meta_description: b.meta_description,
    social: {
      twitter: String(s.twitter ?? ""),
      linkedin: String(s.linkedin ?? ""),
      facebook: String(s.facebook ?? ""),
      github: String(s.github ?? ""),
      youtube: String(s.youtube ?? ""),
    },
  };
}

export default function AdminBrandingPage() {
  const toast = useToast();
  const { refresh: refreshPublic } = useBranding();
  const [remote, setRemote] = useState<BrandingAdmin | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

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
    toast.push("info", "Changes reverted");
  }

  async function saveText() {
    if (!draft) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        meta_title: draft.meta_title,
        meta_description: draft.meta_description,
        social: draft.social,
      };
      const b = await patchBrandingAdmin(body);
      setRemote(b);
      setDraft(toDraft(b));
      toast.push("success", "Saved");
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

  const siteName = (draft.meta_title || "ProjectPilot").trim() || "ProjectPilot";

  return (
    <div className="pp-admin-branding">
      <Card title="Preview">
        <p className="pp-muted">How the sidebar and browser tab icon look in each theme.</p>
        <div className="pp-branding-theme-split" style={{ marginTop: "1rem" }}>
          <div className="pp-branding-theme-panel">
            <span className="pp-branding-theme-label">Light</span>
            <div className="pp-branding-preview__mock pp-branding-preview__mock--split">
              <div className="pp-branding-preview__sidebar">
                {previewUrls.logo ? (
                  <img src={previewUrls.logo} alt="" className="pp-branding-preview__logo" />
                ) : (
                  <strong>{siteName}</strong>
                )}
              </div>
              <div className="pp-branding-preview__main pp-branding-preview__main--light">
                <h3>{siteName}</h3>
                <p className="pp-muted">{draft.meta_description || "Meta description (SEO)"}</p>
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
            <span className="pp-branding-theme-label">Dark</span>
            <div className="pp-branding-preview__mock pp-branding-preview__mock--split">
              <div className="pp-branding-preview__sidebar">
                {previewUrls.logo_dark || previewUrls.logo ? (
                  <img
                    src={previewUrls.logo_dark ?? previewUrls.logo}
                    alt=""
                    className="pp-branding-preview__logo"
                  />
                ) : (
                  <strong>{siteName}</strong>
                )}
              </div>
              <div className="pp-branding-preview__main pp-branding-preview__main--dark">
                <h3>{siteName}</h3>
                <p className="pp-branding-preview__tagline-dark">{draft.meta_description || "Meta description (SEO)"}</p>
                <div className="pp-branding-preview__favicon-row">
                  <span className="pp-branding-preview__muted-dark">Favicon</span>
                  {previewUrls.favicon ? (
                    <img src={previewUrls.favicon} alt="" className="pp-branding-preview__favicon" />
                  ) : (
                    <span className="pp-branding-preview__muted-dark">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Logo & favicon">
        {error ? (
          <p className="pp-field__error" role="alert">
            {error}
          </p>
        ) : null}
        <p className="pp-muted">Max {maxMb} MB per file.</p>
        <div className="pp-branding-slots" style={{ marginTop: "1rem" }}>
          {ASSET_SLOTS.map((s) => (
            <div key={s.slot} className="pp-branding-slot">
              <div>
                <strong>{s.label}</strong>
                {s.hint ? <p className="pp-muted pp-branding-slot__hint">{s.hint}</p> : null}
                <input
                  type="file"
                  accept={allowedExts(s.slot)
                    .map((x) => `.${x}`)
                    .join(",")}
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

      <Card title="SEO">
        <p className="pp-muted" style={{ marginBottom: "0.75rem" }}>
          Meta title is also used as the short product name when no logo is uploaded.
        </p>
        <div className="pp-form pp-form--grid pp-form--full">
          <FormField label="Meta title" htmlFor="b-mt">
            <input
              id="b-mt"
              className="pp-input w-full max-w-none"
              value={draft.meta_title}
              onChange={(e) => setDraft((d) => (d ? { ...d, meta_title: e.target.value } : d))}
            />
          </FormField>
          <FormField label="Meta description" htmlFor="b-md">
            <textarea
              id="b-md"
              className="pp-input w-full max-w-none"
              rows={3}
              value={draft.meta_description}
              onChange={(e) => setDraft((d) => (d ? { ...d, meta_description: e.target.value } : d))}
            />
          </FormField>
        </div>
      </Card>

      <Card title="Social links">
        <div className="pp-form pp-form--grid pp-form--full">
          {(["twitter", "linkedin", "facebook", "github", "youtube"] as const).map((k) => (
            <FormField key={k} label={k[0]!.toUpperCase() + k.slice(1)} htmlFor={`soc-${k}`}>
              <input
                id={`soc-${k}`}
                className="pp-input w-full max-w-none"
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
          Revert text
        </Button>
        <Button type="button" onClick={() => void saveText()} disabled={saving}>
          {saving ? "Saving…" : "Save SEO & social"}
        </Button>
      </div>
    </div>
  );
}
