import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { PageLoader } from "../components/PageLoader";
import { useAuth } from "../auth/AuthContext";
import { isPlatformAdmin } from "../auth/roleUtils";
import { ThemeToggle, useTheme } from "@/theme";

const docsBase = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export default function SettingsPage() {
  const [ready, setReady] = useState(false);
  const { resolved, preference } = useTheme();
  const { user } = useAuth();
  const showBrandingLink = Boolean(user && isPlatformAdmin(user.role));

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) return <PageLoader />;

  return (
    <div className="pp-grid pp-grid--2">
      <Card title="Appearance">
        <p className="pp-muted" style={{ marginBottom: "1rem" }}>
          Light, dark, or follow the system. Preference is stored in this browser (local storage).
        </p>
        <ThemeToggle variant="segmented" />
        <p className="pp-muted" style={{ marginTop: "0.85rem", fontSize: "0.85rem" }}>
          Active: <strong>{resolved === "dark" ? "Dark" : "Light"}</strong>
          {preference === "system" ? " (from system)" : ""}. Use the sun/moon control in the header for a quick toggle.
        </p>
      </Card>

      {showBrandingLink ? (
        <Card title="Branding">
          <p className="pp-muted">
            Logo (light and dark), favicon, SEO fields, social links, and theme accent are managed on the branding page.
          </p>
          <p style={{ marginTop: "0.75rem" }}>
            <Link to="/admin/branding" className="pp-btn pp-btn--secondary pp-btn--sm">
              Open branding settings
            </Link>
          </p>
        </Card>
      ) : null}

      <Card title="Application">
        <p className="pp-muted">
          ProjectPilot stores governance outputs under <code>outputs/</code> on the server. Access and refresh tokens
          are stored in your browser; signing out removes them.
        </p>
      </Card>
      <Card title="API">
        <p>
          <a href={`${docsBase}/docs`} target="_blank" rel="noreferrer">
            OpenAPI docs
          </a>
        </p>
        <p className="pp-muted">
          Configure the API base URL with <code>VITE_API_URL</code> (build-time for Docker). Local dev defaults to{" "}
          <code>http://127.0.0.1:8000</code>.
        </p>
      </Card>
    </div>
  );
}
