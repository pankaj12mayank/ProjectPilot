import type { ComponentType } from "react";
import {
  Activity,
  ClipboardList,
  FileStack,
  FolderKanban,
  LayoutDashboard,
  LineChart,
  Mail,
  Palette,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { isPlatformAdmin } from "../auth/roleUtils";
import { useBranding } from "../branding/BrandingProvider";
import { ScrollArea } from "@/components/shadcn/scroll-area";
import { Separator } from "@/components/shadcn/separator";
import { useSidebarLogoInvertClass, type SidebarLogoFilter } from "@/hooks/useSidebarLogoInvertClass";
import { cn } from "@/lib/utils";
import { useTheme } from "@/theme";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
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

const adminNav: NavItem[] = [
  { to: "/dashboard/admin", label: "Overview", icon: Activity, end: true },
  { to: "/dashboard/admin/branding", label: "Branding", icon: Palette },
  { to: "/dashboard/admin/email", label: "Email / SMTP", icon: Mail },
  { to: "/dashboard/admin/users", label: "Users & roles", icon: Users },
  { to: "/dashboard/admin/audit", label: "Audit log", icon: ShieldCheck },
  { to: "/dashboard/admin/activity", label: "Activity explorer", icon: ClipboardList },
  { to: "/dashboard/admin/system", label: "System", icon: Wrench },
];

function NavButton({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={() => onNavigate?.()}
      className={({ isActive }) =>
        cn(
          "pp-type-sidebar group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
          isActive
            ? "bg-[hsl(var(--sidebar-accent)/0.22)] font-medium text-sidebar-foreground shadow-[inset_0_1px_0_0_hsl(var(--sidebar-accent)/0.35)] ring-1 ring-[hsl(var(--sidebar-accent)/0.35)]"
            : "font-medium text-sidebar-muted hover:bg-[hsl(var(--sidebar-foreground)/0.06)] hover:text-sidebar-foreground",
        )
      }
    >
      <Icon className="size-[1.15rem] shrink-0 opacity-90" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

export function AppSidebar({ mobileOpen, onNavigate }: { mobileOpen: boolean; onNavigate?: () => void }) {
  const { user } = useAuth();
  const { branding } = useBranding();
  const { resolved } = useTheme();
  const product = (branding?.meta_title || "ProjectPilot").trim() || "ProjectPilot";
  const urls = branding?.asset_urls ?? {};
  const logoLight = urls.logo as string | undefined;
  const logoDark = (urls.logo_dark as string | undefined) || logoLight;
  const logo = resolved === "dark" ? logoDark : logoLight;
  const logoFilter: SidebarLogoFilter = "auto";
  const logoInvertClass = useSidebarLogoInvertClass(logo, logoFilter, resolved === "dark");

  const showAdmin = Boolean(user && isPlatformAdmin(user.role));

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-soft backdrop-blur-sm transition-[transform,background-color,border-color,box-shadow,color] duration-300 ease-out dark:shadow-soft-dark md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {logo ? (
            <img
              src={logo}
              alt=""
              className={cn("h-8 max-w-[9.5rem] object-contain object-left transition-[filter] duration-200", logoInvertClass)}
            />
          ) : (
            <span className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">{product}</span>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="flex flex-col gap-0.5">
          <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted">Workspace</p>
          {primaryNav.map((item) => (
            <NavButton key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </nav>

        {showAdmin ? (
          <>
            <Separator className="my-3 bg-sidebar-border" />
            <nav className="flex flex-col gap-0.5">
              <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted">Administration</p>
              {adminNav.map((item) => (
                <NavButton key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </nav>
          </>
        ) : null}

        <Separator className="my-3 bg-sidebar-border" />
        <nav className="flex flex-col gap-0.5">
          <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted">Account</p>
          <NavButton item={{ to: "/dashboard/settings", label: "Settings", icon: Settings }} onNavigate={onNavigate} />
        </nav>
      </ScrollArea>
    </aside>
  );
}
