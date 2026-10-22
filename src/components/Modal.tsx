import { useEffect, useId, useRef, type ReactNode } from "react";
import { XIcon } from "./Icons";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: "normal" | "wide";
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  size = "normal",
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      document.body.classList.add("has-modal");
    } else if (!open && dialog.open) {
      dialog.close();
      document.body.classList.remove("has-modal");
    }

    return () => {
      if (dialog.open) dialog.close();
      document.body.classList.remove("has-modal");
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`modal modal--${size}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="modal__card">
        <header className="modal__header">
          <div>
            <h2 id={titleId} className="modal__title">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="modal__description">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <XIcon />
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </dialog>
  );
}
