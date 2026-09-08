import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  downloadProjectSampleCsv,
  fetchFormatGuide,
  fetchProject,
  uploadProjectAnalyze,
  type AnalyzeUploadResponse,
  type FileAnalyzeSlot,
  type FileSlotError,
  type FormatGuideOut,
  type ProjectOut,
} from "../api/projects";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { PageLoader } from "../components/PageLoader";
import { useToast } from "../components/ToastProvider";
import { friendlyErrorMessage } from "@/lib/friendlyMessages";

const SLOTS: { role: "status_tracker" | "raid_log" | "weekly_history"; title: string; hint: string }[] = [
  {
    role: "status_tracker",
    title: "Status tracker",
    hint: "Planned vs actual %, hours, and budget columns (CSV or Excel).",
  },
  {
    role: "raid_log",
    title: "RAID log",
    hint: "Rows with type, severity, and status for risks and issues.",
  },
  {
    role: "weekly_history",
    title: "Weekly history",
    hint: "Week labels and completion percentage (0–100).",
  },
];

const ACCEPT = ".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";
const ALLOWED_EXT = [".csv", ".xlsx", ".xls"];

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function isAllowedFile(f: File): boolean {
  const name = f.name.toLowerCase();
  return ALLOWED_EXT.some((ext) => name.endsWith(ext));
}

function slotTitle(role: string): string {
  return SLOTS.find((s) => s.role === role)?.title ?? role;
}

/** Preview row index 0 = first data row → matches API `row` value 1 when rows are 1-based data rows. */
function previewRowMatchesApiRow(previewRowIndex: number, apiRow: number | null): boolean {
  if (apiRow == null) return false;
  return previewRowIndex + 1 === apiRow;
}

function splitColumns(col: string | null): string[] {
  if (!col) return [];
  return col
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function ValidationErrorsTable({ errors }: { errors: FileSlotError[] }) {
  if (!errors.length) return null;
  return (
    <div className="pp-table-wrap pp-validation-table-wrap">
      <table className="pp-table pp-validation-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Message</th>
            <th>Row</th>
            <th>Column</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((e, i) => (
            <tr key={`${e.code}-${i}-${e.message}`} className="pp-validation-table__row--err">
              <td>
                <code>{e.code}</code>
              </td>
              <td>{e.message}</td>
              <td>{e.row ?? "—"}</td>
              <td>{e.column ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PreviewTableWithErrors({ slot }: { slot: FileAnalyzeSlot }) {
  if (!slot.preview_columns.length) return <p className="pp-muted">No preview rows.</p>;

  const rowHasError = (previewIdx: number) =>
    slot.errors.some((e) => e.row != null && previewRowMatchesApiRow(previewIdx, e.row));

  function cellHighlight(previewIdx: number, col: string): boolean {
    for (const e of slot.errors) {
      if (!previewRowMatchesApiRow(previewIdx, e.row)) continue;
      const cols = splitColumns(e.column);
      if (!cols.length) return true;
      if (cols.includes(col)) return true;
    }
    return false;
  }

  return (
    <div className="pp-table-wrap">
      <table className="pp-table pp-preview-table">
        <thead>
          <tr>
            <th className="pp-preview-table__idx">#</th>
            {slot.preview_columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slot.preview_rows.map((r, ri) => (
            <tr key={String(ri)} className={rowHasError(ri) ? "pp-preview-row--err" : undefined}>
              <td className="pp-preview-table__idx pp-muted">{ri + 1}</td>
              {slot.preview_columns.map((c, ci) => {
                const v = r[ci];
                return (
                  <td key={c} className={cellHighlight(ri, c) ? "pp-preview-cell--err" : undefined}>
                    {v === null || v === undefined || v === "" ? "—" : String(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FormatGuideSlotPanel({
  role,
  title,
  guide,
  busy,
  onDownloadSample,
}: {
  role: string;
  title: string;
  guide: FormatGuideOut | null;
  busy: boolean;
  onDownloadSample: (role: string) => void;
}) {
  const slot = guide?.slots.find((s) => s.role === role);
  return (
    <div className="pp-format-slot">
      <div className="pp-format-slot__head">
        <h3 className="pp-format-slot__title">{title}</h3>
        <button
          type="button"
          className="pp-btn pp-btn--secondary pp-btn--sm"
          disabled={busy}
          onClick={() => onDownloadSample(role)}
        >
          Download sample CSV
        </button>
      </div>
      {slot ? (
        <>
          <p className="pp-muted pp-format-slot__lead">Expected column names (your file can use close synonyms; we map them automatically).</p>
          <ul className="pp-format-slot__cols">
            {slot.columns.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
          {slot.preview_rows.length ? (
            <div className="pp-table-wrap pp-format-slot__mini">
              <table className="pp-table">
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
          ) : null}
        </>
      ) : (
        <p className="pp-muted">Format preview is loading…</p>
      )}
    </div>
  );
}

function UploadSlot({
  title,
  hint,
  file,
  onFile,
  disabled,
}: {
  title: string;
  hint: string;
  file: File | null;
  onFile: (f: File | null) => void;
  disabled: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      if (disabled) return;
      const f = e.dataTransfer.files?.[0];
      if (f) onFile(f);
    },
    [disabled, onFile],
  );

  return (
    <div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        className="pp-sr-only"
        disabled={disabled}
        onChange={(ev) => {
          const f = ev.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <div
        role="button"
        tabIndex={0}
        className={`pp-upload-zone${drag ? " pp-upload-zone--active" : ""}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(ev) => {
          if (disabled) return;
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
      >
        <p className="pp-upload-zone__title">{title}</p>
        <p className="pp-upload-zone__hint">{hint}</p>
        <p className="pp-upload-zone__hint">Drag and drop here, or click to choose a file.</p>
        {file ? (
          <div className="pp-upload-zone__file">
            <strong>{file.name}</strong> ({Math.round(file.size / 1024)} KB)
            <div className="pp-row-actions" style={{ marginTop: "0.5rem", justifyContent: "center" }}>
              <button
                type="button"
                className="pp-btn pp-btn--secondary pp-btn--sm"
                disabled={disabled}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ProjectUploadPage() {
  const toast = useToast();
  const { projectId } = useParams<{ projectId: string }>();
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const [project, setProject] = useState<ProjectOut | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formatGuide, setFormatGuide] = useState<FormatGuideOut | null>(null);
  const [formatTab, setFormatTab] = useState<(typeof SLOTS)[number]["role"]>("status_tracker");
  const [files, setFiles] = useState<Record<string, File | null>>({
    status_tracker: null,
    raid_log: null,
    weekly_history: null,
  });
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeUploadResponse | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setPageError(null);
    (async () => {
      try {
        const p = await fetchProject(projectId);
        if (!cancelled) setProject(p);
      } catch (e) {
        if (!cancelled) {
          const msg = friendlyErrorMessage(e, "We could not load this project.");
          setPageError(msg);
          toast.push("error", msg);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const g = await fetchFormatGuide();
        if (!cancelled) setFormatGuide(g);
      } catch (e) {
        if (!cancelled) {
          const msg = friendlyErrorMessage(e, "We could not load the sample format guide.");
          toast.push("error", msg);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const setSlot = useCallback(
    (role: string, f: File | null) => {
      if (f && !isAllowedFile(f)) {
        toast.push("error", "That file type is not supported. Use CSV or Excel (.csv, .xlsx, .xls).");
        return;
      }
      setFiles((prev) => ({ ...prev, [role]: f }));
      setResult(null);
    },
    [toast],
  );

  async function handleDownloadSample(role: string) {
    try {
      const blob = await downloadProjectSampleCsv(role);
      triggerBlobDownload(blob, `${role}_sample.csv`);
      toast.push("success", "Sample CSV download started.");
    } catch (e) {
      const msg = friendlyErrorMessage(e, "We could not download that sample file.");
      toast.push("error", msg);
    }
  }

  function scrollToUpload() {
    uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleRetry() {
    setResult(null);
    setError(null);
    scrollToUpload();
  }

  function summarizeUploadResponse(res: AnalyzeUploadResponse): { successLines: string[]; hasFailure: boolean } {
    const successLines: string[] = [];
    let hasFailure = false;
    for (const slot of res.files) {
      if (!slot.filename) continue;
      if (slot.valid) {
        const n = slot.persisted_row_count;
        successLines.push(
          `${slotTitle(slot.role)}: ${n != null ? `${n} row(s) saved to this project.` : "Validated — no blocking issues."}`,
        );
      } else {
        hasFailure = true;
      }
    }
    return { successLines, hasFailure };
  }

  async function handleSubmit() {
    if (!projectId) return;
    const fd = new FormData();
    let any = false;
    SLOTS.forEach(({ role }) => {
      const f = files[role];
      if (f) {
        fd.append(role, f, f.name);
        any = true;
      }
    });
    if (!any) {
      const msg = "Choose at least one file to upload.";
      setError(msg);
      toast.push("error", msg);
      return;
    }
    setError(null);
    setResult(null);
    setBusy(true);
    setProgress(0);
    try {
      const res = await uploadProjectAnalyze(projectId, fd, setProgress);
      setResult(res);
      const { successLines, hasFailure } = summarizeUploadResponse(res);
      if (successLines.length) {
        toast.push("success", successLines.join(" "));
      }
      if (hasFailure) {
        toast.push(
          "info",
          "Some files still have problems. Fix the issues shown below, then upload again — only valid files are saved to the project.",
          8200,
        );
      }
      if (!successLines.length && !hasFailure) {
        toast.push("info", "Validation finished. See details below.");
      }
    } catch (e) {
      const msg = friendlyErrorMessage(e, "We could not upload or validate your files.");
      setError(msg);
      toast.push("error", msg);
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  if (!projectId) {
    return (
      <Card title="Upload">
        <p className="pp-muted">Missing project in the URL.</p>
        <Link to="/dashboard/projects" className="pp-btn pp-btn--secondary pp-btn--sm">
          Back to projects
        </Link>
      </Card>
    );
  }

  if (pageError && !project) {
    return (
      <Card title="Upload data">
        <p className="pp-field__error" role="alert">
          {pageError}
        </p>
        <div className="pp-row-actions" style={{ marginTop: "1rem" }}>
          <Link to="/dashboard/projects" className="pp-btn pp-btn--secondary pp-btn--sm">
            All projects
          </Link>
        </div>
      </Card>
    );
  }

  if (!project) return <PageLoader />;

  return (
    <div className="pp-upload-page">
      <header className="pp-upload-hero">
        <nav className="pp-upload-breadcrumb" aria-label="Breadcrumb">
          <Link to="/dashboard/projects">Projects</Link>
          <span aria-hidden="true"> / </span>
          <Link to={`/dashboard/projects/${encodeURIComponent(project.id)}`}>{project.name}</Link>
          <span aria-hidden="true"> / </span>
          <span className="pp-upload-breadcrumb__here">Upload data</span>
        </nav>
        <p className="pp-upload-hero__sub">
          Files are tied to <strong>{project.name}</strong>
          <span className="pp-muted"> · project id {project.id}</span>
        </p>
        <p className="pp-upload-hero__sub pp-muted">
          Use CSV or Excel (.csv, .xlsx, .xls). You can upload one or more types in a single run; we validate required columns
          and save rows only when a file passes checks.
        </p>
      </header>

      <div className="pp-upload-layout">
        <aside className="pp-upload-aside" aria-label="Expected file formats">
          <Card title="Sample format preview">
            <div className="pp-format-tabs" role="tablist" aria-label="File type">
              {SLOTS.map((s) => (
                <button
                  key={s.role}
                  type="button"
                  role="tab"
                  aria-selected={formatTab === s.role}
                  className={`pp-format-tab${formatTab === s.role ? " pp-format-tab--on" : ""}`}
                  onClick={() => setFormatTab(s.role)}
                >
                  {s.title}
                </button>
              ))}
            </div>
            {SLOTS.filter((s) => s.role === formatTab).map((s) => (
              <FormatGuideSlotPanel
                key={s.role}
                role={s.role}
                title={s.title}
                guide={formatGuide}
                busy={busy}
                onDownloadSample={handleDownloadSample}
              />
            ))}
          </Card>
        </aside>

        <div className="pp-upload-main">
          <div ref={uploadSectionRef}>
            <Card
              title="Your files"
              actions={
                <Link
                  to={`/dashboard/projects/${encodeURIComponent(project.id)}`}
                  className="pp-btn pp-btn--secondary pp-btn--sm"
                >
                  Back to project
                </Link>
              }
            >
              <div className="pp-slot-grid" style={{ marginTop: "0.25rem" }}>
                {SLOTS.map((s) => (
                  <UploadSlot
                    key={s.role}
                    title={s.title}
                    hint={s.hint}
                    file={files[s.role]}
                    disabled={busy}
                    onFile={(f) => setSlot(s.role, f)}
                  />
                ))}
              </div>

              {error ? (
                <p className="pp-field__error" role="alert" style={{ marginTop: "1rem" }}>
                  {error}
                </p>
              ) : null}

              {busy ? (
                <div className="pp-progress">
                  <div className="pp-progress__track">
                    <div className="pp-progress__fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="pp-progress__label">Sending to server… {progress}%</div>
                </div>
              ) : null}

              <div className="pp-row-actions" style={{ marginTop: "1.25rem" }}>
                <Button type="button" onClick={handleSubmit} disabled={busy}>
                  {busy ? "Working…" : "Upload & validate"}
                </Button>
              </div>
            </Card>
          </div>

          {result ? (
            <Card
              title="Validation results"
              actions={
                <button type="button" className="pp-btn pp-btn--secondary pp-btn--sm" onClick={handleRetry}>
                  Upload more files
                </button>
              }
            >
              <p className="pp-muted">
                Row numbers refer to data rows in your file (the first data row is row 1). Highlighted cells match the
                column named in each error, when applicable.
              </p>
              <div className="pp-grid pp-grid--1">
                {result.files.map((slot) => (
                  <section key={slot.role} className="pp-card pp-upload-result-card">
                    <h3 className="pp-card__title" style={{ fontSize: "1.05rem" }}>
                      {SLOTS.find((s) => s.role === slot.role)?.title ?? slot.role}
                      {slot.filename ? (
                        <span className="pp-muted" style={{ fontWeight: 400, fontSize: "0.85rem" }}>
                          {" "}
                          — {slot.filename}
                        </span>
                      ) : null}
                    </h3>
                    <ul className="pp-upload-meta">
                      {slot.sheet_used ? (
                        <li>
                          Sheet used: <code>{slot.sheet_used}</code>
                        </li>
                      ) : null}
                      {slot.data_row_count != null ? <li>Data rows: {slot.data_row_count}</li> : null}
                      {slot.persisted_row_count != null ? (
                        <li>
                          Stored for this project: <strong>{slot.persisted_row_count}</strong> row(s)
                        </li>
                      ) : null}
                    </ul>
                    {slot.warnings.length ? (
                      <div className="pp-validation pp-validation--ok" style={{ marginBottom: "0.75rem" }}>
                        <p className="pp-validation__title">Notices</p>
                        <ul>
                          {slot.warnings.map((w) => (
                            <li key={w}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className={`pp-validation ${slot.valid ? "pp-validation--ok" : "pp-validation--bad"}`}>
                      <p className="pp-validation__title">{slot.valid ? "Validation passed" : "Validation failed"}</p>
                      {slot.errors.length ? (
                        <ValidationErrorsTable errors={slot.errors} />
                      ) : slot.valid && !slot.warnings.some((w) => w.includes("No file was uploaded")) ? (
                        <p style={{ margin: 0 }}>No blocking issues detected for this file.</p>
                      ) : null}
                    </div>
                    {!slot.valid && slot.errors.length ? (
                      <div className="pp-row-actions" style={{ marginTop: "0.75rem" }}>
                        <button type="button" className="pp-btn pp-btn--secondary pp-btn--sm" onClick={handleRetry}>
                          Fix file &amp; retry
                        </button>
                      </div>
                    ) : null}
                    {Object.keys(slot.column_mapping).length ? (
                      <div style={{ marginTop: "0.75rem" }}>
                        <p className="pp-muted" style={{ fontSize: "0.85rem", margin: "0 0 0.35rem" }}>
                          Column mapping (your headers → system names)
                        </p>
                        <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.9rem" }}>
                          {Object.entries(slot.column_mapping).map(([from, to]) => (
                            <li key={from}>
                              <code>{from}</code> → <code>{to}</code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div style={{ marginTop: "1rem" }}>
                      <p className="pp-muted" style={{ fontSize: "0.85rem", margin: "0 0 0.35rem" }}>
                        Preview (first rows)
                      </p>
                      <PreviewTableWithErrors slot={slot} />
                    </div>
                  </section>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
