import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import {
  fetchAiModels,
  fetchAiPrompts,
  fetchAiSettingsAdmin,
  patchAiPrompt,
  patchAiSettingsAdmin,
  postAiSettingsAdmin,
  postAiSettingsTest,
  reseedAiPrompts,
  type AiPrompt,
  type AiProvider,
  type AiSettingsAdmin,
} from "@/api/aiSettings";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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

const inputClass =
  "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20";

const textareaClass =
  "min-h-[140px] w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20";

function providerDefaultBase(p: string): string {
  const v = (p || "").toLowerCase();
  switch (v) {
    case "openai":
      return "https://api.openai.com/v1";
    case "anthropic":
      return "https://api.anthropic.com/v1";
    case "gemini":
      return "https://generativelanguage.googleapis.com/v1";
    case "ollama":
      return "http://localhost:11434/v1";
    default:
      return "";
  }
}

export default function AdminAIPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"config" | "prompts">("config");
  const [remote, setRemote] = useState<AiSettingsAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latency_ms?: number | null } | null>(null);

  const [models, setModels] = useState<{ id: string; is_free: boolean }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsFetched, setModelsFetched] = useState(false);

  const [prompts, setPrompts] = useState<AiPrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [savingPrompt, setSavingPrompt] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [reseedOpen, setReseedOpen] = useState(false);
  const [reseeding, setReseeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchAiSettingsAdmin();
      setRemote(r);
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Could not load AI settings");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadPrompts = useCallback(async () => {
    setPromptsLoading(true);
    try {
      const rows = await fetchAiPrompts();
      setPrompts(rows);
      const init: Record<string, string> = {};
      rows.forEach((r) => (init[r.key] = r.prompt_template));
      setEditing(init);
      // collapsed by default
      setExpanded({});
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Could not load prompts");
    } finally {
      setPromptsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
    void loadPrompts();
  }, [load, loadPrompts]);

  async function save() {
    if (!remote) return;
    const prov = (remote.provider || "").toLowerCase().trim();
    if (!prov) {
      toast.push("error", "Provider is required (e.g. openai, custom, ollama).");
      return;
    }
    if (prov === "custom" && !remote.base_url.trim()) {
      toast.push("error", "Base URL is required for Custom provider.");
      return;
    }
    if (!remote.model.trim()) {
      toast.push("error", "Model is required.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        provider: prov as AiProvider,
        base_url: remote.base_url,
        model: remote.model,
        enabled: remote.enabled,
        temperature: remote.temperature,
        max_tokens: remote.max_tokens,
        timeout_ms: remote.timeout_ms,
        ...(newApiKey.trim() ? { api_key: newApiKey.trim() } : {}),
      };
      const r = await postAiSettingsAdmin(body as never);
      setRemote(r);
      setNewApiKey("");
      setShowKey(false);
      setTestResult(null);
      toast.push("success", "AI settings saved.");
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function clearKey() {
    try {
      const r = await patchAiSettingsAdmin({ api_key: "" });
      setRemote(r);
      setNewApiKey("");
      setShowKey(false);
      toast.push("success", "Stored API key cleared.");
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Clear failed");
    }
  }

  async function handleFetchModels() {
    if (!remote) return;
    const prov = (remote.provider || "").trim();
    const bu = remote.base_url.trim();
    // Use newApiKey if typed but not saved yet, else saved key will be used by backend
    const keyToSend = newApiKey.trim() ? newApiKey.trim() : undefined;
    if (prov.toLowerCase() !== "ollama" && !keyToSend && !remote.api_key_configured) {
      toast.push("error", "API key required to fetch models (or save it first). Ollama does not need a key.");
      return;
    }
    if (!bu && prov.toLowerCase() === "custom") {
      toast.push("error", "Base URL required for custom provider.");
      return;
    }
    setModelsLoading(true);
    setModelsError(null);
    try {
      const res = await fetchAiModels({
        provider: prov.toLowerCase() as AiProvider,
        base_url: bu || undefined,
        api_key: keyToSend,
      });
      if (!res.ok) {
        setModelsError(res.message);
        setModels([]);
        setModelsFetched(false);
        toast.push("error", res.message);
      } else {
        setModels(res.models);
        setModelsFetched(true);
        toast.push("success", res.message);
        if (res.models.length === 0) setModelsError("No models returned.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fetch failed";
      setModelsError(msg);
      toast.push("error", msg);
    } finally {
      setModelsLoading(false);
    }
  }

  async function sendTest() {
    if (!remote) return;
    if (!remote.enabled) {
      toast.push("error", "Enable AI first, then save.");
      return;
    }
    if (remote.provider.toLowerCase() !== "ollama" && !remote.api_key_configured && !newApiKey.trim()) {
      toast.push("error", "Save an API key first.");
      return;
    }
    if (newApiKey.trim()) {
      toast.push("error", "Save settings first to store the new API key, then test.");
      return;
    }
    setTestBusy(true);
    setTestResult(null);
    try {
      const r = await postAiSettingsTest();
      setTestResult(r);
      if (r.ok) toast.push("success", r.message);
      else toast.push("error", r.message);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Test failed";
      setTestResult({ ok: false, message: msg });
      toast.push("error", msg);
    } finally {
      setTestBusy(false);
    }
  }

  async function savePrompt(key: string) {
    const tmpl = (editing[key] || "").trim();
    if (tmpl.length < 10) {
      toast.push("error", "Prompt template too short (min 10 chars).");
      return;
    }
    setSavingPrompt(key);
    try {
      const updated = await patchAiPrompt(key, { prompt_template: tmpl });
      setPrompts((prev) => prev.map((p) => (p.key === key ? updated : p)));
      toast.push("success", `Prompt "${updated.label}" saved.`);
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Save prompt failed");
    } finally {
      setSavingPrompt(null);
    }
  }

  async function togglePromptActive(key: string, v: boolean) {
    try {
      const updated = await patchAiPrompt(key, { is_active: v });
      setPrompts((prev) => prev.map((p) => (p.key === key ? updated : p)));
      toast.push("success", v ? "Prompt enabled." : "Prompt disabled — fallback to default will be used.");
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Toggle failed");
    }
  }

  async function handleReseed() {
    setReseeding(true);
    try {
      const rows = await reseedAiPrompts();
      setPrompts(rows);
      const init: Record<string, string> = {};
      rows.forEach((r) => (init[r.key] = r.prompt_template));
      setEditing(init);
      setExpanded({});
      toast.push("success", "Prompts re-seeded to defaults.");
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Reseed failed");
    } finally {
      setReseeding(false);
      setReseedOpen(false);
    }
  }

  function toggleExpand(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
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
        <p className="text-sm text-destructive">Could not load AI settings.</p>
        <Button type="button" variant="secondary" className="rounded-xl" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  const canTest = remote.enabled && (remote.api_key_configured || remote.provider.toLowerCase() === "ollama") && !newApiKey.trim();
  const freeModels = models.filter((m) => m.is_free);
  const paidModels = models.filter((m) => !m.is_free);

  return (
    <div className="w-full space-y-6">
      <div>
        <p className="mt-1 w-full text-sm leading-relaxed text-muted-foreground">
          Configure any OpenAI-compatible provider. Base URL + API key are stored encrypted. Prompts control every AI enhancement — edit and save without code deploy. Existing reports keep working; AI is non-blocking with automatic fallback to rule-based results.
        </p>
      </div>

      <div className="flex gap-1 rounded-xl border border-border/70 bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("config")}
          className={cn(
            "flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
            activeTab === "config"
              ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50",
          )}
        >
          Configuration
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("prompts")}
          className={cn(
            "flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
            activeTab === "prompts"
              ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50",
          )}
        >
          Prompts
          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{prompts.length || 12}</span>
        </button>
      </div>

      {activeTab === "config" ? (
        <>
          <Card className="border-border/80 shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Provider</CardTitle>
              <CardDescription>Type provider name, set Base URL and fetch models. For Ollama, no API key is required. Custom works with any OpenAI-compatible gateway.</CardDescription>
            </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            id="ai-enabled"
            label="Enable AI enhancements"
            description="When off, all intelligence falls back to deterministic rule-based results. When on, AI enriches forecast, recommendations, and summaries."
            checked={remote.enabled}
            onCheckedChange={(v) => setRemote({ ...remote, enabled: v })}
          />

          <div className="space-y-2">
            <label htmlFor="ai-provider" className="text-sm font-medium text-foreground">
              Provider
            </label>
            <input
              id="ai-provider"
              className={inputClass}
              placeholder="e.g. openai, custom, ollama, anthropic, gemini"
              value={remote.provider}
              onChange={(e) => setRemote({ ...remote, provider: e.target.value as AiProvider })}
              list="ai-provider-list"
            />
            <datalist id="ai-provider-list">
              <option value="openai" />
              <option value="custom" />
              <option value="ollama" />
              <option value="anthropic" />
              <option value="gemini" />
            </datalist>
            <p className="text-xs text-muted-foreground">Free-form — use any name your proxy expects. Common: openai, custom, ollama.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="ai-base-url" className="text-sm font-medium text-foreground">
              Base URL {remote.provider.toLowerCase() === "custom" ? <span className="text-destructive">*</span> : <span className="text-muted-foreground font-normal">(optional)</span>}
            </label>
            <input
              id="ai-base-url"
              className={inputClass}
              placeholder={providerDefaultBase(remote.provider) || "https://your-proxy.example.com/v1"}
              value={remote.base_url}
              onChange={(e) => setRemote({ ...remote, base_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use default for {remote.provider} ({providerDefaultBase(remote.provider) || "—"}). Must be OpenAI-compatible <code className="rounded bg-muted px-1 py-0.5">/v1</code>.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="ai-key" className="text-sm font-medium text-foreground">
              API key
            </label>
            <div className="relative">
              <input
                id="ai-key"
                type={showKey ? "text" : "password"}
                className={cn(inputClass, "pr-10")}
                placeholder={remote.api_key_configured ? `•••••••• (${remote.api_key_masked || "stored"}) — leave blank to keep` : "sk-... or leave blank for Ollama"}
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                aria-label={showKey ? "Hide API key" : "Show API key"}
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Stored encrypted (Fernet). Never returned by API. {remote.api_key_configured ? `Current: ${remote.api_key_masked}` : "Not configured yet."}</p>
            {remote.api_key_configured ? (
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void clearKey()}>
                Clear stored API key
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="ai-model" className="text-sm font-medium text-foreground">
              Model
            </label>
            <div className="flex gap-2">
              <input
                id="ai-model"
                className={inputClass + " flex-1"}
                placeholder="e.g. gpt-4o-mini, llama3.1, gemini-1.5-flash — or fetch below"
                value={remote.model}
                onChange={(e) => setRemote({ ...remote, model: e.target.value })}
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-xl shrink-0"
                disabled={modelsLoading}
                onClick={() => void handleFetchModels()}
              >
                {modelsLoading ? "Fetching…" : "Fetch models"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Type manually or fetch from Base URL — free models appear on top row.</p>

            {modelsError ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{modelsError}</p> : null}

            {modelsFetched && models.length > 0 ? (
              <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-3">
                {freeModels.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Free / recommended — top row</p>
                    <div className="flex flex-wrap gap-1.5">
                      {freeModels.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setRemote({ ...remote, model: m.id })}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            remote.model === m.id
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200",
                          )}
                        >
                          {m.id} {remote.model === m.id ? "✓" : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {paidModels.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Other models</p>
                    <div className="flex max-h-[160px] flex-wrap gap-1.5 overflow-auto pr-1">
                      {paidModels.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setRemote({ ...remote, model: m.id })}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            remote.model === m.id
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-background text-foreground hover:bg-muted",
                          )}
                        >
                          {m.id} {remote.model === m.id ? "✓" : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {freeModels.length === 0 && paidModels.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No models found.</p>
                ) : null}
              </div>
            ) : null}
            {modelsFetched && models.length === 0 && !modelsError ? (
              <p className="text-xs text-muted-foreground">No models returned — try different Base URL or check API key.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Generation tuning</CardTitle>
          <CardDescription>Applied to every AI call. Keep defaults unless you need tighter / more creative output.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="ai-temp" className="text-sm font-medium text-foreground">
              Temperature
            </label>
            <input
              id="ai-temp"
              type="number"
              step="0.1"
              min={0}
              max={2}
              className={inputClass}
              value={remote.temperature}
              onChange={(e) => setRemote({ ...remote, temperature: Number(e.target.value) || 0 })}
            />
            <p className="text-xs text-muted-foreground">0 = deterministic, 2 = very creative</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="ai-tokens" className="text-sm font-medium text-foreground">
              Max tokens
            </label>
            <input
              id="ai-tokens"
              type="number"
              className={inputClass}
              value={remote.max_tokens}
              onChange={(e) => setRemote({ ...remote, max_tokens: Number(e.target.value) || 1024 })}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="ai-timeout" className="text-sm font-medium text-foreground">
              Timeout (ms)
            </label>
            <input
              id="ai-timeout"
              type="number"
              className={inputClass}
              value={remote.timeout_ms}
              onChange={(e) => setRemote({ ...remote, timeout_ms: Number(e.target.value) || 15000 })}
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
          <CardTitle className="text-base">Test connection</CardTitle>
          <CardDescription>Uses saved settings to send a tiny “ping” to the provider. Save first, then test.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!remote.api_key_configured && remote.provider.toLowerCase() !== "ollama" ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">Save an API key above to enable test. Ollama local does not need a key.</p>
          ) : null}
          {!remote.enabled ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">AI is disabled — enable and save to test.</p>
          ) : null}
          {newApiKey.trim() ? (
            <p className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">You have an unsaved new API key. Save first, then test.</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className={cn("rounded-xl")}
              disabled={testBusy || !canTest}
              onClick={() => void sendTest()}
            >
              {testBusy ? "Testing…" : "Test connection"}
            </Button>
            {testResult ? (
              <span className={cn("text-sm font-medium", testResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                {testResult.ok ? "✓ " : "✗ "}
                {testResult.message} {testResult.latency_ms ? `(${testResult.latency_ms}ms)` : ""}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Sends 5 tokens max — safe to run anytime.</span>
            )}
          </div>
        </CardContent>
      </Card>
        </>
      ) : null}

      {activeTab === "prompts" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">Prompt library</h2>
              <p className="text-sm text-muted-foreground">12 best-quality templates. Expand to view formatted prompt, edit inline, toggle active, or reseed all to defaults.</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setExpanded(Object.fromEntries(prompts.map((p) => [p.key, true])))}>Expand all</Button>
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setExpanded({})}>Collapse all</Button>
              <Button type="button" variant="secondary" className="rounded-xl" onClick={() => setReseedOpen(true)}>
                Reseed defaults
              </Button>
            </div>
          </div>

        {promptsLoading ? (
          <p className="text-sm text-muted-foreground">Loading prompts…</p>
        ) : (
          <div className="grid gap-3">
            {prompts.map((p) => {
              const isOpen = !!expanded[p.key];
              const placeholders = Array.from(new Set((p.prompt_template.match(/\{\{[^}]+\}\}/g) || []).map((s) => s.trim()))).slice(0, 8);
              return (
                <Card key={p.key} className="overflow-hidden border-border/80 shadow-card transition-colors hover:border-border">
                  <button
                    type="button"
                    onClick={() => toggleExpand(p.key)}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/20"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-sm font-semibold text-foreground">{p.label}</h3>
                        <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-widest", p.is_active ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/40" : "bg-muted text-muted-foreground ring-1 ring-border")}>
                          {p.is_active ? "ACTIVE" : "DISABLED"}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">{p.key}</span>
                      </p>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{p.description}</p>
                      {!isOpen ? (
                        <p className="mt-2 line-clamp-2 rounded-lg bg-muted/30 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground/80">
                          {p.prompt_template.slice(0, 160)}
                          {p.prompt_template.length > 160 ? "…" : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <label
                        className="flex items-center gap-1.5 text-xs font-medium text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="size-4 rounded border-input accent-primary"
                          checked={p.is_active}
                          onChange={(e) => void togglePromptActive(p.key, e.target.checked)}
                        />
                        Active
                      </label>
                      <span className="rounded-full border border-border bg-background p-1.5 text-muted-foreground shadow-sm">
                        {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </span>
                    </div>
                  </button>
                  {isOpen ? (
                    <CardContent className="space-y-4 border-t border-border/60 bg-muted/10 pt-5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prompt template</p>
                        <p className="mt-1 text-xs text-muted-foreground">Placeholders are replaced at runtime — keep them exact. Best-quality version is pre-filled; edit to tune tone or add project-specific guidance.</p>
                        {placeholders.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {placeholders.map((ph) => (
                              <span key={ph} className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-xs font-medium text-primary">
                                {ph}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring/20">
                        <textarea
                          className="min-h-[180px] w-full resize-y bg-transparent px-4 py-3 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                          value={editing[p.key] ?? ""}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [p.key]: e.target.value }))}
                          placeholder="Prompt template…"
                          rows={7}
                        />
                        <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
                          <span>{(editing[p.key] || "").length} chars</span>
                          <span className="font-mono">{p.key}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" className="rounded-xl" disabled={savingPrompt === p.key} onClick={() => void savePrompt(p.key)}>
                          {savingPrompt === p.key ? "Saving…" : "Save prompt"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="rounded-xl"
                          onClick={() => setEditing((prev) => ({ ...prev, [p.key]: p.prompt_template }))}
                        >
                          Revert
                        </Button>
                      </div>
                    </CardContent>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
        </div>
        ) : null}

      <p className="pb-4 text-xs text-muted-foreground">
        All AI calls are non-blocking: if provider fails or times out, system falls back to rule-based intelligence and reports keep generating.
      </p>

      <ConfirmDialog
        open={reseedOpen}
        title="Reseed prompts?"
        message="All 12 prompts will be reset to best-quality defaults. Your custom edits will be replaced."
        confirmLabel="Reseed"
        variant="primary"
        loading={reseeding}
        onConfirm={() => void handleReseed()}
        onCancel={() => setReseedOpen(false)}
      />
    </div>
  );
}
