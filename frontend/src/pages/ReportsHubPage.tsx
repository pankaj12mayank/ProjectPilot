import { BarChart3, FileText, LineChart } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";

const links = [
  {
    to: "/dashboard/governance",
    title: "Governance report",
    description: "Executive governance package and narrative outputs.",
    icon: FileText,
  },
  {
    to: "/dashboard/metrics",
    title: "Metrics & analytics",
    description: "Cross-project KPIs, trends, and operational metrics.",
    icon: LineChart,
  },
  {
    to: "/dashboard/portfolio",
    title: "Portfolio intelligence",
    description: "Comparisons, heatmaps, and portfolio-level report history.",
    icon: BarChart3,
  },
];

export default function ReportsHubPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reports</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Generate, explore, and export intelligence artifacts. Open a workspace below to continue.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Card key={l.to} className="group border-border/80 transition-shadow hover:shadow-card">
            <CardHeader>
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <l.icon className="size-5" />
              </div>
              <CardTitle className="text-base">{l.title}</CardTitle>
              <CardDescription>{l.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary" className="w-full rounded-xl">
                <Link to={l.to}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-dashed border-border/80 bg-muted/20">
        <CardHeader>
          <CardTitle className="text-base">Project reports</CardTitle>
          <CardDescription>
            Generated report packages live on each project. Pick a project from{" "}
            <Link to="/dashboard/projects" className="font-medium text-primary hover:underline">
              Projects
            </Link>{" "}
            → Reports.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
