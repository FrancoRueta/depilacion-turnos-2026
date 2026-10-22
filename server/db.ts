import { mkdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import type { PGlite } from "@electric-sql/pglite";

export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string): Promise<void>;
}

export interface Database extends Queryable {
  transaction<T>(callback: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  kind: "pglite" | "postgres";
}

interface DatabaseOptions {
  databaseUrl?: string;
  databaseSsl?: string;
  pgliteDataDir?: string;
  memory?: boolean;
  isProduction?: boolean;
}

function sslConfig(databaseUrl: string, explicit: string | undefined): boolean | { rejectUnauthorized: boolean } {
  if (explicit === "false" || explicit === "disable") return false;
  if (explicit === "true" || explicit === "require") return { rejectUnauthorized: true };
  try {
    const hostname = new URL(databaseUrl).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return false;
    }
  } catch {
    // El driver reportará el error de formato de URL.
  }
  return { rejectUnauthorized: true };
}

class PgliteDatabase implements Database {
  readonly kind = "pglite" as const;

  constructor(private readonly client: PGlite) {}

  async query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
    const result = await this.client.query<T>(text, params as never[] | undefined);
    return result.rows;
  }

  async exec(text: string): Promise<void> {
    await this.client.exec(text);
  }

  async transaction<T>(callback: (tx: Queryable) => Promise<T>): Promise<T> {
    return this.client.transaction(async (transaction) => {
      const tx: Queryable = {
        query: async <R = Record<string, unknown>>(text: string, params?: unknown[]) => {
          const result = await transaction.query<R>(text, params as never[] | undefined);
          return result.rows;
        },
        exec: async (text: string) => {
          await transaction.exec(text);
        },
      };
      return callback(tx);
    });
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

class PostgresDatabase implements Database {
  readonly kind = "postgres" as const;
  private readonly pool: pg.Pool;

  constructor(connectionString: string, ssl: boolean | { rejectUnauthorized: boolean }) {
    this.pool = new pg.Pool({
      connectionString,
      ssl,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    this.pool.on("error", (error) => {
      console.error("Error inesperado en la conexión a PostgreSQL:", error.message);
    });
  }

  async query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query(text, params);
    return result.rows as T[];
  }

  async exec(text: string): Promise<void> {
    await this.pool.query(text);
  }

  async transaction<T>(callback: (tx: Queryable) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const tx: Queryable = {
        query: async <R = Record<string, unknown>>(text: string, params?: unknown[]) => {
          const result = await client.query(text, params);
          return result.rows as R[];
        },
        exec: async (text: string) => {
          await client.query(text);
        },
      };
      const value = await callback(tx);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export async function createDatabase(options: DatabaseOptions = {}): Promise<Database> {
  // `memory` es una elección explícita de base efímera (pruebas): no debe
  // conectarse accidentalmente a la DATABASE_URL configurada en el entorno.
  const databaseUrl =
    options.databaseUrl ?? (options.memory ? undefined : process.env.DATABASE_URL);

  if (databaseUrl) {
    return new PostgresDatabase(
      databaseUrl,
      sslConfig(databaseUrl, options.databaseSsl ?? process.env.DATABASE_SSL),
    );
  }

  if (options.isProduction ?? process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL es obligatoria en producción. Configurá una base PostgreSQL administrada.",
    );
  }

  const { PGlite: PGliteClient } = await import("@electric-sql/pglite");
  let dataDir: string | undefined;
  if (!options.memory) {
    dataDir = path.resolve(options.pgliteDataDir ?? process.env.PGLITE_DATA_DIR ?? ".data/pglite");
    await mkdir(dataDir, { recursive: true });
  }

  const client = new PGliteClient(dataDir);
  await client.waitReady;
  return new PgliteDatabase(client);
}
