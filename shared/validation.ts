import {
  DAY_CLOSE_MAX_MINUTES,
  DAY_OPEN_MINUTES,
  ZONE_IDS,
  ZONES,
} from "./constants";
import {
  isHalfHourTime,
  isTimeWithinBusinessWindow,
  isValidDateString,
  isValidTimeString,
  timeToMinutes,
} from "./dates";
import type {
  BookingDetails,
  FieldErrors,
  ServiceDateConfig,
} from "./types";

export interface ValidationResult<T> {
  value?: T;
  errors: FieldErrors;
}

function asRecord(input: unknown): Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

function normalizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function validateBookingInput(input: unknown): ValidationResult<BookingDetails> {
  const record = asRecord(input);
  const errors: FieldErrors = {};

  const fullName = normalizeSpaces(typeof record.fullName === "string" ? record.fullName : "");
  if (fullName.length < 3) {
    errors.fullName = "Ingresá tu nombre y apellido.";
  } else if (fullName.length > 120) {
    errors.fullName = "El nombre no puede superar los 120 caracteres.";
  } else if (!/\p{L}/u.test(fullName)) {
    errors.fullName = "Ingresá un nombre válido.";
  }

  const rawAge =
    typeof record.age === "number"
      ? String(record.age)
      : typeof record.age === "string"
        ? record.age.trim()
        : "";
  const age = /^\d+$/.test(rawAge) ? Number(rawAge) : Number.NaN;
  if (!Number.isSafeInteger(age) || age <= 0 || age > 2_147_483_647) {
    errors.age = "Ingresá una edad válida en números enteros.";
  }

  const rawZones = Array.isArray(record.zones) ? record.zones : [];
  const zones = Array.from(
    new Set(rawZones.filter((zone): zone is string => typeof zone === "string")),
  );
  if (zones.length === 0) {
    errors.zones = "Elegí al menos una zona.";
  } else if (zones.some((zone) => !ZONE_IDS.includes(zone as (typeof ZONE_IDS)[number]))) {
    errors.zones = "Alguna de las zonas elegidas no es válida.";
  } else if (zones.length > ZONES.length) {
    errors.zones = "La selección de zonas no es válida.";
  }

  const phone = normalizeSpaces(typeof record.phone === "string" ? record.phone : "");
  const phoneDigits = phone.replace(/\D/g, "");
  if (!phone) {
    errors.phone = "Ingresá un teléfono de contacto.";
  } else if (phone.length > 30) {
    errors.phone = "El teléfono es demasiado largo.";
  } else if (!/^\+?[\d\s().-]+$/.test(phone) || phone.indexOf("+") > 0) {
    errors.phone = "Usá solo números, espacios, guiones, paréntesis y un + inicial.";
  } else if (phoneDigits.length < 8 || phoneDigits.length > 15) {
    errors.phone = "El teléfono debe tener entre 8 y 15 dígitos.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const orderedZones = ZONES.map((zone) => zone.id).filter((id) => zones.includes(id));

  return {
    errors,
    value: {
      fullName,
      age,
      zones: orderedZones,
      phone,
    },
  };
}

export function validateServiceDateInput(
  input: unknown,
  today: string,
): ValidationResult<ServiceDateConfig> {
  const record = asRecord(input);
  const errors: FieldErrors = {};

  const date = typeof record.date === "string" ? record.date.trim() : "";
  if (!isValidDateString(date)) {
    errors.date = "Elegí una fecha válida.";
  } else if (date < today) {
    errors.date = "La fecha de atención no puede ser pasada.";
  } else {
    const [year, month, day] = date.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
    if (weekday !== 0 && weekday !== 5 && weekday !== 6) {
      errors.date = "La fecha de atención debe ser viernes, sábado o domingo.";
    }
  }

  const openTime = typeof record.openTime === "string" ? record.openTime : "";
  const closeTime = typeof record.closeTime === "string" ? record.closeTime : "";
  if (!isValidTimeString(openTime) || !isHalfHourTime(openTime)) {
    errors.openTime = "La apertura debe ser una hora válida en bloques de 30 minutos.";
  } else if (
    !isTimeWithinBusinessWindow(openTime) ||
    (timeToMinutes(openTime) ?? 0) < DAY_OPEN_MINUTES
  ) {
    errors.openTime = "La apertura debe estar entre las 06:00 y las 22:00.";
  }

  if (!isValidTimeString(closeTime) || !isHalfHourTime(closeTime)) {
    errors.closeTime = "El cierre debe ser una hora válida en bloques de 30 minutos.";
  } else if (
    !isTimeWithinBusinessWindow(closeTime) ||
    (timeToMinutes(closeTime) ?? 0) > DAY_CLOSE_MAX_MINUTES
  ) {
    errors.closeTime = "El cierre debe estar entre las 06:00 y las 22:00.";
  }

  if (!errors.openTime && !errors.closeTime) {
    const openMinutes = timeToMinutes(openTime) ?? 0;
    const closeMinutes = timeToMinutes(closeTime) ?? 0;
    if (openMinutes >= closeMinutes) {
      errors.closeTime = "El cierre debe ser posterior a la apertura.";
    }
  }

  const active = record.active === undefined ? true : record.active;
  if (typeof active !== "boolean") {
    errors.active = "El estado de la fecha no es válido.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    errors,
    value: {
      date,
      openTime,
      closeTime,
      active: active as boolean,
    },
  };
}

export function isInsideServiceWindow(
  time: string,
  openTime: string,
  closeTime: string,
): boolean {
  const start = timeToMinutes(time);
  const open = timeToMinutes(openTime);
  const close = timeToMinutes(closeTime);
  if (start === null || open === null || close === null) return false;
  return start >= open && start + 30 <= close;
}
