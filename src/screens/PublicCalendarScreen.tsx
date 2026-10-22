import { useEffect, useMemo, useState } from "react";
import { ApiRequestError, api } from "../api";
import {
  addMonths,
  formatLongDateCapitalized,
  getBusinessToday,
} from "../../shared/dates";
import type { PublicMonthResponse } from "../../shared/types";
import { Alert } from "../components/Alert";
import {
  CalendarGrid,
  CalendarSkeleton,
  type CalendarDateInfo,
} from "../components/CalendarGrid";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  ClockIcon,
  LockIcon,
  RefreshIcon,
} from "../components/Icons";
import { MonthNavigation } from "../components/MonthNavigation";
import { SelectionSummary } from "../components/SelectionSummary";
import { SlotGrid } from "../components/SlotGrid";
import { Stepper } from "../components/Stepper";

interface PublicCalendarScreenProps {
  mode: "view" | "book";
  month: string;
  selectedDate: string | null;
  selectedTime: string | null;
  onMonthChange: (month: string) => void;
  onSelectDate: (date: string) => void;
  onSelectTime: (time: string) => void;
  onClearSlot: () => void;
  onClearDate: () => void;
  onContinue: () => void;
  onHome: () => void;
  onStartBooking: () => void;
}

export function PublicCalendarScreen({
  mode,
  month,
  selectedDate,
  selectedTime,
  onMonthChange,
  onSelectDate,
  onSelectTime,
  onClearSlot,
  onClearDate,
  onContinue,
  onHome,
  onStartBooking,
}: PublicCalendarScreenProps) {
  const [data, setData] = useState<PublicMonthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const today = getBusinessToday();
  const currentMonth = today.slice(0, 7);
  const prevDisabled = month <= currentMonth;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getPublicMonth(month)
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        setError(
          requestError instanceof ApiRequestError
            ? requestError.message
            : "No pudimos cargar la agenda. Intentá nuevamente.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [month, reloadKey]);

  useEffect(() => {
    if (!data || !selectedDate) return;
    const dateInfo = data.dates.find((item) => item.date === selectedDate);
    if (!dateInfo) {
      setNotice("La fecha que habías elegido ya no está disponible. Elegí otra.");
      onClearDate();
      return;
    }

    if (selectedTime) {
      const slot = dateInfo.slots.find((item) => item.time === selectedTime);
      if (!slot || slot.status !== "available") {
        setNotice("El horario que habías elegido acaba de ocuparse. Elegí otro.");
        onClearSlot();
      }
    }
  }, [data, selectedDate, selectedTime, onClearDate, onClearSlot]);

  const calendarDates = useMemo<CalendarDateInfo[]>(
    () => (data?.dates ?? []).map((item) => ({ date: item.date, active: true })),
    [data],
  );

  const selectedDateInfo = selectedDate
    ? data?.dates.find((item) => item.date === selectedDate) ?? null
    : null;
  const availableCount = selectedDateInfo
    ? selectedDateInfo.slots.filter((slot) => slot.status === "available").length
    : 0;

  const handleSelectDate = (date: string) => {
    setNotice(null);
    onSelectDate(date);
  };

  const handleSelectTime = (time: string) => {
    setNotice(null);
    onSelectTime(time);
  };

  return (
    <section className="public-calendar-screen screen-enter">
      <div className="page-head">
        <button type="button" className="back-link" onClick={onHome}>
          <ArrowLeftIcon size={17} />
          Volver al inicio
        </button>
        <p className="eyebrow">{mode === "book" ? "Nuevo turno" : "Agenda"}</p>
        <h1 className="page-title" data-screen-title tabIndex={-1}>
          {mode === "book" ? "Elegí fecha y horario" : "Consultá la disponibilidad"}
        </h1>
        <p className="page-lede">
          {mode === "book"
            ? "Primero elegí una fecha de atención y después un horario libre."
            : "Explorá las fechas publicadas y mirá qué horarios están libres u ocupados."}
        </p>
      </div>

      {mode === "book" ? <Stepper current={1} /> : null}

      {notice ? (
        <Alert tone="warning" title="La selección cambió">
          {notice}
        </Alert>
      ) : null}

      {error ? (
        <div className="state-card state-card--error">
          <span className="state-card__icon">
            <CalendarIcon size={28} />
          </span>
          <h2>No pudimos cargar la agenda</h2>
          <p>{error}</p>
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
        <div className="booking-layout">
          <div className="panel calendar-panel">
            <MonthNavigation
              month={month}
              prevDisabled={prevDisabled}
              onPrev={() => onMonthChange(addMonths(month, -1))}
              onNext={() => onMonthChange(addMonths(month, 1))}
            />
            {loading && !data ? (
              <CalendarSkeleton />
            ) : (
              <CalendarGrid
                month={month}
                dates={calendarDates}
                selectedDate={selectedDate}
                today={today}
                mode="public"
                onSelectDate={handleSelectDate}
              />
            )}
            <div className="calendar-legend" aria-label="Referencias del calendario">
              <span>
                <span className="legend-dot legend-dot--active" aria-hidden="true" />
                Fecha de atención
              </span>
              <span>
                <span className="legend-dot" aria-hidden="true" />
                Sin atención
              </span>
            </div>
          </div>

          <div className="panel detail-panel">
            {loading && !data ? (
              <div className="detail-skeleton" aria-hidden="true">
                <span className="skeleton-line skeleton-line--short" />
                <span className="skeleton-line skeleton-line--title" />
                <span className="skeleton-line" />
                <div className="skeleton-grid">
                  {Array.from({ length: 6 }, (_, index) => (
                    <span key={index} className="skeleton-block" />
                  ))}
                </div>
              </div>
            ) : data && data.dates.length === 0 ? (
              <div className="state-card state-card--empty state-card--inline">
                <span className="state-card__icon">
                  <CalendarIcon size={28} />
                </span>
                <h2>No hay fechas publicadas</h2>
                <p>
                  Todavía no hay fechas de atención para este mes. Podés consultar el
                  mes siguiente.
                </p>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => onMonthChange(addMonths(month, 1))}
                >
                  Ver mes siguiente
                  <ArrowRightIcon size={17} />
                </button>
              </div>
            ) : selectedDateInfo ? (
              <>
                <div className="date-detail-head">
                  <div>
                    <p className="eyebrow">Fecha elegida</p>
                    <h2>{formatLongDateCapitalized(selectedDateInfo.date)}</h2>
                  </div>
                  <span className="availability-badge">
                    {availableCount > 0
                      ? `${availableCount} ${availableCount === 1 ? "horario libre" : "horarios libres"}`
                      : "Sin horarios libres"}
                  </span>
                </div>
                <p className="date-meta">
                  <ClockIcon size={16} />
                  Turnos de 30 minutos · {selectedDateInfo.openTime} a {selectedDateInfo.closeTime}
                </p>

                <SlotGrid
                  slots={selectedDateInfo.slots}
                  mode={mode}
                  selectedTime={selectedTime}
                  onSelectTime={handleSelectTime}
                />

                {mode === "book" ? (
                  <div className="booking-continue">
                    {selectedTime ? (
                      <SelectionSummary date={selectedDateInfo.date} time={selectedTime} />
                    ) : (
                      <p className="helper-text">
                        Elegí un horario libre para continuar con tus datos.
                      </p>
                    )}
                    <button
                      type="button"
                      className="btn btn--primary btn--block"
                      onClick={onContinue}
                      disabled={!selectedTime}
                    >
                      Continuar con mis datos
                      <ArrowRightIcon size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="view-mode-note">
                    <Alert tone="info" title="Estás consultando la agenda">
                      Para reservar, activá el modo de reserva y elegí un horario libre.
                    </Alert>
                    <button type="button" className="btn btn--primary btn--block" onClick={onStartBooking}>
                      Reservar un turno
                      <ArrowRightIcon size={18} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="state-card state-card--empty state-card--inline">
                <span className="state-card__icon">
                  <CalendarIcon size={28} />
                </span>
                <h2>Elegí una fecha</h2>
                <p>
                  Las fechas resaltadas tienen atención. Seleccioná una para ver sus
                  horarios.
                </p>
                <p className="privacy-line privacy-line--center">
                  <LockIcon size={15} />
                  Los turnos ocupados muestran solo iniciales.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
