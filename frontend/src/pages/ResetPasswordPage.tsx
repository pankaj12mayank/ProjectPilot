import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch, parseJson } from "../api/client";
import { validatePassword } from "../auth/validation";
import { Button } from "../components/ui/Button";
import { FormField } from "../components/ui/FormField";
import { Card } from "../components/ui/Card";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const initialToken = params.get("token") ?? "";
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setTokenError(!token.trim() ? "Reset token is required." : null);
    const pe = validatePassword(password, "New password");
    setPasswordError(pe);
    if (!token.trim() || pe) return;
    setBusy(true);
    try {
      const res = await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await parseJson<{ message?: string; detail?: string }>(res);
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Reset failed");
      }
      setMessage(data.message ?? "Password updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pp-auth">
      <Card title="Reset password">
        {error ? (
          <p className="pp-field__error" role="alert">
            {error}
          </p>
        ) : null}
        <form className="pp-form" onSubmit={onSubmit} noValidate>
          <FormField label="Reset token" htmlFor="reset-token" error={tokenError}>
            <input
              id="reset-token"
              className="pp-input"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setTokenError(null);
              }}
            />
          </FormField>
          <FormField label="New password" htmlFor="reset-password" error={passwordError}>
            <input
              id="reset-password"
              className="pp-input"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError(null);
              }}
            />
          </FormField>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Update password"}
          </Button>
        </form>
        {message ? <p className="pp-success">{message}</p> : null}
        <p className="pp-auth__links">
          <Link to="/login">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
