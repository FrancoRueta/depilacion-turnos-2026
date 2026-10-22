import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  datesInMonth,
  formatLongDateCapitalized,
  formatMonthYear,
  getBusinessToday,
  isWeekendDate,
  monthOf,
} from "../../../shared/dates";
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "../Icons";

interface ServiceDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  error?: string;
}

const WEEKDAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

function weekdayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return WEEKDAY_LABELS[weekday] ?? "";
}

function dayLabel(date: string): string {
  return String(Number(date.slice(8, 10)));
}

export function ServiceDatePicker({ value, onChange, error }: ServiceDatePickerProps) {
  const today = getBusinessToday();
  const currentMonth = today.slice(0, 7);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const selectedMonth = monthOf(value);
    return selectedMonth >= currentMonth ? selectedMonth : currentMonth;
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const options = useMemo(
    () => datesInMonth(visibleMonth).filter((date) => date >= today && isWeekendDate(date)),
    [visibleMonth, today],
  );
  const canGoPrevious = visibleMonth > currentMonth;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const selected = panel.querySelector<HTMLButtonElement>('.service-date-option[aria-pressed="true"]');
    const firstOption = panel.querySelector<HTMLButtonElement>(".service-date-option");
    const firstButton = panel.querySelector<HTMLButtonElement>("button");
    (selected ?? firstOption ?? firstButton)?.focus();
  }, [open]);

  function togglePanel() {
    if (!open) {
      const valueMonth = monthOf(value);
      setVisibleMonth(valueMonth >= currentMonth ? valueMonth : currentMonth);
    }
    setOpen(!open);
  }

  function selectDate(date: string) {
    onChange(date);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function changeMonth(delta: number) {
    const nextMonth = addMonths(visibleMonth, delta);
    if (nextMonth < currentMonth) return;
    setVisibleMonth(nextMonth);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <div className="field" ref={containerRef} onKeyDown={handleKeyDown}>
      <label id="service-date-label" htmlFor="service-date-trigger">
        Fecha de atención
      </label>
      <button
        ref={triggerRef}
        type="button"
        id="service-date-trigger"
        className="date-picker-trigger"
        aria-expanded={open}
        aria-controls="service-date-panel"
        aria-labelledby="service-date-label service-date-value"
        aria-describedby={error ? "service-date-error" : "service-date-hint"}
        aria-invalid={Boolean(error)}
        onClick={togglePanel}
        autoFocus
      >
        <CalendarIcon className="date-picker-trigger__icon" size={19} />
        <span className="date-picker-trigger__value" id="service-date-value">
          {formatLongDateCapitalized(value)}
        </span>
        <ChevronDownIcon className="date-picker-trigger__chevron" size={18} />
      </button>

      {open ? (
        <div
          ref={panelRef}
          className="date-picker-panel"
          id="service-date-panel"
          role="group"
          aria-labelledby="service-date-panel-title"
        >
          <div className="date-picker-panel__head">
            <h3 className="date-picker-panel__title" id="service-date-panel-title">
              {formatMonthYear(visibleMonth)}
            </h3>
            <div className="date-picker-panel__nav">
              <button
                type="button"
                className="icon-button icon-button--soft"
                aria-label="Mes anterior"
                disabled={!canGoPrevious}
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeftIcon size={18} />
              </button>
              <button
                type="button"
                className="icon-button icon-button--soft"
                aria-label="Mes siguiente"
                onClick={() => changeMonth(1)}
              >
                <ChevronRightIcon size={18} />
              </button>
            </div>
          </div>

          {options.length > 0 ? (
            <div className="service-date-options">
              {options.map((date) => {
                const selected = date === value;
                return (
                  <button
                    key={date}
                    type="button"
                    className="service-date-option"
                    aria-pressed={selected}
                    aria-label={formatLongDateCapitalized(date)}
                    onClick={() => selectDate(date)}
                  >
                    <span className="service-date-option__weekday">{weekdayLabel(date)}</span>
                    <span className="service-date-option__day">{dayLabel(date)}</span>
                    {selected ? (
                      <CheckIcon className="service-date-option__check" size={14} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="date-picker-empty">
              No quedan fechas disponibles este mes. Usá la flecha para ver el mes siguiente.
            </p>
          )}

          <p className="date-picker-panel__hint">
            Solo se habilitan viernes, sábados y domingos.
          </p>
        </div>
      ) : null}

      <p className="field-hint" id="service-date-hint">
        Elegí un viernes, sábado o domingo disponible.
      </p>
      {error ? (
        <p className="field-error" id="service-date-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
