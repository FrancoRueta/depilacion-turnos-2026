import { ArrowRightIcon, CalendarIcon, LockIcon, SparkIcon } from "../components/Icons";

interface HomeScreenProps {
  onStartBooking: () => void;
  onViewCalendar: () => void;
}

export function HomeScreen({ onStartBooking, onViewCalendar }: HomeScreenProps) {
  return (
    <section className="home-screen screen-enter">
      <div className="home-hero">
        <div className="home-hero__content">
          <p className="eyebrow">Reservas online</p>
          <h1 className="display-title" data-screen-title tabIndex={-1}>
            Turnos de depilación
          </h1>
          <p className="lede">
            Elegí una fecha disponible, reservá el horario que mejor te quede y listo.
            Sin llamados ni esperas.
          </p>
          <div className="home-actions">
            <button type="button" className="btn btn--primary btn--lg" onClick={onStartBooking}>
              Crear turno
              <ArrowRightIcon size={19} />
            </button>
            <button type="button" className="btn btn--secondary btn--lg" onClick={onViewCalendar}>
              <CalendarIcon size={19} />
              Ver calendario
            </button>
          </div>
          <p className="privacy-line">
            <LockIcon size={16} />
            En la agenda pública solo se muestran las iniciales de quien reservó.
          </p>
        </div>

        <aside className="home-card" aria-labelledby="home-card-title">
          <div className="home-card__ornament" aria-hidden="true">
            <SparkIcon size={22} />
          </div>
          <p className="home-card__kicker">Así de simple</p>
          <h2 id="home-card-title" className="home-card__title">
            Tu momento, en tres pasos
          </h2>
          <ol className="how-list">
            <li>
              <span className="how-list__number">01</span>
              <span>
                <strong>Elegí la fecha</strong>
                <span>Mirá las fechas de atención publicadas.</span>
              </span>
            </li>
            <li>
              <span className="how-list__number">02</span>
              <span>
                <strong>Seleccioná un horario</strong>
                <span>Los turnos son de 30 minutos.</span>
              </span>
            </li>
            <li>
              <span className="how-list__number">03</span>
              <span>
                <strong>Confirmá tus datos</strong>
                <span>Revisá la información y guardá tu reserva.</span>
              </span>
            </li>
          </ol>
        </aside>
      </div>

      <div className="home-footnote">
        <p>
          ¿Solo querés mirar? Podés consultar la agenda sin iniciar una reserva.
        </p>
        <button type="button" className="text-button" onClick={onViewCalendar}>
          Consultar disponibilidad
          <ArrowRightIcon size={16} />
        </button>
      </div>
    </section>
  );
}
