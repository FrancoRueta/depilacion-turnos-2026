import { config, getPort } from "./config";
import { createApp } from "./app";
import { createDatabase } from "./db";
import { runMigrations } from "./migrations";
import { countAdmins } from "./auth";
import { createCallMeBotNotifier } from "./notifications";

async function main(): Promise<void> {
  const db = await createDatabase();
  await runMigrations(db);
  const notifier =
    createCallMeBotNotifier({
      phone: config.callMeBotPhone,
      apiKey: config.callMeBotApiKey,
    }) ?? undefined;
  const app = createApp({ db, notifier });
  const port = getPort();
  const admins = await countAdmins(db);

  const server = app.listen(port, config.host, () => {
    console.log(`Servidor iniciado en http://localhost:${port} (${db.kind})`);
    console.log(
      admins > 0
        ? "Administración configurada."
        : "Administración sin configurar: ejecutá npm run admin:create.",
    );
    console.log(
      notifier
        ? "Avisos por WhatsApp activados."
        : "Avisos por WhatsApp desactivados: configurá CALLMEBOT_PHONE y CALLMEBOT_API_KEY para activarlos.",
    );
  });

  server.on("error", (error) => {
    console.error("No se pudo iniciar el servidor:", error.message);
    process.exitCode = 1;
  });

  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    console.log(`Cerrando servidor (${signal})...`);
    server.close(() => {
      db.close()
        .catch(() => undefined)
        .finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  console.error(
    "No se pudo iniciar la aplicación:",
    error instanceof Error ? error.message : "error desconocido",
  );
  process.exit(1);
});
