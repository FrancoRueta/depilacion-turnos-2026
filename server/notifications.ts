import { formatLongDateCapitalized } from "../shared/dates";

/**
 * Datos mínimos que se envían al administrador. A propósito no incluye nombre,
 * teléfono, edad ni zonas: el aviso solo sirve para enterarse de que hay un
 * turno nuevo y revisarlo en el panel.
 */
export interface BookingNotification {
  date: string;
  startTime: string;
}

export type BookingNotifier = (booking: BookingNotification) => Promise<void>;

export interface FetchResponseLike {
  ok: boolean;
  status: number;
}

export type FetchLike = (
  url: string,
  init: { method: "GET"; signal: AbortSignal },
) => Promise<FetchResponseLike>;

export interface CallMeBotNotifierOptions {
  phone?: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  logError?: (message: string) => void;
}

const CALLMEBOT_ENDPOINT = "https://api.callmebot.com/whatsapp.php";
const DEFAULT_TIMEOUT_MS = 5_000;

export function buildCallMeBotUrl(phone: string, apiKey: string, text: string): string {
  const url = new URL(CALLMEBOT_ENDPOINT);
  url.searchParams.set("phone", phone);
  url.searchParams.set("text", text);
  url.searchParams.set("apikey", apiKey);
  return url.toString();
}

export function bookingNotificationText(booking: BookingNotification): string {
  return `Nuevo turno reservado: ${formatLongDateCapitalized(booking.date)} a las ${booking.startTime}. Entrá al panel para ver los datos.`;
}

/**
 * Crea el notificador de CallMeBot. Devuelve null si falta el teléfono o la
 * API key, para que la aplicación funcione igual sin avisos configurados.
 *
 * El notificador nunca lanza: absorbe timeouts y errores de red. La reserva ya
 * está confirmada cuando se invoca y no debe depender de WhatsApp.
 */
export function createCallMeBotNotifier(
  options: CallMeBotNotifierOptions,
): BookingNotifier | null {
  const phone = options.phone?.trim();
  const apiKey = options.apiKey?.trim();
  if (!phone || !apiKey) return null;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const logError = options.logError ?? ((message: string) => console.error(message));

  return async (booking) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(
        buildCallMeBotUrl(phone, apiKey, bookingNotificationText(booking)),
        { method: "GET", signal: controller.signal },
      );
      if (!response.ok) {
        logError(`CallMeBot respondió con estado ${response.status}.`);
      }
    } catch (error) {
      logError(
        error instanceof Error && error.name === "AbortError"
          ? "El aviso por WhatsApp superó el tiempo de espera."
          : "No se pudo enviar el aviso por WhatsApp.",
      );
    } finally {
      clearTimeout(timer);
    }
  };
}
