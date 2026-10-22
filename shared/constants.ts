export const BUSINESS_TIME_ZONE = "America/Argentina/Buenos_Aires";

export const SLOT_MINUTES = 30;
export const DAY_OPEN_MINUTES = 6 * 60;
export const DAY_CLOSE_MAX_MINUTES = 22 * 60;
export const DEFAULT_OPEN_TIME = "08:00";
export const DEFAULT_CLOSE_TIME = "18:00";

export const SESSION_DURATION_HOURS = 12;
export const ADMIN_SESSION_COOKIE = "turnos_admin";
export const ADMIN_REQUEST_HEADER = "x-admin-request";
export const ADMIN_REQUEST_HEADER_VALUE = "turnos-admin";

/**
 * PROVISIONAL: esta lista es un juego de ejemplos mientras el negocio
 * define las zonas oficiales. Se puede reemplazar centralizadamente aquí
 * (y volver a desplegar); no representa el catálogo definitivo.
 */
export const ZONES = [
  { id: "axilas", label: "Axilas" },
  { id: "brazos", label: "Brazos" },
  { id: "piernas", label: "Piernas" },
  { id: "cavado", label: "Cavado" },
  { id: "bozo", label: "Bozo" },
  { id: "zona-intima", label: "Zona íntima" },
  { id: "espalda", label: "Espalda" },
] as const;

export const ZONE_IDS = ZONES.map((zone) => zone.id);
export const ZONE_LABELS: Record<string, string> = Object.fromEntries(
  ZONES.map((zone) => [zone.id, zone.label]),
);

export const WEEKDAY_LABELS = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
] as const;

export const WEEKDAY_SHORT_LABELS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"] as const;

export const PUBLIC_STATUS_LABELS = {
  available: "Libre",
  booked: "Ocupado",
  past: "Finalizado",
} as const;
