import { useCallback, useEffect, useState } from "react";
import { api, ApiRequestError } from "./api";
import { AdminLoginModal } from "./components/admin/AdminLoginModal";
import { LockIcon } from "./components/Icons";
import { AdminScreen } from "./screens/AdminScreen";
import { BookingFormScreen } from "./screens/BookingFormScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { PublicCalendarScreen } from "./screens/PublicCalendarScreen";
import { ReviewScreen } from "./screens/ReviewScreen";
import { SuccessScreen } from "./screens/SuccessScreen";
import { getBusinessToday } from "../shared/dates";
import type {
  BookingConfirmation,
  BookingDetails,
  BookingDraft,
} from "../shared/types";

type Screen = "home" | "calendar" | "form" | "review" | "success" | "admin";
type CalendarMode = "view" | "book";

const EMPTY_DRAFT: BookingDraft = {
  fullName: "",
  age: "",
  zones: [],
  phone: "",
};

const BASE_TITLE = "Turnos de depilación";

const SCREEN_TITLES: Record<Screen, string> = {
  home: "Reservá tu turno",
  calendar: "Calendario de turnos",
  form: "Completar datos",
  review: "Revisar turno",
  success: "Turno confirmado",
  admin: "Administración",
};

export function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [mode, setMode] = useState<CalendarMode>("view");
  const [month, setMonth] = useState(() => getBusinessToday().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [draft, setDraft] = useState<BookingDraft>(EMPTY_DRAFT);
  const [pendingDetails, setPendingDetails] = useState<BookingDetails | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [admin, setAdmin] = useState<{ username: string } | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getAdminSession()
      .then((response) => {
        if (active && response.authenticated && response.username) {
          setAdmin({ username: response.username });
        }
      })
      .catch(() => {
        // La sesión administrativa no es necesaria para el flujo público.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const title = document.querySelector<HTMLElement>("[data-screen-title]");
    title?.focus({ preventScroll: true });
    document.title = `${SCREEN_TITLES[screen]} · ${BASE_TITLE}`;
  }, [screen]);

  useEffect(() => {
    if ((screen === "form" || screen === "review") && (!selectedDate || !selectedTime)) {
      setMode("book");
      setScreen("calendar");
    }
    if (screen === "review" && !pendingDetails) {
      setScreen("form");
    }
    if (screen === "success" && !confirmation) {
      setScreen("home");
    }
  }, [screen, selectedDate, selectedTime, pendingDetails, confirmation]);

  const openLogin = useCallback((notice: string | null = null) => {
    setLoginNotice(notice);
    setLoginOpen(true);
  }, []);

  const handleSessionExpired = useCallback(() => {
    setAdmin(null);
    setScreen("home");
    openLogin("Tu sesión venció. Volvé a ingresar para continuar.");
  }, [openLogin]);

  const goHome = useCallback(() => {
    setScreen("home");
  }, []);

  const startBooking = useCallback(() => {
    setMode("book");
    setMonth(getBusinessToday().slice(0, 7));
    setSelectedDate(null);
    setSelectedTime(null);
    setDraft(EMPTY_DRAFT);
    setPendingDetails(null);
    setConfirmation(null);
    setScreen("calendar");
  }, []);

  const startViewCalendar = useCallback(() => {
    setMode("view");
    setMonth(getBusinessToday().slice(0, 7));
    setSelectedDate(null);
    setSelectedTime(null);
    setScreen("calendar");
  }, []);

  const startBookingFromView = useCallback(() => {
    setMode("book");
    setSelectedTime(null);
    setDraft(EMPTY_DRAFT);
    setPendingDetails(null);
    setConfirmation(null);
  }, []);

  const handleMonthChange = useCallback((nextMonth: string) => {
    setMonth(nextMonth);
    setSelectedDate(null);
    setSelectedTime(null);
  }, []);

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate((current) => {
      if (current !== date) setSelectedTime(null);
      return date;
    });
  }, []);

  const handleClearSlot = useCallback(() => {
    setSelectedTime(null);
  }, []);

  const handleClearDate = useCallback(() => {
    setSelectedDate(null);
    setSelectedTime(null);
  }, []);

  const handleContinue = useCallback(() => {
    if (!selectedDate || !selectedTime) return;
    setScreen("form");
  }, [selectedDate, selectedTime]);

  const handleFormSubmit = useCallback(
    (details: BookingDetails) => {
      setPendingDetails(details);
      setScreen("review");
    },
    [],
  );

  const handleEditData = useCallback(() => {
    setScreen("form");
  }, []);

  const handleChangeSlot = useCallback(() => {
    setMode("book");
    setSelectedTime(null);
    setScreen("calendar");
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!pendingDetails || !selectedDate || !selectedTime) {
      throw new ApiRequestError(
        400,
        "INCOMPLETE_BOOKING",
        "Faltan datos del turno. Volvé a elegir fecha y horario.",
      );
    }
    const result = await api.createBooking({
      ...pendingDetails,
      date: selectedDate,
      startTime: selectedTime,
    });
    setConfirmation(result);
    setScreen("success");
  }, [pendingDetails, selectedDate, selectedTime]);

  const handleSuccessViewCalendar = useCallback(() => {
    if (confirmation) {
      setMonth(confirmation.date.slice(0, 7));
      setSelectedDate(confirmation.date);
    }
    setSelectedTime(null);
    setMode("view");
    setScreen("calendar");
  }, [confirmation]);

  const handleAdminAccess = useCallback(() => {
    if (admin) {
      setScreen("admin");
    } else {
      openLogin();
    }
  }, [admin, openLogin]);

  const handleAdminLogin = useCallback(async (username: string, password: string) => {
    const response = await api.login(username, password);
    if (!response.authenticated) {
      throw new ApiRequestError(401, "INVALID_CREDENTIALS", "Usuario o contraseña incorrectos.");
    }
    setAdmin({ username: response.username ?? username });
    setLoginOpen(false);
    setLoginNotice(null);
    setScreen("admin");
  }, []);

  const handleAdminLogout = useCallback(async () => {
    await api.logout();
    setAdmin(null);
    setLoginOpen(false);
    setLoginNotice(null);
    setScreen("home");
  }, []);

  const handleCloseLogin = useCallback(() => {
    setLoginOpen(false);
    setLoginNotice(null);
  }, []);

  const screenContent = (() => {
    if (screen === "home") {
      return <HomeScreen onStartBooking={startBooking} onViewCalendar={startViewCalendar} />;
    }

    if (screen === "admin" && admin) {
      return (
        <AdminScreen
          username={admin.username}
          initialMonth={month}
          onHome={goHome}
          onLogout={handleAdminLogout}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (screen === "calendar") {
      return (
        <PublicCalendarScreen
          mode={mode}
          month={month}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          onMonthChange={handleMonthChange}
          onSelectDate={handleSelectDate}
          onSelectTime={setSelectedTime}
          onClearSlot={handleClearSlot}
          onClearDate={handleClearDate}
          onContinue={handleContinue}
          onHome={goHome}
          onStartBooking={startBookingFromView}
        />
      );
    }

    if (screen === "form" && selectedDate && selectedTime) {
      return (
        <BookingFormScreen
          draft={draft}
          date={selectedDate}
          time={selectedTime}
          onChange={setDraft}
          onSubmit={handleFormSubmit}
          onBackToCalendar={handleChangeSlot}
        />
      );
    }

    if (screen === "review" && pendingDetails && selectedDate && selectedTime) {
      return (
        <ReviewScreen
          details={pendingDetails}
          date={selectedDate}
          time={selectedTime}
          onEditData={handleEditData}
          onChangeSlot={handleChangeSlot}
          onConfirm={handleConfirm}
        />
      );
    }

    if (screen === "success" && confirmation && pendingDetails) {
      return (
        <SuccessScreen
          confirmation={confirmation}
          details={pendingDetails}
          onViewCalendar={handleSuccessViewCalendar}
          onNewBooking={startBooking}
          onHome={goHome}
        />
      );
    }

    return <HomeScreen onStartBooking={startBooking} onViewCalendar={startViewCalendar} />;
  })();

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>

      <header className="site-header">
        <div className="site-header__inner">
          <button type="button" className="brand" onClick={goHome} aria-label="Ir al inicio">
            <span className="brand__dot" aria-hidden="true" />
            <span>Turnos de depilación</span>
          </button>
          {admin ? (
            <span className="session-pill">
              <span className="session-pill__dot" aria-hidden="true" />
              Administración activa
            </span>
          ) : null}
        </div>
      </header>

      <main className="site-main" id="main-content" tabIndex={-1}>
        <div className="screen-wrap" key={screen}>
          {screenContent}
        </div>
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div>
            <p className="site-footer__title">Turnos de depilación</p>
            <p className="site-footer__note">
              Agenda online. En la vista pública solo se muestran iniciales.
            </p>
          </div>
          {screen === "admin" && admin ? (
            <span className="admin-link admin-link--active">
              <LockIcon size={15} />
              Sesión de administración
            </span>
          ) : (
            <button type="button" className="admin-link" onClick={handleAdminAccess}>
              <LockIcon size={15} />
              Administración
            </button>
          )}
        </div>
      </footer>

      <AdminLoginModal
        open={loginOpen}
        notice={loginNotice}
        onClose={handleCloseLogin}
        onLogin={handleAdminLogin}
      />
    </div>
  );
}
