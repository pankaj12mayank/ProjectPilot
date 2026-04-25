import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="pp-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="pp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pp-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pp-modal__header">
          <h2 id="pp-modal-title">{title}</h2>
          <Button variant="ghost" type="button" className="pp-modal__close" onClick={onClose} aria-label="Close dialog">
            <X className="size-5 shrink-0" strokeWidth={2} aria-hidden />
          </Button>
        </header>
        <div className="pp-modal__body">{children}</div>
        {footer ? <footer className="pp-modal__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
