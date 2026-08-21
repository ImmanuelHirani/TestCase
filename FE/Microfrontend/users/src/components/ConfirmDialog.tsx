import { Button, Dialog } from '@jasindo/shared';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      headline={title}
      icon="delete"
      onClose={onCancel}
      actions={
        <>
          <Button variant="text" onClick={onCancel}>
            Cancel
          </Button>
          {/* Destructive confirm: error role on a text button, so the colour
              carries the warning without shouting like a filled button. */}
          <Button
            variant="text"
            onClick={onConfirm}
            disabled={busy}
            className="text-error [--md-state-color:var(--md-sys-color-error)]"
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-center">{message}</p>
    </Dialog>
  );
}
