import { useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, parseJson } from "../api/client";
import { validateEmail } from "../auth/validation";
import { Button } from "../components/ui/Button";
import { FormField } from "../components/ui/FormField";
import { Card } from "../components/ui/Card";
import { useToast } from "../components/ToastProvider";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setDevToken(null);
    setResetLink(null);
    const ev = validateEmail(email);
    setEmailError(ev);
    if (ev) return;
    setBusy(true);
    try {
      const res = await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      const data = await parseJson<{
        message?: string;
        dev_reset_token?: string | null;
        reset_link?: string | null;
        detail?: string;
      }>(res);
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Request failed");
      }
      const successMsg = data.message ?? "If that email is registered, you'll receive a reset link shortly.";
      setMessage(successMsg);
      toast.push("success", successMsg);
      if (data.dev_reset_token) setDevToken(data.dev_reset_token);
      if (data.reset_link) setResetLink(data.reset_link);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      toast.push("error", msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pp-auth">
      <Card title="Forgot password">
        <p className="pp-muted">
          Enter the email address you use to sign in. If it matches an account, we&apos;ll email you a link to reset your
          password. Check your inbox and spam folder—it may take a minute to arrive.
        </p>
        {error ? (
          <p className="pp-field__error" role="alert">
            {error}
          </p>
        ) : null}
        <form className="pp-form" onSubmit={onSubmit} noValidate>
          <FormField label="Email" htmlFor="forgot-email" error={emailError}>
            <input
              id="forgot-email"
              className="pp-input"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
            />
          </FormField>
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Request reset"}
          </Button>
        </form>
        {message ? <p className="pp-success">{message}</p> : null}
        {resetLink ? (
          <p className="pp-muted" style={{ marginTop: "0.75rem" }}>
            <a href={resetLink} className="font-medium text-primary underline-offset-4 hover:underline">
              Open password reset
            </a>
          </p>
        ) : null}
        {devToken ? (
          <div className="pp-dev-token">
            <strong>Dev reset token</strong>
            <code>{devToken}</code>
            <Link to={`/reset-password?token=${encodeURIComponent(devToken)}`}>Open reset page</Link>
          </div>
        ) : null}
        <p className="pp-auth__links">
          <Link to="/login">Back to sign in</Link>
        </p>
      </Card>
    </div>
  );
}
