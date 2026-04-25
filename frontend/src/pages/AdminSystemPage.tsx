import { useEffect, useState } from "react";
import { fetchAdminSystemConfig, postAdminReloadSettingsCache, type AdminSystemConfigOut } from "@/api/adminConfig";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { useToast } from "@/components/ToastProvider";

export default function AdminSystemPage() {
  const toast = useToast();
  const [cfg, setCfg] = useState<AdminSystemConfigOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reloadBusy, setReloadBusy] = useState(false);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const data = await fetchAdminSystemConfig();
        if (!c) setCfg(data);
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Could not load configuration");
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">System configuration</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Effective values from the running API (environment + defaults). Change variables in <code className="rounded bg-muted px-1 py-0.5 text-xs">.env</code>{" "}
          and restart the server to apply.
        </p>
      </div>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {!cfg && !err ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

      {cfg ? (
        <div className="grid w-full gap-5">
          <Card className="border-border/80 shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Runtime controls</CardTitle>
              <CardDescription>
                Actions that affect this API process only. Environment variables on disk still require a full restart
                to apply everywhere.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                className="rounded-xl"
                disabled={reloadBusy}
                onClick={() => {
                  void (async () => {
                    setReloadBusy(true);
                    try {
                      const r = await postAdminReloadSettingsCache();
                      toast.push("success", r.message);
                      const data = await fetchAdminSystemConfig();
                      setCfg(data);
                    } catch (e) {
                      toast.push("error", e instanceof Error ? e.message : "Reload failed");
                    } finally {
                      setReloadBusy(false);
                    }
                  })();
                }}
              >
                {reloadBusy ? "Working…" : "Reload settings cache"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  try {
                    const skip = new Set(["projectpilot_token", "projectpilot_refresh"]);
                    const keys = Object.keys(localStorage).filter(
                      (k) => (k.startsWith("projectpilot") || k.startsWith("pp-")) && !skip.has(k),
                    );
                    keys.forEach((k) => localStorage.removeItem(k));
                    toast.push("success", `Cleared ${keys.length} cached entries (sign-in tokens were kept).`);
                  } catch {
                    toast.push("error", "Could not clear browser storage.");
                  }
                }}
              >
                Clear app local storage
              </Button>
            </CardContent>
          </Card>

          <div className="grid w-full gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border/80 shadow-card">
              <CardHeader>
                <CardTitle className="text-base">API &amp; security</CardTitle>
                <CardDescription>Routing and token policy.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="API prefix" value={cfg.api_prefix} />
                <Row label="JWT algorithm" value={cfg.jwt_algorithm} />
                <Row label="Access token TTL" value={`${cfg.jwt_access_expire_minutes} min`} />
                <Row label="Refresh token TTL" value={`${cfg.jwt_refresh_expire_days} days`} />
                <Row label="JWT secret" value={cfg.jwt_secret_configured ? "Configured" : "Weak / dev default"} />
                <Row label="Dev reset token leak" value={cfg.dev_return_reset_token ? "ON (dev only)" : "Off"} />
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-card">
              <CardHeader>
                <CardTitle className="text-base">HTTP &amp; data</CardTitle>
                <CardDescription>CORS and storage.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="CORS origins" value={cfg.cors_origins} multiline />
                <Row label="Database" value={cfg.database_kind} />
                <Row label="Log level" value={cfg.log_level} />
                <Row label="Chart export DPI" value={String(cfg.chart_dpi)} />
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-card">
              <CardHeader>
                <CardTitle className="text-base">Uploads &amp; RAG</CardTitle>
                <CardDescription>Limits and health thresholds.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Branding max upload" value={`${cfg.branding_max_upload_mb} MB`} />
                <Row label="Project file max" value={`${cfg.project_upload_max_mb} MB`} />
                <Row label="RAG thresholds" value={JSON.stringify(cfg.rag_thresholds)} />
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-card">
              <CardHeader>
                <CardTitle className="text-base">Public URLs &amp; paths</CardTitle>
                <CardDescription>Branding and filesystem roots.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row
                  label="Transactional email"
                  value={cfg.email_send_ready ? "Ready to send" : cfg.email_send_status}
                />
                <Row label="PUBLIC_API_URL" value={cfg.public_api_url || "—"} />
                <Row label="PUBLIC_APP_URL" value={cfg.public_app_url || "—"} />
                <Row label="Repo root" value={cfg.paths.repo_root} multiline />
                <Row label="Data" value={cfg.paths.data_dir} />
                <Row label="Outputs" value={cfg.paths.outputs_dir} />
                <Row label="Uploads" value={cfg.paths.uploads_dir} />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-mono text-xs text-foreground ${multiline ? "whitespace-pre-wrap break-all" : "truncate"}`}>{value}</p>
    </div>
  );
}
