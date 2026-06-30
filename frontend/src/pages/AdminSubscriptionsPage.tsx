import { useEffect, useState } from "react";
import { fetchAdminSubscriptions } from "../api/plans";
import { Badge } from "@/components/shadcn/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { Skeleton } from "@/components/shadcn/skeleton";

const STATUS_BADGE: Record<string, "default" | "secondary" | "danger" | "outline"> = {
  active: "default",
  trialing: "secondary",
  past_due: "danger",
  canceled: "outline",
  incomplete: "outline",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminSubscriptionsPage() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAdminSubscriptions();
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="pp-type-dashboard-title text-foreground">Subscriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">All active and recent subscriptions across the platform.</p>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All subscriptions</CardTitle>
            <CardDescription>{rows?.length ?? 0} total records</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {!rows?.length ? (
              <div className="px-6 pb-6 text-sm text-muted-foreground">No subscriptions yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Plan</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Period end</th>
                      <th className="px-4 py-3 font-medium">Gateway ID</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {rows.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{r.user_id?.slice(0, 8)}...</td>
                        <td className="px-4 py-3">{r.plan_name}</td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_BADGE[r.status] || "outline"}>{r.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(r.current_period_end)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {r.gateway_subscription_id ? `${r.gateway_subscription_id.slice(0, 16)}...` : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
