import { FileStack } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";

export default function TemplatesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Templates</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Reusable report and upload templates will appear here in a future release.
        </p>
      </div>
      <Card className="border-dashed border-border/80 bg-muted/15">
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
            <FileStack className="size-6 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-base">Coming soon</CardTitle>
            <CardDescription>
              This area is reserved for curated governance templates, RAID starters, and export presets.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
