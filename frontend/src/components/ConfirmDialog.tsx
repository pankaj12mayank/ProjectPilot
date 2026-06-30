import { type ReactNode } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary" | "secondary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={variant} disabled={loading} onClick={onConfirm}>
            {loading ? "Processing..." : confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-1 text-sm leading-relaxed text-muted-foreground">
        {message}
      </div>
    </Modal>
  );
}
