import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { isPlatformAdmin } from "../auth/roleUtils";
import {
  fetchMySubscription,
  fetchPublicPlans,
  createCheckoutSession,
  createPortalLink,
  cancelSubscription,
  changeSubscriptionPlan,
  type Plan,
  type Subscription,
} from "../api/plans";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { Badge } from "@/components/shadcn/badge";
import { PageLoader } from "../components/PageLoader";
import { useToast } from "../components/ToastProvider";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "danger" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  trialing: { label: "Trial", variant: "secondary" },
  past_due: { label: "Past due", variant: "danger" },
  canceled: { label: "Canceled", variant: "outline" },
  incomplete: { label: "Incomplete", variant: "outline" },
  incomplete_expired: { label: "Expired", variant: "outline" },
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(amount: number | null, currency: string): string {
  if (amount == null) return "Free";
  const sym: Record<string, string> = { GBP: "\u00A3", USD: "$", EUR: "\u20AC", INR: "\u20B9" };
  return `${sym[currency] || currency} ${amount.toFixed(2)}`;
}

export default function SubscriptionPage() {
  const toast = useToast();
  const { user, ready } = useAuth();
  const [searchParams] = useSearchParams();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const checkoutResult = searchParams.get("checkout");
  const checkoutMessage =
    checkoutResult === "cancel"
      ? "Checkout was cancelled. No charges were made."
      : null;

  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, p] = await Promise.all([fetchMySubscription(), fetchPublicPlans()]);
        if (!cancelled) {
          setSub(s);
          setPlans(p.filter((pl) => pl.is_active).sort((a, b) => a.sort_order - b.sort_order));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ready, user]);

  function detectGateway() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz === "Asia/Kolkata") return "razorpay";
    } catch { /* fall through */ }
    return "stripe";
  }

  async function handleCheckout(planSlug: string) {
    setActionLoading(planSlug);
    setError(null);
    try {
      const gateway = detectGateway();
      const result = await createCheckoutSession(planSlug, gateway);
      if (result.is_free) {
        toast.push("success", "Free plan activated. Start using it right away.");
        const s = await fetchMySubscription();
        setSub(s);
      } else if (result.url) {
        window.location.href = result.url;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Checkout failed";
      setError(msg);
      toast.push("error", msg);
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePortal() {
    setActionLoading("portal");
    setError(null);
    try {
      const result = await createPortalLink();
      window.location.href = result.url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Portal link failed";
      setError(msg);
      toast.push("error", msg);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel() {
    setActionLoading("cancel");
    setError(null);
    try {
      await cancelSubscription();
      toast.push("success", "Your subscription has been cancelled. You will retain access until the end of the billing period.");
      setConfirmCancel(false);
      const s = await fetchMySubscription();
      setSub(s);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Cancel failed";
      setError(msg);
      toast.push("error", msg);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleChangePlan(planSlug: string) {
    setActionLoading(planSlug);
    setError(null);
    try {
      const result = await changeSubscriptionPlan(planSlug);
      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.push("success", result.message || "Plan changed successfully.");
        const s = await fetchMySubscription();
        setSub(s);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Plan change failed";
      setError(msg);
      toast.push("error", msg);
    } finally {
      setActionLoading(null);
    }
  }

  if (!ready || !user) return <PageLoader />;
  if (isPlatformAdmin(user.role)) return <Navigate to="/dashboard/admin" replace />;
  if (checkoutResult === "success") return <Navigate to="/dashboard" replace />;

  const currentPlan = plans.find((p) => p.id === sub?.plan_id);
  const statusMeta = sub ? STATUS_LABELS[sub.status] || { label: sub.status, variant: "outline" as const } : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div>
        <h1 className="pp-type-dashboard-title text-foreground">Subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your plan and billing.</p>
      </div>

      {checkoutMessage ? (
        <Card className={checkoutResult === "success" ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}>
          <CardContent className="pt-6">
            <p className="text-sm font-medium">{checkoutMessage}</p>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <PageLoader />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current plan</CardTitle>
              <CardDescription>Your active subscription</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sub && statusMeta ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xl font-bold">{currentPlan?.name || "Unknown"}</span>
                  <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                  {sub.cancel_at_period_end ? (
                    <Badge variant="outline" className="text-amber-500">Ends at period</Badge>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Free plan (no active subscription)</p>
              )}

              {sub && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Period start:</span>{" "}
                    <span className="font-medium">{formatDate(sub.current_period_start)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Period end:</span>{" "}
                    <span className="font-medium">{formatDate(sub.current_period_end)}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                {sub?.gateway_id ? (
                  <Button variant="outline" onClick={handlePortal} disabled={actionLoading === "portal"} className="rounded-xl">
                    {actionLoading === "portal" ? "Loading..." : "Billing portal"}
                  </Button>
                ) : null}
                {sub && !sub.cancel_at_period_end && sub.status === "active" ? (
                  confirmCancel ? (
                    <div className="flex items-center gap-2">
                      <Button variant="destructive" onClick={handleCancel} disabled={actionLoading === "cancel"} className="rounded-xl">
                        {actionLoading === "cancel" ? "Cancelling..." : "Confirm cancel"}
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmCancel(false)} className="rounded-xl">Keep</Button>
                    </div>
                  ) : (
                    <Button variant="outline" onClick={() => setConfirmCancel(true)} className="rounded-xl text-destructive">
                      Cancel subscription
                    </Button>
                  )
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Available plans</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const isCurrent = plan.id === sub?.plan_id;
                const isFree = plan.is_free;
                const price = isFree ? "Free" : formatCurrency(plan.price_monthly, plan.currency) + "/mo";
                return (
                  <Card key={plan.id} className={`relative flex flex-col ${isCurrent ? "ring-2 ring-primary" : ""}`}>
                    {isCurrent ? (
                      <Badge className="absolute -top-2.5 right-3 rounded-xl">Current</Badge>
                    ) : null}
                    <CardHeader>
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                      <p className="text-2xl font-bold tracking-tight">{price}</p>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-4">
                      <ul className="space-y-1.5 text-sm">
                        {plan.features.map((f) => (
                          <li key={f.id} className="flex items-center gap-2">
                            <span className="text-emerald-500">&check;</span>
                            <span className="text-muted-foreground">{f.feature_label}: </span>
                            <span className="font-medium">{f.value}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto pt-2">
                        {isCurrent ? (
                          <Button disabled variant="outline" className="w-full rounded-xl">Current plan</Button>
                        ) : !sub || !sub.gateway_id ? (
                          <Button onClick={() => handleCheckout(plan.slug)} disabled={actionLoading === plan.slug} className="w-full rounded-xl">
                            {actionLoading === plan.slug ? "Processing..." : isFree ? "Select free" : "Subscribe"}
                          </Button>
                        ) : (
                          <Button onClick={() => handleChangePlan(plan.slug)} disabled={actionLoading === plan.slug} variant="secondary" className="w-full rounded-xl">
                            {actionLoading === plan.slug ? "Processing..." : "Change to this plan"}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
