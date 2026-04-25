import type { CSSProperties } from "react";

/** Recharts <Tooltip contentStyle={…} /> — theme-aware for light and dark. */
export const rechartsTooltipContentStyle: CSSProperties = {
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--popover) / 0.94)",
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
  boxShadow: "0 12px 32px hsl(24 22% 6% / 0.22)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
};

export const rechartsTooltipItemStyle: CSSProperties = {
  color: "hsl(var(--foreground))",
};

export const rechartsTooltipLabelStyle: CSSProperties = {
  color: "hsl(var(--muted-foreground))",
  fontWeight: 600,
  marginBottom: 4,
};
