import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { isPlatformAdmin, postLoginPath } from "../auth/roleUtils";
import { useBranding } from "../branding/BrandingProvider";
import { useToast } from "../components/ToastProvider";
import { validateRegisterForm, type FieldErrors } from "../auth/validation";
import { Button } from "../components/ui/Button";
import { FormField } from "../components/ui/FormField";
import { Card } from "../components/ui/Card";
import { PasswordInput } from "../components/ui/PasswordInput";
import { useTheme } from "@/theme";

export default function RegisterPage() {
  const { register, user, ready } = useAuth();
  const { branding } = useBranding();
  const { resolved } = useTheme();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ready) {
    return (
      <div className="pp-loading">
        <div className="pp-spinner" aria-hidden />
      </div>
    );
  }
  if (user) {
    return <Navigate to={postLoginPath(user.role, "/dashboard")} replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validateRegisterForm(fullName, email, password, confirmPassword);
    setFieldErrors(v);
    if (Object.keys(v).length > 0) return;
    setBusy(true);
    try {
      const me = await register(email, password, fullName);
      toast.push("success", "Account created successfully.");
      const dest = isPlatformAdmin(me.role) ? "/dashboard/admin" : "/dashboard/subscription";
      navigate(dest, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setError(msg);
      toast.push("error", msg);
    } finally {
      setBusy(false);
    }
  }

  const product = (branding?.meta_title || "ProjectPilot").trim() || "ProjectPilot";
  const urls = branding?.asset_urls ?? {};
  const logoLight = urls.logo as string | undefined;
  const logoDark = (urls.logo_dark as string | undefined) || logoLight;
  const logo = resolved === "dark" ? logoDark : logoLight;

  return (
    <div className="pp-auth">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        {logo ? (
          <img src={logo} alt="" className="h-12 max-w-[220px] object-contain" />
        ) : (
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{product}</h1>
        )}
        <p className="max-w-md text-sm text-muted-foreground">Create an account to join the workspace.</p>
      </div>
      <Card title="Create account">
        <form className="pp-form" onSubmit={onSubmit} noValidate>
          {error ? (
            <p className="pp-field__error" role="alert">
              {error}
            </p>
          ) : null}
          <FormField label="Full name" htmlFor="reg-name" error={fieldErrors.fullName}>
            <input
              id="reg-name"
              className="pp-input"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (fieldErrors.fullName) setFieldErrors((f) => ({ ...f, fullName: undefined }));
              }}
            />
          </FormField>
          <FormField label="Email" htmlFor="reg-email" error={fieldErrors.email}>
            <input
              id="reg-email"
              className="pp-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
              }}
            />
          </FormField>
          <FormField label="Password (min 8 characters)" htmlFor="reg-password" error={fieldErrors.password}>
            <PasswordInput
              id="reg-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
              }}
            />
          </FormField>
          <FormField label="Confirm password" htmlFor="reg-confirm" error={fieldErrors.confirmPassword}>
            <PasswordInput
              id="reg-confirm"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) setFieldErrors((f) => ({ ...f, confirmPassword: undefined }));
              }}
            />
          </FormField>
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Register"}
          </Button>
        </form>
        <p className="pp-auth__links">
          <Link to="/login">Already have an account?</Link>
        </p>
      </Card>
    </div>
  );
}
