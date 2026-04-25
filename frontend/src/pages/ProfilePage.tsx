import { useEffect, useState } from "react";
import { apiFetch, isNetworkError, readJsonOk } from "../api/client";
import { changeMyPassword, publicAvatarUrl, uploadMyAvatar } from "@/api/userProfile";
import { useAuth } from "../auth/AuthContext";
import { validateEmail, validateFullName, validatePassword } from "../auth/validation";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FormField } from "../components/ui/FormField";
import { PasswordInput } from "../components/ui/PasswordInput";
import { PageLoader } from "../components/PageLoader";
import { useToast } from "../components/ToastProvider";
import { friendlyErrorMessage } from "@/lib/friendlyMessages";
type Me = {
  full_name: string;
  email: string;
  has_avatar?: boolean;
  updated_at?: string;
  id: string;
};

export default function ProfilePage() {
  const { refreshMe } = useAuth();
  const toast = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; email?: string }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwErrors, setPwErrors] = useState<{ current?: string; new?: string; confirm?: string }>({});
  const [pwBusy, setPwBusy] = useState(false);

  const [avatarBusy, setAvatarBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadState("loading");
      setLoadError(null);
      try {
        const res = await apiFetch("/users/me");
        const u = await readJsonOk<Me>(res);
        if (cancelled) return;
        setMe(u);
        setFullName(u.full_name);
        setEmail(u.email);
        setLoadState("ready");
      } catch (e) {
        if (!cancelled) {
          setLoadError(isNetworkError(e) ? "Network error. Check connectivity and API URL." : e instanceof Error ? e.message : "Could not load profile");
          setLoadState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmitProfile(e: React.FormEvent) {
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
      await readJsonOk(res);
      setMessage("Profile saved.");
      await refreshMe();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function onAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setAvatarBusy(true);
    try {
      await uploadMyAvatar(f);
      toast.push("success", "Profile photo updated.");
      await refreshMe();
      const res = await apiFetch("/users/me");
      const u = await readJsonOk<Me>(res);
      setMe(u);
    } catch (err) {
      toast.push("error", friendlyErrorMessage(err, "Could not upload image."));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwErrors({});
    const ne = validatePassword(newPw, "New password");
    const next: typeof pwErrors = {};
    if (!currentPw.trim()) next.current = "Enter your current password.";
    if (ne) next.new = ne;
    if (newPw !== confirmPw) next.confirm = "New password and confirmation must match.";
    if (Object.keys(next).length) {
      setPwErrors(next);
      return;
    }
    setPwBusy(true);
    try {
      await changeMyPassword(currentPw, newPw);
      toast.push("success", "Password updated.");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      toast.push("error", friendlyErrorMessage(err, "Could not change password."));
    } finally {
      setPwBusy(false);
    }
  }

  if (loadState === "loading") return <PageLoader />;
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

  const avatarSrc = me?.has_avatar ? `${publicAvatarUrl(me.id)}?v=${encodeURIComponent(me.updated_at ?? "")}` : null;

  return (
    <div className="pp-grid pp-grid--1">
      <Card title="Profile photo">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="size-24 rounded-2xl border border-border object-cover shadow-sm" />
          ) : (
            <div className="flex size-24 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
              No photo
            </div>
          )}
          <div>
            <p className="pp-muted" style={{ marginBottom: "0.75rem" }}>
              PNG, JPEG, or WebP, up to 500 KB. Shown in the header after upload.
            </p>
            <label className="pp-btn pp-btn--secondary pp-btn--sm cursor-pointer">
              {avatarBusy ? "Uploading…" : "Choose image"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(ev) => void onAvatarPick(ev)} disabled={avatarBusy} />
            </label>
          </div>
        </div>
      </Card>

      <Card title="Contact">
        <form className="pp-form" onSubmit={onSubmitProfile} noValidate>
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

      <Card title="Change password">
        <form className="pp-form" onSubmit={(e) => void onChangePassword(e)} noValidate>
          <FormField label="Current password" htmlFor="pw-cur" error={pwErrors.current}>
            <PasswordInput id="pw-cur" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
          </FormField>
          <FormField label="New password" htmlFor="pw-new" error={pwErrors.new}>
            <PasswordInput id="pw-new" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
          </FormField>
          <FormField label="Confirm new password" htmlFor="pw-conf" error={pwErrors.confirm}>
            <PasswordInput id="pw-conf" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
          </FormField>
          <Button type="submit" disabled={pwBusy}>
            {pwBusy ? "Updating…" : "Update password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
