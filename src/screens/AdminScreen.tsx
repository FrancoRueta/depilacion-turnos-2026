import { useEffect, useMemo, useState } from "react";
import { ApiRequestError, api } from "../api";
import { ZONE_LABELS } from "../../shared/constants";
import {
  addMonths,
  formatLongDateCapitalized,
  formatMonthYear,
  generateSlotTimes,
  getBusinessToday,
} from "../../shared/dates";
import type {
  AdminBooking,
  AdminDatePayload,
  AdminMonthResponse,
  AdminServiceDate,
} from "../../shared/types";
import { Alert } from "../components/Alert";
import {
  CalendarGrid,
  CalendarSkeleton,
  type CalendarDateInfo,
} from "../components/CalendarGrid";
import { ConfirmDialog } from "../components/admin/ConfirmDialog";
import { BookingEditorModal } from "../components/admin/BookingEditorModal";
import { DateEditorModal } from "../components/admin/DateEditorModal";
import {
  ArrowLeftIcon,
  CalendarIcon,
  LogOutIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  ShieldIcon,
  TrashIcon,
} from "../components/Icons";
import { MonthNavigation } from "../components/MonthNavigation";

interface AdminScreenProps {
  username: string;
  initialMonth: string;
  onHome: () => void;
  onLogout: () => Promise<void>;
  onSessionExpired: () => void;
}

type DateEditorState =
  | { mode: "create" }
  | { mode: "edit"; serviceDate: AdminServiceDate };

type ConfirmState =
  | { kind: "date"; serviceDate: AdminServiceDate }
  | { kind: "booking"; booking: AdminBooking; serviceDate: AdminServiceDate };

interface Feedback {
  tone: "success" | "info" | "danger";
  message: string;
}

export function AdminScreen({
  username,
  initialMonth,
  onHome,
  onLogout,
  onSessionExpired,
}: AdminScreenProps) {
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<AdminMonthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [dateEditor, setDateEditor] = useState<DateEditorState | null>(null);
  const [bookingEditor, setBookingEditor] = useState<AdminBooking | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const today = getBusinessToday();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setData((current) => (current?.month === month ? current : null));

    api
      .getAdminMonth(month)
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        if (requestError instanceof ApiRequestError) {
          if (requestError.status === 401) {
            onSessionExpired();
            return;
          }
          setLoadError(requestError.message);
        } else {
          setLoadError("No pudimos cargar la administración de la agenda.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [month, reloadKey, onSessionExpired]);

  const calendarDates = useMemo<CalendarDateInfo[]>(
    () =>
      (data?.dates ?? []).map((item) => ({
        date: item.date,
        active: item.active,
        bookingCount: item.bookings.length,
      })),
    [data],
  );

  const selectedServiceDate =
    selectedDate && data?.month === month
      ? data.dates.find((item) => item.date === selectedDate) ?? null
      : null;

  const refresh = (message: Feedback) => {
    setFeedback(message);
    setReloadKey((key) => key + 1);
  };

  const goToMonth = (nextMonth: string) => {
    setMonth(nextMonth);
    setSelectedDate(null);
    setFeedback(null);
  };

  async function handleLoginExpired(error: unknown): Promise<boolean> {
    if (error instanceof ApiRequestError && error.status === 401) {
      onSessionExpired();
      return true;
    }
    return false;
  }

  async function handleDateSave(payload: AdminDatePayload) {
    if (dateEditor?.mode === "edit") {
      await api.updateDate(dateEditor.serviceDate.id, payload);
      setDateEditor(null);
      setSelectedDate(payload.date);
      setMonth(payload.date.slice(0, 7));
      refresh({ tone: "success", message: "Fecha actualizada correctamente." });
    } else {
      await api.createDate(payload);
      setDateEditor(null);
      setSelectedDate(payload.date);
      setMonth(payload.date.slice(0, 7));
      refresh({ tone: "success", message: "Fecha de atención creada correctamente." });
    }
  }

  async function handleBookingSave(payload: {
    fullName: string;
    age: number;
    zones: string[];
    phone: string;
    date: string;
    startTime: string;
  }) {
    if (!bookingEditor) return;
    await api.updateBooking(bookingEditor.id, payload);
    setBookingEditor(null);
    setSelectedDate(payload.date);
    refresh({ tone: "success", message: "Reserva actualizada correctamente." });
  }

  async function handleDeleteDate() {
    if (confirmState?.kind !== "date") return;
    const serviceDate = confirmState.serviceDate;
    await api.deleteDate(serviceDate.id);
    setConfirmState(null);
    setSelectedDate(null);
    refresh({ tone: "success", message: "Fecha eliminada. El día ya no está publicado." });
  }

  async function handleDeleteBooking() {
    if (confirmState?.kind !== "booking") return;
    const booking = confirmState.booking;
    await api.deleteBooking(booking.id);
    setConfirmState(null);
    refresh({ tone: "success", message: "Turno cancelado. El horario volvió a quedar libre." });
  }

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await onLogout();
    } catch (error) {
      setLogoutError(
        error instanceof ApiRequestError
          ? error.message
          : "No pudimos cerrar la sesión. Intentá nuevamente.",
      );
      setLoggingOut(false);
    }
  }

  const totalSlots = selectedServiceDate
    ? generateSlotTimes(selectedServiceDate.openTime, selectedServiceDate.closeTime).length
    : 0;

  return (
    <section className="admin-screen screen-enter">
      <div className="admin-banner">
        <div className="admin-banner__identity">
          <span className="admin-banner__icon">
            <ShieldIcon size={20} />
          </span>
          <div>
            <strong>Modo administración</strong>
            <span>Sesión de {username}</span>
          </div>
        </div>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <>
              <span className="spinner spinner--dark" aria-hidden="true" />
              Saliendo…
            </>
          ) : (
            <>
              <LogOutIcon size={17} />
              Salir
            </>
          )}
        </button>
      </div>

      {logoutError ? (
        <Alert tone="danger" title="No se pudo cerrar la sesión">
          {logoutError}
        </Alert>
      ) : null}

      <div className="page-head page-head--admin">
        <button type="button" className="back-link" onClick={onHome}>
          <ArrowLeftIcon size={17} />
          Volver al inicio
        </button>
        <p className="eyebrow">Administración</p>
        <div className="page-head__row">
          <div>
            <h1 className="page-title" data-screen-title tabIndex={-1}>
              Agenda y configuración
            </h1>
            <p className="page-lede">
              Gestioná las fechas de atención, sus horarios y las reservas del mes.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setDateEditor({ mode: "create" })}
          >
            <PlusIcon size={18} />
            Nueva fecha
          </button>
        </div>
      </div>

      {feedback ? (
        <Alert
          tone={feedback.tone}
          title={
            feedback.tone === "success"
              ? "Cambios guardados"
              : feedback.tone === "danger"
                ? "No se pudo completar"
                : undefined
          }
        >
          {feedback.message}
        </Alert>
      ) : null}

      {loadError ? (
        <div className="state-card state-card--error">
          <span className="state-card__icon">
            <CalendarIcon size={28} />
          </span>
          <h2>No pudimos cargar la agenda</h2>
          <p>{loadError}</p>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            <RefreshIcon size={18} />
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <div className="booking-layout admin-layout">
            <div className="panel calendar-panel">
              <MonthNavigation
                month={month}
                onPrev={() => goToMonth(addMonths(month, -1))}
                onNext={() => goToMonth(addMonths(month, 1))}
              />
              {loading && !data ? (
                <CalendarSkeleton />
              ) : (
                <CalendarGrid
                  month={month}
                  dates={calendarDates}
                  selectedDate={selectedDate}
                  today={today}
                  mode="admin"
                  onSelectDate={setSelectedDate}
                />
              )}
              <div className="calendar-legend" aria-label="Referencias del calendario">
                <span>
                  <span className="legend-dot legend-dot--active" aria-hidden="true" />
                  Activa
                </span>
                <span>
                  <span className="legend-dot legend-dot--inactive" aria-hidden="true" />
                  Inactiva
                </span>
                <span>
                  <span className="legend-dot" aria-hidden="true" />
                  Sin configurar
                </span>
              </div>
            </div>

            <div className="panel detail-panel admin-detail">
              {loading && !data ? (
                <div className="detail-skeleton" aria-hidden="true">
                  <span className="skeleton-line skeleton-line--short" />
                  <span className="skeleton-line skeleton-line--title" />
                  <span className="skeleton-line" />
                  <div className="skeleton-grid">
                    {Array.from({ length: 4 }, (_, index) => (
                      <span key={index} className="skeleton-block" />
                    ))}
                  </div>
                </div>
              ) : selectedServiceDate ? (
                <>
                  <div className="date-detail-head">
                    <div>
                      <p className="eyebrow">Fecha seleccionada</p>
                      <h2>{formatLongDateCapitalized(selectedServiceDate.date)}</h2>
                    </div>
                    <span
                      className={`status-badge status-badge--${selectedServiceDate.active ? "active" : "inactive"}`}
                    >
                      {selectedServiceDate.active ? "Activa" : "Inactiva"}
                    </span>
                  </div>

                  <p className="date-meta">
                    <CalendarIcon size={16} />
                    {selectedServiceDate.openTime} a {selectedServiceDate.closeTime} ·{" "}
                    {totalSlots} turnos de 30 min
                  </p>

                  <div className="admin-date-actions">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setDateEditor({ mode: "edit", serviceDate: selectedServiceDate })}
                    >
                      <PencilIcon size={16} />
                      Editar fecha
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger-ghost btn--sm"
                      onClick={() => setConfirmState({ kind: "date", serviceDate: selectedServiceDate })}
                      disabled={selectedServiceDate.bookings.length > 0}
                      title={
                        selectedServiceDate.bookings.length > 0
                          ? "Primero cancelá o reubicá las reservas de esta fecha."
                          : undefined
                      }
                    >
                      <TrashIcon size={16} />
                      Eliminar
                    </button>
                  </div>

                  {!selectedServiceDate.active ? (
                    <p className="admin-note">
                      Esta fecha está inactiva y no se muestra en la agenda pública.
                    </p>
                  ) : null}

                  {selectedServiceDate.bookings.length > 0 ? (
                    <p className="admin-note">
                      Para eliminar esta fecha o cambiar su día, primero cancelá o reubicá sus
                      reservas.
                    </p>
                  ) : null}

                  <div className="admin-bookings-head">
                    <h3>Reservas del día</h3>
                    <span>
                      {selectedServiceDate.bookings.length} de {totalSlots} ocupados
                    </span>
                  </div>

                  {selectedServiceDate.bookings.length === 0 ? (
                    <div className="empty-inline admin-empty">
                      No hay reservas para esta fecha. Todo el horario está disponible.
                    </div>
                  ) : (
                    <ul className="admin-booking-list">
                      {selectedServiceDate.bookings.map((booking) => (
                        <li key={booking.id}>
                          <article className="admin-booking">
                            <div className="admin-booking__top">
                              <span className="time-chip">{booking.startTime}</span>
                              <div className="admin-booking__identity">
                                <strong>{booking.fullName}</strong>
                                <span>{booking.age} años</span>
                              </div>
                              <div className="admin-booking__actions">
                                <button
                                  type="button"
                                  className="icon-button icon-button--soft"
                                  aria-label={`Editar la reserva de ${booking.fullName}`}
                                  title="Editar reserva"
                                  onClick={() => setBookingEditor(booking)}
                                >
                                  <PencilIcon size={17} />
                                </button>
                                <button
                                  type="button"
                                  className="icon-button icon-button--soft icon-button--danger"
                                  aria-label={`Cancelar la reserva de ${booking.fullName}`}
                                  title="Cancelar reserva"
                                  onClick={() =>
                                    setConfirmState({
                                      kind: "booking",
                                      booking,
                                      serviceDate: selectedServiceDate,
                                    })
                                  }
                                >
                                  <TrashIcon size={17} />
                                </button>
                              </div>
                            </div>
                            <div className="admin-booking__details">
                              <a href={`tel:${booking.phone.replace(/[^\d+]/g, "")}`}>
                                {booking.phone}
                              </a>
                              <ul className="tag-list" aria-label="Zonas">
                                {booking.zones.map((zone) => (
                                  <li key={zone}>{ZONE_LABELS[zone] ?? zone}</li>
                                ))}
                              </ul>
                            </div>
                          </article>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <div className="admin-detail-empty">
                  <span className="state-card__icon">
                    <CalendarIcon size={28} />
                  </span>
                  <h2>
                    {data?.dates.length === 0 ? "Sin fechas este mes" : "Elegí una fecha"}
                  </h2>
                  <p>
                    {data?.dates.length === 0
                      ? "Creá una fecha de atención para empezar a recibir reservas."
                      : "Seleccioná un día en el calendario o en la lista de fechas para ver y gestionar sus reservas."}
                  </p>
                  {data?.dates.length === 0 ? (
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => setDateEditor({ mode: "create" })}
                    >
                      <PlusIcon size={18} />
                      Nueva fecha
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {data ? (
            <section className="panel admin-dates-panel" aria-labelledby="admin-dates-title">
              <div className="admin-dates-head">
                <div>
                  <p className="eyebrow">Configuración</p>
                  <h2 id="admin-dates-title">Fechas de atención</h2>
                  <p className="helper-text">
                    {data.dates.length === 0
                      ? `No hay fechas configuradas en ${formatMonthYear(month)}.`
                      : `${data.dates.length} ${
                          data.dates.length === 1 ? "fecha configurada" : "fechas configuradas"
                        } en ${formatMonthYear(month)}.`}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => setDateEditor({ mode: "create" })}
                >
                  <PlusIcon size={17} />
                  Nueva fecha
                </button>
              </div>

              {data.dates.length === 0 ? (
                <div className="admin-dates-empty">
                  <p>
                    Creá una fecha para habilitar sus horarios y empezar a recibir reservas.
                  </p>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => setDateEditor({ mode: "create" })}
                  >
                    <PlusIcon size={17} />
                    Crear primera fecha
                  </button>
                </div>
              ) : (
                <ul className="admin-date-list">
                  {data.dates.map((serviceDate) => {
                    const isSelected = selectedDate === serviceDate.date;
                    return (
                      <li
                        key={serviceDate.id}
                        className={`admin-date-item${isSelected ? " admin-date-item--selected" : ""}`}
                      >
                        <button
                          type="button"
                          className="admin-date-item__select"
                          onClick={() => setSelectedDate(serviceDate.date)}
                          aria-current={isSelected ? "true" : undefined}
                        >
                          <span className="admin-date-item__date">
                            {formatLongDateCapitalized(serviceDate.date, false)}
                          </span>
                          <span className="admin-date-item__meta">
                            <span
                              className={`status-badge status-badge--${serviceDate.active ? "active" : "inactive"}`}
                            >
                              {serviceDate.active ? "Activa" : "Inactiva"}
                            </span>
                            <span className="admin-date-item__count">
                              {serviceDate.bookings.length === 0
                                ? "Sin reservas"
                                : `${serviceDate.bookings.length} ${
                                    serviceDate.bookings.length === 1 ? "reserva" : "reservas"
                                  }`}
                            </span>
                          </span>
                        </button>
                        <div className="admin-date-item__actions">
                          <button
                            type="button"
                            className="icon-button icon-button--soft"
                            aria-label={`Editar la fecha del ${formatLongDateCapitalized(serviceDate.date)}`}
                            title="Editar fecha"
                            onClick={() =>
                              setDateEditor({ mode: "edit", serviceDate })
                            }
                          >
                            <PencilIcon size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-button icon-button--soft icon-button--danger"
                            aria-label={`Eliminar la fecha del ${formatLongDateCapitalized(serviceDate.date)}`}
                            title={
                              serviceDate.bookings.length > 0
                                ? "Primero cancelá o reubicá las reservas de esta fecha."
                                : "Eliminar fecha"
                            }
                            disabled={serviceDate.bookings.length > 0}
                            onClick={() =>
                              setConfirmState({ kind: "date", serviceDate })
                            }
                          >
                            <TrashIcon size={16} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null}
        </>
      )}

      {dateEditor ? (
        <DateEditorModal
          mode={dateEditor.mode}
          bookingCount={
            dateEditor.mode === "edit" ? dateEditor.serviceDate.bookings.length : 0
          }
          initial={dateEditor.mode === "edit" ? dateEditor.serviceDate : undefined}
          onClose={() => setDateEditor(null)}
          onSave={handleDateSave}
          onSessionExpired={onSessionExpired}
        />
      ) : null}

      {bookingEditor && data ? (
        <BookingEditorModal
          booking={bookingEditor}
          dates={data.dates}
          onClose={() => setBookingEditor(null)}
          onSave={handleBookingSave}
          onSessionExpired={onSessionExpired}
        />
      ) : null}

      {confirmState?.kind === "date" ? (
        <ConfirmDialog
          title="Eliminar fecha de atención"
          confirmLabel="Eliminar fecha"
          description={
            <>
              <p>
                Vas a eliminar <strong>{formatLongDateCapitalized(confirmState.serviceDate.date)}</strong>.
                Esta acción no se puede deshacer.
              </p>
              <p>La fecha dejará de estar configurada y desaparecerá de la agenda pública.</p>
            </>
          }
          onClose={() => setConfirmState(null)}
          onConfirm={handleDeleteDate}
          onSessionExpired={onSessionExpired}
        />
      ) : null}

      {confirmState?.kind === "booking" ? (
        <ConfirmDialog
          title="Cancelar reserva"
          confirmLabel="Cancelar turno"
          description={
            <>
              <p>
                Vas a cancelar el turno de <strong>{confirmState.booking.fullName}</strong> a
                las <strong>{confirmState.booking.startTime} hs</strong> del{" "}
                {formatLongDateCapitalized(confirmState.serviceDate.date)}.
              </p>
              <p>El horario volverá a quedar libre en la agenda pública.</p>
            </>
          }
          onClose={() => setConfirmState(null)}
          onConfirm={handleDeleteBooking}
          onSessionExpired={onSessionExpired}
        />
      ) : null}
    </section>
  );
}
