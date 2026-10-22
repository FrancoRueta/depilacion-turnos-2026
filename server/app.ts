import { existsSync } from "node:fs";
import path from "node:path";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import {
  ADMIN_REQUEST_HEADER,
  ADMIN_REQUEST_HEADER_VALUE,
  ADMIN_SESSION_COOKIE,
  SESSION_DURATION_HOURS,
} from "../shared/constants";
import { isValidMonthString } from "../shared/dates";
import type { AdminSessionResponse, ApiErrorPayload } from "../shared/types";
import {
  authenticateAdmin,
  countAdmins,
  createAdminSession,
  findSessionAdmin,
  isValidAdminUsername,
  revokeSession,
  type AdminIdentity,
} from "./auth";
import { config } from "./config";
import type { Database } from "./db";
import { ApiError, isApiError, validationError } from "./errors";
import { isValidUuid } from "./ids";
import {
  createPublicBooking,
  deleteAdminBooking,
  updateAdminBooking,
} from "./services/bookings";
import { getAdminMonth, getPublicMonth } from "./services/schedule";
import {
  createServiceDate,
  deleteServiceDate,
  updateServiceDate,
} from "./services/service-dates";

export interface CreateAppOptions {
  db: Database;
  now?: () => Date;
  secureCookies?: boolean;
  trustProxy?: boolean;
  serveStatic?: boolean;
  staticDir?: string;
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

function asyncHandler(handler: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

interface LoginAttempt {
  failures: number;
  blockedUntil: number;
}

function createLoginLimiter() {
  const attempts = new Map<string, LoginAttempt>();
  const windowMs = 15 * 60 * 1000;
  const maxFailures = 5;

  function prune(now: number) {
    if (attempts.size < 500) return;
    for (const [key, value] of attempts) {
      if (value.blockedUntil < now) attempts.delete(key);
    }
  }

  return {
    check(key: string, now = Date.now()): number | null {
      const attempt = attempts.get(key);
      if (!attempt) return null;
      if (attempt.blockedUntil > now) return Math.ceil((attempt.blockedUntil - now) / 1000);
      if (attempt.blockedUntil !== 0) attempts.delete(key);
      return null;
    },
    fail(key: string, now = Date.now()) {
      prune(now);
      const current = attempts.get(key);
      const failures = (current?.failures ?? 0) + 1;
      attempts.set(key, {
        failures,
        blockedUntil: failures >= maxFailures ? now + windowMs : 0,
      });
    },
    reset(key: string) {
      attempts.delete(key);
    },
  };
}

function sendApiError(res: Response, error: ApiError): void {
  const payload: ApiErrorPayload = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
      ...(error.details ? { details: error.details } : {}),
    },
  };
  res.status(error.status).json(payload);
}

function setSessionCookie(
  res: Response,
  token: string,
  secure: boolean,
): void {
  res.cookie(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/api/admin",
    maxAge: SESSION_DURATION_HOURS * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res: Response, secure: boolean): void {
  res.clearCookie(ADMIN_SESSION_COOKIE, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/api/admin",
  });
}

function getCookieToken(req: Request): string | null {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE];
  return typeof token === "string" && token.length > 0 ? token : null;
}

function ensureUuid(value: string): string {
  if (!isValidUuid(value)) {
    throw validationError({ id: "El identificador no es válido." });
  }
  return value;
}

export function createApp(options: CreateAppOptions): express.Express {
  const db = options.db;
  const now = options.now ?? (() => new Date());
  const secureCookies = options.secureCookies ?? config.cookieSecure;
  const trustProxy = options.trustProxy ?? config.trustProxy;
  const loginLimiter = createLoginLimiter();

  const app = express();
  app.disable("x-powered-by");
  if (trustProxy) app.set("trust proxy", 1);

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    if (config.isProduction) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      res.setHeader(
        "Content-Security-Policy",
        [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "font-src 'self'",
          "connect-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "object-src 'none'",
        ].join("; "),
      );
    }
    next();
  });

  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get(
    "/api/public/month/:month",
    asyncHandler(async (req, res) => {
      const month = req.params.month;
      if (!isValidMonthString(month)) {
        throw validationError({ month: "El mes debe tener el formato AAAA-MM." });
      }
      const data = await getPublicMonth(db, month, now());
      res.json(data);
    }),
  );

  app.post(
    "/api/public/bookings",
    asyncHandler(async (req, res) => {
      const confirmation = await createPublicBooking(db, req.body, now());
      res.status(201).json(confirmation);
    }),
  );

  app.use("/api/admin", (req, _res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.get(ADMIN_REQUEST_HEADER) !== ADMIN_REQUEST_HEADER_VALUE) {
        return next(
          new ApiError(
            403,
            "INVALID_REQUEST_ORIGIN",
            "La solicitud de administración no es válida.",
          ),
        );
      }
    }
    next();
  });

  app.post(
    "/api/admin/session",
    asyncHandler(async (req, res) => {
      const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!username || !password) {
        throw validationError({
          username: username ? "" : "Ingresá el usuario.",
          password: password ? "" : "Ingresá la contraseña.",
        });
      }
      if (username.length > 64 || password.length > 200) {
        throw new ApiError(401, "INVALID_CREDENTIALS", "Usuario o contraseña incorrectos.");
      }

      const limiterKey = `${req.ip ?? "sin-ip"}|${username.toLowerCase()}`;
      const retryAfter = loginLimiter.check(limiterKey);
      if (retryAfter !== null) {
        res.setHeader("Retry-After", String(retryAfter));
        throw new ApiError(
          429,
          "RATE_LIMITED",
          "Demasiados intentos. Esperá unos minutos antes de volver a intentar.",
        );
      }

      const admins = await countAdmins(db);
      if (admins === 0) {
        throw new ApiError(
          503,
          "ADMIN_NOT_CONFIGURED",
          "La administración todavía no está configurada. Consultá el instructivo de instalación.",
        );
      }

      if (!isValidAdminUsername(username)) {
        loginLimiter.fail(limiterKey);
        throw new ApiError(401, "INVALID_CREDENTIALS", "Usuario o contraseña incorrectos.");
      }

      const admin = await authenticateAdmin(db, username, password);
      if (!admin) {
        loginLimiter.fail(limiterKey);
        throw new ApiError(401, "INVALID_CREDENTIALS", "Usuario o contraseña incorrectos.");
      }

      loginLimiter.reset(limiterKey);
      const session = await createAdminSession(db, admin.id);
      setSessionCookie(res, session.token, secureCookies);
      const response: AdminSessionResponse = { authenticated: true, username: admin.username };
      res.json(response);
    }),
  );

  app.delete(
    "/api/admin/session",
    asyncHandler(async (req, res) => {
      const token = getCookieToken(req);
      if (token) await revokeSession(db, token);
      clearSessionCookie(res, secureCookies);
      res.status(204).end();
    }),
  );

  app.get(
    "/api/admin/session",
    asyncHandler(async (req, res) => {
      const token = getCookieToken(req);
      const response: AdminSessionResponse = { authenticated: false };
      if (!token) {
        res.json(response);
        return;
      }
      const admin = await findSessionAdmin(db, token);
      if (!admin) {
        clearSessionCookie(res, secureCookies);
        res.json(response);
        return;
      }
      res.json({ authenticated: true, username: admin.username });
    }),
  );

  const requireAdmin = asyncHandler(async (req, res, next) => {
    const token = getCookieToken(req);
    if (!token) {
      throw new ApiError(401, "SESSION_REQUIRED", "Iniciá sesión para continuar.");
    }
    const admin = await findSessionAdmin(db, token);
    if (!admin) {
      clearSessionCookie(res, secureCookies);
      throw new ApiError(
        401,
        "SESSION_EXPIRED",
        "Tu sesión venció. Volvé a iniciar sesión para continuar.",
      );
    }
    (res.locals as { admin?: AdminIdentity }).admin = admin;
    next();
  });

  app.get(
    "/api/admin/month/:month",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const month = req.params.month;
      if (!isValidMonthString(month)) {
        throw validationError({ month: "El mes debe tener el formato AAAA-MM." });
      }
      const data = await getAdminMonth(db, month);
      res.json(data);
    }),
  );

  app.post(
    "/api/admin/dates",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const created = await createServiceDate(db, req.body, now());
      res.status(201).json(created);
    }),
  );

  app.patch(
    "/api/admin/dates/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      await updateServiceDate(db, ensureUuid(req.params.id), req.body, now());
      res.json({ ok: true });
    }),
  );

  app.delete(
    "/api/admin/dates/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      await deleteServiceDate(db, ensureUuid(req.params.id));
      res.status(204).end();
    }),
  );

  app.patch(
    "/api/admin/bookings/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      await updateAdminBooking(db, ensureUuid(req.params.id), req.body, now());
      res.json({ ok: true });
    }),
  );

  app.delete(
    "/api/admin/bookings/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      await deleteAdminBooking(db, ensureUuid(req.params.id));
      res.status(204).end();
    }),
  );

  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "El recurso solicitado no existe." },
    } satisfies ApiErrorPayload);
  });

  const staticDir = path.resolve(options.staticDir ?? path.join(process.cwd(), "dist"));
  const indexPath = path.join(staticDir, "index.html");
  const shouldServeStatic = options.serveStatic ?? existsSync(indexPath);
  if (shouldServeStatic && existsSync(indexPath)) {
    app.use(
      express.static(staticDir, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          } else {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      }),
    );
    app.get("*", (req, res, next) => {
      if (!req.accepts("html")) {
        next();
        return;
      }
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(indexPath);
    });
  }

  app.use((_req, res) => {
    res.status(404).send("No encontrado");
  });

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (isApiError(error)) {
      sendApiError(res, error);
      return;
    }

    const expressError = error as { type?: string; status?: number };
    if (expressError?.type === "entity.parse.failed") {
      sendApiError(res, new ApiError(400, "INVALID_JSON", "La solicitud no tiene un formato válido."));
      return;
    }
    if (expressError?.type === "entity.too.large") {
      sendApiError(res, new ApiError(413, "PAYLOAD_TOO_LARGE", "La solicitud es demasiado grande."));
      return;
    }

    console.error(
      `Error interno no controlado en ${req.method} ${req.path}:`,
      error instanceof Error ? error.name : "desconocido",
    );
    sendApiError(
      res,
      new ApiError(500, "INTERNAL_ERROR", "Ocurrió un error inesperado. Intentá nuevamente."),
    );
  });

  return app;
}
