import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BrandingPublic } from "../api/branding";
import { fetchBrandingPublic } from "../api/branding";
import { hexToHslSpace } from "@/lib/colorUtils";

type BrandingState = {
  branding: BrandingPublic | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  version: number;
};

const BrandingContext = createContext<BrandingState | null>(null);

const defaultBranding: BrandingPublic = {
  meta_title: "",
  meta_description: "",
  social: {},
  asset_version: 1,
  asset_urls: {},
  files_base: "",
  accent_color: "",
};

function BrandingDocumentEffects() {
  const { branding } = useBranding();

  useEffect(() => {
    const b = branding ?? defaultBranding;
    const title = (b.meta_title || "ProjectPilot").trim() || "ProjectPilot";
    document.title = title;

    const fav = b.asset_urls?.favicon as string | undefined;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    if (fav) {
      link.href = fav;
    }

    const desc = (b.meta_description || "").trim();
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (desc) {
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "description";
        document.head.appendChild(meta);
      }
      meta.content = desc;
    } else if (meta) {
      meta.remove();
    }
  }, [branding]);

  useEffect(() => {
    const b = branding ?? defaultBranding;
    const root = document.documentElement;
    const hex = (b.accent_color || "").trim();
    const hsl = hex ? hexToHslSpace(hex) : null;
    if (hsl) {
      root.style.setProperty("--brand-accent", hsl);
      root.style.setProperty("--chart-3", hsl);
    } else {
      root.style.removeProperty("--brand-accent");
      root.style.removeProperty("--chart-3");
    }
  }, [branding]);

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
        accent_color: (b.accent_color || "").trim(),
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
