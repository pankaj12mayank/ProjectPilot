import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { postLoginPath } from "../auth/roleUtils";
import { useBranding } from "../branding/BrandingProvider";
import { validateLoginForm, type FieldErrors } from "../auth/validation";
import { Button } from "../components/ui/Button";
import { FormField } from "../components/ui/FormField";
import { Card } from "../components/ui/Card";

export default function LoginPage() {
  const { branding } = useBranding();
  const { login, user, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
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
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  const title = (branding?.product_name || "ProjectPilot").trim() || "ProjectPilot";
  const bg = branding?.asset_urls?.login_bg;

  return (
    <div
      className="pp-auth"
      style={
        bg
          ? {
              backgroundImage: `linear-gradient(rgb(255 255 255 / 0.88), rgb(255 255 255 / 0.92)), url(${bg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      <Card title={`Sign in to ${title}`}>
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
            <input
              id="login-password"
              className="pp-input"
              type="password"
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
