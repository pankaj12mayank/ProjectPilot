import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProjectRisks, fetchProjects, type ProjectOut, type ProjectRiskOut } from "@/api/projects";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { PageLoader } from "@/components/PageLoader";

export default function RisksHubPage() {
  const [projects, setProjects] = useState<ProjectOut[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [risks, setRisks] = useState<ProjectRiskOut[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingRisks, setLoadingRisks] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      setLoadingList(true);
      setErr(null);
      try {
        const rows = await fetchProjects();
        if (c) return;
        setProjects(rows);
        setSelectedId((prev) => prev || rows[0]?.id || "");
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Could not load projects");
      } finally {
        if (!c) setLoadingList(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setRisks(null);
      return;
    }
    let c = false;
    (async () => {
      setLoadingRisks(true);
      try {
        const r = await fetchProjectRisks(selectedId);
        if (!c) setRisks(r);
      } catch {
        if (!c) setRisks([]);
      } finally {
        if (!c) setLoadingRisks(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [selectedId]);

  const selected = useMemo(() => projects?.find((p) => p.id === selectedId), [projects, selectedId]);

  if (loadingList && !projects) return <PageLoader />;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Risks</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Choose a project to review its risk register and open the full dashboard. Registered risks are separate from
          RAID rows ingested from spreadsheets; they feed reports and portfolio views when present.
        </p>
      </div>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-base">Project</CardTitle>
          <CardDescription>Select a project you can access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!projects?.length ? (
            <p className="text-sm text-muted-foreground">No projects yet. Create a project first.</p>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label htmlFor="risk-hub-project" className="text-sm font-medium text-foreground">
                  Project
                </label>
                <select
                  id="risk-hub-project"
                  className="pp-input max-w-xl"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedId ? (
                  <Button asChild className="rounded-xl">
                    <Link to={`/dashboard/projects/${selectedId}/risks`}>Open risk dashboard</Link>
                  </Button>
                ) : (
                  <Button type="button" className="rounded-xl" disabled>
                    Open risk dashboard
                  </Button>
                )}
                {selectedId ? (
                  <Button asChild variant="secondary" className="rounded-xl">
                    <Link to={`/dashboard/projects/${selectedId}/health`}>Project health</Link>
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" className="rounded-xl" disabled>
                    Project health
                  </Button>
                )}
                <Button asChild variant="outline" className="rounded-xl">
                  <Link to="/dashboard/portfolio">Portfolio heatmap</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selectedId && selected ? (
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-base">Snapshot: {selected.name}</CardTitle>
            <CardDescription>Registered project risks (open and closed).</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRisks ? (
              <p className="text-sm text-muted-foreground">Loading risks…</p>
            ) : !risks?.length ? (
              <p className="text-sm text-muted-foreground">
                No registered risks for this project yet. Open the risk dashboard to add items, or confirm uploads and
                reports exist if you expect ingested context only.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {risks.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 py-2 last:border-0">
                    <span className="font-medium text-foreground">{r.title}</span>
                    <span className="text-xs capitalize text-muted-foreground">
                      {r.severity} · {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {!loadingRisks && risks && risks.length > 8 ? (
              <p className="mt-2 text-xs text-muted-foreground">Showing eight of {risks.length}. Open the dashboard for the full list.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
