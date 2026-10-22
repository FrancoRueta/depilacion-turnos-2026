import { ApiError } from "./errors";

interface PostgresErrorLike {
  code?: string;
  constraint?: string;
  message?: string;
}

function getPostgresError(error: unknown): PostgresErrorLike | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as PostgresErrorLike;
  return typeof candidate.code === "string" ? candidate : null;
}

/**
 * Convierte errores de integridad conocidos en respuestas públicas y
 * recuperables. Nunca expone el mensaje crudo del motor.
 */
export function mapDatabaseError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  const databaseError = getPostgresError(error);
  if (!databaseError) {
    return new ApiError(
      500,
      "INTERNAL_ERROR",
      "No pudimos completar la operación. Intentá nuevamente.",
    );
  }

  const constraint = databaseError.constraint ?? "";
  const message = databaseError.message ?? "";

  if (databaseError.code === "23505") {
    if (constraint.includes("bookings_slot_unique")) {
      return new ApiError(
        409,
        "SLOT_TAKEN",
        "Ese horario acaba de ocuparse. Elegí otro horario para continuar.",
      );
    }
    if (constraint.includes("service_dates_date_unique")) {
      return new ApiError(409, "DATE_EXISTS", "Ya existe una fecha de atención configurada para ese día.");
    }
    return new ApiError(409, "CONFLICT", "El dato ya existe. Revisá la información e intentá nuevamente.");
  }

  if (databaseError.code === "23514" || databaseError.code === "23503") {
    if (message.includes("service_date_has_bookings")) {
      return new ApiError(
        409,
        "DATE_HAS_BOOKINGS",
        "La fecha tiene reservas. Cancelá o reubicá esas reservas antes de eliminarla o desactivarla.",
      );
    }
    if (message.includes("service_date_change_invalidates_bookings")) {
      return new ApiError(
        409,
        "DATE_CHANGE_INVALIDATES_BOOKINGS",
        "El nuevo horario deja reservas fuera de la grilla. Reubicá o cancelá esos turnos primero.",
      );
    }
    if (
      message.includes("service_date_inactive") ||
      message.includes("service_date_past") ||
      message.includes("booking_slot_past")
    ) {
      return new ApiError(
        409,
        "SLOT_UNAVAILABLE",
        "Ese horario ya no está disponible. Volvé a elegir fecha y horario.",
      );
    }
    if (message.includes("booking_outside_service_window")) {
      return new ApiError(
        409,
        "SLOT_UNAVAILABLE",
        "El horario no pertenece a la grilla configurada para esa fecha.",
      );
    }
    return new ApiError(400, "INVALID_DATA", "Alguno de los datos no cumple las reglas del sistema.");
  }

  return new ApiError(
    500,
    "INTERNAL_ERROR",
    "No pudimos completar la operación. Intentá nuevamente.",
  );
}
