import { Card } from "../components/ui/Card";

export default function AdminSystemPage() {
  return (
    <Card title="System settings">
      <p className="pp-muted">
        Runtime configuration is driven by environment variables (for example{" "}
        <code>PUBLIC_API_URL</code>, <code>PUBLIC_APP_URL</code>, <code>BRANDING_MAX_UPLOAD_MB</code>,{" "}
        <code>DATABASE_URL</code>, and JWT settings). Adjust values in your deployment <code>.env</code> file
        and restart the API for changes to take effect.
      </p>
    </Card>
  );
}
