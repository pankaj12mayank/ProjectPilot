import type { ReactNode } from "react";

export function Card({
  title,
  actions,
  children,
  className = "",
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`pp-card ${className}`.trim()}>
      {title || actions ? (
        <div className="pp-card__head">
          {title ? <h2 className="pp-card__title">{title}</h2> : <div />}
          {actions ? <div className="pp-card__actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className="pp-card__body">{children}</div>
    </section>
  );
}
