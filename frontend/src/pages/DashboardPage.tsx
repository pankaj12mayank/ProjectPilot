import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../auth/AuthContext";
import { isPlatformAdmin } from "../auth/roleUtils";
import {
  fetchPortfolioComparison,
  fetchPortfolioOpenRisks,
  fetchPortfolioSummary,
  type PortfolioComparison,
  type PortfolioOpenRiskRow,
  type PortfolioProjectRow,
  type PortfolioSummary,
} from "../api/portfolio";
import { RagBadge } from "@/components/layout/RagBadge";
import { PageLoader } from "../components/PageLoader";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { Progress } from "@/components/shadcn/progress";
import { Skeleton } from "@/components/shadcn/skeleton";
function fmt(n: number | null | undefined, d = 1) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toFixed(d);
}

function aggregatePortfolioTrends(comparison: PortfolioComparison | null) {
  if (!comparison?.trends) return [];
  type Acc = { sumSpi: number; nSpi: number; sumCpi: number; nCpi: number; sumComp: number; nComp: number };
  const byTime = new Map<string, Acc>();
  for (const pts of Object.values(comparison.trends)) {
    for (const p of pts) {
      const k = p.captured_at.slice(0, 16);
      const row = byTime.get(k) ?? { sumSpi: 0, nSpi: 0, sumCpi: 0, nCpi: 0, sumComp: 0, nComp: 0 };
      if (p.spi != null && Number.isFinite(Number(p.spi))) {
        row.sumSpi += Number(p.spi);
        row.nSpi++;
      }
      if (p.cpi != null && Number.isFinite(Number(p.cpi))) {
        row.sumCpi += Number(p.cpi);
        row.nCpi++;
      }
      if (p.completion_pct != null && Number.isFinite(Number(p.completion_pct))) {
        row.sumComp += Number(p.completion_pct);
        row.nComp++;
      }
      byTime.set(k, row);
    }
  }
  return Array.from(byTime.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([t, v]) => ({
      t: t.replace("T", " "),
      spi: v.nSpi ? v.sumSpi / v.nSpi : null,
      cpi: v.nCpi ? v.sumCpi / v.nCpi : null,
      completion: v.nComp ? v.sumComp / v.nComp : null,
    }))
    .slice(-14);
}

function latestMetrics(rows: PortfolioProjectRow[]) {
  let delayed = 0;
  let budgetRisk = 0;
  let active = 0;
  for (const r of rows) {
    if (r.is_archived) continue;
    active++;
    const spi = r.latest_spi == null ? null : Number(r.latest_spi);
    const cpi = r.latest_cpi == null ? null : Number(r.latest_cpi);
    if (spi != null && spi < 1) delayed++;
    if (cpi != null && cpi < 1) budgetRisk++;
  }
  return { delayed, budgetRisk, active };
}

export default function DashboardPage() {
  const { user, ready } = useAuth();
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [comparison, setComparison] = useState<PortfolioComparison | null>(null);
  const [openRisks, setOpenRisks] = useState<PortfolioOpenRiskRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, c, risks] = await Promise.all([
          fetchPortfolioSummary(),
          fetchPortfolioComparison(),
          fetchPortfolioOpenRisks(25).catch(() => [] as PortfolioOpenRiskRow[]),
        ]);
        if (!cancelled) {
          setSummary(s);
          setComparison(c);
          setOpenRisks(risks);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const trendData = useMemo(() => aggregatePortfolioTrends(comparison), [comparison]);

  const ragPie = useMemo(() => {
    if (!summary?.by_rag) return [];
    return Object.entries(summary.by_rag).map(([name, value]) => ({ name, value }));
  }, [summary]);

  const rows = summary?.projects ?? [];
  const { delayed, budgetRisk, active } = useMemo(() => latestMetrics(rows), [rows]);

  const withComp = rows.filter((r) => r.latest_completion_pct != null);
  const avgCompletion =
    withComp.length === 0
      ? null
      : withComp.reduce((a, r) => a + Number(r.latest_completion_pct), 0) / withComp.length;

  const avgRisk = summary?.average_risk_score ?? null;

  if (!ready || !user) {
    return <PageLoader />;
  }

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="pp-type-dashboard-title text-foreground">Dashboard</h1>
          <p className="mt-1 font-sans text-sm leading-relaxed text-muted-foreground">
            Welcome back, <span className="font-medium text-foreground">{user.full_name}</span> — portfolio snapshot
            and delivery signals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" className="rounded-xl">
            <Link to="/dashboard/projects">Projects</Link>
          </Button>
          {isPlatformAdmin(user.role) ? (
            <Button asChild className="rounded-xl">
              <Link to="/admin">Administration</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="pp-type-modal-title text-base text-destructive">Could not refresh portfolio</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardDescription>Active projects</CardDescription>
            <CardTitle className="pp-type-kpi-value text-3xl tabular-nums text-foreground">{active}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Non-archived projects in workspace.</p>
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardDescription>RAG summary</CardDescription>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ragPie.length === 0 ? (
                <Badge variant="muted">No data</Badge>
              ) : (
                ragPie.map((r) => (
                  <span key={r.name} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <RagBadge rag={r.name} />
                    <span className="tabular-nums font-medium text-foreground">{r.value}</span>
                  </span>
                ))
              )}
            </div>
          </CardHeader>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardDescription>Schedule pressure</CardDescription>
            <CardTitle className="pp-type-kpi-value text-3xl tabular-nums text-rag-amber">{delayed}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Projects with SPI below 1.0 (latest snapshot).</p>
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardDescription>Budget risk</CardDescription>
            <CardTitle className="pp-type-kpi-value text-3xl tabular-nums text-rag-red">{budgetRisk}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Projects with CPI below 1.0 (latest snapshot).</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="border-border/80 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">SPI / CPI trend</CardTitle>
            <CardDescription>Portfolio-average indices across recent snapshots.</CardDescription>
          </CardHeader>
          <CardContent className="h-72 pl-0">
            {trendData.length === 0 ? (
              <p className="px-6 text-sm text-muted-foreground">Not enough history yet. Generate reports to populate trends.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/80" vertical={false} />
                  <XAxis dataKey="t" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[0, "auto"]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={36} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="spi" name="SPI" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="cpi" name="CPI" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-base">RAG distribution</CardTitle>
            <CardDescription>Share of latest portfolio RAG states.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {ragPie.length === 0 ? (
              <p className="text-sm text-muted-foreground">No RAG classifications yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ragPie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2}>
                    {ragPie.map((entry) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={
                          entry.name.toLowerCase() === "green"
                            ? "hsl(var(--rag-green))"
                            : entry.name.toLowerCase() === "amber" || entry.name.toLowerCase() === "yellow"
                              ? "hsl(var(--rag-amber))"
                              : "hsl(var(--rag-red))"
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-base">Milestone progress</CardTitle>
            <CardDescription>Average reported completion across projects with snapshots.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">{fmt(avgCompletion, 1)}%</span>
              <span className="text-xs text-muted-foreground">weighted view</span>
            </div>
            <Progress value={avgCompletion == null || !Number.isFinite(avgCompletion) ? 0 : Math.min(100, avgCompletion)} />
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-base">High-severity risks</CardTitle>
            <CardDescription>Top projects by risk score from the latest portfolio summary.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(summary?.top_risky_projects ?? []).slice(0, 5).length === 0 ? (
              <p className="text-sm text-muted-foreground">No elevated risks flagged.</p>
            ) : (
              (summary?.top_risky_projects ?? []).slice(0, 5).map((p) => (
                <div key={p.project_id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2">
                  <Link to={`/dashboard/projects/${p.project_id}`} className="min-w-0 truncate text-sm font-medium hover:underline">
                    {p.name}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <RagBadge rag={p.rag} />
                    <span className="text-xs tabular-nums text-muted-foreground">{fmt(p.risk_score, 1)}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-base">Completion trend</CardTitle>
          <CardDescription>Average completion percentage across snapshots (portfolio level).</CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          {trendData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trend samples yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/80" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} width={36} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="completion" name="Completion %" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-base">Open registered risks</CardTitle>
          <CardDescription>Project risks you created (not ingested RAID rows). High-severity items feed report mitigations.</CardDescription>
        </CardHeader>
        <CardContent>
          {!openRisks?.length ? (
            <p className="text-sm text-muted-foreground">No open registered risks across your projects.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {openRisks.map((r) => (
                <li key={r.risk_id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                  <span>
                    <Link className="font-medium text-foreground hover:underline" to={`/dashboard/projects/${r.project_id}/risks`}>
                      {r.project_name}
                    </Link>
                    <span className="text-muted-foreground"> — {r.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 capitalize">{r.severity}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="outline" size="sm" className="mt-4 rounded-xl">
            <Link to="/dashboard/projects">Manage in projects</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardDescription>Average risk</CardDescription>
            <CardTitle className="pp-type-kpi-value text-2xl tabular-nums">{fmt(avgRisk, 2)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Lower is generally healthier for this index.</CardContent>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardDescription>Forecasted delays</CardDescription>
            <CardTitle className="text-2xl">{delayed > 0 ? "Elevated" : "Stable"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Derived from SPI distribution across active projects.</CardContent>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardDescription>Recommendations</CardDescription>
            <CardTitle className="text-2xl">Per project</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to="/dashboard/recommendations">Open hub</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
