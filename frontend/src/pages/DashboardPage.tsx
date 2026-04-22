import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Card } from "../components/ui/Card";
import { PageLoader } from "../components/PageLoader";

export default function DashboardPage() {
  const { user, ready } = useAuth();

  if (!ready || !user) {
    return <PageLoader />;
  }

  return (
    <div className="pp-grid pp-grid--2">
      <Card title="Welcome">
        <p>
          Signed in as <strong>{user.full_name}</strong> ({user.role}).
        </p>
        <p className="pp-muted">
          Use the sidebar to run governance reports, manage your profile, or administer users.
        </p>
      </Card>
      <Card title="Shortcuts">
        <ul className="pp-shortcuts">
          <li>
            <Link to="/dashboard/metrics">Metrics dashboard</Link>
          </li>
          <li>
            <Link to="/dashboard/projects">Projects &amp; uploads</Link>
          </li>
          <li>
            <Link to="/dashboard/governance">Generate governance report</Link>
          </li>
          <li>
            <Link to="/dashboard/profile">Edit profile</Link>
          </li>
          {user.role === "admin" ? (
            <li>
              <Link to="/dashboard/users">User management</Link>
            </li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
