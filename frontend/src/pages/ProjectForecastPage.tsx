import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchProjectIntelligence, type ProjectIntelligenceResponse } from "../api/intelligence";
import { Card } from "../components/ui/Card";
import { PageLoader } from "../components/PageLoader";
import { Button } from "../components/ui/Button";

function fmt(v: unknown, digits = 2, suffix = ""): string {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return `${n.toFixed(digits)}${suffix}`;
}

export default function ProjectForecastPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [data, setData] = useState<ProjectIntelligenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!projectId) return;
      try {
        setError(null);
        const r = await fetchProjectIntelligence(projectId);
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load forecast");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, key]);

  if (error && !data) {
    return (
      <Card title="Forecast">
        <p className="pp-field__error">{error}</p>
        <Link to={projectId ? `/dashboard/projects/${projectId}` : "/dashboard/projects"}>Back</Link>
      </Card>
    );
  }

  if (!data) return <PageLoader />;

  const fc = data.forecast as Record<string, unknown>;
  const cd = (fc.completion_date as Record<string, unknown>) || {};
  const bo = (fc.budget_overrun as Record<string, unknown>) || {};
  const re = (fc.risk_escalation as Record<string, unknown>) || {};
  const ro = (fc.resource_overload as Record<string, unknown>) || {};
  const drivers = (fc.drivers as string[]) || [];

  return (
    <div className="pp-grid pp-grid--1">
      <Card
        title={`Forecast — ${data.project_name}`}
        actions={
          <div className="pp-row-actions">
            <Button type="button" variant="secondary" className="pp-btn--sm" onClick={() => setKey((k) => k + 1)}>
              Refresh
            </Button>
            <Link to={`/dashboard/projects/${projectId}/recommendations`} className="pp-btn pp-btn--secondary pp-btn--sm">
              Recommendations
            </Link>
            <Link to={`/dashboard/projects/${projectId}/reports`} className="pp-btn pp-btn--secondary pp-btn--sm">
              Download reports
            </Link>
            <Link to={`/dashboard/projects/${projectId}`} className="pp-btn pp-btn--secondary pp-btn--sm">
              Project
            </Link>
          </div>
        }
      >
        {error ? <p className="pp-field__error">{error}</p> : null}
        {!data.data_complete ? (
          <p className="pp-field__error" role="alert">
            Incomplete data: <strong>{data.missing_roles.join(", ")}</strong>. Forecast still uses whatever is on
            file; upload all roles for full accuracy.
          </p>
        ) : (
          <p className="pp-muted">All inputs are computed from validated ingested rows for this project.</p>
        )}
        <p style={{ fontSize: "1.05rem", margin: "0.5rem 0" }}>
          <strong>Summary:</strong> {String(fc.headline || "—")}
        </p>
        <p className="pp-muted">Confidence: {String(fc.confidence || "—")}</p>
      </Card>

      <div className="pp-grid pp-grid--2">
        <Card title="Completion date outlook">
          <ul className="pp-metric-list">
            <li>
              As-of week label: <strong>{String(cd.as_of_week_label || "—")}</strong>
            </li>
            <li>
              Anchor date: <strong>{String(cd.anchor_date_iso || "—")}</strong>
            </li>
            <li>
              Current completion %: <strong>{fmt(cd.current_completion_pct, 1, "%")}</strong>
            </li>
            <li>
              Trend (pts/week): <strong>{fmt(cd.trend_pct_per_week, 4)}</strong>
            </li>
            <li>
              Weeks to 100% (trend): <strong>{fmt(cd.weeks_to_100_at_trend, 2)}</strong>
            </li>
            <li>
              Projected 100% date: <strong>{String(cd.projected_100pct_date_iso || "—")}</strong>
            </li>
          </ul>
          <p className="pp-muted" style={{ marginTop: "0.75rem" }}>
            {String(cd.headline || "")}
          </p>
          {(cd.notes as string[] | undefined)?.length ? (
            <ul className="pp-muted" style={{ marginTop: "0.5rem" }}>
              {(cd.notes as string[]).map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card title="Budget overrun outlook">
          <ul className="pp-metric-list">
            <li>
              CPI: <strong>{fmt(bo.cpi, 3)}</strong>
            </li>
            <li>
              Cost variance (Σ): <strong>{fmt(bo.cost_variance_sum, 0)}</strong>
            </li>
            <li>
              Predicted overrun hint (currency sum): <strong>{fmt(bo.predicted_overrun_currency_hint, 0)}</strong>
            </li>
            <li>
              At risk: <strong>{bo.at_risk ? "Yes" : "No"}</strong>
            </li>
          </ul>
          <p className="pp-muted" style={{ marginTop: "0.75rem" }}>
            {String(bo.headline || "")}
          </p>
        </Card>

        <Card title="Risk escalation">
          <ul className="pp-metric-list">
            <li>
              Risk score: <strong>{fmt(re.risk_score, 0)}</strong>
            </li>
            <li>
              Open high severity: <strong>{fmt(re.high_severity_open_count, 0)}</strong>
            </li>
            <li>
              Open risks: <strong>{fmt(re.open_risk_count, 0)}</strong>
            </li>
            <li>
              Level: <strong>{String(re.escalation_level || "—")}</strong>
            </li>
          </ul>
          <p className="pp-muted" style={{ marginTop: "0.75rem" }}>
            {String(re.headline || "")}
          </p>
          {re.evidence ? <p className="pp-muted pp-risk-snippets">{String(re.evidence)}</p> : null}
        </Card>

        <Card title="Resource overload">
          <ul className="pp-metric-list">
            <li>
              Utilization (actual/planned): <strong>{fmt(ro.utilization_ratio, 3)}</strong>
            </li>
            <li>
              Hour variance (Σ): <strong>{fmt(ro.variance_hours, 1)}</strong>
            </li>
            <li>
              Tasks &gt;110% of plan: <strong>{fmt(ro.overload_task_count, 0)}</strong>
            </li>
            <li>
              At risk: <strong>{ro.at_risk ? "Yes" : "No"}</strong>
            </li>
          </ul>
          <p className="pp-muted" style={{ marginTop: "0.75rem" }}>
            {String(ro.headline || "")}
          </p>
          {Array.isArray(ro.top_overloaded_tasks) && (ro.top_overloaded_tasks as object[]).length ? (
            <div className="pp-table-wrap" style={{ marginTop: "0.75rem" }}>
              <table className="pp-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Planned h</th>
                    <th>Actual h</th>
                    <th>Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {(ro.top_overloaded_tasks as Array<Record<string, unknown>>).map((t, i) => (
                    <tr key={i}>
                      <td>{String(t.task)}</td>
                      <td>{fmt(t.planned_hours, 1)}</td>
                      <td>{fmt(t.actual_hours, 1)}</td>
                      <td>{fmt(t.ratio, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      </div>

      <Card title="Schedule / cost indices & drivers">
        <ul className="pp-metric-list">
          <li>
            SPI at risk (&lt;0.95): <strong>{fc.schedule_at_risk ? "Yes" : "No"}</strong>
          </li>
          <li>
            CPI at risk (&lt;0.95): <strong>{fc.cost_at_risk ? "Yes" : "No"}</strong>
          </li>
          <li>
            Predicted effort overrun (h): <strong>{fmt(fc.predicted_overrun_hours, 1)}</strong>
          </li>
        </ul>
        {drivers.length ? (
          <ul className="pp-muted" style={{ marginTop: "0.75rem" }}>
            {drivers.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
