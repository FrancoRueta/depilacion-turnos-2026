import { CheckIcon } from "./Icons";

const STEPS = ["Fecha y horario", "Tus datos", "Revisión"];

interface StepperProps {
  current: 1 | 2 | 3;
}

export function Stepper({ current }: StepperProps) {
  return (
    <nav className="stepper" aria-label="Pasos para reservar">
      <ol className="stepper__list">
        {STEPS.map((label, index) => {
          const step = (index + 1) as 1 | 2 | 3;
          const complete = step < current;
          const active = step === current;
          return (
            <li
              key={label}
              className={`stepper__item${complete ? " is-complete" : ""}${active ? " is-current" : ""}`}
              aria-current={active ? "step" : undefined}
            >
              <span className="stepper__number" aria-hidden="true">
                {complete ? <CheckIcon size={14} /> : step}
              </span>
              <span className="stepper__label">{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
