import { useEffect, useState } from "react";
import { FileStack } from "lucide-react";
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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Templates</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Built-in project templates set a starting description and checklist for the create-project wizard. Upload formats
          are the same for every template.
        </p>
      </div>

      {err ? (
        <p className="text-sm text-destructive">{err}</p>
      ) : !templates ? (
        <p className="text-sm text-muted-foreground">Loading templates…</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.key} className="border-border/80">
              <CardHeader className="flex flex-row items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileStack className="size-6" />
                </div>
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <CardDescription>{t.summary}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {t.checklist.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {t.checklist.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
                <Button asChild className="rounded-xl">
                  <Link to={`/dashboard/projects/new?template=${encodeURIComponent(t.key)}`}>Use in new project</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
