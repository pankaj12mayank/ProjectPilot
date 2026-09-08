import { useCallback, useEffect, useState } from "react";
import { apiFetch, readJsonOk } from "../api/client";
import { useToast } from "../components/ToastProvider";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

type PlanFeature = {
  id: string;
  feature_key: string;
  feature_label: string;
  value: string;
};

type Plan = {
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
};

type PlanForm = {
  name: string;
  slug: string;
  description: string;
  price_monthly: string;
  price_yearly: string;
  currency: string;
  sort_order: number;
  is_active: boolean;
  is_free: boolean;
};

const FEATURE_DEFS: { key: string; label: string }[] = [
  { key: "max_projects", label: "Max Projects" },
  { key: "reports_per_project", label: "Reports Per Project" },
  { key: "branding_enabled", label: "Custom Branding" },
  { key: "portfolio_access", label: "Portfolio Dashboard" },
  { key: "forecast_enabled", label: "Forecast Charts" },
  { key: "team_members", label: "Team Members" },
  { key: "risk_heatmap", label: "Risk Heatmap" },
  { key: "audit_log_retention_days", label: "Audit Log Retention (Days)" },
  { key: "priority_support", label: "Priority Support" },
  { key: "sso_enabled", label: "Single Sign-On" },
  { key: "api_access", label: "API Access" },
];

export default function AdminPlansPage() {
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>({
    name: "",
    slug: "",
    description: "",
    price_monthly: "",
    price_yearly: "",
    currency: "GBP",
    sort_order: 0,
    is_active: true,
    is_free: false,
  });
  const [features, setFeatures] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Plan | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/admin/plans");
      const data = await readJsonOk<Plan[]>(res);
      setPlans(data);
    } catch {
      toast.push("error", "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  function startEdit(plan: Plan) {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || "",
      price_monthly: plan.price_monthly != null ? String(plan.price_monthly) : "",
      price_yearly: plan.price_yearly != null ? String(plan.price_yearly) : "",
      currency: plan.currency,
      sort_order: plan.sort_order,
      is_active: plan.is_active,
      is_free: plan.is_free,
    });
    const feat: Record<string, string> = {};
    for (const f of plan.features) feat[f.feature_key] = f.value;
    setFeatures(feat);
  }

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        slug: form.slug,
        description: form.description || null,
        currency: form.currency,
        sort_order: form.sort_order,
        is_active: form.is_active,
        is_free: form.is_free,
      };
      if (form.price_monthly) body.price_monthly = parseFloat(form.price_monthly);
      else body.price_monthly = null;
      if (form.price_yearly) body.price_yearly = parseFloat(form.price_yearly);
      else body.price_yearly = null;

      if (!editingPlan) return;
      await apiFetch(`/admin/plans/${editingPlan.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.push("success", "Plan saved successfully");
      await load();
      setEditingPlan(null);
    } catch {
      toast.push("error", "We could not save that plan. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveFeatures() {
    if (!editingPlan) return;
    setSaving(true);
    try {
      const featList = FEATURE_DEFS.map((d) => ({
        feature_key: d.key,
        feature_label: d.label,
        value: features[d.key] || "false",
      }));
      await apiFetch(`/admin/plans/${editingPlan.id}/features`, {
        method: "PUT",
        body: JSON.stringify({ features: featList }),
      });
      toast.push("success", "Plan features updated");
      await load();
    } catch {
      toast.push("error", "We could not save the features configuration.");
    } finally {
      setSaving(false);
    }
  }

  async function removePlan(plan: Plan) {
    setConfirmDelete(null);
    try {
      await apiFetch(`/admin/plans/${plan.id}`, { method: "DELETE" });
      toast.push("success", `"${plan.name}" is now inactive and hidden from the pricing page.`);
      await load();
    } catch {
      toast.push("error", "We could not deactivate that plan. Please try again.");
    }
  }

  if (loading) return <div className="pp-loading"><div className="pp-spinner" aria-hidden /></div>;

  return (
    <div className="space-y-8">
      {editingPlan && (
        <Card title={`Edit: ${editingPlan.name}`}>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Name" htmlFor="plan-name" error={undefined}>
                <input id="plan-name" className="pp-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </FormField>
              <FormField label="Slug" htmlFor="plan-slug" error={undefined}>
                <input id="plan-slug" className="pp-input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              </FormField>
              <FormField label="Monthly Price" htmlFor="plan-monthly" error={undefined}>
                <input id="plan-monthly" className="pp-input" type="number" step="0.01" value={form.price_monthly} onChange={(e) => setForm({ ...form, price_monthly: e.target.value })} />
              </FormField>
              <FormField label="Yearly Price" htmlFor="plan-yearly" error={undefined}>
                <input id="plan-yearly" className="pp-input" type="number" step="0.01" value={form.price_yearly} onChange={(e) => setForm({ ...form, price_yearly: e.target.value })} />
              </FormField>
              <FormField label="Currency" htmlFor="plan-currency" error={undefined}>
                <input id="plan-currency" className="pp-input" maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
              </FormField>
              <FormField label="Sort Order" htmlFor="plan-order" error={undefined}>
                <input id="plan-order" className="pp-input" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
              </FormField>
            </div>
            <FormField label="Description" htmlFor="plan-desc" error={undefined}>
              <textarea id="plan-desc" className="pp-input min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </FormField>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_free} onChange={(e) => setForm({ ...form, is_free: e.target.checked })} />
                Free Plan
              </label>
            </div>
            <div className="flex gap-2">
              <Button disabled={saving} onClick={save}>{saving ? "Saving..." : "Save"}</Button>
              <Button variant="ghost" onClick={() => setEditingPlan(null)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {editingPlan && (
        <Card title="Feature Configuration">
          <div className="space-y-3">
            {FEATURE_DEFS.map((def) => (
              <div key={def.key} className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-foreground">{def.label}</label>
                <input
                  className="pp-input flex-1"
                  value={features[def.key] || ""}
                  onChange={(e) => setFeatures({ ...features, [def.key]: e.target.value })}
                  placeholder="true, false, number, or unlimited"
                />
              </div>
            ))}
            <Button disabled={saving} onClick={saveFeatures}>{saving ? "Saving..." : "Save Features"}</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.id} className={`rounded-xl border p-5 ${plan.is_active ? "border-border/50 bg-card shadow-soft dark:shadow-soft-dark" : "border-dashed border-border/30 bg-muted/20 opacity-60"}`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-semibold text-foreground">{plan.name}</h3>
                <p className="text-xs text-muted-foreground">{plan.slug}</p>
              </div>
              {!plan.is_active && <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inactive</span>}
            </div>
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{plan.description || "—"}</p>
            <div className="mt-3 text-sm">
              {plan.is_free ? (
                <span className="font-semibold text-foreground">Free</span>
              ) : (
                <span>
                  {plan.price_monthly != null && <span className="font-semibold text-foreground">&pound;{plan.price_monthly}<span className="text-xs text-muted-foreground">/mo</span></span>}
                  {plan.price_yearly != null && <span className="ml-2 text-xs text-muted-foreground">or &pound;{plan.price_yearly}/yr</span>}
                </span>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" onClick={() => startEdit(plan)}>Edit</Button>
              {plan.is_active && !plan.is_free && (
                <Button variant="danger" onClick={() => setConfirmDelete(plan)}>Deactivate</Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Deactivate ${confirmDelete?.name ?? ""}?`}
        message={
          <>
            <p>This plan will no longer appear on the pricing page. Users currently on this plan will keep access until their next billing cycle.</p>
            <p className="mt-2">You can reactivate it later by editing the plan.</p>
          </>
        }
        confirmLabel="Deactivate"
        variant="danger"
        loading={saving}
        onConfirm={() => confirmDelete && removePlan(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function FormField({ label, htmlFor, error, children }: { label: string; htmlFor: string; error: string | undefined; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
