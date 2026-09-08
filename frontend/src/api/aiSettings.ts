import { apiFetch, readJsonOk } from "./client";

export type AiProvider = string;

export type AiSettingsAdmin = {
  provider: AiProvider;
  base_url: string;
  model: string;
  enabled: boolean;
  temperature: number;
  max_tokens: number;
  timeout_ms: number;
  api_key_configured: boolean;
  api_key_masked: string;
  updated_at: string | null;
  updated_by_user_id: string | null;
};

export type AiSettingsPostBody = {
  provider: AiProvider;
  base_url: string;
  model: string;
  enabled: boolean;
  temperature: number;
  max_tokens: number;
  timeout_ms: number;
  api_key?: string | null;
};

export type AiSettingsPatch = Partial<{
  provider: AiProvider;
  base_url: string;
  model: string;
  enabled: boolean;
  temperature: number;
  max_tokens: number;
  timeout_ms: number;
  api_key: string | null;
}>;

export type AiTestOut = {
  ok: boolean;
  message: string;
  latency_ms?: number | null;
  model?: string | null;
};

export type AiPrompt = {
  key: string;
  label: string;
  description: string;
  prompt_template: string;
  is_active: boolean;
  version: number;
  updated_at: string | null;
  updated_by_user_id: string | null;
};

export type AiPromptUpdate = Partial<{
  prompt_template: string;
  is_active: boolean;
  label: string;
  description: string;
}>;

export async function fetchAiSettingsAdmin(): Promise<AiSettingsAdmin> {
  const res = await apiFetch("/admin/ai-settings");
  return readJsonOk<AiSettingsAdmin>(res);
}

export async function postAiSettingsAdmin(body: AiSettingsPostBody): Promise<AiSettingsAdmin> {
  const res = await apiFetch("/admin/ai-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJsonOk<AiSettingsAdmin>(res);
}

export async function patchAiSettingsAdmin(body: AiSettingsPatch): Promise<AiSettingsAdmin> {
  const res = await apiFetch("/admin/ai-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJsonOk<AiSettingsAdmin>(res);
}

export async function postAiSettingsTest(): Promise<AiTestOut> {
  const res = await apiFetch("/admin/ai-settings/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return readJsonOk<AiTestOut>(res);
}

export async function fetchAiPrompts(): Promise<AiPrompt[]> {
  const res = await apiFetch("/admin/ai-prompts");
  return readJsonOk<AiPrompt[]>(res);
}

export async function patchAiPrompt(key: string, body: AiPromptUpdate): Promise<AiPrompt> {
  const res = await apiFetch(`/admin/ai-prompts/${encodeURIComponent(key)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJsonOk<AiPrompt>(res);
}

export async function reseedAiPrompts(): Promise<AiPrompt[]> {
  const res = await apiFetch("/admin/ai-prompts/reseed", {
    method: "POST",
  });
  return readJsonOk<AiPrompt[]>(res);
}

export type AiModelsOut = {
  ok: boolean;
  message: string;
  models: { id: string; is_free: boolean }[];
};

export async function fetchAiModels(body?: { provider?: AiProvider; base_url?: string; api_key?: string }): Promise<AiModelsOut> {
  const res = await apiFetch("/admin/ai-settings/models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return readJsonOk<AiModelsOut>(res);
}
