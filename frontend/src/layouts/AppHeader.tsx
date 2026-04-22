import { LogOut, Menu, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { isPlatformAdmin } from "../auth/roleUtils";
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
import { ThemeToggle, useTheme } from "@/theme";

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
  const { preference, setPreference } = useTheme();

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-card/85 shadow-soft backdrop-blur-md dark:border-border/50 dark:bg-card/70 dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
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
        <ThemeToggle variant="icon" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={cn("hidden gap-2 sm:inline-flex", "rounded-xl border-border/80")}>
              <UserRound className="size-4 opacity-80" />
              <span className="max-w-[10rem] truncate text-left text-sm font-medium">{user?.full_name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-0.5">
                <span className="text-sm font-medium">{user?.full_name}</span>
                <span className="text-xs text-muted-foreground">{user?.email}</span>
                <span className="text-xs capitalize text-muted-foreground">{user?.role?.replaceAll("_", " ")}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Appearance</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setPreference("light")} className={preference === "light" ? "bg-accent" : ""}>
              <Sun className="mr-2 size-4 text-brand-blue" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPreference("dark")} className={preference === "dark" ? "bg-accent" : ""}>
              <Moon className="mr-2 size-4 text-brand-blue" />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPreference("system")} className={preference === "system" ? "bg-accent" : ""}>
              <Monitor className="mr-2 size-4 text-brand-blue" />
              System
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/dashboard/profile">Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/dashboard/settings">Settings</Link>
            </DropdownMenuItem>
            {user && isPlatformAdmin(user.role) ? (
              <DropdownMenuItem asChild>
                <Link to="/admin">Administration</Link>
              </DropdownMenuItem>
            ) : null}
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
