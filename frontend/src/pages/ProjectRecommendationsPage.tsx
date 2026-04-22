import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchProjectIntelligence,
  type ProjectIntelligenceResponse,
  type RecommendationItem,
} from "../api/intelligence";
import { Card } from "../components/ui/Card";
import { PageLoader } from "../components/PageLoader";
import { Button } from "../components/ui/Button";

export default function ProjectRecommendationsPage() {
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
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, key]);

  if (error && !data) {
    return (
      <Card title="Recommendations">
        <p className="pp-field__error">{error}</p>
        <Link to={projectId ? `/dashboard/projects/${projectId}` : "/dashboard/projects"}>Back</Link>
      </Card>
    );
  }

  if (!data) return <PageLoader />;

  const recs = data.recommendations;

  return (
    <div className="pp-grid pp-grid--1">
      <Card
        title={`Recommendations — ${data.project_name}`}
        actions={
          <div className="pp-row-actions">
            <Button type="button" variant="secondary" className="pp-btn--sm" onClick={() => setKey((k) => k + 1)}>
              Refresh
            </Button>
            <Link to={`/dashboard/projects/${projectId}/forecast`} className="pp-btn pp-btn--secondary pp-btn--sm">
              Forecast
            </Link>
            <Link to={`/dashboard/projects/${projectId}/reports`} className="pp-btn pp-btn--secondary pp-btn--sm">
              Reports
            </Link>
          </div>
        }
      >
        {!data.data_complete ? (
          <p className="pp-field__error" role="alert">
            Missing roles: {data.missing_roles.join(", ")} — recommendations may be sparse until data is complete.
          </p>
        ) : (
          <p className="pp-muted">
            Each action lists <strong>metric_refs</strong> (values from your KPIs, EVM, RAID, or forecast) and links to{" "}
            <strong>root_cause_ids</strong> where applicable.
          </p>
        )}
      </Card>

      <div className="pp-grid pp-grid--2">
        <Card title="Prioritized actions">
          <div className="pp-rec-list">
            {recs.map((r: RecommendationItem, i) => (
              <div key={i} className="pp-rec-card">
                <div className="pp-rec-card__head">
                  <span className="pp-rec-priority">P{r.priority}</span>
                  <strong>{r.title}</strong>
                </div>
                <p className="pp-muted">{r.detail}</p>
                <p className="pp-rec-owner">
                  <span className="pp-muted">Owner hint:</span> {r.owner_hint}
                </p>
                {r.metric_refs?.length ? (
                  <div className="pp-rec-evidence">
                    <div className="pp-muted pp-rec-evidence__label">Tied to metrics</div>
                    <ul>
                      {r.metric_refs.map((m, j) => (
                        <li key={j}>
                          <code>{m.metric}</code> = {String(m.value)} <span className="pp-muted">({m.source})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {r.root_cause_ids?.length ? (
                  <p className="pp-muted pp-rec-rc">
                    Root causes:{" "}
                    {r.root_cause_ids.map((id) => (
                      <code key={id}>{id}</code>
                    ))}
                  </p>
                ) : null}
                {r.risk_refs && Object.keys(r.risk_refs).length ? (
                  <details className="pp-rec-risk">
                    <summary>Risk context</summary>
                    <pre className="pp-pre-json">{JSON.stringify(r.risk_refs, null, 2)}</pre>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Root causes (evidence)">
          <ul className="pp-root-cause-list">
            {data.root_causes.map((c, i) => (
              <li key={i} className="pp-root-cause-item">
                <span className={`pp-sev pp-sev--${String(c.severity)}`}>{String(c.severity)}</span>
                <span className="pp-muted">[{String(c.category)}]</span> {String(c.statement)}
                {c.evidence ? <div className="pp-root-evidence">{String(c.evidence)}</div> : null}
              </li>
            ))}
          </ul>
          {data.root_causes.length === 0 ? <p className="pp-muted">No automated root causes fired for this snapshot.</p> : null}
        </Card>
      </div>
    </div>
  );
}
