import { useEffect, useState } from "react";
import { Card } from "../components/ui/Card";
import { PageLoader } from "../components/PageLoader";

const docsBase = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export default function SettingsPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) return <PageLoader />;

  return (
    <div className="pp-grid pp-grid--2">
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
