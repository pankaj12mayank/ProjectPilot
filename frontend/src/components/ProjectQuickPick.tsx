import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProjects, type ProjectOut } from "@/api/projects";
import { Button } from "@/components/shadcn/button";

type Destination = "reports" | "recommendations";

const pathFor = (projectId: string, dest: Destination) =>
  dest === "reports"
    ? `/dashboard/projects/${encodeURIComponent(projectId)}/reports`
    : `/dashboard/projects/${encodeURIComponent(projectId)}/recommendations`;

export function ProjectQuickPick({
  destination,
  title,
  description,
}: {
  destination: Destination;
  title: string;
  description: string;
}) {
  const [projects, setProjects] = useState<ProjectOut[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [id, setId] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchProjects();
        if (!cancelled) {
          setProjects(rows);
          setId((prev) => {
            if (prev) return prev;
            return rows[0]?.id ?? "";
          });
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Could not load projects");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {!err && projects && projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects yet. Create one from Projects.</p>
      ) : null}
      {!err && projects && projects.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="pp-quick-pick-project">
            Project
          </label>
          <select
            id="pp-quick-pick-project"
            className="h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground sm:max-w-xs"
            value={id}
            onChange={(e) => setId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {id ? (
            <Button asChild className="rounded-xl sm:shrink-0">
              <Link to={pathFor(id, destination)}>Open</Link>
            </Button>
          ) : (
            <Button type="button" disabled className="rounded-xl sm:shrink-0">
              Open
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
