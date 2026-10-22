import { useState, type ReactNode } from "react";
import { ApiRequestError } from "../../api";
import { Alert } from "../Alert";
import { ShieldIcon } from "../Icons";
import { Modal } from "../Modal";

interface ConfirmDialogProps {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onSessionExpired: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
  onSessionExpired,
}: ConfirmDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm();
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        if (requestError.status === 401) {
          onSessionExpired();
          return;
        }
        setError(requestError.message);
      } else {
        setError("No pudimos completar la acción. Intentá nuevamente.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open title={title} onClose={onClose}>
      <div className="confirm-dialog">
        <span className="confirm-dialog__icon">
          <ShieldIcon size={24} />
        </span>
        <div className="confirm-dialog__content">{description}</div>
      </div>

      {error ? (
        <Alert tone="danger" title="Acción no completada">
          {error}
        </Alert>
      ) : null}

      <div className="modal-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
          Volver
        </button>
        <button
          type="button"
          className="btn btn--danger"
          onClick={handleConfirm}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Procesando…
            </>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </Modal>
  );
}
