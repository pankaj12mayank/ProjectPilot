import { useEffect, useState } from "react";
import { LogOut, Menu, UserRound } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/shadcn/breadcrumb";
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

function titleCase(s: string) {
  if (!s) return "";
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function useBreadcrumbTrail() {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);
  const items: { href: string; label: string; current?: boolean }[] = [];
  let acc = "";
  for (let i = 0; i < segments.length; i++) {
    acc += `/${segments[i]}`;
    const isLast = i === segments.length - 1;
    const raw = segments[i]!;
    const label =
      raw.length > 20 ? `${raw.slice(0, 8)}…` : /^[a-f0-9-]{30,}$/i.test(raw) ? "Details" : titleCase(raw);
    items.push({ href: acc, label, current: isLast });
  }
  return items;
}

export function AppHeader({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const crumbs = useBreadcrumbTrail();
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
        <div className="min-w-0 flex-1">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <Link
                  to="/dashboard"
                  className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  Home
                </Link>
              </BreadcrumbItem>
              {crumbs.map((c) => (
                <span key={c.href} className="contents">
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {c.current ? (
                      <BreadcrumbPage>{c.label}</BreadcrumbPage>
                    ) : (
                      <Link
                        to={c.href}
                        className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
                      >
                        {c.label}
                      </Link>
                    )}
                  </BreadcrumbItem>
                </span>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <ThemeToggle variant="icon" className="shrink-0 rounded-xl border-border/80" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={cn("gap-2 rounded-xl border-border/80", "shrink-0")}>
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="size-7 rounded-full object-cover ring-1 ring-border" />
              ) : (
                <UserRound className="size-4 opacity-80" />
              )}
              <span className="max-w-[10rem] truncate text-left text-sm font-medium">{user?.full_name}</span>
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
