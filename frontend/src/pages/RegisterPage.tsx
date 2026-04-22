import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { postLoginPath } from "../auth/roleUtils";
import { validateRegisterForm, type FieldErrors } from "../auth/validation";
import { Button } from "../components/ui/Button";
import { FormField } from "../components/ui/FormField";
import { Card } from "../components/ui/Card";

export default function RegisterPage() {
  const { register, user, ready } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
      navigate(postLoginPath(me.role, "/dashboard"), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pp-auth">
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
            <input
              id="reg-password"
              className="pp-input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
              }}
            />
          </FormField>
          <FormField label="Confirm password" htmlFor="reg-confirm" error={fieldErrors.confirmPassword}>
            <input
              id="reg-confirm"
              className="pp-input"
              type="password"
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
