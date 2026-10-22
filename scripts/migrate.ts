import { createDatabase } from "../server/db";
import { runMigrations } from "../server/migrations";

async function main() {
  const db = await createDatabase();
  try {
    const executed = await runMigrations(db);
    if (executed.length === 0) {
      console.log("La base de datos ya está actualizada.");
    } else {
      console.log(`Migraciones aplicadas: ${executed.join(", ")}`);
    }
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  console.error(
    "No se pudieron aplicar las migraciones:",
    error instanceof Error ? error.message : "error desconocido",
  );
  process.exit(1);
});
