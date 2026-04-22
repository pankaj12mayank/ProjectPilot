import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { cn } from "@/lib/utils";
import { useTheme } from "./ThemeProvider";

type ThemeToggleProps = {
  /** Quick light/dark flip (navbar). */
  variant?: "icon" | "segmented";
  className?: string;
};

export function ThemeToggle({ variant = "icon", className }: ThemeToggleProps) {
  const { resolved, preference, setPreference, toggle } = useTheme();

  if (variant === "segmented") {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        <Button
          type="button"
          variant={preference === "light" ? "default" : "outline"}
          size="sm"
          className="gap-2 rounded-xl"
          onClick={() => setPreference("light")}
        >
          <Sun className="size-4" />
          Light
        </Button>
        <Button
          type="button"
          variant={preference === "dark" ? "default" : "outline"}
          size="sm"
          className="gap-2 rounded-xl"
          onClick={() => setPreference("dark")}
        >
          <Moon className="size-4" />
          Dark
        </Button>
        <Button
          type="button"
          variant={preference === "system" ? "default" : "outline"}
          size="sm"
          className="gap-2 rounded-xl"
          onClick={() => setPreference("system")}
        >
          <Monitor className="size-4" />
          System
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("inline-flex shrink-0 rounded-xl border-border/80", className)}
      onClick={() => toggle()}
      aria-label={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {resolved === "dark" ? (
        <Sun className="size-[1.05rem] text-brand-blue" />
      ) : (
        <Moon className="size-[1.05rem] text-brand-blue" />
      )}
    </Button>
  );
}
