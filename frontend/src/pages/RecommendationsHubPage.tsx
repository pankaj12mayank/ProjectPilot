import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { ProjectQuickPick } from "@/components/ProjectQuickPick";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";

export default function RecommendationsHubPage() {
  return (
    <div className="w-full space-y-8">
      <div>
        <p className="mt-1 w-full text-sm text-muted-foreground">
          After intelligence runs complete for a project, structured recommendations appear on that project&apos;s
          recommendations page. Pick a project below or browse the full list.
        </p>
      </div>
      <Card className="w-full border-border/80">
        <CardHeader>
          <div className="flex size-10 items-center justify-center rounded-xl bg-[hsl(var(--brand-secondary)/0.18)] text-[hsl(var(--brand-secondary))] dark:bg-[hsl(var(--brand-secondary)/0.22)] dark:text-[hsl(86_32%_78%)]">
            <Sparkles className="size-5" />
          </div>
          <CardTitle className="text-base">Open project recommendations</CardTitle>
          <CardDescription>
            Choose a project you can access. You will be taken to its recommendations view with filters and export
            actions where data exists.
          </CardDescription>
        </CardHeader>
        <CardContent className="w-full max-w-none space-y-6">
          <ProjectQuickPick
            destination="recommendations"
            title="Pick a project"
            description="Lists every project in your workspace that you may open."
            layout="full"
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
