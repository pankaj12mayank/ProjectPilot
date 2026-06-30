import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { postLoginPath } from "../auth/roleUtils";
import { useBranding } from "../branding/BrandingProvider";
import { useToast } from "../components/ToastProvider";
import { validateLoginForm, type FieldErrors } from "../auth/validation";
import { Button } from "../components/ui/Button";
import { FormField } from "../components/ui/FormField";
import { Card } from "../components/ui/Card";
import { PasswordInput } from "../components/ui/PasswordInput";
import { useTheme } from "@/theme";

export default function LoginPage() {
  const { branding } = useBranding();
  const { resolved } = useTheme();
  const { login, user, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    return <Navigate to={postLoginPath(user.role, from)} replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validateLoginForm(email, password);
    setFieldErrors(v);
    if (Object.keys(v).length > 0) return;
    setBusy(true);
    try {
      const me = await login(email, password);
      navigate(postLoginPath(me.role, from), { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
      toast.push("error", msg);
    } finally {
      setBusy(false);
    }
  }

  const title = (branding?.meta_title || "ProjectPilot").trim() || "ProjectPilot";
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
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        )}
        <p className="max-w-md text-sm text-muted-foreground">Sign in to continue to your workspace.</p>
      </div>
      <Card title={`Sign in`}>
        <form className="pp-form" onSubmit={onSubmit} noValidate>
          {error ? (
            <p className="pp-field__error" role="alert">
              {error}
            </p>
          ) : null}
          <FormField label="Email" htmlFor="login-email" error={fieldErrors.email}>
            <input
              id="login-email"
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
          <FormField label="Password" htmlFor="login-password" error={fieldErrors.password}>
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
              }}
            />
          </FormField>
          <Button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="pp-auth__links">
          <Link to="/register">Create an account</Link>
          {" · "}
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
      </Card>
    </div>
  );
}
