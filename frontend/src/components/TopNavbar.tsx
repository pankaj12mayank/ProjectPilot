import { useAuth } from "../auth/AuthContext";

export function TopNavbar({
  title,
  onMenuPress,
}: {
  title: string;
  onMenuPress?: () => void;
}) {
  const { user } = useAuth();

  return (
    <header className="pp-topbar">
      <div className="pp-topbar__left">
        {onMenuPress ? (
          <button type="button" className="pp-topbar__menu" aria-label="Open menu" onClick={onMenuPress}>
            ☰
          </button>
        ) : null}
        <h1 className="pp-topbar__title">{title}</h1>
      </div>
      <div className="pp-topbar__user">
        <span className="pp-topbar__name">{user?.full_name}</span>
        <span className="pp-topbar__meta">{user?.email}</span>
        <span className="pp-topbar__badge">{user?.role}</span>
      </div>
    </header>
  );
}
