import {
  ADMIN_REQUEST_HEADER,
  ADMIN_REQUEST_HEADER_VALUE,
} from "../shared/constants";
import type {
  AdminBookingPayload,
  AdminDatePayload,
  AdminMonthResponse,
  AdminSessionResponse,
  ApiErrorPayload,
  BookingConfirmation,
  BookingDetails,
  FieldErrors,
  PublicMonthResponse,
} from "../shared/types";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: FieldErrors;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: FieldErrors,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.details = details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  admin?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.admin) headers[ADMIN_REQUEST_HEADER] = ADMIN_REQUEST_HEADER_VALUE;

  try {
    const response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: "same-origin",
      signal: controller.signal,
    });

    if (!response.ok) {
      let payload: ApiErrorPayload | null = null;
      try {
        payload = (await response.json()) as ApiErrorPayload;
      } catch {
        // Respuesta sin JSON comprensible.
      }
      throw new ApiRequestError(
        response.status,
        payload?.error?.code ?? "HTTP_ERROR",
        payload?.error?.message ?? "No pudimos completar la solicitud. Intentá nuevamente.",
        payload?.error?.fields,
        payload?.error?.details,
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiRequestError(
        0,
        "TIMEOUT",
        "La conexión tardó demasiado. Revisá tu conexión e intentá nuevamente.",
      );
    }
    throw new ApiRequestError(
      0,
      "NETWORK_ERROR",
      "No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.",
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

export const api = {
  getPublicMonth(month: string): Promise<PublicMonthResponse> {
    return request(`/api/public/month/${encodeURIComponent(month)}`);
  },

  createBooking(payload: BookingDetails & { date: string; startTime: string }): Promise<BookingConfirmation> {
    return request("/api/public/bookings", { method: "POST", body: payload });
  },

  getAdminSession(): Promise<AdminSessionResponse> {
    return request("/api/admin/session", { admin: true });
  },

  login(username: string, password: string): Promise<AdminSessionResponse> {
    return request("/api/admin/session", {
      method: "POST",
      body: { username, password },
      admin: true,
    });
  },

  logout(): Promise<void> {
    return request("/api/admin/session", { method: "DELETE", admin: true });
  },

  getAdminMonth(month: string): Promise<AdminMonthResponse> {
    return request(`/api/admin/month/${encodeURIComponent(month)}`, { admin: true });
  },

  createDate(payload: AdminDatePayload): Promise<{ id: string }> {
    return request("/api/admin/dates", { method: "POST", body: payload, admin: true });
  },

  updateDate(id: string, payload: AdminDatePayload): Promise<{ ok: boolean }> {
    return request(`/api/admin/dates/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: payload,
      admin: true,
    });
  },

  deleteDate(id: string): Promise<void> {
    return request(`/api/admin/dates/${encodeURIComponent(id)}`, {
      method: "DELETE",
      admin: true,
    });
  },

  updateBooking(id: string, payload: AdminBookingPayload): Promise<{ ok: boolean }> {
    return request(`/api/admin/bookings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: payload,
      admin: true,
    });
  },

  deleteBooking(id: string): Promise<void> {
    return request(`/api/admin/bookings/${encodeURIComponent(id)}`, {
      method: "DELETE",
      admin: true,
    });
  },
};
