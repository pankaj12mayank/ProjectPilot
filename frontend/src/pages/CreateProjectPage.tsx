import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  createProject,
  downloadProjectSampleCsv,
  fetchAssignableUsers,
  fetchCreationTemplates,
  fetchFormatGuide,
  type AssignableUserOut,
  type FormatGuideOut,
  type ProjectTemplateOut,
} from "../api/projects";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FormField } from "../components/ui/FormField";
import { useToast } from "../components/ToastProvider";
import { friendlyErrorMessage } from "@/lib/friendlyMessages";

const STEPS = ["Template", "Basic info", "Assign team", "Dates", "Sample formats", "Review"] as const;

function dateInputToIso(date: string, endOfDay: boolean): string | null {
  const t = date.trim();
  if (!t) return null;
  return endOfDay ? `${t}T23:59:59.000Z` : `${t}T00:00:00.000Z`;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CreateProjectPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState<ProjectTemplateOut[] | null>(null);
  const [templateKey, setTemplateKey] = useState("blank");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assignable, setAssignable] = useState<AssignableUserOut[] | null>(null);
  const [teamIds, setTeamIds] = useState<string[]>(() => (user?.id ? [user.id] : []));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [guide, setGuide] = useState<FormatGuideOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.id) {
      setTeamIds((prev) => (prev.length === 0 ? [user.id] : prev.includes(user.id) ? prev : [user.id, ...prev]));
    }
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchCreationTemplates();
        if (cancelled) return;
        setTemplates(rows);
        const wanted = searchParams.get("template")?.trim().toLowerCase();
        if (wanted && rows.some((x) => x.key === wanted)) {
          setTemplateKey(wanted);
          const row = rows.find((x) => x.key === wanted);
          if (row) setDescription(row.suggested_description || "");
        }
      } catch (e) {
        if (!cancelled) {
          const msg = friendlyErrorMessage(e, "We could not load project templates.");
          setError(msg);
          toast.push("error", msg);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, toast]);

  const loadAssignable = useCallback(async () => {
    try {
      const rows = await fetchAssignableUsers();
      setAssignable(rows);
    } catch (e) {
      const msg = friendlyErrorMessage(e, "We could not load the user list for your team.");
      setError(msg);
      toast.push("error", msg);
    }
  }, [toast]);

  useEffect(() => {
    if (step === 2 && assignable === null) void loadAssignable();
  }, [step, assignable, loadAssignable]);

  useEffect(() => {
    if (step !== 4) return;
    let cancelled = false;
    (async () => {
      try {
        const g = await fetchFormatGuide();
        if (!cancelled) setGuide(g);
      } catch (e) {
        if (!cancelled) {
          const msg = friendlyErrorMessage(e, "We could not load the sample format preview.");
          setError(msg);
          toast.push("error", msg);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, toast]);

  function applyTemplateChoice(key: string, list: ProjectTemplateOut[] | null) {
    setTemplateKey(key);
    const row = list?.find((x) => x.key === key);
    if (row) setDescription(row.suggested_description || "");
  }

  function toggleTeam(id: string) {
    if (!user?.id) return;
    if (id === user.id) return;
    setTeamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function validateStep(i: number): string | null {
    if (i === 1 && !name.trim()) return "Project name is required.";
    if (i === 3 && startDate && endDate && endDate < startDate) return "End date must be on or after start date.";
    return null;
  }

  function next() {
    const v = validateStep(step);
    if (v) {
      setError(v);
      toast.push("error", v);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function onDownloadSample(role: string) {
    try {
      const blob = await downloadProjectSampleCsv(role);
      triggerBlobDownload(blob, `${role}_sample.csv`);
      toast.push("success", "Sample file download started.");
    } catch (e) {
      const msg = friendlyErrorMessage(e, "We could not download that sample file.");
      setError(msg);
      toast.push("error", msg);
    }
  }

  async function handleCreate() {
    const v = validateStep(1);
    if (v) {
      setError(v);
      toast.push("error", v);
      setStep(1);
      return;
    }
    if (!user?.id) {
      const msg = "Please sign in again to create a project.";
      setError(msg);
      toast.push("error", msg);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const body: Parameters<typeof createProject>[0] = {
        name: name.trim(),
        description: description.trim() || null,
        team_user_ids: teamIds.length ? teamIds : [user.id],
        template_key: templateKey || null,
      };
      const sIso = dateInputToIso(startDate, false);
      const eIso = dateInputToIso(endDate, true);
      if (sIso) body.planned_start_date = sIso;
      if (eIso) body.planned_end_date = eIso;
      const p = await createProject(body);
      toast.push("success", `Project “${p.name}” was created. You can upload files on the next screen.`);
      navigate(`/dashboard/projects/${p.id}`, { replace: true });
    } catch (err) {
      const msg = friendlyErrorMessage(err, "We could not create this project.");
      setError(msg);
      toast.push("error", msg);
    } finally {
      setSubmitting(false);
    }
  }

  const templateLabel =
    templates?.find((t) => t.key === templateKey)?.name ?? (templateKey || "—");

  return (
    <div className="pp-grid pp-grid--1">
      <Card title="Create project">
        <p className="pp-muted" style={{ marginBottom: "1rem" }}>
          Step {step + 1} of {STEPS.length}: <strong>{STEPS[step]}</strong>
        </p>
        <div className="pp-row-actions" style={{ marginBottom: "1rem", flexWrap: "wrap" }}>
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={i === step ? "pp-pill" : "pp-pill pp-pill--muted"}
              style={{ cursor: "default", fontSize: "0.8rem" }}
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>

        {step === 0 ? (
          <div className="pp-form">
            {!templates ? (
              <p className="pp-muted">Loading templates…</p>
            ) : (
              <FormField label="Project template" htmlFor="proj-template-list">
                <div id="proj-template-list" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {templates.map((t) => (
                    <label
                      key={t.key}
                      className="pp-check"
                      style={{
                        display: "flex",
                        gap: "0.65rem",
                        alignItems: "flex-start",
                        border: templateKey === t.key ? "1px solid var(--pp-border-strong, #ccc)" : "1px solid transparent",
                        borderRadius: "8px",
                        padding: "0.65rem",
                      }}
                    >
                      <input
                        type="radio"
                        name="template"
                        checked={templateKey === t.key}
                        onChange={() => applyTemplateChoice(t.key, templates)}
                      />
                      <span>
                        <strong>{t.name}</strong>
                        <span className="pp-muted" style={{ display: "block", marginTop: "0.25rem" }}>
                          {t.summary}
                        </span>
                        {t.checklist.length ? (
                          <ul className="pp-muted" style={{ margin: "0.5rem 0 0 1.1rem", padding: 0 }}>
                            {t.checklist.map((line) => (
                              <li key={line} style={{ marginBottom: "0.2rem" }}>
                                {line}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              </FormField>
            )}
            <p className="pp-muted" style={{ marginTop: "0.75rem" }}>
              You can edit the suggested description on the next step. The same CSV upload formats apply to every template.
            </p>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="pp-form">
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
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <p className="pp-muted">
              Select team members who work on this project. You are always included as the owner. Access to the project
              still follows the owner and role-based rules in the app.
            </p>
            {!assignable ? (
              <p className="pp-muted">Loading users…</p>
            ) : (
              <ul className="pp-muted" style={{ listStyle: "none", padding: 0, marginTop: "0.75rem" }}>
                {assignable.map((u) => {
                  const locked = u.id === user?.id;
                  const checked = teamIds.includes(u.id);
                  return (
                    <li key={u.id} style={{ marginBottom: "0.5rem" }}>
                      <label className="pp-check" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={locked}
                          onChange={() => toggleTeam(u.id)}
                        />
                        <span>
                          {u.full_name} <span className="pp-muted">({u.email})</span>
                          {locked ? <span className="pp-muted"> — owner</span> : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="pp-form pp-form--grid">
            <FormField label="Planned start (optional)" htmlFor="proj-start">
              <input id="proj-start" className="pp-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </FormField>
            <FormField label="Planned end (optional)" htmlFor="proj-end">
              <input id="proj-end" className="pp-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </FormField>
            <p className="pp-muted" style={{ gridColumn: "1 / -1" }}>
              Planning dates are for your records; analytics still use data from uploaded spreadsheets.
            </p>
          </div>
        ) : null}

        {step === 4 ? (
          <div>
            <p className="pp-muted">
              Expected columns and example rows. Download CSV templates to use as a starting point for uploads.
            </p>
            {!guide ? (
              <p className="pp-muted" style={{ marginTop: "0.75rem" }}>
                Loading preview…
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "1rem" }}>
                {guide.slots.map((slot) => (
                  <div key={slot.role}>
                    <div className="pp-row-actions" style={{ marginBottom: "0.35rem" }}>
                      <strong>{slot.title}</strong>
                      <Button type="button" variant="secondary" onClick={() => void onDownloadSample(slot.role)}>
                        Download sample CSV
                      </Button>
                    </div>
                    <div className="pp-table-wrap">
                      <table className="pp-table">
                        <thead>
                          <tr>
                            {slot.columns.map((c) => (
                              <th key={c}>{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {slot.preview_rows.map((row, ri) => (
                            <tr key={ri}>
                              {row.map((cell, ci) => (
                                <td key={ci}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {step === 5 ? (
          <div className="pp-form">
            <p>
              <strong>Template:</strong> {templateLabel}
            </p>
            <p>
              <strong>Name:</strong> {name.trim() || "—"}
            </p>
            <p>
              <strong>Description:</strong> {description.trim() || "—"}
            </p>
            <p>
              <strong>Team:</strong>{" "}
              {assignable
                ? teamIds
                    .map((id) => assignable.find((u) => u.id === id)?.full_name || id)
                    .join(", ")
                : teamIds.join(", ")}
            </p>
            <p>
              <strong>Planned start:</strong> {startDate || "—"}
            </p>
            <p>
              <strong>Planned end:</strong> {endDate || "—"}
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="pp-field__error" role="alert" style={{ marginTop: "0.75rem" }}>
            {error}
          </p>
        ) : null}

        <div className="pp-row-actions" style={{ marginTop: "1.25rem" }}>
          {step > 0 ? (
            <Button type="button" variant="secondary" onClick={back} disabled={submitting}>
              Back
            </Button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next} disabled={submitting || (step === 0 && !templates)}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={() => void handleCreate()} disabled={submitting}>
              {submitting ? "Creating…" : "Create project"}
            </Button>
          )}
          <Link to="/dashboard/projects" className="pp-btn pp-btn--secondary">
            Cancel
          </Link>
        </div>
      </Card>
    </div>
  );
}
