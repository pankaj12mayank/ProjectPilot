import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { PageLoader } from "../components/PageLoader";
import { useAuth } from "../auth/AuthContext";
import { isPlatformAdmin, isSystemOwner } from "../auth/roleUtils";
import { ThemeToggle, useTheme } from "@/theme";

const docsBase = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export default function SettingsPage() {
  const [ready, setReady] = useState(false);
  const { resolved, preference } = useTheme();
  const { user } = useAuth();
  const showBrandingLink = Boolean(user && isPlatformAdmin(user.role));
  const showApiDocs = Boolean(user && isSystemOwner(user.role));

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) return <PageLoader />;

  return (
    <div className="pp-grid pp-grid--2">
      <Card title="Appearance">
        <p className="pp-muted" style={{ marginBottom: "1rem" }}>
          Light, dark, or match the operating system. The choice is stored for this browser and synced to your account
          when signed in.
        </p>
        <ThemeToggle variant="segmented" />
        <p className="pp-muted" style={{ marginTop: "0.85rem", fontSize: "0.85rem" }}>
          Active: <strong>{resolved === "dark" ? "Dark" : "Light"}</strong>
          {preference === "system" ? " (from system)" : ""}. You can also use the theme control in the sidebar.
        </p>
      </Card>

      {showBrandingLink ? (
        <Card title="Branding">
          <p className="pp-muted">
            Logo (light and dark), favicon, SEO fields, social links, and accent color are configured on the branding
            page.
          </p>
          <p style={{ marginTop: "0.75rem" }}>
            <Link to="/dashboard/admin/branding" className="pp-btn pp-btn--secondary pp-btn--sm">
              Open branding settings
            </Link>
          </p>
        </Card>
      ) : null}

      <Card title="Application">
        <p className="pp-muted">
          Governance outputs are stored on the server under the configured data directories. Tokens stay in this
          browser until you sign out.
        </p>
      </Card>
      {showApiDocs ? (
        <Card title="API documentation">
          <p>
            <a
              href={`${docsBase}/docs`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              OpenAPI docs
            </a>
          </p>
          <p className="pp-muted">
            System owner only. Set the API base URL with <code>VITE_API_URL</code> at build time for Docker. Local
            development defaults to <code>http://127.0.0.1:8000</code>.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
