import { useEffect, useState } from "react";
import { BarChart3, FileText, LineChart } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchPortfolioReportHistory, type PortfolioReportHistoryRow } from "../api/portfolio";
import { ProjectQuickPick } from "@/components/ProjectQuickPick";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";

const links = [
  {
    to: "/dashboard/governance",
    title: "Governance report",
    description: "Standalone governance package from three uploaded files (not tied to a project).",
    icon: FileText,
  },
  {
    to: "/dashboard/metrics",
    title: "Metrics & analytics",
    description: "Per-project health links and quick access to ingested metrics.",
    icon: LineChart,
  },
  {
    to: "/dashboard/portfolio",
    title: "Portfolio intelligence",
    description: "Comparisons, heatmaps, and portfolio-level report history.",
    icon: BarChart3,
  },
];

export default function ReportsHubPage() {
  const [recent, setRecent] = useState<PortfolioReportHistoryRow[]>([]);
  const [recentErr, setRecentErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchPortfolioReportHistory(12);
        if (!cancelled) setRecent(rows);
      } catch (e) {
        if (!cancelled) setRecentErr(e instanceof Error ? e.message : "Could not load history");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reports</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Generate, explore, and export intelligence artifacts. Open a workspace below to continue.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Card key={l.to} className="group border-border/80 transition-shadow hover:shadow-card">
            <CardHeader>
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <l.icon className="size-5" />
              </div>
              <CardTitle className="text-base">{l.title}</CardTitle>
              <CardDescription>{l.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary" className="w-full rounded-xl">
                <Link to={l.to}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-base">Recent report runs</CardTitle>
          <CardDescription>Latest generated packages across projects you can access.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentErr ? <p className="text-sm text-destructive">{recentErr}</p> : null}
          {!recentErr && recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No report runs yet. Generate from a project&apos;s Reports page.</p>
          ) : null}
          {recent.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {recent.map((r) => (
                <li key={`${r.job_id}-${r.created_at}`} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                  <span className="font-medium text-foreground">{r.project_name}</span>
                  <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                  <Button asChild variant="link" className="h-auto p-0 text-primary">
                    <Link to={`/dashboard/projects/${r.project_id}/reports?jobId=${encodeURIComponent(r.job_id)}`}>
                      Open downloads
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-base">Project reports</CardTitle>
          <CardDescription>
            Generated report packages live on each project. Open the full list from{" "}
            <Link to="/dashboard/projects" className="font-medium text-primary hover:underline">
              Projects
            </Link>{" "}
            or jump in below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectQuickPick
            destination="reports"
            title="Pick a project"
            description="Choose a project you can access, then go straight to its Reports workspace."
          />
        </CardContent>
      </Card>
    </div>
  );
}
