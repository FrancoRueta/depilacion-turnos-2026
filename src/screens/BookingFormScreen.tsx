import { useRef, useState } from "react";
import { ZONES } from "../../shared/constants";
import { validateBookingInput } from "../../shared/validation";
import type { BookingDetails, BookingDraft, FieldErrors } from "../../shared/types";
import { Alert } from "../components/Alert";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  InfoIcon,
  PhoneIcon,
  UserIcon,
} from "../components/Icons";
import { SelectionSummary } from "../components/SelectionSummary";
import { Stepper } from "../components/Stepper";

interface BookingFormScreenProps {
  draft: BookingDraft;
  date: string;
  time: string;
  onChange: (draft: BookingDraft) => void;
  onSubmit: (details: BookingDetails) => void;
  onBackToCalendar: () => void;
}

const FIELD_ORDER: Array<keyof FieldErrors> = ["fullName", "age", "zones", "phone"];

export function BookingFormScreen({
  draft,
  date,
  time,
  onChange,
  onSubmit,
  onBackToCalendar,
}: BookingFormScreenProps) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const formRef = useRef<HTMLFormElement>(null);

  function updateField<K extends keyof BookingDraft>(field: K, value: BookingDraft[K]) {
    onChange({ ...draft, [field]: value });
    if (errors[field]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  }

  function toggleZone(zoneId: string) {
    const nextZones = draft.zones.includes(zoneId)
      ? draft.zones.filter((zone) => zone !== zoneId)
      : [...draft.zones, zoneId];
    updateField("zones", nextZones);
  }

  function focusFirstError(fieldErrors: FieldErrors) {
    const firstField = FIELD_ORDER.find((field) => fieldErrors[field]);
    if (!firstField) return;
    requestAnimationFrame(() => {
      if (firstField === "zones") {
        formRef.current?.querySelector<HTMLElement>('input[name="zones"]')?.focus();
      } else {
        formRef.current?.querySelector<HTMLElement>(`#${firstField}`)?.focus();
      }
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateBookingInput(draft);
    if (!result.value) {
      setErrors(result.errors);
      focusFirstError(result.errors);
      return;
    }
    setErrors({});
    onSubmit(result.value);
  }

  return (
    <section className="form-screen screen-enter">
      <div className="page-head page-head--compact">
        <button type="button" className="back-link" onClick={onBackToCalendar}>
          <ArrowLeftIcon size={17} />
          Cambiar fecha u horario
        </button>
        <p className="eyebrow">Nuevo turno</p>
        <h1 className="page-title" data-screen-title tabIndex={-1}>
          Completá tus datos
        </h1>
        <p className="page-lede">
          Usamos esta información para organizar la atención del día.
        </p>
      </div>

      <Stepper current={2} />

      <div className="form-layout">
        <aside className="form-aside">
          <SelectionSummary date={date} time={time} />
          <div className="privacy-card">
            <InfoIcon size={20} />
            <div>
              <strong>Tu privacidad</strong>
              <p>
                En la agenda pública solo se verán tus iniciales. Tus datos completos
                quedan disponibles únicamente para la administración.
              </p>
            </div>
          </div>
        </aside>

        <form ref={formRef} className="panel form-panel" onSubmit={handleSubmit} noValidate>
          {Object.keys(errors).length > 0 ? (
            <Alert tone="danger" title="Revisá los campos marcados">
              Algunos datos necesitan una corrección antes de continuar.
            </Alert>
          ) : null}

          <div className="field-row">
            <div className="field">
              <label htmlFor="fullName">Nombre y apellido</label>
              <div className="input-wrap">
                <UserIcon size={18} />
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="Ej.: María Pérez"
                  value={draft.fullName}
                  onChange={(event) => updateField("fullName", event.target.value)}
                  aria-invalid={Boolean(errors.fullName)}
                  aria-describedby={errors.fullName ? "fullName-error" : undefined}
                  required
                />
              </div>
              {errors.fullName ? (
                <p className="field-error" id="fullName-error" role="alert">
                  {errors.fullName}
                </p>
              ) : null}
            </div>

            <div className="field field--age">
              <label htmlFor="age">Edad</label>
              <input
                id="age"
                name="age"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Ej.: 34"
                value={draft.age}
                onChange={(event) => updateField("age", event.target.value)}
                aria-invalid={Boolean(errors.age)}
                aria-describedby={errors.age ? "age-error" : undefined}
                required
              />
              {errors.age ? (
                <p className="field-error" id="age-error" role="alert">
                  {errors.age}
                </p>
              ) : null}
            </div>
          </div>

          <fieldset
            className="field field--zones"
            aria-invalid={Boolean(errors.zones)}
            aria-describedby={errors.zones ? "zones-error zones-note" : "zones-note"}
          >
            <legend>Zonas a depilar</legend>
            <p className="field-hint">Podés elegir más de una.</p>
            <div className="zone-grid">
              {ZONES.map((zone, index) => (
                <label className="zone-option" key={zone.id}>
                  <input
                    type="checkbox"
                    name="zones"
                    value={zone.id}
                    checked={draft.zones.includes(zone.id)}
                    onChange={() => toggleZone(zone.id)}
                    id={index === 0 ? "zone-first" : undefined}
                  />
                  <span>{zone.label}</span>
                </label>
              ))}
            </div>
            {errors.zones ? (
              <p className="field-error" id="zones-error" role="alert">
                {errors.zones}
              </p>
            ) : null}
            <p className="provisional-note" id="zones-note">
              <InfoIcon size={14} />
              Lista provisional de zonas de ejemplo, pendiente de los nombres oficiales
              del negocio.
            </p>
          </fieldset>

          <div className="field">
            <label htmlFor="phone">Teléfono</label>
            <div className="input-wrap">
              <PhoneIcon size={18} />
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Ej.: 11 5555-5555"
                value={draft.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? "phone-error phone-hint" : "phone-hint"}
                required
              />
            </div>
            <p className="field-hint" id="phone-hint">
              Podés usar +, espacios, guiones y paréntesis.
            </p>
            {errors.phone ? (
              <p className="field-error" id="phone-error" role="alert">
                {errors.phone}
              </p>
            ) : null}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn--primary btn--lg">
              Revisar mis datos
              <ArrowRightIcon size={18} />
            </button>
            <button type="button" className="btn btn--ghost" onClick={onBackToCalendar}>
              Volver al calendario
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
