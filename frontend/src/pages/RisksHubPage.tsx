import { Activity, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";

export default function RisksHubPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Risks</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Portfolio risk posture, RAG signals, and per-project RAID context.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="border-border/80">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
              <Shield className="size-5" />
            </div>
            <CardTitle className="text-base">Portfolio heatmap</CardTitle>
            <CardDescription>Compare normalized risk dimensions across all projects.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="rounded-xl">
              <Link to="/dashboard/portfolio">Open portfolio</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Activity className="size-5" />
            </div>
            <CardTitle className="text-base">Project health</CardTitle>
            <CardDescription>RAG status, SPI/CPI, and risk scores for an individual project.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="rounded-xl">
              <Link to="/dashboard/projects">Choose project</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
