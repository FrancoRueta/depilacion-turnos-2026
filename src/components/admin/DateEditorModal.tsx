import { useMemo, useState } from "react";
import { ApiRequestError } from "../../api";
import {
  formatLongDateCapitalized,
  generateSlotTimes,
  getBusinessToday,
  minutesToTime,
  parseDateString,
} from "../../../shared/dates";
import {
  DEFAULT_CLOSE_TIME,
  DEFAULT_OPEN_TIME,
  DAY_CLOSE_MAX_MINUTES,
  DAY_OPEN_MINUTES,
  SLOT_MINUTES,
} from "../../../shared/constants";
import { validateServiceDateInput } from "../../../shared/validation";
import type { AdminDatePayload, FieldErrors } from "../../../shared/types";
import { Alert } from "../Alert";
import { CalendarIcon, ClockIcon, InfoIcon } from "../Icons";
import { Modal } from "../Modal";

interface DateEditorModalProps {
  mode: "create" | "edit";
  bookingCount: number;
  initial?: {
    id: string;
    date: string;
    openTime: string;
    closeTime: string;
    active: boolean;
  };
  onClose: () => void;
  onSave: (payload: AdminDatePayload) => Promise<void>;
  onSessionExpired: () => void;
}

const TIME_OPTIONS = Array.from(
  { length: (DAY_CLOSE_MAX_MINUTES - DAY_OPEN_MINUTES) / SLOT_MINUTES + 1 },
  (_, index) => minutesToTime(DAY_OPEN_MINUTES + index * SLOT_MINUTES),
);

function nextWeekendDate(today: string): string {
  let candidate = today;
  for (let index = 0; index < 14; index += 1) {
    const [year, month, day] = candidate.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + 1, 12));
    candidate = date.toISOString().slice(0, 10);
    const weekday = date.getUTCDay();
    if (weekday === 5 || weekday === 6 || weekday === 0) return candidate;
  }
  return candidate;
}

export function DateEditorModal({
  mode,
  bookingCount,
  initial,
  onClose,
  onSave,
  onSessionExpired,
}: DateEditorModalProps) {
  const today = getBusinessToday();
  const [date, setDate] = useState(initial?.date ?? nextWeekendDate(today));
  const [openTime, setOpenTime] = useState(initial?.openTime ?? DEFAULT_OPEN_TIME);
  const [closeTime, setCloseTime] = useState(initial?.closeTime ?? DEFAULT_CLOSE_TIME);
  const [active, setActive] = useState(initial?.active ?? true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const slots = useMemo(() => generateSlotTimes(openTime, closeTime), [openTime, closeTime]);

  const dateWeekday = useMemo(() => {
    const parts = parseDateString(date);
    if (!parts) return null;
    const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)).getUTCDay();
    if (weekday === 0) return "domingo";
    if (weekday === 5) return "viernes";
    if (weekday === 6) return "sábado";
    return null;
  }, [date]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const validation = validateServiceDateInput(
      { date, openTime, closeTime, active },
      today,
    );
    if (!validation.value) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setSaving(true);
    try {
      await onSave(validation.value);
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        if (requestError.status === 401) {
          onSessionExpired();
          return;
        }
        setError(requestError.message);
        setFieldErrors(requestError.fields ?? {});
      } else {
        setError("No pudimos guardar los cambios. Intentá nuevamente.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={mode === "create" ? "Nueva fecha de atención" : "Editar fecha de atención"}
      description="Configurá el día y el rango horario en el que se podrá reservar."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={handleSubmit} noValidate>
        {error ? (
          <Alert tone="danger" title="No se pudo guardar">
            {error}
          </Alert>
        ) : null}

        {mode === "edit" && bookingCount > 0 ? (
          <Alert tone="warning" title="Esta fecha tiene reservas">
            Para cambiar el día, desactivarla o achicar el horario por debajo de los turnos
            existentes, primero cancelá o reubicá esas reservas.
          </Alert>
        ) : null}

        <div className="field">
          <label htmlFor="service-date">Fecha de atención</label>
          <input
            id="service-date"
            type="date"
            value={date}
            min={today}
            onChange={(event) => {
              setDate(event.target.value);
              setFieldErrors((current) => ({ ...current, date: "" }));
            }}
            aria-invalid={Boolean(fieldErrors.date)}
            aria-describedby={fieldErrors.date ? "service-date-error" : "service-date-hint"}
            autoFocus
          />
          <p className="field-hint" id="service-date-hint">
            {dateWeekday
              ? `${formatLongDateCapitalized(date)}.`
              : "Solo se permiten viernes, sábados o domingos."}
          </p>
          {fieldErrors.date ? (
            <p className="field-error" id="service-date-error" role="alert">
              {fieldErrors.date}
            </p>
          ) : null}
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="open-time">Apertura</label>
            <div className="select-wrap">
              <ClockIcon size={18} />
              <select
                id="open-time"
                value={openTime}
                onChange={(event) => {
                  setOpenTime(event.target.value);
                  setFieldErrors((current) => ({ ...current, openTime: "" }));
                }}
                aria-invalid={Boolean(fieldErrors.openTime)}
                aria-describedby={fieldErrors.openTime ? "open-time-error" : undefined}
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
            {fieldErrors.openTime ? (
              <p className="field-error" id="open-time-error" role="alert">
                {fieldErrors.openTime}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="close-time">Cierre</label>
            <div className="select-wrap">
              <ClockIcon size={18} />
              <select
                id="close-time"
                value={closeTime}
                onChange={(event) => {
                  setCloseTime(event.target.value);
                  setFieldErrors((current) => ({ ...current, closeTime: "" }));
                }}
                aria-invalid={Boolean(fieldErrors.closeTime)}
                aria-describedby={fieldErrors.closeTime ? "close-time-error" : undefined}
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
            {fieldErrors.closeTime ? (
              <p className="field-error" id="close-time-error" role="alert">
                {fieldErrors.closeTime}
              </p>
            ) : null}
          </div>
        </div>

        <p className="field-hint field-hint--inline">
          <InfoIcon size={15} />
          Horario permitido: 06:00 a 22:00, en bloques de 30 minutos. Se generarán{" "}
          {slots.length} {slots.length === 1 ? "turno" : "turnos"}.
        </p>

        <label className="switch-row">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          <span>
            <strong>Fecha activa</strong>
            <span>Si está activa, aparecerá en la agenda pública.</span>
          </span>
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Guardando…
              </>
            ) : mode === "create" ? (
              "Crear fecha"
            ) : (
              "Guardar cambios"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
