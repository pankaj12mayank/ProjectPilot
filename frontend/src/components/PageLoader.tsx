export function PageLoader() {
  return (
    <div className="pp-loading pp-loading--page" aria-busy="true">
      <div className="pp-spinner" aria-hidden />
      <span>Loading…</span>
    </div>
  );
}
