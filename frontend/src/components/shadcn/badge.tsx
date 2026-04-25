import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-sm",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        success:
          "border-transparent bg-[hsl(var(--rag-green)/0.14)] text-[hsl(var(--on-rag-green))] dark:bg-[hsl(var(--rag-green)/0.2)] dark:text-[hsl(var(--on-rag-green))]",
        warning:
          "border-transparent bg-[hsl(var(--rag-amber)/0.14)] text-[hsl(var(--on-rag-amber))] dark:bg-[hsl(var(--rag-amber)/0.22)] dark:text-[hsl(var(--on-rag-amber))]",
        danger:
          "border-transparent bg-[hsl(var(--rag-red)/0.14)] text-[hsl(var(--on-rag-red))] dark:bg-[hsl(var(--rag-red)/0.2)] dark:text-[hsl(var(--on-rag-red))]",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
