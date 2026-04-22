import { useEffect, useState } from "react";
import { apiFetch, parseJson } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { validateEmail, validateFullName } from "../auth/validation";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FormField } from "../components/ui/FormField";
import { PageLoader } from "../components/PageLoader";

export default function ProfilePage() {
  const { refreshMe } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; email?: string }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadState("loading");
      setLoadError(null);
      try {
        const res = await apiFetch("/users/me");
        if (cancelled) return;
        if (!res.ok) {
          const d = await parseJson<{ detail?: string }>(res);
          setLoadError(typeof d.detail === "string" ? d.detail : "Could not load profile");
          setLoadState("error");
          return;
        }
        const u = await parseJson<{ full_name: string; email: string }>(res);
        setFullName(u.full_name);
        setEmail(u.email);
        setLoadState("ready");
      } catch {
        if (!cancelled) {
          setLoadError("Network error while loading profile.");
          setLoadState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaveError(null);
    const fe = validateFullName(fullName);
    const ee = validateEmail(email);
    const next: { fullName?: string; email?: string } = {};
    if (fe) next.fullName = fe;
    if (ee) next.email = ee;
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      const res = await apiFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ full_name: fullName, email }),
      });
      const data = await parseJson<{ detail?: string }>(res);
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Update failed");
      }
      setMessage("Profile saved.");
      await refreshMe();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (loadState === "loading") {
    return <PageLoader />;
  }
  if (loadState === "error") {
    return (
      <Card title="Profile">
        <p className="pp-field__error" role="alert">
          {loadError}
        </p>
        <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <Card title="Your profile">
      <form className="pp-form" onSubmit={onSubmit} noValidate>
        <FormField label="Full name" htmlFor="prof-name" error={fieldErrors.fullName}>
          <input
            id="prof-name"
            className="pp-input"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setFieldErrors((f) => ({ ...f, fullName: undefined }));
            }}
          />
        </FormField>
        <FormField label="Email" htmlFor="prof-email" error={fieldErrors.email}>
          <input
            id="prof-email"
            className="pp-input"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((f) => ({ ...f, email: undefined }));
            }}
          />
        </FormField>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </form>
      {saveError ? (
        <p className="pp-field__error" role="alert">
          {saveError}
        </p>
      ) : null}
      {message ? <p className="pp-success">{message}</p> : null}
    </Card>
  );
}
