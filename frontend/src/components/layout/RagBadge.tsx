import { Badge } from "@/components/shadcn/badge";
import { cn } from "@/lib/utils";

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase();

export function RagBadge({ rag, className }: { rag: string | null | undefined; className?: string }) {
  const r = norm(rag);
  const variant =
    !r || r === "unknown"
      ? ("muted" as const)
      : r === "green"
        ? ("success" as const)
        : r === "amber" || r === "yellow"
          ? ("warning" as const)
          : ("danger" as const);
  const label = rag && r ? rag.charAt(0).toUpperCase() + rag.slice(1).toLowerCase() : "—";
  return (
    <Badge variant={variant} className={cn("uppercase tracking-wide", className)}>
      {label}
    </Badge>
  );
}
