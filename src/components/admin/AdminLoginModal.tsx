import { useState } from "react";
import { ApiRequestError } from "../../api";
import { Alert } from "../Alert";
import { LockIcon, UserIcon } from "../Icons";
import { Modal } from "../Modal";

interface AdminLoginModalProps {
  open: boolean;
  notice?: string | null;
  onClose: () => void;
  onLogin: (username: string, password: string) => Promise<void>;
}

export function AdminLoginModal({ open, notice, onClose, onLogin }: AdminLoginModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    if (submitting) return;
    setPassword("");
    setError(null);
    setFieldErrors({});
    onClose();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!username.trim()) errors.username = "Ingresá el usuario.";
    if (!password) errors.password = "Ingresá la contraseña.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await onLogin(username.trim(), password);
      setPassword("");
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        setError(requestError.message);
        setFieldErrors(requestError.fields ?? {});
      } else {
        setError("No pudimos iniciar sesión. Intentá nuevamente.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Acceso de administración"
      description="Ingresá con el usuario y la contraseña del responsable del negocio."
      onClose={handleClose}
    >
      <form className="modal-form" onSubmit={handleSubmit} noValidate>
        {notice ? (
          <Alert tone="warning" title="Sesión finalizada">
            {notice}
          </Alert>
        ) : null}

        {error ? (
          <Alert tone="danger" title="No se pudo iniciar sesión">
            {error}
          </Alert>
        ) : null}

        <div className="field">
          <label htmlFor="admin-username">Usuario</label>
          <div className="input-wrap">
            <UserIcon size={18} />
            <input
              id="admin-username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setFieldErrors((current) => ({ ...current, username: "" }));
              }}
              aria-invalid={Boolean(fieldErrors.username)}
              aria-describedby={fieldErrors.username ? "admin-username-error" : undefined}
              autoFocus
            />
          </div>
          {fieldErrors.username ? (
            <p className="field-error" id="admin-username-error" role="alert">
              {fieldErrors.username}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="admin-password">Contraseña</label>
          <div className="input-wrap">
            <LockIcon size={18} />
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({ ...current, password: "" }));
              }}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "admin-password-error" : undefined}
            />
          </div>
          {fieldErrors.password ? (
            <p className="field-error" id="admin-password-error" role="alert">
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        <p className="modal-note">
          No existe registro público de administradores. Si todavía no configuraste el
          acceso, consultá el instructivo de instalación.
        </p>

        <div className="modal-actions">
          <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Ingresando…
              </>
            ) : (
              "Ingresar"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
