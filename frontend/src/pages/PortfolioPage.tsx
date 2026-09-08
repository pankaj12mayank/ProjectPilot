import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchPortfolioComparison,
  fetchPortfolioRiskHeatmap,
  fetchPortfolioSummary,
  type HeatmapProject,
  type PortfolioComparison,
  type PortfolioProjectRow,
  type PortfolioSummary,
} from "../api/portfolio";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageLoader } from "../components/PageLoader";
import {
  CHART_AXIS_STROKE,
  CHART_GRID_STROKE,
  CHART_SERIES,
  rechartsTooltipContentStyle,
  rechartsTooltipItemStyle,
  rechartsTooltipLabelStyle,
} from "@/theme";

type Tab = "summary" | "compare" | "heatmap" | "trends";

function fmt(n: number | null | undefined, d = 1): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toFixed(d);
}

function cellBg(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return "hsl(var(--muted) / 0.4)";
  const t = Math.max(0, Math.min(1, Number(v)));
  return `color-mix(in srgb, hsl(var(--rag-green)) ${(1 - t) * 100}%, hsl(var(--rag-red)) ${t * 100}%)`;
}

export default function PortfolioPage() {
  const [searchParams] = useSearchParams();
  const focusProjectId = searchParams.get("project") ?? searchParams.get("projectId") ?? "";

  const [tab, setTab] = useState<Tab>("summary");
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [comparison, setComparison] = useState<PortfolioComparison | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapProject[]>([]);
  const [dims, setDims] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [key, setKey] = useState(0);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFetching(true);
      try {
        setError(null);
        const bust = key;
        const [s, c, h] = await Promise.all([
          fetchPortfolioSummary(bust),
          fetchPortfolioComparison(bust),
          fetchPortfolioRiskHeatmap(bust),
        ]);
        if (cancelled) return;
        setSummary(s);
        setComparison(c);
        setHeatmap(h.projects);
        setDims(h.dimensions);
        setSelectedId((prev) => {
          const fromQuery =
            focusProjectId && c.rows.some((r) => r.project_id === focusProjectId) ? focusProjectId : "";
          if (fromQuery) return fromQuery;
          if (prev && c.rows.some((r) => r.project_id === prev)) return prev;
          return c.rows[0]?.project_id || "";
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load portfolio");
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, focusProjectId]);

  const chartData = useMemo(() => {
    if (!comparison || !selectedId) return [];
    const series = comparison.trends[selectedId] ?? [];
    return series.map((p) => ({
      t: p.captured_at.slice(0, 16).replace("T", " "),
      completion: p.completion_pct == null ? null : Number(p.completion_pct),
      spi: p.spi == null ? null : Number(p.spi),
      risk: p.risk_score == null ? null : Number(p.risk_score),
    }));
  }, [comparison, selectedId]);

  const ragChartData = useMemo(() => {
    if (!summary?.by_rag) return [];
    return Object.entries(summary.by_rag).map(([name, value]) => ({ name, value }));
  }, [summary]);

  if (error && !summary && !comparison) {
    return (
      <Card title="Portfolio">
        <p className="pp-field__error">{error}</p>
        <Link to="/dashboard/projects">Projects</Link>
      </Card>
    );
  }

  if (!summary || !comparison) return <PageLoader />;

  const data = comparison;

  return (
    <div className="pp-grid pp-grid--1 w-full">
      <Card
        title="Portfolio"
        actions={
          <Button
            type="button"
            variant="secondary"
            className="pp-btn--sm"
            disabled={fetching}
            onClick={() => setKey((k) => k + 1)}
          >
            {fetching ? "Refreshing…" : "Refresh"}
          </Button>
        }
      >
        <p className="pp-muted">
          Administrators, PMO, and project managers see every project in scope. Other roles see only projects they own
          or are invited to. Each project keeps its own uploads, snapshots, and history.
        </p>
        {error ? <p className="pp-field__error">{error}</p> : null}
        <div className="pp-log-tabs" style={{ marginTop: "0.75rem" }}>
          {(
            [
              ["summary", "Summary & charts"],
              ["compare", "Comparison"],
              ["heatmap", "Risk heatmap"],
              ["trends", "Historical trends"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`pp-log-tab${tab === id ? " pp-log-tab--active" : ""}`}
              onClick={() => setTab(id as Tab)}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {tab === "summary" ? (
        <>
          <Card title="Portfolio summary">
            <div className="pp-widget-row w-full max-w-none">
              <div className="pp-widget">
                <div className="pp-widget__label">Projects in scope</div>
                <div className="pp-widget__value">{summary.totals.projects}</div>
              </div>
              <div className="pp-widget">
                <div className="pp-widget__label">Avg risk score</div>
                <div className="pp-widget__value">{summary.average_risk_score ?? "—"}</div>
              </div>
            </div>
            <h4 className="pp-chart-title" style={{ marginTop: "1rem" }}>
              RAG distribution
            </h4>
            <div className="pp-chart-box" style={{ height: 260 }}>
              {ragChartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ragChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke={CHART_AXIS_STROKE} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke={CHART_AXIS_STROKE} />
                    <Tooltip
                      contentStyle={rechartsTooltipContentStyle}
                      itemStyle={rechartsTooltipItemStyle}
                      labelStyle={rechartsTooltipLabelStyle}
                    />
                    <Bar dataKey="value" name="Projects" fill={CHART_SERIES[1]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="pp-muted">No RAG data yet — add snapshots or generate reports.</p>
              )}
            </div>
          </Card>
          <Card title="Top risky projects">
            {summary.top_risky_projects.length === 0 ? (
              <p className="pp-muted">No risk scores in latest snapshots.</p>
            ) : (
              <div className="pp-table-wrap">
                <table className="pp-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Project</th>
                      <th>Risk score</th>
                      <th>RAG</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {summary.top_risky_projects.map((r, i) => (
                      <tr key={r.project_id}>
                        <td>{i + 1}</td>
                        <td>
                          <strong>{r.name}</strong>
                        </td>
                        <td>{r.risk_score}</td>
                        <td>{r.rag ?? "—"}</td>
                        <td>
                          <Link to={`/dashboard/projects/${r.project_id}/health`} className="pp-btn pp-btn--secondary pp-btn--sm">
                            Health
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}

      {tab === "compare" ? (
        <Card title="Cross-project comparison">
          {data.rows.length === 0 ? (
            <p className="pp-muted">No projects in scope.</p>
          ) : (
            <div className="pp-table-wrap">
              <table className="pp-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>RAG</th>
                    <th>Completion %</th>
                    <th>SPI</th>
                    <th>CPI</th>
                    <th>Risk</th>
                    <th>Rank risk</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r: PortfolioProjectRow) => (
                    <tr key={r.project_id}>
                      <td>
                        <strong>{r.name}</strong>
                      </td>
                      <td>{r.latest_rag ?? "—"}</td>
                      <td>{fmt(r.latest_completion_pct)}</td>
                      <td>{fmt(r.latest_spi, 3)}</td>
                      <td>{fmt(r.latest_cpi, 3)}</td>
                      <td>{r.latest_risk_score ?? "—"}</td>
                      <td>{fmt(r.rank_risk_score, 3)}</td>
                      <td>
                        <div className="pp-row-actions">
                          <Button type="button" variant="secondary" className="pp-btn--sm" onClick={() => setSelectedId(r.project_id)}>
                            Trend
                          </Button>
                          <Link to={`/dashboard/projects/${r.project_id}/history`} className="pp-btn pp-btn--secondary pp-btn--sm">
                            History
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {tab === "heatmap" ? (
        <Card title="Portfolio risk heatmap">
          <p className="pp-muted">Cells are 0 (calm) → 1 (hot). Schedule/cost stress derive from SPI/CPI vs 0.95.</p>
          {!heatmap.length ? (
            <p className="pp-muted">No projects.</p>
          ) : (
            <div className="pp-table-wrap" style={{ overflowX: "auto" }}>
              <table className="pp-table pp-heat-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    {dims.map((d) => (
                      <th key={d}>{d.replace(/_/g, " ")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.map((row) => (
                    <tr key={row.project_id}>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      {dims.map((d) => {
                        const v = row.heatmap[d] as number | null | undefined;
                        return (
                          <td key={d} style={{ background: cellBg(v), minWidth: "4.5rem", textAlign: "center" }}>
                            {fmt(v as number | undefined, 2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {tab === "trends" ? (
        <Card title="Historical trends (per project)">
          <p className="pp-muted">Snapshots from report generation or manual capture on the health page.</p>
          {data.rows.length ? (
            <div className="pp-form" style={{ marginBottom: "1rem" }}>
              <label className="pp-muted" htmlFor="pf-trend">
                Project
              </label>
              <select
                id="pf-trend"
                className="pp-input w-full max-w-none"
                style={{ marginTop: "0.35rem" }}
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {data.rows.map((r) => (
                  <option key={r.project_id} value={r.project_id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {chartData.length ? (
            <div className="pp-chart-box">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                  <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke={CHART_AXIS_STROKE} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke={CHART_AXIS_STROKE} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke={CHART_AXIS_STROKE} />
                  <Tooltip
                    contentStyle={rechartsTooltipContentStyle}
                    itemStyle={rechartsTooltipItemStyle}
                    labelStyle={rechartsTooltipLabelStyle}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="completion"
                    name="Completion %"
                    stroke={CHART_SERIES[0]}
                    dot={{ r: 2 }}
                  />
                  <Line yAxisId="right" type="monotone" dataKey="spi" name="SPI" stroke={CHART_SERIES[2]} dot={{ r: 2 }} />
                  <Line yAxisId="right" type="monotone" dataKey="risk" name="Risk score" stroke={CHART_SERIES[4]} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="pp-muted">No snapshots for the selected project.</p>
          )}
        </Card>
      ) : null}
    </div>
  );
}
