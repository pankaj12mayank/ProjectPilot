export function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="pp-kpi-card">
      <div className="pp-kpi-card__label">{label}</div>
      <div className="pp-kpi-card__value">{value}</div>
      {hint ? <div className="pp-kpi-card__hint">{hint}</div> : null}
    </div>
  );
}
