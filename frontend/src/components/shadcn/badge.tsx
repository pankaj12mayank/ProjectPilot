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
          "border-transparent bg-[hsl(var(--rag-green)/0.14)] text-[hsl(160_84%_26%)] dark:bg-[hsl(var(--rag-green)/0.18)] dark:text-emerald-200",
        warning:
          "border-transparent bg-[hsl(var(--rag-amber)/0.14)] text-[hsl(32_94%_28%)] dark:bg-[hsl(var(--rag-amber)/0.2)] dark:text-amber-200",
        danger:
          "border-transparent bg-[hsl(var(--rag-red)/0.14)] text-[hsl(0_72%_34%)] dark:bg-[hsl(var(--rag-red)/0.18)] dark:text-red-200",
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
