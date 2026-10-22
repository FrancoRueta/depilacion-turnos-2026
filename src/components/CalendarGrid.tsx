import {
  datesInMonth,
  firstWeekdayIndex,
  formatLongDate,
  formatMonthYear,
} from "../../shared/dates";
import { WEEKDAY_LABELS, WEEKDAY_SHORT_LABELS } from "../../shared/constants";

export interface CalendarDateInfo {
  date: string;
  active: boolean;
  bookingCount?: number;
}

interface CalendarGridProps {
  month: string;
  dates: CalendarDateInfo[];
  selectedDate: string | null;
  today: string;
  mode: "public" | "admin";
  onSelectDate: (date: string) => void;
}

interface Cell {
  date: string | null;
  day: number | null;
}

function buildCells(month: string): Cell[] {
  const offset = firstWeekdayIndex(month);
  const days = datesInMonth(month);
  const cells: Cell[] = [];

  for (let index = 0; index < offset; index += 1) {
    cells.push({ date: null, day: null });
  }
  for (const date of days) {
    cells.push({ date, day: Number(date.slice(-2)) });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    cells.push({ date: null, day: null });
  }
  return cells.slice(0, 42);
}

export function CalendarGrid({
  month,
  dates,
  selectedDate,
  today,
  mode,
  onSelectDate,
}: CalendarGridProps) {
  const cells = buildCells(month);
  const dateMap = new Map(dates.map((item) => [item.date, item]));
  const rows: Cell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    rows.push(cells.slice(index, index + 7));
  }

  return (
    <table className="calendar">
      <caption className="visually-hidden">Calendario de {formatMonthYear(month)}</caption>
      <thead>
        <tr>
          {WEEKDAY_SHORT_LABELS.map((label, index) => (
            <th key={label} scope="col">
              <abbr title={WEEKDAY_LABELS[index]}>{label}</abbr>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={`row-${rowIndex}`}>
            {row.map((cell, cellIndex) => {
              if (!cell.date) {
                return <td key={`empty-${rowIndex}-${cellIndex}`} />;
              }

              const info = dateMap.get(cell.date);
              const date = cell.date;
              const isPast = cell.date < today;
              const isToday = cell.date === today;
              const isConfigured = Boolean(info);
              const isSelectable =
                isConfigured &&
                (mode === "admin" || (!isPast && (info?.active ?? false)));
              const isSelected = selectedDate === date;
              const active = info?.active ?? false;

              const classNames = [
                "cal-day",
                isConfigured ? "is-configured" : "",
                isConfigured && active ? "is-active" : "",
                isConfigured && !active ? "is-inactive" : "",
                isToday ? "is-today" : "",
                isSelected ? "is-selected" : "",
                !isSelectable ? "is-unavailable" : "",
              ]
                .filter(Boolean)
                .join(" ");

              const stateText = !isConfigured
                ? "sin atención"
                : !active
                  ? "fecha inactiva"
                  : isPast
                    ? "fecha pasada"
                    : "fecha de atención";
              const selectedText = isSelected ? ", seleccionada" : "";
              const bookingText =
                mode === "admin" && info?.bookingCount
                  ? `, ${info.bookingCount} ${info.bookingCount === 1 ? "reserva" : "reservas"}`
                  : "";

              return (
                <td key={date}>
                  <button
                    type="button"
                    className={classNames}
                    onClick={() => {
                      if (isSelectable) onSelectDate(date);
                    }}
                    disabled={!isSelectable}
                    aria-pressed={isSelectable ? isSelected : undefined}
                    aria-label={`${formatLongDate(date)}${isToday ? ", hoy" : ""}, ${stateText}${bookingText}${selectedText}`}
                  >
                    <span className="cal-day__number">{cell.day}</span>
                    {isConfigured ? (
                      <span className="cal-day__dot" aria-hidden="true" />
                    ) : null}
                    {mode === "admin" && info?.bookingCount ? (
                      <span className="cal-day__count" aria-hidden="true">
                        {info.bookingCount > 9 ? "9+" : info.bookingCount}
                      </span>
                    ) : null}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="calendar-skeleton" aria-hidden="true">
      <div className="calendar-skeleton__weekdays">
        {WEEKDAY_SHORT_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="calendar-skeleton__grid">
        {Array.from({ length: 42 }, (_, index) => (
          <span key={index} className="skeleton-block" />
        ))}
      </div>
    </div>
  );
}
