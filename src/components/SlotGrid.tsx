import { PUBLIC_STATUS_LABELS } from "../../shared/constants";
import type { PublicSlot } from "../../shared/types";
import { CheckIcon, LockIcon } from "./Icons";

interface SlotGridProps {
  slots: PublicSlot[];
  mode: "view" | "book";
  selectedTime: string | null;
  onSelectTime?: (time: string) => void;
}

export function SlotGrid({ slots, mode, selectedTime, onSelectTime }: SlotGridProps) {
  if (slots.length === 0) {
    return <p className="empty-inline">No hay horarios configurados para esta fecha.</p>;
  }

  return (
    <ul className="slot-grid" aria-label="Horarios del día">
      {slots.map((slot) => {
        const isSelected = selectedTime === slot.time;
        const isAvailable = slot.status === "available" && mode === "book";
        const statusLabel = PUBLIC_STATUS_LABELS[slot.status];

        if (isAvailable) {
          return (
            <li key={slot.time}>
              <button
                type="button"
                className={`slot slot--available${isSelected ? " is-selected" : ""}`}
                onClick={() => onSelectTime?.(slot.time)}
                aria-pressed={isSelected}
                aria-label={`${slot.time}, libre${isSelected ? ", seleccionado" : ""}`}
              >
                <span className="slot__time">{slot.time}</span>
                <span className="slot__status">
                  {isSelected ? <CheckIcon size={14} /> : <span className="slot__dot" aria-hidden="true" />}
                  {isSelected ? "Elegido" : statusLabel}
                </span>
              </button>
            </li>
          );
        }

        return (
          <li key={slot.time}>
            <div
              className={`slot slot--${slot.status}${isSelected ? " is-selected" : ""}`}
              aria-label={
                slot.status === "booked"
                  ? `${slot.time}, ocupado${slot.initials ? ` por ${slot.initials}` : ""}`
                  : `${slot.time}, ${statusLabel.toLowerCase()}`
              }
            >
              <span className="slot__time">{slot.time}</span>
              <span className="slot__status">
                {slot.status === "booked" ? <LockIcon size={13} /> : null}
                {statusLabel}
                {slot.status === "booked" && slot.initials ? (
                  <span className="slot__initials">{slot.initials}</span>
                ) : null}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
