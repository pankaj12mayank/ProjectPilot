import { useEffect, useState } from "react";
import { ChevronDown, LogOut, Menu, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "@/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import { cn } from "@/lib/utils";
import { publicAvatarUrl } from "@/api/userProfile";
import { ThemeToggle } from "@/theme";

export function AppHeader({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const avatarSrc = user?.has_avatar
    ? `${publicAvatarUrl(user.id)}?v=${encodeURIComponent(user.updated_at ?? user.id)}`
    : null;

  return (
    <header
      className={cn(
        "sticky top-0 z-20 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out",
        scrolled
          ? "border-b border-border/80 bg-card/92 shadow-soft backdrop-blur-lg dark:border-border/55 dark:bg-card/88 dark:shadow-soft-dark"
          : "border-b border-transparent bg-background/55 shadow-none backdrop-blur-sm dark:bg-background/35 dark:backdrop-blur-md",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button type="button" variant="ghost" size="icon" className="md:hidden" onClick={onMenu} aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
        <div className="min-w-0 flex-1" aria-hidden />
        <ThemeToggle variant="icon" className="shrink-0 rounded-xl border-border/80" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={cn("gap-2 rounded-md border-border/80 pr-2", "shrink-0")}>
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="size-7 rounded-full object-cover ring-1 ring-border" />
              ) : (
                <UserRound className="size-4 shrink-0 opacity-80" />
              )}
              <span className="max-w-[10rem] truncate text-left text-sm font-medium">{user?.full_name}</span>
              <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-0.5">
                <span className="text-sm font-medium">{user?.full_name}</span>
                <span className="text-xs text-muted-foreground">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/dashboard/profile">Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
            >
              <LogOut className="mr-2 size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
