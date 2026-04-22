import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BrandingPublic, SidebarLogoFilter } from "../api/branding";
import { fetchBrandingPublic } from "../api/branding";
import { hexToHslSpace } from "@/lib/colorUtils";
import { useTheme } from "@/theme";

type BrandingState = {
  branding: BrandingPublic | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  version: number;
};

const BrandingContext = createContext<BrandingState | null>(null);

const defaultBranding: BrandingPublic = {
  product_name: "ProjectPilot",
  product_tagline: "",
  footer_text: "",
  support_email: "",
  company_address: "",
  social: {},
  meta_title: "",
  meta_description: "",
  default_domain_url: "",
  company_website_url: "",
  public_api_url: "",
  public_app_url: "",
  asset_version: 1,
  asset_urls: {},
  files_base: "",
  sidebar_logo_filter: "auto",
  accent_color_light: "",
  accent_color_dark: "",
};

function normalizeSidebarFilter(v: string | undefined | null): SidebarLogoFilter {
  const x = (v || "auto").toLowerCase();
  return x === "invert" || x === "original" ? x : "auto";
}

function BrandingDocumentEffects() {
  const { branding } = useBranding();
  const { resolved } = useTheme();

  useEffect(() => {
    const b = branding ?? defaultBranding;
    const title = (b.meta_title || b.product_name || "ProjectPilot").trim();
    document.title = title;

    const favLight = b.asset_urls?.favicon as string | undefined;
    const favDark = (b.asset_urls?.favicon_dark as string | undefined) || favLight;
    const fav = resolved === "dark" ? favDark : favLight;

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    if (fav) {
      link.href = fav;
    }
  }, [branding, resolved]);

  useEffect(() => {
    const b = branding ?? defaultBranding;
    const root = document.documentElement;
    const hex = resolved === "dark" ? (b.accent_color_dark || "").trim() : (b.accent_color_light || "").trim();
    const hsl = hex ? hexToHslSpace(hex) : null;
    if (hsl) {
      root.style.setProperty("--brand-accent", hsl);
      root.style.setProperty("--chart-3", hsl);
    } else {
      root.style.removeProperty("--brand-accent");
      root.style.removeProperty("--chart-3");
    }
  }, [branding, resolved]);

  return null;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const b = await fetchBrandingPublic();
      setBranding({
        ...b,
        sidebar_logo_filter: normalizeSidebarFilter(b.sidebar_logo_filter),
        accent_color_light: (b.accent_color_light || "").trim(),
        accent_color_dark: (b.accent_color_dark || "").trim(),
      });
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Branding unavailable");
      setBranding(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      branding,
      loading,
      error,
      refresh,
      version,
    }),
    [branding, loading, error, refresh, version],
  );

  return (
    <BrandingContext.Provider value={value}>
      <BrandingDocumentEffects />
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingState {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}

export function useBrandingSafe(): BrandingState {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    return {
      branding: null,
      loading: false,
      error: null,
      refresh: async () => {},
      version: 0,
    };
  }
  return ctx;
}
