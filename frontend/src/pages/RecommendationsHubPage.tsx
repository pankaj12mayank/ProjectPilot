import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
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
      <Card className="max-w-xl border-border/80">
        <CardHeader>
          <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700">
            <Sparkles className="size-5" />
          </div>
          <CardTitle className="text-base">Open project recommendations</CardTitle>
          <CardDescription>Select a project, then open the Recommendations tab from the project workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="rounded-xl">
            <Link to="/dashboard/projects">Browse projects</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
