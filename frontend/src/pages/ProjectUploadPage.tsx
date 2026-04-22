import { useCallback, useId, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { uploadProjectAnalyze, type AnalyzeUploadResponse, type FileAnalyzeSlot, type FileSlotError } from "../api/projects";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

const SLOTS: { role: "status_tracker" | "raid_log" | "weekly_history"; title: string; hint: string }[] = [
  {
    role: "status_tracker",
    title: "Status tracker",
    hint: "Columns such as Planned %, Actual %, hours, and budget (CSV or Excel).",
  },
  {
    role: "raid_log",
    title: "RAID log",
    hint: "Risk / issue rows with Type, Severity, and Status.",
  },
  {
    role: "weekly_history",
    title: "Weekly history",
    hint: "Week labels and Completion percentage (0–100).",
  },
];

const ACCEPT = ".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

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
        <p className="pp-upload-zone__hint">Drag and drop a file here, or click to choose.</p>
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
  const { projectId } = useParams<{ projectId: string }>();
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const [files, setFiles] = useState<Record<string, File | null>>({
    status_tracker: null,
    raid_log: null,
    weekly_history: null,
  });
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeUploadResponse | null>(null);

  function setSlot(role: string, f: File | null) {
    setFiles((prev) => ({ ...prev, [role]: f }));
    setResult(null);
  }

  function scrollToUpload() {
    uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleRetry() {
    setResult(null);
    setError(null);
    scrollToUpload();
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
      setError("Choose at least one file to upload.");
      return;
    }
    setError(null);
    setResult(null);
    setBusy(true);
    setProgress(0);
    try {
      const res = await uploadProjectAnalyze(projectId, fd, setProgress);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  return (
    <div className="pp-grid pp-grid--1">
      <div ref={uploadSectionRef}>
        <Card
          title="Upload files"
          actions={
            <Link to={projectId ? `/dashboard/projects/${projectId}` : "/dashboard/projects"} className="pp-btn pp-btn--secondary pp-btn--sm">
              Back to project
            </Link>
          }
        >
          <p className="pp-muted">
            Supported formats: <strong>CSV</strong>, <strong>.xlsx</strong>, and <strong>.xls</strong>. Multi-sheet
            workbooks use the first non-empty sheet. Fix any validation errors in your source file, then use{" "}
            <strong>Retry upload</strong> below.
          </p>

          <div className="pp-slot-grid" style={{ marginTop: "1.25rem" }}>
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
              <div className="pp-progress__label">Uploading… {progress}%</div>
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
              Retry upload
            </button>
          }
        >
          <p className="pp-muted">
            Rows and columns in the preview match validation row numbers (first data row is row 1). Cells with issues are
            highlighted when a column is specified.
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
                      Stored in database: <strong>{slot.persisted_row_count}</strong> row(s)
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
                    <>
                      <ValidationErrorsTable errors={slot.errors} />
                    </>
                  ) : slot.valid && !slot.warnings.some((w) => w.includes("No file was uploaded")) ? (
                    <p style={{ margin: 0 }}>No blocking issues detected for this file.</p>
                  ) : null}
                </div>
                {!slot.valid && slot.errors.length ? (
                  <div className="pp-row-actions" style={{ marginTop: "0.75rem" }}>
                    <button type="button" className="pp-btn pp-btn--secondary pp-btn--sm" onClick={handleRetry}>
                      Fix file &amp; retry upload
                    </button>
                  </div>
                ) : null}
                {Object.keys(slot.column_mapping).length ? (
                  <div style={{ marginTop: "0.75rem" }}>
                    <p className="pp-muted" style={{ fontSize: "0.85rem", margin: "0 0 0.35rem" }}>
                      Column mapping (source → canonical)
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
  );
}
