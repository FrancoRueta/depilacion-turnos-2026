import { formatLongDateCapitalized } from "../../shared/dates";
import { CalendarIcon, ClockIcon } from "./Icons";

interface SelectionSummaryProps {
  date: string;
  time?: string | null;
}

export function SelectionSummary({ date, time }: SelectionSummaryProps) {
  return (
    <div className="selection-summary">
      <span className="selection-summary__icon">
        <CalendarIcon size={22} />
      </span>
      <div className="selection-summary__text">
        <span className="selection-summary__label">Tu turno</span>
        <strong>{formatLongDateCapitalized(date)}</strong>
        {time ? (
          <span className="selection-summary__time">
            <ClockIcon size={15} />
            {time} hs
          </span>
        ) : (
          <span className="selection-summary__time">Elegí un horario</span>
        )}
      </div>
    </div>
  );
}
