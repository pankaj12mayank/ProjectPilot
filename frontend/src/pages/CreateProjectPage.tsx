import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createProject } from "../api/projects";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { FormField } from "../components/ui/FormField";

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const p = await createProject({
        name: name.trim(),
        description: description.trim() || null,
      });
      navigate(`/dashboard/projects/${p.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pp-grid pp-grid--1">
      <Card title="Create project">
        <p className="pp-muted">
          Give the workspace a clear name. You can upload spreadsheets on the next step from the project page.
        </p>
        <form className="pp-form" onSubmit={handleSubmit}>
          <FormField label="Project name" htmlFor="proj-name">
            <input
              id="proj-name"
              className="pp-input"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              maxLength={200}
              autoComplete="off"
            />
          </FormField>
          <FormField label="Description (optional)" htmlFor="proj-desc">
            <textarea
              id="proj-desc"
              className="pp-input"
              rows={4}
              value={description}
              onChange={(ev) => setDescription(ev.target.value)}
              maxLength={4000}
            />
          </FormField>
          {error ? (
            <p className="pp-field__error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="pp-row-actions">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create project"}
            </Button>
            <Link to="/dashboard/projects" className="pp-btn pp-btn--secondary">
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
