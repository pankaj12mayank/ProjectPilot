import type { CSSProperties } from "react";

/** Recharts <Tooltip contentStyle={…} /> — theme-aware for light and dark. */
export const rechartsTooltipContentStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--card-foreground))",
  fontSize: 12,
  boxShadow: "0 10px 28px hsl(24 22% 8% / 0.12)",
};

export const rechartsTooltipItemStyle: CSSProperties = {
  color: "hsl(var(--foreground))",
};

export const rechartsTooltipLabelStyle: CSSProperties = {
  color: "hsl(var(--muted-foreground))",
  fontWeight: 600,
  marginBottom: 4,
};
