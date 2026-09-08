import { useEffect, useState } from "react";
import { ArrowRight, FileStack } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchCreationTemplates, type ProjectTemplateOut } from "@/api/projects";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ProjectTemplateOut[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchCreationTemplates();
        if (!cancelled) setTemplates(rows);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Could not load templates");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary/10 via-card to-[hsl(var(--brand-secondary)/0.12)] p-6 shadow-card md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mt-2 w-full text-sm leading-relaxed text-muted-foreground md:text-base">
              These playbooks only set the starting description and a stored template key on the project. Upload rules
              are the same for every project. When you create a project, step one lists all templates so you can pick one
              before continuing.
            </p>
          </div>
          <Button asChild size="lg" className="shrink-0 rounded-2xl shadow-md">
            <Link to="/dashboard/projects/new">
              Create a project <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {!templates ? <p className="text-sm text-muted-foreground">Loading templates…</p> : null}

      {templates && templates.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2">
          {templates.map((t, i) => (
            <Card
              key={t.key}
              className="group relative overflow-hidden border-border/80 bg-card/95 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card-hover"
            >
              <div
                className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-[hsl(var(--brand-secondary))] to-[hsl(var(--brand-accent))]"
                style={{ opacity: 0.45 + (i % 3) * 0.12 }}
                aria-hidden
              />
              <CardHeader className="flex flex-row items-start gap-4 pb-2">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/20">
                  <FileStack className="size-6" />
                </div>
                <div className="min-w-0 space-y-1">
                  <CardTitle className="font-display text-lg tracking-tight">{t.name}</CardTitle>
                  <CardDescription className="text-sm leading-snug">{t.summary}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {t.checklist.length > 0 ? (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {t.checklist.map((line) => (
                      <li key={line} className="flex gap-2">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Select this playbook on the first step of{" "}
                  <Link to="/dashboard/projects/new" className="font-medium text-primary underline-offset-4 hover:underline">
                    create project
                  </Link>
                  , or open create project with{" "}
                  <Link
                    to={`/dashboard/projects/new?template=${encodeURIComponent(t.key)}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    this template pre-selected
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
