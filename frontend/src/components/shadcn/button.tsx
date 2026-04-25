import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-sans text-sm font-semibold leading-snug ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:shadow-[0_0_0_3px_hsl(var(--ring)/0.22)] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-soft hover:brightness-[1.06] hover:saturate-[1.08] hover:shadow-md active:scale-[0.98]",
        secondary:
          "bg-secondary text-secondary-foreground hover:brightness-[0.98] hover:saturate-110 active:scale-[0.98]",
        outline:
          "border border-input bg-secondary/90 text-secondary-foreground backdrop-blur-sm hover:bg-accent hover:text-accent-foreground hover:border-primary/35 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-accent/90 dark:hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground active:scale-[0.98]",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-110 active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
