import test from "node:test";
import assert from "node:assert/strict";
import {
  bookingNotificationText,
  buildCallMeBotUrl,
  createCallMeBotNotifier,
} from "../server/notifications";

test("el aviso incluye fecha y hora y no datos personales", () => {
  const text = bookingNotificationText({ date: "2026-10-23", startTime: "08:00" });
  assert.match(text, /Viernes 23 de octubre de 2026/);
  assert.match(text, /08:00/);
  for (const privateValue of ["María", "Pérez", "5555", "axilas", "piernas"]) {
    assert.ok(!text.includes(privateValue), `El aviso no debe incluir "${privateValue}"`);
  }
});

test("la URL de CallMeBot incluye y codifica los parámetros", () => {
  const url = new URL(buildCallMeBotUrl("+5491123456789", "clave 123&x", "Hola & chau"));
  assert.equal(url.origin + url.pathname, "https://api.callmebot.com/whatsapp.php");
  assert.equal(url.searchParams.get("phone"), "+5491123456789");
  assert.equal(url.searchParams.get("apikey"), "clave 123&x");
  assert.equal(url.searchParams.get("text"), "Hola & chau");
});

test("sin teléfono o API key el notificador queda desactivado", () => {
  assert.equal(createCallMeBotNotifier({}), null);
  assert.equal(createCallMeBotNotifier({ phone: "+5491123456789" }), null);
  assert.equal(createCallMeBotNotifier({ apiKey: "abc" }), null);
  assert.equal(createCallMeBotNotifier({ phone: "  ", apiKey: "  " }), null);
});

test("envía el aviso a CallMeBot con el texto esperado", async () => {
  const calls: string[] = [];
  const notifier = createCallMeBotNotifier({
    phone: "+5491123456789",
    apiKey: "secreta",
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, status: 200 };
    },
  });
  assert.ok(notifier);

  await notifier({ date: "2026-10-23", startTime: "08:00" });

  assert.equal(calls.length, 1);
  const url = new URL(calls[0]);
  assert.equal(url.searchParams.get("phone"), "+5491123456789");
  assert.equal(url.searchParams.get("apikey"), "secreta");
  assert.match(url.searchParams.get("text") ?? "", /Viernes 23 de octubre de 2026/);
  assert.match(url.searchParams.get("text") ?? "", /08:00/);
});

test("absorbe respuestas de error y fallos de red", async () => {
  const logs: string[] = [];
  const failedResponse = createCallMeBotNotifier({
    phone: "+5491123456789",
    apiKey: "secreta",
    fetchImpl: async () => ({ ok: false, status: 500 }),
    logError: (message) => logs.push(message),
  });
  assert.ok(failedResponse);
  await failedResponse({ date: "2026-10-23", startTime: "08:00" });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /500/);

  const networkFailure = createCallMeBotNotifier({
    phone: "+5491123456789",
    apiKey: "secreta",
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
    logError: (message) => logs.push(message),
  });
  assert.ok(networkFailure);
  await networkFailure({ date: "2026-10-24", startTime: "09:00" });
  assert.equal(logs.length, 2);
  assert.match(logs[1], /No se pudo enviar/);
});

test("corta el aviso si CallMeBot no responde a tiempo", async () => {
  const logs: string[] = [];
  const notifier = createCallMeBotNotifier({
    phone: "+5491123456789",
    apiKey: "secreta",
    timeoutMs: 10,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
    logError: (message) => logs.push(message),
  });
  assert.ok(notifier);

  await notifier({ date: "2026-10-23", startTime: "08:00" });

  assert.equal(logs.length, 1);
  assert.match(logs[0], /tiempo de espera/);
});
