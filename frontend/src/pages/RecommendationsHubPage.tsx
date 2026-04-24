import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { ProjectQuickPick } from "@/components/ProjectQuickPick";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";

export default function RecommendationsHubPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Recommendations</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Model-backed actions and recovery paths are generated per project after intelligence runs.
        </p>
      </div>
      <Card className="max-w-2xl border-border/80">
        <CardHeader>
          <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
            <Sparkles className="size-5" />
          </div>
          <CardTitle className="text-base">Open project recommendations</CardTitle>
          <CardDescription>
            Recommendations are generated per project. Browse all projects or open one you already work on.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ProjectQuickPick
            destination="recommendations"
            title="Pick a project"
            description="Choose a project you can access, then go to its Recommendations page."
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="rounded-xl">
              <Link to="/dashboard/projects">Browse projects</Link>
            </Button>
            <Button asChild variant="secondary" className="rounded-xl">
              <Link to="/dashboard/portfolio">Portfolio overview</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
