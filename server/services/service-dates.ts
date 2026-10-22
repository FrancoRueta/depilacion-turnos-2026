import { randomUUID } from "node:crypto";
import { getBusinessToday } from "../../shared/dates";
import type { ServiceDateConfig } from "../../shared/types";
import { validateServiceDateInput } from "../../shared/validation";
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

interface BookingCountRow {
  total: string;
  invalid: string;
}

function parseServiceDate(body: unknown, today: string): ServiceDateConfig {
  const result = validateServiceDateInput(body, today);
  if (!result.value) {
    throw validationError(result.errors);
  }
  return result.value;
}

async function selectServiceDate(
  db: Queryable,
  id: string,
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
      WHERE id = $1
      LIMIT 1${lockClause}`,
    [id],
  );
  return rows[0] ?? null;
}

export async function createServiceDate(
  db: Database,
  body: unknown,
  now: Date = new Date(),
): Promise<{ id: string }> {
  const today = getBusinessToday(now);
  const config = parseServiceDate(body, today);
  const id = randomUUID();

  try {
    await db.query(
      `INSERT INTO service_dates (id, date, open_time, close_time, active)
       VALUES ($1, $2::date, $3::time, $4::time, $5)`,
      [id, config.date, config.openTime, config.closeTime, config.active],
    );
    return { id };
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

export async function updateServiceDate(
  db: Database,
  id: string,
  body: unknown,
  now: Date = new Date(),
): Promise<void> {
  const today = getBusinessToday(now);
  const config = parseServiceDate(body, today);

  try {
    await db.transaction(async (tx) => {
      const existing = await selectServiceDate(tx, id, "update");
      if (!existing) {
        throw new ApiError(404, "DATE_NOT_FOUND", "La fecha de atención ya no existe.");
      }

      const countRows = await tx.query<BookingCountRow>(
        `SELECT count(*)::text AS total,
                count(*) FILTER (
                  WHERE start_time < $2::time
                     OR start_time + interval '30 minutes' > $3::time
                )::text AS invalid
           FROM bookings
          WHERE service_date_id = $1`,
        [id, config.openTime, config.closeTime],
      );
      const total = Number(countRows[0]?.total ?? "0");
      const invalid = Number(countRows[0]?.invalid ?? "0");
      const dateChanged = existing.date !== config.date;
      const deactivating = existing.active && !config.active;

      if ((dateChanged || deactivating) && total > 0) {
        throw new ApiError(
          409,
          "DATE_HAS_BOOKINGS",
          dateChanged
            ? "Para cambiar la fecha primero resolvé las reservas existentes: cancelalas o reubicalas."
            : "Para desactivar la fecha primero resolvé las reservas existentes.",
          { details: { bookingCount: total } },
        );
      }

      if (!dateChanged && invalid > 0) {
        throw new ApiError(
          409,
          "DATE_CHANGE_INVALIDATES_BOOKINGS",
          "El nuevo rango horario deja reservas fuera de la grilla. Reubicá o cancelá esos turnos primero.",
          { details: { bookingCount: invalid } },
        );
      }

      await tx.query(
        `UPDATE service_dates
            SET date = $1::date,
                open_time = $2::time,
                close_time = $3::time,
                active = $4,
                updated_at = now()
          WHERE id = $5`,
        [config.date, config.openTime, config.closeTime, config.active, id],
      );
    });
  } catch (error) {
    if (isApiError(error)) throw error;
    throw mapDatabaseError(error);
  }
}

export async function deleteServiceDate(db: Database, id: string): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const existing = await selectServiceDate(tx, id, "update");
      if (!existing) {
        throw new ApiError(404, "DATE_NOT_FOUND", "La fecha de atención ya no existe.");
      }

      const countRows = await tx.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM bookings WHERE service_date_id = $1",
        [id],
      );
      const total = Number(countRows[0]?.count ?? "0");
      if (total > 0) {
        throw new ApiError(
          409,
          "DATE_HAS_BOOKINGS",
          "La fecha tiene reservas. Para eliminarla, primero cancelá o reubicá esos turnos.",
          { details: { bookingCount: total } },
        );
      }

      await tx.query("DELETE FROM service_dates WHERE id = $1", [id]);
    });
  } catch (error) {
    if (isApiError(error)) throw error;
    throw mapDatabaseError(error);
  }
}
