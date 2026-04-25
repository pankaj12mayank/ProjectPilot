import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchProjectHealth, type ProjectHealthResponse } from "../api/analytics";
import {
  downloadProjectMetricsSnapshot,
  fetchProjectMetricsSnapshots,
  previewProjectMetricsSnapshot,
  recordProjectMetricsSnapshot,
  type MetricsSnapshotListItem,
} from "../api/projects";
import { useToast } from "../components/ToastProvider";
import { friendlyErrorMessage } from "@/lib/friendlyMessages";
import { KpiCard } from "../components/KpiCard";
import { Card } from "../components/ui/Card";
import { PageLoader } from "../components/PageLoader";
import { Table } from "../components/ui/Table";
import { Button } from "@/components/shadcn/button";
import {
  CHART_AXIS_STROKE,
  CHART_GRID_STROKE,
  CHART_SERIES,
  rechartsTooltipContentStyle,
  rechartsTooltipItemStyle,
  rechartsTooltipLabelStyle,
} from "@/theme";

const tooltipBox = rechartsTooltipContentStyle;

function fmt(n: number | null | undefined, digits = 1, suffix = ""): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${Number(n).toFixed(digits)}${suffix}`;
}

function fmtInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return String(Math.round(Number(n)));
}

function RagStrip({ status }: { status: string }) {
  const active = status.toLowerCase();
  return (
    <div className="pp-rag-strip" aria-label={`RAG ${status}`}>
      <span className={`pp-rag-dot pp-rag-dot--red${active === "red" ? " pp-rag-dot--on" : ""}`} title="Red" />
      <span className={`pp-rag-dot pp-rag-dot--amber${active === "amber" ? " pp-rag-dot--on" : ""}`} title="Amber" />
      <span className={`pp-rag-dot pp-rag-dot--green${active === "green" ? " pp-rag-dot--on" : ""}`} title="Green" />
    </div>
  );
}

function RagBanner({ rag }: { rag: ProjectHealthResponse["rag"] }) {
  const reasons = rag.reasons ?? [];
  const sv = rag.inputs?.schedule_variance_sum_pct_points;
  const svText = Number.isFinite(sv) ? Number(sv).toFixed(1) : "—";
  const cls =
    rag.status === "Red" ? "pp-rag pp-rag--red" : rag.status === "Amber" ? "pp-rag pp-rag--amber" : "pp-rag pp-rag--green";
  return (
    <div className={`${cls} w-full max-w-none`}>
      <div className="pp-rag__head">
        <RagStrip status={rag.status} />
        <div className="pp-rag__status">RAG: {rag.status}</div>
      </div>
      <ul className="pp-rag__reasons">
        {reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
      <p className="pp-rag__meta">
        Risk score <strong>{fmtInt(rag.inputs?.risk_score)}</strong> · Schedule variance sum{" "}
        <strong>{svText}</strong> (percentage points)
      </p>
    </div>
  );
}

function sourceLabel(source: string): string {
  if (source === "manual_refresh") return "Manual";
  if (source === "report_package") return "Report run";
  return source;
}

export default function ProjectHealthPage() {
  const toast = useToast();
  const { projectId } = useParams<{ projectId: string }>();
  const [data, setData] = useState<ProjectHealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [healthBusy, setHealthBusy] = useState(false);
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [snapshots, setSnapshots] = useState<MetricsSnapshotListItem[] | null>(null);
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null);
  const [snapshotListNonce, setSnapshotListNonce] = useState(0);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      setHealthBusy(true);
      try {
        setError(null);
        const h = await fetchProjectHealth(projectId, refreshKey);
        if (!cancelled) setData(h);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load analytics");
      } finally {
        if (!cancelled) setHealthBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setSnapshotsError(null);
    (async () => {
      try {
        const rows = await fetchProjectMetricsSnapshots(projectId, 40, `${refreshKey}-${snapshotListNonce}`);
        if (!cancelled) setSnapshots(rows);
      } catch (e) {
        if (!cancelled) {
          const msg = friendlyErrorMessage(e, "Could not load snapshot history.");
          setSnapshotsError(msg);
          setSnapshots([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey, snapshotListNonce]);

  const weeklyData = useMemo(() => {
    if (!data?.charts.weekly_completion?.length) return [];
    return data.charts.weekly_completion
      .filter((d) => d.completion != null && Number.isFinite(Number(d.completion)))
      .map((d) => ({ week: d.week || "—", completion: Number(d.completion) }));
  }, [data]);

  const spiCpiData = useMemo(() => {
    if (!data) return [];
    const spi = Number.isFinite(data.charts.spi_cpi?.spi) ? Number(data.charts.spi_cpi.spi) : 0;
    const cpi = Number.isFinite(data.charts.spi_cpi?.cpi) ? Number(data.charts.spi_cpi.cpi) : 0;
    return [
      { name: "SPI", value: Number(spi.toFixed(3)) },
      { name: "CPI", value: Number(cpi.toFixed(3)) },
    ];
  }, [data]);

  const severityData = useMemo(() => {
    const raw = data?.charts.severity_distribution ?? [];
    if (raw.length) return raw;
    return [{ name: "No data", value: 1 }];
  }, [data]);

  const resourceData = useMemo(() => {
    const rh = data?.charts.resource_hours;
    if (!rh?.labels?.length) return [];
    return rh.labels.map((label, i) => ({
      task: label,
      planned: Number(rh.planned[i]) || 0,
      actual: Number(rh.actual[i]) || 0,
    }));
  }, [data]);

  const gaugeVal = useMemo(() => {
    const v = data?.charts.completion_gauge?.value;
    if (v == null || !Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, v));
  }, [data]);

  async function handleRecordSnapshot() {
    if (!projectId) return;
    setSnapshotMsg(null);
    setSnapshotBusy(true);
    try {
      await recordProjectMetricsSnapshot(projectId);
      setSnapshotMsg("Snapshot saved. You can download it from the history below, or open Reports for PDFs and other files.");
      toast.push("success", "Metrics snapshot saved. It appears in the history below.");
      setSnapshotListNonce((n) => n + 1);
    } catch (e) {
      const msg = friendlyErrorMessage(e, "Snapshot could not be saved.");
      setSnapshotMsg(msg);
      toast.push("error", msg);
    } finally {
      setSnapshotBusy(false);
    }
  }

  if (error && !data) {
    return (
      <Card title="Project health">
        <p className="pp-field__error">{error}</p>
        <Link to={projectId ? `/dashboard/projects/${projectId}` : "/dashboard/projects"}>Back to project</Link>
      </Card>
    );
  }

  if (!data) return <PageLoader />;

  const { kpis, evm, risk, milestones, resources, dependencies } = data;

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <div className="pp-grid pp-grid--1 w-full">
      <Card
        className="w-full"
        title="Project health summary"
        actions={
          <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-2 lg:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={healthBusy}
              onClick={() => setRefreshKey((k) => k + 1)}
            >
              {healthBusy ? "Refreshing…" : "Refresh metrics"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={snapshotBusy || healthBusy}
              onClick={() => void handleRecordSnapshot()}
            >
              {snapshotBusy ? "Saving…" : "Record portfolio snapshot"}
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to="/dashboard/portfolio">Portfolio</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to={`/dashboard/projects/${projectId}/forecast`}>Forecast</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to={`/dashboard/projects/${projectId}/recommendations`}>Recommendations</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to={`/dashboard/projects/${projectId}/reports`}>Reports</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to={`/dashboard/projects/${projectId}/upload`}>Upload data</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to={`/dashboard/projects/${projectId}`}>Project details</Link>
            </Button>
          </div>
        }
      >
        {error ? (
          <p className="pp-field__error" role="alert">
            {error}
          </p>
        ) : null}
        {snapshotMsg ? (
          <p className={snapshotMsg.includes("failed") || snapshotMsg.includes("Error") ? "pp-field__error" : "pp-success"}>
            {snapshotMsg}
          </p>
        ) : null}
        {!data.data_complete ? (
          <p className="pp-field__error" role="alert">
            Missing ingested data for: <strong>{data.missing_roles.join(", ")}</strong>. Upload and validate all three
            files so every metric is derived from your spreadsheets.
          </p>
        ) : null}
        <p className="pp-muted">All figures below are computed from validated rows stored after upload — nothing is manual.</p>
        <RagBanner rag={data.rag} />
      </Card>

      <Card className="w-full border-primary/25 bg-gradient-to-br from-card to-muted/25 shadow-md" title="Snapshot history">
        <div
          className="mb-4 rounded-md border border-border/80 bg-muted/35 px-4 py-3 text-sm text-foreground backdrop-blur-sm dark:bg-muted/25"
          role="note"
        >
          <strong className="font-semibold">For your records:</strong> each snapshot is a point-in-time copy of the
          metrics on this page. Use <strong>Download now</strong> to save the JSON to your computer, or{" "}
          <strong>View</strong> to open a read-only preview. For PDFs, Word, PowerPoint, and other report files, open the
          linked report run on the Reports page—everything is delivered through the app, not via server folders.
        </div>
        <p className="pp-muted" style={{ marginTop: 0 }}>
          After you use <strong>Record portfolio snapshot</strong>, new rows appear here right away.
        </p>
        {snapshotsError ? (
          <p className="pp-field__error" role="alert">
            {snapshotsError}
          </p>
        ) : null}
        {snapshots === null ? (
          <p className="pp-muted">Loading history…</p>
        ) : snapshots.length === 0 ? (
          <p className="pp-muted">No snapshots yet. Use &quot;Record portfolio snapshot&quot; above after you have ingested data.</p>
        ) : (
          <div className="pp-table-wrap" style={{ marginTop: "0.75rem" }}>
            <table className="pp-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Report files</th>
                  <th>Snapshot</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.snapshot_id}>
                    <td>{new Date(s.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td>{sourceLabel(s.source)}</td>
                    <td>
                      {s.report_run_id ? (
                        <Link
                          className="font-medium text-primary underline-offset-4 hover:underline"
                          to={`/dashboard/projects/${projectId}/reports?jobId=${encodeURIComponent(s.report_run_id)}`}
                        >
                          Download report files
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td>
                      <code className="text-xs">{s.snapshot_id.slice(0, 8)}…</code>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="rounded-xl"
                          onClick={() =>
                            void (async () => {
                              try {
                                await downloadProjectMetricsSnapshot(projectId, s.snapshot_id);
                                toast.push("success", "Download started.");
                              } catch (e) {
                                toast.push("error", friendlyErrorMessage(e, "Download failed."));
                              }
                            })()
                          }
                        >
                          Download now
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() =>
                            void (async () => {
                              try {
                                await previewProjectMetricsSnapshot(projectId, s.snapshot_id);
                              } catch (e) {
                                toast.push("error", friendlyErrorMessage(e, "Could not open preview."));
                              }
                            })()
                          }
                        >
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Key performance indicators">
        <div className="pp-kpi-grid">
          <KpiCard label="Completion %" value={fmt(kpis.completion_pct as number | undefined, 1, "%")} hint="Mean actual % across tasks" />
          <KpiCard label="Schedule variance (Σ)" value={fmt(kpis.schedule_variance_sum as number | undefined, 1)} hint="Σ (Actual% − Planned%), points" />
          <KpiCard label="Effort variance (Σ h)" value={fmt(kpis.effort_variance_sum as number | undefined, 1)} hint="Σ (Actual − Planned hours)" />
          <KpiCard label="Cost variance (Σ)" value={fmt(kpis.cost_variance_sum as number | undefined, 0)} hint="Σ (Actual cost − Planned budget)" />
          <KpiCard label="SPI" value={fmt(evm.spi as number | undefined, 3)} hint="Earned value schedule index" />
          <KpiCard label="CPI" value={fmt(evm.cpi as number | undefined, 3)} hint="Earned value cost index" />
          <KpiCard label="EVM cost variance (EV−AC)" value={fmt(evm.cost_variance as number | undefined, 1)} hint="Aggregate earned value cost variance" />
          <KpiCard label="High-risk count" value={fmtInt(risk.high_risk_count ?? risk.risk_score)} hint="Open high / high severity (governance)" />
        </div>
      </Card>

      <div className="pp-grid pp-grid--2">
        <Card title="Milestone widgets">
          <div className="pp-widget-row">
            <div className="pp-widget">
              <div className="pp-widget__label">Delayed milestones</div>
              <div className="pp-widget__value">{fmtInt(milestones.delayed_milestone_count ?? milestones.late_count)}</div>
            </div>
            <div className="pp-widget">
              <div className="pp-widget__label">Avg slip (pts)</div>
              <div className="pp-widget__value">{fmt(milestones.avg_delay_pct_points as number | undefined, 1)}</div>
            </div>
            <div className="pp-widget">
              <div className="pp-widget__label">Max slip (pts)</div>
              <div className="pp-widget__value">{fmt(milestones.max_delay_pct_points as number | undefined, 1)}</div>
            </div>
          </div>
          <p className="pp-muted" style={{ marginTop: "0.75rem" }}>
            On track: {fmtInt(milestones.on_track_count)} · Ahead: {fmtInt(milestones.ahead_count)}
          </p>
        </Card>
        <Card title="Resource widgets">
          <div className="pp-widget-row">
            <div className="pp-widget">
              <div className="pp-widget__label">Utilization</div>
              <div className="pp-widget__value">{fmt(resources.utilization_ratio as number | undefined, 3)}</div>
              <div className="pp-widget__hint">Actual ÷ planned hours</div>
            </div>
            <div className="pp-widget">
              <div className="pp-widget__label">Hour variance</div>
              <div className="pp-widget__value">{fmt(resources.variance_hours as number | undefined, 1)}</div>
              <div className="pp-widget__hint">Σ actual − planned</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="pp-grid pp-grid--2">
        <Card title="EVM detail">
          <ul className="pp-metric-list">
            <li>
              BAC / PV / EV / AC:{" "}
              <strong>
                {fmt(evm.bac as number | undefined, 0)} / {fmt(evm.pv as number | undefined, 0)} /{" "}
                {fmt(evm.ev as number | undefined, 0)} / {fmt(evm.ac as number | undefined, 0)}
              </strong>
            </li>
            <li>
              SV / CV:{" "}
              <strong>
                {fmt(evm.sv as number | undefined, 1)} / {fmt(evm.cv as number | undefined, 1)}
              </strong>
            </li>
            <li>
              VAC / TCPI:{" "}
              <strong>
                {fmt(evm.vac as number | undefined, 0)} / {fmt(evm.tcpi as number | undefined, 3)}
              </strong>
            </li>
          </ul>
        </Card>
        <Card title="Task KPIs">
          <ul className="pp-metric-list">
            <li>
              On track / at risk / ahead:{" "}
              <strong>
                {fmtInt(kpis.tasks_on_track)} / {fmtInt(kpis.tasks_at_risk)} / {fmtInt(kpis.tasks_ahead)}
              </strong>
            </li>
            <li>
              Last weekly completion: <strong>{fmt(kpis.last_reported_completion as number | undefined, 1, "%")}</strong>
            </li>
            <li>
              Weekly trend (avg Δ): <strong>{fmt(kpis.weekly_trend_slope as number | undefined, 2)}</strong>
            </li>
          </ul>
        </Card>
      </div>

      <Card title="Trend & distribution charts">
        <div key={`charts-${refreshKey}`} className="pp-chart-grid">
          <div className="pp-chart-cell">
            <h4 className="pp-chart-title">Weekly completion %</h4>
            <div className="pp-chart-box">
              {weeklyData.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={weeklyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke={CHART_AXIS_STROKE} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke={CHART_AXIS_STROKE} />
                    <Tooltip
                      contentStyle={tooltipBox}
                      itemStyle={rechartsTooltipItemStyle}
                      labelStyle={rechartsTooltipLabelStyle}
                    />
                    <Line
                      type="monotone"
                      dataKey="completion"
                      name="Completion %"
                      stroke={CHART_SERIES[0]}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="pp-muted">No weekly history series.</p>
              )}
            </div>
          </div>
          <div className="pp-chart-cell">
            <h4 className="pp-chart-title">SPI &amp; CPI</h4>
            <div className="pp-chart-box">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={spiCpiData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke={CHART_AXIS_STROKE} />
                  <YAxis domain={[0, "auto"]} tick={{ fontSize: 11 }} stroke={CHART_AXIS_STROKE} />
                  <Tooltip
                    contentStyle={tooltipBox}
                    itemStyle={rechartsTooltipItemStyle}
                    labelStyle={rechartsTooltipLabelStyle}
                  />
                  <Bar dataKey="value" fill={CHART_SERIES[0]} name="Index" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="pp-chart-cell">
            <h4 className="pp-chart-title">RAID by severity</h4>
            <div className="pp-chart-box">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} label>
                    {severityData.map((_, i) => (
                      <Cell key={String(i)} fill={CHART_SERIES[i % CHART_SERIES.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipBox}
                    itemStyle={rechartsTooltipItemStyle}
                    labelStyle={rechartsTooltipLabelStyle}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="pp-chart-cell">
            <h4 className="pp-chart-title">Planned vs actual hours</h4>
            <div className="pp-chart-box">
              {resourceData.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={resourceData} margin={{ top: 8, right: 8, left: 0, bottom: 64 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                    <XAxis
                      dataKey="task"
                      interval={0}
                      angle={-28}
                      textAnchor="end"
                      height={70}
                      tick={{ fontSize: 10 }}
                      stroke={CHART_AXIS_STROKE}
                    />
                    <YAxis tick={{ fontSize: 11 }} stroke={CHART_AXIS_STROKE} />
                    <Tooltip
                      contentStyle={tooltipBox}
                      itemStyle={rechartsTooltipItemStyle}
                      labelStyle={rechartsTooltipLabelStyle}
                    />
                    <Legend />
                    <Bar dataKey="planned" fill="hsl(var(--muted-foreground) / 0.45)" name="Planned h" />
                    <Bar dataKey="actual" fill={CHART_SERIES[0]} name="Actual h" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="pp-muted">No resource variance rows.</p>
              )}
            </div>
          </div>
          <div className="pp-chart-cell">
            <h4 className="pp-chart-title">Overall completion %</h4>
            <div className="pp-chart-box">
              <ResponsiveContainer width="100%" height={120}>
                <BarChart
                  data={[{ name: "Completion", v: gaugeVal }]}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 80, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke={CHART_AXIS_STROKE} />
                  <YAxis type="category" dataKey="name" width={76} tick={{ fontSize: 12 }} stroke={CHART_AXIS_STROKE} />
                  <Tooltip
                    formatter={(v: number) => [`${Number(v).toFixed(1)}%`, ""]}
                    contentStyle={tooltipBox}
                    itemStyle={rechartsTooltipItemStyle}
                    labelStyle={rechartsTooltipLabelStyle}
                  />
                  <Bar dataKey="v" fill="hsl(var(--success))" radius={[0, 6, 6, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Card>

      <div className="pp-grid pp-grid--2">
        <Card title="Risk tables">
          <p className="pp-muted">
            Items: {fmtInt(risk.total_items)} · Open high-severity: {fmtInt(risk.high_severity_open_count)} · Open risks:{" "}
            {fmtInt(risk.open_risk_count)} · Governance high score: {fmtInt(risk.high_risk_count ?? risk.risk_score)}
          </p>
          <h4 className="pp-chart-title">By severity</h4>
          <Table
            columns={[
              { key: "k", header: "Severity" },
              { key: "v", header: "Count" },
            ]}
            rows={Object.entries(risk.by_severity ?? {}).map(([k, v]) => ({ k, v: String(v) }))}
            rowKey={(r) => r.k}
          />
          <h4 className="pp-chart-title" style={{ marginTop: "1rem" }}>
            By type
          </h4>
          <Table
            columns={[
              { key: "k", header: "Type" },
              { key: "v", header: "Count" },
            ]}
            rows={Object.entries(risk.by_type ?? {}).map(([k, v]) => ({ k, v: String(v) }))}
            rowKey={(r) => r.k}
          />
          {risk.open_high_risks?.length ? (
            <>
              <p className="pp-muted" style={{ marginTop: "0.75rem" }}>
                Open + high severity (risk)
              </p>
              <ul className="pp-risk-snippets">
                {risk.open_high_risks.map((o, i) => (
                  <li key={i}>{o.summary}</li>
                ))}
              </ul>
            </>
          ) : null}
        </Card>
        <Card title="Milestones (tasks)">
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Planned %</th>
                  <th>Actual %</th>
                  <th>Δ</th>
                  <th>Slip</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {milestones.milestones.slice(0, 15).map((m, i) => (
                  <tr key={i}>
                    <td>{m.name}</td>
                    <td>{fmt(m.planned_pct ?? undefined, 1)}</td>
                    <td>{fmt(m.actual_pct ?? undefined, 1)}</td>
                    <td>{fmt(m.variance_pct ?? undefined, 1)}</td>
                    <td>{fmt(m.delay_pct_points ?? undefined, 1)}</td>
                    <td>{m.state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="pp-grid pp-grid--2">
        <Card title="Resources">
          <ul className="pp-metric-list">
            <li>
              Planned hours (Σ): <strong>{fmt(resources.total_planned_hours ?? undefined, 1)}</strong>
            </li>
            <li>
              Actual hours (Σ): <strong>{fmt(resources.total_actual_hours ?? undefined, 1)}</strong>
            </li>
            <li>
              Variance (h): <strong>{fmt(resources.variance_hours ?? undefined, 1)}</strong>
            </li>
          </ul>
        </Card>
        <Card title="Dependencies &amp; slip">
          <p className="pp-muted">{dependencies.note}</p>
          {dependencies.edge_delays?.length ? (
            <div className="pp-table-wrap">
              <table className="pp-table">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th>Successor slip (pts)</th>
                  </tr>
                </thead>
                <tbody>
                  {dependencies.edge_delays.map((ed, i) => (
                    <tr key={i}>
                      <td>
                        <code>{ed.from_label}</code>
                      </td>
                      <td>
                        <code>{ed.to_label}</code>
                      </td>
                      <td>{ed.successor_slip_pct == null ? "—" : fmt(ed.successor_slip_pct, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="pp-muted" style={{ marginTop: "0.5rem" }}>
                Total slip across links: {fmt(dependencies.total_dependency_slip_pct ?? undefined, 1)} pts
              </p>
            </div>
          ) : dependencies.edges.length ? (
            <ul className="pp-deps-list">
              {dependencies.edges.map((e, i) => {
                const a = dependencies.nodes.find((n) => n.id === e.from)?.label ?? e.from;
                const b = dependencies.nodes.find((n) => n.id === e.to)?.label ?? e.to;
                return (
                  <li key={i}>
                    <code>{a}</code> → <code>{b}</code>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="pp-muted">No inferred chain.</p>
          )}
        </Card>
      </div>
      </div>
    </div>
  );
}
