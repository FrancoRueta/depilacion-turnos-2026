import { randomUUID } from "node:crypto";
import { addMonths, formatLongDate, getBusinessToday, isWeekendDate } from "../shared/dates";
import { createDatabase } from "../server/db";
import { runMigrations } from "../server/migrations";

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days, 12));
  return next.toISOString().slice(0, 10);
}

function findNextWeekendDate(start: string, preferredWeekday: 5 | 6): string {
  let candidate = addDays(start, 1);
  for (let index = 0; index < 14; index += 1) {
    const [year, month, day] = candidate.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
    if (weekday === preferredWeekday) return candidate;
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("El seed de demostración no puede ejecutarse en producción.");
  }
  if (process.env.DATABASE_URL && process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error(
      "Hay una DATABASE_URL configurada. Si es una base de prueba, ejecutá con ALLOW_DEMO_SEED=1. Nunca lo uses en producción.",
    );
  }

  const db = await createDatabase();
  try {
    await runMigrations(db);
    const today = getBusinessToday();
    const friday = findNextWeekendDate(today, 5);
    let dates = [
      friday,
      addDays(friday, 1),
      findNextWeekendDate(`${addMonths(today.slice(0, 7), 1)}-01`, 6),
    ];

    dates = Array.from(new Set(dates)).filter(
      (date) => date > today && isWeekendDate(date),
    );

    for (const date of dates) {
      await db.query(
        `INSERT INTO service_dates (id, date, open_time, close_time, active)
         VALUES ($1, $2::date, '08:00', '18:00', TRUE)
         ON CONFLICT (date) DO NOTHING`,
        [randomUUID(), date],
      );
    }

    console.log("Datos de demostración cargados (solo desarrollo):");
    for (const date of dates) {
      console.log(`- ${formatLongDate(date)} · 08:00 a 18:00`);
    }
    console.log("No se crearon reservas ni credenciales.");
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  console.error(
    "No se pudieron cargar los datos de demostración:",
    error instanceof Error ? error.message : "error desconocido",
  );
  process.exit(1);
});
