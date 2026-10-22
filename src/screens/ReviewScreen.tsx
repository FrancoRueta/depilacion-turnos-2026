import { useState } from "react";
import { ApiRequestError } from "../api";
import { ZONE_LABELS } from "../../shared/constants";
import { formatLongDateCapitalized } from "../../shared/dates";
import type { BookingDetails } from "../../shared/types";
import { Alert } from "../components/Alert";
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  PencilIcon,
} from "../components/Icons";
import { Stepper } from "../components/Stepper";

interface ReviewScreenProps {
  details: BookingDetails;
  date: string;
  time: string;
  onEditData: () => void;
  onChangeSlot: () => void;
  onConfirm: () => Promise<void>;
}

interface ReviewError {
  code: string;
  message: string;
  recoverableSlot: boolean;
}

export function ReviewScreen({
  details,
  date,
  time,
  onEditData,
  onChangeSlot,
  onConfirm,
}: ReviewScreenProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ReviewError | null>(null);

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        const recoverable = [
          "SLOT_TAKEN",
          "SLOT_PAST",
          "SLOT_UNAVAILABLE",
          "DATE_UNAVAILABLE",
        ].includes(requestError.code);
        setError({
          code: requestError.code,
          message: requestError.message,
          recoverableSlot: recoverable,
        });
      } else {
        setError({
          code: "UNKNOWN",
          message: "No pudimos confirmar el turno. Intentá nuevamente.",
          recoverableSlot: false,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="review-screen screen-enter">
      <div className="page-head page-head--compact">
        <button type="button" className="back-link" onClick={onEditData}>
          <ArrowLeftIcon size={17} />
          Modificar datos
        </button>
        <p className="eyebrow">Nuevo turno</p>
        <h1 className="page-title" data-screen-title tabIndex={-1}>
          Revisá tu turno
        </h1>
        <p className="page-lede">
          Confirmá que todo esté bien. La reserva todavía no fue guardada.
        </p>
      </div>

      <Stepper current={3} />

      <div className="review-layout">
        <div className="review-main">
          {error ? (
            <Alert
              tone="danger"
              title={error.recoverableSlot ? "El horario ya no está disponible" : "No pudimos confirmar el turno"}
              action={
                error.recoverableSlot ? (
                  <button type="button" className="btn btn--secondary btn--sm" onClick={onChangeSlot}>
                    <ArrowLeftIcon size={16} />
                    Elegir otro horario
                  </button>
                ) : undefined
              }
            >
              {error.message}
            </Alert>
          ) : null}

          <div className="panel review-panel">
            <div className="review-section">
              <div className="review-section__heading">
                <h2>
                  <CalendarIcon size={19} />
                  Fecha y horario
                </h2>
                <button type="button" className="text-button" onClick={onChangeSlot}>
                  Cambiar fecha u horario
                </button>
              </div>
              <div className="review-datetime">
                <div>
                  <span className="review-label">Fecha</span>
                  <strong>{formatLongDateCapitalized(date)}</strong>
                </div>
                <div>
                  <span className="review-label">Horario</span>
                  <strong>
                    <ClockIcon size={17} />
                    {time} hs
                  </strong>
                </div>
              </div>
            </div>

            <div className="review-section">
              <div className="review-section__heading">
                <h2>
                  <PencilIcon size={18} />
                  Tus datos
                </h2>
                <button type="button" className="text-button" onClick={onEditData}>
                  Modificar datos
                </button>
              </div>
              <dl className="review-data">
                <div>
                  <dt>Nombre y apellido</dt>
                  <dd>{details.fullName}</dd>
                </div>
                <div>
                  <dt>Edad</dt>
                  <dd>{details.age} años</dd>
                </div>
                <div>
                  <dt>Teléfono</dt>
                  <dd>{details.phone}</dd>
                </div>
                <div className="review-data__full">
                  <dt>Zonas a depilar</dt>
                  <dd>
                    <ul className="tag-list" aria-label="Zonas seleccionadas">
                      {details.zones.map((zone) => (
                        <li key={zone}>{ZONE_LABELS[zone] ?? zone}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <p className="privacy-line">
            <LockIcon size={16} />
            La agenda pública mostrará únicamente tus iniciales en este horario.
          </p>
        </div>

        <aside className="panel review-confirm">
          <h2>Confirmar reserva</h2>
          <p>
            El turno queda reservado de inmediato. Si el horario se ocupó mientras
            completabas tus datos, te avisaremos antes de guardar.
          </p>
          <button
            type="button"
            className="btn btn--primary btn--lg btn--block"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Confirmando…
              </>
            ) : (
              <>
                <CheckIcon size={19} />
                Confirmar turno
              </>
            )}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={onEditData}
            disabled={submitting}
          >
            Modificar datos
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={onChangeSlot}
            disabled={submitting}
          >
            Cambiar fecha u horario
          </button>
        </aside>
      </div>
    </section>
  );
}
