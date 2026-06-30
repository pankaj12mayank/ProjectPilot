import { apiFetch, readJsonOk } from "./client";

export type PlanFeature = {
  id: string;
  feature_key: string;
  feature_label: string;
  value: string;
};

export type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number | null;
  price_yearly: number | null;
  currency: string;
  sort_order: number;
  is_active: boolean;
  is_free: boolean;
  features: PlanFeature[];
  created_at: string;
  updated_at: string;
};

export type PaymentGateway = {
  id: string;
  code: string;
  label: string;
  is_enabled: boolean;
  is_test_mode: boolean;
  api_key: string | null;
  secret_key: string | null;
  webhook_secret: string | null;
  extra_config_json: string;
  created_at: string;
  updated_at: string;
};

export async function fetchPlans(): Promise<Plan[]> {
  const res = await apiFetch("/admin/plans");
  return readJsonOk<Plan[]>(res);
}

export async function fetchPublicPlans(): Promise<Plan[]> {
  try {
    const res = await fetch(
      `${(import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "")}/api/v1/plans`,
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function createPlan(data: {
  name: string;
  slug: string;
  description?: string;
  price_monthly?: number | null;
  price_yearly?: number | null;
  currency?: string;
  sort_order?: number;
  is_active?: boolean;
  is_free?: boolean;
}): Promise<Plan> {
  const res = await apiFetch("/admin/plans", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return readJsonOk<Plan>(res);
}

export async function updatePlan(
  planId: string,
  data: Partial<{
    name: string;
    description: string | null;
    price_monthly: number | null;
    price_yearly: number | null;
    currency: string;
    sort_order: number;
    is_active: boolean;
    is_free: boolean;
  }>,
): Promise<Plan> {
  const res = await apiFetch(`/admin/plans/${planId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return readJsonOk<Plan>(res);
}

export async function deletePlan(planId: string): Promise<void> {
  await apiFetch(`/admin/plans/${planId}`, { method: "DELETE" });
}

export async function updatePlanFeatures(
  planId: string,
  features: { feature_key: string; feature_label: string; value: string }[],
): Promise<PlanFeature[]> {
  const res = await apiFetch(`/admin/plans/${planId}/features`, {
    method: "PUT",
    body: JSON.stringify({ features }),
  });
  return readJsonOk<PlanFeature[]>(res);
}

export async function fetchGateways(): Promise<PaymentGateway[]> {
  const res = await apiFetch("/admin/gateways");
  return readJsonOk<PaymentGateway[]>(res);
}

export async function updateGateway(
  gatewayId: string,
  data: Partial<{
    is_enabled: boolean;
    api_key: string;
    secret_key: string;
    webhook_secret: string;
    extra_config_json: string;
    is_test_mode: boolean;
  }>,
): Promise<PaymentGateway> {
  const res = await apiFetch(`/admin/gateways/${gatewayId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return readJsonOk<PaymentGateway>(res);
}

/* -------- Subscription API -------- */

export type Subscription = {
  id: string;
  user_id: string;
  plan_id: string;
  gateway_id: string | null;
  status: string;
  gateway_subscription_id: string | null;
  gateway_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  plan: Plan | null;
  created_at: string;
  updated_at: string;
};

export async function fetchMySubscription(): Promise<Subscription | null> {
  const res = await apiFetch("/subscription/my");
  if (res.status === 204 || res.status === 404) return null;
  return readJsonOk<Subscription>(res);
}

export async function createCheckoutSession(planSlug: string, gatewayCode = "stripe"): Promise<{ url: string | null; session_id: string | null; is_free?: boolean }> {
  const res = await apiFetch("/subscription/checkout", {
    method: "POST",
    body: JSON.stringify({ plan_slug: planSlug, gateway_code: gatewayCode }),
  });
  return (await readJsonOk(res)) as { url: string | null; session_id: string | null; is_free?: boolean };
}

export async function createPortalLink(): Promise<{ url: string }> {
  const res = await apiFetch("/subscription/portal", { method: "POST" });
  return readJsonOk<{ url: string }>(res);
}

export async function cancelSubscription(): Promise<{ status: string; message: string }> {
  const res = await apiFetch("/subscription/cancel", { method: "POST" });
  return readJsonOk<{ status: string; message: string }>(res);
}

export async function changeSubscriptionPlan(planSlug: string, gatewayCode?: string): Promise<{ status?: string; url?: string; message: string }> {
  const res = await apiFetch("/subscription/change", {
    method: "POST",
    body: JSON.stringify({ plan_slug: planSlug, gateway_code: gatewayCode }),
  });
  return (await readJsonOk(res)) as { status?: string; url?: string; message: string };
}

export async function fetchAdminSubscriptions(): Promise<any[]> {
  const res = await apiFetch("/admin/subscriptions");
  return readJsonOk<any[]>(res);
}
