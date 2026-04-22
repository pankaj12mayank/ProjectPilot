import { useEffect, useState } from "react";

export type SidebarLogoFilter = "auto" | "invert" | "original";

const ALPHA_THRESHOLD = 250;

/**
 * CSS filters for the dark sidebar rail: opaque raster logos (e.g. JPEG / opaque PNG)
 * are auto-inverted for contrast; transparent PNG/WebP/SVG typically skip invert in `auto`.
 */
export function useSidebarLogoInvertClass(imageUrl: string | undefined, preference: SidebarLogoFilter): string {
  const [opaqueRaster, setOpaqueRaster] = useState(false);

  useEffect(() => {
    if (!imageUrl || preference !== "auto") {
      setOpaqueRaster(false);
      return;
    }
    const lower = imageUrl.split("?")[0]?.toLowerCase() ?? "";
    if (lower.endsWith(".svg")) {
      setOpaqueRaster(false);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const cap = 64;
        const w = Math.min(cap, img.naturalWidth || cap);
        const h = Math.min(cap, img.naturalHeight || cap);
        if (w <= 0 || h <= 0) {
          setOpaqueRaster(false);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          setOpaqueRaster(false);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let hasTransparency = false;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i]! < ALPHA_THRESHOLD) {
            hasTransparency = true;
            break;
          }
        }
        setOpaqueRaster(!hasTransparency);
      } catch {
        setOpaqueRaster(false);
      }
    };
    img.onerror = () => setOpaqueRaster(false);
    img.src = imageUrl;
  }, [imageUrl, preference]);

  if (!imageUrl) return "";
  if (preference === "invert") return "brightness-0 invert";
  if (preference === "original") return "";
  return opaqueRaster ? "brightness-0 invert" : "";
}
