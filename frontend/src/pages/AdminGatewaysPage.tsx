import { useCallback, useEffect, useState } from "react";
import { apiFetch, readJsonOk } from "../api/client";
import { useToast } from "../components/ToastProvider";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

type Gateway = {
  id: string;
  code: string;
  label: string;
  is_enabled: boolean;
  is_test_mode: boolean;
  api_key: string | null;
  secret_key: string | null;
  webhook_secret: string | null;
  extra_config_json: string;
};

export default function AdminGatewaysPage() {
  const toast = useToast();
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Partial<Gateway>>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/admin/gateways");
      setGateways(await readJsonOk<Gateway[]>(res));
    } catch {
      toast.push("error", "Failed to load gateways");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  function initDraft(gw: Gateway) {
    setEditing(gw.id);
    setDraft((prev) => ({
      ...prev,
      [gw.id]: {
        api_key: gw.api_key || "",
        secret_key: gw.secret_key || "",
        webhook_secret: gw.webhook_secret || "",
        is_enabled: gw.is_enabled,
        is_test_mode: gw.is_test_mode,
      },
    }));
  }

  async function saveGateway(gw: Gateway) {
    const d = draft[gw.id];
    if (!d) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (d.api_key !== undefined) body.api_key = d.api_key || null;
      if (d.secret_key !== undefined) body.secret_key = d.secret_key || null;
      if (d.webhook_secret !== undefined) body.webhook_secret = d.webhook_secret || null;
      if (d.is_enabled !== undefined) body.is_enabled = d.is_enabled;
      if (d.is_test_mode !== undefined) body.is_test_mode = d.is_test_mode;
      await apiFetch(`/admin/gateways/${gw.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.push("success", `${gw.label} configuration saved.`);
      setEditing(null);
      await load();
    } catch {
      toast.push("error", `We could not save the ${gw.label} configuration.`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="pp-loading"><div className="pp-spinner" aria-hidden /></div>;

  return (
    <div className="space-y-8">
      <h1 className="text-pp-dashboard font-hero font-bold text-foreground">Payment Gateways</h1>
      <p className="text-sm text-muted-foreground">
        Configure Stripe and Razorpay credentials. The system owner enters the API keys, secret keys, and webhook secrets here.
        Both gateways can be enabled simultaneously.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {gateways.map((gw) => {
          const d = draft[gw.id] || {};
          const isEditing = editing === gw.id;
          return (
            <Card key={gw.id} title={gw.label}>
              <div className="mb-3 flex items-center gap-2">
                {gw.is_enabled && <span className="rounded-full bg-semantic-success/20 px-2 py-0.5 text-xs font-medium text-semantic-success">Enabled</span>}
                {gw.is_test_mode && <span className="rounded-full bg-rag-amber/20 px-2 py-0.5 text-xs font-medium text-rag-amber">Test Mode</span>}
              </div>
              <div className="space-y-4">
                {!isEditing ? (
                  <>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">API Key:</span><span className="font-mono">{gw.api_key ? maskKey(gw.api_key) : "—"}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Secret Key:</span><span className="font-mono">{gw.secret_key ? maskKey(gw.secret_key) : "—"}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Webhook Secret:</span><span className="font-mono">{gw.webhook_secret ? maskKey(gw.webhook_secret) : "—"}</span></div>
                    </div>
                    <Button variant="secondary" onClick={() => initDraft(gw)}>Configure</Button>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-foreground">API Key</label>
                      <input className="pp-input mt-1 font-mono text-sm" value={d.api_key ?? ""} onChange={(e) => setDraft({ ...draft, [gw.id]: { ...d, api_key: e.target.value } })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">Secret Key</label>
                      <input className="pp-input mt-1 font-mono text-sm" type="password" value={d.secret_key ?? ""} onChange={(e) => setDraft({ ...draft, [gw.id]: { ...d, secret_key: e.target.value } })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">Webhook Secret</label>
                      <input className="pp-input mt-1 font-mono text-sm" type="password" value={d.webhook_secret ?? ""} onChange={(e) => setDraft({ ...draft, [gw.id]: { ...d, webhook_secret: e.target.value } })} />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={d.is_enabled ?? false} onChange={(e) => setDraft({ ...draft, [gw.id]: { ...d, is_enabled: e.target.checked } })} />
                        Enabled
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={d.is_test_mode ?? true} onChange={(e) => setDraft({ ...draft, [gw.id]: { ...d, is_test_mode: e.target.checked } })} />
                        Test Mode (Sandbox)
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Button disabled={saving} onClick={() => saveGateway(gw)}>{saving ? "Saving..." : "Save"}</Button>
                      <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 4) + "••••" + key.slice(-4);
}
