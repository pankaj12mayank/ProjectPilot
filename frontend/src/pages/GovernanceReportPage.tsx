import { useMemo, useState } from "react";
import { apiFetch, tryParseJson } from "../api/client";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FormField } from "../components/ui/FormField";

export default function GovernanceReportPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const endpoint = useMemo(() => "/governance/report", []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const status = fd.get("status_tracker");
    const raid = fd.get("raid_log");
    const history = fd.get("weekly_history");
    if (!(status instanceof File) || !(raid instanceof File) || !(history instanceof File)) {
      setError("Please choose all three files.");
      return;
    }
    const body = new FormData();
    body.append("status_tracker", status);
    body.append("raid_log", raid);
    body.append("weekly_history", history);
    setBusy(true);
    try {
      const res = await apiFetch(endpoint, { method: "POST", body });
      const text = await res.text();
      if (!res.ok) {
        const parsed = tryParseJson<{ detail?: unknown }>(text);
        const detail =
          parsed && typeof parsed.detail === "string"
            ? parsed.detail
            : parsed && Array.isArray(parsed.detail)
              ? JSON.stringify(parsed.detail)
              : text.trim().slice(0, 400) || res.statusText;
        throw new Error(detail || "Request failed");
      }
      const data = tryParseJson<Record<string, unknown>>(text);
      setResult(data ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Upload inputs">
      <p className="pp-muted">
        Status tracker and RAID log must be Excel files with the expected columns. Weekly history is a CSV with{" "}
        <code>Week</code> and <code>Completion</code>.
      </p>
      <form className="pp-form" onSubmit={onSubmit}>
        <FormField label="Status tracker (.xlsx)" htmlFor="g-status">
          <input id="g-status" name="status_tracker" type="file" accept=".xlsx,.xls" required />
        </FormField>
        <FormField label="RAID log (.xlsx)" htmlFor="g-raid">
          <input id="g-raid" name="raid_log" type="file" accept=".xlsx,.xls" required />
        </FormField>
        <FormField label="Weekly history (.csv)" htmlFor="g-hist">
          <input id="g-hist" name="weekly_history" type="file" accept=".csv" required />
        </FormField>
        <Button type="submit" disabled={busy}>
          {busy ? "Generating…" : "Generate report"}
        </Button>
      </form>
      {error ? (
        <p className="pp-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <pre className="pp-json">{JSON.stringify(result, null, 2)}</pre>
      ) : null}
    </Card>
  );
}
