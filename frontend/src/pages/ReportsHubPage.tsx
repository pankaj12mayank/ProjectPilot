import { useEffect, useState } from "react";
import { BarChart3, FileText, LineChart } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchPortfolioReportHistory, type PortfolioReportHistoryRow } from "../api/portfolio";
import { fetchProjects, type ProjectOut } from "@/api/projects";
import { ProjectQuickPick } from "@/components/ProjectQuickPick";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";

type ReportKind = "governance" | "metrics" | "portfolio";

function ReportWorkspaceCard({
  kind,
  title,
  description,
  icon: Icon,
  projects,
  loading,
}: {
  kind: ReportKind;
  title: string;
  description: string;
  icon: typeof FileText;
  projects: ProjectOut[];
  loading: boolean;
}) {
  const [id, setId] = useState("");

  useEffect(() => {
    if (!projects.length) {
      setId("");
      return;
    }
    setId((prev) => (prev && projects.some((p) => p.id === prev) ? prev : projects[0]!.id));
  }, [projects]);

  const href =
    kind === "governance"
      ? `/dashboard/governance?projectId=${encodeURIComponent(id)}`
      : kind === "metrics"
        ? `/dashboard/metrics?project=${encodeURIComponent(id)}`
        : `/dashboard/portfolio?project=${encodeURIComponent(id)}`;

  return (
    <Card className="h-full border-border/80 shadow-card transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex w-full flex-col gap-4">
        <div className="w-full space-y-2">
          <label htmlFor={`report-pick-${kind}`} className="text-sm font-medium text-foreground">
            Project
          </label>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading projects…</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create a project first, then return here.</p>
          ) : (
            <select
              id={`report-pick-${kind}`}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
              value={id}
              onChange={(e) => setId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {id ? (
          <Button asChild className="w-full rounded-xl">
            <Link to={href}>
              {kind === "governance"
                ? "Continue to governance upload"
                : kind === "metrics"
                  ? "Open metrics hub"
                  : "Open portfolio intelligence"}
            </Link>
          </Button>
        ) : (
          <Button type="button" className="w-full rounded-xl" disabled>
            Select a project
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function ReportsHubPage() {
  const [recent, setRecent] = useState<PortfolioReportHistoryRow[]>([]);
  const [recentErr, setRecentErr] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectOut[]>([]);
  const [projErr, setProjErr] = useState<string | null>(null);
  const [projLoading, setProjLoading] = useState(true);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setProjLoading(true);
      setProjErr(null);
      try {
        const rows = await fetchProjects();
        if (!cancelled) setProjects(rows);
      } catch (e) {
        if (!cancelled) setProjErr(e instanceof Error ? e.message : "Could not load projects");
      } finally {
        if (!cancelled) setProjLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full space-y-8">
      <div>
        <p className="mt-1 w-full text-sm text-muted-foreground">
          Each workspace is opened in the context of a project you choose. Governance uses uploads you attach on the
          next screen; metrics opens that project&apos;s health analytics; portfolio opens the cross-project view with
          your selection highlighted for trends.
        </p>
      </div>

      {projErr ? <p className="text-sm text-destructive">{projErr}</p> : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <ReportWorkspaceCard
          kind="governance"
          title="Governance report"
          description="Generate a governance package from three files (status tracker, RAID log, weekly history) in the context of the project you select."
          icon={FileText}
          projects={projects}
          loading={projLoading}
        />
        <ReportWorkspaceCard
          kind="metrics"
          title="Metrics & analytics"
          description="KPIs, EVM, RAID-derived signals, and charts for the selected project after data has been ingested."
          icon={LineChart}
          projects={projects}
          loading={projLoading}
        />
        <ReportWorkspaceCard
          kind="portfolio"
          title="Portfolio intelligence"
          description="Comparisons, heatmaps, and history across all projects you can access, opened with your project pre-selected for trend charts."
          icon={BarChart3}
          projects={projects}
          loading={projLoading}
        />
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
                <li
                  key={`${r.job_id}-${r.created_at}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0"
                >
                  <span className="font-medium text-foreground">{r.project_name}</span>
                  <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                  <Button asChild variant="link" className="h-auto p-0 text-primary">
                    <Link to={`/dashboard/projects/${r.project_id}/reports?jobId=${encodeURIComponent(r.job_id)}`}>
                      Download files
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
        <CardContent className="w-full max-w-none space-y-4">
          <ProjectQuickPick
            destination="reports"
            title="Pick a project"
            description="Choose a project you can access, then go straight to its Reports workspace."
            layout="full"
          />
        </CardContent>
      </Card>
    </div>
  );
}
