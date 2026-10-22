import { ZONE_LABELS } from "../../shared/constants";
import { formatLongDateCapitalized } from "../../shared/dates";
import type { BookingConfirmation, BookingDetails } from "../../shared/types";
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  LockIcon,
} from "../components/Icons";

interface SuccessScreenProps {
  confirmation: BookingConfirmation;
  details: BookingDetails;
  onViewCalendar: () => void;
  onNewBooking: () => void;
  onHome: () => void;
}

export function SuccessScreen({
  confirmation,
  details,
  onViewCalendar,
  onNewBooking,
  onHome,
}: SuccessScreenProps) {
  return (
    <section className="success-screen screen-enter">
      <div className="success-hero">
        <span className="success-hero__icon" aria-hidden="true">
          <CheckCircleIcon size={42} />
        </span>
        <p className="eyebrow">Reserva guardada</p>
        <h1 className="page-title page-title--success" data-screen-title tabIndex={-1}>
          Turno confirmado
        </h1>
        <p className="page-lede">
          Listo, {details.fullName.split(" ")[0]}. Tu turno quedó registrado y el horario
          ya figura como ocupado en la agenda.
        </p>
      </div>

      <div className="panel success-card">
        <div className="success-card__date">
          <span className="success-card__label">
            <CalendarIcon size={18} />
            Fecha
          </span>
          <strong>{formatLongDateCapitalized(confirmation.date)}</strong>
        </div>
        <div className="success-card__time">
          <span className="success-card__label">
            <ClockIcon size={18} />
            Horario
          </span>
          <strong>{confirmation.startTime} hs</strong>
        </div>
        <div className="success-card__zones">
          <span className="success-card__label">Zonas</span>
          <ul className="tag-list">
            {details.zones.map((zone) => (
              <li key={zone}>{ZONE_LABELS[zone] ?? zone}</li>
            ))}
          </ul>
        </div>
        <p className="privacy-line">
          <LockIcon size={16} />
          En la agenda pública solo se verán tus iniciales.
        </p>
      </div>

      <div className="success-actions">
        <button type="button" className="btn btn--primary btn--lg" onClick={onViewCalendar}>
          Ver el calendario
          <ArrowRightIcon size={18} />
        </button>
        <button type="button" className="btn btn--secondary" onClick={onNewBooking}>
          Reservar otro turno
        </button>
        <button type="button" className="btn btn--ghost" onClick={onHome}>
          Volver al inicio
        </button>
      </div>
    </section>
  );
}
