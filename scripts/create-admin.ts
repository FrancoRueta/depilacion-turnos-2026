import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  countAdmins,
  createOrUpdateSingleAdmin,
  isValidAdminPassword,
  isValidAdminUsername,
} from "../server/auth";
import { createDatabase } from "../server/db";
import { runMigrations } from "../server/migrations";

function readArgument(name: string): string | undefined {
  const prefix = `--${name}=`;
  const argument = process.argv.find((item) => item.startsWith(prefix));
  return argument?.slice(prefix.length);
}

async function promptText(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function promptHidden(question: string): Promise<string> {
  if (!stdin.isTTY) {
    throw new Error(
      "La entrada no es interactiva. Definí ADMIN_USERNAME y ADMIN_PASSWORD para ejecutar el script.",
    );
  }

  return new Promise((resolve, reject) => {
    stdout.write(question);
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";

    const cleanup = () => {
      stdin.setRawMode(Boolean(wasRaw));
      stdin.pause();
      stdin.off("data", onData);
      stdout.write("\n");
    };

    const onData = (chunk: string) => {
      if (chunk.includes("\u0003")) {
        cleanup();
        reject(new Error("Operación cancelada."));
        return;
      }
      if (chunk.startsWith("\u001b")) return;

      for (const character of chunk) {
        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= " ") {
          value += character;
        }
      }
    };

    stdin.on("data", onData);
  });
}

async function main() {
  const usernameArg = readArgument("username") ?? process.env.ADMIN_USERNAME;
  const passwordEnv = process.env.ADMIN_PASSWORD;

  const db = await createDatabase();
  try {
    await runMigrations(db);
    const existingCount = await countAdmins(db);

    if (existingCount > 0 && !usernameArg) {
      const existing = await db.query<{ username: string }>(
        "SELECT username FROM admins ORDER BY created_at ASC LIMIT 1",
      );
      console.log(
        `Ya existe un administrador (${existing[0]?.username ?? "sin nombre"}).`,
      );
      console.log(
        "Para restablecer su contraseña, ejecutá nuevamente indicando el mismo usuario.",
      );
    }

    const username = (usernameArg || (await promptText("Usuario administrador: "))).trim();
    if (!isValidAdminUsername(username)) {
      throw new Error(
        "El usuario debe tener entre 3 y 64 caracteres y usar solo letras, números, punto, guion o guion bajo.",
      );
    }

    let password = passwordEnv ?? "";
    if (!password) {
      password = await promptHidden("Contraseña (mínimo 12 caracteres): ");
      const confirmation = await promptHidden("Repetí la contraseña: ");
      if (password !== confirmation) {
        throw new Error("Las contraseñas no coinciden.");
      }
    }

    if (!isValidAdminPassword(password)) {
      throw new Error("La contraseña debe tener entre 12 y 200 caracteres.");
    }

    const result = await createOrUpdateSingleAdmin(db, username, password);
    if (result.created) {
      console.log("Administrador creado correctamente.");
    } else {
      console.log("Contraseña actualizada correctamente. Las sesiones anteriores fueron cerradas.");
    }
    console.log("Guardá la contraseña en un gestor seguro: no se muestra ni se guarda en el proyecto.");
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  console.error(
    "No se pudo configurar el administrador:",
    error instanceof Error ? error.message : "error desconocido",
  );
  process.exit(1);
});
