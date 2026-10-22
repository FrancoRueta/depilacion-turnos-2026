import { randomUUID } from "node:crypto";
import {
  getBusinessNow,
  getBusinessToday,
  isHalfHourTime,
  isSlotPast,
  isValidDateString,
  isValidTimeString,
} from "../../shared/dates";
import { isInsideServiceWindow, validateBookingInput } from "../../shared/validation";
import type { BookingConfirmation, BookingDetails } from "../../shared/types";
import type { Database, Queryable } from "../db";
import { mapDatabaseError } from "../db-errors";
import { ApiError, isApiError, validationError } from "../errors";

interface ServiceDateRow {
  id: string;
  date: string;
  open_time: string;
  close_time: string;
  active: boolean;
}

interface ExistingBookingRow {
  id: string;
  service_date_id: string;
  date: string;
  start_time: string;
}

interface InsertedBookingRow {
  created_at: string;
}

function parseDetails(body: unknown): {
  details: BookingDetails;
  date: string;
  startTime: string;
} {
  const record =
    body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const validation = validateBookingInput(body);
  const errors = { ...validation.errors };

  const date = typeof record.date === "string" ? record.date : "";
  const startTime = typeof record.startTime === "string" ? record.startTime : "";

  if (!isValidDateString(date)) {
    errors.date = "Elegí una fecha válida.";
  }
  if (!isValidTimeString(startTime)) {
    errors.startTime = "Elegí un horario válido.";
  }

  if (Object.keys(errors).length > 0 || !validation.value) {
    throw validationError(errors);
  }

  return {
    details: validation.value,
    date,
    startTime,
  };
}

async function getServiceDateByDate(
  db: Queryable,
  date: string,
  lock: "share" | "update" | "none" = "none",
): Promise<ServiceDateRow | null> {
  const lockClause = lock === "share" ? " FOR SHARE" : lock === "update" ? " FOR UPDATE" : "";
  const rows = await db.query<ServiceDateRow>(
    `SELECT id,
            to_char(date, 'YYYY-MM-DD') AS date,
            to_char(open_time, 'HH24:MI') AS open_time,
            to_char(close_time, 'HH24:MI') AS close_time,
            active
       FROM service_dates
      WHERE date = $1::date
      LIMIT 1${lockClause}`,
    [date],
  );
  return rows[0] ?? null;
}

function validateSlotAgainstServiceDate(
  serviceDate: ServiceDateRow | null,
  date: string,
  startTime: string,
  now: Date,
): asserts serviceDate is ServiceDateRow {
  if (!serviceDate) {
    throw new ApiError(
      409,
      "DATE_UNAVAILABLE",
      "La fecha elegida ya no está disponible. Volvé a elegir otra fecha.",
    );
  }
  if (!serviceDate.active) {
    throw new ApiError(
      409,
      "DATE_UNAVAILABLE",
      "La fecha elegida ya no está habilitada. Volvé a elegir otra fecha.",
    );
  }
  if (!isHalfHourTime(startTime)) {
    throw new ApiError(
      409,
      "SLOT_UNAVAILABLE",
      "El horario no pertenece a la grilla de turnos. Elegí otro horario.",
    );
  }
  if (!isInsideServiceWindow(startTime, serviceDate.open_time, serviceDate.close_time)) {
    throw new ApiError(
      409,
      "SLOT_UNAVAILABLE",
      "El horario no pertenece al rango de atención. Elegí otro horario.",
    );
  }
  if (date < getBusinessToday(now) || isSlotPast(date, startTime, now)) {
    throw new ApiError(409, "SLOT_PAST", "Ese horario ya pasó. Elegí otro horario disponible.");
  }
}

export async function createPublicBooking(
  db: Database,
  body: unknown,
  now: Date = new Date(),
): Promise<BookingConfirmation> {
  const { details, date, startTime } = parseDetails(body);

  try {
    return await db.transaction(async (tx) => {
      const serviceDate = await getServiceDateByDate(tx, date, "share");
      validateSlotAgainstServiceDate(serviceDate, date, startTime, now);

      const rows = await tx.query<InsertedBookingRow>(
        `INSERT INTO bookings
           (id, service_date_id, start_time, full_name, age, zones, phone)
         VALUES ($1, $2, $3::time, $4, $5, $6, $7)
         ON CONFLICT ON CONSTRAINT bookings_slot_unique DO NOTHING
         RETURNING to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at`,
        [
          randomUUID(),
          serviceDate.id,
          startTime,
          details.fullName,
          details.age,
          details.zones,
          details.phone,
        ],
      );

      const inserted = rows[0];
      if (!inserted) {
        throw new ApiError(
          409,
          "SLOT_TAKEN",
          "Ese horario acaba de ocuparse. Elegí otro horario para continuar.",
        );
      }

      return {
        date,
        startTime,
        createdAt: inserted.created_at,
      };
    });
  } catch (error) {
    if (isApiError(error)) throw error;
    throw mapDatabaseError(error);
  }
}

export async function updateAdminBooking(
  db: Database,
  bookingId: string,
  body: unknown,
  now: Date = new Date(),
): Promise<void> {
  const { details, date, startTime } = parseDetails(body);
  const today = getBusinessToday(now);

  try {
    await db.transaction(async (tx) => {
      const existingRows = await tx.query<ExistingBookingRow>(
        `SELECT b.id,
                b.service_date_id,
                to_char(sd.date, 'YYYY-MM-DD') AS date,
                to_char(b.start_time, 'HH24:MI') AS start_time
           FROM bookings b
           JOIN service_dates sd ON sd.id = b.service_date_id
          WHERE b.id = $1
          FOR UPDATE OF b`,
        [bookingId],
      );

      const existing = existingRows[0];
      if (!existing) {
        throw new ApiError(404, "BOOKING_NOT_FOUND", "La reserva ya no existe.");
      }

      const scheduleChanged = existing.date !== date || existing.start_time !== startTime;

      if (scheduleChanged) {
        const targetDate = await getServiceDateByDate(tx, date, "share");
        validateSlotAgainstServiceDate(targetDate, date, startTime, now);

        const conflictRows = await tx.query<{ id: string }>(
          `SELECT id FROM bookings
            WHERE service_date_id = $1
              AND start_time = $2::time
              AND id <> $3
            LIMIT 1`,
          [targetDate.id, startTime, bookingId],
        );
        if (conflictRows[0]) {
          throw new ApiError(
            409,
            "SLOT_TAKEN",
            "El horario de destino ya está ocupado. Elegí otro.",
          );
        }

        await tx.query(
          `UPDATE bookings
              SET full_name = $1,
                  age = $2,
                  zones = $3,
                  phone = $4,
                  service_date_id = $5,
                  start_time = $6::time,
                  updated_at = now()
            WHERE id = $7`,
          [
            details.fullName,
            details.age,
            details.zones,
            details.phone,
            targetDate.id,
            startTime,
            bookingId,
          ],
        );
      } else {
        await tx.query(
          `UPDATE bookings
              SET full_name = $1,
                  age = $2,
                  zones = $3,
                  phone = $4,
                  updated_at = now()
            WHERE id = $5`,
          [details.fullName, details.age, details.zones, details.phone, bookingId],
        );
      }

      if (existing.date < today) {
        // La edición de datos de una reserva histórica es válida. No se
        // permite reubicarla al pasado porque validateSlotAgainstServiceDate
        // solo se ejecuta cuando el horario cambia.
      }
    });
  } catch (error) {
    if (isApiError(error)) throw error;
    throw mapDatabaseError(error);
  }
}

export async function deleteAdminBooking(db: Database, bookingId: string): Promise<void> {
  try {
    const rows = await db.query<{ id: string }>(
      "DELETE FROM bookings WHERE id = $1 RETURNING id",
      [bookingId],
    );
    if (!rows[0]) {
      throw new ApiError(404, "BOOKING_NOT_FOUND", "La reserva ya no existe.");
    }
  } catch (error) {
    if (isApiError(error)) throw error;
    throw mapDatabaseError(error);
  }
}

export function parseBookingId(value: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export { getBusinessNow };
