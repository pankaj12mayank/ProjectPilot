import { Link } from "react-router-dom";
import { useBranding } from "../../branding/BrandingProvider";
import { footerContent } from "../content/footer";

export function LandingFooter() {
  const { branding } = useBranding();
  const product = (branding?.meta_title || "ProjectPilot").trim() || "ProjectPilot";

  return (
    <footer className="border-t border-border/40 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <span className="font-hero text-lg font-bold tracking-tight text-foreground">
              {product}
            </span>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {footerContent.description}
            </p>
          </div>
          {footerContent.columns.map((col) => (
            <div key={col.title}>
              <h3 className="mb-3 text-sm font-semibold text-foreground">{col.title}</h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-border/40 pt-6">
          <p className="text-center text-xs text-muted-foreground">{footerContent.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
