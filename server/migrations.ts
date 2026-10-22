import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Database } from "./db";

export async function runMigrations(
  db: Database,
  migrationsDir = path.join(process.cwd(), "migrations"),
): Promise<string[]> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const entries = await readdir(migrationsDir);
  const files = entries.filter((entry) => entry.endsWith(".sql")).sort();
  const appliedRows = await db.query<{ name: string }>("SELECT name FROM schema_migrations");
  const applied = new Set(appliedRows.map((row) => row.name));
  const executed: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    });
    executed.push(file);
  }

  return executed;
}
