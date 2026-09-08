import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchEmailSettingsAdmin,
  patchEmailSettingsAdmin,
  postEmailSettingsAdmin,
  postEmailSettingsTest,
  type EmailProvider,
  type EmailSettingsAdmin,
} from "@/api/emailSettings";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { useToast } from "@/components/ToastProvider";
import { cn } from "@/lib/utils";

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <input
        id={id}
        type="checkbox"
        className="mt-1 size-4 shrink-0 rounded border-input accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
    </div>
  );
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function validateClient(
  r: EmailSettingsAdmin,
  newSmtpPassword: string,
  newApiKey: string,
): string | null {
  if (!r.enabled) return null;
  const fe = r.from_email.trim();
  if (!fe || !emailRe.test(fe)) {
    return "From email is required and must be valid when sending is enabled.";
  }
  if (r.provider === "smtp") {
    if (!r.smtp_host.trim()) return "SMTP host is required when SMTP is enabled.";
    if (r.smtp_user.trim() && !newSmtpPassword.trim() && !r.password_configured) {
      return "SMTP password is required when a username is set (or clear the username).";
    }
  }
  if (r.provider === "sendgrid") {
    if (!newApiKey.trim() && !r.api_key_configured) {
      return "SendGrid API key is required when SendGrid is enabled (paste a new key or disable sending).";
    }
  }
  return null;
}

const inputClass =
  "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground";

export default function AdminEmailPage() {
  const toast = useToast();
  const [remote, setRemote] = useState<EmailSettingsAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testBusy, setTestBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchEmailSettingsAdmin();
      setRemote(r);
      setTestTo((prev) => prev || r.from_email || "");
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Could not load email settings");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!remote) return;
    const clientErr = validateClient(remote, newPassword, newApiKey);
    if (clientErr) {
      toast.push("error", clientErr);
      return;
    }
    setSaving(true);
    try {
      const body = {
        provider: remote.provider as EmailProvider,
        enabled: remote.enabled,
        smtp_host: remote.smtp_host,
        smtp_port: remote.smtp_port,
        use_tls: remote.use_tls,
        use_ssl: remote.use_ssl,
        smtp_user: remote.smtp_user,
        from_email: remote.from_email,
        from_name: remote.from_name,
        ...(newPassword.trim() ? { smtp_password: newPassword.trim() } : {}),
        ...(newApiKey.trim() ? { api_key: newApiKey.trim() } : {}),
      };
      const r = await postEmailSettingsAdmin(body);
      setRemote(r);
      setNewPassword("");
      setNewApiKey("");
      toast.push("success", "Email settings saved.");
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    const to = testTo.trim();
    if (!to) {
      toast.push("error", "Enter a recipient address for the test.");
      return;
    }
    setTestBusy(true);
    try {
      const r = await postEmailSettingsTest(to);
      if (r.ok) toast.push("success", r.message);
      else toast.push("error", r.message);
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Test send failed");
    } finally {
      setTestBusy(false);
    }
  }

  if (loading && !remote) {
    return (
      <div className="w-full space-y-4">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!remote) {
    return (
      <div className="w-full space-y-4">
        <p className="text-sm text-destructive">Could not load email settings.</p>
        <Button type="button" variant="secondary" className="rounded-xl" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <p className="mt-1 w-full text-sm text-muted-foreground">
          Choose SMTP or SendGrid. Secrets are stored encrypted — update them here without code changes. Configure the
          public app URL under{" "}
          <Link className="text-primary underline-offset-4 hover:underline" to="/dashboard/admin/branding">
            Branding
          </Link>{" "}
          so password-reset links work.
        </p>
      </div>

      <Card className="border-border/80 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Provider</CardTitle>
          <CardDescription>SendGrid uses HTTPS to SendGrid&apos;s API; SMTP uses your relay host.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            id="email-enabled"
            label="Enable sending"
            description="When off, forgot-password still issues a token but no email is sent (unless dev token mode is on)."
            checked={remote.enabled}
            onCheckedChange={(v) => setRemote({ ...remote, enabled: v })}
          />
          <div className="space-y-2">
            <label htmlFor="email-provider" className="text-sm font-medium text-foreground">
              Provider
            </label>
            <select
              id="email-provider"
              className={inputClass}
              value={remote.provider}
              onChange={(e) => setRemote({ ...remote, provider: e.target.value as EmailProvider })}
            >
              <option value="smtp">SMTP</option>
              <option value="sendgrid">SendGrid</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {remote.provider === "sendgrid" ? (
        <Card className="border-border/80 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">SendGrid</CardTitle>
            <CardDescription>API key with Mail Send permission. Never shown again after save.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <label htmlFor="api-key" className="text-sm font-medium text-foreground">
                API key
              </label>
              <input
                id="api-key"
                type="password"
                className={inputClass}
                placeholder={remote.api_key_configured ? "•••••••• (leave blank to keep)" : "SG.xxx…"}
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">Stored encrypted. Not returned by the API.</p>
              {remote.api_key_configured ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() =>
                    void (async () => {
                      try {
                        const r = await patchEmailSettingsAdmin({ api_key: "" });
                        setRemote(r);
                        setNewApiKey("");
                        toast.push("success", "Stored API key cleared.");
                      } catch (e) {
                        toast.push("error", e instanceof Error ? e.message : "Clear failed");
                      }
                    })()
                  }
                >
                  Clear stored API key
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/80 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">SMTP server</CardTitle>
            <CardDescription>Typical: port 587 with STARTTLS, or 465 with implicit SSL.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="smtp-host" className="text-sm font-medium text-foreground">
                  SMTP host
                </label>
                <input
                  id="smtp-host"
                  className={inputClass}
                  value={remote.smtp_host}
                  onChange={(e) => setRemote({ ...remote, smtp_host: e.target.value })}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="smtp-port" className="text-sm font-medium text-foreground">
                  Port
                </label>
                <input
                  id="smtp-port"
                  type="number"
                  className={inputClass}
                  value={remote.smtp_port}
                  onChange={(e) => setRemote({ ...remote, smtp_port: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ToggleRow
                id="smtp-tls"
                label="STARTTLS"
                description="Use after connect (common on port 587)."
                checked={remote.use_tls}
                onCheckedChange={(v) => setRemote({ ...remote, use_tls: v })}
              />
              <ToggleRow
                id="smtp-ssl"
                label="Implicit SSL"
                description="SMTP_SSL (often port 465). Usually turn off STARTTLS when using this."
                checked={remote.use_ssl}
                onCheckedChange={(v) => setRemote({ ...remote, use_ssl: v })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="smtp-user" className="text-sm font-medium text-foreground">
                  SMTP username
                </label>
                <input
                  id="smtp-user"
                  className={inputClass}
                  value={remote.smtp_user}
                  onChange={(e) => setRemote({ ...remote, smtp_user: e.target.value })}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="smtp-pass" className="text-sm font-medium text-foreground">
                  SMTP password
                </label>
                <input
                  id="smtp-pass"
                  type="password"
                  className={inputClass}
                  placeholder={remote.password_configured ? "Leave blank to keep current" : "If required by your host"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">Stored encrypted. Not returned by the API.</p>
                {remote.password_configured ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() =>
                      void (async () => {
                        try {
                          const r = await patchEmailSettingsAdmin({ smtp_password: "" });
                          setRemote(r);
                          setNewPassword("");
                          toast.push("success", "Stored SMTP password cleared.");
                        } catch (e) {
                          toast.push("error", e instanceof Error ? e.message : "Clear failed");
                        }
                      })()
                    }
                  >
                    Clear stored password
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/80 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">From identity</CardTitle>
          <CardDescription>Shown as the sender on password reset and test messages.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="from-email" className="text-sm font-medium text-foreground">
              From email
            </label>
            <input
              id="from-email"
              type="email"
              className={inputClass}
              value={remote.from_email}
              onChange={(e) => setRemote({ ...remote, from_email: e.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="from-name" className="text-sm font-medium text-foreground">
              From name
            </label>
            <input
              id="from-name"
              className={inputClass}
              value={remote.from_name}
              onChange={(e) => setRemote({ ...remote, from_name: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="button" className="rounded-xl" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
        <Button type="button" variant="secondary" className="rounded-xl" disabled={loading} onClick={() => void load()}>
          Reload
        </Button>
      </div>

      <Card className="border-border/80 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Test delivery</CardTitle>
          <CardDescription>Sends a short test using the saved configuration (must save first).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="test-to" className="text-sm font-medium text-foreground">
              Send test to
            </label>
            <input
              id="test-to"
              type="email"
              className={inputClass}
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className={cn("rounded-xl sm:shrink-0")}
            disabled={testBusy}
            onClick={() => void sendTest()}
          >
            {testBusy ? "Sending…" : "Send test email"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
