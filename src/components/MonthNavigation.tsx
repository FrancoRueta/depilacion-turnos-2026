import { formatMonthYear } from "../../shared/dates";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";

interface MonthNavigationProps {
  month: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
}

export function MonthNavigation({
  month,
  onPrev,
  onNext,
  prevDisabled = false,
}: MonthNavigationProps) {
  return (
    <div className="month-nav">
      <button
        type="button"
        className="icon-button"
        onClick={onPrev}
        disabled={prevDisabled}
        aria-label="Mes anterior"
      >
        <ChevronLeftIcon />
      </button>
      <h2 className="month-nav__title" aria-live="polite">
        {formatMonthYear(month)}
      </h2>
      <button
        type="button"
        className="icon-button"
        onClick={onNext}
        aria-label="Mes siguiente"
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}
