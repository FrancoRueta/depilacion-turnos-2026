import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type {
  AdminMonthResponse,
  ApiErrorPayload,
  BookingConfirmation,
  PublicMonthResponse,
} from "../shared/types";
import { createApp } from "../server/app";
import { createOrUpdateSingleAdmin } from "../server/auth";
import { createDatabase } from "../server/db";
import { runMigrations } from "../server/migrations";

const NOW = new Date("2026-10-22T15:00:00-03:00");
const ADMIN_USER = "admin-pruebas";
const ADMIN_PASSWORD = "ClaveDePrueba-2026!";
const CSRF_HEADERS = { "x-admin-request": "turnos-admin" };

interface TestRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  cookie?: string;
  adminHeader?: boolean;
}

function bookingPayload(date: string, startTime: string, overrides: Record<string, unknown> = {}) {
  return {
    fullName: "María Pérez",
    age: 34,
    zones: ["axilas", "piernas"],
    phone: "+54 11 5555-5555",
    date,
    startTime,
    ...overrides,
  };
}

test("API de turnos: reservas, privacidad, concurrencia y administración", async (t) => {
  const db = await createDatabase({ memory: true });
  await runMigrations(db);
  await createOrUpdateSingleAdmin(db, ADMIN_USER, ADMIN_PASSWORD);

  const app = createApp({
    db,
    now: () => NOW,
    secureCookies: false,
    trustProxy: false,
    serveStatic: false,
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let sessionCookie = "";
  let dateAId = "";
  let dateBId = "";

  function request(path: string, options: TestRequestOptions = {}) {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.adminHeader) headers["x-admin-request"] = "turnos-admin";
    if (options.cookie) headers.Cookie = options.cookie;

    return fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  }

  async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T;
  }

  async function errorCode(response: Response): Promise<string> {
    const payload = await json<ApiErrorPayload>(response);
    return payload.error.code;
  }

  async function getAdminMonth(): Promise<AdminMonthResponse> {
    const response = await request("/api/admin/month/2026-10", { cookie: sessionCookie });
    assert.equal(response.status, 200);
    return json<AdminMonthResponse>(response);
  }

  try {
    await t.test("protege la administración sin sesión y sin la cabecera interna", async () => {
      const withoutSession = await request("/api/admin/dates", {
        method: "POST",
        body: {
          date: "2026-10-23",
          openTime: "08:00",
          closeTime: "10:00",
          active: true,
        },
        adminHeader: true,
      });
      assert.equal(withoutSession.status, 401);
      assert.equal(await errorCode(withoutSession), "SESSION_REQUIRED");

      const withoutInternalHeader = await request("/api/admin/dates", {
        method: "POST",
        body: {
          date: "2026-10-23",
          openTime: "08:00",
          closeTime: "10:00",
          active: true,
        },
      });
      assert.equal(withoutInternalHeader.status, 403);
      assert.equal(await errorCode(withoutInternalHeader), "INVALID_REQUEST_ORIGIN");

      const privateMonth = await request("/api/admin/month/2026-10");
      assert.equal(privateMonth.status, 401);
      assert.equal(await errorCode(privateMonth), "SESSION_REQUIRED");
    });

    await t.test("inicia sesión con credenciales válidas y cookie HttpOnly", async () => {
      const response = await request("/api/admin/session", {
        method: "POST",
        body: { username: ADMIN_USER, password: ADMIN_PASSWORD },
        adminHeader: true,
      });
      assert.equal(response.status, 200);
      const setCookie = response.headers.get("set-cookie");
      assert.ok(setCookie, "La respuesta debe incluir la cookie de sesión");
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /SameSite=Strict/i);
      assert.match(setCookie, /Path=\/api\/admin/i);
      sessionCookie = setCookie.split(";")[0];

      const body = await json<{ authenticated: boolean; username: string }>(response);
      assert.deepEqual(body, { authenticated: true, username: ADMIN_USER });
    });

    await t.test("valida y crea fechas de atención", async () => {
      const invalidWeekday = await request("/api/admin/dates", {
        method: "POST",
        body: {
          date: "2026-10-26",
          openTime: "08:00",
          closeTime: "10:00",
          active: true,
        },
        cookie: sessionCookie,
        adminHeader: true,
      });
      assert.equal(invalidWeekday.status, 400);
      assert.equal(await errorCode(invalidWeekday), "VALIDATION_ERROR");

      const pastDate = await request("/api/admin/dates", {
        method: "POST",
        body: {
          date: "2026-10-16",
          openTime: "08:00",
          closeTime: "10:00",
          active: true,
        },
        cookie: sessionCookie,
        adminHeader: true,
      });
      assert.equal(pastDate.status, 400);

      const outsideWindow = await request("/api/admin/dates", {
        method: "POST",
        body: {
          date: "2026-10-23",
          openTime: "05:30",
          closeTime: "22:30",
          active: true,
        },
        cookie: sessionCookie,
        adminHeader: true,
      });
      assert.equal(outsideWindow.status, 400);

      const firstDate = await request("/api/admin/dates", {
        method: "POST",
        body: {
          date: "2026-10-23",
          openTime: "08:00",
          closeTime: "10:00",
          active: true,
        },
        cookie: sessionCookie,
        adminHeader: true,
      });
      assert.equal(firstDate.status, 201);
      dateAId = (await json<{ id: string }>(firstDate)).id;

      const secondDate = await request("/api/admin/dates", {
        method: "POST",
        body: {
          date: "2026-10-24",
          openTime: "08:00",
          closeTime: "10:00",
          active: true,
        },
        cookie: sessionCookie,
        adminHeader: true,
      });
      assert.equal(secondDate.status, 201);
      dateBId = (await json<{ id: string }>(secondDate)).id;

      const duplicate = await request("/api/admin/dates", {
        method: "POST",
        body: {
          date: "2026-10-23",
          openTime: "08:00",
          closeTime: "10:00",
          active: true,
        },
        cookie: sessionCookie,
        adminHeader: true,
      });
      assert.equal(duplicate.status, 409);
      assert.equal(await errorCode(duplicate), "DATE_EXISTS");
    });

    await t.test("crea una reserva real y no expone datos privados al público", async () => {
      const response = await request("/api/public/bookings", {
        method: "POST",
        body: bookingPayload("2026-10-23", "08:00"),
      });
      assert.equal(response.status, 201);
      const confirmation = await json<BookingConfirmation>(response);
      assert.deepEqual(Object.keys(confirmation).sort(), ["createdAt", "date", "startTime"]);
      assert.equal(confirmation.date, "2026-10-23");
      assert.equal(confirmation.startTime, "08:00");

      const publicResponse = await request("/api/public/month/2026-10");
      assert.equal(publicResponse.status, 200);
      const publicBody = await json<PublicMonthResponse>(publicResponse);
      assert.deepEqual(Object.keys(publicBody).sort(), ["dates", "month"]);
      assert.equal(publicBody.dates.length, 2);

      const firstDate = publicBody.dates.find((item) => item.date === "2026-10-23");
      assert.ok(firstDate);
      assert.deepEqual(Object.keys(firstDate).sort(), ["closeTime", "date", "openTime", "slots"]);
      assert.equal(firstDate.slots.length, 4);
      const bookedSlot = firstDate.slots.find((slot) => slot.time === "08:00");
      assert.deepEqual(bookedSlot, { time: "08:00", status: "booked", initials: "M. P." });
      assert.deepEqual(firstDate.slots[1], { time: "08:30", status: "available" });

      const publicJson = JSON.stringify(publicBody);
      for (const privateValue of ["María", "Pérez", "5555-5555", "axilas", "piernas"]) {
        assert.ok(
          !publicJson.includes(privateValue),
          `La respuesta pública no debe incluir "${privateValue}"`,
        );
      }

      const adminResponse = await request("/api/admin/month/2026-10", {
        cookie: sessionCookie,
      });
      assert.equal(adminResponse.status, 200);
      const adminBody = await json<AdminMonthResponse>(adminResponse);
      const adminBooking = adminBody.dates
        .flatMap((item) => item.bookings)
        .find((item) => item.date === "2026-10-23" && item.startTime === "08:00");
      assert.ok(adminBooking);
      assert.equal(adminBooking.fullName, "María Pérez");
      assert.equal(adminBooking.phone, "+54 11 5555-5555");
      assert.deepEqual(adminBooking.zones, ["axilas", "piernas"]);
    });

    await t.test("rechaza duplicados, fechas no habilitadas y horarios inválidos", async () => {
      const duplicate = await request("/api/public/bookings", {
        method: "POST",
        body: bookingPayload("2026-10-23", "08:00"),
      });
      assert.equal(duplicate.status, 409);
      assert.equal(await errorCode(duplicate), "SLOT_TAKEN");

      const unavailableDate = await request("/api/public/bookings", {
        method: "POST",
        body: bookingPayload("2026-10-25", "08:00"),
      });
      assert.equal(unavailableDate.status, 409);
      assert.equal(await errorCode(unavailableDate), "DATE_UNAVAILABLE");

      const unaligned = await request("/api/public/bookings", {
        method: "POST",
        body: bookingPayload("2026-10-23", "08:15"),
      });
      assert.equal(unaligned.status, 409);
      assert.equal(await errorCode(unaligned), "SLOT_UNAVAILABLE");

      const outsideHours = await request("/api/public/bookings", {
        method: "POST",
        body: bookingPayload("2026-10-23", "10:00"),
      });
      assert.equal(outsideHours.status, 409);
      assert.equal(await errorCode(outsideHours), "SLOT_UNAVAILABLE");

      const invalidFields = await request("/api/public/bookings", {
        method: "POST",
        body: bookingPayload("2026-10-23", "09:30", {
          fullName: "",
          age: 0,
          zones: [],
          phone: "abc",
        }),
      });
      assert.equal(invalidFields.status, 400);
      const payload = await json<ApiErrorPayload>(invalidFields);
      assert.equal(payload.error.code, "VALIDATION_ERROR");
      assert.ok(payload.error.fields?.fullName);
      assert.ok(payload.error.fields?.age);
      assert.ok(payload.error.fields?.zones);
      assert.ok(payload.error.fields?.phone);
    });

    await t.test("impide dos reservas concurrentes en el mismo horario", async () => {
      const first = request("/api/public/bookings", {
        method: "POST",
        body: bookingPayload("2026-10-23", "08:30", {
          fullName: "Lucía Gómez",
          age: 29,
          zones: ["brazos"],
          phone: "11 4444-4444",
        }),
      });
      const second = request("/api/public/bookings", {
        method: "POST",
        body: bookingPayload("2026-10-23", "08:30", {
          fullName: "Carolina Díaz",
          age: 41,
          zones: ["espalda"],
          phone: "11 6666-6666",
        }),
      });

      const [firstResponse, secondResponse] = await Promise.all([first, second]);
      const statuses = [firstResponse.status, secondResponse.status].sort((a, b) => a - b);
      assert.deepEqual(statuses, [201, 409]);
      const conflict = firstResponse.status === 409 ? firstResponse : secondResponse;
      assert.equal(await errorCode(conflict), "SLOT_TAKEN");

      const publicResponse = await request("/api/public/month/2026-10");
      const publicBody = await json<PublicMonthResponse>(publicResponse);
      const slot = publicBody.dates
        .find((item) => item.date === "2026-10-23")
        ?.slots.find((item) => item.time === "08:30");
      assert.equal(slot?.status, "booked");
      assert.match(slot?.initials ?? "", /^[A-Z]\.(?:\s[A-Z]\.)?$/);
    });

    await t.test("impide eliminar, desactivar o recortar fechas con reservas", async () => {
      const deleteWithBookings = await request(`/api/admin/dates/${dateAId}`, {
        method: "DELETE",
        cookie: sessionCookie,
        adminHeader: true,
      });
      assert.equal(deleteWithBookings.status, 409);
      assert.equal(await errorCode(deleteWithBookings), "DATE_HAS_BOOKINGS");

      const shrinkRange = await request(`/api/admin/dates/${dateAId}`, {
        method: "PATCH",
        body: {
          date: "2026-10-23",
          openTime: "08:30",
          closeTime: "10:00",
          active: true,
        },
        cookie: sessionCookie,
        adminHeader: true,
      });
      assert.equal(shrinkRange.status, 409);
      assert.equal(await errorCode(shrinkRange), "DATE_CHANGE_INVALIDATES_BOOKINGS");

      const deactivate = await request(`/api/admin/dates/${dateAId}`, {
        method: "PATCH",
        body: {
          date: "2026-10-23",
          openTime: "08:00",
          closeTime: "10:00",
          active: false,
        },
        cookie: sessionCookie,
        adminHeader: true,
      });
      assert.equal(deactivate.status, 409);
      assert.equal(await errorCode(deactivate), "DATE_HAS_BOOKINGS");
    });

    await t.test("permite reubicar reservas y protege el horario de destino", async () => {
      const adminBody = await getAdminMonth();
      const dateA = adminBody.dates.find((item) => item.date === "2026-10-23");
      assert.ok(dateA);
      const firstBooking = dateA.bookings.find((item) => item.startTime === "08:00");
      const concurrentBooking = dateA.bookings.find((item) => item.startTime === "08:30");
      assert.ok(firstBooking);
      assert.ok(concurrentBooking);

      const moveFirst = await request(`/api/admin/bookings/${firstBooking.id}`, {
        method: "PATCH",
        body: bookingPayload("2026-10-24", "08:00"),
        cookie: sessionCookie,
        adminHeader: true,
      });
      assert.equal(moveFirst.status, 200);

      const targetConflict = await request(`/api/admin/bookings/${concurrentBooking.id}`, {
        method: "PATCH",
        body: bookingPayload("2026-10-24", "08:00", { fullName: "Lucía Gómez" }),
        cookie: sessionCookie,
        adminHeader: true,
      });
      assert.equal(targetConflict.status, 409);
      assert.equal(await errorCode(targetConflict), "SLOT_TAKEN");

      const moveConcurrent = await request(`/api/admin/bookings/${concurrentBooking.id}`, {
        method: "PATCH",
        body: bookingPayload("2026-10-24", "08:30", {
          fullName: "Lucía Gómez",
          age: 29,
          zones: ["brazos"],
          phone: "11 4444-4444",
        }),
        cookie: sessionCookie,
        adminHeader: true,
      });
      assert.equal(moveConcurrent.status, 200);

      const publicAfterMove = await json<PublicMonthResponse>(
        await request("/api/public/month/2026-10"),
      );
      const oldDate = publicAfterMove.dates.find((item) => item.date === "2026-10-23");
      const newDate = publicAfterMove.dates.find((item) => item.date === "2026-10-24");
      assert.equal(oldDate?.slots.find((slot) => slot.time === "08:00")?.status, "available");
      assert.equal(newDate?.slots.find((slot) => slot.time === "08:00")?.status, "booked");
      assert.equal(newDate?.slots.find((slot) => slot.time === "08:30")?.status, "booked");
    });

    await t.test("cancela reservas, libera horarios y elimina fechas sin reservas", async () => {
      const adminBody = await getAdminMonth();
      const dateA = adminBody.dates.find((item) => item.date === "2026-10-23");
      const dateB = adminBody.dates.find((item) => item.date === "2026-10-24");
      assert.ok(dateA);
      assert.ok(dateB);
      assert.equal(dateA.bookings.length, 0);
      assert.equal(dateB.bookings.length, 2);

      const deleteFreeDate = await request(`/api/admin/dates/${dateAId}`, {
        method: "DELETE",
        cookie: sessionCookie,
        adminHeader: true,
      });
      assert.equal(deleteFreeDate.status, 204);

      const secondBooking = dateB.bookings.find((item) => item.startTime === "08:30");
      assert.ok(secondBooking);
      const cancelSecond = await request(`/api/admin/bookings/${secondBooking.id}`, {
        method: "DELETE",
        cookie: sessionCookie,
        adminHeader: true,
      });
      assert.equal(cancelSecond.status, 204);

      const publicBody = await json<PublicMonthResponse>(
        await request("/api/public/month/2026-10"),
      );
      assert.equal(publicBody.dates.some((item) => item.date === "2026-10-23"), false);
      assert.equal(
        publicBody.dates
          .find((item) => item.date === "2026-10-24")
          ?.slots.find((slot) => slot.time === "08:30")?.status,
        "available",
      );

      const firstBooking = dateB.bookings.find((item) => item.startTime === "08:00");
      assert.ok(firstBooking);
      const cancelFirst = await request(`/api/admin/bookings/${firstBooking.id}`, {
        method: "DELETE",
        cookie: sessionCookie,
        adminHeader: true,
      });
      assert.equal(cancelFirst.status, 204);

      const deleteSecondDate = await request(`/api/admin/dates/${dateBId}`, {
        method: "DELETE",
        cookie: sessionCookie,
        adminHeader: true,
      });
      assert.equal(deleteSecondDate.status, 204);
    });

    await t.test("exige la cabecera interna en cada mutación administrativa", async () => {
      const response = await request("/api/admin/bookings/00000000-0000-4000-8000-000000000000", {
        method: "DELETE",
        cookie: sessionCookie,
      });
      assert.equal(response.status, 403);
      assert.equal(await errorCode(response), "INVALID_REQUEST_ORIGIN");
    });

    await t.test("cierra la sesión y rechaza credenciales incorrectas", async () => {
      const logout = await request("/api/admin/session", {
        method: "DELETE",
        cookie: sessionCookie,
        adminHeader: true,
      });
      assert.equal(logout.status, 204);

      const protectedAfterLogout = await request("/api/admin/month/2026-10", {
        cookie: sessionCookie,
      });
      assert.equal(protectedAfterLogout.status, 401);

      const wrongLogin = await request("/api/admin/session", {
        method: "POST",
        body: { username: ADMIN_USER, password: "ClaveIncorrecta-2026" },
        adminHeader: true,
      });
      assert.equal(wrongLogin.status, 401);
      assert.equal(await errorCode(wrongLogin), "INVALID_CREDENTIALS");
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await db.close();
  }
});
