import { useEffect, useMemo, useState } from "react";
import { ApiRequestError } from "../../api";
import { ZONES } from "../../../shared/constants";
import {
  formatLongDateCapitalized,
  generateSlotTimes,
  getBusinessToday,
  isSlotPast,
} from "../../../shared/dates";
import { validateBookingInput } from "../../../shared/validation";
import type {
  AdminBooking,
  AdminBookingPayload,
  AdminServiceDate,
  BookingDraft,
  FieldErrors,
} from "../../../shared/types";
import { Alert } from "../Alert";
import { CalendarIcon, InfoIcon } from "../Icons";
import { Modal } from "../Modal";

interface BookingEditorModalProps {
  booking: AdminBooking;
  dates: AdminServiceDate[];
  onClose: () => void;
  onSave: (payload: AdminBookingPayload) => Promise<void>;
  onSessionExpired: () => void;
}

export function BookingEditorModal({
  booking,
  dates,
  onClose,
  onSave,
  onSessionExpired,
}: BookingEditorModalProps) {
  const today = getBusinessToday();
  const [draft, setDraft] = useState<BookingDraft>({
    fullName: booking.fullName,
    age: String(booking.age),
    zones: booking.zones,
    phone: booking.phone,
  });
  const [targetDate, setTargetDate] = useState(booking.date);
  const [targetTime, setTargetTime] = useState(booking.startTime);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectableDates = useMemo(
    () =>
      dates
        .filter(
          (serviceDate) =>
            serviceDate.date === booking.date ||
            (serviceDate.active && serviceDate.date >= today),
        )
        .sort((a, b) => a.date.localeCompare(b.date)),
    [dates, booking.date, today],
  );

  const selectedServiceDate = selectableDates.find((item) => item.date === targetDate) ?? null;

  const availableTimes = useMemo(() => {
    if (!selectedServiceDate) return [];
    const otherBookings = new Set(
      selectedServiceDate.bookings
        .filter((item) => item.id !== booking.id)
        .map((item) => item.startTime),
    );
    return generateSlotTimes(selectedServiceDate.openTime, selectedServiceDate.closeTime).filter(
      (time) => {
        if (otherBookings.has(time)) return false;
        if (!isSlotPast(selectedServiceDate.date, time)) return true;
        return selectedServiceDate.date === booking.date && time === booking.startTime;
      },
    );
  }, [selectedServiceDate, booking.id, booking.date, booking.startTime]);

  useEffect(() => {
    if (availableTimes.length > 0 && !availableTimes.includes(targetTime)) {
      setTargetTime(availableTimes[0]);
    }
  }, [availableTimes, targetTime]);

  function updateDraft<K extends keyof BookingDraft>(field: K, value: BookingDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function toggleZone(zoneId: string) {
    const zones = draft.zones.includes(zoneId)
      ? draft.zones.filter((zone) => zone !== zoneId)
      : [...draft.zones, zoneId];
    updateDraft("zones", zones);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const validation = validateBookingInput(draft);
    const errors: FieldErrors = { ...validation.errors };
    if (!selectedServiceDate) {
      errors.date = "Elegí una fecha de atención válida.";
    }
    if (!targetTime) {
      errors.startTime = "Elegí un horario libre.";
    }
    if (!validation.value || Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Revisá los datos marcados antes de guardar.");
      return;
    }

    setFieldErrors({});
    setSaving(true);
    try {
      await onSave({
        ...validation.value,
        date: targetDate,
        startTime: targetTime,
      });
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        if (requestError.status === 401) {
          onSessionExpired();
          return;
        }
        setError(requestError.message);
        setFieldErrors(requestError.fields ?? {});
      } else {
        setError("No pudimos guardar la reserva. Intentá nuevamente.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title="Editar reserva"
      description="Podés corregir los datos o reubicar el turno en un horario libre."
      onClose={onClose}
      size="wide"
    >
      <form className="modal-form" onSubmit={handleSubmit} noValidate>
        {error ? (
          <Alert tone="danger" title="No se pudo guardar">
            {error}
          </Alert>
        ) : null}

        <div className="field-row">
          <div className="field">
            <label htmlFor="booking-name">Nombre y apellido</label>
            <input
              id="booking-name"
              type="text"
              autoComplete="off"
              value={draft.fullName}
              onChange={(event) => updateDraft("fullName", event.target.value)}
              aria-invalid={Boolean(fieldErrors.fullName)}
              aria-describedby={fieldErrors.fullName ? "booking-name-error" : undefined}
              autoFocus
            />
            {fieldErrors.fullName ? (
              <p className="field-error" id="booking-name-error" role="alert">
                {fieldErrors.fullName}
              </p>
            ) : null}
          </div>
          <div className="field field--age">
            <label htmlFor="booking-age">Edad</label>
            <input
              id="booking-age"
              type="text"
              inputMode="numeric"
              value={draft.age}
              onChange={(event) => updateDraft("age", event.target.value)}
              aria-invalid={Boolean(fieldErrors.age)}
              aria-describedby={fieldErrors.age ? "booking-age-error" : undefined}
            />
            {fieldErrors.age ? (
              <p className="field-error" id="booking-age-error" role="alert">
                {fieldErrors.age}
              </p>
            ) : null}
          </div>
        </div>

        <div className="field">
          <label htmlFor="booking-phone">Teléfono</label>
          <input
            id="booking-phone"
            type="tel"
            value={draft.phone}
            onChange={(event) => updateDraft("phone", event.target.value)}
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={fieldErrors.phone ? "booking-phone-error" : undefined}
          />
          {fieldErrors.phone ? (
            <p className="field-error" id="booking-phone-error" role="alert">
              {fieldErrors.phone}
            </p>
          ) : null}
        </div>

        <fieldset className="field field--zones" aria-invalid={Boolean(fieldErrors.zones)}>
          <legend>Zonas a depilar</legend>
          <div className="zone-grid">
            {ZONES.map((zone) => (
              <label className="zone-option" key={zone.id}>
                <input
                  type="checkbox"
                  checked={draft.zones.includes(zone.id)}
                  onChange={() => toggleZone(zone.id)}
                />
                <span>{zone.label}</span>
              </label>
            ))}
          </div>
          {fieldErrors.zones ? (
            <p className="field-error" role="alert">
              {fieldErrors.zones}
            </p>
          ) : null}
        </fieldset>

        <div className="field-row">
          <div className="field">
            <label htmlFor="booking-date">
              <CalendarIcon size={16} />
              Fecha
            </label>
            <select
              id="booking-date"
              value={targetDate}
              onChange={(event) => {
                setTargetDate(event.target.value);
                setFieldErrors((current) => ({ ...current, date: "" }));
              }}
              aria-invalid={Boolean(fieldErrors.date)}
            >
              {selectableDates.map((serviceDate) => (
                <option key={serviceDate.id} value={serviceDate.date}>
                  {formatLongDateCapitalized(serviceDate.date, false)}
                  {serviceDate.date === booking.date ? " (actual)" : ""}
                </option>
              ))}
            </select>
            {fieldErrors.date ? (
              <p className="field-error" role="alert">
                {fieldErrors.date}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="booking-time">Horario</label>
            <select
              id="booking-time"
              value={targetTime}
              onChange={(event) => {
                setTargetTime(event.target.value);
                setFieldErrors((current) => ({ ...current, startTime: "" }));
              }}
              aria-invalid={Boolean(fieldErrors.startTime)}
              disabled={availableTimes.length === 0}
            >
              {availableTimes.map((time) => (
                <option key={time} value={time}>
                  {time}
                  {selectedServiceDate?.date === booking.date && time === booking.startTime
                    ? " (actual)"
                    : ""}
                </option>
              ))}
            </select>
            {fieldErrors.startTime ? (
              <p className="field-error" role="alert">
                {fieldErrors.startTime}
              </p>
            ) : null}
          </div>
        </div>

        {availableTimes.length === 0 ? (
          <Alert tone="warning" title="Sin horarios libres">
            No quedan horarios disponibles en la fecha elegida. Probá con otra fecha.
          </Alert>
        ) : (
          <p className="field-hint field-hint--inline">
            <InfoIcon size={15} />
            Solo se muestran horarios libres de fechas activas de este mes. La
            disponibilidad se vuelve a validar al guardar.
          </p>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={saving || availableTimes.length === 0}
          >
            {saving ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Guardando…
              </>
            ) : (
              "Guardar reserva"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
