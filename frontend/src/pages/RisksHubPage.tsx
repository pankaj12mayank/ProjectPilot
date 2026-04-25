import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProjectRisks, fetchProjects, type ProjectOut, type ProjectRiskOut } from "@/api/projects";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { PageLoader } from "@/components/PageLoader";

type Flow = "register" | "snapshot";

const PAGE_SIZE = 10;

export default function RisksHubPage() {
  const [projects, setProjects] = useState<ProjectOut[] | null>(null);
  const [flow, setFlow] = useState<Flow>("register");
  const [selectedId, setSelectedId] = useState("");
  const [risks, setRisks] = useState<ProjectRiskOut[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingRisks, setLoadingRisks] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let c = false;
    (async () => {
      setLoadingList(true);
      setErr(null);
      try {
        const rows = await fetchProjects();
        if (c) return;
        setProjects(rows);
        setSelectedId((prev) => {
          if (prev && rows.some((p) => p.id === prev)) return prev;
          return rows[0]?.id || "";
        });
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
    if (!selectedId || flow !== "snapshot") {
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
  }, [selectedId, flow]);

  useEffect(() => {
    setPage(1);
  }, [q, statusFilter, selectedId, flow]);

  const selected = useMemo(() => projects?.find((p) => p.id === selectedId), [projects, selectedId]);

  const filteredRisks = useMemo(() => {
    if (!risks) return [];
    const needle = q.trim().toLowerCase();
    return risks.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!needle) return true;
      const blob = `${r.title} ${r.description ?? ""}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [risks, q, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRisks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredRisks.slice(start, start + PAGE_SIZE);
  }, [filteredRisks, safePage]);

  if (loadingList && !projects) return <PageLoader />;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Risks</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Choose whether you are opening the live register to add or edit items, or reviewing a read-only snapshot. In
          both cases, pick the project first. RAID rows from uploads inform health scores; this list is for registered
          project risks you maintain explicitly.
        </p>
      </div>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-base">1. What do you want to do?</CardTitle>
          <CardDescription>Select a flow, then choose a project below.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant={flow === "register" ? "default" : "outline"}
            className="h-auto flex-1 flex-col items-start gap-1 rounded-xl py-4 text-left"
            onClick={() => setFlow("register")}
          >
            <span className="font-semibold">Risk dashboard</span>
            <span className="text-xs font-normal opacity-90">Create, edit, and link risks to report runs.</span>
          </Button>
          <Button
            type="button"
            variant={flow === "snapshot" ? "default" : "outline"}
            className="h-auto flex-1 flex-col items-start gap-1 rounded-xl py-4 text-left"
            onClick={() => setFlow("snapshot")}
          >
            <span className="font-semibold">Snapshot & search</span>
            <span className="text-xs font-normal opacity-90">Filter and paginate the current register in read-only mode.</span>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-base">2. Project</CardTitle>
          <CardDescription>Select a project you can access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!projects?.length ? (
            <p className="text-sm text-muted-foreground">No projects yet. Create a project first.</p>
          ) : (
            <>
              <div className="flex w-full flex-col gap-2">
                <label htmlFor="risk-hub-project" className="text-sm font-medium text-foreground">
                  Project
                </label>
                <select
                  id="risk-hub-project"
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
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

              {selected && selected.has_ingested_data ? (
                <p className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  This project has ingested uploads. RAID-based signals appear under{" "}
                  <Link className="font-medium text-primary hover:underline" to={`/dashboard/projects/${selected.id}/health`}>
                    Project health
                  </Link>
                  . Registered risks below are separate and are what reports reference for formal mitigations.
                </p>
              ) : selected ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                  No ingested files yet for this project. Upload from the project workspace, then refresh this page to
                  align health data with your register.
                </p>
              ) : null}

              {flow === "register" && selectedId ? (
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button asChild className="w-full rounded-xl sm:w-auto">
                    <Link to={`/dashboard/projects/${selectedId}/risks`}>Open risk dashboard</Link>
                  </Button>
                  <Button asChild variant="secondary" className="w-full rounded-xl sm:w-auto">
                    <Link to={`/dashboard/projects/${selectedId}/health`}>Project health</Link>
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {flow === "snapshot" && selectedId && selected ? (
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-base">3. Register snapshot — {selected.name}</CardTitle>
            <CardDescription>Search and filter the list, then open the dashboard if you need to edit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid w-full gap-3 sm:grid-cols-2">
              <div className="flex w-full flex-col gap-2">
                <label htmlFor="risk-q" className="text-sm font-medium text-foreground">
                  Search
                </label>
                <input
                  id="risk-q"
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Title or description"
                />
              </div>
              <div className="flex w-full flex-col gap-2">
                <label htmlFor="risk-status" className="text-sm font-medium text-foreground">
                  Status
                </label>
                <select
                  id="risk-status"
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                >
                  <option value="all">All</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            {loadingRisks ? (
              <p className="text-sm text-muted-foreground">Loading risks…</p>
            ) : !risks?.length ? (
              <p className="text-sm text-muted-foreground">
                No registered risks for this project yet. Switch to Risk dashboard and add items, or confirm you expect
                only ingest-driven scores on the health page.
              </p>
            ) : filteredRisks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No risks match these filters.</p>
            ) : (
              <>
                <div className="w-full overflow-x-auto rounded-xl border border-border/60">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead className="border-b border-border/60 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Title</th>
                        <th className="px-3 py-2 font-medium">Severity</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Updated</th>
                        <th className="px-3 py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {slice.map((r) => (
                        <tr key={r.id} className="border-b border-border/40 last:border-0">
                          <td className="px-3 py-2 font-medium text-foreground">{r.title}</td>
                          <td className="px-3 py-2 capitalize text-muted-foreground">{r.severity}</td>
                          <td className="px-3 py-2 capitalize text-muted-foreground">{r.status}</td>
                          <td className="px-3 py-2 text-muted-foreground">{new Date(r.updated_at).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right">
                            <Button asChild variant="link" className="h-auto p-0 text-primary">
                              <Link to={`/dashboard/projects/${selectedId}/risks`}>View in dashboard</Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex w-full flex-col gap-2 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredRisks.length)} of{" "}
                    {filteredRisks.length} (total {risks.length} on project)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="self-center text-xs text-muted-foreground">
                      Page {safePage} / {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}

            <Button asChild variant="secondary" className="w-full rounded-xl sm:w-auto">
              <Link to={`/dashboard/projects/${selectedId}/risks`}>Open full risk dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        Portfolio heatmap and comparisons live under{" "}
        <Link to="/dashboard/portfolio" className="text-primary underline-offset-4 hover:underline">
          Portfolio
        </Link>
        .
      </p>
    </div>
  );
}
