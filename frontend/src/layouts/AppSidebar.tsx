import type { ComponentType } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileStack,
  FolderKanban,
  LayoutDashboard,
  LineChart,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { isPlatformAdmin } from "../auth/roleUtils";
import { useBranding } from "../branding/BrandingProvider";
import { Button } from "@/components/shadcn/button";
import { ScrollArea } from "@/components/shadcn/scroll-area";
import { Separator } from "@/components/shadcn/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn/tooltip";
import { useSidebarLogoInvertClass, type SidebarLogoFilter } from "@/hooks/useSidebarLogoInvertClass";
import { cn } from "@/lib/utils";
import { useTheme } from "@/theme";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  adminOnly?: boolean;
};

const primaryNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { to: "/dashboard/portfolio", label: "Portfolio", icon: LineChart },
  { to: "/dashboard/reports", label: "Reports", icon: ScrollText },
  { to: "/dashboard/risks", label: "Risks", icon: Shield },
  { to: "/dashboard/recommendations", label: "Recommendations", icon: Sparkles },
  { to: "/dashboard/logs", label: "Activity & logs", icon: ClipboardList },
  { to: "/dashboard/templates", label: "Templates", icon: FileStack },
];

const bottomNav: NavItem[] = [
  { to: "/admin/users", label: "Users", icon: Users, adminOnly: true },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

function NavButton({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={() => onNavigate?.()}
      className={({ isActive }) =>
        cn(
          "pp-type-sidebar group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
          collapsed && "justify-center px-2",
          isActive
            ? "bg-[hsl(var(--sidebar-accent)/0.28)] font-medium text-sidebar-foreground shadow-sm ring-1 ring-white/10"
            : "font-medium text-sidebar-muted hover:bg-white/[0.06] hover:text-sidebar-foreground",
        )
      }
    >
      <Icon className="size-[1.15rem] shrink-0 opacity-90" />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }
  return link;
}

export function AppSidebar({
  mobileOpen,
  collapsed,
  onCollapseChange,
  onNavigate,
}: {
  mobileOpen: boolean;
  collapsed: boolean;
  onCollapseChange: (v: boolean) => void;
  onNavigate?: () => void;
}) {
  const { user } = useAuth();
  const { branding } = useBranding();
  const { resolved } = useTheme();
  const product = (branding?.meta_title || "ProjectPilot").trim() || "ProjectPilot";
  const urls = branding?.asset_urls ?? {};
  const logoLight = urls.logo as string | undefined;
  const logoDark = (urls.logo_dark as string | undefined) || logoLight;
  const logo = resolved === "dark" ? logoDark : logoLight;
  const logoFilter: SidebarLogoFilter = "auto";
  const logoInvertClass = useSidebarLogoInvertClass(logo, logoFilter);

  const showAdmin = Boolean(user && isPlatformAdmin(user.role));

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-soft backdrop-blur-sm transition-all duration-300 ease-out md:translate-x-0",
        collapsed ? "w-[4.5rem]" : "w-60",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
    >
      <div className={cn("flex h-16 items-center gap-2 border-b border-sidebar-border px-3", collapsed && "justify-center px-2")}>
        <div className={cn("flex min-w-0 flex-1 items-center gap-2", collapsed && "flex-none justify-center")}>
          {logo && !collapsed ? (
            <img
              src={logo}
              alt=""
              className={cn("h-8 max-w-[9.5rem] object-contain object-left transition-[filter] duration-200", logoInvertClass)}
            />
          ) : (
            <span className={cn("truncate text-sm font-semibold tracking-tight text-sidebar-foreground", collapsed && "sr-only")}>
              {product}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "hidden shrink-0 text-sidebar-muted hover:bg-white/[0.08] hover:text-sidebar-foreground md:inline-flex",
            collapsed && "mx-auto",
          )}
          onClick={() => onCollapseChange(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="flex flex-col gap-0.5">
          <p
            className={cn(
              "mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted",
              collapsed && "sr-only",
            )}
          >
            Workspace
          </p>
          {primaryNav.map((item) => (
            <NavButton key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </nav>
        <Separator className="my-3 bg-sidebar-border" />
        <nav className="flex flex-col gap-0.5">
          <p
            className={cn(
              "mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted",
              collapsed && "sr-only",
            )}
          >
            Account
          </p>
          {showAdmin ? (
            <NavButton
              item={{ to: "/admin", label: "Administration", icon: Activity, end: true }}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ) : null}
          {bottomNav
            .filter((i) => !i.adminOnly || showAdmin)
            .map((item) => (
              <NavButton key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
